import assert from "node:assert/strict";
import test from "node:test";

import { homeTrialDaysRemaining, shouldShowHomeTrialReminder } from "./homeTrialReminder.js";

test("home hides the Pro trial reminder until only three days remain", () => {
  assert.equal(shouldShowHomeTrialReminder({ active: true, daysRemaining: 14 }), false);
  assert.equal(shouldShowHomeTrialReminder({ active: true, daysRemaining: 4 }), false);
  assert.equal(shouldShowHomeTrialReminder({ active: true, daysRemaining: 3 }), true);
  assert.equal(shouldShowHomeTrialReminder({ active: true, daysRemaining: 1 }), true);
  assert.equal(shouldShowHomeTrialReminder({ active: true, daysRemaining: 0 }), true);
  assert.equal(shouldShowHomeTrialReminder({ active: false, daysRemaining: 1 }), false);
});

test("home can derive the remaining trial days from endsAt", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  const trial = { active: true, endsAt: "2026-10-14T10:00:00.000Z" };
  assert.equal(homeTrialDaysRemaining(trial, now), 3);
  assert.equal(shouldShowHomeTrialReminder(trial, now), true);
  assert.equal(shouldShowHomeTrialReminder({ ...trial, endsAt: "2026-10-15T10:00:00.000Z" }, now), false);
});

test("home does not show a reminder when the remaining time is unknown", () => {
  assert.equal(homeTrialDaysRemaining({ active: true }), null);
  assert.equal(shouldShowHomeTrialReminder({ active: true }), false);
});
