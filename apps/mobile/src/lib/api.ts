import { accessToken, devUserId, supabase } from "./supabase";
import { demoRequest } from "./demo";
import { timezone } from "./time";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export type TaskKind = "general" | "shopping" | "social" | "cooking" | "errand" | "event";
export type TaskStatus = "open" | "done" | "dropped";

export type Item = {
  id: string; taskId: string; name: string; qty: number | null; unit: string | null;
  checked: boolean; suggested: boolean; suggestionReason: string | null;
};
export type Task = {
  id: string; title: string; kind: TaskKind; status: TaskStatus; day: string;
  startTime: string | null; durationMin: number | null; person: string | null; location: string | null;
  notes: string | null; carryCount: number; calendarEventId: string | null; items: Item[];
};
export type CalEvent = { id: string; title: string; start: string | null; end: string | null; allDay: boolean; location: string | null };
export type Me = {
  id: string; name: string | null; timezone: string; bedtime: string; voiceReplies: boolean;
  streak: number; bestStreak: number; graceNights: number; fullMoons: number; moonPhase: number;
  lastClosedDay: string | null; calendar: { available: boolean; connected: boolean };
};
export type Today = { day: string; bedtime: string; today: Task[]; tomorrow: Task[]; events: CalEvent[] };
export type PantryItem = {
  id: string; name: string; lastQty: number | null; unit: string | null; lastBoughtAt: string | null;
  avgIntervalDays: number | null; timesBought: number; daysLeft: number | null; summary: string;
};
export type Night = {
  id: string; day: string; closedAt: string | null; doneCount: number; carriedCount: number;
  droppedCount: number; usedGrace: boolean; tomorrowPreview: string | null;
};
export type Closed = { night: Night; user: Me; earnedMoon: boolean; phase: number };
export type CheckinState = {
  message: string; finished: boolean; today: Task[]; tomorrow: Task[];
  closed?: Closed | null; applied?: { taskId: string; title: string; action: string }[];
  purchases?: { name: string; qty?: number | null; unit?: string | null }[];
};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const DEMO = process.env.EXPO_PUBLIC_DEMO === "true";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (DEMO) {
    try { return (await demoRequest(method, path, body ?? {})) as T; } catch (e) { throw new ApiError((e as Error).message, 400); }
  }
  const headers: Record<string, string> = { "content-type": "application/json", "x-timezone": timezone() };
  if (supabase) {
    const token = await accessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  } else {
    headers["x-dev-user"] = await devUserId();
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("Can't reach Hushtick. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong. Try again.", res.status);
  return data as T;
}

export const api = {
  me: () => request<Me>("GET", "/me"),
  updateMe: (patch: Partial<Pick<Me, "name" | "bedtime" | "voiceReplies" | "timezone">>) => request<Me>("PATCH", "/me", patch),
  today: () => request<Today>("GET", "/days/today"),
  capture: (text: string) => request<{ created: Task[]; followUp: string | null }>("POST", "/capture", { text }),
  updateTask: (id: string, patch: Partial<Pick<Task, "status" | "day" | "startTime" | "title">>) => request<Task>("PATCH", `/tasks/${id}`, patch),
  deleteTask: (id: string) => request<{ ok: true }>("DELETE", `/tasks/${id}`),
  checkItem: (id: string, checked: boolean) => request<Item>("PATCH", `/items/${id}`, { checked }),
  addItem: (taskId: string, name: string) => request<Item>("POST", `/tasks/${taskId}/items`, { name }),
  pantry: () => request<{ items: PantryItem[] }>("GET", "/pantry"),
  addToList: (name: string, qty?: number | null, unit?: string | null) => request("POST", "/shopping/add", { name, qty, unit }),
  checkinStart: () => request<CheckinState & { nightId: string; day: string }>("POST", "/checkin/start", {}),
  checkinReply: (text: string) => request<CheckinState>("POST", "/checkin/reply", { text }),
  checkinFinish: () => request<{ closed: Closed }>("POST", "/checkin/finish", {}),
  nights: () => request<{ nights: Night[] }>("GET", "/nights"),
  googleConnectUrl: (redirect: string) => request<{ url: string }>("GET", `/google/connect?redirect=${encodeURIComponent(redirect)}`),
};
