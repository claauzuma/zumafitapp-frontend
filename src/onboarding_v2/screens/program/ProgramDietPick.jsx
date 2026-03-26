// src/onboarding_v2/screens/program/ProgramDietPick.jsx
import React from "react";

export default function ProgramDietPick({ value, onChange, onBack, onNext }) {
  const options = [
    { v: "equilibrada", t: "Equilibrada", s: "Distribución estándar de carbohidratos y grasas." },
    { v: "baja_grasa", t: "Baja en grasa", s: "Reducimos grasa para priorizar carbohidratos y proteína." },
    { v: "baja_carbo", t: "Baja en carbohidratos", s: "Reducimos carbohidratos para priorizar grasa y proteína." },
    { v: "keto", t: "Keto", s: "Carbohidratos muy bajos para mayor consumo de grasa." },
  ];

  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Nuevo programa</div>
      </div>

      <div className="ob2-progressTop" />

      <h1 className="ob2-h1">¿Qué dieta preferís?</h1>
      <p className="ob2-p">Podés cambiarlo después. Te recomendamos empezar con una opción equilibrada.</p>

      <div className="ob2-list">
        {options.map((o) => {
          const active = value === o.v;
          const isRecommended = o.v === "equilibrada";

          return (
            <button
              key={o.v}
              type="button"
              className={`ob2-choice ${active ? "active" : ""}`}
              onClick={() => onChange(o.v)}
            >
              <div>
                <div className="ob2-choiceText" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {o.t}
                  {isRecommended ? (
<span className="ob2-pill rec">
  Recomendado
</span>

                  ) : null}
                </div>
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
