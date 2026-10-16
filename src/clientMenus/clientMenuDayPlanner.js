const DEFAULT_PROTEIN_MIN = 10;
const DEFAULT_PROTEIN_MAX = 70;
const MACRO_KEYS = Object.freeze(["proteina", "carbs", "grasas"]);
const TARGET_KEYS = Object.freeze(["kcal", ...MACRO_KEYS]);
const NUTRITION_FIELDS = Object.freeze({
  kcal: ["kcal", "calorias", "calories"],
  proteina: ["proteina", "proteinas", "protein", "p"],
  carbs: ["carbs", "carbohidratos", "carbohydrates", "c"],
  grasas: ["grasas", "grasa", "fat", "g"],
});

const MEAL_LABELS = Object.freeze({
  desayuno: "Desayuno",
  colacion: "Colación",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  snack: "Snack",
  pre_entreno: "Pre-entreno",
  post_entreno: "Post-entreno",
});

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

export function normalizeDayNutritionTarget(value = {}) {
  const source = value?.target || value?.totals || value?.totales || value;
  return {
    kcal: number(source?.kcal ?? source?.calorias ?? source?.calories),
    proteina: number(source?.proteina ?? source?.proteinas ?? source?.protein ?? source?.p),
    carbs: number(source?.carbs ?? source?.carbohidratos ?? source?.carbohydrates ?? source?.c),
    grasas: number(source?.grasas ?? source?.grasa ?? source?.fat ?? source?.g),
  };
}

export function addDayNutrition(left = {}, right = {}) {
  const a = normalizeDayNutritionTarget(left);
  const b = normalizeDayNutritionTarget(right);
  return Object.fromEntries(TARGET_KEYS.map((key) => [key, a[key] + b[key]]));
}

export function subtractDayNutrition(left = {}, right = {}) {
  const a = normalizeDayNutritionTarget(left);
  const b = normalizeDayNutritionTarget(right);
  return Object.fromEntries(TARGET_KEYS.map((key) => [key, a[key] - b[key]]));
}

export function generationRemainingNutrition(value = {}) {
  const normalized = normalizeDayNutritionTarget(value);
  return Object.fromEntries(TARGET_KEYS.map((key) => [key, Math.max(0, normalized[key])]));
}

function mealFoods(meal = {}) {
  if (Array.isArray(meal?.items)) return meal.items;
  if (Array.isArray(meal?.foods)) return meal.foods;
  if (Array.isArray(meal?.alimentos)) return meal.alimentos;
  return [];
}

function foodHasPlannedQuantity(food = {}) {
  const quantity = number(food?.cantidad ?? food?.quantity ?? food?.amount);
  const identity = String(
    food?.alimentoId || food?.foodId || food?.id || food?._id ||
    food?.nombreSnapshot || food?.nombre || food?.name || ""
  ).trim();
  return quantity > 0 && Boolean(identity);
}

function plannedMealDirectNutrition(meal = {}) {
  const explicitTotals = meal?.nutrition?.totals || meal?.totals || meal?.totales;
  if (explicitTotals && typeof explicitTotals === "object") {
    return normalizeDayNutritionTarget(explicitTotals);
  }
  return normalizeDayNutritionTarget({
    kcal: meal?.kcal ?? meal?.calorias ?? meal?.calories,
    proteina: meal?.proteina ?? meal?.proteinas ?? meal?.protein ?? meal?.p,
    carbs: meal?.carbs ?? meal?.carbohidratos ?? meal?.carbohydrates ?? meal?.c,
    grasas: meal?.grasas ?? meal?.grasa ?? meal?.fat ?? meal?.g,
  });
}

/**
 * Una meta o un slot vacío no son planificación conservable. Sólo una comida
 * con al menos un alimento y una cantidad física positiva queda bloqueada.
 */
export function mealHasPlannedContent(meal = {}) {
  return mealFoods(meal).some(foodHasPlannedQuantity);
}

