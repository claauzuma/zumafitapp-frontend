const KEYS = ["kcal", "proteina", "carbs", "grasas"];

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
};

export function registrationTotals(value = {}) {
  const source = value?.totals || value?.totales || value || {};
  return {
    kcal: round(source.kcal ?? source.calorias ?? source.calories, 1),
    proteina: round(source.proteina ?? source.proteinas ?? source.protein ?? source.p, 1),
    carbs: round(source.carbs ?? source.carbohidratos ?? source.carbohydrates ?? source.c, 1),
    grasas: round(source.grasas ?? source.grasa ?? source.fat ?? source.g, 1),
  };
}

export const TRACKING_PROTEIN_SHORTFALL_TOLERANCE_G = 4;

export function reviewTrackingRegistration({
  target = {},
  result = {},
  destinationLabel = "esta comida",
} = {}) {
  const available = registrationTotals(target);
  const actual = registrationTotals(result);
  const difference = Object.fromEntries(KEYS.map((key) => [key, round(actual[key] - available[key], 1)]));
  const kcalOverage = available.kcal > 0 ? Math.max(0, difference.kcal) : 0;
  const proteinShortfall = available.proteina > 0
    ? Math.max(0, round(available.proteina - actual.proteina, 1))
    : 0;
  const carbOverage = available.carbs > 0 ? Math.max(0, difference.carbs) : 0;
  const fatOverage = available.grasas > 0 ? Math.max(0, difference.grasas) : 0;
  const issues = [];

  if (kcalOverage > 1) {
    issues.push({
      code: "kcal_overage",
      severity: "over",
      label: "Calorías",
      difference: round(kcalOverage, 1),
      message: `Esta combinación supera ${destinationLabel} por ${round(kcalOverage, 1)} kcal.`,
    });
  }
  if (proteinShortfall > TRACKING_PROTEIN_SHORTFALL_TOLERANCE_G) {
    issues.push({
      code: "protein_shortfall",
      severity: "warning",
      label: "Proteína",
      difference: round(-proteinShortfall, 1),
      message: `Esta combinación queda ${round(proteinShortfall, 1)} g por debajo de la proteína objetivo.`,
    });
  }
  // Conserva los umbrales del semáforo de destinos existente.
  if (carbOverage > 10) {
    issues.push({
      code: "carb_overage",
      severity: "warning",
      label: "Carbohidratos",
      difference: round(carbOverage, 1),
      message: `Los carbohidratos superan lo disponible por ${round(carbOverage, 1)} g.`,
    });
  }
  if (fatOverage > 3) {
    issues.push({
      code: "fat_overage",
      severity: "warning",
      label: "Grasas",
      difference: round(fatOverage, 1),
      message: `Las grasas superan lo disponible por ${round(fatOverage, 1)} g.`,
    });
  }

  return {
    target: available,
    result: actual,
    difference,
    issues,
    acceptable: issues.length === 0,
    level: issues.some((issue) => issue.severity === "over")
      ? "over"
      : issues.length ? "warning" : "good",
  };
}

function destinationIdentity(destination = {}, index = 0) {
  return String(
    destination.executionId || destination.id || destination.menuMealId || `destination-${index + 1}`
  );
}

function destinationCapacity(destination = {}) {
  if (destination.kind === "free") {
    return Math.max(0, number(destination.remainingKcal));
  }
  return Math.max(0, number(destination?.remaining?.kcal));
}

function allocationTotals(totalValue, allocatedKcal, isLast = false, accumulated = {}) {
  const total = registrationTotals(totalValue);
  const ratio = total.kcal > 0 ? Math.max(0, allocatedKcal) / total.kcal : 0;
  const result = {
    kcal: round(allocatedKcal, 1),
    proteina: round(total.proteina * ratio, 1),
    carbs: round(total.carbs * ratio, 1),
    grasas: round(total.grasas * ratio, 1),
  };
  if (isLast) {
    for (const key of KEYS) {
      result[key] = round(total[key] - number(accumulated[key]), 1);
    }
  }
  return result;
}

