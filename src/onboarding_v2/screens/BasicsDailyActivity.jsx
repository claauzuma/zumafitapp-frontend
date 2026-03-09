import React from "react";

export default function BasicsDailyActivity({ form, setForm }) {
  const options = [
    { value: "sedentario", title: "Mayormente sedentario", sub: "Normalmente < 5.000 pasos/día", icon: "🛋️" },
    { value: "moderado", title: "Moderadamente activo", sub: "Normalmente 5.000–15.000 pasos/día", icon: "👟" },
    { value: "muy_activo", title: "Muy activo", sub: "Normalmente > 15.000 pasos/día", icon: "🛼" },
  ];

  return (
    <>
      <h2 className="ob2-h2">¿Qué tan activo/a sos?</h2>
      <p className="ob2-p">Actividad fuera del gym (trabajo, caminatas, etc.).</p>

      <div style={{ display: "grid", gap: 12 }}>
        {options.map((o) => {
          const selected = form.actividadDiaria === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={`ob2-opt ${selected ? "selected" : ""}`}
              onClick={() => setForm((p) => ({ ...p, actividadDiaria: o.value }))}
            >
              <div className="ob2-opt-left">
                <div className="ob2-icon">{o.icon}</div>
                <div>
                  <p className="ob2-opt-title">{o.title}</p>
                  <p className="ob2-opt-sub">{o.sub}</p>
                </div>
              </div>
              <div className="ob2-radio"><div /></div>
            </button>
          );
        })}
      </div>
    </>
  );
}