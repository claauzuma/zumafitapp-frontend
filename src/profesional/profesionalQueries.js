import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES, queryKeys } from "../queryClient.js";
import {
  getProfessionalClientDetail,
  getProfessionalClientInvitations,
  getProfessionalClients,
} from "./profesionalApi.js";

export function useProfessionalClients() {
  return useQuery({
    queryKey: queryKeys.professionalClients(),
    queryFn: getProfessionalClients,
    staleTime: STALE_TIMES.professionalClients,
  });
}

export function useProfessionalClientDetail(clientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.professionalClientDetail(clientId),
    queryFn: () => getProfessionalClientDetail(clientId),
    staleTime: STALE_TIMES.professionalClientDetail,
    ...options,
    enabled: Boolean(clientId) && options.enabled !== false,
  });
}

export function useProfessionalClientInvitations(filters = {}) {
  return useQuery({
    queryKey: queryKeys.professionalClientInvitations(filters),
    queryFn: () => getProfessionalClientInvitations(filters),
    staleTime: STALE_TIMES.professionalClientInvitations,
  });
}
