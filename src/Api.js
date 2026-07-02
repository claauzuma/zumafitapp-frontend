import { API_BASE } from "./apiCredentials";
import { getCachedToken, isImpersonating } from "./authCache.js";

function joinUrl(base, path) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

function getAuthToken() {
  try {
    return getCachedToken();
  } catch {
    return null;
  }
}

function withAuthHeader(headers = {}) {
  const h = { ...headers };

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

  const upperMethod = String(method || "GET").toUpperCase();
  const isSafeRead = ["GET", "HEAD", "OPTIONS"].includes(upperMethod);
  const isStopImpersonation = String(path || "").includes("/api/usuarios/admin/impersonation/stop");

  if (isImpersonating() && !isSafeRead && !isStopImpersonation) {
    const err = new Error("Modo simulacion de solo lectura: esta accion no esta permitida");
    err.status = 403;
    err.impersonation = true;
    err.readOnly = true;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const isStringBody = typeof body === "string";

  try {
    const mergedHeaders = withAuthHeader({
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...headers,
    });

    const finalBody =
      body == null
        ? undefined
        : isFormData
        ? body
        : isStringBody
        ? body
        : JSON.stringify(body);

    const res = await fetch(url, {
      method,
      headers: mergedHeaders,
      body: finalBody,
      credentials: "include",
      signal: controller.signal,
    });

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
      let serverMessage =
        data?.error ||
        data?.errors ||
        data?.message ||
        data?.code ||
        `Error HTTP ${res.status}`;
      if (res.status === 413) {
        serverMessage = data?.error || "La solicitud es demasiado grande. Probá con menos días o un menú más liviano.";
      } else if (typeof serverMessage === "string" && /^\s*</.test(serverMessage)) {
        serverMessage = `Error HTTP ${res.status}`;
      }
      const err = new Error(serverMessage);
      if (data && typeof data === "object") Object.assign(err, data);
      err.message = serverMessage;
      err.error = serverMessage;
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (e) {
    if (e?.name === "AbortError") {
      const err = new Error("Tiempo de espera agotado. Revisá tu conexión.");
      err.status = 0;
      throw err;
    }

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
