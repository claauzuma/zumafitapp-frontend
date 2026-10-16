import React, { useMemo, useState } from "react";
import { ArrowLeft,X, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronUp, Crown, Edit3, Info, Loader2, Moon, RefreshCw, SlidersHorizontal, Sparkles, Sun, Target, Utensils } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
import { normalizeGoalFromUser } from "../clientNutrition/nutritionState.js";
import AppToast from "../ui/AppToast.jsx";
import ClientMenusPanel from "./ClientMenusPanel.jsx";
import ClientMenuGenerator from "./ClientMenuGenerator.jsx";
import { authorizeClientMenuGeneration, createClientMenu } from "./clientMenusApi.js";
import { generateClientMenuPreview } from "./clientMenuGeneration.js";
import { MEAL_NUTRITION_POLICY } from "../nutricion/mealNutritionResult.js";
import {
  buildGeneratedMenuActivationPayload,
  generatedMenuReviewPresentation,
  generatedMenuTotals,
} from "./clientMenuPreview.js";
import { buildAutonomousMenuGenerationRequest, MENU_GENERATION_MODE_SIMILAR } from "../entrenado/menu/menuQuickActions.js";
import { getTrackingDay } from "../tracking/trackingApi.js";
import { trackingDayRevision } from "../tracking/trackingDayRevision.js";
import "../nutritionLibrary/nutritionLibrary.css";

function safeReturnPath(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("/app/") || text === "/app/menu/nuevo") return "/app/menu";
  return text;
}

const WIZARD_DAYS = [
  ["monday", "Lun"],
  ["tuesday", "Mar"],
  ["wednesday", "Mié"],
  ["thursday", "Jue"],
  ["friday", "Vie"],
  ["saturday", "Sáb"],
  ["sunday", "Dom"],
];

function localIsoDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekdayKeyFromIso(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return WIZARD_DAYS[0][0];
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const mondayIndex = (date.getDay() + 6) % 7;
  return WIZARD_DAYS[mondayIndex][0];
}

function planMetaFromUser(user = {}) {
  const capabilities = user?.nutritionCapabilities || {};
  const raw = String(capabilities.plan || user?.plan || "free").toLowerCase();
  const key = raw === "premium2" || raw === "vip" ? "vip" : raw === "premium" || raw === "pro" ? "pro" : "free";
  const explicitLimit = Number(capabilities?.limits?.menuDays);
  return {
    key,
    label: key === "vip" ? "VIP" : key === "pro" ? "Pro" : "Free",
    dayLimit: Number.isFinite(explicitLimit) && explicitLimit > 0 ? Math.min(7, explicitLimit) : key === "free" ? 1 : 7,
  };
}

function targetForWizard(user = {}, override = null) {
  if (override?.kcal) return {
    kcal: Number(override.kcal) || 0,
    proteina: Number(override.proteina ?? override.p) || 0,
    carbs: Number(override.carbs ?? override.c) || 0,
    grasas: Number(override.grasas ?? override.g) || 0,
  };
  const normalized = normalizeGoalFromUser(user);
  return normalized.configured ? {
    kcal: Number(normalized.kcal) || 0,
    proteina: Number(normalized.p) || 0,
    carbs: Number(normalized.c) || 0,
    grasas: Number(normalized.g) || 0,
  } : null;
}

function targetLine(target = null) {
  if (!target?.kcal) return "Objetivo diario pendiente";
  return `${Math.round(target.kcal).toLocaleString("es-AR")} kcal · P${Math.round(target.proteina || 0)} · C${Math.round(target.carbs || 0)} · G${Math.round(target.grasas || 0)}`;
}

