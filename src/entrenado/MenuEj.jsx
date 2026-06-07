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
.menu-error{
  border:1px solid rgba(250,204,21,.28);
  background:rgba(15,15,15,.96);
  color:#eaeaea;
  border-radius:18px;
  padding:18px;
  margin-top:14px;
}
.menu-error strong{ color:#f5d76e; display:block; font-size:18px; margin-bottom:6px; }
.menu-error p{ color:#bdbdbd; margin:0 0 12px; font-weight:700; }
.menu-error button{
  border:0;
  border-radius:14px;
  background:linear-gradient(135deg,#facc15,#f5d76e);
  color:#0a0a0a;
  font-weight:900;
  padding:10px 14px;
}
@media (max-width: 640px){
  .menu-wrap{
    width:calc(100% + 20px);
    max-width:none;
    margin-inline:-10px;
    padding:8px 0 14px;
  }
  .menu-top,
  .tabs{
    padding-inline:2px;
  }
  .tabs{
    gap:8px;
    flex-wrap:nowrap;
    overflow-x:auto;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
  }
  .tabs::-webkit-scrollbar{ display:none; }
  .tab{
    flex:0 0 auto;
    padding:10px 13px;
  }
}
`;

class MenuErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Menu render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="menu-error">
          <strong>No se pudo mostrar el menú.</strong>
          <p>Hubo un error visual al cargar esta sección. Recargá la pantalla y, si sigue, revisamos el log puntual.</p>
          <button type="button" onClick={() => window.location.reload()}>Recargar</button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
        <MenuErrorBoundary>
          <Outlet />
        </MenuErrorBoundary>
      </div>
    </div>
  );
}
