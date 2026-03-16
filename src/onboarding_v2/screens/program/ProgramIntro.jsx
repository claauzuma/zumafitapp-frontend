// src/onboarding_v2/screens/program/ProgramIntro.jsx
import React from "react";

export default function ProgramIntro({ onBack, onNext }) {
  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Programa</div>
      </div>

      <h1 className="ob2-h1">¡Listo para tu programa!</h1>
      <p className="ob2-p">Contanos tus preferencias para ajustar el plan.</p>

      <div className="ob2-timeline">
        <div className="ob2-line">
          <div className="ob2-bubble active">✓</div>
          <div>
            <p className="ob2-section-title">Básicos</p>
            <p className="ob2-section-sub">Listo</p>
          </div>
        </div>

        <div className="ob2-line">
          <div className="ob2-bubble active">✓</div>
          <div>
            <p className="ob2-section-title">Objetivo</p>
            <p className="ob2-section-sub">Listo</p>
          </div>
        </div>

        <div className="ob2-line">
          <div className="ob2-bubble active">3</div>
          <div>
            <p className="ob2-section-title">Programa</p>
            <p className="ob2-section-sub">Últimos detalles</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="ob2-btn primary" type="button" onClick={onNext}>
          Ir a Programa
        </button>
      </div>
    </div>
  );
}
