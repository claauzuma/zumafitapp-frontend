// src/onboarding_v2/screens/program/ProgramIntro.jsx
import React from "react";

export default function ProgramIntro({ onNext }) {
  async function handleNext() {
    await new Promise((r) => setTimeout(r, 140));
    onNext?.();
  }

  return (
    <div className="ob2-card ob2-programIntro">
      <h1 className="ob2-h1">¡Listo para tu programa!</h1>
      <p className="ob2-p">Contanos tus preferencias y hábitos para ajustar tu plan.</p>

      <div className="ob2-stepList">
        <div className="ob2-stepItem done ob2-stepItemDoneGreen">
          <div className="ob2-stepDot ob2-stepDotDoneGreen">✓</div>
          <div>
            <div className="ob2-stepTitle ob2-stepTitleDoneGreen">Básicos</div>
            <div className="ob2-stepSub">Listo</div>
          </div>
        </div>

        <div className="ob2-stepItem done ob2-stepItemDoneGreen">
          <div className="ob2-stepDot ob2-stepDotDoneGreen">✓</div>
          <div>
            <div className="ob2-stepTitle ob2-stepTitleDoneGreen">Objetivo</div>
            <div className="ob2-stepSub">Listo</div>
          </div>
        </div>

        <div className="ob2-stepItem active ob2-stepItemActiveGold">
          <div className="ob2-stepDot ob2-stepDotActiveGold">3</div>
          <div>
            <div className="ob2-stepTitle ob2-stepTitleActiveGold">Programa</div>
            <div className="ob2-stepSub">Últimos detalles</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="ob2-btn primary" type="button" onClick={handleNext}>
          Ir a Programa
        </button>
      </div>
    </div>
  );
}
