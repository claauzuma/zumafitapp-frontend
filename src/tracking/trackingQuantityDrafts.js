import { buildMenuItemSnapshot, inferMacroBasis } from "../nutricion/nutricionUtils.js";
import {
  addNutritionTotals,
  nutritionTotals,
  subtractNutritionTotals,
} from "./manualDayCompletion.js";

export const TRACKING_QUANTITY_MODE_CONSTRAINED = "constrained";
export const TRACKING_QUANTITY_MODE_CALORIE_FILL = "calorie_fill";
export const TRACKING_QUANTITY_MODE_OPTIONS = [
  {
    value: TRACKING_QUANTITY_MODE_CONSTRAINED,
    label: "Respetar porciones",
    description: "Usa los mínimos, máximos y pasos configurados para cada alimento.",
  },
  {
    value: TRACKING_QUANTITY_MODE_CALORIE_FILL,
    label: "Completar calorías",
    description: "Prioriza completar las calorías disponibles con los alimentos elegidos.",
  },
];
export const TRACKING_QUANTITY_MODES = TRACKING_QUANTITY_MODE_OPTIONS.map(({ value }) => value);
const TRACKING_DRAFT_STORAGE_PREFIX = "zumafit:tracking-quantity-drafts:v1";
const TRACKING_DRAFT_STORAGE_VERSION = 1;

const TRACKING_CONTINUOUS_QUANTITY_UNITS = new Set([
  "g",
  "gr",
  "grs",
  "gramo",
  "gramos",
  "ml",
  "mililitro",
  "mililitros",
]);
const TRACKING_FRACTIONAL_QUANTITY_FLAGS = [
  "allowFractionalQuantity",
  "fractionalQuantityAllowed",
  "fractionalUnitsAllowed",
  "allowsFractions",
];
const TRACKING_QUANTITY_INTEGER_EPSILON = 1e-8;

export function isTrackingQuantityMode(value) {
  return TRACKING_QUANTITY_MODES.includes(String(value || ""));
}

export function normalizeTrackingQuantityMode(
  value,
  fallback = TRACKING_QUANTITY_MODE_CONSTRAINED
) {
  if (isTrackingQuantityMode(value)) return String(value);
  return isTrackingQuantityMode(fallback)
    ? String(fallback)
    : TRACKING_QUANTITY_MODE_CONSTRAINED;
}

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

