import { google } from "googleapis";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import type { Task, User } from "../db/schema.js";
import { env, googleEnabled } from "../env.js";
import { addDays, zonedToUtc } from "../lib/days.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const stateKey = () => new TextEncoder().encode(env.GOOGLE_CLIENT_SECRET ?? "dev");

function oauth() {
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

/** Only send people back to our own apps after Google, never to an arbitrary URL. */
export function safeRedirect(requested?: string) {
  if (!requested) return env.APP_REDIRECT_URI;
  const appScheme = env.APP_REDIRECT_URI.split("://")[0];
  if (requested.startsWith(`${appScheme}://`) || requested.startsWith("exp://")) return requested;
  try {
    const origin = new URL(requested).origin;
    if (env.WEB_APP_ORIGINS.includes(origin)) return requested;
  } catch { /* fall through */ }
  return env.APP_REDIRECT_URI;
}

export async function connectUrl(userId: string, redirect?: string) {
  if (!googleEnabled) throw new Error("Google Calendar isn't configured on the server.");
  const state = await new SignJWT({ uid: userId, back: safeRedirect(redirect) }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(stateKey());
  return oauth().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES, state });
}

export async function readState(state: string) {
  const { payload } = await jwtVerify(state, stateKey());
  return { uid: String(payload.uid), back: safeRedirect(typeof payload.back === "string" ? payload.back : undefined) };
}

export async function finishConnect(code: string, state: string) {
  const payload = await readState(state);
  const { tokens } = await oauth().getToken(code);
  if (!tokens.refresh_token) throw new Error("Google didn't return a refresh token. Remove Hushtick's access in your Google account and connect again.");
  await db.update(schema.users).set({ googleRefreshToken: tokens.refresh_token }).where(eq(schema.users.id, String(payload.uid)));
}

function calendarFor(user: User) {
  if (!googleEnabled || !user.googleRefreshToken) return null;
  const auth = oauth();
  auth.setCredentials({ refresh_token: user.googleRefreshToken });
  return google.calendar({ version: "v3", auth });
}

/** Creates or updates the calendar event for a task. Only timed tasks go to the calendar. */
export async function syncTask(user: User, task: Task) {
  const cal = calendarFor(user);
  if (!cal) return;
  const calendarId = user.googleCalendarId ?? "primary";

  if (task.status === "dropped" || !task.startTime) {
    if (task.calendarEventId) {
      await cal.events.delete({ calendarId, eventId: task.calendarEventId }).catch(() => {});
      await db.update(schema.tasks).set({ calendarEventId: null }).where(eq(schema.tasks.id, task.id));
    }
    return;
  }

  const start = zonedToUtc(task.day, task.startTime, user.timezone);
  const end = new Date(start.getTime() + (task.durationMin ?? 60) * 60_000);
  const body = {
    summary: task.status === "done" ? `✓ ${task.title}` : task.title,
    location: task.location ?? undefined,
    description: "Added by Hushtick",
    start: { dateTime: start.toISOString(), timeZone: user.timezone },
    end: { dateTime: end.toISOString(), timeZone: user.timezone },
    extendedProperties: { private: { hushtickTaskId: task.id } },
  };

  if (task.calendarEventId) {
    await cal.events.patch({ calendarId, eventId: task.calendarEventId, requestBody: body });
  } else {
    const { data } = await cal.events.insert({ calendarId, requestBody: body });
    if (data.id) await db.update(schema.tasks).set({ calendarEventId: data.id }).where(eq(schema.tasks.id, task.id));
  }
}

/** Events already on the user's calendar for a day, excluding ones Hushtick created. */
export async function dayEvents(user: User, day: string) {
  const cal = calendarFor(user);
  if (!cal) return [];
  const { data } = await cal.events.list({
    calendarId: user.googleCalendarId ?? "primary",
    timeMin: zonedToUtc(day, "04:00", user.timezone).toISOString(),
    timeMax: zonedToUtc(addDays(day, 1), "04:00", user.timezone).toISOString(),
    singleEvents: true, orderBy: "startTime", maxResults: 50,
  });
  return (data.items ?? [])
    .filter((e) => !e.extendedProperties?.private?.hushtickTaskId && e.status !== "cancelled")
    .map((e) => ({
      id: e.id!, title: e.summary ?? "(no title)", location: e.location ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null, end: e.end?.dateTime ?? e.end?.date ?? null,
      allDay: Boolean(e.start?.date),
    }));
}

/** Calendar failures should never block the user's to-do list. */
export function syncInBackground(user: User, task: Task) {
  syncTask(user, task).catch((err) => console.warn("calendar sync failed", task.id, err?.message));
}
