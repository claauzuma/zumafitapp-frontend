// src/onboarding_v2/screens/program/ProgramTrainingPick.jsx
import React from "react";

export default function ProgramTrainingPick({ value, onChange, onBack, onNext }) {
  const options = [
    { v: "none", t: "Nada o actividad suave" },
    { v: "lifting", t: "Musculación" },
    { v: "cardio", t: "Cardio" },
    { v: "both", t: "Cardio + Musculación" },
  ];

  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Nuevo programa</div>
      </div>

      <div className="ob2-progressTop" />

      <h1 className="ob2-h1">¿Qué entrenamiento vas a hacer?</h1>

      <div className="ob2-list">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              className={`ob2-choice ${active ? "active" : ""}`}
              onClick={() => onChange(o.v)}
            >
              <div className="ob2-choiceText">{o.t}</div>
              <div className={`ob2-radio ${active ? "on" : ""}`} />
            </button>
          );
        })}
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <button className="ob2-btn primary" type="button" onClick={onNext} disabled={!value}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
