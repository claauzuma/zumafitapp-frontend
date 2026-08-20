import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  DollarSign,
  Gauge,
  Info,
  Layers3,
  Loader2,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Utensils,
  WandSparkles,
  X,
} from "lucide-react";

import { listAlimentos } from "../../nutricion/nutricionApi.js";
import { foodSupportsMealType } from "../../clientMenus/clientMenuGenerationPolicy.js";

import {
  DEFAULT_MENU_GENERATION_SETTINGS,
  MENU_GENERATION_MODE_COMBINE,
  MENU_GENERATION_MODE_SCRATCH,
  MENU_GENERATION_MODE_SIMILAR,
  generationModeLabel,
  mealTypesForCount,
} from "./menuQuickActions.js";

const PROFILE_OPTIONS = [
  {
    id: "recommended",
    title: "Rápido / recomendado",
    text: "Usa tu objetivo, preferencias y hábitos guardados.",
    icon: Gauge,
    tone: "teal",
  },
  {
    id: "custom",
    title: "Personalizado",
    text: "Definí cantidad de comidas, tipos y alimentos a incluir.",
    icon: SlidersHorizontal,
    tone: "gold",
  },
  {
    id: "library",
    title: "Desde biblioteca",
    text: "Armá el día usando tus comidas y menús ya guardados.",
    icon: BookOpen,
    tone: "violet",
  },
];

const ORIGIN_OPTIONS = [
  { id: MENU_GENERATION_MODE_SIMILAR, title: "Biblioteca similar", text: "Usa menús parecidos.", icon: BookOpen },
  { id: MENU_GENERATION_MODE_COMBINE, title: "Combinar biblioteca", text: "Mezcla y completa.", icon: Layers3 },
  { id: MENU_GENERATION_MODE_SCRATCH, title: "Generar desde cero", text: "Desde tus objetivos.", icon: WandSparkles },
];

const MEAL_LABELS = {
  desayuno: "Desayuno",
  colacion: "Colación",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  snack: "Snack",
  pre_entreno: "Pre-entreno",
  post_entreno: "Post-entreno",
};

const ALL_MEAL_TYPES = ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack", "pre_entreno", "post_entreno"];

const SELECT_OPTIONS = {
  variety: [
    ["low", "Baja"],
    ["medium", "Media"],
    ["high", "Alta"],
  ],
  algorithmTolerance: [
    ["strict", "Estricta"],
    ["balanced", "Balanceada"],
    ["flexible", "Flexible"],
  ],
  prepTime: [
    ["quick", "Rápido"],
    ["normal", "Normal"],
    ["elaborate", "Elaborado"],
  ],
  budget: [
    ["low", "Bajo"],
    ["medium", "Medio"],
    ["high", "Alto"],
  ],
};

