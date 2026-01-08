// src/HomeSessionGate.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import { getCachedStatus, setAuthLogged, setAuthGuest } from "./authCache.js";
import FullPageLoader from "./FullPageLoader.jsx";

export default function HomeSessionGate({ children }) {
  const nav = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const cached = getCachedStatus();

      // ✅ si cache dice guest -> NO hacemos nada, 0 loader
      if (cached === "guest") return;

      // ✅ si cache dice logged -> redirigimos directo (podés mostrar loader si querés)
      if (cached === "logged") {
        nav("/app/inicio", { replace: true });
        return;
      }

      // ✅ cached unknown: acá es el único caso “gris”.
      // Para cumplir tu regla:
      // - NO mostramos loader de entrada
      // - Sólo si /me responde que está logueado, mostramos loader y redirigimos.
      const me = await apiFetch("/api/usuarios/auth/me", { method: "GET", silent401: true });
      if (!alive) return;

      if (me?.user || me) {
        setAuthLogged();
        setChecking(true); // ✅ loader sólo si realmente está logueado
        nav("/app/inicio", { replace: true });
      } else {
        setAuthGuest();
        // se queda en bienvenida sin loader
      }
    })();

    return () => {
      alive = false;
    };
  }, [nav]);

  if (checking) {
    return <FullPageLoader title="Verificando sesión…" sub="Cargando tu panel." />;
  }

  return children;
}
