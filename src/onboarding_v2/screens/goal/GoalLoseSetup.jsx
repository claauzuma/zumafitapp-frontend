// src/onboarding_v2/screens/goal/GoalLoseSetup.jsx
import React from "react";

export default function GoalLoseSetup({
  initialBudgetKcal,
  endDateLabel,
  targetWeightKg,
  setTargetWeightKg,
  ratePctBWPerWeek,
  setRatePctBWPerWeek,
  onBack,
  onNext,
}) {
  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Definir nuevo objetivo</div>
      </div>

      {/* KPI arriba */}
      <div className="ob2-kpiRow">
        <div className="ob2-kpi mint">
          <div className="ob2-kpi-num">{initialBudgetKcal} kcal</div>
          <div className="ob2-kpi-sub">presupuesto diario inicial</div>
        </div>
        <div className="ob2-kpi gray">
          <div className="ob2-kpi-num">{endDateLabel}</div>
          <div className="ob2-kpi-sub">fecha estimada</div>
        </div>
      </div>

      <h1 className="ob2-h1">¿Cuál es tu peso objetivo?</h1>

      <div className="ob2-centerNum">{Number(targetWeightKg).toFixed(1)} kg</div>

      <div className="ob2-slider">
        <input
          type="range"
          min={40}
          max={160}
          step={0.1}
          value={targetWeightKg}
          onChange={(e) => setTargetWeightKg(Number(e.target.value))}
        />
        <div className="ob2-slider-minmax">
          <span>40</span>
          <span>160</span>
        </div>
      </div>

      <h1 className="ob2-h1" style={{ marginTop: 18 }}>
        ¿A qué ritmo querés lograrlo?
      </h1>

      <div className="ob2-pill mint">Estándar (recomendado)</div>

      <div className="ob2-slider" style={{ marginTop: 10 }}>
        <input
          type="range"
          min={0.1}
          max={1.5}
          step={0.01}
          value={ratePctBWPerWeek}
          onChange={(e) => setRatePctBWPerWeek(Number(e.target.value))}
        />
        <div className="ob2-slider-minmax">
          <span>0.1%</span>
          <span>1.5%</span>
        </div>
      </div>

      <div className="ob2-grid2">
        <div className="ob2-box">
          <div className="ob2-boxBig">{Math.abs(ratePctBWPerWeek).toFixed(2)}%</div>
          <div className="ob2-boxSub">del peso corporal / semana</div>
        </div>
        <div className="ob2-box">
          <div className="ob2-boxBig">{(Math.abs(ratePctBWPerWeek) * 4).toFixed(2)}%</div>
          <div className="ob2-boxSub">del peso corporal / mes</div>
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
