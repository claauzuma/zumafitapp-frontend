import { buildMenuItemSnapshot } from "../../nutricion/nutricionUtils.js";
import {
  hasTrackingDraftPhysicallyValidQuantity,
  trackingDraftProposals,
  trackingDraftsNutritionTotals,
  trackingDraftsReadyToConfirm,
} from "../../tracking/trackingQuantityDrafts.js";

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function equivalentMealTarget(value = {}) {
  const nested = value?.totals || value?.totales || value?.macros || value;
  return {
    kcal: Math.max(0, number(nested?.kcal ?? nested?.calorias ?? nested?.calories)),
    proteina: Math.max(0, number(nested?.proteina ?? nested?.proteinas ?? nested?.protein ?? nested?.p)),
    carbs: Math.max(0, number(nested?.carbs ?? nested?.carbohidratos ?? nested?.carbohydrates ?? nested?.c)),
    grasas: Math.max(0, number(nested?.grasas ?? nested?.grasa ?? nested?.fat ?? nested?.g)),
  };
}

export function resolveEquivalentMealAccess({ permissions = {}, capabilities = {} } = {}) {
  const replacementsAllowed = permissions.canUseMenuAlternatives !== false;
  const explicitCreate = permissions.canCreateEquivalentMeals;
  const canCreate = explicitCreate === undefined
    ? replacementsAllowed && capabilities.canUseEquivalences === true
    : explicitCreate === true;
  const explicitAuto = permissions.canAutoCreateEquivalentMeals;
  const canAuto = canCreate && (explicitAuto === undefined
    ? capabilities.canAutoCalculateTrackingQuantities === true
    : explicitAuto === true);
  const rawLimit = Number(
    permissions.equivalentMealFoodsLimit ?? capabilities?.limits?.equivalentMealFoods
  );
  return {
    canCreate,
    canAuto,
    canReplaceFoods: canCreate,
    maxFoods: canCreate && Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : canCreate ? 6 : 0,
  };
}

export function equivalentMealComparison(targetValue = {}, proposalValue = {}) {
  const target = equivalentMealTarget(targetValue);
  const proposal = equivalentMealTarget(proposalValue);
  const diff = {
    kcal: proposal.kcal - target.kcal,
    proteina: proposal.proteina - target.proteina,
    carbs: proposal.carbs - target.carbs,
    grasas: proposal.grasas - target.grasas,
  };
  const kcalTolerance = Math.max(2, target.kcal * 0.01);
  const proteinTolerance = Math.max(2, target.proteina * 0.08);
  return {
    target,
    proposal,
    diff,
    kcalTolerance,
    exceedsCalories: diff.kcal > kcalTolerance,
    caloriesClose: Math.abs(diff.kcal) <= kcalTolerance,
    proteinReached: target.proteina <= 0 || diff.proteina >= -proteinTolerance,
  };
}

function differenceText(label, difference, unit = "g") {
  const value = Math.abs(number(difference));
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
  return `${label ? `${label}: ` : ""}${difference < 0 ? "faltan" : "sobran"} ${formatted} ${unit}`;
}

/**
 * Decide si una alternativa necesita una confirmacion nutricional visible.
 * Es solamente una regla de presentacion: no cambia el ranking ni el solver.
 */
export function equivalentMealDecisionWarning({
  target: targetValue = {},
  proposal: proposalValue = {},
  optimization = null,
} = {}) {
  const target = equivalentMealTarget(targetValue);
  const proposal = equivalentMealTarget(proposalValue);
  if (!(target.kcal > 0) || !(proposal.kcal > 0)) return null;

  const difference = {
    kcal: proposal.kcal - target.kcal,
    proteina: proposal.proteina - target.proteina,
    carbs: proposal.carbs - target.carbs,
    grasas: proposal.grasas - target.grasas,
  };
  const calorieTolerance = Math.max(1, number(optimization?.calorieTolerance));
  const calorieDeficit = Math.max(0, -difference.kcal);
  const proteinConfigured = target.proteina > 0;
  const proteinDeficit = proteinConfigured ? Math.max(0, -difference.proteina) : 0;
  const proteinExcess = proteinConfigured ? Math.max(0, difference.proteina) : 0;
  const carbThreshold = target.carbs > 0 ? Math.max(12, target.carbs * 0.15) : Infinity;
  const fatThreshold = target.grasas > 0 ? Math.max(5, target.grasas * 0.2) : Infinity;
  const carbFar = Math.abs(difference.carbs) > carbThreshold;
  const fatFar = Math.abs(difference.grasas) > fatThreshold;
  const macroDistributionFar = proteinExcess >= 6 - 1e-6 && (carbFar || fatFar);
  const reasons = [];
  const codes = [];

  if (calorieDeficit > calorieTolerance + 1e-6) {
    codes.push("calorie_target_not_reached");
    reasons.push(`${differenceText("Calorías", -calorieDeficit, "kcal")} para completar la meta.`);
  }
  if (proteinDeficit >= 3 - 1e-6) {
    codes.push("protein_target_not_reached");
    reasons.push(`${differenceText("Proteína", -proteinDeficit)} respecto de la meta.`);
  }
  if (macroDistributionFar) {
    codes.push("macro_distribution_far_with_protein_excess");
    const secondary = [
      carbFar ? differenceText("Carbohidratos", difference.carbs) : "",
      fatFar ? differenceText("Grasas", difference.grasas) : "",
    ].filter(Boolean).join(" · ");
    reasons.push(
      `La proteína supera la meta por ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(proteinExcess)} g y el reparto de macros queda alejado (${secondary}).`
    );
  }
  if (!reasons.length) return null;

  const summary = codes.includes("calorie_target_not_reached")
    ? "No completa la meta calórica"
    : codes.includes("protein_target_not_reached")
      ? "No completa la meta de proteína"
      : "El reparto de macros queda desbalanceado";
  return {
    title: "Revisá esta alternativa",
    summary,
    reasons,
    codes,
    target,
    proposal,
    difference,
  };
}

