// src/onboarding_v2/screens/goal/GoalWizard.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../Api.js";

import GoalIntro from "./GoalIntro.jsx";
import GoalPick from "./GoalPick.jsx";
import GoalLoseSetup from "./GoalLoseSetup.jsx";
import GoalLoseSummary from "./GoalLoseSummary.jsx";

import GoalMaintenanceSetup from "./GoalMaintenanceSetup.jsx";
import GoalMaintenanceSummary from "./GoalMaintenanceSummary.jsx";

import GoalGainSetup from "./GoalGainSetup.jsx";
import GoalGainSummary from "./GoalGainSummary.jsx";

function kgToLb(kg) {
  return kg * 2.2046226218;
}
function lbToKg(lb) {
  return lb / 2.2046226218;
}
function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

export default function GoalWizard({ onDone }) {
  const nav = useNavigate();

  // Step interno de Goal (no confundir con onboarding.step del backend)
  // 0 intro -> 1 elegir objetivo -> 2 setup -> 3 summary
  const [step, setStep] = useState(0);

  // goalType: perder_peso | mantener_peso | ganar_peso
  const [goalType, setGoalType] = useState("");

  // Datos base (por ahora simples; los cálculos finos los hacés después)
  const [initialBudgetKcal] = useState(2400);

  // Valores comunes
  const [targetWeightKg, setTargetWeightKg] = useState(70.0);

  // Lose/Gain rate: % BW per week (ej 0.5%)
  const [ratePctBWPerWeek, setRatePctBWPerWeek] = useState(0.5);

  const endDateLabel = useMemo(() => {
    // Placeholder: después calculás posta
    return "—";
  }, []);

  async function saveGoalToBackend(goalPayload) {
    // ✅ IMPORTANTÍSIMO: marcamos __wizard:"v2" para que el backend no ejecute el flujo viejo
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 2,
        data: { __wizard: "v2", ...goalPayload },
      }),
    });
  }

  // --------------------------
  // RENDER
  // --------------------------
  if (step === 0) {
    return <GoalIntro onNext={() => setStep(1)} />;
  }

  if (step === 1) {
    return (
      <GoalPick
        value={goalType}
        onChange={(v) => setGoalType(v)}
        onBack={() => nav("/app/onboarding", { replace: true })}
        onNext={() => {
          if (!goalType) return;
          setStep(2);
        }}
      />
    );
  }

  // Setup según objetivo
  if (step === 2) {
    if (goalType === "perder_peso") {
      return (
        <GoalLoseSetup
          initialBudgetKcal={initialBudgetKcal}
          endDateLabel={endDateLabel}
          targetWeightKg={targetWeightKg}
          setTargetWeightKg={setTargetWeightKg}
          ratePctBWPerWeek={ratePctBWPerWeek}
          setRatePctBWPerWeek={(v) => setRatePctBWPerWeek(clamp(v, 0.1, 1.5))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      );
    }

    if (goalType === "ganar_peso") {
      return (
        <GoalGainSetup
          initialBudgetKcal={initialBudgetKcal}
          endDateLabel={endDateLabel}
          targetWeightKg={targetWeightKg}
          setTargetWeightKg={setTargetWeightKg}
          ratePctBWPerWeek={ratePctBWPerWeek}
          setRatePctBWPerWeek={(v) => setRatePctBWPerWeek(clamp(v, 0.1, 1.5))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      );
    }

    // mantenimiento
    return (
      <GoalMaintenanceSetup
        initialRangeLabel={`${initialBudgetKcal - 150} – ${initialBudgetKcal + 150} kcal`}
        trendTargetKg={targetWeightKg}
        setTrendTargetKg={setTargetWeightKg}
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
      />
    );
  }

  // Summary + persist
  if (goalType === "perder_peso") {
    const summary = {
      goalType,
      initialBudgetKcal,
      endDateLabel,
      targetWeightKg,
      ratePctBWPerWeek: -Math.abs(ratePctBWPerWeek),
    };

    return (
      <GoalLoseSummary
        summary={summary}
        onBack={() => setStep(2)}
        onNext={async () => {
          await saveGoalToBackend({
            goalType: "perder_peso",
            targetWeightKg: Number(targetWeightKg),
            ratePctBWPerWeek: Number(summary.ratePctBWPerWeek),
            initialBudgetKcal: Number(initialBudgetKcal),
          });
          onDone?.();
        }}
      />
    );
  }

  if (goalType === "ganar_peso") {
    const summary = {
      goalType,
      initialBudgetKcal,
      endDateLabel,
      targetWeightKg,
      ratePctBWPerWeek: Math.abs(ratePctBWPerWeek),
    };

    return (
      <GoalGainSummary
        summary={summary}
        onBack={() => setStep(2)}
        onNext={async () => {
          await saveGoalToBackend({
            goalType: "ganar_peso",
            targetWeightKg: Number(targetWeightKg),
            ratePctBWPerWeek: Number(summary.ratePctBWPerWeek),
            initialBudgetKcal: Number(initialBudgetKcal),
          });
          onDone?.();
        }}
      />
    );
  }

  // mantenimiento summary
  const maint = {
    goalType,
    trendTargetKg: targetWeightKg,
    rangeMinKg: Number(targetWeightKg) - 1.5,
    rangeMaxKg: Number(targetWeightKg) + 1.5,
    initialRangeKcalMin: initialBudgetKcal - 150,
    initialRangeKcalMax: initialBudgetKcal + 150,
    approach: "Mantenerse en rango",
  };

  return (
    <GoalMaintenanceSummary
      summary={maint}
      onBack={() => setStep(2)}
      onNext={async () => {
        await saveGoalToBackend({
          goalType: "mantener_peso",
          trendTargetKg: Number(maint.trendTargetKg),
          targetRangeKg: { min: maint.rangeMinKg, max: maint.rangeMaxKg },
          initialRangeKcal: { min: maint.initialRangeKcalMin, max: maint.initialRangeKcalMax },
          approach: maint.approach,
        });
        onDone?.();
      }}
    />
  );
}
