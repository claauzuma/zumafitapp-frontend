// src/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "./Api.js";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ok | no

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await apiFetch("/api/usuarios/auth/me", {
          method: "GET",
          // redundante pero útil:
          headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
        });
        if (alive) setStatus("ok");
      } catch {
        if (alive) setStatus("no");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") return null;
  if (status === "no") return <Navigate to="/login" replace />;
  return children;
}
