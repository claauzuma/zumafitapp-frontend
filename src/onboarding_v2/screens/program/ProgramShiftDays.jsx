// src/onboarding_v2/screens/program/ProgramShiftDays.jsx
import React from "react";

export default function ProgramShiftDays({ days, value, onToggle, onBack, onNext }) {
  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Nuevo programa</div>
      </div>

      <div className="ob2-progressTop" />

      <h1 className="ob2-h1">¿Qué días querés con más calorías?</h1>
      <p className="ob2-p">Podés dejarlo vacío si preferís.</p>

      <div className="ob2-checkList">
        {days.map((d) => {
          const checked = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              className="ob2-checkRow"
              onClick={() => onToggle(d)}
            >
              <div className="ob2-checkText">{d}</div>
              <div className={`ob2-checkBox ${checked ? "on" : ""}`} />
            </button>
          );
        })}
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <button className="ob2-btn primary" type="button" onClick={onNext}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
