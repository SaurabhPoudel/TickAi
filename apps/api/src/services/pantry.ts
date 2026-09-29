import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import type { PantryItem } from "../db/schema.js";
import { daysBetween } from "../lib/days.js";
import { displayName, pantryKey } from "../lib/normalize.js";

export type Suggestion = { name: string; qty: number | null; unit: string | null; reason: string; daysLeft: number | null };

function formatQty(qty: number | null, unit: string | null) {
  if (qty == null) return "";
  const n = Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

function ago(days: number) {
  const d = Math.round(days);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

/** How many days of this item are probably left. null = not enough history yet. */
export function daysLeft(item: PantryItem, now = new Date()): number | null {
  if (!item.lastBoughtAt || !item.avgIntervalDays) return null;
  return item.avgIntervalDays - daysBetween(item.lastBoughtAt, now);
}

export function describe(item: PantryItem, now = new Date()): string {
  const qty = formatQty(item.lastQty, item.unit);
  const since = item.lastBoughtAt ? ago(daysBetween(item.lastBoughtAt, now)) : "";
  const last = [qty, since].filter(Boolean).join(", ");
  const lasts = item.avgIntervalDays ? ` Usually lasts ${Math.round(item.avgIntervalDays)} days.` : "";
  return last ? `Last time: ${last}.${lasts}` : "";
}

/** Items the user is probably running low on, most urgent first. */
export async function suggestions(userId: string, now = new Date()): Promise<Suggestion[]> {
  const items = await db.select().from(schema.pantryItems).where(eq(schema.pantryItems.userId, userId));
  const out: (Suggestion & { score: number })[] = [];
  for (const item of items) {
    if (!item.lastBoughtAt) continue;
    const left = daysLeft(item, now);
    const since = daysBetween(item.lastBoughtAt, now);
    const due = left != null ? left <= 2 : item.timesBought >= 1 && since >= 7;
    if (!due) continue;
    out.push({
      name: item.name, qty: item.lastQty, unit: item.unit, daysLeft: left,
      reason: describe(item, now), score: left ?? 7 - since,
    });
  }
  return out.sort((a, b) => a.score - b.score).map(({ score: _s, ...s }) => s);
}

/** Called when the user says what they bought (usually during the bedtime check-in). */
export async function recordPurchase(
  userId: string, p: { name: string; qty?: number | null; unit?: string | null }, at = new Date(),
) {
  const key = pantryKey(p.name);
  if (!key) return null;
  const [existing] = await db.select().from(schema.pantryItems)
    .where(and(eq(schema.pantryItems.userId, userId), eq(schema.pantryItems.key, key)));

  let item: PantryItem;
  if (!existing) {
    [item] = await db.insert(schema.pantryItems).values({
      userId, key, name: displayName(p.name), lastQty: p.qty ?? null, unit: p.unit ?? null,
      lastBoughtAt: at, timesBought: 1,
    }).returning();
  } else {
    // Learn how long a purchase lasts with a moving average, ignoring same-day repeats.
    const gap = existing.lastBoughtAt ? daysBetween(existing.lastBoughtAt, at) : null;
    let avg = existing.avgIntervalDays;
    if (gap != null && gap >= 0.5) avg = avg ? avg * 0.6 + gap * 0.4 : gap;
    [item] = await db.update(schema.pantryItems).set({
      lastQty: p.qty ?? existing.lastQty, unit: p.unit ?? existing.unit, lastBoughtAt: at,
      avgIntervalDays: avg, timesBought: existing.timesBought + 1,
    }).where(eq(schema.pantryItems.id, existing.id)).returning();
  }
  await db.insert(schema.purchases).values({ pantryItemId: item.id, qty: p.qty ?? null, unit: p.unit ?? null, boughtAt: at });
  return item;
}

export async function list(userId: string, now = new Date()) {
  const items = await db.select().from(schema.pantryItems).where(eq(schema.pantryItems.userId, userId));
  return items
    .map((i) => ({
      id: i.id, name: i.name, lastQty: i.lastQty, unit: i.unit,
      lastBoughtAt: i.lastBoughtAt, avgIntervalDays: i.avgIntervalDays,
      timesBought: i.timesBought, daysLeft: daysLeft(i, now), summary: describe(i, now),
    }))
    .sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99));
}
