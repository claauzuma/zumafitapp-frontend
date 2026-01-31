// src/ClientShell.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import { setAuthGuest, getCachedUser } from "./authCache.js";

const CSS = `
:root{
  --bg:#0b0b0b;
  --panel:#101010;
  --panel2:#0f0f0f;
  --border:#232323;
  --border2:#2b2b2b;
  --txt:#eaeaea;
  --muted:#cfcfcf;
  --gold:#f5d76e;
  --gold2:#facc15;
}

.cs-wrap{
  min-height:100vh;
  background: var(--bg);
  color: var(--txt);
}

/* header */
.cs-header{
  position: sticky;
  top: 0;
  z-index: 80;
  border-bottom:1px solid #1b1b1b;
  background: rgba(11,11,11,.92);
  backdrop-filter: blur(8px) saturate(140%);
}
.cs-header-inner{
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.cs-brand{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
}
.cs-logo{
  width:42px;
  height:42px;
  border-radius:14px;
  border:1px solid var(--border2);
  background: linear-gradient(180deg,#141414,#0f0f0f);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:900;
  color: var(--gold);
}
.cs-title{
  font-weight: 900;
  line-height:1.1;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-sub{
  font-size:12px;
  color: var(--muted);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-actions{
  display:flex;
  align-items:center;
  gap:10px;
}

/* botones */
.cs-btn{
  width:44px;
  height:44px;
  border-radius:14px;
  border:1px solid var(--border2);
  background: var(--panel2);
  color: var(--txt);
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
.cs-btn:hover{
  transform: translateY(-1px);
  border-color:#3a3a3a;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.cs-btn:active{ transform: translateY(1px) scale(.99); }
.cs-btn:disabled{ opacity:.7; cursor:not-allowed; transform:none; box-shadow:none; }
.cs-btn.is-loading{
  border-color: rgba(245,215,110,.55);
  box-shadow: 0 0 0 3px rgba(245,215,110,.10), 0 10px 40px rgba(0,0,0,.35);
  filter: brightness(1.05);
}
.cs-btn::after{
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
.cs-btn:active::after{
  opacity:1;
  transform: translate(-50%,-50%) scale(18);
  transition: transform .45s ease, opacity .55s ease;
}

/* content */
.cs-content{
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 14px 26px;
}

/* overlay + drawer */
.cs-ov{
  position:fixed;
  inset:0;
  z-index: 9998;
  background: rgba(11,11,11,.55);
  backdrop-filter: blur(6px) saturate(140%);
}
.cs-drawer{
  position:fixed;
  top:0;
  right:0;
  height: 100vh;
  width: min(380px, 92vw);
  z-index: 9999;
  border-left:1px solid var(--border);
  background: linear-gradient(180deg,#121212,#0b0b0b);
  box-shadow: -18px 0 70px rgba(0,0,0,.65);
  transform: translateX(110%);
  transition: transform .18s ease;
  display:flex;
  flex-direction:column;
}
.cs-drawer.open{ transform: translateX(0); }

.cs-d-head{
  padding: 14px 14px 12px;
  border-bottom:1px solid #1b1b1b;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}

/* profile header */
.cs-prof{
  display:flex;
  align-items:center;
  gap:12px;
  min-width:0;
}
.cs-avatar{
  width:48px;
  height:48px;
  border-radius:999px;
  border:1px solid var(--border2);
  background: radial-gradient(600px 200px at 20% 0%, rgba(245,215,110,.18), transparent 60%),
              linear-gradient(180deg,#141414,#0f0f0f);
  display:flex;
  align-items:center;
  justify-content:center;
  color: var(--gold);
  font-weight: 900;
  font-size: 18px;
  flex: 0 0 auto;
  overflow:hidden;
}
.cs-avatar img{
  width:100%;
  height:100%;
  object-fit: cover;
  display:block;
}
.cs-prof-name{
  font-weight: 900;
  color: var(--txt);
  line-height:1.1;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-prof-sub{
  font-size:12px;
  color: var(--muted);
  margin-top: 3px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-prof-link{
  display:inline-flex;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 900;
  color: var(--gold);
  text-decoration:none;
  width: fit-content;
}
.cs-prof-link:hover{ text-decoration: underline; }

/* section title */
.cs-sec{
  padding: 10px 10px 0;
}
.cs-sec-title{
  padding: 10px 12px 6px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(245,215,110,.85);
}

/* item */
.cs-item, .cs-item-disabled{
  display:flex;
  align-items:center;
  gap:10px;
  padding: 12px 12px;
  border-radius: 14px;
  border:1px solid transparent;
  text-decoration:none;
  color: var(--txt);
  font-weight: 800;
  transition: background .15s ease, border-color .15s ease, transform .08s ease;
  margin: 4px 10px;
}
.cs-item:hover{
  background: #0f0f0f;
  border-color: #242424;
  transform: translateY(-1px);
}
.cs-item.active{
  background: linear-gradient(135deg,var(--gold2),var(--gold));
  color:#0a0a0a;
  border-color: transparent;
}
.cs-ic{
  width:40px;
  height:40px;
  border-radius: 14px;
  border:1px solid var(--border2);
  background: #0f0f0f;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 18px;
  flex: 0 0 auto;
}
.cs-item.active .cs-ic{
  border-color: rgba(0,0,0,.15);
  background: rgba(0,0,0,.08);
}
.cs-desc{
  display:flex;
  flex-direction:column;
  gap:2px;
  min-width:0;
}

/* ✅ descripción SIEMPRE visible */
.cs-subline{
  display:block;
  margin-top:2px;
  font-weight: 600;
  color: var(--muted);
  opacity:.9;
}
.cs-item.active .cs-subline{
  color:#0b0b0b;
  opacity:.85;
}

/* disabled item */
.cs-item-disabled{
  background:#0f0f0f;
  border-color:#1e1e1e;
  opacity: .78;
  cursor: not-allowed;
}
.cs-item-disabled:hover{ transform:none; }
.cs-badge{
  margin-left:auto;
  font-size:11px;
  font-weight:900;
  color:#0a0a0a;
  background: linear-gradient(135deg,var(--gold2),var(--gold));
  padding:6px 10px;
  border-radius:999px;
}

/* drawer body scroll */
.cs-d-body{
  padding: 4px 0 10px;
  overflow:auto;
}

/* footer */
.cs-d-foot{
  margin-top:auto;
  padding: 12px 14px 16px;
  border-top:1px solid #1b1b1b;
  display:flex;
  flex-direction:column;
  gap:10px;
}
.cs-foot-item{
  width:100%;
  justify-content:center;
}

/* logout overlay (premium) */
.cn-ov{
  position:fixed;
  inset:0;
  background: rgba(11,11,11,.55);
  backdrop-filter: blur(6px) saturate(140%);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:10000;
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
.cn-ov-row{ display:flex; align-items:center; gap:12px; position:relative; }
.cn-ov-spin{
  width:44px; height:44px; border-radius:50%;
  border:3px solid rgba(245,215,110,.18);
  border-top-color: rgba(245,215,110,.95);
  box-shadow: 0 0 18px rgba(245,215,110,.18);
  animation: cnSpin .9s linear infinite;
  flex:0 0 auto;
}
@keyframes cnSpin{ to{ transform: rotate(360deg); } }
.cn-ov-title{ font-weight:900; margin:0; color:#f5d76e; font-size:16px; }
.cn-ov-sub{ margin:4px 0 0; color:#cfcfcf; font-size:13px; line-height:1.4; }
.cn-ov-shimmer{
  margin-top:14px; height:10px; border-radius:999px;
  background:#101010; border:1px solid #1f1f1f;
  overflow:hidden; position:relative;
}
.cn-ov-shimmer::after{
  content:""; position:absolute; inset:0;
  transform: translateX(-60%);
  background: linear-gradient(90deg, transparent, rgba(245,215,110,.35), transparent);
  animation: cnShimmer 1.2s ease-in-out infinite;
}
@keyframes cnShimmer{ 0%{ transform: translateX(-60%);} 100%{ transform: translateX(160%);} }

@media (max-width:520px){
  .cs-header-inner{ padding:10px 12px; }
  .cs-btn{ width:42px; height:42px; border-radius:13px; }
  .cs-logo{ width:40px; height:40px; border-radius:13px; }
  .cs-avatar{ width:46px; height:46px; }
}
`;

