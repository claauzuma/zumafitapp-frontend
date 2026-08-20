import test from "node:test";
import assert from "node:assert/strict";

import { buildTrackingMenuDestinations } from "./trackingMenuDestinations.js";

test("una meta nativa del coach conserva identidad técnica sin usar targetMealIds", () => {
  const result = buildTrackingMenuDestinations({
    date: "2026-08-20",
    target: { kcal: 2132, p: 170, c: 206, g: 70 },
    mealTargetPlan: {
      mode: "per_meal",
      meals: [
        {
          id: "coach-lunch",
          label: "Almuerzo",
          type: "almuerzo",
          target: { kcal: 894, p: 56, c: 116, g: 23 },
        },
      ],
    },
    assignment: { primaryMenu: null, alternatives: [] },
    tracking: { targetMealIds: [] },
  });

  assert.equal(result.hasMenu, false);
  assert.equal(result.hasMealTargets, true);
  assert.equal(result.meals.length, 1);
  assert.equal(result.meals[0].kind, "meal_target");
  assert.equal(result.meals[0].nativeTarget, true);
  assert.equal(result.meals[0].activatesTargetMode, false);
  assert.equal(result.meals[0].executionId, "menu_target_coach-lunch");
});

test("una propuesta concreta en Por meta usa menu_target y deja de ofrecerse como Hecha", () => {
  const result = buildTrackingMenuDestinations({
    date: "2026-08-20",
    target: { kcal: 2132, p: 170, c: 206, g: 70 },
    assignment: {
      primaryMenu: {
        menuId: "menu-1",
        menuSnapshot: {
          id: "menu-1",
          name: "Menú",
          totals: { kcal: 894, proteina: 56, carbs: 116, grasas: 23 },
          meals: [
            {
              id: "proposal-lunch",
              name: "Almuerzo",
              type: "almuerzo",
              totals: { kcal: 894, proteina: 56, carbs: 116, grasas: 23 },
            },
          ],
        },
      },
      alternatives: [],
    },
    tracking: {
      targetMealIds: ["proposal-lunch"],
      completedMenuMealIds: [],
    },
  });

  assert.equal(result.hasMenu, true);
  assert.equal(result.meals.length, 1);
  assert.equal(result.meals[0].kind, "menu_meal");
  assert.equal(result.meals[0].targetMode, true);
  assert.equal(result.meals[0].completed, false);
  assert.equal(result.meals[0].executionId, "menu_target_proposal-lunch");
});

test("daily_target aparece solo sin estructura y usa la fecha", () => {
  const result = buildTrackingMenuDestinations({
    date: "2026-08-20",
    target: { kcal: 2132, p: 170, c: 206, g: 70 },
    assignment: { primaryMenu: null, alternatives: [] },
    tracking: { targetMealIds: [], completedMenuMealIds: [] },
  });

  assert.equal(result.meals.length, 0);
  assert.equal(result.dailyTarget?.executionId, "daily_target_2026-08-20");
  assert.deepEqual(result.destinations.map((entry) => entry.kind), ["daily_target"]);
});

test("una identidad larga de comida queda limitada al contrato backend de 80 caracteres", () => {
  const result = buildTrackingMenuDestinations({
    date: "2026-08-20",
    target: { kcal: 2100 },
    mealTargetPlan: {
      mode: "per_meal",
      meals: [{ id: `meal-${"x".repeat(120)}`, label: "Almuerzo", target: { kcal: 700 } }],
    },
    assignment: { primaryMenu: null, alternatives: [] },
    tracking: {},
  });
  assert.equal(result.meals[0].executionId.length, 80);
});

test("día mixto no duplica destinos, conserva Pendiente/Por meta/nativa y excluye Hecha", () => {
  const result = buildTrackingMenuDestinations({
    date: "2026-08-20",
    target: { kcal: 2200, p: 160, c: 250, g: 70 },
    mealTargetPlan: {
      mode: "per_meal",
      meals: [
        { id: "proposal-lunch", label: "Almuerzo", type: "almuerzo", target: { kcal: 700, p: 50 } },
        { id: "coach-snack", label: "Merienda", type: "merienda", target: { kcal: 350, p: 20 } },
      ],
    },
    assignment: {
      primaryMenu: {
        menuId: "menu-mixed",
        menuSnapshot: {
          id: "menu-mixed",
          totals: { kcal: 2000, proteina: 150, carbs: 220, grasas: 65 },
          meals: [
            { id: "proposal-breakfast", name: "Desayuno", type: "desayuno", totals: { kcal: 450 } },
            { id: "proposal-lunch", name: "Almuerzo", type: "almuerzo", totals: { kcal: 700 } },
            { id: "proposal-dinner", name: "Cena", type: "cena", totals: { kcal: 650 } },
          ],
        },
      },
      alternatives: [],
    },
    tracking: {
      targetMealIds: ["proposal-lunch"],
      completedMenuMealIds: ["proposal-dinner"],
    },
  });

  assert.deepEqual(result.meals.map((entry) => entry.menuMealId), [
    "proposal-breakfast",
    "proposal-lunch",
    "coach-snack",
  ]);
  assert.deepEqual(result.meals.map((entry) => entry.status), ["pending", "target", "target"]);
  assert.equal(new Set(result.destinations.map((entry) => entry.executionId || entry.id)).size, result.destinations.length);
  assert.equal(result.dailyTarget, null);
});
