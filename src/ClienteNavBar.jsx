// src/ClientNavBar.jsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import { setAuthGuest } from "./authCache.js"; // (opcional: también clearAuthCache si lo tenés)

const CSS = `
.cn-wrap{
  background:#0b0b0b;
  border-bottom:1px solid #1b1b1b;
  position:sticky;
  top:0;
  z-index:60;
}
.cn{
  max-width:1100px;
  margin:0 auto;
  padding:10px 16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

/* izquierda: barra de iconos en una sola línea */
.cn-left{
  display:flex;
  align-items:center;
  gap:10px;
  flex:1;
  min-width:0;
  overflow-x:auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* firefox */
}
.cn-left::-webkit-scrollbar{ display:none; } /* chrome */

/* cada item = boton icono */
.cn-icon{
  width:44px;
  height:44px;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  text-decoration:none;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  font-size:18px;
  font-weight:900;
  flex:0 0 auto;
  position:relative;
  overflow:hidden;
  transition: transform .08s ease, box-shadow .15s ease, border-color .15s ease, filter .18s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.cn-icon:hover{
  transform: translateY(-1px);
  border-color:#3a3a3a;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.cn-icon:active{
  transform: translateY(1px) scale(.99);
}
.cn-icon::after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:10px;
  height:10px;
  transform: translate(-50%,-50%) scale(0);
  border-radius:999px;
  background: radial-gradient(circle, rgba(245,215,110,.30), transparent 60%);
  opacity:0;
  pointer-events:none;
}
.cn-icon:active::after{
  opacity:1;
  transform: translate(-50%,-50%) scale(18);
  transition: transform .45s ease, opacity .55s ease;
}

/* activo: dorado */
.cn-icon.active{
  background: linear-gradient(135deg,#facc15,#f5d76e);
  color:#0a0a0a;
  border:none;
  box-shadow: 0 10px 30px rgba(245,215,110,.14);
}

/* derecha */
.cn-right{
  display:flex;
  align-items:center;
  gap:10px;
  flex:0 0 auto;
}

/* botón salir solo icono */
.cn-logout{
  width:44px;
  height:44px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  cursor:pointer;
  font-weight:900;
  display:flex;
  align-items:center;
  justify-content:center;
  position:relative;
  overflow:hidden;
  transition: transform .08s ease, box-shadow .15s ease, border-color .15s ease, filter .18s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.cn-logout:hover{
  transform: translateY(-1px);
  border-color:#3a3a3a;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.cn-logout:active{
  transform: translateY(1px) scale(.99);
}
.cn-logout::after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:10px;
  height:10px;
  transform: translate(-50%,-50%) scale(0);
  border-radius:999px;
  background: radial-gradient(circle, rgba(245,215,110,.30), transparent 60%);
  opacity:0;
  pointer-events:none;
}
.cn-logout:active::after{
  opacity:1;
  transform: translate(-50%,-50%) scale(18);
  transition: transform .45s ease, opacity .55s ease;
}
.cn-logout:disabled{ opacity:.7; cursor:not-allowed; transform:none; box-shadow:none; }
.cn-logout.is-loading{
  border-color: rgba(245,215,110,.55);
  box-shadow: 0 0 0 3px rgba(245,215,110,.10), 0 10px 40px rgba(0,0,0,.35);
  filter: brightness(1.05);
}

/* responsive: achicar un toque en pantallas chicas */
@media (max-width: 520px){
  .cn{ padding:10px 12px; }
  .cn-icon, .cn-logout{ width:42px; height:42px; border-radius:13px; }
}

/* ✅ Overlay de logout (premium, dorado) */
.cn-ov{
  position:fixed;
  inset:0;
  background: rgba(11,11,11,.55);
  backdrop-filter: blur(6px) saturate(140%);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:9999;
  padding:18px;
}
.cn-ov-card{
  width:min(520px, 100%);
  border:1px solid #232323;
  background: linear-gradient(180deg,#121212,#0b0b0b);
  border-radius:18px;
  padding:18px 16px;
  position:relative;
  overflow:hidden;
  box-shadow: 0 18px 70px rgba(0,0,0,.65);
}
.cn-ov-glow{
  position:absolute;
  inset:-2px;
  background: radial-gradient(600px 200px at 20% 0%, rgba(245,215,110,.22), transparent 60%),
              radial-gradient(520px 220px at 80% 100%, rgba(250,204,21,.10), transparent 60%);
  pointer-events:none;
}
.cn-ov-row{
  display:flex;
  align-items:center;
  gap:12px;
  position:relative;
}
.cn-ov-spin{
  width:44px;
  height:44px;
  border-radius:50%;
  border:3px solid rgba(245,215,110,.18);
  border-top-color: rgba(245,215,110,.95);
  box-shadow: 0 0 18px rgba(245,215,110,.18);
  animation: cnSpin .9s linear infinite;
  flex:0 0 auto;
}
@keyframes cnSpin{ to{ transform: rotate(360deg); } }
.cn-ov-title{
  font-weight:900;
  margin:0;
  color:#f5d76e;
  font-size:16px;
}
.cn-ov-sub{
  margin:4px 0 0;
  color:#cfcfcf;
  font-size:13px;
  line-height:1.4;
}
.cn-ov-shimmer{
  margin-top:14px;
  height:10px;
  border-radius:999px;
  background:#101010;
  border:1px solid #1f1f1f;
  overflow:hidden;
  position:relative;
}
.cn-ov-shimmer::after{
  content:"";
  position:absolute;
  inset:0;
  transform: translateX(-60%);
  background: linear-gradient(90deg, transparent, rgba(245,215,110,.35), transparent);
  animation: cnShimmer 1.2s ease-in-out infinite;
}
@keyframes cnShimmer{ 0%{ transform: translateX(-60%);} 100%{ transform: translateX(160%);} }
`;

