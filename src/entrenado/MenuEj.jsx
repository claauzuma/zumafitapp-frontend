// src/entrenado/MenuEj.jsx
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { MoreHorizontal, SlidersHorizontal, Star, Utensils } from "lucide-react";

const CSS = `
.menu-wrap{ max-width:1100px; margin:0 auto; padding:16px; color:#eaeaea; }
.menu-top{ position:relative; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.menu-title{ display:flex; align-items:center; gap:9px; font-weight:900; font-size:18px; }
.menu-mobile-actions{ display:none; position:relative; }
.menu-options-btn{
  width:40px;
  height:40px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#f5d76e;
  display:grid;
  place-items:center;
}
.menu-options-panel{
  position:fixed;
  left:12px;
  right:12px;
  bottom:calc(12px + env(safe-area-inset-bottom));
  z-index:100;
  border:1px solid #2b2b2b;
  border-radius:20px;
  background:linear-gradient(180deg,#141414,#0b0b0b);
  padding:8px;
  box-shadow:0 18px 50px rgba(0,0,0,.45);
}
.menu-options-backdrop{
  position:fixed;
  inset:0;
  z-index:99;
  border:0;
  background:rgba(0,0,0,.42);
  backdrop-filter:blur(4px);
}
.menu-options-title{
  padding:8px 10px 10px;
  color:#f5d76e;
  font-size:12px;
  font-weight:900;
  text-transform:uppercase;
}
.menu-option{
  display:flex;
  align-items:center;
  gap:10px;
  min-height:42px;
  padding:9px 10px;
  border-radius:12px;
  color:#eaeaea;
  text-decoration:none;
  font-size:13px;
  font-weight:900;
}
.menu-option.active{
  background:rgba(245,215,110,.12);
  color:#f5d76e;
}
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
.menu-outlet{ margin-top:14px; }
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
    width:100%;
    max-width:none;
    margin-inline:0;
    overflow-x:hidden;
    padding:8px 0 14px;
  }
  .menu-top,
  .tabs{
    padding-inline:2px;
  }
  .menu-top{
    min-height:42px;
    margin-bottom:6px;
  }
  .menu-title{
    font-size:16px;
  }
  .menu-mobile-actions{
    display:block;
  }
  .tabs{
    display:none;
  }
  .menu-outlet{
    margin-top:8px;
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
  const location = useLocation();
  const [actionsOpen, setActionsOpen] = useState(false);
  const currentTitle = location.pathname.endsWith("/preferencias")
    ? "Preferencias"
    : location.pathname.endsWith("/favoritas")
      ? "Favoritas"
      : "Menú del día";

  useEffect(() => {
    setActionsOpen(false);
  }, [location.pathname]);

  return (
    <div className="menu-wrap">
      <style>{CSS}</style>

      <div className="menu-top">
        <div className="menu-title">
          <Utensils size={20} />
          {currentTitle}
        </div>
        <div className="menu-mobile-actions">
          <button
            type="button"
            className="menu-options-btn"
            onClick={() => setActionsOpen((value) => !value)}
            aria-label="Opciones de menú"
            aria-expanded={actionsOpen}
          >
            <MoreHorizontal size={20} />
          </button>
          {actionsOpen ? (
            <>
              <button type="button" className="menu-options-backdrop" onClick={() => setActionsOpen(false)} aria-label="Cerrar opciones" />
              <div className="menu-options-panel" role="dialog" aria-label="Opciones de menú">
                <div className="menu-options-title">Menú</div>
                <NavLink to="/app/menu" end className={({ isActive }) => `menu-option ${isActive ? "active" : ""}`}>
                  <Utensils size={17} />
                  Menú del día
                </NavLink>
                <NavLink to="/app/menu/preferencias" className={({ isActive }) => `menu-option ${isActive ? "active" : ""}`}>
                  <SlidersHorizontal size={17} />
                  Preferencias
                </NavLink>
                <NavLink to="/app/menu/favoritas" className={({ isActive }) => `menu-option ${isActive ? "active" : ""}`}>
                  <Star size={17} />
                  Favoritas
                </NavLink>
              </div>
            </>
          ) : null}
        </div>
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

      <div className="menu-outlet">
        <MenuErrorBoundary>
          <Outlet />
        </MenuErrorBoundary>
      </div>
    </div>
  );
}