function firstName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0];
}
function initialFromName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "Z";
  return s[0].toUpperCase();
}

/**
 * 🔧 CONFIG
 * - Se quitó Notificaciones del drawer.
 * - Ajustes también se quitó del drawer (queda solo "Salir" abajo).
 */
const NAV_TOP = [
  { to: "/app/inicio", label: "Inicio", sub: "Resumen y accesos", icon: "🏠", enabled: true },
];

const NAV_SECTIONS = [
  {
    title: "Tu plan",
    items: [
      { to: "/app/menu", label: "Menú", sub: "Comidas y planificación", icon: "🍽️", enabled: true },
      { to: "/app/rutinas", label: "Rutina", sub: "Entrenamiento", icon: "🏋️", enabled: true },
      { to: "/app/equivalencias", label: "Equivalencias", sub: "Intercambios de alimentos", icon: "🧠", enabled: false },
    ],
  },
  {
    title: "Tu progreso",
    items: [
      { to: "/app/progresos", label: "Progresos", sub: "Medidas y fotos", icon: "📈", enabled: true },
    ],
  },
  {
    title: "Social",
    items: [
      { to: "/app/amigos", label: "Amigos", sub: "Conexiones", icon: "🤝", enabled: false },
      { to: "/app/feed", label: "Feed", sub: "Actividad", icon: "📰", enabled: false },
    ],
  },
];

