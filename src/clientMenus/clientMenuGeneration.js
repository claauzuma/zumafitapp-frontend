import { automaticMenuMatchMessage, buildCalorieTopUpMeal } from "./clientMenuAutomaticMatch.js";
import { GENERATOR_DAY_KEYS, generatorMealSpecs, generationNumber as number } from "./clientMenuGenerationCore.js";
import {
  MEAL_NUTRITION_POLICY,
  adaptMealNutritionResult,
} from "../nutricion/mealNutritionResult.js";
import {
  generateSequentialMenuDay,
  generationRemainingNutrition,
  mealHasPlannedContent,
  normalizeDayNutritionTarget,
  subtractDayNutrition,
} from "./clientMenuDayPlanner.js";
import {
  buildIncludedFoodAssignments,
  exactMealTypesMatch,
  curateGenerationFoodPool,
  generatedMealNutritionTotals,
  generatedMealFingerprint,
  generatedMealComposition,
  generatedMealCompositionFingerprint,
  generatedMealFoodIdentities,
  generationMealTypeForMenuType,
  isGenericGenerationFood,
  libraryMealScore,
  libraryMealVarietyPenalty,
  mealProteinWithinGenerationRange,
  menuPreferredFoodMatches,
  validateMenuGenerationPolicy,
} from "./clientMenuGenerationPolicy.js";
export { GENERATOR_DAY_KEYS, GENERATOR_MEAL_TYPES, distributeGeneratorProteinTarget, distributeGeneratorTarget, generatorMealSpecs, nutritionTargetForMenuGeneration } from "./clientMenuGenerationCore.js";
export {
  generatedMealComposition,
  generatedMealCompositionFingerprint,
  generatedMealFingerprint,
  libraryMealScore,
} from "./clientMenuGenerationPolicy.js";
export { automaticMenuMatchMessage } from "./clientMenuAutomaticMatch.js";

function generationDebug(...values) {
  try {
    if (globalThis.localStorage?.getItem("zumafit:generation-debug") === "1") {
      console.info(...values);
    }
  } catch {
    // localStorage puede estar bloqueado; el diagnóstico nunca debe romper la generación.
  }
}

// Estas dependencias llegan hasta `Api.js` (entorno Vite/navegador). Cargarlas
// sólo cuando se usan permite probar el orquestador puro con un servicio
// inyectado y evita acoplar la lógica diaria al transporte HTTP.
async function listAlimentos(params) {
  const api = await import("../nutricion/nutricionApi.js");
  return await api.listAlimentos(params);
}

async function listLibraryMeals(params) {
  const api = await import("../nutritionLibrary/nutritionLibraryApi.js");
  return await api.listLibraryMeals(params);
}

async function listLibraryMenus(params) {
  const api = await import("../nutritionLibrary/nutritionLibraryApi.js");
  return await api.listLibraryMenus(params);
}

async function defaultAutomaticMealGenerator(payload) {
  const api = await import("./clientMenusApi.js");
  return await api.generateAutomaticMenuMeal(payload);
}

