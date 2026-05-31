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

export function useProfessionalClientDetail(clientId) {
  return useQuery({
    queryKey: queryKeys.professionalClientDetail(clientId),
    queryFn: () => getProfessionalClientDetail(clientId),
    enabled: Boolean(clientId),
    staleTime: STALE_TIMES.professionalClientDetail,
  });
}

export function useProfessionalClientInvitations(filters = {}) {
  return useQuery({
    queryKey: queryKeys.professionalClientInvitations(filters),
    queryFn: () => getProfessionalClientInvitations(filters),
    staleTime: STALE_TIMES.professionalClientInvitations,
  });
}