function destinationNutritionScore(destination = {}, total = {}) {
  const baseScore = number(destination.fitScore);
  const remaining = registrationTotals(destination.remaining || {});
  if (!(total.kcal > 0) || !(total.proteina > 0) || !(remaining.proteina > 0)) {
    return baseScore;
  }
  const pieceKcal = Math.min(destination.capacity, total.kcal);
  const pieceProtein = total.proteina * (pieceKcal / total.kcal);
  const proteinDifference = Math.abs(remaining.proteina - pieceProtein);
  const withinTolerance = proteinDifference <= TRACKING_PROTEIN_SHORTFALL_TOLERANCE_G;
  const proteinOverage = Math.max(0, pieceProtein - remaining.proteina);
  return baseScore + (withinTolerance ? 30 : Math.max(0, 18 - proteinDifference)) - proteinOverage * 2;
}

/**
 * Reparte imputación presupuestaria. No crea ni divide FoodLogs.
 */
export function suggestTrackingAllocations({
  candidate = {},
  freeCalories = null,
  meals = [],
  preferredExecutionId = "",
} = {}) {
  const total = registrationTotals(candidate);
  const unique = new Map();
  const raw = [
    ...(freeCalories?.available ? [freeCalories] : []),
    ...(Array.isArray(meals) ? meals : []),
  ];

  raw.forEach((destination, index) => {
    const id = destinationIdentity(destination, index);
    if (!id || destination.completed === true || destination.status === "completed") return;
    const capacity = destinationCapacity(destination);
    if (!(capacity > 0) || unique.has(id)) return;
    unique.set(id, { ...destination, executionId: id, capacity });
  });

  const eligible = [...unique.values()].sort((left, right) => {
    const leftPreferred = left.executionId === preferredExecutionId ? 1 : 0;
    const rightPreferred = right.executionId === preferredExecutionId ? 1 : 0;
    if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;
    if (left.kind === "free" && right.kind !== "free") return -1;
    if (right.kind === "free" && left.kind !== "free") return 1;
    return destinationNutritionScore(right, total) - destinationNutritionScore(left, total);
  });

  let remainingKcal = Math.max(0, total.kcal);
  const draft = [];
  for (const destination of eligible) {
    if (remainingKcal <= 0.05) break;
    const kcal = Math.min(destination.capacity, remainingKcal);
    if (!(kcal > 0.05)) continue;
    draft.push({ destination, kcal: round(kcal, 1) });
    remainingKcal = round(remainingKcal - kcal, 1);
  }

  const valid = total.kcal > 0 && remainingKcal <= 0.1;
  const accumulated = { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };
  const allocations = draft.map((entry, index) => {
    const totals = allocationTotals(total, entry.kcal, valid && index === draft.length - 1, accumulated);
    for (const key of KEYS) accumulated[key] = round(accumulated[key] + totals[key], 1);
    return {
      kind: entry.destination.kind || "meal_target",
      executionId: entry.destination.executionId,
      label: entry.destination.label || "Comida",
      totals,
      target: registrationTotals(entry.destination.remaining || { kcal: entry.destination.remainingKcal }),
    };
  });

  return {
    valid,
    total,
    allocations,
    allocated: registrationTotals(accumulated),
    unallocatedKcal: Math.max(0, round(remainingKcal, 1)),
    eligible,
  };
}

export function allocationsSumExactly(plan = {}) {
  const total = registrationTotals(plan.total);
  const sum = (Array.isArray(plan.allocations) ? plan.allocations : []).reduce((acc, allocation) => {
    const value = registrationTotals(allocation.totals);
    for (const key of KEYS) acc[key] = round(acc[key] + value[key], 1);
    return acc;
  }, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  return KEYS.every((key) => Math.abs(sum[key] - total[key]) <= 0.1);
}
