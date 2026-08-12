import { createDailyTargetsDraft } from "../nutricion/dailyNutritionTargets.js";

function cleanId(value = "") {
  return String(value || "").trim();
}

export function nutritionDraftForMenuAssignment(client = {}) {
  const macros = client?.metasActuales?.macros || {};
  return {
    kcal: client?.metasActuales?.kcal || "",
    p: macros.p ?? macros.proteina ?? macros.protein ?? "",
    c: macros.c ?? macros.carbs ?? macros.carbohidratos ?? "",
    g: macros.g ?? macros.grasas ?? macros.fat ?? "",
    dailyTargets: createDailyTargetsDraft(client),
  };
}

export function resolveFreshAssignmentClient(clientId, detailResponse, { fetching = false } = {}) {
  if (!cleanId(clientId) || fetching) return null;
  const client = detailResponse?.client || null;
  const resolvedId = cleanId(client?.id || client?._id);
  return resolvedId && resolvedId === cleanId(clientId) ? client : null;
}
