import test from "node:test";
import assert from "node:assert/strict";

import { isMealTargetCalorieComplete } from "./mealTargetCompletion.js";

test("Por meta cuenta como hecha dentro de una tolerancia de diez kcal", () => {
  assert.equal(isMealTargetCalorieComplete({ targetKcal: 675, consumedKcal: 665, trackedItemsCount: 1 }), true);
  assert.equal(isMealTargetCalorieComplete({ targetKcal: 675, consumedKcal: 675, trackedItemsCount: 1 }), true);
  assert.equal(isMealTargetCalorieComplete({ targetKcal: 675, consumedKcal: 685, trackedItemsCount: 1 }), true);
});

test("Por meta sigue pendiente fuera de la tolerancia", () => {
  assert.equal(isMealTargetCalorieComplete({ targetKcal: 675, consumedKcal: 664, trackedItemsCount: 1 }), false);
  assert.equal(isMealTargetCalorieComplete({ targetKcal: 675, consumedKcal: 686, trackedItemsCount: 1 }), false);
});

test("una meta sin FoodLogs no se completa aunque sus totales sean iguales", () => {
  assert.equal(isMealTargetCalorieComplete({ targetKcal: 675, consumedKcal: 675, trackedItemsCount: 0 }), false);
});
