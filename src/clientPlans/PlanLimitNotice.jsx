import React from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { clientPlanLabel, normalizeClientPlan } from "./clientPlanUtils.js";

export default function PlanLimitNotice({
  type = "menus",
  plan = "free",
  current = 0,
  limit = null,
  onPrimary,
  onPlans,
  primaryLabel = "Administrar",
  plansLabel = "Ver planes",
}) {
  const normalizedPlan = normalizeClientPlan(plan);
  const label = clientPlanLabel(normalizedPlan);

  const copy = {
    menus: {
      title: `Usaste todos los menus disponibles en ${label}`,
      text: `Podes editar o eliminar uno existente${Number.isFinite(Number(limit)) ? ` (${current}/${limit})` : ""}, o conocer las opciones de Pro.`,
    },
    days: {
      title: "La planificacion semanal requiere un plan superior",
      text: "Tu plan actual permite una planificacion mas acotada. Podes continuar con el modo disponible.",
    },
    premium: {
      title: "Contenido disponible en VIP",
      text: "Con VIP accedes a la biblioteca premium de ZumaFit.",
    },
  }[type] || {
    title: "Funcion no disponible en tu plan",
    text: "Consulta los beneficios disponibles antes de continuar.",
  };

  return (
    <aside className="plan-limit-notice" role="status" aria-live="polite">
      <div className="plan-limit-icon" aria-hidden="true">
        <AlertTriangle size={18} />
      </div>
      <div className="plan-limit-copy">
        <strong>{copy.title}</strong>
        <p>{copy.text}</p>
      </div>
      <div className="plan-limit-actions">
        {onPrimary ? (
          <button type="button" onClick={onPrimary}>
            {primaryLabel}
          </button>
        ) : null}
        {onPlans ? (
          <button type="button" onClick={onPlans}>
            {plansLabel}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </aside>
  );
}
