// src/onboarding_v2/screens/goal/GoalMaintenanceSummary.jsx
import React from "react";

export default function GoalMaintenanceSummary({ summary, onBack, onNext }) {
  return (
    <div className="ob2-card">
      <div className="ob2-top">
        <button className="ob2-back" type="button" onClick={onBack}>←</button>
        <div className="ob2-top-title">Definir nuevo objetivo</div>
      </div>

      <h1 className="ob2-h1">Resumen del objetivo</h1>

      <div className="ob2-summaryHead purple">
        <div className="ob2-summaryTitle">Mantenimiento</div>
        <div className="ob2-summaryValue">{Number(summary.trendTargetKg).toFixed(1)} kg</div>
      </div>

      <div className="ob2-summaryCard">
        <div className="ob2-summaryRow">
          <div className="ob2-summaryLabel">Rango objetivo</div>
          <div className="ob2-summaryRight">
            {Number(summary.rangeMinKg).toFixed(1)} – {Number(summary.rangeMaxKg).toFixed(1)} kg
          </div>
        </div>
        <div className="ob2-summaryBody">
          Ajustamos tus calorías para mantenerte dentro del rango.
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
