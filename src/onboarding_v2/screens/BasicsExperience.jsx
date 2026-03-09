import React from "react";

export default function BasicsExperience({ form, setForm }) {
  const options = [
    { value: "ninguna", title: "Nada", sub: "Actualmente no entreno fuerza", icon: "⚫" },
    { value: "principiante", title: "Principiante", sub: "Menos de 1 año", icon: "🟤" },
    { value: "intermedio", title: "Intermedio", sub: "Más de 1 año (menos de 4)", icon: "🟠" },
    { value: "avanzado", title: "Avanzado", sub: "4 años o más", icon: "🟡" },
  ];

  return (
    <>
      <h2 className="ob2-h2">¿Tu experiencia con pesas?</h2>
      <p className="ob2-p">Esto ayuda a ajustar tu programa de entrenamiento.</p>

      <div style={{ display: "grid", gap: 12 }}>
        {options.map((o) => {
          const selected = form.experienciaPesas === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={`ob2-opt ${selected ? "selected" : ""}`}
              onClick={() => setForm((p) => ({ ...p, experienciaPesas: o.value }))}
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