function signedDifference(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("es-AR", { maximumFractionDigits: 1 })}`;
}

export default function ClientMenuCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState(null);
  const [generatedDraft, setGeneratedDraft] = useState(() => location.state?.generatedDraft || null);
  const [generationRevision, setGenerationRevision] = useState(0);
  const [regeneratingMeal, setRegeneratingMeal] = useState(null);
  const [regenerationError, setRegenerationError] = useState("");
  const [editingGenerated, setEditingGenerated] = useState(false);


  const [expandedReviewMeals, setExpandedReviewMeals] = useState([]);


  const [usingGenerated, setUsingGenerated] = useState(false);
  const [manualMealCount, setManualMealCount] = useState(null);
  const [manualSetup, setManualSetup] = useState(null);
  const cachedUser = useMemo(() => getCachedUser(), []);
  const authQuery = useAuthMe({
    enabled: true,
    initialFromCache: true,
    staleTime: 30 * 1000,
    refetchOnMount: false,
  });
  const user = authQuery.data || cachedUser || {};
  const returnTo = safeReturnPath(location.state?.from);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(location.state?.selectedDate || ""))
    ? String(location.state.selectedDate)
    : "";
  const dailyTarget = location.state?.dailyTarget || null;
  const wizardTarget = targetForWizard(user, dailyTarget);
  const generationSettings = location.state?.generationSettings || null;
  const activeMenuComparison = location.state?.activeMenuComparison || null;
  const generatedTotals = useMemo(() => generatedMenuTotals(generatedDraft), [generatedDraft]);
  const generatedComparison = activeMenuComparison?.current && generatedDraft
    ? { current: activeMenuComparison.current, proposed: generatedTotals }
    : activeMenuComparison;
  const editMenuId = location.state?.editMenuId || location.state?.menuId || "";
  const editMenuRequest = editMenuId
    ? {
        id: editMenuId,
        token: location.state?.editToken || `${editMenuId}-route`,
        focusName: location.state?.focus === "name",
      }
    : null;
  const generationMode = searchParams.get("mode") === "generate" && !generatedDraft && !editMenuRequest;
  const mealCountStep = !generationMode && !generatedDraft && !editMenuRequest && !manualMealCount;
  const setupStep = !generationMode && !generatedDraft && !editMenuRequest && !!manualMealCount && !manualSetup;

  function openManualCreator() {
    const next = new URLSearchParams(searchParams);
    next.delete("mode");
    setSearchParams(next, { replace: true });
  }

  async function regeneratePreview(mealIndex = null) {
    if (!generationSettings || !generatedDraft || regeneratingMeal !== null) return;
    setRegeneratingMeal(mealIndex === null ? "all" : mealIndex);
    setRegenerationError("");
    try {
      const expectedTrackingRevision = generatedDraft?.generationMeta?.trackingRevision;
      const draftDate = selectedDate || generatedDraft?.fechaInicio;
      if (expectedTrackingRevision && draftDate) {
        const currentTrackingDay = await getTrackingDay(draftDate);
        if (trackingDayRevision(currentTrackingDay) !== expectedTrackingRevision) {
          throw new Error("Tracking cambió. Volvé al Menú y generá una propuesta actualizada.");
        }
      }
      const authorization = await authorizeClientMenuGeneration();
      if (authorization?.policy !== MEAL_NUTRITION_POLICY || authorization?.previewOnly !== true) {
        throw new Error("El servidor no autorizó una vista previa segura.");
      }
      const request = buildAutonomousMenuGenerationRequest({
        settings: generationSettings,
        target: wizardTarget || dailyTarget || generatedDraft.menuTarget,
        selectedDate: selectedDate || generatedDraft.fechaInicio,
        name: generatedDraft.nombre,
      });
      const trace = Array.isArray(generatedDraft?.generationMeta?.trace)
        ? generatedDraft.generationMeta.trace
        : [];
      const preservedIndexes = new Set(
        trace.filter((entry) => entry?.status === "preserved").map((entry) => Number(entry.slotIndex))
      );
      const selectedSlotIndex = mealIndex === null
        ? null
        : Number(generatedDraft.comidas?.[mealIndex]?.plannerSlotIndex ?? mealIndex);
      if (selectedSlotIndex !== null && preservedIndexes.has(selectedSlotIndex)) {
        throw new Error("Esta comida ya estaba planificada y se conserva intacta.");
      }
      // Regenerar todo conserva sólo las comidas originales. Regenerar una
      // comida conserva además las anteriores y recalcula ésta + posteriores,
      // de modo que el residual nutricional vuelva a cerrar el día.
      const plannedMeals = (generatedDraft.comidas || []).filter((meal, index) => (
        preservedIndexes.has(Number(meal?.plannerSlotIndex ?? index))
        || (selectedSlotIndex !== null && Number(meal?.plannerSlotIndex ?? index) < selectedSlotIndex)
      ));
      const preview = await generateClientMenuPreview({
        ...request,
        plannedMeals,
        reservedMealTargets: generatedDraft?.generationMeta?.reservedMealTargets || [],
        // La propuesta visible también integra el contexto. Regenerar todo o
        // desde un slot busca composiciones nuevas respecto de lo ya mostrado.
        diversityMeals: generatedDraft.comidas || [],
        generationMode: request.generationMode === MENU_GENERATION_MODE_SIMILAR
          ? "combine_library"
          : request.generationMode,
        sourceMode: request.sourceMode === "library" ? "combined" : request.sourceMode,
      });
      setGeneratedDraft({
        ...preview,
        generationMeta: {
          ...(preview?.generationMeta || {}),
          trackingRevision: expectedTrackingRevision,
        },
        fechaInicio: selectedDate || generatedDraft.fechaInicio || preview.fechaInicio,
        objectiveMode: "custom",
        menuTarget: wizardTarget || dailyTarget || generatedDraft.menuTarget,
      });
      setGenerationRevision((current) => current + 1);
    } catch (error) {
      setRegenerationError(error?.message || "No pudimos regenerar la propuesta.");
    } finally {
      setRegeneratingMeal(null);
    }
  }

function closeGeneratedPreview() {
  /*
   * Todavía estamos viendo una propuesta.
   *
   * NO guardamos menú.
   * NO activamos nada.
   * NO modificamos Tracking.
   */
  navigate(returnTo || "/app/menu", {
    replace: true,

    state: {
      selectedDate:
        selectedDate ||
        generatedDraft?.fechaInicio ||
        "",
    },
  });
}

  function editGenerationSettings() {
    navigate(returnTo || "/app/menu", {
      replace: true,
      state: { openGenerationSettings: true, selectedDate: selectedDate || generatedDraft?.fechaInicio },
    });
  }

  async function useGeneratedMenu() {
    if (!generatedDraft || usingGenerated) return;
    setUsingGenerated(true);
    setRegenerationError("");
    try {
      const expectedTrackingRevision = generatedDraft?.generationMeta?.trackingRevision;
      const draftDate = selectedDate || generatedDraft?.fechaInicio;
      if (expectedTrackingRevision && draftDate) {
        const currentTrackingDay = await getTrackingDay(draftDate);
        if (trackingDayRevision(currentTrackingDay) !== expectedTrackingRevision) {
          const staleError = new Error("Tracking cambió desde que generaste esta propuesta. Volvé a generar para usar el estado actual.");
          staleError.code = "STALE_MENU_PREVIEW";
          throw staleError;
        }
      }
      await createClientMenu(buildGeneratedMenuActivationPayload(
        generatedDraft,
        wizardTarget || dailyTarget || generatedDraft.menuTarget
      ));
      setToast({ type: "success", message: "Menú guardado y activado para el día." });
      navigate(returnTo || "/app/menu", {
        replace: true,
        state: { selectedDate: selectedDate || generatedDraft.fechaInicio, refreshMenu: true },
      });
    } catch (error) {
      setRegenerationError(error?.error || error?.message || "No pudimos guardar y activar este menú.");
    } finally {
      setUsingGenerated(false);
    }
  }

  return (
    <div className="nl-page client-menu-create-page">
      <section className="nl-shell client-menu-create-shell">
        {generationMode ? (
          <ClientMenuGenerator
            user={user}
            targetOverride={dailyTarget}
            initialSettings={generationSettings}
            selectedDate={selectedDate}
            onCancel={openManualCreator}
            onGenerated={(draft) => {
              setGeneratedDraft({
                ...draft,
                fechaInicio: selectedDate || draft.fechaInicio,
                objectiveMode: dailyTarget?.kcal ? "custom" : draft.objectiveMode,
                menuTarget: dailyTarget?.kcal ? dailyTarget : draft.menuTarget,
              });
              openManualCreator();
            }}
          />
        ) : mealCountStep ? (
          <MealCountStep
            initialCount={Number(location.state?.mealCount) || 4}
            target={wizardTarget}
            onSelect={setManualMealCount}
            onCancel={() => navigate(returnTo, { replace: true })}
          />
        ) : setupStep ? (
          <MenuSetupStep
            user={user}
            targetOverride={dailyTarget}
            initialDate={selectedDate}
            mealCount={manualMealCount}
            onBack={() => setManualMealCount(null)}
            onContinue={setManualSetup}
          />
        ) : (
          <>
          {generatedDraft && generationSettings && editingGenerated ? (
            <section className="mb-3 rounded-3xl border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_100%_0,rgba(45,212,191,.10),transparent_35%),#0b1118] p-3 text-white shadow-xl">

<div className="flex items-start justify-between gap-3">
  <div>
    <span className="text-[10px] font-black uppercase tracking-wide text-[#FFD75E]">
      Vista previa automática
    </span>

    <h2 className="mt-1 text-lg font-black">
      Revisá antes de usar
    </h2>
  </div>

  <div className="flex items-center gap-1.5">
    <button
      type="button"
      onClick={editGenerationSettings}
      className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-white/10 px-2 text-[9px] font-black text-zinc-300"
    >
      <SlidersHorizontal size={13} />
      Ajustes
    </button>

    <button
      type="button"
      onClick={closeGeneratedPreview}
      className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200"
      aria-label="Cerrar vista previa"
      title="Salir sin usar este menú"
    >
      <X size={17} />
    </button>
  </div>
</div>


              <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-black/20 p-2"><small className="text-[8px] font-black text-zinc-500">META</small><strong className="block text-sm font-black text-[#FFD75E]">{Math.round(wizardTarget?.kcal || 0)} kcal</strong></div><div className="rounded-xl border border-teal-300/20 bg-teal-300/[0.06] p-2"><small className="text-[8px] font-black text-teal-200/60">GENERADO</small><strong className="block text-sm font-black text-teal-200">{Math.round(generatedTotals.kcal)} kcal</strong></div></div>
              <p className="mt-2 text-[9px] font-bold text-zinc-400">Diferencia: {signedDifference(generatedTotals.kcal - Number(wizardTarget?.kcal || 0))} kcal · P {signedDifference(generatedTotals.proteina - Number(wizardTarget?.proteina || 0))} · C {signedDifference(generatedTotals.carbs - Number(wizardTarget?.carbs || 0))} · G {signedDifference(generatedTotals.grasas - Number(wizardTarget?.grasas || 0))}</p>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">{(generatedDraft.comidas || []).map((meal, index) => <button key={meal.id || index} type="button" disabled={regeneratingMeal !== null} onClick={() => regeneratePreview(index)} className="inline-flex min-h-10 items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 text-left text-[9px] font-black text-zinc-200 disabled:opacity-50"><span className="truncate">Regenerar {meal.nombre || `Comida ${index + 1}`}</span>{regeneratingMeal === index ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>)}</div>
              <button type="button" disabled={regeneratingMeal !== null} onClick={() => regeneratePreview(null)} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[10px] font-black text-[#FFE8A3] disabled:opacity-50">{regeneratingMeal === "all" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerar todo</button>
              {regenerationError ? <div className="mt-2 rounded-xl border border-rose-300/25 bg-rose-300/10 p-2 text-[9px] font-bold text-rose-100">{regenerationError}</div> : null}
            </section>
          ) : null}
          {generatedDraft && generationSettings && !editingGenerated ? (



<GeneratedMenuReview
  draft={generatedDraft}

  target={
    wizardTarget ||
    dailyTarget ||
    generatedDraft.menuTarget
  }

  totals={generatedTotals}

  expandedMeals={expandedReviewMeals}

  onToggleMeal={(index) =>
    setExpandedReviewMeals((current) => {
      /*
       * Cada comida se abre/cierra de forma
       * independiente.
       *
       * Abrir Almuerzo NO cierra Desayuno.
       */
      if (current.includes(index)) {
        return current.filter(
          (mealIndex) =>
            mealIndex !== index
        );
      }

      return [
        ...current,
        index,
      ];
    })
  }

  onRegenerate={regeneratePreview}

  regeneratingMeal={regeneratingMeal}

  error={regenerationError}

  onSettings={editGenerationSettings}

  onEdit={() =>
    setEditingGenerated(true)
  }

  onUse={useGeneratedMenu}

  onClose={closeGeneratedPreview}

  using={usingGenerated}
/>
          ) : null}


          {!generatedDraft || !generationSettings || editingGenerated ? <ClientMenusPanel
            key={`generated-preview-${generationRevision}`}
            directCreate
            editMenuRequest={editMenuRequest}
            initialDraft={generatedDraft}
            returnTo={returnTo}
            user={user}
            initialDate={selectedDate}
            initialTarget={dailyTarget}
            initialMealCount={manualMealCount || 4}
            initialSetup={manualSetup}
            activeMenuComparison={generatedComparison}
            onToast={setToast}
          /> : null}
          </>
        )}
      </section>
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

const REVIEW_MEAL_ICONS = {
  desayuno: Sun,
  almuerzo: Utensils,
  merienda: Sparkles,
  cena: Moon,
};

const REVIEW_MEAL_LABELS = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  colacion: "Colación",
  snack: "Snack",
  pre_entreno: "Pre entreno",
  post_entreno: "Post entreno",
  otra: "Comida",
};

function mealReviewTotals(meal = {}) {
  return generatedMenuTotals({ comidas: [meal] });
}

function GeneratedMenuReview({
  draft,
  target,
  totals,
  expandedMeals,
  onToggleMeal,
  onRegenerate,
  regeneratingMeal,
  error,
  onSettings,
  onEdit,
  onUse,
  onClose,
  using,
}) {
  const reviewPresentation = generatedMenuReviewPresentation(draft);
  const generationWarnings = reviewPresentation.warnings;
  const reservedMealTargets = Array.isArray(draft?.generationMeta?.reservedMealTargets)
    ? draft.generationMeta.reservedMealTargets
    : [];
  const ReviewStatusIcon = reviewPresentation.tone === "success"
    ? CheckCircle2
    : reviewPresentation.tone === "danger"
      ? X
      : Info;
  /*
   * =====================================================
   * META TOTAL DEL DÍA
   * =====================================================
   *
   * Ejemplo:
   * 2132 kcal
   */
  const targetKcal =
    Math.max(
      0,
      Number(target?.kcal) || 0
    );


  /*
   * =====================================================
   * META DE LAS COMIDAS
   * =====================================================
   *
   * Ejemplo:
   * 1932 kcal
   *
   * Esto YA tiene descontadas las calorías libres.
   */
  const plannedTarget =
    draft?.plannedTarget ||
    draft?.generationMeta?.plannedTarget ||
    {};


  /*
   * =====================================================
   * CALORÍAS LIBRES
   * =====================================================
   */
  const freeCalories =
    Math.max(
      0,
      Number(
        draft?.flexibleCalories ??
        draft?.generationMeta?.freeCalories ??
        0
      ) || 0
    );


  /*
   * Compatibilidad con previews viejos:
   *
   * si no trae plannedTarget,
   * lo calculamos como:
   *
   * meta total - libres.
   */
  const plannedKcalFromDraft =
    Math.max(
      0,
      Number(plannedTarget?.kcal) || 0
    );


  const plannedKcal =
    plannedKcalFromDraft > 0
      ? plannedKcalFromDraft
      : Math.max(
          0,
          targetKcal -
            freeCalories
        );


  /*
   * =====================================================
   * PORCENTAJES VISUALES
   * =====================================================
   */

  const menuPercent =
    targetKcal > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (
              plannedKcal /
              targetKcal
            ) * 100
          )
        )
      : 0;


  const freePercent =
    targetKcal > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (
              freeCalories /
              targetKcal
            ) * 100
          )
        )
      : 0;


  /*
   * Lo planificado incluye:
   *
   * kcal de comidas
   * +
   * kcal libres.
   *
   * Por eso debería dar 100%.
   */
  const planningPercent =
    targetKcal > 0
      ? Math.min(
          100,
          Math.round(
            (
              (
                plannedKcal +
                freeCalories
              ) /
              targetKcal
            ) * 100
          )
        )
      : 0;


  /*
   * =====================================================
   * TARGET DE COMPARACIÓN
   * =====================================================
   *
   * IMPORTANTE:
   *
   * Las comidas generadas se comparan contra
   * plannedTarget, NO contra la meta completa.
   *
   * Ej:
   *
   * generado 1931.8
   * target comidas 1932
   *
   * diferencia = -0.2
   *
   * NO -200.2.
   */
  const plannedProtein =
    Number(
      plannedTarget?.proteina ??
      target?.proteina ??
      0
    ) || 0;


  const plannedCarbs =
    Number(
      plannedTarget?.carbs ??
      target?.carbs ??
      0
    ) || 0;


  const plannedFat =
    Number(
      plannedTarget?.grasas ??
      target?.grasas ??
      0
    ) || 0;


  return (
    <section
      className="generated-menu-review"
      aria-labelledby="generated-menu-review-title"
      data-assessment={reviewPresentation.classification}
    >

      {/* ================================================= */}
      {/* CABECERA */}
      {/* ================================================= */}

      <header className="generated-review-ready relative pr-12">

        <button
          type="button"
          onClick={onClose}
          className="
            absolute
            right-3
            top-3
            z-20

            grid
            h-9
            w-9
            place-items-center

            rounded-xl
            border
            border-white/10
            bg-black/30

            text-zinc-400

            backdrop-blur-md
            transition

            hover:border-rose-300/30
            hover:bg-rose-400/10
            hover:text-rose-200
          "
          aria-label="Cerrar menú generado"
          title="Salir sin usar este menú"
        >
          <X
            size={18}
            strokeWidth={2.4}
          />
        </button>


        <span className="generated-review-spark">
          <Sparkles size={24} />
        </span>


        <div className="pr-4">
          <h1 id="generated-menu-review-title">
            Menú generado automáticamente
          </h1>

          <p>
            {reviewPresentation.description}
          </p>

          <span className="generated-review-status mt-2 inline-flex">
            <ReviewStatusIcon size={15} />
            {reviewPresentation.label}
          </span>
        </div>

      </header>


      {/* ================================================= */}
      {/* META DEL DÍA */}
      {/* ================================================= */}

      <section className="generated-review-target">

        <span className="generated-review-target-icon">
          <Target size={24} />
        </span>


        <div>
          <small>
            Meta del día
          </small>

          <strong>
            {Math.round(
              targetKcal
            ).toLocaleString("es-AR")} kcal
          </strong>

          <p>
            P{Math.round(target?.proteina || 0)}
            {" / "}
            C{Math.round(target?.carbs || 0)}
            {" / "}
            G{Math.round(target?.grasas || 0)}
          </p>
        </div>


        <div className="generated-review-percent">
          <strong>
            {planningPercent}%
          </strong>

          <small>
            planificado
          </small>
        </div>

      </section>


      {/* ================================================= */}
      {/* CALORÍAS LIBRES */}
      {/* ================================================= */}

      {freeCalories > 0 ? (
        <section
          className="
            mt-2
            overflow-hidden

            rounded-[16px]

            border
            border-[#D4AF37]/40

            bg-[radial-gradient(circle_at_100%_0%,rgba(255,215,94,.11),transparent_40%),linear-gradient(145deg,#10171d,#090e13)]

            px-3.5
            py-3

            shadow-[0_10px_26px_rgba(0,0,0,.20)]
          "
        >

          <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3">

            {/* ICONO */}

            <span
              className="
                grid
                h-10
                w-10
                place-items-center

                rounded-full

                border
                border-[#FFD75E]/30

                bg-[#D4AF37]/10

                text-[#FFD75E]
              "
            >
              <Sparkles size={18} />
            </span>


            {/* TEXTO */}

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-1.5">

                <strong className="text-[13px] font-black text-white">
                  Calorías libres
                </strong>

                <span
                  className="
                    rounded-full
                    border
                    border-[#FFD75E]/25
                    bg-[#D4AF37]/10

                    px-1.5
                    py-0.5

                    text-[7px]
                    font-black
                    uppercase
                    tracking-wide

                    text-[#FFD75E]
                  "
                >
                  Flexible
                </span>

              </div>


              <p className="mt-1 text-[9px] font-bold leading-relaxed text-zinc-500">
                Reservadas para usar como quieras durante el día.
              </p>

            </div>


            {/* VALOR */}

            <div className="shrink-0 text-right">

              <strong className="block text-[16px] font-black text-[#FFD75E]">
                {Math.round(
                  freeCalories
                )} kcal
              </strong>

              <span className="text-[8px] font-black text-zinc-500">
                {Math.round(
                  freePercent
                )}
                % del día
              </span>

            </div>

          </div>


          {/* ================================================= */}
          {/* BARRA MENÚ + LIBRE */}
          {/* ================================================= */}

          <div className="mt-3 overflow-hidden rounded-full bg-white/[0.07]">

            <div className="flex h-[6px] w-full">

              <div
                className="h-full bg-teal-300"
                style={{
                  width:
                    `${menuPercent}%`,
                }}
              />

              <div
                className="h-full bg-[#FFD75E]"
                style={{
                  width:
                    `${freePercent}%`,
                }}
              />

            </div>

          </div>


          {/* ================================================= */}
          {/* LEYENDA */}
          {/* ================================================= */}

          <div className="mt-2 grid grid-cols-2 gap-2">

            <div>
              <span className="block text-[8px] font-bold text-zinc-600">
                En comidas
              </span>

              <strong className="text-[10px] font-black text-teal-300">
                {Math.round(
                  plannedKcal
                ).toLocaleString("es-AR")} kcal
              </strong>
            </div>


            <div className="text-right">
              <span className="block text-[8px] font-bold text-zinc-600">
                Libres
              </span>

              <strong className="text-[10px] font-black text-[#FFD75E]">
                {Math.round(
                  freeCalories
                ).toLocaleString("es-AR")} kcal
              </strong>
            </div>

          </div>

        </section>
      ) : null}


      {/* ================================================= */}
      {/* COMIDAS */}
      {/* ================================================= */}

      {reservedMealTargets.length ? (
        <section className="mb-3 grid gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-3">
          <div>
            <strong className="text-sm font-black text-amber-100">Metas que ya planificaste</strong>
            <p className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-400">
              Se conservaron y se descontaron antes de generar las demás comidas.
            </p>
          </div>
          {reservedMealTargets.map((meal, index) => {
            const mealTarget = meal?.target || meal?.meta || {};
            return (
              <div key={meal?.id || meal?.mealId || index} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="min-w-0">
                  <b className="block truncate text-xs font-black text-white">{meal?.name || meal?.nombre || `Comida ${index + 1}`}</b>
                  <small className="mt-0.5 block text-[9px] font-bold text-zinc-400">
                    P {Number(mealTarget.proteina ?? mealTarget.p) || 0} · C {Number(mealTarget.carbs ?? mealTarget.c) || 0} · G {Number(mealTarget.grasas ?? mealTarget.g) || 0}
                  </small>
                </span>
                <strong className="shrink-0 text-xs font-black text-amber-100">{Math.round(Number(mealTarget.kcal) || 0)} kcal</strong>
              </div>
            );
          })}
        </section>
      ) : null}

      <div className="generated-review-meals">

        {(draft?.comidas || []).map(
          (meal, index) => {

            const type =
              meal.tipoComida ||
              "otra";

            const Icon =
              REVIEW_MEAL_ICONS[type] ||
              Utensils;

              const mealLabel =
  REVIEW_MEAL_LABELS[type] ||
  meal.nombre ||
  `Comida ${index + 1}`;


            const mealTotals =
              mealReviewTotals(meal);

            const traceSlotIndex = Number(meal?.plannerSlotIndex ?? index);
            const traceEntry = Array.isArray(draft?.generationMeta?.trace)
              ? draft.generationMeta.trace.find((entry) => Number(entry?.slotIndex) === traceSlotIndex)
              : null;
            const preserved = traceEntry?.status === "preserved";

 const expanded =
  Array.isArray(expandedMeals) &&
  expandedMeals.includes(index);


            return (
              <article
                key={meal.id || index}
                className={`generated-review-meal ${type}`}
              >

                <button
                  type="button"
                  className="generated-review-meal-main"
                  onClick={() =>
                    onToggleMeal(index)
                  }
                  aria-expanded={expanded}
                >

                  <span className="generated-review-meal-icon">
                    <Icon size={23} />
                  </span>


                  <span className="generated-review-meal-copy">

<span className="generated-review-meal-title">
  <strong>
    {mealLabel}
  </strong>

  <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${
    preserved
      ? "border-sky-300/25 bg-sky-300/10 text-sky-200"
      : "border-teal-300/25 bg-teal-300/10 text-teal-200"
  }`}>
    {preserved ? "✓ Conservada" : "✨ Generada"}
  </span>

  <b>
    {Math.round(
      mealTotals.kcal
    )} kcal
  </b>