function normalizedQuantityUnit(unit = "") {
  return String(unit || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

export function trackingFoodExplicitlyAllowsFractionalQuantity(food = {}) {
  const sources = [food, food?.raw].filter((source) => source && typeof source === "object");
  return sources.some((source) => TRACKING_FRACTIONAL_QUANTITY_FLAGS.some(
    (flag) => source[flag] === true
  ));
}

export function trackingFoodRequiresWholeQuantity(food = {}, unit = foodUnit(food)) {
  if (TRACKING_CONTINUOUS_QUANTITY_UNITS.has(normalizedQuantityUnit(unit))) return false;
  return !trackingFoodExplicitlyAllowsFractionalQuantity(food);
}

export function isTrackingFoodQuantityPhysicallyValid(
  food = {},
  unit = foodUnit(food),
  value = "",
  { allowEmpty = false } = {}
) {
  if (value === "" || value === null || value === undefined) return allowEmpty;
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return false;
  if (!trackingFoodRequiresWholeQuantity(food, unit)) return true;
  return Math.abs(quantity - Math.round(quantity)) <= TRACKING_QUANTITY_INTEGER_EPSILON;
}

function exactMacrosPerUnitOrGram(food = {}, unit = foodUnit(food)) {
  const normalizedUnit = String(unit || "").trim().toLowerCase();
  const gramBased = ["g", "gr", "grs", "gramo", "gramos", "ml", "mililitro", "mililitros"]
    .includes(normalizedUnit);
  const basis = food.macroBasis || inferMacroBasis(unit, food.raw || food);
  const divisor = basis === "per100" && gramBased ? 100 : 1;
  const number = (...values) => {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed / divisor;
    }
    return 0;
  };
  return {
    kcal: number(food.kcal, food.calorias, food.kcalUnidad),
    proteina: number(food.proteina, food.protein, food.proteinaUnidad),
    carbs: number(food.carbs, food.carbohidratos, food.carbohidratosUnidad),
    grasas: number(food.grasas, food.fat, food.grasasUnidad),
  };
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

export function createTrackingFoodDraft(
  food = {},
  quantity = "",
  draftId = "",
  trackingQuantityMode = TRACKING_QUANTITY_MODE_CALORIE_FILL
) {
  const unit = foodUnit(food);
  const normalizedQuantity = isTrackingFoodQuantityPhysicallyValid(food, unit, quantity, {
    allowEmpty: true,
  })
    ? draftQuantityValue(quantity)
    : "";
  const mode = normalizedQuantity ? "manual" : "automatic";
  return {
    id: String(draftId || `${foodId(food)}-${Date.now()}`),
    foodId: foodId(food),
    name: foodName(food),
    unit,
    food,
    quantity: normalizedQuantity,
    mode,
    status: normalizedQuantity ? "manual" : "pending",
    trackingQuantityMode: normalizeTrackingQuantityMode(
      trackingQuantityMode,
      TRACKING_QUANTITY_MODE_CALORIE_FILL
    ),
  };
}

function registeredLogFood(item = {}) {
  const quantity = Number(item?.cantidad);
  const registeredFoodId = String(item?.alimentoId || item?.foodId || "");
  if (!(quantity > 0) || !registeredFoodId) return null;
  const totals = nutritionTotals(item);
  return {
    id: registeredFoodId,
    nombre: item?.nombreSnapshot || item?.nombre || item?.name || "Alimento",
    unidad: item?.unidad || item?.unit || "g",
    macroBasis: "perUnit",
    kcal: totals.kcal / quantity,
    proteina: totals.proteina / quantity,
    carbs: totals.carbs / quantity,
    grasas: totals.grasas / quantity,
    categoria: item?.categoriaSnapshot || item?.categoria || "",
    imagen: item?.imagen || null,
    imagenUrl: item?.imagenUrl || "",
  };
}

export function createTrackingRegisteredReplacementDraft(
  item = {},
  draftId = "",
  trackingQuantityMode = TRACKING_QUANTITY_MODE_CALORIE_FILL
) {
  const logId = String(item?.id || item?._id || "");
  const food = registeredLogFood(item);
  const registeredQuantity = Number(item?.cantidad);
  if (!logId || !food || !(registeredQuantity > 0)) return null;
  return {
    ...createTrackingFoodDraft(
      food,
      "",
      draftId || `registered-${logId}`,
      trackingQuantityMode
    ),
    replacesLogId: logId,
    registeredQuantity,
    registeredUnit: item?.unidad || item?.unit || "g",
    registeredTotals: nutritionTotals(item),
  };
}

export function isTrackingRegisteredReplacementDraft(draft = {}) {
  return Boolean(String(draft?.replacesLogId || ""));
}

export function updateTrackingFoodDraftQuantity(draft = {}, quantity = "") {
  if (!isTrackingFoodQuantityPhysicallyValid(draft.food || draft, draft.unit, quantity, {
    allowEmpty: true,
  })) {
    return draft;
  }
  const normalizedQuantity = draftQuantityValue(quantity);
  const currentDraft = { ...draft };
  delete currentDraft.calculatedWithTrackingQuantityMode;
  return {
    ...currentDraft,
    quantity: normalizedQuantity,
    mode: normalizedQuantity ? "manual" : trackingDraftMode(draft),
    status: normalizedQuantity ? "manual" : trackingDraftMode(draft) === "manual" ? "manual" : "pending",
  };
}

export function hasTrackingDraftQuantity(draft = {}) {
  return draftQuantity(draft.quantity) !== null;
}

export function hasTrackingDraftPhysicallyValidQuantity(draft = {}) {
  return hasTrackingDraftQuantity(draft) && isTrackingFoodQuantityPhysicallyValid(
    draft.food || draft,
    draft.unit,
    draft.quantity
  );
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
  const currentDraft = { ...draft };
  delete currentDraft.calculatedWithTrackingQuantityMode;
  return {
    ...currentDraft,
    mode: "automatic",
    status: "pending",
  };
}

export function markTrackingDraftManual(draft = {}) {
  const currentDraft = { ...draft };
  delete currentDraft.calculatedWithTrackingQuantityMode;
  return {
    ...currentDraft,
    mode: "manual",
    status: "manual",
  };
}

export function trackingDraftsQuantityMode(drafts = []) {
  const entries = Array.isArray(drafts) ? drafts : [];
  const explicitMode = entries.find((draft) => (
    isTrackingQuantityMode(draft?.trackingQuantityMode)
  ))?.trackingQuantityMode;

  // Compatibilidad: un borrador previo sin campo conserva el motor histórico.
  // Los borradores nuevos siempre traen calorie_fill desde su creación.
  return normalizeTrackingQuantityMode(
    explicitMode,
    entries.length
      ? TRACKING_QUANTITY_MODE_CONSTRAINED
      : TRACKING_QUANTITY_MODE_CALORIE_FILL
  );
}

export function updateTrackingDraftsQuantityMode(drafts = [], trackingQuantityMode = "") {
  const normalizedMode = normalizeTrackingQuantityMode(trackingQuantityMode);
  return (Array.isArray(drafts) ? drafts : []).map((draft) => ({
    ...draft,
    trackingQuantityMode: normalizedMode,
  }));
}

export function trackingDraftNutritionTotals(draft = {}) {
  if (hasTrackingDraftQuantity(draft) && !hasTrackingDraftPhysicallyValidQuantity(draft)) {
    return nutritionTotals();
  }
  if (isTrackingDraftAutomatic(draft) && !isTrackingDraftCalculated(draft)) {
    return nutritionTotals();
  }
  return nutritionTotals(draftSnapshot(draft) || {});
}

export function trackingDraftsNutritionTotals(drafts = []) {
  return (Array.isArray(drafts) ? drafts : []).reduce(
    (totals, draft) => addNutritionTotals(totals, trackingDraftNutritionTotals(draft)),
    nutritionTotals()
  );
}

export function trackingDraftsReplacedTotals(drafts = []) {
  return (Array.isArray(drafts) ? drafts : []).reduce(
    (totals, draft) => addNutritionTotals(
      totals,
      isTrackingRegisteredReplacementDraft(draft) ? draft.registeredTotals : {}
    ),
    nutritionTotals()
  );
}

export function trackingDraftProjectedDelta(draft = {}) {
  if (
    isTrackingRegisteredReplacementDraft(draft)
    && (!hasTrackingDraftQuantity(draft) || (
      isTrackingDraftAutomatic(draft) && !isTrackingDraftCalculated(draft)
    ))
  ) {
    return nutritionTotals();
  }
  return subtractNutritionTotals(
    trackingDraftNutritionTotals(draft),
    isTrackingRegisteredReplacementDraft(draft) ? draft.registeredTotals : {}
  );
}

export function trackingDraftsProjectedDelta(drafts = []) {
  return (Array.isArray(drafts) ? drafts : []).reduce(
    (totals, draft) => addNutritionTotals(totals, trackingDraftProjectedDelta(draft)),
    nutritionTotals()
  );
}

export function trackingDraftKey(date = "", mealId = "") {
  return `${String(date)}:${String(mealId)}`;
}

export function trackingDateDrafts(draftsByMeal = {}, date = "") {
  const prefix = `${String(date)}:`;
  return Object.entries(draftsByMeal || {}).reduce((drafts, [key, entries]) => (
    key.startsWith(prefix) && Array.isArray(entries) ? [...drafts, ...entries] : drafts
  ), []);
}

export function trackingDateDraftTotals(draftsByMeal = {}, date = "") {
  return trackingDraftsNutritionTotals(trackingDateDrafts(draftsByMeal, date));
}

export function trackingDateDraftProjectedDelta(draftsByMeal = {}, date = "") {
  return trackingDraftsProjectedDelta(trackingDateDrafts(draftsByMeal, date));
}

export function trackingDraftCalculationPayload(drafts = []) {
  const entries = Array.isArray(drafts) ? drafts : [];
  const fixedDrafts = entries.filter((draft) => (
    !isTrackingDraftAutomatic(draft) && hasTrackingDraftPhysicallyValidQuantity(draft)
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
    const macros = exactMacrosPerUnitOrGram(draft.food || {}, unit);
    return {
      foodId: draft.foodId,
      name: draft.name,
      unit,
      source: "pending",
      currentQuantity: hasTrackingDraftQuantity(draft) ? Number(draft.quantity) : null,
      kcalPerUnitOrGram: macros.kcal,
      proteinPerUnitOrGram: macros.proteina,
      carbsPerUnitOrGram: macros.carbs,
      fatPerUnitOrGram: macros.grasas,
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

export function buildTrackingQuantityCalculationRequest({
  date,
  target = {},
  trackingQuantityMode,
  fixedFoods = [],
  pendingFoods = [],
  generationStrategy = "selected_only",
  rejectedSuggestionFoodIds = [],
} = {}) {
  const normalizedMode = normalizeTrackingQuantityMode(trackingQuantityMode);
  return {
    date,
    target,
    mode: "kcalProteina",
    generationType: generationStrategy === "assisted_food_addition"
      ? "assisted_food_addition"
      : "selectedOnly",
    rejectedSuggestionFoodIds: Array.isArray(rejectedSuggestionFoodIds)
      ? rejectedSuggestionFoodIds.map(String).filter(Boolean).slice(0, 40)
      : [],
    trackingQuantityMode: normalizedMode,
    fixedFoods,
    pendingFoods,
    options: {
      redondear: true,
      usarMinMax: normalizedMode === TRACKING_QUANTITY_MODE_CONSTRAINED,
    },
  };
}

export function trackingDraftsReadyToConfirm(drafts = []) {
  const entries = Array.isArray(drafts) ? drafts : [];
  return entries.length > 0 && entries.every((draft) => (
    hasTrackingDraftPhysicallyValidQuantity(draft) &&
    (!isTrackingDraftAutomatic(draft) || isTrackingDraftCalculated(draft))
  ));
}

export function trackingDraftProposals(drafts = [], generatedFoods = []) {
  const available = Array.isArray(generatedFoods) ? [...generatedFoods] : [];
  return (Array.isArray(drafts) ? drafts : []).map((draft) => {
    const matchIndex = available.findIndex((generated) => {
      const generatedId = generatedFoodId(generated);
      if (generatedId && draft.foodId) return generatedId === draft.foodId;
      return generatedFoodName(generated) === draft.name.trim().toLowerCase();
    });
    const generated = matchIndex >= 0
      ? available.splice(matchIndex, 1)[0]
      : hasTrackingDraftPhysicallyValidQuantity(draft) && (
        !isTrackingDraftAutomatic(draft) || isTrackingDraftCalculated(draft)
      )
        ? fixedGeneratedFood(draft)
        : null;
    if (!generated) return null;
    const quantity = Number(generated.quantity ?? generated.cantidad) || 0;
    if (!(quantity > 0)) return null;
    return {
      draftId: draft.id,
      food: draft.food,
      generated,
      quantity,
      initialQuantity: quantity,
      unit: draft.unit || generated.unit || generated.unidad || "g",
      fixed: !isTrackingDraftAutomatic(draft),
    };
  }).filter(Boolean);
}

export function partitionTrackingDraftConfirmations(drafts = [], proposals = []) {
  const draftsById = new Map(
    (Array.isArray(drafts) ? drafts : []).map((draft) => [String(draft?.id || ""), draft])
  );
  return (Array.isArray(proposals) ? proposals : []).reduce(
    (partition, proposal) => {
      const draft = draftsById.get(String(proposal?.draftId || ""));
      if (!draft) return partition;
      const entry = { draft, proposal };
      if (isTrackingRegisteredReplacementDraft(draft)) partition.replacements.push(entry);
      else partition.additions.push(entry);
      return partition;
    },
    { replacements: [], additions: [] }
  );
}

export function applyTrackingDraftProposals(
  drafts = [],
  proposals = [],
  trackingQuantityMode = trackingDraftsQuantityMode(drafts)
) {
  const available = Array.isArray(proposals) ? [...proposals] : [];
  const normalizedTrackingMode = normalizeTrackingQuantityMode(trackingQuantityMode);
  return (Array.isArray(drafts) ? drafts : []).map((draft) => {
    if (!isTrackingDraftAutomatic(draft)) return draft;
    const matchIndex = available.findIndex((proposal) => {
      const proposalFood = proposal.food || proposal.generated || {};
      const proposalId = foodId(proposalFood);
      if (proposalId && draft.foodId) return proposalId === draft.foodId;
      return foodName(proposalFood).trim().toLowerCase() === draft.name.trim().toLowerCase();
    });
    if (matchIndex < 0) return draft;
    const proposal = available.splice(matchIndex, 1)[0];
    if (!isTrackingFoodQuantityPhysicallyValid(
      draft.food || draft,
      proposal.unit || draft.unit,
      proposal.quantity
    )) return draft;
    const quantity = draftQuantityValue(proposal.quantity);
    if (!quantity) return draft;
    return {
      ...draft,
      quantity,
      mode: "automatic",
      status: "calculated",
      trackingQuantityMode: normalizedTrackingMode,
      calculatedWithTrackingQuantityMode: normalizedTrackingMode,
    };
  });
}

export function withoutTrackingMealDrafts(draftsByMeal = {}, draftKey = "") {
  if (!Object.prototype.hasOwnProperty.call(draftsByMeal || {}, draftKey)) return draftsByMeal;
  const next = { ...(draftsByMeal || {}) };
  delete next[draftKey];
  return next;
}

export function restoreTrackingMealDrafts(
  draftsByMeal = {},
  draftKey = "",
  rollbackDrafts = []
) {
  const rollback = Array.isArray(rollbackDrafts) ? rollbackDrafts : [];
  if (!rollback.length) return draftsByMeal;
  const current = Array.isArray(draftsByMeal?.[draftKey]) ? draftsByMeal[draftKey] : [];
  const merged = [...rollback];
  const rollbackIndexesById = new Map(
    merged
      .map((draft, index) => [String(draft?.id || ""), index])
      .filter(([id]) => id)
  );

  current.forEach((draft) => {
    const id = String(draft?.id || "");
    if (id && rollbackIndexesById.has(id)) {
      merged[rollbackIndexesById.get(id)] = draft;
      return;
    }
    if (id) rollbackIndexesById.set(id, merged.length);
    merged.push(draft);
  });

  return {
    ...(draftsByMeal || {}),
    [draftKey]: merged,
  };
}

function trackingDraftStorageEntries(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entries]) => String(key) && Array.isArray(entries) && entries.length)
      .map(([key, entries]) => [
        String(key),
        entries.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)),
      ])
      .filter(([, entries]) => entries.length)
  );
}

