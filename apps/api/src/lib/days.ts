/**
 * Tuck's "day" ends when you go to bed, not at midnight.
 * Anything before 4am still belongs to the previous day, so night owls
 * who check in at 1:30am close out the right day.
 */
const DAY_BOUNDARY_HOUR = 4;

function parts(tz: string, at: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "long",
  });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), weekday: p.weekday as string };
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function logicalToday(tz: string, at = new Date()): string {
  const p = parts(tz, at);
  return p.hour < DAY_BOUNDARY_HOUR ? addDays(p.date, -1) : p.date;
}

export function localClock(tz: string, at = new Date()) {
  const p = parts(tz, at);
  return { ...p, time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}` };
}

export function weekdayOf(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 86_400_000;
}

/** Converts a local date + HH:MM in a time zone to a UTC Date. */
export function zonedToUtc(isoDate: string, hhmm: string, tz: string): Date {
  const guess = new Date(`${isoDate}T${hhmm}:00Z`);
  const p = parts(tz, guess);
  const asLocal = new Date(`${p.date}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:00Z`);
  return new Date(guess.getTime() - (asLocal.getTime() - guess.getTime()));
}
