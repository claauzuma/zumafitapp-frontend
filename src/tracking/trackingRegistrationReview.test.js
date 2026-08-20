import test from "node:test";
import assert from "node:assert/strict";

import {
  allocationsSumExactly,
  reviewTrackingRegistration,
  suggestTrackingAllocations,
} from "./trackingRegistrationReview.js";

const meal = (id, kcal, extras = {}) => ({
  kind: "meal_target",
  executionId: id,
  label: id,
  remaining: { kcal, proteina: kcal / 10, carbs: kcal / 8, grasas: kcal / 30 },
  ...extras,
});

test("proteína con déficit de hasta 4 g no genera warning severo", () => {
  assert.equal(reviewTrackingRegistration({
    target: { kcal: 500, proteina: 56 },
    result: { kcal: 500, proteina: 53 },
  }).issues.some((issue) => issue.code === "protein_shortfall"), false);
});

test("proteína con déficit mayor a 4 g genera warning visible", () => {
  const review = reviewTrackingRegistration({
    target: { kcal: 500, proteina: 56 },
    result: { kcal: 500, proteina: 50 },
    destinationLabel: "Almuerzo",
  });
  assert.equal(review.level, "warning");
  assert.equal(review.issues[0].difference, -6);
  assert.match(review.issues[0].message, /6 g/);
});

test("el exceso calórico informa diferencia exacta", () => {
  const review = reviewTrackingRegistration({
    target: { kcal: 500, proteina: 20 },
    result: { kcal: 560, proteina: 20 },
    destinationLabel: "Almuerzo",
  });
  assert.equal(review.level, "over");
  assert.equal(review.issues[0].difference, 60);
});

test("reparte libres más una comida sin alterar el consumo real", () => {
  const plan = suggestTrackingAllocations({
    candidate: { kcal: 600, proteina: 30, carbs: 60, grasas: 20 },
    freeCalories: { kind: "free", executionId: "flexible_margin", label: "Calorías libres", available: true, remainingKcal: 200 },
    meals: [meal("almuerzo", 400)],
  });
  assert.equal(plan.valid, true);
  assert.deepEqual(plan.allocations.map((item) => item.totals.kcal), [200, 400]);
  assert.equal(allocationsSumExactly(plan), true);
});

test("reparte libres más varias comidas y conserva kcal/macros exactos", () => {
  const plan = suggestTrackingAllocations({
    candidate: { kcal: 600, proteina: 30, carbs: 60, grasas: 20 },
    freeCalories: { kind: "free", executionId: "flexible_margin", label: "Calorías libres", available: true, remainingKcal: 150 },
    meals: [meal("almuerzo", 250), meal("cena", 200)],
  });
  assert.equal(plan.valid, true);
  assert.deepEqual(Object.fromEntries(plan.allocations.map((item) => [item.executionId, item.totals.kcal])), {
    flexible_margin: 150,
    almuerzo: 250,
    cena: 200,
  });
  assert.equal(allocationsSumExactly(plan), true);
});

test("reparte entre varias comidas sin libres y excluye Hechas", () => {
  const plan = suggestTrackingAllocations({
    candidate: { kcal: 600, proteina: 30 },
    meals: [
      meal("almuerzo", 350),
      meal("cena-hecha", 800, { status: "completed" }),
      meal("cena", 250),
    ],
  });
  assert.equal(plan.valid, true);
  assert.deepEqual(Object.fromEntries(plan.allocations.map((item) => [item.executionId, item.totals.kcal])), {
    almuerzo: 350,
    cena: 250,
  });
});

test("no simula una combinación cuando la capacidad es insuficiente", () => {
  const plan = suggestTrackingAllocations({
    candidate: { kcal: 600, proteina: 30 },
    meals: [meal("almuerzo", 200), meal("cena", 250)],
  });
  assert.equal(plan.valid, false);
  assert.equal(plan.unallocatedKcal, 150);
});

test("prioriza la comida que encaja mejor con la proteina proporcional", () => {
  const plan = suggestTrackingAllocations({
    candidate: { kcal: 400, proteina: 40, carbs: 30, grasas: 12 },
    meals: [
      { kind: "meal_target", executionId: "snack", label: "Snack", remaining: { kcal: 200, proteina: 5 }, fitScore: 10 },
      { kind: "meal_target", executionId: "cena", label: "Cena", remaining: { kcal: 200, proteina: 20 }, fitScore: 10 },
      { kind: "meal_target", executionId: "almuerzo", label: "Almuerzo", remaining: { kcal: 200, proteina: 20 }, fitScore: 9 },
    ],
  });

  assert.equal(plan.valid, true);
  assert.deepEqual(plan.allocations.map((entry) => entry.executionId), ["cena", "almuerzo"]);
});
