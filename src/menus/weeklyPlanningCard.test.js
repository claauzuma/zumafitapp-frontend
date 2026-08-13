import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSIGNED_DAY_PLANNING_ACTIONS,
  EMPTY_DAY_ACTIONS,
  TARGET_DEFINITION_MODES,
  defaultTargetDefinitionMode,
  emptyDayPlanningCopy,
} from "./weeklyPlanningCard.js";

test("la card vacía ofrece exactamente las tres entradas de producto", () => {
  assert.deepEqual(EMPTY_DAY_ACTIONS.map((action) => action.label), [
    "Elegir menú",
    "Definir meta",
    "Crear menú",
  ]);
});

test("la card vacía concentra estado y meta sin duplicar mensajes de error", () => {
  const copy = emptyDayPlanningCopy({ kcal: 1906, protein: 166 });
  assert.deepEqual(copy, {
    status: "Sin planificación",
    targetLabel: "Meta actual",
    kcal: 1906,
    protein: 166,
    explanation: "Todavía no definiste cómo manejar este día.",
  });
});

test("el lápiz de un día asignado permite editar, cambiar menú o definir meta", () => {
  assert.deepEqual(ASSIGNED_DAY_PLANNING_ACTIONS.map((action) => action.label), [
    "Editar menú",
    "Cambiar menú",
    "Definir meta",
  ]);
});

test("definir meta ofrece los tres modos acordados y recomienda personalizar por comida", () => {
  assert.deepEqual(TARGET_DEFINITION_MODES.map((mode) => mode.label), [
    "Personalizar por comida",
    "Plan mixto",
    "Solo meta diaria",
  ]);
  assert.equal(defaultTargetDefinitionMode(), "per_meal");
  assert.equal(TARGET_DEFINITION_MODES.filter((mode) => mode.recommended).length, 1);
});
