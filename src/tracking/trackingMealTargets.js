const TARGET_KEYS = ["kcal", "proteina", "carbs", "grasas"];
const TARGET_LABELS = {
  kcal: "calorias",
  proteina: "proteina",
  carbs: "carbohidratos",
  grasas: "grasas",
};
const MEAL_WEIGHTS = {
  desayuno: 24,
  almuerzo: 32,
  merienda: 16,
  cena: 28,
  snack: 12,
  otra: 20,
};

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

export function normalizeTrackingTarget(value = {}) {
  return Object.fromEntries(TARGET_KEYS.map((key) => [key, finitePositive(value?.[key])]));
}

function hasNutrition(value = {}) {
  const totals = normalizeTrackingTarget(value);
  return TARGET_KEYS.some((key) => totals[key] > 0);
}

export function pendingTrackingTargetMeals(meals = [], consumedByMeal = {}) {
  return (Array.isArray(meals) ? meals : []).filter((meal) => (
    !hasNutrition(consumedByMeal?.[String(meal?.id || "")])
  ));
}

export function trackingMealTargetBudget({
  objective = {},
  consumed = {},
  meals = [],
  consumedByMeal = {},
  mealId = "",
} = {}) {
  const target = normalizeTrackingTarget(objective);
  const dayConsumed = normalizeTrackingTarget(consumed);
  const selectedId = String(mealId || "");
  const selectedConsumed = normalizeTrackingTarget(consumedByMeal?.[selectedId]);
  const configured = Object.fromEntries(TARGET_KEYS.map((key) => [key, target[key] > 0]));
  const dailyRemaining = Object.fromEntries(TARGET_KEYS.map((key) => [
    key,
    configured[key] ? Math.max(0, round(target[key] - dayConsumed[key])) : null,
  ]));
  const reservedByOtherMeals = { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };

  (Array.isArray(meals) ? meals : []).forEach((meal) => {
    const id = String(meal?.id || "");
    if (!id || id === selectedId) return;
    const mealTarget = normalizeTrackingTarget(meal?.target);
    const mealConsumed = normalizeTrackingTarget(consumedByMeal?.[id]);
    TARGET_KEYS.forEach((key) => {
      if (!configured[key] || mealTarget[key] <= 0) return;
      reservedByOtherMeals[key] = round(
        reservedByOtherMeals[key] + Math.max(0, mealTarget[key] - mealConsumed[key])
      );
    });
  });

  const maximum = Object.fromEntries(TARGET_KEYS.map((key) => [
    key,
    configured[key]
      ? round(selectedConsumed[key] + Math.max(0, dailyRemaining[key] - reservedByOtherMeals[key]))
      : null,
  ]));

  return {
    configured,
    dailyRemaining,
    selectedConsumed,
    reservedByOtherMeals,
    maximum,
  };
}

export function trackingMealTargetOverages(value = {}, budget = {}) {
  const target = normalizeTrackingTarget(value);
  return TARGET_KEYS.flatMap((key) => {
    const limit = budget?.maximum?.[key];
    if (!budget?.configured?.[key] || !Number.isFinite(limit)) return [];
    const tolerance = key === "kcal" ? 0.5 : 0.05;
    if (target[key] <= limit + tolerance) return [];
    return [{
      key,
      label: TARGET_LABELS[key],
      value: target[key],
      limit,
      excess: round(target[key] - limit),
      unit: key === "kcal" ? "kcal" : "g",
    }];
  });
}

function mealWeight(meal = {}) {
  const type = String(meal?.type || meal?.tipo || "otra").trim().toLowerCase();
  return MEAL_WEIGHTS[type] || MEAL_WEIGHTS.otra;
}

