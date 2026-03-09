import React from "react";

export default function ProgramPlaceholder({ onFinish }) {
  return (
    <div className="ob2-card">
      <h2 className="ob2-h2" style={{ marginTop: 0 }}>Programa</h2>
      <p className="ob2-p">
        Acá va el onboarding de <b>Programa</b> (con pasos opcionales). Cuando me pases esas imágenes, lo replicamos.
      </p>

      <button className="ob2-btn primary" type="button" onClick={onFinish}>
        Terminar (placeholder)
      </button>
    </div>
  );
}