export function generatedAlternativeToDrafts(alternative = {}, createDraft, maxFoods = 6, optionIndex = 0) {
  if (typeof createDraft !== "function") return [];
  return (Array.isArray(alternative?.foods) ? alternative.foods : [])
    .slice(0, Math.max(1, Number(maxFoods) || 6))
    .map((food, index) => createDraft(food, index, optionIndex))
    .filter(Boolean);
}

export function nextGeneratedAlternativeIndex(currentIndex, alternatives = []) {
  const length = Array.isArray(alternatives) ? alternatives.length : 0;
  if (!length) return -1;
  const parsed = Number(currentIndex);
  const normalized = Number.isInteger(parsed) ? parsed : -1;
  return (Math.max(-1, normalized) + 1) % length;
}

export function buildEquivalentMealRecalculationRequest({
  menuId = "",
  mealId = "",
  mealType = "otra",
  target = {},
  drafts = [],
  fixedFoods = [],
  variantSeed = 1,
} = {}) {
  const entries = Array.isArray(drafts) ? drafts : [];
  return {
    menuId: String(menuId || ""),
    mealId: String(mealId || ""),
    mealType,
    target: equivalentMealTarget(target),
    selectedFoodIds: entries.map((draft) => String(draft?.foodId || "")).filter(Boolean),
    fixedFoods: Array.isArray(fixedFoods) ? fixedFoods : [],
    currentFoods: entries.map((draft) => ({
      foodId: String(draft?.foodId || ""),
      quantity: Number(draft?.quantity) > 0 ? Number(draft.quantity) : null,
    })).filter((entry) => entry.foodId),
    generateVariant: true,
    variantSeed,
  };
}

export function equivalentMealGenerationFeedback(response = {}) {
  const level = String(response?.relaxation?.level || response?.alternative?.relaxation?.level || "");
  const usable = response?.status === "SUCCESS" &&
    response?.recommended === true &&
    Array.isArray(response?.alternative?.foods) &&
    response.alternative.foods.length > 0;
  if (!usable) {
    return {
      usable: false,
      level: level || null,
      notice: "",
      error: response?.code === "MEAL_TARGET_NOT_REACHABLE_WITH_PORTION_RULES"
        ? "No se puede alcanzar esta meta. Con estos alimentos y porciones no pudimos obtener una alternativa suficientemente cercana a tu objetivo nutricional. Probá modificando los ajustes, quitando un alimento obligatorio o permitiendo otras sugerencias."
        : "No encontramos una combinación compatible con esta meta y estos ajustes.",
    };
  }
  const notice = level === "RELAX_STEP"
    ? "Porciones ajustadas ligeramente para mejorar la precisión nutricional."
    : level === "RELAX_MIN"
      ? "Algunas porciones mínimas fueron flexibilizadas ligeramente para acercarse mejor a tu objetivo."
      : "";
  return { usable: true, level: level || "STRICT", notice, error: "" };
}

function normalizedFilterTerms(value = "") {
  return String(value || "")
    .split(",")
    .map((term) => term.trim().toLocaleLowerCase("es"))
    .filter(Boolean);
}

function libraryMealFoodNames(meal = {}) {
  const items = Array.isArray(meal.items)
    ? meal.items
    : Array.isArray(meal.alimentos)
      ? meal.alimentos
      : [];
  return items.map((item) => String(
    item?.nombreSnapshot || item?.nombre || item?.name || item?.alimento?.nombre || ""
  ).toLocaleLowerCase("es"));
}

