import React from "react";

import "./routeLoading.css";

export function RouteLoadingFallback({ label = "Cargando seccion..." }) {
  return (
    <div className="route-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="route-loading-card">
        <span className="route-loading-mark">Z</span>
        <div>
          <strong>{label}</strong>
          <span>Preparando ZumaFit</span>
        </div>
        <i aria-hidden="true" />
      </div>
    </div>
  );
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
