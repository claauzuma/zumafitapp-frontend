import React from "react";
import {
  Clock3,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";

const STAGES = [
  {
    number: "01",
    title: "Tu base",
    description: "Conocemos tu cuerpo, tu actividad y tu experiencia.",
    Icon: UserRound,
    active: true,
  },
  {
    number: "02",
    title: "Tu objetivo",
    description: "Definimos una meta clara, realista y medible.",
    Icon: Target,
  },
  {
    number: "03",
    title: "Tu programa",
    description: "Ajustamos el plan a tus gustos y a tu rutina.",
    Icon: SlidersHorizontal,
  },
];

export default function IntroStart() {
  return (
    <>
      <section className="ob2-intro-hero">
        <div className="ob2-intro-eyebrow">
          <Sparkles size={15} strokeWidth={2.4} aria-hidden="true" />
          Configuración inteligente
        </div>

        <h1 className="ob2-h1 ob2-intro-title">
          Tu mejor plan empieza <span>con vos.</span>
        </h1>
        <p className="ob2-p ob2-intro-copy">
          Contanos lo esencial y ZumaFit va a construir una experiencia que se adapte de verdad a tu día a día.
        </p>

        <div className="ob2-intro-benefits" aria-label="Beneficios de la configuración">
          <span className="ob2-intro-chip">
            <Clock3 size={14} aria-hidden="true" />
            Menos de 2 min
          </span>
          <span className="ob2-intro-chip">
            <ShieldCheck size={14} aria-hidden="true" />
            Siempre editable
          </span>
        </div>
      </section>

      <div className="ob2-card ob2-introStart ob2-intro-journey">
        <div className="ob2-intro-journey-head">
          <div>
            <span className="ob2-intro-journey-kicker">Tu recorrido</span>
            <h2>Simple, personal y directo</h2>
          </div>
          <span className="ob2-intro-journey-count">3 etapas</span>
        </div>

        <div className="ob2-stepList ob2-intro-steps" role="list">
          {STAGES.map(({ number, title, description, Icon, active }) => (
            <div
              className={`ob2-stepItem ob2-intro-step${active ? " active ob2-stepItemActiveGold is-active" : ""}`}
              role="listitem"
              key={number}
            >
              <div className={`ob2-stepDot ob2-intro-step-icon${active ? " ob2-stepDotActiveGold" : ""}`}>
                {React.createElement(Icon, { size: 18, strokeWidth: 2.1, "aria-hidden": true })}
              </div>
              <div className="ob2-intro-step-body">
                <span className="ob2-intro-step-number">{number}</span>
                <div className={`ob2-stepTitle${active ? " ob2-stepTitleActiveGold" : ""}`}>{title}</div>
                <div className="ob2-stepSub">{description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
