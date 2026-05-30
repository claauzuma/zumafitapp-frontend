// src/PublicOnlyRoute.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import FullPageLoader from "./FullPageLoader.jsx";
import {
  getCachedStatus,
  setAuthGuest,
  setAuthLogged,
} from "./authCache.js";
import { useAuthMe } from "./authQueries.js";
import { clearPrivateQueryCache } from "./queryClient.js";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getHomeByUser(user) {
  const role = normalizeRole(user?.role || user?.rol);
  const tipo = String(user?.tipo || "").toLowerCase();
  const done = Boolean(user?.onboarding?.done);
  const enabled = user?.onboarding?.enabled === true;

  const shouldDoOnboarding =
    (role === "cliente" || role === "client") &&
    tipo === "entrenado" &&
    enabled &&
    !done;

  if (role === "admin") return "/admin/inicio";
  if (role === "coach") return "/profesional";

  return shouldDoOnboarding ? "/app/onboarding" : "/app/inicio";
}

function hasOAuthReturnParams() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    return Boolean(params.get("token") || params.get("oauth") || params.get("error"));
  } catch {
    return false;
  }
}

export default function PublicOnlyRoute({ children }) {
  const [sessionStatus, setSessionStatus] = useState(() => getCachedStatus());
  const isOAuthReturn = useMemo(() => hasOAuthReturnParams(), []);
  const shouldValidateSession = !isOAuthReturn && sessionStatus !== "guest";
  const meQuery = useAuthMe({
    enabled: shouldValidateSession,
    silent401: true,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!shouldValidateSession || meQuery.isPending || meQuery.isFetching) return;

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
    shouldValidateSession,
  ]);

  if (shouldValidateSession && (meQuery.isPending || meQuery.isFetching)) {
    return <FullPageLoader title="Verificando sesion..." sub="Un segundo..." />;
  }

  if (shouldValidateSession && meQuery.data) {
    return <Navigate to={getHomeByUser(meQuery.data)} replace />;
  }

  return children;
}