</span>


                    <small>
                      P{Math.round(
                        mealTotals.proteina
                      )}
                      {" / "}
                      C{Math.round(
                        mealTotals.carbs
                      )}
                      {" / "}
                      G{Math.round(
                        mealTotals.grasas
                      )}
                    </small>


                    <span className="generated-review-food-chips">

                      {(meal.items || [])
                        .slice(0, 4)
                        .map(
                          (
                            item,
                            itemIndex
                          ) => (
                            <i
                              key={
                                item.id ||
                                itemIndex
                              }
                            >
                              {item.nombreSnapshot ||
                                item.nombre ||
                                "Alimento"}
                            </i>
                          )
                        )}


                      {(meal.items || [])
                        .length > 4 ? (
                        <i>
                          +
                          {(meal.items || [])
                            .length - 4}
                        </i>
                      ) : null}

                    </span>

                  </span>


                  <span className="generated-review-chevron">
                    {expanded ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </span>

                </button>


                {expanded ? (
                  <div className="generated-review-detail">

                    {(meal.items || []).map(
                      (
                        item,
                        itemIndex
                      ) => (
                        <div
                          key={
                            item.id ||
                            itemIndex
                          }
                          className="generated-review-food-detail"
                        >

                       <span className="min-w-0">
  <strong className="block text-[11px] font-black leading-tight text-zinc-100 sm:text-[12px]">
    {item.nombreSnapshot ||
      item.nombre ||
      "Alimento"}
  </strong>

  <small className="mt-1 block text-[8px] font-bold leading-tight text-zinc-500 sm:text-[9px]">
    {Math.round(
      (
        Number(
          item.kcal
        ) || 0
      ) * 10
    ) / 10} kcal

    {" · P"}

    {Math.round(
      (
        Number(
          item.proteina
        ) || 0
      ) * 10
    ) / 10}

    {" · C"}

    {Math.round(
      (
        Number(
          item.carbs
        ) || 0
      ) * 10
    ) / 10}

    {" · G"}

    {Math.round(
      (
        Number(
          item.grasas
        ) || 0
      ) * 10
    ) / 10}
  </small>
</span>


                          <b>
                            {Number(
                              item.cantidad
                            ) || 0}
                            {" "}
                            {item.unidadSnapshot ||
                              item.unidad ||
                              "g"}
                          </b>

                        </div>
                      )
                    )}


                    <button
                      type="button"
                      disabled={
                        regeneratingMeal !== null ||
                        preserved
                      }
                      onClick={() =>
                        onRegenerate(index)
                      }
                      className="generated-review-regenerate-meal"
                    >
                      {regeneratingMeal ===
                      index ? (
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                      ) : (
                        <RefreshCw
                          size={14}
                        />
                      )}

                      {preserved ? "Comida conservada" : "Regenerar esta comida"}
                    </button>

                  </div>
                ) : null}

              </article>
            );
          }
        )}

      </div>


      {/* ================================================= */}
      {/* DIFERENCIA VS MENÚ PLANIFICADO */}
      {/* ================================================= */}

      <p className="generated-review-difference">

        Diferencia vs. menú planificado:{" "}

        {signedDifference(
          Number(totals?.kcal || 0) -
          plannedKcal
        )} kcal

        {" · P "}

        {signedDifference(
          Number(
            totals?.proteina || 0
          ) -
          plannedProtein
        )}

        {" · C "}

        {signedDifference(
          Number(
            totals?.carbs || 0
          ) -
          plannedCarbs
        )}

        {" · G "}

        {signedDifference(
          Number(
            totals?.grasas || 0
          ) -
          plannedFat
        )}

      </p>


      {generationWarnings.length ? (
        <div className="grid gap-1.5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-[9px] font-bold leading-relaxed text-amber-100">
          {generationWarnings.map((entry, index) => (
            <p key={`${entry.code || "warning"}-${index}`}>
              {entry.mealType ? `${REVIEW_MEAL_LABELS[entry.mealType] || entry.mealType}: ` : ""}
              {entry.message}
            </p>
          ))}
        </div>
      ) : null}


      {error ? (
        <div className="generated-review-error">
          {error}
        </div>
      ) : null}


      {/* ================================================= */}
      {/* ACCIONES */}
      {/* ================================================= */}

      <footer className="generated-review-actions">

        <button
          type="button"
          disabled={
            regeneratingMeal !== null ||
            using
          }
          onClick={() =>
            onRegenerate(null)
          }
        >
          {regeneratingMeal ===
          "all" ? (
            <Loader2
              size={17}
              className="animate-spin"
            />
          ) : (
            <RefreshCw size={17} />
          )}

          Generar otra opción
        </button>


        <button
          type="button"
          disabled={
            regeneratingMeal !== null ||
            using
          }
          onClick={onEdit}
        >
          <Edit3 size={17} />
          Editar comidas
        </button>


        <button
          type="button"
          className="generated-review-use"
          disabled={
            regeneratingMeal !== null ||
            using ||
            !reviewPresentation.usable
          }
          onClick={onUse}
          title={reviewPresentation.usable ? undefined : "Generá otra opción antes de continuar"}
        >
          {using ? (
            <Loader2
              size={18}
              className="animate-spin"
            />
          ) : !reviewPresentation.usable ? (
            <X size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}

          {reviewPresentation.usable ? "Usar este menú" : "No utilizable"}

          {reviewPresentation.usable ? <ArrowRight size={18} /> : null}
        </button>

      </footer>


      <button
        type="button"
        className="generated-review-settings"
        onClick={onSettings}
      >
        <SlidersHorizontal size={15} />
        Editar ajustes de generación
      </button>

    </section>
  );
}

