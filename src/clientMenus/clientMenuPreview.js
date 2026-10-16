import {
  MEAL_NUTRITION_CLASSIFICATION,
  adaptMealNutritionResult,
} from "../nutricion/mealNutritionResult.js";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reviewTraceEntry(preview = {}, index = 0, meal = null) {
  const trace = Array.isArray(preview?.generationMeta?.trace)
    ? preview.generationMeta.trace
    : [];
  const slotIndex = Number(meal?.plannerSlotIndex ?? index);
  return trace.find((entry) => Number(entry?.slotIndex) === slotIndex) || null;
}

function mealReviewAssessment(preview = {}, meal = {}, index = 0) {
  const trace = reviewTraceEntry(preview, index, meal);
  if (trace?.status === "preserved" && !meal?.nutrition && !meal?.classification) return null;
  const mealResult = adaptMealNutritionResult(meal);
  if (mealResult.classification || typeof meal?.usable === "boolean") return mealResult;
  const solverResult = adaptMealNutritionResult(trace?.solver || {});
  return solverResult.classification || typeof trace?.solver?.usable === "boolean"
    ? solverResult
    : null;
}

function uniqueReviewWarnings(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((warning, index) => typeof warning === "string"
      ? { code: `MENU_PREVIEW_WARNING_${index + 1}`, message: warning }
      : warning
    )
    .filter((warning) => String(warning?.message || warning?.summary || "").trim())
    .map((warning) => ({
      ...warning,
      message: String(warning.message || warning.summary).trim(),
    }))
    .filter((warning) => {
      const code = String(warning.code || "").trim();
      const mealType = String(warning.mealType || "").trim();
      const key = code ? `${code}:${mealType}` : `${warning.message}:${mealType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Presentación diaria derivada sólo del assessment central, sin tolerancias. */
export function generatedMenuReviewPresentation(preview = {}) {
  const assessmentEntries = (Array.isArray(preview?.comidas) ? preview.comidas : [])
    .map((meal, index) => ({
      meal,
      result: mealReviewAssessment(preview, meal, index),
    }))
    .filter((entry) => Boolean(entry.result));
  const assessments = assessmentEntries.map((entry) => entry.result);
  const hasNoSolution = assessments.some((result) => (
    result.classification === MEAL_NUTRITION_CLASSIFICATION.NO_SOLUTION ||
    result.usable === false
  ));
  const hasBestEffort = assessments.some((result) => (
    result.classification === MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT
  ));
  const allRecommended = assessments.length > 0 && assessments.every((result) => (
    result.classification === MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED &&
    result.usable === true
  ));
  const classification = hasNoSolution
    ? MEAL_NUTRITION_CLASSIFICATION.NO_SOLUTION
    : hasBestEffort
      ? MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT
      : allRecommended
        ? MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED
        : "UNKNOWN";
  const warnings = uniqueReviewWarnings([
    ...(Array.isArray(preview?.warnings) ? preview.warnings : []),
    ...assessmentEntries.map(({ meal, result }) => result.warning ? {
      ...result.warning,
      mealType: result.warning.mealType || meal?.tipoComida || meal?.mealType || "",
    } : null).filter(Boolean),
  ]);

  if (classification === MEAL_NUTRITION_CLASSIFICATION.NO_SOLUTION) {
    return {
      classification,
      tone: "danger",
      usable: false,
      label: "No utilizable",
      description: "No se obtuvo una propuesta utilizable. Generá otra opción para continuar.",
      warnings,
    };
  }
  if (classification === MEAL_NUTRITION_CLASSIFICATION.BEST_EFFORT) {
    return {
      classification,
      tone: "warning",
      usable: true,
      label: "Mejor opción disponible",
      description: "Podés usar este menú; revisá el aviso nutricional antes de continuar.",
      warnings,
    };
  }
  if (classification === MEAL_NUTRITION_CLASSIFICATION.RECOMMENDED) {
    return {
      classification,
      tone: "success",
      usable: true,
      label: "Recomendado",
      description: "Tu plan del día está listo para vos.",
      warnings,
    };
  }
  return {
    classification,
    tone: "neutral",
    usable: true,
    label: "Revisar",
    description: "Revisá el menú antes de usarlo.",
    warnings,
  };
}

export function generatedMenuTotals(menu = {}) {
  const reserved = Array.isArray(menu?.generationMeta?.reservedMealTargets)
    ? menu.generationMeta.reservedMealTargets
    : [];
  const aggregate = menu?.generationMeta?.resultTotals;
  if (reserved.length && aggregate && typeof aggregate === "object") {
    return {
      kcal: number(aggregate.kcal),
      proteina: number(aggregate.proteina),
      carbs: number(aggregate.carbs),
      grasas: number(aggregate.grasas),
    };
  }
  return (menu?.comidas || []).reduce((totals, meal) => {
    const items = Array.isArray(meal?.items)
      ? meal.items
      : Array.isArray(meal?.foods)
        ? meal.foods
        : Array.isArray(meal?.alimentos) ? meal.alimentos : [];
    return items.reduce((sum, item) => ({
    kcal: sum.kcal + number(item.kcal ?? item.calorias),
    proteina: sum.proteina + number(item.proteina ?? item.protein),
    carbs: sum.carbs + number(item.carbs ?? item.carbohidratos),
    grasas: sum.grasas + number(item.grasas ?? item.fat),
    }), totals);
  }, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

export function replaceGeneratedPreviewMeal(preview = {}, mealIndex = -1, replacement = null) {
  if (!replacement || !Array.isArray(preview?.comidas) || !preview.comidas[mealIndex]) return preview;
  const currentMeal = preview.comidas[mealIndex];
  return {
    ...preview,
    comidas: preview.comidas.map((meal, index) => index === mealIndex
      ? {
          ...replacement,
          id: currentMeal.id,
          orden: currentMeal.orden,
          nombre: currentMeal.nombre || replacement.nombre,
        }
      : meal),
  };
}

export function buildGeneratedMenuActivationPayload(preview = {}, target = null) {
  if (!generatedMenuReviewPresentation(preview).usable) {
    const error = new Error("La propuesta no es utilizable. Generá otra opción antes de activarla.");
    error.code = "MENU_PREVIEW_NO_SOLUTION";
    throw error;
  }
  const physicalMeals = (Array.isArray(preview?.comidas) ? preview.comidas : []).filter((meal) => {
    const items = Array.isArray(meal?.items)
      ? meal.items
      : Array.isArray(meal?.foods) ? meal.foods : [];
    return items.some((item) => Number(item?.cantidad ?? item?.quantity) > 0);
  });
  if (!physicalMeals.length) {
    const error = new Error("No hay comidas físicas para guardar. Generá alimentos antes de usar este menú.");
    error.code = "MENU_EMPTY_PREVIEW";
    throw error;
  }
  const clean = { ...preview };
  delete clean.focusName;
  delete clean.isActiveOwnMenu;
  const selectedTarget = target || clean.menuTarget || {};
  const payload = {
    ...clean,
    source: clean.source || "autonomous",
    activate: true,
    estrategiaObjetivo: "custom",
    kcalObjetivo: number(selectedTarget.kcal),
    macrosObjetivo: {
      proteina: number(selectedTarget.proteina ?? selectedTarget.p),
      carbs: number(selectedTarget.carbs ?? selectedTarget.c),
      grasas: number(selectedTarget.grasas ?? selectedTarget.g),
    },
  };
  delete payload.menuTarget;
  delete payload.objectiveMode;
  return payload;
}
