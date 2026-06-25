import { apiFetch } from "../Api.js";

function qsFrom(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "todos") return;
    qs.set(key, String(value));
  });
  const out = qs.toString();
  return out ? `?${out}` : "";
}

export async function listLibraryMeals(filters = {}) {
  return await apiFetch(`/api/nutricion/biblioteca/comidas${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

export async function listLibraryMenus(filters = {}) {
  return await apiFetch(`/api/nutricion/biblioteca/menus${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

export async function copyLibraryMeal(id, payload = {}) {
  const data = await apiFetch(`/api/nutricion/biblioteca/comidas/${id}/copiar-a-mis-comidas`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function copyLibraryMenu(id, payload = {}) {
  const data = await apiFetch(`/api/nutricion/biblioteca/menus/${id}/copiar-a-mis-menus`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.menu || null;
}

export async function setLibraryMealFavorite(id, favorite = true) {
  const data = await apiFetch(`/api/nutricion/biblioteca/comidas/${id}/favorita`, {
    method: favorite ? "POST" : "DELETE",
    timeoutMs: 12000,
  });
  return data?.comida || null;
}

export async function setLibraryMenuFavorite(id, favorite = true) {
  const data = await apiFetch(`/api/nutricion/biblioteca/menus/${id}/favorito`, {
    method: favorite ? "POST" : "DELETE",
    timeoutMs: 12000,
  });
  return data?.menu || null;
}

export async function assignLibraryMeal(id, clientIds = []) {
  const data = await apiFetch(`/api/profesional/biblioteca/comidas/${id}/asignar`, {
    method: "POST",
    body: { clientIds },
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function assignLibraryMenu(id, clientIds = []) {
  const data = await apiFetch(`/api/profesional/biblioteca/menus/${id}/asignar`, {
    method: "POST",
    body: { clientIds },
    timeoutMs: 14000,
  });
  return data?.menu || null;
}
