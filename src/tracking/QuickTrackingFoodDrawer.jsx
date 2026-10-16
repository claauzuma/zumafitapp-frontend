import React, { useEffect, useMemo, useState } from "react";
import {
  Apple,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Utensils,
  X,
} from "lucide-react";

import { listAlimentos } from "../nutricion/nutricionApi.js";
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

export default function QuickTrackingFoodDrawer({
  open = false,
  date = "",
  initialDestinationKey = "picoteo",
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
        className="
          relative z-10
          flex max-h-[92dvh] w-full flex-col
          overflow-hidden
          rounded-t-[1.7rem]
          border border-white/10
          bg-[#080d13]
          shadow-[0_-20px_60px_rgba(0,0,0,.65)]

          sm:max-w-[460px]
          sm:rounded-[1.7rem]
        "
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
                  Guardalo directamente en tu Tracking.
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
              <section className="mt-5">
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
              </section>
            </>
          ) : null}

          {saveError ? (
            <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-[10px] font-black text-rose-200">
              {saveError}
            </div>
          ) : null}
        </div>

        {/* BOTÓN */}
        <footer className="border-t border-white/[0.08] bg-[#080d13]/95 p-3">
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
        </footer>
      </div>
    </section>
  );
}
