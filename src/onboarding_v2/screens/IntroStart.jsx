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
    description: "Cuerpo, actividad y experiencia.",
    Icon: UserRound,
    active: true,
  },
  {
    number: "02",
    title: "Tu objetivo",
    description: "Una meta clara, realista y medible.",
    Icon: Target,
  },
  {
    number: "03",
    title: "Tu programa",
    description: "Tus gustos, horarios y rutina.",
    Icon: SlidersHorizontal,
  },
];

export default function IntroStart() {
  return (
    <div className="ob2-card ob2-introStart ob2-intro-journey ob2-intro-compact">
      <header className="ob2-intro-compact-head">
        <div className="ob2-intro-eyebrow">
          <Sparkles size={15} strokeWidth={2.4} aria-hidden="true" />
          Tu experiencia ZumaFit
        </div>

        <h1 className="ob2-h1 ob2-intro-title">
          Armemos <span>tu plan.</span>
        </h1>
        <p className="ob2-p ob2-intro-copy">
          Tres pasos rápidos para adaptar tu nutrición y entrenamiento a tu vida real.
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
      </header>

      <div className="ob2-stepList ob2-intro-steps" role="list" aria-label="Etapas de configuración">
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
  );
}
