function value(number) {
  const parsed = Number(number);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 10) / 10) : 0;
}

export function normalizedTotals(input = {}) {
  return {
    kcal: value(input.kcal ?? input.calorias ?? input.calories),
    proteina: value(input.proteina ?? input.proteinas ?? input.protein),
    carbs: value(input.carbs ?? input.carbohidratos ?? input.carbohydrates),
    grasas: value(input.grasas ?? input.fat ?? input.fats),
  };
}

export function addDayFavoriteTotals(left = {}, right = {}) {
  const a = normalizedTotals(left);
  const b = normalizedTotals(right);
  return normalizedTotals({
    kcal: a.kcal + b.kcal,
    proteina: a.proteina + b.proteina,
    carbs: a.carbs + b.carbs,
    grasas: a.grasas + b.grasas,
  });
}

export function dayFavoriteCompatibility(plan = {}, target = {}) {
  const required = normalizedTotals(plan);
  const available = normalizedTotals(target);
  const difference = Math.round((available.kcal - required.kcal) * 10) / 10;
  return {
    allowed: difference >= -0.5,
    exact: Math.abs(difference) <= 0.5,
    required,
    target: available,
    extraFreeCalories: Math.max(0, difference),
    missingCalories: Math.max(0, -difference),
  };
}
