import { apiFetch } from "./Api.js";
import {
  startImpersonationCache,
  restoreAdminAfterImpersonation,
  getImpersonationSession,
  isImpersonating,
} from "./authCache.js";

export async function startAdminImpersonation(targetUserId, { returnTo = "/admin/usuarios" } = {}) {
  if (isImpersonating()) {
    restoreAdminAfterImpersonation();
  }

  const data = await apiFetch(`/api/usuarios/admin/users/${targetUserId}/impersonation/start`, {
    method: "POST",
    body: {},
    timeoutMs: 12000,
  });

  startImpersonationCache({
    token: data?.token,
    targetUser: data?.targetUser,
    expiresAt: data?.expiresAt,
    returnTo,
  });

  return data;
}

export async function getCurrentImpersonation() {
  try {
    const data = await apiFetch("/api/usuarios/admin/impersonation/current", {
      method: "GET",
      timeoutMs: 8000,
    });

    if (!data?.active) {
      restoreAdminAfterImpersonation();
      return null;
    }

    return {
      ...getImpersonationSession(),
      ...data,
      active: true,
    };
  } catch {
    restoreAdminAfterImpersonation();
    return null;
  }
}

export async function stopAdminImpersonation() {
  const session = getImpersonationSession();

  try {
    await apiFetch("/api/usuarios/admin/impersonation/stop", {
      method: "POST",
      body: {},
      timeoutMs: 10000,
    });
  } finally {
    restoreAdminAfterImpersonation();
  }

  return session?.returnTo || "/admin/usuarios";
}
