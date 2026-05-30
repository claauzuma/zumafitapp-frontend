// src/PublicOnlyRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import FullPageLoader from "./FullPageLoader.jsx";
import {
  getCachedRole,
  getCachedStatus,
  getCachedUser,
  setAuthGuest,
  setAuthLogged,
} from "./authCache.js";
import { useAuthMe } from "./authQueries.js";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getHomeByUser(user, roleCached = null) {
  const role = normalizeRole(user?.role || roleCached || "");
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

export default function PublicOnlyRoute({ children }) {
  const cached = getCachedStatus();
  const roleCached = getCachedRole?.() || null;
  const [status, setStatus] = useState(cached);
  const shouldCheck = cached === "unknown";
  const meQuery = useAuthMe({ enabled: shouldCheck, silent401: true });

  useEffect(() => {
    if (!shouldCheck) {
      setStatus(cached);
      return;
    }

    if (meQuery.isPending) return;

    if (meQuery.data) {
      setAuthLogged(meQuery.data);
      setStatus("logged");
      return;
    }

    if (meQuery.isError || meQuery.data === null) {
      setAuthGuest();
      setStatus("guest");
    }
  }, [cached, meQuery.data, meQuery.dataUpdatedAt, meQuery.isError, meQuery.isPending, shouldCheck]);

  if (status === "unknown") {
    return <FullPageLoader title="Verificando sesion..." sub="Un segundo..." />;
  }

  if (status === "logged") {
    const user = getCachedUser?.() || null;
    return <Navigate to={getHomeByUser(user, roleCached)} replace />;
  }

  return children;
}
