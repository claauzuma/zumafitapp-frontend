// src/entrenado/MenuEj.jsx
import React from "react";
import { NavLink, Outlet } from "react-router-dom";

const CSS = `
.menu-wrap{ max-width:1100px; margin:0 auto; padding:16px; color:#eaeaea; }
.menu-top{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.menu-title{ font-weight:900; font-size:18px; }
.tabs{ margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; }
.tab{
  padding:10px 12px;
  border-radius:999px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  text-decoration:none;
  font-weight:900;
  font-size:12px;
}
.tab.active{
  background: linear-gradient(135deg,#facc15,#f5d76e);
  color:#0a0a0a;
  border-color:transparent;
}
`;

export default function MenuEj() {
  return (
    <div className="menu-wrap">
      <style>{CSS}</style>

      <div className="menu-top">
        <div className="menu-title">🍽️ Menú</div>
      </div>

      <div className="tabs">
        <NavLink
          to="/app/menu"
          end
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Menú
        </NavLink>

        <NavLink
          to="/app/menu/preferencias"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Preferencias
        </NavLink>

        <NavLink
          to="/app/menu/favoritas"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Favoritas
        </NavLink>
      </div>

      <div style={{ marginTop: 14 }}>
        <Outlet />
      </div>
    </div>
  );
}
