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

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function formatDateAR(d) {
  try {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return "—";
  }
}

function calcPlan({
  mode,
  maintenanceKcal,
  currentWeightKg,
  targetWeightKg,
  ratePctBWPerWeek,
}) {
  const mKcal = Number(maintenanceKcal);
  const w0 = Number(currentWeightKg);
  const wt = Number(targetWeightKg);
  const r = Number(ratePctBWPerWeek);

  if (
    !Number.isFinite(mKcal) ||
    !Number.isFinite(w0) ||
    !Number.isFinite(wt) ||
    !Number.isFinite(r)
  ) {
    return { budgetKcal: 2400, endDateLabel: "—", deficitDaily: 0, kgPerWeek: 0 };
  }

  const kgPerWeek = Math.max(0, w0 * (r / 100));
  const kcalPerWeek = kgPerWeek * 7700;
  const kcalPerDay = kcalPerWeek / 7;

  const minBudget = 1400;
  const maxBudgetLose = Math.max(minBudget, mKcal - 100);
  const maxBudgetGain = mKcal + 1200;

  let budgetKcal = mKcal;

  if (mode === "lose") {
    budgetKcal = Math.round(clamp(mKcal - kcalPerDay, minBudget, maxBudgetLose));
  } else {
    budgetKcal = Math.round(clamp(mKcal + kcalPerDay, mKcal + 100, maxBudgetGain));
  }

  let endDateLabel = "—";
  if (kgPerWeek > 0) {
    const deltaKg = mode === "lose" ? Math.max(0, w0 - wt) : Math.max(0, wt - w0);
    if (deltaKg > 0) {
      const weeks = deltaKg / kgPerWeek;
      const days = Math.ceil(weeks * 7);
      const end = new Date();
      end.setDate(end.getDate() + days);
      endDateLabel = formatDateAR(end);
    }
  }

  return {
    budgetKcal,
    endDateLabel,
    deficitDaily: mode === "lose" ? kcalPerDay : -kcalPerDay,
    kgPerWeek,
  };
}

export default function GoalWizard({
  onDone,
  heightCm,
  currentWeightKg,
  tdeeKcal,
}) {
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [goalType, setGoalType] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState(70.0);
  const [ratePctBWPerWeek, setRatePctBWPerWeek] = useState(0.5);
  const [loading, setLoading] = useState(false);

  const maintenanceKcal = useMemo(() => {
    const t = Number(tdeeKcal);
    return Number.isFinite(t) && t >= 800 && t <= 6000 ? t : 2400;
  }, [tdeeKcal]);

  const startWeightKg = useMemo(() => {
    const w = Number(currentWeightKg);
    return Number.isFinite(w) && w >= 30 && w <= 250 ? w : 75;
  }, [currentWeightKg]);

  async function saveGoalToBackend(goalPayload) {
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 2,
        data: {
          __wizard: "v2",
          goal: goalPayload,
        },
      }),
    });
  }

async function handleSaveAndContinue(goalPayload) {
  if (loading) return;

  setLoading(true);

  try {
    await saveGoalToBackend(goalPayload);
    await onDone?.();
  } catch (e) {
    console.error("No se pudo guardar el objetivo", e);
    setLoading(false);
  }
}


  if (step === 0) {
    return <GoalIntro onNext={() => setStep(1)} />;
  }

  if (step === 1) {
    return (
      <GoalPick
        value={goalType}
        onChange={(v) => setGoalType(v)}
        onBack={() => nav("/app/onboarding", { replace: true })}
        onNext={async () => {
          if (!goalType || loading) return;
          await new Promise((r) => setTimeout(r, 140));
          setStep(2);
        }}
      />
    );
  }

  if (step === 2) {
    if (goalType === "perder_peso") {
      const plan = calcPlan({
        mode: "lose",
        maintenanceKcal,
        currentWeightKg: startWeightKg,
        targetWeightKg,
        ratePctBWPerWeek,
      });

      return (
        <GoalLoseSetup
          initialBudgetKcal={plan.budgetKcal}
          endDateLabel={plan.endDateLabel}
          targetWeightKg={targetWeightKg}
          setTargetWeightKg={setTargetWeightKg}
          ratePctBWPerWeek={ratePctBWPerWeek}
          setRatePctBWPerWeek={(v) => setRatePctBWPerWeek(clamp(v, 0.1, 1.5))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          heightCm={heightCm}
          currentWeightKg={startWeightKg}
          maintenanceKcal={maintenanceKcal}
        />
      );
    }

    if (goalType === "ganar_peso") {
      const plan = calcPlan({
        mode: "gain",
        maintenanceKcal,
        currentWeightKg: startWeightKg,
        targetWeightKg,
        ratePctBWPerWeek,
      });

      return (
        <GoalGainSetup
          initialBudgetKcal={plan.budgetKcal}
          endDateLabel={plan.endDateLabel}
          targetWeightKg={targetWeightKg}
          setTargetWeightKg={setTargetWeightKg}
          ratePctBWPerWeek={ratePctBWPerWeek}
          setRatePctBWPerWeek={(v) => setRatePctBWPerWeek(clamp(v, 0.1, 1.5))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      );
    }

    return (
      <GoalMaintenanceSetup
        initialRangeLabel={`${maintenanceKcal - 150} – ${maintenanceKcal + 150} kcal`}
        trendTargetKg={targetWeightKg}
        setTrendTargetKg={setTargetWeightKg}
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
      />
    );
  }

  if (goalType === "perder_peso") {
    const plan = calcPlan({
      mode: "lose",
      maintenanceKcal,
      currentWeightKg: startWeightKg,
      targetWeightKg,
      ratePctBWPerWeek,
    });

    const summary = {
      type: "perder_peso",
      maintenanceKcal,
      startWeightKg,
      initialBudgetKcal: plan.budgetKcal,
      endDateLabel: plan.endDateLabel,
      targetWeightKg,
      ratePctBWPerWeek: -Math.abs(ratePctBWPerWeek),
    };

    return (
      <GoalLoseSummary
        summary={summary}
        onBack={() => {
          if (loading) return;
          setStep(2);
        }}
        onNext={() => handleSaveAndContinue(summary)}
        loading={loading}
      />
    );
  }

  if (goalType === "ganar_peso") {
    const plan = calcPlan({
      mode: "gain",
      maintenanceKcal,
      currentWeightKg: startWeightKg,
      targetWeightKg,
      ratePctBWPerWeek,
    });

    const summary = {
      type: "ganar_peso",
      maintenanceKcal,
      startWeightKg,
      initialBudgetKcal: plan.budgetKcal,
      endDateLabel: plan.endDateLabel,
      targetWeightKg,
      ratePctBWPerWeek: Math.abs(ratePctBWPerWeek),
    };

    return (
      <GoalGainSummary
        summary={summary}
        onBack={() => {
          if (loading) return;
          setStep(2);
        }}
        onNext={() => handleSaveAndContinue(summary)}
        loading={loading}
      />
    );
  }

  const maint = {
    type: "mantener_peso",
    maintenanceKcal,
    trendTargetKg: targetWeightKg,
    targetRangeKg: {
      min: Number(targetWeightKg) - 1.5,
      max: Number(targetWeightKg) + 1.5,
    },
    initialRangeKcal: {
      min: maintenanceKcal - 150,
      max: maintenanceKcal + 150,
    },
    approach: "Mantenerse en rango",
  };

  return (
    <GoalMaintenanceSummary
      summary={maint}
      onBack={() => {
        if (loading) return;
        setStep(2);
      }}
      onNext={() => handleSaveAndContinue(maint)}
      loading={loading}
    />
  );
}
