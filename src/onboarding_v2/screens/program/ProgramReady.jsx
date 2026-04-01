// src/onboarding_v2/screens/program/ProgramReady.jsx
import React, { useMemo } from "react";

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

export default function ProgramReady({ data, onBack, onFinish, loading = false }) {
  const days = useMemo(
    () => [
      { key: "Lunes", short: "L" },
      { key: "Martes", short: "M" },
      { key: "Miércoles", short: "X" },
      { key: "Jueves", short: "J" },
      { key: "Viernes", short: "V" },
      { key: "Sábado", short: "S" },
      { key: "Domingo", short: "D" },
    ],
    []
  );

  const week = useMemo(() => {
    return days.map((d) => ({
      ...d,
      kcal: 2614,
      p: 156,
      f: 87,
      c: 301,
    }));
  }, [days]);

  return (
    <div className="ob2-card ob2-card--ready">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack} disabled={loading}>
          ←
        </button>
        <div className="ob2-top-title">Programa</div>
      </div>

      <h1 className="ob2-h1">Tu programa está listo</h1>
      <p className="ob2-p">Este resumen es inicial. Se puede ajustar más adelante.</p>

      <div className="ob2-programReadyFull">
        <div className="ob2-macroGrid">
          {week.map((d) => (
            <div key={d.key} className="ob2-macroCol">
              <div className="ob2-macroKcal">{d.kcal}</div>

              <div className="ob2-macroBox p">
                <div className="ob2-macroNum">{d.p}</div>
                <div className="ob2-macroLabel">P</div>
              </div>

              <div className="ob2-macroBox f">
                <div className="ob2-macroNum">{d.f}</div>
                <div className="ob2-macroLabel">F</div>
              </div>

              <div className="ob2-macroBox c">
                <div className="ob2-macroNum">{d.c}</div>
                <div className="ob2-macroLabel">C</div>
              </div>

              <div className="ob2-macroDay">{d.short}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ob2-howList" style={{ marginTop: 16 }}>
        <div className="ob2-howLine">
          <div className="ob2-howDot">1</div>
          <div>
            <div className="ob2-howTitle">Dieta</div>
            <div className="ob2-howValue">{labelDiet(data?.diet)}</div>
          </div>
        </div>

        <div className="ob2-howLine">
          <div className="ob2-howDot">2</div>
          <div>
            <div className="ob2-howTitle">Entrenamiento</div>
            <div className="ob2-howValue">{labelTraining(data?.training)}</div>
          </div>
        </div>

        <div className="ob2-howLine">
          <div className="ob2-howDot">3</div>
          <div>
            <div className="ob2-howTitle">Calorías</div>
            <div className="ob2-howValue">
              {data?.calorieDist === "shift" ? "Mover calorías" : "Distribuir parejo"}
            </div>
          </div>
        </div>

        <div className="ob2-howLine">
          <div className="ob2-howDot">4</div>
          <div>
            <div className="ob2-howTitle">Proteína</div>
            <div className="ob2-howValue">{labelProtein(data?.protein)}</div>
          </div>
        </div>
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <button
            className={`ob2-btn primary ${loading ? "is-loading" : ""}`}
            type="button"
            onClick={onFinish}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar y finalizar"}
          </button>
        </div>
      </div>
    </div>
  );
}
