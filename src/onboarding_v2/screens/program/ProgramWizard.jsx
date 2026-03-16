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

  // 0 intro
  // 1 dieta
  // 2 entrenamiento
  // 3 distribución calorías (even vs shift)
  // 4 días shift (solo si shift)
  // 5 proteína
  // 6 generating
  // 7 ready
  const [step, setStep] = useState(0);

  const [diet, setDiet] = useState(""); // equilibrada | baja_grasa | baja_carbo | keto
  const [training, setTraining] = useState(""); // none | lifting | cardio | both
  const [calorieDist, setCalorieDist] = useState(""); // even | shift
  const [shiftDays, setShiftDays] = useState([]); // ["Lunes", ...]
  const [protein, setProtein] = useState(""); // low | moderate | high | extra_high

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
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 3,
        data: { __wizard: "v2", __final: true, programV2: finalData },
      }),
    });
  }

  // ----------------
  // RENDER
  // ----------------
  if (step === 0) {
    return (
      <ProgramIntro
        onBack={() => nav("/app/onboarding/goal", { replace: true })}
        onNext={() => setStep(1)}
      />
    );
  }

  if (step === 1) {
    return (
      <ProgramDietPick
        value={diet}
        onChange={setDiet}
        onBack={() => setStep(0)}
        onNext={async () => {
          if (!diet) return;
          await savePartial({ diet });
          setStep(2);
        }}
      />
    );
  }

  if (step === 2) {
    return (
      <ProgramTrainingPick
        value={training}
        onChange={setTraining}
        onBack={() => setStep(1)}
        onNext={async () => {
          if (!training) return;
          await savePartial({ diet, training });
          setStep(3);
        }}
      />
    );
  }

  if (step === 3) {
    return (
      <ProgramCalorieDistribution
        value={calorieDist}
        onChange={setCalorieDist}
        onBack={() => setStep(2)}
        onNext={async () => {
          if (!calorieDist) return;

          await savePartial({ diet, training, calorieDist });

          // ✅ branching:
          // even -> NO días
          // shift -> SÍ días
          if (calorieDist === "shift") {
            setStep(4);
          } else {
            setShiftDays([]); // limpiamos si venía de shift
            setStep(5);
          }
        }}
      />
    );
  }

  if (step === 4) {
    return (
      <ProgramShiftDays
        days={DAYS}
        value={shiftDays}
        onToggle={(day) => {
          setShiftDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
        }}
        onBack={() => setStep(3)}
        onNext={async () => {
          // puede avanzar sin elegir ninguno (como tu screenshot)
          await savePartial({ diet, training, calorieDist, shiftDays });
          setStep(5);
        }}
      />
    );
  }

  if (step === 5) {
    return (
      <ProgramProteinPick
        value={protein}
        onChange={setProtein}
        onBack={() => setStep(calorieDist === "shift" ? 4 : 3)}
        onNext={async () => {
          if (!protein) return;
          await savePartial({ ...payload, protein });
          setStep(6);
        }}
      />
    );
  }

  if (step === 6) {
    return <ProgramGenerating onBack={() => setStep(5)} onDone={() => setStep(7)} />;
  }

  // step === 7
  return (
    <ProgramReady
      data={payload}
      onBack={() => setStep(5)}
      onFinish={async () => {
        await saveFinal(payload);
        onDone?.();
      }}
    />
  );
}
