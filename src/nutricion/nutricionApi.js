import { apiFetch } from "../Api.js";
import { buildFoodIndex, filterFoods, filterMeals, normalizeFood, normalizeMeal } from "./nutricionUtils.js";

function alimentosQuery(filters = {}) {
  const params = new URLSearchParams();
  const search = String(filters.search || filters.q || "").trim();
  const category = String(filters.category || filters.categoria || "").trim();
  const limit = Number(filters.limit);

  if (search) params.set("search", search);
  if (category && category !== "todos") params.set("category", category);
  if (Number.isFinite(limit) && limit > 0) params.set("limit", String(Math.min(Math.trunc(limit), 50)));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listAlimentos(filters = {}) {
  const data = await apiFetch(`/api/alimentos${alimentosQuery(filters)}`, {
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
  const params = new URLSearchParams();
  const scope = String(filters.scope || "").trim();
  const search = String(filters.search || "").trim();
  if (scope) params.set("scope", scope);
  if (search) params.set("search", search);
  const query = params.toString();
  const data = await apiFetch(`/api/comidas${query ? `?${query}` : ""}`, {
    method: "GET",
    timeoutMs: 12000,
  });

  const rawMeals = Array.isArray(data?.comidas) ? data.comidas : [];
  const foodIndex = buildFoodIndex(foods);
  const meals = rawMeals.map((meal) => normalizeMeal(meal, foodIndex));
  return {
    comidas: filterMeals(meals, filters),
    all: meals,
    total: meals.length,
  };
}

export async function getComida(comidaId, foods = []) {
  const data = await apiFetch(`/api/comidas/${comidaId}`, {
    method: "GET",
    timeoutMs: 12000,
  });
  return normalizeMeal(data?.comida || null, buildFoodIndex(foods));
}

export async function createComida(payload) {
  const data = await apiFetch("/api/comidas", {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function updateComida(comidaId, payload) {
  const data = await apiFetch(`/api/comidas/${comidaId}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function deleteComida(comidaId) {
  return await apiFetch(`/api/comidas/${comidaId}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}

export async function duplicateComida(comidaId, payload = {}) {
  const data = await apiFetch(`/api/comidas/${comidaId}/duplicar`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function generateMealQuantities(payload = {}) {
  return await apiFetch("/api/alimentos/generar-cantidades", {
    method: "POST",
    body: payload,
    timeoutMs: 18000,
  });
}
