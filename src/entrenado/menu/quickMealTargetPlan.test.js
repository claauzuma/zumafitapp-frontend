import test from "node:test";
import assert from "node:assert/strict";

import {
  appendPersonalMealTargetConfig,
  buildPersonalMealTargetConfig,
  calculateLockedMealMacros,
  personalMealTargetsFromTrackingDay,
} from "./quickMealTargetPlan.js";

test("crea una comida personal por meta y distribuye macros según las kcal del día", () => {
  const config = buildPersonalMealTargetConfig({
    type: "almuerzo",
    kcal: 600,
    dailyTarget: { kcal: 2400, proteina: 160, carbs: 280, grasas: 80 },
    existingMeals: [{ mealId: "desayuno" }],
    idSuffix: "test",
  });

  assert.deepEqual(config, {
    mealId: "menu_target_almuerzo_test",
    tipo: "almuerzo",
    nombre: "Almuerzo",
    orden: 1,
    meta: { kcal: 600, proteina: 40, carbs: 70, grasas: 20 },
  });
});

test("conserva las comidas configuradas y expone sólo las creadas por meta", () => {
  const mealsConfig = appendPersonalMealTargetConfig({
    mealsConfig: [{ mealId: "picoteo", tipo: "snack", nombre: "Picoteo", meta: null }],
  }, {
    type: "cena",
    kcal: 500,
    idSuffix: "personal",
  });

  const targets = personalMealTargetsFromTrackingDay({ mealsConfig });
  assert.equal(mealsConfig.length, 2);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].id, "menu_target_cena_personal");
  assert.equal(targets[0].target.kcal, 500);
  assert.equal(targets[0].personalTargetOnly, true);
});

test("las metas manuales de macros prevalecen sobre la distribución sugerida", () => {
  const config = buildPersonalMealTargetConfig({
    type: "merienda",
    kcal: 450,
    macros: { proteina: "35", carbs: "42.5", grasas: "12" },
    dailyTarget: { kcal: 2000, proteina: 120, carbs: 220, grasas: 70 },
    idSuffix: "macros",
  });

  assert.deepEqual(config.meta, {
    kcal: 450,
    proteina: 35,
    carbs: 42.5,
    grasas: 12,
  });
});

test("un macro bloqueado queda fijo y los abiertos completan las calorías objetivo", () => {
  const result = calculateLockedMealMacros({
    kcal: 700,
    macros: { proteina: 60, carbs: 0, grasas: 0 },
    locks: { proteina: true, carbs: false, grasas: false },
    dailyTarget: { proteina: 170, carbs: 206, grasas: 70 },
  });

  assert.equal(result.macros.proteina, 60);
  assert.ok(Math.abs(result.actualKcal - 700) <= 1);
  assert.equal(result.overConstrained, false);
  assert.ok(result.macros.carbs > 0);
  assert.ok(result.macros.grasas > 0);
});

test("informa cuando los macros bloqueados ya superan la meta calórica", () => {
  const result = calculateLockedMealMacros({
    kcal: 500,
    macros: { proteina: 150, carbs: 20, grasas: 10 },
    locks: { proteina: true, carbs: true, grasas: true },
  });

  assert.equal(result.actualKcal, 770);
  assert.equal(result.differenceKcal, 270);
  assert.equal(result.overConstrained, true);
});
