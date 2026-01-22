// src/Api.js
import { API_BASE } from "./apiCredentials";
import { getCachedToken } from "./authCache.js";

function joinUrl(base, path) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

// ✅ helper: token fallback (por si el navegador no guarda cookies)
function getAuthToken() {
  try {
    return getCachedToken(); // ✅ viene de authCache (auth_token_v1)
  } catch {
    return null;
  }
}

// ✅ helper: setear Authorization sin pisar si ya existe
function withAuthHeader(headers = {}) {
  const h = { ...headers };

  // si ya viene authorization, no tocamos
  if (h.Authorization || h.authorization) return h;

  const token = getAuthToken();
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }

  return h;
}

export async function apiFetch(path, options = {}) {
  const url = joinUrl(API_BASE, path);

  const {
    method = "GET",
    headers = {},
    body,
    silent401 = false,
    timeoutMs = 12000,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const mergedHeaders = withAuthHeader({
      "Content-Type": "application/json",
      ...headers,
    });

    const res = await fetch(url, {
      method,
      headers: mergedHeaders,
      body,
      credentials: "include", // ✅ cookies si el navegador las acepta
      signal: controller.signal,
    });

    // ✅ Para /me: si 401 y silent401 -> devolver null (sin throw)
    if (silent401 && res.status === 401) return null;

    if (res.status === 204) return null;

    let data = null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      try {
        const text = await res.text();
        data = text ? { message: text } : null;
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      const err = new Error(data?.error || data?.message || "Error");
      if (data && typeof data === "object") Object.assign(err, data);
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (e) {
    // ✅ Timeout
    if (e?.name === "AbortError") {
      const err = new Error("Tiempo de espera agotado. Revisá tu conexión.");
      err.status = 0;
      throw err;
    }

    // ✅ Errores típicos de red (sin internet / backend caído / CORS / DNS)
    if (e instanceof TypeError) {
      const err = new Error("No se pudo conectar con el servidor. Revisá tu conexión.");
      err.status = 0;
      throw err;
    }

    throw e;
  } finally {
    clearTimeout(timer);
  }
}
