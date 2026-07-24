import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRemainingMomentTargets,
  calculateManualDayProgress,
  calculateMenuAdherence,
  calculateNutritionAdherence,
  createManualCompletionPlan,
  distributeNutritionTarget,
  menuTrackingConsumedTotals,
  removeManualCompletionMoment,
  resolveTrackingMealCalculationTarget,
} from "./manualDayCompletion.js";

const target = { kcal: 2000, proteina: 150, carbs: 220, grasas: 65 };
const menuConsumed = { kcal: 1350, proteina: 100, carbs: 150, grasas: 40 };

test("calcula el restante sin tracking manual previo", () => {
  const result = calculateManualDayProgress({ target, menuConsumed });
  assert.equal(result.available.kcal, 650);
  assert.equal(result.trackedConsumed.kcal, 0);
  assert.equal(result.remaining.kcal, 650);
});

test("descuenta tracking manual previo una sola vez", () => {
  const result = calculateManualDayProgress({
    target,
    menuConsumed,
    trackedConsumed: { kcal: 130, proteina: 15, carbs: 20, grasas: 4 },
  });
  assert.equal(result.available.kcal, 650);
  assert.equal(result.trackedConsumed.kcal, 130);
  assert.equal(result.consumed.kcal, 1480);
  assert.equal(result.remaining.kcal, 520);
});

test("incluye margen flexible realmente consumido dentro de la fuente del Menu", () => {
  const result = calculateManualDayProgress({
    target,
    menuConsumed: { kcal: 1450, proteina: 102, carbs: 165, grasas: 43 },
    trackedConsumed: { kcal: 130 },
  });
  assert.equal(result.remaining.kcal, 420);
});

test("mantiene las calorias libres no consumidas dentro del restante", () => {
  const result = calculateManualDayProgress({
    target: { kcal: 2776 },
    menuConsumed: { kcal: 2523 },
  });
  assert.equal(result.remaining.kcal, 253);
});

test("descuenta calorias libres parciales una sola vez", () => {
  const menuTrackingDay = {
    tracking: {
      consumedTotals: { kcal: 2623 },
      manualEntries: [
        { source: "flexible_margin", countsAsMenuMeal: false, kcal: 100 },
      ],
    },
  };
  const result = calculateManualDayProgress({
    target: { kcal: 2776 },
    menuConsumed: menuTrackingConsumedTotals(menuTrackingDay),
  });
  assert.equal(result.menuConsumed.kcal, 2623);
  assert.equal(result.trackedConsumed.kcal, 0);
  assert.equal(result.remaining.kcal, 153);
});

test("cuenta calorias libres completas y excedidas sin bloquear el tracking", () => {
  const completed = calculateManualDayProgress({
    target: { kcal: 2776 },
    menuConsumed: { kcal: 2776 },
  });
  const exceeded = calculateManualDayProgress({
    target: { kcal: 2776 },
    menuConsumed: { kcal: 2823 },
  });
  assert.equal(completed.status, "reached");
  assert.equal(completed.remaining.kcal, 0);
  assert.equal(exceeded.status, "exceeded");
  assert.equal(exceeded.remaining.kcal, -47);
  assert.equal(exceeded.exceededBy, 47);
});

test("no vuelve a sumar manualEntries flexibles sobre consumedTotals", () => {
  const consumed = menuTrackingConsumedTotals({
    tracking: {
      consumedTotals: { kcal: 2623, proteina: 120 },
      manualEntries: [
        { source: "flexible_margin", countsAsMenuMeal: false, kcal: 100 },
      ],
    },
  });
  assert.equal(consumed.kcal, 2623);
  assert.equal(consumed.proteina, 120);
});

test("distingue objetivo alcanzado y excedente sin truncar negativos", () => {
  const reached = calculateManualDayProgress({
    target,
    menuConsumed: { kcal: 1500 },
    trackedConsumed: { kcal: 500 },
  });
  const exceeded = calculateManualDayProgress({
    target,
    menuConsumed: { kcal: 1500 },
    trackedConsumed: { kcal: 580 },
  });
  assert.equal(reached.status, "reached");
  assert.equal(reached.remaining.kcal, 0);
  assert.equal(exceeded.status, "exceeded");
  assert.equal(exceeded.remaining.kcal, -80);
  assert.equal(exceeded.exceededBy, 80);
});

test("no inventa objetivos de macros inexistentes", () => {
  const result = calculateManualDayProgress({
    target: { kcal: 2000 },
    menuConsumed: { kcal: 1300 },
  });
  assert.equal(result.configured.kcal, true);
  assert.equal(result.configured.proteina, false);
  assert.equal(result.configured.carbs, false);
  assert.equal(result.configured.grasas, false);
});

test("distribuye en 1, 2, 3 y 4 momentos conservando el total exacto", () => {
  assert.deepEqual(distributeNutritionTarget({ kcal: 500 }, 1).map((row) => row.kcal), [500]);
  assert.deepEqual(distributeNutritionTarget({ kcal: 500 }, 2).map((row) => row.kcal), [250, 250]);
  assert.deepEqual(distributeNutritionTarget({ kcal: 500 }, 3).map((row) => row.kcal), [167, 167, 166]);
  assert.deepEqual(distributeNutritionTarget({ kcal: 500 }, 4).map((row) => row.kcal), [125, 125, 125, 125]);
  assert.deepEqual(distributeNutritionTarget({ kcal: 520 }, 3).map((row) => row.kcal), [174, 173, 173]);
});

