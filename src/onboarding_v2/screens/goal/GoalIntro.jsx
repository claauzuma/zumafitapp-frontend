// src/onboarding_v2/screens/goal/GoalIntro.jsx
import React from "react";

export default function GoalIntro({ onNext }) {
  return (
    <div className="ob2-card">
      <h1 className="ob2-h1">¡Vamos con tu objetivo!</h1>
      <p className="ob2-p">
        Ahora definimos tu meta y armamos un plan para ayudarte a lograrla.
      </p>

      <div style={{ marginTop: 18 }} className="ob2-stepList">
        <div className="ob2-stepItem done">
          <div className="ob2-stepDot">✓</div>
          <div>
            <div className="ob2-stepTitle">Básicos</div>
            <div className="ob2-stepSub">Listo</div>
          </div>
        </div>

        <div className="ob2-stepItem active">
          <div className="ob2-stepDot">2</div>
          <div>
            <div className="ob2-stepTitle">Objetivo</div>
            <div className="ob2-stepSub">Elegí tu meta</div>
          </div>
        </div>

        <div className="ob2-stepItem">
          <div className="ob2-stepDot">3</div>
          <div>
            <div className="ob2-stepTitle">Programa</div>
            <div className="ob2-stepSub">Últimos detalles</div>
          </div>
        </div>
      </div>

      <div className="ob2-sticky">
        <button className="ob2-btn primary" type="button" onClick={onNext}>
          Ir a Objetivo
        </button>
      </div>
    </div>
  );
}
