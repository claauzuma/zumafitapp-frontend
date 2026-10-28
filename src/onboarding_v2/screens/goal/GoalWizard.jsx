// src/onboarding_v2/screens/goal/GoalWizard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../Api.js";
import { previewClientNutrition } from "../../../clientGoals/clientGoalsApi.js";
import GoalIntro from "./GoalIntro.jsx";
import GoalPick from "./GoalPick.jsx";
import GoalLoseSetup from "./GoalLoseSetup.jsx";
import GoalLoseSummary from "./GoalLoseSummary.jsx";
import GoalMaintenanceSetup from "./GoalMaintenanceSetup.jsx";
import GoalMaintenanceSummary from "./GoalMaintenanceSummary.jsx";
import GoalGainSetup from "./GoalGainSetup.jsx";
import GoalGainSummary from "./GoalGainSummary.jsx";

const GOAL_STEP_LABELS = [
  "Tu objetivo",
  "Elegí tu meta",
  "Ajustá el plan",
  "Confirmá tu objetivo",
];

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function formatPreviewDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

export default function GoalWizard({
  onDone,
  onProgress,
  onBackChange,
  heightCm,
  currentWeightKg,
  tdeeKcal,
  nutritionInput,
}) {
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [goalType, setGoalType] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState(null);
  const [ratePctBWPerWeek, setRatePctBWPerWeek] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    onProgress?.({
      section: "goal",
      step,
      total: GOAL_STEP_LABELS.length,
      label: GOAL_STEP_LABELS[step],
    });
  }, [onProgress, step]);

  const handleWizardBack = useCallback(() => {
    if (loading) return;
    if (step <= 1) {
      nav("/app/onboarding", { replace: true, state: { backToBasics: true } });
      return;
    }
    setStep((current) => Math.max(1, current - 1));
  }, [loading, nav, step]);

  useEffect(() => {
    onBackChange?.("goal", handleWizardBack, loading);
  }, [handleWizardBack, loading, onBackChange]);

  const maintenanceKcal = useMemo(() => {
    const t = Number(tdeeKcal);
    return Number.isFinite(t) && t >= 800 && t <= 6000 ? t : null;
  }, [tdeeKcal]);

  const startWeightKg = useMemo(() => {
    const w = Number(currentWeightKg);
    return Number.isFinite(w) && w >= 30 && w <= 250 ? w : null;
  }, [currentWeightKg]);
  const previewInput = useMemo(() => ({
    birthDate: nutritionInput?.birthDate,
    sex: nutritionInput?.sex,
    heightCm: nutritionInput?.heightCm,
    weightKg: nutritionInput?.weightKg,
    activity: nutritionInput?.activity,
    exerciseFrequency: nutritionInput?.exerciseFrequency,
    maintenanceKcalOverride: nutritionInput?.maintenanceKcalOverride,
  }), [
    nutritionInput?.activity,
    nutritionInput?.birthDate,
    nutritionInput?.exerciseFrequency,
    nutritionInput?.heightCm,
    nutritionInput?.maintenanceKcalOverride,
    nutritionInput?.sex,
    nutritionInput?.weightKg,
  ]);

  useEffect(() => {
    if (!(startWeightKg > 0)) return;
    setTargetWeightKg((current) => {
      const value = Number(current);
      const validForGoal = Number.isFinite(value) && value >= 30 && value <= 250
        && (goalType !== "perder_peso" || value < startWeightKg)
        && (goalType !== "ganar_peso" || value > startWeightKg);
      if (validForGoal) return current;
      if (goalType === "perder_peso") return Math.max(30, Math.round((startWeightKg - 5) * 10) / 10);
      if (goalType === "ganar_peso") return Math.min(250, Math.round((startWeightKg + 5) * 10) / 10);
      return startWeightKg;
    });
  }, [goalType, startWeightKg]);

  useEffect(() => {
    if (!goalType || !(Number(targetWeightKg) > 0)) {
      setPreview(null);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const result = await previewClientNutrition({
          ...previewInput,
          goalType,
          targetWeightKg: Number(targetWeightKg),
          ratePctBWPerWeek: goalType === "mantener_peso" ? undefined : Number(ratePctBWPerWeek),
        });
        if (!active) return;
        setPreview(result);
        if (!result?.ready) {
          setPreviewError(`Faltan datos: ${(result?.missingFields || []).join(", ")}.`);
        }
      } catch (error) {
        if (!active) return;
        setPreview(null);
        setPreviewError(error?.message || "No se pudo calcular el objetivo.");
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [goalType, previewInput, ratePctBWPerWeek, targetWeightKg]);

  const plan = useMemo(() => ({
    ready: preview?.ready === true,
    maintenanceKcal: preview?.maintenanceKcal ?? maintenanceKcal,
    budgetKcal: preview?.target?.kcal ?? null,
    macros: preview?.target?.macros || null,
    endDateLabel: formatPreviewDate(preview?.projection?.endDate),
    projection: preview?.projection || null,
  }), [maintenanceKcal, preview]);

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
  if (loading || !plan.ready) return;

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
    return (
      <div key="goal-intro" className="ob2-stage ob2-stage--nested">
        <GoalIntro onNext={() => setStep(1)} />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div key="goal-pick" className="ob2-stage ob2-stage--nested">
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
      </div>
    );
  }

  if (step === 2) {
    if (goalType === "perder_peso") {
      return (
        <div key="goal-lose-setup" className="ob2-stage ob2-stage--nested">
          <GoalLoseSetup
            initialBudgetKcal={plan.budgetKcal}
            endDateLabel={plan.endDateLabel}
            projection={plan.projection}
            calculationReady={plan.ready}
            calculationLoading={previewLoading}
            calculationError={previewError}
            targetWeightKg={targetWeightKg}
            setTargetWeightKg={setTargetWeightKg}
            ratePctBWPerWeek={ratePctBWPerWeek}
            setRatePctBWPerWeek={(v) => setRatePctBWPerWeek(clamp(v, 0.1, 1.5))}
            onBack={() => setStep(1)}
            onNext={() => plan.ready && setStep(3)}
            heightCm={heightCm}
            currentWeightKg={startWeightKg}
          />
        </div>
      );
    }

    if (goalType === "ganar_peso") {
      return (
        <div key="goal-gain-setup" className="ob2-stage ob2-stage--nested">
          <GoalGainSetup
            maintenanceKcal={plan.maintenanceKcal}
            initialBudgetKcal={plan.budgetKcal}
            endDateLabel={plan.endDateLabel}
            projection={plan.projection}
            calculationReady={plan.ready}
            calculationLoading={previewLoading}
            calculationError={previewError}
            targetWeightKg={targetWeightKg}
            setTargetWeightKg={setTargetWeightKg}
            ratePctBWPerWeek={ratePctBWPerWeek}
            setRatePctBWPerWeek={(v) => setRatePctBWPerWeek(clamp(v, 0.1, 1.5))}
            onBack={() => setStep(1)}
            onNext={() => plan.ready && setStep(3)}
          />
        </div>
      );
    }

    return (
      <div key="goal-maintenance-setup" className="ob2-stage ob2-stage--nested">
        <GoalMaintenanceSetup
          initialRangeLabel={plan.ready ? `${plan.budgetKcal - 150} – ${plan.budgetKcal + 150} kcal` : "Calculando…"}
          trendTargetKg={targetWeightKg}
          setTrendTargetKg={setTargetWeightKg}
          onBack={() => setStep(1)}
          onNext={() => plan.ready && setStep(3)}
        />
      </div>
    );
  }

  if (goalType === "perder_peso") {
    const summary = {
      type: "perder_peso",
      maintenanceKcal: plan.maintenanceKcal,
      startWeightKg,
      initialBudgetKcal: plan.budgetKcal,
      targetMacros: plan.macros,
      calculationSource: "server_nutrition_preview",
      endDateLabel: plan.endDateLabel,
      targetWeightKg,
      ratePctBWPerWeek: -Math.abs(ratePctBWPerWeek),
    };

    return (
      <div key="goal-lose-summary" className="ob2-stage ob2-stage--nested">
        <GoalLoseSummary
          summary={summary}
          onBack={() => {
            if (loading) return;
            setStep(2);
          }}
          onNext={() => handleSaveAndContinue(summary)}
          loading={loading}
        />
      </div>
    );
  }

  if (goalType === "ganar_peso") {
    const summary = {
      type: "ganar_peso",
      maintenanceKcal: plan.maintenanceKcal,
      startWeightKg,
      initialBudgetKcal: plan.budgetKcal,
      targetMacros: plan.macros,
      calculationSource: "server_nutrition_preview",
      endDateLabel: plan.endDateLabel,
      targetWeightKg,
      ratePctBWPerWeek: Math.abs(ratePctBWPerWeek),
    };

    return (
      <div key="goal-gain-summary" className="ob2-stage ob2-stage--nested">
        <GoalGainSummary
          summary={summary}
          onBack={() => {
            if (loading) return;
            setStep(2);
          }}
          onNext={() => handleSaveAndContinue(summary)}
          loading={loading}
        />
      </div>
    );
  }

  const maint = {
    type: "mantener_peso",
    maintenanceKcal: plan.maintenanceKcal,
    initialBudgetKcal: plan.budgetKcal,
    trendTargetKg: targetWeightKg,
    targetMacros: plan.macros,
    calculationSource: "server_nutrition_preview",
    targetRangeKg: {
      min: Number(targetWeightKg) - 1.5,
      max: Number(targetWeightKg) + 1.5,
    },
    initialRangeKcal: {
      min: plan.budgetKcal - 150,
      max: plan.budgetKcal + 150,
    },
    approach: "Mantenerse en rango",
  };

  return (
    <div key="goal-maintenance-summary" className="ob2-stage ob2-stage--nested">
      <GoalMaintenanceSummary
        summary={maint}
        onBack={() => {
          if (loading) return;
          setStep(2);
        }}
        onNext={() => handleSaveAndContinue(maint)}
        loading={loading}
      />
    </div>
  );
}
