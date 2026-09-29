import { z } from "zod";
import { env } from "../env.js";
import type { ChatTurn, ShoppingItem, Task } from "../db/schema.js";
import { callTool } from "./client.js";
import { Draft, calendarContext, draftJsonSchema } from "./drafts.js";

export const CheckinTurn = z.object({
  updates: z.array(z.object({
    ref: z.string(),
    action: z.enum(["done", "carry", "drop", "move"]),
    day: z.string().nullish(),
    startTime: z.string().nullish(),
  })).default([]),
  purchases: z.array(z.object({ name: z.string(), qty: z.number().nullish(), unit: z.string().nullish() })).default([]),
  newTasks: z.array(Draft).default([]),
  reply: z.string(),
  finished: z.boolean(),
  tomorrowPreview: z.string().nullish(),
});
export type CheckinTurn = z.infer<typeof CheckinTurn>;

const SYSTEM = `You are Tuck, a calm bedtime companion. Each night you spend about a minute helping the user close out their day so they can sleep with nothing left hanging.

Your job this turn: read what the user just said and record it with the update_day tool.
- updates: for each task they mention, mark done, carry (to tomorrow), drop (not doing it), or move (to a specific day, set day and optionally startTime).
- purchases: when they say what they bought, list each item with qty and unit if given. This builds their grocery memory, so capture it even if they only mention it in passing.
- newTasks: anything new they want to do.
- reply: what you say next, out loud. One or two short sentences. Warm, plain, never guilt-tripping. No lists, no emoji.

How the conversation goes:
1. Find out what happened with each open task. Group questions; don't ask one task at a time.
2. If a shopping task is done but they haven't said what they bought, ask once: "What did you pick up?" Items on the list they didn't buy will carry over automatically; you don't need to ask about each one.
3. A task marked with carried_before >= 3 has been pushed many times. Ask once, gently, whether to break it into a smaller first step, give it a set time, or let it go.
4. Once every open task is accounted for (or the user says they're done, "that's it", "goodnight"), set finished=true, write a one-sentence tomorrowPreview naming the first thing tomorrow, and make the reply a short goodnight.

Keep it short. It's bedtime: never more than about four exchanges, and never ask about something the user already answered. Unmentioned tasks are carried automatically when you finish.`;

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
  ctx: { today: string; weekday: string; time: string; timezone: string; bedtime: string };
  refs: Map<string, TaskWithItems>;
  tomorrow: Task[];
  transcript: ChatTurn[];
}) {
  const tomorrow = opts.tomorrow.length
    ? opts.tomorrow.map((t) => `- ${t.title}${t.startTime ? ` at ${t.startTime}` : ""}`).join("\n")
    : "(nothing planned yet)";
  const system = `${SYSTEM}

${calendarContext(opts.ctx.today, opts.ctx.weekday, opts.ctx.time, opts.ctx.timezone, opts.ctx.bedtime)}
User's name: ${opts.name ?? "unknown"}

Today's tasks (refer to them by ref):
${describeTasks(opts.refs) || "(none)"}

Already planned for tomorrow:
${tomorrow}`;

  return callTool({
    model: env.CHECKIN_MODEL,
    system,
    messages: opts.transcript,
    tool: {
      name: "update_day",
      description: "Record what the user said about their day and give your next spoken reply.",
      input_schema: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ref: { type: "string" },
                action: { type: "string", enum: ["done", "carry", "drop", "move"] },
                day: { type: ["string", "null"] },
                startTime: { type: ["string", "null"] },
              },
              required: ["ref", "action"],
            },
          },
          purchases: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, qty: { type: ["number", "null"] }, unit: { type: ["string", "null"] } },
              required: ["name"],
            },
          },
          newTasks: { type: "array", items: draftJsonSchema },
          reply: { type: "string" },
          finished: { type: "boolean" },
          tomorrowPreview: { type: ["string", "null"] },
        },
        required: ["updates", "purchases", "newTasks", "reply", "finished"],
      },
    },
    schema: CheckinTurn,
    maxTokens: 1200,
  });
}
