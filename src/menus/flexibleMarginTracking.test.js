import test from "node:test";
import assert from "node:assert/strict";

import {
  FLEXIBLE_MARGIN_SOURCE,
  FLEXIBLE_MARGIN_STATUS_SOURCE,
  canUseFlexibleMarginRecommendations,
  flexibleMarginEntries,
  flexibleMarginMacroRemaining,
  flexibleMarginRemaining,
  flexibleMarginStatusEntry,
  flexibleMarginTotals,
  isFlexibleMarginCompleted,
  replaceFlexibleMarginEntries,
} from "./flexibleMarginTracking.js";

const row = {
  date: "2026-07-05",
  dayKey: "monday",
  tracking: {
    manualEntries: [
      {
        id: "manual-1",
        source: "manual_food",
        totals: { kcal: 200, proteina: 10, carbs: 20, grasas: 5 },
      },
      {
        id: "flex-1",
        source: FLEXIBLE_MARGIN_SOURCE,
        mealSlotType: "flexible_margin",
        totals: { kcal: 134, proteina: 1.5, carbs: 31, grasas: 0.4 },
      },
      {
        id: "status",
        source: FLEXIBLE_MARGIN_STATUS_SOURCE,
        mealSlotType: "flexible_margin",
        flexibleMarginCompleted: true,
        totals: { kcal: 0, proteina: 0, carbs: 0, grasas: 0 },
      },
    ],
  },
};

test("lee solo alimentos del margen flexible y excluye el marcador de estado", () => {
  const entries = flexibleMarginEntries(row);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "flex-1");
  assert.deepEqual(flexibleMarginTotals(row), { kcal: 134, proteina: 1.5, carbs: 31, grasas: 0.4 });
});

test("calcula restante y macros pendientes del margen, no del dia completo", () => {
  const plan = { flexibleCalories: 407, macroPending: { protein: 0, carbs: 44, fat: 41 } };

  assert.equal(flexibleMarginRemaining(plan, row), 273);
  assert.deepEqual(flexibleMarginMacroRemaining(plan, row), {
    kcal: 273,
    proteina: 0,
    carbs: 13,
    grasas: 40.6,
  });
});

test("reemplaza solo entries del margen y conserva tracking manual externo", () => {
  const next = replaceFlexibleMarginEntries(row, [
    {
      id: "flex-2",
      source: FLEXIBLE_MARGIN_SOURCE,
      mealSlotType: "flexible_margin",
      totals: { kcal: 250, proteina: 8, carbs: 35, grasas: 6 },
    },
  ], false);

  assert.equal(next.length, 2);
  assert.equal(next[0].id, "manual-1");
  assert.equal(next[1].id, "flex-2");
  assert.equal(next.some((entry) => entry.source === FLEXIBLE_MARGIN_STATUS_SOURCE), false);
});

test("persiste completado con marcador asociado a la fecha visible", () => {
  const next = replaceFlexibleMarginEntries(row, [], true);
  const status = next.find((entry) => entry.source === FLEXIBLE_MARGIN_STATUS_SOURCE);

  assert.equal(status.date, "2026-07-05");
  assert.equal(status.dayKey, "monday");
  assert.equal(isFlexibleMarginCompleted(next), true);
  assert.deepEqual(flexibleMarginStatusEntry(row, true).totals, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
});

test("recomendacion automatica requiere capability especifica y falla cerrada", () => {
  assert.equal(canUseFlexibleMarginRecommendations({ canUseFlexibleMarginRecommendations: false, canAutoCompleteRemainingMeals: true }), false);
  assert.equal(canUseFlexibleMarginRecommendations({ canUseFlexibleMarginRecommendations: true, canAutoCompleteRemainingMeals: false }), true);
  assert.equal(canUseFlexibleMarginRecommendations({ canAutoCompleteRemainingMeals: false }), false);
  assert.equal(canUseFlexibleMarginRecommendations({ canAutoCompleteRemainingMeals: true }), false);
  assert.equal(canUseFlexibleMarginRecommendations({}), false);
});
