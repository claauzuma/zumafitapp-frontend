import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_FLEXIBLE_CALORIES,
  assignmentFlexibleCalories,
  buildFlexibleAssignmentMetadata,
  getMenuDayCompatibility,
} from "./menuAssignmentCompatibility.js";

const target = { kcal: 2930, p: 180, c: 350, g: 90 };

test("permite deficit dentro del margen flexible", () => {
  const compatibility = getMenuDayCompatibility({ kcal: 2523, protein: 180, carbs: 306, fat: 49 }, target);

  assert.equal(compatibility.key, "flexible");
  assert.equal(compatibility.canAssign, true);
  assert.equal(compatibility.flexibleCalories, 407);
  assert.equal(compatibility.requiresFlexibleConfirmation, true);
  assert.deepEqual(compatibility.macroPending, { protein: 0, carbs: 44, fat: 41 });
});

test("permite deficit exacto al limite flexible", () => {
  const compatibility = getMenuDayCompatibility({ kcal: 1900, protein: 130, carbs: 220, fat: 60 }, { kcal: 2500, p: 150, c: 300, g: 80 });

  assert.equal(compatibility.canAssign, true);
  assert.equal(compatibility.flexibleCalories, MAX_FLEXIBLE_CALORIES);
});

test("bloquea deficit excesivo", () => {
  const compatibility = getMenuDayCompatibility({ kcal: 1800, protein: 160, carbs: 180, fat: 50 }, { kcal: 2500, p: 180, c: 300, g: 80 });

  assert.equal(compatibility.key, "deficit_excessive");
  assert.equal(compatibility.canAssign, false);
  assert.equal(compatibility.flexibleCalories, 700);
});

test("permite menu exacto sin margen flexible", () => {
  const compatibility = getMenuDayCompatibility({ kcal: 2500, protein: 150, carbs: 300, fat: 80 }, { kcal: 2500, p: 150, c: 300, g: 80 });

  assert.equal(compatibility.key, "compatible");
  assert.equal(compatibility.canAssign, true);
  assert.equal(compatibility.flexibleCalories, 0);
});

test("mantiene bloqueo por exceso calorico grande", () => {
  const compatibility = getMenuDayCompatibility({ kcal: 2523, protein: 180, carbs: 306, fat: 49 }, { kcal: 1900, p: 160, c: 220, g: 60 });

  assert.equal(compatibility.key, "surplus_blocked");
  assert.equal(compatibility.canAssign, false);
});

test("proteina baja advierte pero no bloquea si calorias son asignables", () => {
  const compatibility = getMenuDayCompatibility({ kcal: 2523, protein: 90, carbs: 420, fat: 43 }, target);

  assert.equal(compatibility.key, "flexible_protein_warning");
  assert.equal(compatibility.canAssign, true);
  assert.equal(compatibility.proteinLow, true);
});

test("metadata guarda margen flexible y pendientes por dia", () => {
  const metadata = buildFlexibleAssignmentMetadata(
    { kcal: 2523, protein: 180, carbs: 306, fat: 49 },
    target,
    { dayKey: "monday" }
  );

  assert.equal(metadata.assignmentType, "coach_menu");
  assert.equal(metadata.source, "coach");
  assert.equal(metadata.dayKey, "monday");
  assert.equal(metadata.targetCalories, 2930);
  assert.equal(metadata.plannedCalories, 2523);
  assert.equal(metadata.flexibleCalories, 407);
  assert.equal(metadata.flexibleMode, "free_margin");
  assert.deepEqual(metadata.macroPending, { protein: 0, carbs: 44, fat: 41 });
});

test("calcula flexibleCalories visual para asignaciones viejas sin metadata", () => {
  const flexibleCalories = assignmentFlexibleCalories(
    { plannedCalories: 2523 },
    { kcal: 2930 },
    { kcal: 2523 }
  );

  assert.equal(flexibleCalories, 407);
});
