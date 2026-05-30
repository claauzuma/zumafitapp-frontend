import { apiFetch } from "../Api.js";

function qsFrom(filters = {}) {
  const qs = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    if (value === "todos" || value === 0) return;
    qs.set(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : "";
}

export async function listRutinas(filters = {}) {
  const data = await apiFetch(`/api/rutinas${qsFrom({ ...filters, includeDays: 1 })}`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return {
    rutinas: Array.isArray(data?.rutinas) ? data.rutinas : [],
    total: data?.total ?? data?.rutinas?.length ?? 0,
  };
}

export async function getRutina(id) {
  const data = await apiFetch(`/api/rutinas/${id}`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return data?.rutina || null;
}

export async function createRutina(payload) {
  const data = await apiFetch("/api/rutinas", {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });

  return data?.rutina || null;
}

export async function updateRutina(id, payload) {
  const data = await apiFetch(`/api/rutinas/${id}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });

  return data?.rutina || null;
}

export async function deleteRutina(id) {
  return await apiFetch(`/api/rutinas/${id}`, {
    method: "DELETE",
    timeoutMs: 10000,
  });
}

export async function duplicateRutina(id, payload = {}) {
  const data = await apiFetch(`/api/rutinas/${id}/duplicar`, {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });

  return data?.rutina || null;
}

export async function listEjercicios(filters = {}) {
  const data = await apiFetch(`/api/ejercicios${qsFrom(filters)}`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return {
    ejercicios: Array.isArray(data?.ejercicios) ? data.ejercicios : [],
    total: data?.total ?? data?.ejercicios?.length ?? 0,
  };
}

export async function createEjercicio(payload) {
  const data = await apiFetch("/api/ejercicios", {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });

  return data?.ejercicio || null;
}

export async function updateEjercicio(id, payload) {
  const data = await apiFetch(`/api/ejercicios/${id}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });

  return data?.ejercicio || null;
}

export async function deleteEjercicio(id) {
  return await apiFetch(`/api/ejercicios/${id}`, {
    method: "DELETE",
    timeoutMs: 10000,
  });
}

export async function getAssignableClients(scope = "coach", search = "") {
  if (scope === "admin") {
    const filters = {
      role: "cliente",
      limit: 300,
      ...(search ? { search } : {}),
    };
    const data = await apiFetch(`/api/usuarios/admin/users${qsFrom(filters)}`, {
      method: "GET",
      timeoutMs: 10000,
    });

    return {
      clients: Array.isArray(data?.users) ? data.users : [],
      total: data?.total ?? data?.users?.length ?? 0,
    };
  }

  const data = await apiFetch("/api/usuarios/users/me/coach-clients", {
    method: "GET",
    timeoutMs: 10000,
  });

  const clients = Array.isArray(data?.clients) ? data.clients : [];
  const normalizedSearch = String(search || "").trim().toLowerCase();
  const visible = normalizedSearch
    ? clients.filter((client) => {
        const email = String(client?.email || "").toLowerCase();
        const name = `${client?.profile?.nombre || ""} ${client?.profile?.apellido || ""}`.toLowerCase();
        return email.includes(normalizedSearch) || name.includes(normalizedSearch);
      })
    : clients;

  return {
    clients: visible,
    total: data?.total ?? visible.length,
  };
}

export async function assignRutinaToClient(clienteId, payload) {
  const data = await apiFetch(`/api/clientes/${clienteId}/rutinas/asignar`, {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });

  return data?.rutina || null;
}

export async function listClienteRutinas(clienteId) {
  const data = await apiFetch(`/api/clientes/${clienteId}/rutinas`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return {
    rutinas: Array.isArray(data?.rutinas) ? data.rutinas : [],
    total: data?.total ?? data?.rutinas?.length ?? 0,
  };
}

export async function getClienteRutinaActiva(clienteId) {
  const data = await apiFetch(`/api/clientes/${clienteId}/rutinas/activa`, {
    method: "GET",
    timeoutMs: 10000,
  });

  return data?.rutina || null;
}

export async function updateClienteRutina(clienteId, planId, payload) {
  const data = await apiFetch(`/api/clientes/${clienteId}/rutinas/${planId}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });

  return data?.rutina || null;
}

export async function deleteClienteRutina(clienteId, planId) {
  return await apiFetch(`/api/clientes/${clienteId}/rutinas/${planId}`, {
    method: "DELETE",
    timeoutMs: 10000,
  });
}
