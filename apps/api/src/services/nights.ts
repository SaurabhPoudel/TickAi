import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import type { Night, User } from "../db/schema.js";
import { addDays } from "../lib/days.js";
import { moonPhase, nextStreak } from "../lib/streak.js";
export { moonPhase } from "../lib/streak.js";
import * as tasks from "./tasks.js";

export async function openFor(user: User, day: string): Promise<Night> {
  const [existing] = await db.select().from(schema.nights)
    .where(and(eq(schema.nights.userId, user.id), eq(schema.nights.day, day)));
  if (existing) return existing;
  const [created] = await db.insert(schema.nights).values({ userId: user.id, day }).onConflictDoNothing().returning();
  return created ?? (await openFor(user, day));
}

/** Ends the night: carries anything still open, updates the streak, stores the summary. */
export async function close(user: User, night: Night, preview?: string | null) {
  const today = await tasks.forDay(user.id, night.day);
  let carried = 0;
  for (const t of today) {
    if (t.status !== "open") continue;
    await tasks.carry(user, t);
    carried += 1;
  }
  await carryUnboughtItems(user, night.day, today);

  const done = today.filter((t) => t.status === "done").length;
  const dropped = today.filter((t) => t.status === "dropped").length;
  const s = nextStreak(user, night.day);

  const tomorrow = await tasks.forDay(user.id, addDays(night.day, 1));
  const tomorrowPreview = preview ?? defaultPreview(tomorrow);

  const [closed] = await db.update(schema.nights).set({
    closedAt: new Date(), doneCount: done, carriedCount: carried + night.carriedCount,
    droppedCount: dropped, usedGrace: s.usedGrace, tomorrowPreview,
  }).where(eq(schema.nights.id, night.id)).returning();

  const [u] = await db.update(schema.users).set({
    streak: s.streak, graceNights: s.graceNights, fullMoons: s.fullMoons, bestStreak: s.bestStreak, lastClosedDay: s.lastClosedDay,
  }).where(eq(schema.users.id, user.id)).returning();

  return { night: closed, user: u, earnedMoon: s.earnedMoon, phase: moonPhase(u.streak) };
}

/** Things on a finished shopping list that weren't bought roll into tomorrow's list. */
async function carryUnboughtItems(user: User, day: string, today: tasks.TaskWithItems[]) {
  const leftovers = today
    .filter((t) => t.kind === "shopping" && t.status === "done")
    .flatMap((t) => t.items.filter((i) => !i.checked && !i.suggested));
  if (!leftovers.length) return;
  await tasks.createFromDrafts(user, [{
    title: "Pick up what you missed", kind: "shopping", day: addDays(day, 1),
    items: leftovers.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
  }]);
}

function defaultPreview(list: { title: string; startTime: string | null }[]) {
  if (!list.length) return "Tomorrow is wide open.";
  const first = [...list].sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"))[0];
  const rest = list.length - 1;
  const lead = first.startTime ? `${first.title} at ${first.startTime}` : first.title;
  return rest ? `Tomorrow starts with ${lead}, plus ${rest} more.` : `Tomorrow: ${lead}.`;
}

export async function history(userId: string, limit = 35) {
  return db.select().from(schema.nights).where(eq(schema.nights.userId, userId))
    .orderBy(desc(schema.nights.day)).limit(limit);
}
