import assert from "node:assert/strict";
import test from "node:test";

import {
  activePlanningMealIds,
  orphanedGeneratedMealConfigIds,
} from "./orphanedMealConfigs.js";

test("identifica todas las identidades que siguen vinculadas a una planificación", () => {
  const ids = activePlanningMealIds({
    destinations: [{
      executionId: "menu_target_lunch",
      menuMealId: "lunch",
      mealTargetId: "target_lunch",
    }],
  });
  assert.deepEqual([...ids], ["menu_target_lunch", "lunch", "target_lunch"]);
});

test("limpia sólo configs menu_target vacías, sin meta y sin planificación activa", () => {
  const trackingDay = {
    mealsConfig: [
      { mealId: "menu_target_orphan", meta: null },
      { mealId: "menu_target_active", meta: null },
      { mealId: "menu_target_with_food", meta: null },
      { mealId: "menu_target_with_goal", meta: { kcal: 500 } },
      { mealId: "almuerzo_manual", meta: null },
    ],
    meals: {
      menu_target_orphan: [],
      menu_target_active: [],
      menu_target_with_food: [{ id: "food-1" }],
      menu_target_with_goal: [],
      almuerzo_manual: [],
    },
  };

  assert.deepEqual(orphanedGeneratedMealConfigIds({
    trackingDay,
    destinationResult: {
      destinations: [{ executionId: "menu_target_active" }],
    },
  }), ["menu_target_orphan"]);
});

test("un borrador local evita limpiar la comida hasta que se confirme o descarte", () => {
  assert.deepEqual(orphanedGeneratedMealConfigIds({
    trackingDay: {
      mealsConfig: [{ mealId: "menu_target_lunch", meta: null }],
      meals: { menu_target_lunch: [] },
    },
    destinationResult: { destinations: [] },
    draftMealIds: ["menu_target_lunch"],
  }), []);
});

test("limpia una card vacía reemplazada por una meta del mismo momento", () => {
  assert.deepEqual(orphanedGeneratedMealConfigIds({
    trackingDay: {
      mealsConfig: [
        { mealId: "almuerzo_vacio", tipo: "almuerzo", meta: null },
        {
          mealId: "tracked_almuerzo_real",
          tipo: "almuerzo",
          personalTarget: true,
          meta: { kcal: 821, proteina: 60, carbs: 94.4, grasas: 24.4 },
        },
      ],
      meals: {
        almuerzo_vacio: [],
        tracked_almuerzo_real: [{ id: "food-1", kcal: 241 }],
      },
    },
    destinationResult: { destinations: [] },
  }), ["almuerzo_vacio"]);
});

test("no limpia una comida con alimentos, borrador ni una configuración estructural", () => {
  const trackingDay = {
    mealsConfig: [
      { mealId: "almuerzo_con_alimentos", tipo: "almuerzo", meta: null },
      { mealId: "almuerzo_con_borrador", tipo: "almuerzo", meta: null },
      { mealId: "picoteo", tipo: "almuerzo", meta: null },
      {
        mealId: "menu_target_almuerzo",
        tipo: "almuerzo",
        personalTarget: true,
        meta: { kcal: 700 },
      },
    ],
    meals: {
      almuerzo_con_alimentos: [{ id: "food-1" }],
      almuerzo_con_borrador: [],
      picoteo: [],
      menu_target_almuerzo: [],
    },
  };

  assert.deepEqual(orphanedGeneratedMealConfigIds({
    trackingDay,
    destinationResult: { destinations: [] },
    draftMealIds: ["almuerzo_con_borrador"],
  }), []);
});

