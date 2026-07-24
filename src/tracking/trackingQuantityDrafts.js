import { buildMenuItemSnapshot } from "../nutricion/nutricionUtils.js";
import { addNutritionTotals, nutritionTotals } from "./manualDayCompletion.js";

function draftQuantity(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function draftQuantityValue(value) {
  const normalized = draftQuantity(value);
  if (normalized === null) return "";
  return typeof value === "string" ? value.trim() : normalized;
}

function foodId(food = {}) {
  return String(food.id || food._id || food.alimentoId || food.nombre || food.name || "");
}

function foodName(food = {}) {
  return String(food.nombre || food.name || food.Alimentos || "Alimento");
}

function foodUnit(food = {}) {
  return String(food.unidad || food.unit || "g");
}

function draftSnapshot(draft = {}) {
  const quantity = draftQuantity(draft.quantity);
  if (!quantity) return null;
  return buildMenuItemSnapshot(draft.food || {}, quantity, draft.unit || foodUnit(draft.food));
}

function trackingDraftMode(draft = {}) {
  if (draft.mode === "automatic" || draft.quantityMode === "automatic") return "automatic";
  if (draft.mode === "manual" || draft.quantityMode === "manual") return "manual";
  return hasTrackingDraftQuantity(draft) ? "manual" : "automatic";
}

function generatedFoodId(food = {}) {
  return String(food.foodId || food.id || food._id || food.alimentoId || "");
}

function generatedFoodName(food = {}) {
  return String(food.nombre || food.name || "").trim().toLowerCase();
}

function fixedGeneratedFood(draft = {}) {
  const snapshot = draftSnapshot(draft) || {};
  const quantity = draftQuantity(draft.quantity) || 0;
  return {
    foodId: draft.foodId,
    name: draft.name,
    nombre: draft.name,
    quantity,
    cantidad: quantity,
    unit: draft.unit,
    unidad: draft.unit,
    source: "fixed",
    fixedQuantity: true,
    kcal: Number(snapshot.kcal) || 0,
    proteina: Number(snapshot.proteina) || 0,
    protein: Number(snapshot.proteina) || 0,
    carbs: Number(snapshot.carbs) || 0,
    grasas: Number(snapshot.grasas) || 0,
    fat: Number(snapshot.grasas) || 0,
  };
}

export function createTrackingFoodDraft(food = {}, quantity = "", draftId = "") {
  const normalizedQuantity = draftQuantityValue(quantity);
  const mode = normalizedQuantity ? "manual" : "automatic";
  return {
    id: String(draftId || `${foodId(food)}-${Date.now()}`),
    foodId: foodId(food),
    name: foodName(food),
    unit: foodUnit(food),
    food,
    quantity: normalizedQuantity,
    mode,
    status: normalizedQuantity ? "manual" : "pending",
  };
}

export function updateTrackingFoodDraftQuantity(draft = {}, quantity = "") {
  const normalizedQuantity = draftQuantityValue(quantity);
  return {
    ...draft,
    quantity: normalizedQuantity,
    mode: normalizedQuantity ? "manual" : "automatic",
    status: normalizedQuantity ? "manual" : "pending",
  };
}

export function hasTrackingDraftQuantity(draft = {}) {
  return draftQuantity(draft.quantity) !== null;
}

export function isTrackingDraftAutomatic(draft = {}) {
  return trackingDraftMode(draft) === "automatic";
}

export function isTrackingDraftCalculated(draft = {}) {
  return isTrackingDraftAutomatic(draft) &&
    draft.status === "calculated" &&
    hasTrackingDraftQuantity(draft);
}

export function markTrackingDraftAutomatic(draft = {}) {
  return {
    ...draft,
    mode: "automatic",
    status: "pending",
  };
}

export function markTrackingDraftManual(draft = {}) {
  if (!hasTrackingDraftQuantity(draft)) return draft;
  return {
    ...draft,
    mode: "manual",
    status: "manual",
  };
}

export function trackingDraftNutritionTotals(draft = {}) {
  return nutritionTotals(draftSnapshot(draft) || {});
}

export function trackingDraftsNutritionTotals(drafts = []) {
  return (Array.isArray(drafts) ? drafts : []).reduce(
    (totals, draft) => addNutritionTotals(totals, trackingDraftNutritionTotals(draft)),
    nutritionTotals()
  );
}

export function trackingDraftCalculationPayload(drafts = []) {
  const entries = Array.isArray(drafts) ? drafts : [];
  const fixedDrafts = entries.filter((draft) => (
    !isTrackingDraftAutomatic(draft) && hasTrackingDraftQuantity(draft)
  ));
  const pendingDrafts = entries.filter(isTrackingDraftAutomatic);
  const fixedFoods = fixedDrafts.map((draft) => {
    const generated = fixedGeneratedFood(draft);
    return {
      foodId: draft.foodId,
      name: draft.name,
      unit: draft.unit,
      quantity: generated.quantity,
      kcal: generated.kcal,
      protein: generated.proteina,
      proteina: generated.proteina,
      carbs: generated.carbs,
      fat: generated.grasas,
      grasas: generated.grasas,
      categoria: draft.food?.categoria || draft.food?.fuente || draft.food?.source || "",
      source: "fixed",
    };
  });
  const pendingFoods = pendingDrafts.map((draft) => {
    const unit = draft.unit || "g";
    const gramBased = ["g", "gr", "gramo", "gramos", "ml"].includes(unit.toLowerCase());
    const baseQuantity = gramBased ? 100 : 1;
    const snapshot = buildMenuItemSnapshot(draft.food || {}, baseQuantity, unit);
    return {
      foodId: draft.foodId,
      name: draft.name,
      unit,
      source: "pending",
      currentQuantity: hasTrackingDraftQuantity(draft) ? Number(draft.quantity) : null,
      kcalPerUnitOrGram: (Number(snapshot.kcal) || 0) / baseQuantity,
      proteinPerUnitOrGram: (Number(snapshot.proteina) || 0) / baseQuantity,
      carbsPerUnitOrGram: (Number(snapshot.carbs) || 0) / baseQuantity,
      fatPerUnitOrGram: (Number(snapshot.grasas) || 0) / baseQuantity,
      categoria: draft.food?.categoria || draft.food?.fuente || draft.food?.source || "",
      minGramos: Number(draft.food?.porcionMin ?? draft.food?.minGramos) || undefined,
      maxGramos: Number(draft.food?.porcionMax ?? draft.food?.maxGramos) || undefined,
      stepGramos: Number(draft.food?.multiplo ?? draft.food?.stepGramos) || undefined,
    };
  });

  return {
    fixedFoods,
    pendingFoods,
    fixedTotals: trackingDraftsNutritionTotals(fixedDrafts),
  };
}

export function trackingDraftsReadyToConfirm(drafts = []) {
  const entries = Array.isArray(drafts) ? drafts : [];
  return entries.length > 0 && entries.every((draft) => (
    hasTrackingDraftQuantity(draft) &&
    (!isTrackingDraftAutomatic(draft) || isTrackingDraftCalculated(draft))
  ));
}

export function trackingDraftProposals(drafts = [], generatedFoods = []) {
  const available = Array.isArray(generatedFoods) ? [...generatedFoods] : [];
  return (Array.isArray(drafts) ? drafts : []).map((draft) => {
    const matchIndex = available.findIndex((generated) => {
      const generatedId = generatedFoodId(generated);
      if (generatedId && draft.foodId && generatedId === draft.foodId) return true;
      return generatedFoodName(generated) === draft.name.trim().toLowerCase();
    });
    const generated = matchIndex >= 0
      ? available.splice(matchIndex, 1)[0]
      : hasTrackingDraftQuantity(draft) && (
        !isTrackingDraftAutomatic(draft) || isTrackingDraftCalculated(draft)
      )
        ? fixedGeneratedFood(draft)
        : null;
    if (!generated) return null;
    const quantity = Number(generated.quantity ?? generated.cantidad) || 0;
    if (!(quantity > 0)) return null;
    return {
      food: draft.food,
      generated,
      quantity,
      initialQuantity: quantity,
      unit: draft.unit || generated.unit || generated.unidad || "g",
      fixed: !isTrackingDraftAutomatic(draft),
    };
  }).filter(Boolean);
}

export function applyTrackingDraftProposals(drafts = [], proposals = []) {
  const available = Array.isArray(proposals) ? [...proposals] : [];
  return (Array.isArray(drafts) ? drafts : []).map((draft) => {
    if (!isTrackingDraftAutomatic(draft)) return draft;
    const matchIndex = available.findIndex((proposal) => {
      const proposalFood = proposal.food || proposal.generated || {};
      const proposalId = foodId(proposalFood);
      if (proposalId && draft.foodId && proposalId === draft.foodId) return true;
      return foodName(proposalFood).trim().toLowerCase() === draft.name.trim().toLowerCase();
    });
    if (matchIndex < 0) return draft;
    const proposal = available.splice(matchIndex, 1)[0];
    const quantity = draftQuantityValue(proposal.quantity);
    if (!quantity) return draft;
    return {
      ...draft,
      quantity,
      mode: "automatic",
      status: "calculated",
    };
  });
}
