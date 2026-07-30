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
