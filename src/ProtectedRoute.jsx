// src/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import FullPageLoader from "./FullPageLoader.jsx";
import { getCachedStatus, setAuthGuest, setAuthLogged } from "./authCache.js";
import { useAuthMe } from "./authQueries.js";

export default function ProtectedRoute({ children }) {
  const cached = getCachedStatus();
  const [status, setStatus] = useState(() => (cached === "logged" ? "ok" : "loading"));
  const meQuery = useAuthMe({ enabled: status !== "no", silent401: true });

  useEffect(() => {
    if (meQuery.isPending) return;

    if (meQuery.data) {
      setAuthLogged(meQuery.data);
      setStatus("ok");
      return;
    }

    if (meQuery.isError || meQuery.data === null) {
      setAuthGuest();
      setStatus("no");
    }
  }, [meQuery.data, meQuery.dataUpdatedAt, meQuery.isError, meQuery.isPending]);

  if (status === "loading") {
    return <FullPageLoader title="Verificando sesion..." sub="Entrando a tu panel." />;
  }

  if (status === "no") return <Navigate to="/login" replace />;

  return children;
}
