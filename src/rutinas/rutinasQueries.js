import { useQuery } from "@tanstack/react-query";

import { STALE_TIMES, queryKeys } from "../queryClient.js";
import {
  getAssignableClients,
  getClienteRutinaActiva,
  getRutina,
  listClienteRutinas,
  listEjercicios,
  listRutinas,
} from "./rutinasApi.js";

export function useRutinas(filters = {}) {
  return useQuery({
    queryKey: queryKeys.rutinas(filters),
    queryFn: () => listRutinas(filters),
    staleTime: STALE_TIMES.rutinas,
    placeholderData: (previous) => previous,
  });
}

export function useRutina(rutinaId, options = {}) {
  return useQuery({
    queryKey: queryKeys.rutina(rutinaId),
    queryFn: () => getRutina(rutinaId),
    enabled: Boolean(rutinaId) && options.enabled !== false,
    staleTime: STALE_TIMES.rutina,
  });
}

export function useEjercicios(filters = {}) {
  return useQuery({
    queryKey: queryKeys.ejercicios(filters),
    queryFn: () => listEjercicios(filters),
    staleTime: STALE_TIMES.ejercicios,
    placeholderData: (previous) => previous,
  });
}

export function useAssignableClients(scope, search = "", options = {}) {
  return useQuery({
    queryKey: queryKeys.rutinaAssignableClients(scope, search),
    queryFn: () => getAssignableClients(scope, search),
    enabled: options.enabled !== false,
    staleTime: STALE_TIMES.rutinaAssignableClients,
    placeholderData: (previous) => previous,
  });
}

export function useClienteRutinas(clientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.clienteRutinas(clientId),
    queryFn: () => listClienteRutinas(clientId),
    enabled: Boolean(clientId) && options.enabled !== false,
    staleTime: STALE_TIMES.clienteRutinas,
  });
}

export function useClienteRutinaActiva(clientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.clienteRutinaActiva(clientId),
    queryFn: () => getClienteRutinaActiva(clientId),
    enabled: Boolean(clientId) && options.enabled !== false,
    staleTime: STALE_TIMES.clienteRutinaActiva,
  });
}
