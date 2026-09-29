import {
  pgTable, text, uuid, integer, timestamp, date, boolean, real, jsonb, pgEnum, index, uniqueIndex,
} from "drizzle-orm/pg-core";

export const taskKind = pgEnum("task_kind", ["general", "shopping", "social", "cooking", "errand", "event"]);
export const taskStatus = pgEnum("task_status", ["open", "done", "dropped"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Supabase auth user id
  name: text("name"),
  timezone: text("timezone").notNull().default("UTC"),
  bedtime: text("bedtime").notNull().default("22:30"), // HH:MM, local
  voiceReplies: boolean("voice_replies").notNull().default(true),
  streak: integer("streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  graceNights: integer("grace_nights").notNull().default(1),
  fullMoons: integer("full_moons").notNull().default(0),
  lastClosedDay: date("last_closed_day"),
  googleRefreshToken: text("google_refresh_token"),
  googleCalendarId: text("google_calendar_id").default("primary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: taskKind("kind").notNull().default("general"),
  status: taskStatus("status").notNull().default("open"),
  day: date("day").notNull(), // the logical day it's planned for
  startTime: text("start_time"), // HH:MM local, optional
  durationMin: integer("duration_min"),
  person: text("person"),
  location: text("location"),
  notes: text("notes"),
  carryCount: integer("carry_count").notNull().default(0),
  calendarEventId: text("calendar_event_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tasks_user_day").on(t.userId, t.day)]);

export const shoppingItems = pgTable("shopping_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  qty: real("qty"),
  unit: text("unit"),
  checked: boolean("checked").notNull().default(false),
  suggested: boolean("suggested").notNull().default(false), // came from pantry memory, not the user
  suggestionReason: text("suggestion_reason"),
});

/** One row per thing the user buys regularly. The memory behind "last time you got…". */
export const pantryItems = pgTable("pantry_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull(), // normalized name, e.g. "milk"
  name: text("name").notNull(), // display name
  lastQty: real("last_qty"),
  unit: text("unit"),
  lastBoughtAt: timestamp("last_bought_at", { withTimezone: true }),
  avgIntervalDays: real("avg_interval_days"), // learned: how long a purchase lasts
  timesBought: integer("times_bought").notNull().default(0),
}, (t) => [uniqueIndex("pantry_user_key").on(t.userId, t.key)]);

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  pantryItemId: uuid("pantry_item_id").notNull().references(() => pantryItems.id, { onDelete: "cascade" }),
  qty: real("qty"),
  unit: text("unit"),
  boughtAt: timestamp("bought_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** A bedtime check-in. One per logical day. */
export const nights = pgTable("nights", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  transcript: jsonb("transcript").$type<ChatTurn[]>().notNull().default([]),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  doneCount: integer("done_count").notNull().default(0),
  carriedCount: integer("carried_count").notNull().default(0),
  droppedCount: integer("dropped_count").notNull().default(0),
  usedGrace: boolean("used_grace").notNull().default(false),
  tomorrowPreview: text("tomorrow_preview"),
}, (t) => [uniqueIndex("nights_user_day").on(t.userId, t.day)]);

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
export type Night = typeof nights.$inferSelect;
