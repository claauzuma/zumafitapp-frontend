import { plannedTargetWithFreeCalories } from "../../clientMenus/clientMenuGeneration.js";
import { buildDayDistribution } from "../../clientMenus/clientMenuDayPlanner.js";
import { isMealTargetCalorieComplete } from "./mealTargetCompletion.js";

const MEAL_LABELS = {
  desayuno: "Desayuno",
  colacion: "Colación",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  snack: "Snack",
  pre_entreno: "Pre-entreno",
  post_entreno: "Post-entreno",
};

export const PERSONAL_MEAL_TARGET_ORIGIN = Object.freeze({
  AUTO: "auto",
  MANUAL: "manual",
  COACH: "coach",
});

const PERSONAL_MEAL_TARGET_ORIGINS = new Set(Object.values(PERSONAL_MEAL_TARGET_ORIGIN));

const MACRO_KEYS = ["proteina", "carbs", "grasas"];
const KCAL_PER_GRAM = { proteina: 4, carbs: 4, grasas: 9 };
const FALLBACK_CALORIE_SHARES = { proteina: 0.3, carbs: 0.4, grasas: 0.3 };

export const MANUAL_MEAL_TARGET_OVERAGE_TOLERANCE = Object.freeze({
  kcal: 5,
  proteina: 10,
  carbs: 5,
  grasas: 5,
});

// Las calorías de cada comida se muestran redondeadas a enteros, mientras que
// la distribución conserva un decimal. Este margen evita bloquear un plan por
// esa diferencia visual sin admitir un exceso nutricional real.
export const PERSONAL_MEAL_TARGET_TOTAL_ROUNDING_TOLERANCE_KCAL = 0.5;

export function personalMealTargetTotalFitsBudget(totalKcal, budgetKcal) {
  return number(totalKcal)
    <= number(budgetKcal) + PERSONAL_MEAL_TARGET_TOTAL_ROUNDING_TOLERANCE_KCAL;
}

/**
 * Bandas exclusivas del perfil Por meta. Mantienen el reparto reconociblemente
 * equilibrado, pero permiten que dos generaciones no sean clones entre sÃ­.
 */
export function personalMealTargetBalancedBounds(count) {
  if (count === 3) return { min: 0.25, max: 0.4, jitter: 0.35 };
  if (count === 4) return { min: 0.2, max: 0.3, jitter: 0.32 };
  if (count === 5) return { min: 0.15, max: 0.25, jitter: 0.3 };
  if (count === 6) return { min: 0.15, max: 0.25, jitter: 0.25 };
  return null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value) {
  return Math.round(number(value) * 10) / 10;
}

function allocateExactly(total, weights = [], digits = 1) {
  const scale = 10 ** digits;
  const totalUnits = Math.max(0, Math.round(number(total) * scale));
  const safeWeights = weights.map((value) => Math.max(0, number(value)));
  const weightTotal = safeWeights.reduce((sum, value) => sum + value, 0);
  const normalized = safeWeights.map((value) => (
    weightTotal > 0 ? value / weightTotal : 1 / Math.max(1, safeWeights.length)
  ));
  const raw = normalized.map((weight) => totalUnits * weight);
  const units = raw.map(Math.floor);
  let pending = totalUnits - units.reduce((sum, value) => sum + value, 0);
  raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach(({ index }) => {
      if (pending <= 0) return;
      units[index] += 1;
      pending -= 1;
    });
  return units.map((value) => value / scale);
}

function allocateExactlyWithMinimum(total, weights = [], minimum = 0, digits = 1) {
  if (!weights.length) return [];
  const safeMinimum = Math.max(0, number(minimum));
  const minimumTotal = safeMinimum * weights.length;
  if (number(total) <= minimumTotal) {
    return weights.map(() => rounded(safeMinimum));
  }
  const headroomWeights = weights.map((value) => Math.max(0, number(value) - safeMinimum));
  const allocated = allocateExactly(number(total) - minimumTotal, headroomWeights, digits);
  return allocated.map((value) => rounded(safeMinimum + value));
}

function allocateProportionallyWithMinimum(total, weights = [], minimum = 0, digits = 1) {
  if (!weights.length) return [];
  const safeMinimum = Math.max(0, number(minimum));
  if (number(total) <= safeMinimum * weights.length) return weights.map(() => rounded(safeMinimum));
  const values = weights.map(() => 0);
  let active = weights.map((_, index) => index);
  let remaining = number(total);

  while (active.length) {
    const proposed = allocateExactly(remaining, active.map((index) => weights[index]), digits);
    const belowMinimum = active.filter((_, activeIndex) => proposed[activeIndex] < safeMinimum);
    if (!belowMinimum.length) {
      active.forEach((index, activeIndex) => { values[index] = proposed[activeIndex]; });
      break;
    }
    const below = new Set(belowMinimum);
    belowMinimum.forEach((index) => { values[index] = rounded(safeMinimum); });
    remaining = rounded(remaining - safeMinimum * belowMinimum.length);
    active = active.filter((index) => !below.has(index));
  }
  return values;
}

function normalizedTarget(value = {}) {
  return {
    kcal: rounded(value?.kcal),
    proteina: rounded(value?.proteina ?? value?.p),
    carbs: rounded(value?.carbs ?? value?.c),
    grasas: rounded(value?.grasas ?? value?.g),
  };
}

/**
 * Los targets creados por el generador histórico terminan en fecha + índice.
 * Los creados por "Planificar otra" usaban un sufijo aleatorio. La inferencia
 * sólo mantiene compatibilidad; todos los writes nuevos persisten targetOrigin.
 */
export function personalMealTargetOrigin(meal = {}) {
  const explicit = String(meal?.targetOrigin || meal?.metaOrigin || "").trim().toLowerCase();
  if (PERSONAL_MEAL_TARGET_ORIGINS.has(explicit)) return explicit;
  if (meal?.manualTarget === true || meal?.targetEdited === true) {
    return PERSONAL_MEAL_TARGET_ORIGIN.MANUAL;
  }
  const id = String(meal?.mealId || meal?.id || "");
  if (/_manual(?:_|$)/i.test(id)) return PERSONAL_MEAL_TARGET_ORIGIN.MANUAL;
  if (/_20\d{6}_\d+$/i.test(id) || /^menu_target_[a-z0-9_]+_\d+$/i.test(id)) {
    return PERSONAL_MEAL_TARGET_ORIGIN.AUTO;
  }
  // Antes de persistir el origen, "Planificar otra" creaba IDs aleatorios,
  // mientras el generador usaba fecha + índice. Ante un legacy ambiguo
  // protegemos la intención del usuario y lo tratamos como manual.
  return PERSONAL_MEAL_TARGET_ORIGIN.MANUAL;
}

export function personalMealTargetCanRegenerate(meal = {}, trackingDay = null) {
  const id = String(meal?.id || meal?.mealId || "");
  const items = Array.isArray(trackingDay?.meals?.[id]) ? trackingDay.meals[id] : [];
  return personalMealTargetOrigin(meal) === PERSONAL_MEAL_TARGET_ORIGIN.AUTO
    && meal?.confirmed !== true
    && meal?.metaConfirmed !== true
    && meal?.targetLocked !== true
    && items.length === 0;
}

export function targetBelowConsumed(target = {}, consumed = {}, tolerance = 0.000001) {
  const next = {
    kcal: number(target?.kcal),
    proteina: number(target?.proteina ?? target?.p),
    carbs: number(target?.carbs ?? target?.c),
    grasas: number(target?.grasas ?? target?.g),
  };
  const actual = {
    kcal: number(consumed?.kcal),
    proteina: number(consumed?.proteina ?? consumed?.p),
    carbs: number(consumed?.carbs ?? consumed?.c),
    grasas: number(consumed?.grasas ?? consumed?.g),
  };
  return ["kcal", ...MACRO_KEYS]
    .filter((key) => next[key] + tolerance < actual[key]);
}

export function assertPersonalMealTargetNotBelowConsumed(target = {}, consumed = {}) {
  const below = targetBelowConsumed(target, consumed);
  if (!below.length) return true;
  const labels = {
    kcal: "calorías",
    proteina: "proteína",
    carbs: "carbohidratos",
    grasas: "grasas",
  };
  const actual = {
    kcal: number(consumed?.kcal),
    proteina: number(consumed?.proteina ?? consumed?.p),
    carbs: number(consumed?.carbs ?? consumed?.c),
    grasas: number(consumed?.grasas ?? consumed?.g),
  };
  const detail = below
    .map((key) => `${labels[key]} ${actual[key]}${key === "kcal" ? " kcal" : " g"}`)
    .join(", ");
  throw new Error(`Ya consumiste ${detail}. La meta no puede quedar por debajo de lo registrado.`);
}

function trackingItemTarget(item = {}) {
  return normalizedTarget({
    kcal: item?.kcal ?? item?.calorias ?? item?.calories,
    proteina: item?.proteina ?? item?.proteinas ?? item?.protein ?? item?.p,
    carbs: item?.carbs ?? item?.carbohidratos ?? item?.carbohydrates ?? item?.c,
    grasas: item?.grasas ?? item?.grasa ?? item?.fat ?? item?.g,
  });
}

function addNormalizedTargets(left = {}, right = {}) {
  const a = normalizedTarget(left);
  const b = normalizedTarget(right);
  return Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(a[key] + b[key]),
  ]));
}

