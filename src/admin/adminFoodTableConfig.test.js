import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_FOOD_COLUMNS_STORAGE_KEY,
  DEFAULT_ADMIN_FOOD_COLUMNS,
  adminFoodGridTemplate,
  applyAdminFoodColumnPreset,
  createInlineFoodDraft,
  detectAdminFoodColumnPreset,
  isInlineFoodDraftDirty,
  loadAdminFoodColumns,
  persistAdminFoodColumns,
  sanitizeAdminFoodColumns,
  setInlineGenerationValue,
  toggleAdminFoodColumn,
  validateInlineFoodDraft,
} from "./adminFoodTableConfig.js";

function food(overrides = {}) {
  return {
    generation: {
      mode: "EXPLICIT_ONLY",
      roles: { P1: false, P2: false, C1: false, C2: false, V: false, F: false, G: false },
      mealTypes: { breakfast: false, lunch: false, snack: false, dinner: false, extraSnack: false },
      portionRule: { unit: null, min: null, max: null, step: null, allowedValues: [] },
    },
    ...overrides,
  };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("la vista inicial contiene las columnas de producto requeridas", () => {
  assert.deepEqual(DEFAULT_ADMIN_FOOD_COLUMNS, ["food", "kcal", "protein", "carbs", "fat", "unit", "mode", "rolesSummary", "momentsSummary", "edit", "save"]);
});

test("mostrar y ocultar una columna conserva el resto", () => {
  const hidden = toggleAdminFoodColumn(DEFAULT_ADMIN_FOOD_COLUMNS, "kcal");
  assert.equal(hidden.includes("kcal"), false);
  assert.equal(toggleAdminFoodColumn(hidden, "kcal").includes("kcal"), true);
});

test("Alimento no se puede ocultar", () => {
  assert.equal(toggleAdminFoodColumn(DEFAULT_ADMIN_FOOD_COLUMNS, "food").includes("food"), true);
  assert.equal(sanitizeAdminFoodColumns(["kcal"])[0], "food");
});

test("Guardar queda siempre al extremo derecho cuando esta visible", () => {
  assert.deepEqual(sanitizeAdminFoodColumns(["save", "P1", "food", "kcal"]), ["food", "P1", "kcal", "save"]);
  assert.deepEqual(toggleAdminFoodColumn(["food", "save"], "P1"), ["food", "P1", "save"]);
});

test("las columnas elegidas persisten y se restauran", () => {
  const storage = memoryStorage();
  persistAdminFoodColumns(["food", "mode", "save"], storage);
  assert.deepEqual(loadAdminFoodColumns(storage), ["food", "mode", "save"]);
});

test("la vista Generador anterior se compacta al cargar sin tocar configuracion de alimentos", () => {
  const previousGenerator = [
    "food", "mode", "P1", "P2", "C1", "C2", "V", "F", "G",
    "breakfast", "lunch", "snack", "dinner", "extraSnack", "save",
  ];
  const storage = memoryStorage({
    [ADMIN_FOOD_COLUMNS_STORAGE_KEY]: JSON.stringify(previousGenerator),
  });

  assert.deepEqual(loadAdminFoodColumns(storage), applyAdminFoodColumnPreset("generator"));
});

test("una preferencia corrupta vuelve a la configuracion inicial", () => {
  const storage = memoryStorage({ [ADMIN_FOOD_COLUMNS_STORAGE_KEY]: "{no-json" });
  assert.deepEqual(loadAdminFoodColumns(storage), DEFAULT_ADMIN_FOOD_COLUMNS);
});

test("restablecer usa una copia independiente del layout default", () => {
  const reset = [...DEFAULT_ADMIN_FOOD_COLUMNS];
  reset.pop();
  assert.equal(DEFAULT_ADMIN_FOOD_COLUMNS.at(-1), "save");
  assert.notDeepEqual(reset, DEFAULT_ADMIN_FOOD_COLUMNS);
});

test("los presets Nutricion, Generador y Porciones exponen su foco", () => {
  assert.equal(applyAdminFoodColumnPreset("nutrition").includes("protein"), true);
  assert.equal(applyAdminFoodColumnPreset("generator").includes("P1"), true);
  assert.equal(applyAdminFoodColumnPreset("generator")[2], "mealTypesEditor");
  assert.equal(applyAdminFoodColumnPreset("generator").includes("portionUnit"), false);
  assert.equal(applyAdminFoodColumnPreset("portions").includes("allowedValues"), true);
  assert.equal(detectAdminFoodColumnPreset(applyAdminFoodColumnPreset("generator")), "generator");
});

test("editar modo deja la fila dirty sin tocar el draft base", () => {
  const base = createInlineFoodDraft(food());
  const edited = setInlineGenerationValue(base, ["mode"], "DISABLED");
  assert.equal(base.generation.mode, "EXPLICIT_ONLY");
  assert.equal(edited.generation.mode, "DISABLED");
  assert.equal(isInlineFoodDraftDirty(edited, base), true);
});

test("editar un rol o momento solo modifica ese flag", () => {
  const base = createInlineFoodDraft(food());
  const withRole = setInlineGenerationValue(base, ["roles", "P1"], true);
  const withMeal = setInlineGenerationValue(withRole, ["mealTypes", "lunch"], true);
  assert.equal(withMeal.generation.roles.P1, true);
  assert.equal(withMeal.generation.roles.P2, false);
  assert.equal(withMeal.generation.mealTypes.lunch, true);
  assert.equal(withMeal.generation.mealTypes.dinner, false);
});

test("permite varios momentos y desactivar uno sin alterar generation restante", () => {
  const original = food({
    generation: {
      mode: "GENERIC",
      roles: { P1: true, P2: false, C1: true, C2: false, V: false, F: false, G: false },
      mealTypes: { breakfast: false, lunch: true, snack: true, dinner: true, extraSnack: false },
      portionRule: { unit: "g", min: 25, max: 200, step: 5, allowedValues: [50, 100] },
    },
    Calorias: 165,
    Proteinas: 31,
  });
  const base = createInlineFoodDraft(original);
  const withBreakfast = setInlineGenerationValue(base, ["mealTypes", "breakfast"], true);
  const withoutLunch = setInlineGenerationValue(withBreakfast, ["mealTypes", "lunch"], false);
  const result = validateInlineFoodDraft(withoutLunch);

  assert.deepEqual(result.generation.mealTypes, {
    breakfast: true,
    lunch: false,
    snack: true,
    dinner: true,
    extraSnack: false,
  });
  assert.deepEqual(result.generation.roles, original.generation.roles);
  assert.deepEqual(result.generation.portionRule, original.generation.portionRule);
  assert.deepEqual(Object.keys(result), ["generation"]);
  assert.equal(original.Calorias, 165);
  assert.equal(original.Proteinas, 31);
});

test("un alimento sin mealTypes muestra los cinco defaults apagados sin quedar dirty", () => {
  const legacy = food({ generation: {
    mode: "EXPLICIT_ONLY",
    roles: { P1: true },
    portionRule: { unit: "unidad", min: 1, max: 4, step: 1, allowedValues: [1, 2] },
  } });
  const draft = createInlineFoodDraft(legacy);

  assert.deepEqual(draft.generation.mealTypes, {
    breakfast: false,
    lunch: false,
    snack: false,
    dinner: false,
    extraSnack: false,
  });
  assert.equal(isInlineFoodDraftDirty(draft, createInlineFoodDraft(legacy)), false);
  assert.deepEqual(draft.generation.portionRule, legacy.generation.portionRule);
});

test("guardar serializa solo generation y convierte numeros", () => {
  let draft = createInlineFoodDraft(food());
  draft = setInlineGenerationValue(draft, ["portionRule", "unit"], "g");
  draft = setInlineGenerationValue(draft, ["portionRule", "min"], "10");
  draft = setInlineGenerationValue(draft, ["portionRule", "max"], "120");
  draft = setInlineGenerationValue(draft, ["portionRule", "step"], "5");
  draft.allowedValuesText = "10, 20, 20";
  const result = validateInlineFoodDraft(draft);
  assert.deepEqual(Object.keys(result), ["generation"]);
  assert.deepEqual(result.generation.portionRule, { unit: "g", min: 10, max: 120, step: 5, allowedValues: [10, 20] });
});

test("un guardado exitoso puede reemplazar la base y limpiar dirty", () => {
  const base = createInlineFoodDraft(food());
  let edited = setInlineGenerationValue(base, ["mode"], "DISABLED");
  edited = setInlineGenerationValue(edited, ["mealTypes", "breakfast"], true);
  edited = setInlineGenerationValue(edited, ["mealTypes", "extraSnack"], true);
  const savedBase = createInlineFoodDraft({ generation: validateInlineFoodDraft(edited).generation });
  assert.equal(isInlineFoodDraftDirty(edited, savedBase), false);
  assert.equal(savedBase.generation.mealTypes.breakfast, true);
  assert.equal(savedBase.generation.mealTypes.extraSnack, true);
});

test("GENERIC incompleto conserva un error visible antes del PATCH", () => {
  const draft = setInlineGenerationValue(createInlineFoodDraft(food()), ["mode"], "GENERIC");
  assert.match(validateInlineFoodDraft(draft).error, /al menos un rol/i);
  assert.equal(isInlineFoodDraftDirty(draft, createInlineFoodDraft(food())), true);
});

test("un error de validacion no modifica ni descarta el draft", () => {
  const base = createInlineFoodDraft(food());
  const draft = setInlineGenerationValue(base, ["mode"], "GENERIC");
  const signature = JSON.stringify(draft);
  validateInlineFoodDraft(draft);
  assert.equal(JSON.stringify(draft), signature);
});

test("la validacion rechaza minimo mayor que maximo", () => {
  let draft = createInlineFoodDraft(food());
  draft = setInlineGenerationValue(draft, ["portionRule", "min"], "40");
  draft = setInlineGenerationValue(draft, ["portionRule", "max"], "20");
  assert.match(validateInlineFoodDraft(draft).error, /mínimo no puede superar/i);
});

test("la grilla mantiene Alimento primero y Guardar al final", () => {
  const columns = ["food", "P1", "breakfast", "save"];
  const template = adminFoodGridTemplate(columns).split(" ");
  assert.equal(template[0], "280px");
  assert.equal(template.at(-1), "132px");
});
