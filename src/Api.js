// src/Api.js
import { API_BASE } from "./apiCredentials";

function buildUrl(path) {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function apiFetch(path, options = {}) {
  // ✅ Si no hay API configurada, no llamar
  if (!API_BASE || String(API_BASE).trim() === "") {
    // Opción A: devolver null (silencioso)
    return null;

    // Opción B: lanzar un error claro (recomendado si querés detectar rápido)
    // throw new Error("API deshabilitada (API_BASE vacío).");
  }

  const url = buildUrl(path);
  const isFormData = options.body instanceof FormData;

  const res = await fetch(url, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const msg = data?.error || data?.message || `Error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}
