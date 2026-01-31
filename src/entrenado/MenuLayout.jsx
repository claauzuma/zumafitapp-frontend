import React from "react";
import { NavLink, Outlet } from "react-router-dom";

const CSS = `
.m-wrap{ color:#eaeaea; }
.m-head{
  max-width:1100px;
  margin:0 auto;
  padding: 6px 0 10px;
}
.m-title{
  font-size: 22px;
  font-weight: 900;
  margin: 0 0 10px;
}
.m-tabs{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.m-tab{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  text-decoration:none;
  color:#eaeaea;
  font-weight:900;
  transition: transform .08s ease, box-shadow .15s ease, border-color .15s ease;
}
.m-tab:hover{
  transform: translateY(-1px);
  border-color:#3a3a3a;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.m-tab.active{
  background: linear-gradient(135deg,#facc15,#f5d76e);
  color:#0a0a0a;
  border-color: transparent;
}
.m-body{
  max-width:1100px;
  margin:0 auto;
  padding-top: 8px;
}
`;

export default function MenuLayout() {
  return (
    <div className="m-wrap">
      <style>{CSS}</style>

      <div className="m-head">
        <h2 className="m-title">🍽️ Menú</h2>

        <nav className="m-tabs" aria-label="Secciones de menú">
          {/* ✅ /app/menu => index => MenuEj (tu plan) */}
          <NavLink
            to="/app/menu"
            end
            className={({ isActive }) => `m-tab ${isActive ? "active" : ""}`}
          >
            📅 Menú
          </NavLink>

          <NavLink
            to="/app/menu/preferencias"
            className={({ isActive }) => `m-tab ${isActive ? "active" : ""}`}
          >
            ⚙️ Preferencias
          </NavLink>

          <NavLink
            to="/app/menu/favoritas"
            className={({ isActive }) => `m-tab ${isActive ? "active" : ""}`}
          >
            ⭐ Favoritas
          </NavLink>
        </nav>
      </div>

      <div className="m-body">
        <Outlet />
      </div>
    </div>
  );
}
