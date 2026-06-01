import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES, queryKeys } from "../queryClient.js";
import {
  getClientActiveMenu,
  getClientMenu,
  getFoodEquivalents,
  getMenuBase,
  listClientMenus,
  listMenusBase,
} from "./menusApi.js";

export function useMenusBase(filters = {}) {
  return useQuery({
    queryKey: queryKeys.menusBase(filters),
    queryFn: () => listMenusBase(filters),
    staleTime: STALE_TIMES.menusBase,
    placeholderData: (previous) => previous,
  });
}

export function useMenuBase(menuId) {
  return useQuery({
    queryKey: queryKeys.menuBase(menuId),
    queryFn: () => getMenuBase(menuId),
    enabled: Boolean(menuId),
    staleTime: STALE_TIMES.menuBase,
  });
}

export function useClientMenus(clientId, filters = {}) {
  return useQuery({
    queryKey: queryKeys.clientMenus(clientId, filters),
    queryFn: () => listClientMenus(clientId, filters),
    enabled: Boolean(clientId),
    staleTime: STALE_TIMES.clientMenus,
    placeholderData: (previous) => previous,
  });
}

export function useClientActiveMenu(clientId) {
  return useQuery({
    queryKey: queryKeys.clientActiveMenu(clientId),
    queryFn: () => getClientActiveMenu(clientId),
    enabled: Boolean(clientId),
    staleTime: STALE_TIMES.clientActiveMenu,
  });
}

export function useClientMenu(clientId, menuAsignadoId) {
  return useQuery({
    queryKey: queryKeys.clientMenu(clientId, menuAsignadoId),
    queryFn: () => getClientMenu(clientId, menuAsignadoId),
    enabled: Boolean(clientId) && Boolean(menuAsignadoId),
    staleTime: STALE_TIMES.clientMenus,
  });
}

export function useFoodEquivalentsQuery(payload, enabled = false) {
  return useQuery({
    queryKey: queryKeys.foodEquivalents(payload),
    queryFn: () => getFoodEquivalents(payload),
    enabled,
    staleTime: 60 * 1000,
  });
}
