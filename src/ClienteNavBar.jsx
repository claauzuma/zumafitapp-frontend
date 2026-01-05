// src/ClientNavBar.jsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js";

const CSS = `
.cn-wrap{ background:#0b0b0b; border-bottom:1px solid #1b1b1b; position:sticky; top:0; z-index:60; }
.cn{ max-width:1100px; margin:0 auto; padding:10px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
.cn-left{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cn-link{
  text-decoration:none; color:#d6d6d6; border:1px solid #2b2b2b; background:#0f0f0f;
  padding:8px 10px; border-radius:12px; font-weight:900; font-size:13px;
}
.cn-link.active{ background:linear-gradient(135deg,#facc15,#f5d76e); color:#0a0a0a; border:none; }
.cn-right{ display:flex; align-items:center; gap:8px; }
.cn-logout{
  border:1px solid #2b2b2b; background:#0f0f0f; color:#eaeaea; border-radius:12px;
  padding:8px 10px; cursor:pointer; font-weight:900; display:flex; align-items:center; gap:8px;
}
.cn-logout:disabled{ opacity:.7; cursor:not-allowed; }
`;

export default function ClientNavBar() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  async function logout() {
    try {
      setLoading(true);
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch {
      // si falla igual limpiamos UI y mandamos a login
    } finally {
      setLoading(false);
      nav("/", { replace: true }); // volvés a la bienvenida pública
    }
  }

  return (
    <div className="cn-wrap">
      <style>{CSS}</style>

      <div className="cn">
        <div className="cn-left">
          <NavLink className={({ isActive }) => `cn-link ${isActive ? "active" : ""}`} to="/app/inicio">
            🏠 Inicio
          </NavLink>
          <NavLink className={({ isActive }) => `cn-link ${isActive ? "active" : ""}`} to="/app/perfil">
            👤 Perfil
          </NavLink>
          <NavLink className={({ isActive }) => `cn-link ${isActive ? "active" : ""}`} to="/app/menu">
            🍽️ Menú
          </NavLink>
          <NavLink className={({ isActive }) => `cn-link ${isActive ? "active" : ""}`} to="/app/rutinas">
            🏋️ Rutina
          </NavLink>
          <NavLink className={({ isActive }) => `cn-link ${isActive ? "active" : ""}`} to="/app/progresos">
            📈 Progresos
          </NavLink>
          <NavLink className={({ isActive }) => `cn-link ${isActive ? "active" : ""}`} to="/app/ajustes">
            ⚙️ Ajustes
          </NavLink>
        </div>

        <div className="cn-right">
          <button className="cn-logout" onClick={logout} disabled={loading} title="Cerrar sesión">
            ⎋ {loading ? "Saliendo..." : "Salir"}
          </button>
        </div>
      </div>
    </div>
  );
}
