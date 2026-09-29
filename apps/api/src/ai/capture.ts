import { z } from "zod";
import { env } from "../env.js";
import { callTool } from "./client.js";
import { Draft, calendarContext, draftJsonSchema } from "./drafts.js";

const CaptureResult = z.object({
  tasks: z.array(Draft),
  followUp: z.string().nullish(),
});
export type CaptureResult = z.infer<typeof CaptureResult>;

const SYSTEM = `You turn what someone says out loud into a tidy to-do list for Tuck, a personal planner.

How to split:
- One spoken sentence often holds several tasks. "I want to go shopping, then cook cake and meet some person" is three tasks: a shopping task, a cooking task, a social task.
- Keep titles short and in the user's own words, starting with a verb.
- Remove filler ("I want to", "I need to", "um").

Kinds: shopping (buying things), cooking, social (meeting or calling a person), errand (bank, post office, pickup), event (fixed-time appointment), general (anything else).

Dates and times:
- Resolve words like "tomorrow" or "Friday" using the date table.
- If no day is said, use today, unless it is already within 2 hours of bedtime or later; then use tomorrow.
- Only set startTime when the user said or clearly implied a time ("at 5", "after lunch" = 13:30). Never invent one.

Shopping:
- Put the things to buy in items, with qty and unit if said.
- If the same message has a cooking task and a shopping task, add the obvious ingredients for the dish to the shopping items with suggested=true (e.g. cake: flour, sugar, eggs, butter). Keep it to the basics.

Follow-up:
- If a task is too vague to act on, write ONE short friendly question in followUp, e.g. "Who are you meeting, and roughly what time?" Otherwise leave it null.`;

export async function captureTasks(text: string, ctx: { today: string; weekday: string; time: string; timezone: string; bedtime: string }) {
  return callTool({
    model: env.CAPTURE_MODEL,
    system: `${SYSTEM}\n\n${calendarContext(ctx.today, ctx.weekday, ctx.time, ctx.timezone, ctx.bedtime)}`,
    messages: [{ role: "user", content: text }],
    tool: {
      name: "save_tasks",
      description: "Save the tasks found in what the user said.",
      input_schema: {
        type: "object",
        properties: {
          tasks: { type: "array", items: draftJsonSchema },
          followUp: { type: ["string", "null"] },
        },
        required: ["tasks"],
      },
    },
    schema: CaptureResult,
  });
}