export function plannedMealNutrition(meal = {}) {
  if (meal?.consumptionAccountingTotals && typeof meal.consumptionAccountingTotals === "object") {
    return normalizeDayNutritionTarget(meal.consumptionAccountingTotals);
  }
  if (!mealHasPlannedContent(meal)) return normalizeDayNutritionTarget();
  const foods = mealFoods(meal).filter(foodHasPlannedQuantity);
  const calculated = foods
    .reduce((totals, food) => addDayNutrition(totals, food), normalizeDayNutritionTarget());
  // `meal.target` describe la intención, no el resultado físico. Sólo se usa
  // un agregado explícito real cuando los items legacy omiten ese nutriente.
  const direct = plannedMealDirectNutrition(meal);
  return Object.fromEntries(TARGET_KEYS.map((key) => [
    key,
    foods.some((food) => NUTRITION_FIELDS[key].some((field) => {
      const value = food?.[field];
      return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
    })) ? calculated[key] : direct[key],
  ]));
}

function mealType(meal = {}, fallback = "") {
  return String(meal?.tipoComida || meal?.mealType || meal?.type || meal?.tipo || fallback)
    .trim()
    .toLowerCase();
}

function mealName(meal = {}, index = 0, type = "") {
  return String(meal?.nombre || meal?.name || MEAL_LABELS[type] || `Comida ${index + 1}`);
}

function plannerError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

export function buildDayMealSlots({
  mealTypes = [],
  plannedMeals = [],
  reservedMealTargets = [],
} = {}) {
  const requestedTypes = (Array.isArray(mealTypes) ? mealTypes : []).map(String).filter(Boolean);
  const fixedMeals = (Array.isArray(plannedMeals) ? plannedMeals : [])
    .filter(mealHasPlannedContent);
  const reservedMeals = (Array.isArray(reservedMealTargets) ? reservedMealTargets : [])
    .filter((meal) => normalizeDayNutritionTarget(meal?.target || meal?.meta || meal).kcal > 0);

  const slots = requestedTypes.map((type, index) => ({
    index,
    type,
    name: MEAL_LABELS[type] || `Comida ${index + 1}`,
    fixedMeal: null,
    reservedMealTarget: null,
  }));

  fixedMeals.forEach((meal, fixedIndex) => {
    const type = mealType(meal);
    const exact = slots.find((slot) => !slot.fixedMeal && slot.type === type);
    const destination = exact || slots.find((slot) => !slot.fixedMeal);
    const resolved = destination || {
      index: slots.length,
      type: type || "otro",
      name: mealName(meal, fixedIndex, type),
      fixedMeal: null,
      reservedMealTarget: null,
    };
    if (!destination) slots.push(resolved);
    resolved.fixedMeal = meal;
    resolved.type = type || resolved.type;
    resolved.name = mealName(meal, fixedIndex, resolved.type);
  });

  reservedMeals.forEach((meal, reservedIndex) => {
    const type = mealType(meal);
    const exact = slots.find((slot) => (
      !slot.reservedMealTarget && slot.type === type
    ));
    const destination = exact || slots.find((slot) => !slot.fixedMeal && !slot.reservedMealTarget);
    const resolved = destination || {
      index: slots.length,
      type: type || "otro",
      name: mealName(meal, reservedIndex, type),
      fixedMeal: null,
      reservedMealTarget: null,
    };
    if (!destination) slots.push(resolved);
    resolved.reservedMealTarget = meal;
    resolved.type = type || resolved.type;
    resolved.name = mealName(meal, reservedIndex, resolved.type);
  });

  return slots;
}

