export const MAX_FLEXIBLE_CALORIES = 600;
export const CLOSE_CALORIE_TOLERANCE = 100;
export const MAX_CALORIE_SURPLUS_WARNING = 150;
export const MIN_PROTEIN_TARGET_RATIO = 0.8;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function round(value) {
  return Math.round(toNumber(value, 0) * 10) / 10;
}

export function normalizeNutritionTarget(source = {}) {
  const macros = source?.macrosObjetivo || source?.macros || source?.targetMacros || {};
  return {
    kcal: firstNumber(source?.kcal, source?.calories, source?.calorias, source?.targetCalories, source?.caloriasObjetivo),
    protein: firstNumber(source?.protein, source?.proteina, source?.p, macros?.protein, macros?.proteina, macros?.p),
    carbs: firstNumber(source?.carbs, source?.carbohidratos, source?.c, macros?.carbs, macros?.carbohidratos, macros?.c),
    fat: firstNumber(source?.fat, source?.grasas, source?.g, macros?.fat, macros?.grasas, macros?.g),
  };
}

export function normalizePlannedTotals(source = {}) {
  const totals = source?.totals || source?.totales || source?.macrosTotales || source || {};
  const macros = source?.macrosObjetivo || source?.macros || {};
  return {
    kcal: firstNumber(totals?.kcal, source?.kcal, source?.calories, source?.calorias, source?.plannedCalories),
    protein: firstNumber(
      totals?.protein,
      totals?.proteina,
      source?.protein,
      source?.proteina,
      source?.p,
      macros?.protein,
      macros?.proteina,
      macros?.p
    ),
    carbs: firstNumber(totals?.carbs, source?.carbs, source?.carbohidratos, source?.c, macros?.carbs, macros?.carbohidratos, macros?.c),
    fat: firstNumber(totals?.fat, totals?.grasas, source?.fat, source?.grasas, source?.g, macros?.fat, macros?.grasas, macros?.g),
  };
}

export function calculateMacroPending(menuTotals = {}, target = {}) {
  const menu = normalizePlannedTotals(menuTotals);
  const dayTarget = normalizeNutritionTarget(target);
  return {
    protein: round(Math.max(0, dayTarget.protein - menu.protein)),
    carbs: round(Math.max(0, dayTarget.carbs - menu.carbs)),
    fat: round(Math.max(0, dayTarget.fat - menu.fat)),
  };
}

