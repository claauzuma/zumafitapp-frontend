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

export async function getProfessionalClients() {
  const data = await apiFetch("/api/usuarios/users/me/coach-clients", {
    method: "GET",
    timeoutMs: 10000,
  });

  return {
    coach: data?.coach || null,
    clients: Array.isArray(data?.clients) ? data.clients : [],
    total: data?.total ?? data?.clients?.length ?? 0,
  };
}

export async function getProfessionalClientDetail(clientId) {
  const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return {
    coach: data?.coach || null,
    client: data?.client || null,
  };
}

export async function updateProfessionalClientNutrition(clientId, payload) {
  const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}/nutrition`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });

  return {
    coach: data?.coach || null,
    client: data?.client || null,
  };
}

export async function updateProfessionalClientMenu(clientId, payload) {
  const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}/menu`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });

  return {
    coach: data?.coach || null,
    client: data?.client || null,
  };
}

export async function updateProfessionalClientRoutine(clientId, payload) {
  const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}/routine`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });

  return {
    coach: data?.coach || null,
    client: data?.client || null,
  };
}

export async function getProfessionalClientInvitations(filters = {}) {
  const data = await apiFetch(`/api/usuarios/users/me/client-invitations${qsFrom({
    search: filters.search || "",
    status: filters.status || "todos",
    limit: filters.limit || 100,
  })}`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return {
    invitations: Array.isArray(data?.invitations) ? data.invitations : [],
    total: data?.total ?? data?.invitations?.length ?? 0,
  };
}

export async function createProfessionalClientInvitation(payload) {
  const data = await apiFetch("/api/usuarios/users/me/client-invitations", {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });

  return {
    invitation: data?.invitation || null,
    capacity: data?.capacity || null,
  };
}

export async function cancelProfessionalClientInvitation(invitationId) {
  const data = await apiFetch(`/api/usuarios/users/me/client-invitations/${invitationId}/cancel`, {
    method: "PATCH",
    timeoutMs: 12000,
  });

  return data?.invitation || null;
}

export async function deleteProfessionalClientInvitation(invitationId) {
  return await apiFetch(`/api/usuarios/users/me/client-invitations/${invitationId}`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}
