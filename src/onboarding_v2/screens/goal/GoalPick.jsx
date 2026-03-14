// src/onboarding_v2/screens/goal/GoalPick.jsx
import React from "react";

export default function GoalPick({ value, onChange, onBack, onNext }) {
  const options = [
    { v: "perder_peso", t: "Perder peso" },
    { v: "mantener_peso", t: "Mantener peso" },
    { v: "ganar_peso", t: "Ganar peso" },
  ];

  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Definir nuevo objetivo</div>
      </div>

      <div className="ob2-progressTop" />

      <h1 className="ob2-h1">¿Cuál es tu objetivo?</h1>

      <div className="ob2-list">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              className={`ob2-choice ${active ? "active" : ""}`}
              onClick={() => onChange?.(o.v)}
            >
              <div className="ob2-choiceText">{o.t}</div>
              <div className={`ob2-radio ${active ? "on" : ""}`} />
            </button>
          );
        })}
      </div>

      <div className="ob2-sticky">
        <button className="ob2-btn primary" type="button" onClick={onNext} disabled={!value}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
