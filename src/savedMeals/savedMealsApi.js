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

export async function listSavedMeals(filters = {}) {
  return await apiFetch(`/api/comidas-guardadas${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

export async function getSavedMeal(id) {
  const data = await apiFetch(`/api/comidas-guardadas/${id}`, {
    method: "GET",
    timeoutMs: 12000,
  });
  return data?.comida || null;
}

export async function createSavedMeal(payload) {
  const data = await apiFetch("/api/comidas-guardadas", {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function updateSavedMeal(id, payload) {
  const data = await apiFetch(`/api/comidas-guardadas/${id}`, {
    method: "PUT",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function deleteSavedMeal(id) {
  return await apiFetch(`/api/comidas-guardadas/${id}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}

export async function duplicateSavedMeal(id, payload = {}) {
  const data = await apiFetch(`/api/comidas-guardadas/${id}/duplicar`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function toggleSavedMealFavorite(id, favorita = null) {
  const data = await apiFetch(`/api/comidas-guardadas/${id}/favorita`, {
    method: "POST",
    body: favorita === null ? {} : { favorita },
    timeoutMs: 12000,
  });
  return data?.comida || null;
}

export async function addSavedMealToTracking(id, payload = {}) {
  return await apiFetch(`/api/comidas-guardadas/${id}/agregar-a-tracking`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
}

export async function listProfessionalMealTemplates(filters = {}) {
  return await apiFetch(`/api/profesional/comidas-plantillas${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

export async function createProfessionalMealTemplate(payload) {
  const data = await apiFetch("/api/profesional/comidas-plantillas", {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function updateProfessionalMealTemplate(id, payload) {
  const data = await apiFetch(`/api/profesional/comidas-plantillas/${id}`, {
    method: "PUT",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function assignProfessionalMealTemplate(id, clientIds = []) {
  const data = await apiFetch(`/api/profesional/comidas-plantillas/${id}/asignar`, {
    method: "POST",
    body: { clientIds },
    timeoutMs: 14000,
  });
  return data?.comida || null;
}

export async function previewAdminSavedMealsExcelImport(file, options = {}) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, String(value));
  });

  return await apiFetch("/api/admin/comidas-globales/importar-excel/preview", {
    method: "POST",
    body: form,
    timeoutMs: 30000,
  });
}

export async function confirmAdminSavedMealsExcelImport(payload = {}) {
  return await apiFetch("/api/admin/comidas-globales/importar-excel/confirm", {
    method: "POST",
    body: payload,
    timeoutMs: 30000,
  });
}