export function getMenuDayCompatibility(menuTotals = {}, target = {}) {
  const menu = normalizePlannedTotals(menuTotals);
  const dayTarget = normalizeNutritionTarget(target);
  const kcalDiff = round(menu.kcal - dayTarget.kcal);
  const proteinDiff = round(menu.protein - dayTarget.protein);
  const deficitCalories = round(Math.max(0, dayTarget.kcal - menu.kcal));
  const surplusCalories = round(Math.max(0, menu.kcal - dayTarget.kcal));
  const proteinRatio = dayTarget.protein > 0 ? menu.protein / dayTarget.protein : 1;
  const proteinLow = dayTarget.protein > 0 && proteinRatio < MIN_PROTEIN_TARGET_RATIO;
  const proteinComplete = dayTarget.protein > 0 && menu.protein >= dayTarget.protein;
  const macroPending = calculateMacroPending(menu, dayTarget);

  const base = {
    menu,
    target: dayTarget,
    kcalDiff,
    proteinDiff,
    deficitCalories,
    surplusCalories,
    proteinLow,
    proteinComplete,
    macroPending,
    flexibleCalories: 0,
    requiresFlexibleConfirmation: false,
    canAssign: false,
  };

  if (!dayTarget.kcal || !dayTarget.protein) {
    return {
      ...base,
      key: "missing_target",
      label: "Sin meta",
      tone: "empty",
    };
  }

  if (Math.abs(kcalDiff) <= CLOSE_CALORIE_TOLERANCE) {
    return {
      ...base,
      key: proteinLow ? "compatible_protein_warning" : "compatible",
      label: proteinLow ? "Compatible con advertencia" : "Compatible",
      tone: proteinLow ? "review" : "good",
      canAssign: true,
    };
  }

  if (deficitCalories > 0) {
    if (deficitCalories <= MAX_FLEXIBLE_CALORIES) {
      return {
        ...base,
        key: proteinLow ? "flexible_protein_warning" : "flexible",
        label: "Compatible con margen flexible",
        tone: proteinLow ? "review" : "good",
        canAssign: true,
        flexibleCalories: deficitCalories,
        requiresFlexibleConfirmation: true,
      };
    }

    return {
      ...base,
      key: "deficit_excessive",
      label: "Incompatible",
      tone: "warning",
      flexibleCalories: deficitCalories,
    };
  }

  if (surplusCalories > 0) {
    if (surplusCalories <= MAX_CALORIE_SURPLUS_WARNING) {
      return {
        ...base,
        key: "surplus_warning",
        label: "Advertencia por exceso",
        tone: "warning",
        canAssign: true,
      };
    }

    return {
      ...base,
      key: "surplus_blocked",
      label: "Incompatible",
      tone: "warning",
    };
  }

  return {
    ...base,
    key: proteinLow ? "protein_warning" : "review",
    label: proteinLow ? "Compatible con advertencia" : "Revisar",
    tone: proteinLow ? "review" : "good",
    canAssign: true,
  };
}

export function buildFlexibleAssignmentMetadata(menuTotals = {}, target = {}, options = {}) {
  const compatibility = getMenuDayCompatibility(menuTotals, target);
  const flexibleCalories = compatibility.deficitCalories > 0 ? compatibility.deficitCalories : 0;

  return {
    assignmentType: options.assignmentType || "coach_menu",
    source: options.source || "coach",
    dayKey: options.dayKey || "",
    targetCalories: round(compatibility.target.kcal),
    plannedCalories: round(compatibility.menu.kcal),
    flexibleCalories,
    flexibleMode: flexibleCalories > 0 ? "free_margin" : "",
    flexibleLabel: flexibleCalories > 0 ? "Calorias libres" : "",
    macroPending: compatibility.macroPending,
    proteinWarning: compatibility.proteinLow,
    compatibility: {
      key: compatibility.key,
      label: compatibility.label,
      kcalDiff: compatibility.kcalDiff,
      proteinDiff: compatibility.proteinDiff,
      canAssign: compatibility.canAssign,
      flexibleCalories,
    },
  };
}

export function assignmentFlexibleCalories(entry = {}, target = {}, plannedTotals = {}) {
  const explicit = Number(entry?.flexibleCalories);
  if (Number.isFinite(explicit) && explicit > 0) return round(explicit);
  const targetCalories = firstNumber(entry?.targetCalories, normalizeNutritionTarget(target).kcal);
  const plannedSource = Object.keys(plannedTotals || {}).length ? plannedTotals : entry?.menuSnapshot || entry;
  const plannedCalories = firstNumber(entry?.plannedCalories, normalizePlannedTotals(plannedSource).kcal);
  const deficit = targetCalories - plannedCalories;
  return deficit > 0 ? round(deficit) : 0;
}

export function assignmentMacroPending(entry = {}, target = {}, plannedTotals = {}) {
  const pending = entry?.macroPending;
  if (pending && typeof pending === "object") {
    return {
      protein: round(toNumber(pending.protein ?? pending.proteina, 0)),
      carbs: round(toNumber(pending.carbs, 0)),
      fat: round(toNumber(pending.fat ?? pending.grasas, 0)),
    };
  }
  const plannedSource = Object.keys(plannedTotals || {}).length ? plannedTotals : entry?.menuSnapshot || entry;
  return calculateMacroPending(plannedSource, target);
}
