function explicitMealId(meal = {}) {
  return String(meal?.id || meal?._id || meal?.mealId || "").trim();
}

function mealName(meal = {}) {
  return String(meal?.nombre || meal?.name || meal?.label || "").trim().toLowerCase();
}

/**
 * Resuelve una entrada del plan por identidad. El índice sólo se usa para
 * datos legacy donde la comida abierta no trae ningún identificador estable.
 */
export function resolveMealTargetPlanEntry(row = {}, baseMeal = {}, mealIndex = 0) {
  const plan = row?.mealTargetPlan;
  if (plan?.mode !== "per_meal" || !Array.isArray(plan.meals)) return null;

  const stableId = explicitMealId(baseMeal);
  if (stableId) {
    return plan.meals.find((entry) => explicitMealId(entry) === stableId) || null;
  }

  const stableName = mealName(baseMeal);
  if (stableName) {
    const matchingNames = plan.meals.filter((entry) => mealName(entry) === stableName);
    if (matchingNames.length === 1) return matchingNames[0];
  }

  return plan.meals[mealIndex] || null;
}

export function mealTargetExecutionSeed({
  baseMeal = {},
  meal = {},
  planned = {},
  mealIndex = 0,
} = {}) {
  return (
    explicitMealId(baseMeal) ||
    explicitMealId(meal) ||
    explicitMealId(planned) ||
    `slot_${mealIndex + 1}`
  );
}

export function buildNativeMealTargetDrawerContext({
  row = {},
  meal = {},
  mealIndex = 0,
  openFoodPicker = false,
} = {}) {
  return {
    row,
    meal,
    baseMeal: meal,
    mealIndex,
    action: "native_target",
    nativeTarget: true,
    ...(openFoodPicker ? { openFoodPicker: true } : {}),
  };
}
