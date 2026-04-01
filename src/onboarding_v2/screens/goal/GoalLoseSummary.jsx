import React from "react";

export default function GoalLoseSummary({ summary, onBack, onNext, loading = false }) {
  return (
    <div>
      <h1 className="ob2-h1">Resumen del objetivo</h1>
      <p className="ob2-p">Guardamos esto y pasamos a Programa.</p>

      <div className="ob2-summaryHead mint">
        <div className="ob2-summaryTitle">Pérdida de peso</div>
        <div className="ob2-summaryValue">→ {Number(summary.targetWeightKg).toFixed(1)} kg</div>
      </div>

      <div className="ob2-summaryCard">
        <div className="ob2-summaryRow">
          <div className="ob2-summaryLabel">Ritmo</div>
          <div className="ob2-summaryRight">
            {Number(summary.ratePctBWPerWeek).toFixed(2)}% / semana
          </div>
        </div>
        <div className="ob2-summaryBody">
          Ajustaremos tus calorías según sea necesario para sostener este ritmo. El ritmo real puede variar.
        </div>
      </div>

      <div className="ob2-summaryCard">
        <div className="ob2-summaryRow">
          <div className="ob2-summaryLabel">Presupuesto diario inicial</div>
          <div className="ob2-summaryRight">{summary.initialBudgetKcal} kcal</div>
        </div>
        <div className="ob2-summaryBody">Este valor es una estimación inicial.</div>
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <div className="ob2-row2">
            <button
              className="ob2-btn ghost"
              type="button"
              onClick={onBack}
              disabled={loading}
            >
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
