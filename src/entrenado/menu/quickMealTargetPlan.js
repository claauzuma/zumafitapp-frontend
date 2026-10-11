import { plannedTargetWithFreeCalories } from "../../clientMenus/clientMenuGeneration.js";
import { buildDayDistribution } from "../../clientMenus/clientMenuDayPlanner.js";

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

const MACRO_KEYS = ["proteina", "carbs", "grasas"];
const KCAL_PER_GRAM = { proteina: 4, carbs: 4, grasas: 9 };
const FALLBACK_CALORIE_SHARES = { proteina: 0.3, carbs: 0.4, grasas: 0.3 };

export const MANUAL_MEAL_TARGET_OVERAGE_TOLERANCE = Object.freeze({
  kcal: 5,
  proteina: 10,
  carbs: 5,
  grasas: 5,
});

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
    meal.confirmed !== true && !explicitlyPreservedIds.has(String(meal.id))
  ));
  const fixedMeals = pendingMeals.filter((meal) => (
    meal.confirmed === true || explicitlyPreservedIds.has(String(meal.id))
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
    meals: meals.map((meal) => [meal.id, meal.confirmed === true, ...Object.values(normalizedTarget(meal.target))]),
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
    hasDifference: targetHasDifference(difference),
    hasResidual: targetHasDifference(residual),
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
    return meal?.personalTargetOnly === true && id.startsWith("menu_target_") ? [id] : [];
  }))];
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
  if (existing.length > types.length) {
    throw new Error(`Ya planificaste ${existing.length} comidas. Elegí al menos esa cantidad para conservarlas.`);
  }
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
  if (unmatched.length) {
    throw new Error(`Incluí ${unmatched.map((meal) => meal?.name || MEAL_LABELS[meal?.type] || "la comida planificada").join(", ")} entre los momentos elegidos para poder conservarla.`);
  }
  const existingTotals = personalMealTargetTotals(existing);
  const plannedTarget = normalizedTarget(accounting.generationTarget);
  for (const key of ["kcal", ...MACRO_KEYS]) {
    if (existingTotals[key] > plannedTarget[key] + 0.05) {
      throw new Error(`Las metas ya planificadas superan el objetivo disponible de ${key}. Editalas antes de generar el resto.`);
    }
  }
  const remainingTarget = Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [
    key,
    rounded(Math.max(0, plannedTarget[key] - existingTotals[key])),
  ]));
  const pendingTypes = slots.filter((slot) => !slot.existing).map((slot) => slot.type);
  if (!pendingTypes.length && Object.values(remainingTarget).some((value) => value > 0.05)) {
    throw new Error("Las comidas elegidas ya están planificadas, pero todavía queda objetivo sin asignar. Agregá otro momento o editá sus metas.");
  }
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
  const meals = slots.map((slot, index) => {
    if (slot.existing) return { ...slot.existing, personalTargetOnly: true, preserved: true };
    const allocationIndex = pendingIndex;
    pendingIndex += 1;
    return {
      id: `menu_target_${slot.type}_${index + 1}`,
      type: slot.type,
      name: MEAL_LABELS[slot.type] || `Comida ${index + 1}`,
      target: Object.fromEntries(["kcal", ...MACRO_KEYS].map((key) => [key, allocations[key][allocationIndex]])),
      personalTargetOnly: true,
      confirmed: false,
    };
  });
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
    mealId: meal?.preserved && String(meal?.id || meal?.mealId || "").startsWith("menu_target_")
      ? String(meal.id || meal.mealId)
      : `menu_target_${meal.type}_${suffix}_${index + 1}`,
    tipo: meal.type,
    nombre: meal.name || MEAL_LABELS[meal.type] || `Comida ${index + 1}`,
    orden: index,
    meta: normalizedTarget(meal.target),
    metaConfirmed: meal?.confirmed === true || meal?.metaConfirmed === true,
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
} = {}) {
  const currentMeals = (Array.isArray(meals) ? meals : []).map((meal) => ({
    ...meal,
    target: normalizedTarget(meal.target || meal.meta),
  }));
  const editedIndex = currentMeals.findIndex((meal) => String(meal.id || meal.mealId) === String(mealId));
  if (editedIndex < 0) throw new Error("No encontramos la comida que querés editar.");
  const normalizedNextTarget = normalizedTarget(target);
  const nextTarget = { ...normalizedNextTarget, kcal: Math.round(normalizedNextTarget.kcal) };
  if ([nextTarget.kcal, nextTarget.proteina, nextTarget.carbs, nextTarget.grasas].some((value) => value < 0)) {
    throw new Error("Las metas no pueden ser negativas.");
  }
  const macroKcal = rounded(nextTarget.proteina * 4 + nextTarget.carbs * 4 + nextTarget.grasas * 9);
  const beforeTotals = personalMealTargetTotals(currentMeals);
  const result = currentMeals.map((meal, index) => index === editedIndex ? { ...meal, target: nextTarget } : meal);

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
      confirmed: meal?.metaConfirmed === true || meal?.confirmed === true,
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
    metaConfirmed: false,
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
  const preserved = existingMeals.filter((meal) => !isPersonalMealTargetConfig(meal));
  return [
    ...preserved,
    ...(Array.isArray(targetConfigs) ? targetConfigs : []).map((meal, index) => ({
      ...meal,
      orden: preserved.length + index,
    })),
  ];
}
