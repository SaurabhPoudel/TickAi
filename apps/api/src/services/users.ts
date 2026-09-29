import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import type { User } from "../db/schema.js";

export async function getOrCreate(id: string, timezone?: string): Promise<User> {
  const [found] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (found) return found;
  const [created] = await db.insert(schema.users)
    .values({ id, timezone: timezone && isValidTz(timezone) ? timezone : "UTC" })
    .onConflictDoNothing().returning();
  if (created) return created;
  const [again] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return again;
}

export function isValidTz(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

export async function update(id: string, patch: Partial<Pick<User, "name" | "timezone" | "bedtime" | "voiceReplies">>) {
  const [u] = await db.update(schema.users).set(patch).where(eq(schema.users.id, id)).returning();
  return u;
}
