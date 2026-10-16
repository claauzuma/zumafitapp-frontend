import { apiFetch } from "../../Api.js";

export async function listDayFavorites() {
  return await apiFetch("/api/clientes/me/day-favorites", { method: "GET", timeoutMs: 12000 });
}

export async function createDayFavorite(payload = {}) {
  return await apiFetch("/api/clientes/me/day-favorites", { method: "POST", body: payload, timeoutMs: 14000 });
}

export async function applyDayFavorite(id, date) {
  return await apiFetch(`/api/clientes/me/day-favorites/${encodeURIComponent(id)}/apply`, {
    method: "POST",
    body: { date },
    timeoutMs: 18000,
  });
}

export async function deleteDayFavorite(id) {
  return await apiFetch(`/api/clientes/me/day-favorites/${encodeURIComponent(id)}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}
