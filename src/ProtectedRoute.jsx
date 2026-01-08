// src/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import FullPageLoader from "./FullPageLoader.jsx";
import { getCachedStatus, setAuthLogged, setAuthGuest } from "./authCache.js";

export default function ProtectedRoute({ children }) {
  // loading | ok | no
  const cached = getCachedStatus();
  const [status, setStatus] = useState(() => (cached === "logged" ? "ok" : "loading"));

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const me = await apiFetch("/api/usuarios/auth/me", {
          method: "GET",
          silent401: true,
          timeoutMs: 6000,
        });

        if (!alive) return;

        if (me?.user || me) {
          setAuthLogged();
          setStatus("ok");
        } else {
          setAuthGuest();
          setStatus("no");
        }
      } catch {
        if (!alive) return;
        setAuthGuest();
        setStatus("no");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") {
    return <FullPageLoader title="Verificando sesión…" sub="Entrando a tu panel." />;
  }

  if (status === "no") return <Navigate to="/login" replace />;

  return children;
}
