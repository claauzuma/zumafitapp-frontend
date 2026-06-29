import { apiFetch } from "./Api.js";

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const out = search.toString();
  return out ? `?${out}` : "";
}

export async function registerProfessionalApplication(payload) {
  return await apiFetch("/api/professional-applications", {
    method: "POST",
    body: payload,
    timeoutMs: 14000,
  });
}

export async function listAdminProfessionalApplications(filters = {}) {
  const data = await apiFetch(`/api/admin/professional-applications${qs(filters)}`, {
    method: "GET",
    timeoutMs: 10000,
  });
  return {
    applications: Array.isArray(data?.applications) ? data.applications : [],
    total: data?.total || 0,
  };
}

export async function patchAdminProfessionalApplication(id, payload) {
  const data = await apiFetch(`/api/admin/professional-applications/${id}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.application || data;
}

export async function getCoachSubscription() {
  return await apiFetch("/api/coaches/me/subscription", {
    method: "GET",
    timeoutMs: 10000,
  });
}

export async function createCoachSubscriptionRequest(payload) {
  const data = await apiFetch("/api/coaches/me/subscription-requests", {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.request || data;
}

export async function listAdminCoachSubscriptionRequests(filters = {}) {
  const data = await apiFetch(`/api/admin/coach-subscription-requests${qs(filters)}`, {
    method: "GET",
    timeoutMs: 10000,
  });
  return {
    requests: Array.isArray(data?.requests) ? data.requests : [],
    total: data?.total || 0,
  };
}

export async function approveAdminCoachSubscriptionRequest(id, payload = {}) {
  const data = await apiFetch(`/api/admin/coach-subscription-requests/${id}/approve`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.request || data;
}

export async function rejectAdminCoachSubscriptionRequest(id, payload = {}) {
  const data = await apiFetch(`/api/admin/coach-subscription-requests/${id}/reject`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.request || data;
}

export async function patchAdminCoachSubscription(coachId, payload = {}) {
  const data = await apiFetch(`/api/admin/coaches/${coachId}/subscription`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });
  return data?.subscription || data;
}

export async function listAdminAccessAuditEvents(filters = {}) {
  const data = await apiFetch(`/api/admin/access-audit-events${qs(filters)}`, {
    method: "GET",
    timeoutMs: 10000,
  });
  return {
    events: Array.isArray(data?.events) ? data.events : [],
    total: data?.total || 0,
  };
}