function formatKcal(value) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Number(value) || 0)} kcal`;
}

function titleForOption(group, value) {
  return SELECT_OPTIONS[group]?.find(([id]) => id === value)?.[1] || value;
}

function Header({ step, onClose }) {
  return (
    <header className="rounded-[1.15rem] border border-white/10 bg-[linear-gradient(145deg,#101923,#080d13)] px-3 py-3 shadow-[0_12px_30px_rgba(0,0,0,.28)]">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2">
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300" aria-label="Cerrar ajustes">
          <X size={17} />
        </button>
        <div className="min-w-0 text-center">
          <strong className="flex items-center justify-center gap-1.5 text-sm font-black text-white"><Sparkles size={15} className="text-[#FFD75E]" /> Generar menú automático</strong>
          <span className="mt-1 block text-[10px] font-bold text-zinc-400">Paso {step} de 4</span>
          <span className="mt-1.5 flex justify-center gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4].map((item) => <i key={item} className={`h-1.5 rounded-full transition-all ${item === step ? "w-5 bg-[#FFD75E]" : item < step ? "w-1.5 bg-teal-300" : "w-1.5 bg-zinc-700"}`} />)}
          </span>
        </div>
        <span />
      </div>
    </header>
  );
}

function SectionTitle({ icon: Icon, title, text }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-teal-300/25 bg-teal-300/10 text-teal-200">{React.createElement(Icon, { size: 17 })}</span>
      <div className="min-w-0"><h3 className="text-sm font-black text-white">{title}</h3>{text ? <p className="mt-0.5 text-[10px] font-bold leading-relaxed text-zinc-500">{text}</p> : null}</div>
    </div>
  );
}

function ChoiceCard({ selected, icon: Icon, title, text, onClick, compact = false }) {
  return (
    <button type="button" onClick={onClick} className={`relative grid w-full ${compact ? "min-h-[88px] grid-rows-[auto_1fr] gap-2 px-2 py-3 text-center" : "min-h-[74px] grid-cols-[46px_minmax(0,1fr)_22px] items-center gap-3 px-3 py-2.5 text-left"} rounded-2xl border transition ${selected ? "border-[#D4AF37]/70 bg-[radial-gradient(circle_at_0_0,rgba(212,175,55,.16),transparent_54%),rgba(212,175,55,.065)] shadow-[inset_0_0_24px_rgba(212,175,55,.05)]" : "border-white/10 bg-white/[0.025]"}`} aria-pressed={selected}>
      <span className={`${compact ? "mx-auto h-8 w-8" : "h-11 w-11"} grid place-items-center rounded-full border ${selected ? "border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#FFD75E]" : "border-teal-300/20 bg-teal-300/[0.07] text-teal-200"}`}>{React.createElement(Icon, { size: compact ? 16 : 20 })}</span>
      <span className="min-w-0"><strong className={`block font-black text-white ${compact ? "text-[10px]" : "text-[13px]"}`}>{title}</strong><span className={`mt-0.5 block font-bold leading-snug text-zinc-500 ${compact ? "text-[8px]" : "text-[10px]"}`}>{text}</span></span>
      {!compact ? <span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-[#FFD75E] bg-[#FFD75E] text-black" : "border-zinc-600"}`}>{selected ? <Check size={12} strokeWidth={3} /> : null}</span> : <span className={`absolute right-2 top-2 h-3.5 w-3.5 rounded-full border ${selected ? "border-[#FFD75E] bg-[#FFD75E] shadow-[0_0_10px_rgba(255,215,94,.55)]" : "border-zinc-600"}`} />}
    </button>
  );
}

function foodKey(food = {}) {
  return String(food.id || food._id || food.alimentoId || food.nombre || food.name || "");
}

function foodName(food = {}) {
  return String(food.nombre || food.name || "Alimento");
}

function IncludedFoodRow({ food, mealTypes, onChange, onRemove }) {
  const compatibleMealTypes = mealTypes.filter((type) => foodSupportsMealType(food, type));
  const selectedTarget = food.targetMealType === "any" || compatibleMealTypes.includes(food.targetMealType)
    ? food.targetMealType
    : "any";
  return (
    <article className="grid min-h-[68px] grid-cols-[38px_minmax(0,1fr)_34px] items-center gap-2 rounded-2xl border border-teal-300/20 bg-[linear-gradient(135deg,rgba(45,212,191,.08),rgba(255,255,255,.02))] px-2.5 py-2">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-teal-300/25 bg-teal-300/10 text-teal-200"><Utensils size={16} /></span>
      <div className="min-w-0">
        <strong className="block truncate text-[11px] font-black text-white">{foodName(food)}</strong>
        <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-2">
          <label className="flex min-w-[70px] cursor-pointer items-center gap-1.5 border-r border-white/10 pr-2">
            <input type="checkbox" checked={food.mustAppear === true} onChange={(event) => onChange({ ...food, mustAppear: event.target.checked })} className="h-3.5 w-3.5 accent-teal-300" />
            <span className="text-[7px] font-black leading-tight text-zinc-400">Debe<br />aparecer</span>
          </label>
          <label className="min-w-0">
            <span className="block text-[7px] font-black text-zinc-600">Aparece en</span>
            <select value={selectedTarget} onChange={(event) => onChange({ ...food, targetMealType: event.target.value })} className="mt-0.5 min-h-7 w-full rounded-lg border border-white/10 bg-[#090f15] px-1.5 text-[8px] font-black text-zinc-200">
              <option value="any">Cualquier comida compatible</option>
              {compatibleMealTypes.map((type) => <option key={type} value={type}>{MEAL_LABELS[type] || type}</option>)}
            </select>
          </label>
        </div>
      </div>
      <button type="button" onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-rose-400/10 hover:text-rose-200" aria-label={`Quitar ${foodName(food)}`}><X size={15} /></button>
    </article>
  );
}

