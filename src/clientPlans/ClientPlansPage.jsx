import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Gift,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
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
  capabilitiesFromResolvedAccess,
  clientAccessContextKey,
  clientPlanCapabilitiesKey,
  clientPlanMenusUsageKey,
  createClientPlanChangeRequest,
  fetchClientPlanCapabilities,
  fetchClientPlanMenusUsage,
  startClientProTrial,
} from "./clientPlanQueries.js";
import { useClientAccessContext } from "./useClientAccessContext.js";
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

function formatPlanDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ClientPlansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const accessContextQuery = useClientAccessContext();
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    enabled: accessContextQuery.isError,
  });
  const accessCapabilities = capabilitiesFromResolvedAccess(accessContextQuery.data);
  const usageQuery = useQuery({
    queryKey: clientPlanMenusUsageKey,
    queryFn: fetchClientPlanMenusUsage,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    enabled: !!(accessCapabilities || capabilitiesQuery.data),
  });
  const startTrialMutation = useMutation({
    mutationFn: startClientProTrial,
    onSuccess: (accessContext) => {
      queryClient.setQueryData(clientAccessContextKey, accessContext);
      queryClient.invalidateQueries({ queryKey: clientPlanCapabilitiesKey });
      queryClient.invalidateQueries({ queryKey: clientPlanMenusUsageKey });
    },
  });
  const planRequestMutation = useMutation({
    mutationFn: createClientPlanChangeRequest,
    onSuccess: (data, planId) => {
      const requestPlan = data?.request?.requestedPlan || planId;
      setRequestedPlan(requestPlan);
      if (data?.accessContext) {
        queryClient.setQueryData(clientAccessContextKey, data.accessContext);
      }
      queryClient.invalidateQueries({ queryKey: clientPlanCapabilitiesKey });
    },
  });

  const waitingForAccessFallback =
    accessContextQuery.isLoading ||
    (accessContextQuery.isError && capabilitiesQuery.isLoading && !capabilitiesQuery.data);

  if (waitingForAccessFallback && !accessCapabilities && !capabilitiesQuery.data) return <Skeleton />;

  if (accessContextQuery.isError && capabilitiesQuery.isError && !capabilitiesQuery.data) {
    return (
      <section className="cp-page">
        <button type="button" className="cp-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} />
          Volver
        </button>
        <article className="cp-error">
          <strong>No pudimos cargar tu plan.</strong>
          <p>
            Fallo la consulta de contexto de acceso y tambien el fallback de capacidades. No vamos a asumir un plan si
            esas requests fallan. Status: {accessContextQuery.error?.status ?? capabilitiesQuery.error?.status ?? "desconocido"}.
          </p>
          <button
            type="button"
            onClick={() => {
              accessContextQuery.refetch();
              capabilitiesQuery.refetch();
            }}
          >
            Reintentar
          </button>
        </article>
      </section>
    );
  }

  const accessContext = accessContextQuery.data || null;
  const capabilities = accessCapabilities || capabilitiesQuery.data;
  const usageCapabilities = usageQuery.data?.capabilities || capabilities;
  const rawPlan = capabilities?.effectivePersonalPlan || capabilities?.plan;
  const hasPlan = Boolean(rawPlan);
  const plan = hasPlan ? normalizeClientPlan(accessContext?.effectivePersonalPlan || planFromCapabilities(user, capabilities)) : "";
  const personalPlan = normalizeClientPlan(accessContext?.personalPlan || capabilities?.personalPlan || plan || user?.plan);
  const tone = hasPlan ? clientPlanTone(plan) : "free";
  const usage = menusUsageFromResponse(usageQuery.data, usageCapabilities);
  const usageKnown = usage.used !== null && usage.used !== undefined && Number.isFinite(Number(usage.used));
  const usageLoading = usageQuery.isLoading || usageQuery.isFetching;
  const canUpgrade = hasPlan && normalizeClientPlan(plan) !== "vip";
  const currentPreset = capabilities;
  const currentPlanIndex = hasPlan ? PLAN_ORDER.indexOf(plan) : -1;
  const effectiveAccess = accessContext?.effectiveAccess || accessContext?.primaryAccess || null;
  const isCoachAccess = Boolean(
    effectiveAccess?.id === "service_pro" ||
    effectiveAccess?.id === "service_vip" ||
    accessContext?.mode === "coach" ||
    accessContext?.hasCoach
  );
  const currentCopy = hasPlan
    ? isCoachAccess
      ? {
          eyebrow: "Acompanamiento profesional",
          title: `${effectiveAccess?.label || accessContext?.primaryAccess?.label || "Coach Pro"} activo`,
          summary: "Tu menu, rutina y objetivos principales quedan bajo autoridad profesional. Tu plan personal se conserva para cuando termine el acompanamiento.",
        }
      : planCopy(plan)
    : null;
  const trial = accessContext?.trial || null;
  const trialOffer = accessContext?.trialOffer || null;
  const fallbackCanAttemptTrial =
    !accessContext &&
    !!capabilitiesQuery.data &&
    normalizeClientPlan(capabilities?.plan) === "free" &&
    !capabilities?.hasCoach;
  const canStartTrial = Boolean(
    trialOffer?.eligible ?? ((trial?.status === "available" && !accessContext?.hasCoach) || fallbackCanAttemptTrial)
  );
  const pendingRequest = accessContext?.planChangeRequests?.pending || null;
  const pendingRequestedPlan = normalizeClientPlan(pendingRequest?.requestedPlan || requestedPlan || "");
  const pendingProRequest = pendingRequestedPlan === "pro";
  const personalCatalog = accessContext?.catalogs?.personalPlans || {};
  const serviceCatalog = accessContext?.catalogs?.professionalServices || {};
  const isAccessFallback = !accessContext && !!capabilitiesQuery.data;

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
            {isCoachAccess ? (
              <PlanBadge tone="coach">Acceso principal {effectiveAccess?.label || "Coach Pro"}</PlanBadge>
            ) : hasPlan ? (
              <PlanBadge tone={tone}>Plan efectivo {clientPlanLabel(plan)}</PlanBadge>
            ) : (
              <PlanBadge>Plan desconocido</PlanBadge>
            )}
            {hasPlan ? <PlanBadge tone={clientPlanTone(personalPlan)}>Plan personal {clientPlanLabel(personalPlan)}</PlanBadge> : null}
            {trial?.active ? <PlanBadge tone="pro">Prueba Pro: {trial.daysRemaining ?? trial.daysLeft} dias</PlanBadge> : null}
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
          <span>{isCoachAccess ? "Servicio activo" : trial?.active ? "Prueba activa" : "Plan actual"}</span>
          <strong>{isCoachAccess ? (effectiveAccess?.label || "Coach") : hasPlan ? clientPlanLabel(plan) : "?"}</strong>
        </div>
      </header>

      {isCoachAccess ? (
        <section className="cp-coach-state">
          <div>
            <span className="cp-kicker">
              <UserRoundCheck size={15} />
              Coach como autoridad
            </span>
            <h2>{effectiveAccess?.label || "Coach Pro"} es tu acceso principal</h2>
            <p>
              El servicio se acuerda y paga con el profesional. ZumaFit conserva tu plan personal como retorno si el
              acompanamiento termina.
            </p>
          </div>
          <div className="cp-coach-state-meta">
            <span>Billing</span>
            <strong>{accessContext?.billing?.owner === "coach" ? "Financiado por coach" : "Personal"}</strong>
            <small>{accessContext?.coachAccess?.startedAt ? `Activo desde ${new Date(accessContext.coachAccess.startedAt).toLocaleDateString("es-AR")}` : "Pendiente de fecha"}</small>
          </div>
        </section>
      ) : null}

      {isAccessFallback ? (
        <section className="cp-partial-error" role="status">
          <div>
            <strong>Usando fallback de capabilities.</strong>
            <p>El backend todavia no devolvio access-context en esta sesion. La pantalla queda operativa con datos reducidos.</p>
          </div>
          <button type="button" onClick={() => accessContextQuery.refetch()}>
            Reintentar contexto
          </button>
        </section>
      ) : null}

      {canStartTrial ? (
        <section className="cp-trial-card featured">
          <div className="cp-trial-icon">
            <Gift size={21} />
          </div>
          <div>
            <span className="cp-kicker">14 dias gratis</span>
            <h2>Proba ZumaFit Pro</h2>
            <p>
              Desbloquea durante 14 dias menus semanales, mas capacidad, biblioteca global, equivalencias y progreso avanzado.
              Sin cambiar tu plan personal Free y sin cobro automatico.
            </p>
            <div className="cp-trial-benefits" aria-label="Beneficios principales de la prueba Pro">
              <span>Menus semanales</span>
              <span>Biblioteca global</span>
              <span>Mas capacidad</span>
              <span>Historial completo</span>
            </div>
            {startTrialMutation.isError ? (
              <small className="cp-inline-error">{startTrialMutation.error?.error || startTrialMutation.error?.message}</small>
            ) : null}
          </div>
          <div className="cp-trial-actions">
            <button
              type="button"
              onClick={() => startTrialMutation.mutate()}
              disabled={startTrialMutation.isPending}
            >
              {startTrialMutation.isPending ? "Activando..." : "Activar prueba Pro"}
            </button>
            <button type="button" className="ghost" onClick={() => setExpandedPlanId("pro")}>
              Ver beneficios Pro
            </button>
          </div>
          <small className="cp-trial-note">Al terminar, volves automaticamente a Free. Tus datos quedan guardados.</small>
        </section>
      ) : null}

      {trial?.active ? (
        <section className="cp-trial-active-card">
          <div>
            <span className="cp-kicker">Prueba Pro activa</span>
            <h2>Te quedan {trial.daysRemaining ?? trial.daysLeft ?? 0} dias</h2>
            <p>Finaliza el {formatPlanDate(trial.endsAt) || "dia indicado por el servidor"}.</p>
          </div>
          <button type="button" onClick={() => setExpandedPlanId("pro")}>
            Ver funciones Pro
          </button>
        </section>
      ) : null}

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
          {Number.isFinite(Number(currentPreset?.limits?.favorites)) ? (
            <article>
              <span>Favoritos</span>
              <strong>Hasta {currentPreset.limits.favorites}</strong>
              <small>Comidas y menus destacados</small>
            </article>
          ) : null}
          <article>
            <span>Biblioteca</span>
            <strong>{libraryAccessLabel(currentPreset)}</strong>
            <small>{currentPreset.canUsePremiumLibrary ? "Incluye premium" : currentPreset.canUseGlobalLibrary ? "Incluye global" : "Acceso basico"}</small>
          </article>
          <article>
            <span>Historial tracking</span>
            <strong>{currentPreset?.limits?.trackingHistoryDays ? `${currentPreset.limits.trackingHistoryDays} dias` : "Completo"}</strong>
            <small>{currentPreset.canTrack ? "Registro diario incluido" : "Tracking no disponible"}</small>
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
              : canStartTrial
              ? "Todavia podes probar Pro gratis durante 14 dias. Si no activas la prueba, seguis usando Free normalmente."
              : canUpgrade
              ? "Podes revisar Pro y VIP abajo. Como no hay checkout, el cambio genera una solicitud manual para administracion."
              : "Ya estas en el plan mas alto visible para clientes. La gestion de suscripcion todavia no esta disponible desde la app."}
          </p>
          <p className="cp-roadmap-copy">
            AutoCoach, menus automaticos y rutinas automaticas quedan modelados como capacidades: cuando no hay algoritmo real,
            se muestran como proximamente o con revision requerida.
          </p>
        </div>
      </section>

      {pendingRequest || requestedPlan ? (
        <section className="cp-upgrade-request" role="status" aria-live="polite">
          <div>
            <span className="cp-kicker">{pendingRequest ? "Solicitud pendiente" : "Solicitud de mejora"}</span>
            <h2>{pendingRequest ? `Solicitud ${clientPlanLabel(pendingRequestedPlan)} pendiente` : `Te interesa pasar a ${clientPlanLabel(requestedPlan)}`}</h2>
            <p>
              {pendingRequest
                ? "Administracion ya tiene tu pedido. No se proceso ningun pago ni se cambio tu plan automaticamente."
                : "Guardamos una solicitud manual. No se proceso ningun pago desde la app; el equipo ZumaFit puede continuar la activacion desde administracion sin que pierdas tus datos."}
            </p>
          </div>
          {!pendingRequest ? <button type="button" onClick={() => setRequestedPlan("")}>Cambiar eleccion</button> : null}
        </section>
      ) : null}

      {planRequestMutation.isError ? (
        <section className="cp-partial-error" role="alert">
          <div>
            <strong>No pudimos registrar la solicitud.</strong>
            <p>{planRequestMutation.error?.error || planRequestMutation.error?.message}</p>
          </div>
          <button type="button" onClick={() => planRequestMutation.reset()}>
            Cerrar
          </button>
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
            const preset = {
              ...PLAN_PRESETS[planId],
              ...(personalCatalog[planId]
                ? {
                    limits: {
                      ...PLAN_PRESETS[planId].limits,
                      ...personalCatalog[planId].limits,
                    },
                  }
                : {}),
            };
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
                  ) : canStartTrial && planId === "pro" ? (
                    <button
                      type="button"
                      className="cp-upgrade-action"
                      onClick={() => startTrialMutation.mutate()}
                      disabled={startTrialMutation.isPending}
                    >
                      {startTrialMutation.isPending ? "Activando prueba..." : "Activar prueba Pro"}
                    </button>
                  ) : pendingProRequest && planId === "pro" ? (
                    <span className="cp-current-label pending">Solicitud Pro pendiente</span>
                  ) : isUpgrade ? (
                    <button
                      type="button"
                      className="cp-upgrade-action"
                      onClick={() => planRequestMutation.mutate(planId)}
                      disabled={planRequestMutation.isPending}
                    >
                      {planRequestMutation.isPending ? "Enviando solicitud..." : `Solicitar plan ${clientPlanLabel(planId)}`}
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

      <section className="cp-section">
        <div className="cp-section-head">
          <div>
            <span className="cp-kicker">
              <BriefcaseBusiness size={15} />
              Acompanamiento profesional
            </span>
            <h2>Servicios con coach</h2>
            <p className="cp-section-subtitle">
              Estos paquetes no son una renovacion personal de ZumaFit. El cliente paga al profesional y el coach sostiene
              su licencia en ZumaFit.
            </p>
          </div>
        </div>

        <div className="cp-service-grid">
          {["service_pro", "service_vip"].map((serviceId) => {
            const service = serviceCatalog[serviceId] || {
              id: serviceId,
              label: serviceId === "service_vip" ? "Coach VIP" : "Coach Pro",
              library: serviceId === "service_vip" ? "premium" : "global",
            };
            const isCurrentService = accessContext?.primaryAccess?.id === serviceId;
            return (
              <article key={serviceId} className={`cp-service-card ${serviceId} ${isCurrentService ? "current" : ""}`}>
                <div className="cp-service-icon">
                  <UserRoundCheck size={22} />
                </div>
                <div>
                  <div className="cp-plan-card-head">
                    <div>
                      <h3>{service.label}</h3>
                      <p>{serviceId === "service_vip" ? "Seguimiento premium supervisado" : "Seguimiento profesional"}</p>
                    </div>
                    {isCurrentService ? <PlanBadge tone="coach">Activo</PlanBadge> : null}
                  </div>
                  <ul className="cp-feature-list compact">
                    <li>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>Menu, rutina y objetivos con autoridad del coach</span>
                      <strong>Incluido</strong>
                    </li>
                    <li>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>Biblioteca ZumaFit</span>
                      <strong>{service.library === "premium" ? "Premium" : "Global"}</strong>
                    </li>
                    <li>
                      {serviceId === "service_vip" ? <CheckCircle2 size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
                      <span>Analisis automatico supervisado</span>
                      <strong>{serviceId === "service_vip" ? "Coach IA" : "No incluido"}</strong>
                    </li>
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
