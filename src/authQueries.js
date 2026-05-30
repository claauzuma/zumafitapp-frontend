import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./Api.js";
import { getCachedStatus, getCachedUser, setAuthGuest, setAuthLogged } from "./authCache.js";
import {
  STALE_TIMES,
  queryClient,
  queryKeys,
  setAuthUserQueryData,
} from "./queryClient.js";

export async function fetchAuthMe(options = {}) {
  const { silent401 = false, timeoutMs = 6000 } = options;
  const data = await apiFetch("/api/usuarios/auth/me", {
    method: "GET",
    silent401,
    timeoutMs,
  });

  const user = data?.user || data || null;
  if (user) {
    setAuthLogged(user);
    setAuthUserQueryData(user);
    return user;
  }

  if (silent401) setAuthGuest();
  return null;
}

export function fetchAuthMeQuery(options = {}) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.authMe(),
    queryFn: () => fetchAuthMe(options),
    staleTime: STALE_TIMES.authMe,
  });
}

export function useAuthMe(options = {}) {
  const { enabled = true, silent401 = true, initialFromCache = false } = options;

  return useQuery({
    queryKey: queryKeys.authMe(),
    queryFn: () => fetchAuthMe({ silent401 }),
    enabled,
    staleTime: STALE_TIMES.authMe,
    retry: false,
    initialData: initialFromCache && getCachedStatus() === "logged" ? getCachedUser() || undefined : undefined,
  });
}

export function useProfessionalMe() {
  return useQuery({
    queryKey: queryKeys.professionalMe(),
    queryFn: () => fetchAuthMe({ silent401: false, timeoutMs: 8000 }),
    staleTime: STALE_TIMES.professionalMe,
    retry: false,
    initialData: () =>
      queryClient.getQueryData(queryKeys.professionalMe()) ||
      queryClient.getQueryData(queryKeys.authMe()) ||
      getCachedUser() ||
      undefined,
  });
}
