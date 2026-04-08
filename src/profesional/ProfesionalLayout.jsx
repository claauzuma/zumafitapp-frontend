import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { canNutrition, canTraining } from "../utils/roles.js";

export default function ProfesionalLayout({ me }) {
  const role = me?.role || "";

  return (
    <div className="pl-wrap">
      <aside className="pl-side">
        <div className="pl-brand">Panel profesional</div>

        <nav className="pl-nav">
          <NavLink to="/profesional" end className="pl-link">
            Inicio
          </NavLink>

          <NavLink to="/profesional/clientes" className="pl-link">
            Clientes
          </NavLink>

          {canTraining(role) && (
            <NavLink to="/profesional/rutinas" className="pl-link">
              Rutinas
            </NavLink>
          )}

          {canNutrition(role) && (
            <NavLink to="/profesional/menus" className="pl-link">
              Menús
            </NavLink>
          )}

          <NavLink to="/profesional/perfil" className="pl-link">
            Perfil
          </NavLink>
        </nav>
      </aside>

      <main className="pl-main">
        <Outlet />
      </main>

      <style>{styles}</style>
    </div>
  );
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
  margin-bottom:18px;
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
}
`;