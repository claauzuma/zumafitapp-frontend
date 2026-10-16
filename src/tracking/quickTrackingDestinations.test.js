import assert from "node:assert/strict";
import test from "node:test";

import { buildQuickTrackingDestinations } from "./quickTrackingDestinations.js";

test("una meta personal reemplaza el destino genérico y conserva su mealId estable", () => {
  const destinations = buildQuickTrackingDestinations([{
    mealId: "menu_target_desayuno_20261013_1",
    tipo: "desayuno",
    nombre: "Desayuno",
  }]);
  const breakfast = destinations.filter((destination) => destination.mealType === "desayuno");

  assert.equal(breakfast.length, 1);
  assert.equal(breakfast[0].mealId, "menu_target_desayuno_20261013_1");
  assert.equal(destinations[0].mealId, "picoteo");
});

test("destinos físicos y metas se deduplican por identidad", () => {
  const destinations = buildQuickTrackingDestinations([
    { mealId: "meal-lunch", mealType: "almuerzo", mealName: "Almuerzo" },
    { mealId: "meal-lunch", mealType: "almuerzo", mealName: "Almuerzo" },
  ]);

  assert.equal(destinations.filter((destination) => destination.mealId === "meal-lunch").length, 1);
  assert.equal(destinations.some((destination) => destination.mealId === "almuerzo"), false);
});
