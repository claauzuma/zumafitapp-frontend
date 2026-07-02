import { getClientNutritionCapabilities, listClientMenus } from "../clientMenus/clientMenusApi.js";
import { apiFetch } from "../Api.js";
import { queryClient } from "../queryClient.js";
import {
  capabilitiesFromAccessContext,
  extractCapabilities,
  extractAccessContext,
  normalizeCapabilities,
  resolveEffectiveClientNutritionCapabilities,
  responseShape,
} from "./clientPlanUtils.js";

export const clientAccessContextKey = ["client", "access-context"];
export const clientPlanCapabilitiesKey = ["client", "nutritionCapabilities"];
export const clientPlanMenusUsageKey = ["client", "planMenusUsage"];
export const CLIENT_ACCESS_CONTEXT_STALE_TIME = 30 * 1000;
export const CLIENT_PLAN_CAPABILITIES_STALE_TIME = 2 * 60 * 1000;

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

export async function fetchClientAccessContext() {
  try {
    const data = await apiFetch("/api/clientes/me/access-context", {
      method: "GET",
      timeoutMs: 10000,
    });
    const accessContext = extractAccessContext(data);
    if (!accessContext) {
      const error = new Error("ACCESS_CONTEXT_INVALID");
      error.status = 200;
      throw error;
    }
    debugClientPlanRequest("access context", {
      url: "/api/clientes/me/access-context",
      status: 200,
      primaryAccess: accessContext.primaryAccess?.id,
      personalPlan: accessContext.personalPlan,
      effectivePersonalPlan: accessContext.effectivePersonalPlan,
    });
    return accessContext;
  } catch (error) {
    logClientPlanQueryError("GET /api/clientes/me/access-context", error);
    throw error;
  }
}

export async function fetchClientPlanCapabilities() {
  const cachedAccessContext = queryClient.getQueryData(clientAccessContextKey);
  const cachedCapabilities = capabilitiesFromResolvedAccess(cachedAccessContext);
  if (cachedCapabilities) {
    debugClientPlanRequest("capabilities from access-context cache", {
      source: "access-context-cache",
      plan: cachedCapabilities.plan,
      hasCapabilities: true,
      limits: cachedCapabilities.limits,
    });
    return cachedCapabilities;
  }

  try {
    const accessContext = await fetchClientAccessContext();
    queryClient.setQueryData(clientAccessContextKey, accessContext);
    const capabilities = capabilitiesFromResolvedAccess(accessContext);
    if (capabilities) {
      debugClientPlanRequest("capabilities from access-context cache", {
        source: "access-context",
        plan: capabilities.plan,
        hasCapabilities: true,
        limits: capabilities.limits,
      });
      return capabilities;
    }
  } catch (error) {
    debugClientPlanRequest("access-context primary failed, trying fallback", {
      status: error?.status ?? "unknown",
      code: error?.code,
      message: error?.message,
    });
  }

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

export function capabilitiesFromResolvedAccess(accessContext = null) {
  const capabilities = capabilitiesFromAccessContext(accessContext);
  if (!capabilities) return null;
  return { ...capabilities, _source: "access-context" };
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

export async function startClientProTrial() {
  try {
    const data = await apiFetch("/api/clientes/me/trial/activate", {
      method: "POST",
      timeoutMs: 12000,
    });
    const accessContext = extractAccessContext(data);
    if (!accessContext) {
      const error = new Error("ACCESS_CONTEXT_INVALID");
      error.status = 200;
      throw error;
    }
    debugClientPlanRequest("trial activation success", {
      url: "/api/clientes/me/trial/activate",
      status: 200,
      trialStatus: accessContext.trial?.status,
      effectiveAccess: accessContext.effectiveAccess?.id,
    });
    return accessContext;
  } catch (error) {
    logClientPlanQueryError("POST /api/clientes/me/trial/activate", error);
    throw error;
  }
}

export async function acknowledgeClientTrialOnboardingOffer() {
  const data = await apiFetch("/api/clientes/me/trial/onboarding-offer/ack", {
    method: "POST",
    timeoutMs: 12000,
  });
  const accessContext = extractAccessContext(data);
  if (!accessContext) {
    const error = new Error("ACCESS_CONTEXT_INVALID");
    error.status = 200;
    throw error;
  }
  return accessContext;
}

export async function acknowledgeClientTrialExpiryNotice() {
  const data = await apiFetch("/api/clientes/me/trial/expiry-notice/ack", {
    method: "POST",
    timeoutMs: 12000,
  });
  const accessContext = extractAccessContext(data);
  if (!accessContext) {
    const error = new Error("ACCESS_CONTEXT_INVALID");
    error.status = 200;
    throw error;
  }
  return accessContext;
}

export async function createClientPlanChangeRequest(requestedPlan) {
  const data = await apiFetch("/api/clientes/me/plan-change-requests", {
    method: "POST",
    body: { requestedPlan },
    timeoutMs: 12000,
  });
  return data;
}

// Compatibilidad para imports anteriores: ahora esta query representa solo el uso secundario.
export const clientPlanSummaryKey = clientPlanMenusUsageKey;

export async function fetchClientPlanSummary() {
  return await fetchClientPlanMenusUsage();
}
