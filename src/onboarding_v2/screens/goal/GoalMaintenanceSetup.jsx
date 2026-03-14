// src/onboarding_v2/screens/goal/GoalMaintenanceSetup.jsx
import React from "react";

export default function GoalMaintenanceSetup({
  initialRangeLabel,
  trendTargetKg,
  setTrendTargetKg,
  onBack,
  onNext,
}) {
  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Definir nuevo objetivo</div>
      </div>

      <div className="ob2-kpi purple" style={{ marginBottom: 16 }}>
        <div className="ob2-kpi-num">{initialRangeLabel}</div>
        <div className="ob2-kpi-sub">rango calórico dinámico inicial</div>
      </div>

      <h1 className="ob2-h1">¿Qué es mantenimiento dinámico?</h1>

      <div className="ob2-infoBox">
        En mantenimiento, el plan es <b>dinámico</b>: monitoreamos tu peso y ajustamos
        para mantener tu <b>peso tendencia</b> en rango.
      </div>

      <h1 className="ob2-h1" style={{ marginTop: 18 }}>
        ¿Cuál es tu peso tendencia objetivo?
      </h1>

      <div className="ob2-centerNum">{Number(trendTargetKg).toFixed(1)} kg</div>

      <div className="ob2-slider">
        <input
          type="range"
          min={40}
          max={160}
          step={0.1}
          value={trendTargetKg}
          onChange={(e) => setTrendTargetKg(Number(e.target.value))}
        />
        <div className="ob2-slider-minmax">
          <span>40</span>
          <span>160</span>
        </div>
      </div>

      <div className="ob2-sticky">
        <button className="ob2-btn primary" type="button" onClick={onNext}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