function itemId(prefix, index) {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function generationFoodId(food = {}) {
  return String(food?.id || food?._id || food?.alimentoId || food?.foodId || "").trim();
}

function foodConstraintAppliesToMeal(food = {}, type = "") {
  const targetType = String(food?.targetMealType || "any");
  return !targetType || targetType === "any" || targetType === type;
}

function generationMealLabel(type = "", mealTargets = [], index = 0) {
  const matching = (Array.isArray(mealTargets) ? mealTargets : []).find((entry) => (
    String(entry?.type || entry?.tipo || "") === type
  ));
  return matching?.label || matching?.name || matching?.nombre ||
    String(type || `Comida ${index + 1}`).replaceAll("_", " ");
}

/**
 * Genera una vista previa diaria sin persistirla. Las comidas con contenido
 * recibido en `plannedMeals` quedan intactas; el resto se resuelve de forma
 * secuencial mediante el generador individual del backend.
 */
export async function generateClientMenuPreview({
  target = {},
  mealTypes = [],
  selectedDays = [],
  selectedDate = "",
  distribution = "balanced",
  sourceMode = "combined",
  generationMode = "",
  foods = [],
  mealTargets = [],
  plannedMeals = [],
  reservedMealTargets = [],
  consumedBaseline = {},
  generationAccounting = null,
  diversityMeals = [],
  useOnlySelectedFoods = false,
  allowRepeats = false,
  assisted = false,
  preferFavorites = false,
  excludedFoods = [],
  allowCalorieTopUp = false,
  firstMealTime = "",
  name = "Mi menu generado",
  generationSettings = {},
  calorieDistributionMode = "balanced",
  calorieDistributionPercents = {},
  lockedCalorieMeals = {},
  freeCalories = 0,
  variantSeed = "",
  automaticMealGenerator = defaultAutomaticMealGenerator,
} = {}) {
  const preservedPlanning = (Array.isArray(plannedMeals) ? plannedMeals : [])
    .filter(mealHasPlannedContent);

  // La equivalencia de un menú completo sólo es válida para un día vacío. Si
  // ya hay planificación fija, pasamos al generador por comida para no tocarla.
  if (
    generationMode === "similar_menu"
    && !preservedPlanning.length
    && !(Array.isArray(reservedMealTargets) && reservedMealTargets.length)
    && !Object.values(normalizeDayNutritionTarget(consumedBaseline)).some((value) => value > 0)
    && !useOnlySelectedFoods
  ) {
    return await generateClientMenuPreviewLegacy({
      target,
      mealTypes,
      selectedDays,
      selectedDate,
      distribution,
      sourceMode,
      generationMode,
      foods,
      mealTargets,
      useOnlySelectedFoods,
      allowRepeats,
      assisted,
      preferFavorites,
      excludedFoods,
      allowCalorieTopUp,
      firstMealTime,
      name,
      generationSettings,
      calorieDistributionMode,
      calorieDistributionPercents,
      lockedCalorieMeals,
      freeCalories,
      variantSeed,
    });
  }

  validateMenuGenerationPolicy({ generationMode, foods, useOnlySelectedFoods });
  const normalizedConsumedBaseline = normalizeDayNutritionTarget(consumedBaseline);
  const remainingAfterConsumption = generationRemainingNutrition(subtractDayNutrition(
    target,
    normalizedConsumedBaseline
  ));
  const flexiblePlan = plannedTargetWithFreeCalories(remainingAfterConsumption, freeCalories);
  const plannedTarget = normalizeDayNutritionTarget(flexiblePlan.plannedTarget);
  const assignments = buildIncludedFoodAssignments(foods, mealTypes);
  const runId = variantSeed || `menu-run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const baseHour = /^\d{2}:\d{2}$/.test(firstMealTime) ? Number(firstMealTime.slice(0, 2)) : null;

  const dayResult = await generateSequentialMenuDay({
    dailyTarget: plannedTarget,
    mealTypes,
    plannedMeals: preservedPlanning,
    reservedMealTargets,
    diversityMeals,
    distributionMode: calorieDistributionMode,
    distributionPercentages: calorieDistributionPercents,
    seed: runId,
    generateMeal: async ({ slot, target: mealTarget, seed, usedFingerprints, previousMeals }) => {
      const assignment = assignments[slot.type] || { required: [], preferred: [], allowed: [] };
      const blockedFoods = (Array.isArray(excludedFoods) ? excludedFoods : [])
        .filter((food) => foodConstraintAppliesToMeal(food, slot.type));
      const blockedIds = new Set(blockedFoods.map(generationFoodId).filter(Boolean));
      const explicitFoods = useOnlySelectedFoods ? assignment.allowed : assignment.required;
      const requiredFoods = explicitFoods.filter((food) => !blockedIds.has(generationFoodId(food)));
      const conflict = explicitFoods.find((food) => blockedIds.has(generationFoodId(food)));
      if (conflict) {
        const error = new Error(`${conflict.nombre || conflict.name || "Un alimento"} no puede estar incluido y evitado en ${slot.name}.`);
        error.code = "MENU_FOOD_CONSTRAINT_CONFLICT";
        error.mealType = slot.type;
        throw error;
      }

      const strategy = useOnlySelectedFoods && requiredFoods.length
        ? "selected_only"
        : "assisted_food_addition";
      const spec = {
        type: slot.type,
        name: generationMealLabel(slot.type, mealTargets, slot.index),
        target: mealTarget,
      };
      const generated = await generateFromFoods(spec, requiredFoods, strategy, {
        requiredFoods,
        genericFoods: [],
        excludedFoodIds: [...blockedIds],
        seed,
        usedFingerprints: allowRepeats ? new Set() : usedFingerprints,
        previousMeals: allowRepeats ? [] : previousMeals,
        automaticMealGenerator,
      });
      const horario = baseHour === null
        ? ""
        : `${String((baseHour + slot.index * 3) % 24).padStart(2, "0")}:${firstMealTime.slice(3)}`;
      return {
        ...generated,
        meal: {
          ...generated.meal,
          orden: slot.index + 1,
          plannerSlotIndex: slot.index,
          ...(horario ? { horario } : {}),
        },
      };
    },
  });

  return {
    nombre: String(name || "Mi menu generado").trim() || "Mi menu generado",
    descripcion: "Vista previa generada. Revisá y editá antes de guardar.",
    selectedDays: selectedDays?.length ? selectedDays : [GENERATOR_DAY_KEYS[0]],
    comidas: dayResult.meals,
    warnings: dayResult.warnings,
    generationMeta: {
      previewOnly: true,
      source: "autonomous",
      sourceMode,
      generationMode,
      useOnlySelectedFoods,
      settings: generationSettings,
      policy: dayResult.generatedCount > 0
        ? dayResult.trace.find((entry) => entry?.status === "generated")?.solver?.policy || MEAL_NUTRITION_POLICY
        : "preserved_planning",
      dailyTarget: normalizeDayNutritionTarget(target),
      plannedTarget,
      freeCalories: flexiblePlan.freeCalories,
      initialFreeCalories: Number(generationAccounting?.initialFreeCalories ?? freeCalories) || 0,
      freeCaloriesConsumed: Number(generationAccounting?.freeCaloriesConsumed) || 0,
      freeCaloriesRemaining: Number(generationAccounting?.freeCaloriesRemaining ?? flexiblePlan.freeCalories) || 0,
      consumedBaselineTotals: normalizedConsumedBaseline,
      accounting: generationAccounting,
      generationRunId: runId,
      seed: runId,
      revision: 1,
      distributionMode: calorieDistributionMode,
      distributionSource: dayResult.distribution.source,
      distribution: Object.fromEntries(mealTypes.map((type, index) => [
        type,
        roundGenerationValue((dayResult.distribution.weights[index] || 0) * 100),
      ])),
      fixedMealKeys: dayResult.fixedMealKeys,
      fixedMealCount: dayResult.fixedMeals.length,
      reservedMealTargetCount: dayResult.reservedMeals.length,
      reservedMealTargets: dayResult.reservedMeals,
      generatedMealCount: dayResult.generatedCount,
      fixedTotals: dayResult.fixedTotals,
      reservedTotals: dayResult.reservedTotals,
      resultTotals: dayResult.totals,
      difference: dayResult.difference,
      remainingRaw: dayResult.rawRemaining,
      warnings: dayResult.warnings,
      trace: dayResult.trace,
    },
    menuTarget: normalizeDayNutritionTarget(target),
    plannedTarget,
    flexibleCalories: flexiblePlan.freeCalories,
    isActiveOwnMenu: false,
  };
}

function mealItems(meal = {}) {
  const values = Array.isArray(meal.items) ? meal.items : Array.isArray(meal.alimentos) ? meal.alimentos : [];
  return values.map((item, index) => ({
    ...item,
    id: item.id || itemId("library-food", index),
    kcal: number(item.kcal ?? item.calorias),
    proteina: number(item.proteina ?? item.proteinas),
    carbs: number(item.carbs ?? item.carbohidratos),
    grasas: number(item.grasas ?? item.fat),
  }));
}

function completeMealItems(meal = {}) {
  const items = mealItems(meal);
  return items.length > 0 && items.every((item) => (
    number(item.cantidad ?? item.quantity) > 0
    && Boolean(String(item.unidadSnapshot || item.unidad || item.unit || "").trim())
    && Number.isFinite(Number(item.kcal))
  ));
}

function foodIdentitySets(foods = []) {
  return {
    ids: new Set(foods.flatMap((food) => [food.id, food._id, food.alimentoId, food.foodId]).filter(Boolean).map(String)),
    names: new Set(foods.map((food) => String(food.nombre || food.name || food.nombreSnapshot || "").trim().toLowerCase()).filter(Boolean)),
  };
}

function foodMatchesSets(food = {}, sets = { ids: new Set(), names: new Set() }) {
  const ids = [food.alimentoId, food.foodId, food._id, food.id].filter(Boolean).map(String);
  const name = String(food.nombreSnapshot || food.nombre || food.name || "").trim().toLowerCase();
  return ids.some((id) => sets.ids.has(id)) || Boolean(name && sets.names.has(name));
}

function mealContainsFoods(meal = {}, foods = []) {
  const items = mealItems(meal);
  return foods.every((food) => {
    const expected = foodIdentitySets([food]);
    return items.some((item) => foodMatchesSets(item, expected));
  });
}

function mealUsesOnlyCatalogFoods(meal = {}, catalogFoods = []) {
  const catalog = foodIdentitySets(catalogFoods);
  return mealItems(meal).every((item) => foodMatchesSets(item, catalog));
}

function assertGeneratedMealPolicy(meal = {}, {
  requiredFoods = [],
  genericFoods = [],
  allowProteinBelowMinimum = false,
  enforceProteinRange = true,
} = {}) {
  if (!completeMealItems(meal)) {
    const error = new Error("La propuesta contiene alimentos sin una cantidad utilizable.");
    error.code = "MENU_INVALID_GENERATED_QUANTITY";
    throw error;
  }
  const protein = generatedMealNutritionTotals(meal).proteina;
  if (enforceProteinRange && (
    protein > 70 + 1e-6 ||
    (!allowProteinBelowMinimum && !mealProteinWithinGenerationRange(meal))
  )) {
    const error = new Error(
  `La comida generada quedó en ${
    Math.round(protein * 10) / 10
  } g de proteína; debe quedar entre 5 g y 70 g.`
);
    error.code = "MENU_MEAL_PROTEIN_RANGE";
    error.details = { protein };
    throw error;
  }
  if (genericFoods.length && !mealUsesOnlyCatalogFoods(meal, genericFoods)) {
    const error = new Error("La propuesta incluyo un alimento que no esta habilitado como GENERIC.");
    error.code = "MENU_NON_GENERIC_FOOD";
    throw error;
  }
  if (!mealContainsFoods(meal, requiredFoods)) {
    const error = new Error("No pudimos incluir uno de los alimentos marcados como Debe aparecer en esta comida.");
    error.code = "MENU_REQUIRED_FOOD_MISSING";
    throw error;
  }
  return meal;
}

function menuMeals(menu = {}) {
  if (Array.isArray(menu.comidas) && menu.comidas.length) return menu.comidas;
  const days = menu.dias && typeof menu.dias === "object" ? Object.values(menu.dias) : [];
  const day = days.find((entry) => Array.isArray(entry?.comidas) && entry.comidas.length);
  return day?.comidas || [];
}

function automaticMenuMatchError(status, details = {}) {
  const error = new Error(automaticMenuMatchMessage(status));
  error.code = status === "requires_calorie_top_up"
    ? "MENU_CALORIE_TOP_UP_CONFIRMATION_REQUIRED"
    : status === "no_protein_match"
      ? "MENU_NO_PROTEIN_MATCH"
      : "MENU_NO_CALORIE_MATCH";
  error.details = details;
  return error;
}

export function buildSimilarMenuPreview({ candidate, target, selectedDays, name, topUpTarget = null, topUpAccepted = false }) {
  const meals = menuMeals(candidate).map((meal, index) => ({
    ...meal,
    id: itemId("similar-meal", index),
    nombre: meal.nombre || meal.name || `Comida ${index + 1}`,
    tipoComida: meal.tipoComida || meal.mealType || "otra",
    orden: index + 1,
    items: mealItems(meal),
    generationSource: "library_menu",
    sourceId: String(meal.id || meal._id || ""),
  }));
  if (!meals.length) throw new Error("El menú compatible no tiene comidas utilizables.");

  const topUpKcal = number(topUpTarget?.kcal);
  if (topUpAccepted && topUpKcal > 0) {
    meals.push(buildCalorieTopUpMeal(topUpTarget, {
      id: itemId("calorie-top-up", meals.length),
      order: meals.length + 1,
    }));
  }

  return {
    nombre: String(name || candidate.nombre || "Menú similar").trim() || "Menú similar",
    descripcion: topUpAccepted && topUpKcal > 0
      ? `Vista previa basada en ${candidate.nombre || "un menú de la biblioteca"}, con un complemento pendiente de ${Math.round(topUpKcal)} kcal.`
      : `Vista previa basada en ${candidate.nombre || "un menú de la biblioteca"}.`,
    selectedDays: selectedDays?.length ? selectedDays : [GENERATOR_DAY_KEYS[0]],
    comidas: meals,
    generationMeta: {
      previewOnly: true,
      sourceMode: "similar_menu",
      policy: "library_equivalence",
      sourceMenuId: String(candidate.id || candidate._id || ""),
      calorieTopUpAccepted: topUpAccepted && topUpKcal > 0,
      calorieTopUpTarget: topUpAccepted && topUpKcal > 0 ? topUpTarget : null,
    },
    menuTarget: target,
    isActiveOwnMenu: false,
  };
}

async function generateFromSimilarMenu({ target, mealTypes = [], selectedDays, selectedDate, name, preferFavorites = false, preferredFoods = [], excludedFoods = [], allowCalorieTopUp = false, genericFoods = [], assignments = {} }) {
  const response = await listLibraryMenus({
    scope: "all",
    context: "day-menu",
    automaticMatch: true,
    preferFavorites,
    targetMeals: mealTypes.length,
    selectedDate: selectedDate || new Date().toISOString().slice(0, 10),
    includeComidas: true,
    targetKcal: target.kcal,
    targetProtein: target.proteina,
    targetCarbs: target.carbs,
    targetFat: target.grasas,
    limit: 30,
  });
  const excludedIds = new Set(excludedFoods.map((food) => String(food.id || food._id || food.alimentoId || "")).filter(Boolean));
  const excludedNames = new Set(excludedFoods.map((food) => String(food.nombre || food.name || "").trim().toLowerCase()).filter(Boolean));
  const candidateAllowed = (menu) => {
    const meals = menuMeals(menu);
    if (!exactMealTypesMatch(meals, mealTypes)) return false;
    return meals.every((meal) => {
      const type = String(meal.tipoComida || meal.mealType || "");
      return completeMealItems(meal)
        && mealProteinWithinGenerationRange(meal)
        && mealUsesOnlyCatalogFoods(meal, genericFoods)
        && mealContainsFoods(meal, assignments[type]?.required || [])
        && mealItems(meal).every((item) => {
          const id = String(item.alimentoId || item.foodId || item.id || "");
          const foodName = String(item.nombreSnapshot || item.nombre || "").trim().toLowerCase();
          return !excludedIds.has(id) && !excludedNames.has(foodName);
        });
    });
  };
  const resolution = response?.automaticResolution || {};
  const candidate = [...(response?.menus || [])]
    .filter(candidateAllowed)
    .sort((left, right) => {
      const matches = (menu) => menuPreferredFoodMatches(menuMeals(menu), preferredFoods);
      return matches(right) - matches(left);
    })[0]
    || (resolution.candidate && candidateAllowed(resolution.candidate) ? resolution.candidate : null);

  if (resolution.status === "requires_calorie_top_up" && candidate && !allowCalorieTopUp) {
    throw automaticMenuMatchError(resolution.status, {
      candidateId: String(candidate.id || candidate._id || ""),
      candidateName: candidate.nombre || "Menú de biblioteca",
      candidateTotals: candidate.totales || candidate.macrosTotales || resolution.candidate?.equivalence?.result || {},
      topUpTarget: resolution.topUpTarget,
      maxTopUpKcal: resolution.maxTopUpKcal,
    });
  }
  if (!candidate) throw automaticMenuMatchError(
    resolution.status === "requires_calorie_top_up" ? "no_calorie_match" : resolution.status || "no_calorie_match"
  );
  return buildSimilarMenuPreview({
    candidate,
    target,
    selectedDays,
    name,
    topUpTarget: resolution.topUpTarget,
    topUpAccepted: resolution.status === "requires_calorie_top_up" && allowCalorieTopUp,
  });
}

async function generateFromLibrary(spec, excludedIds = new Set(), {
  preferFavorites = false,
  preferredFoods = [],
  excludedFoodIds = [],
  excludedFoodNames = [],
  algorithmTolerance = "balanced",
  variety = "medium",
  usedFoodIdentities = new Set(),
  requiredFoods = [],
  genericFoods = [],
} = {}) {
  const query = async (scope) => await listLibraryMeals({
    scope,
    tipoComida: spec.type,
    targetKcal: spec.target.kcal,
    targetProteina: spec.target.proteina,
    targetCarbs: spec.target.carbs,
    targetGrasas: spec.target.grasas,
    limit: 30,
  });
  const blockedIds = new Set(excludedFoodIds.map(String));
  const blockedNames = new Set(excludedFoodNames.map((value) => String(value).trim().toLowerCase()).filter(Boolean));
  const usableMeals = (response) => (Array.isArray(response?.comidas) ? response.comidas : []).filter((meal) => (
    completeMealItems(meal)
    && mealProteinWithinGenerationRange(meal)
    && mealUsesOnlyCatalogFoods(meal, genericFoods)
    && mealContainsFoods(meal, requiredFoods)
    && mealItems(meal).every((item) => {
      const id = String(item.alimentoId || item.foodId || item.id || "");
      const name = String(item.nombreSnapshot || item.nombre || "").trim().toLowerCase();
      return !blockedIds.has(id) && !blockedNames.has(name);
    })
  ));
  let response = preferFavorites ? await query("favorites") : await query("discover");
  let meals = usableMeals(response);
  let available = meals.filter((meal) => !excludedIds.has(String(meal.id || meal._id || "")));
  if (!available.length && preferFavorites) {
    response = await query("discover");
    meals = usableMeals(response);
    available = meals.filter((meal) => !excludedIds.has(String(meal.id || meal._id || "")));
  }
  if (!available.length) return null;
  const best = [...available].sort((left, right) => (
    libraryMealScore(left, spec.target, preferredFoods, algorithmTolerance)
      + libraryMealVarietyPenalty(left, usedFoodIdentities, variety)
      - libraryMealScore(right, spec.target, preferredFoods, algorithmTolerance)
      - libraryMealVarietyPenalty(right, usedFoodIdentities, variety)
  ))[0];
  if (!best) return null;
  return {
    id: itemId("generated-meal", 0),
    nombre: best.nombre || spec.name,
    tipoComida: spec.type,
    items: mealItems(best),
    target: spec.target,
    generationSource: "library",
    sourceId: String(best.id || best._id || ""),
  };
}

function generatedResponseFoodItem(food = {}, index = 0) {
  return {
    id: itemId("generated-food", index),
    alimentoId: food.foodId || food.alimentoId || food.id || food._id || null,
    nombreSnapshot: food.nombre || food.name || "Alimento",
    cantidad: number(food.cantidad ?? food.quantity),
    unidad: food.unidad || food.unit || "g",
    unidadSnapshot: food.unidad || food.unit || "g",
    kcal: number(food.kcal ?? food.calorias),
    proteina: number(food.proteina ?? food.protein),
    carbs: number(food.carbs ?? food.carbohidratos),
    grasas: number(food.grasas ?? food.fat),
    categoriaSnapshot: food.categoria || "",
    imagen: food.imagen || null,
    imagenUrl: food.imagenUrl || "",
    suggested: food.source === "addedCandidate" || food.suggested === true,
    generationRole: food.role || food.generationRole || "",
  };
}

function generatedResponseWarning(value, index = 0, mealType = "") {
  const warning = typeof value === "string" ? { message: value } : value;
  if (!warning || typeof warning !== "object") return null;
  const message = String(warning.message || warning.summary || "").trim();
  if (!message) return null;
  return {
    ...warning,
    code: String(warning.code || `MENU_GENERATION_WARNING_${index + 1}`),
    message,
    mealType,
  };
}

function uniqueGeneratedWarnings(values = [], mealType = "") {
  return values
    .map((warning, index) => generatedResponseWarning(warning, index, mealType))
    .filter(Boolean)
    .filter((warning, index, warnings) => warnings.findIndex((candidate) => (
      candidate.code === warning.code || candidate.message === warning.message
    )) === index);
}

async function generateFromFoods(spec, foods = [], strategy = "selected_only", {
  requiredFoods = [],
  genericFoods = [],
  excludedFoodIds = [],
  seed = "",
  usedFingerprints = new Set(),
  previousMeals = [],
  automaticMealGenerator = defaultAutomaticMealGenerator,
} = {}) {
  void foods;
  const requiredIds = requiredFoods
    .map((food) => String(food?.id || food?._id || food?.alimentoId || food?.foodId || ""))
    .filter(Boolean);
  const response = await automaticMealGenerator({
    mealType: generationMealTypeForMenuType(spec.type),
    target: spec.target,
    requiredFoodIds: requiredIds,
    excludedFoodIds,
    strategy,
    variantSeed: seed,
    limit: 32,
    ...(previousMeals.length ? {
      diversityContext: {
        previousMeals: previousMeals.map(generatedMealComposition),
      },
    } : {}),
  });

  const alternatives = [response?.alternative, ...(response?.alternatives || [])]
    .filter((alternative) => Array.isArray(alternative?.foods) && alternative.foods.length)
    .map((alternative, index) => {
      const nutritionResult = adaptMealNutritionResult(
        index === 0 ? response : alternative,
        alternative
      );
      const warnings = uniqueGeneratedWarnings([
        nutritionResult.warning,
        ...(Array.isArray(alternative?.warnings) ? alternative.warnings : []),
      ], spec.type);
      const meal = {
        id: itemId("generated-meal", 0),
        nombre: spec.name,
        tipoComida: spec.type,
        target: spec.target,
        generationSource: MEAL_NUTRITION_POLICY,
        classification: nutritionResult.classification,
        recommended: nutritionResult.recommended,
        usable: nutritionResult.usable,
        ...(nutritionResult.raw ? { nutrition: nutritionResult.raw } : {}),
        warnings,
        items: alternative.foods.map(generatedResponseFoodItem),
      };
      return {
        alternative,
        meal,
        nutritionResult,
        totals: generatedMealNutritionTotals(meal),
        fingerprint: generatedMealFingerprint(meal),
        compositionFingerprint: alternative?.composition?.fingerprint ||
          generatedMealCompositionFingerprint(meal),
      };
    });

  if (!alternatives.length) {
    const error = new Error(
      response?.code === "TARGET_NOT_REACHABLE_WITH_SELECTED_FOODS"
        ? `No pudimos construir ${spec.name} usando únicamente los alimentos elegidos y sus porciones válidas.`
        : `No encontramos una combinación válida para ${spec.name}.`
    );
    error.code = response?.code || "MENU_MEAL_GENERATION_FAILED";
    error.mealType = spec.type;
    error.details = response?.meta || null;
    throw error;
  }

  const usableAlternatives = alternatives.filter((candidate) => candidate.nutritionResult.usable === true);
  if (!usableAlternatives.length) {
    const error = new Error(`No encontramos una combinación utilizable para ${spec.name}.`);
    error.code = response?.code || "MENU_MEAL_GENERATION_FAILED";
    error.mealType = spec.type;
    error.details = response?.meta || null;
    throw error;
  }

  // La selección de diversidad es semántica y central. Cambiar sólo gramos no
  // crea otra composición; si repetir es inevitable, el backend la conserva
  // usable con un warning en vez de fabricar un NO_SOLUTION local.
  void usedFingerprints;
  const selected = usableAlternatives[0];

  const meal = assertGeneratedMealPolicy(selected.meal, {
    requiredFoods,
    genericFoods,
    allowProteinBelowMinimum: true,
    enforceProteinRange: false,
  });
  return {
    meal,
    fingerprint: selected.fingerprint,
    compositionFingerprint: selected.compositionFingerprint,
    warnings: meal.warnings || [],
    diagnostics: {
      policy: selected.nutritionResult.policy || selected.alternative?.optimization?.policy || MEAL_NUTRITION_POLICY,
      status: selected.alternative?.status,
      classification: selected.nutritionResult.classification,
      recommended: selected.nutritionResult.recommended,
      usable: selected.nutritionResult.usable,
      nutrition: selected.nutritionResult.raw,
      relaxation: selected.alternative?.relaxation || response?.relaxation || null,
      structure: selected.alternative?.structure || "",
      difference: selected.alternative?.difference || null,
      composition: selected.alternative?.composition || generatedMealComposition(meal),
      diversity: selected.alternative?.diversity || response?.meta?.selectedDiversity || null,
      meta: response?.meta || null,
    },
  };
}

function roundGenerationValue(value = 0) {
  return Math.round(number(value) * 10) / 10;
}


export function plannedTargetWithFreeCalories(
  target = {},
  requestedFreeCalories = 0
) {
  const dailyKcal = Math.max(
    0,
    number(target?.kcal)
  );

  const freeCalories = Math.min(
    dailyKcal,
    Math.max(
      0,
      number(requestedFreeCalories)
    )
  );

  const plannedKcal = Math.max(
    0,
    dailyKcal - freeCalories
  );

  /*
   * Por ahora reservamos también una parte
   * proporcional de los macros para las
   * calorías libres.
   *
   * Ej:
   *
   * meta 2132
   * menú 1932
   *
   * factor = 1932 / 2132
   */
  const factor =
    dailyKcal > 0
      ? plannedKcal / dailyKcal
      : 1;

  return {
    freeCalories:
      roundGenerationValue(
        freeCalories
      ),

    plannedTarget: {
      kcal:
        roundGenerationValue(
          plannedKcal
        ),

      proteina:
        roundGenerationValue(
          number(
            target?.proteina ??
            target?.p
          ) * factor
        ),

      carbs:
        roundGenerationValue(
          number(
            target?.carbs ??
            target?.c
          ) * factor
        ),

      grasas:
        roundGenerationValue(
          number(
            target?.grasas ??
            target?.g
          ) * factor
        ),
    },

    factor,
  };
}

// Compatibilidad acotada para el camino legacy de "menú similar". El
// orquestador diario nuevo no usa estas funciones.
function buildPlannerMealWeights({
  plannedTarget = {},
  mealTypes = [],
  distribution = "balanced",
  calorieDistributionMode = "balanced",
  calorieDistributionPercents = {},
  mealTargets = [],
} = {}) {
  const baseSpecs = generatorMealSpecs({ target: plannedTarget, mealTypes, distribution, mealTargets });
  const raw = mealTypes.map((type, index) => (
    calorieDistributionMode === "custom"
      ? number(calorieDistributionPercents?.[type])
      : number(baseSpecs[index]?.target?.kcal)
  ));
  const total = raw.reduce((sum, value) => sum + Math.max(0, value), 0) || mealTypes.length || 1;
  return {
    baseSpecs,
    weights: Object.fromEntries(mealTypes.map((type, index) => [
      type,
      total > 0 ? Math.max(0, raw[index]) / total : 1 / Math.max(1, mealTypes.length),
    ])),
    source: calorieDistributionMode === "custom" ? "custom" : "balanced",
  };
}

function sequentialMealTarget({ remainingTarget = {}, remainingMealTypes = [], currentMealType = "", weights = {} } = {}) {
  const types = Array.isArray(remainingMealTypes) ? remainingMealTypes : [];
  const remaining = normalizeDayNutritionTarget(remainingTarget);
  const totalWeight = types.reduce((sum, type) => sum + Math.max(0, number(weights?.[type])), 0);
  const ratio = types.length <= 1
    ? 1
    : totalWeight > 0
      ? Math.max(0, number(weights?.[currentMealType])) / totalWeight
      : 1 / types.length;
  return Object.fromEntries(Object.entries(remaining).map(([key, value]) => [
    key,
    roundGenerationValue(Math.max(0, value) * ratio),
  ]));
}

function subtractGeneratedFromRemaining(remaining = {}, generated = {}) {
  const left = normalizeDayNutritionTarget(remaining);
  const right = normalizeDayNutritionTarget(generated);
  return Object.fromEntries(Object.keys(left).map((key) => [key, left[key] - right[key]]));
}


async function generateClientMenuPreviewLegacy({
  target,
  mealTypes,
  selectedDays,
  selectedDate = "",

  /*
   * Sistema anterior.
   * Todavía se conserva.
   */
  distribution = "balanced",

  sourceMode = "combined",
  generationMode = "",

  foods = [],
  mealTargets = [],

  useOnlySelectedFoods = false,
  allowRepeats = false,
  assisted = false,
  preferFavorites = false,

  excludedFoods = [],

  allowCalorieTopUp = false,
  firstMealTime = "",

  name = "Mi menu generado",

  generationSettings = {},

  /*
   * ========================================
   * NUEVO PLANIFICADOR
   * ========================================
   */

  calorieDistributionMode = "balanced",

  calorieDistributionPercents = {},

  lockedCalorieMeals = {},

  freeCalories = 0,

  variantSeed = "",

} = {}) {
generationDebug(
  "\n⚙️ ZUMAFIT - AJUSTES RECIBIDOS POR EL GENERADOR",
  {
    target,

    mealTypes,

    distribution,

    calorieDistributionMode,

    calorieDistributionPercents,

    lockedCalorieMeals,

    freeCalories,

    includeFoods:
      (Array.isArray(foods)
        ? foods
        : []
      ).map((food) => ({
        nombre:
          food?.nombre ||
          food?.name ||
          "",

        targetMealType:
          food?.targetMealType ||
          "any",

        mustAppear:
          food?.mustAppear !== false,
      })),

    excludeFoods:
      (
        Array.isArray(excludedFoods)
          ? excludedFoods
          : []
      ).map((food) => ({
        nombre:
          food?.nombre ||
          food?.name ||
          "",

        targetMealType:
          food?.targetMealType ||
          "any",
      })),

    foodPoolMode:
      useOnlySelectedFoods
        ? "only"
        : "combine",

    variantSeed,
  }
);

  validateMenuGenerationPolicy({ generationMode, foods, useOnlySelectedFoods });

const flexiblePlan =
  plannedTargetWithFreeCalories(
    target,
    freeCalories
  );

const plannedTarget =
  flexiblePlan.plannedTarget;

const resolvedFreeCalories =
  flexiblePlan.freeCalories;


generationDebug(
  "🎯 ZUMAFIT - OBJETIVO DEL PLAN",
  {
    dailyTarget: target,

    requestedFreeCalories:
      freeCalories,

    resolvedFreeCalories,

    plannedTarget,

    factor:
      flexiblePlan.factor,
  }
);


  const excludedFoodIds = excludedFoods.map((food) => String(food.id || food._id || food.alimentoId || "")).filter(Boolean);
  const excludedFoodNames = excludedFoods.map((food) => String(food.nombre || food.name || "").trim().toLowerCase()).filter(Boolean);
  const allowedFoods = foods.filter((food) => (
    !excludedFoodIds.includes(String(food.id || food._id || food.alimentoId || ""))
    && !excludedFoodNames.includes(String(food.nombre || food.name || "").trim().toLowerCase())
  ));





  const genericResponse = await listAlimentos({ mode: "GENERIC" });
  const genericFoods = (genericResponse?.alimentos || []).filter(isGenericGenerationFood).filter((food) => {
    const id = String(food.id || food._id || food.alimentoId || "");
    const foodName = String(food.nombre || food.name || "").trim().toLowerCase();
    return !excludedFoodIds.includes(id) && !excludedFoodNames.includes(foodName);
  });
  const genericCatalog = [...allowedFoods, ...genericFoods].reduce((map, food) => {
    const key = String(food.id || food._id || food.alimentoId || food.nombre || food.name || "").trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, food);
    return map;
  }, new Map());
  const catalogFoods = [...genericCatalog.values()];
  const assignments = buildIncludedFoodAssignments(allowedFoods, mealTypes);

 if (generationMode === "similar_menu") {
  const similarPreview =
    await generateFromSimilarMenu({
      /*
       * La biblioteca debe buscar un menú
       * compatible con las kcal PLANIFICADAS,
       * no con la meta completa.
       */
      target: plannedTarget,

      mealTypes,

      selectedDays,

      selectedDate,

      name,

      preferFavorites,

      preferredFoods:
        allowedFoods,

      excludedFoods,

      allowCalorieTopUp,

      genericFoods:
        catalogFoods,

      assignments,
    });


  /*
   * Pero hacia afuera mantenemos la meta
   * diaria completa.
   */
  return {
    ...similarPreview,

    menuTarget:
      target,

    plannedTarget,

    flexibleCalories:
      resolvedFreeCalories,

    generationMeta: {
      ...(
        similarPreview
          ?.generationMeta ||
        {}
      ),

      previewOnly: true,

      source:
        "autonomous",

      freeCalories:
        resolvedFreeCalories,

      dailyTarget:
        target,

      plannedTarget,
    },
  };
}


const plannerDistribution =
  buildPlannerMealWeights({
    plannedTarget,

    mealTypes,

    distribution,

    calorieDistributionMode,

    calorieDistributionPercents,

    mealTargets,
  });


const baseSpecs =
  plannerDistribution.baseSpecs;


const mealWeights =
  plannerDistribution.weights;


const distributionSource =
  plannerDistribution.source;


/*
 * Nos permite recuperar nombre y metadata
 * del spec original por tipo de comida.
 */
const baseSpecByType =
  new Map(
    baseSpecs.map(
      (spec) => [
        String(spec.type),
        spec,
      ]
    )
  );


/*
 * Éste va cambiando después de cada
 * comida generada.
 */
let remainingTarget = {
  ...plannedTarget,
};


generationDebug(
  "📊 ZUMAFIT - DISTRIBUCIÓN DEL PLAN",
  {
    mode:
      calorieDistributionMode,

    source:
      distributionSource,

    percentages:
      Object.fromEntries(
        mealTypes.map(
          (type) => [
            type,
            roundGenerationValue(
              number(
                mealWeights[type]
              ) * 100
            ),
          ]
        )
      ),

    plannedTarget,
  }
);






  const excludedLibraryIds = new Set();
  const meals = [];
  const generatedFingerprints = new Set();
  const usedFoodIdentities = new Set();


for (
  let index = 0;
  index < mealTypes.length;
  index += 1
) {
  const mealType =
    String(mealTypes[index]);

  const remainingMealTypes =
    mealTypes.slice(index);

  const baseSpec =
    baseSpecByType.get(
      mealType
    ) || {
      type:
        mealType,

      name:
        String(
          mealType ||
          `Comida ${index + 1}`
        )
          .replaceAll("_", " "),
    };


  /*
   * ESTE target ya no es fijo.
   *
   * Se calcula usando el restante REAL
   * que dejaron las comidas anteriores.
   */
  const spec = {
    ...baseSpec,

    type:
      mealType,

    target:
      sequentialMealTarget({
        remainingTarget,

        remainingMealTypes,

        currentMealType:
          mealType,

        weights:
          mealWeights,
      }),
  };


  const assignment =
    assignments[spec.type] || {
      required: [],
      preferred: [],
      allowed: [],
    };


  generationDebug(
    "🎯 ZUMAFIT - PREPARANDO SLOT",
    {
      numero:
        index + 1,

      nombre:
        spec.name,

      tipo:
        spec.type,

      porcentajeBase:
        roundGenerationValue(
          number(
            mealWeights[
              spec.type
            ]
          ) * 100
        ),

      remainingBefore:
        remainingTarget,

      target:
        spec.target,
    }
  );

  let generated = null;
     if (!useOnlySelectedFoods && (sourceMode === "library" || sourceMode === "combined")) {
      generated = await generateFromLibrary(spec, allowRepeats ? new Set() : excludedLibraryIds, {
        preferFavorites,
        preferredFoods: assignment.preferred,
        excludedFoodIds,
        excludedFoodNames,
        algorithmTolerance: generationSettings.algorithmTolerance,
        variety: generationSettings.variety,
        usedFoodIdentities,
        requiredFoods: assignment.required,
        genericFoods: catalogFoods,
      });
      if (generated?.sourceId && !allowRepeats) excludedLibraryIds.add(generated.sourceId);
    }
    if (!generated && (sourceMode === "foods" || sourceMode === "combined")) {



/*
 * Los alimentos que el usuario asignó explícitamente
 * a esta comida tienen prioridad sobre mealTypes.
 *
 * Ej:
 * Pan → Desayuno
 *
 * Aunque Pan no tenga breakfast:true,
 * entra porque el usuario lo eligió expresamente.
 */
let mealFoods = [
  ...assignment.allowed,
];

if (!useOnlySelectedFoods) {
  const scopedCatalog = catalogFoods.filter((food) => {
    const selected = allowedFoods.find((entry) =>
      foodMatchesSets(
        food,
        foodIdentitySets([entry])
      )
    );

    return (
      !selected ||
      selected.targetMealType === "any" ||
      !selected.targetMealType ||
      selected.targetMealType === spec.type
    );
  });

  /*
   * Los alimentos automáticos de la BD
   * siguen respetando breakfast/lunch/snack/etc.
   */
  const curated = curateGenerationFoodPool({
    foods: scopedCatalog,
    preferredFoods: [
      ...assignment.required,
      ...assignment.preferred,
    ],
    mealType: spec.type,
    limit: Math.max(
      6,
      assignment.required.length + 4
    ),
  });

  /*
   * Los obligatorios elegidos por el usuario
   * NO vuelven a pasar por foodSupportsMealType.
   */
  const required = [
    ...assignment.required,
  ];

  mealFoods = [
    ...assignment.allowed,
    ...required,
    ...curated,
  ].reduce(
    (items, food) =>
      items.some((entry) =>
        foodMatchesSets(
          entry,
          foodIdentitySets([food])
        )
      )
        ? items
        : [...items, food],
    []
  );
}



      generated = await generateFromFoods(
        spec,
        mealFoods,
        !useOnlySelectedFoods || assisted ? "assisted_food_addition" : "selected_only",
        { requiredFoods: assignment.required, genericFoods: catalogFoods, excludedFoodIds }
      );




    }



if (!generated) {
  const error = new Error(
    useOnlySelectedFoods
      ? `No pudimos construir ${spec.name} usando únicamente los alimentos seleccionados.`
      : `No encontramos una propuesta para ${spec.name}.`
  );

  error.code = useOnlySelectedFoods
    ? "MENU_SELECTED_ONLY_INCOMPATIBLE"
    : "MENU_MEAL_GENERATION_FAILED";

  error.mealType = spec.type;

  throw error;
}

assertGeneratedMealPolicy(
  generated,
  {
    requiredFoods: assignment.required,
    genericFoods: catalogFoods,
  }
);



    const fingerprint = generatedMealFingerprint(generated);
    if (!allowRepeats && fingerprint && generatedFingerprints.has(fingerprint)) {
      const error = new Error(`No encontramos otra propuesta distinta para ${spec.name} sin repetir una comida exacta.`);
      error.code = "MENU_REPEATED_MEAL_UNAVAILABLE";
      error.mealType = spec.type;
      throw error;
    }
    if (fingerprint) generatedFingerprints.add(fingerprint);

    generatedMealFoodIdentities(generated).forEach((identity) => usedFoodIdentities.add(identity));
    /*
 * ========================================
 * RESULTADO REAL DE LA COMIDA
 * ========================================
 */

const actualMealTotals =
  generatedMealNutritionTotals(
    generated
  );


const remainingBefore =
  {
    ...remainingTarget,
  };


remainingTarget =
  subtractGeneratedFromRemaining(
    remainingTarget,
    actualMealTotals
  );


generationDebug(
  "✅ ZUMAFIT - SLOT GENERADO",
  {
    numero:
      index + 1,

    nombre:
      spec.name,

    tipo:
      spec.type,

    porcentajeBase:
      roundGenerationValue(
        number(
          mealWeights[
            spec.type
          ]
        ) * 100
      ),

    target:
      spec.target,

    actual:
      actualMealTotals,

    remainingBefore,

    remainingAfter:
      remainingTarget,
  }
);

const baseHour = /^\d{2}:\d{2}$/.test(firstMealTime) ? Number(firstMealTime.slice(0, 2)) : null;
    const horario = baseHour === null ? "" : `${String((baseHour + index * 3) % 24).padStart(2, "0")}:${firstMealTime.slice(3)}`;
    meals.push({ ...generated, orden: index + 1, ...(horario ? { horario } : {}) });


  }

  const generatedDayTotals =
  meals.reduce(
    (totals, meal) => {
      const mealTotals =
        generatedMealNutritionTotals(
          meal
        );

      totals.kcal +=
        number(
          mealTotals.kcal
        );

      totals.proteina +=
        number(
          mealTotals.proteina
        );

      totals.carbs +=
        number(
          mealTotals.carbs
        );

      totals.grasas +=
        number(
          mealTotals.grasas
        );

      return totals;
    },
    {
      kcal: 0,
      proteina: 0,
      carbs: 0,
      grasas: 0,
    }
  );


const roundedGeneratedDayTotals = {
  kcal:
    roundGenerationValue(
      generatedDayTotals.kcal
    ),

  proteina:
    roundGenerationValue(
      generatedDayTotals.proteina
    ),

  carbs:
    roundGenerationValue(
      generatedDayTotals.carbs
    ),

  grasas:
    roundGenerationValue(
      generatedDayTotals.grasas
    ),
};


const dayDifference = {
  kcal:
    roundGenerationValue(
      plannedTarget.kcal -
      roundedGeneratedDayTotals.kcal
    ),

  proteina:
    roundGenerationValue(
      plannedTarget.proteina -
      roundedGeneratedDayTotals.proteina
    ),

  carbs:
    roundGenerationValue(
      plannedTarget.carbs -
      roundedGeneratedDayTotals.carbs
    ),

  grasas:
    roundGenerationValue(
      plannedTarget.grasas -
      roundedGeneratedDayTotals.grasas
    ),
};


generationDebug(
  "📋 ZUMAFIT - RESULTADO DEL DÍA",
  {
    dailyTarget:
      target,

    freeCalories:
      resolvedFreeCalories,

    plannedTarget,

    distributionMode:
      calorieDistributionMode,

    distributionSource,

    distribution:
      Object.fromEntries(
        mealTypes.map(
          (type) => [
            type,
            roundGenerationValue(
              number(
                mealWeights[type]
              ) * 100
            ),
          ]
        )
      ),

    generatedTotals:
      roundedGeneratedDayTotals,

    difference:
      dayDifference,

    remainingRaw:
      remainingTarget,
  }
);


return {
  nombre:
    String(
      name ||
      "Mi menu generado"
    ).trim() ||
    "Mi menu generado",

  descripcion:
    "Vista previa generada. Revisa y edita antes de guardar.",

  selectedDays:
    selectedDays?.length
      ? selectedDays
      : [
          GENERATOR_DAY_KEYS[0],
        ],

  comidas:
    meals,

  generationMeta: {
    previewOnly: true,

    /*
     * Más adelante nos permitirá distinguir
     * cómo nació este menú aunque una vez
     * confirmado funcione como menú normal.
     */
    source:
      "autonomous",

    sourceMode,

    generationMode,

    useOnlySelectedFoods,

    settings:
      generationSettings,

    policy:
      meals.some(
        (meal) =>
          meal.generationSource ===
          MEAL_NUTRITION_POLICY
      )
        ? MEAL_NUTRITION_POLICY
        : "library_equivalence",

    /*
     * =====================================
     * PLANIFICACIÓN DEL DÍA
     * =====================================
     */

    dailyTarget:
      target,

    plannedTarget,

    freeCalories:
      resolvedFreeCalories,

    variantSeed,
  },

  /*
   * Meta real diaria.
   *
   * Tracking seguirá apuntando acá.
   */
  menuTarget:
    target,

  /*
   * Lo que las comidas automáticas
   * deben intentar cubrir.
   */
  plannedTarget,

  /*
   * Lo que dejamos deliberadamente
   * sin asignar a comidas.
   */
  flexibleCalories:
    resolvedFreeCalories,

  isActiveOwnMenu:
    false,
};



}