export function generationTrackingBreakdown(trackingDay = null, {
  excludedMealIds = [],
} = {}) {
  const excluded = new Set((Array.isArray(excludedMealIds) ? excludedMealIds : [])
    .map((mealId) => String(mealId || "").trim())
    .filter(Boolean));
  const meals = trackingDay?.meals && typeof trackingDay.meals === "object"
    ? trackingDay.meals
    : null;
  const entries = meals ? Object.entries(meals) : [];

  if (entries.length) {
    return entries.reduce((breakdown, [mealId, items]) => {
      const id = String(mealId || "");
      if (excluded.has(id)) return breakdown;
      const mealTotals = (Array.isArray(items) ? items : []).reduce(
        (totals, item) => addNormalizedTargets(totals, trackingItemTarget(item)),
        normalizedTarget()
      );
      const consumesFreeCalories = id === "picoteo" || id.startsWith("flexible_");
      return {
        total: addNormalizedTargets(breakdown.total, mealTotals),
        freeEligible: consumesFreeCalories
          ? addNormalizedTargets(breakdown.freeEligible, mealTotals)
          : breakdown.freeEligible,
      };
    }, { total: normalizedTarget(), freeEligible: normalizedTarget() });
  }

  // Compatibilidad con una respuesta antigua que sólo exponga el agregado.
  // Si hay exclusiones no es seguro usar ese total porque produciría doble
  // descuento; la API actual siempre entrega `meals` para ese caso.
  if (!excluded.size) {
    return {
      total: normalizedTarget(trackingDay?.totals || {}),
      freeEligible: normalizedTarget(),
    };
  }
  return { total: normalizedTarget(), freeEligible: normalizedTarget() };
}

/** Los registros preservados quedan fuera para que nunca se resten dos veces. */
export function generationTrackingNutrition(trackingDay = null, options = {}) {
  return generationTrackingBreakdown(trackingDay, options).total;
}

export function generationTargetAfterTracking(dailyTarget = {}, trackingNutrition = {}) {
  const target = normalizedTarget(dailyTarget);
  const consumed = normalizedTarget(trackingNutrition);
  return Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(Math.max(0, target[key] - consumed[key])),
  ]));
}

export function generationNutritionBudget({
  dailyTarget = {},
  tracking = {},
  freeCalories = 0,
} = {}) {
  const target = normalizedTarget(dailyTarget);
  const consumed = normalizedTarget(tracking?.total || tracking);
  const freeEligible = normalizedTarget(tracking?.freeEligible || {});
  const initialFreeCalories = rounded(Math.min(
    target.kcal,
    Math.max(0, number(freeCalories))
  ));
  const freeCaloriesConsumed = rounded(Math.min(initialFreeCalories, freeEligible.kcal));
  const freeCaloriesRemaining = rounded(Math.max(0, initialFreeCalories - freeCaloriesConsumed));
  const freeShare = freeEligible.kcal > 0 ? freeCaloriesConsumed / freeEligible.kcal : 0;
  const freeConsumedNutrition = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    key === "kcal" ? freeCaloriesConsumed : rounded(freeEligible[key] * freeShare),
  ]));
  const normalConsumption = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(Math.max(0, consumed[key] - freeConsumedNutrition[key])),
  ]));
  const remainingDailyTarget = generationTargetAfterTracking(target, consumed);
  const flexiblePlan = plannedTargetWithFreeCalories(
    remainingDailyTarget,
    freeCaloriesRemaining
  );

  return {
    dailyTarget: target,
    initialFreeCalories,
    freeCaloriesConsumed,
    freeCaloriesRemaining,
    consumed,
    freeEligible,
    freeConsumedNutrition,
    normalConsumption,
    remainingDailyTarget,
    generationTarget: normalizedTarget(flexiblePlan.plannedTarget),
  };
}

export function personalMealTargetTotals(meals = []) {
  return (Array.isArray(meals) ? meals : []).reduce((totals, meal) => {
    const target = normalizedTarget(meal?.target || meal?.meta || {});
    return Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
      key,
      rounded(totals[key] + target[key]),
    ]));
  }, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

function targetDifference(left = {}, right = {}) {
  const a = normalizedTarget(left);
  const b = normalizedTarget(right);
  return Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(a[key] - b[key]),
  ]));
}

function targetHasDifference(value = {}, tolerance = 0.05) {
  return ["kcal", ...MACRO_KEYS].some((key) => Math.abs(number(value?.[key])) > tolerance);
}

function targetForecastHasDifference(value = {}) {
  return Math.abs(number(value?.kcal)) > PERSONAL_MEAL_TARGET_TOTAL_ROUNDING_TOLERANCE_KCAL
    || MACRO_KEYS.some((key) => Math.abs(number(value?.[key])) > 0.05);
}

/**
 * Revisión exclusivamente informativa para Tracking manual. Registrar lo que
 * la persona realmente comió nunca se bloquea: estos umbrales sólo evitan
 * convertir diferencias pequeñas de redondeo/porción en una alerta fuerte.
 * La generación automática conserva su evaluación nutricional central.
 */
export function manualMealTargetOverageReview({ target = {}, consumed = {} } = {}) {
  const goal = normalizedTarget(target);
  const actual = normalizedTarget(consumed);
  const excess = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(Math.max(0, actual[key] - goal[key])),
  ]));
  const exceededKeys = ["kcal", ...MACRO_KEYS].filter((key) => (
    excess[key] > MANUAL_MEAL_TARGET_OVERAGE_TOLERANCE[key]
  ));

  return {
    kind: exceededKeys.length ? "informational_overage" : "within_tolerance",
    severity: "info",
    canContinue: true,
    tolerance: { ...MANUAL_MEAL_TARGET_OVERAGE_TOLERANCE },
    excess,
    exceededKeys,
    hasNotice: exceededKeys.length > 0,
  };
}

/**
 * Reconcilia, siempre desde el snapshot actual de Tracking, la realidad del día
 * con las metas personales ya creadas. No persiste ni modifica nada por sí sola:
 * devuelve el forecast de "mantener" y la propuesta de "ajustar" para que la UI
 * deje la decisión en manos del usuario.
 */
