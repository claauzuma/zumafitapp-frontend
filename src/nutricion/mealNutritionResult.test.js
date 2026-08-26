import assert from "node:assert/strict";
import test from "node:test";

import {
  MEAL_NUTRITION_CLASSIFICATION,
  adaptMealNutritionResult,
  mealNutritionDecisionWarning,
} from "./mealNutritionResult.js";

function bestEffortNutrition(overrides = {}) {
  return {
    policy: "meal_generation_balanced_v1",
    status: "BEST_EFFORT",
    recommended: false,
    usable: true,
    target: { kcal: 776, proteina: 57.6, carbs: 94.6, grasas: 15.6 },
    totals: { kcal: 772, proteina: 86.2, carbs: 76.5, grasas: 13.5 },
    difference: { kcal: -4, proteina: 28.6, carbs: -18.1, grasas: -2.1 },
    warning: {
      code: "MEAL_NUTRITION_BEST_EFFORT",
      title: "Revisá esta alternativa",
      summary: "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.",
      message: "Mensaje central",
      reasons: ["Proteína: sobran 28,6 g", "Proteína: sobran 28,6 g"],
      reasonCodes: ["PROTEIN_ABOVE_REASONABLE_RANGE"],
    },
    ...overrides,
  };
}

test("adapta alternative.nutrition sin volver a clasificar sus números", () => {
  const result = adaptMealNutritionResult({
    status: "SUCCESS",
    alternative: {
      foods: [{ foodId: "pollo" }],
      nutrition: bestEffortNutrition({
        totals: { kcal: 776, proteina: 57.6, carbs: 94.6, grasas: 15.6 },
      }),
    },
  });

  assert.equal(result.classification, MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT);
  assert.equal(result.usable, true);
  assert.equal(result.recommended, false);
  assert.equal(result.warning.summary, "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.");
  assert.deepEqual(result.warning.reasons, ["Proteína: sobran 28,6 g"]);
});

test("acepta response.nutrition cuando el envelope superior contiene la evaluación", () => {
  const result = adaptMealNutritionResult({
    status: "SUCCESS",
    nutrition: bestEffortNutrition(),
    alternative: { foods: [{ foodId: "pollo" }] },
  });
  assert.equal(result.contractPresent, true);
  assert.equal(result.classification, MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT);
  assert.equal(result.totals.proteina, 86.2);
});

test("la presentación usa solamente el warning central de BEST_EFFORT", () => {
  const result = adaptMealNutritionResult({ nutrition: bestEffortNutrition() });
  const warning = mealNutritionDecisionWarning(result);
  assert.equal(warning.title, "Revisá esta alternativa");
  assert.equal(warning.summary, "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.");
  assert.deepEqual(warning.codes, [
    "MEAL_NUTRITION_BEST_EFFORT",
    "PROTEIN_ABOVE_REASONABLE_RANGE",
  ]);
  assert.equal(warning.proposal.kcal, 772);
});

test("RECOMMENDED no muestra warning y NO_SOLUTION nunca es usable", () => {
  const recommended = adaptMealNutritionResult({
    nutrition: {
      ...bestEffortNutrition(),
      status: "RECOMMENDED",
      recommended: true,
      warning: null,
    },
  });
  assert.equal(recommended.usable, true);
  assert.equal(mealNutritionDecisionWarning(recommended), null);

  const none = adaptMealNutritionResult({
    status: "NO_SOLUTION",
    nutrition: { status: "NO_SOLUTION", recommended: false, usable: false },
  });
  assert.equal(none.classification, MEAL_NUTRITION_CLASSIFICATION.NO_SOLUTION);
  assert.equal(none.usable, false);
  assert.equal(mealNutritionDecisionWarning(none), null);
});

test("el fallback legacy usa estados explícitos, nunca diferencias nutricionales", () => {
  const result = adaptMealNutritionResult({
    status: "SUCCESS",
    recommended: true,
    alternative: {
      status: "TARGET_REACHED",
      foods: [{ foodId: "arroz" }],
      totals: { kcal: 1, proteina: 999, carbs: 0, grasas: 0 },
    },
  });
  assert.equal(result.contractPresent, false);
  assert.equal(result.classification, MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED);
  assert.equal(result.usable, true);

  const directBestEffort = adaptMealNutritionResult({
    status: "BEST_EFFORT",
    usable: true,
    foods: [{ foodId: "arroz" }],
    totals: { kcal: 999, proteina: 0, carbs: 0, grasas: 0 },
  });
  assert.equal(directBestEffort.classification, MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT);
  assert.equal(directBestEffort.usable, true);
});
