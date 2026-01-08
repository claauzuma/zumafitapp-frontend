// src/PublicOnlyRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import FullPageLoader from "./FullPageLoader.jsx";
import { getCachedStatus, setAuthLogged, setAuthGuest } from "./authCache.js";

export default function PublicOnlyRoute({ children }) {
  const cached = getCachedStatus(); // logged | guest | unknown
  const [status, setStatus] = useState(cached);

  useEffect(() => {
    let alive = true;

    // ✅ si ya sabemos por cache, no consultamos nada
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

    // ✅ unknown: consultamos /me con timeout y fallback a guest
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

  // ✅ Loader SOLO cuando está unknown
  if (status === "unknown") {
    return <FullPageLoader title="Verificando sesión…" sub="Un segundo…" />;
  }

  if (status === "logged") return <Navigate to="/app/inicio" replace />;

  return children;
}
