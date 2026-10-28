import { apiFetch } from "../Api.js";
import { getCachedToken } from "../authCache.js";
import { buildFoodIndex, filterFoods, filterMeals, normalizeFood, normalizeMeal } from "./nutricionUtils.js";

const CUSTOM_FOODS_CACHE_MS = 60 * 1000;
let customFoodsCache = { token: null, expiresAt: 0, items: [] };
let customFoodsRequest = null;
let customFoodsRevision = 0;

function invalidateCustomFoodsCache() {
  customFoodsRevision += 1;
  customFoodsCache = { token: null, expiresAt: 0, items: [] };
  customFoodsRequest = null;
}

async function visibleCustomFoods() {
  const token = getCachedToken();
  if (!token) return [];
  if (customFoodsCache.token === token && Date.now() < customFoodsCache.expiresAt) {
    return customFoodsCache.items;
  }
  if (customFoodsRequest?.token === token) return await customFoodsRequest.promise;

  const revision = customFoodsRevision;
  const promise = apiFetch("/api/alimentos/personalizados", {
    method: "GET",
    timeoutMs: 12000,
  }).then((data) => {
    const items = Array.isArray(data?.items) ? data.items : [];
    if (revision === customFoodsRevision) {
      customFoodsCache = { token, expiresAt: Date.now() + CUSTOM_FOODS_CACHE_MS, items };
    }
    return items;
  }).catch((error) => {
    if ([401, 403, 404].includes(Number(error?.status))) return [];
    throw error;
  }).finally(() => {
    if (customFoodsRequest?.promise === promise) customFoodsRequest = null;
  });
  customFoodsRequest = { token, promise };
  return await promise;
}

function alimentosQuery(filters = {}) {
  const params = new URLSearchParams();
  params.set("view", "compact");
  const search = String(filters.search || filters.q || "").trim();
  const category = String(filters.category || filters.categoria || "").trim();
  const mode = String(filters.mode || filters.generationMode || "").trim().toUpperCase();
  const limit = Number(filters.limit);

  if (search) params.set("search", search);
  if (category && category !== "todos") params.set("category", category);
  if (["EXPLICIT_ONLY", "GENERIC", "DISABLED"].includes(mode)) params.set("mode", mode);
  if (Number.isFinite(limit) && limit > 0) params.set("limit", String(Math.min(Math.trunc(limit), 50)));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listAlimentos(filters = {}) {
  const mode = String(filters.mode || filters.generationMode || "").trim().toUpperCase();
  const includeCustom = filters.includeCustom !== false && (!mode || mode === "EXPLICIT_ONLY");
  const [data, customItems] = await Promise.all([
    apiFetch(`/api/alimentos/catalogo${alimentosQuery(filters)}`, {
      method: "GET",
      timeoutMs: 12000,
    }),
    includeCustom ? visibleCustomFoods() : Promise.resolve([]),
  ]);

  const globalFoods = Array.isArray(data) ? data.map(normalizeFood) : [];
  const customFoods = customItems.map(normalizeFood);
  const limit = Number(filters.limit);
  const foods = filterFoods([...globalFoods, ...customFoods], filters);
  const visibleFoods = Number.isFinite(limit) && limit > 0
    ? foods.slice(0, Math.min(Math.trunc(limit), 50))
    : foods;
  return {
    alimentos: visibleFoods,
    all: visibleFoods,
    total: visibleFoods.length,
  };
}

export async function listCustomFoods() {
  const data = await apiFetch("/api/alimentos/personalizados", {
    method: "GET",
    timeoutMs: 12000,
  });
  return {
    ...data,
    items: Array.isArray(data?.items) ? data.items.map(normalizeFood) : [],
  };
}

export async function createCustomFood(payload) {
  const data = await apiFetch("/api/alimentos/personalizados", {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });
  invalidateCustomFoodsCache();
  return normalizeFood(data?.alimento || {});
}

export async function updateCustomFood(foodId, payload) {
  const data = await apiFetch(`/api/alimentos/personalizados/${foodId}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  invalidateCustomFoodsCache();
  return normalizeFood(data?.alimento || {});
}

export async function deleteCustomFood(foodId) {
  const result = await apiFetch(`/api/alimentos/personalizados/${foodId}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
  invalidateCustomFoodsCache();
  return result;
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
