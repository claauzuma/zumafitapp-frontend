// src/onboarding_v2/screens/program/ProgramGenerating.jsx
import React, { useEffect, useState } from "react";

const GENERATION_PHASES = [
  {
    label: "Analizando tu objetivo",
    detail: "Combinamos tus datos, actividad y meta principal.",
  },
  {
    label: "Distribuyendo calorías y macros",
    detail: "Equilibramos la energía y la proteína de tu semana.",
  },
  {
    label: "Preparando tu programa",
    detail: "Aplicamos los últimos ajustes para dejarlo listo.",
  },
];

export default function ProgramGenerating({ onBack, onDone }) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const secondPhaseTimer = setTimeout(() => setPhaseIndex(1), 520);
    const thirdPhaseTimer = setTimeout(() => setPhaseIndex(2), 1060);
    const doneTimer = setTimeout(() => onDone?.(), 1600);

    return () => {
      clearTimeout(secondPhaseTimer);
      clearTimeout(thirdPhaseTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  const phase = GENERATION_PHASES[phaseIndex];

  return (
    <div className="ob2-card ob2-generation-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack} aria-label="Volver al paso anterior">
          ←
        </button>
        <div className="ob2-top-title">Generando</div>
      </div>

      <h1 className="ob2-h1">Generando tu programa…</h1>
      <p className="ob2-p">Ajustamos el plan según tus respuestas.</p>

      <div className="ob2-generation-visual">
        <div className="ob2-orbitWrap ob2-generation-orbit" aria-hidden="true">
          <div className="ob2-orbitRing big" />
          <div className="ob2-orbitRing mid" />
          <div className="ob2-orbitRing small" />

          <div className="ob2-orbitDot dot-big" />
          <div className="ob2-orbitDot dot-mid" />
          <div className="ob2-orbitDot dot-small" />
        </div>
      </div>

      <div
        className="ob2-generation-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
      >
        <span className="ob2-generation-step">Paso {phaseIndex + 1} de {GENERATION_PHASES.length}</span>
        <strong className="ob2-generation-title">{phase.label}</strong>
        <span className="ob2-generation-detail">{phase.detail}</span>
      </div>

      <div className="ob2-generation-progress" aria-hidden="true">
        {GENERATION_PHASES.map((item, index) => (
          <span
            key={item.label}
            className={`ob2-generation-progress-segment ${index <= phaseIndex ? "is-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
