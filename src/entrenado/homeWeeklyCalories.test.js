import test from "node:test";
import assert from "node:assert/strict";

import { buildWeeklyCalorieSummary } from "./homeWeeklyCalories.js";

test("clasifica cumplidos, pasados incumplidos y pendientes sin inventar consumo", () => {
  const summary = buildWeeklyCalorieSummary({
    weekStart: "2026-07-27",
    todayDateKey: "2026-07-29",
    fallbackTargetKcal: 2000,
    rows: [
      { date: "2026-07-27", tracking: { status: "completed", consumedTotals: { kcal: 1980 } } },
      { date: "2026-07-28", tracking: { status: "in_progress", consumedTotals: { kcal: 1100 } } },
      { date: "2026-07-29", tracking: { status: "pending", consumedTotals: { kcal: 0 } } },
    ],
  });

  assert.equal(summary.days[0].tone, "complete");
  assert.equal(summary.days[1].tone, "missed");
  assert.equal(summary.days[1].consumedKcal, 1100);
  assert.equal(summary.days[1].chartKcal, 2000);
  assert.equal(summary.days[2].tone, "pending");
  assert.equal(summary.days[2].isProjected, true);
  assert.equal(summary.days[2].consumedKcal, 0);
  assert.equal(summary.days[2].chartKcal, 2000);
});

test("un dia excedido pasado se muestra rojo pero conserva la altura de su meta", () => {
  const summary = buildWeeklyCalorieSummary({
    weekStart: "2026-07-27",
    todayDateKey: "2026-08-02",
    fallbackTargetKcal: 2000,
    rows: [{ date: "2026-07-28", tracking: { status: "exceeded", consumedTotals: { kcal: 2400 } } }],
  });

  assert.equal(summary.days[1].tone, "missed");
  assert.equal(summary.days[1].consumedKcal, 2400);
  assert.equal(summary.days[1].chartKcal, 2000);
});

test("calcula el promedio desde la distribucion objetivo y no desde el consumo", () => {
  const summary = buildWeeklyCalorieSummary({
    weekStart: "2026-07-27",
    todayDateKey: "2026-07-29",
    fallbackTargetKcal: 2000,
    rows: [
      { date: "2026-07-27", tracking: { status: "completed", consumedTotals: { kcal: 1800 } } },
      { date: "2026-07-28", tracking: { status: "completed", consumedTotals: { kcal: 2200 } } },
      { date: "2026-07-30", tracking: { status: "pending", consumedTotals: { kcal: 2500 } } },
    ],
  });

  assert.equal(summary.averageTargetKcal, 2000);
  assert.equal(summary.targetDays, 7);
  assert.equal(summary.recordedDays, 2);
});

test("respeta la meta especifica de cada dia para las barras pendientes", () => {
  const summary = buildWeeklyCalorieSummary({
    weekStart: "2026-07-27",
    todayDateKey: "2026-07-27",
    fallbackTargetKcal: 2000,
    rows: [{ date: "2026-07-28", target: { kcal: 2500 }, tracking: { status: "pending" } }],
  });

  assert.equal(summary.days[1].targetKcal, 2500);
  assert.equal(summary.days[1].chartKcal, 2500);
  assert.equal(summary.scaleMax, 2500);
});

test("una distribucion personalizada produce alturas y promedio segun la meta de cada dia", () => {
  const targets = [2200, 1800, 2400, 1800, 2400, 2000, 2000];
  const summary = buildWeeklyCalorieSummary({
    weekStart: "2026-07-27",
    todayDateKey: "2026-07-29",
    fallbackTargetKcal: 2100,
    rows: targets.map((kcal, index) => ({
      date: `2026-${index < 5 ? "07" : "08"}-${String(index < 5 ? 27 + index : index - 4).padStart(2, "0")}`,
      target: { kcal },
      tracking: { status: "pending" },
    })),
  });

  assert.deepEqual(summary.days.map((day) => day.chartKcal), targets);
  assert.equal(summary.averageTargetKcal, 2086);
});
