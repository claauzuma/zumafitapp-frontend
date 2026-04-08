import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCachedStatus, getCachedUser } from "./authCache.js";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function normalizeTipo(tipo) {
  return String(tipo || "").trim().toLowerCase();
}

function getHomeByUser(user) {
  const role = normalizeRole(user?.role || user?.rol);
  const tipo = normalizeTipo(user?.tipo);
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

export default function RequireOnboarding({ children }) {
  const status = getCachedStatus();
  const user = getCachedUser();
  const location = useLocation();

  if (status !== "logged") return children;

  const role = normalizeRole(user?.role || user?.rol);
  const tipo = normalizeTipo(user?.tipo);
  const done = Boolean(user?.onboarding?.done);
  const enabled = user?.onboarding?.enabled === true;

  const isOnOnboarding = location.pathname.startsWith("/app/onboarding");

  const isClienteEntrenado =
    (role === "cliente" || role === "client") &&
    tipo === "entrenado";

  // Admins y coaches no usan el onboarding ni el layout de cliente
  if (!isClienteEntrenado) {
    return <Navigate to={getHomeByUser(user)} replace />;
  }

  const shouldDoOnboarding = enabled && !done;
  const canEverUseOnboarding = enabled;

  if (shouldDoOnboarding && !isOnOnboarding) {
    return <Navigate to="/app/onboarding" replace />;
  }

  if ((!canEverUseOnboarding || done) && isOnOnboarding) {
    return <Navigate to="/app/inicio" replace />;
  }

  return children;
}
