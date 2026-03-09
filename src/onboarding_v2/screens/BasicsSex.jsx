import React from "react";

export default function BasicsSex({ form, setForm }) {
  const options = [
    { value: "femenino", title: "Femenino", icon: "♀" },
    { value: "masculino", title: "Masculino", icon: "♂" },
    { value: "prefiero_no_decir", title: "Prefiero no decir", icon: "?" },
  ];

  return (
    <>
      <h2 className="ob2-h2">¿Cuál es tu sexo?</h2>
      <p className="ob2-p">Nos ayuda a estimar tu gasto calórico con mayor precisión.</p>

      <div style={{ display: "grid", gap: 12 }}>
        {options.map((o) => {
          const selected = form.sexo === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={`ob2-opt ${selected ? "selected" : ""}`}
              onClick={() => setForm((p) => ({ ...p, sexo: o.value }))}
            >
              <div className="ob2-opt-left">
                <div className="ob2-icon">{o.icon}</div>
                <div>
                  <p className="ob2-opt-title">{o.title}</p>
                </div>
              </div>
              <div className="ob2-radio">
                <div />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}