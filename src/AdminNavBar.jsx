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

  const linkClass = ({ isActive }) => `an-link ${isActive ? "active" : ""}`;

  return (
    <header className="an-wrap">
      <div className="an-inner">
        <div className="an-left">
          <button className="an-brand" type="button" onClick={() => navigate("/admin/inicio")}>
            🛡️ <span>Admin</span>
          </button>

          <nav className="an-nav">
            <NavLink to="/admin/inicio" className={linkClass}>
              Inicio
            </NavLink>
            {/* Dejá estos links si vas a crear esas pantallas */}
            <NavLink to="/admin/usuarios" className={linkClass}>
              Usuarios
            </NavLink>
            <NavLink to="/admin/reportes" className={linkClass}>
              Reportes
            </NavLink>
          </nav>
        </div>

        <div className="an-right">
          <button className="an-btn" type="button" onClick={() => navigate("/app/inicio")}>
            Ver App
          </button>
          <button className="an-btn danger" type="button" onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      <style>{`
        .an-wrap{
          position: sticky;
          top: 0;
          z-index: 60;
          background: linear-gradient(180deg,#0b0b0b,#0b0b0bcc);
          backdrop-filter: blur(6px) saturate(140%);
          border-bottom: 1px solid #1f1f1f;
        }
        .an-inner{
          max-width: 1100px;
          margin: 0 auto;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .an-left{
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }
        .an-brand{
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
          background: transparent;
          color: #f5d76e;
          font-weight: 900;
          cursor: pointer;
          padding: 0;
          white-space: nowrap;
        }
        .an-brand span{ letter-spacing: .2px; }

        .an-nav{
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .an-link{
          color: #eaeaea;
          text-decoration: none;
          padding: 8px 10px;
          border: 1px solid #2b2b2b;
          border-radius: 12px;
          background: #0f0f0f;
          font-weight: 800;
        }
        .an-link.active{
          border-color: rgba(245,215,110,.6);
          box-shadow: 0 0 0 3px rgba(245,215,110,.12);
        }

        .an-right{
          display: flex;
          gap: 10px;
          flex: 0 0 auto;
        }
        .an-btn{
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid #2b2b2b;
          background: #0f0f0f;
          color: #eaeaea;
          cursor: pointer;
          font-weight: 800;
        }
        .an-btn.danger{
          border-color: #5a1f1f;
          background: #1a0b0b;
        }

        @media (max-width: 520px){
          .an-inner{ align-items: flex-start; flex-direction: column; }
          .an-right{ width: 100%; }
          .an-btn{ flex: 1; }
        }
      `}</style>
    </header>
  );
}
