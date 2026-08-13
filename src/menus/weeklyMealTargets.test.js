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

test("la normalización conserva una planificación persistida y rechaza contenido ambiguo", () => {
  const meals = buildBalancedMealTargets(target, 4, "tuesday");
  assert.equal(normalizeStoredMealTargetPlan({ mode: "per_meal", meals }).meals.length, 4);
  assert.equal(normalizeStoredMealTargetPlan({ mode: "mixed", meals }), null);
  assert.equal(normalizeStoredMealTargetPlan({ mode: "per_meal", meals: meals.slice(0, 2) }), null);
});
