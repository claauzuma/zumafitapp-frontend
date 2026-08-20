import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronUp, Crown, Edit3, Info, Loader2, Moon, RefreshCw, SlidersHorizontal, Sparkles, Sun, Target, Utensils } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
import { normalizeGoalFromUser } from "../clientNutrition/nutritionState.js";
import AppToast from "../ui/AppToast.jsx";
import ClientMenusPanel from "./ClientMenusPanel.jsx";
import ClientMenuGenerator from "./ClientMenuGenerator.jsx";
import { authorizeClientMenuGeneration, createClientMenu } from "./clientMenusApi.js";
import { generateClientMenuPreview } from "./clientMenuGeneration.js";
import { buildGeneratedMenuActivationPayload, generatedMenuTotals, replaceGeneratedPreviewMeal } from "./clientMenuPreview.js";
import { buildAutonomousMenuGenerationRequest, MENU_GENERATION_MODE_SIMILAR } from "../entrenado/menu/menuQuickActions.js";
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
  const [expandedReviewMeal, setExpandedReviewMeal] = useState(null);
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
      const authorization = await authorizeClientMenuGeneration();
      if (authorization?.policy !== "tracking_calorie_fill_v1" || authorization?.previewOnly !== true) {
        throw new Error("El servidor no autorizó una vista previa segura.");
      }
      const request = buildAutonomousMenuGenerationRequest({
        settings: generationSettings,
        target: wizardTarget || dailyTarget || generatedDraft.menuTarget,
        selectedDate: selectedDate || generatedDraft.fechaInicio,
        name: generatedDraft.nombre,
      });
      let preview;
      if (mealIndex === null) {
        preview = await generateClientMenuPreview(request);
      } else {
        const currentMeal = generatedDraft.comidas?.[mealIndex];
        if (!currentMeal) throw new Error("No encontramos la comida que querés regenerar.");
        const type = currentMeal.tipoComida || currentMeal.mealType || request.mealTypes[mealIndex];
        const mealTarget = currentMeal.target || currentMeal.totales;
        const single = await generateClientMenuPreview({
          ...request,
          target: mealTarget,
          mealTypes: [type],
          mealTargets: [{ type, label: currentMeal.nombre, target: mealTarget }],
          generationMode: request.generationMode === MENU_GENERATION_MODE_SIMILAR ? "combine_library" : request.generationMode,
          sourceMode: request.sourceMode === "library" ? "combined" : request.sourceMode,
          name: currentMeal.nombre,
        });
        const replacement = single.comidas?.[0];
        if (!replacement) throw new Error(`No pudimos regenerar ${currentMeal.nombre || "esta comida"}.`);
        preview = replaceGeneratedPreviewMeal(generatedDraft, mealIndex, replacement);
      }
      setGeneratedDraft({
        ...preview,
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
              <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-wide text-[#FFD75E]">Vista previa automática</span><h2 className="mt-1 text-lg font-black">Revisá antes de usar</h2></div><button type="button" onClick={() => navigate(returnTo, { replace: true })} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-white/10 px-2 text-[9px] font-black text-zinc-300"><SlidersHorizontal size={13} /> Ajustes</button></div>
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
              target={wizardTarget || dailyTarget || generatedDraft.menuTarget}
              totals={generatedTotals}
              expandedMeal={expandedReviewMeal}
              onToggleMeal={(index) => setExpandedReviewMeal((current) => current === index ? null : index)}
              onRegenerate={regeneratePreview}
              regeneratingMeal={regeneratingMeal}
              error={regenerationError}
              onSettings={editGenerationSettings}
              onEdit={() => setEditingGenerated(true)}
              onUse={useGeneratedMenu}
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

function mealReviewTotals(meal = {}) {
  return generatedMenuTotals({ comidas: [meal] });
}

function GeneratedMenuReview({
  draft,
  target,
  totals,
  expandedMeal,
  onToggleMeal,
  onRegenerate,
  regeneratingMeal,
  error,
  onSettings,
  onEdit,
  onUse,
  using,
}) {
  const targetKcal = Number(target?.kcal) || 0;
  const distributed = targetKcal > 0 ? Math.round((Number(totals?.kcal) || 0) / targetKcal * 100) : 0;

  return (
    <section className="generated-menu-review" aria-labelledby="generated-menu-review-title">
      <header className="generated-review-ready">
        <span className="generated-review-spark"><Sparkles size={24} /></span>
        <div><h1 id="generated-menu-review-title">Menú generado automáticamente</h1><p>Tu plan del día está listo para vos.</p></div>
        <span className="generated-review-status"><CheckCircle2 size={15} /> Listo</span>
      </header>

      <section className="generated-review-target">
        <span className="generated-review-target-icon"><Target size={24} /></span>
        <div><small>Meta del día</small><strong>{Math.round(targetKcal).toLocaleString("es-AR")} kcal</strong><p>P{Math.round(target?.proteina || 0)} / C{Math.round(target?.carbs || 0)} / G{Math.round(target?.grasas || 0)}</p></div>
        <div className="generated-review-percent"><strong>{distributed}%</strong><small>distribuido</small></div>
      </section>

      <div className="generated-review-meals">
        {(draft?.comidas || []).map((meal, index) => {
          const type = meal.tipoComida || "otra";
          const Icon = REVIEW_MEAL_ICONS[type] || Utensils;
          const mealTotals = mealReviewTotals(meal);
          const expanded = expandedMeal === index;
          return (
            <article key={meal.id || index} className={`generated-review-meal ${type}`}>
              <button type="button" className="generated-review-meal-main" onClick={() => onToggleMeal(index)} aria-expanded={expanded}>
                <span className="generated-review-meal-icon"><Icon size={23} /></span>
                <span className="generated-review-meal-copy">
                  <span className="generated-review-meal-title"><strong>{meal.nombre || `Comida ${index + 1}`}</strong><b>{Math.round(mealTotals.kcal)} kcal</b></span>
                  <small>P{Math.round(mealTotals.proteina)} / C{Math.round(mealTotals.carbs)} / G{Math.round(mealTotals.grasas)}</small>
                  <span className="generated-review-food-chips">
                    {(meal.items || []).slice(0, 4).map((item, itemIndex) => <i key={item.id || itemIndex}>{item.nombreSnapshot || item.nombre || "Alimento"}</i>)}
                    {(meal.items || []).length > 4 ? <i>+{meal.items.length - 4}</i> : null}
                  </span>
                </span>
                <span className="generated-review-chevron">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
              </button>
              {expanded ? (
                <div className="generated-review-detail">
                  {(meal.items || []).map((item, itemIndex) => (
                    <div key={item.id || itemIndex} className="generated-review-food-detail">
                      <span><strong>{item.nombreSnapshot || item.nombre || "Alimento"}</strong><small>{Math.round((Number(item.kcal) || 0) * 10) / 10} kcal · P{Math.round((Number(item.proteina) || 0) * 10) / 10} · C{Math.round((Number(item.carbs) || 0) * 10) / 10} · G{Math.round((Number(item.grasas) || 0) * 10) / 10}</small></span>
                      <b>{Number(item.cantidad) || 0} {item.unidadSnapshot || item.unidad || "g"}</b>
                    </div>
                  ))}
                  <button type="button" disabled={regeneratingMeal !== null} onClick={() => onRegenerate(index)} className="generated-review-regenerate-meal">
                    {regeneratingMeal === index ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerar esta comida
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="generated-review-difference">Diferencia vs. meta: {signedDifference(totals.kcal - targetKcal)} kcal · P {signedDifference(totals.proteina - Number(target?.proteina || 0))} · C {signedDifference(totals.carbs - Number(target?.carbs || 0))} · G {signedDifference(totals.grasas - Number(target?.grasas || 0))}</p>
      {error ? <div className="generated-review-error">{error}</div> : null}

      <footer className="generated-review-actions">
        <button type="button" disabled={regeneratingMeal !== null || using} onClick={() => onRegenerate(null)}>{regeneratingMeal === "all" ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />} Regenerar todo</button>
        <button type="button" disabled={regeneratingMeal !== null || using} onClick={onEdit}><Edit3 size={17} /> Editar comidas</button>
        <button type="button" className="generated-review-use" disabled={regeneratingMeal !== null || using} onClick={onUse}>{using ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Usar este menú <ArrowRight size={18} /></button>
      </footer>
      <button type="button" className="generated-review-settings" onClick={onSettings}><SlidersHorizontal size={15} /> Editar ajustes de generación</button>
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
