import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERATION_MEAL_TYPES,
  GENERATION_MODES,
  GENERATION_ROLES,
  createFoodDraft,
  editFoodDraft,
  foodCreationPayloadFromDraft,
  generationPayloadFromDraft,
  replaceFoodInAdminPage,
  toggleGenerationFlag,
} from "./adminFoodGeneration.js";

test("Editar abre un draft con la metadata efectiva del alimento", () => {
  const draft = editFoodDraft({ generation: { mode: "DISABLED", roles: { P1: true } } });
  assert.equal(draft.generation.mode, "DISABLED");
  assert.equal(draft.generation.roles.P1, true);
});

test("el dropdown ofrece exactamente los tres modos permitidos", () => {
  assert.deepEqual(GENERATION_MODES, ["EXPLICIT_ONLY", "GENERIC", "DISABLED"]);
});

test("los meal types de UI coinciden exactamente con el contrato del generador", () => {
  assert.deepEqual(GENERATION_MEAL_TYPES.map(([key]) => key), [
    "breakfast", "lunch", "snack", "dinner", "extraSnack",
  ]);
});

test("roles y momentos se pueden alternar sin modificar otros flags", () => {
  let draft = createFoodDraft();
  draft = toggleGenerationFlag(draft, "roles", "C1");
  draft = toggleGenerationFlag(draft, "mealTypes", "dinner");
  assert.equal(draft.generation.roles.C1, true);
  assert.equal(draft.generation.roles.P1, false);
  assert.equal(draft.generation.mealTypes.dinner, true);
  assert.equal(draft.generation.mealTypes.breakfast, false);
  assert.equal(GENERATION_ROLES.length, 7);
  assert.equal(GENERATION_MEAL_TYPES.length, 5);
});

test("portionRule editable serializa números, nulls y allowedValues únicos", () => {
  const draft = createFoodDraft();
  draft.generation.portionRule = { unit: "unidad", min: "1", max: "6", step: "1", allowedValues: [] };
  draft.allowedValuesText = "1, 2, 2, 3";
  const result = generationPayloadFromDraft(draft);
  assert.deepEqual(result.generation.portionRule, { unit: "unidad", min: 1, max: 6, step: 1, allowedValues: [1, 2, 3] });
});

test("guardar actualiza la fila local sin recargar toda la pagina", () => {
  const page = { total: 2, documents: [{ _id: "a", name: "Antes" }, { _id: "b", name: "Otro" }] };
  const updated = replaceFoodInAdminPage(page, { _id: "a", name: "Después", generation: { mode: "GENERIC" } });
  assert.equal(updated.documents[0].name, "Después");
  assert.equal(updated.documents[1], page.documents[1]);
  assert.equal(updated.total, 2);
});

test("los errores de GENERIC y portionRule quedan disponibles para mostrarse", () => {
  const incomplete = createFoodDraft();
  incomplete.generation.mode = "GENERIC";
  assert.match(generationPayloadFromDraft(incomplete).error, /al menos un rol/i);
  incomplete.generation.roles.P1 = true;
  assert.match(generationPayloadFromDraft(incomplete).error, /al menos un momento/i);
  incomplete.generation.mealTypes.breakfast = true;
  incomplete.generation.portionRule.min = "10";
  incomplete.generation.portionRule.max = "5";
  assert.match(generationPayloadFromDraft(incomplete).error, /mínimo no puede superar/i);
});

test("crear alimento parte de EXPLICIT_ONLY y conserva flags apagados", () => {
  const draft = createFoodDraft();
  assert.equal(draft.generation.mode, "EXPLICIT_ONLY");
  assert.equal(Object.values(draft.generation.roles).some(Boolean), false);
  assert.equal(Object.values(draft.generation.mealTypes).some(Boolean), false);
});

test("editar un alimento sin mealTypes aplica el default de lectura sin mutar el documento", () => {
  const food = {
    generation: {
      mode: "EXPLICIT_ONLY",
      roles: { C1: true },
      portionRule: { unit: "g", min: 10, max: 300, step: 5, allowedValues: [] },
    },
  };
  const before = structuredClone(food);
  const draft = editFoodDraft(food);

  assert.equal(Object.values(draft.generation.mealTypes).some(Boolean), false);
  assert.deepEqual(draft.generation.portionRule, before.generation.portionRule);
  assert.deepEqual(food, before);
});

test("crear alimento valida datos nutricionales antes de llamar al backend", () => {
  const draft = { ...createFoodDraft(), name: "Prueba", kcal: "100", protein: "10", carbs: "12", fat: "2" };
  const result = foodCreationPayloadFromDraft(draft);
  assert.equal(result.food.name, "Prueba");
  assert.equal(result.food.generation.mode, "EXPLICIT_ONLY");
  assert.equal(result.food.kcal, 100);
});
