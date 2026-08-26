const MEAL_LABELS = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  snack: "Snack",
};

const MACRO_KEYS = ["proteina", "carbs", "grasas"];
const KCAL_PER_GRAM = { proteina: 4, carbs: 4, grasas: 9 };
const FALLBACK_CALORIE_SHARES = { proteina: 0.3, carbs: 0.4, grasas: 0.3 };

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value) {
  return Math.round(number(value) * 10) / 10;
}

function configuredMacro(value, fallback) {
  if (value === "" || value === null || value === undefined) return rounded(fallback);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Ingresá metas de macros válidas.");
  }
  return rounded(parsed);
}

function macroInputIsSet(value) {
  return value !== "" && value !== null && value !== undefined;
}

export function calculateLockedMealMacros({
  kcal,
  macros = {},
  locks = null,
  dailyTarget = {},
} = {}) {
  const targetKcal = Math.max(0, number(kcal));
  const resolvedLocks = Object.fromEntries(MACRO_KEYS.map((key) => [
    key,
    locks && typeof locks === "object" ? locks[key] === true : macroInputIsSet(macros?.[key]),
  ]));
  const result = { proteina: 0, carbs: 0, grasas: 0 };
  const invalidLockedMacros = [];

  MACRO_KEYS.forEach((key) => {
    if (!resolvedLocks[key]) return;
    const raw = macros?.[key];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      invalidLockedMacros.push(key);
      return;
    }
    result[key] = rounded(parsed);
  });

  const lockedCalories = MACRO_KEYS.reduce((sum, key) => (
    sum + (resolvedLocks[key] ? result[key] * KCAL_PER_GRAM[key] : 0)
  ), 0);
  const unlockedKeys = MACRO_KEYS.filter((key) => !resolvedLocks[key]);
  const remainingCalories = Math.max(0, targetKcal - lockedCalories);

  if (unlockedKeys.length) {
    const dailyCalories = Object.fromEntries(unlockedKeys.map((key) => [
      key,
      number(dailyTarget?.[key] ?? (key === "proteina" ? dailyTarget?.p : key === "carbs" ? dailyTarget?.c : dailyTarget?.g)) * KCAL_PER_GRAM[key],
    ]));
    const dailyWeight = unlockedKeys.reduce((sum, key) => sum + dailyCalories[key], 0);
    const fallbackWeight = unlockedKeys.reduce((sum, key) => sum + FALLBACK_CALORIE_SHARES[key], 0);

    unlockedKeys.forEach((key) => {
      const share = dailyWeight > 0
        ? dailyCalories[key] / dailyWeight
        : FALLBACK_CALORIE_SHARES[key] / fallbackWeight;
      result[key] = rounded((remainingCalories * share) / KCAL_PER_GRAM[key]);
    });
  }

  const actualKcal = rounded(MACRO_KEYS.reduce(
    (sum, key) => sum + result[key] * KCAL_PER_GRAM[key],
    0
  ));
  const differenceKcal = rounded(actualKcal - targetKcal);
  const allLocked = unlockedKeys.length === 0;
  const overConstrained = lockedCalories > targetKcal + 0.5;

  return {
    macros: result,
    locks: resolvedLocks,
    targetKcal: rounded(targetKcal),
    actualKcal,
    differenceKcal,
    lockedCalories: rounded(lockedCalories),
    overConstrained,
    allLocked,
    cannotMatchTarget: overConstrained || (allLocked && Math.abs(differenceKcal) > 1),
    invalidLockedMacros,
  };
}

function mealConfigId(meal = {}) {
  return String(meal?.mealId || meal?.id || meal?.mealConfigId || "").trim();
}

function mealConfigTarget(meal = {}) {
  return meal?.meta || meal?.target || {};
}

export function isPersonalMealTargetConfig(meal = {}) {
  const id = mealConfigId(meal);
  const target = mealConfigTarget(meal);
  return id.startsWith("menu_target_") && [
    target.kcal,
    target.proteina ?? target.p,
    target.carbs ?? target.c,
    target.grasas ?? target.g,
  ].some((value) => number(value) > 0);
}

export function personalMealTargetsFromTrackingDay(trackingDay = null) {
  const configs = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  return configs.filter(isPersonalMealTargetConfig).map((meal, index) => {
    const id = mealConfigId(meal);
    const type = String(meal?.tipo || meal?.type || meal?.mealType || "snack");
    const sourceTarget = mealConfigTarget(meal);
    const target = {
      kcal: number(sourceTarget.kcal),
      proteina: number(sourceTarget.proteina ?? sourceTarget.p),
      carbs: number(sourceTarget.carbs ?? sourceTarget.c),
      grasas: number(sourceTarget.grasas ?? sourceTarget.g),
    };
    const label = String(meal?.nombre || meal?.label || meal?.name || MEAL_LABELS[type] || `Comida ${index + 1}`);
    return {
      id,
      name: label,
      nombre: label,
      type,
      tipo: type,
      target,
      totals: target,
      foods: [],
      personalTargetOnly: true,
    };
  });
}

export function buildPersonalMealTargetConfig({
  type = "snack",
  kcal,
  macros = {},
  locks = null,
  dailyTarget = {},
  existingMeals = [],
  idSuffix = "",
} = {}) {
  const targetKcal = number(kcal);
  if (targetKcal <= 0) throw new Error("Ingresá una meta de calorías válida.");

  const safeType = Object.prototype.hasOwnProperty.call(MEAL_LABELS, type) ? type : "snack";
  const dailyKcal = number(dailyTarget?.kcal);
  const ratio = dailyKcal > 0 ? targetKcal / dailyKcal : 0;
  const calculation = calculateLockedMealMacros({
    kcal: targetKcal,
    macros,
    locks,
    dailyTarget,
  });
  if (locks && calculation.invalidLockedMacros.length) {
    throw new Error("Ingresá metas de macros válidas.");
  }
  const suffix = String(idSuffix || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 24);

  return {
    mealId: `menu_target_${safeType}_${suffix || Date.now().toString(36)}`,
    tipo: safeType,
    nombre: MEAL_LABELS[safeType],
    orden: Array.isArray(existingMeals) ? existingMeals.length : 0,
    meta: {
      kcal: locks ? calculation.actualKcal : rounded(targetKcal),
      proteina: locks ? calculation.macros.proteina : configuredMacro(macros?.proteina ?? macros?.p, number(dailyTarget?.proteina ?? dailyTarget?.p) * ratio),
      carbs: locks ? calculation.macros.carbs : configuredMacro(macros?.carbs ?? macros?.c, number(dailyTarget?.carbs ?? dailyTarget?.c) * ratio),
      grasas: locks ? calculation.macros.grasas : configuredMacro(macros?.grasas ?? macros?.g, number(dailyTarget?.grasas ?? dailyTarget?.g) * ratio),
    },
  };
}

export function appendPersonalMealTargetConfig(trackingDay = null, options = {}) {
  const existingMeals = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  return [
    ...existingMeals,
    buildPersonalMealTargetConfig({ ...options, existingMeals }),
  ];
}
