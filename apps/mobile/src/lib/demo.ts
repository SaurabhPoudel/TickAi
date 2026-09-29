/**
 * An in-browser stand-in for the API, used when EXPO_PUBLIC_DEMO=true.
 * It keeps sample data in memory so the app can be tried without a server, database or API key.
 * Capture and the check-in use simple rules here, not Claude.
 */
import type { CalEvent, Closed, Item, Me, Night, PantryItem, Task, TaskKind } from "./api";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function logicalToday() {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return iso(d);
}
function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

function item(taskId: string, name: string, extra: Partial<Item> = {}): Item {
  return { id: id("i"), taskId, name, qty: null, unit: null, checked: false, suggested: false, suggestionReason: null, ...extra };
}
function task(title: string, kind: TaskKind, day: string, extra: Partial<Task> = {}, items: (tid: string) => Item[] = () => []): Task {
  const tid = id("t");
  return {
    id: tid, title, kind, status: "open", day, startTime: null, durationMin: null, person: null, location: null,
    notes: null, carryCount: 0, calendarEventId: null, items: items(tid), ...extra,
  };
}

const today = logicalToday();
const tomorrow = addDays(today, 1);

const me: Me = {
  id: "demo", name: "Sam", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, bedtime: "22:30", voiceReplies: false,
  streak: 5, bestStreak: 9, graceNights: 1, fullMoons: 1, moonPhase: 5 / 7, lastClosedDay: addDays(today, -1),
  calendar: { available: true, connected: false },
};

let tasks: Task[] = [
  task("Get groceries", "shopping", today, {}, (t) => [
    item(t, "milk", { qty: 2, unit: "L", suggestionReason: "Last time: 2 L, 6 days ago. Usually lasts 7 days." }),
    item(t, "eggs", { qty: 12 }),
    item(t, "bread", { checked: true }),
    item(t, "flour", { suggested: true, suggestionReason: "For what you're cooking" }),
    item(t, "butter", { suggested: true, suggestionReason: "For what you're cooking" }),
  ]),
  task("Bake the cake", "cooking", today),
  task("Meet Rahul", "social", today, { startTime: "18:00", person: "Rahul", calendarEventId: "demo" }),
  task("Call the bank", "errand", today, { carryCount: 3 }),
  task("Water the plants", "general", today, { status: "done" }),
  task("Dentist", "event", tomorrow, { startTime: "10:00", location: "Smile Clinic" }),
  task("Send mum the photos", "social", tomorrow, { person: "Mum" }),
];

const events: CalEvent[] = [
  { id: "e1", title: "Team standup", start: `${today}T09:30:00`, end: `${today}T09:45:00`, allDay: false, location: null },
  { id: "e2", title: "Yoga class", start: `${today}T19:30:00`, end: `${today}T20:30:00`, allDay: false, location: null },
];

const pantry: PantryItem[] = [
  { id: "p1", name: "milk", lastQty: 2, unit: "L", lastBoughtAt: daysAgo(6), avgIntervalDays: 7, timesBought: 8, daysLeft: 1, summary: "Last time: 2 L, 6 days ago. Usually lasts 7 days." },
  { id: "p2", name: "coffee", lastQty: 250, unit: "g", lastBoughtAt: daysAgo(16), avgIntervalDays: 18, timesBought: 4, daysLeft: 2, summary: "Last time: 250 g, 16 days ago. Usually lasts 18 days." },
  { id: "p3", name: "eggs", lastQty: 12, unit: null, lastBoughtAt: daysAgo(5), avgIntervalDays: 9, timesBought: 6, daysLeft: 4, summary: "Last time: 12, 5 days ago. Usually lasts 9 days." },
  { id: "p4", name: "rice", lastQty: 5, unit: "kg", lastBoughtAt: daysAgo(12), avgIntervalDays: 30, timesBought: 3, daysLeft: 18, summary: "Last time: 5 kg, 12 days ago. Usually lasts 30 days." },
  { id: "p5", name: "bananas", lastQty: 6, unit: null, lastBoughtAt: daysAgo(3), avgIntervalDays: null, timesBought: 1, daysLeft: null, summary: "Last time: 6, 3 days ago." },
];

