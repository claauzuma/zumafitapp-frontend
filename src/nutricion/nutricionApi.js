import { apiFetch } from "../Api.js";
import { filterFoods, filterMeals, normalizeFood, normalizeMeal } from "./nutricionUtils.js";

export async function listAlimentos(filters = {}) {
  const data = await apiFetch("/api/alimentos", {
    method: "GET",
    timeoutMs: 12000,
  });

  const foods = Array.isArray(data) ? data.map(normalizeFood) : [];
  return {
    alimentos: filterFoods(foods, filters),
    all: foods,
    total: foods.length,
  };
}

export async function listComidas(filters = {}, foods = []) {
  const data = await apiFetch("/api/comidas", {
    method: "GET",
    timeoutMs: 12000,
  });

  const rawMeals = Array.isArray(data?.comidas) ? data.comidas : [];
  const meals = rawMeals.map((meal) => normalizeMeal(meal, foods));
  return {
    comidas: filterMeals(meals, filters),
    all: meals,
    total: meals.length,
  };
}
