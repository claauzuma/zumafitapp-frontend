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
            🛡️ <span>ZumaFit Admin</span>
          </button>

          <nav className="an-nav">
            <NavLink to="/admin/inicio" className={linkClass}>
              Inicio
            </NavLink>
            <NavLink to="/admin/usuarios" className={linkClass}>
              Usuarios
            </NavLink>
            <NavLink to="/admin/comidas" className={linkClass}>
              Comidas
            </NavLink>
            <NavLink to="/admin/alimentos" className={linkClass}>
              Alimentos
            </NavLink>
            <NavLink to="/admin/rutinas" className={linkClass}>
              Rutinas
            </NavLink>
          </nav>
        </div>

        <div className="an-right">
          <button className="an-btn ghost" type="button" onClick={() => navigate("/app/inicio")}>
            Ver App
          </button>
          <button className="an-btn danger" type="button" onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      <style>{`
        :root{
          --bg: #0b0b0b;
          --bg2:#0f0f0f;
          --line:#222;
          --txt:#eaeaea;
          --muted:#b9b9b9;
          --gold:#f5d76e;
          --gold2:#ffd95e;
        }

        .an-wrap{
          position: sticky;
          top: 0;
          z-index: 60;
          background: linear-gradient(180deg, rgba(11,11,11,.92), rgba(11,11,11,.70));
          backdrop-filter: blur(8px) saturate(140%);
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .an-inner{
          max-width: 1180px;
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
          gap: 10px;
          border: none;
          background: transparent;
          color: var(--gold);
          font-weight: 900;
          cursor: pointer;
          padding: 0;
          white-space: nowrap;
          letter-spacing: .2px;
        }
        .an-brand span{
          color: var(--gold);
          text-shadow: 0 0 18px rgba(245,215,110,.12);
        }

        .an-nav{
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .an-link{
          color: var(--txt);
          text-decoration: none;
          padding: 9px 12px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 14px;
          background: rgba(15,15,15,.75);
          font-weight: 850;
          transition: transform .08s ease, box-shadow .15s ease, border-color .15s ease;
        }
        .an-link:hover{
          transform: translateY(-1px);
          border-color: rgba(245,215,110,.40);
          box-shadow: 0 0 0 3px rgba(245,215,110,.10);
        }
        .an-link.active{
          border-color: rgba(245,215,110,.60);
          box-shadow: 0 0 0 3px rgba(245,215,110,.14);
          background: rgba(245,215,110,.08);
        }

        .an-right{
          display: flex;
          gap: 10px;
          flex: 0 0 auto;
          align-items: center;
        }

        .an-btn{
          padding: 9px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(15,15,15,.75);
          color: var(--txt);
          cursor: pointer;
          font-weight: 900;
          transition: transform .08s ease, box-shadow .15s ease, border-color .15s ease;
        }
        .an-btn:hover{
          transform: translateY(-1px);
          border-color: rgba(245,215,110,.40);
          box-shadow: 0 0 0 3px rgba(245,215,110,.10);
        }
        .an-btn.ghost{
          border-color: rgba(255,255,255,.14);
          color: #f0f0f0;
        }
        .an-btn.danger{
          border-color: rgba(255,90,90,.25);
          background: rgba(60,10,10,.55);
        }
        .an-btn.danger:hover{
          border-color: rgba(255,90,90,.45);
          box-shadow: 0 0 0 3px rgba(255,90,90,.12);
        }

        @media (max-width: 680px){
          .an-inner{ align-items: flex-start; flex-direction: column; }
          .an-right{ width: 100%; }
          .an-btn{ flex: 1; }
        }
      `}</style>
    </header>
  );
}