export function personalMealTargetDayReconciliation({
  dailyTarget = {},
  trackingDay = null,
  freeCalories = 0,
  minimumMealKcal = 100,
  completedMealIds = [],
  preservedMealIds = [],
} = {}) {
  const meals = personalMealTargetsFromTrackingDay(trackingDay);
  if (!meals.length) return null;

  const target = normalizedTarget(dailyTarget);
  const tracking = generationTrackingBreakdown(trackingDay);
  const accounting = generationNutritionBudget({
    dailyTarget: target,
    tracking,
    freeCalories,
  });
  const explicitlyCompletedIds = new Set([
    ...(Array.isArray(completedMealIds) ? completedMealIds : []),
    ...(Array.isArray(trackingDay?.completedMenuMealIds)
      ? trackingDay.completedMenuMealIds
      : []),
  ].map(String));
  const explicitlyPreservedIds = new Set(
    (Array.isArray(preservedMealIds) ? preservedMealIds : []).map(String)
  );
  const actualByMealId = new Map(meals.map((meal) => {
    const id = String(meal.id);
    const actual = (trackingDay?.meals?.[meal.id] || []).reduce(
      (totals, item) => addNormalizedTargets(totals, trackingItemTarget(item)),
      normalizedTarget()
    );
    return [id, actual];
  }));
  const trackedIds = new Set(meals.flatMap((meal) => {
    const id = String(meal.id);
    const items = trackingDay?.meals?.[meal.id];
    if (!Array.isArray(items) || !items.length) return [];
    const actual = actualByMealId.get(id) || normalizedTarget();
    const targetKcal = number(meal?.target?.kcal);
    const targetReached = targetKcal > 0 && actual.kcal >= targetKcal - 10;
    return explicitlyCompletedIds.has(id) || targetReached ? [id] : [];
  }));
  const inProgressIds = new Set(meals.flatMap((meal) => {
    const id = String(meal.id);
    const items = trackingDay?.meals?.[meal.id];
    return Array.isArray(items) && items.length && !trackedIds.has(id) ? [id] : [];
  }));
  const trackedMeals = meals.filter((meal) => trackedIds.has(String(meal.id)));
  const inProgressMeals = meals.filter((meal) => inProgressIds.has(String(meal.id)));
  const pendingMeals = meals.filter((meal) => (
    !trackedIds.has(String(meal.id)) && !inProgressIds.has(String(meal.id))
  ));
  const eligibleMeals = pendingMeals.filter((meal) => (
    meal.confirmed !== true
    && personalMealTargetOrigin(meal) === PERSONAL_MEAL_TARGET_ORIGIN.AUTO
    && !explicitlyPreservedIds.has(String(meal.id))
  ));
  const fixedMeals = pendingMeals.filter((meal) => (
    meal.confirmed === true
    || personalMealTargetOrigin(meal) !== PERSONAL_MEAL_TARGET_ORIGIN.AUTO
    || explicitlyPreservedIds.has(String(meal.id))
  ));
  const trackedActual = trackedMeals.reduce(
    (totals, meal) => addNormalizedTargets(
      totals,
      actualByMealId.get(String(meal.id))
    ),
    normalizedTarget()
  );
  const trackedPlanned = personalMealTargetTotals(trackedMeals);
  const trackedDifference = targetDifference(trackedActual, trackedPlanned);
  const inProgressActual = inProgressMeals.reduce(
    (totals, meal) => addNormalizedTargets(
      totals,
      actualByMealId.get(String(meal.id))
    ),
    normalizedTarget()
  );
  const inProgressRemaining = inProgressMeals.reduce(
    (totals, meal) => addNormalizedTargets(
      totals,
      targetDifference(meal.target, actualByMealId.get(String(meal.id)))
    ),
    normalizedTarget()
  );
  const mealExcessBuffered = rounded(Math.min(
    accounting.freeCaloriesRemaining,
    Math.max(0, trackedDifference.kcal)
  ));
  const effectiveFreeCaloriesRemaining = rounded(Math.max(
    0,
    accounting.freeCaloriesRemaining - mealExcessBuffered
  ));
  // Una comida que todavía está en progreso conserva su meta completa dentro
  // del forecast. Su consumo real ya está en `accounting.consumed`, por eso se
  // resta sólo su restante más abajo, pero no debe cambiar la reserva flexible
  // ni convertir un registro parcial en un déficit del día.
  const remainingBeforeInProgress = addNormalizedTargets(
    accounting.remainingDailyTarget,
    inProgressActual
  );
  const effectiveGenerationTarget = normalizedTarget(plannedTargetWithFreeCalories(
    remainingBeforeInProgress,
    effectiveFreeCaloriesRemaining
  ).plannedTarget);
  const freeReserve = targetDifference(
    remainingBeforeInProgress,
    effectiveGenerationTarget
  );
  const pendingTotals = personalMealTargetTotals(pendingMeals);
  const forecast = addNormalizedTargets(
    addNormalizedTargets(
      addNormalizedTargets(accounting.consumed, inProgressRemaining),
      pendingTotals
    ),
    freeReserve
  );
  const difference = targetDifference(forecast, target);
  const fixedTotals = personalMealTargetTotals(fixedMeals);
  const availableForEligible = targetDifference(
    effectiveGenerationTarget,
    addNormalizedTargets(fixedTotals, personalMealTargetTotals(inProgressMeals))
  );
  const minimumKcal = Math.max(0, number(minimumMealKcal));
  const adjustedById = new Map();

  if (eligibleMeals.length) {
    const allocationTotals = {
      kcal: Math.max(minimumKcal * eligibleMeals.length, availableForEligible.kcal),
      proteina: Math.max(0, availableForEligible.proteina),
      carbs: Math.max(0, availableForEligible.carbs),
      grasas: Math.max(0, availableForEligible.grasas),
    };
    const allocations = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
      key,
      key === "kcal"
        ? allocateProportionallyWithMinimum(
          allocationTotals[key],
          eligibleMeals.map((meal) => meal.target?.[key]),
          minimumKcal,
          0
        )
        : allocateExactly(
          allocationTotals[key],
          eligibleMeals.map((meal) => meal.target?.[key]),
          1
        ),
    ]));
    eligibleMeals.forEach((meal, index) => {
      adjustedById.set(String(meal.id), {
        kcal: allocations.kcal[index],
        proteina: allocations.proteina[index],
        carbs: allocations.carbs[index],
        grasas: allocations.grasas[index],
      });
    });
  }

  const adjustedMeals = meals.map((meal) => (
    adjustedById.has(String(meal.id))
      ? { ...meal, target: adjustedById.get(String(meal.id)) }
      : meal
  ));
  const adjustedPendingTotals = personalMealTargetTotals(
    adjustedMeals.filter((meal) => (
      !trackedIds.has(String(meal.id)) && !inProgressIds.has(String(meal.id))
    ))
  );
  const adjustedForecast = addNormalizedTargets(
    addNormalizedTargets(
      addNormalizedTargets(accounting.consumed, inProgressRemaining),
      adjustedPendingTotals
    ),
    freeReserve
  );
  const residual = targetDifference(adjustedForecast, target);
  const adjustmentChanges = adjustedMeals.some((meal, index) => targetHasDifference(
    targetDifference(meal.target, meals[index]?.target)
  ));
  const signature = JSON.stringify({
    target,
    freeCalories: accounting.initialFreeCalories,
    tracking: Object.entries(trackingDay?.meals || {}).map(([mealId, items]) => [
      mealId,
      (Array.isArray(items) ? items : []).map((item) => [
        String(item?.id || item?._id || ""),
        number(item?.cantidad),
        ...Object.values(trackingItemTarget(item)),
      ]),
    ]),
    meals: meals.map((meal) => [
      meal.id,
      meal.confirmed === true,
      personalMealTargetOrigin(meal),
      ...Object.values(normalizedTarget(meal.target)),
    ]),
    preservedMealIds: [...explicitlyPreservedIds].sort(),
  });

  return {
    target,
    meals,
    adjustedMeals,
    accounting: {
      ...accounting,
      freeCaloriesRemainingBeforeMealBuffer: accounting.freeCaloriesRemaining,
      mealExcessBuffered,
      freeCaloriesRemaining: effectiveFreeCaloriesRemaining,
      generationTarget: effectiveGenerationTarget,
    },
    freeReserve,
    forecast,
    adjustedForecast,
    difference,
    residual,
    trackedMealIds: [...trackedIds],
    inProgressMealIds: [...inProgressIds],
    inProgressActual,
    inProgressRemaining,
    trackedDifference,
    eligibleMealIds: eligibleMeals.map((meal) => String(meal.id)),
    fixedMealIds: fixedMeals.map((meal) => String(meal.id)),
    preservedMealIds: meals
      .map((meal) => String(meal.id))
      .filter((mealId) => explicitlyPreservedIds.has(mealId)),
    canAdjust: eligibleMeals.length > 0 && adjustmentChanges,
    adjustmentChanges,
    hasDifference: targetForecastHasDifference(difference),
    hasResidual: targetForecastHasDifference(residual),
    signature,
  };
}

/**
 * Obtiene identidades de metas personales que ya tienen una composición
 * planificada en el menú. Tracking y la planificación viven en estructuras
 * distintas, por eso reconciliación recibe estos IDs de forma explícita.
 */
export function personalMealTargetPlannedIds(row = null) {
  const tracking = row?.tracking || row || {};
  const entries = [
    ...(Array.isArray(tracking.mealReplacements) ? tracking.mealReplacements : []),
    ...(Array.isArray(tracking.foodReplacements) ? tracking.foodReplacements : []),
    ...(Array.isArray(tracking.generatedRemainingMeals) ? tracking.generatedRemainingMeals : []),
  ];
  const ids = new Set();

  entries.forEach((entry) => {
    if (!entry || entry.isActiveReplacement === false) return;
    const hasComposition = (
      (Array.isArray(entry.foods) && entry.foods.length > 0) ||
      (Array.isArray(entry.items) && entry.items.length > 0) ||
      entry.composition ||
      entry.generatedComposition
    );
    if (!hasComposition) return;
    [entry.originalMealId, ...(Array.isArray(entry.replacesMealIds) ? entry.replacesMealIds : [])]
      .map((value) => String(value || ""))
      .filter((value) => value.startsWith("menu_target_"))
      .forEach((value) => ids.add(value));
  });

  return [...ids];
}

export function personalMealTargetConfirmationReview(target = {}, composition = {}) {
  const original = normalizedTarget(target);
  const actual = normalizedTarget(composition);
  const proteinDifference = rounded(actual.proteina - original.proteina);
  const proteinStatus = proteinDifference < -0.05
    ? "below"
    : proteinDifference > 0.05
      ? "exceeded"
      : "reached";
  return {
    target: original,
    composition: actual,
    difference: targetDifference(original, actual),
    proteinDifference,
    proteinStatus,
  };
}

export const PERSONAL_MEAL_TARGET_MANUAL_CONFIRMATION = "manual_consumption";

function trackingMealTypeFromTarget(value = "") {
  const type = String(value || "").trim().toLowerCase();
  if (type === "breakfast" || type.includes("desay")) return "desayuno";
  if (type === "lunch" || type.includes("almuer")) return "almuerzo";
  if (type === "dinner" || type.includes("cena")) return "cena";
  if (type.includes("meriend")) return "merienda";
  if (type === "extrasnack" || type.includes("snack") || type.includes("colaci")) return "snack";
  return "otra";
}

/**
 * Cierra o reabre una meta asignada por el coach sin tocar la prescripciÃ³n.
 * La ejecuciÃ³n vive como un overlay en FoodLogs y redistribuye solamente entre
 * metas pendientes sin consumo. El plan semanal del profesional queda intacto.
 */