const nights: Night[] = Array.from({ length: 24 }, (_, i) => i + 1)
  .filter((i) => ![7, 8, 15, 21].includes(i))
  .map((i) => ({
    id: `n${i}`, day: addDays(today, -i), closedAt: daysAgo(i), doneCount: 2 + (i % 4), carriedCount: i % 3,
    droppedCount: i % 5 === 0 ? 1 : 0, usedGrace: i === 6, tomorrowPreview: null,
  }));

// ---- Capture: split on commas and "and", guess kinds and times. ----

const KINDS: [RegExp, TaskKind][] = [
  [/\b(buy|get|pick up|groceries|shop|out of)\b/i, "shopping"],
  [/\b(cook|bake|make dinner|make lunch)\b/i, "cooking"],
  [/\b(meet|call|see|visit|text)\b/i, "social"],
  [/\b(bank|post office|pay|renew|return)\b/i, "errand"],
  [/\b(dentist|doctor|appointment|class)\b/i, "event"],
];

function capture(text: string) {
  const parts = text.replace(/\b(i need to|i want to|i have to|i should|um|uh|then)\b/gi, "")
    .split(/,|\band\b(?! (?:eggs|bread|milk))/i).map((s) => s.trim()).filter(Boolean);
  const created: Task[] = [];
  for (const raw of parts) {
    const kind = KINDS.find(([re]) => re.test(raw))?.[1] ?? "general";
    const at = raw.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let startTime: string | null = null;
    if (at) {
      let h = Number(at[1]);
      if (at[3]?.toLowerCase() === "pm" || (!at[3] && h >= 1 && h <= 7)) h = h === 12 ? 12 : h + 12;
      startTime = `${pad(h % 24)}:${at[2] ?? "00"}`;
    }
    const day = /\btomorrow\b/i.test(raw) ? tomorrow : today;
    let title = raw.replace(/\bat \d{1,2}(:\d{2})?\s*(am|pm)?/i, "").replace(/\b(today|tomorrow)\b/i, "").trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    const person = kind === "social" ? raw.match(/\b(?:meet|call|see|visit|text) ([A-Z][a-z]+)/)?.[1] ?? null : null;
    created.push(task(title, kind, day, { startTime, person }));
  }
  tasks = [...tasks, ...created];
  const vague = created.find((t) => t.kind === "social" && !t.person);
  return { created, followUp: vague ? "Who are you meeting, and roughly what time?" : null };
}

// ---- Check-in: a short scripted conversation. ----

let checkinTurns = 0;
let closedToday = false;

function checkinStart() {
  const open = tasks.filter((t) => t.day === today && t.status === "open");
  checkinTurns = 0;
  if (closedToday) return { nightId: "demo", day: today, message: "You already tucked in today. Sleep well.", finished: true, ...lists() };
  const titles = open.slice(0, 4).map((t) => t.title.charAt(0).toLowerCase() + t.title.slice(1));
  const list = titles.length <= 1 ? titles[0] ?? "" : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
  const message = open.length
    ? `Evening, ${me.name}. Today you had ${list}. How did it go?`
    : `Evening, ${me.name}. You checked off everything today. Anything to add for tomorrow?`;
  return { nightId: "demo", day: today, message, finished: false, ...lists() };
}

function lists() {
  return { today: tasks.filter((t) => t.day === today), tomorrow: tasks.filter((t) => t.day === tomorrow) };
}

