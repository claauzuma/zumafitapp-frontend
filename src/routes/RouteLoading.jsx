import React from "react";

import FullPageLoader from "../FullPageLoader.jsx";
import "./routeLoading.css";

export function RouteLoadingFallback({ label = "Cargando seccion..." }) {
  return <FullPageLoader title={label} sub="Preparando ZumaFit." variant="contained" />;
}

export class RouteChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Error cargando chunk de ruta:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="route-loading route-loading-error" role="alert">
        <div className="route-loading-card">
          <span className="route-loading-mark warning">!</span>
          <div>
            <strong>No pudimos cargar esta seccion.</strong>
            <span>Puede ser un problema de conexion o una actualizacion reciente.</span>
          </div>
          <div className="route-loading-actions">
            <button type="button" onClick={() => window.location.reload()}>
              Reintentar
            </button>
            <a href="/">Volver al inicio</a>
          </div>
        </div>
      </div>
    );
  }
}
