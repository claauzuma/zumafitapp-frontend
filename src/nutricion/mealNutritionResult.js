export const MEAL_NUTRITION_POLICY = "meal_generation_balanced_v1";

export const MEAL_NUTRITION_CLASSIFICATION = Object.freeze({
  RECOMMENDED: "RECOMMENDED",
  BEST_EFFORT: "BEST_EFFORT",
  NO_SOLUTION: "NO_SOLUTION",
});

const KNOWN_CLASSIFICATIONS = new Set(Object.values(MEAL_NUTRITION_CLASSIFICATION));

function object(value) {
  return value && typeof value === "object" ? value : null;
}

function boolean(...values) {
  return values.find((value) => typeof value === "boolean");
}

function classification(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (KNOWN_CLASSIFICATIONS.has(normalized)) return normalized;
  if (normalized === "TARGET_REACHED") return MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED;
  return null;
}

function nutritionValues(value = {}) {
  const source = object(value?.totals) || object(value?.totales) || object(value?.macros) || object(value) || {};
  const number = (candidate) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    kcal: number(source.kcal ?? source.calorias ?? source.calories),
    proteina: number(source.proteina ?? source.proteinas ?? source.protein ?? source.p),
    carbs: number(source.carbs ?? source.carbohidratos ?? source.carbohydrates ?? source.c),
    grasas: number(source.grasas ?? source.grasa ?? source.fat ?? source.g),
  };
}

function warningReason(reason) {
  if (typeof reason === "string") return reason.trim();
  return String(reason?.message || reason?.summary || reason?.text || "").trim();
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function normalizeMealNutritionWarning(value = null) {
  const warning = object(value);
  if (!warning) return null;
  const reasons = uniqueStrings(
    (Array.isArray(warning.reasons) ? warning.reasons : []).map(warningReason)
  );
  const reasonCodes = uniqueStrings([
    ...(Array.isArray(warning.reasonCodes) ? warning.reasonCodes : []),
    ...(Array.isArray(warning.codes) ? warning.codes : []),
  ]);
  const message = String(warning.message || "").trim();
  const summary = String(warning.summary || message || "").trim();
  return {
    ...warning,
    code: String(warning.code || "").trim(),
    category: String(warning.category || "nutrition").trim() || "nutrition",
    severity: String(warning.severity || "warning").trim() || "warning",
    title: String(warning.title || "").trim(),
    summary,
    message: message || summary,
    reasons,
    reasonCodes,
  };
}

/**
 * Adapta exclusivamente el contrato calculado por backend. Esta capa no tiene
 * tolerancias ni vuelve a clasificar kcal, proteina, carbohidratos o grasas.
 */
export function adaptMealNutritionResult(responseValue = {}, alternativeValue = null) {
  const response = object(responseValue) || {};
  const alternative = object(alternativeValue) || object(response.alternative) || (
    Array.isArray(response.foods) ? response : null
  );
  const nutrition = object(alternative?.nutrition) ||
    object(response.nutrition) ||
    object(alternative?.optimization?.nutritionAssessment) ||
    object(response.optimization?.nutritionAssessment);

  const explicitClassification = classification(
    nutrition?.classification ?? nutrition?.status ??
    alternative?.classification ?? alternative?.status ??
    response.classification ?? response.status
  );
  const responseStatus = String(response.status || "").trim().toUpperCase();
  const alternativeStatus = String(alternative?.status || "").trim().toUpperCase();
  const recommended = boolean(
    nutrition?.recommended,
    alternative?.recommended,
    response.recommended
  );
  const resolvedClassification = explicitClassification || (
    responseStatus === "NO_SOLUTION"
      ? MEAL_NUTRITION_CLASSIFICATION.NO_SOLUTION
      : recommended === true
        ? MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED
        : alternativeStatus === "BEST_EFFORT"
          ? MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT
          : null
  );
  const explicitUsable = boolean(nutrition?.usable, alternative?.usable, response.usable);
  const usable = resolvedClassification === MEAL_NUTRITION_CLASSIFICATION.NO_SOLUTION
    ? false
    : explicitUsable ?? (
      resolvedClassification === MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED ||
      resolvedClassification === MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT
    );
  const warning = normalizeMealNutritionWarning(nutrition?.warning);

  return {
    contractPresent: Boolean(nutrition),
    policy: String(nutrition?.policy || alternative?.optimization?.policy || "").trim() || null,
    classification: resolvedClassification,
    status: resolvedClassification,
    recommended: recommended ?? resolvedClassification === MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED,
    usable,
    target: nutritionValues(nutrition?.target || alternative?.target || response.target),
    totals: nutritionValues(nutrition?.totals || alternative?.totals || response.totals),
    difference: nutritionValues(nutrition?.difference || alternative?.difference || response.difference),
    warning,
    raw: nutrition,
  };
}

export function mealNutritionDecisionWarning(resultValue = {}) {
  const result = resultValue?.contractPresent === true || resultValue?.classification
    ? resultValue
    : adaptMealNutritionResult(resultValue);
  if (
    result.classification !== MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT ||
    result.usable !== true
  ) return null;

  const warning = normalizeMealNutritionWarning(result.warning) || {};
  const summary = warning.summary ||
    "Es la mejor alternativa disponible, aunque no coincide por completo con la meta.";
  const reasons = warning.reasons?.length
    ? warning.reasons
    : warning.message && warning.message !== summary
      ? [warning.message]
      : [summary];
  const codes = uniqueStrings([
    warning.code || "MEAL_NUTRITION_BEST_EFFORT",
    ...(warning.reasonCodes || []),
  ]);
  return {
    title: warning.title || "Revisá esta alternativa",
    summary,
    reasons,
    codes,
    target: nutritionValues(result.target),
    proposal: nutritionValues(result.totals),
    difference: nutritionValues(result.difference),
    warning,
  };
}
