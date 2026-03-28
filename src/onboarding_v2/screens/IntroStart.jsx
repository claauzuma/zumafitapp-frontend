import React from "react";

export default function IntroStart() {
  return (
    <>
      <h1 className="ob2-h1">EMPECEMOS</h1>
      <p className="ob2-p">Tu programa personalizado te espera.</p>

      <div className="ob2-card ob2-introStart">
        <div className="ob2-stepList">
          {/* ACTIVE (amarillo) */}
          <div className="ob2-stepItem active ob2-stepItemActiveGold">
            <div className="ob2-stepDot ob2-stepDotActiveGold">1</div>
            <div>
              <div className="ob2-stepTitle ob2-stepTitleActiveGold">Básicos</div>
              <div className="ob2-stepSub">Te conocemos un poco más. Esta es la base del programa.</div>
            </div>
          </div>

          {/* default */}
          <div className="ob2-stepItem">
            <div className="ob2-stepDot">2</div>
            <div>
              <div className="ob2-stepTitle">Objetivo</div>
              <div className="ob2-stepSub">Definimos tu meta y tu dirección.</div>
            </div>
          </div>

          {/* default */}
          <div className="ob2-stepItem">
            <div className="ob2-stepDot">3</div>
            <div>
              <div className="ob2-stepTitle">Programa</div>
              <div className="ob2-stepSub">Preferencias del plan.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
