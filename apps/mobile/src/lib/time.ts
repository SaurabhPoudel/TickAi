import type { Mode } from "@/theme/tokens";

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes from now until bedtime, handling bedtimes after midnight. */
export function minutesToBedtime(bedtime: string, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let diff = minutesOf(bedtime) - nowMin;
  if (diff < -6 * 60) diff += 24 * 60; // bedtime is "tomorrow" (e.g. 01:00)
  return diff;
}

export function skyMode(bedtime: string, now = new Date()): Mode {
  const toBed = minutesToBedtime(bedtime, now);
  const hour = now.getHours();
  if (toBed <= 30 || hour < 5) return "night";
  if (toBed <= 150) return "dusk";
  return "day";
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

export function formatTime(hhmm: string | null) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${suffix}` : `${hr}${suffix}`;
}

export function shiftTime(hhmm: string, minutes: number) {
  const total = (minutesOf(hhmm) + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Local calendar date as YYYY-MM-DD. Before 4am counts as the previous day, like the server. */
export function localDay(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
