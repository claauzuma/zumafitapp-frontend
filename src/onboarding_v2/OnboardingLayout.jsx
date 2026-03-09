import React from "react";
import "./OnboardingStyles.css";

export default function OnboardingLayout({
  title,
  subtitle,
  progressPct,
  onBack,
  children,
  footer,
}) {
  return (
    <div className="ob2-root">
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

      <div className="ob2-container">{children}</div>

      {footer ? <div className="ob2-sticky">{footer}</div> : null}
    </div>
  );
}