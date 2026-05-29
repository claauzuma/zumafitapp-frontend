const KEY_STATUS = "auth_status_v1";
const KEY_ROLE = "auth_role_v1";
const KEY_USER = "auth_user_v1";
const KEY_TOKEN = "auth_token_v1";

const KEY_IMP_ACTIVE = "impersonation_active_v1";
const KEY_IMP_TOKEN = "impersonation_token_v1";
const KEY_IMP_ADMIN_TOKEN = "impersonation_admin_token_v1";
const KEY_IMP_ADMIN_USER = "impersonation_admin_user_v1";
const KEY_IMP_TARGET_USER = "impersonation_target_user_v1";
const KEY_IMP_RETURN_TO = "impersonation_return_to_v1";
const KEY_IMP_EXPIRES_AT = "impersonation_expires_at_v1";

export function setAuthLogged(user = null, token = null) {
  try {
    localStorage.setItem(KEY_STATUS, "logged");

    if (user && typeof user === "object" && user.user && user.token && token == null) {
      token = user.token;
      user = user.user;
    }

    const role =
      user?.role ||
      user?.rol ||
      user?.user?.role ||
      user?.user?.rol ||
      null;

    if (role) localStorage.setItem(KEY_ROLE, String(role));
    else localStorage.removeItem(KEY_ROLE);

    if (user) localStorage.setItem(KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(KEY_USER);

    if (token && typeof token === "string") localStorage.setItem(KEY_TOKEN, token);
  } catch {
    return;
  }
}

export function getCachedToken() {
  try {
    if (isImpersonating()) {
      return localStorage.getItem(KEY_IMP_TOKEN) || localStorage.getItem(KEY_TOKEN) || null;
    }
    return localStorage.getItem(KEY_TOKEN) || null;
  } catch {
    return null;
  }
}

export function setAuthGuest() {
  try {
    localStorage.setItem(KEY_STATUS, "guest");
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_TOKEN);
    clearImpersonationStorage();
  } catch {
    return;
  }
}

export function getCachedStatus() {
  try {
    return localStorage.getItem(KEY_STATUS) || "unknown";
  } catch {
    return "unknown";
  }
}

export function getCachedRole() {
  try {
    return localStorage.getItem(KEY_ROLE) || null;
  } catch {
    return null;
  }
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuthCache() {
  try {
    localStorage.removeItem(KEY_STATUS);
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_TOKEN);
    clearImpersonationStorage();
  } catch {
    return;
  }
}

export function isImpersonating() {
  try {
    return localStorage.getItem(KEY_IMP_ACTIVE) === "true";
  } catch {
    return false;
  }
}

export function getImpersonationSession() {
  try {
    if (!isImpersonating()) return null;

    const targetRaw = localStorage.getItem(KEY_IMP_TARGET_USER);
    const adminRaw = localStorage.getItem(KEY_IMP_ADMIN_USER);

    return {
      active: true,
      token: localStorage.getItem(KEY_IMP_TOKEN) || null,
      targetUser: targetRaw ? JSON.parse(targetRaw) : null,
      adminUser: adminRaw ? JSON.parse(adminRaw) : null,
      returnTo: localStorage.getItem(KEY_IMP_RETURN_TO) || "/admin/usuarios",
      expiresAt: localStorage.getItem(KEY_IMP_EXPIRES_AT) || null,
      readOnly: true,
    };
  } catch {
    return null;
  }
}

export function startImpersonationCache({ token, targetUser, expiresAt, returnTo = "/admin/usuarios" }) {
  try {
    const adminToken = localStorage.getItem(KEY_TOKEN) || "";
    const adminUser = getCachedUser();

    localStorage.setItem(KEY_IMP_ACTIVE, "true");
    localStorage.setItem(KEY_IMP_TOKEN, token || "");
    localStorage.setItem(KEY_IMP_ADMIN_TOKEN, adminToken);
    localStorage.setItem(KEY_IMP_ADMIN_USER, JSON.stringify(adminUser || null));
    localStorage.setItem(KEY_IMP_TARGET_USER, JSON.stringify(targetUser || null));
    localStorage.setItem(KEY_IMP_RETURN_TO, returnTo || "/admin/usuarios");
    localStorage.setItem(KEY_IMP_EXPIRES_AT, expiresAt || "");

    localStorage.setItem(KEY_STATUS, "logged");
    localStorage.setItem(KEY_ROLE, String(targetUser?.role || ""));
    localStorage.setItem(KEY_USER, JSON.stringify(targetUser || null));
    if (token) localStorage.setItem(KEY_TOKEN, token);
  } catch {
    return;
  }
}

export function restoreAdminAfterImpersonation() {
  try {
    const adminToken = localStorage.getItem(KEY_IMP_ADMIN_TOKEN) || "";
    const adminRaw = localStorage.getItem(KEY_IMP_ADMIN_USER);
    const adminUser = adminRaw ? JSON.parse(adminRaw) : null;

    clearImpersonationStorage();

    localStorage.setItem(KEY_STATUS, "logged");
    if (adminUser) {
      localStorage.setItem(KEY_USER, JSON.stringify(adminUser));
      if (adminUser?.role) localStorage.setItem(KEY_ROLE, String(adminUser.role));
      else localStorage.removeItem(KEY_ROLE);
    } else {
      localStorage.removeItem(KEY_USER);
      localStorage.setItem(KEY_ROLE, "admin");
    }

    if (adminToken) localStorage.setItem(KEY_TOKEN, adminToken);
    else localStorage.removeItem(KEY_TOKEN);
  } catch {
    clearImpersonationStorage();
  }
}

export function clearImpersonationStorage() {
  try {
    localStorage.removeItem(KEY_IMP_ACTIVE);
    localStorage.removeItem(KEY_IMP_TOKEN);
    localStorage.removeItem(KEY_IMP_ADMIN_TOKEN);
    localStorage.removeItem(KEY_IMP_ADMIN_USER);
    localStorage.removeItem(KEY_IMP_TARGET_USER);
    localStorage.removeItem(KEY_IMP_RETURN_TO);
    localStorage.removeItem(KEY_IMP_EXPIRES_AT);
  } catch {
    return;
  }
}
