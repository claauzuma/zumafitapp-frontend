function mealConfigId(config = {}) {
  return String(config?.mealId || config?.id || config?.mealConfigId || "").trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasConfiguredTarget(config = {}) {
  const target = config?.meta || config?.target || {};
  return [
    target?.kcal ?? target?.calorias ?? target?.calories,
    target?.proteina ?? target?.proteinas ?? target?.protein ?? target?.p,
    target?.carbs ?? target?.carbohidratos ?? target?.carbohydrates ?? target?.c,
    target?.grasas ?? target?.grasa ?? target?.fat ?? target?.g,
  ].some((value) => Math.abs(number(value)) > 0.000001);
}

function mealConfigType(config = {}) {
  return String(config?.tipo || config?.type || config?.mealType || "")
    .trim()
    .toLowerCase();
}

function isPersonalTargetConfig(config = {}) {
  const id = mealConfigId(config);
  return config?.personalTarget === true || id.startsWith("menu_target_");
}

function isStructuralMealConfig(id = "") {
  return id === "picoteo"
    || id === "manual_completion_general"
    || id.startsWith("manual_completion_")
    || id.startsWith("daily_target_");
}

export function activePlanningMealIds(destinationResult = {}) {
  return new Set(
    (Array.isArray(destinationResult?.destinations) ? destinationResult.destinations : [])
      .flatMap((destination) => [
        destination?.executionId,
        destination?.menuMealId,
        destination?.mealTargetId,
      ])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
}

export function orphanedGeneratedMealConfigIds({
  trackingDay = {},
  destinationResult = {},
  draftMealIds = [],
} = {}) {
  const activeIds = activePlanningMealIds(destinationResult);
  const draftIds = new Set(
    (Array.isArray(draftMealIds) ? draftMealIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const meals = trackingDay?.meals && typeof trackingDay.meals === "object"
    ? trackingDay.meals
    : {};
  const configs = Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [];
  const personalTargetTypes = new Set(
    configs
      .filter((config) => isPersonalTargetConfig(config) && hasConfiguredTarget(config))
      .map(mealConfigType)
      .filter(Boolean)
  );

  return configs
    .filter((config) => {
      const id = mealConfigId(config);
      if (activeIds.has(id) || draftIds.has(id)) return false;
      if (hasConfiguredTarget(config)) return false;
      if (Array.isArray(meals[id]) && meals[id].length > 0) return false;

      // Los targets históricos sin contenido dejan una card fantasma cuando
      // ya no pertenecen a la planificación actual.
      if (id.startsWith("menu_target_")) return true;

      // Al pasar una comida libre/registrada a "Por meta", puede existir una
      // configuración vacía anterior del mismo momento. La meta nueva ya
      // representa ese momento; conservar ambas genera dos cards en Tracking.
      const type = mealConfigType(config);
      return Boolean(
        type
        && personalTargetTypes.has(type)
        && !isStructuralMealConfig(id)
      );
    })
    .map(mealConfigId);
}

