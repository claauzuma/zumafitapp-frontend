// src/onboarding_v2/screens/goal/GoalIntro.jsx
import React from "react";

export default function GoalIntro({ onNext }) {
  async function handleNext() {
    await new Promise((r) => setTimeout(r, 140));
    onNext?.();
  }

  return (
    <div className="ob2-card ob2-goalIntro">
      <h1 className="ob2-h1">¡Vamos con tu objetivo!</h1>
      <p className="ob2-p">Ahora definimos tu meta y armamos un plan para ayudarte a lograrla.</p>

      <div className="ob2-stepList">
        {/* DONE (verde) */}
        <div className="ob2-stepItem done ob2-stepItemDoneGreen">
          <div className="ob2-stepDot ob2-stepDotDoneGreen">✓</div>
          <div>
            <div className="ob2-stepTitle ob2-stepTitleDoneGreen">Básicos</div>
            <div className="ob2-stepSub">Listo</div>
          </div>
        </div>

        {/* ACTIVE (amarillo) */}
        <div className="ob2-stepItem active ob2-stepItemActiveGold">
          <div className="ob2-stepDot ob2-stepDotActiveGold">2</div>
          <div>
            <div className="ob2-stepTitle ob2-stepTitleActiveGold">Objetivo</div>
            <div className="ob2-stepSub">Elegí tu meta</div>
          </div>
        </div>

        {/* default */}
        <div className="ob2-stepItem">
          <div className="ob2-stepDot">3</div>
          <div>
            <div className="ob2-stepTitle">Programa</div>
            <div className="ob2-stepSub">Últimos detalles</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="ob2-btn primary" type="button" onClick={handleNext}>
          Ir a Objetivo
        </button>
      </div>
    </div>
  );
}
