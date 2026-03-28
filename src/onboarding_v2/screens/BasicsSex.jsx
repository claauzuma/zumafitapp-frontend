import React from "react";

export default function BasicsSex({ form, setForm }) {
  const options = [
    { value: "femenino", title: "Femenino", icon: "♀", color: "#ff6fb3" }, // rosa
    { value: "masculino", title: "Masculino", icon: "♂", color: "#4da3ff" }, // azul
    { value: "prefiero_no_decir", title: "Prefiero no decir", icon: "?", color: "#38d27a" }, // verde
  ];

  return (
    <>
      <h2 className="ob2-h2">¿Cuál es tu género?</h2>
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
                <div
                  className="ob2-icon"
                  style={{
                    color: o.color,
                    borderColor: `${o.color}55`,
                    background: `${o.color}14`,
                  }}
                >
                  {o.icon}
                </div>

                <div>
                  <p className="ob2-opt-title">{o.title}</p>
                </div>
              </div>

              <div className={`ob2-radio ${selected ? "on" : ""}`}>
                <div />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