export function filterEquivalentLibraryMeals(meals = [], { include = "", exclude = "" } = {}) {
  const includeTerms = normalizedFilterTerms(include);
  const excludeTerms = normalizedFilterTerms(exclude);
  return (Array.isArray(meals) ? meals : []).filter((meal) => {
    const foodNames = libraryMealFoodNames(meal);
    const includesRequired = !includeTerms.length || includeTerms.every((term) =>
      foodNames.some((name) => name.includes(term))
    );
    const includesExcluded = excludeTerms.some((term) =>
      foodNames.some((name) => name.includes(term))
    );
    return includesRequired && !includesExcluded;
  });
}

export function equivalentLibrarySourceLabel(meal = {}) {
  const ownerType = String(meal.ownerType || "").toLocaleLowerCase("es");
  const sourceType = String(meal.sourceType || "").toLocaleLowerCase("es");
  if (meal.assigned || sourceType === "assigned_snapshot") return "Alternativa del coach";
  if (ownerType === "cliente" || ownerType === "client" || sourceType === "client_owned") return "Mi comida";
  if (ownerType === "coach" || sourceType === "coach_owned") return "Biblioteca del coach";
  if (ownerType === "admin" || sourceType.startsWith("admin_")) return "Biblioteca ZumaFit";
  return "Biblioteca";
}

export function equivalentMealDraftStorageKey(owner = "", date = "", mealId = "", menuId = "", creationType = "full_meal") {
  const safe = (value) => encodeURIComponent(String(value || "").slice(0, 120));
  if (!owner) return "";
  return `zumafit:menu-equivalent:v2:${safe(owner)}:${safe(menuId || "menu")}:${safe(date)}:${safe(mealId)}:${safe(creationType)}`;
}

export function createEquivalentDraftRequestId(owner = "", date = "", mealId = "") {
  const random = globalThis?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `equivalent-draft-${String(owner || "user").slice(0, 40)}-${String(date || "day")}-${String(mealId || "meal").slice(0, 40)}-${random}`.slice(0, 120);
}

export function buildEquivalentMealFromDrafts({
  drafts = [],
  originalMealName = "Comida",
  originalMealId = "meal",
  date = "",
  menuId = "",
  menuVersion = "",
  mealType = "otro",
  strategy = "selected_only",
  requestId = "",
  warnings = [],
  favoriteOriginId = "",
  target = null,
} = {}) {
  if (!trackingDraftsReadyToConfirm(drafts)) return null;
  const proposals = trackingDraftProposals(drafts, []);
  if (proposals.length !== drafts.length) return null;
  const items = proposals.map((proposal, index) => {
    const quantity = Number(proposal.quantity);
    if (!(quantity > 0) || !hasTrackingDraftPhysicallyValidQuantity(drafts[index])) return null;
    const snapshot = buildMenuItemSnapshot(
      proposal.food || proposal.generated || {},
      quantity,
      proposal.unit || "g"
    );
    return {
      ...snapshot,
      id: snapshot.id || snapshot.alimentoId || `equivalent-food-${index + 1}`,
      name: snapshot.nombreSnapshot || snapshot.nombre || drafts[index]?.name || `Alimento ${index + 1}`,
      nombre: snapshot.nombreSnapshot || snapshot.nombre || drafts[index]?.name || `Alimento ${index + 1}`,
      quantity,
      cantidad: quantity,
      unit: snapshot.unidad || proposal.unit || "g",
      totals: equivalentMealTarget(snapshot),
      source: drafts[index]?.suggested ? "addedCandidate" : "selected",
      quantityMode: drafts[index]?.suggested
        ? "suggested"
        : drafts[index]?.mode === "automatic" ? "calculated" : "manual",
      suggested: drafts[index]?.suggested === true,
    };
  }).filter(Boolean);
  if (items.length !== drafts.length) return null;
  const totals = equivalentMealTarget(trackingDraftsNutritionTotals(drafts));
  const referenceTarget = equivalentMealTarget(target || {});
  return {
    id: `custom-equivalent-${String(originalMealId || "meal")}-${String(date || "day")}`.slice(0, 100),
    name: `Mi alternativa de ${originalMealName}`,
    nombre: `Mi alternativa de ${originalMealName}`,
    source: "client_equivalent_meal",
    replacementMode: "custom_equivalent",
    creationType: "full_meal_equivalent",
    strategy: strategy === "assisted_food_addition" ? strategy : "selected_only",
    requestId,
    menuId,
    menuVersion,
    originalMealId: String(originalMealId || "meal"),
    originalMealName,
    mealType,
    date,
    warnings: Array.isArray(warnings) ? warnings : [],
    favoriteOriginId: favoriteOriginId || null,
    foods: items,
    items,
    totals,
    totales: totals,
    equivalenceReference: {
      origin: "client_equivalent_meal",
      menuId,
      menuVersion,
      originalMealId: String(originalMealId || "meal"),
      originalMealName,
      mealType,
      sourceDate: date,
      target: referenceTarget,
      strategy: strategy === "assisted_food_addition" ? strategy : "selected_only",
      templateVersion: 1,
    },
  };
}
