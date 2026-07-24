import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRemainingMomentTargets,
  calculateManualDayProgress,
  calculateMenuAdherence,
  calculateNutritionAdherence,
  distributeNutritionTarget,
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
