import React from "react";

export default function GoalPick({ value, onChange, onBack, onNext }) {
  const options = [
    { v: "perder_peso", t: "Perder peso", sub: "Déficit + progreso sostenido" },
    { v: "mantener_peso", t: "Mantener peso", sub: "Estabilidad y consistencia" },
    { v: "ganar_peso", t: "Ganar peso", sub: "Superávit controlado" },
  ];

  const iconFor = (v) => {
    if (v === "perder_peso") return "🔥";
    if (v === "ganar_peso") return "💪";
    return "➡️";
  };

  return (
    <div>
      <h1 className="ob2-h1">¿Cuál es tu objetivo?</h1>
      <p className="ob2-p">Elegí una opción. Después ajustamos el plan en detalle.</p>

      <div style={{ display: "grid", gap: 10 }}>
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              className={`ob2-opt ${active ? "selected" : ""}`}
              onClick={() => onChange?.(o.v)}
            >
              <div className="ob2-opt-left">
                <div className="ob2-icon">{iconFor(o.v)}</div>
                <div>
                  <p className="ob2-opt-title">{o.t}</p>
                  <p className="ob2-opt-sub">{o.sub}</p>
                </div>
              </div>

              <div className="ob2-radio">
                <div style={{ background: active ? "var(--ob2-accent)" : "transparent" }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <div className="ob2-row2">
            <button
              className="ob2-btn ghost"
              type="button"
              onClick={onBack}
            >
              Atrás
            </button>

            <button
              className="ob2-btn primary"
              type="button"
              onClick={onNext}
              disabled={!value}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
