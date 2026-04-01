// src/onboarding_v2/screens/program/ProgramWizard.jsx
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

  const payload = useMemo(
    () => ({
      diet,
      training,
      calorieDist,
      shiftDays,
      protein,
    }),
    [diet, training, calorieDist, shiftDays, protein]
  );

  async function savePartial(partial) {
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 3,
        data: { __wizard: "v2", __final: false, programV2: partial },
      }),
    });
  }

  async function saveFinal(finalData) {
    try {
      setLoading(true);
      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify({
          step: 3,
          data: { __wizard: "v2", __final: true, programV2: finalData },
        }),
      });
    } finally {
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
            await new Promise((r) => setTimeout(r, 140));
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <ProgramDietPick
          value={diet}
          onChange={setDiet}
          onBack={() => setStep(0)}
          onNext={async () => {
            if (!diet) return;
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
          onBack={() => setStep(1)}
          onNext={async () => {
            if (!training) return;
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
          onBack={() => setStep(2)}
          onNext={async () => {
            if (!calorieDist) return;
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
            setShiftDays((prev) =>
              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
            );
          }}
          onBack={() => setStep(3)}
          onNext={async () => {
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
          onBack={() => setStep(calorieDist === "shift" ? 4 : 3)}
          onNext={async () => {
            if (!protein) return;
            await new Promise((r) => setTimeout(r, 100));
            setStep(6);
            savePartialInBackground({ ...payload, protein }, "protein");
          }}
        />
      )}

      {step === 6 && (
        <ProgramGenerating
          onBack={() => setStep(5)}
          onDone={() => setStep(7)}
        />
      )}

      {step === 7 && (
        <ProgramReady
          data={payload}
          onBack={() => setStep(5)}
          onFinish={async () => {
            if (loading) return;
            await saveFinal(payload);
            onDone?.();
          }}
          loading={loading}
        />
      )}
    </div>
  );
}
