// src/PublicOnlyRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import FullPageLoader from "./FullPageLoader.jsx";
import {
  getCachedStatus,
  getCachedRole,
  getCachedUser,
  setAuthLogged,
  setAuthGuest,
} from "./authCache.js";

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
          setAuthLogged(user);
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
    const user = getCachedUser?.() || null;
    return <Navigate to={getHomeByUser(user, roleCached)} replace />;
  }

  return children;
}
