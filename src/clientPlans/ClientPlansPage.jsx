import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Crown,
  Gift,
  LockKeyhole,
  Sparkles,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
import {
  clientPlanLabel,
  clientPlanTone,
  clientTypeLabel,
  menusUsageFromResponse,
  normalizeClientPlan,
  PLAN_ORDER,
  PLAN_PRESETS,
  planCopy,
  planDetails,
  planFromCapabilities,
  usageText,
} from "./clientPlanUtils.js";
import {
  CLIENT_PLAN_CAPABILITIES_STALE_TIME,
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

function formatLimit(value, singular, plural = `${singular}s`) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `Sin limite de ${plural}`;
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function libraryBenefit(capabilities = {}) {
  if (capabilities.canUsePremiumLibrary) return "Biblioteca premium";
  if (capabilities.canUseGlobalLibrary) return "Biblioteca global";
  if (capabilities.canUseBasicLibrary) return "Biblioteca basica";
  return "Biblioteca no disponible";
}

function primaryPlanBenefits(planId = "free", capabilities = {}) {
  const limits = capabilities?.limits || {};
  if (planId === "vip") {
    return [
      `Hasta ${formatLimit(limits.ownMenus, "menu", "menus")}`,
      `Hasta ${formatLimit(limits.ownMeals, "comida guardada", "comidas guardadas")}`,
      `Hasta ${formatLimit(limits.favorites, "favorito", "favoritos")}`,
      libraryBenefit(capabilities),
    ];
  }
  if (planId === "pro") {
    return [
      `Hasta ${formatLimit(limits.ownMenus, "menu", "menus")}`,
      `Hasta ${formatLimit(limits.menuDays, "dia", "dias")} por menu`,
      `Hasta ${formatLimit(limits.ownMeals, "comida guardada", "comidas guardadas")}`,
      libraryBenefit(capabilities),
    ];
  }
  return [
    "Tracking diario",
    `Hasta ${formatLimit(limits.ownMenus, "menu propio", "menus propios")}`,
    `Hasta ${formatLimit(limits.ownMeals, "comida guardada", "comidas guardadas")}`,
    libraryBenefit(capabilities),
  ];
}

function comingSoonCopy(planId = "free", capabilities = {}) {
  const comingSoon = [
    capabilities.automaticMenusStatus === "coming_soon" ? "menus automaticos" : "",
    capabilities.automaticRoutineStatus === "coming_soon" ? "rutinas automaticas" : "",
    capabilities.autoCoachNutrition === "coming_soon" ? "AutoCoach nutricional" : "",
    capabilities.autoCoachTraining === "coming_soon" ? "AutoCoach entrenamiento" : "",
  ].filter(Boolean);
  if (!comingSoon.length) return "";
  if (planId === "vip") return "AutoCoach avanzado y automatizaciones supervisadas";
  return "AutoCoach y automatizaciones";
}

function buildPlanDetailGroups(planId = "free", capabilities = {}) {
  const limits = capabilities?.limits || {};
  const ownMenus = Number(limits.ownMenus);
  const ownMeals = Number(limits.ownMeals);
  const favorites = Number(limits.favorites);
  const menuDays = Number(limits.menuDays);
  const automaticMenuSoon = capabilities.automaticMenusStatus === "coming_soon";
  const automaticRoutineSoon = capabilities.automaticRoutineStatus === "coming_soon";
  const autoCoachNutritionSoon = capabilities.autoCoachNutrition === "coming_soon";
  const autoCoachTrainingSoon = capabilities.autoCoachTraining === "coming_soon";

  return [
    {
      title: "Nutricion",
      items: [
        { text: "Tracking diario", state: capabilities.canTrack ? "included" : "blocked" },
        { text: Number.isFinite(ownMenus) ? formatLimit(ownMenus, "menu propio", "menus propios") : "Menus propios", state: ownMenus > 0 ? "included" : "blocked" },
        { text: Number.isFinite(menuDays) ? `${formatLimit(menuDays, "dia", "dias")} por menu` : "Menu semanal", state: menuDays > 0 ? "included" : "blocked" },
        { text: Number.isFinite(ownMeals) ? formatLimit(ownMeals, "comida guardada", "comidas guardadas") : "Comidas guardadas", state: ownMeals > 0 ? "included" : "blocked" },
      ],
    },
    {
      title: "Biblioteca",
      items: [
        { text: "Biblioteca basica", state: capabilities.canUseBasicLibrary ? "included" : "blocked" },
        { text: "Biblioteca global", state: capabilities.canUseGlobalLibrary ? "included" : "blocked" },
        { text: "Biblioteca premium", state: capabilities.canUsePremiumLibrary ? "included" : "blocked" },
        { text: Number.isFinite(favorites) ? formatLimit(favorites, "favorito", "favoritos") : "Favoritos", state: favorites > 0 ? "included" : "blocked" },
      ],
    },
    {
      title: "Entrenamiento",
      items: [
        { text: "Registro manual de rutinas", state: "included" },
        { text: "Rutinas automaticas", state: automaticRoutineSoon ? "soon" : capabilities.canGenerateAutomaticRoutine ? "included" : "blocked" },
      ],
    },
    {
      title: "Progreso",
      items: [
        { text: limits.trackingHistoryDays ? `${limits.trackingHistoryDays} dias de historial` : "Historial completo", state: "included" },
        { text: "Medidas y fotos de progreso", state: "included" },
      ],
    },
    {
      title: "Proximamente",
      items: [
        { text: "Menus automaticos", state: automaticMenuSoon ? "soon" : capabilities.canGenerateAutomaticMenu ? "included" : "blocked" },
        { text: "AutoCoach nutricional", state: autoCoachNutritionSoon ? "soon" : capabilities.autoCoachNutrition !== "manual" ? "included" : "blocked" },
        { text: planId === "vip" ? "AutoCoach entrenamiento avanzado" : "AutoCoach entrenamiento", state: autoCoachTrainingSoon ? "soon" : capabilities.autoCoachTraining !== "manual" ? "included" : "blocked" },
      ],
    },
  ];
}

function DetailIcon({ state }) {
  if (state === "included") return <CheckCircle2 size={15} aria-hidden="true" />;
  if (state === "soon") return <Sparkles size={15} aria-hidden="true" />;
  return <LockKeyhole size={15} aria-hidden="true" />;
}

export default function ClientPlansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requestedPlan, setRequestedPlan] = useState("");
  const [selectedComparisonPlan, setSelectedComparisonPlan] = useState("");
  const [detailsPlanId, setDetailsPlanId] = useState("");
  const detailsDialogRef = useRef(null);
  const detailsTriggerRef = useRef(null);
  const cachedUser = useMemo(() => getCachedUser(), []);
  const meQuery = useAuthMe({
    enabled: true,
    initialFromCache: true,
    staleTime: 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const user = meQuery.data || cachedUser || {};
  const accessContextQuery = useClientAccessContext();
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: CLIENT_PLAN_CAPABILITIES_STALE_TIME,
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

  const closePlanDetails = () => {
    setDetailsPlanId("");
    window.setTimeout(() => detailsTriggerRef.current?.focus?.(), 0);
  };

  const openPlanDetails = (planId, event) => {
    detailsTriggerRef.current = event?.currentTarget || null;
    setDetailsPlanId(planId);
  };

  useEffect(() => {
    if (!detailsPlanId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      detailsDialogRef.current?.querySelector("button")?.focus?.();
    }, 0);
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setDetailsPlanId("");
        window.setTimeout(() => detailsTriggerRef.current?.focus?.(), 0);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [detailsPlanId]);

  const handleDetailsKeyDown = (event) => {
    if (event.key !== "Tab") return;
    const focusable = detailsDialogRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
  const planPresets = PLAN_ORDER.reduce((acc, planId) => {
    acc[planId] = {
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
    return acc;
  }, {});
  const defaultComparisonPlan = hasPlan ? (plan === "free" ? "pro" : plan === "pro" ? "vip" : "vip") : "pro";
  const activeComparisonPlan = PLAN_ORDER.includes(selectedComparisonPlan)
    ? selectedComparisonPlan
    : defaultComparisonPlan;
  const detailsPlan = PLAN_ORDER.includes(detailsPlanId) ? detailsPlanId : "";
  const detailsPreset = detailsPlan ? planPresets[detailsPlan] : null;
  const detailsCopy = detailsPlan ? planDetails(detailsPlan) : null;
  const detailsGroups = detailsPreset ? buildPlanDetailGroups(detailsPlan, detailsPreset) : [];

  const renderPlanAction = (planId) => {
    const planIndex = PLAN_ORDER.indexOf(planId);
    const isCurrent = hasPlan && planId === plan;
    const isUpgrade = hasPlan && planIndex > currentPlanIndex;
    if (isCurrent) return <span className="cp-current-label">Plan actual</span>;
    if (trial?.active && planId === "pro") return <span className="cp-current-label pending">Prueba Pro activa</span>;
    if (canStartTrial && planId === "pro") {
      return (
        <button
          type="button"
          className="cp-upgrade-action"
          onClick={() => startTrialMutation.mutate()}
          disabled={startTrialMutation.isPending}
        >
          {startTrialMutation.isPending ? "Activando prueba..." : "Activar prueba Pro"}
        </button>
      );
    }
    if (pendingProRequest && planId === "pro") {
      return <span className="cp-current-label pending">Solicitud Pro pendiente</span>;
    }
    if (isUpgrade) {
      return (
        <button
          type="button"
          className="cp-upgrade-action"
          onClick={() => planRequestMutation.mutate(planId)}
          disabled={planRequestMutation.isPending}
        >
          {planRequestMutation.isPending ? "Enviando solicitud..." : `Solicitar ${clientPlanLabel(planId)}`}
        </button>
      );
    }
    return <span className="cp-disabled-action">Cambio no disponible desde la app</span>;
  };

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
            Tu plan actual
          </span>
          <h1>{hasPlan ? clientPlanLabel(plan) : "Plan no disponible"}</h1>
          <p>
            {hasPlan
              ? currentCopy.summary
              : "Conoce que incluye tu plan y que funciones podes desbloquear cuando el flujo de mejora este disponible."}
          </p>
          <div className="cp-badge-row">
            {hasPlan ? <PlanBadge tone={tone}>En uso</PlanBadge> : <PlanBadge>Plan desconocido</PlanBadge>}
            {capabilities?.hasCoach ? <PlanBadge tone="coach">{clientTypeLabel(user, capabilities)}</PlanBadge> : null}
            {isCoachAccess ? <PlanBadge tone="coach">Acceso principal {effectiveAccess?.label || "Coach Pro"}</PlanBadge> : null}
            {isCoachAccess && hasPlan ? <PlanBadge tone={clientPlanTone(personalPlan)}>Plan personal {clientPlanLabel(personalPlan)}</PlanBadge> : null}
            {trial?.active ? <PlanBadge tone="pro">Prueba Pro: {trial.daysRemaining ?? trial.daysLeft} dias</PlanBadge> : null}
          </div>
          {hasPlan ? (
            <div className="cp-current-stats" aria-label="Resumen rapido del plan actual">
              <article>
                <span>Menus</span>
                <strong>{usageKnown ? usageText(usage) : usageLoading ? "..." : "No disp."}</strong>
              </article>
              <article>
                <span>Comidas</span>
                <strong>{Number.isFinite(Number(currentPreset?.limits?.ownMeals)) ? `Hasta ${currentPreset.limits.ownMeals}` : "-"}</strong>
              </article>
              <article>
                <span>Favoritos</span>
                <strong>{Number.isFinite(Number(currentPreset?.limits?.favorites)) ? `Hasta ${currentPreset.limits.favorites}` : "-"}</strong>
              </article>
              <article>
                <span>Historial</span>
                <strong>{currentPreset?.limits?.trackingHistoryDays ? `${currentPreset.limits.trackingHistoryDays} dias` : "Completo"}</strong>
              </article>
            </div>
          ) : null}
          {hasPlan ? <span className="cp-current-status">Estas usando este plan</span> : null}
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
            <strong>Informacion de contexto limitada.</strong>
            <p>Podemos mostrar tu plan, pero faltan algunos datos secundarios de esta sesion.</p>
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
            <button type="button" className="ghost" onClick={(event) => openPlanDetails("pro", event)}>
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
          <button type="button" onClick={(event) => openPlanDetails("pro", event)}>
            Ver funciones Pro
          </button>
        </section>
      ) : null}

      {usageQuery.isError ? (
        <section className="cp-partial-error" role="status">
          <div>
            <strong>El plan cargo, pero no el conteo de menus.</strong>
            <p>Menus utilizados: no disponible. Status: {usageQuery.error?.status ?? "desconocido"}.</p>
          </div>
          <button type="button" onClick={() => usageQuery.refetch()}>
            Reintentar conteo
          </button>
        </section>
      ) : null}

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
            <span className="cp-kicker">Mejora tu plan</span>
            <h2>Compara Free, Pro y VIP</h2>
            <p className="cp-section-subtitle">Elegis un plan para leerlo comodo en mobile. En desktop ves la comparacion completa.</p>
          </div>
        </div>

        <div className="cp-plan-tabs" role="tablist" aria-label="Seleccionar plan para comparar">
          {PLAN_ORDER.map((planId) => (
            <button
              key={planId}
              type="button"
              role="tab"
              aria-selected={activeComparisonPlan === planId}
              aria-controls={`plan-card-${planId}`}
              className={activeComparisonPlan === planId ? "active" : ""}
              onClick={() => setSelectedComparisonPlan(planId)}
            >
              {clientPlanLabel(planId)}
            </button>
          ))}
        </div>

        <div className="cp-grid cp-plan-grid">
          {PLAN_ORDER.map((planId) => {
            const preset = planPresets[planId];
            const copy = planCopy(planId);
            const isCurrent = hasPlan && planId === plan;
            const isRecommended = planId === "pro";
            const primaryBenefits = primaryPlanBenefits(planId, preset);
            const soonText = comingSoonCopy(planId, preset);
            return (
              <article
                key={planId}
                id={`plan-card-${planId}`}
                className={`cp-plan-card ${clientPlanTone(planId)} ${isCurrent ? "current" : ""} ${activeComparisonPlan === planId ? "selected" : ""}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                <div className="cp-plan-card-head">
                  <div>
                    <h3>{clientPlanLabel(planId)}</h3>
                    <p>{copy.summary}</p>
                  </div>
                  <div className="cp-card-badges">
                    {isCurrent ? <PlanBadge tone={clientPlanTone(planId)}>Actual</PlanBadge> : null}
                    {isRecommended && !isCurrent ? <PlanBadge tone="pro">Recomendado</PlanBadge> : null}
                  </div>
                </div>

                <ul className="cp-feature-list">
                  {primaryBenefits.map((benefit) => (
                    <li key={benefit}>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                {soonText ? (
                  <div className="cp-coming-soon">
                    <span>Proximamente</span>
                    <strong>{soonText}</strong>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="cp-details-toggle"
                  onClick={(event) => openPlanDetails(planId, event)}
                >
                  <span>Ver todos los beneficios</span>
                  <ChevronDown size={17} aria-hidden="true" />
                </button>

                <div className="cp-plan-card-foot">{renderPlanAction(planId)}</div>
              </article>
            );
          })}
        </div>
      </section>

      {detailsPlan ? (
        <div className="cp-details-backdrop" role="presentation" onMouseDown={closePlanDetails}>
          <section
            ref={detailsDialogRef}
            className="cp-details-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-details-title"
            onKeyDown={handleDetailsKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="cp-details-dialog-head">
              <div>
                <span className="cp-kicker">Todo lo que incluye</span>
                <h2 id="cp-details-title">{clientPlanLabel(detailsPlan)}</h2>
                <p>{detailsCopy?.description}</p>
              </div>
              <button type="button" className="cp-details-close" onClick={closePlanDetails} aria-label="Cerrar detalles">
                <X size={20} />
              </button>
            </header>

            <div className="cp-details-group-list">
              {detailsGroups.map((group) => (
                <article key={group.title} className="cp-details-group">
                  <h3>{group.title}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={`${group.title}-${item.text}`} className={item.state}>
                        <DetailIcon state={item.state} />
                        <span>{item.text}</span>
                        {item.state === "soon" ? <strong>Proximamente</strong> : null}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <footer className="cp-details-dialog-foot">{renderPlanAction(detailsPlan)}</footer>
          </section>
        </div>
      ) : null}

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