export function updateCoachMealTargetExecution({
  trackingDay = null,
  coachMeals = [],
  mealId = "",
  reopen = false,
} = {}) {
  const selectedId = String(mealId || "").trim();
  const sourceMeals = (Array.isArray(coachMeals) ? coachMeals : [])
    .map((meal, index) => ({
      ...meal,
      id: String(meal?.id || meal?.mealId || `coach-target-${index + 1}`),
      target: normalizedTarget(meal?.target || meal?.meta || meal?.totals),
    }));
  if (!sourceMeals.some((meal) => meal.id === selectedId)) {
    throw new Error("No encontramos la meta asignada por tu coach.");
  }

  const configs = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  const sourceIds = new Set(sourceMeals.map((meal) => meal.id));
  const executionConfigs = new Map(configs
    .filter((config) => sourceIds.has(mealConfigId(config)) && config?.coachTargetExecution === true)
    .map((config) => [mealConfigId(config), config]));
  const selectedConfig = executionConfigs.get(selectedId);
  const selectedConfirmation = manualConsumptionConfirmation(selectedConfig?.metaConfirmation);
  if (reopen && (!selectedConfig?.metaConfirmed || !selectedConfirmation)) {
    throw new Error("Esta comida no tiene un cierre manual para reabrir.");
  }

  const consumedById = new Map(sourceMeals.map((meal) => [
    meal.id,
    personalMealTargetConsumedComposition(trackingDay, meal.id),
  ]));
  const selectedConsumption = consumedById.get(selectedId);
  if (!reopen && !selectedConsumption?.items?.length) {
    throw new Error("RegistrÃ¡ al menos un alimento consumido antes de confirmar.");
  }

  const syntheticMeals = sourceMeals.map((meal) => {
    const config = executionConfigs.get(meal.id);
    return {
      ...meal,
      target: normalizedTarget(config?.meta || meal.target),
      confirmed: meal.id === selectedId ? false : config?.metaConfirmed === true,
      metaConfirmed: meal.id === selectedId ? false : config?.metaConfirmed === true,
      targetLocked: false,
      targetOrigin: PERSONAL_MEAL_TARGET_ORIGIN.AUTO,
    };
  });
  const nextSelectedTarget = reopen
    ? selectedConfirmation.previousMeta
    : normalizedTarget(selectedConsumption.totals);
  const editableMealIds = sourceMeals
    .filter((meal) => meal.id !== selectedId)
    .filter((meal) => executionConfigs.get(meal.id)?.metaConfirmed !== true)
    .filter((meal) => !(consumedById.get(meal.id)?.items?.length))
    .map((meal) => meal.id);
  const result = editPersonalMealTargetDay({
    meals: syntheticMeals,
    mealId: selectedId,
    target: nextSelectedTarget,
    mode: "redistribute",
    editableMealIds,
    confirmedMealIds: sourceMeals
      .filter((meal) => executionConfigs.get(meal.id)?.metaConfirmed === true && meal.id !== selectedId)
      .map((meal) => meal.id),
    minimumRecipientKcal: 0,
  });
  const targetsById = new Map(result.meals.map((meal) => [String(meal.id), normalizedTarget(meal.target)]));
  const nextExecutionConfigs = sourceMeals.map((meal, index) => {
    const previous = executionConfigs.get(meal.id) || {};
    const isSelected = meal.id === selectedId;
    const previousTarget = normalizedTarget(previous?.meta || meal.target);
    return {
      ...previous,
      mealId: meal.id,
      tipo: trackingMealTypeFromTarget(meal.type || meal.tipo),
      nombre: meal.name || meal.nombre || meal.label || MEAL_LABELS[trackingMealTypeFromTarget(meal.type || meal.tipo)] || `Comida ${index + 1}`,
      orden: Number(meal.order ?? meal.orden ?? index),
      meta: targetsById.get(meal.id),
      metaConfirmed: isSelected ? !reopen : previous?.metaConfirmed === true,
      metaConfirmation: isSelected
        ? (reopen ? null : {
            mode: PERSONAL_MEAL_TARGET_MANUAL_CONFIRMATION,
            previousMeta: previousTarget,
            consumedMeta: nextSelectedTarget,
          })
        : previous?.metaConfirmation || null,
      targetOrigin: PERSONAL_MEAL_TARGET_ORIGIN.COACH,
      targetLocked: true,
      personalTarget: false,
      coachTargetExecution: true,
      consumptionSourceMealIds: Array.isArray(previous?.consumptionSourceMealIds)
        ? previous.consumptionSourceMealIds
        : [meal.id],
    };
  });

  return {
    mealId: selectedId,
    reopened: reopen,
    mealsConfig: [
      ...configs.filter((config) => !(
        sourceIds.has(mealConfigId(config)) && config?.coachTargetExecution === true
      )),
      ...nextExecutionConfigs,
    ],
    residual: result.residual,
  };
}

function manualConsumptionConfirmation(value = null) {
  if (value?.mode !== PERSONAL_MEAL_TARGET_MANUAL_CONFIRMATION) return null;
  return {
    mode: PERSONAL_MEAL_TARGET_MANUAL_CONFIRMATION,
    previousMeta: normalizedTarget(value.previousMeta || value.previousTarget || {}),
    consumedMeta: normalizedTarget(value.consumedMeta || value.confirmedTarget || {}),
  };
}

/** Devuelve exclusivamente los FoodLogs reales asociados a la meta. */
export function personalMealTargetConsumedComposition(trackingDay = null, mealId = "") {
  const id = String(mealId || "").trim();
  const config = (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [])
    .find((meal) => mealConfigId(meal) === id);
  const sourceIds = [...new Set([
    id,
    ...(Array.isArray(config?.consumptionSourceMealIds) ? config.consumptionSourceMealIds : []),
  ].map((value) => String(value || "").trim()).filter(Boolean))];
  const items = sourceIds.flatMap((sourceId) => (
    Array.isArray(trackingDay?.meals?.[sourceId]) ? trackingDay.meals[sourceId] : []
  ));
  const totals = items.reduce(
    (sum, item) => addNormalizedTargets(sum, trackingItemTarget(item)),
    normalizedTarget()
  );
  return { mealId: id, sourceMealIds: sourceIds, items, totals };
}

/**
 * El estado automático es derivado y nunca pisa un cierre manual. Esto evita
 * que la meta ajustada al consumo se vuelva un falso automático al recargar.
 */
export function personalMealTargetCompletionState({
  target = {},
  consumed = {},
  trackedItemsCount = 0,
  metaConfirmed = false,
  confirmation = null,
} = {}) {
  const manualConfirmation = metaConfirmed === true
    ? manualConsumptionConfirmation(confirmation)
    : null;
  const manualStale = Boolean(manualConfirmation) && targetHasDifference(
    targetDifference(target, consumed)
  );
  const automatic = !manualConfirmation && isMealTargetCalorieComplete({
    targetKcal: normalizedTarget(target).kcal,
    consumedKcal: normalizedTarget(consumed).kcal,
    trackedItemsCount,
  });
  return {
    automatic,
    manual: Boolean(manualConfirmation),
    manualStale,
    completed: automatic || (Boolean(manualConfirmation) && !manualStale),
    canManuallyConfirm: trackedItemsCount > 0 && !automatic && !manualConfirmation,
    canReopen: Boolean(manualConfirmation),
    confirmation: manualConfirmation,
  };
}

/**
 * Cierra manualmente una comida usando su consumo real. Los FoodLogs no se
 * mutan: sólo cambia la meta activa y el reconciliador central reparte la
 * diferencia entre las comidas que siguen disponibles.
 */
export function confirmPersonalMealTargetConsumption({
  trackingDay = null,
  mealId = "",
  dailyTarget = {},
  freeCalories = 0,
  minimumMealKcal = 100,
  completedMealIds = [],
  preservedMealIds = [],
} = {}) {
  const id = String(mealId || "").trim();
  const configs = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  const currentConfig = configs.find((config) => mealConfigId(config) === id);
  if (!currentConfig) throw new Error("No encontramos la comida que querés confirmar.");
  // Una meta generada puede absorber un consumo previo y conservar su identidad
  // estable (por ejemplo, "almuerzo"). En ese caso el backend persiste
  // `personalTarget: true`; exigir además el prefijo menu_target_ rechazaba una
  // meta válida que el resto de la aplicación ya trataba como personal.
  if (!isPersonalMealTargetConfig(currentConfig)) {
    throw new Error("Esta comida no es una meta personal editable.");
  }

  const composition = personalMealTargetConsumedComposition(trackingDay, id);
  if (!composition.items.length) {
    throw new Error("Registrá al menos un alimento consumido antes de confirmar.");
  }
  const originalTarget = normalizedTarget(mealConfigTarget(currentConfig));
  const existingConfirmation = manualConsumptionConfirmation(currentConfig?.metaConfirmation);
  if (currentConfig?.metaConfirmed === true && existingConfirmation) {
    return {
      alreadyConfirmed: true,
      mealId: id,
      originalTarget: existingConfirmation.previousMeta,
      confirmedTarget: normalizedTarget(mealConfigTarget(currentConfig)),
      mealsConfig: configs,
      reconciliation: null,
      residual: normalizedTarget(),
    };
  }
  if (isMealTargetCalorieComplete({
    targetKcal: originalTarget.kcal,
    consumedKcal: composition.totals.kcal,
    trackedItemsCount: composition.items.length,
  })) {
    throw new Error("Esta comida ya queda marcada como hecha automáticamente.");
  }

  const confirmedTarget = normalizedTarget(composition.totals);
  const closedConfigs = configs.map((config) => (
    mealConfigId(config) === id
      ? {
          ...config,
          meta: confirmedTarget,
          metaConfirmed: true,
          metaConfirmation: {
            mode: PERSONAL_MEAL_TARGET_MANUAL_CONFIRMATION,
            previousMeta: originalTarget,
            consumedMeta: confirmedTarget,
          },
        }
      : config
  ));
  const closedDay = { ...trackingDay, mealsConfig: closedConfigs };
  const reconciliation = personalMealTargetDayReconciliation({
    dailyTarget,
    trackingDay: closedDay,
    freeCalories,
    minimumMealKcal,
    completedMealIds,
    preservedMealIds: [...new Set([...(preservedMealIds || []), id])],
  });
  const mealsConfig = reconciliation
    ? personalMealTargetConfigsFromReconciliation(closedDay, reconciliation)
    : closedConfigs;

  return {
    alreadyConfirmed: false,
    mealId: id,
    originalTarget,
    confirmedTarget,
    difference: targetDifference(originalTarget, confirmedTarget),
    mealsConfig,
    reconciliation,
    residual: normalizedTarget(reconciliation?.residual),
  };
}