function trackingDraftStorageFeedback(value = {}, draftsByMeal = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key, feedback]) => (
      Object.prototype.hasOwnProperty.call(draftsByMeal, key) &&
      feedback &&
      typeof feedback === "object" &&
      !Array.isArray(feedback)
    ))
  );
}

export function trackingDraftStorageOwner(user = {}) {
  const source = user?.user && typeof user.user === "object" ? user.user : user;
  const value =
    source?.id ||
    source?._id ||
    source?.userId ||
    source?.usuarioId ||
    source?.email ||
    "";
  return String(value || "").trim().toLowerCase();
}

export function trackingDraftStorageKey(owner = "") {
  const normalizedOwner = String(owner || "").trim().toLowerCase();
  return normalizedOwner
    ? `${TRACKING_DRAFT_STORAGE_PREFIX}:${encodeURIComponent(normalizedOwner)}`
    : "";
}

export function loadTrackingDraftState(storage, owner = "") {
  const empty = { draftsByMeal: {}, feedbackByMeal: {} };
  const key = trackingDraftStorageKey(owner);
  if (!key || !storage || typeof storage.getItem !== "function") return empty;
  try {
    const raw = storage.getItem(key);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== TRACKING_DRAFT_STORAGE_VERSION) return empty;
    const draftsByMeal = trackingDraftStorageEntries(parsed.draftsByMeal);
    return {
      draftsByMeal,
      feedbackByMeal: trackingDraftStorageFeedback(parsed.feedbackByMeal, draftsByMeal),
    };
  } catch {
    return empty;
  }
}

