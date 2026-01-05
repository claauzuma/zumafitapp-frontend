// src/PublicOnlyRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "./Api.js";

export default function PublicOnlyRoute({ children }) {
  const [status, setStatus] = useState("loading"); // loading | logged | guest

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // ✅ si es 401, para público es normal -> lo silenciamos
        await apiFetch("/api/usuarios/auth/me", { method: "GET", silent401: true });
        if (alive) setStatus("logged");
      } catch {
        if (alive) setStatus("guest");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") return null;

  // ✅ si ya está logueado, lo mandás al inicio del panel
  if (status === "logged") return <Navigate to="/app/inicio" replace />;

  return children;
}
