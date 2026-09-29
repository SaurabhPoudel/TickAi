import { and, asc, eq, inArray, max } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import type { ShoppingItem, Task, User } from "../db/schema.js";
import type { Draft } from "../ai/drafts.js";
import { addDays } from "../lib/days.js";
import { pantryKey } from "../lib/normalize.js";
import { syncInBackground } from "./calendar.js";
import * as pantry from "./pantry.js";

export type TaskWithItems = Task & { items: ShoppingItem[] };

export async function withItems(list: Task[]): Promise<TaskWithItems[]> {
  if (!list.length) return [];
  const items = await db.select().from(schema.shoppingItems)
    .where(inArray(schema.shoppingItems.taskId, list.map((t) => t.id)));
  return list.map((t) => ({ ...t, items: items.filter((i) => i.taskId === t.id) }));
}

export async function forDay(userId: string, day: string) {
  const list = await db.select().from(schema.tasks)
    .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.day, day)))
    .orderBy(asc(schema.tasks.startTime), asc(schema.tasks.sortOrder), asc(schema.tasks.createdAt));
  return withItems(list);
}

export async function get(userId: string, id: string) {
  const [t] = await db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.id, id)));
  return t ?? null;
}

async function nextSort(userId: string, day: string) {
  const [row] = await db.select({ m: max(schema.tasks.sortOrder) }).from(schema.tasks)
    .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.day, day)));
  return (row?.m ?? 0) + 1;
}

/** Saves tasks Claude drafted. Shopping tasks get "last time you got…" suggestions from pantry memory. */
export async function createFromDrafts(user: User, drafts: Draft[]) {
  const created: TaskWithItems[] = [];
  const running = await pantry.suggestions(user.id);

  for (const d of drafts) {
    const [task] = await db.insert(schema.tasks).values({
      userId: user.id, title: d.title, kind: d.kind, day: d.day,
      startTime: d.startTime ?? null, durationMin: d.durationMin ?? null,
      person: d.person ?? null, location: d.location ?? null, notes: d.notes ?? null,
      sortOrder: await nextSort(user.id, d.day),
    }).returning();

    let items: ShoppingItem[] = [];
    if (d.kind === "shopping") {
      const said = (d.items ?? []).map((i) => ({
        taskId: task.id, name: i.name, qty: i.qty ?? null, unit: i.unit ?? null,
        suggested: Boolean(i.suggested), suggestionReason: i.suggested ? "For what you're cooking" : null,
      }));
      const saidKeys = new Set(said.map((i) => pantryKey(i.name)));
      // Fill in quantities from memory when the user didn't say how much.
      const memory = await pantry.list(user.id);
      for (const i of said) {
        const m = memory.find((p) => pantryKey(p.name) === pantryKey(i.name));
        if (m && i.qty == null) { i.qty = m.lastQty; i.unit = m.unit; i.suggestionReason = m.summary || i.suggestionReason; }
      }
      const fromMemory = running
        .filter((s) => !saidKeys.has(pantryKey(s.name)))
        .slice(0, 8)
        .map((s) => ({ taskId: task.id, name: s.name, qty: s.qty, unit: s.unit, suggested: true, suggestionReason: s.reason }));
      const rows = [...said, ...fromMemory];
      if (rows.length) items = await db.insert(schema.shoppingItems).values(rows).returning();
    }
    created.push({ ...task, items });
    syncInBackground(user, task);
  }
  return created;
}

export async function update(user: User, id: string, patch: Partial<Pick<Task, "title" | "day" | "startTime" | "durationMin" | "status" | "notes" | "sortOrder">>) {
  const set: Partial<Task> = { ...patch };
  if (patch.status === "done") set.completedAt = new Date();
  if (patch.status === "open") set.completedAt = null;
  const [task] = await db.update(schema.tasks).set(set)
    .where(and(eq(schema.tasks.userId, user.id), eq(schema.tasks.id, id))).returning();
  if (task) syncInBackground(user, task);
  return task ?? null;
}

export async function remove(user: User, id: string) {
  const task = await get(user.id, id);
  if (!task) return false;
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  if (task.calendarEventId) syncInBackground(user, { ...task, status: "dropped" });
  return true;
}

export async function carry(user: User, task: Task, toDay = addDays(task.day, 1), startTime: string | null = task.startTime) {
  const [moved] = await db.update(schema.tasks)
    .set({ day: toDay, startTime, carryCount: task.carryCount + 1, sortOrder: -1 })
    .where(eq(schema.tasks.id, task.id)).returning();
  syncInBackground(user, moved);
  return moved;
}

export async function setItem(userId: string, itemId: string, checked: boolean) {
  const [row] = await db.select({ item: schema.shoppingItems, task: schema.tasks })
    .from(schema.shoppingItems).innerJoin(schema.tasks, eq(schema.tasks.id, schema.shoppingItems.taskId))
    .where(and(eq(schema.shoppingItems.id, itemId), eq(schema.tasks.userId, userId)));
  if (!row) return null;
  const [item] = await db.update(schema.shoppingItems).set({ checked }).where(eq(schema.shoppingItems.id, itemId)).returning();
  // Ticking an item off in the store counts as buying it.
  if (checked) await pantry.recordPurchase(userId, { name: item.name, qty: item.qty, unit: item.unit });
  return item;
}

export async function addItem(userId: string, taskId: string, item: { name: string; qty?: number | null; unit?: string | null }) {
  const task = await get(userId, taskId);
  if (!task) return null;
  const [row] = await db.insert(schema.shoppingItems)
    .values({ taskId, name: item.name, qty: item.qty ?? null, unit: item.unit ?? null }).returning();
  return row;
}

/** Adds an item to the next open shopping list (today or tomorrow), creating one if needed. */
export async function addToNextList(user: User, today: string, item: { name: string; qty?: number | null; unit?: string | null }) {
  const days = [today, addDays(today, 1)];
  const lists = await db.select().from(schema.tasks).where(and(
    eq(schema.tasks.userId, user.id), eq(schema.tasks.kind, "shopping"),
    eq(schema.tasks.status, "open"), inArray(schema.tasks.day, days),
  )).orderBy(asc(schema.tasks.day)).limit(1);
  let task: Task | undefined = lists[0];
  if (!task) {
    [task] = await db.insert(schema.tasks).values({
      userId: user.id, title: "Groceries", kind: "shopping", day: today, sortOrder: await nextSort(user.id, today),
    }).returning();
  }
  const [row] = await db.insert(schema.shoppingItems)
    .values({ taskId: task.id, name: item.name, qty: item.qty ?? null, unit: item.unit ?? null }).returning();
  return { task, item: row };
}
