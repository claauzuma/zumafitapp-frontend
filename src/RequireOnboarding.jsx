// src/RequireOnboarding.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCachedStatus, getCachedUser } from "./authCache.js";

export default function RequireOnboarding({ children }) {
  const status = getCachedStatus();
  const user = getCachedUser();
  const location = useLocation();

  // si no está logueado, que se encargue ProtectedRoute (o redirigí)
  if (status !== "logged") return children;

  const role = String(user?.role || user?.rol || "").toLowerCase();
  const done = Boolean(user?.onboarding?.done);

  const isOnOnboarding = location.pathname.startsWith("/app/onboarding");

  // ✅ clientes: si no completó, obligalo a onboarding
  if (role === "cliente" && !done && !isOnOnboarding) {
    return <Navigate to="/app/onboarding" replace />;
  }

  // ✅ si ya completó y entra a /app/onboarding, lo mandamos al inicio
  if (role === "cliente" && done && isOnOnboarding) {
    return <Navigate to="/app/inicio" replace />;
  }

  return children;
}