/** Restaura la meta previa de un cierre manual y vuelve a reconciliar el día. */
export function reopenPersonalMealTargetConsumption({
  trackingDay = null,
  mealId = "",
  dailyTarget = {},
  freeCalories = 0,
  minimumMealKcal = 100,
  completedMealIds = [],
  preservedMealIds = [],
} = {}) {
  const id = String(mealId || "").trim();
  const configs = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  const currentConfig = configs.find((config) => mealConfigId(config) === id);
  const confirmation = manualConsumptionConfirmation(currentConfig?.metaConfirmation);
  if (!currentConfig || currentConfig?.metaConfirmed !== true || !confirmation) {
    throw new Error("Esta comida no tiene un cierre manual para reabrir.");
  }

  const reopenedConfigs = configs.map((config) => (
    mealConfigId(config) === id
      ? {
          ...config,
          meta: confirmation.previousMeta,
          metaConfirmed: false,
          metaConfirmation: null,
        }
      : config
  ));
  const reopenedDay = { ...trackingDay, mealsConfig: reopenedConfigs };
  const reconciliation = personalMealTargetDayReconciliation({
    dailyTarget,
    trackingDay: reopenedDay,
    freeCalories,
    minimumMealKcal,
    completedMealIds,
    preservedMealIds: [...new Set([...(preservedMealIds || []), id])],
  });
  const mealsConfig = reconciliation
    ? personalMealTargetConfigsFromReconciliation(reopenedDay, reconciliation)
    : reopenedConfigs;

  return {
    mealId: id,
    restoredTarget: confirmation.previousMeta,
    mealsConfig,
    reconciliation,
    residual: normalizedTarget(reconciliation?.residual),
  };
}

export function personalMealTargetConfigsFromReconciliation(
  trackingDay = null,
  reconciliation = null
) {
  const editableIds = new Set(reconciliation?.eligibleMealIds || []);
  const targetsById = new Map((reconciliation?.adjustedMeals || []).map((meal) => [
    String(meal.id || meal.mealId || ""),
    normalizedTarget(meal.target || meal.meta),
  ]));
  return (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : []).map((config) => {
    const id = mealConfigId(config);
    return editableIds.has(id) && targetsById.has(id)
      ? { ...config, meta: targetsById.get(id) }
      : config;
  });
}

export function personalMealTargetFlexiblePlan(dailyTarget = {}, meals = [], {
  explicitFreeCalories = null,
  expectedPlannedTarget = null,
  consumedNutrition = {},
  planDate = "",
  date = "",
} = {}) {
  const personalMeals = (Array.isArray(meals) ? meals : [])
    .filter((meal) => meal?.personalTargetOnly === true);
  // Una o dos metas sueltas todavía son planificación parcial: el resto del
  // objetivo sigue sin asignar y no debe presentarse como "calorías libres".
  // Los planes Por meta completos se crean con 3 a 6 comidas.
  if (personalMeals.length < 3) return null;
  const target = normalizedTarget(dailyTarget);
  const consumed = normalizedTarget(consumedNutrition);
  const planned = personalMealTargetTotals(personalMeals);
  const hasExplicitContract = explicitFreeCalories !== null && explicitFreeCalories !== undefined;
  if (hasExplicitContract) {
    const explicit = rounded(Math.max(0, number(explicitFreeCalories)));
    const expected = normalizedTarget(expectedPlannedTarget || {});
    if (!(explicit > 0.05)) return null;
    if (planDate && date && planDate !== date) return null;
    if (!(expected.kcal > 0) || Math.abs(expected.kcal - planned.kcal) > 0.11) return null;
  }
  const flexibleCalories = rounded(Math.max(0, hasExplicitContract
    ? number(explicitFreeCalories)
    : target.kcal - planned.kcal));
  if (!(flexibleCalories > 0.05)) return null;
  return {
    source: "personal_target",
    flexibleCalories,
    target,
    planned,
    macroPending: {
      protein: rounded(Math.max(0, target.proteina - consumed.proteina - planned.proteina)),
      carbs: rounded(Math.max(0, target.carbs - consumed.carbs - planned.carbs)),
      fat: rounded(Math.max(0, target.grasas - consumed.grasas - planned.grasas)),
    },
  };
}

export function editablePersonalMealTargetIds(meals = []) {
  return [...new Set((Array.isArray(meals) ? meals : []).flatMap((meal) => {
    const id = String(meal?.id || meal?.mealId || "");
    return meal?.personalTargetOnly === true
      && meal?.targetLocked !== true
      && personalMealTargetOrigin(meal) !== PERSONAL_MEAL_TARGET_ORIGIN.COACH
      && id
      ? [id]
      : [];
  }))];
}

/**
 * Quita solamente la configuración de una meta personal. El mapa `meals`
 * queda intacto para que cualquier FoodLog siga siendo consumo real asociado
 * al mismo mealId. Al quitar la configuración también desaparecen el cierre y
 * su previousMeta, que viven dentro de esa misma meta.
 */
export function removePersonalMealTargetFromTrackingDay(trackingDay = null, mealId = "", {
  redistribute = false,
} = {}) {
  const id = String(mealId || "").trim();
  const targets = personalMealTargetsFromTrackingDay(trackingDay);
  const target = targets
    .find((meal) => String(meal.id) === id);
  if (!target) throw new Error("No encontramos la meta que querés eliminar.");
  if (!editablePersonalMealTargetIds([target]).includes(id)) {
    throw new Error("Esta meta está bloqueada y no se puede eliminar.");
  }

  const consumed = personalMealTargetConsumedComposition(trackingDay, id).totals;
  const releasedTarget = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(Math.max(0, number(target.target?.[key]) - number(consumed[key]))),
  ]));
  const recipientIds = new Set(redistribute ? targets.flatMap((meal) => {
    const recipientId = String(meal.id || meal.mealId || "");
    const editableAutomatic = recipientId !== id
      && meal.confirmed !== true
      && meal.metaConfirmed !== true
      && meal.targetLocked !== true
      && personalMealTargetOrigin(meal) === PERSONAL_MEAL_TARGET_ORIGIN.AUTO;
    return editableAutomatic ? [recipientId] : [];
  }) : []);

  if (redistribute && !recipientIds.size && Object.values(releasedTarget).some((value) => value > 0.05)) {
    throw new Error("No hay otras metas automáticas disponibles para redistribuir.");
  }

  const additionsById = new Map([...recipientIds].map((recipientId) => [
    recipientId,
    normalizedTarget(),
  ]));
  for (const key of ["kcal", ...MACRO_KEYS]) {
    const recipients = targets.filter((meal) => recipientIds.has(String(meal.id || meal.mealId || "")));
    const values = allocateExactly(
      releasedTarget[key],
      recipients.map((meal) => meal.target?.[key]),
      1
    );
    recipients.forEach((meal, index) => {
      const recipientId = String(meal.id || meal.mealId || "");
      additionsById.get(recipientId)[key] = values[index];
    });
  }

  const mealsConfig = (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [])
    .filter((meal) => mealConfigId(meal) !== id)
    .map((meal) => {
      const recipientId = mealConfigId(meal);
      const addition = additionsById.get(recipientId);
      if (!addition) return meal;
      return {
        ...meal,
        meta: addNormalizedTargets(mealConfigTarget(meal), addition),
      };
    });

  return {
    ...(trackingDay || {}),
    mealsConfig,
    removedMealId: id,
    removedTarget: normalizedTarget(target.target),
    consumedTarget: normalizedTarget(consumed),
    redistributedTarget: redistribute ? releasedTarget : normalizedTarget(),
    redistributionRecipientIds: [...recipientIds],
  };
}

export function resolvePersonalMealTargetRemovals({
  originalMealIds = [],
  nextMeals = [],
  confirmedRemovalIds = [],
} = {}) {
  const nextIds = new Set((Array.isArray(nextMeals) ? nextMeals : [])
    .map((meal) => String(meal?.id || meal?.mealId || ""))
    .filter(Boolean));
  const confirmedIds = new Set((Array.isArray(confirmedRemovalIds) ? confirmedRemovalIds : [])
    .map((mealId) => String(mealId || ""))
    .filter(Boolean));
  const removedMealIds = [...new Set((Array.isArray(originalMealIds) ? originalMealIds : [])
    .map((mealId) => String(mealId || ""))
    .filter((mealId) => mealId && !nextIds.has(mealId)))];
  return {
    removedMealIds,
    unconfirmedMealIds: removedMealIds.filter((mealId) => !confirmedIds.has(mealId)),
  };
}

/**
 * Cambia exclusivamente el orden visual/persistido de las metas. Conserva la
 * identidad de cada comida para que sus FoodLogs y sus mínimos consumidos sigan
 * asociados al mismo mealId.
 */
export function reorderPersonalMealTargets(meals = [], mealId = "", direction = 0) {
  const ordered = Array.isArray(meals) ? [...meals] : [];
  const from = ordered.findIndex((meal) => String(meal?.id || meal?.mealId || "") === String(mealId));
  const step = Number(direction) < 0 ? -1 : Number(direction) > 0 ? 1 : 0;
  const to = from + step;
  if (from < 0 || !step || to < 0 || to >= ordered.length) return ordered;
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  return ordered;
}

/**
 * Crea metas vacías por comida usando exactamente la misma distribución y
 * reserva proporcional de macros que usa el planificador automático diario.
 * No genera alimentos ni invoca al combinador/solver.
 */
