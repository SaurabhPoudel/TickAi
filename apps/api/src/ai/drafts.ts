import { z } from "zod";
import { addDays, weekdayOf } from "../lib/days.js";

/** A task as Claude proposes it, before it's saved. Shared by capture and the bedtime check-in. */
export const Draft = z.object({
  title: z.string().min(1).describe("Short, verb-first task title in the user's words, e.g. 'Bake the cake', 'Meet Rahul'."),
  kind: z.enum(["general", "shopping", "social", "cooking", "errand", "event"]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD, taken from the date table"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullish().describe("HH:MM 24h local time, only if the user gave or clearly implied a time"),
  durationMin: z.number().int().positive().nullish(),
  person: z.string().nullish().describe("Who they're meeting, for social tasks"),
  location: z.string().nullish(),
  notes: z.string().nullish(),
  items: z.array(z.object({
    name: z.string().min(1).describe("Singular, lowercase, no quantity: 'milk', 'eggs'"),
    qty: z.number().nullish(),
    unit: z.string().nullish().describe("e.g. 'L', 'kg', 'dozen'; null for a plain count"),
    suggested: z.boolean().nullish().describe("true if you inferred it (e.g. cake ingredients) rather than the user saying it"),
  })).nullish().describe("Shopping tasks only: things to buy"),
});
export type Draft = z.infer<typeof Draft>;

export type ClockContext = { today: string; time: string; timezone: string; bedtime: string };

/** Date table and "now" for the prompt. `today` is the logical day (before 4am still counts as the day before). */
export function calendarContext({ today, time, timezone, bedtime }: ClockContext) {
  const days: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const label = i === 0 ? "today" : i === 1 ? "tomorrow" : d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    days.push(`${label}: ${d.toISOString().slice(0, 10)}`);
  }
  const lateNight = Number(time.slice(0, 2)) < 4
    ? `\nIt's after midnight but the user hasn't slept yet, so "today" still means ${weekdayOf(today)} ${today} and "tomorrow" means ${addDays(today, 1)}.`
    : "";
  return `Right now it is ${weekdayOf(today)} ${today}, ${time} (${timezone}). The user goes to bed around ${bedtime}.${lateNight}\nDates:\n${days.join("\n")}`;
}
