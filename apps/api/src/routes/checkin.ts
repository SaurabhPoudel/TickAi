import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import type { ChatTurn, User } from "../db/schema.js";
import { checkinTurn, refsFor } from "../ai/checkin.js";
import { addDays, localClock, logicalToday } from "../lib/days.js";
import * as nights from "../services/nights.js";
import * as pantry from "../services/pantry.js";
import * as tasks from "../services/tasks.js";

function opener(name: string | null, hour: number, open: { title: string }[], doneCount: number) {
  const word = hour >= 4 && hour < 12 ? "Morning" : hour < 17 && hour >= 12 ? "Hey" : "Evening";
  const hi = name ? `${word}, ${name}.` : `${word}.`;
  if (!open.length && doneCount) return `${hi} You checked off everything today. Anything to add for tomorrow?`;
  if (!open.length) return `${hi} Nothing was on the list today. Anything you got done, or anything for tomorrow?`;
  const titles = open.slice(0, 4).map((t) => t.title.charAt(0).toLowerCase() + t.title.slice(1));
  const list = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
  const more = open.length > 4 ? `, plus ${open.length - 4} more` : "";
  return `${hi} Today you had ${list}${more}. How did it go?`;
}

async function state(user: User, day: string) {
  const [today, tomorrow] = await Promise.all([tasks.forDay(user.id, day), tasks.forDay(user.id, addDays(day, 1))]);
  return { today, tomorrow };
}

export async function checkinRoutes(app: FastifyInstance) {
  app.post("/checkin/start", async (req) => {
    const u = req.user;
    const day = logicalToday(u.timezone);
    const night = await nights.openFor(u, day);
    const { today, tomorrow } = await state(u, day);
    if (night.closedAt) {
      return { nightId: night.id, day, message: "You already tucked in today. Sleep well.", finished: true, today, tomorrow, closed: night };
    }
    const message = opener(u.name, localClock(u.timezone).hour, today.filter((t) => t.status === "open"), today.filter((t) => t.status === "done").length);
    const transcript: ChatTurn[] = [{ role: "assistant", content: message }];
    await db.update(schema.nights).set({ transcript }).where(eq(schema.nights.id, night.id));
    return { nightId: night.id, day, message, finished: false, today, tomorrow };
  });

  app.post("/checkin/reply", async (req, reply) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body);
    const u = req.user;
    const day = logicalToday(u.timezone);
    const night = await nights.openFor(u, day);
    if (night.closedAt) return reply.code(409).send({ error: "This night is already closed." });

    const { today, tomorrow } = await state(u, day);
    const refs = refsFor(today);
    const transcript: ChatTurn[] = [...night.transcript, { role: "user", content: text }];
    const clock = localClock(u.timezone);
    const turn = await checkinTurn({
      name: u.name, refs, tomorrow, transcript,
      ctx: { today: day, time: clock.time, timezone: u.timezone, bedtime: u.bedtime },
    });

    // Apply what the user said.
    const applied: { taskId: string; title: string; action: string }[] = [];
    let carried = 0;
    for (const up of turn.updates) {
      const t = refs.get(up.ref);
      if (!t) continue;
      if (up.action === "done") await tasks.update(u, t.id, { status: "done" });
      if (up.action === "drop") await tasks.update(u, t.id, { status: "dropped" });
      if (up.action === "carry") { await tasks.carry(u, t); carried += 1; }
      if (up.action === "move" && up.day) await tasks.update(u, t.id, { day: up.day, startTime: up.startTime ?? t.startTime });
      applied.push({ taskId: t.id, title: t.title, action: up.action });
    }
    for (const p of turn.purchases) {
      await pantry.recordPurchase(u.id, p);
      // Tick matching items on today's lists.
      for (const t of today.filter((x) => x.kind === "shopping")) {
        const match = t.items.find((i) => !i.checked && i.name.toLowerCase().includes(p.name.toLowerCase().split(" ")[0]));
        if (match) await db.update(schema.shoppingItems).set({ checked: true }).where(eq(schema.shoppingItems.id, match.id));
      }
    }
    const added = turn.newTasks.length ? await tasks.createFromDrafts(u, turn.newTasks) : [];

    transcript.push({ role: "assistant", content: turn.reply });
    await db.update(schema.nights)
      .set({ transcript, carriedCount: night.carriedCount + carried })
      .where(eq(schema.nights.id, night.id));

    let closed = null;
    if (turn.finished) {
      const fresh = { ...night, transcript, carriedCount: night.carriedCount + carried };
      closed = await nights.close(u, fresh, turn.tomorrowPreview);
    }
    const after = await state(u, day);
    return { message: turn.reply, finished: turn.finished, applied, purchases: turn.purchases, added, ...after, closed };
  });

  /** "That's all": close without another AI turn. Anything still open is carried. */
  app.post("/checkin/finish", async (req) => {
    const u = req.user;
    const day = logicalToday(u.timezone);
    const night = await nights.openFor(u, day);
    if (night.closedAt) return { closed: { night, user: u, earnedMoon: false, phase: nights.moonPhase(u.streak) } };
    return { closed: await nights.close(u, night) };
  });

  app.get("/nights", async (req) => ({ nights: await nights.history(req.user.id) }));
}
