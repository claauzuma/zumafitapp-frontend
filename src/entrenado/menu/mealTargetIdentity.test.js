import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNativeMealTargetDrawerContext,
  mealTargetExecutionSeed,
  resolveMealTargetPlanEntry,
} from "./mealTargetIdentity.js";

const row = {
  mealTargetPlan: {
    mode: "per_meal",
    meals: [
      { id: "menu_target_breakfast", label: "Desayuno" },
      { id: "menu_target_lunch", label: "Almuerzo" },
      { id: "menu_target_dinner", label: "Cena" },
    ],
  },
};

test("mealId estable gana aunque Almuerzo cambie de posición", () => {
  const lunch = { id: "menu_target_lunch", name: "Almuerzo" };
  const resolved = resolveMealTargetPlanEntry(row, lunch, 0);

  assert.equal(resolved.id, "menu_target_lunch");
  assert.equal(mealTargetExecutionSeed({ baseMeal: lunch, planned: resolved, mealIndex: 0 }), "menu_target_lunch");
});

test("un ID estable desconocido nunca cae por índice sobre otra comida", () => {
  const resolved = resolveMealTargetPlanEntry(
    row,
    { id: "menu_target_merienda", name: "Merienda" },
    1
  );

  assert.equal(resolved, null);
});

test("el fallback por índice queda limitado a comidas legacy sin ID ni nombre único", () => {
  assert.equal(resolveMealTargetPlanEntry(row, {}, 2)?.id, "menu_target_dinner");
});

test("el botón + abre el selector de la meta exacta aunque cambie su posición", () => {
  const lunch = { id: "menu_target_lunch", name: "Almuerzo" };
  const context = buildNativeMealTargetDrawerContext({
    row,
    meal: lunch,
    mealIndex: 0,
    openFoodPicker: true,
  });

  assert.equal(context.meal.id, "menu_target_lunch");
  assert.equal(context.baseMeal.id, "menu_target_lunch");
  assert.equal(context.nativeTarget, true);
  assert.equal(context.openFoodPicker, true);
  assert.equal(
    mealTargetExecutionSeed({
      baseMeal: context.baseMeal,
      meal: context.meal,
      planned: resolveMealTargetPlanEntry(row, context.baseMeal, context.mealIndex),
      mealIndex: context.mealIndex,
    }),
    "menu_target_lunch"
  );
});
