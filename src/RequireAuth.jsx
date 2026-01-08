// src/RequireAuth.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { getCachedStatus } from "./authCache.js";

export default function RequireAuth({ children }) {
  const cached = getCachedStatus();

  // ✅ Si no sabemos o es guest => a bienvenida directo (sin loader)
  if (cached !== "logged") {
    return <Navigate to="/" replace />;
  }

  return children;
}
