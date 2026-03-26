// src/onboarding_v2/screens/program/ProgramGenerating.jsx
import React, { useEffect } from "react";

export default function ProgramGenerating({ onBack, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>
          ←
        </button>
        <div className="ob2-top-title">Generando</div>
      </div>

      <h1 className="ob2-h1">Generando tu programa…</h1>
      <p className="ob2-p">Ajustamos el plan según tus respuestas.</p>

      <div style={{ marginTop: 18, display: "grid", placeItems: "center" }}>
        <div className="ob2-orbitWrap" aria-label="Generando">
          <div className="ob2-orbitRing big" />
          <div className="ob2-orbitRing mid" />
          <div className="ob2-orbitRing small" />

          {/* dots que orbitan */}
          <div className="ob2-orbitDot dot-big" />
          <div className="ob2-orbitDot dot-mid" />
          <div className="ob2-orbitDot dot-small" />
        </div>
      </div>
    </div>
  );
}
