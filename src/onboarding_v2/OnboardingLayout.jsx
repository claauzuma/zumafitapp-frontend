import React from "react";
import {
  Activity,
  CalendarDays,
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
import "./OnboardingStyles.css";

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
  children,
  footer,
  theme = "intro",
}) {
  const { label, Icon } = THEME_META[theme] || THEME_META.intro;

  return (
    <div className={`ob2-root ob2-theme-${theme}`}>
      <div className="ob2-topbar">
        <div className="ob2-topbar-inner">
          <button className="ob2-back" onClick={onBack} type="button" title="Atrás">
            ←
          </button>
          <div className="ob2-titlewrap">
            <p className="ob2-title">{title}</p>
            {subtitle ? <p className="ob2-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        <div className="ob2-progress">
          <div style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="ob2-container">
        <div className="ob2-theme-marker" aria-hidden="true">
          <span className="ob2-theme-marker-icon"><Icon size={18} strokeWidth={1.8} /></span>
          <span>{label}</span>
        </div>
        <div className="ob2-screen-content">{children}</div>
      </div>

      {footer ? <div className="ob2-sticky">{footer}</div> : null}
    </div>
  );
}
