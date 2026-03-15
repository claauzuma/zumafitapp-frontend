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
    <div>
      <div className="ob2-kpiRow">
        <div className="ob2-kpi mint">
          <div className="ob2-kpi-num">{initialBudgetKcal} kcal</div>
          <div className="ob2-kpi-sub">presupuesto diario inicial</div>
        </div>
        <div className="ob2-kpi">
          <div className="ob2-kpi-num">{endDateLabel}</div>
          <div className="ob2-kpi-sub">fecha estimada (placeholder)</div>
        </div>
      </div>

      <h1 className="ob2-h1">¿Cuál es tu peso objetivo?</h1>
      <p className="ob2-p">Podés ajustarlo después. Lo usamos como referencia.</p>

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
      <p className="ob2-p">Recomendado: 0.5% por semana (aprox.).</p>

      <span className="ob2-pill mint">Estándar (recomendado)</span>

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
        <div className="ob2-sticky-inner">
          <div className="ob2-row2">
            <button className="ob2-btn ghost" type="button" onClick={onBack}>
              Atrás
            </button>
            <button className="ob2-btn primary" type="button" onClick={onNext}>
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
