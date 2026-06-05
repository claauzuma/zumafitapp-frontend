import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES, queryKeys } from "../queryClient.js";
import { getAdminDatabaseStats } from "./adminSystemApi.js";

export function useAdminDatabaseStats() {
  return useQuery({
    queryKey: queryKeys.adminDatabaseStats(),
    queryFn: getAdminDatabaseStats,
    staleTime: STALE_TIMES.adminDatabaseStats,
  });
}
