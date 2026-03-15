import React from "react";

export default function GoalMaintenanceSummary({ summary, onBack, onNext }) {
  return (
    <div>
      <h1 className="ob2-h1">Resumen del objetivo</h1>
      <p className="ob2-p">Guardamos tu mantenimiento y seguimos.</p>

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
        <div className="ob2-summaryBody">Ajustamos tus calorías para mantenerte dentro del rango.</div>
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <div className="ob2-row2">
            <button className="ob2-btn ghost" type="button" onClick={onBack}>
              Atrás
            </button>
            <button className="ob2-btn primary" type="button" onClick={onNext}>
              Guardar y continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
