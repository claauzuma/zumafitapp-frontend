// src/RequireOnboarding.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCachedStatus, getCachedUser } from "./authCache.js";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export default function RequireOnboarding({ children }) {
  const status = getCachedStatus();
  const user = getCachedUser();
  const location = useLocation();

  // Si no está logueado, que lo resuelva ProtectedRoute (no bloqueamos acá)
  if (status !== "logged") return children;

  const role = normalizeRole(user?.role || user?.rol);
  const done = Boolean(user?.onboarding?.done);

  // ✅ sirve para /app/onboarding, /app/onboarding/goal, /app/onboarding/program
  const isOnOnboarding = location.pathname.startsWith("/app/onboarding");

  // ✅ Consideramos "cliente" y "client" como mismo rol
  const isClient = role === "cliente" || role === "client";

  // ✅ clientes: si no completó onboarding, obligalo a /app/onboarding
  if (isClient && !done && !isOnOnboarding) {
    return <Navigate to="/app/onboarding" replace />;
  }

  // ✅ si ya completó y entra a /app/onboarding, lo mandamos al inicio
  if (isClient && done && isOnOnboarding) {
    return <Navigate to="/app/inicio" replace />;
  }

  return children;
}