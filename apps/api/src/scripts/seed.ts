/**
 * Fills a dev user with a realistic few weeks of history so you can see every screen.
 * Usage: npm run seed -- <dev-user-id> [timezone]
 * Then point the app at the API and use the same id (see README).
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { addDays, logicalToday } from "../lib/days.js";
import * as pantry from "../services/pantry.js";
import * as users from "../services/users.js";

const id = `dev:${process.argv[2] ?? "demo"}`;
const tz = process.argv[3] ?? "Asia/Kolkata";

await users.getOrCreate(id, tz);
await db.update(schema.users).set({
  name: "Sam", timezone: tz, bedtime: "23:00", streak: 12, bestStreak: 12, graceNights: 1, fullMoons: 1,
}).where(eq(schema.users.id, id));
const today = logicalToday(tz);
await db.update(schema.users).set({ lastClosedDay: addDays(today, -1) }).where(eq(schema.users.id, id));

await db.delete(schema.tasks).where(eq(schema.tasks.userId, id));
await db.delete(schema.nights).where(eq(schema.nights.userId, id));
await db.delete(schema.pantryItems).where(eq(schema.pantryItems.userId, id));

// Twelve nights of history, with one grace night.
for (let i = 12; i >= 1; i--) {
  await db.insert(schema.nights).values({
    userId: id, day: addDays(today, -i), closedAt: new Date(Date.now() - i * 86_400_000),
    doneCount: [2, 4, 1, 5, 3, 6, 2, 4, 5, 3, 1, 4][i - 1], carriedCount: i % 3, usedGrace: i === 6,
  });
}
await db.delete(schema.nights).where(and(eq(schema.nights.userId, id), eq(schema.nights.day, addDays(today, -6))));

// Grocery memory: a few weeks of purchases.
const ago = (d: number) => new Date(Date.now() - d * 86_400_000);
for (const [name, qty, unit, days] of [
  ["Milk", 2, "L", [20, 13, 6]], ["Eggs", 12, null, [24, 12]], ["Bread", 1, "loaf", [9, 5]],
  ["Rice", 5, "kg", [40]], ["Bananas", 6, null, [11, 7, 2]], ["Coffee", 250, "g", [30, 16]],
  ["Paneer", 200, "g", [10, 3]],
] as const) {
  for (const d of days) await pantry.recordPurchase(id, { name, qty, unit }, ago(d));
}

const [shop] = await db.insert(schema.tasks).values({ userId: id, title: "Get groceries", kind: "shopping", day: today, sortOrder: 1 }).returning();
await db.insert(schema.shoppingItems).values([
  { taskId: shop.id, name: "Flour", qty: 500, unit: "g", suggested: true, suggestionReason: "For what you're cooking" },
  { taskId: shop.id, name: "Butter", qty: 200, unit: "g", checked: true, suggested: true, suggestionReason: "For what you're cooking" },
  { taskId: shop.id, name: "Milk", qty: 2, unit: "L", suggested: true, suggestionReason: "Last time: 2 L, 6 days ago. Usually lasts 7 days." },
  { taskId: shop.id, name: "Eggs", qty: 12, suggestionReason: "Last time: 12, 12 days ago." },
]);
await db.insert(schema.tasks).values([
  { userId: id, title: "Bake the birthday cake", kind: "cooking", day: today, status: "done", completedAt: new Date(), sortOrder: 2 },
  { userId: id, title: "Meet Rahul", kind: "social", day: today, startTime: "18:00", person: "Rahul", location: "Blue Tokai, Indiranagar", sortOrder: 3 },
  { userId: id, title: "Call the bank about the card", kind: "errand", day: today, carryCount: 3, sortOrder: 4 },
  { userId: id, title: "Water the plants", kind: "general", day: today, status: "done", completedAt: new Date(), sortOrder: 5 },
  { userId: id, title: "Dentist", kind: "event", day: addDays(today, 1), startTime: "10:30", sortOrder: 1 },
  { userId: id, title: "Send Priya the photos", kind: "general", day: addDays(today, 1), sortOrder: 2 },
]);

console.log(`Seeded ${id} (${tz}) for ${today}`);
process.exit(0);
