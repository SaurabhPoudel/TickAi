import type { User } from "../db/schema.js";
import { daysBetween } from "./days.js";

export const MOON_CYCLE = 7; // nights for a full moon
export const MAX_GRACE = 2;

/** Pure streak math, kept separate so it's easy to test. */
export function nextStreak(u: Pick<User, "streak" | "graceNights" | "lastClosedDay" | "fullMoons" | "bestStreak">, day: string) {
  if (u.lastClosedDay === day) return { ...u, usedGrace: false, earnedMoon: false };
  let { streak, graceNights, fullMoons } = u;
  let usedGrace = false;
  const missed = u.lastClosedDay
    ? Math.round(daysBetween(new Date(`${u.lastClosedDay}T12:00:00Z`), new Date(`${day}T12:00:00Z`))) - 1
    : 0;
  if (!u.lastClosedDay || missed === 0) streak += 1;
  else if (missed > 0 && missed <= graceNights) { graceNights -= missed; streak += 1; usedGrace = true; }
  else streak = 1;

  const earnedMoon = streak % MOON_CYCLE === 0;
  if (earnedMoon) { fullMoons += 1; graceNights = Math.min(MAX_GRACE, graceNights + 1); }
  return { streak, graceNights, fullMoons, bestStreak: Math.max(u.bestStreak, streak), lastClosedDay: day, usedGrace, earnedMoon };
}

export function moonPhase(streak: number) {
  return streak === 0 ? 0 : (((streak - 1) % MOON_CYCLE) + 1) / MOON_CYCLE;
}

