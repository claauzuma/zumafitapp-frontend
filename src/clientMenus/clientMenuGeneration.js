import { buildMenuItemSnapshot } from "../nutricion/nutricionUtils.js";
import { listAlimentos } from "../nutricion/nutricionApi.js";
import { calculateTrackingQuantities } from "../tracking/trackingApi.js";
import {
  buildTrackingQuantityCalculationRequest,
  createTrackingFoodDraft,
  trackingDraftCalculationPayload,
  trackingDraftProposals,
  TRACKING_QUANTITY_MODE_CALORIE_FILL,
} from "../tracking/trackingQuantityDrafts.js";
import { listLibraryMeals, listLibraryMenus } from "../nutritionLibrary/nutritionLibraryApi.js";
import { automaticMenuMatchMessage, buildCalorieTopUpMeal } from "./clientMenuAutomaticMatch.js";
import { GENERATOR_DAY_KEYS, generatorMealSpecs, generationNumber as number } from "./clientMenuGenerationCore.js";
import {
  buildIncludedFoodAssignments,
  exactMealTypesMatch,
  curateGenerationFoodPool,
  foodSupportsMealType,
  generatedMealNutritionTotals,
  generatedMealFingerprint,
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
export { generatedMealFingerprint, libraryMealScore } from "./clientMenuGenerationPolicy.js";
export { automaticMenuMatchMessage } from "./clientMenuAutomaticMatch.js";

function itemId(prefix, index) {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
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

function assertGeneratedMealPolicy(meal = {}, { requiredFoods = [], genericFoods = [] } = {}) {
  if (!completeMealItems(meal)) {
    const error = new Error("La propuesta contiene alimentos sin una cantidad utilizable.");
    error.code = "MENU_INVALID_GENERATED_QUANTITY";
    throw error;
  }
  if (!mealProteinWithinGenerationRange(meal)) {
    const protein = generatedMealNutritionTotals(meal).proteina;
    const error = new Error(`La comida generada quedo en ${Math.round(protein * 10) / 10} g de proteina; debe quedar entre 15 g y 65 g.`);
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
    suggested: food.source === "addedCandidate",
  };
}

async function generateFromFoods(spec, foods = [], strategy = "selected_only", {
  requiredFoods = [],
  genericFoods = [],
  excludedFoodIds = [],
} = {}) {
  if (!foods.length) return null;
  const drafts = foods.map((food, index) => createTrackingFoodDraft(
    food,
    "",
    `menu-generator-${index}`,
    TRACKING_QUANTITY_MODE_CALORIE_FILL
  ));
  const input = trackingDraftCalculationPayload(drafts);
  const request = buildTrackingQuantityCalculationRequest({
    date: new Date().toISOString().slice(0, 10),
    target: spec.target,
    trackingQuantityMode: TRACKING_QUANTITY_MODE_CALORIE_FILL,
    fixedFoods: input.fixedFoods,
    pendingFoods: input.pendingFoods,
    generationStrategy: strategy,
    rejectedSuggestionFoodIds: excludedFoodIds,
  });
  const response = await calculateTrackingQuantities({
    ...request,
    menuGenerationPolicy: "generic_menu_v1",
    generationMealType: generationMealTypeForMenuType(spec.type),
  });
  if (response?.optimization?.policy !== "tracking_calorie_fill_v1") {
    throw new Error("El servidor no confirmo la policy segura de Tracking.");
  }
  const proposals = trackingDraftProposals(drafts, response?.foods || []);
  if (!proposals.length) throw new Error(response?.message || "No se encontro una propuesta valida.");
  const proposalItems = proposals.map((proposal, index) => ({
    ...buildMenuItemSnapshot(proposal.food, proposal.quantity, proposal.unit),
    id: itemId("generated-food", index),
  }));
  const selected = foodIdentitySets(foods);
  const addedItems = strategy === "selected_only"
    ? []
    : (response?.foods || [])
        .filter((food) => food?.source === "addedCandidate" && !foodMatchesSets(food, selected))
        .map((food, index) => generatedResponseFoodItem(food, proposalItems.length + index));
  const meal = {
    id: itemId("generated-meal", 0),
    nombre: spec.name,
    tipoComida: spec.type,
    target: spec.target,
    generationSource: "tracking_calorie_fill_v1",
    warnings: Array.isArray(response?.warnings) ? response.warnings : [],
    items: [...proposalItems, ...addedItems],
  };
  return assertGeneratedMealPolicy(meal, { requiredFoods, genericFoods });
}

export async function generateClientMenuPreview({
  target,
  mealTypes,
  selectedDays,
  selectedDate = "",
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
} = {}) {
  validateMenuGenerationPolicy({ generationMode, foods, useOnlySelectedFoods });
  const excludedFoodIds = excludedFoods.map((food) => String(food.id || food._id || food.alimentoId || "")).filter(Boolean);
  const excludedFoodNames = excludedFoods.map((food) => String(food.nombre || food.name || "").trim().toLowerCase()).filter(Boolean);
  const allowedFoods = foods.filter((food) => (
    !excludedFoodIds.includes(String(food.id || food._id || food.alimentoId || ""))
    && !excludedFoodNames.includes(String(food.nombre || food.name || "").trim().toLowerCase())
  ));
  const invalidSelected = allowedFoods.filter((food) => !isGenericGenerationFood(food));
  if (invalidSelected.length) {
    const error = new Error(`El alimento ${invalidSelected[0].nombre || invalidSelected[0].name || "seleccionado"} no esta habilitado como GENERIC.`);
    error.code = "MENU_NON_GENERIC_FOOD";
    throw error;
  }
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
    return await generateFromSimilarMenu({ target, mealTypes, selectedDays, selectedDate, name, preferFavorites, preferredFoods: allowedFoods, excludedFoods, allowCalorieTopUp, genericFoods: catalogFoods, assignments });
  }
  const specs = generatorMealSpecs({ target, mealTypes, distribution, mealTargets });
  const excludedLibraryIds = new Set();
  const meals = [];
  const generatedFingerprints = new Set();
  const usedFoodIdentities = new Set();
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const assignment = assignments[spec.type] || { required: [], preferred: [], allowed: [] };
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
      let mealFoods = assignment.allowed.filter((food) => foodSupportsMealType(food, spec.type));
      if (!useOnlySelectedFoods) {
        const scopedCatalog = catalogFoods.filter((food) => {
          const selected = allowedFoods.find((entry) => foodMatchesSets(food, foodIdentitySets([entry])));
          return !selected || selected.targetMealType === "any" || !selected.targetMealType || selected.targetMealType === spec.type;
        });
        const curated = curateGenerationFoodPool({
          foods: scopedCatalog,
          preferredFoods: [...assignment.required, ...assignment.preferred],
          mealType: spec.type,
          limit: Math.max(6, assignment.required.length + 4),
        });
        const required = [...assignment.required].filter((food) => foodSupportsMealType(food, spec.type));
        mealFoods = [...required, ...curated].reduce((items, food) => (
          items.some((entry) => foodMatchesSets(entry, foodIdentitySets([food]))) ? items : [...items, food]
        ), []);
      }
      generated = await generateFromFoods(
        spec,
        mealFoods,
        !useOnlySelectedFoods || assisted ? "assisted_food_addition" : "selected_only",
        { requiredFoods: assignment.required, genericFoods: catalogFoods, excludedFoodIds }
      );
    }
    assertGeneratedMealPolicy(generated, { requiredFoods: assignment.required, genericFoods: catalogFoods });
    if (!generated) {
      const error = new Error(useOnlySelectedFoods
        ? `No pudimos construir ${spec.name} usando únicamente los alimentos seleccionados.`
        : `No encontramos una propuesta para ${spec.name}.`);
      error.code = useOnlySelectedFoods ? "MENU_SELECTED_ONLY_INCOMPATIBLE" : "MENU_MEAL_GENERATION_FAILED";
      error.mealType = spec.type;
      throw error;
    }
    const fingerprint = generatedMealFingerprint(generated);
    if (!allowRepeats && fingerprint && generatedFingerprints.has(fingerprint)) {
      const error = new Error(`No encontramos otra propuesta distinta para ${spec.name} sin repetir una comida exacta.`);
      error.code = "MENU_REPEATED_MEAL_UNAVAILABLE";
      error.mealType = spec.type;
      throw error;
    }
    if (fingerprint) generatedFingerprints.add(fingerprint);
    generatedMealFoodIdentities(generated).forEach((identity) => usedFoodIdentities.add(identity));
    const baseHour = /^\d{2}:\d{2}$/.test(firstMealTime) ? Number(firstMealTime.slice(0, 2)) : null;
    const horario = baseHour === null ? "" : `${String((baseHour + index * 3) % 24).padStart(2, "0")}:${firstMealTime.slice(3)}`;
    meals.push({ ...generated, orden: index + 1, ...(horario ? { horario } : {}) });
  }
  return {
    nombre: String(name || "Mi menu generado").trim() || "Mi menu generado",
    descripcion: "Vista previa generada. Revisa y edita antes de guardar.",
    selectedDays: selectedDays?.length ? selectedDays : [GENERATOR_DAY_KEYS[0]],
    comidas: meals,
    generationMeta: {
      previewOnly: true,
      sourceMode,
      generationMode,
      useOnlySelectedFoods,
      settings: generationSettings,
      policy: meals.some((meal) => meal.generationSource === "tracking_calorie_fill_v1")
        ? "tracking_calorie_fill_v1"
        : "library_equivalence",
    },
    menuTarget: target,
    isActiveOwnMenu: false,
  };
}