function MealCountStep({ target = null, initialCount = 4, onSelect, onCancel }) {
  const [selected, setSelected] = useState(initialCount);

  return (
    <section className="client-meal-count-step" aria-labelledby="client-meal-count-title">
      <span className="client-wizard-step">Paso 1 de 3</span>
      <span className="client-meal-count-icon"><Utensils size={25} aria-hidden="true" /></span>
      <h1 id="client-meal-count-title">Crear menú manual</h1>
      <p>Elegí cuántas comidas querés hacer hoy. Después podés renombrarlas, reordenarlas o agregar más.</p>
      {target?.kcal ? (
        <div className="client-meal-count-target">
          <Target size={26} aria-hidden="true" />
          <span><strong>Objetivo del día</strong><small>{targetLine(target)}</small></span>
        </div>
      ) : null}
      <div className="client-meal-count-options" role="radiogroup" aria-label="Cantidad inicial de comidas">
        {[3, 4, 5, 6].map((count) => (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={selected === count}
            className={`${count === 4 ? "recommended" : ""} ${selected === count ? "selected" : ""}`}
            onClick={() => setSelected(count)}
          >
            <i><Utensils size={19} aria-hidden="true" /></i>
            <span>{count}</span>
            <strong>{count} comidas</strong>
            {count === 4 ? <small><Check size={13} /> Recomendada</small> : null}
          </button>
        ))}
      </div>
      <button type="button" className="client-wizard-primary" onClick={() => onSelect(selected)}>
        Continuar <ArrowRight size={20} aria-hidden="true" />
      </button>
      <button type="button" className="client-wizard-back" onClick={onCancel}><ArrowLeft size={16} /> Volver</button>
    </section>
  );
}

