import { z } from "zod";

/** A task as Claude proposes it, before it's saved. Shared by capture and the bedtime check-in. */
export const Draft = z.object({
  title: z.string().min(1),
  kind: z.enum(["general", "shopping", "social", "cooking", "errand", "event"]).default("general"),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  durationMin: z.number().int().positive().nullish(),
  person: z.string().nullish(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
  items: z.array(z.object({
    name: z.string().min(1),
    qty: z.number().nullish(),
    unit: z.string().nullish(),
    suggested: z.boolean().nullish(),
  })).nullish(),
});
export type Draft = z.infer<typeof Draft>;

export const draftJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short, verb-first task title in the user's words, e.g. 'Bake the cake', 'Meet Rahul'." },
    kind: { type: "string", enum: ["general", "shopping", "social", "cooking", "errand", "event"] },
    day: { type: "string", description: "YYYY-MM-DD" },
    startTime: { type: ["string", "null"], description: "HH:MM 24h local time, only if the user gave or clearly implied a time" },
    durationMin: { type: ["integer", "null"] },
    person: { type: ["string", "null"], description: "Who they're meeting, for social tasks" },
    location: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    items: {
      type: ["array", "null"],
      description: "Shopping tasks only: things to buy",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          suggested: { type: ["boolean", "null"], description: "true if you inferred it (e.g. cake ingredients) rather than the user saying it" },
        },
        required: ["name"],
      },
    },
  },
  required: ["title", "kind", "day"],
} as const;

export function calendarContext(today: string, weekday: string, time: string, timezone: string, bedtime: string) {
  const days: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const label = i === 0 ? "today" : i === 1 ? "tomorrow" : d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    days.push(`${label}: ${d.toISOString().slice(0, 10)}`);
  }
  return `Right now it is ${weekday} ${today}, ${time} (${timezone}). The user goes to bed around ${bedtime}.\nDates:\n${days.join("\n")}`;
}