export default function ClientShell() {
  const nav = useNavigate();
  const loc = useLocation();
  const user = useMemo(() => getCachedUser(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ cierra drawer cuando cambia la ruta
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  // ✅ ESC para cerrar
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch (err) {
      console.log("[ClientShell] logout FAIL (igual limpiamos)", err);
    } finally {
      setAuthGuest();
      nav("/", { replace: true });
      setTimeout(() => setLoading(false), 200);
    }
  }

  const fullName = user?.profile?.nombre || user?.nombre || "";
  const nombre = firstName(fullName);
  const sub = nombre ? `Hola, ${nombre}` : "Tu espacio";

  // (opcional) si en el futuro tenés una URL de avatar:
  const avatarUrl = user?.profile?.avatarUrl || user?.avatarUrl || "";

  function renderItem(it) {
    if (!it.enabled) {
      return (
        <div key={it.to} className="cs-item-disabled" title={`${it.label} (Próximamente)`}>
          <span className="cs-ic">{it.icon}</span>
          <span className="cs-desc">
            <span>{it.label}</span>
            <small className="cs-subline">{it.sub}</small>
          </span>
          <span className="cs-badge">Próximamente</span>
        </div>
      );
    }

    return (
      <NavLink
        key={it.to}
        to={it.to}
        className={({ isActive }) => `cs-item ${isActive ? "active" : ""}`}
        title={it.label}
      >
        <span className="cs-ic">{it.icon}</span>
        <span className="cs-desc">
          <span>{it.label}</span>
          <small className="cs-subline">{it.sub}</small>
        </span>
      </NavLink>
    );
  }

  return (
    <div className="cs-wrap">
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

      <header className="cs-header">
        <div className="cs-header-inner">
          <div className="cs-brand">
            <div className="cs-logo">Z</div>
            <div style={{ minWidth: 0 }}>
              <div className="cs-title">ZumaFit</div>
              <div className="cs-sub">{sub}</div>
            </div>
          </div>

          <div className="cs-actions">
            <button className="cs-btn" onClick={() => setOpen(true)} aria-label="Abrir menú" title="Menú">
              ☰
            </button>

            <button
              className={`cs-btn ${loading ? "is-loading" : ""}`}
              onClick={logout}
              disabled={loading}
              aria-label={loading ? "Cerrando sesión…" : "Cerrar sesión"}
              title={loading ? "Cerrando sesión…" : "Cerrar sesión"}
            >
              {loading ? "…" : "⎋"}
            </button>
          </div>
        </div>
      </header>

      {/* overlay */}
      {open && <div className="cs-ov" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`cs-drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Menú principal">
        <div className="cs-d-head">
          <div className="cs-prof">
            <div className="cs-avatar" aria-label="Avatar">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" /> : <span>{initialFromName(fullName)}</span>}
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="cs-prof-name">{fullName ? fullName : "Mi cuenta"}</div>
              <div className="cs-prof-sub">{sub}</div>

              <NavLink className="cs-prof-link" to="/app/perfil">
                Ver mi perfil →
              </NavLink>
            </div>
          </div>

          <button className="cs-btn" onClick={() => setOpen(false)} aria-label="Cerrar menú" title="Cerrar">
            ✕
          </button>
        </div>

        <div className="cs-d-body">
          {/* TOP */}
          <div className="cs-sec">{NAV_TOP.map(renderItem)}</div>

          {/* SECTIONS */}
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.title} className="cs-sec">
              <div className="cs-sec-title">{sec.title}</div>
              {sec.items.map(renderItem)}
            </div>
          ))}
        </div>

        <div className="cs-d-foot">
          {/* Salir (último de todo) */}
          <button
            className="cs-btn cs-foot-item"
            onClick={logout}
            disabled={loading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? "Cerrando…" : "Salir"}
          </button>
        </div>
      </aside>

      {/* contenido */}
      <main className="cs-content">
        <Outlet />
      </main>
    </div>
  );
}
