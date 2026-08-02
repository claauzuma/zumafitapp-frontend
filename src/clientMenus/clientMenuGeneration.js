import { buildMenuItemSnapshot } from "../nutricion/nutricionUtils.js";
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
import { GENERATOR_DAY_KEYS, distributeGeneratorTarget, generationNumber as number } from "./clientMenuGenerationCore.js";
export { GENERATOR_DAY_KEYS, GENERATOR_MEAL_TYPES, distributeGeneratorTarget, nutritionTargetForMenuGeneration } from "./clientMenuGenerationCore.js";
export { automaticMenuMatchMessage } from "./clientMenuAutomaticMatch.js";

function itemId(prefix, index) {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function mealItems(meal = {}) {
  const values = Array.isArray(meal.items) ? meal.items : Array.isArray(meal.alimentos) ? meal.alimentos : [];
  return values.map((item, index) => ({
    ...item,
    id: item.id || itemId("library-food", index),
    proteina: number(item.proteina ?? item.proteinas),
    carbs: number(item.carbs ?? item.carbohidratos),
    grasas: number(item.grasas ?? item.fat),
  }));
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

async function generateFromSimilarMenu({ target, mealTypes = [], selectedDays, selectedDate, name, preferFavorites = false, excludedFoods = [], allowCalorieTopUp = false }) {
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
  const candidateAllowed = (menu) => menuMeals(menu).every((meal) => mealItems(meal).every((item) => {
    const id = String(item.alimentoId || item.foodId || item.id || "");
    const foodName = String(item.nombreSnapshot || item.nombre || "").trim().toLowerCase();
    return !excludedIds.has(id) && !excludedNames.has(foodName);
  }));
  const resolution = response?.automaticResolution || {};
  const candidate = (response?.menus || []).find(candidateAllowed)
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

function libraryMealScore(meal = {}, target = {}) {
  const totals = meal.totales || meal.macrosTotales || {};
  const kcal = number(totals.kcal ?? meal.kcal);
  const protein = number(totals.proteina ?? totals.protein);
  const carbs = number(totals.carbs ?? totals.carbohidratos);
  const fat = number(totals.grasas ?? totals.fat);
  return Math.abs(number(target.kcal) - kcal) * 4
    + Math.abs(number(target.proteina) - protein) * 2
    + Math.abs(number(target.carbs) - carbs)
    + Math.abs(number(target.grasas) - fat);
}

async function generateFromLibrary(spec, excludedIds = new Set(), { preferFavorites = false, excludedFoodIds = [], excludedFoodNames = [] } = {}) {
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
  const usableMeals = (response) => (Array.isArray(response?.comidas) ? response.comidas : []).filter((meal) => mealItems(meal).every((item) => {
    const id = String(item.alimentoId || item.foodId || item.id || "");
    const name = String(item.nombreSnapshot || item.nombre || "").trim().toLowerCase();
    return !blockedIds.has(id) && !blockedNames.has(name);
  }));
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
    libraryMealScore(left, spec.target) - libraryMealScore(right, spec.target)
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

async function generateFromFoods(spec, foods = [], strategy = "selected_only") {
  if (!foods.length) return null;
  const drafts = foods.map((food, index) => createTrackingFoodDraft(
    food,
    "",
    `menu-generator-${index}`,
    TRACKING_QUANTITY_MODE_CALORIE_FILL
  ));
  const input = trackingDraftCalculationPayload(drafts);
  const response = await calculateTrackingQuantities(buildTrackingQuantityCalculationRequest({
    date: new Date().toISOString().slice(0, 10),
    target: spec.target,
    trackingQuantityMode: TRACKING_QUANTITY_MODE_CALORIE_FILL,
    fixedFoods: input.fixedFoods,
    pendingFoods: input.pendingFoods,
    generationStrategy: strategy,
  }));
  if (response?.optimization?.policy !== "tracking_calorie_fill_v1") {
    throw new Error("El servidor no confirmo la policy segura de Tracking.");
  }
  const proposals = trackingDraftProposals(drafts, response?.foods || []);
  if (!proposals.length) throw new Error(response?.message || "No se encontro una propuesta valida.");
  return {
    id: itemId("generated-meal", 0),
    nombre: spec.name,
    tipoComida: spec.type,
    target: spec.target,
    generationSource: "tracking_calorie_fill_v1",
    warnings: Array.isArray(response?.warnings) ? response.warnings : [],
    items: proposals.map((proposal, index) => ({
      ...buildMenuItemSnapshot(proposal.food, proposal.quantity, proposal.unit),
      id: itemId("generated-food", index),
    })),
  };
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
  allowRepeats = false,
  assisted = false,
  preferFavorites = false,
  excludedFoods = [],
  allowCalorieTopUp = false,
  firstMealTime = "",
  name = "Mi menu generado",
} = {}) {
  if (generationMode === "similar_menu") {
    return await generateFromSimilarMenu({ target, mealTypes, selectedDays, selectedDate, name, preferFavorites, excludedFoods, allowCalorieTopUp });
  }
  const specs = distributeGeneratorTarget(target, mealTypes, distribution);
  const excludedLibraryIds = new Set();
  const excludedFoodIds = excludedFoods.map((food) => String(food.id || food._id || food.alimentoId || "")).filter(Boolean);
  const excludedFoodNames = excludedFoods.map((food) => String(food.nombre || food.name || "")).filter(Boolean);
  const allowedFoods = foods.filter((food) => !excludedFoodIds.includes(String(food.id || food._id || food.alimentoId || "")));
  const meals = [];
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    let generated = null;
    if (sourceMode === "library" || sourceMode === "combined") {
      generated = await generateFromLibrary(spec, allowRepeats ? new Set() : excludedLibraryIds, { preferFavorites, excludedFoodIds, excludedFoodNames });
      if (generated?.sourceId && !allowRepeats) excludedLibraryIds.add(generated.sourceId);
    }
    if (!generated && (sourceMode === "foods" || sourceMode === "combined")) {
      generated = await generateFromFoods(spec, allowedFoods, assisted ? "assisted_food_addition" : "selected_only");
    }
    if (!generated) throw new Error(`No encontramos una propuesta para ${spec.name}.`);
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
      policy: meals.some((meal) => meal.generationSource === "tracking_calorie_fill_v1")
        ? "tracking_calorie_fill_v1"
        : "library_equivalence",
    },
    isActiveOwnMenu: false,
  };
}
