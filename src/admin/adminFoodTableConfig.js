import { editFoodDraft, generationPayloadFromDraft } from "./adminFoodGeneration.js";

export const ADMIN_FOOD_COLUMNS_STORAGE_KEY = "zumafit.admin.foods.columns.v1";

export const ADMIN_FOOD_COLUMN_GROUPS = Object.freeze([
  {
    id: "information",
    label: "Información",
    columns: [
      ["food", "Alimento"], ["status", "Estado"], ["kcal", "Kcal"],
      ["protein", "Proteína"], ["carbs", "Carbohidratos"], ["fat", "Grasas"], ["unit", "Unidad actual"],
    ],
  },
  {
    id: "generator",
    label: "Generador",
    columns: [
      ["mode", "Modo"], ["rolesSummary", "Roles (resumen)"], ["momentsSummary", "Momentos (resumen)"],
      ["mealTypesEditor", "Momentos permitidos"],
      ["P1", "P1"], ["P2", "P2"], ["C1", "C1"], ["C2", "C2"], ["V", "V"], ["F", "F"], ["G", "G"],
      ["breakfast", "Desayuno"], ["lunch", "Almuerzo"], ["snack", "Merienda"],
      ["dinner", "Cena"], ["extraSnack", "Snack extra"],
    ],
  },
  {
    id: "portions",
    label: "Porciones",
    columns: [
      ["portionUnit", "Unidad técnica"], ["min", "Mínimo"], ["max", "Máximo"],
      ["step", "Paso"], ["allowedValues", "Valores permitidos"],
    ],
  },
  { id: "actions", label: "Acciones", columns: [["edit", "Editar"], ["save", "Guardar"]] },
]);

export const ADMIN_FOOD_COLUMN_LABELS = Object.freeze(Object.fromEntries(
  ADMIN_FOOD_COLUMN_GROUPS.flatMap((group) => group.columns)
));

export const DEFAULT_ADMIN_FOOD_COLUMNS = Object.freeze([
  "food", "kcal", "protein", "carbs", "fat", "unit", "mode", "rolesSummary", "momentsSummary", "edit", "save",
]);

export const ADMIN_FOOD_COLUMN_PRESETS = Object.freeze({
  nutrition: ["food", "kcal", "protein", "carbs", "fat", "unit"],
  generator: ["food", "mode", "mealTypesEditor", "P1", "P2", "C1", "C2", "V", "F", "G", "save"],
  portions: ["food", "mode", "portionUnit", "min", "max", "step", "allowedValues", "save"],
});

const LEGACY_GENERATOR_PRESET = Object.freeze([
  "food", "mode", "P1", "P2", "C1", "C2", "V", "F", "G",
  "breakfast", "lunch", "snack", "dinner", "extraSnack", "save",
]);

const ALL_COLUMN_IDS = new Set(Object.keys(ADMIN_FOOD_COLUMN_LABELS));

export function sanitizeAdminFoodColumns(value) {
  const input = Array.isArray(value) ? value : DEFAULT_ADMIN_FOOD_COLUMNS;
  const unique = [...new Set(input.filter((column) => ALL_COLUMN_IDS.has(column)))];
  const middle = unique.filter((column) => column !== "food" && column !== "save");
  const sanitized = ["food", ...middle];
  if (unique.includes("save")) sanitized.push("save");
  return sanitized.length ? sanitized : [...DEFAULT_ADMIN_FOOD_COLUMNS];
}

export function loadAdminFoodColumns(storage = globalThis?.localStorage) {
  try {
    const value = storage?.getItem(ADMIN_FOOD_COLUMNS_STORAGE_KEY);
    if (!value) return [...DEFAULT_ADMIN_FOOD_COLUMNS];
    const stored = sanitizeAdminFoodColumns(JSON.parse(value));
    const isLegacyGenerator = stored.length === LEGACY_GENERATOR_PRESET.length
      && stored.every((column, index) => column === LEGACY_GENERATOR_PRESET[index]);
    return isLegacyGenerator ? [...ADMIN_FOOD_COLUMN_PRESETS.generator] : stored;
  } catch {
    return [...DEFAULT_ADMIN_FOOD_COLUMNS];
  }
}

export function persistAdminFoodColumns(columns, storage = globalThis?.localStorage) {
  const sanitized = sanitizeAdminFoodColumns(columns);
  try { storage?.setItem(ADMIN_FOOD_COLUMNS_STORAGE_KEY, JSON.stringify(sanitized)); } catch { /* storage unavailable */ }
  return sanitized;
}

export function toggleAdminFoodColumn(columns, column) {
  const current = sanitizeAdminFoodColumns(columns);
  if (column === "food") return current;
  return current.includes(column)
    ? sanitizeAdminFoodColumns(current.filter((item) => item !== column))
    : sanitizeAdminFoodColumns([...current, column]);
}

export function applyAdminFoodColumnPreset(preset) {
  return sanitizeAdminFoodColumns(ADMIN_FOOD_COLUMN_PRESETS[preset] || DEFAULT_ADMIN_FOOD_COLUMNS);
}

export function detectAdminFoodColumnPreset(columns) {
  const current = sanitizeAdminFoodColumns(columns);
  const same = (candidate) => candidate.length === current.length && candidate.every((item, index) => item === current[index]);
  if (same(DEFAULT_ADMIN_FOOD_COLUMNS)) return "default";
  return Object.entries(ADMIN_FOOD_COLUMN_PRESETS).find(([, value]) => same(value))?.[0] || "custom";
}

export function adminFoodColumnWidth(column) {
  if (column === "food") return "280px";
  if (column === "save") return "132px";
  if (column === "edit") return "68px";
  if (["rolesSummary", "momentsSummary"].includes(column)) return "150px";
  if (column === "mealTypesEditor") return "430px";
  if (column === "mode") return "142px";
  if (column === "allowedValues") return "170px";
  if (["portionUnit", "status"].includes(column)) return "116px";
  if (["P1", "P2", "C1", "C2", "V", "F", "G", "breakfast", "lunch", "snack", "dinner", "extraSnack"].includes(column)) return "86px";
  return "92px";
}

export function adminFoodGridTemplate(columns) {
  return sanitizeAdminFoodColumns(columns).map(adminFoodColumnWidth).join(" ");
}

export function createInlineFoodDraft(food) {
  return editFoodDraft(food);
}

export function inlineDraftSignature(draft) {
  const source = draft || {};
  return JSON.stringify({ generation: source.generation, allowedValuesText: String(source.allowedValuesText || "").trim() });
}

export function isInlineFoodDraftDirty(draft, baseDraft) {
  return inlineDraftSignature(draft) !== inlineDraftSignature(baseDraft);
}

export function validateInlineFoodDraft(draft) {
  return generationPayloadFromDraft(draft);
}

export function setInlineGenerationValue(draft, path, value) {
  if (path.length === 1) return { ...draft, generation: { ...draft.generation, [path[0]]: value } };
  const [group, key] = path;
  return {
    ...draft,
    generation: { ...draft.generation, [group]: { ...draft.generation[group], [key]: value } },
  };
}
