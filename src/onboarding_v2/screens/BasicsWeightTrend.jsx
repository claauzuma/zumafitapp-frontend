import React from "react";

export default function BasicsWeightTrend({ form, setForm }) {
  const options = [
    { value: "bajando", title: "Vengo bajando de peso", icon: "↓" },
    { value: "subiendo", title: "Vengo subiendo de peso", icon: "↑" },
    { value: "estable", title: "Estoy estable", icon: "—" },
    { value: "no_se", title: "No estoy seguro/a", icon: "?" },
  ];

  return (
    <>
      <h2 className="ob2-h2">¿Cómo fue tu peso estas semanas?</h2>
      <p className="ob2-p">Una referencia general nos ayuda a ajustar el plan.</p>

      <div style={{ display: "grid", gap: 12 }}>
        {options.map((o) => {
          const selected = form.tendenciaPeso === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={`ob2-opt ${selected ? "selected" : ""}`}
              onClick={() => setForm((p) => ({ ...p, tendenciaPeso: o.value }))}
            >
              <div className="ob2-opt-left">
                <div className="ob2-icon">{o.icon}</div>
                <div>
                  <p className="ob2-opt-title">{o.title}</p>
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