import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBalancedMealTargets,
  MEAL_TYPE_OPTIONS,
  mealTargetTotals,
  normalizeStoredMealTargetPlan,
  rebalanceMealTargets,
  validateMealTargetPlan,
  updateMealMoment,
} from "./weeklyMealTargets.js";

const target = { kcal: 1906, p: 166, c: 162, g: 66 };

test("el reparto equilibrado soporta de 3 a 6 comidas y cierra todos los totales", () => {
  [3, 4, 5, 6].forEach((count) => {
    const meals = buildBalancedMealTargets(target, count, "tuesday");
    assert.equal(meals.length, count);
    assert.deepEqual(mealTargetTotals(meals), target);
    assert.equal(validateMealTargetPlan(meals, target).valid, true);
  });
});

test("cada slot puede cambiar de momento sin alterar su objetivo nutricional", () => {
  const meals = buildBalancedMealTargets(target, 3, "thursday");
  const lunch = MEAL_TYPE_OPTIONS.find((option) => option.label === "Almuerzo");
  const snack = MEAL_TYPE_OPTIONS.find((option) => option.label === "Merienda");
  const withoutBreakfast = updateMealMoment(updateMealMoment(meals, meals[0].id, lunch), meals[1].id, snack);
  assert.deepEqual(withoutBreakfast.map((meal) => meal.label), ["Almuerzo", "Merienda", "Cena"]);
  assert.deepEqual(mealTargetTotals(withoutBreakfast), target);
  const rebalanced = rebalanceMealTargets(target, withoutBreakfast, "thursday");
  assert.deepEqual(rebalanced.map((meal) => meal.label), ["Almuerzo", "Merienda", "Cena"]);
  assert.deepEqual(mealTargetTotals(rebalanced), target);
});

test("la validación detecta una edición que rompe la meta diaria", () => {
  const meals = buildBalancedMealTargets(target, 4, "tuesday");
  meals[0] = { ...meals[0], target: { ...meals[0].target, p: meals[0].target.p + 3 } };
  const validation = validateMealTargetPlan(meals, target);
  assert.equal(validation.valid, false);
  assert.equal(validation.differences.p, 3);
});

test("la validación acepta el reparto exacto de 2.240 kcal del planificador", () => {
  const dailyTarget = { kcal: 2240, p: 190, c: 235, g: 60 };
  const meals = [
    { target: { kcal: 493, p: 41.8, c: 51.7, g: 13.2 } },
    { target: { kcal: 739, p: 62.7, c: 77.6, g: 19.8 } },
    { target: { kcal: 336, p: 28.5, c: 35.2, g: 9 } },
    { target: { kcal: 672, p: 57, c: 70.5, g: 18 } },
  ];

  assert.deepEqual(mealTargetTotals(meals), dailyTarget);
  assert.equal(validateMealTargetPlan(meals, dailyTarget).valid, true);
});

test("la normalización conserva una planificación persistida y rechaza contenido ambiguo", () => {
  const meals = buildBalancedMealTargets(target, 4, "tuesday");
  assert.equal(normalizeStoredMealTargetPlan({ mode: "per_meal", meals }).meals.length, 4);
  assert.equal(normalizeStoredMealTargetPlan({ mode: "mixed", meals }), null);
  assert.equal(normalizeStoredMealTargetPlan({ mode: "per_meal", meals: meals.slice(0, 2) }), null);
});
