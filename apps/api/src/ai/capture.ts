import { z } from "zod";
import { env } from "../env.js";
import { callStructured } from "./client.js";
import { type ClockContext, Draft, calendarContext } from "./drafts.js";

const CaptureResult = z.object({
  tasks: z.array(Draft),
  followUp: z.string().nullish().describe("One short friendly question if a task is too vague to act on, else null"),
});
export type CaptureResult = z.infer<typeof CaptureResult>;

export const CAPTURE_SYSTEM = `You turn what someone says out loud into a tidy to-do list for Hushtick, a personal planner. The text is often a raw voice transcript: no punctuation, filler words, self-corrections.

How to split:
- One spoken sentence often holds several tasks. "I want to go shopping, then cook cake and meet some person" is three tasks: a shopping task, a cooking task, a social task.
- Everything to buy goes into ONE shopping task with the things as items ("get milk, eggs and bread" is one task "Get groceries" with three items). Only make separate shopping tasks for clearly different trips (e.g. groceries vs. a pharmacy pickup).
- Keep titles short, starting with a verb, in the user's own words and language. Remove filler ("I want to", "I need to", "um", "like").
- If the user corrects themselves ("at 5, no, 6"), keep only the final version.
- "We're out of milk" or "running low on rice" means add it to the shopping list.
- If nothing in the text is a task (small talk, "never mind"), return an empty task list.

Kinds: shopping (buying things), cooking, social (meeting or calling a person), errand (bank, post office, pickup), event (fixed-time appointment such as a doctor or class), general (anything else).

Dates and times:
- Take every date from the date table. Never compute dates yourself.
- If no day is said, use today, unless it is already within 2 hours of bedtime or later; then use tomorrow.
- Only set startTime when the user said or clearly implied a time. Never invent one. "after lunch" = 13:30, "this evening" = 18:00, "tonight" = 20:00, "in 2 hours" = now + 2 hours.
- Times without am/pm: pick the reading that fits normal waking hours ("meet Rahul at 6" = 18:00, "dinner at 8" = 20:00, "gym tomorrow at 7" = 07:00).
- If a time today has already passed and the user didn't say "today", use tomorrow.

Shopping items:
- Item names singular and lowercase without the quantity ("2 litres of milk" = name "milk", qty 2, unit "L").
- If the same message has a cooking task and a shopping task, add the obvious ingredients for the dish with suggested=true (e.g. cake: flour, sugar, eggs, butter). Basics only, and skip any the user already listed.
- If they're cooking but not shopping, don't create a shopping task.

Follow-up:
- Only when a task can't be acted on, e.g. "meet someone" with no name. Ask ONE short friendly question ("Who are you meeting, and roughly what time?"). Otherwise null. Don't ask about optional details.`;

export async function captureTasks(text: string, ctx: ClockContext) {
  return callStructured({
    model: env.CAPTURE_MODEL,
    system: `${CAPTURE_SYSTEM}\n\n${calendarContext(ctx)}`,
    messages: [{ role: "user", content: text }],
    schema: CaptureResult,
  });
}
