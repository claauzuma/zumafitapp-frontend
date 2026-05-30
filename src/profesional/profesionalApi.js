import { apiFetch } from "../Api.js";

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
