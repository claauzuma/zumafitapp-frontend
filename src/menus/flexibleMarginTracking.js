export const FLEXIBLE_MARGIN_SOURCE = "flexible_margin";
export const FLEXIBLE_MARGIN_STATUS_SOURCE = "flexible_margin_status";
export const FLEXIBLE_MARGIN_SLOT_TYPE = "flexible_margin";
export const FLEXIBLE_MARGIN_LABEL = "Calorias libres";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readTotal(source = {}, keys = []) {
  if (!source || typeof source !== "object") return 0;
  const lower = Object.entries(source).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") return toNumber(source[key]);
    const value = lower[String(key).toLowerCase()];
    if (value !== undefined && value !== null && value !== "") return toNumber(value);
  }
  return 0;
}

export function flexibleEntryTotals(entry = {}) {
  const source = entry?.totals || entry?.totales || entry?.macros || entry || {};
  return {
    kcal: readTotal(source, ["kcal", "calories", "calorias", "cal"]),
    proteina: readTotal(source, ["proteina", "proteinas", "protein", "p"]),
    carbs: readTotal(source, ["carbs", "carbohidratos", "carbohydrates", "hidratos", "c"]),
    grasas: readTotal(source, ["grasas", "grasa", "fat", "fats", "g"]),
  };
}

export function isFlexibleMarginStatusEntry(entry = {}) {
  return entry?.source === FLEXIBLE_MARGIN_STATUS_SOURCE || entry?.flexibleMarginStatus === true;
}

export function isFlexibleMarginEntry(entry = {}) {
  if (!entry || typeof entry !== "object" || isFlexibleMarginStatusEntry(entry)) return false;
  return (
    entry.source === FLEXIBLE_MARGIN_SOURCE ||
    entry.mealSlotType === FLEXIBLE_MARGIN_SLOT_TYPE ||
    entry.flexibleMargin === true
  );
}

export function manualEntriesFrom(rowOrEntries = {}) {
  if (Array.isArray(rowOrEntries)) return rowOrEntries;
  return Array.isArray(rowOrEntries?.tracking?.manualEntries) ? rowOrEntries.tracking.manualEntries : [];
}

export function flexibleMarginEntries(rowOrEntries = {}) {
  return manualEntriesFrom(rowOrEntries).filter(isFlexibleMarginEntry);
}

export function nonFlexibleManualEntries(rowOrEntries = {}) {
  return manualEntriesFrom(rowOrEntries).filter((entry) => !isFlexibleMarginEntry(entry) && !isFlexibleMarginStatusEntry(entry));
}

export function flexibleMarginTotals(rowOrEntries = {}) {
  return flexibleMarginEntries(rowOrEntries).reduce((acc, entry) => {
    const totals = flexibleEntryTotals(entry);
    return {
      kcal: acc.kcal + totals.kcal,
      proteina: acc.proteina + totals.proteina,
      carbs: acc.carbs + totals.carbs,
      grasas: acc.grasas + totals.grasas,
    };
  }, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

export function isFlexibleMarginCompleted(rowOrEntries = {}) {
  if (!Array.isArray(rowOrEntries) && rowOrEntries?.tracking?.flexibleMarginCompleted === true) return true;
  if (!Array.isArray(rowOrEntries) && rowOrEntries?.flexibleMarginCompleted === true) return true;
  return manualEntriesFrom(rowOrEntries).some((entry) => (
    isFlexibleMarginStatusEntry(entry) && entry.flexibleMarginCompleted === true
  ));
}

export function flexibleMarginStatusEntry(row = {}, completed = true) {
  const now = new Date().toISOString();
  return {
    id: `flexible-margin-status-${row?.date || "day"}`,
    date: row?.date || "",
    dayKey: row?.dayKey || "",
    source: FLEXIBLE_MARGIN_STATUS_SOURCE,
    mealSlotType: FLEXIBLE_MARGIN_SLOT_TYPE,
    label: FLEXIBLE_MARGIN_LABEL,
    name: FLEXIBLE_MARGIN_LABEL,
    flexibleMarginStatus: true,
    flexibleMarginCompleted: completed === true,
    countsAsMenuMeal: false,
    totals: { kcal: 0, proteina: 0, carbs: 0, grasas: 0 },
    items: [],
    foods: [],
    updatedAt: now,
  };
}

export function replaceFlexibleMarginEntries(row = {}, entries = [], completed = false) {
  const nextEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const status = completed ? [flexibleMarginStatusEntry(row, true)] : [];
  return [...nonFlexibleManualEntries(row), ...nextEntries, ...status];
}

export function flexibleMarginRemaining(plan = {}, rowOrEntries = {}) {
  const target = toNumber(plan?.flexibleCalories, 0);
  const totals = flexibleMarginTotals(rowOrEntries);
  return target - totals.kcal;
}

export function flexibleMarginMacroRemaining(plan = {}, rowOrEntries = {}) {
  const totals = flexibleMarginTotals(rowOrEntries);
  const pending = plan?.macroPending || {};
  return {
    kcal: Math.max(0, flexibleMarginRemaining(plan, rowOrEntries)),
    proteina: Math.max(0, toNumber(pending.protein ?? pending.proteina, 0) - totals.proteina),
    carbs: Math.max(0, toNumber(pending.carbs, 0) - totals.carbs),
    grasas: Math.max(0, toNumber(pending.fat ?? pending.grasas, 0) - totals.grasas),
  };
}

export function canUseFlexibleMarginRecommendations(permissions = {}) {
  if (permissions?.canUseFlexibleMarginRecommendations !== undefined) {
    return permissions.canUseFlexibleMarginRecommendations !== false;
  }
  return permissions?.canAutoCompleteRemainingMeals !== false;
}
