// src/onboarding_v2/screens/goal/GoalGainSetup.jsx
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
    // Placeholder simple: después lo afinás vos.
    // 0.25% -> +150; 0.5% -> +250; 0.75% -> +350; 1.0% -> +450
    const r = Number(ratePctBWPerWeek || 0);
    if (r <= 0.25) return 150;
    if (r <= 0.5) return 250;
    if (r <= 0.75) return 350;
    return 450;
  }, [ratePctBWPerWeek]);

  const targetKcal = initialBudgetKcal + surplusKcal;

  return (
    <div className="ob2-card">
      <h2 className="ob2-h2" style={{ marginTop: 0 }}>
        Ganar peso
      </h2>
      <p className="ob2-p">
        Definí tu <b>peso objetivo</b> y el <b>ritmo</b>. Los cálculos finos los ajustás después.
      </p>

      {/* Peso objetivo */}
      <div style={boxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900 }}>Peso objetivo</div>
          <div style={{ color: "#bdbdbd", fontSize: 12 }}>kg</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
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

      {/* Ritmo */}
      <div style={boxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900 }}>Ritmo (por semana)</div>
          <div style={{ color: "#bdbdbd", fontSize: 12 }}>% del peso corporal</div>
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <PickRate
            label="Lento"
            sub="0.25% (más limpio)"
            active={Number(ratePctBWPerWeek) === 0.25}
            onClick={() => setRatePctBWPerWeek?.(0.25)}
          />
          <PickRate
            label="Moderado"
            sub="0.5% (recomendado)"
            active={Number(ratePctBWPerWeek) === 0.5}
            onClick={() => setRatePctBWPerWeek?.(0.5)}
          />
          <PickRate
            label="Rápido"
            sub="0.75% (más agresivo)"
            active={Number(ratePctBWPerWeek) === 0.75}
            onClick={() => setRatePctBWPerWeek?.(0.75)}
          />
          <PickRate
            label="Muy rápido"
            sub="1.0% (solo si sabés lo que hacés)"
            active={Number(ratePctBWPerWeek) === 1.0}
            onClick={() => setRatePctBWPerWeek?.(1.0)}
          />
        </div>
      </div>

      {/* Resumen kcal */}
      <div style={summaryStyle}>
        <div style={{ fontWeight: 950, color: "#eaeaea" }}>Presupuesto inicial (aprox.)</div>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <Row k="Mantenimiento" v={`${initialBudgetKcal} kcal`} />
          <Row k="Superávit" v={`+${surplusKcal} kcal`} />
          <Row k="Objetivo" v={`${targetKcal} kcal`} strong />
        </div>
        <div style={{ marginTop: 10, color: "#bdbdbd", fontSize: 12 }}>
          Fecha estimada: <b style={{ color: "#eaeaea" }}>{endDateLabel}</b> (placeholder)
        </div>
      </div>

      {/* Footer */}
      <div className="ob2-row2" style={{ marginTop: 14 }}>
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
  );
}

function PickRate({ label, sub, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "ob2-btn",
        active ? "primary" : "ghost",
      ].join(" ")}
      style={{
        width: "100%",
        justifyContent: "space-between",
        padding: "14px 14px",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: active ? "linear-gradient(135deg, #f5d98a, #ffe89d)" : "transparent",
        color: active ? "#0a0a0a" : "#eaeaea",
        border: active ? "1px solid rgba(245,215,110,.55)" : "1px solid #2b2b2b",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div style={{ fontWeight: 950 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: active ? 0.9 : 0.7 }}>{sub}</div>
      </div>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: active ? "#0a0a0a" : "#3a3a3a",
          boxShadow: active ? "0 0 12px rgba(0,0,0,.25)" : "none",
        }}
      />
    </button>
  );
}

function Row({ k, v, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
      <div style={{ color: "#bdbdbd", fontSize: 13 }}>{k}</div>
      <div style={{ fontWeight: strong ? 950 : 800, color: strong ? "#f5d98a" : "#eaeaea" }}>{v}</div>
    </div>
  );
}

const boxStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 16,
  border: "1px solid #2b2b2b",
  background: "#0b0b0b",
};

const summaryStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(245,215,110,.18)",
  background: "linear-gradient(180deg, rgba(245,215,110,.08), rgba(0,0,0,.15))",
};
