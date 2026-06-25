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

export async function getClientNutritionCapabilities() {
  const data = await apiFetch("/api/clientes/me/nutrition-capabilities", {
    method: "GET",
    timeoutMs: 10000,
  });
  if (data?.capabilities && typeof data.capabilities === "object") return data.capabilities;
  if (data && typeof data === "object" && (data.plan || data.limits || data.canTrack !== undefined)) return data;
  return null;
}

export async function listClientMenus(filters = {}) {
  return await apiFetch(`/api/clientes/me/menus${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

export async function getClientMenu(id) {
  const data = await apiFetch(`/api/clientes/me/menus/${id}`, {
    method: "GET",
    timeoutMs: 12000,
  });
  return data?.menu || null;
}

export async function createClientMenu(payload = {}) {
  const data = await apiFetch("/api/clientes/me/menus", {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.menu || null;
}

export async function updateClientMenu(id, payload = {}) {
  const data = await apiFetch(`/api/clientes/me/menus/${id}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.menu || null;
}

export async function deleteClientMenu(id, payload = {}) {
  return await apiFetch(`/api/clientes/me/menus/${id}`, {
    method: "DELETE",
    body: payload,
    timeoutMs: 12000,
  });
}

export async function duplicateClientMenu(id, payload = {}) {
  const data = await apiFetch(`/api/clientes/me/menus/${id}/duplicate`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return data?.menu || null;
}

export async function activateClientMenu(id) {
  return await apiFetch(`/api/clientes/me/menus/${id}/activate`, {
    method: "POST",
    timeoutMs: 12000,
  });
}

export async function deactivateClientMenu() {
  return await apiFetch("/api/clientes/me/menus/deactivate", {
    method: "POST",
    timeoutMs: 12000,
  });
}
