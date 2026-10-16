import React, { useEffect, useMemo, useState } from "react";
import {
  Apple,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Coffee,
  DollarSign,
  Dumbbell,
  Flame,
  Gauge,
  Info,
  Layers3,
  Loader2,
  Lock,
  Moon,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  Trash2,
  TriangleAlert,
  Unlock,
  Utensils,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

import { listAlimentos } from "../../nutricion/nutricionApi.js";
import {
  buildPersonalMealTargetDayPlan,
  calculateLockedMealMacros,
  editPersonalMealTargetDay,
  mergeConsumedMealsIntoPersonalTargetPlan,
  personalMealTargetTotalFitsBudget,
  personalMealTargetTotals,
  reorderPersonalMealTargets,
} from "./quickMealTargetPlan.js";

import {
  DEFAULT_MENU_GENERATION_SETTINGS,
  MENU_GENERATION_MODE_COMBINE,
  MENU_GENERATION_MODE_SCRATCH,
  MENU_GENERATION_MODE_SIMILAR,
  mealTypesForCount,
  menuGenerationWizardFlow,
} from "./menuQuickActions.js";



const PROFILE_OPTIONS = [
  {
    id: "custom",
    title: "Personalizado",
    text: "Elegí comidas, distribución de calorías, preferencias y alimentos a incluir o excluir.",
    icon: SlidersHorizontal,
    tone: "gold",
  },
  {
    id: "target",
    title: "Por meta",
    text: "Creá metas vacías por comida y completalas después con alimentos.",
    icon: Target,
    tone: "teal",
  },
  {
    id: "library",
    title: "Desde biblioteca",
    text: "Usá tus comidas y menús guardados como base.",
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

const MAIN_MEAL_TYPES = [
  "desayuno",
  "almuerzo",
  "merienda",
  "cena",
];

const EXTRA_MEAL_TYPES = [
  "colacion",
  "snack",
  "pre_entreno",
  "post_entreno",
];

const MEAL_ICONS = {
  desayuno: Sunrise,
  almuerzo: Sun,
  merienda: Coffee,
  cena: Moon,
  colacion: Apple,
  snack: Apple,
  pre_entreno: Dumbbell,
  post_entreno: Dumbbell,
};

const CALORIE_DISTRIBUTION_OPTIONS = [
  {
    id: "balanced",
    label: "Equilibrado",
    icon: Scale,
  },
  {
    id: "more_breakfast",
    label: "Más en desayuno",
    icon: Sunrise,
  },
  {
    id: "more_lunch",
    label: "Más en almuerzo",
    icon: Sun,
  },
  {
    id: "more_dinner",
    label: "Más en cena",
    icon: Moon,
  },
  {
    id: "custom",
    label: "Personalizado",
    icon: SlidersHorizontal,
  },
];

const FREE_CALORIE_PRESETS = [
  { id: "0", label: "Ninguna", sublabel: "0 kcal", value: 0 },
  { id: "100", label: "100 kcal", value: 100 },
  { id: "200", label: "200 kcal", value: 200 },
  { id: "300", label: "300 kcal", value: 300 },
  { id: "custom", label: "Personalizado", value: null },
];

function evenMealPercentages(mealTypes = []) {
  if (!mealTypes.length) return {};

  const base = Math.floor(100 / mealTypes.length);
  let remaining = 100 - base * mealTypes.length;

  return mealTypes.reduce((result, type) => {
    result[type] = base + (remaining > 0 ? 1 : 0);

    if (remaining > 0) {
      remaining -= 1;
    }

    return result;
  }, {});
}


function randomWeightedDistribution(total, types, current = {}) {
  if (!types.length) return {};

  if (types.length === 1) {
    return {
      [types[0]]: total,
    };
  }

  /*
   * Usamos el reparto actual como base,
   * pero agregamos una pequeña variación.
   *
   * Así no cambia brutalmente cada vez.
   */
  const weighted = types.map((type) => {
    const currentValue = Math.max(
      1,
      Number(current[type] || 1)
    );

    const variation = 0.85 + Math.random() * 0.3;

    return {
      type,
      weight: currentValue * variation,
    };
  });

  const weightTotal = weighted.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  const provisional = weighted.map((item) => {
    const exact =
      weightTotal > 0
        ? (item.weight / weightTotal) * total
        : total / types.length;

    return {
      ...item,
      value: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let used = provisional.reduce(
    (sum, item) => sum + item.value,
    0
  );

  let remaining = total - used;

  provisional
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((item) => {
      if (remaining <= 0) return;

      item.value += 1;
      remaining -= 1;
    });

  return provisional.reduce((result, item) => {
    result[item.type] = item.value;
    return result;
  }, {});
}


function rebalanceCaloriePercentages({
  mealTypes = [],
  percentages = {},
  locked = {},
  changedType,
  changedValue,
}) {
  const next = { ...percentages };

  /*
   * Las comidas bloqueadas, excepto la que el usuario
   * está modificando directamente, mantienen su valor.
   */
  const lockedOthers = mealTypes.filter(
    (type) =>
      type !== changedType &&
      locked[type] === true
  );

  const lockedTotal = lockedOthers.reduce(
    (sum, type) =>
      sum + Number(percentages[type] || 0),
    0
  );

  /*
   * La comida modificada no puede ocupar más
   * del porcentaje que queda libre.
   */
  const maxChangedValue = Math.max(
    0,
    100 - lockedTotal
  );

  const normalizedChangedValue = Math.min(
    maxChangedValue,
    Math.max(
      0,
      Math.round(Number(changedValue) || 0)
    )
  );

  next[changedType] = normalizedChangedValue;

  const adjustableTypes = mealTypes.filter(
    (type) =>
      type !== changedType &&
      locked[type] !== true
  );

  /*
   * Si no queda ninguna comida que pueda ajustarse,
   * la comida tocada absorbe exactamente lo necesario.
   */
  if (!adjustableTypes.length) {
    next[changedType] = Math.max(
      0,
      100 - lockedTotal
    );

    return next;
  }

  const remaining = Math.max(
    0,
    100 -
      lockedTotal -
      normalizedChangedValue
  );

  const redistributed =
    randomWeightedDistribution(
      remaining,
      adjustableTypes,
      percentages
    );

  adjustableTypes.forEach((type) => {
    next[type] = redistributed[type] || 0;
  });

  /*
   * Restauramos explícitamente los bloqueados.
   */
  lockedOthers.forEach((type) => {
    next[type] = Number(
      percentages[type] || 0
    );
  });

  return next;
}



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

function formatNutritionNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(Number(value) || 0);
}

function titleForOption(group, value) {
  return SELECT_OPTIONS[group]?.find(([id]) => id === value)?.[1] || value;
}


function Header({
  step,
  totalSteps = 4,
  profile,
  purpose = "settings",
  onBack,
  onClose,
}) {
  return (
    <header className="shrink-0 border-b border-white/[0.07] bg-[#05080d]/95 px-4 pb-3 pt-4 backdrop-blur-xl">

      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-start gap-2">

        {/* VOLVER */}

        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={onBack}
              className="grid h-10 w-10 place-items-center rounded-xl border border-teal-300/30 bg-teal-300/[0.05] text-zinc-200 transition hover:border-teal-300/50 hover:bg-teal-300/10 hover:text-white"
              aria-label="Volver al paso anterior"
            >
              <ArrowLeft size={19} />
            </button>
          ) : (
            <span className="block h-10 w-10" />
          )}
        </div>


        {/* TITULO */}

        <div className="min-w-0 text-center">
          <h2 className="text-[18px] font-black leading-tight text-white">
            {profile === "target"
              ? purpose === "generate"
                ? "Crear menú por meta"
                : purpose === "edit_targets"
                  ? "Editar metas del día"
                  : "Ajustes por meta"
              : "Generar menú automático"}
          </h2>

          <p className="mt-1 text-[11px] font-semibold text-zinc-500">
            {profile === "target"
              ? purpose === "generate"
                ? "Definí las metas de cada comida"
                : purpose === "edit_targets"
                  ? "Ajustá la planificación sin perder lo consumido"
                  : "Guardá tu configuración base"
              : "Configurá cómo querés armar tu día"}
          </p>
        </div>


        {/* CERRAR */}

        <button
          type="button"
          onClick={() => onClose?.()}
          className="grid h-10 w-10 place-items-center justify-self-end rounded-xl border border-white/10 bg-white/[0.035] text-zinc-400 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200"
          aria-label="Cerrar ajustes"
          title="Cerrar"
        >
          <X size={19} />
        </button>

      </div>


      {/* PASO */}

      <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">

        <strong className="text-center text-[12px] font-black text-teal-300">
            Paso {step} de {totalSteps}
        </strong>

        <span className="rounded-full border border-teal-300/30 bg-teal-300/[0.06] px-2.5 py-1 text-[10px] font-black text-teal-200">
          {step} / {totalSteps}
        </span>

      </div>


      {/* PROGRESO */}

      <div className={`mt-3 grid gap-1.5 ${totalSteps === 2 ? "grid-cols-2" : "grid-cols-4"}`}>

        {Array.from({ length: totalSteps }, (_, index) => index + 1).map(
          (item) => (
            <span
              key={item}
              className={`h-1 rounded-full ${
                item <= step
                  ? "bg-teal-300"
                  : "bg-white/10"
              }`}
            />
          )
        )}

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



function ChoiceCard({
  selected,
  icon: optionIcon,
  title,
  text,
  onClick,
  compact = false,
  tone = "teal",
}) {
  const tones = {
    teal: {
      border: "border-teal-300/45",
      background: "bg-teal-300/[0.045]",
      iconBorder: "border-teal-300/30",
      iconBackground: "bg-teal-300/10",
      iconText: "text-teal-300",
      radio: "border-teal-300",
    },
    gold: {
      border: "border-[#FFD75E]/55",
      background: "bg-[#D4AF37]/[0.05]",
      iconBorder: "border-[#FFD75E]/30",
      iconBackground: "bg-[#D4AF37]/15",
      iconText: "text-[#FFD75E]",
      radio: "border-[#FFD75E]",
    },
    violet: {
      border: "border-violet-400/45",
      background: "bg-violet-400/[0.045]",
      iconBorder: "border-violet-400/30",
      iconBackground: "bg-violet-400/10",
      iconText: "text-violet-300",
      radio: "border-violet-400",
    },
  };

  const style = tones[tone] || tones.teal;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative grid min-h-[88px] w-full grid-rows-[auto_1fr] gap-2 rounded-2xl border px-2 py-3 text-center transition ${
          selected
            ? "border-[#FFD75E]/70 bg-[#D4AF37]/10"
            : "border-white/10 bg-white/[0.025]"
        }`}
        aria-pressed={selected}
      >
        <span
          className={`mx-auto grid h-8 w-8 place-items-center rounded-full border ${
            selected
              ? "border-[#FFD75E]/45 bg-[#D4AF37]/15 text-[#FFD75E]"
              : "border-teal-300/20 bg-teal-300/[0.07] text-teal-200"
          }`}
        >
          {React.createElement(optionIcon, { size: 16 })}
        </span>

        <span>
          <strong className="block text-[10px] font-black text-white">
            {title}
          </strong>
          <span className="mt-0.5 block text-[8px] font-bold leading-snug text-zinc-500">
            {text}
          </span>
        </span>

        <span
          className={`absolute right-2 top-2 h-3.5 w-3.5 rounded-full border ${
            selected
              ? "border-[#FFD75E] bg-[#FFD75E]"
              : "border-zinc-600"
          }`}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative grid min-h-[116px] w-full grid-cols-[58px_minmax(0,1fr)_28px] items-center gap-4 rounded-[1.35rem] border px-4 py-4 text-left transition ${
        selected
          ? `${style.border} ${style.background} shadow-[0_0_26px_rgba(212,175,55,.08)]`
          : `${style.border} ${style.background}`
      }`}
      aria-pressed={selected}
    >
      <span
        className={`grid h-14 w-14 place-items-center rounded-full border ${style.iconBorder} ${style.iconBackground} ${style.iconText}`}
      >
        {React.createElement(optionIcon, { size: 25, strokeWidth: 2.2 })}
      </span>

      <span className="min-w-0">
        <strong className="block text-[15px] font-black leading-tight text-white">
          {title}
        </strong>

        <span className="mt-2 block text-[11px] font-semibold leading-relaxed text-zinc-400">
          {text}
        </span>
      </span>

      <span
        className={`grid h-6 w-6 place-items-center rounded-full border-2 ${style.radio}`}
      >
        {selected ? (
          <span className="h-3 w-3 rounded-full bg-[#FFD75E] shadow-[0_0_10px_rgba(255,215,94,.6)]" />
        ) : null}
      </span>
    </button>
  );
}



function foodKey(food = {}) {
  return String(food.id || food._id || food.alimentoId || food.nombre || food.name || "");
}

function foodName(food = {}) {
  return String(food.nombre || food.name || "Alimento");
}

function preferenceMealTarget(food = {}) {
  return String(food?.targetMealType || "any");
}

function preferenceBelongsToMeal(food = {}, mealType = "") {
  return preferenceMealTarget(food) === String(mealType);
}

function preferenceIsGlobal(food = {}) {
  const target = preferenceMealTarget(food);
  return !target || target === "any";
}

function MealFoodSearch({
  kind = "include",
  values = [],
  onAdd,
  onRemove,
  placeholder = "Buscar alimento...",
}) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedSignature = values
    .map((food) => foodKey(food))
    .filter(Boolean)
    .sort()
    .join("|");

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
      /*
       * IMPORTANTE:
       * acá NO usamos mode: "GENERIC".
       *
       * Es una elección explícita del usuario,
       * por lo tanto puede elegir también EXPLICIT_ONLY.
       */
      listAlimentos({
        search: term,
        limit: 10,
      })
        .then((response) => {
          if (!active) return;

          const selectedKeys = new Set(
            values.map((food) => foodKey(food))
          );

          setResults(
            (response?.alimentos || []).filter(
              (food) =>
                foodKey(food) &&
                !selectedKeys.has(foodKey(food))
            )
          );

          setError("");
        })
        .catch(() => {
          if (!active) return;

          setResults([]);
          setError("No pudimos buscar alimentos.");
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [input, selectedSignature, values]);

  const addFood = (food) => {
    if (!foodKey(food)) return;

    onAdd?.(food);

    setInput("");
    setResults([]);
  };

  const include = kind === "include";

  return (
    <div
      className={`rounded-2xl border p-3 ${
        include
          ? "border-teal-300/25 bg-teal-300/[0.045]"
          : "border-rose-400/25 bg-rose-400/[0.045]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <strong
            className={`text-[12px] font-black ${
              include
                ? "text-teal-300"
                : "text-rose-300"
            }`}
          >
            {include ? "Incluir" : "Evitar"}
          </strong>

          <p className="mt-0.5 text-[9px] font-bold text-zinc-500">
            {include
              ? "Estos alimentos deberán aparecer."
              : "Estos alimentos no se usarán en esta comida."}
          </p>
        </div>

        <span
          className={`grid h-8 w-8 place-items-center rounded-full border ${
            include
              ? "border-teal-300/30 text-teal-300"
              : "border-rose-400/30 text-rose-300"
          }`}
        >
          {include ? "+" : "×"}
        </span>
      </div>

      {values.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {values.map((food) => (
            <span
              key={`${kind}-${foodKey(food)}`}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black ${
                include
                  ? "border-teal-300/30 bg-teal-300/10 text-teal-100"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-100"
              }`}
            >
              <span className="max-w-[145px] truncate">
                {foodName(food)}
              </span>

              <button
                type="button"
                onClick={() => onRemove?.(food)}
                className="grid h-5 w-5 place-items-center rounded-full bg-black/20 text-zinc-300"
                aria-label={`Quitar ${foodName(food)}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[9px] font-bold text-zinc-600">
          Ningún alimento seleccionado.
        </p>
      )}

      <div className="relative mt-3">
        <label
          className={`grid min-h-[44px] grid-cols-[18px_minmax(0,1fr)_18px] items-center gap-2 rounded-xl border bg-black/30 px-3 ${
            include
              ? "border-teal-300/20 focus-within:border-teal-300/50"
              : "border-rose-400/20 focus-within:border-rose-400/50"
          }`}
        >
          <Search
            size={15}
            className={
              include
                ? "text-teal-300/70"
                : "text-rose-300/70"
            }
          />

          <input
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            placeholder={placeholder}
            className="min-w-0 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-zinc-600"
          />

          {loading ? (
            <Loader2
              size={14}
              className="animate-spin text-teal-300"
            />
          ) : null}
        </label>

        {results.length ? (
          <div className="absolute inset-x-0 top-[calc(100%+.35rem)] z-30 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#090f16] p-1.5 shadow-2xl">
            {results.map((food) => (
              <button
                key={foodKey(food)}
                type="button"
                onClick={() => addFood(food)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-white/[0.06]"
              >
                <span className="truncate text-[11px] font-black text-zinc-100">
                  {foodName(food)}
                </span>

                <span className="shrink-0 text-[8px] font-bold text-zinc-500">
                  {food.unidad ||
                    food.unit ||
                    food.Unidad ||
                    "g"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {input.trim().length >= 2 &&
      !loading &&
      !results.length &&
      !error ? (
        <p className="mt-1.5 text-[8px] font-bold text-zinc-600">
          No encontramos coincidencias.
        </p>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-[8px] font-bold text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}


function MealPreferenceCard({
  mealType,
  open,
  onToggle,
  includedFoods,
  excludedFoods,
  onInclude,
  onExclude,
  onRemoveInclude,
  onRemoveExclude,
}) {
  const Icon =
    typeof MEAL_ICONS !== "undefined"
      ? MEAL_ICONS[mealType] || Utensils
      : Utensils;

  const includedCount = includedFoods.length;
  const excludedCount = excludedFoods.length;

  return (
    <article className="rounded-2xl border border-white/[0.09] bg-[#090f16]">
      <button
        type="button"
        onClick={onToggle}
        className="grid min-h-[72px] w-full grid-cols-[44px_minmax(0,1fr)_34px] items-center gap-3 px-3 text-left"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full border border-teal-300/25 bg-teal-300/[0.08] text-teal-300">
          <Icon size={19} />
        </span>

        <span className="min-w-0">
          <strong className="block text-[13px] font-black text-white">
            {MEAL_LABELS[mealType] || mealType}
          </strong>

          <span className="mt-1 block text-[9px] font-bold text-zinc-500">
            {includedCount}{" "}
            {includedCount === 1
              ? "incluido"
              : "incluidos"}
            {" · "}
            {excludedCount}{" "}
            {excludedCount === 1
              ? "evitado"
              : "evitados"}
          </span>

          {!open &&
          (includedCount > 0 || excludedCount > 0) ? (
            <span className="mt-2 flex min-w-0 gap-1 overflow-hidden">
              {includedFoods.slice(0, 2).map((food) => (
                <span
                  key={`mini-i-${foodKey(food)}`}
                  className="max-w-[90px] truncate rounded-full border border-teal-300/20 bg-teal-300/[0.07] px-2 py-0.5 text-[8px] font-black text-teal-100"
                >
                  {foodName(food)}
                </span>
              ))}

              {excludedFoods.slice(0, 1).map((food) => (
                <span
                  key={`mini-e-${foodKey(food)}`}
                  className="max-w-[90px] truncate rounded-full border border-rose-400/20 bg-rose-400/[0.07] px-2 py-0.5 text-[8px] font-black text-rose-200"
                >
                  {foodName(food)}
                </span>
              ))}
            </span>
          ) : null}
        </span>

        <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-zinc-400">
          <ChevronDown
            size={16}
            className={`transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {open ? (
        <div className="grid gap-3 border-t border-white/[0.07] p-3">
          <MealFoodSearch
            kind="include"
            values={includedFoods}
            onAdd={onInclude}
            onRemove={onRemoveInclude}
            placeholder={`Buscar para ${
              MEAL_LABELS[mealType] || mealType
            }...`}
          />

          <MealFoodSearch
            kind="exclude"
            values={excludedFoods}
            onAdd={onExclude}
            onRemove={onRemoveExclude}
            placeholder={`Evitar en ${
              MEAL_LABELS[mealType] || mealType
            }...`}
          />
        </div>
      ) : null}
    </article>
  );
}





function IncludedFoodRow({
  food,
  mealTypes,
  onChange,
  onRemove,
}) {
  /*
   * Un alimento elegido explícitamente por el usuario
   * puede asignarse a cualquiera de las comidas
   * configuradas para el día.
   *
   * Los mealTypes de Mongo sólo controlan el pool
   * automático, no una elección manual.
   */
  const availableMealTypes = Array.isArray(mealTypes)
    ? mealTypes
    : [];

  const selectedTarget =
    food.targetMealType === "any" ||
    availableMealTypes.includes(food.targetMealType)
      ? food.targetMealType
      : "any";

  return (
    <article className="grid min-h-[68px] grid-cols-[38px_minmax(0,1fr)_34px] items-center gap-2 rounded-2xl border border-teal-300/20 bg-[linear-gradient(135deg,rgba(45,212,191,.08),rgba(255,255,255,.02))] px-2.5 py-2">

      <span className="grid h-9 w-9 place-items-center rounded-full border border-teal-300/25 bg-teal-300/10 text-teal-200">
        <Utensils size={16} />
      </span>

      <div className="min-w-0">

        <strong className="block truncate text-[11px] font-black text-white">
          {foodName(food)}
        </strong>

        <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-2">

          <label className="flex min-w-[70px] cursor-pointer items-center gap-1.5 border-r border-white/10 pr-2">

            <input
              type="checkbox"
              checked={food.mustAppear === true}
              onChange={(event) =>
                onChange({
                  ...food,
                  mustAppear: event.target.checked,
                })
              }
              className="h-3.5 w-3.5 accent-teal-300"
            />

            <span className="text-[7px] font-black leading-tight text-zinc-400">
              Debe
              <br />
              aparecer
            </span>

          </label>

          <label className="min-w-0">

            <span className="block text-[7px] font-black text-zinc-600">
              Aparece en
            </span>

            <select
              value={selectedTarget}
              onChange={(event) =>
                onChange({
                  ...food,
                  targetMealType: event.target.value,
                })
              }
              className="mt-0.5 min-h-7 w-full rounded-lg border border-white/10 bg-[#090f15] px-1.5 text-[8px] font-black text-zinc-200"
            >
              <option value="any">
                Cualquier comida
              </option>

              {availableMealTypes.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {MEAL_LABELS[type] || type}
                </option>
              ))}
            </select>

          </label>

        </div>

      </div>

      <button
        type="button"
        onClick={onRemove}
        className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-rose-400/10 hover:text-rose-200"
        aria-label={`Quitar ${foodName(food)}`}
      >
        <X size={15} />
      </button>

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
  listAlimentos({
  search: term,
  limit: 10,
})
        .then((response) => {
          if (!active) return;

setResults(
  (response?.alimentos || []).filter(
    (food) =>
      !values.some(
        (item) =>
          foodKey(item) ===
          foodKey(food)
      )
  )
);


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
    if (profile === "recommended") {
      setDraft((current) => ({
        ...DEFAULT_MENU_GENERATION_SETTINGS,
        includeFoods: current.includeFoods,
        excludeFoods: current.excludeFoods,
        firstMealTime: current.firstMealTime,
      }));
    } else if (profile === "library") {
      setDraft((current) => ({
        ...current,
        generationProfile: profile,
        mode: MENU_GENERATION_MODE_SIMILAR,
      }));
    } else {
      setDraft((current) => ({
        ...current,
        generationProfile: profile,
      }));
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h3 className="text-[22px] font-black leading-tight text-white">
          ¿Cómo querés crear tu menú?
        </h3>

        <p className="mt-2 text-[13px] font-semibold text-zinc-400">
          Elegí una opción para empezar.
        </p>
      </div>

      <div className="grid gap-3">
        {PROFILE_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.id}
            {...option}
            selected={draft.generationProfile === option.id}
            onClick={() => selectProfile(option.id)}
          />
        ))}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/[0.06] px-4 py-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-teal-300/30 text-teal-300">
          <Info size={16} />
        </span>

        <p className="pt-1 text-[11px] font-semibold leading-relaxed text-zinc-300">
          Podés volver y cambiar estos ajustes antes de crear tu menú.
        </p>
      </div>
    </div>
  );
}

function StepTwo({
  draft,
  setDraft,
  target = {},
  protectedMealTypes = [],
  editingExistingTargets = false,
}) {
  const [showExtraMealTypes, setShowExtraMealTypes] = useState(false);
  const protectedTypes = new Set(Array.isArray(protectedMealTypes) ? protectedMealTypes : []);

  const mealTypes = Array.isArray(draft.mealTypes)
    ? draft.mealTypes
    : mealTypesForCount(draft.mealCount);

  const distributionMode =
    draft.calorieDistributionMode || "balanced";

  const customPercentages =
    draft.calorieDistributionPercents &&
    typeof draft.calorieDistributionPercents === "object"
      ? draft.calorieDistributionPercents
      : evenMealPercentages(mealTypes);

const lockedCalorieMeals =
  draft.lockedCalorieMeals &&
  typeof draft.lockedCalorieMeals === "object"
    ? draft.lockedCalorieMeals
    : {};


  const customDistributionTotal = mealTypes.reduce(
    (total, type) =>
      total + Number(customPercentages[type] || 0),
    0
  );

  const freeCalories = Math.max(
    0,
    Number(draft.freeCalories || 0)
  );
  const maximumFreeCalories = draft.generationProfile === "target"
    ? Math.max(0, (Number(target?.kcal) || 0) - 1)
    : 2000;

  const freeCaloriesPreset =
    draft.freeCaloriesPreset ||
    ([0, 100, 200, 300].includes(freeCalories)
      ? String(freeCalories)
      : "custom");

  const toggleMealType = (type) => {
    if (protectedTypes.has(type)) return;
    setDraft((current) => {
      const selected = Array.isArray(current.mealTypes)
        ? current.mealTypes
        : mealTypesForCount(current.mealCount);

      if (selected.includes(type)) {
        const nextMealTypes = selected.filter(
          (item) => item !== type
        );

        return {
          ...current,
          mealTypes: nextMealTypes,
          calorieDistributionPercents:
            evenMealPercentages(nextMealTypes),
        };
      }

      if (selected.length >= Number(current.mealCount)) {
        return current;
      }

      const nextMealTypes = [...selected, type];

      return {
        ...current,
        mealTypes: nextMealTypes,
        calorieDistributionPercents:
          evenMealPercentages(nextMealTypes),
      };
    });
  };

  const selectMealCount = (count) => {
    if (count < protectedTypes.size) return;
    const orderedCandidates = [
      ...mealTypes,
      ...mealTypesForCount(count),
      ...MAIN_MEAL_TYPES,
      ...EXTRA_MEAL_TYPES,
    ].filter((type, index, values) => values.indexOf(type) === index);
    const selectedTypes = new Set(protectedTypes);
    orderedCandidates.forEach((type) => {
      if (selectedTypes.size < count) selectedTypes.add(type);
    });
    const nextMealTypes = orderedCandidates.filter((type) => selectedTypes.has(type)).slice(0, count);

    setDraft((current) => ({
      ...current,
      mealCount: count,
      mealTypes: nextMealTypes,
      calorieDistributionPercents:
        evenMealPercentages(nextMealTypes),
    }));
  };

  const selectDistribution = (mode) => {
    setDraft((current) => ({
      ...current,

      /*
       * Campo nuevo.
       * Después lo conectaremos al planificador.
       */
      calorieDistributionMode: mode,

      /*
       * Conservamos el campo viejo por ahora
       * para no romper el generador actual.
       */
      distribution: "balanced",

      calorieDistributionPercents:
        mode === "custom"
          ? (
              current.calorieDistributionPercents &&
              typeof current.calorieDistributionPercents === "object"
                ? current.calorieDistributionPercents
                : evenMealPercentages(mealTypes)
            )
          : current.calorieDistributionPercents,
    }));
  };

const updateCustomPercentage = (type, value) => {
  setDraft((current) => {
    const currentPercentages =
      current.calorieDistributionPercents &&
      typeof current.calorieDistributionPercents === "object"
        ? current.calorieDistributionPercents
        : evenMealPercentages(mealTypes);

    const locked =
      current.lockedCalorieMeals &&
      typeof current.lockedCalorieMeals === "object"
        ? current.lockedCalorieMeals
        : {};

    const nextPercentages =
      rebalanceCaloriePercentages({
        mealTypes,
        percentages: currentPercentages,
        locked,
        changedType: type,
        changedValue: value,
      });

    return {
      ...current,
      calorieDistributionPercents:
        nextPercentages,
    };
  });
};

const toggleCalorieMealLock = (type) => {
  setDraft((current) => ({
    ...current,

    lockedCalorieMeals: {
      ...(current.lockedCalorieMeals || {}),
      [type]:
        !current.lockedCalorieMeals?.[type],
    },
  }));
};




  const selectFreeCalories = (preset) => {
    if (preset.id === "custom") {
      setDraft((current) => ({
        ...current,
        freeCaloriesPreset: "custom",
        freeCalories:
          Number(current.freeCalories) > 0
            ? Number(current.freeCalories)
            : Math.min(200, maximumFreeCalories),
      }));

      return;
    }

    setDraft((current) => ({
      ...current,
      freeCaloriesPreset: preset.id,
      freeCalories: Math.min(preset.value, maximumFreeCalories),
    }));
  };

  const visibleMealTypes = [
    ...MAIN_MEAL_TYPES,
    ...(showExtraMealTypes ||
    mealTypes.some((type) =>
      EXTRA_MEAL_TYPES.includes(type)
    )
      ? EXTRA_MEAL_TYPES
      : []),
  ];

  return (
    <section className="rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.08),transparent_28%),linear-gradient(145deg,#0d151d,#080d13)] p-4 shadow-[0_18px_40px_rgba(0,0,0,.34)]">

      <SectionTitle
        icon={Utensils}
        title="Estructura del día"
        text="Definí cuántas comidas querés y cómo repartir tu objetivo."
      />

      {/* ================================================= */}
      {/* 1. CANTIDAD DE COMIDAS */}
      {/* ================================================= */}

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-3">
        <strong className="text-[12px] font-black text-zinc-200">
          1. Cantidad de comidas
        </strong>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {(editingExistingTargets ? [1, 2, 3, 4, 5, 6] : [3, 4, 5, 6]).map((count) => {
            const selected =
              Number(draft.mealCount) === count;
            const unavailable = count < protectedTypes.size;

            return (
              <button
                key={count}
                type="button"
                onClick={() => selectMealCount(count)}
                disabled={unavailable}
                className={`min-h-[68px] rounded-2xl border text-center transition ${
                  selected
                    ? "border-teal-300/70 bg-teal-300/[0.09] text-teal-300 shadow-[0_0_18px_rgba(45,212,191,.08)]"
                    : unavailable
                      ? "cursor-not-allowed border-white/[0.05] bg-black/10 text-zinc-700"
                      : "border-white/10 bg-black/20 text-zinc-400"
                }`}
              >
                <strong className="block text-[20px] font-black leading-none">
                  {count}
                </strong>

                <span className="mt-1 block text-[9px] font-bold">
                  comidas
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================= */}
      {/* 2. TIPOS DE COMIDA */}
      {/* ================================================= */}

      <div className="mt-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-[12px] font-black text-zinc-200">
            2. Elegí los tipos de comidas
          </strong>

          <span
            className={`text-[10px] font-black ${
              mealTypes.length === Number(draft.mealCount)
                ? "text-teal-300"
                : "text-amber-300"
            }`}
          >
            {mealTypes.length}/{draft.mealCount}
          </span>
        </div>

        <p className="mt-1 text-[9px] font-semibold text-zinc-500">
          Elegí exactamente la cantidad de comidas configurada.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {visibleMealTypes.map((type) => {
            const selected = mealTypes.includes(type);
            const protectedType = protectedTypes.has(type);
            const Icon = MEAL_ICONS[type] || Utensils;

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleMealType(type)}
                disabled={protectedType}
                title={protectedType ? "Esta comida tiene consumos y no se puede quitar" : undefined}
                className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-[10px] font-black transition ${
                  selected
                    ? "border-teal-300/50 bg-teal-300/[0.10] text-teal-100"
                    : "border-white/10 bg-white/[0.025] text-zinc-500"
                }`}
              >
                <Icon
                  size={14}
                  className={
                    selected
                      ? "text-teal-300"
                      : "text-zinc-600"
                  }
                />

                {MEAL_LABELS[type] || type}

                {protectedType ? (
                  <span className="grid h-4 w-4 place-items-center rounded-full border border-[#FFD75E]/40 bg-[#D4AF37]/15 text-[#FFD75E]">
                    <Lock size={9} strokeWidth={2.7} />
                  </span>
                ) : selected ? (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-teal-300 text-black">
                    <Check size={10} strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {!showExtraMealTypes ? (
          <button
            type="button"
            onClick={() => setShowExtraMealTypes(true)}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 text-[9px] font-black text-zinc-400"
          >
            <Plus size={14} />
            Agregar otro tipo
          </button>
        ) : null}
      </div>

      {/* ================================================= */}
      {/* 3. DISTRIBUCIÓN DE CALORÍAS */}
      {/* ================================================= */}

      <div className="mt-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3">
        <strong className="text-[12px] font-black text-zinc-200">
          3. Distribución de calorías
        </strong>

        <p className="mt-1 text-[9px] font-semibold text-zinc-500">
          Elegí cómo querés distribuir las calorías entre las comidas.
        </p>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {CALORIE_DISTRIBUTION_OPTIONS.map(
            (option) => {
              const selected =
                distributionMode === option.id;

              const Icon = option.icon;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    selectDistribution(option.id)
                  }
                  className={`grid min-h-[76px] place-items-center content-center gap-1 rounded-xl border px-1.5 text-center transition ${
                    selected
                      ? option.id === "custom"
                        ? "border-[#FFD75E]/75 bg-[#D4AF37]/10 text-[#FFD75E] shadow-[0_0_15px_rgba(212,175,55,.10)]"
                        : "border-teal-300/50 bg-teal-300/[0.08] text-teal-200"
                      : "border-white/10 bg-black/20 text-zinc-500"
                  }`}
                >
                  <Icon size={18} />

                  <span className="text-[8px] font-black leading-tight">
                    {option.label}
                  </span>
                </button>
              );
            }
          )}
        </div>

        {distributionMode === "custom" ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-[#070c12] p-3">
            <div className="grid gap-3">
              {mealTypes.map((type) => {
                const Icon =
                  MEAL_ICONS[type] || Utensils;

                const value = Number(
                  customPercentages[type] || 0
                );

                return (
<div
  key={type}
  className="grid grid-cols-[105px_minmax(0,1fr)_72px_34px] items-center gap-2"
>
                    <span className="flex items-center gap-2 text-[12px] font-black text-zinc-200">
                      <Icon
                        size={14}
                        className="text-teal-300"
                      />

                      <span className="truncate">
                        {MEAL_LABELS[type] || type}
                      </span>
                    </span>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={value}
                      onChange={(event) =>
                        updateCustomPercentage(
                          type,
                          event.target.value
                        )
                      }
                      className="w-full accent-teal-300"
                    />

                    <label className="grid grid-cols-[1fr_auto] items-center gap-1 rounded-xl border border-white/10 bg-black/25 px-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(event) =>
                          updateCustomPercentage(
                            type,
                            event.target.value
                          )
                        }
                       className="min-h-10 min-w-0 bg-transparent text-right text-[15px] font-black text-white outline-none"
                      />

                      <span className="text-[12px] font-black text-zinc-500">
                        %
                      </span>
                    </label>
<button
  type="button"
  onClick={() =>
    toggleCalorieMealLock(type)
  }
  className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
    lockedCalorieMeals[type]
      ? "border-[#FFD75E]/60 bg-[#D4AF37]/15 text-[#FFD75E]"
      : "border-white/10 bg-white/[0.025] text-zinc-500"
  }`}
  title={
    lockedCalorieMeals[type]
      ? "Desbloquear porcentaje"
      : "Fijar porcentaje"
  }
>
  {lockedCalorieMeals[type] ? (
    <Lock size={15} />
  ) : (
    <Unlock size={15} />
  )}
</button>



                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3">
              <strong className="text-[10px] font-black text-zinc-300">
                Total
              </strong>

              <strong
                className={`text-[11px] font-black ${
                  customDistributionTotal === 100
                    ? "text-teal-300"
                    : "text-amber-300"
                }`}
              >
                {customDistributionTotal} %
              </strong>
            </div>

            {customDistributionTotal !== 100 ? (
              <p className="mt-2 text-right text-[8px] font-bold text-amber-300">
                La distribución personalizada debe sumar 100%.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ================================================= */}
      {/* CALORÍAS LIBRES */}
      {/* ================================================= */}

      <div className="relative mt-3 overflow-hidden rounded-[1.35rem] border border-[#FFD75E]/75 bg-[radial-gradient(circle_at_100%_0%,rgba(255,215,94,.13),transparent_36%),linear-gradient(145deg,rgba(212,175,55,.10),rgba(8,13,19,.96))] p-4 shadow-[0_0_24px_rgba(212,175,55,.10)]">

        <div className="pointer-events-none absolute right-4 top-3 text-[#FFD75E]/25">
          ✦
        </div>

        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#FFD75E]/45 bg-[#D4AF37]/15 text-[#FFD75E]">
            <Sparkles size={19} />
          </span>

          <div>
            <div className="flex flex-wrap items-baseline gap-1">
              <strong className="text-[15px] font-black text-[#FFD75E]">
                Calorías libres
              </strong>

              <span className="text-[10px] font-bold text-zinc-400">
                (opcional)
              </span>
            </div>

            <p className="mt-1 text-[9px] font-semibold leading-relaxed text-zinc-400">
              Dejá un margen de calorías para usarlas con flexibilidad.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {FREE_CALORIE_PRESETS.map((preset) => {
            const selected =
              freeCaloriesPreset === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  selectFreeCalories(preset)
                }
                className={`min-h-[54px] rounded-xl border px-1.5 text-center transition ${
                  selected
                    ? "border-[#FFD75E] bg-[#D4AF37]/20 text-[#FFD75E] shadow-[0_0_16px_rgba(255,215,94,.18)]"
                    : "border-white/10 bg-black/25 text-zinc-300"
                }`}
              >
                <strong className="block text-[9px] font-black leading-tight">
                  {preset.label}
                </strong>

                {preset.sublabel ? (
                  <span className="mt-0.5 block text-[7px] font-bold opacity-70">
                    {preset.sublabel}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {freeCaloriesPreset === "custom" ? (
          <label className="mt-3 block">
            <span className="text-[9px] font-black text-[#FFD75E]">
              ¿Cuántas calorías querés dejar libres?
            </span>

            <div className="mt-2 grid grid-cols-[1fr_auto] items-center rounded-xl border border-[#FFD75E]/35 bg-black/30 px-3">
              <input
                type="number"
                min="0"
                max={maximumFreeCalories}
                step="10"
                value={freeCalories}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    freeCaloriesPreset: "custom",
                    freeCalories: Math.min(maximumFreeCalories, Math.max(
                      0,
                      Number(event.target.value) || 0
                    )),
                  }))
                }
                className="min-h-11 min-w-0 bg-transparent text-[13px] font-black text-white outline-none"
              />

              <span className="text-[10px] font-black text-[#FFD75E]">
                kcal
              </span>
            </div>
          </label>
        ) : null}

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-teal-300/25 bg-teal-300/[0.07] px-3 py-2.5">
          <Info
            size={15}
            className="mt-0.5 shrink-0 text-teal-300"
          />

          <p className="text-[9px] font-bold leading-relaxed text-teal-100">
            {draft.generationProfile === "target"
              ? freeCalories > 0
                ? `${formatKcal(freeCalories)} quedarán reservadas y no se asignarán a las metas de las comidas.`
                : "Las metas de las comidas usarán todo tu objetivo calórico diario."
              : freeCalories > 0
                ? `${formatKcal(freeCalories)} no se asignarán a ninguna comida automática. Podés usarlas cuando quieras.`
                : "El menú automático usará todo tu objetivo calórico diario."}
          </p>
        </div>
      </div>
    </section>
  );
}


function TargetMealsStep({
  draft,
  setDraft,
  target,
  dailyTarget = {},
  trackingBreakdown = {},
  sessionSeed = "",
  editingExistingTargets = false,
  minimumTargetsByMealId = {},
  preservedMealIds = [],
  consumedMeals = [],
  mealRecordsById = {},
  originalMealIds = [],
}) {
  const mealTypes = Array.isArray(draft.mealTypes) ? draft.mealTypes : mealTypesForCount(draft.mealCount);
  const tracked = trackingBreakdown?.total || {};
  const freeEligible = trackingBreakdown?.freeEligible || {};
  const consumedKcal = Number(tracked?.kcal) || 0;
  const consumedProtein = Number(tracked?.proteina) || 0;
  const consumedCarbs = Number(tracked?.carbs) || 0;
  const consumedFat = Number(tracked?.grasas) || 0;
  const freeEligibleKcal = Number(freeEligible?.kcal) || 0;
  const freeEligibleProtein = Number(freeEligible?.proteina) || 0;
  const freeEligibleCarbs = Number(freeEligible?.carbs) || 0;
  const freeEligibleFat = Number(freeEligible?.grasas) || 0;
  const includedConsumption = personalMealTargetTotals(
    (Array.isArray(consumedMeals) ? consumedMeals : []).map((meal) => ({
      target: meal?.consumed || {},
    }))
  );
  const includedConsumedKcal = Math.min(consumedKcal, Math.max(0, Number(includedConsumption.kcal) || 0));
  const externalConsumedKcal = Math.max(0, Math.round((consumedKcal - includedConsumedKcal) * 10) / 10);
  const preservedMealIdsKey = (Array.isArray(preservedMealIds) ? preservedMealIds : [])
    .map(String)
    .sort()
    .join("\u0000");
  const preservedMealIdSet = useMemo(
    () => new Set(preservedMealIdsKey ? preservedMealIdsKey.split("\u0000") : []),
    [preservedMealIdsKey]
  );
  const consumedMealsSignature = (Array.isArray(consumedMeals) ? consumedMeals : [])
    .map((meal) => [
      meal?.id || meal?.mealId,
      meal?.type,
      meal?.consumed?.kcal,
      meal?.consumed?.proteina,
      meal?.consumed?.carbs,
      meal?.consumed?.grasas,
    ])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  const targetPlanSignatureFor = (types) => JSON.stringify({
    target: [target?.kcal, target?.proteina ?? target?.p, target?.carbs ?? target?.c, target?.grasas ?? target?.g],
    mealTypes: types,
    mode: draft.calorieDistributionMode,
    percentages: draft.calorieDistributionPercents,
    freeCalories: draft.freeCalories,
    consumed: [consumedKcal, consumedProtein, consumedCarbs, consumedFat],
    freeEligible: [freeEligibleKcal, freeEligibleProtein, freeEligibleCarbs, freeEligibleFat],
    preservedMealIds: [...preservedMealIdSet].sort(),
    consumedMeals: consumedMealsSignature,
    sessionSeed,
  });
  const signature = targetPlanSignatureFor(mealTypes);
  const [editor, setEditor] = useState(null);
  const [editorLocks, setEditorLocks] = useState({ proteina: false, carbs: false, grasas: false });
  const [editMode, setEditMode] = useState("redistribute");
  const [error, setError] = useState("");
  const [editNotice, setEditNotice] = useState("");
  const [dismissedWarning, setDismissedWarning] = useState("");
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [mealPendingRemoval, setMealPendingRemoval] = useState(null);

  useEffect(() => {
    if (draft.targetPlanSignature === signature && Array.isArray(draft.targetMeals)) return;
    if (
      editingExistingTargets
      && !draft.targetPlanSignature
      && Array.isArray(draft.targetMeals)
      && draft.targetMeals.length
    ) {
      setDraft((current) => ({ ...current, targetPlanSignature: signature }));
      return;
    }
    try {
      const basePlan = buildPersonalMealTargetDayPlan({
        dailyTarget: target,
        consumedNutrition: {
          kcal: consumedKcal,
          proteina: consumedProtein,
          carbs: consumedCarbs,
          grasas: consumedFat,
        },
        freeEligibleNutrition: {
          kcal: freeEligibleKcal,
          proteina: freeEligibleProtein,
          carbs: freeEligibleCarbs,
          grasas: freeEligibleFat,
        },
        mealTypes,
        existingMeals: (Array.isArray(draft.targetMeals) ? draft.targetMeals : [])
          .filter((meal) => (
            meal?.derivedFromConsumption !== true
            && (
              meal?.confirmed === true
              || preservedMealIdSet.has(String(meal?.id || meal?.mealId || ""))
              || (
                editingExistingTargets
                && Number(minimumTargetsByMealId?.[meal?.id]?.kcal) > 0
              )
            )
          )),
        distributionMode: draft.calorieDistributionMode,
        distributionPercentages: draft.calorieDistributionPercents,
        freeCalories: draft.freeCalories,
        seed: sessionSeed || signature,
        minimumMealCount: editingExistingTargets ? 1 : 3,
      });
      const plan = !editingExistingTargets && consumedMeals.length
        ? mergeConsumedMealsIntoPersonalTargetPlan(basePlan, consumedMeals)
        : basePlan;
      const currentMeals = Array.isArray(draft.targetMeals) ? draft.targetMeals : [];
      const reusedIndexes = new Set();
      const plannedMeals = editingExistingTargets
        ? plan.meals.map((plannedMeal) => {
            const currentIndex = currentMeals.findIndex((currentMeal, index) => (
              !reusedIndexes.has(index)
              && String(currentMeal?.type || "") === String(plannedMeal?.type || "")
            ));
            if (currentIndex < 0) return plannedMeal;
            reusedIndexes.add(currentIndex);
            const currentMeal = currentMeals[currentIndex];
            return {
              ...currentMeal,
              ...plannedMeal,
              id: currentMeal.id,
              preserved: currentMeal.preserved === true,
              target: plannedMeal.target,
            };
          })
        : plan.meals;
      setDraft((current) => ({
        ...current,
        targetMeals: plannedMeals,
        targetPlannedTarget: plan.plannedTarget,
        targetFreeCalories: plan.freeCalories,
        targetPlanSignature: signature,
        targetPlanCustomized: plannedMeals.some((meal) => meal?.confirmed === true),
        targetIncludesTrackedConsumption: !editingExistingTargets && consumedMeals.length > 0,
        targetIncludedTrackedConsumption: !editingExistingTargets
          ? includedConsumption
          : null,
      }));
      setError("");
    } catch (planError) {
      setError(planError?.message || "No pudimos distribuir las metas.");
    }
  }, [
    draft.calorieDistributionMode,
    draft.calorieDistributionPercents,
    draft.freeCalories,
    draft.targetMeals,
    draft.targetPlanSignature,
    consumedCarbs,
    consumedFat,
    consumedKcal,
    consumedProtein,
    consumedMeals,
    freeEligibleCarbs,
    freeEligibleFat,
    freeEligibleKcal,
    freeEligibleProtein,
    editingExistingTargets,
    mealTypes,
    minimumTargetsByMealId,
    preservedMealIdSet,
    sessionSeed,
    setDraft,
    signature,
    target,
  ]);

  const meals = Array.isArray(draft.targetMeals) ? draft.targetMeals : [];
  const availableMealTypes = [...MAIN_MEAL_TYPES, ...EXTRA_MEAL_TYPES]
    .filter((type, index, values) => values.indexOf(type) === index && !mealTypes.includes(type));
  const totals = personalMealTargetTotals(meals);
  const freeCalories = Math.max(0, Number(draft.targetFreeCalories ?? draft.freeCalories) || 0);
  const plannedKcal = Number(draft.targetPlannedTarget?.kcal)
    || Math.max(0, (Number(target?.kcal) || 0) - freeCalories);
  const overPlannedKcal = Math.max(0, Math.round((totals.kcal - plannedKcal) * 10) / 10);
  const openEditor = (meal) => {
    if (meal?.confirmed) return;
    const minimumConsumed = minimumTargetsByMealId?.[meal.id] || null;
    const hasConsumedMinimum = minimumConsumed && ["kcal", "proteina", "carbs", "grasas"]
      .some((key) => Number(minimumConsumed[key]) > 0.05);
    setEditor({
      id: meal.id,
      name: meal.name,
      ...meal.target,
      minimumConsumed: hasConsumedMinimum ? minimumConsumed : null,
    });
    setEditorLocks({ proteina: false, carbs: false, grasas: false });
    setEditMode("redistribute");
    setError("");
    setEditNotice("");
  };
  const toggleMealConfirmation = (mealId) => {
    setDraft((current) => ({
      ...current,
      targetMeals: (Array.isArray(current.targetMeals) ? current.targetMeals : []).map((meal) => (
        meal.id === mealId ? { ...meal, confirmed: meal.confirmed !== true } : meal
      )),
      targetPlanCustomized: true,
    }));
    if (editor?.id === mealId) setEditor(null);
    setEditNotice("");
    setError("");
  };
  const addMealType = (type) => {
    if (!type || mealTypes.includes(type) || mealTypes.length >= 6) return;
    setDraft((current) => {
      const nextMealTypes = [...(Array.isArray(current.mealTypes) ? current.mealTypes : []), type];
      return {
        ...current,
        mealTypes: nextMealTypes,
        mealCount: nextMealTypes.length,
        calorieDistributionPercents: evenMealPercentages(nextMealTypes),
        targetPlanCustomized: true,
      };
    });
    setShowMealPicker(false);
    setEditNotice(`${MEAL_LABELS[type] || "La comida"} se agregó y las metas abiertas se redistribuyeron.`);
    setError("");
  };
  const moveMeal = (mealId, direction) => {
    setDraft((current) => {
      const currentMeals = Array.isArray(current.targetMeals) ? current.targetMeals : [];
      const nextMeals = reorderPersonalMealTargets(currentMeals, mealId, direction);
      if (nextMeals.every((meal, index) => meal === currentMeals[index])) return current;
      const nextMealTypes = nextMeals.map((meal) => meal.type);
      return {
        ...current,
        targetMeals: nextMeals,
        mealTypes: nextMealTypes,
        mealCount: nextMealTypes.length,
        targetPlanSignature: targetPlanSignatureFor(nextMealTypes),
        targetPlanCustomized: true,
      };
    });
    setEditNotice("Orden actualizado. Las metas y los alimentos registrados se conservaron.");
    setError("");
  };
  const requestMealRemoval = (meal) => {
    if (!meal || meals.length <= 1) return;
    setMealPendingRemoval({
      meal,
      records: Array.isArray(mealRecordsById?.[meal.id]) ? mealRecordsById[meal.id] : [],
    });
  };
  const confirmMealRemoval = () => {
    const meal = mealPendingRemoval?.meal;
    if (!meal) return;
    const originalIds = new Set((Array.isArray(originalMealIds) ? originalMealIds : []).map(String));
    setDraft((current) => {
      const currentMeals = Array.isArray(current.targetMeals) ? current.targetMeals : [];
      const nextMeals = currentMeals.filter((item) => String(item.id) !== String(meal.id));
      const nextMealTypes = nextMeals.map((item) => item.type);
      const removedIds = new Set(Array.isArray(current.targetRemovedMealIds) ? current.targetRemovedMealIds.map(String) : []);
      if (originalIds.has(String(meal.id))) removedIds.add(String(meal.id));
      return {
        ...current,
        targetMeals: nextMeals,
        mealTypes: nextMealTypes,
        mealCount: nextMealTypes.length,
        calorieDistributionPercents: evenMealPercentages(nextMealTypes),
        targetRemovedMealIds: [...removedIds],
        targetPlanCustomized: true,
      };
    });
    if (editor?.id === meal.id) setEditor(null);
    setMealPendingRemoval(null);
    setEditNotice(`${meal.name} se eliminará al guardar${mealPendingRemoval.records.length ? ` junto con ${mealPendingRemoval.records.length} registro${mealPendingRemoval.records.length === 1 ? "" : "s"}` : ""}.`);
    setError("");
  };
  const adjustedEditor = (nextEditor, locks, preserveKey = "") => {
    const kcal = Number(nextEditor?.kcal);
    if (!(kcal > 0)) return nextEditor;
    const effectiveLocks = preserveKey ? { ...locks, [preserveKey]: true } : locks;
    const calculation = calculateLockedMealMacros({
      kcal,
      macros: nextEditor,
      locks: effectiveLocks,
      dailyTarget: target,
    });
    if (calculation.invalidLockedMacros.length) return nextEditor;
    return { ...nextEditor, ...calculation.macros };
  };
  const updateEditor = (key, value) => {
    setEditor((current) => {
      const next = { ...current, [key]: value };
      if (key === "kcal") return adjustedEditor(next, editorLocks);
      if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) return next;
      return adjustedEditor(next, editorLocks, key);
    });
  };
  const toggleEditorLock = (key) => {
    const nextLocks = { ...editorLocks, [key]: !editorLocks[key] };
    setEditorLocks(nextLocks);
    setEditor((current) => adjustedEditor(current, nextLocks));
  };
  const editorMacroKcal = editor
    ? Math.round(((Number(editor.proteina) || 0) * 4 + (Number(editor.carbs) || 0) * 4 + (Number(editor.grasas) || 0) * 9) * 10) / 10
    : 0;
  const editorRoundedKcal = Math.round(editorMacroKcal);
  const editorKcalDifference = editor ? Math.round((editorMacroKcal - (Number(editor.kcal) || 0)) * 10) / 10 : 0;
  const applyEdit = () => {
    setError("");
    setEditNotice("");
    try {
      const effectiveTarget = { ...editor, kcal: editorRoundedKcal };
      const consumedMinimum = editor?.minimumConsumed || {};
      const belowConsumed = [
        ["kcal", "calorías"],
        ["proteina", "proteína"],
        ["carbs", "carbohidratos"],
        ["grasas", "grasas"],
      ].find(([key]) => Number(effectiveTarget[key]) + 0.05 < Number(consumedMinimum[key] || 0));
      if (belowConsumed) {
        throw new Error(`La meta de ${belowConsumed[1]} no puede quedar por debajo de lo que ya consumiste en esta comida.`);
      }
      const editableMealIds = meals
        .filter((meal) => (
          meal?.confirmed !== true
          && !(Number(minimumTargetsByMealId?.[meal.id]?.kcal) > 0)
        ))
        .map((meal) => meal.id);
      const result = editPersonalMealTargetDay({
        meals,
        mealId: editor.id,
        target: effectiveTarget,
        mode: editMode,
        maximumKcal: plannedKcal,
        editableMealIds,
        confirmedMealIds: meals.filter((meal) => meal.confirmed).map((meal) => meal.id),
        onlySubsequent: true,
        minimumRecipientKcal: 100,
      });
      setDraft((current) => ({
        ...current,
        targetMeals: result.meals,
        targetPlanCustomized: true,
      }));
      setEditor(null);
      setError("");
      const residualKcal = Math.round((Number(result.residual?.kcal) || 0) * 10) / 10;
      if (Math.abs(residualKcal) > 0.05) {
        setEditNotice(`Se conservaron los macros forzados (${editorMacroKcal} kcal reales; meta redondeada a ${editorRoundedKcal} kcal) y se redistribuyó todo lo posible. Quedaron ${residualKcal > 0 ? "+" : ""}${residualKcal} kcal respecto del plan anterior.`);
      } else if (editMode === "redistribute") {
        setEditNotice(`Meta guardada en ${editorRoundedKcal} kcal. Las metas posteriores no confirmadas se redistribuyeron sin bajar de 100 kcal.`);
      } else {
        setEditNotice(`Los macros equivalen a ${editorMacroKcal} kcal; la meta se guardó redondeada en ${editorRoundedKcal} kcal.`);
      }
    } catch (editError) {
      const exceedsBudget = /presupuesto calórico|superan tu objetivo diario/i.test(editError?.message || "");
      setDismissedWarning("");
      setError(exceedsBudget
        ? `No se puede guardar: esos macros equivalen a ${editorMacroKcal} kcal y no queda capacidad suficiente en las comidas posteriores abiertas sin bajar alguna de 100 kcal. El menú dispone de ${plannedKcal} kcal; las ${freeCalories} kcal libres permanecen reservadas.`
        : editError?.message || "No pudimos aplicar esa meta.");
    }
  };

  const mealTones = [
    { border: "border-teal-300/35", glow: "shadow-[inset_3px_0_0_#2dd4bf,0_12px_30px_rgba(0,0,0,.22)]", icon: "border-teal-300/25 bg-teal-300/10 text-teal-300", text: "text-teal-300", bar: "bg-gradient-to-r from-teal-400 to-cyan-300", button: "border-teal-300/30 bg-teal-300/10 text-teal-200" },
    { border: "border-violet-400/30", glow: "shadow-[inset_3px_0_0_#a855f7,0_12px_30px_rgba(0,0,0,.22)]", icon: "border-violet-400/25 bg-violet-400/10 text-violet-300", text: "text-violet-300", bar: "bg-gradient-to-r from-violet-500 to-fuchsia-300", button: "border-violet-400/30 bg-violet-400/10 text-violet-200" },
    { border: "border-amber-400/30", glow: "shadow-[inset_3px_0_0_#f59e0b,0_12px_30px_rgba(0,0,0,.22)]", icon: "border-amber-400/25 bg-amber-400/10 text-amber-300", text: "text-amber-300", bar: "bg-gradient-to-r from-amber-500 to-orange-300", button: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
    { border: "border-sky-400/30", glow: "shadow-[inset_3px_0_0_#38bdf8,0_12px_30px_rgba(0,0,0,.22)]", icon: "border-sky-400/25 bg-sky-400/10 text-sky-300", text: "text-sky-300", bar: "bg-gradient-to-r from-sky-500 to-cyan-300", button: "border-sky-400/30 bg-sky-400/10 text-sky-200" },
  ];

  const metricCards = [
    { label: "Planificado", value: formatKcal(totals.kcal), icon: Flame, tone: "text-[#FFD75E]" },
    { label: "Proteína", value: `P ${totals.proteina} g`, icon: Dumbbell, tone: "text-teal-300" },
    { label: "Carbos", value: `C ${totals.carbs} g`, icon: Apple, tone: "text-violet-300" },
    { label: "Grasas", value: `G ${totals.grasas} g`, icon: Gauge, tone: "text-orange-300" },
  ];
  const overBudgetWarning = !personalMealTargetTotalFitsBudget(totals.kcal, plannedKcal)
    ? `El menú supera en ${formatKcal(overPlannedKcal)} sus ${formatKcal(plannedKcal)} planificadas. Desbloqueá y corregí una meta antes de continuar; las ${formatKcal(freeCalories)} libres siguen reservadas.`
    : "";
  const blockingWarning = error || overBudgetWarning;
  const showBlockingWarning = Boolean(blockingWarning) && dismissedWarning !== blockingWarning;

  return (
    <div className="grid gap-3">
      <section className="overflow-hidden rounded-[1.25rem] border border-teal-300/25 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.14),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(6,182,212,.07),transparent_35%),linear-gradient(145deg,#07151c,#070d14)] p-3 shadow-[0_14px_36px_rgba(0,0,0,.30)]">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-teal-300/30 bg-teal-300/10 text-teal-200"><Target size={17} /></span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-black leading-tight text-white">Crear por meta</h3>
              <p className="mt-0.5 truncate text-[10px] font-bold text-zinc-500">Revisá las metas concretas de este día.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-teal-300/20 bg-teal-300/10 px-2 py-1 text-[9px] font-black text-teal-200">Planificado</span>
        </div>

        <div className="mt-2.5 grid grid-cols-4 divide-x divide-white/[0.07] rounded-2xl border border-white/[0.08] bg-black/20 px-1 py-2">
          {metricCards.map((metric) => (
            <div key={metric.label} className="grid min-w-0 place-items-center px-1 text-center">
              <span className={`grid h-7 w-7 place-items-center rounded-full border border-current/20 bg-black/20 ${metric.tone}`}>{React.createElement(metric.icon, { size: 13 })}</span>
              <strong className={`mt-1 block max-w-full truncate text-[12px] font-black leading-tight ${metric.tone}`}>{metric.value}</strong>
              <span className="mt-0.5 block text-[8px] font-black uppercase tracking-[.06em] text-zinc-500">{metric.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] px-2 py-1.5 text-center">
          <span><small className="text-[9px] font-black uppercase tracking-wide text-zinc-500">Objetivo diario</small><b className="ml-1.5 text-[12px] font-black text-white">{formatKcal(dailyTarget?.kcal || target?.kcal || 0)}</b></span>
          <span className="border-l border-white/[0.08]"><small className="text-[9px] font-black uppercase tracking-wide text-zinc-500">Libres</small><b className="ml-1.5 text-[12px] font-black text-[#FFD75E]">{formatKcal(freeCalories)}</b></span>
        </div>
        {consumedKcal > 0 ? (
          <p className="mt-2 rounded-xl border border-teal-300/20 bg-teal-300/[0.05] px-3 py-2 text-[10px] font-bold leading-relaxed text-teal-100">
            Ya registraste {formatKcal(consumedKcal)}. {includedConsumedKcal > 0 ? `${formatKcal(includedConsumedKcal)} ya ${includedConsumedKcal === 1 ? "está incluida" : "están incluidas"} dentro de su comida` : "Ese consumo ya descuenta tu objetivo"}{externalConsumedKcal > 0 ? ` y ${formatKcal(externalConsumedKcal)} quedan contabilizadas fuera de estas metas` : ""}; nada se cuenta dos veces.
          </p>
        ) : null}
      </section>

      <div className="grid gap-2">
        {editingExistingTargets ? (
          <div className="mb-0.5 flex items-center justify-between gap-3 px-0.5">
            <div>
              <strong className="block text-[12px] font-black text-white">Metas de comidas</strong>
              <span className="mt-0.5 block text-[9px] font-bold text-zinc-500">Conservamos todo lo registrado hasta que confirmes un borrado.</span>
            </div>
            <button
              type="button"
              disabled={!availableMealTypes.length || meals.length >= 6}
              onClick={() => setShowMealPicker(true)}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-teal-300/35 bg-teal-300/[0.08] px-3 text-[10px] font-black text-teal-100 shadow-[0_0_20px_rgba(45,212,191,.07)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus size={15} strokeWidth={2.8} />
              Agregar
            </button>
          </div>
        ) : null}
        {meals.map((meal, index) => {
          const Icon = MEAL_ICONS[meal.type] || Utensils;
          const tone = mealTones[index % mealTones.length];
          const percent = totals.kcal > 0 ? Math.max(0, Math.min(100, Math.round((meal.target.kcal / totals.kcal) * 100))) : 0;
          const consumedTarget = minimumTargetsByMealId?.[meal.id] || {};
          const consumedMealKcal = Math.max(0, Number(consumedTarget.kcal) || 0);
          const consumedPercent = Number(meal.target.kcal) > 0
            ? Math.max(0, Math.min(100, Math.round((consumedMealKcal / Number(meal.target.kcal)) * 100)))
            : 0;
          const selected = editor?.id === meal.id;
          const confirmed = meal.confirmed === true;
          return (
            <article key={meal.id} className={`rounded-2xl border bg-[linear-gradient(100deg,rgba(15,23,32,.98),rgba(5,13,20,.98))] p-3 transition ${tone.border} ${tone.glow} ${selected ? "ring-1 ring-white/15" : ""}`}>
              <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-full border shadow-[0_0_22px_currentColor] ${tone.icon}`}>{React.createElement(Icon, { size: 20 })}</span>
                <div className="min-w-0">
                  <strong className="block truncate text-[15px] font-black text-white">{meal.name}</strong>
                  {consumedMealKcal > 0 ? <span className="mt-1 inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-0.5 text-[9px] font-black text-emerald-200">{formatKcal(consumedMealKcal)} ya registradas</span> : null}
                  <p className="mt-1 truncate text-[11px] font-bold text-zinc-300"><b className="text-teal-300">P</b> {meal.target.proteina} g <span className="text-zinc-700">·</span> <b className="text-violet-300">C</b> {meal.target.carbs} g <span className="text-zinc-700">·</span> <b className="text-orange-300">G</b> {meal.target.grasas} g</p>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2" title={`${percent}% del menú planificado`}><span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${percent}%` }} /></span><span className={`whitespace-nowrap text-[9px] font-black ${tone.text}`}>{percent}% del día</span></div>
                  {consumedMealKcal > 0 ? (
                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2" title={`${formatKcal(consumedMealKcal)} consumidas de ${formatKcal(meal.target.kcal)}`}>
                      <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_8px_rgba(52,211,153,.35)]" style={{ width: `${consumedPercent}%` }} /></span>
                      <span className="whitespace-nowrap text-[9px] font-black text-emerald-300">{consumedPercent}% consumido</span>
                    </div>
                  ) : null}
                </div>
                <div className="text-right"><strong className="block text-[17px] font-black text-[#FFD75E]">{formatKcal(meal.target.kcal)}</strong><div className="mt-1.5 flex items-center justify-end gap-1"><button type="button" onClick={() => toggleMealConfirmation(meal.id)} className={`grid h-9 w-9 place-items-center rounded-xl border transition ${confirmed ? "border-[#FFD75E]/45 bg-[#D4AF37]/15 text-[#FFD75E]" : "border-white/10 bg-white/[0.03] text-zinc-500"}`} aria-pressed={confirmed} aria-label={confirmed ? `Desbloquear meta de ${meal.name}` : `Confirmar meta de ${meal.name}`} title={confirmed ? "Meta confirmada: no se redistribuye" : "Meta abierta: puede redistribuirse"}>{confirmed ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" onClick={() => openEditor(meal)} disabled={confirmed} className={`inline-flex min-h-9 items-center gap-1 rounded-xl border px-2.5 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${tone.button}`}><PencilLine size={13} /> {confirmed ? "Fija" : "Editar"}</button>{editingExistingTargets ? <button type="button" onClick={() => requestMealRemoval(meal)} disabled={meals.length <= 1} className="grid h-9 w-9 place-items-center rounded-xl border border-rose-300/25 bg-rose-300/[0.06] text-rose-200 transition hover:border-rose-200/45 hover:bg-rose-300/[0.12] disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Eliminar ${meal.name}`} title={meals.length <= 1 ? "El día debe conservar al menos una meta" : `Eliminar ${meal.name}`}><Trash2 size={13} /></button> : null}</div></div>
              </div>
              {editingExistingTargets ? (
                <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span className="text-[8px] font-black uppercase tracking-[.12em] text-zinc-600">Orden del día</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveMeal(meal.id, -1)} disabled={index === 0} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.025] px-2 text-[8px] font-black text-zinc-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label={`Mover ${meal.name} hacia arriba`} title="Mover hacia arriba"><ArrowUp size={12} /> Subir</button>
                    <button type="button" onClick={() => moveMeal(meal.id, 1)} disabled={index === meals.length - 1} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.025] px-2 text-[8px] font-black text-zinc-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label={`Mover ${meal.name} hacia abajo`} title="Mover hacia abajo"><ArrowDown size={12} /> Bajar</button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {editor ? (
        <div className="fixed inset-0 z-[170] grid place-items-center bg-black/80 p-3 backdrop-blur-md sm:p-6" role="presentation">
          <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-[1.6rem] border border-teal-300/40 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.16),transparent_34%),linear-gradient(145deg,#0a1921,#070c12)] p-4 shadow-[0_30px_100px_rgba(0,0,0,.75),0_0_38px_rgba(45,212,191,.12)] ring-1 ring-white/[0.04] sm:max-h-[calc(100dvh-3rem)] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="target-meal-editor-title">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="grid h-11 w-11 place-items-center rounded-full border border-teal-300/40 bg-teal-300/10 text-teal-300 shadow-[0_0_24px_rgba(45,212,191,.14)]"><PencilLine size={17} /></span><div><span className="text-[8px] font-black uppercase tracking-[.15em] text-teal-300">Editar meta</span><h3 id="target-meal-editor-title" className="mt-0.5 text-[18px] font-black text-white">{editor.name}</h3></div></div><button type="button" onClick={() => setEditor(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white" aria-label="Cerrar editor de meta"><X size={16} /></button></div>

          {editor.minimumConsumed ? (
            <div className="mt-3 rounded-xl border border-sky-300/25 bg-sky-300/[0.06] px-3 py-2.5 text-[10px] font-bold leading-relaxed text-sky-100">
              Mínimo por consumo real: <b>{formatKcal(editor.minimumConsumed.kcal)}</b> · P {editor.minimumConsumed.proteina} g · C {editor.minimumConsumed.carbs} g · G {editor.minimumConsumed.grasas} g.
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="rounded-xl border border-[#FFD75E]/20 bg-[#D4AF37]/[0.04] p-2.5"><span className="block text-[9px] font-black text-zinc-400">Calorías (kcal)</span><span className="mt-1 grid grid-cols-[1fr_auto] items-center gap-1"><input type="number" min={editor.minimumConsumed?.kcal || 0} step="0.1" value={editor.kcal} onChange={(event) => updateEditor("kcal", event.target.value)} className="min-w-0 bg-transparent text-[17px] font-black text-[#FFE071] outline-none" /><Flame size={14} className="text-[#FFD75E]" /></span></label>
            {[["proteina", "Proteína", "P", "text-teal-300"], ["carbs", "Carbohidratos", "C", "text-violet-300"], ["grasas", "Grasas", "G", "text-orange-300"]].map(([key, label, shortLabel, color]) => {
              const locked = editorLocks[key] === true;
              return (
                <label key={key} className={`relative rounded-xl border p-2.5 pr-10 transition ${locked ? "border-[#FFD75E]/35 bg-[#D4AF37]/[0.06]" : "border-white/10 bg-black/25"}`}>
                  <span className="block text-[9px] font-black text-zinc-400">{label} (g)</span>
                  <span className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5"><b className={`text-[12px] font-black ${color}`}>{shortLabel}</b><input type="number" min={editor.minimumConsumed?.[key] || 0} step="0.1" value={editor[key]} onChange={(event) => updateEditor(key, event.target.value)} className="min-w-0 bg-transparent text-[17px] font-black text-white outline-none" /></span>
                  <button type="button" onClick={(event) => { event.preventDefault(); toggleEditorLock(key); }} className={`absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg border transition ${locked ? "border-[#FFD75E]/45 bg-[#D4AF37]/15 text-[#FFD75E]" : "border-white/10 bg-white/[0.03] text-zinc-500"}`} aria-pressed={locked} aria-label={locked ? `Desbloquear ${label}` : `Fijar ${label}`} title={locked ? "Fijo: no se ajustará automáticamente" : "Abierto: se ajusta al restante"}>{locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                </label>
              );
            })}
          </div>

          <div className={`mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 ${Math.abs(editorKcalDifference) <= 1 ? "border-teal-300/25 bg-teal-300/[0.06]" : "border-amber-300/25 bg-amber-300/[0.07]"}`}>
            <span className={`grid h-9 w-9 place-items-center rounded-full border ${Math.abs(editorKcalDifference) <= 1 ? "border-teal-300/30 text-teal-300" : "border-amber-300/30 text-amber-300"}`}><Gauge size={16} /></span>
            <span><strong className="block text-[11px] font-black text-white">Resultado nutricional</strong><span className="mt-0.5 block text-[9px] font-bold text-zinc-400">Esta es la energía real de los macros. Al guardar, la meta usará este valor.</span></span>
            <span className="text-right"><strong className={`block text-[16px] font-black ${Math.abs(editorKcalDifference) <= 1 ? "text-teal-300" : "text-amber-300"}`}>{editorMacroKcal} kcal</strong><small className="mt-0.5 block text-[9px] font-black text-zinc-400">{Math.abs(editorKcalDifference) <= 1 ? "Meta alineada" : `${editorKcalDifference > 0 ? "+" : ""}${editorKcalDifference} kcal`}</small></span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setEditMode("keep")} className={`grid min-h-[78px] grid-cols-[32px_minmax(0,1fr)] items-start gap-2.5 rounded-xl border p-3 text-left transition ${editMode === "keep" ? "border-teal-300/55 bg-teal-300/[0.08] shadow-[0_0_20px_rgba(45,212,191,.08)]" : "border-white/10 bg-black/20"}`}><span className={`grid h-8 w-8 place-items-center rounded-full border ${editMode === "keep" ? "border-teal-300/30 text-teal-300" : "border-white/10 text-zinc-500"}`}><Lock size={14} /></span><span><strong className="block text-[11px] font-black text-white">Mantener las demás metas</strong><span className="mt-1 block text-[9px] font-bold leading-relaxed text-zinc-400">Las otras comidas conservarán sus valores actuales.</span></span></button>
            <button type="button" onClick={() => setEditMode("redistribute")} className={`grid min-h-[78px] grid-cols-[32px_minmax(0,1fr)] items-start gap-2.5 rounded-xl border p-3 text-left transition ${editMode === "redistribute" ? "border-orange-300/45 bg-orange-300/[0.07] shadow-[0_0_20px_rgba(251,146,60,.08)]" : "border-white/10 bg-black/20"}`}><span className={`grid h-8 w-8 place-items-center rounded-full border ${editMode === "redistribute" ? "border-orange-300/30 text-orange-300" : "border-white/10 text-zinc-500"}`}><SlidersHorizontal size={14} /></span><span><strong className="block text-[11px] font-black text-white">Redistribuir en las comidas siguientes</strong><span className="mt-1 block text-[9px] font-bold leading-relaxed text-zinc-400">Ajusta sólo metas posteriores no confirmadas. Cada una conserva al menos 100 kcal.</span></span></button>
          </div>

          <button type="button" onClick={applyEdit} className="mt-3 min-h-12 w-full rounded-xl border border-teal-300/35 bg-teal-300/10 text-[12px] font-black text-teal-100">Aplicar esta meta</button>
          </section>
        </div>
      ) : editNotice ? <p className="rounded-xl border border-teal-300/25 bg-teal-300/[0.08] p-3 text-[10px] font-black leading-relaxed text-teal-100" role="status">{editNotice}</p> : null}

      {showMealPicker ? (
        <div className="fixed inset-0 z-[175] grid place-items-center bg-black/80 p-4 backdrop-blur-md" role="presentation">
          <section className="w-full max-w-[470px] rounded-[1.55rem] border border-teal-300/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.16),transparent_38%),linear-gradient(145deg,#0b1820,#070c12)] p-4 shadow-[0_30px_100px_rgba(0,0,0,.75)] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="add-target-meal-title">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-teal-300/35 bg-teal-300/10 text-teal-200"><Plus size={20} /></span><div><span className="text-[8px] font-black uppercase tracking-[.14em] text-teal-300">Nueva meta</span><h3 id="add-target-meal-title" className="mt-0.5 text-[18px] font-black text-white">Agregar comida</h3></div></div>
              <button type="button" onClick={() => setShowMealPicker(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300" aria-label="Cerrar"><X size={16} /></button>
            </div>
            <p className="mt-3 text-[11px] font-bold leading-relaxed text-zinc-400">Elegí un momento. Las metas abiertas se redistribuirán y las comidas con consumo conservarán sus mínimos reales.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {availableMealTypes.map((type) => {
                const Icon = MEAL_ICONS[type] || Utensils;
                return (
                  <button key={type} type="button" onClick={() => addMealType(type)} className="grid min-h-[82px] place-items-center rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center transition hover:border-teal-300/35 hover:bg-teal-300/[0.07] active:scale-[0.98]">
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-teal-300/25 bg-teal-300/[0.07] text-teal-200">{React.createElement(Icon, { size: 17 })}</span>
                    <strong className="mt-2 text-[10px] font-black text-white">{MEAL_LABELS[type] || type}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {mealPendingRemoval ? (
        <div className="fixed inset-0 z-[185] grid place-items-center bg-black/85 p-4 backdrop-blur-md" role="presentation">
          <section className="w-full max-w-[500px] overflow-hidden rounded-[1.6rem] border border-rose-300/35 bg-[radial-gradient(circle_at_50%_0,rgba(251,113,133,.16),transparent_42%),linear-gradient(180deg,#19171d,#090d13)] p-5 shadow-[0_30px_100px_rgba(0,0,0,.78)]" role="alertdialog" aria-modal="true" aria-labelledby="remove-target-meal-title">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-rose-300/40 bg-rose-300/10 text-rose-200 shadow-[0_0_30px_rgba(251,113,133,.16)]"><Trash2 size={25} /></div>
            <h3 id="remove-target-meal-title" className="mt-4 text-center text-[21px] font-black text-white">¿Eliminar {mealPendingRemoval.meal.name}?</h3>
            {mealPendingRemoval.records.length ? (
              <>
                <p className="mx-auto mt-2 max-w-[410px] text-center text-[12px] font-bold leading-relaxed text-rose-100">Esta comida tiene {mealPendingRemoval.records.length} registro{mealPendingRemoval.records.length === 1 ? "" : "s"}. Al guardar también se eliminarán:</p>
                <div className="mt-3 grid max-h-36 gap-1.5 overflow-y-auto rounded-2xl border border-rose-200/15 bg-black/25 p-2.5">
                  {mealPendingRemoval.records.map((record, index) => (
                    <div key={`${record.id || record.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[10px] font-bold text-zinc-200">
                      <span className="min-w-0 truncate">{record.name || `Registro ${index + 1}`}</span>
                      {record.detail ? <span className="shrink-0 text-zinc-500">{record.detail}</span> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mx-auto mt-2 max-w-[400px] text-center text-[12px] font-bold leading-relaxed text-zinc-300">La meta está vacía. Las demás comidas abiertas se redistribuirán al confirmar.</p>
            )}
            <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-center text-[10px] font-bold leading-relaxed text-amber-100">Nada se borra todavía. El cambio se ejecutará recién cuando pulses “Guardar metas del día”.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMealPendingRemoval(null)} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-[11px] font-black text-zinc-200">No, conservar</button>
              <button type="button" onClick={confirmMealRemoval} className="min-h-12 rounded-2xl border border-rose-300/45 bg-rose-300/[0.11] text-[11px] font-black text-rose-100">Sí, eliminar</button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-xl border border-cyan-300/25 bg-[linear-gradient(120deg,rgba(34,211,238,.09),rgba(45,212,191,.05))] p-3 text-[11px] font-bold leading-relaxed text-zinc-300"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-300/30 text-cyan-300"><Info size={15} /></span><span>Agregar una comida conserva los registros existentes. El candado fija una meta fuera de futuras redistribuciones. La papelera sólo elimina alimentos si lo confirmás expresamente y después guardás el día.</span></div>

      {showBlockingWarning ? (
        <div className="fixed inset-0 z-[190] grid place-items-center bg-black/80 p-4 backdrop-blur-md" role="presentation">
          <section className="w-full max-w-[500px] overflow-hidden rounded-[1.6rem] border border-rose-300/35 bg-[radial-gradient(circle_at_50%_0,rgba(251,113,133,.18),transparent_42%),linear-gradient(180deg,#18202a,#090d13)] p-5 shadow-[0_30px_100px_rgba(0,0,0,.75)] sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="target-warning-title" aria-describedby="target-warning-message">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-rose-300/40 bg-rose-300/10 text-rose-200 shadow-[0_0_34px_rgba(251,113,133,.18)]"><TriangleAlert size={30} strokeWidth={2.2} /></div>
            <h3 id="target-warning-title" className="mt-4 text-center text-[21px] font-black text-white sm:text-[24px]">No se puede aplicar esta meta</h3>
            <p id="target-warning-message" className="mx-auto mt-3 max-w-[420px] text-center text-[14px] font-bold leading-[1.65] text-zinc-200 sm:text-[16px]">{blockingWarning}</p>
            <div className="mt-5 rounded-2xl border border-[#FFD75E]/20 bg-[#D4AF37]/[0.06] p-3 text-center text-[12px] font-bold leading-relaxed text-[#FFE8A3]">Revisá los candados, reducí los macros o liberá capacidad en una comida posterior.</div>
            <button type="button" autoFocus onClick={() => { setDismissedWarning(blockingWarning); if (error) setError(""); }} className="mt-5 min-h-[52px] w-full rounded-2xl border border-[#FFD75E]/70 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-4 text-[14px] font-black text-black shadow-[0_12px_30px_rgba(212,175,55,.18)]">Entendido</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TargetReviewStep({ draft, target, consumedBaseline = {}, onEditStep }) {
  const meals = Array.isArray(draft.targetMeals) ? draft.targetMeals : [];
  const totals = personalMealTargetTotals(meals);
  const dailyKcal = Number(target?.kcal) || 0;
  const consumedKcal = Math.max(0, Number(consumedBaseline?.kcal) || 0);
  const consumptionIncluded = draft.targetIncludesTrackedConsumption === true;
  const includedConsumedKcal = consumptionIncluded
    ? Math.max(0, Number(draft.targetIncludedTrackedConsumption?.kcal) || 0)
    : 0;
  const externalConsumedKcal = Math.max(0, consumedKcal - includedConsumedKcal);
  const remaining = Math.max(0, Math.round((dailyKcal - totals.kcal - externalConsumedKcal) * 10) / 10);
  const tones = [
    { icon: "border-teal-300/40 bg-teal-300/10 text-teal-200 shadow-[0_0_24px_rgba(45,212,191,.16)]", value: "text-teal-300", line: "bg-teal-300" },
    { icon: "border-amber-300/40 bg-amber-300/10 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,.15)]", value: "text-[#FFD75E]", line: "bg-[#FFD75E]" },
    { icon: "border-violet-300/40 bg-violet-300/10 text-violet-200 shadow-[0_0_24px_rgba(167,139,250,.15)]", value: "text-violet-300", line: "bg-violet-300" },
    { icon: "border-sky-300/40 bg-sky-300/10 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,.15)]", value: "text-sky-300", line: "bg-sky-300" },
  ];
  const totalMetrics = [
    { label: "Menú", value: formatKcal(totals.kcal), icon: Utensils, tone: "text-teal-300" },
    { label: "P", value: `${totals.proteina} g`, icon: Dumbbell, tone: "text-teal-300" },
    { label: "C", value: `${totals.carbs} g`, icon: Apple, tone: "text-amber-300" },
    { label: "G", value: `${totals.grasas} g`, icon: Gauge, tone: "text-violet-300" },
  ];
  return (
    <div className="grid gap-4 pb-1">
      <section className="overflow-hidden rounded-[1.7rem] border border-teal-300/40 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.17),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(14,165,233,.08),transparent_38%),linear-gradient(155deg,#0c1720,#070b11)] p-4 shadow-[0_0_34px_rgba(45,212,191,.12),0_24px_60px_rgba(0,0,0,.46)] sm:p-5">
        <div className="flex items-start gap-3 border-b border-white/[0.07] pb-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-teal-300/50 bg-teal-300/10 text-teal-200 shadow-[0_0_28px_rgba(45,212,191,.18)]"><Target size={28} /></span>
          <div className="min-w-0"><h3 className="text-[21px] font-black leading-tight text-white sm:text-[24px]">Resumen de tus metas</h3><p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-zinc-400 sm:text-[12px]">{consumptionIncluded ? "Se conservará lo que ya registraste y se crearán las metas para completar el día." : "Se crearán slots vacíos. Ninguna comida se marcará como consumida."}</p></div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-teal-300/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.14),transparent_60%),rgba(3,20,25,.72)] p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-teal-300/35 text-teal-300"><Scale size={19} /></span><span><small className="block text-[10px] font-bold text-zinc-400">Objetivo diario</small><strong className="mt-1 block text-[19px] font-black text-teal-300 sm:text-[21px]">{formatKcal(dailyKcal)}</strong></span></div>
          <div className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-[#FFD75E]/30 bg-[radial-gradient(circle_at_0_0,rgba(212,175,55,.14),transparent_60%),rgba(24,20,7,.68)] p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#FFD75E]/35 text-[#FFD75E]"><Lock size={18} /></span><span><small className="block text-[10px] font-bold text-zinc-400">Sin asignar / libres</small><strong className="mt-1 block text-[19px] font-black text-[#FFD75E] sm:text-[21px]">{formatKcal(remaining)}</strong></span></div>
        </div>

        {consumedKcal > 0 ? (
          <p className="mt-3 rounded-xl border border-teal-300/20 bg-teal-300/[0.05] px-3 py-2 text-[10px] font-bold text-teal-100">
            Ya registrado: {formatKcal(consumedKcal)}. {consumptionIncluded ? `${formatKcal(includedConsumedKcal)} están incluidas en su comida${externalConsumedKcal > 0 ? ` y ${formatKcal(externalConsumedKcal)} ya cuentan fuera de estas metas` : ""}; nada se duplica.` : "No se vuelve a asignar dentro de estas metas."}
          </p>
        ) : null}

        <div className="mt-4 grid gap-2.5">
          {meals.map((meal, index) => {
            const tone = tones[index % tones.length];
            const Icon = MEAL_ICONS[meal.type] || Utensils;
            return (
              <button key={meal.id} type="button" onClick={() => onEditStep?.(3)} className="grid min-h-[72px] grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[0.09] bg-[linear-gradient(100deg,rgba(17,28,38,.94),rgba(7,13,20,.94))] p-3 text-left shadow-[0_10px_24px_rgba(0,0,0,.18)] transition hover:border-white/20">
                <span className={`grid h-11 w-11 place-items-center rounded-xl border ${tone.icon}`}>{React.createElement(Icon, { size: 20 })}</span>
                <span className="min-w-0"><strong className="flex items-center gap-1.5 truncate text-[15px] font-black text-white">{meal.name}{meal.confirmed ? <Lock size={12} className="shrink-0 text-[#FFD75E]" aria-label="Meta confirmada" /> : null}</strong><small className="mt-1 block truncate text-[10px] font-bold text-zinc-400">P {meal.target.proteina} · C {meal.target.carbs} · G {meal.target.grasas}</small></span>
                <span className="flex items-center gap-3"><span className="text-right"><strong className={`block text-[19px] font-black ${tone.value}`}>{formatNutritionNumber(meal.target.kcal, 0)}</strong><small className="block text-[10px] font-bold text-zinc-500">kcal</small></span><span className={`h-11 w-0.5 rounded-full ${tone.line}`} /></span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-teal-300/25 bg-[linear-gradient(120deg,rgba(45,212,191,.08),rgba(8,13,20,.88))] p-3">
          {totalMetrics.map((metric, index) => (
            <div key={metric.label} className={`grid place-items-center px-1 text-center ${index ? "border-l border-white/[0.08]" : ""}`}><span className={`grid h-8 w-8 place-items-center rounded-full border border-current/20 bg-black/20 ${metric.tone}`}>{React.createElement(metric.icon, { size: 15 })}</span><small className="mt-1.5 text-[9px] font-bold text-zinc-500">{metric.label}</small><b className="mt-0.5 text-[11px] font-black text-white sm:text-[12px]">{metric.value}</b></div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StepThree({ draft, setDraft }) {
  const mealTypes = Array.isArray(draft.mealTypes)
    ? draft.mealTypes
    : mealTypesForCount(draft.mealCount);

  const includeFoods = Array.isArray(draft.includeFoods)
    ? draft.includeFoods
    : [];

  const excludeFoods = Array.isArray(draft.excludeFoods)
    ? draft.excludeFoods
    : [];

  const [openMeal, setOpenMeal] = useState(
    mealTypes[0] || ""
  );

  useEffect(() => {
    if (
      mealTypes.length &&
      !mealTypes.includes(openMeal)
    ) {
      setOpenMeal(mealTypes[0]);
    }
  }, [mealTypes, openMeal]);

  const totalPreferences =
    includeFoods.length + excludeFoods.length;

  const totalIncluded = includeFoods.length;

  const globalIncludeFoods =
    includeFoods.filter(preferenceIsGlobal);

  const globalExcludeFoods =
    excludeFoods.filter(preferenceIsGlobal);

  const addPreference = (
    kind,
    mealType,
    food
  ) => {
    setDraft((current) => {
      const currentIncludes = Array.isArray(
        current.includeFoods
      )
        ? current.includeFoods
        : [];

      const currentExcludes = Array.isArray(
        current.excludeFoods
      )
        ? current.excludeFoods
        : [];

      const identity = foodKey(food);

      /*
       * Sólo quitamos el alimento opuesto
       * de ESTA misma comida.
       *
       * Ejemplo:
       * Pan puede estar incluido en desayuno
       * y evitado en cena.
       */
      const cleanMealOccurrence = (list) =>
        list.filter(
          (item) =>
            !(
              foodKey(item) === identity &&
              preferenceMealTarget(item) ===
                mealType
            )
        );

      let nextIncludes =
        cleanMealOccurrence(currentIncludes);

      let nextExcludes =
        cleanMealOccurrence(currentExcludes);

      if (kind === "include") {
        nextIncludes = [
          ...nextIncludes,
          {
            ...food,

            /*
             * No mostramos más el checkbox
             * "Debe aparecer".
             *
             * Pero internamente lo mantenemos
             * para no romper el motor actual.
             */
            mustAppear: true,
            targetMealType: mealType,
          },
        ];
      } else {
        nextExcludes = [
          ...nextExcludes,
          {
            ...food,
            targetMealType: mealType,
          },
        ];
      }

      return {
        ...current,
        includeFoods: nextIncludes,
        excludeFoods: nextExcludes,
      };
    });
  };

  const removePreference = (
    kind,
    mealType,
    food
  ) => {
    setDraft((current) => {
      const key = foodKey(food);

      const field =
        kind === "include"
          ? "includeFoods"
          : "excludeFoods";

      const currentValues = Array.isArray(
        current[field]
      )
        ? current[field]
        : [];

      return {
        ...current,

        [field]: currentValues.filter(
          (item) =>
            !(
              foodKey(item) === key &&
              preferenceMealTarget(item) ===
                mealType
            )
        ),
      };
    });
  };

  const removeGlobalPreference = (
    kind,
    food
  ) => {
    setDraft((current) => {
      const field =
        kind === "include"
          ? "includeFoods"
          : "excludeFoods";

      const key = foodKey(food);

      return {
        ...current,

        [field]: (
          Array.isArray(current[field])
            ? current[field]
            : []
        ).filter(
          (item) =>
            !(
              foodKey(item) === key &&
              preferenceIsGlobal(item)
            )
        ),
      };
    });
  };

  const resetFoodPreferences = () => {
    setDraft((current) => ({
      ...current,
      includeFoods: [],
      excludeFoods: [],

      /*
       * Sin alimentos elegidos,
       * el comportamiento lógico es
       * permitir que ZumaFit los elija.
       */
      foodPoolMode: "combine",
    }));
  };

  const mealsWithoutIncludedFoods =
    mealTypes.filter(
      (mealType) =>
        !includeFoods.some((food) => {
          const target =
            preferenceMealTarget(food);

          return (
            target === "any" ||
            target === mealType
          );
        })
    );

  const onlyModeIncomplete =
    draft.foodPoolMode === "only" &&
    mealsWithoutIncludedFoods.length > 0;

  return (
    <div className="grid gap-3">
      <section className="rounded-[1.35rem] border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.09),transparent_30%),linear-gradient(145deg,#0e1720,#080d13)] p-4 shadow-[0_14px_34px_rgba(0,0,0,.30)]">

        {/* HEADER */}

        <div className="flex items-start justify-between gap-3">
          <SectionTitle
            icon={Utensils}
            title="Preferencias de alimentos"
            text="Elegí qué querés incluir o evitar en cada comida."
          />

          <button
            type="button"
            onClick={resetFoodPreferences}
            disabled={!totalPreferences}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-2.5 text-[9px] font-black text-rose-200 disabled:cursor-default disabled:opacity-30"
          >
            <RefreshCw size={13} />
            Resetear
          </button>
        </div>

        {/* CÓMO USAR LOS ALIMENTOS */}

        <div className="mt-5">
          <strong className="text-[12px] font-black text-zinc-200">
            Cómo usaré tus preferencias
          </strong>

          <p className="mt-1 text-[9px] font-bold leading-relaxed text-zinc-500">
            Elegí si ZumaFit puede completar las
            comidas con otros alimentos o si debe
            usar solamente los que indiques.
          </p>

          <div
            className="mt-3 grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Uso de alimentos"
          >
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  foodPoolMode: "combine",
                }))
              }
              className={`relative min-h-[78px] rounded-2xl border p-3 text-left transition ${
                draft.foodPoolMode !== "only"
                  ? "border-teal-300/55 bg-teal-300/[0.09] shadow-[0_0_18px_rgba(45,212,191,.08)]"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <strong className="block pr-6 text-[11px] font-black text-white">
                Combinar con otros
              </strong>

              <span className="mt-1 block text-[9px] font-bold leading-snug text-zinc-500">
                Más variedad y flexibilidad.
              </span>

              <CheckCircle2
                size={17}
                className={`absolute right-3 top-3 ${
                  draft.foodPoolMode !== "only"
                    ? "text-teal-300"
                    : "text-zinc-700"
                }`}
              />
            </button>

            <button
              type="button"
              disabled={!totalIncluded}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  foodPoolMode: "only",
                }))
              }
              className={`relative min-h-[78px] rounded-2xl border p-3 text-left transition disabled:opacity-35 ${
                draft.foodPoolMode === "only"
                  ? "border-[#FFD75E]/65 bg-[#D4AF37]/10"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <strong className="block pr-6 text-[11px] font-black text-white">
                Sólo los elegidos
              </strong>

              <span className="mt-1 block text-[9px] font-bold leading-snug text-zinc-500">
                Menú más estricto.
              </span>

              <CheckCircle2
                size={17}
                className={`absolute right-3 top-3 ${
                  draft.foodPoolMode === "only"
                    ? "text-[#FFD75E]"
                    : "text-zinc-700"
                }`}
              />
            </button>
          </div>
        </div>

        {/* SI NO HAY NADA ELEGIDO */}

        {!totalPreferences ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-teal-300/25 bg-teal-300/[0.07] p-3">
            <Sparkles
              size={16}
              className="mt-0.5 shrink-0 text-teal-300"
            />

            <div>
              <strong className="text-[10px] font-black text-teal-100">
                Sin preferencias
              </strong>

              <p className="mt-1 text-[9px] font-bold leading-relaxed text-zinc-400">
                No pasa nada. ZumaFit elegirá
                automáticamente alimentos del pool
                GENERIC compatible con cada comida.
              </p>
            </div>
          </div>
        ) : null}

        {/* PREFERENCIAS ANTIGUAS "ANY" */}

        {globalIncludeFoods.length ||
        globalExcludeFoods.length ? (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.05] p-3">
            <strong className="text-[10px] font-black text-amber-200">
              Preferencias generales
            </strong>

            <p className="mt-1 text-[8px] font-bold leading-relaxed text-zinc-500">
              Son alimentos guardados anteriormente
              como “Cualquier comida”. Siguen
              funcionando de forma general.
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {globalIncludeFoods.map((food) => (
                <span
                  key={`global-i-${foodKey(food)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-teal-300/25 bg-teal-300/[0.07] px-2 py-1 text-[9px] font-black text-teal-100"
                >
                  + {foodName(food)}

                  <button
                    type="button"
                    onClick={() =>
                      removeGlobalPreference(
                        "include",
                        food
                      )
                    }
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}

              {globalExcludeFoods.map((food) => (
                <span
                  key={`global-e-${foodKey(food)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-400/[0.07] px-2 py-1 text-[9px] font-black text-rose-100"
                >
                  − {foodName(food)}

                  <button
                    type="button"
                    onClick={() =>
                      removeGlobalPreference(
                        "exclude",
                        food
                      )
                    }
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* POR COMIDA */}

        <div className="mt-5">
          <strong className="text-[12px] font-black text-zinc-200">
            Preferencias por comida
          </strong>

          <p className="mt-1 text-[9px] font-bold text-zinc-500">
            Abrí una comida y agregá los alimentos
            que querés incluir o evitar.
          </p>

          <div className="mt-3 grid gap-2">
            {mealTypes.map((mealType) => {
              const mealIncludes =
                includeFoods.filter((food) =>
                  preferenceBelongsToMeal(
                    food,
                    mealType
                  )
                );

              const mealExcludes =
                excludeFoods.filter((food) =>
                  preferenceBelongsToMeal(
                    food,
                    mealType
                  )
                );

              return (
                <MealPreferenceCard
                  key={mealType}
                  mealType={mealType}
                  open={openMeal === mealType}
                  onToggle={() =>
                    setOpenMeal((current) =>
                      current === mealType
                        ? ""
                        : mealType
                    )
                  }
                  includedFoods={mealIncludes}
                  excludedFoods={mealExcludes}
                  onInclude={(food) =>
                    addPreference(
                      "include",
                      mealType,
                      food
                    )
                  }
                  onExclude={(food) =>
                    addPreference(
                      "exclude",
                      mealType,
                      food
                    )
                  }
                  onRemoveInclude={(food) =>
                    removePreference(
                      "include",
                      mealType,
                      food
                    )
                  }
                  onRemoveExclude={(food) =>
                    removePreference(
                      "exclude",
                      mealType,
                      food
                    )
                  }
                />
              );
            })}
          </div>
        </div>

        {/* WARNING ONLY */}

        {onlyModeIncomplete ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3">
            <Info
              size={15}
              className="mt-0.5 shrink-0 text-amber-300"
            />

            <p className="text-[9px] font-bold leading-relaxed text-amber-100">
              Elegiste “Sólo los elegidos”, pero
              todavía hay comidas sin alimentos
              incluidos:{" "}
              {mealsWithoutIncludedFoods
                .map(
                  (type) =>
                    MEAL_LABELS[type] || type
                )
                .join(", ")}
              .
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-teal-300/20 bg-teal-300/[0.07] p-3">
        <Info
          size={15}
          className="mt-0.5 shrink-0 text-teal-300"
        />

        <p className="text-[9px] font-bold leading-relaxed text-teal-100">
          Los alimentos que agregues en “Incluir”
          se consideran obligatorios para esa comida.
          No necesitás marcar “Debe aparecer”.
        </p>
      </div>
    </div>
  );
}



function StepFour({
  draft,
  setDraft,
  target,
  hasMenu,
  purpose,
  onEditStep,
}) {
  const meals = Array.isArray(draft.mealTypes)
    ? draft.mealTypes
    : mealTypesForCount(draft.mealCount);

  const includeFoods = Array.isArray(draft.includeFoods)
    ? draft.includeFoods
    : [];

  const excludeFoods = Array.isArray(draft.excludeFoods)
    ? draft.excludeFoods
    : [];

  const freeCalories = Math.max(
    0,
    Number(draft.freeCalories || 0)
  );

  const dailyCalories = Math.max(
    0,
    Number(target?.kcal || 0)
  );

  const automaticMenuCalories = Math.max(
    0,
    dailyCalories - freeCalories
  );

  const distributionMode =
    draft.calorieDistributionMode || "balanced";

  const distributionLabels = {
    balanced: "Equilibrada",
    more_breakfast: "Más en desayuno",
    more_lunch: "Más en almuerzo",
    more_dinner: "Más en cena",
    custom: "Personalizada",
  };

  const distributionLabel =
    distributionLabels[distributionMode] ||
    "Equilibrada";

  const percentages =
    draft.calorieDistributionPercents &&
    typeof draft.calorieDistributionPercents === "object"
      ? draft.calorieDistributionPercents
      : {};

  const globalIncluded = includeFoods.filter(
    (food) =>
      !food?.targetMealType ||
      food.targetMealType === "any"
  );

  const globalExcluded = excludeFoods.filter(
    (food) =>
      !food?.targetMealType ||
      food.targetMealType === "any"
  );

  const preferencesByMeal = meals.map((mealType) => {
    const included = includeFoods.filter(
      (food) => food?.targetMealType === mealType
    );

    const excluded = excludeFoods.filter(
      (food) => food?.targetMealType === mealType
    );

    return {
      mealType,
      included,
      excluded,
    };
  });

  const totalPreferences =
    includeFoods.length + excludeFoods.length;

  const foodPoolLabel =
    draft.foodPoolMode === "only"
      ? "Sólo alimentos elegidos"
      : "Combinar con otros alimentos";

  return (
    <div className="grid gap-4">

      {/* ================================================= */}
      {/* RESUMEN PRINCIPAL */}
      {/* ================================================= */}

      <section className="overflow-hidden rounded-[1.4rem] border border-[#D4AF37]/35 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.09),transparent_30%),linear-gradient(145deg,#0e1720,#080d13)] shadow-[0_18px_45px_rgba(0,0,0,.32)]">

        {/* HEADER */}

        <div className="flex items-start gap-3 border-b border-white/[0.07] p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-teal-300/30 bg-teal-300/10 text-teal-300">
            <ClipboardCheck size={23} />
          </span>

          <div className="min-w-0">
            <h3 className="text-[18px] font-black leading-tight text-white">
              Resumen de tu configuración
            </h3>

            <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-zinc-400">
              {purpose === "generate"
                ? "Todo listo. Revisá los últimos detalles antes de generar tu menú."
                : "Revisá cómo quedarán guardados tus ajustes automáticos."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4">

          {/* ================================================= */}
          {/* TIPO / ORIGEN */}
          {/* ================================================= */}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <strong className="text-[12px] font-black uppercase tracking-[0.06em] text-zinc-400">
                Modo de generación
              </strong>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ORIGIN_OPTIONS.map((option) => {
                const selected =
                  draft.mode === option.id;

                const Icon = option.icon;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        mode: option.id,
                      }))
                    }
                    className={`relative grid min-h-[102px] content-center justify-items-center gap-2 rounded-2xl border px-2 py-3 text-center transition ${
                      selected
                        ? "border-[#FFD75E]/75 bg-[#D4AF37]/10 shadow-[0_0_22px_rgba(212,175,55,.11)]"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full border ${
                        selected
                          ? "border-[#FFD75E]/45 bg-[#D4AF37]/15 text-[#FFD75E]"
                          : "border-teal-300/20 bg-teal-300/[0.07] text-teal-300"
                      }`}
                    >
                      <Icon size={19} />
                    </span>

                    <strong className="text-[11px] font-black leading-tight text-white">
                      {option.title}
                    </strong>

                    <span className="text-[9px] font-bold leading-tight text-zinc-500">
                      {option.text}
                    </span>

                    {selected ? (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#FFD75E] text-black">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================================================= */}
          {/* COMIDAS */}
          {/* ================================================= */}

          <button
            type="button"
            onClick={() => onEditStep?.(2)}
            className="rounded-2xl border border-white/[0.09] bg-black/20 p-3.5 text-left transition hover:border-teal-300/25"
          >
            <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-teal-300/20 bg-teal-300/[0.08] text-teal-300">
                <Utensils size={18} />
              </span>

              <span className="min-w-0">
                <strong className="block text-[14px] font-black text-white">
                  Tipos de comidas
                </strong>

                <span className="mt-1 block text-[10px] font-bold text-zinc-500">
                  {meals.length} comidas seleccionadas
                </span>
              </span>

              <ArrowRight
                size={17}
                className="text-teal-300"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {meals.map((mealType) => {
                const Icon =
                  typeof MEAL_ICONS !== "undefined"
                    ? MEAL_ICONS[mealType] || Utensils
                    : Utensils;

                return (
                  <span
                    key={mealType}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/[0.07] px-3 text-[10px] font-black text-teal-100"
                  >
                    <Icon
                      size={14}
                      className="text-teal-300"
                    />

                    {MEAL_LABELS[mealType] || mealType}
                  </span>
                );
              })}
            </div>
          </button>

          {/* ================================================= */}
          {/* DISTRIBUCIÓN */}
          {/* ================================================= */}

          <button
            type="button"
            onClick={() => onEditStep?.(2)}
            className="rounded-2xl border border-white/[0.09] bg-black/20 p-3.5 text-left transition hover:border-teal-300/25"
          >
            <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-teal-300/20 bg-teal-300/[0.08] text-teal-300">
                <SlidersHorizontal size={18} />
              </span>

              <span>
                <strong className="block text-[14px] font-black text-white">
                  Distribución de calorías
                </strong>

                <span className="mt-1 block text-[10px] font-bold text-zinc-500">
                  Cómo se reparte el objetivo entre tus comidas
                </span>
              </span>

              <span className="flex items-center gap-1 text-[11px] font-black text-teal-300">
                {distributionLabel}
                <ArrowRight size={15} />
              </span>
            </div>

            {distributionMode === "custom" ? (
              <div
                className={`mt-4 grid gap-2 ${
                  meals.length <= 4
                    ? "grid-cols-2 sm:grid-cols-4"
                    : "grid-cols-2 sm:grid-cols-3"
                }`}
              >
                {meals.map((mealType) => {
                  const Icon =
                    typeof MEAL_ICONS !== "undefined"
                      ? MEAL_ICONS[mealType] ||
                        Utensils
                      : Utensils;

                  const value = Number(
                    percentages[mealType] || 0
                  );

                  return (
                    <div
                      key={mealType}
                      className="rounded-xl border border-white/[0.07] bg-black/25 px-2 py-2.5 text-center"
                    >
                      <Icon
                        size={15}
                        className="mx-auto text-teal-300"
                      />

                      <span className="mt-1.5 block truncate text-[9px] font-black text-zinc-300">
                        {MEAL_LABELS[mealType] ||
                          mealType}
                      </span>

                      <strong className="mt-1 block text-[15px] font-black text-teal-300">
                        {value}%
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-teal-300/15 bg-teal-300/[0.04] px-3 py-2.5">
                <span className="text-[10px] font-bold leading-relaxed text-zinc-400">
                  ZumaFit distribuirá las calorías usando
                  la preferencia{" "}
                  <strong className="text-teal-200">
                    {distributionLabel.toLowerCase()}
                  </strong>
                  .
                </span>
              </div>
            )}
          </button>

          {/* ================================================= */}
          {/* PREFERENCIAS DE ALIMENTOS */}
          {/* ================================================= */}

          <button
            type="button"
            onClick={() => onEditStep?.(3)}
            className="rounded-2xl border border-[#FFD75E]/35 bg-[linear-gradient(135deg,rgba(212,175,55,.08),rgba(0,0,0,.16))] p-3.5 text-left transition hover:border-[#FFD75E]/55"
          >
            <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[#FFD75E]/30 bg-[#D4AF37]/10 text-[#FFD75E]">
                <Layers3 size={18} />
              </span>

              <span>
                <strong className="block text-[14px] font-black text-white">
                  Preferencias de alimentos
                </strong>

                <span className="mt-1 block text-[10px] font-bold text-zinc-500">
                  Incluir y evitar alimentos por comida
                </span>
              </span>

              <span className="flex items-center gap-1 rounded-full border border-[#FFD75E]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-black text-[#FFD75E]">
                {totalPreferences} total
                <ArrowRight size={14} />
              </span>
            </div>

            {totalPreferences ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {preferencesByMeal.map(
                  ({
                    mealType,
                    included,
                    excluded,
                  }) => {
                    const Icon =
                      typeof MEAL_ICONS !== "undefined"
                        ? MEAL_ICONS[mealType] ||
                          Utensils
                        : Utensils;

                    return (
                      <div
                        key={mealType}
                        className="rounded-xl border border-white/[0.07] bg-black/20 p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            size={14}
                            className="text-teal-300"
                          />

                          <strong className="truncate text-[10px] font-black text-zinc-200">
                            {MEAL_LABELS[mealType] ||
                              mealType}
                          </strong>
                        </div>

                        <div className="mt-2 grid gap-1">
                          <span className="text-[10px] font-black text-teal-300">
                            + {included.length}{" "}
                            {included.length === 1
                              ? "incluido"
                              : "incluidos"}
                          </span>

                          <span className="text-[10px] font-black text-rose-300">
                            − {excluded.length}{" "}
                            {excluded.length === 1
                              ? "evitado"
                              : "evitados"}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-teal-300/20 bg-teal-300/[0.06] px-3 py-2.5">
                <Sparkles
                  size={15}
                  className="mt-0.5 shrink-0 text-teal-300"
                />

                <p className="text-[10px] font-bold leading-relaxed text-zinc-300">
                  Sin alimentos específicos. ZumaFit
                  tendrá libertad para elegir opciones
                  automáticas compatibles.
                </p>
              </div>
            )}

            {globalIncluded.length ||
            globalExcluded.length ? (
              <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2">
                <span className="text-[9px] font-bold text-amber-200">
                  Además tenés{" "}
                  {globalIncluded.length +
                    globalExcluded.length}{" "}
                  preferencias generales para cualquier
                  comida.
                </span>
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
              <span className="text-[10px] font-bold text-zinc-500">
                Forma de completar
              </span>

              <strong className="text-[10px] font-black text-teal-300">
                {foodPoolLabel}
              </strong>
            </div>
          </button>

          {/* ================================================= */}
          {/* CALORÍAS LIBRES */}
          {/* ================================================= */}

          <button
            type="button"
            onClick={() => onEditStep?.(2)}
            className={`relative overflow-hidden rounded-2xl border p-3.5 text-left transition ${
              freeCalories > 0
                ? "border-[#FFD75E]/55 bg-[radial-gradient(circle_at_100%_0%,rgba(255,215,94,.12),transparent_35%),rgba(212,175,55,.07)]"
                : "border-white/[0.09] bg-black/20"
            }`}
          >
            <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
              <span
                className={`grid h-10 w-10 place-items-center rounded-full border ${
                  freeCalories > 0
                    ? "border-[#FFD75E]/35 bg-[#D4AF37]/15 text-[#FFD75E]"
                    : "border-teal-300/20 bg-teal-300/[0.08] text-teal-300"
                }`}
              >
                <Sparkles size={18} />
              </span>

              <span>
                <strong
                  className={`block text-[14px] font-black ${
                    freeCalories > 0
                      ? "text-[#FFD75E]"
                      : "text-white"
                  }`}
                >
                  Calorías libres
                </strong>

                <span className="mt-1 block text-[10px] font-bold text-zinc-500">
                  Margen que no se asignará al menú automático
                </span>
              </span>

              <span
                className={`flex items-center gap-1 text-[14px] font-black ${
                  freeCalories > 0
                    ? "text-[#FFD75E]"
                    : "text-teal-300"
                }`}
              >
                {freeCalories > 0
                  ? formatKcal(freeCalories)
                  : "Ninguna"}

                <ArrowRight size={15} />
              </span>
            </div>

            {dailyCalories > 0 ? (
              <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl border border-white/[0.07] bg-black/20 py-3">
                <div className="px-2 text-center">
                  <span className="block text-[9px] font-bold text-zinc-500">
                    Objetivo diario
                  </span>

                  <strong className="mt-1 block text-[13px] font-black text-white">
                    {formatKcal(dailyCalories)}
                  </strong>
                </div>

                <div className="px-2 text-center">
                  <span className="block text-[9px] font-bold text-zinc-500">
                    Menú
                  </span>

                  <strong className="mt-1 block text-[13px] font-black text-teal-300">
                    {formatKcal(
                      automaticMenuCalories
                    )}
                  </strong>
                </div>

                <div className="px-2 text-center">
                  <span className="block text-[9px] font-bold text-zinc-500">
                    Libres
                  </span>

                  <strong
                    className={`mt-1 block text-[13px] font-black ${
                      freeCalories > 0
                        ? "text-[#FFD75E]"
                        : "text-zinc-400"
                    }`}
                  >
                    {formatKcal(freeCalories)}
                  </strong>
                </div>
              </div>
            ) : null}
          </button>

        </div>
      </section>

      {/* ================================================= */}
      {/* ESTADO FINAL */}
      {/* ================================================= */}

      <div className="flex items-start gap-3 rounded-2xl border border-teal-300/25 bg-teal-300/[0.07] p-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-teal-300/30 text-teal-300">
          <Info size={16} />
        </span>

        <div>
          <strong className="text-[11px] font-black text-teal-100">
            Todo listo
          </strong>

          <p className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-300">
            {hasMenu
              ? "Estos ajustes se podrán usar para regenerar el menú del día cuando quieras."
              : purpose === "generate"
                ? "ZumaFit usará esta configuración para crear una propuesta nueva."
                : "Guardaremos esta configuración para tus próximas generaciones automáticas."}
          </p>
        </div>
      </div>
    </div>
  );
}




export default function MenuGenerationSettingsWizard({
  open = false,
  settings = DEFAULT_MENU_GENERATION_SETTINGS,
  target = {},
  trackingBreakdown = {},
  hasMenu = false,
  purpose = "settings",
  onClose,
  onSave,
  onGenerate,
  onCreateTargets,
  creatingTargets = false,
  onRestore,
  targetEditContext = null,
  targetGenerationContext = null,
  onUpdateTargets,
  externalError = "",
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(settings);
  const [targetSessionSeed, setTargetSessionSeed] = useState("");
  const activeTargetContext = purpose === "edit_targets"
    ? targetEditContext
    : targetGenerationContext;

  useEffect(() => {
    if (!open) return;
    const incoming = settings || DEFAULT_MENU_GENERATION_SETTINGS;
    const normalizedIncoming = incoming.generationProfile === "recommended"
      ? { ...incoming, generationProfile: "custom" }
      : incoming;
    const flow = menuGenerationWizardFlow(normalizedIncoming, purpose);
    if (normalizedIncoming.generationProfile === "target" && purpose === "generate") {
      const sessionSeed = `target-preview:${Date.now()}`;
      const authoritativeMeals = Array.isArray(activeTargetContext?.targetMeals)
        ? activeTargetContext.targetMeals
        : (Array.isArray(normalizedIncoming.targetMeals) ? normalizedIncoming.targetMeals : []);
      const preservedIds = new Set(
        (Array.isArray(activeTargetContext?.preservedMealIds)
          ? activeTargetContext.preservedMealIds
          : []).map(String)
      );
      const preservedMeals = authoritativeMeals.filter((meal) => (
        meal?.confirmed === true
        || preservedIds.has(String(meal?.id || meal?.mealId || ""))
      ));
      setTargetSessionSeed(sessionSeed);
      setDraft({
        ...normalizedIncoming,
        targetMeals: preservedMeals,
        targetPlannedTarget: null,
        targetFreeCalories: Number(normalizedIncoming.freeCalories) || 0,
        targetPlanDate: "",
        targetPlanSignature: "",
        targetPlanCustomized: false,
      });
    } else {
      setTargetSessionSeed("");
      setDraft(normalizedIncoming);
    }
    setStep(flow.initialStep);
  }, [activeTargetContext, open, purpose, settings]);

  useEffect(() => {
  if (!open) return undefined;

  const previousOverflow = document.body.style.overflow;

  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = previousOverflow;
  };
}, [open]);

useEffect(() => {
  if (!open) return undefined;

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose?.();
    }
  };

  window.addEventListener(
    "keydown",
    handleKeyDown
  );

  return () => {
    window.removeEventListener(
      "keydown",
      handleKeyDown
    );
  };
}, [open, onClose]);



  if (!open) return null;

const selectedMealTypes =
  Array.isArray(draft.mealTypes)
    ? draft.mealTypes
    : [];

const customCalorieDistributionTotal =
  selectedMealTypes.reduce(
    (total, type) =>
      total +
      Number(
        draft.calorieDistributionPercents?.[type] || 0
      ),
    0
  );

const validCustomCalorieDistribution =
  draft.calorieDistributionMode !== "custom" ||
  customCalorieDistributionTotal === 100;


  const stepThreeMealTypes =
  Array.isArray(draft.mealTypes)
    ? draft.mealTypes
    : [];

const stepThreeOnlyModeValid =
  draft.generationProfile === "target" ||
  draft.foodPoolMode !== "only" ||
  stepThreeMealTypes.every((mealType) =>
    (draft.includeFoods || []).some((food) => {
      const target =
        preferenceMealTarget(food);

      return (
        target === "any" ||
        target === mealType
      );
    })
  );

const targetMealTotals = personalMealTargetTotals(draft.targetMeals || []);
const targetMealBudget = Number(draft.targetPlannedTarget?.kcal)
  || Math.max(0, (Number(target?.kcal) || 0) - (Number(draft.targetFreeCalories ?? draft.freeCalories) || 0));
const targetMealPlanValid = Array.isArray(draft.targetMeals)
  && draft.targetMeals.length === Number(draft.mealCount)
  && personalMealTargetTotalFitsBudget(targetMealTotals.kcal, targetMealBudget);
const editingExistingTargets = purpose === "edit_targets";

const canAdvance =
  (
    step !== 2 ||
    (
      selectedMealTypes.length ===
        Number(draft.mealCount) &&
      selectedMealTypes.length >= (editingExistingTargets ? 1 : 3) &&
      validCustomCalorieDistribution &&
      (
        draft.generationProfile !== "target" ||
        Number(draft.freeCalories || 0) < Number(target?.kcal || 0)
      )
    )
  ) &&
  (
    step !== 3 ||
    (
      draft.generationProfile === "target"
        ? targetMealPlanValid
        : stepThreeOnlyModeValid
    )
  );
const wizardFlow = menuGenerationWizardFlow(draft, purpose);

  const regenerateTargetPreview = () => {
    const preservedIds = new Set(
      (Array.isArray(activeTargetContext?.preservedMealIds)
        ? activeTargetContext.preservedMealIds
        : []).map(String)
    );
    setDraft((current) => {
      const confirmedMeals = (Array.isArray(current.targetMeals) ? current.targetMeals : [])
        .filter((meal) => (
          meal?.confirmed === true
          || preservedIds.has(String(meal?.id || meal?.mealId || ""))
        ));
      return {
        ...current,
        targetMeals: confirmedMeals,
        targetPlannedTarget: null,
        targetFreeCalories: Number(current.freeCalories) || 0,
        targetPlanDate: "",
        targetPlanSignature: "",
        targetPlanCustomized: confirmedMeals.length > 0,
      };
    });
    setTargetSessionSeed((current) => `${current || `target-preview:${Date.now()}`}:reroll`);
  };

  const restore = () => {
    const restored = onRestore?.() || { ...DEFAULT_MENU_GENERATION_SETTINGS };
    setDraft(restored);
    setStep(menuGenerationWizardFlow(restored, purpose).initialStep);
  };

return (
  <section
    id="menu-generation-settings"
    className="fixed inset-0 z-[100] bg-[#05080d]"
    role="dialog"
    aria-modal="true"
    aria-label="Asistente de ajustes de generación"
  >
    <div className="mx-auto flex h-[100dvh] w-full max-w-[760px] flex-col bg-[#05080d] shadow-2xl">

<Header
  step={step}
  totalSteps={wizardFlow.totalSteps}
  profile={draft.generationProfile}
  purpose={purpose}
  onBack={editingExistingTargets
    ? onClose
    : () => setStep((current) => Math.max(1, current - 1))}
  onClose={onClose}
/>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <div className="mx-auto w-full max-w-[620px]">

          {externalError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 flex items-start gap-3 rounded-[1.15rem] border border-rose-300/35 bg-[linear-gradient(135deg,rgba(65,20,31,.94),rgba(20,12,18,.98))] p-3.5 text-rose-50 shadow-[0_14px_34px_rgba(0,0,0,.30)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-rose-200/30 bg-rose-300/10 text-rose-100">
                <TriangleAlert size={19} />
              </span>
              <span className="min-w-0 pt-0.5 text-[12px] font-black leading-relaxed">
                {externalError}
              </span>
            </div>
          ) : null}

          {step === 1 ? (
            <StepOne
              draft={draft}
              setDraft={setDraft}
            />
          ) : null}

          {step === 2 ? (
            <StepTwo
              draft={draft}
              setDraft={setDraft}
              target={target}
              protectedMealTypes={activeTargetContext?.protectedMealTypes || []}
              editingExistingTargets={editingExistingTargets}
            />
          ) : null}

          {step === 3 ? (
            draft.generationProfile === "target" ? (
              <TargetMealsStep
                key={targetSessionSeed}
                draft={draft}
                setDraft={setDraft}
                target={target}
                dailyTarget={target}
                trackingBreakdown={trackingBreakdown}
                sessionSeed={targetSessionSeed}
                editingExistingTargets={editingExistingTargets}
                minimumTargetsByMealId={activeTargetContext?.minimumTargetsByMealId || {}}
                preservedMealIds={activeTargetContext?.preservedMealIds || []}
                consumedMeals={activeTargetContext?.consumedMeals || []}
                mealRecordsById={activeTargetContext?.mealRecordsById || {}}
                originalMealIds={activeTargetContext?.originalMealIds || []}
              />
            ) : (
              <StepThree draft={draft} setDraft={setDraft} />
            )
          ) : null}

{step === 4 ? (
  draft.generationProfile === "target" ? (
    <TargetReviewStep draft={draft} target={target} consumedBaseline={trackingBreakdown?.total} onEditStep={setStep} />
  ) : (
    <StepFour draft={draft} setDraft={setDraft} target={target} hasMenu={hasMenu} purpose={purpose} onEditStep={setStep} />
  )
) : null}

        </div>
      </main>

      <footer className="shrink-0 border-t border-white/[0.07] bg-[#070b10]/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-[620px] gap-2">

          {editingExistingTargets && step === 3 ? (
            <button
              type="button"
              disabled={!targetMealPlanValid || creatingTargets}
              onClick={() => onUpdateTargets?.(draft)}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD75E]/70 bg-[linear-gradient(135deg,#E0B52B,#FFE071)] px-4 text-[13px] font-black text-black shadow-[0_10px_30px_rgba(212,175,55,.28)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creatingTargets ? <Loader2 size={19} className="animate-spin" /> : <Save size={18} />}
              {creatingTargets ? "Guardando metas..." : "Guardar metas del día"}
            </button>
          ) : wizardFlow.settingsOnly && step === 2 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => onSave?.(draft)}
              className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD75E]/60 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-4 text-[13px] font-black text-black shadow-[0_8px_24px_rgba(212,175,55,.20)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={18} />
              Guardar ajustes
            </button>
          ) : draft.generationProfile === "target" && purpose === "generate" && step === 3 ? (
            <div className="grid gap-2 sm:grid-cols-[1.35fr_.85fr]">
              <button
                type="button"
                disabled={!canAdvance}
                onClick={() => setStep(4)}
                className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD75E]/60 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-4 text-[13px] font-black text-black shadow-[0_8px_24px_rgba(212,175,55,.20)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuar
                <ArrowRight size={18} strokeWidth={2.6} />
              </button>
              <button
                type="button"
                onClick={regenerateTargetPreview}
                className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl border border-teal-300/30 bg-teal-300/[0.04] px-4 text-[11px] font-black text-teal-100"
              >
                <RefreshCw size={16} />
                Generar otra combinación
              </button>
            </div>
          ) : step < 4 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((current) => current + 1)}
              className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD75E]/60 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-4 text-[13px] font-black text-black shadow-[0_8px_24px_rgba(212,175,55,.20)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
              <ArrowRight size={18} strokeWidth={2.6} />
            </button>
          ) : draft.generationProfile === "target" ? (
            <div className="grid gap-2 sm:grid-cols-[1.35fr_.85fr]">
              <button
                type="button"
                disabled={!targetMealPlanValid || creatingTargets}
                onClick={() => onCreateTargets?.(draft)}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD75E]/70 bg-[linear-gradient(135deg,#E0B52B,#FFE071)] px-4 text-[13px] font-black text-black shadow-[0_10px_30px_rgba(212,175,55,.28)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creatingTargets ? <Loader2 size={19} className="animate-spin" /> : <Target size={19} />}
                {creatingTargets ? "Creando metas..." : "Crear metas del día"}
              </button>
              <button
                type="button"
                disabled={creatingTargets}
                onClick={() => setStep(3)}
                className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-teal-300/35 bg-teal-300/[0.06] px-4 text-[12px] font-black text-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PencilLine size={17} />
                Volver a editar metas
              </button>
            </div>
          ) : purpose === "generate" ? (
            <button
              type="button"
              onClick={() => onGenerate?.(draft)}
              className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD75E]/60 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-4 text-[13px] font-black text-black shadow-[0_8px_24px_rgba(212,175,55,.20)]"
            >
              <Sparkles size={18} />
              Generar menú
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSave?.(draft)}
              className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-[#FFD75E]/60 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] px-4 text-[13px] font-black text-black shadow-[0_8px_24px_rgba(212,175,55,.20)]"
            >
              <Save size={18} />
              Guardar ajustes
            </button>
          )}

          {!(draft.generationProfile === "target" && (purpose === "generate" || editingExistingTargets)) ? (
            <button
              type="button"
              onClick={restore}
              disabled={creatingTargets}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-teal-300/30 bg-teal-300/[0.035] px-4 text-[12px] font-black text-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw size={17} />
              Restaurar
            </button>
          ) : null}

        </div>
      </footer>

    </div>
  </section>
);



}
