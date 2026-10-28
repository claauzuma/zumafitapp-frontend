import React from "react";

export default function GoalMaintenanceSummary({ summary, onBack, onNext, loading = false }) {
  const rangeMin = summary?.targetRangeKg?.min ?? summary?.rangeMinKg;
  const rangeMax = summary?.targetRangeKg?.max ?? summary?.rangeMaxKg;

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
            {Number(rangeMin).toFixed(1)} – {Number(rangeMax).toFixed(1)} kg
          </div>
        </div>
        <div className="ob2-summaryBody">Ajustamos tus calorías para mantenerte dentro del rango.</div>
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <div className="ob2-row2">
            <button className="ob2-btn ghost" type="button" onClick={onBack} disabled={loading}>
              Atrás
            </button>
            <button
              className={`ob2-btn primary ${loading ? "is-loading" : ""}`}
              type="button"
              onClick={onNext}
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar y continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
