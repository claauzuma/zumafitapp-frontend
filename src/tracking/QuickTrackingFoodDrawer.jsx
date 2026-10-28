import React, { useEffect, useMemo, useState } from "react";
import {
  Apple,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PencilLine,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import {
  createCustomFood,
  deleteCustomFood,
  listAlimentos,
  listCustomFoods,
  updateCustomFood,
} from "../nutricion/nutricionApi.js";
import {
  buildMenuItemSnapshot,
  getFoodImageUrl,
} from "../nutricion/nutricionUtils.js";
import { useAddFoodLog } from "./trackingQueries.js";
import { buildQuickTrackingDestinations } from "./quickTrackingDestinations.js";

const VISIBLE_SEARCH_RESULTS = 3;
const EMPTY_DESTINATIONS = [];

function foodPayload(food = {}) {
  return {
    id: food.id || food._id || food.alimentoId,
    alimentoId: food.alimentoId || food.id || food._id,
    nombre: food.nombre || food.name,
    unidad: food.unidad || food.unit || "g",
    kcal: food.kcal,
    proteina: food.proteina ?? food.protein,
    carbs: food.carbs,
    grasas: food.grasas ?? food.fat,
    fuente: food.fuente || food.source,
    categoria: food.categoria || food.macroGroup,
    macroBasis: food.macroBasis,
    imagen: food.imagen,
    imagenUrl: getFoodImageUrl(food),
  };
}

function defaultQuantity(food = {}) {
  const unit = String(food.unidad || food.unit || "g")
    .trim()
    .toLowerCase();

  if (
    [
      "unidad",
      "unidades",
      "u",
      "porcion",
      "porción",
      "porciones",
    ].includes(unit)
  ) {
    return "1";
  }

  return "100";
}

function formatMacro(value) {
  const number = Number(value) || 0;
  return Math.round(number * 10) / 10;
}

const EMPTY_CUSTOM_FOOD = {
  nombre: "",
  unidad: "g",
  calorias: "",
  proteinas: "",
  carbohidratos: "",
  grasas: "",
};

function customFoodDraft(food = null) {
  if (!food) return { ...EMPTY_CUSTOM_FOOD };
  return {
    nombre: food.nombre || food.name || "",
    unidad: food.unidad || food.unit || "g",
    calorias: String(food.kcal ?? ""),
    proteinas: String(food.proteina ?? food.protein ?? ""),
    carbohidratos: String(food.carbs ?? ""),
    grasas: String(food.grasas ?? food.fat ?? ""),
  };
}

function customFoodCalories(draft = {}) {
  const protein = Math.max(0, Number(String(draft.proteinas || "0").replace(",", ".")) || 0);
  const carbs = Math.max(0, Number(String(draft.carbohidratos || "0").replace(",", ".")) || 0);
  const fat = Math.max(0, Number(String(draft.grasas || "0").replace(",", ".")) || 0);
  return Math.round((protein * 4 + carbs * 4 + fat * 9) * 10) / 10;
}

function QuickCustomFoodLibrary({ onBack, onChoose }) {
  const [data, setData] = useState({ items: [], usage: 0, limit: 0, canCreate: false });
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(() => customFoodDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await listCustomFoods();
      setData({
        items: Array.isArray(response.items) ? response.items : [],
        usage: Number(response.usage) || 0,
        limit: Number(response.limit) || 0,
        canCreate: response.canCreate === true,
      });
    } catch (loadError) {
      setError(loadError?.message || "No pudimos cargar tus alimentos personalizados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(food = null) {
    setEditing(food);
    setDraft(customFoodDraft(food));
    setError("");
    setView("form");
  }

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    if (!draft.nombre.trim()) {
      setError("Escribi un nombre para el alimento.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      nombre: draft.nombre.trim(),
      unidad: draft.unidad,
      calorias: customFoodCalories(draft),
      proteinas: draft.proteinas,
      carbohidratos: draft.carbohidratos,
      grasas: draft.grasas,
    };
    try {
      if (editing) {
        const updated = await updateCustomFood(editing.id, payload);
        setData((current) => ({
          ...current,
          items: current.items.map((item) => item.id === updated.id ? updated : item),
        }));
        setEditing(null);
        setView("list");
      } else {
        const created = await createCustomFood(payload);
        onChoose?.(created);
      }
    } catch (saveError) {
      setError(saveError?.message || "No pudimos guardar el alimento.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(food) {
    if (!window.confirm(`Eliminar ${food.nombre || food.name} de tus alimentos personalizados?`)) return;
    try {
      await deleteCustomFood(food.id);
      setData((current) => ({
        ...current,
        usage: Math.max(0, current.usage - 1),
        items: current.items.filter((item) => item.id !== food.id),
      }));
    } catch (removeError) {
      setError(removeError?.message || "No pudimos eliminar el alimento.");
    }
  }

  const atLimit = data.limit > 0 && data.usage >= data.limit;
  return (
    <div className="min-h-full bg-[#080d13] p-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={view === "form" ? () => setView("list") : onBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200" aria-label="Volver">
          <ChevronLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <span className="block text-[9px] font-black uppercase tracking-[.15em] text-emerald-300">Biblioteca privada</span>
          <strong className="block truncate text-sm font-black text-white">{view === "form" ? (editing ? "Editar alimento" : "Crear alimento") : "Mis alimentos personalizados"}</strong>
        </div>
        {data.limit ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[.07] px-2.5 py-1 text-[10px] font-black text-emerald-200">{data.usage}/{data.limit}</span> : null}
      </div>

      {error ? <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-[11px] font-bold text-rose-200">{error}</div> : null}

      {view === "form" ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[.055] p-3">
            <div className="flex items-center gap-2 text-[#FFE28A]"><Sparkles size={15} /><strong className="text-xs font-black">{draft.unidad === "unidad" ? "Valores por 1 unidad" : `Valores cada 100 ${draft.unidad}`}</strong></div>
            <p className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-500">Es privado y nunca se agrega solo a un menu automatico.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
            <label className="grid gap-1 text-[9px] font-black uppercase tracking-wide text-zinc-500">Nombre<input autoFocus maxLength={80} value={draft.nombre} onChange={(event) => setField("nombre", event.target.value)} placeholder="Ej. Yogur casero" className="h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm font-black normal-case text-white outline-none" /></label>
            <label className="grid gap-1 text-[9px] font-black uppercase tracking-wide text-zinc-500">Unidad<select value={draft.unidad} onChange={(event) => setField("unidad", event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#0b1117] px-2 text-xs font-black normal-case text-white outline-none"><option value="g">100 g</option><option value="ml">100 ml</option><option value="unidad">1 unid</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-2.5 text-[9px] font-black uppercase tracking-wide text-zinc-500">
              Calorias<span className="flex items-center gap-1"><output className="min-w-0 flex-1 text-base font-black normal-case text-amber-200">{formatMacro(customFoodCalories(draft))}</output><small className="text-zinc-600">kcal</small></span>
            </div>
            {[
              ["proteinas", "Proteinas", "g", "text-emerald-200"],
              ["carbohidratos", "Carbos", "g", "text-cyan-200"],
              ["grasas", "Grasas", "g", "text-violet-200"],
            ].map(([field, label, suffix, tone]) => (
              <label key={field} className="grid gap-1 rounded-xl border border-white/10 bg-white/[.03] p-2.5 text-[9px] font-black uppercase tracking-wide text-zinc-500">
                {label}<span className="flex items-center gap-1"><input type="number" min="0" step="0.1" inputMode="decimal" value={draft[field]} onChange={(event) => setField(field, event.target.value)} placeholder="0" className={`min-w-0 flex-1 bg-transparent text-base font-black normal-case outline-none ${tone}`} /><small className="text-zinc-600">{suffix}</small></span>
              </label>
            ))}
          </div>
          <button type="button" disabled={saving} onClick={save} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6ee7b7,#34d399)] px-4 text-sm font-black text-[#052e25] disabled:opacity-50">
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={16} />}{editing ? "Guardar cambios" : "Crear y seleccionar"}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {loading ? <div className="grid min-h-24 place-items-center"><Loader2 size={18} className="animate-spin text-emerald-300" /></div> : null}
          {!loading && data.canCreate ? <button type="button" disabled={atLimit} onClick={() => openForm()} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300/35 bg-emerald-300/[.06] text-sm font-black text-emerald-100 disabled:opacity-45"><Plus size={17} />{atLimit ? "Limite de 30 alcanzado" : "Crear alimento personalizado"}</button> : null}
          {!loading && !data.canCreate ? <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[.055] p-3 text-xs font-bold text-zinc-300"><strong className="block text-[#FFE28A]">Disponible para clientes Pro y VIP</strong><span className="mt-1 block text-zinc-500">Tu plan actual no permite crear alimentos personalizados.</span></div> : null}
          {!loading && data.items.map((food) => (
            <article key={food.id} className="flex items-center gap-2 rounded-2xl border border-white/[.08] bg-white/[.025] p-2">
              <button type="button" onClick={() => onChoose?.(food)} className="min-w-0 flex-1 p-1 text-left"><strong className="block truncate text-xs font-black text-white">{food.nombre || food.name}</strong><small className="mt-1 block truncate text-[9px] font-bold text-zinc-500">{(food.unidad || food.unit) === "unidad" ? "1 unidad" : `100 ${food.unidad || food.unit}`} · {formatMacro(food.kcal)} kcal · P {formatMacro(food.proteina ?? food.protein)} / C {formatMacro(food.carbs)} / G {formatMacro(food.grasas ?? food.fat)}</small></button>
              {data.canCreate ? <button type="button" onClick={() => openForm(food)} className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/[.06] text-cyan-200" aria-label={`Editar ${food.nombre || food.name}`}><PencilLine size={15} /></button> : null}
              <button type="button" onClick={() => remove(food)} className="grid h-9 w-9 place-items-center rounded-xl border border-rose-300/20 bg-rose-300/[.06] text-rose-200" aria-label={`Eliminar ${food.nombre || food.name}`}><Trash2 size={15} /></button>
            </article>
          ))}
          {!loading && data.canCreate && !data.items.length ? <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-[11px] font-bold text-zinc-500">Todavia no creaste alimentos personalizados.</div> : null}
        </div>
      )}
    </div>
  );
}

export default function QuickTrackingFoodDrawer({
  open = false,
  date = "",
  initialDestinationKey = "picoteo",
  destinationLocked = false,
  destinations = EMPTY_DESTINATIONS,
  onClose,
  onSaved,
}) {
  const addMutation = useAddFoodLog();
  const destinationOptions = useMemo(
    () => buildQuickTrackingDestinations(destinations),
    [destinations]
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("100");
  const [customFoodsOpen, setCustomFoodsOpen] = useState(false);

const [destinationKey, setDestinationKey] =
  useState(initialDestinationKey || "picoteo");

  const [saveError, setSaveError] = useState("");

  /*
   * Cada vez que abrimos arrancamos limpio.
   * Picoteo queda seleccionado por defecto.
   */
useEffect(() => {
  if (!open) return;

  setSearch("");
  setDebouncedSearch("");
  setResults([]);
  setSearchError("");
  setSelectedFood(null);
  setQuantity("100");
  setCustomFoodsOpen(false);

  const validInitialDestination =
    destinationOptions.some(
      (item) =>
        item.key === initialDestinationKey
    )
      ? initialDestinationKey
      : "picoteo";

  setDestinationKey(
    validInitialDestination
  );

  setSaveError("");
}, [
  date,
  open,
  initialDestinationKey,
  destinationOptions,
]);

  /*
   * Bloqueamos scroll de fondo + Escape.
   */
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape" && !addMutation.isPending) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [addMutation.isPending, onClose, open]);

  /*
   * Debounce de búsqueda.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 260);

    return () => window.clearTimeout(timer);
  }, [search]);

  /*
   * Misma búsqueda que usamos en Tracking.
   */
  useEffect(() => {
    if (!open) return undefined;

    const term = debouncedSearch.trim();

    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return undefined;
    }

    let active = true;

    setSearching(true);
    setSearchError("");

    listAlimentos({
      search: term,
      limit: 12,
    })
      .then((data) => {
        if (!active) return;

        setResults(
          (data?.alimentos || data?.all || []).slice(0, 12)
        );
      })
      .catch((error) => {
        if (!active) return;

        setResults([]);
        setSearchError(
          error?.message ||
            "No se pudieron buscar alimentos."
        );
      })
      .finally(() => {
        if (active) {
          setSearching(false);
        }
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, open]);

  const selectedDestination =
    destinationOptions.find(
      (item) => item.key === destinationKey
    ) || destinationOptions[0];
  const hasFixedDestination = destinationLocked && destinationOptions.some(
    (item) => item.key === initialDestinationKey
  );

  const preview = useMemo(() => {
    if (!selectedFood) return null;

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    try {
      return buildMenuItemSnapshot(
        selectedFood,
        amount,
        selectedFood.unidad ||
          selectedFood.unit ||
          "g"
      );
    } catch {
      return null;
    }
  }, [quantity, selectedFood]);

  function chooseFood(food) {
    setSelectedFood(food);
    setQuantity(defaultQuantity(food));
    setSaveError("");
  }

  async function saveFood() {
    if (
      !date ||
      !selectedFood ||
      addMutation.isPending
    ) {
      return;
    }

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount <= 0) {
      setSaveError("Ingresá una cantidad válida.");
      return;
    }

    const payload = {
      date,

      mealId: selectedDestination.mealId,
      mealType: selectedDestination.mealType,
      mealName: selectedDestination.mealName,

      food: foodPayload(selectedFood),

      cantidad: amount,
      unidad:
        selectedFood.unidad ||
        selectedFood.unit ||
        "g",
    };

    setSaveError("");

    try {
      await addMutation.mutateAsync(payload);

      onClose?.();
      onSaved?.(payload);
    } catch (error) {
      setSaveError(
        error?.message ||
          "No se pudo registrar el alimento."
      );
    }
  }

  if (!open) return null;

  return (
    <section
      className="
        fixed inset-0 z-[150]
        flex items-end justify-center
        bg-black/75
        backdrop-blur-sm
        sm:items-center
        sm:p-4
      "
      role="dialog"
      aria-modal="true"
      aria-label="Registrar alimento"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Cerrar"
        onClick={
          addMutation.isPending
            ? undefined
            : onClose
        }
      />

      <div
        className={`
          relative z-10
          flex max-h-[92dvh] w-full flex-col
          overflow-hidden
          rounded-t-[1.7rem]
          border border-white/10
          bg-[#080d13]
          shadow-[0_-20px_60px_rgba(0,0,0,.65)]

          sm:max-w-[460px]
          sm:rounded-[1.7rem]
          ${customFoodsOpen ? "h-[92dvh] sm:h-[min(760px,92dvh)]" : ""}
        `}
      >
        {/* HEADER */}
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFD75E]">
                <Utensils size={18} />
              </span>

              <div>
                <h2 className="text-[15px] font-black text-zinc-50">
                  Registrar alimento
                </h2>

                <p className="text-[10px] font-bold text-zinc-500">
                  {hasFixedDestination
                    ? `Se agrega a ${selectedDestination?.label || "esta comida"}.`
                    : "Guardalo directamente en tu Tracking."}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={addMutation.isPending}
            onClick={onClose}
            className="
              grid h-9 w-9 shrink-0 place-items-center
              rounded-xl border border-white/10
              bg-white/[0.04]
              text-zinc-300
              disabled:opacity-40
            "
          >
            <X size={18} />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {customFoodsOpen ? (
            <div className="absolute inset-0 z-20 overflow-y-auto bg-[#080d13]">
              <QuickCustomFoodLibrary
                onBack={() => setCustomFoodsOpen(false)}
                onChoose={(food) => {
                  chooseFood(food);
                  setCustomFoodsOpen(false);
                }}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setCustomFoodsOpen(true)}
            className="mb-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.055] px-3 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><Plus size={15} /></span>
              <span className="min-w-0"><strong className="block truncate text-xs font-black text-emerald-100">Mis alimentos personalizados</strong><small className="block truncate text-[9px] font-bold text-zinc-500">Crear, editar o elegir · Pro</small></span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-emerald-300" />
          </button>

          {/* BUSCADOR */}
          <label className="relative block">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />

            <input
              autoFocus
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar alimento..."
              className="
                h-12 w-full rounded-2xl
                border border-white/10
                bg-white/[0.045]
                pl-10 pr-10
                text-sm font-bold text-zinc-100
                outline-none
                placeholder:text-zinc-600
                focus:border-cyan-300/40
              "
            />

            {searching ? (
              <Loader2
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cyan-300"
              />
            ) : null}
          </label>

          {searchError ? (
            <p className="mt-2 text-[11px] font-bold text-rose-300">
              {searchError}
            </p>
          ) : null}

          {/* RESULTADOS */}
          {results.length ? (
            <div className="mt-3">
              <div
                className="max-h-[192px] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.08] bg-white/[0.025] [scrollbar-color:rgba(103,232,249,.45)_rgba(255,255,255,.04)] [scrollbar-width:thin]"
                aria-label="Resultados de alimentos"
              >
                {results.map((food, index) => {
                const id =
                  food.id ||
                  food._id ||
                  food.alimentoId ||
                  index;

                const imageUrl =
                  getFoodImageUrl(food);

                const active =
                  String(
                    selectedFood?.id ||
                      selectedFood?._id ||
                      selectedFood?.alimentoId ||
                      ""
                  ) ===
                  String(
                    food.id ||
                      food._id ||
                      food.alimentoId ||
                      ""
                  );

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => chooseFood(food)}
                    className={`
                      flex min-h-16 w-full items-center gap-3
                      border-b border-white/[0.06]
                      px-3 py-2.5 text-left
                      last:border-b-0
                      ${
                        active
                          ? "bg-cyan-300/[0.08]"
                          : "hover:bg-white/[0.04]"
                      }
                    `}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Apple
                          size={18}
                          className="text-zinc-500"
                        />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[12px] font-black text-zinc-100">
                        {food.nombre ||
                          food.name ||
                          "Alimento"}
                      </strong>

                      <small className="mt-0.5 block truncate text-[9px] font-bold text-zinc-500">
                        {formatMacro(food.kcal)} kcal · P{" "}
                        {formatMacro(
                          food.proteina ??
                            food.protein
                        )}{" "}
                        · C{" "}
                        {formatMacro(food.carbs)} · G{" "}
                        {formatMacro(
                          food.grasas ?? food.fat
                        )}
                      </small>
                    </span>

                    {active ? (
                      <Check
                        size={17}
                        className="shrink-0 text-cyan-300"
                      />
                    ) : null}
                  </button>
                );
                })}
              </div>

              {results.length > VISIBLE_SEARCH_RESULTS ? (
                <p className="mt-1.5 flex items-center justify-center gap-1 text-[9px] font-black text-cyan-200/75">
                  Deslizá dentro de la lista para ver {results.length - VISIBLE_SEARCH_RESULTS} resultados más
                  <ChevronDown size={13} aria-hidden="true" />
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ALIMENTO SELECCIONADO */}
          {selectedFood ? (
            <>
              <section className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.055] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-cyan-300">
                      Seleccionado
                    </p>

                    <strong className="mt-1 block truncate text-[13px] font-black text-zinc-50">
                      {selectedFood.nombre ||
                        selectedFood.name}
                    </strong>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(event.target.value)
                      }
                      className="
                        h-10 w-20 rounded-xl
                        border border-white/10
                        bg-black/30 px-2
                        text-center text-sm font-black
                        text-zinc-100 outline-none
                        focus:border-cyan-300/40
                      "
                    />

                    <span className="min-w-8 text-[11px] font-black text-zinc-400">
                      {selectedFood.unidad ||
                        selectedFood.unit ||
                        "g"}
                    </span>
                  </div>
                </div>

                {preview ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-black">
                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[#FFD75E]">
                      {formatMacro(preview.kcal)} kcal
                    </span>

                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-emerald-200">
                      P {formatMacro(preview.proteina)} g
                    </span>

                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-cyan-200">
                      C {formatMacro(preview.carbs)} g
                    </span>

                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-amber-200">
                      G {formatMacro(preview.grasas)} g
                    </span>
                  </div>
                ) : null}
              </section>

              {/* DESTINO */}
              {!hasFixedDestination ? <section className="mt-5">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                  ¿Dónde lo querés registrar?
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {destinationOptions.map((destination) => {
                    const active =
                      destination.key ===
                      destinationKey;

                    return (
                      <button
                        key={destination.key}
                        type="button"
                        onClick={() =>
                          setDestinationKey(
                            destination.key
                          )
                        }
                        className={`
                          relative rounded-2xl border
                          px-3 py-2.5 text-left
                          transition

                          ${
                            destination.featured
                              ? "col-span-2"
                              : ""
                          }

                          ${
                            active
                              ? "border-[#D4AF37]/55 bg-[#D4AF37]/10"
                              : "border-white/[0.08] bg-white/[0.03]"
                          }
                        `}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <strong
                              className={`block text-[11px] font-black ${
                                active
                                  ? "text-[#FFE28A]"
                                  : "text-zinc-200"
                              }`}
                            >
                              {destination.label}
                            </strong>

                            {destination.description ? (
                              <small className="mt-0.5 block text-[9px] font-bold text-zinc-500">
                                {
                                  destination.description
                                }
                              </small>
                            ) : null}
                          </div>

                          <span
                            className={`
                              grid h-5 w-5 place-items-center
                              rounded-full border

                              ${
                                active
                                  ? "border-[#FFD75E] bg-[#FFD75E] text-black"
                                  : "border-white/15 text-transparent"
                              }
                            `}
                          >
                            <Check size={12} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {destinationKey === "picoteo" ? (
                  <p className="mt-2 text-[9px] font-bold leading-relaxed text-zinc-500">
                    Picoteo suma calorías y macros al día,
                    pero no ocupa ni reemplaza una comida.
                  </p>
                ) : null}
              </section> : null}
            </>
          ) : null}

          {saveError ? (
            <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-[10px] font-black text-rose-200">
              {saveError}
            </div>
          ) : null}
        </div>

        {/* BOTÓN */}
        {!customFoodsOpen ? <footer className="border-t border-white/[0.08] bg-[#080d13]/95 p-3">
          <button
            type="button"
            disabled={
              !selectedFood ||
              !preview ||
              addMutation.isPending
            }
            onClick={saveFood}
            className="
              flex min-h-12 w-full items-center
              justify-center gap-2
              rounded-2xl
              bg-[linear-gradient(135deg,#FFD75E,#D4AF37)]
              px-4
              text-sm font-black text-black
              shadow-[0_10px_28px_rgba(212,175,55,.18)]
              transition active:scale-[0.99]
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {addMutation.isPending ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                Guardando...
              </>
            ) : (
              <>
                <Check size={17} />
                Registrar alimento
              </>
            )}
          </button>
        </footer> : null}
      </div>
    </section>
  );
}
