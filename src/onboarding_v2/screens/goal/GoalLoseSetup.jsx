// src/onboarding_v2/screens/goal/GoalLoseSetup.jsx
import React, { useMemo, useEffect, useState } from "react";

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDateAR(date) {
  try {
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const KCAL_PER_KG = 7700;

export default function GoalLoseSetup({
  initialBudgetKcal,
  targetWeightKg,
  setTargetWeightKg,
  ratePctBWPerWeek,
  setRatePctBWPerWeek,
  onBack,
  onNext,
  heightCm,
  currentWeightKg,
  tdeeKcal,
}) {
  const currentWeight = Number(currentWeightKg);

  // 1) mínimo sano (IMC 18.5)
  const minHealthyKg = useMemo(() => {
    const cm = Number(heightCm);
    if (!Number.isFinite(cm) || cm < 120 || cm > 230) return 45;
    const m = cm / 100;
    const min = 18.5 * m * m;
    const rounded = Math.round(min * 2) / 2;
    return Math.max(40, rounded);
  }, [heightCm]);

  // 2) máximo permitido para perder peso = menor al peso actual
  const maxLoseTarget = useMemo(() => {
    if (!Number.isFinite(currentWeight) || currentWeight <= 0) return 160;
    return Math.max(minHealthyKg, currentWeight - 0.1);
  }, [currentWeight, minHealthyKg]);

  // si por alguna razón el peso actual ya está por debajo del mínimo saludable,
  // evitamos romper el rango
  const finalMin = minHealthyKg;
  const finalMax = Math.max(finalMin, maxLoseTarget);

  useEffect(() => {
    const cur = Number(targetWeightKg);
    if (!Number.isFinite(cur)) return;

    if (cur < finalMin) {
      setTargetWeightKg(finalMin);
      return;
    }

    if (cur > finalMax) {
      setTargetWeightKg(finalMax);
    }
  }, [finalMin, finalMax, targetWeightKg, setTargetWeightKg]);

  const safeTarget = Number.isFinite(Number(targetWeightKg))
    ? clamp(Number(targetWeightKg), finalMin, finalMax)
    : finalMax;

  // 3) edición del peso objetivo
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState(String(safeTarget.toFixed(1)));

  useEffect(() => {
    if (!editingTarget) setTargetDraft(String(safeTarget.toFixed(1)));
  }, [safeTarget, editingTarget]);

  function commitTargetDraft() {
    const raw = String(targetDraft || "").replace(",", ".");
    const n = Number(raw);

    if (!Number.isFinite(n)) {
      setTargetDraft(String(safeTarget.toFixed(1)));
      setEditingTarget(false);
      return;
    }

    const next = clamp(n, finalMin, finalMax);
    setTargetWeightKg(next);
    setEditingTarget(false);
  }

  // 4) edición del ritmo
  const [editingRate, setEditingRate] = useState(false);
  const rateSafe = clamp(Number(ratePctBWPerWeek ?? 0.5), 0.1, 1.5);
  const [rateDraft, setRateDraft] = useState(String(rateSafe.toFixed(2)));

  useEffect(() => {
    if (!editingRate) setRateDraft(String(rateSafe.toFixed(2)));
  }, [rateSafe, editingRate]);

  function commitRateDraft() {
    const raw = String(rateDraft || "").replace(",", ".");
    const n = Number(raw);

    if (!Number.isFinite(n)) {
      setRateDraft(String(rateSafe.toFixed(2)));
      setEditingRate(false);
      return;
    }

    setRatePctBWPerWeek(clamp(n, 0.1, 1.5));
    setEditingRate(false);
  }

  // 5) cálculos
  const computed = useMemo(() => {
    const cw = Number(currentWeightKg);
    const tdee = Number(tdeeKcal);
    const deltaKg = Number.isFinite(cw) ? Math.max(0, cw - safeTarget) : 0;

    const weeklyLossKg =
      Number.isFinite(cw) && cw > 0 ? (rateSafe / 100) * cw : 0;

    const dailyDefBase =
      weeklyLossKg > 0 ? (weeklyLossKg * KCAL_PER_KG) / 7 : 0;

    const progress = clamp(deltaKg / 12, 0.25, 1);
    const dailyDefEffective = dailyDefBase * progress;

    let budget = Number(initialBudgetKcal) || 0;
    if (Number.isFinite(tdee) && tdee > 0) {
      budget = Math.round(tdee - dailyDefEffective);
      budget = Math.max(1200, budget);
    }

    let etaLabel = "—";
    if (weeklyLossKg > 0 && deltaKg > 0) {
      const weeks = deltaKg / weeklyLossKg;
      const days = Math.max(1, Math.round(weeks * 7));
      etaLabel = fmtDateAR(addDays(startOfDay(new Date()), days));
    } else if (deltaKg === 0 && Number.isFinite(cw) && cw > 0) {
      etaLabel = fmtDateAR(startOfDay(new Date()));
    }

    return {
      deltaKg,
      weeklyLossKg,
      dailyDefBase,
      dailyDefEffective,
      budget,
      etaLabel,
      progress,
    };
  }, [rateSafe, currentWeightKg, tdeeKcal, initialBudgetKcal, safeTarget]);

  const deltaText =
    computed.deltaKg > 0
      ? `faltan ${computed.deltaKg.toFixed(1)} kg`
      : "ya estás en el objetivo";

  const targetError =
    Number.isFinite(currentWeight) && safeTarget >= currentWeight
      ? "El peso objetivo debe ser menor que tu peso actual."
      : "";

  async function handleNext() {
    if (Number.isFinite(currentWeight) && safeTarget >= currentWeight) return;
    await new Promise((r) => setTimeout(r, 140));
    onNext?.();
  }

  return (
    <div>
      <div className="ob2-kpiRow">
        <div className="ob2-kpi mint">
          <div className="ob2-kpi-num">{computed.budget || initialBudgetKcal} kcal</div>
          <div className="ob2-kpi-sub">
            presupuesto diario inicial
            <div style={{ marginTop: 4, color: "#bdbdbd", fontSize: 12 }}>
              (ajustado por objetivo: {Math.round(computed.progress * 100)}%)
            </div>
          </div>
        </div>

        <div className="ob2-kpi">
          <div className="ob2-kpi-num">{computed.etaLabel}</div>
          <div className="ob2-kpi-sub">fecha estimada (aprox.)</div>
        </div>
      </div>

      <h1 className="ob2-h1">¿Cuál es tu peso objetivo?</h1>
      <p className="ob2-p">
        Podés ajustarlo después. Lo usamos como referencia.
        <br />
        <span style={{ color: "#bdbdbd", fontSize: 12 }}>
          Mínimo recomendado: {minHealthyKg.toFixed(1)} kg ·
          {" "}Tu peso actual: {Number.isFinite(currentWeight) ? currentWeight.toFixed(1) : "—"} kg ·
          {" "}{deltaText}
        </span>
      </p>

      <div className="ob2-centerNum ob2-goalTarget">
        {!editingTarget ? (
          <button
            type="button"
            onClick={() => setEditingTarget(true)}
            style={{
              all: "unset",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: "inherit",
              letterSpacing: "-0.2px",
            }}
            title="Tocá para editar"
          >
            {safeTarget.toFixed(1)} kg
          </button>
        ) : (
          <input
            className="ob2-input"
            autoFocus
            inputMode="decimal"
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            onBlur={commitTargetDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTargetDraft();
              if (e.key === "Escape") {
                setEditingTarget(false);
                setTargetDraft(String(safeTarget.toFixed(1)));
              }
            }}
            style={{
              padding: "6px 10px",
              textAlign: "center",
              fontSize: "inherit",
              fontWeight: 1000,
              maxWidth: 140,
              margin: "0 auto",
              display: "block",
            }}
          />
        )}
      </div>

      {targetError ? (
        <p className="ob2-p" style={{ marginTop: 8, color: "#ffd9a1", fontSize: 12 }}>
          {targetError}
        </p>
      ) : null}

      <div className="ob2-slider">
        <input
          style={{ width: "100%" }}
          type="range"
          min={finalMin}
          max={finalMax}
          step={0.1}
          value={safeTarget}
          onChange={(e) => setTargetWeightKg(Number(e.target.value))}
        />
        <div className="ob2-slider-minmax">
          <span>{finalMin.toFixed(1)}</span>
          <span>{finalMax.toFixed(1)}</span>
        </div>
      </div>

      <h1 className="ob2-h1" style={{ marginTop: 18 }}>
        ¿A qué ritmo querés lograrlo?
      </h1>
      <p className="ob2-p">
        Recomendado: 0.5% por semana.
        <span style={{ color: "#bdbdbd", fontSize: 12 }}>
          {" "}
          ({computed.weeklyLossKg.toFixed(2)} kg/sem · déficit base{" "}
          {Math.round(computed.dailyDefBase)} kcal/día · aplicado{" "}
          {Math.round(computed.dailyDefEffective)} kcal/día)
        </span>
      </p>

      <div className="ob2-grid2" style={{ marginTop: 10 }}>
        <div className="ob2-box">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            {!editingRate ? (
              <button
                type="button"
                onClick={() => setEditingRate(true)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontWeight: 1000,
                  fontSize: 22,
                  letterSpacing: "-0.2px",
                }}
                title="Tocá para editar"
              >
                {rateSafe.toFixed(2)}%
              </button>
            ) : (
              <input
                className="ob2-input"
                autoFocus
                inputMode="decimal"
                value={rateDraft}
                onChange={(e) => setRateDraft(e.target.value)}
                onBlur={commitRateDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRateDraft();
                  if (e.key === "Escape") {
                    setEditingRate(false);
                    setRateDraft(String(rateSafe.toFixed(2)));
                  }
                }}
                style={{ padding: "10px 12px" }}
              />
            )}
            <span className="ob2-pill mint">por semana</span>
          </div>
          <div className="ob2-boxSub">del peso corporal</div>
        </div>

        <div className="ob2-box">
          <div className="ob2-boxBig">{(rateSafe * 4).toFixed(2)}%</div>
          <div className="ob2-boxSub">aprox. por mes</div>
        </div>
      </div>

      <div className="ob2-slider" style={{ marginTop: 12 }}>
        <input
          style={{ width: "100%" }}
          type="range"
          min={0.1}
          max={1.5}
          step={0.01}
          value={rateSafe}
          onChange={(e) =>
            setRatePctBWPerWeek(clamp(Number(e.target.value), 0.1, 1.5))
          }
        />
        <div className="ob2-slider-minmax">
          <span>0.1%</span>
          <span>1.5%</span>
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
              onClick={handleNext}
              disabled={Number.isFinite(currentWeight) && safeTarget >= currentWeight}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
