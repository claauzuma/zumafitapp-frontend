import assert from "node:assert/strict";
import test from "node:test";

import {
  clientPlanLabel,
  coachProfessionalPlanFromUser,
  coachProfessionalPlanLabel,
  coachProfessionalPlanSummary,
  coachTrialState,
  legacyCoachPlanCode,
  normalizeCoachProfessionalPlan,
} from "./professionalPlans.js";

test("normaliza planes profesionales canónicos y legacy sin mezclarlos con el label de cliente", () => {
  assert.equal(normalizeCoachProfessionalPlan("trial_pro"), "coach_initial");
  assert.equal(normalizeCoachProfessionalPlan("coach_pro"), "coach_pro");
  assert.equal(normalizeCoachProfessionalPlan("coach_vip"), "coach_ai");
  assert.equal(coachProfessionalPlanLabel("trial_pro"), "Inicial");
  assert.equal(coachProfessionalPlanLabel("coach_ai"), "VIP");
  assert.match(coachProfessionalPlanSummary("coach_initial"), /propios menús y comidas/);
  assert.match(coachProfessionalPlanSummary("coach_ai"), /premium/);
  assert.equal(clientPlanLabel("free"), "Free");
});

test("prioriza coachSubscription.plan y conserva el mapeo legacy al persistir", () => {
  const user = {
    plan: "trial_pro",
    coachSubscription: { plan: "coach_pro", status: "active" },
  };
  assert.equal(coachProfessionalPlanFromUser(user), "coach_pro");
  assert.equal(legacyCoachPlanCode("coach_initial"), "trial_pro");
  assert.equal(legacyCoachPlanCode("coach_pro"), "pro");
  assert.equal(legacyCoachPlanCode("coach_ai"), "vip");
});

test("Prueba Pro se determina por estado y vencimiento, no por coach_initial", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");
  const initialActive = coachTrialState({
    plan: "trial_pro",
    subscription: { status: "active", trialEndsAt: "2026-07-01T00:00:00.000Z" },
  }, now);
  assert.equal(initialActive.isTrial, false);
  assert.equal(initialActive.expired, false);

  const trial = coachTrialState({
    plan: "pro",
    subscription: { status: "trial", trialEndsAt: "2026-07-01T00:00:00.000Z" },
  }, now);
  assert.equal(trial.isTrial, true);
  assert.equal(trial.expired, true);
});
