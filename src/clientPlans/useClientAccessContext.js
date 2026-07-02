import { useQuery } from "@tanstack/react-query";

import {
  CLIENT_ACCESS_CONTEXT_STALE_TIME,
  clientAccessContextKey,
  fetchClientAccessContext,
} from "./clientPlanQueries.js";

export function useClientAccessContext(options = {}) {
  return useQuery({
    queryKey: clientAccessContextKey,
    queryFn: fetchClientAccessContext,
    staleTime: CLIENT_ACCESS_CONTEXT_STALE_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

export default useClientAccessContext;