function hashSeed(value = "") {
  const text = String(value || "zumafit-menu");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededGenerationRandom(seed = "") {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function distributionBounds(count) {
  if (count === 3 || count === 4) return { min: 0.2, max: 0.4, jitter: 0.16 };
  if (count === 5) return { min: 0.15, max: 0.4, jitter: 0.13 };
  if (count === 6) return { min: 0.15, max: 0.25, jitter: 0.08 };
  return { min: 0, max: 1, jitter: 0.1 };
}

function normalizeWeights(values = []) {
  const cleaned = values.map((value) => Math.max(0, number(value)));
  const total = cleaned.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return cleaned.map(() => 1 / Math.max(1, cleaned.length));
  return cleaned.map((value) => value / total);
}

function projectWeightsToBounds(values, minimum, maximum) {
  let output = normalizeWeights(values);
  for (let pass = 0; pass < 30; pass += 1) {
    const fixed = output.map((value) => value <= minimum + 1e-12 || value >= maximum - 1e-12);
    output = output.map((value) => Math.min(maximum, Math.max(minimum, value)));
    const difference = 1 - output.reduce((sum, value) => sum + value, 0);
    if (Math.abs(difference) <= 1e-12) break;
    const adjustable = output
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => !fixed[index] && (
        difference > 0 ? value < maximum - 1e-12 : value > minimum + 1e-12
      ));
    if (!adjustable.length) break;
    const share = difference / adjustable.length;
    adjustable.forEach(({ index }) => {
      output[index] += share;
    });
  }
  const scale = 1_000_000;
  const minimumUnits = Math.ceil(minimum * scale - 1e-9);
  const maximumUnits = Math.floor(maximum * scale + 1e-9);
  const units = output.map((value) => Math.min(
    maximumUnits,
    Math.max(minimumUnits, Math.floor(value * scale))
  ));
  let pending = scale - units.reduce((sum, value) => sum + value, 0);
  const order = output
    .map((value, index) => ({ index, remainder: value * scale - Math.floor(value * scale) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  while (pending !== 0) {
    const direction = pending > 0 ? 1 : -1;
    const candidate = order.find(({ index }) => (
      direction > 0 ? units[index] < maximumUnits : units[index] > minimumUnits
    ));
    if (!candidate) break;
    units[candidate.index] += direction;
    pending -= direction;
  }
  return units.map((value) => value / scale);
}

/** Distribución equilibrada reproducible, acotada y con suma exactamente 1. */
export function balancedMealDistribution(count = 4, {
  seed = "",
  rng = null,
  bounds = null,
} = {}) {
  const size = Math.max(1, Math.trunc(number(count)) || 1);
  const random = typeof rng === "function" ? rng : createSeededGenerationRandom(seed);
  const defaults = distributionBounds(size);
  const requested = bounds && typeof bounds === "object" ? bounds : {};
  const min = Number.isFinite(Number(requested.min)) ? Number(requested.min) : defaults.min;
  const max = Number.isFinite(Number(requested.max)) ? Number(requested.max) : defaults.max;
  const jitter = Number.isFinite(Number(requested.jitter)) ? Number(requested.jitter) : defaults.jitter;
  const feasibleBounds = min >= 0
    && max >= min
    && min * size <= 1 + 1e-9
    && max * size >= 1 - 1e-9;
  const effective = feasibleBounds ? { min, max, jitter } : defaults;
  const raw = Array.from(
    { length: size },
    () => 1 + (random() - 0.5) * 2 * Math.max(0, effective.jitter)
  );
  return projectWeightsToBounds(raw, effective.min, effective.max);
}

export function buildDayDistribution({
  mealTypes = [],
  mode = "balanced",
  percentages = {},
  seed = "",
  rng = null,
  balancedBounds = null,
} = {}) {
  const types = (Array.isArray(mealTypes) ? mealTypes : []).map(String).filter(Boolean);
  const warnings = [];
  let weights;
  let source = mode;

  if (mode === "custom") {
    const raw = types.map((type) => number(percentages?.[type]));
    if (raw.every((value) => value > 0)) {
      weights = normalizeWeights(raw);
    } else {
      source = "balanced_fallback";
      warnings.push({
        code: "MENU_INVALID_CUSTOM_DISTRIBUTION",
        message: "La distribución manual estaba incompleta; se usó Equilibrado sin perder ninguna comida.",
      });
    }
  }

  if (!weights) {
    weights = balancedMealDistribution(types.length, { seed, rng, bounds: balancedBounds });
    const boostedType = mode === "more_breakfast"
      ? "desayuno"
      : mode === "more_lunch"
        ? "almuerzo"
        : mode === "more_dinner"
          ? "cena"
          : "";
    if (boostedType && types.includes(boostedType)) {
      weights = normalizeWeights(weights.map((value, index) => (
        types[index] === boostedType ? value * 1.25 : value
      )));
    } else if (!boostedType) {
      source = source === "balanced_fallback" ? source : "balanced";
    }
  }

  const byType = Object.fromEntries(types.map((type, index) => [type, weights[index]]));
  return { weights, byType, source, warnings };
}

function warning(code, message, details = {}) {
  return { code, message, details };
}

export function proteinFeasibility(remainingProtein, remainingSlots, {
  minimum = DEFAULT_PROTEIN_MIN,
  maximum = DEFAULT_PROTEIN_MAX,
} = {}) {
  const protein = Math.max(0, number(remainingProtein));
  const slots = Math.max(0, Math.trunc(number(remainingSlots)));
  if (!slots) return { feasible: protein <= 1e-9, warning: null };
  if (protein < minimum * slots - 1e-9) {
    return {
      feasible: false,
      warning: warning(
        "MENU_PROTEIN_BELOW_FEASIBLE_RANGE",
        `Quedan ${round(protein, 1)} g de proteína para ${slots} comidas; el mínimo deseado sería ${minimum * slots} g.`,
        { remainingProtein: protein, remainingSlots: slots, minimumRequired: minimum * slots }
      ),
    };
  }
  if (protein > maximum * slots + 1e-9) {
    return {
      feasible: false,
      warning: warning(
        "MENU_PROTEIN_ABOVE_FEASIBLE_RANGE",
        `Quedan ${round(protein, 1)} g de proteína para ${slots} comidas; el máximo posible es ${maximum * slots} g.`,
        { remainingProtein: protein, remainingSlots: slots, maximumPossible: maximum * slots }
      ),
    };
  }
  return { feasible: true, warning: null };
}

function currentProteinTarget(remainingProtein, remainingSlots, ratio, minimum, maximum) {
  const protein = Math.max(0, number(remainingProtein));
  const slotsAfter = Math.max(0, remainingSlots - 1);
  if (remainingSlots <= 1) return Math.min(maximum, protein);

  const feasibility = proteinFeasibility(protein, remainingSlots, { minimum, maximum });
  if (!feasibility.feasible) {
    if (protein > maximum * remainingSlots) return maximum;
    return Math.min(maximum, Math.max(0, protein * ratio));
  }

  const minimumCurrent = Math.max(minimum, protein - maximum * slotsAfter);
  const maximumCurrent = Math.min(maximum, protein - minimum * slotsAfter);
  return Math.min(maximumCurrent, Math.max(minimumCurrent, protein * ratio));
}

function currentCarbFatTargets(remaining, ratio, remainingSlots) {
  const carbs = Math.max(0, number(remaining.carbs));
  const fat = Math.max(0, number(remaining.grasas));
  if (remainingSlots <= 1) return { carbs, grasas: fat, feasible: carbs > fat };
  if (!(carbs > fat)) {
    return { carbs: carbs * ratio, grasas: fat * ratio, feasible: false };
  }
  const difference = carbs - fat;
  const fatTarget = fat * ratio;
  return {
    carbs: fatTarget + difference * ratio,
    grasas: fatTarget,
    feasible: true,
  };
}

export function nextSequentialMealTarget({
  rawRemaining = {},
  remainingSlotWeights = [],
  proteinMinimum = DEFAULT_PROTEIN_MIN,
  proteinMaximum = DEFAULT_PROTEIN_MAX,
} = {}) {
  const remaining = generationRemainingNutrition(rawRemaining);
  const weights = normalizeWeights(remainingSlotWeights);
  const remainingSlots = Math.max(1, weights.length);
  const ratio = weights[0] ?? 1;
  const warnings = [];
  const feasibility = proteinFeasibility(remaining.proteina, remainingSlots, {
    minimum: proteinMinimum,
    maximum: proteinMaximum,
  });
  if (feasibility.warning) warnings.push(feasibility.warning);

  const carbFat = currentCarbFatTargets(remaining, ratio, remainingSlots);
  if (!carbFat.feasible) {
    warnings.push(warning(
      "MENU_CARB_FAT_RELATION_NOT_FEASIBLE",
      "Con los macros restantes no es posible mantener carbohidratos mayores que grasas en todas las comidas.",
      { remainingCarbs: remaining.carbs, remainingFat: remaining.grasas, remainingSlots }
    ));
  }

  const target = {
    kcal: remainingSlots <= 1 ? remaining.kcal : remaining.kcal * ratio,
    proteina: currentProteinTarget(
      remaining.proteina,
      remainingSlots,
      ratio,
      proteinMinimum,
      proteinMaximum
    ),
    carbs: carbFat.carbs,
    grasas: carbFat.grasas,
  };

  return {
    target: Object.fromEntries(TARGET_KEYS.map((key) => [key, round(target[key], 2)])),
    ratio,
    warnings,
  };
}

function nutritionDifference(actual = {}, target = {}) {
  const a = normalizeDayNutritionTarget(actual);
  const t = normalizeDayNutritionTarget(target);
  return Object.fromEntries(TARGET_KEYS.map((key) => [key, round(a[key] - t[key], 2)]));
}

function fixedMealKey(meal, index) {
  return String(meal?.id || meal?._id || meal?.nombre || meal?.name || `fixed-${index + 1}`);
}

/**
 * Orquestador diario. No selecciona alimentos ni calcula cantidades: recibe
 * `generateMeal`, que es el generador individual ya probado, y lo invoca una
 * comida por vez con el restante real actualizado.
 */
export async function generateSequentialMenuDay({
  dailyTarget = {},
  mealTypes = [],
  plannedMeals = [],
  reservedMealTargets = [],
  consumedBaseline = {},
  distributionMode = "balanced",
  distributionPercentages = {},
  seed = "",
  rng = null,
  generateMeal,
  diversityMeals = [],
  proteinMinimum = DEFAULT_PROTEIN_MIN,
  proteinMaximum = DEFAULT_PROTEIN_MAX,
} = {}) {
  if (typeof generateMeal !== "function") {
    throw new TypeError("generateMeal debe ser una función.");
  }
  const target = normalizeDayNutritionTarget(dailyTarget);
  const slots = buildDayMealSlots({ mealTypes, plannedMeals, reservedMealTargets });
  const distribution = buildDayDistribution({
    mealTypes,
    mode: distributionMode,
    percentages: distributionPercentages,
    seed,
    rng,
  });
  const warnings = [...distribution.warnings];
  const fixedMeals = slots.filter((slot) => slot.fixedMeal).map((slot) => slot.fixedMeal);
  const reservedMeals = slots
    .filter((slot) => slot.reservedMealTarget)
    .map((slot) => slot.reservedMealTarget);
  const fixedTotals = fixedMeals.reduce(
    (totals, meal) => addDayNutrition(totals, plannedMealNutrition(meal)),
    normalizeDayNutritionTarget()
  );
  const targetOnlySlots = slots.filter((slot) => slot.reservedMealTarget && !slot.fixedMeal);
  const targetConsumedTotals = targetOnlySlots.reduce(
    (totals, slot) => addDayNutrition(totals, slot.reservedMealTarget?.consumed),
    normalizeDayNutritionTarget()
  );
  const targetCommitment = (meal = {}) => meal?.completed === true
    ? normalizeDayNutritionTarget(meal?.consumed)
    : normalizeDayNutritionTarget(meal?.target || meal?.meta || meal);
  const reservedTotals = targetOnlySlots.reduce(
    (totals, slot) => addDayNutrition(totals, targetCommitment(slot.reservedMealTarget)),
    normalizeDayNutritionTarget()
  );
  const baselineTotals = normalizeDayNutritionTarget(consumedBaseline);
  const committedBaseTotals = addDayNutrition(
    addDayNutrition(fixedTotals, baselineTotals),
    targetConsumedTotals
  );
  const targetPendingByIndex = new Map(targetOnlySlots.map((slot) => {
    const meal = slot.reservedMealTarget;
    const pending = meal?.completed === true
      ? normalizeDayNutritionTarget()
      : normalizeDayNutritionTarget(meal?.remainingTarget || subtractDayNutrition(
          meal?.target || meal?.meta || meal,
          meal?.consumed
        ));
    return [slot.index, pending];
  }));
  let futureTargetPendingTotals = [...targetPendingByIndex.values()].reduce(
    (totals, pending) => addDayNutrition(totals, pending),
    normalizeDayNutritionTarget()
  );
  const plannedCommittedTotals = addDayNutrition(fixedTotals, reservedTotals);
  let generatedTotals = normalizeDayNutritionTarget();
  const remainingAfterPlanning = subtractDayNutrition(target, plannedCommittedTotals);
  let rawRemaining = subtractDayNutrition(
    target,
    addDayNutrition(committedBaseTotals, futureTargetPendingTotals)
  );
  const reservedOverage = TARGET_KEYS.find((key) => remainingAfterPlanning[key] < -1e-9);
  if (reservedOverage) {
    throw plannerError(
      "MENU_RESERVED_TARGET_OVERAGE",
      `Las comidas Por meta ya superan el objetivo disponible de ${reservedOverage}. Editalas antes de generar el resto.`,
      {
        nutrient: reservedOverage,
        target: target[reservedOverage],
        reserved: reservedTotals[reservedOverage],
      }
    );
  }
  for (const key of TARGET_KEYS) {
    if (rawRemaining[key] < -1e-9) {
      const trackingCausedOverage = remainingAfterPlanning[key] >= -1e-9
        && baselineTotals[key] > 0;
      warnings.push(warning(
        trackingCausedOverage ? "MENU_TRACKING_TARGET_OVERAGE" : "MENU_FIXED_PLANNING_OVERAGE",
        trackingCausedOverage
          ? `Lo ya registrado supera la meta restante de ${key} por ${round(Math.abs(rawRemaining[key]), 1)}.`
          : `La planificación conservada ya supera la meta de ${key} por ${round(Math.abs(rawRemaining[key]), 1)}.`,
        { nutrient: key, overage: round(Math.abs(rawRemaining[key]), 2) }
      ));
    }
  }
  const macroCalories = target.proteina * 4 + target.carbs * 4 + target.grasas * 9;
  if (target.kcal > 0 && Math.abs(macroCalories - target.kcal) > 4 + 1e-9) {
    warnings.push(warning(
      "MENU_DAILY_TARGET_ENERGY_MISMATCH",
      `La meta de macros equivale a ${round(macroCalories, 1)} kcal y difiere de la meta calórica en ${round(Math.abs(macroCalories - target.kcal), 1)} kcal.`,
      { targetKcal: target.kcal, macroCalories: round(macroCalories, 2) }
    ));
  }
  const outputMeals = [];
  const trace = [];
  const pendingSlots = slots.filter((slot) => !slot.fixedMeal && !slot.reservedMealTarget);
  const pendingWeightByIndex = new Map(
    pendingSlots.map((slot) => [slot.index, distribution.weights[slot.index] || 0])
  );
  const generatedFingerprints = new Set();
  const generatedDiversityMeals = [];
  const externalDiversityMeals = Array.isArray(diversityMeals) ? diversityMeals : [];
  let generatedCount = 0;

  for (const slot of slots) {
    if (slot.fixedMeal) {
      outputMeals.push(slot.fixedMeal);
      trace.push({
        slotIndex: slot.index,
        mealType: slot.type,
        status: "preserved",
        actual: plannedMealNutrition(slot.fixedMeal),
        remainingAfter: rawRemaining,
      });
      continue;
    }

    const targetSpec = slot.reservedMealTarget;
    if (targetSpec?.completed === true) {
      trace.push({
        slotIndex: slot.index,
        mealType: slot.type,
        status: "consumed_target",
        target: normalizeDayNutritionTarget(targetSpec?.target || targetSpec?.meta || targetSpec),
        actual: normalizeDayNutritionTarget(targetSpec?.consumed),
        mealId: String(targetSpec?.id || targetSpec?.mealId || ""),
        remainingAfter: { ...rawRemaining },
      });
      continue;
    }

    const remainingPendingSlots = pendingSlots.filter((pending) => pending.index >= slot.index);
    const targetResolution = targetSpec
      ? { target: targetPendingByIndex.get(slot.index), warnings: [] }
      : nextSequentialMealTarget({
          rawRemaining,
          remainingSlotWeights: remainingPendingSlots.map((pending) => pendingWeightByIndex.get(pending.index)),
          proteinMinimum,
          proteinMaximum,
        });
    targetResolution.warnings.forEach((entry) => {
      if (!warnings.some((current) => current.code === entry.code)) warnings.push(entry);
    });
    if (!(targetResolution.target?.kcal > 0)) {
      trace.push({
        slotIndex: slot.index,
        mealType: slot.type,
        status: targetSpec ? "consumed_target" : "no_remaining",
        target: normalizeDayNutritionTarget(targetResolution.target),
        mealId: String(targetSpec?.id || targetSpec?.mealId || ""),
        remainingAfter: { ...rawRemaining },
      });
      continue;
    }
    const remainingBefore = { ...rawRemaining };
    const generated = await generateMeal({
      slot,
      target: targetResolution.target,
      remainingBefore,
      remainingSlots: remainingPendingSlots.length,
      usedFingerprints: new Set(generatedFingerprints),
      previousMeals: [
        ...externalDiversityMeals,
        ...fixedMeals,
        ...generatedDiversityMeals,
      ],
      seed: `${seed}:${slot.index}:${slot.type}`,
    });
    const meal = generated?.meal || generated;
    if (!mealHasPlannedContent(meal)) {
      throw plannerError(
        "MENU_MEAL_GENERATION_FAILED",
        `No se pudo generar contenido válido para ${slot.name}.`,
        { mealType: slot.type, slotIndex: slot.index }
      );
    }
    const actual = plannedMealNutrition(meal);
    generatedTotals = addDayNutrition(generatedTotals, actual);
    if (targetSpec) {
      futureTargetPendingTotals = subtractDayNutrition(
        futureTargetPendingTotals,
        targetPendingByIndex.get(slot.index)
      );
    }
    rawRemaining = subtractDayNutrition(
      target,
      addDayNutrition(
        addDayNutrition(committedBaseTotals, generatedTotals),
        futureTargetPendingTotals
      )
    );
    if (generated?.fingerprint) generatedFingerprints.add(generated.fingerprint);
    generatedDiversityMeals.push(meal);
    if (Array.isArray(generated?.warnings)) warnings.push(...generated.warnings);
    const outputMeal = targetSpec ? {
      ...meal,
      targetMealId: String(targetSpec?.id || targetSpec?.mealId || ""),
      targetOrigin: targetSpec?.targetOrigin || "auto",
      compositionOrigin: "auto",
    } : meal;
    outputMeals.push(outputMeal);
    generatedCount += 1;
    trace.push({
      slotIndex: slot.index,
      mealType: slot.type,
      status: targetSpec ? "generated_for_target" : "generated",
      weight: distribution.weights[slot.index],
      target: targetResolution.target,
      mealId: String(targetSpec?.id || targetSpec?.mealId || ""),
      actual,
      remainingBefore,
      remainingAfter: { ...rawRemaining },
      solver: generated?.diagnostics || null,
    });
  }

  const totals = addDayNutrition(committedBaseTotals, generatedTotals);
  const difference = nutritionDifference(totals, target);

  return {
    meals: outputMeals,
    fixedMeals,
    reservedMeals,
    fixedMealKeys: fixedMeals.map(fixedMealKey),
    generatedCount,
    fixedTotals: Object.fromEntries(TARGET_KEYS.map((key) => [key, round(fixedTotals[key], 2)])),
    reservedTotals: Object.fromEntries(TARGET_KEYS.map((key) => [key, round(reservedTotals[key], 2)])),
    consumedBaselineTotals: Object.fromEntries(TARGET_KEYS.map((key) => [key, round(baselineTotals[key], 2)])),
    totals: Object.fromEntries(TARGET_KEYS.map((key) => [key, round(totals[key], 2)])),
    difference,
    rawRemaining: Object.fromEntries(TARGET_KEYS.map((key) => [key, round(rawRemaining[key], 2)])),
    distribution,
    warnings,
    trace,
  };
}

export const MENU_GENERATION_PROTEIN_MIN = DEFAULT_PROTEIN_MIN;
export const MENU_GENERATION_PROTEIN_MAX = DEFAULT_PROTEIN_MAX;