function FoodSearchPicker({ label, hint, values, onChange, tone = "teal", placeholder, kind = "exclude", mealTypes = [] }) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = input.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      listAlimentos({ search: term, limit: 10, mode: "GENERIC" })
        .then((response) => {
          if (!active) return;
          setResults((response?.alimentos || []).filter((food) => (
            food?.generation?.mode === "GENERIC"
            && (kind !== "include" || mealTypes.some((type) => foodSupportsMealType(food, type)))
            && !values.some((item) => foodKey(item) === foodKey(food))
          )));
          setError("");
        })
        .catch(() => {
          if (!active) return;
          setResults([]);
          setError("No pudimos buscar alimentos.");
        })
        .finally(() => { if (active) setLoading(false); });
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [input, kind, mealTypes, values]);

  const add = (food) => {
    if (!foodKey(food) || values.some((item) => foodKey(item) === foodKey(food))) return;
    onChange([...values, kind === "include" ? { ...food, mustAppear: true, targetMealType: "any" } : food]);
    setInput("");
    setResults([]);
  };
  const colors = tone === "rose"
    ? "border-rose-400/35 bg-rose-400/10 text-rose-200"
    : "border-teal-300/35 bg-teal-300/10 text-teal-100";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2"><strong className="text-[11px] font-black text-zinc-200">{label}</strong>{hint ? <span className="text-[8px] font-bold text-zinc-600">{hint}</span> : null}</div>
      {values.length ? kind === "include"
        ? <div className="mt-2 grid gap-1.5">{values.map((food) => <IncludedFoodRow key={foodKey(food)} food={food} mealTypes={mealTypes} onChange={(nextFood) => onChange(values.map((item) => foodKey(item) === foodKey(food) ? nextFood : item))} onRemove={() => onChange(values.filter((item) => foodKey(item) !== foodKey(food)))} />)}</div>
        : <div className="mt-2 flex flex-wrap gap-1.5">{values.map((food) => <span key={foodKey(food)} className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-black ${colors}`}>{foodName(food)}<button type="button" onClick={() => onChange(values.filter((item) => foodKey(item) !== foodKey(food)))} className="grid h-5 w-5 place-items-center rounded-full bg-black/20" aria-label={`Quitar ${foodName(food)}`}><X size={10} /></button></span>)}</div>
        : null}
      <div className="relative mt-2">
        <label className="grid min-h-10 grid-cols-[18px_minmax(0,1fr)_18px] items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 focus-within:border-teal-300/40">
          <Search size={14} className="text-zinc-500" />
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} className="min-w-0 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-zinc-600" />
          {loading ? <Loader2 size={14} className="animate-spin text-teal-300" /> : null}
        </label>
        {results.length ? <div className="absolute inset-x-0 top-[calc(100%+.3rem)] z-20 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#0a1017] p-1.5 shadow-2xl">{results.map((food) => <button key={foodKey(food)} type="button" onClick={() => add(food)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left hover:bg-white/[0.06]"><span className="truncate text-[10px] font-black text-zinc-100">{foodName(food)}</span><small className="shrink-0 text-[8px] font-bold text-zinc-500">{food.unidad || food.unit || "g"}</small></button>)}</div> : null}
      </div>
      {input.trim().length >= 2 && !loading && !results.length && !error ? <p className="mt-1 text-[8px] font-bold text-zinc-600">No encontramos coincidencias.</p> : null}
      {error ? <p className="mt-1 text-[8px] font-bold text-rose-300">{error}</p> : null}
    </div>
  );
}

function SelectRow({ icon: Icon, title, text, value, options, onChange }) {
  return (
    <label className="grid min-h-[52px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-full border border-teal-300/20 bg-teal-300/[0.07] text-teal-200">{React.createElement(Icon, { size: 15 })}</span>
      <span className="min-w-0"><strong className="block text-[10px] font-black text-zinc-200">{title}</strong><span className="block truncate text-[8px] font-bold text-zinc-600">{text}</span></span>
      <span className="relative flex items-center gap-1 text-[10px] font-black text-teal-300">{titleForOption(options, value)}<ChevronDown size={13} /><select value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={title}>{SELECT_OPTIONS[options].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></span>
    </label>
  );
}

function StepOne({ draft, setDraft }) {
  const selectProfile = (profile) => {
    if (profile === "recommended") setDraft((current) => ({
      ...DEFAULT_MENU_GENERATION_SETTINGS,
      includeFoods: current.includeFoods,
      excludeFoods: current.excludeFoods,
      firstMealTime: current.firstMealTime,
    }));
    else if (profile === "library") setDraft((current) => ({ ...current, generationProfile: profile, mode: MENU_GENERATION_MODE_SIMILAR }));
    else setDraft((current) => ({ ...current, generationProfile: profile }));
  };
  return (
    <section className="rounded-[1.2rem] border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.09),transparent_34%),linear-gradient(145deg,#101923,#080d13)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.30)]">
      <SectionTitle icon={Sparkles} title="Generar menú automático" text="Elegí cómo querés armar tu día." />
      <div className="my-3 h-px bg-white/[0.07]" />
      <div className="grid gap-2">{PROFILE_OPTIONS.map((option) => <ChoiceCard key={option.id} {...option} selected={draft.generationProfile === option.id} onClick={() => selectProfile(option.id)} />)}</div>
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-teal-300/20 bg-teal-300/[0.07] p-2.5 text-[9px] font-bold leading-relaxed text-teal-100"><Info size={14} className="mt-0.5 shrink-0" /> Podés volver y cambiar estos ajustes antes de generar.</div>
    </section>
  );
}

function StepTwo({ draft, setDraft }) {
  const mealTypes = Array.isArray(draft.mealTypes) ? draft.mealTypes : mealTypesForCount(draft.mealCount);
  const toggleMealType = (type) => {
    setDraft((current) => {
      const selected = Array.isArray(current.mealTypes) ? current.mealTypes : mealTypesForCount(current.mealCount);
      return {
        ...current,
        mealTypes: selected.includes(type) ? selected.filter((item) => item !== type) : [...selected, type],
      };
    });
  };
  return (
    <section className="rounded-[1.2rem] border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.09),transparent_34%),linear-gradient(145deg,#101923,#080d13)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.30)]">
      <SectionTitle icon={Utensils} title="Estructura del día" text="Definí cuántas comidas querés y cómo repartir tu objetivo." />
      <div className="mt-4"><strong className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Cantidad de comidas</strong><div className="mt-2 grid grid-cols-4 gap-1.5">{[3, 4, 5, 6].map((count) => <button key={count} type="button" onClick={() => setDraft((current) => ({ ...current, mealCount: count, mealTypes: mealTypesForCount(count) }))} className={`min-h-12 rounded-xl border text-center ${draft.mealCount === count ? "border-[#D4AF37]/65 bg-[#D4AF37]/12 text-[#FFD75E]" : "border-white/10 bg-black/20 text-zinc-400"}`}><strong className="block text-base font-black">{count}</strong><span className="block text-[7px] font-bold">comidas</span></button>)}</div></div>
      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/20 p-2.5"><div className="flex items-center justify-between gap-2"><strong className="text-[10px] font-black text-zinc-300">Elegí los tipos</strong><span className={`text-[8px] font-black ${mealTypes.length === draft.mealCount ? "text-teal-300" : "text-amber-300"}`}>{mealTypes.length}/{draft.mealCount}</span></div><p className="mt-1 text-[8px] font-bold text-zinc-600">Podés reemplazar los sugeridos. La cantidad elegida debe coincidir.</p><div className="mt-2 flex flex-wrap gap-1.5">{ALL_MEAL_TYPES.map((type) => { const selected = mealTypes.includes(type); return <button key={type} type="button" onClick={() => toggleMealType(type)} className={`rounded-full border px-2 py-1 text-[9px] font-black ${selected ? "border-teal-300/35 bg-teal-300/[0.10] text-teal-100" : "border-white/10 bg-white/[0.025] text-zinc-500"}`}>{selected ? <Check size={10} className="mr-1 inline" /> : null}{MEAL_LABELS[type] || type}</button>; })}</div></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-[9px] font-black text-zinc-500">Distribución<select value={draft.distribution} onChange={(event) => setDraft((current) => ({ ...current, distribution: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#090e15] px-3 text-[11px] font-black text-white"><option value="balanced">Según tipo de comida</option><option value="equal">Partes iguales</option></select></label>
        <label className="grid gap-1 text-[9px] font-black text-zinc-500">Primera comida<input type="time" value={draft.firstMealTime} onChange={(event) => setDraft((current) => ({ ...current, firstMealTime: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#090e15] px-3 text-[11px] font-black text-white" /></label>
      </div>
      <label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3"><span><strong className="block text-[10px] font-black text-zinc-200">Permitir repetir comidas</strong><small className="block text-[8px] font-bold text-zinc-600">Puede reutilizar opciones dentro del día.</small></span><input type="checkbox" checked={draft.allowRepeats} onChange={(event) => setDraft((current) => ({ ...current, allowRepeats: event.target.checked }))} className="h-4 w-4 accent-[#D4AF37]" /></label>
    </section>
  );
}

function StepThree({ draft, setDraft }) {
  const mealTypes = Array.isArray(draft.mealTypes) ? draft.mealTypes : mealTypesForCount(draft.mealCount);
  return (
    <div className="grid gap-2.5">
      <section className="rounded-[1.2rem] border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.10),transparent_34%),linear-gradient(145deg,#101923,#080d13)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.30)]">
        <SectionTitle icon={Utensils} title="Preferencias de alimentos" text="Indicá qué alimentos te gustan, necesitás o preferís evitar." />
        <div className="mt-4 grid gap-4">
          <FoodSearchPicker kind="include" mealTypes={mealTypes} label="Incluir alimentos" hint="Sólo alimentos GENERIC" values={draft.includeFoods} onChange={(includeFoods) => setDraft((current) => ({ ...current, includeFoods }))} placeholder="Buscar pollo, arroz, yogur..." />
          <FoodSearchPicker label="Excluir / evitar" hint="Sólo alimentos GENERIC" values={draft.excludeFoods} onChange={(excludeFoods) => setDraft((current) => ({ ...current, excludeFoods }))} tone="rose" placeholder="Buscar pescado, mariscos..." />
        </div>
        <div className="mt-4 grid gap-1.5" role="radiogroup" aria-label="Uso de alimentos incluidos">
          <button type="button" onClick={() => setDraft((current) => ({ ...current, foodPoolMode: "only" }))} className={`grid min-h-12 grid-cols-[minmax(0,1fr)_18px] items-center rounded-xl border px-3 text-left ${draft.foodPoolMode === "only" ? "border-[#D4AF37]/55 bg-[#D4AF37]/10" : "border-white/10 bg-black/20"}`}><span><strong className="block text-[10px] font-black text-zinc-100">Sólo estos alimentos</strong><small className="block text-[8px] font-bold text-zinc-500">Usará exclusivamente los alimentos de Incluir.</small></span><CheckCircle2 size={16} className={draft.foodPoolMode === "only" ? "text-[#FFD75E]" : "text-zinc-700"} /></button>
          <button type="button" onClick={() => setDraft((current) => ({ ...current, foodPoolMode: "combine" }))} className={`grid min-h-12 grid-cols-[minmax(0,1fr)_18px] items-center rounded-xl border px-3 text-left ${draft.foodPoolMode === "combine" ? "border-teal-300/40 bg-teal-300/[0.08]" : "border-white/10 bg-black/20"}`}><span><strong className="block text-[10px] font-black text-zinc-100">Combinar con otros alimentos</strong><small className="block text-[8px] font-bold text-zinc-500">Puede completar el menú con opciones compatibles.</small></span><CheckCircle2 size={16} className={draft.foodPoolMode === "combine" ? "text-teal-300" : "text-zinc-700"} /></button>
        </div>
      </section>
      <div className="flex items-start gap-2 rounded-xl border border-teal-300/20 bg-teal-300/[0.07] p-2.5 text-[9px] font-bold leading-relaxed text-teal-100"><Info size={14} className="mt-0.5 shrink-0" /> Si la combinación es demasiado restrictiva, el generador podrá avisarte antes de continuar.</div>
    </div>
  );
}

function StepFour({ draft, setDraft, target, hasMenu, purpose }) {
  const meals = Array.isArray(draft.mealTypes) ? draft.mealTypes : mealTypesForCount(draft.mealCount);
  const includedSummary = draft.includeFoods.map((food) => {
    const destination = food.targetMealType && food.targetMealType !== "any"
      ? MEAL_LABELS[food.targetMealType] || food.targetMealType
      : "Cualquier comida compatible";
    return `${foodName(food)} → ${destination}${food.mustAppear === true ? " (debe aparecer)" : ""}`;
  }).join("; ");
  const summary = [
    `${draft.mealCount} comidas: ${meals.map((type) => MEAL_LABELS[type] || type).join(", ")}`,
    `Meta del día: ${formatKcal(target?.kcal)}`,
    draft.distribution === "equal" ? "Distribución en partes iguales" : "Distribución según tipo de comida",
    draft.preferFavorites ? "Prioriza favoritas" : "Favoritas sin prioridad especial",
    draft.includeFoods.length ? `Incluir: ${includedSummary}` : "Sin alimentos preferidos",
    draft.excludeFoods.length ? `Evitar: ${draft.excludeFoods.map(foodName).join(", ")}` : "Sin exclusiones",
  ];
  return (
    <div className="grid gap-2.5">
      <section className="rounded-[1.2rem] border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.10),transparent_34%),linear-gradient(145deg,#101923,#080d13)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.30)]">
        <SectionTitle icon={SlidersHorizontal} title="Ajustes avanzados" text="Personalizá cómo se preparará el menú." />
        <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/15 p-2"><strong className="px-1 text-[9px] font-black text-zinc-400">Origen del menú</strong><div className="mt-2 grid grid-cols-3 gap-1.5">{ORIGIN_OPTIONS.map((option) => <ChoiceCard key={option.id} {...option} compact selected={draft.mode === option.id} onClick={() => setDraft((current) => ({ ...current, mode: option.id }))} />)}</div></div>
        <div className="mt-2 grid gap-1.5">
          <SelectRow icon={Layers3} title="Variedad" text="Nivel de variedad de comidas." value={draft.variety} options="variety" onChange={(variety) => setDraft((current) => ({ ...current, variety }))} />
          <SelectRow icon={Target} title="Tolerancia del algoritmo" text="Qué tan estricto será el cálculo." value={draft.algorithmTolerance} options="algorithmTolerance" onChange={(algorithmTolerance) => setDraft((current) => ({ ...current, algorithmTolerance }))} />
          <SelectRow icon={Clock3} title="Preferencia de preparación" text="Se guarda; aún no filtra sin datos reales de tiempo." value={draft.prepTime} options="prepTime" onChange={(prepTime) => setDraft((current) => ({ ...current, prepTime }))} />
          <SelectRow icon={DollarSign} title="Preferencia de presupuesto" text="Se guarda; aún no filtra sin datos reales de costo." value={draft.budget} options="budget" onChange={(budget) => setDraft((current) => ({ ...current, budget }))} />
          <label className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3"><span><strong className="block text-[10px] font-black text-zinc-200">Priorizar favoritas</strong><small className="block text-[8px] font-bold text-zinc-600">Usa primero tus comidas guardadas favoritas.</small></span><input type="checkbox" checked={draft.preferFavorites} onChange={(event) => setDraft((current) => ({ ...current, preferFavorites: event.target.checked }))} className="h-4 w-4 accent-[#D4AF37]" /></label>
        </div>
      </section>
      <section className="relative overflow-hidden rounded-[1.2rem] border border-[#D4AF37]/40 bg-[radial-gradient(circle_at_100%_100%,rgba(45,212,191,.12),transparent_36%),linear-gradient(145deg,#111923,#080d13)] p-3">
        <SectionTitle icon={ClipboardCheck} title={purpose === "generate" ? "Resumen antes de generar" : "Resumen antes de guardar"} text={hasMenu ? "Estos ajustes podrán usarse aunque el día ya tenga un menú." : "Listo para configurar un menú nuevo para este día."} />
        <div className="mt-3 grid gap-1.5">{summary.map((line) => <div key={line} className="flex items-start gap-2 text-[9px] font-bold leading-relaxed text-zinc-300"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#FFD75E]" />{line}</div>)}</div>
        <div className="mt-3 rounded-xl border border-teal-300/20 bg-teal-300/[0.07] px-3 py-2 text-[9px] font-black text-teal-100">Origen: {generationModeLabel(draft.mode)} · {draft.foodPoolMode === "only" ? "Sólo alimentos incluidos" : "Puede combinar otros alimentos"}</div>
      </section>
    </div>
  );
}

export default function MenuGenerationSettingsWizard({
  open = false,
  settings = DEFAULT_MENU_GENERATION_SETTINGS,
  target = {},
  hasMenu = false,
  purpose = "settings",
  onClose,
  onSave,
  onGenerate,
  onRestore,
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (!open) return;
    setDraft(settings || DEFAULT_MENU_GENERATION_SETTINGS);
    setStep(1);
  }, [open, settings]);

  if (!open) return null;

  const canAdvance = step !== 2 || (
    Array.isArray(draft.mealTypes) &&
    draft.mealTypes.length === Number(draft.mealCount) &&
    draft.mealTypes.length >= 3
  );

  const restore = () => {
    const restored = onRestore?.() || { ...DEFAULT_MENU_GENERATION_SETTINGS };
    setDraft(restored);
  };

  return (
    <section id="menu-generation-settings" className="mt-2.5 grid gap-2" aria-label="Asistente de ajustes de generación">
      <Header step={step} onClose={onClose} />
      {step === 1 ? <StepOne draft={draft} setDraft={setDraft} /> : null}
      {step === 2 ? <StepTwo draft={draft} setDraft={setDraft} /> : null}
      {step === 3 ? <StepThree draft={draft} setDraft={setDraft} /> : null}
      {step === 4 ? <StepFour draft={draft} setDraft={setDraft} target={target} hasMenu={hasMenu} purpose={purpose} /> : null}
      <footer className="sticky bottom-1 z-10 grid grid-cols-[.8fr_1fr_1.25fr] gap-1.5 rounded-2xl border border-white/10 bg-[#090d13]/95 p-2 shadow-[0_-10px_30px_rgba(0,0,0,.45)] backdrop-blur-md">
        <button type="button" onClick={() => step === 1 ? onClose?.() : setStep((current) => current - 1)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-[10px] font-black text-zinc-300"><ArrowLeft size={14} /> {step === 1 ? "Cerrar" : "Atrás"}</button>
        <button type="button" onClick={restore} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-[9px] font-black text-zinc-200"><RefreshCw size={13} /> Recomendados</button>
        {step < 4 ? <button type="button" disabled={!canAdvance} onClick={() => setStep((current) => current + 1)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37]/45 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-2 text-[10px] font-black text-black shadow-[0_8px_20px_rgba(212,175,55,.22)] disabled:cursor-not-allowed disabled:opacity-40">Continuar <ArrowRight size={14} /></button> : purpose === "generate" ? <button type="button" onClick={() => onGenerate?.(draft)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37]/45 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-2 text-[10px] font-black text-black shadow-[0_8px_20px_rgba(212,175,55,.22)]"><Sparkles size={14} /> Generar menú</button> : <button type="button" onClick={() => onSave?.(draft)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37]/45 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-2 text-[10px] font-black text-black shadow-[0_8px_20px_rgba(212,175,55,.22)]"><Save size={14} /> Guardar ajustes</button>}
      </footer>
    </section>
  );
}
