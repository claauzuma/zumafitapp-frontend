import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../Api.js";
import ProgramIntro from "./ProgramIntro.jsx";
import ProgramDietPick from "./ProgramDietPick.jsx";
import ProgramTrainingPick from "./ProgramTrainingPick.jsx";
import ProgramCalorieDistribution from "./ProgramCalorieDistribution.jsx";
import ProgramShiftDays from "./ProgramShiftDays.jsx";
import ProgramProteinPick from "./ProgramProteinPick.jsx";
import ProgramGenerating from "./ProgramGenerating.jsx";
import ProgramReady from "./ProgramReady.jsx";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function ProgramWizard({ onDone }) {
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [diet, setDiet] = useState("equilibrada");
  const [training, setTraining] = useState("");
  const [calorieDist, setCalorieDist] = useState("");
  const [shiftDays, setShiftDays] = useState([]);
  const [protein, setProtein] = useState("moderate");
  const [loading, setLoading] = useState(false);

  const [weeklyPlan, setWeeklyPlan] = useState({
    caloriesByDay: {},
    macrosByDay: {},
  });

  const payload = useMemo(
    () => ({
      diet,
      training,
      calorieDist,
      shiftDays,
      protein,
      weeklyPlan,
    }),
    [diet, training, calorieDist, shiftDays, protein, weeklyPlan]
  );

  async function savePartial(partial) {
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 3,
        data: {
          __wizard: "v2",
          __final: false,
          program: partial,
        },
      }),
    });
  }

  async function saveFinal(finalData) {
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 3,
        data: {
          __wizard: "v2",
          __final: true,
          program: finalData,
        },
      }),
    });
  }

  async function handleFinish() {
    if (loading) return;

    setLoading(true);

    try {
      await saveFinal(payload);
      await onDone?.();
    } catch (e) {
      console.error("No se pudo guardar el programa", e);
      setLoading(false);
    }
  }

  function savePartialInBackground(partial, label = "program") {
    savePartial(partial).catch((e) => {
      console.error(`No se pudo guardar ${label}`, e);
    });
  }

  return (
    <div className="ob2-program">
      {step === 0 && (
        <ProgramIntro
          onBack={() => nav("/app/onboarding/goal", { replace: true })}
          onNext={async () => {
            if (loading) return;
            await new Promise((r) => setTimeout(r, 140));
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <ProgramDietPick
          value={diet}
          onChange={setDiet}
          onBack={() => {
            if (loading) return;
            setStep(0);
          }}
          onNext={async () => {
            if (!diet || loading) return;
            await new Promise((r) => setTimeout(r, 100));
            setStep(2);
            savePartialInBackground({ diet }, "diet");
          }}
        />
      )}

      {step === 2 && (
        <ProgramTrainingPick
          value={training}
          onChange={setTraining}
          onBack={() => {
            if (loading) return;
            setStep(1);
          }}
          onNext={async () => {
            if (!training || loading) return;
            await new Promise((r) => setTimeout(r, 100));
            setStep(3);
            savePartialInBackground({ diet, training }, "training");
          }}
        />
      )}

      {step === 3 && (
        <ProgramCalorieDistribution
          value={calorieDist}
          onChange={setCalorieDist}
          onBack={() => {
            if (loading) return;
            setStep(2);
          }}
          onNext={async () => {
            if (!calorieDist || loading) return;
            await new Promise((r) => setTimeout(r, 100));

            if (calorieDist === "shift") {
              setStep(4);
            } else {
              setShiftDays([]);
              setStep(5);
            }

            savePartialInBackground({ diet, training, calorieDist }, "calorie distribution");
          }}
        />
      )}

      {step === 4 && (
        <ProgramShiftDays
          days={DAYS}
          value={shiftDays}
          onToggle={(day) => {
            if (loading) return;
            setShiftDays((prev) =>
              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
            );
          }}
          onBack={() => {
            if (loading) return;
            setStep(3);
          }}
          onNext={async () => {
            if (loading) return;
            await new Promise((r) => setTimeout(r, 100));
            setStep(5);
            savePartialInBackground({ diet, training, calorieDist, shiftDays }, "shift days");
          }}
        />
      )}

      {step === 5 && (
        <ProgramProteinPick
          value={protein}
          onChange={setProtein}
          onBack={() => {
            if (loading) return;
            setStep(calorieDist === "shift" ? 4 : 3);
          }}
          onNext={async () => {
            if (!protein || loading) return;
            await new Promise((r) => setTimeout(r, 100));
            setStep(6);
            savePartialInBackground({ diet, training, calorieDist, shiftDays, protein }, "protein");
          }}
        />
      )}

      {step === 6 && (
        <ProgramGenerating
          onBack={() => {
            if (loading) return;
            setStep(5);
          }}
          onDone={() => {
            if (loading) return;
            setStep(7);
          }}
        />
      )}

      {step === 7 && (
        <ProgramReady
          data={payload}
          onBack={() => {
            if (loading) return;
            setStep(5);
          }}
          onPlanReady={(plan) => {
            setWeeklyPlan(plan);
          }}
          onFinish={handleFinish}
          loading={loading}
        />
      )}
    </div>
  );
}