function MenuSetupStep({ user = {}, targetOverride = null, initialDate = "", mealCount = 4, onBack, onContinue }) {
  const plan = planMetaFromUser(user);
  const currentTarget = targetForWizard(user, targetOverride);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : localIsoDate();
  const [name, setName] = useState("Mi menú");
  const [nameEditing, setNameEditing] = useState(false);
  const [date, setDate] = useState(startDate);
  const [objectiveMode, setObjectiveMode] = useState(currentTarget ? "current" : "custom");
  const [customTarget, setCustomTarget] = useState(currentTarget || { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  const [selectedDays, setSelectedDays] = useState([weekdayKeyFromIso(startDate)]);
  const selectedTarget = objectiveMode === "custom" ? customTarget : currentTarget;
  const canContinue = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && selectedDays.length > 0 && Number(selectedTarget?.kcal) > 0;

  function changeDate(nextDate) {
    const previousDay = weekdayKeyFromIso(date);
    const nextDay = weekdayKeyFromIso(nextDate);
    setDate(nextDate);
    setSelectedDays((current) => current.length === 1 && current[0] === previousDay ? [nextDay] : current);
  }

  function toggleDay(dayKey) {
    setSelectedDays((current) => {
      if (current.includes(dayKey)) return current.length > 1 ? current.filter((day) => day !== dayKey) : current;
      if (current.length >= plan.dayLimit) return current;
      return [...current, dayKey];
    });
  }

  function updateTarget(field, value) {
    const parsed = Math.max(0, Number(value) || 0);
    setCustomTarget((current) => ({ ...current, [field]: parsed }));
  }

  return (
    <section className="client-menu-setup-step" aria-labelledby="client-menu-setup-title">
      <span className="client-wizard-step">Paso 2 de 3</span>
      <span className="client-meal-count-icon"><Utensils size={25} aria-hidden="true" /></span>
      <h1 id="client-menu-setup-title">Configurar mi menú</h1>
      <p>Definí el nombre, la fecha y el objetivo nutricional.</p>

      <div className="client-setup-name">
        <span className="client-setup-name-icon"><Utensils size={20} aria-hidden="true" /></span>
        {nameEditing ? (
          <input
            value={name}
            maxLength={180}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNameEditing(false)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") setNameEditing(false); }}
            aria-label="Nombre del menú"
          />
        ) : <strong>{name}</strong>}
        <button type="button" onClick={() => setNameEditing(true)} aria-label="Editar nombre del menú"><Edit3 size={18} /></button>
        <span className={`client-setup-plan ${plan.key}`}><Crown size={15} /> Plan {plan.label}</span>
      </div>

      <span className="client-setup-limit"><CalendarDays size={15} /> Hasta {plan.dayLimit} {plan.dayLimit === 1 ? "día" : "días"} · {mealCount} comidas iniciales</span>

      <section className="client-setup-objective">
        <h2>Objetivo y comienzo</h2>
        <label className="client-setup-date">
          <span>Fecha de inicio</span>
          <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} aria-label="Fecha de inicio del menú" />
        </label>
        <div className="client-setup-objective-modes" role="radiogroup" aria-label="Objetivo nutricional del menú">
          <button type="button" role="radio" aria-checked={objectiveMode === "current"} disabled={!currentTarget} className={objectiveMode === "current" ? "active" : ""} onClick={() => setObjectiveMode("current")}>
            <Target size={20} /><span><strong>Usar mi objetivo actual</strong><small>{targetLine(currentTarget)}</small></span>
          </button>
          <button type="button" role="radio" aria-checked={objectiveMode === "custom"} className={objectiveMode === "custom" ? "active" : ""} onClick={() => setObjectiveMode("custom")}>
            <Target size={20} /><span><strong>Objetivo propio</strong><small>Definir calorías y macros</small></span>
          </button>
        </div>
        {objectiveMode === "custom" ? (
          <div className="client-setup-target-grid">
            {[["kcal", "Kcal"], ["proteina", "Proteína"], ["carbs", "Carbohidratos"], ["grasas", "Grasas"]].map(([field, label]) => (
              <label key={field}><span>{label}</span><input type="number" min="0" step="0.1" value={customTarget[field] || ""} onChange={(event) => updateTarget(field, event.target.value)} aria-label={`${label} objetivo del menú`} /></label>
            ))}
          </div>
        ) : null}
      </section>

      <div className="client-setup-days" role="group" aria-label="Días incluidos en el menú">
        {WIZARD_DAYS.map(([key, label]) => (
          <button key={key} type="button" className={selectedDays.includes(key) ? "active" : ""} aria-pressed={selectedDays.includes(key)} onClick={() => toggleDay(key)}>{label}</button>
        ))}
      </div>

      <div className="client-setup-note"><Info size={20} /><span>Este menú se crea sin registrar consumo. Podés renombrarlo, eliminarlo, ordenarlo o agregar otras comidas después.</span></div>

      <button
        type="button"
        className="client-wizard-primary"
        disabled={!canContinue}
        onClick={() => onContinue({
          nombre: name.trim(),
          fechaInicio: date,
          objectiveMode,
          menuTarget: objectiveMode === "custom" ? customTarget : null,
          selectedDays,
          dayLimit: plan.dayLimit,
        })}
      >
        Continuar <ArrowRight size={20} aria-hidden="true" />
      </button>
      <button type="button" className="client-wizard-back" onClick={onBack}><ArrowLeft size={16} /> Volver</button>
    </section>
  );
}
