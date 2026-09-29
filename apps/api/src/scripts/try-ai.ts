/**
 * Runs the capture and check-in prompts against Claude with fixed examples, no database needed.
 * Use it to test prompt changes before trying them in the app.
 *
 *   npm run try-ai -w apps/api              # everything
 *   npm run try-ai -w apps/api -- capture   # capture cases only
 *   npm run try-ai -w apps/api -- checkin   # the scripted check-in only
 *   npm run try-ai -w apps/api -- dry       # print prompts and schemas, no API calls
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { captureTasks } from "../ai/capture.js";
import { CheckinTurn, checkinTurn, refsFor } from "../ai/checkin.js";
import { type ClockContext, Draft, calendarContext } from "../ai/drafts.js";
import type { ChatTurn, ShoppingItem, Task } from "../db/schema.js";
import { addDays } from "../lib/days.js";

const mode = process.argv[2] ?? "all";
const today = "2026-09-29"; // a Tuesday
const evening: ClockContext = { today, time: "19:10", timezone: "Asia/Kathmandu", bedtime: "23:00" };
const lateNight: ClockContext = { ...evening, time: "01:20" };

type Check = (r: { tasks: Draft[]; followUp?: string | null }) => string | null;
const count = (n: number): Check => (r) => (r.tasks.length === n ? null : `expected ${n} tasks, got ${r.tasks.length}`);
const has = (pred: (t: Draft) => boolean, what: string): Check => (r) => (r.tasks.some(pred) ? null : `missing: ${what}`);
const asksFollowUp: Check = (r) => (r.followUp ? null : "expected a follow-up question");

const captureCases: { text: string; ctx?: ClockContext; checks: Check[] }[] = [
  {
    text: "get groceries bake a cake and meet Rahul at 6",
    checks: [count(3), has((t) => t.kind === "social" && t.startTime === "18:00" && /rahul/i.test(t.person ?? ""), "Rahul at 18:00"),
      has((t) => t.kind === "shopping" && (t.items ?? []).some((i) => i.suggested), "suggested cake ingredients")],
  },
  {
    text: "um I need to buy milk eggs and bread and uh two litres of orange juice",
    checks: [count(1), has((t) => t.kind === "shopping" && (t.items ?? []).length === 4, "one shopping task with 4 items"),
      has((t) => (t.items ?? []).some((i) => /juice/.test(i.name) && i.qty === 2), "juice qty 2")],
  },
  {
    text: "call the bank tomorrow morning and dentist on friday at 3 no wait 4",
    checks: [count(2), has((t) => t.day === addDays(today, 1), "bank tomorrow"),
      has((t) => t.day === "2026-10-02" && t.startTime === "16:00", "dentist Friday 16:00")],
  },
  { text: "meet someone later", checks: [count(1), asksFollowUp] },
  { text: "never mind, nothing", checks: [count(0)] },
  { text: "we're out of rice and I should call mum", checks: [count(2), has((t) => t.kind === "shopping", "rice on a list"), has((t) => t.kind === "social", "call mum")] },
  { text: "pick up the parcel tomorrow", ctx: lateNight, checks: [count(1), has((t) => t.day === addDays(today, 1), `day ${addDays(today, 1)} (logical tomorrow after midnight)`)] },
];

async function runCapture() {
  let failed = 0;
  for (const c of captureCases) {
    const started = Date.now();
    const r = await captureTasks(c.text, c.ctx ?? evening);
    const problems = c.checks.map((f) => f(r)).filter(Boolean);
    failed += problems.length ? 1 : 0;
    console.log(`\n${problems.length ? "FAIL" : "ok  "} "${c.text}" (${Date.now() - started} ms)`);
    for (const t of r.tasks) {
      const items = t.items?.length ? `  [${t.items.map((i) => `${i.qty ?? ""}${i.unit ?? ""} ${i.name}${i.suggested ? "*" : ""}`.trim()).join(", ")}]` : "";
      console.log(`     ${t.kind.padEnd(8)} ${t.day} ${t.startTime ?? "     "} ${t.title}${t.person ? ` (with ${t.person})` : ""}${items}`);
    }
    if (r.followUp) console.log(`     follow-up: ${r.followUp}`);
    for (const p of problems) console.log(`     ! ${p}`);
  }
  console.log(`\nCapture: ${captureCases.length - failed}/${captureCases.length} passed`);
}

function fakeTask(i: number, title: string, extra: Partial<Task> = {}, items: string[] = []): Task & { items: ShoppingItem[] } {
  const id = `task-${i}`;
  return {
    id, userId: "demo", title, kind: "general", day: today, status: "open", startTime: null, durationMin: null,
    person: null, location: null, notes: null, sortOrder: i, carryCount: 0, createdAt: new Date(), completedAt: null,
    ...extra,
    items: items.map((name, j) => ({ id: `${id}-i${j}`, taskId: id, name, qty: null, unit: null, checked: false, suggested: false, suggestionReason: null } as unknown as ShoppingItem)),
  } as Task & { items: ShoppingItem[] };
}

async function runCheckin() {
  const today = [
    fakeTask(1, "Get groceries", { kind: "shopping" }, ["milk", "eggs", "bread", "coffee"]),
    fakeTask(2, "Bake the cake", { kind: "cooking" }),
    fakeTask(3, "Meet Rahul", { kind: "social", startTime: "18:00", person: "Rahul" }),
    fakeTask(4, "Call the bank", { kind: "errand", carryCount: 4 }),
  ];
  const refs = refsFor(today);
  const userLines = [
    "met Rahul, got the groceries, the cake didn't happen",
    "milk, eggs and bread, forgot the coffee. and the bank, ugh, I don't know",
    "let's do it friday at 10",
    "that's it, goodnight",
  ];
  const transcript: ChatTurn[] = [{ role: "assistant", content: "Evening. Today you had get groceries, bake the cake, meet Rahul and call the bank. How did it go?" }];
  console.log(`\nHushtick: ${transcript[0].content}`);
  for (const line of userLines) {
    transcript.push({ role: "user", content: line });
    console.log(`You:  ${line}`);
    const started = Date.now();
    const turn = await checkinTurn({ name: "Sam", ctx: { ...evening, time: "22:40" }, refs, tomorrow: [], transcript });
    transcript.push({ role: "assistant", content: turn.reply });
    // Apply updates to the fake tasks so the next turn sees the new state, as the real route does.
    for (const u of turn.updates) {
      const t = refs.get(u.ref);
      if (!t) continue;
      if (u.action === "done") t.status = "done";
      if (u.action === "drop") t.status = "dropped";
      if (u.action === "carry" || u.action === "move") refs.delete(u.ref);
    }
    const bits = [
      turn.updates.length && `updates ${turn.updates.map((u) => `${u.ref}:${u.action}${u.day ? `→${u.day}${u.startTime ? " " + u.startTime : ""}` : ""}`).join(" ")}`,
      turn.purchases.length && `bought ${turn.purchases.map((p) => p.name).join(", ")}`,
      turn.newTasks.length && `new ${turn.newTasks.map((t) => t.title).join(", ")}`,
    ].filter(Boolean).join(" | ");
    console.log(`Hushtick: ${turn.reply}   (${Date.now() - started} ms)`);
    if (bits) console.log(`      ${bits}`);
    if (turn.finished) {
      console.log(`      finished. Preview: ${turn.tomorrowPreview ?? "(none)"}`);
      return;
    }
  }
  console.log("      ! never finished after 4 exchanges");
}

if (mode === "dry") {
  console.log(calendarContext(evening), "\n");
  console.log(calendarContext(lateNight), "\n");
  console.log(JSON.stringify(zodOutputFormat(CheckinTurn).schema, null, 1));
} else {
  if (mode === "all" || mode === "capture") await runCapture();
  if (mode === "all" || mode === "checkin") await runCheckin();
}
