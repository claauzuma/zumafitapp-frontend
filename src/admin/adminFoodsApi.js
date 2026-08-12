import { apiFetch } from "../Api.js";
import { buildAdminFoodsQuery } from "./adminFoodsParams.js";

export async function getAdminFoods(filters = {}) {
  const query = buildAdminFoodsQuery(filters);
  return apiFetch(`/api/admin/alimentos${query ? `?${query}` : ""}`, {
    method: "GET",
    timeoutMs: 20000,
  });
}

export async function updateAdminFoodGeneration(foodId, generation) {
  return apiFetch(`/api/admin/alimentos/${encodeURIComponent(foodId)}/generation`, {
    method: "PATCH",
    body: { generation },
    timeoutMs: 20000,
  });
}

export async function createAdminFood(food) {
  return apiFetch("/api/admin/alimentos", {
    method: "POST",
    body: food,
    timeoutMs: 20000,
  });
}