export function buildPersonalMealTargetDayPlan({
  dailyTarget = {},
  consumedNutrition = {},
  freeEligibleNutrition = {},
  mealTypes = [],
  existingMeals = [],
  distributionMode = "balanced",
  distributionPercentages = {},
  freeCalories = 0,
  seed = "personal-meal-targets",
  minimumMealCount = 3,
} = {}) {
  const types = (Array.isArray(mealTypes) ? mealTypes : []).map(String).filter(Boolean);
  const safeMinimumMealCount = Math.max(1, Math.min(3, Math.trunc(number(minimumMealCount)) || 3));
  if (types.length < safeMinimumMealCount || types.length > 6) {
    throw new Error(`Elegí entre ${safeMinimumMealCount} y 6 comidas.`);
  }
  const accounting = generationNutritionBudget({
    dailyTarget,
    tracking: {
      total: consumedNutrition,
      freeEligible: freeEligibleNutrition,
    },
    freeCalories,
  });
  if (!(accounting.generationTarget.kcal > 0)) {
    throw new Error("Las calorías libres deben ser menores al objetivo diario.");
  }
  const existing = (Array.isArray(existingMeals) ? existingMeals : [])
    .filter((meal) => meal?.personalTargetOnly === true && normalizedTarget(meal?.target || meal?.meta).kcal > 0);
  const usedExisting = new Set();
  const slots = types.map((type) => {
    const matchIndex = existing.findIndex((meal, index) => (
      !usedExisting.has(index) && String(meal?.type || meal?.tipo || "") === type
    ));
    if (matchIndex < 0) return { type, existing: null };
    usedExisting.add(matchIndex);
    return { type, existing: existing[matchIndex] };
  });
  const unmatched = existing.filter((_, index) => !usedExisting.has(index));
  const generationCount = Math.max(0, types.length - existing.length);
  const pendingSlots = slots.filter((slot) => !slot.existing).slice(0, generationCount);
  const existingTotals = personalMealTargetTotals(existing);
  const plannedTarget = normalizedTarget(accounting.generationTarget);
  for (const key of ["kcal", ...MACRO_KEYS]) {
    if (pendingSlots.length && existingTotals[key] > plannedTarget[key] + 0.05) {
      throw new Error(`Las metas ya planificadas superan el objetivo disponible de ${key}. Editalas antes de generar el resto.`);
    }
  }
  const remainingTarget = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(Math.max(0, plannedTarget[key] - existingTotals[key])),
  ]));
  const pendingTypes = pendingSlots.map((slot) => slot.type);
  if (pendingTypes.length && remainingTarget.kcal < pendingTypes.length * 100 - 0.05) {
    throw new Error(`No queda energía suficiente para crear ${pendingTypes.length} comidas de al menos 100 kcal. Reducí una meta existente o elegí menos comidas.`);
  }
  const pendingDistribution = pendingTypes.length ? buildDayDistribution({
    mealTypes: pendingTypes,
    mode: distributionMode,
    percentages: distributionPercentages,
    seed,
    balancedBounds: null,
  }) : { weights: [], warnings: [], source: "preserved_targets" };
  const allocations = Object.fromEntries(
    ["kcal", ...MACRO_KEYS].map((key) => [
      key,
      allocateExactly(remainingTarget[key], pendingDistribution.weights, key === "kcal" ? 0 : 1),
    ])
  );
  if (allocations.kcal.some((value) => value < 100 - 0.05)) {
    throw new Error("La distribución elegida deja una comida nueva por debajo de 100 kcal. Ajustá los porcentajes o las metas existentes.");
  }
  let pendingIndex = 0;
  const selectedPendingSlots = new Set(pendingSlots);
  const meals = slots.flatMap((slot, index) => {
    if (slot.existing) return [{
      ...slot.existing,
      personalTargetOnly: true,
      targetOrigin: personalMealTargetOrigin(slot.existing),
      preserved: true,
    }];
    if (!selectedPendingSlots.has(slot)) return [];
    const allocationIndex = pendingIndex;
    pendingIndex += 1;
    return [{
      id: `menu_target_${slot.type}_${index + 1}`,
      type: slot.type,
      name: MEAL_LABELS[slot.type] || `Comida ${index + 1}`,
      target: Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [key, allocations[key][allocationIndex]])),
      personalTargetOnly: true,
      confirmed: false,
      targetOrigin: PERSONAL_MEAL_TARGET_ORIGIN.AUTO,
    }];
  });
  unmatched.forEach((meal) => meals.push({
    ...meal,
    personalTargetOnly: true,
    targetOrigin: personalMealTargetOrigin(meal),
    preserved: true,
  }));
  const distribution = {
    ...pendingDistribution,
    weights: meals.map((meal) => plannedTarget.kcal > 0
      ? normalizedTarget(meal.target).kcal / plannedTarget.kcal
      : 0),
  };
  return {
    dailyTarget: normalizedTarget(dailyTarget),
    plannedTarget,
    freeCalories: accounting.freeCaloriesRemaining,
    accounting,
    residual: targetDifference(personalMealTargetTotals(meals), plannedTarget),
    distribution,
    meals,
  };
}

export function personalMealTargetDistributionSignature(planOrMeals = {}) {
  const meals = Array.isArray(planOrMeals)
    ? planOrMeals
    : Array.isArray(planOrMeals?.meals)
      ? planOrMeals.meals
      : [];
  return meals.map((meal) => {
    const target = normalizedTarget(meal?.target || meal?.meta);
    return [meal?.type || meal?.tipo || "", target.kcal, target.proteina, target.carbs, target.grasas].join(":");
  }).join("|");
}

/**
 * Reintenta con seeds derivados cuando una distribuciÃ³n equilibrada coincide
 * con alguna de las variantes recientes. Sigue usando el mismo distribuidor.
 */
export function buildVariedPersonalMealTargetDayPlan(options = {}, {
  avoidSignatures = [],
  maximumAttempts = 24,
} = {}) {
  const avoided = new Set((Array.isArray(avoidSignatures) ? avoidSignatures : []).filter(Boolean));
  const baseSeed = String(options?.seed || "personal-meal-targets");
  let lastPlan = null;
  const attempts = Math.max(1, Math.trunc(number(maximumAttempts)) || 1);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const plan = buildPersonalMealTargetDayPlan({
      ...options,
      seed: `${baseSeed}:variant-${attempt + 1}`,
    });
    lastPlan = plan;
    if (!avoided.has(personalMealTargetDistributionSignature(plan))) return plan;
  }
  return lastPlan;
}

export function personalMealTargetConfigsFromPlan(plan = {}, { idSuffix = "" } = {}) {
  const suffix = String(idSuffix || Date.now().toString(36))
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 24);
  return (Array.isArray(plan?.meals) ? plan.meals : []).map((meal, index) => ({
    mealId: meal?.preserved && String(meal?.id || meal?.mealId || "")
      ? String(meal.id || meal.mealId)
      : `menu_target_${meal.type}_${suffix}_${index + 1}`,
    tipo: meal.type,
    nombre: meal.name || MEAL_LABELS[meal.type] || `Comida ${index + 1}`,
    orden: index,
    meta: normalizedTarget(meal.target),
    metaConfirmed: meal?.confirmed === true || meal?.metaConfirmed === true,
    metaConfirmation: meal?.metaConfirmation || null,
    targetOrigin: personalMealTargetOrigin(meal),
    targetLocked: meal?.targetLocked === true,
    personalTarget: true,
    consumptionSourceMealIds: [...new Set(
      (Array.isArray(meal?.consumptionSourceMealIds)
        ? meal.consumptionSourceMealIds
        : (Array.isArray(meal?.sourceMealIds) ? meal.sourceMealIds : []))
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )],
  }));
}

/**
 * Edita una meta y, opcionalmente, redistribuye la diferencia entre los demás
 * slots editables. Los cuatro nutrientes se redistribuyen por separado y nunca
 * quedan negativos. `maximumKcal` es el presupuesto calórico disponible para
 * las comidas y nunca se supera, incluso cuando hay macros fijados.
 */
export function editPersonalMealTargetDay({
  meals = [],
  mealId,
  target = {},
  mode = "keep",
  editableMealIds = null,
  maximumKcal = Infinity,
  confirmedMealIds = null,
  onlySubsequent = false,
  minimumRecipientKcal = 0,
  consumedMinimum = null,
} = {}) {
  const currentMeals = (Array.isArray(meals) ? meals : []).map((meal) => ({
    ...meal,
    target: normalizedTarget(meal.target || meal.meta),
  }));
  const editedIndex = currentMeals.findIndex((meal) => String(meal.id || meal.mealId) === String(mealId));
  if (editedIndex < 0) throw new Error("No encontramos la comida que querés editar.");
  if (currentMeals[editedIndex]?.confirmed === true || currentMeals[editedIndex]?.metaConfirmed === true) {
    throw new Error("Reabrí la comida confirmada antes de editarla.");
  }
  if (
    currentMeals[editedIndex]?.targetLocked === true
    || personalMealTargetOrigin(currentMeals[editedIndex]) === PERSONAL_MEAL_TARGET_ORIGIN.COACH
  ) {
    throw new Error("Esta meta está bloqueada y no se puede editar.");
  }
  if (consumedMinimum) assertPersonalMealTargetNotBelowConsumed(target, consumedMinimum);
  const nextTarget = normalizedTarget(target);
  if ([nextTarget.kcal, nextTarget.proteina, nextTarget.carbs, nextTarget.grasas].some((value) => value < 0)) {
    throw new Error("Las metas no pueden ser negativas.");
  }
  const macroKcal = rounded(nextTarget.proteina * 4 + nextTarget.carbs * 4 + nextTarget.grasas * 9);
  const beforeTotals = personalMealTargetTotals(currentMeals);
  const result = currentMeals.map((meal, index) => index === editedIndex
    ? {
        ...meal,
        target: nextTarget,
        targetOrigin: PERSONAL_MEAL_TARGET_ORIGIN.MANUAL,
        targetEdited: true,
      }
    : meal);

  if (mode === "redistribute") {
    const allowed = editableMealIds ? new Set(editableMealIds.map(String)) : null;
    const confirmed = confirmedMealIds ? new Set(confirmedMealIds.map(String)) : null;
    const recipients = result
      .map((meal, index) => ({ meal, index }))
      .filter(({ meal, index }) => {
        const id = String(meal.id || meal.mealId);
        const mealConfirmed = meal?.confirmed === true || meal?.metaConfirmed === true || confirmed?.has(id);
        return index !== editedIndex
          && (!onlySubsequent || index > editedIndex)
          && !mealConfirmed
          && (!allowed || allowed.has(id));
      });
    const recipientIndexes = new Set(recipients.map(({ index }) => index));
    for (const key of ["kcal", ...MACRO_KEYS]) {
      const fixedTotal = result.reduce((sum, meal, index) => (
        index === editedIndex || !recipientIndexes.has(index)
          ? sum + meal.target[key]
          : sum
      ), 0);
      const remaining = rounded(beforeTotals[key] - fixedTotal);
      const weights = recipients.map(({ meal }) => meal.target[key]);
      const values = key === "kcal"
        ? allocateExactlyWithMinimum(remaining, weights, minimumRecipientKcal, 0)
        : allocateExactly(Math.max(0, remaining), weights, 1);
      recipients.forEach(({ index }, recipientIndex) => {
        result[index] = { ...result[index], target: { ...result[index].target, [key]: values[recipientIndex] } };
      });
    }
  }

  const totals = personalMealTargetTotals(result);
  if (Number.isFinite(Number(maximumKcal)) && totals.kcal > Number(maximumKcal) + 0.05) {
    throw new Error(`Las metas suman ${totals.kcal} kcal y superan el presupuesto calórico de las comidas (${rounded(maximumKcal)} kcal).`);
  }
  const residual = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(totals[key] - beforeTotals[key]),
  ]));
  return { meals: result, totals, beforeTotals, residual, macroKcal };
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
  return (id.startsWith("menu_target_") || meal?.personalTarget === true) && [
    target.kcal,
    target.proteina ?? target.p,
    target.carbs ?? target.c,
    target.grasas ?? target.g,
  ].some((value) => number(value) > 0);
}

