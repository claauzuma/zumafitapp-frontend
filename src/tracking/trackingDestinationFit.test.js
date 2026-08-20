import test from "node:test";
import assert from "node:assert/strict";

import { buildTrackingDestinationFit, menuTargetExecutionId } from "./trackingDestinationFit.js";

test("allocations reemplazan la imputación directa sin duplicar consumo", () => {
  const result = buildTrackingDestinationFit({
    destinations: {
      freeCalories: { kind: "free", available: true, remainingKcal: 200 },
      meals: [{ kind: "meal_target", menuMealId: "almuerzo", label: "Almuerzo", target: { kcal: 500, proteina: 30 } }],
    },
    registration: null,
    trackingMeals: {
      menu_target_almuerzo: [{ kcal: 600, proteina: 30, writeRequestId: "split-1" }],
    },
    allocations: [{ writeRequestId: "split-1" }],
    allocationTotalsByDestination: {
      flexible_margin: { kcal: 200, proteina: 10 },
      menu_target_almuerzo: { kcal: 400, proteina: 20 },
    },
  });

  assert.equal(result.meals[0].consumed.kcal, 400);
  assert.equal(result.meals[0].remaining.kcal, 100);
  assert.equal(result.freeCalories.remainingKcal, 0);
});

test("menu_target conserva la misma identidad de 80 caracteres que el backend", () => {
  const longMealId = `meal-${"x".repeat(120)}`;
  const executionId = menuTargetExecutionId(longMealId);
  assert.equal(executionId.length, 80);

  const result = buildTrackingDestinationFit({
    destinations: {
      meals: [{ kind: "meal_target", menuMealId: longMealId, target: { kcal: 500 } }],
    },
    trackingMeals: { [executionId]: [{ kcal: 125 }] },
  });
  assert.equal(result.meals[0].executionId, executionId);
  assert.equal(result.meals[0].consumed.kcal, 125);
});
