// src/onboarding_v2/screens/goal/GoalIntro.jsx
import React from "react";

export default function GoalIntro({ onNext }) {
  return (
    <div className="ob2-card">
      <h1 className="ob2-h1">¡Vamos con tu objetivo!</h1>
      <p className="ob2-p">
        Ahora definimos tu meta y armamos un plan para ayudarte a lograrla.
      </p>

      {/* Timeline (usa clases existentes del CSS) */}
      <div className="ob2-timeline">
        <div className="ob2-line">
          <div className="ob2-bubble active">✓</div>
          <div>
            <p className="ob2-section-title">Básicos</p>
            <p className="ob2-section-sub">Listo</p>
          </div>
        </div>

        <div className="ob2-line">
          <div className="ob2-bubble active">2</div>
          <div>
            <p className="ob2-section-title">Objetivo</p>
            <p className="ob2-section-sub">Elegí tu meta</p>
          </div>
        </div>

        <div className="ob2-line">
          <div className="ob2-bubble">3</div>
          <div>
            <p className="ob2-section-title">Programa</p>
            <p className="ob2-section-sub">Últimos detalles</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="ob2-btn primary" type="button" onClick={onNext}>
          Ir a Objetivo
        </button>
      </div>
    </div>
  );
}
