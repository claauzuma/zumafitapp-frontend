export const MENU_GENERATION_MODE_SIMILAR = "similar_menu";
export const MENU_GENERATION_MODE_COMBINE = "combine_library";
export const MENU_GENERATION_MODE_SCRATCH = "from_scratch";

export const DEFAULT_MENU_GENERATION_SETTINGS = Object.freeze({
  generationProfile: "recommended",
  mode: MENU_GENERATION_MODE_COMBINE,
  mealCount: 4,
  mealTypes: ["desayuno", "almuerzo", "merienda", "cena"],
  allowRepeats: false,
  distribution: "balanced",
  preferFavorites: false,
  firstMealTime: "",
  includeFoods: [],
  excludeFoods: [],
  foodPoolMode: "combine",
  variety: "medium",
  algorithmTolerance: "balanced",
  prepTime: "quick",
  budget: "medium",
});

const VALID_MODES = new Set([
  MENU_GENERATION_MODE_SIMILAR,
  MENU_GENERATION_MODE_COMBINE,
  MENU_GENERATION_MODE_SCRATCH,
]);

const VALID_MEAL_TYPES = new Set([
  "desayuno", "colacion", "almuerzo", "merienda", "cena", "snack", "pre_entreno", "post_entreno",
]);

function normalizedFoodSelections(value = []) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map((food) => {
    const source = food && typeof food === "object" ? food : { nombre: String(food || "") };
    const nombre = String(source.nombre || source.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const id = String(source.id || source._id || source.alimentoId || nombre.toLowerCase()).trim();
    if (!nombre || !id || seen.has(id)) return null;
    seen.add(id);
    const generationSource = source.generation && typeof source.generation === "object" ? source.generation : {};
    const portionRule = generationSource.portionRule && typeof generationSource.portionRule === "object"
      ? generationSource.portionRule
      : {};
    const targetMealType = VALID_MEAL_TYPES.has(String(source.targetMealType || ""))
      ? String(source.targetMealType)
      : "any";
    return {
      id,
      alimentoId: source.alimentoId || source.id || source._id || "",
      nombre,
      name: nombre,
      unidad: source.unidad || source.unit || "g",
      unit: source.unit || source.unidad || "g",
      unidadBase: source.unidadBase || source.unidad || source.unit || "g",
      cantidadUnidad: Number(source.cantidadUnidad) || 1,
      kcal: Number(source.kcal ?? source.kcalUnidad) || 0,
      proteina: Number(source.proteina ?? source.protein ?? source.proteinaUnidad) || 0,
      protein: Number(source.protein ?? source.proteina ?? source.proteinaUnidad) || 0,
      carbs: Number(source.carbs ?? source.carbohidratosUnidad) || 0,
      grasas: Number(source.grasas ?? source.fat ?? source.grasasUnidad) || 0,
      fat: Number(source.fat ?? source.grasas ?? source.grasasUnidad) || 0,
      kcalUnidad: Number(source.kcalUnidad ?? source.kcal) || 0,
      proteinaUnidad: Number(source.proteinaUnidad ?? source.proteina ?? source.protein) || 0,
      carbohidratosUnidad: Number(source.carbohidratosUnidad ?? source.carbs) || 0,
      grasasUnidad: Number(source.grasasUnidad ?? source.grasas ?? source.fat) || 0,
      kcal100: Number(source.kcal100) || 0,
      proteina100: Number(source.proteina100) || 0,
      carbohidratos100: Number(source.carbohidratos100) || 0,
      grasas100: Number(source.grasas100) || 0,
      porcionMin: Number(portionRule.min ?? source.porcionMin) || 0,
      porcionMax: Number(portionRule.max ?? source.porcionMax) || 0,
      porcionSugerida: Number(source.porcionSugerida) || 0,
      multiplo: Number(portionRule.step ?? source.multiplo) || 0,
      macroBasis: source.macroBasis || "",
      categoria: source.categoria || source.source || "",
      aptoDesayuno: source.aptoDesayuno === true,
      aptoAlmuerzo: source.aptoAlmuerzo === true,
      aptoMerienda: source.aptoMerienda === true,
      aptoCena: source.aptoCena === true,
      aptoPreEntreno: source.aptoPreEntreno === true,
      aptoPostEntreno: source.aptoPostEntreno === true,
      esProteinaPrincipal: source.esProteinaPrincipal === true,
      esCarboPrincipal: source.esCarboPrincipal === true,
      esGrasaPrincipal: source.esGrasaPrincipal === true,
      esVegetalLibre: source.esVegetalLibre === true,
      mustAppear: source.mustAppear === true,
      targetMealType,
      generation: {
        mode: generationSource.mode || "EXPLICIT_ONLY",
        roles: Object.fromEntries(["P1", "P2", "C1", "C2", "V", "F", "G"].map((role) => [role, generationSource.roles?.[role] === true])),
        mealTypes: Object.fromEntries(["breakfast", "lunch", "snack", "dinner", "extraSnack"].map((mealType) => [mealType, generationSource.mealTypes?.[mealType] === true])),
        portionRule: {
          unit: portionRule.unit || null,
          min: Number.isFinite(Number(portionRule.min)) ? Number(portionRule.min) : null,
          max: Number.isFinite(Number(portionRule.max)) ? Number(portionRule.max) : null,
          step: Number.isFinite(Number(portionRule.step)) ? Number(portionRule.step) : null,
          allowedValues: Array.isArray(portionRule.allowedValues)
            ? portionRule.allowedValues.map(Number).filter((amount) => Number.isFinite(amount) && amount > 0).slice(0, 30)
            : [],
        },
      },
    };
  }).filter(Boolean).slice(0, 24);
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeMenuGenerationSettings(value = {}) {
  const requestedMealCount = Math.max(3, Math.min(6, Math.round(Number(value.mealCount) || 4)));
  const selectedMealTypes = Array.isArray(value.mealTypes)
    ? [...new Set(value.mealTypes.map(String).filter((type) => VALID_MEAL_TYPES.has(type)))].slice(0, 6)
    : [];
  const mealTypes = selectedMealTypes.length >= 3 ? selectedMealTypes : mealTypesForCount(requestedMealCount);
  const mealCount = mealTypes.length;
  const firstMealTime = /^\d{2}:\d{2}$/.test(String(value.firstMealTime || ""))
    ? String(value.firstMealTime)
    : "";
  return {
    generationProfile: enumValue(
      value.generationProfile,
      ["recommended", "custom", "library"],
      DEFAULT_MENU_GENERATION_SETTINGS.generationProfile
    ),
    mode: VALID_MODES.has(value.mode) ? value.mode : DEFAULT_MENU_GENERATION_SETTINGS.mode,
    mealCount,
    mealTypes,
    allowRepeats: value.allowRepeats === true,
    distribution: value.distribution === "equal" ? "equal" : "balanced",
    preferFavorites: value.preferFavorites === true,
    firstMealTime,
    includeFoods: normalizedFoodSelections(value.includeFoods).map((food) => ({
      ...food,
      targetMealType: food.targetMealType === "any" || mealTypes.includes(food.targetMealType)
        ? food.targetMealType
        : "any",
    })),
    excludeFoods: normalizedFoodSelections(value.excludeFoods),
    foodPoolMode: enumValue(value.foodPoolMode, ["combine", "only"], "combine"),
    variety: enumValue(value.variety, ["low", "medium", "high"], "medium"),
    algorithmTolerance: enumValue(value.algorithmTolerance, ["strict", "balanced", "flexible"], "balanced"),
    prepTime: enumValue(value.prepTime, ["quick", "normal", "elaborate"], "quick"),
    budget: enumValue(value.budget, ["low", "medium", "high"], "medium"),
  };
}

export function menuGenerationSettingsOwner(user = {}) {
  return String(user.id || user._id || user.email || "anonymous");
}

export function menuGenerationSettingsKey(user = {}) {
  return `zumafit:menu-generation-settings:v1:${menuGenerationSettingsOwner(user)}`;
}

export function loadMenuGenerationSettings(user = {}, storage = globalThis?.localStorage) {
  if (!storage) return { ...DEFAULT_MENU_GENERATION_SETTINGS };
  try {
    const parsed = JSON.parse(storage.getItem(menuGenerationSettingsKey(user)) || "null");
    if (parsed?.version !== 1) return { ...DEFAULT_MENU_GENERATION_SETTINGS };
    return normalizeMenuGenerationSettings(parsed.settings);
  } catch {
    return { ...DEFAULT_MENU_GENERATION_SETTINGS };
  }
}

export function saveMenuGenerationSettings(user = {}, settings = {}, storage = globalThis?.localStorage) {
  const normalized = normalizeMenuGenerationSettings(settings);
  if (!storage) return normalized;
  try {
    storage.setItem(menuGenerationSettingsKey(user), JSON.stringify({
      version: 1,
      settings: normalized,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    return normalized;
  }
  return normalized;
}

export function resetMenuGenerationSettings(user = {}, storage = globalThis?.localStorage) {
  const defaults = { ...DEFAULT_MENU_GENERATION_SETTINGS };
  try { storage?.removeItem(menuGenerationSettingsKey(user)); } catch { return defaults; }
  return defaults;
}

export function generationModeLabel(mode = "") {
  if (mode === MENU_GENERATION_MODE_SIMILAR) return "Biblioteca";
  if (mode === MENU_GENERATION_MODE_SCRATCH) return "Desde cero";
  return "Combinar comidas";
}

export function mealTypesForCount(count = 4) {
  const options = {
    3: ["desayuno", "almuerzo", "cena"],
    4: ["desayuno", "almuerzo", "merienda", "cena"],
    5: ["desayuno", "almuerzo", "merienda", "cena", "snack"],
    6: ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack"],
  };
  return options[Math.max(3, Math.min(6, Math.round(Number(count) || 4)))];
}

export function buildAutonomousMenuGenerationRequest({
  settings = {},
  target = {},
  selectedDate = "",
  coachMealTargets = [],
  allowCalorieTopUp = false,
  name = "Mi menu generado",
} = {}) {
  const normalized = normalizeMenuGenerationSettings(settings);
  const coachTargets = Array.isArray(coachMealTargets) ? coachMealTargets : [];
  const coachTypes = coachTargets
    .map((meal) => String(meal?.type || meal?.tipo || "").trim().toLowerCase())
    .filter((type) => VALID_MEAL_TYPES.has(type));
  const mealTypes = coachTypes.length === coachTargets.length && coachTypes.length
    ? coachTypes
    : normalized.mealTypes;
  const sourceMode = normalized.foodPoolMode === "only" || normalized.mode === MENU_GENERATION_MODE_SCRATCH
    ? "foods"
    : normalized.mode === MENU_GENERATION_MODE_SIMILAR
      ? "library"
      : "combined";
  return {
    target,
    mealTypes,
    mealTargets: coachTypes.length === coachTargets.length ? coachTargets : [],
    selectedDays: [dayKeyFromIsoDate(selectedDate)],
    selectedDate,
    distribution: normalized.distribution,
    sourceMode,
    generationMode: normalized.mode,
    foods: normalized.includeFoods,
    excludedFoods: normalized.excludeFoods,
    useOnlySelectedFoods: normalized.foodPoolMode === "only",
    allowRepeats: normalized.allowRepeats,
    preferFavorites: normalized.preferFavorites,
    firstMealTime: normalized.firstMealTime,
    allowCalorieTopUp,
    name,
    generationSettings: {
      generationProfile: normalized.generationProfile,
      variety: normalized.variety,
      algorithmTolerance: normalized.algorithmTolerance,
      prepTime: normalized.prepTime,
      budget: normalized.budget,
    },
  };
}

export function dayKeyFromIsoDate(value = "") {
  const parts = String(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return "monday";
  const index = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][index];
}

export function libraryTargetPath(date = "", target = {}) {
  const params = new URLSearchParams({ tab: "admin", context: "day-menu" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date))) params.set("selectedDate", String(date));
  [
    ["targetKcal", target.kcal],
    ["targetProtein", target.proteina],
    ["targetCarbs", target.carbs],
    ["targetFat", target.grasas],
  ].forEach(([key, value]) => {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) params.set(key, String(number));
  });
  return `/app/nutricion?${params.toString()}`;
}

export function resolveAutonomousMenuActions(capabilities = {}) {
  const library = capabilities.canUseBasicLibrary === true
    || capabilities.canUseGlobalLibrary === true
    || capabilities.canUsePremiumLibrary === true;
  const create = capabilities.canCreateOwnMenu === true;
  const automatic = capabilities.canGenerateAutomaticMenu === true;
  const settings = capabilities.canEditMenuPreferences === true
    || capabilities.hasCoach !== true;
  return {
    library,
    create,
    automatic,
    settings,
    visible: library || create || automatic || settings,
  };
}

export function automaticGenerationRequiresPlan(error = {}) {
  const code = String(error?.code || error?.message || "").trim();
  return Number(error?.status) === 403 && code === "PLAN_CAPABILITY_REQUIRED";
}
