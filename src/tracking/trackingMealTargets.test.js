import test from "node:test";
import assert from "node:assert/strict";

import {
  allocateTrackingRemainingBySelectedPercent,
  distributeTrackingRemainingTargets,
  pendingTrackingTargetMeals,
  trackingPendingProteinShortfall,
  trackingTargetFromRemainingPercent,
  trackingMealTargetBudget,
  trackingMealTargetOverages,
} from "./trackingMealTargets.js";

test("la meta de una comida usa el restante real y suma lo ya consumido en esa comida", () => {
  const budget = trackingMealTargetBudget({
    objective: { kcal: 2000, proteina: 150, carbs: 220, grasas: 60 },
    consumed: { kcal: 800, proteina: 60, carbs: 80, grasas: 20 },
    meals: [{ id: "cena", target: {} }],
    consumedByMeal: { cena: { kcal: 100, proteina: 10, carbs: 5, grasas: 2 } },
    mealId: "cena",
  });
  assert.deepEqual(budget.maximum, { kcal: 1300, proteina: 100, carbs: 145, grasas: 42 });
});

test("reserva el objetivo pendiente de las otras comidas", () => {
  const budget = trackingMealTargetBudget({
    objective: { kcal: 2000, proteina: 150, carbs: 220, grasas: 60 },
    consumed: { kcal: 800, proteina: 60, carbs: 80, grasas: 20 },
    meals: [
      { id: "merienda", target: { kcal: 400, proteina: 20, carbs: 50, grasas: 10 } },
      { id: "cena", target: {} },
    ],
    consumedByMeal: { cena: { kcal: 100, proteina: 10, carbs: 5, grasas: 2 } },
    mealId: "cena",
  });
  assert.deepEqual(budget.maximum, { kcal: 900, proteina: 80, carbs: 95, grasas: 32 });
});

test("detecta excesos de calorias y cada macro configurado", () => {
  const budget = {
    configured: { kcal: true, proteina: true, carbs: true, grasas: false },
    maximum: { kcal: 500, proteina: 40, carbs: 60, grasas: null },
  };
  assert.deepEqual(
    trackingMealTargetOverages({ kcal: 550, proteina: 45, carbs: 60, grasas: 90 }, budget)
      .map((entry) => entry.key),
    ["kcal", "proteina"]
  );
});

test("una unica comida pendiente recibe todo el restante exacto", () => {
  const result = distributeTrackingRemainingTargets({
    remaining: { kcal: 903, proteina: 58.5, carbs: 38.4, grasas: 56.1 },
    meals: [{ id: "cena", type: "cena" }],
  });
  assert.deepEqual(result, [{
    mealId: "cena",
    target: { kcal: 903, proteina: 58.5, carbs: 38.4, grasas: 56.1 },
  }]);
});

test("dos o mas comidas se ponderan por tipo y conservan todos los totales", () => {
  const remaining = { kcal: 1200, proteina: 90.3, carbs: 140.7, grasas: 40.2 };
  const result = distributeTrackingRemainingTargets({
    remaining,
    meals: [
      { id: "almuerzo", type: "almuerzo" },
      { id: "merienda", type: "merienda" },
      { id: "cena", type: "cena" },
    ],
  });
  const totals = result.reduce((sum, entry) => ({
    kcal: sum.kcal + entry.target.kcal,
    proteina: sum.proteina + entry.target.proteina,
    carbs: sum.carbs + entry.target.carbs,
    grasas: sum.grasas + entry.target.grasas,
  }), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  assert.deepEqual(
    Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(1))])),
    remaining
  );
  assert.ok(result[0].target.kcal > result[1].target.kcal);
  assert.ok(result[2].target.kcal > result[1].target.kcal);
});

test("no distribuye sobre comidas que ya tienen consumo", () => {
  const meals = [{ id: "desayuno" }, { id: "almuerzo" }, { id: "cena" }];
  const consumedByMeal = { desayuno: { kcal: 300 } };
  assert.deepEqual(
    pendingTrackingTargetMeals(meals, consumedByMeal).map((meal) => meal.id),
    ["almuerzo", "cena"]
  );
  assert.deepEqual(
    distributeTrackingRemainingTargets({ remaining: { kcal: 700 }, meals, consumedByMeal })
      .map((entry) => entry.mealId),
    ["almuerzo", "cena"]
  );
});