/** Consumo real que todavía no tiene una meta asociada. */
export function consumedMealsWithoutPersonalTarget(trackingDay = null) {
  const configs = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  const configuredTargets = new Set(configs.filter(isPersonalMealTargetConfig).flatMap((meal) => [
    mealConfigId(meal),
    ...(Array.isArray(meal?.consumptionSourceMealIds) ? meal.consumptionSourceMealIds : []),
  ]).map(String));
  const configById = new Map(configs.map((meal) => [mealConfigId(meal), meal]));
  return Object.entries(trackingDay?.meals || {}).flatMap(([mealId, items]) => {
    if (mealId === "picoteo" || configuredTargets.has(mealId) || !Array.isArray(items) || !items.length) return [];
    const config = configById.get(mealId) || {};
    const firstItem = items[0] || {};
    const type = String(
      config?.tipo
      || config?.type
      || config?.mealType
      || firstItem?.mealType
      || firstItem?.tipoComida
      || mealId
      || "snack"
    );
    return [{
      id: mealId,
      mealId,
      type,
      name: String(
        config?.nombre
        || config?.name
        || firstItem?.savedMealName
        || firstItem?.mealName
        || MEAL_LABELS[type]
        || "Comida"
      ),
      consumed: items.reduce(
        (totals, item) => addNormalizedTargets(totals, trackingItemTarget(item)),
        normalizedTarget()
      ),
      items,
    }];
  });
}

export function combineConsumedMealsByType(consumedMeals = []) {
  const combined = new Map();
  (Array.isArray(consumedMeals) ? consumedMeals : []).forEach((meal) => {
    const type = String(meal?.type || "otra").trim().toLowerCase() || "otra";
    const current = combined.get(type);
    if (!current) {
      combined.set(type, {
        ...meal,
        type,
        consumed: normalizedTarget(meal?.consumed),
        items: Array.isArray(meal?.items) ? [...meal.items] : [],
        sourceMealIds: [String(meal?.id || meal?.mealId || "")].filter(Boolean),
      });
      return;
    }
    combined.set(type, {
      ...current,
      consumed: addNormalizedTargets(current.consumed, meal?.consumed),
      items: [...current.items, ...(Array.isArray(meal?.items) ? meal.items : [])],
      sourceMealIds: [...new Set([
        ...current.sourceMealIds,
        String(meal?.id || meal?.mealId || ""),
      ].filter(Boolean))],
    });
  });
  return [...combined.values()];
}

/**
 * El reparto se calcula sobre lo que todavía falta del día. Después se suma el
 * consumo del slot a su target para que el resultado final nunca quede debajo
 * de Tracking ni descuente ese consumo dos veces.
 */
export function mergeConsumedMealsIntoPersonalTargetPlan(plan = {}, consumedMeals = []) {
  const pending = combineConsumedMealsByType(consumedMeals).map((meal) => ({ ...meal }));
  const meals = (Array.isArray(plan?.meals) ? plan.meals : []).map((meal) => {
    const matchIndex = pending.findIndex((entry) => String(entry.type) === String(meal.type));
    if (matchIndex < 0) return meal;
    const consumed = pending.splice(matchIndex, 1)[0];
    return {
      ...meal,
      id: consumed.id,
      name: consumed.name || meal.name,
      target: addNormalizedTargets(meal.target, consumed.consumed),
      targetOrigin: PERSONAL_MEAL_TARGET_ORIGIN.AUTO,
      personalTargetOnly: true,
      preserved: true,
      derivedFromConsumption: true,
      consumptionSourceMealIds: consumed.sourceMealIds,
    };
  });
  pending.forEach((consumed) => meals.push({
    id: consumed.id,
    type: consumed.type,
    name: consumed.name,
    target: normalizedTarget(consumed.consumed),
    targetOrigin: PERSONAL_MEAL_TARGET_ORIGIN.AUTO,
    personalTargetOnly: true,
    preserved: true,
    derivedFromConsumption: true,
    consumptionSourceMealIds: consumed.sourceMealIds,
  }));
  return {
    ...plan,
    meals,
    plannedTarget: personalMealTargetTotals(meals),
  };
}

export function personalMealTargetAutomaticSpecs(trackingDay = null) {
  return personalMealTargetsFromTrackingDay(trackingDay).map((meal) => {
    const composition = personalMealTargetConsumedComposition(trackingDay, meal.id);
    const completion = personalMealTargetCompletionState({
      target: meal.target,
      consumed: composition.totals,
      trackedItemsCount: composition.items.length,
      metaConfirmed: meal.metaConfirmed,
      confirmation: meal.metaConfirmation,
    });
    return {
      ...meal,
      consumed: composition.totals,
      consumedItemsCount: composition.items.length,
      completed: completion.completed,
      remainingTarget: Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
        key,
        rounded(Math.max(0, meal.target[key] - composition.totals[key])),
      ])),
    };
  });
}

function plannedMealLogicalType(meal = {}) {
  return String(meal?.tipoComida || meal?.mealType || meal?.type || meal?.tipo || "")
    .trim()
    .toLowerCase();
}

function plannedMealStableId(meal = {}, index = 0) {
  return String(
    meal?.targetMealId || meal?.mealId || meal?.id || meal?._id
    || meal?.nombre || meal?.name || `meal-${index + 1}`
  );
}

function plannedMealPhysicalItems(meal = {}) {
  if (Array.isArray(meal?.items)) return meal.items;
  if (Array.isArray(meal?.foods)) return meal.foods;
  if (Array.isArray(meal?.alimentos)) return meal.alimentos;
  if (Array.isArray(meal?.ingredientes)) return meal.ingredientes;
  if (Array.isArray(meal?.ingredients)) return meal.ingredients;
  return [];
}

function targetHasNutrition(value = {}) {
  const target = normalizedTarget(value);
  return [target.kcal, target.proteina, target.carbs, target.grasas]
    .some((amount) => Math.abs(amount) > 0.001);
}

function plannedMealNutrition(meal = {}) {
  const directSources = [
    meal?.totals,
    meal?.totales,
    meal?.target,
    meal?.meta,
    meal?.macros,
    meal?.nutrition,
    meal?.nutricion,
    meal,
  ];
  const direct = directSources
    .map((source) => trackingItemTarget(source || {}))
    .find(targetHasNutrition);
  if (direct) return direct;
  return plannedMealPhysicalItems(meal).reduce((totals, item) => {
    const source = item?.totals || item?.totales || item?.nutrition || item?.nutricion || item;
    return addNormalizedTargets(totals, trackingItemTarget(source));
  }, normalizedTarget());
}

function targetsMatch(left = {}, right = {}, tolerance = 0.11) {
  const a = normalizedTarget(left);
  const b = normalizedTarget(right);
  return ["kcal", ...MACRO_KEYS].every((key) => Math.abs(a[key] - b[key]) <= tolerance);
}

