import { apiFetch } from "../Api.js";
import { menuToBasePayload, normalizeAssignedMenu, normalizeMenuBase } from "./menusUtils.js";

function qsFrom(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "todos") return;
    qs.set(key, String(value));
  });
  const out = qs.toString();
  return out ? `?${out}` : "";
}

export async function listMenusBase(filters = {}) {
  const data = await apiFetch(`/api/menus${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 12000,
  });

  const menus = Array.isArray(data?.menus) ? data.menus.map(normalizeMenuBase) : [];
  return {
    menus,
    total: data?.total ?? menus.length,
  };
}

export async function getMenuBase(menuId) {
  const data = await apiFetch(`/api/menus/${menuId}`, {
    method: "GET",
    timeoutMs: 12000,
  });
  return normalizeMenuBase(data?.menu || null);
}

export async function createMenuBase(payload) {
  const data = await apiFetch("/api/menus", {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return normalizeMenuBase(data?.menu || null);
}

export async function createMenuBaseFromDisplay(menu) {
  return await createMenuBase(menuToBasePayload(menu));
}

export async function updateMenuBase(menuId, payload) {
  const data = await apiFetch(`/api/menus/${menuId}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 14000,
  });
  return normalizeMenuBase(data?.menu || null);
}

export async function deleteMenuBase(menuId) {
  return await apiFetch(`/api/menus/${menuId}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}

export async function duplicateMenuBase(menuId, payload = {}) {
  const data = await apiFetch(`/api/menus/${menuId}/duplicar`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return normalizeMenuBase(data?.menu || null);
}

export async function assignMenuToClient(clientId, payload) {
  const data = await apiFetch(`/api/clientes/${clientId}/menus/asignar`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return normalizeAssignedMenu(data?.menu || null);
}

export async function listClientMenus(clientId, filters = {}) {
  const data = await apiFetch(`/api/clientes/${clientId}/menus${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 12000,
  });
  const menus = Array.isArray(data?.menus) ? data.menus.map(normalizeAssignedMenu) : [];
  return {
    menus,
    total: data?.total ?? menus.length,
  };
}

export async function getClientActiveMenu(clientId) {
  const data = await apiFetch(`/api/clientes/${clientId}/menus/activo`, {
    method: "GET",
    timeoutMs: 12000,
  });
  return normalizeAssignedMenu(data?.menu || null);
}

export async function getClientMenu(clientId, menuAsignadoId) {
  const data = await apiFetch(`/api/clientes/${clientId}/menus/${menuAsignadoId}`, {
    method: "GET",
    timeoutMs: 12000,
  });
  return normalizeAssignedMenu(data?.menu || null);
}

export async function updateClientMenu(clientId, menuAsignadoId, payload) {
  const data = await apiFetch(`/api/clientes/${clientId}/menus/${menuAsignadoId}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 15000,
  });
  return normalizeAssignedMenu(data?.menu || null);
}

export async function deleteClientMenu(clientId, menuAsignadoId) {
  return await apiFetch(`/api/clientes/${clientId}/menus/${menuAsignadoId}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}

export async function duplicateClientMenu(clientId, menuAsignadoId, payload = {}) {
  const data = await apiFetch(`/api/clientes/${clientId}/menus/${menuAsignadoId}/duplicar`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return normalizeAssignedMenu(data?.menu || null);
}

export async function saveClientMenuAsTemplate(clientId, menuAsignadoId, payload = {}) {
  const data = await apiFetch(`/api/clientes/${clientId}/menus/${menuAsignadoId}/guardar-como-template`, {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
  return normalizeMenuBase(data?.menu || null);
}

export async function getFoodEquivalents(payload) {
  return await apiFetch("/api/menus/alimentos/equivalentes", {
    method: "POST",
    body: payload,
    timeoutMs: 15000,
  });
}

export async function previewAdminMenusExcelImport(file, options = {}) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    form.append(key, String(value));
  });

  return await apiFetch("/api/menus/admin/importar-excel/preview", {
    method: "POST",
    body: form,
    timeoutMs: 30000,
  });
}

export async function confirmAdminMenusExcelImport(payload = {}) {
  return await apiFetch("/api/menus/admin/importar-excel/confirm", {
    method: "POST",
    body: payload,
    timeoutMs: 30000,
  });
}