function splitWeighted(value = 0, weights = [], digits = 1) {
  const factor = 10 ** digits;
  const units = Math.max(0, Math.round((Number(value) || 0) * factor));
  if (!weights.length) return [];
  const weightTotal = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0) || weights.length;
  const raw = weights.map((weight) => units * Math.max(0, weight) / weightTotal);
  const allocated = raw.map(Math.floor);
  let remainder = units - allocated.reduce((sum, entry) => sum + entry, 0);
  const priority = raw
    .map((entry, index) => ({ index, fraction: entry - allocated[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; remainder > 0; index += 1, remainder -= 1) {
    allocated[priority[index % priority.length].index] += 1;
  }
  return allocated.map((entry) => entry / factor);
}

function clampPercentage(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function splitSelectedPercentage(value, meals, selectedIndex, percentage, digits) {
  const factor = 10 ** digits;
  const totalUnits = Math.max(0, Math.round((Number(value) || 0) * factor));
  if (meals.length === 1) return [totalUnits / factor];

  const selectedUnits = Math.round(totalUnits * clampPercentage(percentage) / 100);
  const otherMeals = meals.filter((_, index) => index !== selectedIndex);
  const otherValues = splitWeighted(
    (totalUnits - selectedUnits) / factor,
    otherMeals.map(mealWeight),
    digits
  );
  let otherIndex = 0;
  return meals.map((_, index) => {
    if (index === selectedIndex) return selectedUnits / factor;
    const result = otherValues[otherIndex] || 0;
    otherIndex += 1;
    return result;
  });
}

export function distributeTrackingRemainingTargets({
  remaining = {},
  meals = [],
  consumedByMeal = {},
} = {}) {
  const pendingMeals = pendingTrackingTargetMeals(meals, consumedByMeal);
  const available = normalizeTrackingTarget(remaining);
  if (!pendingMeals.length || !hasNutrition(available)) return [];
  const weights = pendingMeals.map(mealWeight);
  const valuesByKey = Object.fromEntries(TARGET_KEYS.map((key) => [
    key,
    splitWeighted(available[key], weights, key === "kcal" ? 0 : 1),
  ]));

  return pendingMeals.map((meal, index) => ({
    mealId: String(meal.id),
    target: Object.fromEntries(TARGET_KEYS.map((key) => [key, valuesByKey[key][index] || 0])),
  }));
}

export function allocateTrackingRemainingBySelectedPercent({
  remaining = {},
  meals = [],
  consumedByMeal = {},
  selectedMealId = "",
  selectedPercent = 0,
} = {}) {
  const pendingMeals = pendingTrackingTargetMeals(meals, consumedByMeal);
  const selectedId = String(selectedMealId || "");
  const selectedIndex = pendingMeals.findIndex((meal) => String(meal?.id || "") === selectedId);
  const available = normalizeTrackingTarget(remaining);
  if (selectedIndex < 0 || !pendingMeals.length || !hasNutrition(available)) return [];

  const percentage = pendingMeals.length === 1 ? 100 : clampPercentage(selectedPercent);
  const valuesByKey = Object.fromEntries(TARGET_KEYS.map((key) => [
    key,
    splitSelectedPercentage(
      available[key],
      pendingMeals,
      selectedIndex,
      percentage,
      key === "kcal" ? 0 : 1
    ),
  ]));

  return pendingMeals.map((meal, index) => ({
    mealId: String(meal.id),
    target: Object.fromEntries(TARGET_KEYS.map((key) => [key, valuesByKey[key][index] || 0])),
  }));
}

export function trackingPendingProteinShortfall({
  remaining = {},
  meals = [],
  consumedByMeal = {},
} = {}) {
  const availableProtein = normalizeTrackingTarget(remaining).proteina;
  if (availableProtein <= 0) return 0;
  const plannedProtein = pendingTrackingTargetMeals(meals, consumedByMeal)
    .reduce((sum, meal) => sum + normalizeTrackingTarget(meal?.target).proteina, 0);
  return round(Math.max(0, availableProtein - plannedProtein));
}

export function trackingTargetFromRemainingPercent(remaining = {}, percent = 0) {
  const available = normalizeTrackingTarget(remaining);
  const safePercent = clampPercentage(percent);
  return Object.fromEntries(TARGET_KEYS.map((key) => [
    key,
    round(available[key] * safePercent / 100, key === "kcal" ? 0 : 1),
  ]));
}
