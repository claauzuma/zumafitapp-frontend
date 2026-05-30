import { useQuery } from "@tanstack/react-query";
import {
  getAdminCoaches,
  getAdminCoachClients,
  getAdminCoachPlans,
  getAdminUserById,
  getAdminUnassignedClients,
  listAdminUsers,
} from "./adminUsuariosApi.js";
import { STALE_TIMES, queryKeys } from "../queryClient.js";

export function useAdminUsers(filters) {
  return useQuery({
    queryKey: queryKeys.adminUsers(filters),
    queryFn: () => listAdminUsers(filters),
    staleTime: STALE_TIMES.adminUsers,
    placeholderData: (previous) => previous,
  });
}

export function useAdminUser(userId, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminUser(userId),
    queryFn: () => getAdminUserById(userId),
    enabled: Boolean(userId) && options.enabled !== false,
    staleTime: STALE_TIMES.adminUser,
  });
}

export function useAdminCoaches(search = "", options = {}) {
  return useQuery({
    queryKey: queryKeys.adminCoaches(search),
    queryFn: () => getAdminCoaches(search),
    enabled: options.enabled !== false,
    staleTime: STALE_TIMES.adminCoaches,
    placeholderData: (previous) => previous,
  });
}

export function useAdminUnassignedClients(search = "", options = {}) {
  return useQuery({
    queryKey: queryKeys.adminUnassignedClients(search),
    queryFn: () => getAdminUnassignedClients(search),
    enabled: options.enabled !== false,
    staleTime: STALE_TIMES.adminUnassignedClients,
    placeholderData: (previous) => previous,
  });
}

export function useAdminCoachClients(coachId, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminCoachClients(coachId),
    queryFn: () => getAdminCoachClients(coachId),
    enabled: Boolean(coachId) && options.enabled !== false,
    staleTime: STALE_TIMES.adminCoachClients,
  });
}

export function useAdminCoachPlans() {
  return useQuery({
    queryKey: queryKeys.adminCoachPlans(),
    queryFn: getAdminCoachPlans,
    staleTime: STALE_TIMES.adminCoachPlans,
  });
}