export default function ClientNavBar() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;

    setLoading(true);

    try {
      // backend: invalida cookie/sesión
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch (err) {
      // aunque falle, limpiamos la UI igual
      console.log("[ClientNavBar] logout FAIL (igual limpiamos)", err);
    } finally {
      // ✅ invalida el “hint” de auth del front
      setAuthGuest();
      // opcional si lo tenés: clearAuthCache();

      // ✅ navega a login / home
      nav("/", { replace: true });

      // si querés que el overlay quede 200ms para que se “sienta” pro:
      setTimeout(() => setLoading(false), 200);
    }
  }

  return (
    <div className="cn-wrap">
      <style>{CSS}</style>

      {loading && (
        <div className="cn-ov" role="status" aria-live="polite" aria-busy="true">
          <div className="cn-ov-card">
            <div className="cn-ov-glow" />
            <div className="cn-ov-row">
              <div className="cn-ov-spin" />
              <div>
                <p className="cn-ov-title">Cerrando sesión…</p>
                <p className="cn-ov-sub">Guardando cambios y asegurando tu cuenta.</p>
              </div>
            </div>
            <div className="cn-ov-shimmer" />
          </div>
        </div>
      )}

      <div className="cn">
        <div className="cn-left" aria-label="Navegación">
          <NavLink className={({ isActive }) => `cn-icon ${isActive ? "active" : ""}`} to="/app/inicio" title="Inicio" aria-label="Inicio">
            🏠
          </NavLink>

          <NavLink className={({ isActive }) => `cn-icon ${isActive ? "active" : ""}`} to="/app/menu" title="Menú" aria-label="Menú">
            🍽️
          </NavLink>

          <NavLink className={({ isActive }) => `cn-icon ${isActive ? "active" : ""}`} to="/app/rutinas" title="Rutinas" aria-label="Rutinas">
            🏋️
          </NavLink>

          <NavLink className={({ isActive }) => `cn-icon ${isActive ? "active" : ""}`} to="/app/progresos" title="Progresos" aria-label="Progresos">
            📈
          </NavLink>

          <NavLink className={({ isActive }) => `cn-icon ${isActive ? "active" : ""}`} to="/app/perfil" title="Perfil" aria-label="Perfil">
            👤
          </NavLink>

          <NavLink className={({ isActive }) => `cn-icon ${isActive ? "active" : ""}`} to="/app/ajustes" title="Ajustes" aria-label="Ajustes">
            ⚙️
          </NavLink>
        </div>

        <div className="cn-right">
          <button
            className={`cn-logout ${loading ? "is-loading" : ""}`}
            onClick={logout}
            disabled={loading}
            title={loading ? "Cerrando sesión…" : "Cerrar sesión"}
            aria-label={loading ? "Cerrando sesión…" : "Cerrar sesión"}
          >
            {loading ? "…" : "⎋"}
          </button>
        </div>
      </div>
    </div>
  );
}
