import { useQuery } from "@tanstack/react-query";

import { STALE_TIMES, queryKeys } from "../queryClient.js";
import { listAlimentos, listComidas } from "./nutricionApi.js";
import {
  DEMO_MENUS,
  getDemoMenuRanges,
  getDemoMenusByProtein,
  getDemoMenusByRange,
} from "./nutricionDemo.js";

export function useAlimentos(filters = {}) {
  return useQuery({
    queryKey: queryKeys.alimentos(filters),
    queryFn: () => listAlimentos(filters),
    staleTime: STALE_TIMES.alimentos,
    placeholderData: (previous) => previous,
  });
}

export function useComidas(filters = {}, foods = [], options = {}) {
  return useQuery({
    queryKey: queryKeys.comidas(filters),
    queryFn: () => listComidas(filters, foods),
    enabled: options.enabled !== false,
    staleTime: STALE_TIMES.comidas,
    placeholderData: (previous) => previous,
  });
}

export function useMenusDemo(filters = {}) {
  return useQuery({
    queryKey: queryKeys.menusDemo(filters),
    queryFn: async () => ({ menus: filterDemoMenus(DEMO_MENUS, filters), total: DEMO_MENUS.length }),
    staleTime: STALE_TIMES.menusDemo,
    placeholderData: (previous) => previous,
  });
}

export function useMenuRanges() {
  return useQuery({
    queryKey: queryKeys.menuRanges(),
    queryFn: async () => ({ ranges: getDemoMenuRanges() }),
    staleTime: STALE_TIMES.menusDemo,
  });
}

export function useMenusByRange(range) {
  return useQuery({
    queryKey: queryKeys.menusByRange(range),
    queryFn: async () => ({ menus: getDemoMenusByRange(range) }),
    enabled: Boolean(range),
    staleTime: STALE_TIMES.menusDemo,
  });
}

export function useMenusByProtein(range, protein) {
  return useQuery({
    queryKey: queryKeys.menusByProtein(range, protein),
    queryFn: async () => ({ menus: getDemoMenusByProtein(range, protein) }),
    enabled: Boolean(range) && Boolean(protein),
    staleTime: STALE_TIMES.menusDemo,
  });
}

function filterDemoMenus(menus = [], filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  const goal = String(filters.goal || filters.objetivo || "todos").trim().toLowerCase();
  const meals = Number(filters.meals || filters.comidas || 0);

  return menus.filter((menu) => {
    const haystack = `${menu.name} ${menu.description} ${(menu.tags || []).join(" ")} ${(menu.goals || []).join(" ")}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesGoal = goal === "todos" || (menu.goals || []).some((item) => String(item).toLowerCase() === goal);
    const matchesMeals = !meals || Number(menu.mealsCount) === meals;
    return matchesSearch && matchesGoal && matchesMeals;
  });
}
