import { useQuery } from "@tanstack/react-query";

import { clientAccessContextKey, fetchClientAccessContext } from "./clientPlanQueries.js";

export function useClientAccessContext(options = {}) {
  return useQuery({
    queryKey: clientAccessContextKey,
    queryFn: fetchClientAccessContext,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    ...options,
  });
}

export default useClientAccessContext;