test("asigna 90 por ciento a la comida elegida y 10 por ciento a la otra", () => {
  const result = allocateTrackingRemainingBySelectedPercent({
    remaining: { kcal: 1000, proteina: 80, carbs: 120, grasas: 40 },
    meals: [
      { id: "merienda", type: "merienda" },
      { id: "snack", type: "snack" },
    ],
    selectedMealId: "merienda",
    selectedPercent: 90,
  });
  assert.deepEqual(result, [
    { mealId: "merienda", target: { kcal: 900, proteina: 72, carbs: 108, grasas: 36 } },
    { mealId: "snack", target: { kcal: 100, proteina: 8, carbs: 12, grasas: 4 } },
  ]);
});

test("el caso real de 1389 kcal deja 90 por ciento en merienda y 10 en snack", () => {
  const result = allocateTrackingRemainingBySelectedPercent({
    remaining: { kcal: 1389, proteina: 128.7, carbs: 162, grasas: 75 },
    meals: [
      { id: "merienda", type: "merienda" },
      { id: "snack", type: "snack" },
    ],
    selectedMealId: "merienda",
    selectedPercent: 90,
  });
  assert.deepEqual(result, [
    { mealId: "merienda", target: { kcal: 1250, proteina: 115.8, carbs: 145.8, grasas: 67.5 } },
    { mealId: "snack", target: { kcal: 139, proteina: 12.9, carbs: 16.2, grasas: 7.5 } },
  ]);
});

test("reparte el porcentaje sobrante entre tres comidas y conserva los totales", () => {
  const remaining = { kcal: 1389, proteina: 128.7, carbs: 162, grasas: 75 };
  const result = allocateTrackingRemainingBySelectedPercent({
    remaining,
    meals: [
      { id: "merienda", type: "merienda" },
      { id: "cena", type: "cena" },
      { id: "snack", type: "snack" },
    ],
    selectedMealId: "merienda",
    selectedPercent: 60,
  });
  const totals = result.reduce((sum, entry) => ({
    kcal: sum.kcal + entry.target.kcal,
    proteina: sum.proteina + entry.target.proteina,
    carbs: sum.carbs + entry.target.carbs,
    grasas: sum.grasas + entry.target.grasas,
  }), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  assert.deepEqual(
    Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(1))])),
    remaining
  );
  assert.equal(result[0].target.kcal, 833);
  assert.ok(result[1].target.kcal > result[2].target.kcal);
});

test("una unica comida recibe el 100 por ciento aunque se solicite otro porcentaje", () => {
  const result = allocateTrackingRemainingBySelectedPercent({
    remaining: { kcal: 903, proteina: 58.5, carbs: 38.4, grasas: 56.1 },
    meals: [{ id: "cena", type: "cena" }],
    selectedMealId: "cena",
    selectedPercent: 25,
  });
  assert.deepEqual(result[0].target, { kcal: 903, proteina: 58.5, carbs: 38.4, grasas: 56.1 });
});

test("la asignacion porcentual no modifica comidas que ya tienen consumo", () => {
  const result = allocateTrackingRemainingBySelectedPercent({
    remaining: { kcal: 1000, proteina: 100 },
    meals: [{ id: "almuerzo" }, { id: "merienda" }, { id: "cena" }],
    consumedByMeal: { almuerzo: { kcal: 250, proteina: 20 } },
    selectedMealId: "merienda",
    selectedPercent: 75,
  });
  assert.deepEqual(result.map((entry) => entry.mealId), ["merienda", "cena"]);
  assert.equal(result[0].target.kcal, 750);
  assert.equal(result[1].target.kcal, 250);
});

test("informa solo la proteina restante que todavia no tiene meta", () => {
  assert.equal(trackingPendingProteinShortfall({
    remaining: { proteina: 100 },
    meals: [
      { id: "merienda", target: { proteina: 60 } },
      { id: "cena", target: { proteina: 25 } },
      { id: "consumida", target: { proteina: 99 } },
    ],
    consumedByMeal: { consumida: { kcal: 300, proteina: 20 } },
  }), 15);
});

test("calcula una meta individual como porcentaje del restante sin tocar otras comidas", () => {
  assert.deepEqual(
    trackingTargetFromRemainingPercent(
      { kcal: 1389, proteina: 128.7, carbs: 162, grasas: 75 },
      90
    ),
    { kcal: 1250, proteina: 115.8, carbs: 145.8, grasas: 67.5 }
  );
  assert.deepEqual(
    trackingTargetFromRemainingPercent({ kcal: 1389, proteina: 128.7, carbs: 162, grasas: 75 }, 10),
    { kcal: 139, proteina: 12.9, carbs: 16.2, grasas: 7.5 }
  );
});
