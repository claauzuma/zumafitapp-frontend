import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "../Api.js";
import { setAuthGuest } from "../authCache.js";

export default function AdminNavBar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function logout() {
    try {
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch {}
    setAuthGuest();
    navigate("/", { replace: true });
  }

  function go(to) {
    setOpen(false);
    navigate(to);
  }

  const linkClass = ({ isActive }) => `an-link ${isActive ? "active" : ""}`;
  const mobileLinkClass = ({ isActive }) => `an-m-link ${isActive ? "active" : ""}`;

  return (
    <>
      <header className="an-wrap">
        <div className="an-inner">
          <button
            className="an-brand"
            type="button"
            onClick={() => navigate("/admin/inicio")}
          >
            <span className="an-brand-icon">🛡️</span>
            <span className="an-brand-text">ZumaFit Admin</span>
          </button>

          <nav className="an-nav an-nav-desktop">
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

          <div className="an-right an-right-desktop">
            <button
              className="an-btn ghost"
              type="button"
              onClick={() => navigate("/app/inicio")}
            >
              Ver App
            </button>
            <button className="an-btn danger" type="button" onClick={logout}>
              Salir
            </button>
          </div>

          <div className="an-mobile-actions">
            <button
              className="an-btn an-mobile-mini ghost"
              type="button"
              onClick={() => navigate("/app/inicio")}
            >
              App
            </button>

            <button
              className="an-btn an-mobile-mini danger"
              type="button"
              onClick={logout}
            >
              Salir
            </button>

            <button
              className="an-menu-btn"
              type="button"
              aria-label="Abrir menú admin"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {open && (
        <button
          className="an-backdrop"
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`an-drawer ${open ? "open" : ""}`}>
        <div className="an-drawer-head">
          <div className="an-drawer-title">Panel admin</div>
          <button
            className="an-drawer-close"
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="an-drawer-brand">
          <span>🛡️</span>
          <strong>ZumaFit Admin</strong>
        </div>

        <nav className="an-mobile-nav">
          <NavLink to="/admin/inicio" className={mobileLinkClass} onClick={() => setOpen(false)}>
            Inicio
          </NavLink>
          <NavLink to="/admin/usuarios" className={mobileLinkClass} onClick={() => setOpen(false)}>
            Usuarios
          </NavLink>
          <NavLink to="/admin/comidas" className={mobileLinkClass} onClick={() => setOpen(false)}>
            Comidas
          </NavLink>
          <NavLink to="/admin/alimentos" className={mobileLinkClass} onClick={() => setOpen(false)}>
            Alimentos
          </NavLink>
          <NavLink to="/admin/rutinas" className={mobileLinkClass} onClick={() => setOpen(false)}>
            Rutinas
          </NavLink>
        </nav>

        <div className="an-drawer-actions">
          <button className="an-btn ghost" type="button" onClick={() => go("/app/inicio")}>
            Ver App
          </button>
          <button className="an-btn danger" type="button" onClick={logout}>
            Salir
          </button>
        </div>
      </aside>

      <style>{`
        :root{
          --bg:#0b0b0b;
          --bg2:#121212;
          --line:rgba(255,255,255,.08);
          --txt:#f0f0f0;
          --gold:#f5d76e;
        }

        .an-wrap{
          position: sticky;
          top: 0;
          z-index: 80;
          background: linear-gradient(180deg, rgba(11,11,11,.95), rgba(11,11,11,.82));
          backdrop-filter: blur(8px) saturate(140%);
          border-bottom: 1px solid var(--line);
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
          min-width: 0;
        }

        .an-brand-icon{
          font-size: 18px;
          flex: 0 0 auto;
        }

        .an-brand-text{
          color: var(--gold);
          white-space: nowrap;
          font-size: 20px;
          line-height: 1;
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
          align-items: center;
          flex: 0 0 auto;
        }

        .an-btn{
          display: inline-flex;
          align-items: center;
          justify-content: center;
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

        .an-mobile-actions{
          display: none;
          align-items: center;
          gap: 8px;
        }

        .an-mobile-mini{
          min-width: 74px;
          padding: 8px 10px;
          border-radius: 12px;
          font-size: 13px;
        }

        .an-menu-btn{
          height: 40px;
          min-width: 42px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(15,15,15,.82);
          color: var(--txt);
          cursor: pointer;
          font-size: 18px;
          font-weight: 900;
        }

        .an-backdrop{
          position: fixed;
          inset: 0;
          z-index: 89;
          border: none;
          background: rgba(0,0,0,.46);
          backdrop-filter: blur(2px);
        }

        .an-drawer{
          position: fixed;
          top: 0;
          right: 0;
          width: min(84vw, 320px);
          height: 100dvh;
          z-index: 90;
          background: linear-gradient(180deg, #101010, #0a0a0a);
          border-left: 1px solid rgba(255,255,255,.08);
          box-shadow: -18px 0 40px rgba(0,0,0,.40);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transform: translateX(100%);
          transition: transform .22s ease;
        }

        .an-drawer.open{
          transform: translateX(0);
        }

        .an-drawer-head{
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .an-drawer-title{
          color: #cfcfcf;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .3px;
          text-transform: uppercase;
        }

        .an-drawer-close{
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.04);
          color: #fff;
          font-size: 16px;
          cursor: pointer;
        }

        .an-drawer-brand{
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--gold);
          font-size: 20px;
          font-weight: 900;
          padding: 6px 2px 10px;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }

        .an-mobile-nav{
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .an-m-link{
          color: var(--txt);
          text-decoration: none;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          font-weight: 850;
        }

        .an-m-link.active{
          border-color: rgba(245,215,110,.60);
          box-shadow: 0 0 0 3px rgba(245,215,110,.14);
          background: rgba(245,215,110,.08);
        }

        .an-drawer-actions{
          margin-top: auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        @media (max-width: 860px){
          .an-nav-desktop,
          .an-right-desktop{
            display: none;
          }

          .an-mobile-actions{
            display: flex;
          }

          .an-inner{
            padding: 10px 12px;
          }

          .an-brand-text{
            font-size: 16px;
            max-width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        @media (min-width: 861px){
          .an-backdrop,
          .an-drawer{
            display: none;
          }
        }
      `}</style>
    </>
  );
}
