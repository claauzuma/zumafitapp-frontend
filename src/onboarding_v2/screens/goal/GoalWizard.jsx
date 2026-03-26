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

/**
 * Estimaciones rápidas (aprox):
 * - 1 kg de grasa ~ 7700 kcal
 * - déficit/superávit semanal = kg/sem * 7700
 * - diario = semanal / 7
 *
 * ratePctBWPerWeek es "porcentaje del peso corporal por semana", ej 0.5 = 0.5%
 */
function calcPlan({
  mode, // "lose" | "gain"
  maintenanceKcal,
  currentWeightKg,
  targetWeightKg,
  ratePctBWPerWeek,
}) {
  const mKcal = Number(maintenanceKcal);
  const w0 = Number(currentWeightKg);
  const wt = Number(targetWeightKg);
  const r = Number(ratePctBWPerWeek);

  if (!Number.isFinite(mKcal) || !Number.isFinite(w0) || !Number.isFinite(wt) || !Number.isFinite(r)) {
    return { budgetKcal: 2400, endDateLabel: "—", deficitDaily: 0, kgPerWeek: 0 };
  }

  const kgPerWeek = Math.max(0, w0 * (r / 100)); // ej 80kg * 0.5% = 0.4 kg/sem
  const kcalPerWeek = kgPerWeek * 7700;
  const kcalPerDay = kcalPerWeek / 7;

  // clamps básicos de UX
  const minBudget = 1400; // genérico (si después querés, lo hacemos por sexo)
  const maxBudgetLose = Math.max(minBudget, mKcal - 100); // que no quede en "mantenimiento" exacto
  const maxBudgetGain = mKcal + 1200; // techo para no volar

  let budgetKcal = mKcal;
  if (mode === "lose") {
    budgetKcal = Math.round(clamp(mKcal - kcalPerDay, minBudget, maxBudgetLose));
  } else {
    budgetKcal = Math.round(clamp(mKcal + kcalPerDay, mKcal + 100, maxBudgetGain));
  }

  // fecha estimada aprox
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
  heightCm,          // ✅ viene de Basics
  currentWeightKg,   // ✅ viene de Basics (peso actual)
  tdeeKcal,          // ✅ viene de Basics (mantenimiento)
}) {
  const nav = useNavigate();

  // 0 intro -> 1 elegir objetivo -> 2 setup -> 3 summary
  const [step, setStep] = useState(0);

  // perder_peso | mantener_peso | ganar_peso
  const [goalType, setGoalType] = useState("");

  // ✅ base real: mantenimiento desde BasicsTDEE
  const maintenanceKcal = useMemo(() => {
    const t = Number(tdeeKcal);
    return Number.isFinite(t) && t >= 800 && t <= 6000 ? t : 2400;
  }, [tdeeKcal]);

  // ✅ peso actual desde Basics
  const startWeightKg = useMemo(() => {
    const w = Number(currentWeightKg);
    return Number.isFinite(w) && w >= 30 && w <= 250 ? w : 75;
  }, [currentWeightKg]);

  // Estados comunes
  const [targetWeightKg, setTargetWeightKg] = useState(70.0);
  const [ratePctBWPerWeek, setRatePctBWPerWeek] = useState(0.5);

  async function saveGoalToBackend(goalPayload) {
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

  // ---- SETUP ----
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
          initialBudgetKcal={plan.budgetKcal}     // ✅ ahora sale del TDEE + % semanal
          endDateLabel={plan.endDateLabel}        // ✅ ahora NO es "—"
          targetWeightKg={targetWeightKg}
          setTargetWeightKg={setTargetWeightKg}
          ratePctBWPerWeek={ratePctBWPerWeek}
          setRatePctBWPerWeek={(v) => setRatePctBWPerWeek(clamp(v, 0.1, 1.5))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          heightCm={heightCm}                      // ✅ tu mínimo sano
          // si querés usarlo dentro del setup después:
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

    // mantenimiento
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

  // ---- SUMMARY + PERSIST ----
  if (goalType === "perder_peso") {
    const plan = calcPlan({
      mode: "lose",
      maintenanceKcal,
      currentWeightKg: startWeightKg,
      targetWeightKg,
      ratePctBWPerWeek,
    });

    const summary = {
      goalType,
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
        onBack={() => setStep(2)}
        onNext={async () => {
          await saveGoalToBackend({
            goalType: "perder_peso",
            maintenanceKcal: Number(maintenanceKcal),
            startWeightKg: Number(startWeightKg),
            targetWeightKg: Number(targetWeightKg),
            ratePctBWPerWeek: Number(summary.ratePctBWPerWeek),
            initialBudgetKcal: Number(plan.budgetKcal),
            endDateLabel: String(plan.endDateLabel || "—"),
          });
          onDone?.();
        }}
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
      goalType,
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
        onBack={() => setStep(2)}
        onNext={async () => {
          await saveGoalToBackend({
            goalType: "ganar_peso",
            maintenanceKcal: Number(maintenanceKcal),
            startWeightKg: Number(startWeightKg),
            targetWeightKg: Number(targetWeightKg),
            ratePctBWPerWeek: Number(summary.ratePctBWPerWeek),
            initialBudgetKcal: Number(plan.budgetKcal),
            endDateLabel: String(plan.endDateLabel || "—"),
          });
          onDone?.();
        }}
      />
    );
  }

  // mantenimiento summary
  const maint = {
    goalType,
    maintenanceKcal,
    trendTargetKg: targetWeightKg,
    rangeMinKg: Number(targetWeightKg) - 1.5,
    rangeMaxKg: Number(targetWeightKg) + 1.5,
    initialRangeKcalMin: maintenanceKcal - 150,
    initialRangeKcalMax: maintenanceKcal + 150,
    approach: "Mantenerse en rango",
  };

  return (
    <GoalMaintenanceSummary
      summary={maint}
      onBack={() => setStep(2)}
      onNext={async () => {
        await saveGoalToBackend({
          goalType: "mantener_peso",
          maintenanceKcal: Number(maintenanceKcal),
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
