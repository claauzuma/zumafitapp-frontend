import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleUserRound,
  Database,
  Info,
  Library,
  Layers3,
  LockKeyhole,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UnlockKeyhole,
  WandSparkles,
  X,
} from "lucide-react";

import { listAlimentos } from "../../nutricion/nutricionApi.js";
import { getFoodImageUrl } from "../../nutricion/nutricionUtils.js";
import { getCachedUser } from "../../authCache.js";
import { calculateTrackingQuantities } from "../../tracking/trackingApi.js";
import { listLibraryMeals } from "../../nutritionLibrary/nutritionLibraryApi.js";
import {
  generateEquivalentMealAlternative,
  getEquivalentMealGenerationSettings,
  saveEquivalentMealGenerationSettings,
} from "../../clientMenus/clientMenusApi.js";
import { buildTrackingQuantityInlineFeedback } from "../../tracking/trackingQuantityReview.js";
import {
  applyTrackingDraftProposals,
  buildTrackingQuantityCalculationRequest,
  createTrackingFoodDraft,
  isTrackingDraftAutomatic,
  markTrackingDraftAutomatic,
  markTrackingDraftManual,
  trackingDraftCalculationPayload,
  trackingDraftProposals,
  trackingDraftStorageOwner,
  trackingDraftsNutritionTotals,
  trackingDraftsReadyToConfirm,
  trackingFoodRequiresWholeQuantity,
  updateTrackingFoodDraftQuantity,
} from "../../tracking/trackingQuantityDrafts.js";
import {
  buildEquivalentMealFromDrafts,
  createEquivalentDraftRequestId,
  equivalentMealComparison,
  equivalentMealDraftStorageKey,
  equivalentMealTarget,
  equivalentLibrarySourceLabel,
  filterEquivalentLibraryMeals,
  generatedAlternativeToDrafts,
  nextGeneratedAlternativeIndex,
} from "./menuEquivalentMeal.js";

const format = (value, digits = 0) => Number(value || 0).toLocaleString("es-AR", {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits,
});

function foodName(food = {}) {
  return food.nombre || food.name || food.Alimentos || "Alimento";
}

function foodUnit(food = {}) {
  return food.unidad || food.unit || food.Unidad || "g";
}

function suggestedQuantity(food = {}) {
  const direct = Number(
    food.porcionSugerida ?? food.cantidadSugerida ?? food.raw?.porcionSugerida ?? food.raw?.cantidadSugerida
  );
  if (Number.isFinite(direct) && direct > 0) return direct;
  return trackingFoodRequiresWholeQuantity(food, foodUnit(food)) ? 1 : 100;
}

function resultsFrom(response = {}) {
  if (Array.isArray(response)) return response;
  for (const key of ["alimentos", "items", "data", "rows", "results", "all"]) {
    if (Array.isArray(response?.[key])) return response[key];
  }
  return [];
}

function loadDraftState(storageKey, maxFoods) {
  const empty = { drafts: [], strategy: "selected_only", rejectedSuggestionFoodIds: [], requestId: "", warnings: [], favoriteOriginId: "", generatedConstraintSignature: "" };
  if (!storageKey) return empty;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    if (Array.isArray(parsed)) return { ...empty, drafts: parsed.filter(Boolean).slice(0, maxFoods) };
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      ...empty,
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts.filter(Boolean).slice(0, maxFoods) : [],
      strategy: parsed.strategy === "assisted_food_addition" ? parsed.strategy : "selected_only",
      rejectedSuggestionFoodIds: Array.isArray(parsed.rejectedSuggestionFoodIds)
        ? parsed.rejectedSuggestionFoodIds.map(String).filter(Boolean).slice(0, 40)
        : [],
      requestId: String(parsed.requestId || "").slice(0, 120),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 20) : [],
      favoriteOriginId: String(parsed.favoriteOriginId || "").slice(0, 120),
      generatedConstraintSignature: String(parsed.generatedConstraintSignature || "").slice(0, 1000),
    };
  } catch {
    return empty;
  }
}

function draftsFromSeedFoods(seedFoods = [], maxFoods = 6) {
  return (Array.isArray(seedFoods) ? seedFoods : []).slice(0, maxFoods).map((food, index) => {
    const quantity = Number(food.cantidad ?? food.quantity) || "";
    const draft = createTrackingFoodDraft(
      food,
      quantity,
      `equivalent-seed-${food.alimentoId || food.id || index}-${Date.now()}`,
      "calorie_fill"
    );
    const automatic = String(food.quantityMode || food.mode || "").toLowerCase() === "automatic";
    return {
      ...(automatic ? markTrackingDraftAutomatic(draft) : markTrackingDraftManual(draft)),
      suggested: food.suggested === true,
    };
  });
}

function libraryItemFood(item = {}) {
  const quantity = Number(item.cantidad ?? item.quantity) || 0;
  const divisor = quantity > 0 ? quantity : 1;
  return {
    ...item,
    id: item.alimentoId || item.id || item._id,
    alimentoId: item.alimentoId || item.id || item._id,
    nombre: item.nombre || item.nombreSnapshot || item.name || "Alimento",
    unidad: item.unidad || item.unit || "g",
    macroBasis: "perUnit",
    kcal: Number(item.kcal || 0) / divisor,
    proteina: Number(item.proteina ?? item.proteinas ?? 0) / divisor,
    carbs: Number(item.carbs ?? item.carbohidratos ?? 0) / divisor,
    grasas: Number(item.grasas || 0) / divisor,
  };
}

function responseCandidateFood(food = {}) {
  const quantity = Number(food.quantity ?? food.cantidad) || 0;
  const divisor = quantity > 0 ? quantity : 1;
  return {
    ...food,
    id: food.foodId || food.alimentoId || food.id || food._id,
    alimentoId: food.foodId || food.alimentoId || food.id || food._id,
    nombre: food.nombre || food.name || "Alimento sugerido",
    unidad: food.unidad || food.unit || "g",
    macroBasis: "perUnit",
    kcal: Number(food.kcal || 0) / divisor,
    proteina: Number(food.proteina ?? food.protein ?? 0) / divisor,
    carbs: Number(food.carbs || 0) / divisor,
    grasas: Number(food.grasas ?? food.fat ?? 0) / divisor,
  };
}

