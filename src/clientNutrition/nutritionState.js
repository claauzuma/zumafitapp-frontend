export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function roundedNumber(value) {
  const number = toFiniteNumber(value);
  return number === null ? null : Math.round(number);
}

export function normalizeGoalFromUser(user = {}) {
  const safeUser = user && typeof user === "object" ? user : {};
  const metas = safeUser.metasActuales || safeUser.currentGoals || safeUser.objetivoActual || {};
  const macros = metas.macros || safeUser.macrosObjetivo || safeUser.goal?.macros || {};
  const goal = safeUser.goal || safeUser.objetivo || {};

  const kcal = roundedNumber(
    metas.kcal ??
      metas.calorias ??
      metas.calories ??
      goal.initialBudgetKcal ??
      goal.kcalObjetivo ??
      goal.caloriasObjetivo ??
      safeUser.objetivoCalorico
  );
  const p = roundedNumber(macros.p ?? macros.proteina ?? macros.proteinas ?? goal.proteinaObjetivo);
  const c = roundedNumber(macros.c ?? macros.carbs ?? macros.carbohidratos ?? goal.carbohidratosObjetivo);
  const g = roundedNumber(macros.g ?? macros.grasas ?? macros.grasa ?? goal.grasasObjetivo);

  return {
    kcal,
    p,
    c,
    g,
    configured: [kcal, p, c, g].some((value) => Number.isFinite(value) && value > 0),
    complete: [kcal, p, c, g].every((value) => Number.isFinite(value) && value > 0),
  };
}

export function normalizeTotals(value = {}) {
  const safeValue = value && typeof value === "object" ? value : {};
  const nested =
    safeValue.totals ||
    safeValue.totales ||
    safeValue.macrosTotales ||
    safeValue.macros ||
    safeValue.nutrition ||
    safeValue.nutricion ||
    {};
  return {
    kcal: toFiniteNumber(nested.kcal ?? nested.calories ?? nested.calorias ?? safeValue.kcal ?? safeValue.calories ?? safeValue.calorias) || 0,
    proteina: toFiniteNumber(
      nested.proteina ??
        nested.proteinas ??
        nested.protein ??
        safeValue.proteina ??
        safeValue.proteinas ??
        safeValue.protein ??
        safeValue.p
    ) || 0,
    carbs: toFiniteNumber(
      nested.carbs ??
        nested.carbohidratos ??
        nested.carbohydrates ??
        safeValue.carbs ??
        safeValue.carbohidratos ??
        safeValue.carbohydrates ??
        safeValue.c
    ) || 0,
    grasas: toFiniteNumber(
      nested.grasas ??
        nested.grasa ??
        nested.fat ??
        safeValue.grasas ??
        safeValue.grasa ??
        safeValue.fat ??
        safeValue.g
    ) || 0,
  };
}

export function totalsHaveValue(totals = {}) {
  const safeTotals = normalizeTotals(totals);
  return ["kcal", "proteina", "carbs", "grasas"].some((key) => Math.abs(safeTotals[key]) > 0.001);
}

export function mealFoodItems(meal = {}) {
  const safeMeal = meal && typeof meal === "object" ? meal : {};
  if (Array.isArray(safeMeal.items)) return safeMeal.items;
  if (Array.isArray(safeMeal.foods)) return safeMeal.foods;
  if (Array.isArray(safeMeal.alimentos)) return safeMeal.alimentos;
  if (Array.isArray(safeMeal.ingredientes)) return safeMeal.ingredientes;
  if (Array.isArray(safeMeal.ingredients)) return safeMeal.ingredients;
  return [];
}

export function mealHasFood(meal = {}) {
  if (mealFoodItems(meal).length > 0) return true;
  return totalsHaveValue(meal);
}

export function menuMeals(menu = {}) {
  const safeMenu = menu && typeof menu === "object" ? menu : {};
  if (Array.isArray(safeMenu.comidas)) return safeMenu.comidas;
  if (Array.isArray(safeMenu.meals)) return safeMenu.meals;
  if (Array.isArray(safeMenu.items)) return safeMenu.items;
  const days = safeMenu.dias && typeof safeMenu.dias === "object" ? Object.values(safeMenu.dias) : [];
  const dayMeals = days.flatMap((day) => {
    if (Array.isArray(day?.comidas)) return day.comidas;
    if (Array.isArray(day?.meals)) return day.meals;
    return [];
  });
  return dayMeals;
}

export function menuContentSummary(menu = {}) {
  const meals = menuMeals(menu);
  const mealsWithFood = meals.filter(mealHasFood);
  const totals = normalizeTotals(menu);
  return {
    meals,
    totalMealBlocks: meals.length || Number(menu?.cantidadComidas || 0) || 0,
    mealsWithFoodCount: mealsWithFood.length,
    hasFood: mealsWithFood.length > 0 || totalsHaveValue(totals),
    totals,
  };
}
