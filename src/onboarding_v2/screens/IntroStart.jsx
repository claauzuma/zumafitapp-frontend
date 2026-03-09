import React from "react";

export default function IntroStart() {
  return (
    <>
      <h1 className="ob2-h1">EMPECEMOS</h1>
      <p className="ob2-p">Tu programa personalizado te espera.</p>

      <div className="ob2-card">
        <div className="ob2-timeline">
          <div className="ob2-line">
            <div className="ob2-bubble active">1</div>
            <div>
              <p className="ob2-section-title">Básicos</p>
              <p className="ob2-section-sub">
                Aprendemos sobre vos y tu metabolismo. Esto es la base del programa.
              </p>
            </div>
          </div>

          <div className="ob2-line">
            <div className="ob2-bubble">2</div>
            <div>
              <p className="ob2-section-title">Objetivo</p>
              <p className="ob2-section-sub">Definimos tu meta y tu dirección.</p>
            </div>
          </div>

          <div className="ob2-line">
            <div className="ob2-bubble">3</div>
            <div>
              <p className="ob2-section-title">Programa</p>
              <p className="ob2-section-sub">Preferencias del plan (algunas se pueden omitir).</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}