function signed(value, digits = 0) {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? "+" : ""}${format(numeric, digits)}`;
}

function generationConstraintSignature({ strategy, requiredFoods, avoidedFoods } = {}) {
  const ids = (values) => (Array.isArray(values) ? values : [])
    .map((food) => String(food?.id || food?.foodId || food?.alimentoId || food || ""))
    .filter(Boolean)
    .sort();
  return JSON.stringify({
    strategy: strategy === "assisted_food_addition" ? strategy : "selected_only",
    requiredFoodIds: ids(requiredFoods),
    excludedFoodIds: ids(avoidedFoods),
  });
}

function GenerationSettingsSheet({
  mealTitle,
  target,
  strategy,
  requiredFoods,
  avoidedFoods,
  activeFilter,
  filterInput,
  foodResults,
  foodSearchLoading,
  error,
  generationMode,
  busy,
  onClose,
  onStrategyChange,
  onActiveFilterChange,
  onFilterInputChange,
  onAddFilter,
  onSelectFood,
  onRemoveFilter,
  onGenerationModeChange,
  onCancel,
  onReset,
  onConfirm,
  dialogRef,
  closeRef,
  titleId,
}) {
  const includeTerms = Array.isArray(requiredFoods) ? requiredFoods : [];
  const excludeTerms = Array.isArray(avoidedFoods) ? avoidedFoods : [];
  const modeOptions = [
    {
      key: "library",
      label: "Buscar en biblioteca",
      description: "Encontrá opciones compatibles.",
      Icon: Library,
      tone: "emerald",
    },
    {
      key: "combine",
      label: "Combinar comidas",
      description: "Mezclá opciones que ya tenés.",
      Icon: Layers3,
      tone: "gold",
    },
    {
      key: "scratch",
      label: "Desde cero",
      description: "Armá una comida nueva.",
      Icon: PencilLine,
      tone: "gold",
    },
  ];

  return (
    <section className="fixed inset-0 z-[110] flex items-end justify-center bg-black/82 p-0 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        ref={dialogRef}
        className="flex max-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[radial-gradient(circle_at_10%_0,rgba(20,184,166,.12),transparent_31%),radial-gradient(circle_at_100%_10%,rgba(212,175,55,.11),transparent_28%),linear-gradient(180deg,#071019,#060b11)] shadow-[0_-24px_80px_rgba(0,0,0,.72)] sm:max-h-[94dvh] sm:rounded-[2rem]"
      >
        <header className="shrink-0 border-b border-white/[0.07] px-4 pb-3 pt-[calc(.8rem+env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#D8B742]">Automático</span>
              <h3 id={titleId} className="mt-0.5 text-[21px] font-black leading-tight text-white">Ajustes de generación</h3>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[0.045] text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,.28)] disabled:opacity-50" aria-label="Cerrar ajustes de generación">
              <X size={20} />
            </button>
          </div>

          <div className="mt-2.5 flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/35 bg-emerald-300/[0.07] text-[#FFD65C] shadow-[0_0_20px_rgba(16,185,129,.15)]" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <strong className="max-w-[92px] shrink truncate text-[13px] font-black text-white">{mealTitle}</strong>
            <span className="shrink-0 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2 py-1 text-[9px] font-black text-[#FFD966]">{format(target.kcal)} kcal</span>
            <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black text-zinc-300">P {format(target.proteina, 1)} g</span>
            <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black text-zinc-300">C {format(target.carbs, 1)} g</span>
            <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black text-zinc-300">G {format(target.grasas, 1)} g</span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto px-3 py-3">
          <div className="grid gap-2.5">
            <section className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={strategy === "selected_only"} onClick={() => onStrategyChange("selected_only")} className={`min-h-[104px] rounded-2xl border p-3 text-left transition ${strategy === "selected_only" ? "border-emerald-300/45 bg-emerald-300/[0.09] shadow-[inset_0_0_24px_rgba(16,185,129,.08)]" : "border-white/10 bg-white/[0.025]"}`}>
                <span className="flex items-start justify-between gap-2">
                  <CircleUserRound size={20} className="text-emerald-300" />
                  <span className={`relative h-6 w-10 rounded-full border transition ${strategy === "selected_only" ? "border-emerald-300/40 bg-emerald-400" : "border-white/10 bg-zinc-700"}`} aria-hidden="true">
                    <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition ${strategy === "selected_only" ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                </span>
                <strong className="mt-2 block text-[13px] font-black leading-tight text-white">Usar solo mis alimentos</strong>
                <span className="mt-1 block text-[10px] font-bold leading-snug text-zinc-500">No agrega alimentos nuevos.</span>
              </button>
              <button type="button" aria-pressed={strategy === "assisted_food_addition"} onClick={() => onStrategyChange("assisted_food_addition")} className={`min-h-[104px] rounded-2xl border p-3 text-left transition ${strategy === "assisted_food_addition" ? "border-[#D4AF37]/45 bg-[#D4AF37]/[0.09] shadow-[inset_0_0_24px_rgba(212,175,55,.07)]" : "border-white/10 bg-white/[0.025]"}`}>
                <span className="flex items-start justify-between gap-2">
                  <Sparkles size={20} className="text-[#FFD65C]" />
                  <span className={`relative h-6 w-10 rounded-full border transition ${strategy === "assisted_food_addition" ? "border-[#F5C842]/40 bg-[#E3B627]" : "border-white/10 bg-zinc-700"}`} aria-hidden="true">
                    <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition ${strategy === "assisted_food_addition" ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                </span>
                <strong className="mt-2 block text-[13px] font-black leading-tight text-white">Permitir sugerencias</strong>
                <span className="mt-1 block text-[10px] font-bold leading-snug text-zinc-500">Puede sumar opciones compatibles.</span>
              </button>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.025]">
              <div className="border-b border-white/[0.07] p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="flex items-center gap-2 text-xs font-black text-zinc-100"><Check size={15} className="text-emerald-300" /> Debe incluir</strong>
                  <span className="text-[10px] font-black text-emerald-300">{includeTerms.length} agregados</span>
                </div>
                <div className="mt-2 flex min-h-8 flex-wrap gap-1.5">
                  {includeTerms.map((food) => (
                    <button key={food.id} type="button" onClick={() => onRemoveFilter("include", food.id)} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 text-[11px] font-black text-zinc-200" aria-label={`Quitar ${food.name} de alimentos requeridos`}>
                      {food.name}<X size={12} />
                    </button>
                  ))}
                  <button type="button" onClick={() => onActiveFilterChange("include")} className={`grid h-8 w-8 place-items-center rounded-full border border-dashed ${activeFilter === "include" ? "border-emerald-300/45 text-emerald-300" : "border-white/15 text-zinc-500"}`} aria-label="Agregar alimento requerido"><Plus size={14} /></button>
                </div>
              </div>
              <div className="border-b border-white/[0.07] p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="flex items-center gap-2 text-xs font-black text-zinc-100"><X size={15} className="text-rose-400" /> Evitar</strong>
                  <span className="text-[10px] font-black text-rose-400">{excludeTerms.length} agregados</span>
                </div>
                <div className="mt-2 flex min-h-8 flex-wrap gap-1.5">
                  {excludeTerms.map((food) => (
                    <button key={food.id} type="button" onClick={() => onRemoveFilter("exclude", food.id)} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 text-[11px] font-black text-zinc-200" aria-label={`Quitar ${food.name} de alimentos a evitar`}>
                      {food.name}<X size={12} />
                    </button>
                  ))}
                  <button type="button" onClick={() => onActiveFilterChange("exclude")} className={`grid h-8 w-8 place-items-center rounded-full border border-dashed ${activeFilter === "exclude" ? "border-rose-300/45 text-rose-300" : "border-white/15 text-zinc-500"}`} aria-label="Agregar alimento a evitar"><Plus size={14} /></button>
                </div>
              </div>
              <form className="p-3" onSubmit={(event) => { event.preventDefault(); onAddFilter(); }}>
                <label className={`flex min-h-11 items-center gap-2 rounded-xl border bg-black/25 px-3 ${activeFilter === "include" ? "border-emerald-300/20" : "border-rose-300/20"}`}>
                  <Search size={16} className="shrink-0 text-zinc-500" />
                  <input value={filterInput} onChange={(event) => onFilterInputChange(event.target.value)} placeholder={activeFilter === "include" ? "Agregar alimento requerido" : "Agregar alimento a evitar"} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600" aria-label={activeFilter === "include" ? "Nuevo alimento requerido" : "Nuevo alimento a evitar"} />
                  {foodSearchLoading ? <RefreshCw size={14} className="animate-spin text-zinc-500" aria-label="Buscando alimentos" /> : null}
                  <button type="submit" disabled={!filterInput.trim()} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.045] text-zinc-300 disabled:opacity-30" aria-label="Agregar filtro"><Plus size={14} /></button>
                </label>
                {foodResults.length ? (
                  <div className="mt-2 grid max-h-36 gap-1 overflow-y-auto rounded-xl border border-white/10 bg-[#081019] p-1.5" role="listbox" aria-label="Alimentos encontrados">
                    {foodResults.map((food) => (
                      <button key={food.id} type="button" role="option" aria-selected="false" onClick={() => onSelectFood(food)} className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 text-left hover:bg-white/[0.05]">
                        <span className="min-w-0 truncate text-xs font-black text-zinc-100">{food.name}</span>
                        <Plus size={14} className={activeFilter === "include" ? "text-emerald-300" : "text-rose-300"} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </form>
            </section>

            <section className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-3">
              <strong className="flex items-center gap-2 text-xs font-black text-white"><Sparkles size={16} className="text-emerald-300" /> ¿Cómo querés que genere?</strong>
              <div className="mt-2.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Método de generación">
                {modeOptions.map(({ key, label, description, Icon, tone }) => {
                  const selected = generationMode === key;
                  const accent = tone === "emerald" ? "text-emerald-300" : "text-[#FFD65C]";
                  return (
                    <button key={key} type="button" role="radio" aria-checked={selected} onClick={() => onGenerationModeChange(key)} className={`relative min-h-[108px] rounded-2xl border p-2.5 text-left transition ${selected ? "border-emerald-300/40 bg-emerald-300/[0.085] shadow-[inset_0_0_24px_rgba(16,185,129,.08)]" : "border-[#D4AF37]/18 bg-[#D4AF37]/[0.035]"}`}>
                      {selected ? <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-black"><Check size={12} strokeWidth={3} /></span> : null}
                      {React.createElement(Icon, { size: 19, className: accent, "aria-hidden": true })}
                      <strong className={`mt-2 block text-[11px] font-black leading-tight ${selected ? "text-emerald-200" : "text-[#FFE089]"}`}>{label}</strong>
                      <span className="mt-1 block text-[9px] font-bold leading-snug text-zinc-500">{description}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            {error ? <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-2.5 text-xs font-bold text-rose-100" role="alert">{error}</div> : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/[0.08] bg-[#071018]/96 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-2.5">
          <div className="grid grid-cols-[minmax(0,.95fr)_minmax(0,1.25fr)] gap-2">
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <button type="button" onClick={onCancel} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-1 border-r border-white/10 px-2 text-[11px] font-black text-zinc-200 disabled:opacity-50"><X size={14} /> Cancelar</button>
              <button type="button" onClick={onReset} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-1 px-2 text-[10px] font-black text-zinc-500 disabled:opacity-50"><RotateCcw size={13} /> Restablecer</button>
            </div>
            <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200/30 bg-[linear-gradient(135deg,#06c994,#03a982)] px-3 text-[12px] font-black text-[#02130e] shadow-[0_10px_28px_rgba(16,185,129,.22)] disabled:opacity-50">
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} {busy ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}

export default function EquivalentMealBuilder({
  context = {},
  canAuto = false,
  maxFoods = 6,
  saving = false,
  onClose,
  onApply,
}) {
  const row = context.row || {};
  const meal = useMemo(
    () => context.baseMeal || context.meal || {},
    [context.baseMeal, context.meal]
  );
  const mealIndex = Number(context.mealIndex) || 0;
  const mealId = String(meal.id || meal._id || meal.nombre || meal.name || `meal-${mealIndex + 1}`);
  const mealTitle = meal.name || meal.nombre || `Comida ${mealIndex + 1}`;
  const target = useMemo(() => equivalentMealTarget(meal), [meal]);
  const [draftOwner] = useState(() => trackingDraftStorageOwner(getCachedUser() || {}));
  const menuId = String(
    context.menuId ||
    row?.tracking?.menuId ||
    row?.assignment?.primaryMenu?.menuId ||
    row?.assignment?.menuId ||
    "menu"
  );
  const menuVersion = String(
    context.menuVersion ||
    row?.assignment?.primaryMenu?.menuSnapshot?.snapshotVersion ||
    row?.assignment?.primaryMenu?.assignedAt ||
    row?.assignment?.assignedAt ||
    "1"
  );
  const storageKey = useMemo(
    () => equivalentMealDraftStorageKey(draftOwner, row.date, mealId, menuId, "full_meal"),
    [draftOwner, mealId, menuId, row.date]
  );
  const [initialDraftState] = useState(() => {
    const persisted = loadDraftState(storageKey, maxFoods);
    if (persisted.drafts.length) return persisted;
    return {
      ...persisted,
      drafts: draftsFromSeedFoods(context.seedFoods, maxFoods),
    };
  });
  const [drafts, setDrafts] = useState(initialDraftState.drafts);
  const [strategy, setStrategy] = useState(initialDraftState.strategy);
  const [rejectedSuggestionFoodIds, setRejectedSuggestionFoodIds] = useState(initialDraftState.rejectedSuggestionFoodIds);
  const [requestId] = useState(() => initialDraftState.requestId || createEquivalentDraftRequestId(draftOwner, row.date, mealId));
  const [warnings, setWarnings] = useState(initialDraftState.warnings);
  const [favoriteOriginId, setFavoriteOriginId] = useState(initialDraftState.favoriteOriginId);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [foodEditorOpen, setFoodEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [generationNotice, setGenerationNotice] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [optimization, setOptimization] = useState(null);
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [confirmOverage, setConfirmOverage] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryMeals, setLibraryMeals] = useState([]);
  const [libraryError, setLibraryError] = useState("");
  const [libraryInclude, setLibraryInclude] = useState("");
  const [libraryExclude, setLibraryExclude] = useState("");
  const [settingsSheetOpen] = useState(context.initialSection === "settings");
  const [settingsFilterTarget, setSettingsFilterTarget] = useState("include");
  const [settingsFilterInput, setSettingsFilterInput] = useState("");
  const [settingsGenerationMode, setSettingsGenerationMode] = useState("library");
  const [settingsRequiredFoods, setSettingsRequiredFoods] = useState([]);
  const [settingsAvoidedFoods, setSettingsAvoidedFoods] = useState([]);
  const [settingsFoodResults, setSettingsFoodResults] = useState([]);
  const [settingsFoodSearching, setSettingsFoodSearching] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [generatedAlternatives, setGeneratedAlternatives] = useState([]);
  const [generatedAlternativeIndex, setGeneratedAlternativeIndex] = useState(-1);
  const [generatedConstraintSignature, setGeneratedConstraintSignature] = useState(initialDraftState.generatedConstraintSignature || "");
  const [draftState, setDraftState] = useState(initialDraftState.drafts.length ? "SUCCESS" : "EMPTY");
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = `equivalent-meal-${mealIndex}-title`;

  const totals = useMemo(() => trackingDraftsNutritionTotals(drafts), [drafts]);
  const comparison = useMemo(() => equivalentMealComparison(target, totals), [target, totals]);
  const calculationFeedback = useMemo(() => optimization ? buildTrackingQuantityInlineFeedback({
    target,
    proposal: totals,
    configured: {
      kcal: target.kcal > 0,
      proteina: target.proteina > 0,
      carbs: target.carbs > 0,
      grasas: target.grasas > 0,
    },
    optimization,
  }) : null, [optimization, target, totals]);
  const ready = trackingDraftsReadyToConfirm(drafts);
  const visibleLibraryMeals = useMemo(() => filterEquivalentLibraryMeals(libraryMeals, {
    include: libraryInclude,
    exclude: libraryExclude,
  }), [libraryExclude, libraryInclude, libraryMeals]);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape" && !saving && !calculating && !settingsSaving) onClose?.();
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [calculating, onClose, saving, settingsSaving]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (drafts.length) window.localStorage.setItem(storageKey, JSON.stringify({
        version: 2,
        drafts,
        strategy,
        rejectedSuggestionFoodIds,
        requestId,
        warnings,
        favoriteOriginId,
        generatedConstraintSignature,
        target,
        menuId,
        menuVersion,
      }));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // El flujo sigue funcionando aunque el navegador bloquee storage.
    }
  }, [drafts, favoriteOriginId, generatedConstraintSignature, menuId, menuVersion, rejectedSuggestionFoodIds, requestId, storageKey, strategy, target, warnings]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearched(true);
      listAlimentos({ search: term, limit: 12 })
        .then((response) => {
          if (active) setResults(resultsFrom(response).slice(0, 12));
        })
        .catch((searchError) => {
          if (active) {
            setError(searchError?.message || "No pudimos buscar alimentos.");
            setResults([]);
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    if (!settingsSheetOpen) return undefined;
    const term = settingsFilterInput.trim();
    if (term.length < 2) {
      setSettingsFoodResults([]);
      setSettingsFoodSearching(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSettingsFoodSearching(true);
      listAlimentos({ search: term, limit: 8 })
        .then((response) => {
          if (!active) return;
          const blockedIds = new Set([
            ...settingsRequiredFoods.map((food) => food.id),
            ...settingsAvoidedFoods.map((food) => food.id),
          ]);
          setSettingsFoodResults(resultsFrom(response)
            .map((food) => ({
              ...food,
              id: String(food.id || food._id || food.alimentoId || ""),
              name: foodName(food),
            }))
            .filter((food) => food.id && !blockedIds.has(food.id))
            .slice(0, 8));
        })
        .catch((searchError) => {
          if (active) {
            setSettingsError(searchError?.message || "No pudimos buscar alimentos.");
            setSettingsFoodResults([]);
          }
        })
        .finally(() => {
          if (active) setSettingsFoodSearching(false);
        });
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [settingsAvoidedFoods, settingsFilterInput, settingsRequiredFoods, settingsSheetOpen]);

  function clearResult() {
    setOptimization(null);
    setConfirmOverage(false);
    setError("");
  }

  function invalidateGeneratedAlternatives() {
    setGeneratedAlternatives([]);
    setGeneratedAlternativeIndex(-1);
    setGeneratedConstraintSignature("");
  }

  function draftsFromGeneratedAlternative(alternative = {}, optionIndex = 0) {
    return generatedAlternativeToDrafts(alternative, (food, index) => {
      const normalizedFood = responseCandidateFood(food);
      const draft = createTrackingFoodDraft(
        normalizedFood,
        "",
        `generated-${food.foodId || food.id || index}-${optionIndex}`,
        "calorie_fill"
      );
      return {
        ...markTrackingDraftAutomatic(draft),
        quantity: Number(food.quantity ?? food.cantidad) || "",
        status: "calculated",
        suggested: true,
        source: "generatedAlternative",
      };
    }, maxFoods, optionIndex);
  }

  function showGeneratedAlternative(alternatives, index) {
    const selected = alternatives[index];
    if (!selected) return false;
    const nextDrafts = draftsFromGeneratedAlternative(selected, index);
    if (!nextDrafts.length || !trackingDraftsReadyToConfirm(nextDrafts)) return false;
    setDrafts(nextDrafts);
    setStrategy(selected.foods.length > settingsRequiredFoods.length
      ? "assisted_food_addition"
      : strategy);
    setOptimization(selected.optimization || null);
    setWarnings(Array.isArray(selected.warnings) ? selected.warnings : []);
    setGeneratedAlternativeIndex(index);
    setDraftState("SUCCESS");
    setError("");
    setGenerationNotice(selected.status === "TARGET_NOT_REACHABLE_WITH_SELECTED_FOODS"
      ? "Mejor aproximacion posible usando solamente los alimentos requeridos."
      : selected.status === "BEST_EFFORT"
        ? "Completamos las calorias con la mejor aproximacion posible para estos alimentos."
        : "Alternativa calculada. Generar otra opcion recorre el mismo ranking sin azar.");
    return true;
  }

  function addFood(food) {
    if (drafts.length >= maxFoods) {
      setError(`Tu acceso permite hasta ${maxFoods} alimentos en una comida equivalente.`);
      return;
    }
    const id = String(food.id || food._id || food.alimentoId || foodName(food));
    if (drafts.some((draft) => draft.foodId === id)) {
      setError("Ese alimento ya esta en la propuesta.");
      return;
    }
    const quantity = canAuto ? "" : suggestedQuantity(food);
    setDrafts((current) => [
      ...current,
      createTrackingFoodDraft(food, quantity, `equivalent-${id}-${Date.now()}`, "calorie_fill"),
    ]);
    setSearch("");
    setResults([]);
    clearResult();
    invalidateGeneratedAlternatives();
    setDraftState("SUCCESS");
  }

  function removeFood(id) {
    setDrafts((current) => {
      const removed = current.find((draft) => draft.id === id);
      if (removed?.suggested && removed.foodId) {
        setRejectedSuggestionFoodIds((items) => [...new Set([...items, String(removed.foodId)])].slice(0, 40));
      }
      return current.filter((draft) => draft.id !== id);
    });
    clearResult();
    invalidateGeneratedAlternatives();
    setDraftState("SUCCESS");
  }

  function changeStrategy(nextStrategy) {
    const next = nextStrategy === "assisted_food_addition" ? nextStrategy : "selected_only";
    setStrategy(next);
    if (next === "selected_only") {
      setDrafts((current) => current.filter((draft) => !draft.suggested));
    }
    clearResult();
    invalidateGeneratedAlternatives();
  }

  function updateQuantity(id, value) {
    setDrafts((current) => current.map((draft) => (
      draft.id === id ? updateTrackingFoodDraftQuantity(draft, value) : draft
    )));
    clearResult();
    invalidateGeneratedAlternatives();
  }

  function toggleMode(id) {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== id) return draft;
      if (isTrackingDraftAutomatic(draft)) {
        const withQuantity = draft.quantity
          ? draft
          : updateTrackingFoodDraftQuantity(draft, suggestedQuantity(draft.food));
        return markTrackingDraftManual(withQuantity);
      }
      if (!canAuto) return draft;
      return markTrackingDraftAutomatic(draft);
    }));
    clearResult();
    invalidateGeneratedAlternatives();
  }

  async function calculate() {
    if (!canAuto) {
      setError("El calculo automatico no esta incluido en este acceso. Podes definir las cantidades manualmente.");
      return;
    }
    if (!drafts.length) {
      setError("Agrega al menos un alimento.");
      return;
    }
    const input = trackingDraftCalculationPayload(drafts);
    if (!input.pendingFoods.length) {
      setError("Marca al menos un alimento como Auto para recalcularlo.");
      return;
    }
    if (input.fixedTotals.kcal >= target.kcal && target.kcal > 0) {
      setError("Las cantidades Manuales ya completan o superan las calorias de esta comida.");
      return;
    }
    try {
      setCalculating(true);
      setError("");
      const response = await calculateTrackingQuantities(buildTrackingQuantityCalculationRequest({
        date: row.date,
        target,
        trackingQuantityMode: "calorie_fill",
        fixedFoods: input.fixedFoods,
        pendingFoods: input.pendingFoods,
        generationStrategy: strategy,
        rejectedSuggestionFoodIds,
      }));
      if (response?.status === "error" || !Array.isArray(response?.foods) || !response.foods.length) {
        throw new Error(response?.message || "No se encontro una combinacion valida.");
      }
      let calculationDrafts = drafts;
      const addedCandidates = response.foods.filter((food) => food?.source === "addedCandidate");
      if (addedCandidates.length) {
        const additions = addedCandidates
          .filter((food) => !calculationDrafts.some((draft) => String(draft.foodId) === String(food.foodId || food.alimentoId || food.id)))
          .slice(0, Math.max(0, maxFoods - calculationDrafts.length))
          .map((food, index) => ({
            ...createTrackingFoodDraft(
              responseCandidateFood(food),
              "",
              `suggested-${food.foodId || food.id || index}-${Date.now()}`,
              "calorie_fill"
            ),
            suggested: true,
            source: "addedCandidate",
          }));
        calculationDrafts = [...calculationDrafts, ...additions];
      }
      const proposals = trackingDraftProposals(calculationDrafts, response.foods);
      if (proposals.length !== calculationDrafts.length) {
        throw new Error("No se obtuvo una cantidad valida para todos los alimentos.");
      }
      const nextDrafts = applyTrackingDraftProposals(calculationDrafts, proposals, "calorie_fill");
      if (!trackingDraftsReadyToConfirm(nextDrafts)) {
        throw new Error("Revisa los alimentos: alguna cantidad no es fisicamente valida.");
      }
      setDrafts(nextDrafts);
      setOptimization(response.optimization || null);
      setWarnings(Array.isArray(response.warnings) ? response.warnings : []);
    } catch (calculationError) {
      setError(calculationError?.message || "No pudimos calcular las cantidades.");
    } finally {
      setCalculating(false);
    }
  }

  async function loadLibrary(scope = "all", filterOverrides = {}) {
    try {
      setLibraryOpen(true);
      setLibraryLoading(true);
      setLibraryError("");
      const includeValue = filterOverrides.include ?? libraryInclude;
      const primaryFoodFilter = String(includeValue).split(",").map((term) => term.trim()).find(Boolean) || "";
      const data = await listLibraryMeals({
        scope,
        tipoComida: meal.tipoComida || meal.type || "todos",
        search: primaryFoodFilter,
        targetKcal: target.kcal,
        targetProteina: target.proteina,
        targetCarbs: target.carbs,
        targetGrasas: target.grasas,
        limit: 20,
      });
      setLibraryMeals(Array.isArray(data?.comidas) ? data.comidas : []);
    } catch (libraryLoadError) {
      setLibraryError(libraryLoadError?.message || "No pudimos buscar comidas equivalentes.");
      setLibraryMeals([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function generateAlternativeDraft() {
    setError("");
    setGenerationNotice("");
    if (settingsGenerationMode === "library") {
      loadLibrary("all");
      return;
    }
    setLibraryOpen(false);
    if (!canAuto) {
      setDraftState("ERROR");
      setError("La generacion automatica no esta habilitada para este acceso.");
      return;
    }
    const signature = generationConstraintSignature({
      strategy,
      requiredFoods: settingsRequiredFoods,
      avoidedFoods: settingsAvoidedFoods,
    });
    if (signature === generatedConstraintSignature && generatedAlternatives.length > 1) {
      const nextIndex = nextGeneratedAlternativeIndex(generatedAlternativeIndex, generatedAlternatives);
      showGeneratedAlternative(generatedAlternatives, nextIndex);
      return;
    }
    if (strategy === "selected_only" && !settingsRequiredFoods.length) {
      setDraftState("NO_SOLUTION");
      setError("En Usar solo mis alimentos, agrega al menos un alimento en Debe incluir.");
      return;
    }
    try {
      setCalculating(true);
      setDraftState("LOADING");
      const response = await generateEquivalentMealAlternative({
        menuId,
        mealId,
        mealName: mealTitle,
        mealType: meal.tipoComida || meal.type || meal.mealType || "otra",
        target,
        limit: 32,
      });
      const alternatives = [response?.alternative, ...(response?.alternatives || [])].filter(Boolean);
      if (response?.status !== "SUCCESS" || !alternatives.length) {
        setDraftState("NO_SOLUTION");
        setDrafts([]);
        setOptimization(null);
        setError(response?.code === "TARGET_NOT_REACHABLE_WITH_SELECTED_FOODS"
          ? "No encontramos una cantidad valida usando solamente los alimentos seleccionados."
          : "No encontramos una combinacion compatible con esta meta y estos ajustes.");
        return;
      }
      setGeneratedAlternatives(alternatives);
      setGeneratedConstraintSignature(signature);
      if (!showGeneratedAlternative(alternatives, 0)) {
        throw new Error("La alternativa no devolvio cantidades fisicamente validas.");
      }
    } catch (generationError) {
      setDraftState("ERROR");
      setError(generationError?.message || "No pudimos generar la alternativa.");
    } finally {
      setCalculating(false);
    }
  }

  useEffect(() => {
    let active = true;
    setSettingsLoading(true);
    getEquivalentMealGenerationSettings({ menuId, mealId, mealName: mealTitle })
      .then((saved) => {
        if (!active || !saved) return;
        const requiredFoods = Array.isArray(saved.requiredFoods) ? saved.requiredFoods : [];
        const avoidedFoods = Array.isArray(saved.avoidedFoods) ? saved.avoidedFoods : [];
        const includeNames = requiredFoods.map((food) => food.name).filter(Boolean).join(", ");
        const excludeNames = avoidedFoods.map((food) => food.name).filter(Boolean).join(", ");
        setSettingsRequiredFoods(requiredFoods);
        setSettingsAvoidedFoods(avoidedFoods);
        setLibraryInclude(includeNames);
        setLibraryExclude(excludeNames);
        setStrategy(saved.strategy === "assisted_food_addition" ? saved.strategy : "selected_only");
        setSettingsGenerationMode(["library", "combine", "scratch"].includes(saved.generationMode) ? saved.generationMode : "library");
        const currentSignature = generationConstraintSignature({
          strategy: saved.strategy,
          requiredFoods,
          avoidedFoods,
        });
        if (initialDraftState.generatedConstraintSignature && initialDraftState.generatedConstraintSignature !== currentSignature) {
          setDrafts([]);
          setDraftState("EMPTY");
          invalidateGeneratedAlternatives();
          try {
            if (storageKey) window.localStorage.removeItem(storageKey);
          } catch {
            // La configuracion nueva igualmente invalida el borrador en memoria.
          }
        }
      })
      .catch((loadError) => {
        if (!active) return;
        setSettingsError(loadError?.message || "No pudimos cargar los ajustes guardados.");
      })
      .finally(() => {
        if (active) setSettingsLoading(false);
      });
    return () => {
      active = false;
    };
    // Se recupera una sola configuracion para el menu y la comida que abrieron el dialogo.
  }, [initialDraftState.generatedConstraintSignature, mealId, mealTitle, menuId, storageKey]);

  function applyLibraryMeal(libraryMeal = {}, adjust = false) {
    const sourceItems = Array.isArray(libraryMeal.items) ? libraryMeal.items : [];
    const next = sourceItems.slice(0, maxFoods).map((item, index) => {
      const food = libraryItemFood(item);
      const preserveManual = !adjust || item.quantityMode === "manual";
      return {
        ...createTrackingFoodDraft(
          food,
          preserveManual ? Number(item.cantidad ?? item.quantity) || "" : "",
          `library-${libraryMeal.id || "meal"}-${food.id || index}-${Date.now()}`,
          "calorie_fill"
        ),
        favoriteOriginId: libraryMeal.id || "",
      };
    });
    setDrafts(next);
    setFavoriteOriginId(String(libraryMeal.id || ""));
    setStrategy("selected_only");
    setOptimization(null);
    setWarnings([]);
    setLibraryOpen(false);
    setError(libraryMeal?.equivalence?.requiresAdjustment && !adjust
      ? "Esta comida fue creada con otra meta. Revisa las diferencias o usa Ajustar a mi objetivo."
      : "");
  }

  async function apply() {
    if (!ready) {
      setError(canAuto
        ? "Completa las cantidades o usa Calcular cantidades."
        : "Completa una cantidad valida para cada alimento.");
      return;
    }
    if (comparison.exceedsCalories && !confirmOverage) {
      setConfirmOverage(true);
      setError(`La propuesta supera la meta por ${format(comparison.diff.kcal, 0)} kcal. Revisa las cantidades o toca Guardar igualmente.`);
      return;
    }
    const equivalentMeal = buildEquivalentMealFromDrafts({
      drafts,
      originalMealName: mealTitle,
      originalMealId: mealId,
      date: row.date,
      menuId,
      menuVersion,
      mealType: meal.tipoComida || meal.type || "otro",
      strategy,
      requestId,
      warnings,
      favoriteOriginId,
      target,
    });
    if (!equivalentMeal) {
      setError("No pudimos preparar una comida valida para guardar.");
      return;
    }
    if (comparison.exceedsCalories && confirmOverage) {
      equivalentMeal.warningAccepted = true;
      equivalentMeal.acceptedWarnings = [
        ...new Set([...(equivalentMeal.acceptedWarnings || []), "calorie_over_target"]),
      ];
    }
    try {
      await onApply?.({
        row,
        originalMeal: meal,
        replacementMeal: equivalentMeal,
        mealIndex,
        saveTemplate,
      });
      if (storageKey) window.localStorage.removeItem(storageKey);
      setDrafts([]);
    } catch (applyError) {
      setError(applyError?.message || "No pudimos guardar la comida equivalente.");
    }
  }

  function discard() {
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
    } catch {
      // Sin accion adicional.
    }
    setDrafts([]);
    setDraftState("EMPTY");
    invalidateGeneratedAlternatives();
    onClose?.();
  }

  function addSettingsFilter() {
    const normalized = settingsFilterInput.trim().toLocaleLowerCase("es");
    if (!normalized) return;
    const exact = settingsFoodResults.find((food) => food.name.toLocaleLowerCase("es") === normalized);
    const candidate = exact || (settingsFoodResults.length === 1 ? settingsFoodResults[0] : null);
    if (!candidate) {
      setSettingsError("Elegí un alimento de los resultados de la base.");
      return;
    }
    selectSettingsFood(candidate);
  }

  function selectSettingsFood(food) {
    const normalized = {
      id: String(food?.id || food?._id || food?.alimentoId || ""),
      name: foodName(food),
    };
    if (!normalized.id) return;
    if (settingsFilterTarget === "exclude") {
      const nextAvoided = [...settingsAvoidedFoods.filter((item) => item.id !== normalized.id), normalized];
      const nextRequired = settingsRequiredFoods.filter((item) => item.id !== normalized.id);
      setSettingsAvoidedFoods(nextAvoided);
      setSettingsRequiredFoods(nextRequired);
      setLibraryExclude(nextAvoided.map((item) => item.name).join(", "));
      setLibraryInclude(nextRequired.map((item) => item.name).join(", "));
    } else {
      const nextRequired = [...settingsRequiredFoods.filter((item) => item.id !== normalized.id), normalized];
      const nextAvoided = settingsAvoidedFoods.filter((item) => item.id !== normalized.id);
      setSettingsRequiredFoods(nextRequired);
      setSettingsAvoidedFoods(nextAvoided);
      setLibraryInclude(nextRequired.map((item) => item.name).join(", "));
      setLibraryExclude(nextAvoided.map((item) => item.name).join(", "));
    }
    setSettingsFilterInput("");
    setSettingsFoodResults([]);
    setSettingsError("");
    invalidateGeneratedAlternatives();
  }

  function removeSettingsFilter(type, foodId) {
    if (type === "exclude") {
      const next = settingsAvoidedFoods.filter((food) => food.id !== foodId);
      setSettingsAvoidedFoods(next);
      setLibraryExclude(next.map((food) => food.name).join(", "));
    } else {
      const next = settingsRequiredFoods.filter((food) => food.id !== foodId);
      setSettingsRequiredFoods(next);
      setLibraryInclude(next.map((food) => food.name).join(", "));
    }
    setSettingsError("");
    invalidateGeneratedAlternatives();
  }

  function resetGenerationSettings() {
    changeStrategy("selected_only");
    setLibraryInclude("");
    setLibraryExclude("");
    setSettingsRequiredFoods([]);
    setSettingsAvoidedFoods([]);
    setSettingsFoodResults([]);
    setSettingsFilterTarget("include");
    setSettingsFilterInput("");
    setSettingsGenerationMode("library");
    invalidateGeneratedAlternatives();
  }

  async function saveGenerationSettings() {
    try {
      setSettingsSaving(true);
      setSettingsError("");
      const saved = await saveEquivalentMealGenerationSettings({
        menuId,
        mealId,
        mealName: mealTitle,
        strategy,
        generationMode: settingsGenerationMode,
        requiredFoods: settingsRequiredFoods.map((food) => ({ id: food.id })),
        avoidedFoods: settingsAvoidedFoods.map((food) => ({ id: food.id })),
      });
      if (saved) {
        setSettingsRequiredFoods(Array.isArray(saved.requiredFoods) ? saved.requiredFoods : []);
        setSettingsAvoidedFoods(Array.isArray(saved.avoidedFoods) ? saved.avoidedFoods : []);
      }
      try {
        if (storageKey) window.localStorage.removeItem(storageKey);
      } catch {
        // La configuracion queda guardada aunque storage no este disponible.
      }
      setDrafts([]);
      setDraftState("EMPTY");
      invalidateGeneratedAlternatives();
      onClose?.();
    } catch (saveError) {
      setSettingsError(saveError?.message || "No pudimos guardar los ajustes.");
    } finally {
      setSettingsSaving(false);
    }
  }

  if (settingsSheetOpen) {
    return (
      <GenerationSettingsSheet
        mealTitle={mealTitle}
        target={target}
        strategy={strategy}
        requiredFoods={settingsRequiredFoods}
        avoidedFoods={settingsAvoidedFoods}
        activeFilter={settingsFilterTarget}
        filterInput={settingsFilterInput}
        foodResults={settingsFoodResults}
        foodSearchLoading={settingsFoodSearching}
        error={settingsError}
        generationMode={settingsGenerationMode}
        busy={saving || calculating || settingsLoading || settingsSaving}
        onClose={onClose}
        onStrategyChange={changeStrategy}
        onActiveFilterChange={setSettingsFilterTarget}
        onFilterInputChange={setSettingsFilterInput}
        onAddFilter={addSettingsFilter}
        onSelectFood={selectSettingsFood}
        onRemoveFilter={removeSettingsFilter}
        onGenerationModeChange={setSettingsGenerationMode}
        onCancel={onClose}
        onReset={resetGenerationSettings}
        onConfirm={saveGenerationSettings}
        dialogRef={dialogRef}
        closeRef={closeRef}
        titleId={titleId}
      />
    );
  }

  return (
    <section className="fixed inset-0 z-[110] flex items-end bg-black/82 p-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={dialogRef} className="mx-auto flex h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_12%_0,rgba(20,184,166,.14),transparent_33%),radial-gradient(circle_at_100%_5%,rgba(212,175,55,.12),transparent_28%),linear-gradient(180deg,#08131b,#050a10)] shadow-[0_30px_100px_rgba(0,0,0,.78)] sm:h-auto sm:max-h-[94dvh] sm:rounded-[2rem]">
        <header className="shrink-0 border-b border-white/[0.08] px-3.5 pb-3 pt-[calc(.8rem+env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/35 bg-emerald-300/[0.08] text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,.13)]" aria-hidden="true"><WandSparkles size={20} /></span>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">Mi equivalente</span>
                <h3 id={titleId} className="truncate text-[20px] font-black leading-tight text-white">Armar alternativa</h3>
                <p className="truncate text-[10px] font-bold text-zinc-400">{mealTitle} · <b className="text-emerald-200">{format(target.kcal)} kcal objetivo</b></p>
              </div>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} disabled={saving || calculating} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[0.045] text-zinc-200 disabled:opacity-50" aria-label="Cerrar y conservar borrador"><X size={19} /></button>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[10px] font-black">
            <span className="rounded-xl border border-rose-300/15 bg-rose-300/[0.045] px-2 py-1.5 text-rose-100">P&nbsp; {format(target.proteina, 1)} g</span>
            <span className="rounded-xl border border-sky-300/15 bg-sky-300/[0.045] px-2 py-1.5 text-sky-100">C&nbsp; {format(target.carbs, 1)} g</span>
            <span className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] px-2 py-1.5 text-amber-100">G&nbsp; {format(target.grasas, 1)} g</span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto px-3 py-3 sm:p-5">
          <div className="grid gap-2.5">
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-1.5">
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Origen de la alternativa">
                <button type="button" role="radio" aria-checked={settingsGenerationMode === "library"} onClick={() => setSettingsGenerationMode("library")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-[11px] font-black transition ${settingsGenerationMode === "library" ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-transparent bg-black/15 text-zinc-500"}`}>
                  <Database size={15} /> Usar de la base
                </button>
                <button type="button" role="radio" aria-checked={settingsGenerationMode !== "library"} onClick={() => setSettingsGenerationMode("scratch")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-[11px] font-black transition ${settingsGenerationMode !== "library" ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#FFE080]" : "border-transparent bg-black/15 text-zinc-500"}`}>
                  <WandSparkles size={15} /> Generar auto
                </button>
              </div>
              <p className="px-2 pb-1 pt-1.5 text-center text-[9px] font-bold text-zinc-500">Usa los alimentos requeridos, evitados y preferencias que guardaste en Ajustes.</p>
            </section>

            {drafts.length ? (
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <header className="flex min-h-10 items-center justify-between border-b border-white/[0.07] px-3">
                  <strong className="text-[11px] font-black text-white">Alimentos del borrador <span className="ml-1 rounded-full bg-emerald-300/10 px-1.5 py-0.5 text-emerald-300">{drafts.length}</span></strong>
                  <span className="text-[9px] font-bold text-zinc-500">Tocá el candado para fijar</span>
                </header>
                {drafts.map((draft) => {
                  const automatic = isTrackingDraftAutomatic(draft);
                  const imageUrl = getFoodImageUrl(draft.food || {});
                  const draftNutrition = trackingDraftsNutritionTotals([draft]);
                  return (
                    <article key={draft.id} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.07] p-2 last:border-b-0">
                      <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-emerald-300/20 bg-white">
                        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-black text-zinc-700">{draft.name.slice(0, 1)}</span>}
                      </span>
                      <div className="min-w-0">
                        <strong className="block truncate text-[12px] font-black text-white">{draft.name}</strong>
                        <span className="mt-0.5 block text-[9px] font-bold text-zinc-500">{draft.quantity ? `${format(draftNutrition.kcal)} kcal` : "Cantidad pendiente"}</span>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${automatic ? "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE080]" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"}`}>{automatic ? "Auto" : "Fijo"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className={`flex h-10 w-[86px] items-center overflow-hidden rounded-xl border bg-black/25 ${automatic ? "border-[#D4AF37]/25" : "border-emerald-300/25"}`}>
                          <span className="sr-only">Cantidad de {draft.name}</span>
                          <input type="number" min="0" step={trackingFoodRequiresWholeQuantity(draft.food, draft.unit) ? "1" : "0.1"} value={draft.quantity} onChange={(event) => updateQuantity(draft.id, event.target.value)} placeholder={automatic ? "Auto" : "0"} className={`min-w-0 flex-1 bg-transparent px-1.5 text-right text-[12px] font-black outline-none placeholder:text-zinc-600 ${automatic ? "text-[#FFE080]" : "text-emerald-200"}`} aria-label={`Cantidad de ${draft.name}`} />
                          <span className="shrink-0 pr-2 text-[10px] font-black text-zinc-500">{draft.unit}</span>
                        </label>
                        <button type="button" onClick={() => toggleMode(draft.id)} disabled={!canAuto && !automatic} className={`grid h-10 w-10 place-items-center rounded-xl border ${automatic ? "border-white/10 bg-white/[0.035] text-zinc-400" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"}`} aria-label={`${automatic ? "Fijar" : "Volver a automático"} ${draft.name}`}>{automatic ? <UnlockKeyhole size={15} /> : <LockKeyhole size={15} />}</button>
                        <button type="button" onClick={() => removeFood(draft.id)} className="grid h-10 w-10 place-items-center rounded-xl border border-rose-400/20 bg-rose-400/[0.07] text-rose-200" aria-label={`Quitar ${draft.name}`}><Trash2 size={15} /></button>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-5 text-center">
                <RefreshCw size={22} className={`mx-auto text-zinc-600 ${draftState === "LOADING" ? "animate-spin" : ""}`} />
                <strong className="mt-2 block text-xs font-black text-zinc-300">{draftState === "LOADING" ? "Calculando alimentos y cantidades" : draftState === "NO_SOLUTION" ? "No encontramos una solucion" : draftState === "ERROR" ? "No pudimos generar" : "Todavía no generaste una alternativa"}</strong>
                <p className="mt-1 text-[10px] font-bold text-zinc-600">{draftState === "LOADING" ? "Evaluamos estructuras compatibles con tu meta y tus ajustes." : "Elegí el origen y usá “Generar alternativa”."}</p>
              </div>
            )}

            {foodEditorOpen ? <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3">
                  <Search size={16} className="shrink-0 text-[#FFD76B]" />
                  <input value={search} onChange={(event) => { setSearch(event.target.value); setError(""); }} placeholder="Buscar pollo, arroz, huevos..." className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600" aria-label="Buscar alimento para la comida equivalente" />
                  {searching ? <RefreshCw size={15} className="animate-spin text-zinc-400" /> : null}
                </label>
                <span className="shrink-0 text-[10px] font-black text-zinc-500">{drafts.length}/{maxFoods}</span>
              </div>
              {results.length ? (
                <div className="mt-2 grid max-h-48 gap-1.5 overflow-y-auto">
                  {results.map((food, index) => (
                    <button key={`${food.id || food._id || foodName(food)}-${index}`} type="button" onClick={() => addFood(food)} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 text-left">
                      <span className="min-w-0 truncate text-sm font-black text-zinc-100">{foodName(food)}</span>
                      <ChevronRight size={16} className="shrink-0 text-[#FFD76B]" />
                    </button>
                  ))}
                </div>
              ) : searched && !searching && search.trim().length >= 2 ? (
                <p className="mt-2 text-xs font-bold text-zinc-500">No encontramos alimentos con esa busqueda.</p>
              ) : null}
            </section> : null}

            {libraryOpen ? (
              <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.045] p-2.5">
                <header className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="flex items-center gap-2 text-[12px] font-black text-white"><Library size={15} className="text-emerald-300" /> Alternativas de la base</strong>
                    <p className="mt-0.5 truncate text-[9px] font-bold text-zinc-500">Ya aplicamos los filtros guardados en Ajustes.</p>
                  </div>
                  <button type="button" onClick={() => setLibraryOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400" aria-label="Cerrar alternativas de la base"><X size={15} /></button>
                </header>
                <div className="mt-2 grid max-h-56 gap-1.5 overflow-y-auto">
                  {libraryLoading ? <div className="flex min-h-20 items-center justify-center gap-2 text-[11px] font-black text-zinc-400"><RefreshCw size={15} className="animate-spin" /> Buscando alternativas...</div> : null}
                  {libraryError ? <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-2 text-xs font-bold text-rose-100" role="alert">{libraryError}</div> : null}
                  {!libraryLoading ? visibleLibraryMeals.map((libraryMeal) => {
                    const equivalence = libraryMeal.equivalence || {};
                    const diff = equivalence.diff || {};
                    return (
                      <article key={libraryMeal.id} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block truncate text-[12px] font-black text-white">{libraryMeal.nombre}</strong>
                            <span className="mt-0.5 block text-[9px] font-bold text-zinc-400">{format(libraryMeal.totales?.kcal)} kcal · P {format(libraryMeal.totales?.proteina, 1)} · Dif. {signed(diff.kcal)} kcal</span>
                            <span className="mt-1 inline-flex rounded-full border border-sky-300/20 bg-sky-300/[0.07] px-2 py-0.5 text-[8px] font-black text-sky-100">{equivalentLibrarySourceLabel(libraryMeal)}</span>
                          </div>
                          <button type="button" onClick={() => applyLibraryMeal(libraryMeal, true)} disabled={!canAuto} className="min-h-10 shrink-0 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 text-[10px] font-black text-emerald-100 disabled:opacity-40">Usar</button>
                        </div>
                      </article>
                    );
                  }) : null}
                  {!libraryLoading && !visibleLibraryMeals.length && !libraryError ? <p className="p-3 text-center text-[10px] font-bold text-zinc-500">No encontramos comidas compatibles con la meta y los ajustes guardados.</p> : null}
                </div>
              </section>
            ) : null}

            {drafts.length ? (
              <section className={`rounded-2xl border px-3 py-2.5 ${comparison.exceedsCalories ? "border-rose-400/30 bg-rose-400/[0.08]" : comparison.caloriesClose ? "border-emerald-300/30 bg-emerald-300/[0.07]" : "border-sky-300/25 bg-sky-300/[0.06]"}`}>
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <strong className="shrink-0 text-[11px] font-black text-white">Resultado actual:</strong>
                  <b className="shrink-0 text-[12px] text-emerald-200">{format(totals.kcal)} kcal</b>
                  <span className="shrink-0 text-[10px] font-black text-rose-100">P {format(totals.proteina, 1)}</span>
                  <span className="shrink-0 text-[10px] font-black text-sky-100">C {format(totals.carbs, 1)}</span>
                  <span className="shrink-0 text-[10px] font-black text-amber-100">G {format(totals.grasas, 1)}</span>
                  <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black text-zinc-300">{signed(comparison.diff.kcal)} kcal</span>
                </div>
                {!optimization && !comparison.proteinReached && target.proteina > 0 ? (
                  <p className="mt-2 flex items-start gap-2 text-[10px] font-bold text-amber-100"><AlertTriangle size={14} className="shrink-0" /> Con esta selección faltan {format(Math.abs(comparison.diff.proteina), 1)} g de proteína.</p>
                ) : comparison.caloriesClose ? (
                  <p className="mt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-100"><Check size={14} /> Calorías alineadas con la comida original.</p>
                ) : null}
              </section>
            ) : null}

            {calculationFeedback ? (
              <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs font-bold text-amber-100">
                <Info size={15} className="mr-2 inline" /><strong>{calculationFeedback.title}.</strong> {calculationFeedback.message}
              </div>
            ) : null}
            {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm font-bold text-rose-100" role="alert">{error}</div> : null}
            {generationNotice ? <div className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.07] p-3 text-[10px] font-bold leading-relaxed text-sky-100" role="status"><Info size={14} className="mr-1.5 inline" />{generationNotice}</div> : null}

            <label className="flex min-h-11 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.025] px-3 text-[11px] font-bold text-zinc-300">
              <input type="checkbox" checked={saveTemplate} onChange={(event) => setSaveTemplate(event.target.checked)} className="h-4 w-4 accent-emerald-400" />
              Guardar también en Mis comidas
            </label>
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-[#071018]/96 px-3 pb-[calc(.7rem+env(safe-area-inset-bottom))] pt-2.5">
          <div className="grid grid-cols-[1.2fr_.8fr] gap-2">
            <button type="button" onClick={generateAlternativeDraft} disabled={saving || calculating || libraryLoading || settingsLoading} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200/30 bg-[linear-gradient(135deg,#69e6ad,#35c98b)] px-3 text-[11px] font-black text-[#032117] shadow-[0_9px_24px_rgba(16,185,129,.18)] disabled:opacity-45">
              {libraryLoading || calculating ? <RefreshCw size={15} className="animate-spin" /> : <WandSparkles size={15} />}
              {libraryLoading ? "Buscando..." : calculating ? "Generando..." : generatedAlternatives.length > 1 && generatedConstraintSignature ? "Generar otra opción" : "Generar alternativa"}
            </button>
            {canAuto ? (
              <button type="button" onClick={calculate} disabled={saving || calculating || !drafts.length} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-300/[0.08] px-2 text-[11px] font-black text-sky-100 disabled:opacity-40">
                <RefreshCw size={15} className={calculating ? "animate-spin" : ""} />
                {calculating ? "Calculando..." : "Recalcular"}
              </button>
            ) : <div className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 text-[9px] font-bold text-zinc-500">Cantidades manuales</div>}
          </div>
          <div className="mt-2 grid grid-cols-[.7fr_.8fr_1.5fr] gap-2">
            <button type="button" onClick={() => setFoodEditorOpen((open) => !open)} disabled={saving || calculating} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-[10px] font-black ${foodEditorOpen ? "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE080]" : "border-white/10 bg-white/[0.03] text-zinc-300"}`} aria-expanded={foodEditorOpen}><Search size={14} /> Editar</button>
            <button type="button" onClick={discard} disabled={saving || calculating} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-400/20 bg-rose-400/[0.055] px-2 text-[10px] font-black text-rose-100 disabled:opacity-50"><X size={14} /> Cancelar</button>
            <button type="button" onClick={apply} disabled={saving || calculating || !ready} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#FFE38A,#D4AF37)] px-3 text-[11px] font-black text-black shadow-[0_9px_24px_rgba(212,175,55,.18)] disabled:opacity-40">
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
              {confirmOverage && comparison.exceedsCalories ? "Usar igualmente" : "Usar alternativa"}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[9px] font-bold text-zinc-600">Cerrar conserva el borrador. Cancelar lo descarta.</p>
        </footer>
      </div>
    </section>
  );
}
