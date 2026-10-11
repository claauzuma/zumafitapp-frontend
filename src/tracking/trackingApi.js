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

export async function addFoodLogsBatch(payload) {
  return await apiFetch("/api/tracking/day/logs/batch", {
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

export async function deleteTrackingMeals(payload = {}) {
  const mealIds = [...new Set(
    (Array.isArray(payload.mealIds) ? payload.mealIds : [])
      .map((mealId) => String(mealId || "").trim())
      .filter(Boolean)
  )];
  if (!mealIds.length) throw new Error("No hay comidas para eliminar.");

  let batchResponse = null;
  try {
    batchResponse = await apiFetch("/api/tracking/day/meals/batch", {
      method: "DELETE",
      body: { ...payload, mealIds },
      timeoutMs: 14000,
    });
  } catch (error) {
    if (![404, 405].includes(Number(error?.status))) throw error;
  }

  const acknowledgedIds = new Set(
    (Array.isArray(batchResponse?.deletedMealIds) ? batchResponse.deletedMealIds : [])
      .map((mealId) => String(mealId || ""))
  );
  const pendingIds = mealIds.filter((mealId) => !acknowledgedIds.has(mealId));
  if (!pendingIds.length) return batchResponse;

  // Compatibilidad temporal: un backend anterior puede interpretar literalmente
  // /meals/batch como si "batch" fuera el ID y devolver 200 sin borrar nada.
  // Si las metas siguen vacías, una sola actualización de mealsConfig las retira
  // de forma segura. Si contienen registros, volvemos al endpoint individual,
  // que además elimina esos FoodLogs y reconcilia sus allocations.
  const { mealIds: _ignoredMealIds, ...singlePayload } = payload;
  const mealsConfig = Array.isArray(batchResponse?.mealsConfig) ? batchResponse.mealsConfig : null;
  const mealsById = batchResponse?.meals && typeof batchResponse.meals === "object"
    ? batchResponse.meals
    : null;
  const pendingSet = new Set(pendingIds);
  const knownPendingIds = mealsConfig
    ? new Set(mealsConfig.map((meal) => String(meal?.mealId || meal?.id || "")))
    : new Set();
  const canRemoveEmptyConfigs = Boolean(
    mealsConfig &&
    mealsById &&
    pendingIds.every((mealId) => knownPendingIds.has(mealId)) &&
    pendingIds.every((mealId) => Array.isArray(mealsById[mealId]) && mealsById[mealId].length === 0)
  );
  if (canRemoveEmptyConfigs) {
    const response = await updateTrackingMealsConfig({
      ...singlePayload,
      mealsConfig: mealsConfig.filter((meal) => !pendingSet.has(String(meal?.mealId || meal?.id || ""))),
    });
    return {
      ...(response || {}),
      deletedMealIds: mealIds,
      deletionFallback: "empty_config_batch",
    };
  }

  let latestResponse = batchResponse;
  for (const mealId of pendingIds) {
    latestResponse = await deleteTrackingMeal(mealId, singlePayload);
  }
  return {
    ...(latestResponse || {}),
    deletedMealIds: mealIds,
    deletionFallback: "individual",
  };
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


export async function saveMenuTrackingDay(
  payload = {}
) {
  if (
    !payload ||
    !payload.date
  ) {
    throw new Error(
      "Falta la fecha del tracking del menú."
    );
  }

  return await apiFetch(
    "/api/usuarios/me/menu-tracking/day",
    {
      method: "POST",
      body: payload,
      timeoutMs: 12000,
    }
  );
}
