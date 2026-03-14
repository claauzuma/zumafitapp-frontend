// src/onboarding_v2/screens/goal/GoalLoseSummary.jsx
import React from "react";

export default function GoalLoseSummary({ summary, onBack, onNext }) {
  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Definir nuevo objetivo</div>
      </div>

      <h1 className="ob2-h1">Resumen del objetivo</h1>

      <div className="ob2-summaryHead mint">
        <div className="ob2-summaryTitle">Pérdida de peso</div>
        <div className="ob2-summaryValue">→ {Number(summary.targetWeightKg).toFixed(1)} kg</div>
      </div>

      <div className="ob2-summaryCard">
        <div className="ob2-summaryRow">
          <div className="ob2-summaryLabel">Ritmo</div>
          <div className="ob2-summaryRight">{Number(summary.ratePctBWPerWeek).toFixed(2)}% / semana</div>
        </div>
        <div className="ob2-summaryBody">
          Ajustaremos tus calorías según sea necesario para sostener este ritmo.
          El ritmo real puede variar con el tiempo.
        </div>
      </div>

      <div className="ob2-summaryCard">
        <div className="ob2-summaryRow">
          <div className="ob2-summaryLabel">Presupuesto diario inicial</div>
          <div className="ob2-summaryRight">{summary.initialBudgetKcal} kcal</div>
        </div>
        <div className="ob2-summaryBody">
          Este valor es una estimación inicial y se recalcula con tus datos.
        </div>
      </div>

      <div className="ob2-sticky">
        <button className="ob2-btn primary" type="button" onClick={onNext}>
          Guardar y continuar
        </button>
      </div>
    </div>
  );
}
