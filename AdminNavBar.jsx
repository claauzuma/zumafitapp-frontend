import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import { setAuthGuest } from "./authCache.js";

export default function AdminNavBar() {
  const navigate = useNavigate();

  async function logout() {
    try {
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch {}
    setAuthGuest();
    navigate("/", { replace: true });
  }

  const linkClass = ({ isActive }) =>
    `an-link ${isActive ? "active" : ""}`;

  return (
    <header className="an-wrap">
      <div className="an-inner">
        <div className="an-left">
          <span className="an-brand">🛡️ Admin</span>

          <nav className="an-nav">
            <NavLink to="/admin/inicio" className={linkClass}>Inicio</NavLink>
            <NavLink to="/admin/usuarios" className={linkClass}>Usuarios</NavLink>
            <NavLink to="/admin/reportes" className={linkClass}>Reportes</NavLink>
          </nav>
        </div>

        <div className="an-right">
          <button className="an-btn" onClick={() => navigate("/app/inicio")}>Ver App</button>
          <button className="an-btn danger" onClick={logout}>Salir</button>
        </div>
      </div>

      <style>{`
        .an-wrap{position:sticky;top:0;z-index:50;background:#0b0b0b;border-bottom:1px solid #1f1f1f}
        .an-inner{max-width:1100px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .an-left{display:flex;align-items:center;gap:14px}
        .an-brand{font-weight:900;color:#f5d76e}
        .an-nav{display:flex;gap:10px;flex-wrap:wrap}
        .an-link{color:#eaeaea;text-decoration:none;padding:8px 10px;border:1px solid #2b2b2b;border-radius:12px;background:#0f0f0f}
        .an-link.active{border-color:rgba(245,215,110,.6);box-shadow:0 0 0 3px rgba(245,215,110,.12)}
        .an-right{display:flex;gap:10px}
        .an-btn{padding:8px 12px;border-radius:12px;border:1px solid #2b2b2b;background:#0f0f0f;color:#eaeaea;cursor:pointer;font-weight:800}
        .an-btn.danger{border-color:#5a1f1f;background:#1a0b0b}
      `}</style>
    </header>
  );
}
