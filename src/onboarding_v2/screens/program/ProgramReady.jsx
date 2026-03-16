// src/onboarding_v2/screens/program/ProgramReady.jsx
import React from "react";

function labelDiet(v) {
  if (v === "equilibrada") return "Equilibrada";
  if (v === "baja_grasa") return "Baja en grasa";
  if (v === "baja_carbo") return "Baja en carbohidratos";
  if (v === "keto") return "Keto";
  return "—";
}
function labelTraining(v) {
  if (v === "none") return "Nada o actividad suave";
  if (v === "lifting") return "Musculación";
  if (v === "cardio") return "Cardio";
  if (v === "both") return "Cardio + Musculación";
  return "—";
}
function labelProtein(v) {
  if (v === "low") return "Baja";
  if (v === "moderate") return "Moderada";
  if (v === "high") return "Alta";
  if (v === "extra_high") return "Extra alta";
  return "—";
}

export default function ProgramReady({ data, onBack, onFinish }) {
  const days = ["L","M","X","J","V","S","D"];

  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Programa</div>
      </div>

      <h1 className="ob2-h1">Tu programa está listo</h1>
      <p className="ob2-p">
        Este resumen es inicial. Podés ajustar más adelante.
      </p>

      {/* Grid semanal (placeholder visual) */}
      <div className="ob2-weekGrid">
        {days.map((d) => (
          <div key={d} className="ob2-weekCol">
            <div className="ob2-weekKcal">— kcal</div>
            <div className="ob2-weekBox p">P</div>
            <div className="ob2-weekBox c">C</div>
            <div className="ob2-weekBox f">G</div>
            <div className="ob2-weekDay">{d}</div>
          </div>
        ))}
      </div>

      {/* How list */}
      <div className="ob2-howList">
        <div className="ob2-howLine">
          <div className="ob2-howDot">1</div>
          <div>
            <div className="ob2-howTitle">Dieta</div>
            <div className="ob2-howValue">{labelDiet(data.diet)}</div>
          </div>
        </div>

        <div className="ob2-howLine">
          <div className="ob2-howDot">2</div>
          <div>
            <div className="ob2-howTitle">Entrenamiento</div>
            <div className="ob2-howValue">{labelTraining(data.training)}</div>
          </div>
        </div>

        <div className="ob2-howLine">
          <div className="ob2-howDot">3</div>
          <div>
            <div className="ob2-howTitle">Calorías</div>
            <div className="ob2-howValue">
              {data.calorieDist === "shift" ? "Mover calorías" : "Distribuir parejo"}
            </div>
          </div>
        </div>

        <div className="ob2-howLine">
          <div className="ob2-howDot">4</div>
          <div>
            <div className="ob2-howTitle">Proteína</div>
            <div className="ob2-howValue">{labelProtein(data.protein)}</div>
          </div>
        </div>
      </div>

      {data.calorieDist === "shift" ? (
        <p className="ob2-p" style={{ marginTop: 10 }}>
          Días con más calorías:{" "}
          <b style={{ color: "#eaeaea" }}>
            {Array.isArray(data.shiftDays) && data.shiftDays.length ? data.shiftDays.join(", ") : "Ninguno"}
          </b>
        </p>
      ) : null}

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <button className="ob2-btn primary" type="button" onClick={onFinish}>
            Guardar y finalizar
          </button>
        </div>
      </div>
    </div>
  );
}