test("redistribuye dinámicamente después de consumos", () => {
  const moments = [
    { id: "m1", label: "Momento 1" },
    { id: "m2", label: "Momento 2" },
    { id: "m3", label: "Momento 3" },
  ];
  const afterFirst = buildRemainingMomentTargets({
    remaining: { kcal: 280 },
    moments,
    consumedByMoment: { m1: { kcal: 220 } },
  });
  assert.equal(afterFirst[0].state, "consumed");
  assert.deepEqual(afterFirst.map((row) => row.target.kcal), [0, 140, 140]);

  const afterSecond = buildRemainingMomentTargets({
    remaining: { kcal: 180 },
    moments,
    consumedByMoment: { m1: { kcal: 220 }, m2: { kcal: 100 } },
  });
  assert.deepEqual(afterSecond.map((row) => row.target.kcal), [0, 0, 180]);
});

test("completar todo en el primer momento deja los demás opcionales", () => {
  const rows = buildRemainingMomentTargets({
    remaining: { kcal: 0 },
    moments: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
    consumedByMoment: { m1: { kcal: 500 } },
  });
  assert.equal(rows[0].state, "consumed");
  assert.equal(rows[1].state, "planned");
  assert.equal(rows[2].state, "planned");
  assert.deepEqual(rows.map((row) => row.target.kcal), [0, 0, 0]);
});

test("mantiene adherencia de menu y nutricional como métricas separadas", () => {
  const menu = calculateMenuAdherence(3, 5);
  const nutrition = calculateNutritionAdherence({ kcal: 1980 }, { kcal: 2000 });
  assert.equal(menu.percent, 60);
  assert.equal(nutrition.percent, 99);
});

test("calcula contra la meta restante de la comida", () => {
  const result = resolveTrackingMealCalculationTarget({
    meal: { id: "comida_2", target: { kcal: 400, proteina: 30 } },
    meals: [{ id: "comida_2", target: { kcal: 400, proteina: 30 } }],
    consumedByMeal: { comida_2: { kcal: 110, proteina: 8 } },
    dayRemaining: { kcal: 792 },
    dayConfigured: { kcal: true },
  });
  assert.equal(result.status, "ready");
  assert.equal(result.source, "meal");
  assert.deepEqual(result.target, { kcal: 290, proteina: 22, carbs: 0, grasas: 0 });
  assert.equal(result.configured.kcal, true);
  assert.equal(result.configured.proteina, true);
});

test("usa el restante diario para la unica comida libre", () => {
  const result = resolveTrackingMealCalculationTarget({
    meal: { id: "registro_manual", target: {} },
    meals: [{ id: "registro_manual", target: {} }],
    consumedByMeal: {},
    dayRemaining: { kcal: 792, proteina: 66.5, carbs: 113.9, grasas: 56.6 },
    dayConfigured: { kcal: true, proteina: true, carbs: true, grasas: true },
  });
  assert.equal(result.status, "ready");
  assert.equal(result.source, "day");
  assert.equal(result.target.kcal, 792);
  assert.equal(result.configured.proteina, true);
});

test("usa el restante diario solo para la ultima comida libre pendiente", () => {
  const meals = [
    { id: "comida_1", target: {} },
    { id: "comida_2", target: {} },
  ];
  const result = resolveTrackingMealCalculationTarget({
    meal: meals[1],
    meals,
    consumedByMeal: { comida_1: { kcal: 250 }, comida_2: {} },
    dayRemaining: { kcal: 500 },
    dayConfigured: { kcal: true },
  });
  assert.equal(result.status, "ready");
  assert.equal(result.target.kcal, 500);
});

test("no adivina una meta entre varias comidas libres", () => {
  const meals = [
    { id: "comida_1", target: {} },
    { id: "comida_2", target: {} },
  ];
  const result = resolveTrackingMealCalculationTarget({
    meal: meals[0],
    meals,
    consumedByMeal: {},
    dayRemaining: { kcal: 792 },
    dayConfigured: { kcal: true },
  });
  assert.equal(result.status, "ambiguous");
});

test("informa objetivo alcanzado sin impedir el registro manual", () => {
  const mealTargetReached = resolveTrackingMealCalculationTarget({
    meal: { id: "comida_1", target: { kcal: 400 } },
    meals: [{ id: "comida_1", target: { kcal: 400 } }],
    consumedByMeal: { comida_1: { kcal: 410 } },
    dayRemaining: { kcal: 300 },
    dayConfigured: { kcal: true },
  });
  const dayTargetReached = resolveTrackingMealCalculationTarget({
    meal: { id: "registro_manual", target: {} },
    meals: [{ id: "registro_manual", target: {} }],
    consumedByMeal: {},
    dayRemaining: { kcal: -20 },
    dayConfigured: { kcal: true },
  });
  assert.equal(mealTargetReached.status, "reached");
  assert.equal(dayTargetReached.status, "reached");
});

test("elimina un momento vacío y no duplica ids al volver a organizar", () => {
  const initial = createManualCompletionPlan(3);
  const reduced = removeManualCompletionMoment(initial, "manual_completion_moment_2");

  assert.equal(reduced.count, 2);
  assert.deepEqual(
    reduced.moments.map((moment) => moment.id),
    ["manual_completion_moment_1", "manual_completion_moment_3"]
  );
  assert.deepEqual(reduced.moments.map((moment) => moment.order), [0, 1]);

  const expanded = createManualCompletionPlan(3, reduced);
  assert.deepEqual(
    expanded.moments.map((moment) => moment.id),
    ["manual_completion_moment_1", "manual_completion_moment_3", "manual_completion_moment_2"]
  );
  assert.equal(new Set(expanded.moments.map((moment) => moment.id)).size, 3);
});

test("eliminar el último momento quita la organización temporal", () => {
  const initial = createManualCompletionPlan(1);
  assert.equal(removeManualCompletionMoment(initial, initial.moments[0].id), null);
});
