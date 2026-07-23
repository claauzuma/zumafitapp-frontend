import { apiFetch } from "../Api.js";

export async function listAdminUsers(filters = {}) {
  const qs = new URLSearchParams();
  const search = String(filters.search || "").trim();
  const role = String(filters.role || "todos").trim();
  const estado = String(filters.estado || "todos").trim();
  const limit = Number(filters.limit) || 100;

  if (search) qs.set("search", search);
  if (role && role !== "todos") qs.set("role", role);
  if (estado && estado !== "todos") qs.set("estado", estado);
  qs.set("limit", String(limit));

  const data = await apiFetch(`/api/usuarios/admin/users?${qs.toString()}`, {
    method: "GET",
    timeoutMs: 9000,
  });

  return {
    users: data?.users || data?.usuarios || data || [],
    total: data?.total ?? data?.count ?? null,
  };
}

export async function getAdminUserById(id) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}`, {
    method: "GET",
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function patchAdminUser(id, patch) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}`, {
    method: "PATCH",
    body: patch,
    timeoutMs: 12000,
  });
  return data?.user || data;
}

export async function updateAdminUserStatus(id, estado) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/status`, {
    method: "PATCH",
    body: { estado },
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function updateAdminUserPlan(id, plan) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/plan`, {
    method: "PATCH",
    body: { plan },
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function getAdminCoachPlans() {
  const data = await apiFetch("/api/usuarios/admin/coach-plans", {
    method: "GET",
    timeoutMs: 10000,
  });
  return data?.plans || [];
}

export async function updateAdminCoachPlanConfig(planCode, payload) {
  const data = await apiFetch(`/api/usuarios/admin/coach-plans/${planCode}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.plan || data;
}

export async function resetAdminCoachPlanConfig(planCode) {
  const data = await apiFetch(`/api/usuarios/admin/coach-plans/${planCode}/reset`, {
    method: "POST",
    body: {},
    timeoutMs: 12000,
  });
  return data?.plan || data;
}

export async function getAdminClientPlans() {
  const data = await apiFetch("/api/usuarios/admin/client-plans", {
    method: "GET",
    timeoutMs: 10000,
  });
  return data?.plans || [];
}

export async function updateAdminClientPlanConfig(planCode, payload) {
  const data = await apiFetch(`/api/usuarios/admin/client-plans/${planCode}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.plan || data;
}

export async function resetAdminClientPlanConfig(planCode) {
  const data = await apiFetch(`/api/usuarios/admin/client-plans/${planCode}/reset`, {
    method: "POST",
    body: {},
    timeoutMs: 12000,
  });
  return data?.plan || data;
}

export async function updateAdminCoachPlan(id, payload) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/coach-plan`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.user || data;
}

export async function getAdminCoachPlanPreview(id, payload = {}) {
  const qs = new URLSearchParams();
  qs.set("plan", String(payload.plan || "coach_initial"));
  qs.set("resetOverrides", payload.resetOverrides ? "true" : "false");
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/coach-plan-preview?${qs.toString()}`, {
    method: "GET",
    timeoutMs: 10000,
  });
  return data?.preview || data;
}

export async function updateAdminCoachOverrides(id, payload) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/coach-overrides`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.user || data;
}

export async function deleteAdminCoachOverrides(id) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/coach-overrides`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
  return data?.user || data;
}

export async function getAdminCoachEffectiveCapabilities(id) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/effective-capabilities`, {
    method: "GET",
    timeoutMs: 10000,
  });
  return data?.effectiveCapabilities || null;
}

export async function updateAdminUserGoals(id, payload) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/goals`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.user || data;
}

export async function updateAdminUserDailyGoals(id, metasDiarias) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/daily-goals`, {
    method: "PATCH",
    body: { metasDiarias },
    timeoutMs: 12000,
  });
  return data?.user || data;
}

export async function assignCoachToClient(id, coachId) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/assign-coach`, {
    method: "PATCH",
    body: { coachId },
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function unassignCoachFromClient(id) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/unassign-coach`, {
    method: "PATCH",
    body: {},
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function getAdminCoachClients(id) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/clients`, {
    method: "GET",
    timeoutMs: 10000,
  });
  return {
    coach: data?.coach || null,
    clients: data?.clients || [],
    total: data?.total || 0,
  };
}

export async function updateAdminCoachProfile(id, payload) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/coach-profile`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function updateAdminCoachCapabilities(id, payload) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/coach-capabilities`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function getAdminCoaches(search = "") {
  const qs = new URLSearchParams();
  if (search.trim()) qs.set("search", search.trim());

  const data = await apiFetch(`/api/usuarios/admin/coaches?${qs.toString()}`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return data?.coaches || [];
}

export async function getAdminUnassignedClients(search = "") {
  const qs = new URLSearchParams();
  if (search.trim()) qs.set("search", search.trim());

  const data = await apiFetch(`/api/usuarios/admin/clients/unassigned?${qs.toString()}`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return data?.clients || [];
}

export async function resetAdminUserOnboarding(id) {
  const data = await apiFetch(`/api/usuarios/admin/users/${id}/reset-onboarding`, {
    method: "PATCH",
    body: {},
    timeoutMs: 10000,
  });
  return data?.user || data;
}

export async function deleteAdminUser(id) {
  return await apiFetch(`/api/usuarios/admin/users/${id}`, {
    method: "DELETE",
    timeoutMs: 10000,
  });
}
