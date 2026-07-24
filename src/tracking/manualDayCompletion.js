const NUTRITION_KEYS = ["kcal", "proteina", "carbs", "grasas"];

const ALIASES = {
  kcal: ["kcal", "calorias", "calories", "cal"],
  proteina: ["proteina", "proteinas", "protein", "p"],
  carbs: ["carbs", "carbohidratos", "carbohydrates", "hidratos", "c"],
  grasas: ["grasas", "grasa", "fat", "fats", "g"],
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(finiteNumber(value) * factor) / factor;
}

function firstNumber(source = {}, keys = []) {
  if (!source || typeof source !== "object") return undefined;
  const lower = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [String(key).toLowerCase(), value])
  );
  for (const key of keys) {
    const value = source[key] ?? lower[String(key).toLowerCase()];
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

export function nutritionTotals(value = {}) {
  const safe = value && typeof value === "object" ? value : {};
  const nested =
    safe.totals ||
    safe.totales ||
    safe.macros ||
    safe.macrosTotales ||
    safe.nutrition ||
    safe.nutricion ||
    {};

  return Object.fromEntries(
    NUTRITION_KEYS.map((key) => [
      key,
      round(firstNumber(nested, ALIASES[key]) ?? firstNumber(safe, ALIASES[key]) ?? 0),
    ])
  );
}

export function configuredNutritionTarget(value = {}) {
  const safe = value && typeof value === "object" ? value : {};
  const nested = safe.target || safe.objetivo || safe.macros || safe.macrosObjetivo || safe;
  const raw = Object.fromEntries(
    NUTRITION_KEYS.map((key) => [key, firstNumber(nested, ALIASES[key])])
  );

  return {
    totals: Object.fromEntries(
      NUTRITION_KEYS.map((key) => [key, round(raw[key] ?? 0)])
    ),
    configured: Object.fromEntries(
      NUTRITION_KEYS.map((key) => [key, Number.isFinite(raw[key]) && raw[key] > 0])
    ),
  };
}

export function addNutritionTotals(...values) {
  return values.reduce(
    (acc, value) => {
      const totals = nutritionTotals(value);
      return Object.fromEntries(
        NUTRITION_KEYS.map((key) => [key, round(acc[key] + totals[key])])
      );
    },
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
  );
}

export function subtractNutritionTotals(left = {}, right = {}) {
  const a = nutritionTotals(left);
  const b = nutritionTotals(right);
  return Object.fromEntries(
    NUTRITION_KEYS.map((key) => [key, round(a[key] - b[key])])
  );
}

export function positiveNutritionTotals(value = {}) {
  const totals = nutritionTotals(value);
  return Object.fromEntries(
    NUTRITION_KEYS.map((key) => [key, Math.max(0, totals[key])])
  );
}

export function hasNutritionConsumption(value = {}) {
  const totals = nutritionTotals(value);
  return NUTRITION_KEYS.some((key) => totals[key] > 0);
}

export function calculateManualDayProgress({
  target = null,
  menuConsumed = {},
  trackedConsumed = {},
} = {}) {
  const normalizedTarget = configuredNutritionTarget(target || {});
  const menu = nutritionTotals(menuConsumed);
  const tracked = nutritionTotals(trackedConsumed);
  const consumed = addNutritionTotals(menu, tracked);
  const available = subtractNutritionTotals(normalizedTarget.totals, menu);
  const remaining = subtractNutritionTotals(normalizedTarget.totals, consumed);
  const targetKcal = normalizedTarget.totals.kcal;
  const remainingKcal = remaining.kcal;
  const nearThreshold = targetKcal > 0 ? Math.max(15, Math.min(40, targetKcal * 0.02)) : 0;

  let status = "missing_target";
  if (normalizedTarget.configured.kcal) {
    if (remainingKcal < -0.5) status = "exceeded";
    else if (Math.abs(remainingKcal) <= 0.5) status = "reached";
    else if (remainingKcal <= nearThreshold) status = "near";
    else status = "remaining";
  }

  return {
    target: normalizedTarget.totals,
    configured: normalizedTarget.configured,
    menuConsumed: menu,
    trackedConsumed: tracked,
    consumed,
    available,
    remaining,
    status,
    exceededBy: remainingKcal < 0 ? round(Math.abs(remainingKcal)) : 0,
  };
}

export function manualDayStatusText(progress = {}) {
  const kcal = Math.round(Math.abs(finiteNumber(progress?.remaining?.kcal)));
  if (progress.status === "missing_target") return "No hay un objetivo calórico configurado";
  if (progress.status === "exceeded") return `Superaste tu objetivo en aproximadamente ${kcal} kcal`;
  if (progress.status === "reached") return "Objetivo del día alcanzado";
  if (progress.status === "near") return "Estás muy cerca de tu objetivo";
  return `Te quedan aproximadamente ${kcal} kcal`;
}

export function calculateMenuAdherence(completedMeals = 0, totalMeals = 0) {
  const completed = Math.max(0, Math.min(finiteNumber(completedMeals), finiteNumber(totalMeals)));
  const total = Math.max(0, finiteNumber(totalMeals));
  return {
    completedMeals: completed,
    totalMeals: total,
    percent: total > 0 ? round((completed / total) * 100) : null,
  };
}

export function calculateNutritionAdherence(consumed = {}, target = {}) {
  const actual = nutritionTotals(consumed);
  const configuredTarget = configuredNutritionTarget(target);
  const targetKcal = configuredTarget.totals.kcal;
  return {
    consumed: actual,
    target: configuredTarget.totals,
    percent: configuredTarget.configured.kcal && targetKcal > 0
      ? round((actual.kcal / targetKcal) * 100)
      : null,
  };
}

function splitExact(value = 0, count = 1, digits = 0) {
  const safeCount = Math.max(1, Math.min(4, Math.trunc(finiteNumber(count, 1))));
  const factor = 10 ** digits;
  const units = Math.max(0, Math.round(finiteNumber(value) * factor));
  const base = Math.floor(units / safeCount);
  const remainder = units - base * safeCount;
  return Array.from(
    { length: safeCount },
    (_, index) => (base + (index < remainder ? 1 : 0)) / factor
  );
}

export function distributeNutritionTarget(value = {}, count = 1) {
  const totals = positiveNutritionTotals(value);
  const safeCount = Math.max(1, Math.min(4, Math.trunc(finiteNumber(count, 1))));
  const rows = Array.from(
    { length: safeCount },
    () => ({ kcal: 0, proteina: 0, carbs: 0, grasas: 0 })
  );

  NUTRITION_KEYS.forEach((key) => {
    const values = splitExact(totals[key], safeCount, key === "kcal" ? 0 : 1);
    values.forEach((entry, index) => {
      rows[index][key] = entry;
    });
  });
  return rows;
}

export function buildRemainingMomentTargets({
  remaining = {},
  moments = [],
  consumedByMoment = {},
} = {}) {
  const safeMoments = (Array.isArray(moments) ? moments : []).slice(0, 4);
  const rows = safeMoments.map((moment, index) => {
    const id = String(moment?.id || `manual_completion_moment_${index + 1}`);
    const consumed = nutritionTotals(consumedByMoment?.[id] || {});
    return {
      ...moment,
      id,
      label: moment?.label || `Momento ${index + 1}`,
      consumed,
      state: hasNutritionConsumption(consumed) ? "consumed" : "planned",
      target: { kcal: 0, proteina: 0, carbs: 0, grasas: 0 },
    };
  });

  const pendingIndexes = rows
    .map((row, index) => (row.state === "planned" ? index : -1))
    .filter((index) => index >= 0);
  const distribution = pendingIndexes.length
    ? distributeNutritionTarget(remaining, pendingIndexes.length)
    : [];

  pendingIndexes.forEach((rowIndex, distributionIndex) => {
    rows[rowIndex].target = distribution[distributionIndex];
  });

  return rows;
}

export function createManualCompletionPlan(count = 1, previous = null) {
  const safeCount = Math.max(1, Math.min(4, Math.trunc(finiteNumber(count, 1))));
  const previousMoments = Array.isArray(previous?.moments) ? previous.moments : [];
  return {
    count: safeCount,
    moments: Array.from({ length: safeCount }, (_, index) => ({
      id: previousMoments[index]?.id || `manual_completion_moment_${index + 1}`,
      label: previousMoments[index]?.label || `Momento ${index + 1}`,
      order: index,
    })),
  };
}
