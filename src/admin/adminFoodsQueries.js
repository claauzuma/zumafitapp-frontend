import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../queryClient.js";
import { createAdminFood, getAdminFoods, updateAdminFoodGeneration } from "./adminFoodsApi.js";
import { replaceFoodInAdminPage } from "./adminFoodGeneration.js";

export function useAdminFoods(filters = {}) {
  return useQuery({
    queryKey: queryKeys.adminFoods(filters),
    queryFn: () => getAdminFoods(filters),
    staleTime: 45 * 1000,
    placeholderData: (previous) => previous,
  });
}

export function useUpdateAdminFoodGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ foodId, generation }) => updateAdminFoodGeneration(foodId, generation),
    onSuccess: ({ food }) => {
      queryClient.setQueriesData({ queryKey: queryKeys.adminFoodsRoot() }, (page) => replaceFoodInAdminPage(page, food));
      return queryClient.invalidateQueries({ queryKey: queryKeys.adminFoodsRoot() });
    },
  });
}

export function useUpdateAdminFoodGenerationInline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ foodId, generation }) => updateAdminFoodGeneration(foodId, generation),
    onSuccess: ({ food }) => {
      queryClient.setQueriesData({ queryKey: queryKeys.adminFoodsRoot() }, (page) => replaceFoodInAdminPage(page, food));
    },
  });
}

export function useCreateAdminFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminFood,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.adminFoodsRoot() }),
  });
}
