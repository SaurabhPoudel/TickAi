import { z } from "zod";
import { env } from "../env.js";
import type { ChatTurn, ShoppingItem, Task } from "../db/schema.js";
import { callStructured } from "./client.js";
import { type ClockContext, Draft, calendarContext } from "./drafts.js";

export const CheckinTurn = z.object({
  updates: z.array(z.object({
    ref: z.string().describe("Task ref such as t1"),
    action: z.enum(["done", "carry", "drop", "move"]),
    day: z.string().nullish().describe("move only: YYYY-MM-DD from the date table"),
    startTime: z.string().nullish().describe("move only: HH:MM 24h, if they gave a time"),
  })),
  purchases: z.array(z.object({
    name: z.string().describe("Singular, lowercase: 'milk'"),
    qty: z.number().nullish(),
    unit: z.string().nullish(),
  })),
  newTasks: z.array(Draft),
  reply: z.string().describe("What Tuck says next, out loud"),
  finished: z.boolean(),
  tomorrowPreview: z.string().nullish().describe("When finished: one sentence naming the first thing tomorrow"),
});
export type CheckinTurn = z.infer<typeof CheckinTurn>;

export const CHECKIN_SYSTEM = `You are Tuck, a calm bedtime companion. Each night you spend about a minute helping the user close out their day so they can sleep with nothing left hanging.

Each turn, read what the user just said and return:
- updates: for each open task they talk about, mark done, carry (to tomorrow), drop (not doing it), or move (to a specific day from the date table, with startTime if they gave one). Only tasks with status=open need updates; never repeat an update for a task that is already done, dropped or moved.
- purchases: every item they say they bought, with qty and unit if given. This builds their grocery memory, so capture it even when mentioned in passing. "Got everything on the list" means every item on that list not already marked (got it).
- newTasks: anything new they want to do. Take dates from the date table; if no day is said, use tomorrow.
- reply: what you say next, out loud.
- finished and tomorrowPreview: see below.

How the conversation goes:
1. Find out what happened with the open tasks. Group questions; never go one task at a time.
2. Vague answers count: "did most of it" or "the rest can wait" means the ones they didn't name carry over. Don't ask them to itemise.
3. If a shopping task is done but they haven't said what they bought, ask once: "What did you pick up?" Unbought items carry over automatically; don't ask about each.
4. A task with carried_before >= 3 has been pushed many times. Ask once, gently, whether to break it into a smaller first step, give it a set time, or let it go. Don't mention the count.
5. Finish (finished=true) as soon as every open task is accounted for, or the user says they're done ("that's it", "goodnight", "nothing else"), or this is exchange 4. Unmentioned tasks carry over automatically. When finishing, the reply is a short goodnight, and tomorrowPreview names the first thing tomorrow, e.g. "First up tomorrow: call the bank at 10 am." If tomorrow is empty, say it's a clear day.

How to talk (your reply is read aloud by text-to-speech in a dark room):
- One or two short sentences. Warm and plain. Never guilt-trip or praise excessively.
- No lists, emoji, symbols or abbreviations. Say times the way people speak them ("6 pm", "half past 9").
- Never ask about something the user already answered.`;

type TaskWithItems = Task & { items: ShoppingItem[] };

export function refsFor(tasks: TaskWithItems[]) {
  const refs = new Map<string, TaskWithItems>();
  tasks.forEach((t, i) => refs.set(`t${i + 1}`, t));
  return refs;
}

function describeTasks(refs: Map<string, TaskWithItems>) {
  return [...refs.entries()].map(([ref, t]) => {
    const bits = [`${ref}: "${t.title}"`, `kind=${t.kind}`, `status=${t.status}`];
    if (t.startTime) bits.push(`at ${t.startTime}`);
    if (t.person) bits.push(`with ${t.person}`);
    if (t.carryCount) bits.push(`carried_before=${t.carryCount}`);
    if (t.items.length) bits.push(`list: ${t.items.map((i) => i.name + (i.checked ? " (got it)" : "")).join(", ")}`);
    return bits.join(", ");
  }).join("\n");
}

export async function checkinTurn(opts: {
  name: string | null;
  ctx: ClockContext;
  refs: Map<string, TaskWithItems>;
  tomorrow: Task[];
  transcript: ChatTurn[];
}) {
  const tomorrow = opts.tomorrow.length
    ? opts.tomorrow.map((t) => `- ${t.title}${t.startTime ? ` at ${t.startTime}` : ""}`).join("\n")
    : "(nothing planned yet)";
  const exchange = opts.transcript.filter((t) => t.role === "user").length;
  const system = `${CHECKIN_SYSTEM}

${calendarContext(opts.ctx)}
User's name: ${opts.name ?? "unknown"}
This is exchange ${exchange} of about 4.

Today's tasks (refer to them by ref):
${describeTasks(opts.refs) || "(none)"}

Already planned for tomorrow:
${tomorrow}`;

  return callStructured({
    model: env.CHECKIN_MODEL,
    system,
    messages: opts.transcript,
    schema: CheckinTurn,
    effort: env.CHECKIN_EFFORT,
  });
}
