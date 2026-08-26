export const GENERATION_MODES = Object.freeze(["EXPLICIT_ONLY", "GENERIC", "DISABLED"]);

export const GENERATION_ROLES = Object.freeze([
  ["P1", "Proteína principal"],
  ["P2", "Proteína secundaria"],
  ["C1", "Carbohidrato principal"],
  ["C2", "Carbohidrato secundario"],
  ["V", "Vegetal"],
  ["F", "Fruta"],
  ["G", "Grasa/complemento"],
]);

export const GENERATION_MEAL_TYPES = Object.freeze([
  ["breakfast", "Desayuno"],
  ["lunch", "Almuerzo"],
  ["snack", "Merienda"],
  ["dinner", "Cena"],
  ["extraSnack", "Snack extra"],
]);

export const PORTION_UNITS = Object.freeze(["g", "unidad", "ml", "porcion"]);

function falseFlags(entries) {
  return Object.fromEntries(entries.map(([key]) => [key, false]));
}

export function defaultGeneration() {
  return {
    mode: "EXPLICIT_ONLY",
    roles: falseFlags(GENERATION_ROLES),
    mealTypes: falseFlags(GENERATION_MEAL_TYPES),
    portionRule: { unit: null, min: null, max: null, step: null, allowedValues: [] },
  };
}

export function generationForFood(food = {}) {
  const raw = food?.raw || food;
  const source = raw?.generation || {};
  const defaults = defaultGeneration();
  return {
    mode: GENERATION_MODES.includes(source.mode) ? source.mode : defaults.mode,
    roles: Object.fromEntries(GENERATION_ROLES.map(([key]) => [key, source?.roles?.[key] === true])),
    mealTypes: Object.fromEntries(GENERATION_MEAL_TYPES.map(([key]) => [key, source?.mealTypes?.[key] === true])),
    portionRule: {
      unit: PORTION_UNITS.includes(source?.portionRule?.unit) ? source.portionRule.unit : null,
      min: source?.portionRule?.min ?? null,
      max: source?.portionRule?.max ?? null,
      step: source?.portionRule?.step ?? null,
      allowedValues: Array.isArray(source?.portionRule?.allowedValues) ? source.portionRule.allowedValues : [],
    },
  };
}

export function createFoodDraft() {
  return {
    name: "",
    category: "",
    unit: "g",
    quantity: "100",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
    active: true,
    generation: defaultGeneration(),
    allowedValuesText: "",
  };
}

export function editFoodDraft(food = {}) {
  const generation = generationForFood(food);
  return {
    generation,
    allowedValuesText: generation.portionRule.allowedValues.join(", "),
  };
}

export function toggleGenerationFlag(draft, group, key) {
  return {
    ...draft,
    generation: {
      ...draft.generation,
      [group]: {
        ...draft.generation[group],
        [key]: !draft.generation[group][key],
      },
    },
  };
}

export function parseAllowedValuesInput(value = "") {
  const tokens = String(value || "").split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean);
  const values = tokens.map(Number);
  if (values.some((item) => !Number.isFinite(item) || item <= 0)) {
    return { values: [], error: "Los valores permitidos deben ser números positivos separados por comas." };
  }
  return { values: [...new Set(values)].sort((a, b) => a - b), error: "" };
}

function nullableNumber(value, label, { positive = false } = {}) {
  if (value === "" || value === null || value === undefined) return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) {
    return { error: `${label} ${positive ? "debe ser mayor a 0" : "no puede ser negativo"}.` };
  }
  return { value: number };
}

export function generationPayloadFromDraft(draft = {}) {
  const generation = generationForFood({ generation: draft.generation });
  const allowed = parseAllowedValuesInput(draft.allowedValuesText);
  if (allowed.error) return { error: allowed.error };
  const min = nullableNumber(generation.portionRule.min, "El mínimo");
  const max = nullableNumber(generation.portionRule.max, "El máximo");
  const step = nullableNumber(generation.portionRule.step, "El paso", { positive: true });
  const error = min.error || max.error || step.error;
  if (error) return { error };
  if (min.value !== null && max.value !== null && min.value > max.value) {
    return { error: "El mínimo no puede superar al máximo." };
  }
  if (generation.mode === "GENERIC" && !Object.values(generation.roles).some(Boolean)) {
    return { error: "Un alimento GENERIC necesita al menos un rol." };
  }
  if (generation.mode === "GENERIC" && !Object.values(generation.mealTypes).some(Boolean)) {
    return { error: "Un alimento GENERIC necesita al menos un momento de comida." };
  }
  return {
    generation: {
      ...generation,
      portionRule: {
        unit: generation.portionRule.unit || null,
        min: min.value,
        max: max.value,
        step: step.value,
        allowedValues: allowed.values,
      },
    },
  };
}

export function foodCreationPayloadFromDraft(draft = {}) {
  const generationResult = generationPayloadFromDraft(draft);
  if (generationResult.error) return generationResult;
  if (!String(draft.name || "").trim()) return { error: "El nombre es obligatorio." };
  if (!String(draft.unit || "").trim()) return { error: "La unidad actual es obligatoria." };
  const numeric = [
    ["quantity", "La cantidad base", true],
    ["kcal", "Las kcal", false],
    ["protein", "La proteína", false],
    ["carbs", "Los carbohidratos", false],
    ["fat", "Las grasas", false],
  ];
  const parsed = {};
  for (const [key, label, positive] of numeric) {
    const value = Number(draft[key]);
    if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
      return { error: `${label} ${positive ? "debe ser mayor a 0" : "no puede ser negativo"}.` };
    }
    parsed[key] = value;
  }
  return {
    food: {
      name: String(draft.name).trim(),
      category: String(draft.category || "").trim(),
      unit: String(draft.unit).trim(),
      ...parsed,
      active: draft.active !== false,
      generation: generationResult.generation,
    },
  };
}

export function enabledSummary(flags = {}, definitions = []) {
  const enabled = definitions.filter(([key]) => flags?.[key] === true).map(([key]) => key);
  return enabled.length ? enabled.join(" · ") : "Sin configurar";
}

export function mealTypesSummary(flags = {}) {
  const enabled = GENERATION_MEAL_TYPES.filter(([key]) => flags?.[key] === true).map(([, label]) => label);
  return enabled.length ? enabled.join(" · ") : "Sin configurar";
}

export function replaceFoodInAdminPage(page, updatedFood) {
  if (!page || !updatedFood) return page;
  const id = String(updatedFood._id || updatedFood.id || "");
  return {
    ...page,
    documents: (page.documents || []).map((food) =>
      String(food?._id || food?.id || "") === id ? updatedFood : food
    ),
  };
}
