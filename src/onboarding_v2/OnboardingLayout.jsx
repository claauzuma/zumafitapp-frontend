import React, { useEffect, useRef } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Ruler,
  Scale,
  ScanLine,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import BrandLogo from "../ui/BrandLogo.jsx";
import "./OnboardingStyles.css";

const PHASES = ["Básicos", "Objetivo", "Programa"];

const THEME_META = {
  intro: { label: "Tu recorrido", Icon: Sparkles },
  sex: { label: "Perfil", Icon: UserRound },
  birth: { label: "Edad y contexto", Icon: CalendarDays },
  height: { label: "Altura", Icon: Ruler },
  weight: { label: "Peso actual", Icon: Scale },
  bodyfat: { label: "Composición corporal", Icon: ScanLine },
  trend: { label: "Evolución", Icon: TrendingUp },
  exercise: { label: "Entrenamiento", Icon: Dumbbell },
  daily: { label: "Movimiento diario", Icon: Footprints },
  exp: { label: "Experiencia", Icon: Activity },
  tdee: { label: "Energía diaria", Icon: Flame },
  goal: { label: "Tu objetivo", Icon: Target },
  program: { label: "Tu programa", Icon: Gauge },
};

export default function OnboardingLayout({
  title,
  subtitle,
  progressPct,
  onBack,
  backDisabled = false,
  children,
  footer,
  theme = "intro",
  phaseIndex,
  stepCurrent,
  stepTotal,
  transitionKey,
  navigationKey,
}) {
  const contentRef = useRef(null);
  const { label, Icon } = THEME_META[theme] || THEME_META.intro;
  const activePhase = Number.isInteger(phaseIndex)
    ? Math.min(2, Math.max(0, phaseIndex))
    : theme === "goal"
      ? 1
      : theme === "program"
        ? 2
        : 0;
  const safeProgress = Math.min(100, Math.max(0, Number(progressPct) || 0));
  const hasStepCount = Number(stepCurrent) > 0 && Number(stepTotal) > 0;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() => {
      contentRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [navigationKey]);

  return (
    <div className={`ob2-root ob2-theme-${theme} ${footer ? "ob2-has-footer" : ""}`}>
      <div className="ob2-ambient" aria-hidden="true">
        <span className="ob2-ambient-orb ob2-ambient-orb--one" />
        <span className="ob2-ambient-orb ob2-ambient-orb--two" />
      </div>

      <header
        className="ob2-topbar"
        aria-label={[title, subtitle].filter(Boolean).join(" · ")}
      >
        <div className="ob2-topbar-inner">
          <button
            className="ob2-back"
            onClick={onBack}
            type="button"
            aria-label="Volver"
            disabled={backDisabled}
          >
            <ArrowLeft size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <BrandLogo className="ob2-brand" size="xs" priority />

          <div
            className="ob2-progress-orb"
            style={{ "--ob2-progress-angle": `${safeProgress * 3.6}deg` }}
            aria-label={`${Math.round(safeProgress)}% completado`}
          >
            <span>{Math.round(safeProgress)}</span>
            <small>%</small>
          </div>
        </div>

        <ol className="ob2-phase-rail" aria-label="Etapas de configuración">
          {PHASES.map((phase, index) => {
            const state = index < activePhase ? "is-complete" : index === activePhase ? "is-active" : "";
            return (
              <li key={phase} className={state} aria-current={index === activePhase ? "step" : undefined}>
                <span className="ob2-phase-dot" aria-hidden="true">
                  {index < activePhase ? <Check size={12} strokeWidth={3} /> : index + 1}
                </span>
                <span>{phase}</span>
              </li>
            );
          })}
        </ol>

        <div
          className="ob2-progress"
          role="progressbar"
          aria-label="Progreso total del onboarding"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(safeProgress)}
        >
          <div style={{ "--ob2-progress-scale": safeProgress / 100 }} />
        </div>
      </header>

      <main className="ob2-container">
        <div className="ob2-context-row">
          <div className="ob2-theme-marker">
            <span className="ob2-theme-marker-icon" aria-hidden="true">
              <Icon size={17} strokeWidth={1.9} />
            </span>
            <span>{label}</span>
          </div>
          {hasStepCount ? (
            <span className="ob2-step-count">
              Paso <strong>{stepCurrent}</strong> de {stepTotal}
            </span>
          ) : null}
        </div>
        <div
          key={transitionKey || theme}
          ref={contentRef}
          className="ob2-screen-content ob2-stage"
          tabIndex={-1}
        >
          {children}
        </div>
      </main>

      {footer ? <div className="ob2-sticky">{footer}</div> : null}
    </div>
  );
}
