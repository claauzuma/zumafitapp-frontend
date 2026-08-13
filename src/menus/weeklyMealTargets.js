export const MEAL_TYPE_OPTIONS = Object.freeze([
  { type: "breakfast", label: "Desayuno" },
  { type: "lunch", label: "Almuerzo" },
  { type: "snack", label: "Merienda" },
  { type: "dinner", label: "Cena" },
  { type: "extraSnack", label: "Snack" },
  { type: "extraSnack", label: "Colación" },
]);

const MEAL_PRESETS = Object.freeze({
  3: [
    ["breakfast", "Desayuno", 0.26],
    ["lunch", "Almuerzo", 0.4],
    ["dinner", "Cena", 0.34],
  ],
  4: [
    ["breakfast", "Desayuno", 0.22],
    ["lunch", "Almuerzo", 0.33],
    ["snack", "Merienda", 0.15],
    ["dinner", "Cena", 0.3],
  ],
  5: [
    ["breakfast", "Desayuno", 0.2],
    ["lunch", "Almuerzo", 0.29],
    ["snack", "Merienda", 0.13],
    ["dinner", "Cena", 0.26],
    ["snack", "Snack", 0.12],
  ],
  6: [
    ["breakfast", "Desayuno", 0.17],
    ["snack", "Media mañana", 0.11],
    ["lunch", "Almuerzo", 0.27],
    ["snack", "Merienda", 0.12],
    ["dinner", "Cena", 0.23],
    ["snack", "Snack", 0.1],
  ],
});

export function mealTypeLabel(type = "snack", fallback = "Comida") {
  return MEAL_TYPE_OPTIONS.find((option) => option.type === type)?.label || fallback;
}

export function updateMealMoment(meals = [], mealId, option = {}) {
  const safeOption = MEAL_TYPE_OPTIONS.find((item) => item.type === option.type && item.label === option.label);
  if (!safeOption) return meals;
  return meals.map((meal) => meal.id === mealId ? { ...meal, type: safeOption.type, label: safeOption.label } : meal);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function distributeExact(total, weights, decimals = 0) {
  const scale = 10 ** decimals;
  const units = Math.max(0, Math.round(number(total) * scale));
  const raw = weights.map((weight) => units * number(weight));
  const base = raw.map(Math.floor);
  let pending = units - base.reduce((sum, value) => sum + value, 0);
  raw
    .map((value, index) => ({ index, fraction: value - base[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach(({ index }) => {
      if (pending <= 0) return;
      base[index] += 1;
      pending -= 1;
    });
  return base.map((value) => value / scale);
}

export function buildBalancedMealTargets(target = {}, count = 4, dayKey = "day") {
  const safeCount = Math.max(3, Math.min(6, Number(count) || 4));
  const preset = MEAL_PRESETS[safeCount];
  const weights = preset.map((entry) => entry[2]);
  const kcal = distributeExact(target.kcal, weights, 0);
  const protein = distributeExact(target.p, weights, 1);
  const carbs = distributeExact(target.c, weights, 1);
  const fat = distributeExact(target.g, weights, 1);

  return preset.map(([type, label], index) => ({
    id: `coach_target_${dayKey}_${index + 1}`,
    label,
    type,
    order: index,
    target: { kcal: kcal[index], p: protein[index], c: carbs[index], g: fat[index] },
  }));
}

export function rebalanceMealTargets(target = {}, meals = [], dayKey = "day") {
  const balanced = buildBalancedMealTargets(target, meals.length || 4, dayKey);
  return balanced.map((meal, index) => ({
    ...meal,
    id: meals[index]?.id || meal.id,
    label: meals[index]?.label || meal.label,
    type: meals[index]?.type || meal.type,
  }));
}

export function mealTargetTotals(meals = []) {
  return (Array.isArray(meals) ? meals : []).reduce((totals, meal) => ({
    kcal: totals.kcal + number(meal?.target?.kcal),
    p: Math.round((totals.p + number(meal?.target?.p)) * 10) / 10,
    c: Math.round((totals.c + number(meal?.target?.c)) * 10) / 10,
    g: Math.round((totals.g + number(meal?.target?.g)) * 10) / 10,
  }), { kcal: 0, p: 0, c: 0, g: 0 });
}

export function validateMealTargetPlan(meals = [], dailyTarget = {}) {
  if (!Array.isArray(meals) || meals.length < 3 || meals.length > 6) {
    return { valid: false, message: "Elegí entre 3 y 6 comidas." };
  }
  if (meals.some((meal) => ["kcal", "p", "c", "g"].some((key) => number(meal?.target?.[key]) < 0))) {
    return { valid: false, message: "Las metas no pueden tener valores negativos." };
  }
  const totals = mealTargetTotals(meals);
  const differences = {
    kcal: Math.round((totals.kcal - number(dailyTarget.kcal)) * 10) / 10,
    p: Math.round((totals.p - number(dailyTarget.p)) * 10) / 10,
    c: Math.round((totals.c - number(dailyTarget.c)) * 10) / 10,
    g: Math.round((totals.g - number(dailyTarget.g)) * 10) / 10,
  };
  const valid = Math.abs(differences.kcal) <= 1 && ["p", "c", "g"].every((key) => Math.abs(differences[key]) <= 0.1);
  return {
    valid,
    totals,
    differences,
    message: valid ? "" : "La suma de las comidas debe coincidir con la meta diaria.",
  };
}

export function normalizeStoredMealTargetPlan(plan = null) {
  if (!plan || plan.mode !== "per_meal" || !Array.isArray(plan.meals)) return null;
  const meals = plan.meals.slice(0, 6).map((meal, index) => ({
    id: String(meal.id || `coach_target_meal_${index + 1}`),
    label: String(meal.label || meal.name || `Comida ${index + 1}`),
    type: String(meal.type || "snack"),
    order: index,
    target: {
      kcal: number(meal.target?.kcal),
      p: number(meal.target?.p ?? meal.target?.proteina),
      c: number(meal.target?.c ?? meal.target?.carbs),
      g: number(meal.target?.g ?? meal.target?.grasas),
    },
  }));
  return meals.length >= 3 ? { ...plan, mode: "per_meal", meals } : null;
}
