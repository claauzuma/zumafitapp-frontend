import { apiFetch } from "../Api.js";
import { setAuthLogged } from "../authCache.js";
import { setAuthUserQueryData } from "../queryClient.js";
import { fetchAuthMe } from "../authQueries.js";
import { fetchClientAccessContext } from "../clientPlans/clientPlanQueries.js";

export const clientGoalsKey = ["client", "goals"];

export async function fetchClientGoals() {
  const [user, accessContext] = await Promise.all([
    fetchAuthMe({ silent401: false, timeoutMs: 9000 }),
    fetchClientAccessContext().catch((error) => ({ error })),
  ]);

  return {
    user,
    accessContext: accessContext?.error ? null : accessContext,
    accessContextError: accessContext?.error || null,
  };
}

export async function updateClientGoals(payload = {}) {
  const data = await apiFetch("/api/usuarios/users/me/goals", {
    method: "PATCH",
    body: payload,
    timeoutMs: 12000,
  });

  const user = data?.user || data || null;
  if (user) {
    setAuthLogged(user);
    setAuthUserQueryData(user);
  }

  return user;
}

export async function fetchClientProgress() {
  return await apiFetch("/api/usuarios/users/me/progress", { method: "GET", timeoutMs: 9000 });
}

export async function upsertClientWeight(payload = {}) {
  const data = await apiFetch("/api/usuarios/users/me/progress/weight", {
    method: "PATCH",
    body: payload,
    timeoutMs: 10000,
  });
  if (data?.user) {
    setAuthLogged(data.user);
    setAuthUserQueryData(data.user);
  }
  return data;
}
