import { useQuery } from "@tanstack/react-query";
import {
  getAdminCoaches,
  getAdminCoachClients,
  getAdminCoachPlanPreview,
  getAdminCoachPlans,
  getAdminClientPlans,
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

export function useAdminClientPlans() {
  return useQuery({
    queryKey: queryKeys.adminClientPlans(),
    queryFn: getAdminClientPlans,
    staleTime: STALE_TIMES.adminClientPlans,
  });
}

export function useAdminCoachPlanPreview(coachId, plan, resetOverrides = false, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminCoachPlanPreview(coachId, plan, resetOverrides),
    queryFn: () => getAdminCoachPlanPreview(coachId, { plan, resetOverrides }),
    enabled: Boolean(coachId && plan) && options.enabled !== false,
    staleTime: STALE_TIMES.adminCoachPlanPreview,
  });
}
