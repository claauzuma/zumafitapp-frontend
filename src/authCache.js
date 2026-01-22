// src/authCache.js

// Estado de auth ultra simple y rápido (para evitar loaders)
// "unknown" = no sabemos todavía (ej: primera carga)
// "guest"   = deslogueado
// "logged"  = logueado

const KEY_STATUS = "auth_status_v1";
const KEY_ROLE = "auth_role_v1";
const KEY_USER = "auth_user_v1";

// ✅ NUEVO: token fallback (por si el navegador no guarda cookies)
const KEY_TOKEN = "auth_token_v1";

/**
 * Guarda estado logged + (opcional) user/role y token si viene.
 *
 * Backwards compatible:
 * - setAuthLogged(user)
 * - setAuthLogged()
 *
 * Y soporta:
 * - setAuthLogged(user, token)
 * - setAuthLogged({ user, token })  (por si querés pasar el payload entero)
 */
export function setAuthLogged(user = null, token = null) {
  try {
    localStorage.setItem(KEY_STATUS, "logged");

    // Si te pasan un objeto tipo { user, token }
    if (user && typeof user === "object" && user.user && user.token && token == null) {
      token = user.token;
      user = user.user;
    }

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

    // ✅ Guardar token si viene (fallback)
    if (token && typeof token === "string") localStorage.setItem(KEY_TOKEN, token);
    // no lo borro si no viene, para no romper flows viejos
  } catch {}
}

/**
 * Devuelve el token cacheado (Bearer fallback) o null.
 */
export function getCachedToken() {
  try {
    return localStorage.getItem(KEY_TOKEN) || null;
  } catch {
    return null;
  }
}

/**
 * Marca como guest y limpia role + user + token.
 */
export function setAuthGuest() {
  try {
    localStorage.setItem(KEY_STATUS, "guest");
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_TOKEN);
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
    localStorage.removeItem(KEY_TOKEN);
  } catch {}
}
