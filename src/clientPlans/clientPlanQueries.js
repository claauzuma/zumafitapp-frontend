import { getClientNutritionCapabilities, listClientMenus } from "../clientMenus/clientMenusApi.js";
import {
  extractCapabilities,
  normalizeCapabilities,
  resolveEffectiveClientNutritionCapabilities,
  responseShape,
} from "./clientPlanUtils.js";

export const clientPlanCapabilitiesKey = ["client", "nutritionCapabilities"];
export const clientPlanMenusUsageKey = ["client", "planMenusUsage"];

export function logClientPlanQueryError(request, error) {
  if (!import.meta.env?.DEV) return;
  console.warn("[ClientPlans] request failed", {
    request,
    status: error?.status ?? "unknown",
    code: error?.code,
    message: error?.message,
    error: error?.error,
  });
}

function debugClientPlanRequest(label, meta = {}) {
  if (!import.meta.env?.DEV) return;
  console.debug(`[ClientPlans] ${label}`, meta);
}

export async function fetchClientPlanCapabilities() {
  const resolved = await resolveEffectiveClientNutritionCapabilities({
    fetchDirect: getClientNutritionCapabilities,
    fetchMenusFallback: () => listClientMenus({ includeComidas: false, limit: 1 }),
    logger: (stage, meta) => debugClientPlanRequest(stage, meta),
  });
  const finalCapabilities = { ...resolved.capabilities, _source: resolved.source };
  debugClientPlanRequest("final resolved data", {
    source: resolved.source,
    plan: finalCapabilities.plan,
    hasCapabilities: true,
    limits: finalCapabilities.limits,
  });
  return finalCapabilities;
}

export async function fetchClientPlanMenusUsage() {
  try {
    const data = await listClientMenus({ includeComidas: false, limit: 1 });
    const { capabilities } = normalizeCapabilities(extractCapabilities(data));
    debugClientPlanRequest("menus usage request", {
      url: "/api/clientes/me/menus?includeComidas=false&limit=1",
      status: 200,
      responseShape: responseShape(data),
      hasCapabilities: !!capabilities,
    });
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      pagination: data?.pagination && typeof data.pagination === "object" ? data.pagination : null,
      activeMenu: data?.activeMenu || null,
      capabilities,
    };
  } catch (error) {
    logClientPlanQueryError("GET /api/clientes/me/menus?includeComidas=false&limit=1", error);
    throw error;
  }
}

// Compatibilidad para imports anteriores: ahora esta query representa solo el uso secundario.
export const clientPlanSummaryKey = clientPlanMenusUsageKey;

export async function fetchClientPlanSummary() {
  return await fetchClientPlanMenusUsage();
}
