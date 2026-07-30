import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Check,
  ChevronRight,
  Heart,
  Info,
  Library,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { listAlimentos } from "../../nutricion/nutricionApi.js";
import { getFoodImageUrl } from "../../nutricion/nutricionUtils.js";
import { getCachedUser } from "../../authCache.js";
import { calculateTrackingQuantities } from "../../tracking/trackingApi.js";
import { listLibraryMeals, setLibraryMealFavorite } from "../../nutritionLibrary/nutritionLibraryApi.js";
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
  const empty = { drafts: [], strategy: "selected_only", rejectedSuggestionFoodIds: [], requestId: "", warnings: [], favoriteOriginId: "" };
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
  const [error, setError] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [optimization, setOptimization] = useState(null);
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [confirmOverage, setConfirmOverage] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryMeals, setLibraryMeals] = useState([]);
  const [libraryError, setLibraryError] = useState("");
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
      if (event.key === "Escape" && !saving && !calculating) onClose?.();
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
  }, [calculating, onClose, saving]);

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
        target,
        menuId,
        menuVersion,
      }));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // El flujo sigue funcionando aunque el navegador bloquee storage.
    }
  }, [drafts, favoriteOriginId, menuId, menuVersion, rejectedSuggestionFoodIds, requestId, storageKey, strategy, target, warnings]);

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

  function clearResult() {
    setOptimization(null);
    setConfirmOverage(false);
    setError("");
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
  }

  function changeStrategy(nextStrategy) {
    const next = nextStrategy === "assisted_food_addition" ? nextStrategy : "selected_only";
    setStrategy(next);
    if (next === "selected_only") {
      setDrafts((current) => current.filter((draft) => !draft.suggested));
    }
    clearResult();
  }

  function updateQuantity(id, value) {
    setDrafts((current) => current.map((draft) => (
      draft.id === id ? updateTrackingFoodDraftQuantity(draft, value) : draft
    )));
    clearResult();
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

  async function loadLibrary(scope = "all") {
    try {
      setLibraryOpen(true);
      setLibraryLoading(true);
      setLibraryError("");
      const data = await listLibraryMeals({
        scope,
        tipoComida: meal.tipoComida || meal.type || "todos",
        targetKcal: target.kcal,
        targetProteina: target.proteina,
        targetCarbs: target.carbs,
        targetGrasas: target.grasas,
        limit: 8,
      });
      setLibraryMeals(Array.isArray(data?.comidas) ? data.comidas : []);
    } catch (libraryLoadError) {
      setLibraryError(libraryLoadError?.message || "No pudimos buscar comidas equivalentes.");
      setLibraryMeals([]);
    } finally {
      setLibraryLoading(false);
    }
  }

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

  async function favoriteLibraryMeal(libraryMeal = {}) {
    try {
      await setLibraryMealFavorite(libraryMeal.id, true);
      setLibraryMeals((current) => current.map((item) => item.id === libraryMeal.id ? { ...item, favorita: true } : item));
    } catch (favoriteError) {
      setLibraryError(favoriteError?.message || "No pudimos guardar la favorita.");
    }
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
    onClose?.();
  }

  return (
    <section className="fixed inset-0 z-[110] flex items-end bg-black/82 p-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={dialogRef} className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_15%_0,rgba(45,212,191,.14),transparent_34%),radial-gradient(circle_at_100%_8%,rgba(212,175,55,.16),transparent_30%),linear-gradient(180deg,#101923,#070b10)] shadow-[0_30px_100px_rgba(0,0,0,.75)] sm:h-auto sm:max-h-[92dvh] sm:rounded-[1.7rem]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-3 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] sm:p-5">
          <div className="min-w-0">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 text-[10px] font-black uppercase tracking-wide text-emerald-200">
              <Sparkles size={14} /> Mi equivalente
            </span>
            <h3 id={titleId} className="mt-2 truncate text-xl font-black text-white sm:text-2xl">Reemplazar {mealTitle}</h3>
            <p className="mt-1 text-xs font-bold text-zinc-400">Solo cambia esta comida del {row.date || "dia"}. El menu original no se modifica.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={saving || calculating} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[0.06] text-white disabled:opacity-50" aria-label="Cerrar y conservar borrador">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto px-3 py-3 sm:p-5">
          <div className="grid gap-3">
            <section className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#FFE8A3]">Meta de la comida</span>
                  <strong className="mt-1 block text-xl font-black text-white">{format(target.kcal)} kcal</strong>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black text-zinc-300">Calorias → P → C/G</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] font-black text-zinc-300">
                <span className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">P {format(target.proteina, 1)} g</span>
                <span className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">C {format(target.carbs, 1)} g</span>
                <span className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">G {format(target.grasas, 1)} g</span>
              </div>
            </section>

            {canAuto ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                <span className="px-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">Como calcular</span>
                <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Estrategia para calcular la comida">
                  <button type="button" role="radio" aria-checked={strategy === "selected_only"} onClick={() => changeStrategy("selected_only")} className={`min-h-11 rounded-xl border px-2 text-[11px] font-black ${strategy === "selected_only" ? "border-emerald-300/35 bg-emerald-300/12 text-emerald-100" : "border-white/10 bg-black/20 text-zinc-400"}`}>
                    Usar solo mis alimentos
                  </button>
                  <button type="button" role="radio" aria-checked={strategy === "assisted_food_addition"} onClick={() => changeStrategy("assisted_food_addition")} className={`min-h-11 rounded-xl border px-2 text-[11px] font-black ${strategy === "assisted_food_addition" ? "border-sky-300/35 bg-sky-300/12 text-sky-100" : "border-white/10 bg-black/20 text-zinc-400"}`}>
                    Permitir sugerencias
                  </button>
                </div>
                <p className="mt-2 px-1 text-[10px] font-bold text-zinc-500">
                  {strategy === "assisted_food_addition"
                    ? "Si tus alimentos no alcanzan, puede proponer 1 a 3 opciones compatibles. Nunca las consume automaticamente."
                    : "El calculo no puede incorporar ningun alimento que no hayas elegido."}
                </p>
              </section>
            ) : null}

            {drafts.length ? (
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                {drafts.map((draft) => {
                  const automatic = isTrackingDraftAutomatic(draft);
                  const imageUrl = getFoodImageUrl(draft.food || {});
                  return (
                    <article key={draft.id} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-white/[0.07] p-2.5 last:border-b-0 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:p-3">
                      <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-emerald-300/25 bg-white sm:h-12 sm:w-12">
                        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-black text-zinc-700">{draft.name.slice(0, 1)}</span>}
                      </span>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-black text-white">{draft.name}</strong>
                        {draft.suggested ? <span className="mt-1 mr-1 inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-2 py-1 text-[9px] font-black uppercase text-sky-100">Sugerido</span> : null}
                        <button type="button" onClick={() => toggleMode(draft.id)} disabled={!canAuto && !automatic} className={`mt-1 min-h-8 rounded-full border px-2.5 text-[10px] font-black ${automatic ? "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFE8A3]" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"}`} aria-label={`Cambiar ${draft.name} a ${automatic ? "Manual" : "Auto"}`}>
                          {automatic ? "Auto" : "Manual"}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="flex h-10 w-[92px] items-center overflow-hidden rounded-xl border border-white/12 bg-black/25 sm:w-[108px]">
                          <span className="sr-only">Cantidad de {draft.name}</span>
                          <input type="number" min="0" step={trackingFoodRequiresWholeQuantity(draft.food, draft.unit) ? "1" : "0.1"} value={draft.quantity} onChange={(event) => updateQuantity(draft.id, event.target.value)} placeholder={automatic ? "Auto" : "0"} className="min-w-0 flex-1 bg-transparent px-2 text-right text-sm font-black text-white outline-none placeholder:text-zinc-600" aria-label={`Cantidad de ${draft.name}`} />
                          <span className="shrink-0 pr-2 text-[10px] font-black text-zinc-500">{draft.unit}</span>
                        </label>
                        <button type="button" onClick={() => removeFood(draft.id)} className="grid h-10 w-10 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-200" aria-label={`Quitar ${draft.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-4 text-center text-sm font-bold text-zinc-500">Busca alimentos y arma tu alternativa.</div>
            )}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
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
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <strong className="flex items-center gap-2 text-sm font-black text-white"><Library size={16} className="text-[#FFD76B]" /> Biblioteca equivalente</strong>
                  <p className="mt-1 text-[10px] font-bold text-zinc-500">Resultados de solo lectura ordenados por kcal, proteina y luego C/G.</p>
                </div>
                <button type="button" onClick={() => libraryOpen ? setLibraryOpen(false) : loadLibrary("all")} disabled={libraryLoading} className="min-h-11 shrink-0 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 text-[11px] font-black text-[#FFE8A3] disabled:opacity-50">
                  {libraryLoading ? "Buscando..." : libraryOpen ? "Cerrar" : "Buscar"}
                </button>
              </div>
              {libraryOpen ? (
                <div className="mt-3 grid gap-2">
                  <button type="button" onClick={() => loadLibrary("favorites")} disabled={libraryLoading} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] text-[10px] font-black text-rose-100"><Heart size={14} /> Ver mis favoritas</button>
                  {libraryError ? <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-2 text-xs font-bold text-rose-100" role="alert">{libraryError}</div> : null}
                  {libraryMeals.map((libraryMeal) => {
                    const equivalence = libraryMeal.equivalence || {};
                    const diff = equivalence.diff || {};
                    return (
                      <article key={libraryMeal.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block truncate text-sm font-black text-white">{libraryMeal.nombre}</strong>
                            <span className="mt-1 block text-[10px] font-bold text-zinc-400">{format(libraryMeal.totales?.kcal)} kcal · {signed(diff.kcal)} kcal</span>
                            <span className="mt-1 block text-[10px] font-bold text-zinc-500">P {signed(diff.proteina, 1)} · C {signed(diff.carbs, 1)} · G {signed(diff.grasas, 1)}</span>
                          </div>
                          <button type="button" onClick={() => favoriteLibraryMeal(libraryMeal)} disabled={libraryMeal.favorita} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-rose-200 disabled:opacity-45" aria-label={`Guardar ${libraryMeal.nombre} como favorita`}><Heart size={15} fill={libraryMeal.favorita ? "currentColor" : "none"} /></button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => applyLibraryMeal(libraryMeal, false)} className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-[10px] font-black text-zinc-200">Usar borrador</button>
                          <button type="button" onClick={() => applyLibraryMeal(libraryMeal, true)} disabled={!canAuto} className="min-h-10 rounded-xl border border-sky-300/25 bg-sky-300/10 px-2 text-[10px] font-black text-sky-100 disabled:opacity-40">Ajustar a mi meta</button>
                        </div>
                      </article>
                    );
                  })}
                  {!libraryLoading && !libraryMeals.length && !libraryError ? <p className="text-center text-xs font-bold text-zinc-500">No hay coincidencias visibles para esta meta.</p> : null}
                </div>
              ) : null}
            </section>

            {drafts.length ? (
              <section className={`rounded-2xl border p-3 ${comparison.exceedsCalories ? "border-rose-400/30 bg-rose-400/[0.08]" : comparison.caloriesClose ? "border-emerald-300/30 bg-emerald-300/[0.07]" : "border-sky-300/25 bg-sky-300/[0.06]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Propuesta actual</span>
                    <strong className="mt-1 block text-xl font-black text-white">{format(totals.kcal)} kcal</strong>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-black text-zinc-200">{signed(comparison.diff.kcal)} kcal</span>
                </div>
                <p className="mt-2 text-xs font-bold text-zinc-300">P {format(totals.proteina, 1)} ({signed(comparison.diff.proteina, 1)}) · C {format(totals.carbs, 1)} ({signed(comparison.diff.carbs, 1)}) · G {format(totals.grasas, 1)} ({signed(comparison.diff.grasas, 1)})</p>
                {!optimization && !comparison.proteinReached && target.proteina > 0 ? (
                  <p className="mt-2 flex items-start gap-2 text-xs font-bold text-amber-100"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> Con esta seleccion faltan {format(Math.abs(comparison.diff.proteina), 1)} g de proteina.</p>
                ) : comparison.caloriesClose ? (
                  <p className="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-100"><Check size={15} /> Calorias alineadas con la comida original.</p>
                ) : null}
              </section>
            ) : null}

            {calculationFeedback ? (
              <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs font-bold text-amber-100">
                <Info size={15} className="mr-2 inline" /><strong>{calculationFeedback.title}.</strong> {calculationFeedback.message}
              </div>
            ) : null}
            {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm font-bold text-rose-100" role="alert">{error}</div> : null}

            <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-sm font-bold text-zinc-200">
              <input type="checkbox" checked={saveTemplate} onChange={(event) => setSaveTemplate(event.target.checked)} className="h-5 w-5 accent-emerald-400" />
              Guardar como favorita reutilizable
            </label>
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-[#0b121a]/96 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 sm:p-4">
          <div className="grid grid-cols-[auto_1fr] gap-2 sm:grid-cols-[auto_1fr_1fr]">
            <button type="button" onClick={discard} disabled={saving || calculating} className="grid min-h-11 w-11 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-200 disabled:opacity-50 sm:w-auto sm:px-4" aria-label="Descartar borrador de comida equivalente"><Trash2 size={17} /><span className="sr-only sm:not-sr-only sm:ml-2">Descartar</span></button>
            {canAuto ? (
              <button type="button" onClick={calculate} disabled={saving || calculating || !drafts.length} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-300/10 px-3 text-xs font-black text-sky-100 disabled:opacity-45">
                {calculating ? <RefreshCw size={16} className="animate-spin" /> : <Calculator size={16} />}
                {calculating ? "Calculando..." : "Calcular cantidades"}
              </button>
            ) : (
              <div className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] px-3 text-center text-[10px] font-bold text-zinc-500">Cantidades manuales</div>
            )}
            <button type="button" onClick={apply} disabled={saving || calculating || !drafts.length} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#FFE38A,#D4AF37)] px-4 text-sm font-black text-black shadow-[0_10px_28px_rgba(212,175,55,.22)] disabled:opacity-45 sm:col-span-1">
              {saving ? <RefreshCw size={17} className="animate-spin" /> : <Check size={17} />}
              {confirmOverage && comparison.exceedsCalories ? "Guardar igualmente" : "Usar esta comida"}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] font-bold text-zinc-500">Queda pendiente hasta marcarla completa. Cerrar conserva el borrador.</p>
        </footer>
      </div>
    </section>
  );
}
