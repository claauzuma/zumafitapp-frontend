// src/RequireRole.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { getCachedStatus, getCachedRole } from "./authCache.js";

export default function RequireRole({ role, children }) {
  const status = getCachedStatus();
  const r = String(getCachedRole() || "").toLowerCase();

  if (status !== "logged") return <Navigate to="/login" replace />;
  if (!r) return <Navigate to="/login" replace />;

  const allowed = Array.isArray(role)
    ? role.map((x) => String(x).toLowerCase()).includes(r)
    : r === String(role).toLowerCase();

  if (!allowed) {
    const fallback = r === "admin" ? "/admin/inicio" : r === "coach" ? "/profesional" : "/app/inicio";
    return <Navigate to={fallback} replace />;
  }

  return children;
}
