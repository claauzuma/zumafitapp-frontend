// src/PublicOnlyRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import FullPageLoader from "./FullPageLoader.jsx";
import { getCachedStatus, getCachedRole, setAuthLogged, setAuthGuest } from "./authCache.js";

export default function PublicOnlyRoute({ children }) {
  const cached = getCachedStatus(); // logged | guest | unknown
  const roleCached = getCachedRole?.() || null;

  const [status, setStatus] = useState(cached);

  useEffect(() => {
    let alive = true;

    if (cached === "guest") {
      setStatus("guest");
      return () => {
        alive = false;
      };
    }
    if (cached === "logged") {
      setStatus("logged");
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const me = await apiFetch("/api/usuarios/auth/me", {
          method: "GET",
          silent401: true,
          timeoutMs: 6000,
        });

        if (!alive) return;

        const user = me?.user || me;
        if (user) {
          setAuthLogged(user);      // ✅ guarda rol
          setStatus("logged");
        } else {
          setAuthGuest();
          setStatus("guest");
        }
      } catch {
        if (!alive) return;
        setAuthGuest();
        setStatus("guest");
      }
    })();

    return () => {
      alive = false;
    };
  }, [cached]);

  if (status === "unknown") {
    return <FullPageLoader title="Verificando sesión…" sub="Un segundo…" />;
  }

  if (status === "logged") {
    const role = (getCachedRole?.() || roleCached || "").toLowerCase();
    return <Navigate to={role === "admin" ? "/admin/inicio" : "/app/inicio"} replace />;
  }

  return children;
}
