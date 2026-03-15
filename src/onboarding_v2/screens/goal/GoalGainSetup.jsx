import React, { useMemo } from "react";

function round1(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

export default function GoalGainSetup({
  initialBudgetKcal = 2400,
  endDateLabel = "—",
  targetWeightKg,
  setTargetWeightKg,
  ratePctBWPerWeek,
  setRatePctBWPerWeek,
  onBack,
  onNext,
}) {
  const surplusKcal = useMemo(() => {
    const r = Number(ratePctBWPerWeek || 0);
    if (r <= 0.25) return 150;
    if (r <= 0.5) return 250;
    if (r <= 0.75) return 350;
    return 450;
  }, [ratePctBWPerWeek]);

  const targetKcal = initialBudgetKcal + surplusKcal;

  return (
    <div>
      <h1 className="ob2-h1">Ganar peso</h1>
      <p className="ob2-p">
        Definí tu <b>peso objetivo</b> y el <b>ritmo</b>. Los cálculos finos los ajustás después.
      </p>

      <div className="ob2-card" style={{ background: "#0b0b0b" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900 }}>Peso objetivo</div>
          <div style={{ color: "#bdbdbd", fontSize: 12 }}>kg</div>
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            className="ob2-input"
            inputMode="decimal"
            value={targetWeightKg ?? ""}
            onChange={(e) => {
              const raw = String(e.target.value).replace(",", ".");
              const n = Number(raw);
              if (!Number.isFinite(n)) return setTargetWeightKg?.(raw);
              setTargetWeightKg?.(round1(n));
            }}
            placeholder="Ej: 78.5"
          />
        </div>

        <p className="ob2-p" style={{ marginTop: 10, fontSize: 12 }}>
          Tip: poné un objetivo realista (ej. +2 a +6 kg).
        </p>
      </div>

      <div className="ob2-card" style={{ background: "#0b0b0b", marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900 }}>Ritmo (por semana)</div>
          <div style={{ color: "#bdbdbd", fontSize: 12 }}>% del peso corporal</div>
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <PickRate label="Lento" sub="0.25% (más limpio)" active={Number(ratePctBWPerWeek) === 0.25} onClick={() => setRatePctBWPerWeek?.(0.25)} />
          <PickRate label="Moderado" sub="0.5% (recomendado)" active={Number(ratePctBWPerWeek) === 0.5} onClick={() => setRatePctBWPerWeek?.(0.5)} />
          <PickRate label="Rápido" sub="0.75% (más agresivo)" active={Number(ratePctBWPerWeek) === 0.75} onClick={() => setRatePctBWPerWeek?.(0.75)} />
          <PickRate label="Muy rápido" sub="1.0% (solo si sabés lo que hacés)" active={Number(ratePctBWPerWeek) === 1.0} onClick={() => setRatePctBWPerWeek?.(1.0)} />
        </div>
      </div>

      <div className="ob2-card" style={{ marginTop: 10, borderColor: "rgba(245,215,110,.18)", background: "linear-gradient(180deg, rgba(245,215,110,.08), rgba(0,0,0,.15))" }}>
        <div style={{ fontWeight: 1000 }}>Presupuesto inicial (aprox.)</div>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <Row k="Mantenimiento" v={`${initialBudgetKcal} kcal`} />
          <Row k="Superávit" v={`+${surplusKcal} kcal`} />
          <Row k="Objetivo" v={`${targetKcal} kcal`} strong />
        </div>
        <div style={{ marginTop: 10, color: "#bdbdbd", fontSize: 12 }}>
          Fecha estimada: <b style={{ color: "#eaeaea" }}>{endDateLabel}</b> (placeholder)
        </div>
      </div>

      <div className="ob2-sticky">
        <div className="ob2-sticky-inner">
          <div className="ob2-row2">
            <button className="ob2-btn ghost" type="button" onClick={onBack}>
              Atrás
            </button>
            <button
              className="ob2-btn primary"
              type="button"
              onClick={onNext}
              disabled={!targetWeightKg || Number(targetWeightKg) <= 0}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickRate({ label, sub, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ob2-opt ${active ? "selected" : ""}`}
      style={{ padding: 14 }}
    >
      <div className="ob2-opt-left">
        <div className="ob2-icon">{active ? "✓" : "•"}</div>
        <div>
          <p className="ob2-opt-title">{label}</p>
          <p className="ob2-opt-sub">{sub}</p>
        </div>
      </div>

      <div className="ob2-radio">
        <div style={{ background: active ? "#f5d98a" : "transparent" }} />
      </div>
    </button>
  );
}

function Row({ k, v, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
      <div style={{ color: "#bdbdbd", fontSize: 13 }}>{k}</div>
      <div style={{ fontWeight: strong ? 1000 : 800, color: strong ? "#f5d98a" : "#eaeaea" }}>{v}</div>
    </div>
  );
}