function legacyDuplicatedAutomaticMeals(meals = [], targetMeals = [], trackingDay = null) {
  const planned = Array.isArray(meals) ? meals : [];
  const targets = Array.isArray(targetMeals) ? targetMeals : [];
  const physicalMeals = planned.filter((meal) => plannedMealPhysicalItems(meal).length > 0);
  const matches = new Set();

  physicalMeals.forEach((meal, index) => {
    if (plannedMealCompositionOrigin(meal) !== "manual" || meal?.compositionEdited === true) return;
    const id = plannedMealStableId(meal, index);
    const type = plannedMealLogicalType(meal);
    const targetMeal = targets.find((target) => {
      const targetId = String(target?.id || target?.mealId || "");
      const targetType = String(target?.type || target?.tipo || target?.mealType || "").toLowerCase();
      return targetId === id || (type && targetType === type);
    });
    if (!targetMeal) return;
    const targetId = String(targetMeal?.id || targetMeal?.mealId || "");
    const logs = Array.isArray(trackingDay?.meals?.[targetId]) ? trackingDay.meals[targetId] : [];
    if (
      logs.length
      || targetMeal?.confirmed === true
      || targetMeal?.metaConfirmed === true
      || targetMeal?.targetLocked === true
      || targetMeal?.targetEdited === true
      || targetMeal?.manualTarget === true
    ) return;
    const target = targetMeal?.target || targetMeal?.meta || targetMeal?.totals;
    const nutrition = plannedMealNutrition(meal);
    if (targetHasNutrition(nutrition) && targetsMatch(target, nutrition)) matches.add(meal);
  });

  // Una coincidencia aislada puede ser intencional. Tres o más slots que
  // replican exactamente un menú físico son la firma del bug legacy que
  // copiaba el automático como metas y dejaba ambas vistas activas.
  const duplicatedMenu = matches.size >= 3
    && matches.size >= Math.ceil(physicalMeals.length / 2);
  return duplicatedMenu ? matches : new Set();
}

export function plannedMealCompositionOrigin(meal = {}) {
  const explicit = String(meal?.compositionOrigin || "").trim().toLowerCase();
  if (["auto", "manual", "coach"].includes(explicit)) return explicit;
  const stableId = String(meal?.id || meal?._id || meal?.mealId || "").trim().toLowerCase();
  return meal?.generationSource
    || meal?.plannerSlotIndex !== undefined
    || stableId.startsWith("generated-meal-")
    ? "auto"
    : "manual";
}

/**
 * Algunas composiciones automáticas creadas antes de persistir correctamente
 * `compositionOrigin` quedaron guardadas como `manual`, pero conservaron su
 * `generationSource`. Sólo aplicamos esa compatibilidad cuando el menú completo
 * tiene forma de generación legacy. Los menús automáticos nuevos declaran su
 * source y en ellos una edición manual explícita siempre gana.
 */
export function plannedMealCompositionOrigins(meals = [], {
  menuSource = "",
  targetMeals = [],
  trackingDay = null,
} = {}) {
  const planned = Array.isArray(meals) ? meals : [];
  const source = String(menuSource || "").trim().toLowerCase();
  const sourceDeclaresAutomatic = /^(auto|generat)/.test(source) || source === "autonomous";
  const physicalMeals = planned.filter((meal) => plannedMealPhysicalItems(meal).length > 0);
  const legacyAutomaticMeals = new Set(physicalMeals.filter((meal) => (
    plannedMealCompositionOrigin(meal) === "manual"
    && String(meal?.generationSource || "").trim() !== ""
    && normalizedTarget(meal?.target || meal?.meta).kcal > 0
  )));
  const ambiguousLegacyAutomaticMeals = new Set(physicalMeals.filter((meal) => (
    plannedMealCompositionOrigin(meal) === "manual"
    && meal?.compositionEdited !== true
    && meal?.manualComposition !== true
  )));
  const legacyAutomaticMenu = !sourceDeclaresAutomatic
    && legacyAutomaticMeals.size >= 2
    && legacyAutomaticMeals.size >= Math.ceil(physicalMeals.length / 2);
  const legacyAutomaticMenuBySource = sourceDeclaresAutomatic
    && ambiguousLegacyAutomaticMeals.size >= 3
    && ambiguousLegacyAutomaticMeals.size >= Math.ceil(physicalMeals.length / 2);
  const duplicatedAutomaticMeals = legacyDuplicatedAutomaticMeals(
    planned,
    targetMeals,
    trackingDay
  );

  return planned.map((meal) => (
    (legacyAutomaticMenu && legacyAutomaticMeals.has(meal))
      || (legacyAutomaticMenuBySource && ambiguousLegacyAutomaticMeals.has(meal))
      || duplicatedAutomaticMeals.has(meal)
      ? "auto"
      : plannedMealCompositionOrigin(meal)
  ));
}

/**
 * Al pasar Auto -> Por meta la composición automática pendiente deja de ser
 * efectiva para ese día. No se muta el menú reusable: la proyección diaria la
 * reemplaza por el target. Consumo, cierres y composiciones manuales sobreviven.
 */
export function reconcilePlannedMealsWithPersonalTargets({
  plannedMeals = [],
  trackingDay = null,
  completedMealIds = [],
  suppressedMealIds = [],
  legacyTargetMeals = [],
  menuSource = "",
} = {}) {
  const targets = personalMealTargetsFromTrackingDay(trackingDay);
  const detectionTargets = targets.length
    ? targets
    : (Array.isArray(legacyTargetMeals) ? legacyTargetMeals : []);
  const suppressed = new Set(
    (Array.isArray(suppressedMealIds) ? suppressedMealIds : []).map(String)
  );
  if (!detectionTargets.length && !suppressed.size) {
    return { meals: Array.isArray(plannedMeals) ? plannedMeals : [], supersededMeals: [] };
  }
  const compositionOrigins = plannedMealCompositionOrigins(plannedMeals, {
    menuSource,
    targetMeals: detectionTargets,
    trackingDay,
  });
  const completed = new Set((Array.isArray(completedMealIds) ? completedMealIds : []).map(String));
  const targetIds = new Set(detectionTargets.map((target) => String(target.id || target.mealId || "")));
  const targetTypes = new Set(detectionTargets.map((target) => String(target.type || target.tipo || "")));
  const meals = [];
  const supersededMeals = [];
  (Array.isArray(plannedMeals) ? plannedMeals : []).forEach((meal, index) => {
    const id = plannedMealStableId(meal, index);
    const executionId = String(meal?.targetMealId || id);
    const type = plannedMealLogicalType(meal);
    const matchesTarget = targetIds.has(executionId) || (type && targetTypes.has(type));
    const done = completed.has(id) || completed.has(executionId);
    const isSuppressed = suppressed.has(id) || suppressed.has(executionId);
    const superseded = !done && (
      isSuppressed
      || (matchesTarget && compositionOrigins[index] === "auto")
    );
    (superseded ? supersededMeals : meals).push(meal);
  });
  return { meals, supersededMeals };
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
      targetOrigin: personalMealTargetOrigin(meal),
      targetEdited: meal?.targetEdited === true,
      manualTarget: meal?.manualTarget === true,
      targetLocked: meal?.targetLocked === true,
      consumptionSourceMealIds: [...new Set([
        id,
        ...(Array.isArray(meal?.consumptionSourceMealIds) ? meal.consumptionSourceMealIds : []),
      ].map((value) => String(value || "").trim()).filter(Boolean))],
      confirmed: meal?.metaConfirmed === true || meal?.confirmed === true,
      metaConfirmed: meal?.metaConfirmed === true || meal?.confirmed === true,
      metaConfirmation: manualConsumptionConfirmation(meal?.metaConfirmation),
      manualConsumptionConfirmed: Boolean(
        (meal?.metaConfirmed === true || meal?.confirmed === true)
        && manualConsumptionConfirmation(meal?.metaConfirmation)
      ),
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
  targetOrigin = PERSONAL_MEAL_TARGET_ORIGIN.MANUAL,
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
    metaConfirmed: false,
    targetOrigin: PERSONAL_MEAL_TARGET_ORIGINS.has(String(targetOrigin))
      ? String(targetOrigin)
      : PERSONAL_MEAL_TARGET_ORIGIN.MANUAL,
    personalTarget: true,
  };
}

export function appendPersonalMealTargetConfig(trackingDay = null, options = {}) {
  const existingMeals = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  return [
    ...existingMeals,
    buildPersonalMealTargetConfig({ ...options, existingMeals }),
  ];
}

export function replacePersonalMealTargetConfigs(trackingDay = null, targetConfigs = []) {
  const existingMeals = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  const nextTargets = Array.isArray(targetConfigs) ? targetConfigs : [];
  const claimedTargetIds = new Set(nextTargets.map(mealConfigId).filter(Boolean));
  const targetTypes = new Set(nextTargets.map((meal) => (
    String(meal?.tipo || meal?.type || meal?.mealType || "").trim().toLowerCase()
  )).filter(Boolean));
  const loggedMeals = trackingDay?.meals && typeof trackingDay.meals === "object"
    ? trackingDay.meals
    : {};
  // Al borrar una meta, el backend conserva una configuración sin `meta` para
  // que sus FoodLogs sigan teniendo nombre/tipo. Si luego regeneramos usando
  // ese mismo mealId, esa ficha histórica debe ser reemplazada por la nueva
  // meta, no viajar junto a ella. Dos configs con el mismo ID hacen que el
  // backend renombre una y separan artificialmente consumo y objetivo.
  const preserved = existingMeals.filter((meal) => {
    const id = mealConfigId(meal);
    if (isPersonalMealTargetConfig(meal) || claimedTargetIds.has(id)) return false;
    const type = String(meal?.tipo || meal?.type || meal?.mealType || "").trim().toLowerCase();
    const hasLogs = Array.isArray(loggedMeals[id]) && loggedMeals[id].length > 0;
    const structural = id === "picoteo"
      || id === "manual_completion_general"
      || id.startsWith("manual_completion_")
      || id.startsWith("daily_target_");
    const supersededEmptyMeal = targetTypes.has(type)
      && !targetHasNutrition(mealConfigTarget(meal))
      && !hasLogs
      && !structural;
    return !supersededEmptyMeal;
  });
  return [
    ...preserved,
    ...nextTargets.map((meal, index) => ({
      ...meal,
      orden: preserved.length + index,
    })),
  ];
}
