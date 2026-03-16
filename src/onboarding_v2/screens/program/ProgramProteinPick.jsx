// src/onboarding_v2/screens/program/ProgramProteinPick.jsx
import React from "react";

export default function ProgramProteinPick({ value, onChange, onBack, onNext }) {
  const options = [
    { v: "low", t: "Baja", s: "En el límite inferior del rango óptimo." },
    { v: "moderate", t: "Moderada", s: "En el medio del rango óptimo." },
    { v: "high", t: "Alta", s: "En el límite superior del rango óptimo." },
    { v: "extra_high", t: "Extra alta", s: "La recomendación más alta." },
  ];

  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Nuevo programa</div>
      </div>

      <div className="ob2-progressTop" />

      <h1 className="ob2-h1">¿Qué ingesta de proteína preferís?</h1>

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
              <div>
                <div className="ob2-choiceText">{o.t}</div>
                <div className="ob2-choiceSub">{o.s}</div>
              </div>
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