export function saveTrackingDraftState(
  storage,
  owner = "",
  { draftsByMeal = {}, feedbackByMeal = {} } = {}
) {
  const key = trackingDraftStorageKey(owner);
  if (!key || !storage || typeof storage.setItem !== "function") return false;
  const drafts = trackingDraftStorageEntries(draftsByMeal);
  const feedback = trackingDraftStorageFeedback(feedbackByMeal, drafts);
  try {
    if (!Object.keys(drafts).length) {
      storage.removeItem?.(key);
      return true;
    }
    storage.setItem(key, JSON.stringify({
      version: TRACKING_DRAFT_STORAGE_VERSION,
      draftsByMeal: drafts,
      feedbackByMeal: feedback,
    }));
    return true;
  } catch {
    return false;
  }
}

function trackingDraftSignatureHash(value = "", seed = 2166136261) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function trackingDraftConfirmationRequestId(date = "", mealId = "", drafts = []) {
  const signature = JSON.stringify((Array.isArray(drafts) ? drafts : []).map((draft) => ({
    id: String(draft?.id || ""),
    foodId: String(draft?.foodId || ""),
    quantity: draftQuantityValue(draft?.quantity),
    unit: String(draft?.unit || ""),
  })));
  const firstHash = trackingDraftSignatureHash(signature);
  const secondHash = trackingDraftSignatureHash(signature, 3339675911);
  const safeMealId = String(mealId || "meal").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  return `tracking-draft:${String(date).slice(0, 10)}:${safeMealId}:${firstHash}${secondHash}`;
}
