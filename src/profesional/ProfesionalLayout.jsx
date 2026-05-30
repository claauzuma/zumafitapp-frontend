import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCircle,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { apiFetch } from "../Api.js";
import { getCachedUser, isImpersonating, setAuthGuest } from "../authCache.js";
import { useProfessionalMe } from "../authQueries.js";
import { clearPrivateQueryCache } from "../queryClient.js";
import ImpersonationBanner from "../ImpersonationBanner.jsx";

export default function ProfesionalLayout({ me: meProp }) {
  const navigate = useNavigate();
  const meQuery = useProfessionalMe();
  const me = meProp || meQuery.data || getCachedUser() || null;
  const navItems = useMemo(() => buildNavItems(me), [me]);
  const plan = planLabel(me?.effectiveCapabilities?.planCode || me?.plan);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut || isImpersonating()) return;

    setLoggingOut(true);
    try {
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("No se pudo cerrar sesion en el servidor:", error);
    }

    setAuthGuest();
    clearPrivateQueryCache();
    navigate("/", { replace: true });
  }

  return (
    <>
      <ImpersonationBanner />
      <div className="pl-wrap">
        <header className="pl-mobileBar">
          <BrandBlock compact />
          <button
            type="button"
            className="pl-menuBtn"
            aria-label="Abrir menu profesional"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <aside className="pl-side" aria-label="Panel profesional">
          <div>
            <BrandBlock />
            <div className="pl-plan">{plan}</div>
            <ProfesionalNav items={navItems} className="pl-nav" />
          </div>

          <button
            type="button"
            className="pl-logout"
            onClick={logout}
            disabled={loggingOut || isImpersonating()}
            title={isImpersonating() ? "Modo solo lectura" : "Cerrar sesion"}
          >
            <LogOut size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{loggingOut ? "Saliendo..." : "Salir"}</span>
          </button>
        </aside>

        {mobileOpen && (
          <button
            type="button"
            className="pl-backdrop"
            aria-label="Cerrar menu"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside className={`pl-drawer ${mobileOpen ? "open" : ""}`} aria-hidden={!mobileOpen}>
          <div className="pl-drawerHead">
            <div className="pl-drawerTitle">Panel profesional</div>
            <button
              type="button"
              className="pl-drawerClose"
              aria-label="Cerrar menu"
              onClick={() => setMobileOpen(false)}
            >
              <X size={19} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>

          <BrandBlock />
          <div className="pl-plan">{plan}</div>
          <ProfesionalNav items={navItems} className="pl-drawerNav" onNavigate={() => setMobileOpen(false)} />

          <button
            type="button"
            className="pl-logout drawer"
            onClick={logout}
            disabled={loggingOut || isImpersonating()}
            title={isImpersonating() ? "Modo solo lectura" : "Cerrar sesion"}
          >
            <LogOut size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{loggingOut ? "Saliendo..." : "Salir"}</span>
          </button>
        </aside>

        <main className="pl-main">
          <Outlet context={{ me }} />
        </main>

        <style>{styles}</style>
      </div>
    </>
  );
}

function BrandBlock({ compact = false }) {
  return (
    <div className={`pl-brandBlock ${compact ? "compact" : ""}`}>
      <div className="pl-mark">ZF</div>
      <div className="pl-brandCopy">
        <div className="pl-brand">ZumaFit Pro</div>
        <div className="pl-sub">Panel profesional</div>
      </div>
    </div>
  );
}

function ProfesionalNav({ items, className, onNavigate }) {
  return (
    <nav className={className} aria-label="Navegacion profesional">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `pl-link ${isActive ? "active" : ""}`}
            onClick={onNavigate}
          >
            <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function buildNavItems(me) {
  const specialties = me?.coachProfile?.specialties || {};
  const features = me?.effectiveCapabilities?.features || {};

  const canRoutines =
    !!specialties.training &&
    (!me?.effectiveCapabilities || Object.values(features?.routines || {}).some(Boolean));
  const canMenus =
    !!specialties.nutrition &&
    (!me?.effectiveCapabilities || Object.values(features?.menus || {}).some(Boolean));

  const items = [
    { to: "/profesional", label: "Inicio", end: true, icon: LayoutDashboard },
    { to: "/profesional/clientes", label: "Clientes", icon: Users },
  ];

  if (canRoutines) items.push({ to: "/profesional/rutinas", label: "Rutinas", icon: Dumbbell });
  if (canMenus) items.push({ to: "/profesional/menus", label: "Menus", icon: Utensils });

  items.push({ to: "/profesional/progreso", label: "Progreso", icon: Activity });
  items.push({ to: "/profesional/ajustes", label: "Ajustes", icon: Settings });
  items.push({ to: "/profesional/perfil", label: "Perfil", icon: UserCircle });

  return items;
}

function planLabel(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium2" || p === "vip") return "VIP";
  if (p === "premium" || p === "pro") return "Pro";
  return "Prueba Pro";
}

const styles = `
.pl-wrap{
  --pl-bg:#090909;
  --pl-panel:#101010;
  --pl-panel2:#0d0f12;
  --pl-line:rgba(255,255,255,.08);
  --pl-text:#edf0f3;
  --pl-muted:#aeb6c1;
  --pl-gold:#f5d76e;
  min-height:100dvh;
  display:grid;
  grid-template-columns:268px minmax(0, 1fr);
  background:var(--pl-bg);
  color:var(--pl-text);
}
.pl-side{
  position:sticky;
  top:0;
  height:100dvh;
  border-right:1px solid var(--pl-line);
  padding:18px 16px;
  background:linear-gradient(180deg, rgba(18,18,18,.98), rgba(9,9,9,.98));
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  gap:18px;
}
.pl-mobileBar{
  display:none;
}
.pl-brandBlock{
  display:flex;
  align-items:center;
  gap:12px;
  min-width:0;
}
.pl-mark{
  width:42px;
  height:42px;
  border-radius:15px;
  display:flex;
  align-items:center;
  justify-content:center;
  border:1px solid rgba(245,215,110,.24);
  background:linear-gradient(180deg, rgba(245,215,110,.13), rgba(255,255,255,.03));
  color:var(--pl-gold);
  font-weight:1000;
  letter-spacing:0;
}
.pl-brandCopy{
  min-width:0;
}
.pl-brand{
  font-size:20px;
  line-height:1;
  font-weight:1000;
  color:var(--pl-gold);
  white-space:nowrap;
}
.pl-sub{
  margin-top:4px;
  color:var(--pl-muted);
  font-size:12px;
  font-weight:800;
  letter-spacing:0;
  text-transform:uppercase;
}
.pl-plan{
  margin:16px 0 18px;
  display:inline-flex;
  min-height:30px;
  align-items:center;
  padding:0 11px;
  border-radius:999px;
  border:1px solid rgba(245,215,110,.22);
  background:rgba(245,215,110,.08);
  color:var(--pl-gold);
  font-size:12px;
  font-weight:950;
}
.pl-nav,
.pl-drawerNav{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.pl-link{
  display:flex;
  align-items:center;
  gap:10px;
  padding:11px 12px;
  border:1px solid transparent;
  border-radius:14px;
  color:#d9dee6;
  text-decoration:none;
  font-weight:850;
  transition:background .15s ease, border-color .15s ease, color .15s ease;
}
.pl-link:hover{
  background:rgba(255,255,255,.04);
  border-color:rgba(245,215,110,.14);
}
.pl-link.active{
  background:rgba(245,215,110,.09);
  color:var(--pl-gold);
  border-color:rgba(245,215,110,.26);
}
.pl-logout{
  width:100%;
  min-height:44px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  border-radius:14px;
  border:1px solid rgba(255,90,90,.24);
  background:rgba(255,90,90,.08);
  color:#ffd0d0;
  font-weight:900;
  cursor:pointer;
  transition:transform .12s ease, border-color .15s ease, box-shadow .15s ease;
}
.pl-logout:hover{
  transform:translateY(-1px);
  border-color:rgba(255,90,90,.42);
  box-shadow:0 0 0 3px rgba(255,90,90,.10);
}
.pl-logout:disabled{
  opacity:.58;
  cursor:not-allowed;
  transform:none;
  box-shadow:none;
}
.pl-logout.drawer{
  margin-top:auto;
}
.pl-main{
  min-width:0;
  width:min(100%, 1220px);
  justify-self:center;
  padding:18px;
}
.pl-backdrop{
  position:fixed;
  inset:0;
  z-index:89;
  border:none;
  background:rgba(0,0,0,.52);
  backdrop-filter:blur(3px);
}
.pl-drawer{
  position:fixed;
  top:0;
  right:0;
  z-index:90;
  width:min(86vw, 330px);
  height:100dvh;
  padding:16px;
  display:flex;
  flex-direction:column;
  gap:14px;
  background:linear-gradient(180deg, #101010, #080808);
  border-left:1px solid rgba(255,255,255,.08);
  box-shadow:-18px 0 40px rgba(0,0,0,.40);
  transform:translateX(100%);
  visibility:hidden;
  pointer-events:none;
  transition:transform .22s ease;
}
.pl-drawer.open{
  transform:translateX(0);
  visibility:visible;
  pointer-events:auto;
}
.pl-drawerHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.pl-drawerTitle{
  color:#cfcfcf;
  font-size:13px;
  font-weight:850;
  letter-spacing:0;
  text-transform:uppercase;
}
.pl-drawerClose,
.pl-menuBtn{
  width:40px;
  height:40px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);
  color:var(--pl-text);
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
}
.pl-drawerClose{
  width:38px;
  height:38px;
}
@media (min-width: 861px){
  .pl-backdrop,
  .pl-drawer{
    display:none;
  }
}
@media (max-width: 860px){
  .pl-wrap{
    grid-template-columns:1fr;
  }
  .pl-mobileBar{
    position:sticky;
    top:0;
    z-index:80;
    min-width:0;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:10px 12px;
    border-bottom:1px solid var(--pl-line);
    background:rgba(9,9,9,.92);
    backdrop-filter:blur(14px) saturate(145%);
  }
  .pl-side{
    display:none;
  }
  .pl-mark{
    width:38px;
    height:38px;
    border-radius:14px;
  }
  .pl-brandBlock.compact{
    min-width:0;
    flex:1 1 auto;
  }
  .pl-brand{
    max-width:155px;
    overflow:hidden;
    text-overflow:ellipsis;
    font-size:16px;
  }
  .pl-sub{
    display:none;
  }
  .pl-main{
    width:100%;
    padding:14px 12px 22px;
  }
}
@media (max-width: 420px){
  .pl-brand{
    max-width:130px;
  }
  .pl-drawer{
    width:min(92vw, 330px);
    padding:14px;
  }
}
`;
