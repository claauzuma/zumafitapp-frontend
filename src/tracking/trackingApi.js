import { apiFetch } from "../Api.js";

function qsFrom(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, String(value));
  });
  const out = qs.toString();
  return out ? `?${out}` : "";
}

export async function getTrackingDay(date) {
  return await apiFetch(`/api/tracking/day${qsFrom({ date })}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

export async function getMenuTrackingWeek(start) {
  return await apiFetch(`/api/usuarios/me/menu-tracking/week${qsFrom({ start })}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

export async function addFoodLog(payload) {
  return await apiFetch("/api/tracking/day/logs", {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
}

export async function addCalculatedFoodLogs(payload) {
  return await apiFetch("/api/tracking/day/logs/calculated", {
    method: "POST",
    body: payload,
    timeoutMs: 18000,
  });
}

export async function updateManualDayCompletion(date, payload = {}) {
  return await apiFetch(`/api/usuarios/me/menu-tracking/day/${encodeURIComponent(date)}/completion`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 14000,
  });
}

export async function calculateTrackingQuantities(payload = {}) {
  return await apiFetch("/api/tracking/day/calculate-quantities", {
    method: "POST",
    body: payload,
    timeoutMs: 18000,
  });
}

export async function updateTrackingMealsConfig(payload) {
  return await apiFetch("/api/tracking/day/meals", {
    method: "PATCH",
    body: payload,
    timeoutMs: 14000,
  });
}

export async function deleteTrackingMeal(mealId, payload) {
  return await apiFetch(`/api/tracking/day/meals/${mealId}`, {
    method: "DELETE",
    body: payload,
    timeoutMs: 14000,
  });
}

export async function updateFoodLog(logId, payload) {
  return await apiFetch(`/api/tracking/day/logs/${logId}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 14000,
  });
}

export async function deleteFoodLog(logId) {
  return await apiFetch(`/api/tracking/day/logs/${logId}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}
