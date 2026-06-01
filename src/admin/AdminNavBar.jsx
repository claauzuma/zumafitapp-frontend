import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Apple,
  Dumbbell,
  Home,
  LoaderCircle,
  LogOut,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Utensils,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "../Api.js";
import { setAuthGuest } from "../authCache.js";
import { clearPrivateQueryCache } from "../queryClient.js";
import AppToast from "../ui/AppToast.jsx";

const NAV_ITEMS = [
  { to: "/admin/inicio", label: "Inicio", icon: Home },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/comidas", label: "Comidas", icon: Utensils },
  { to: "/admin/alimentos", label: "Alimentos", icon: Apple },
  { to: "/admin/rutinas", label: "Rutinas", icon: Dumbbell },
  { to: "/admin/coach-planes", label: "Planes", icon: SlidersHorizontal },
];

export default function AdminNavBar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState(null);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setToast(null);
    try {
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("No se pudo cerrar sesion en el servidor:", error);
      setToast({
        type: "error",
        message: error?.message || "No se pudo cerrar sesion. Proba de nuevo.",
      });
      setLoggingOut(false);
      return;
    }

    setAuthGuest();
    clearPrivateQueryCache();
    navigate("/", { replace: true });
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
            <span className="an-brand-mark" aria-hidden="true">
              <ShieldCheck size={21} strokeWidth={2.4} />
            </span>
            <span className="an-brand-copy">
              <span className="an-brand-text">ZumaFit Admin</span>
              <span className="an-brand-sub">Panel de control</span>
            </span>
          </button>

          <nav className="an-nav an-nav-desktop" aria-label="Navegacion admin">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="an-right an-right-desktop">
            <button className="an-btn danger" type="button" onClick={logout} disabled={loggingOut}>
              {loggingOut ? (
                <LoaderCircle className="an-spin" size={17} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <LogOut size={17} strokeWidth={2.2} aria-hidden="true" />
              )}
              <span>{loggingOut ? "Cerrando sesión..." : "Salir"}</span>
            </button>
          </div>

          <div className="an-mobile-actions">
            <button
              className="an-menu-btn"
              type="button"
              aria-label="Abrir menu admin"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <button
          className="an-backdrop"
          type="button"
          aria-label="Cerrar menu"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`an-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="an-drawer-head">
          <div className="an-drawer-title">Panel admin</div>
          <button
            className="an-drawer-close"
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setOpen(false)}
          >
            <X size={19} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        <div className="an-drawer-brand">
          <span className="an-brand-mark" aria-hidden="true">
            <ShieldCheck size={21} strokeWidth={2.4} />
          </span>
          <strong>ZumaFit Admin</strong>
        </div>

        <nav className="an-mobile-nav" aria-label="Navegacion admin mobile">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={mobileLinkClass} onClick={() => setOpen(false)}>
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="an-drawer-actions">
          <button className="an-btn danger" type="button" onClick={logout} disabled={loggingOut}>
            {loggingOut ? (
              <LoaderCircle className="an-spin" size={17} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <LogOut size={17} strokeWidth={2.2} aria-hidden="true" />
            )}
            <span>{loggingOut ? "Cerrando sesión..." : "Salir"}</span>
          </button>
        </div>
      </aside>

      <AppToast toast={toast} onClose={() => setToast(null)} />

      <style>{`
        :root{
          --bg:#090909;
          --line:rgba(255,255,255,.08);
          --txt:#f0f0f0;
          --muted:#aeb4be;
          --gold:#f5d76e;
          --gold-soft:rgba(245,215,110,.10);
        }

        .an-wrap{
          position: sticky;
          top: 0;
          z-index: 80;
          background: rgba(9,9,9,.90);
          backdrop-filter: blur(14px) saturate(145%);
          border-bottom: 1px solid var(--line);
        }

        .an-inner{
          max-width: 1220px;
          margin: 0 auto;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .an-brand{
          display: inline-flex;
          align-items: center;
          gap: 11px;
          border: none;
          background: transparent;
          color: var(--gold);
          font-weight: 900;
          cursor: pointer;
          padding: 0;
          min-width: 0;
        }

        .an-brand-mark{
          width: 38px;
          height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(245,215,110,.22);
          background: linear-gradient(180deg, rgba(245,215,110,.12), rgba(255,255,255,.03));
          color: var(--gold);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .an-brand-copy{
          display: grid;
          gap: 2px;
          min-width: 0;
          text-align: left;
        }

        .an-brand-text{
          color: var(--gold);
          white-space: nowrap;
          font-size: 18px;
          line-height: 1;
          letter-spacing: .2px;
        }

        .an-brand-sub{
          color: var(--muted);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .an-nav{
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 4px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 18px;
          background: rgba(255,255,255,.025);
        }

        .an-link{
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--txt);
          text-decoration: none;
          padding: 9px 11px;
          border: 1px solid transparent;
          border-radius: 14px;
          background: transparent;
          font-size: 14px;
          font-weight: 850;
          transition: background .15s ease, color .15s ease, border-color .15s ease;
        }

        .an-link:hover{
          border-color: rgba(245,215,110,.16);
          background: rgba(245,215,110,.055);
          color: #fff6d2;
        }

        .an-link.active{
          border-color: rgba(245,215,110,.28);
          background: var(--gold-soft);
          color: var(--gold);
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
          gap: 8px;
          min-height: 40px;
          padding: 0 13px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(15,15,15,.72);
          color: var(--txt);
          cursor: pointer;
          font-weight: 900;
          transition: transform .08s ease, box-shadow .15s ease, border-color .15s ease, background .15s ease;
        }

        .an-btn:hover{
          transform: translateY(-1px);
          border-color: rgba(245,215,110,.30);
          box-shadow: 0 0 0 3px rgba(245,215,110,.08);
        }

        .an-btn.danger{
          border-color: rgba(255,90,90,.25);
          background: rgba(255,90,90,.08);
          color: #ffd0d0;
        }

        .an-btn:disabled{
          opacity: .68;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .an-spin{
          animation: an-spin .8s linear infinite;
        }

        @keyframes an-spin{
          to{ transform: rotate(360deg); }
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

        .an-menu-btn{
          height: 40px;
          width: 42px;
          padding: 0;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(15,15,15,.82);
          color: var(--txt);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .an-backdrop{
          position: fixed;
          inset: 0;
          z-index: 89;
          border: none;
          background: rgba(0,0,0,.52);
          backdrop-filter: blur(3px);
        }

        .an-drawer{
          position: fixed;
          top: 0;
          right: 0;
          width: min(86vw, 330px);
          height: 100dvh;
          z-index: 90;
          background: linear-gradient(180deg, #101010, #080808);
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
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .an-drawer-brand{
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--gold);
          font-size: 20px;
          font-weight: 900;
          padding: 6px 2px 12px;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }

        .an-mobile-nav{
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .an-m-link{
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--txt);
          text-decoration: none;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          font-weight: 850;
        }

        .an-m-link.active{
          border-color: rgba(245,215,110,.50);
          box-shadow: 0 0 0 3px rgba(245,215,110,.10);
          background: rgba(245,215,110,.08);
          color: var(--gold);
        }

        .an-drawer-actions{
          margin-top: auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        @media (max-width: 1040px){
          .an-link span{
            display: none;
          }
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
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .an-brand-sub{
            display: none;
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
