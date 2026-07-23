import assert from "node:assert/strict";
import test from "node:test";

import { buildNutritionAssignmentImpact } from "./nutritionAssignmentImpact.js";

function assignment(name, alternatives = []) {
  return {
    menuId: `menu-${name}`,
    menuSnapshot: { id: `menu-${name}`, name },
    alternatives,
  };
}

function clientFixture() {
  return {
    metasActuales: {
      kcal: 1940,
      macros: { p: 150, c: 200, g: 60 },
    },
    menu: {
      weeklyPlan: {
        caloriesByDay: {},
        macrosByDay: {},
        assignedMenusByDay: {
          monday: assignment("lunes", [assignment("alternativa")]),
          tuesday: assignment("martes"),
        },
      },
    },
  };
}

test("detecta cambio de macros en todos los días que tienen asignación", () => {
  const client = clientFixture();
  const impact = buildNutritionAssignmentImpact(client, {
    kcal: 1980,
    p: 160,
    c: 200,
    g: 60,
    dailyTargets: {},
  });

  assert.deepEqual(impact.affectedDayKeys, ["monday", "tuesday"]);
  assert.equal(impact.assignedMenus, 3);
});

test("un cambio diario iso-calórico conserva las asignaciones de los demás días", () => {
  const client = clientFixture();
  const impact = buildNutritionAssignmentImpact(client, {
    kcal: 1940,
    p: 150,
    c: 200,
    g: 60,
    dailyTargets: {
      monday: { kcal: 1940, p: 170, c: 180, g: 60 },
    },
  });

  assert.deepEqual(impact.affectedDayKeys, ["monday"]);
  assert.equal(impact.affectedDays[0].previousTarget.p, 150);
  assert.equal(impact.affectedDays[0].nextTarget.p, 170);
});

test("detecta asignaciones anteriores cuando la meta ya había cambiado antes de abrir la pantalla", () => {
  const client = clientFixture();
  client.metasActuales.updatedAt = "2026-07-23T20:59:46.389Z";
  Object.values(client.menu.weeklyPlan.assignedMenusByDay).forEach((entry) => {
    entry.assignedAt = "2026-07-09T04:19:25.571Z";
  });

  const impact = buildNutritionAssignmentImpact(client, {
    kcal: 1940,
    p: 150,
    c: 200,
    g: 60,
    dailyTargets: {},
  });

  assert.deepEqual(impact.affectedDayKeys, ["monday", "tuesday"]);
  assert.equal(impact.changedDays, 0);
  assert.equal(impact.staleDays, 2);
});

test("una asignación creada para la meta actual no queda obsoleta por una edición no nutricional posterior", () => {
  const client = clientFixture();
  client.metasActuales.updatedAt = "2026-07-23T20:59:46.389Z";
  Object.values(client.menu.weeklyPlan.assignedMenusByDay).forEach((entry) => {
    entry.assignedAt = "2026-07-09T04:19:25.571Z";
    entry.targetCalories = 1940;
    entry.targetMacros = { p: 150, c: 200, g: 60 };
  });

  const impact = buildNutritionAssignmentImpact(client, {
    kcal: 1940,
    p: 150,
    c: 200,
    g: 60,
    dailyTargets: {},
  });

  assert.deepEqual(impact.affectedDayKeys, []);
});
