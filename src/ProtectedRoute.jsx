// src/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import FullPageLoader from "./FullPageLoader.jsx";
import { getCachedStatus, setAuthGuest, setAuthLogged } from "./authCache.js";
import { useAuthMe } from "./authQueries.js";
import { clearPrivateQueryCache } from "./queryClient.js";
import { shouldShowInitialSessionLoader } from "./sessionGateState.js";

export default function ProtectedRoute({ children }) {
  const [sessionStatus, setSessionStatus] = useState(() => getCachedStatus());
  const shouldCheck = sessionStatus !== "guest";
  const meQuery = useAuthMe({
    enabled: shouldCheck,
    silent401: true,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const showInitialLoader = shouldShowInitialSessionLoader(meQuery);

  useEffect(() => {
    if (!shouldCheck || meQuery.isPending || meQuery.isFetching) return;

    if (meQuery.data) {
      setAuthLogged(meQuery.data);
      setSessionStatus("logged");
      return;
    }

    if (meQuery.isError || meQuery.data === null) {
      setSessionStatus("guest");
      setAuthGuest();
      clearPrivateQueryCache();
    }
  }, [
    meQuery.data,
    meQuery.dataUpdatedAt,
    meQuery.isError,
    meQuery.isFetching,
    meQuery.isPending,
    shouldCheck,
  ]);

  if (!shouldCheck) return <Navigate to="/login" replace />;

  if (showInitialLoader) {
    return <FullPageLoader title="Verificando sesion..." sub="Entrando a tu panel." />;
  }

  if (!meQuery.data) return <Navigate to="/login" replace />;

  return children;
}
