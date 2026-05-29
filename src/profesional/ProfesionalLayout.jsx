import React, { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getCachedUser } from "../authCache.js";
import ImpersonationBanner from "../ImpersonationBanner.jsx";

export default function ProfesionalLayout({ me: meProp }) {
  const me = meProp || getCachedUser() || null;
  const navItems = useMemo(() => buildNavItems(me), [me]);

  return (
    <>
      <ImpersonationBanner />
      <div className="pl-wrap">
        <aside className="pl-side">
          <div className="pl-brand">Panel profesional</div>
          <div className="pl-plan">{planLabel(me?.effectiveCapabilities?.planCode || me?.plan)}</div>

          <nav className="pl-nav">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="pl-link">
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="pl-main">
          <Outlet context={{ me }} />
        </main>

        <style>{styles}</style>
      </div>
    </>
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
    { to: "/profesional", label: "Inicio", end: true },
    { to: "/profesional/clientes", label: "Clientes" },
  ];

  if (canRoutines) items.push({ to: "/profesional/rutinas", label: "Rutinas" });
  if (canMenus) items.push({ to: "/profesional/menus", label: "Menus" });

  items.push({ to: "/profesional/progreso", label: "Progreso" });
  items.push({ to: "/profesional/perfil", label: "Perfil" });

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
  min-height:100dvh;
  display:grid;
  grid-template-columns:260px 1fr;
  background:#090b10;
  color:#eaeaea;
}
.pl-side{
  border-right:1px solid #1a2230;
  padding:18px;
  background:#0c1017;
}
.pl-brand{
  font-size:22px;
  font-weight:1000;
}
.pl-plan{
  margin:8px 0 18px;
  display:inline-flex;
  min-height:30px;
  align-items:center;
  padding:0 10px;
  border-radius:999px;
  border:1px solid rgba(245,215,110,.18);
  background:rgba(245,215,110,.07);
  color:#f5d76e;
  font-size:12px;
  font-weight:900;
}
.pl-nav{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.pl-link{
  padding:10px 12px;
  border-radius:12px;
  color:#d9dee6;
  text-decoration:none;
  font-weight:850;
}
.pl-link.active{
  background:rgba(245,215,110,.08);
  color:#f5d76e;
  border:1px solid rgba(245,215,110,.18);
}
.pl-main{
  padding:18px;
}
@media (max-width: 900px){
  .pl-wrap{
    grid-template-columns:1fr;
  }
  .pl-side{
    border-right:none;
    border-bottom:1px solid #1a2230;
  }
  .pl-nav{
    flex-direction:row;
    overflow:auto;
    padding-bottom:4px;
  }
  .pl-link{
    flex:0 0 auto;
  }
}
`;
