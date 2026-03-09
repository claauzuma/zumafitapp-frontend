import React from "react";

export default function BasicsExerciseFreq({ form, setForm }) {
  const options = [
    { value: "0", title: "0 sesiones / semana", icon: "📅" },
    { value: "1_3", title: "1–3 sesiones / semana", icon: "📆" },
    { value: "4_6", title: "4–6 sesiones / semana", icon: "🗓️" },
    { value: "7_plus", title: "7+ sesiones / semana", icon: "✅" },
  ];

  return (
    <>
      <h2 className="ob2-h2">¿Cada cuánto entrenás?</h2>
      <p className="ob2-p">Cardio, fuerza o deportes cuentan.</p>

      <div style={{ display: "grid", gap: 12 }}>
        {options.map((o) => {
          const selected = form.frecuenciaEjercicio === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={`ob2-opt ${selected ? "selected" : ""}`}
              onClick={() => setForm((p) => ({ ...p, frecuenciaEjercicio: o.value }))}
            >
              <div className="ob2-opt-left">
                <div className="ob2-icon">{o.icon}</div>
                <div><p className="ob2-opt-title">{o.title}</p></div>
              </div>
              <div className="ob2-radio"><div /></div>
            </button>
          );
        })}
      </div>
    </>
  );
}