function checkinReply(text: string) {
  checkinTurns += 1;
  const said = text.toLowerCase();
  const applied: { taskId: string; title: string; action: string }[] = [];
  for (const t of tasks.filter((x) => x.day === today && x.status === "open")) {
    const words = t.title.toLowerCase().split(" ").filter((w) => w.length > 3);
    if (!words.some((w) => said.includes(w)) && !(t.person && said.includes(t.person.toLowerCase()))) continue;
    const negative = new RegExp(`(didn't|did not|no|not|skip)[^.,]*(${words.join("|")})|(${words.join("|")})[^.,]*(didn't|did not|not|wait)`).test(said);
    t.status = negative ? t.status : "done";
    if (negative) { t.day = tomorrow; t.carryCount += 1; }
    applied.push({ taskId: t.id, title: t.title, action: negative ? "carry" : "done" });
  }
  const bought = pantry.filter((p) => said.includes(p.name)).map((p) => ({ name: p.name, qty: p.lastQty, unit: p.unit }));
  const stillOpen = tasks.filter((t) => t.day === today && t.status === "open");
  const done = /\b(that's it|thats it|goodnight|good night|nothing else|done)\b/.test(said) || !stillOpen.length || checkinTurns >= 3;
  if (done) return { message: "Got it. Everything's settled, sleep well.", finished: true, applied, purchases: bought, ...lists(), closed: close() };
  const stubborn = stillOpen.find((t) => t.carryCount >= 3);
  const message = stubborn
    ? `And ${stubborn.title.toLowerCase()} keeps slipping. Want to give it a set time tomorrow, or let it go?`
    : `Nice. What about ${stillOpen.map((t) => t.title.toLowerCase()).join(" and ")}?`;
  return { message, finished: false, applied, purchases: bought, ...lists() };
}

function close(): Closed {
  const todays = tasks.filter((t) => t.day === today);
  let carried = 0;
  for (const t of todays) if (t.status === "open") { t.day = tomorrow; t.carryCount += 1; carried += 1; }
  closedToday = true;
  me.streak += 1;
  me.bestStreak = Math.max(me.bestStreak, me.streak);
  const earnedMoon = me.streak % 7 === 0;
  if (earnedMoon) { me.fullMoons += 1; me.graceNights = Math.min(2, me.graceNights + 1); }
  me.moonPhase = (((me.streak - 1) % 7) + 1) / 7;
  me.lastClosedDay = today;
  const first = tasks.filter((t) => t.day === tomorrow).sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"))[0];
  const night: Night = {
    id: id("n"), day: today, closedAt: new Date().toISOString(), doneCount: todays.filter((t) => t.status === "done").length,
    carriedCount: carried, droppedCount: todays.filter((t) => t.status === "dropped").length, usedGrace: false,
    tomorrowPreview: first ? `Tomorrow starts with ${first.title}${first.startTime ? ` at ${first.startTime}` : ""}.` : "Tomorrow is wide open.",
  };
  nights.unshift(night);
  return { night, user: { ...me }, earnedMoon, phase: me.moonPhase };
}

// ---- Router ----

export async function demoRequest(method: string, path: string, body: any): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 250)); // feel like a network
  const [p] = path.split("?");
  const findTask = (tid: string) => tasks.find((t) => t.id === tid);

  if (method === "GET" && p === "/me") return { ...me };
  if (method === "PATCH" && p === "/me") return Object.assign(me, body);
  if (method === "GET" && p === "/days/today") return { day: today, bedtime: me.bedtime, ...lists(), events };
  if (method === "POST" && p === "/capture") return capture(String(body.text ?? ""));
  if (method === "GET" && p === "/pantry") return { items: pantry };
  if (method === "GET" && p === "/nights") return { nights };
  if (method === "POST" && p === "/checkin/start") return checkinStart();
  if (method === "POST" && p === "/checkin/reply") return checkinReply(String(body.text ?? ""));
  if (method === "POST" && p === "/checkin/finish") return { closed: close() };
  if (method === "GET" && p === "/google/connect") throw new Error("Google Calendar isn't available in the demo.");
  if (method === "POST" && p === "/shopping/add") {
    let list = tasks.find((t) => t.kind === "shopping" && t.status === "open" && t.day >= today);
    if (!list) { list = task("Get groceries", "shopping", today); tasks.push(list); }
    list.items.push(item(list.id, body.name, { qty: body.qty ?? null, unit: body.unit ?? null }));
    return list;
  }

  let m = p.match(/^\/tasks\/([^/]+)$/);
  if (m && method === "PATCH") return Object.assign(findTask(m[1])!, body);
  if (m && method === "DELETE") { tasks = tasks.filter((t) => t.id !== m![1]); return { ok: true }; }
  m = p.match(/^\/tasks\/([^/]+)\/items$/);
  if (m && method === "POST") { const it = item(m[1], body.name); findTask(m[1])!.items.push(it); return it; }
  m = p.match(/^\/items\/([^/]+)$/);
  if (m && method === "PATCH") {
    const it = tasks.flatMap((t) => t.items).find((i) => i.id === m![1])!;
    it.checked = body.checked;
    return it;
  }
  throw new Error(`Demo doesn't handle ${method} ${p}`);
}
