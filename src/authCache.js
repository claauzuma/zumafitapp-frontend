// src/authCache.js

// Estado de auth ultra simple y rápido (para evitar loaders)
// "unknown" = no sabemos todavía (ej: primera carga)
// "guest"   = deslogueado
// "logged"  = logueado

const KEY_STATUS = "auth_status_v1";
const KEY_ROLE = "auth_role_v1";
const KEY_USER = "auth_user_v1";

/**
 * Guarda estado logged + (opcional) user y role.
 * Soporta que lo llames como setAuthLogged() sin args (backwards compatible).
 */
export function setAuthLogged(user = null) {
  try {
    localStorage.setItem(KEY_STATUS, "logged");

    // Intentamos inferir role de varias formas comunes
    const role =
      user?.role ||
      user?.rol ||
      user?.user?.role ||
      user?.user?.rol ||
      null;

    if (role) localStorage.setItem(KEY_ROLE, String(role));
    else localStorage.removeItem(KEY_ROLE);

    // Guardar user completo es opcional (pero útil)
    if (user) localStorage.setItem(KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(KEY_USER);
  } catch {}
}

/**
 * Marca como guest y limpia role + user.
 */
export function setAuthGuest() {
  try {
    localStorage.setItem(KEY_STATUS, "guest");
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_USER);
  } catch {}
}

/**
 * Devuelve: "logged" | "guest" | "unknown"
 */
export function getCachedStatus() {
  try {
    return localStorage.getItem(KEY_STATUS) || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Devuelve el rol cacheado (ej: "admin") o null si no existe.
 */
export function getCachedRole() {
  try {
    return localStorage.getItem(KEY_ROLE) || null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el user cacheado (obj) o null.
 * No lo necesitás para roles, pero ayuda.
 */
export function getCachedUser() {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Limpia todo el cache de auth.
 */
export function clearAuthCache() {
  try {
    localStorage.removeItem(KEY_STATUS);
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_USER);
  } catch {}
}
