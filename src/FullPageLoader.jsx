import React from "react";
import BrandLogo from "./ui/BrandLogo.jsx";
import "./fullPageLoader.css";

export function LoadingCard({ title = "Cargando...", sub = "Preparando tu panel." }) {
  return (
    <div className="zl-card">
      <div className="zl-glow" aria-hidden="true" />
      <div className="zl-brand" aria-hidden="true">
        <BrandLogo size="lg" priority />
      </div>
      <div className="zl-content">
        <div className="zl-spinner" aria-hidden="true">
          <span />
        </div>
        <div className="zl-copy">
          <p className="zl-title">{title}</p>
          <p className="zl-sub">{sub}</p>
        </div>
      </div>
      <div className="zl-progress" aria-hidden="true"><span /></div>
    </div>
  );
}

export default function FullPageLoader({
  title = "Cargando...",
  sub = "Preparando tu panel.",
  variant = "page",
}) {
  return (
    <div
      className={`zl-wrap zl-${variant}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
    >
      <LoadingCard title={title} sub={sub} />
    </div>
  );
}
