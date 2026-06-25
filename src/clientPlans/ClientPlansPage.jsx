import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
import {
  clientPlanLabel,
  clientPlanTone,
  clientTypeLabel,
  libraryAccessLabel,
  menusUsageFromResponse,
  normalizeClientPlan,
  PLAN_ORDER,
  PLAN_PRESETS,
  planCopy,
  planDetails,
  planFeatureRows,
  planFromCapabilities,
  planUpgradeHighlights,
  usageText,
} from "./clientPlanUtils.js";
import {
  clientPlanCapabilitiesKey,
  clientPlanMenusUsageKey,
  fetchClientPlanCapabilities,
  fetchClientPlanMenusUsage,
} from "./clientPlanQueries.js";
import "./clientPlans.css";

function PlanBadge({ children, tone = "free" }) {
  return <span className={`cp-badge ${tone}`}>{children}</span>;
}

function UsageBar({ used = 0, limit = null }) {
  const percent = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(100, Math.round((Number(used) / Number(limit)) * 100))
    : 0;
  return (
    <div className="cp-usage-track" aria-hidden="true">
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function Skeleton() {
  return (
    <section className="cp-page" aria-busy="true">
      <div className="cp-skeleton hero" />
      <div className="cp-skeleton" />
      <div className="cp-grid">
        <div className="cp-skeleton card" />
        <div className="cp-skeleton card" />
        <div className="cp-skeleton card" />
      </div>
    </section>
  );
}

export default function ClientPlansPage() {
  const navigate = useNavigate();
  const [requestedPlan, setRequestedPlan] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState("");
  const cachedUser = useMemo(() => getCachedUser(), []);
  const meQuery = useAuthMe({
    enabled: true,
    initialFromCache: true,
    staleTime: 60 * 1000,
    refetchOnMount: false,
  });
  const user = meQuery.data || cachedUser || {};
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const usageQuery = useQuery({
    queryKey: clientPlanMenusUsageKey,
    queryFn: fetchClientPlanMenusUsage,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    enabled: !!capabilitiesQuery.data,
  });

  if (capabilitiesQuery.isLoading && !capabilitiesQuery.data) return <Skeleton />;

  if (capabilitiesQuery.isError && !capabilitiesQuery.data) {
    return (
      <section className="cp-page">
        <button type="button" className="cp-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} />
          Volver
        </button>
        <article className="cp-error">
          <strong>No pudimos cargar tu plan.</strong>
          <p>
            Fallo la consulta obligatoria de capacidades. No vamos a asumir que sos Free si esa request falla.
            Status: {capabilitiesQuery.error?.status ?? "desconocido"}.
          </p>
          <button type="button" onClick={() => capabilitiesQuery.refetch()}>Reintentar</button>
        </article>
      </section>
    );
  }

  const capabilities = capabilitiesQuery.data;
  const usageCapabilities = usageQuery.data?.capabilities || capabilities;
  const rawPlan = capabilities?.plan;
  const hasPlan = Boolean(rawPlan);
  const plan = hasPlan ? planFromCapabilities(user, capabilities) : "";
  const tone = hasPlan ? clientPlanTone(plan) : "free";
  const usage = menusUsageFromResponse(usageQuery.data, usageCapabilities);
  const usageKnown = usage.used !== null && usage.used !== undefined && Number.isFinite(Number(usage.used));
  const usageLoading = usageQuery.isLoading || usageQuery.isFetching;
  const canUpgrade = hasPlan && normalizeClientPlan(plan) !== "vip";
  const currentPreset = capabilities;
  const currentPlanIndex = hasPlan ? PLAN_ORDER.indexOf(plan) : -1;
  const currentCopy = hasPlan ? planCopy(plan) : null;

  return (
    <section className="cp-page">
      <button type="button" className="cp-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={17} />
        Volver
      </button>

      <header className={`cp-hero ${tone}`}>
        <div>
          <span className="cp-kicker">
            <Crown size={16} />
            {currentCopy?.eyebrow || "Tu plan actual"}
          </span>
          <h1>{hasPlan ? currentCopy.title : "Plan no disponible"}</h1>
          <p>
            {hasPlan
              ? currentCopy.summary
              : "Conoce que incluye tu plan y que funciones podes desbloquear cuando el flujo de mejora este disponible."}
          </p>
          <div className="cp-badge-row">
            <PlanBadge tone={capabilities?.hasCoach ? "coach" : "self"}>{clientTypeLabel(user, capabilities)}</PlanBadge>
            {hasPlan ? <PlanBadge tone={tone}>Plan {clientPlanLabel(plan)}</PlanBadge> : <PlanBadge>Plan desconocido</PlanBadge>}
          </div>
          {hasPlan ? (
            <div className="cp-current-stats" aria-label="Resumen rapido del plan actual">
              <article>
                <strong>{currentPreset?.limits?.ownMenus ?? "-"}</strong>
                <span>menus propios</span>
              </article>
              <article>
                <strong>{currentPreset?.limits?.ownMeals ?? "-"}</strong>
                <span>comidas propias</span>
              </article>
              <article>
                <strong>{libraryAccessLabel(currentPreset)}</strong>
                <span>biblioteca</span>
              </article>
            </div>
          ) : null}
        </div>
        <div className={`cp-plan-orb ${tone}`} aria-hidden="true">
          <span>Plan actual</span>
          <strong>{hasPlan ? clientPlanLabel(plan) : "?"}</strong>
        </div>
      </header>

      <section className="cp-usage-card" aria-label="Uso actual del plan">
        <div className="cp-section-head">
          <div>
            <span className="cp-kicker">
              <ShieldCheck size={15} />
              Uso actual
            </span>
            <h2>Tus limites reales</h2>
          </div>
          <span className="cp-soft-pill">{libraryAccessLabel(currentPreset)} biblioteca</span>
        </div>
        <div className="cp-usage-grid">
          <article>
            <span>Menus propios</span>
            <strong>{usageKnown ? usageText(usage) : usageLoading ? "Cargando..." : "No disponible"}</strong>
            {usageKnown ? (
              <UsageBar used={usage.used} limit={usage.limit} />
            ) : (
              <small>{usageLoading ? "Calculando tus menus guardados." : "No pudimos calcular el contador."}</small>
            )}
          </article>
          {Number.isFinite(Number(currentPreset?.limits?.ownMeals)) ? (
            <article>
              <span>Comidas propias</span>
              <strong>Hasta {currentPreset.limits.ownMeals}</strong>
              <small>Limite disponible por capabilities</small>
            </article>
          ) : null}
          <article>
            <span>Biblioteca</span>
            <strong>{libraryAccessLabel(currentPreset)}</strong>
            <small>{currentPreset.canUsePremiumLibrary ? "Incluye premium" : currentPreset.canUseGlobalLibrary ? "Incluye global" : "Acceso basico"}</small>
          </article>
          <article>
            <span>Tracking</span>
            <strong>{currentPreset.canTrack ? "Incluido" : "No disponible"}</strong>
            <small>Registro diario de consumo</small>
          </article>
        </div>
        {usageQuery.isError ? (
          <div className="cp-partial-error" role="status">
            <div>
              <strong>El plan cargo, pero no el conteo de menus.</strong>
              <p>
                Request secundaria: GET /api/clientes/me/menus?includeComidas=false&amp;limit=1.
                Status: {usageQuery.error?.status ?? "desconocido"}.
              </p>
            </div>
            <button type="button" onClick={() => usageQuery.refetch()}>
              Reintentar conteo
            </button>
          </div>
        ) : null}
      </section>

      <section className="cp-upgrade-note">
        <Sparkles size={18} aria-hidden="true" />
        <div>
          <strong>{canUpgrade ? "Mejora de plan" : "Gestion de plan VIP"}</strong>
          <p>
            {!hasPlan
              ? "El backend respondio capabilities sin un campo plan. La pantalla no asume un plan por defecto."
              : canUpgrade
              ? "Podes revisar Pro y VIP abajo. La activacion todavia no procesa pagos dentro de la app, pero dejamos clara la opcion para solicitar el cambio."
              : "Ya estas en el plan mas alto visible para clientes. La gestion de suscripcion todavia no esta disponible desde la app."}
          </p>
          <p className="cp-roadmap-copy">
            Menus automaticos: hoy no estan habilitados en Free, Pro ni VIP segun las capabilities reales del backend.
          </p>
        </div>
      </section>

      {requestedPlan ? (
        <section className="cp-upgrade-request" role="status" aria-live="polite">
          <div>
            <span className="cp-kicker">Solicitud de mejora</span>
            <h2>Te interesa pasar a {clientPlanLabel(requestedPlan)}</h2>
            <p>
              Esta app todavia no tiene checkout conectado. Dejo la seleccion visible para que el equipo ZumaFit pueda
              activar el cambio de plan desde administracion sin que pierdas tus datos.
            </p>
          </div>
          <button type="button" onClick={() => setRequestedPlan("")}>Cambiar eleccion</button>
        </section>
      ) : null}

      <section className="cp-section">
        <div className="cp-section-head">
          <div>
            <span className="cp-kicker">Comparacion</span>
            <h2>Planes ZumaFit</h2>
            <p className="cp-section-subtitle">Los planes superiores resaltan solo funciones o limites extra frente a tu plan actual.</p>
          </div>
        </div>

        <div className="cp-grid">
          {PLAN_ORDER.map((planId) => {
            const preset = PLAN_PRESETS[planId];
            const copy = planCopy(planId);
            const isCurrent = hasPlan && planId === plan;
            const isRecommended = planId === "pro";
            const planIndex = PLAN_ORDER.indexOf(planId);
            const isUpgrade = hasPlan && planIndex > currentPlanIndex;
            const highlights = isCurrent ? ["Tu plan actual"] : planUpgradeHighlights(planId, plan || "free");
            const details = planDetails(planId);
            const isExpanded = expandedPlanId === planId;
            return (
              <article
                key={planId}
                className={`cp-plan-card ${clientPlanTone(planId)} ${isCurrent ? "current" : ""}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                <div className="cp-plan-card-head">
                  <div>
                    <h3>{clientPlanLabel(planId)}</h3>
                    <p>{copy.library}</p>
                  </div>
                  <div className="cp-card-badges">
                    {isCurrent ? <PlanBadge tone={clientPlanTone(planId)}>Plan actual</PlanBadge> : null}
                    {isRecommended && !isCurrent ? <PlanBadge tone="pro">Recomendado</PlanBadge> : null}
                  </div>
                </div>

                {highlights.length ? (
                  <div className={`cp-plan-highlights ${isCurrent ? "current" : ""}`}>
                    {highlights.map((highlight) => (
                      <span key={highlight}>{highlight}</span>
                    ))}
                  </div>
                ) : null}

                <ul className="cp-feature-list">
                  {planFeatureRows(preset).map((feature) => (
                    <li key={feature.key} className={!feature.included || feature.muted ? "muted" : ""}>
                      {feature.included ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : (
                        <LockKeyhole size={16} aria-hidden="true" />
                      )}
                      <span>{feature.label}</span>
                      <strong>{feature.value}</strong>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="cp-details-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedPlanId(isExpanded ? "" : planId)}
                >
                  <span>Ver mas detalles</span>
                  {isExpanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
                </button>

                {isExpanded ? (
                  <div className="cp-plan-details">
                    <strong>{details.title}</strong>
                    <p>{details.description}</p>
                    <ul>
                      {details.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="cp-plan-card-foot">
                  {isCurrent ? (
                    <span className="cp-current-label">Estas usando {clientPlanLabel(planId)}</span>
                  ) : isUpgrade ? (
                    <button type="button" className="cp-upgrade-action" onClick={() => setRequestedPlan(planId)}>
                      Quiero pasarme a {clientPlanLabel(planId)}
                    </button>
                  ) : (
                    <span className="cp-disabled-action">Cambio no disponible desde la app</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
