import { useMutation, useQuery } from "@tanstack/react-query";

import { STALE_TIMES, invalidateTrackingDay, queryClient, queryKeys } from "../queryClient.js";
import { addFoodLog, deleteFoodLog, getTrackingDay, updateFoodLog } from "./trackingApi.js";

export function useTrackingDay(date) {
  return useQuery({
    queryKey: queryKeys.trackingDay(date),
    queryFn: () => getTrackingDay(date),
    enabled: Boolean(date),
    staleTime: STALE_TIMES.trackingDay,
  });
}

export function useAddFoodLog() {
  return useMutation({
    mutationFn: addFoodLog,
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}

export function useUpdateFoodLog() {
  return useMutation({
    mutationFn: ({ logId, ...payload }) => updateFoodLog(logId, payload),
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}

export function useDeleteFoodLog() {
  return useMutation({
    mutationFn: ({ logId }) => deleteFoodLog(logId),
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}
