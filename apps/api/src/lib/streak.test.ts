import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStreak, moonPhase } from "../lib/streak.js";

const base = { streak: 0, graceNights: 1, lastClosedDay: null as string | null, fullMoons: 0, bestStreak: 0 };

test("first night starts a streak", () => {
  assert.equal(nextStreak(base, "2026-09-29").streak, 1);
});

test("consecutive nights extend the streak", () => {
  assert.equal(nextStreak({ ...base, streak: 3, lastClosedDay: "2026-09-28" }, "2026-09-29").streak, 4);
});

test("one missed night uses a grace night", () => {
  const s = nextStreak({ ...base, streak: 5, lastClosedDay: "2026-09-27" }, "2026-09-29");
  assert.equal(s.streak, 6);
  assert.equal(s.graceNights, 0);
  assert.equal(s.usedGrace, true);
});

test("too many missed nights resets", () => {
  assert.equal(nextStreak({ ...base, streak: 5, lastClosedDay: "2026-09-20" }, "2026-09-29").streak, 1);
});

test("seventh night earns a full moon and a grace night", () => {
  const s = nextStreak({ ...base, streak: 6, graceNights: 0, lastClosedDay: "2026-09-28" }, "2026-09-29");
  assert.equal(s.earnedMoon, true);
  assert.equal(s.fullMoons, 1);
  assert.equal(s.graceNights, 1);
});

test("moon phase fills over seven nights", () => {
  assert.equal(moonPhase(0), 0);
  assert.equal(moonPhase(7), 1);
  assert.ok(Math.abs(moonPhase(8) - 1 / 7) < 1e-9);
});
