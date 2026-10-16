import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  Info,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Wheat,
  X,
} from "lucide-react";

import { listAlimentos } from "../nutricion/nutricionApi.js";
import {
  buildMenuItemSnapshot,
  formatNumber,
  getFoodImageUrl,
} from "../nutricion/nutricionUtils.js";

import { getCachedUser } from "../authCache.js";

import {
  CLIENT_PLAN_CAPABILITIES_STALE_TIME,
  clientPlanCapabilitiesKey,
  fetchClientPlanCapabilities,
} from "../clientPlans/clientPlanQueries.js";

import {
  useAddCalculatedFoodLogs,
  useDeleteFoodLog,
  useTrackingDay,
  useUpdateFoodLog,
} from "./trackingQueries.js";

import {
  addFoodLogsBatch,
  calculateTrackingQuantities,
} from "./trackingApi.js";

import {
  applyTrackingDraftProposals,
  buildTrackingQuantityCalculationRequest,
  createTrackingFoodDraft,
  defaultTrackingFoodManualQuantity,
  hasTrackingDraftQuantity,
  isTrackingFoodQuantityPhysicallyValid,
  isTrackingDraftAutomatic,
  isTrackingDraftCalculated,
  loadTrackingDraftState,
  markTrackingDraftAutomatic,
  markTrackingDraftManual,
  resolveTrackingFoodPickerQuantity,
  saveTrackingDraftState,
  TRACKING_PICKER_QUANTITY_AUTOMATIC,
  TRACKING_PICKER_QUANTITY_MANUAL,
  trackingDraftConfirmationRequestId,
  trackingDraftConfirmationTransport,
  trackingDraftCalculationPayload,
  trackingDraftKey,
  trackingDraftNutritionTotals,
  trackingDraftProposals,
  trackingDraftsNutritionTotals,
  trackingDraftsQuantityMode,
  trackingDraftsReadyToConfirm,
  trackingDraftStorageOwner,
  trackingFoodRequiresWholeQuantity,
  updateTrackingFoodDraftQuantity,
} from "./trackingQuantityDrafts.js";

import {
  trackingQuantityInvalidFoodsMessage,
} from "./trackingQuantityReview.js";


function browserStorage() {
  try {
    return globalThis.window?.localStorage || null;
  } catch {
    return null;
  }
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTotals(value = {}) {
  const nested = value?.totals || value?.totales || value || {};

  return {
    kcal: number(nested.kcal),
    proteina: number(
      nested.proteina ??
      nested.protein ??
      nested.p
    ),
    carbs: number(
      nested.carbs ??
      nested.carbohidratos ??
      nested.c
    ),
    grasas: number(
      nested.grasas ??
      nested.fat ??
      nested.g
    ),
  };
}

function addTotals(left = {}, right = {}) {
  const a = normalizeTotals(left);
  const b = normalizeTotals(right);

  return {
    kcal: a.kcal + b.kcal,
    proteina: a.proteina + b.proteina,
    carbs: a.carbs + b.carbs,
    grasas: a.grasas + b.grasas,
  };
}

function subtractTotals(left = {}, right = {}) {
  const a = normalizeTotals(left);
  const b = normalizeTotals(right);

  return {
    kcal: a.kcal - b.kcal,
    proteina: a.proteina - b.proteina,
    carbs: a.carbs - b.carbs,
    grasas: a.grasas - b.grasas,
  };
}

function positiveTotals(value = {}) {
  const totals = normalizeTotals(value);

  return {
    kcal: Math.max(0, totals.kcal),
    proteina: Math.max(0, totals.proteina),
    carbs: Math.max(0, totals.carbs),
    grasas: Math.max(0, totals.grasas),
  };
}

function hasPositiveTotals(value = {}) {
  const totals = positiveTotals(value);

  return (
    totals.kcal > 0 ||
    totals.proteina > 0 ||
    totals.carbs > 0 ||
    totals.grasas > 0
  );
}

function sumTrackingItems(items = []) {
  return items.reduce(
    (acc, item) => addTotals(acc, item),
    {
      kcal: 0,
      proteina: 0,
      carbs: 0,
      grasas: 0,
    }
  );
}

function trackingItemName(item = {}) {
  return (
    item.nombreSnapshot ||
    item.name ||
    item.nombre ||
    item.food?.nombre ||
    item.food?.name ||
    "Alimento"
  );
}

function trackingItemQuantity(item = {}) {
  return number(
    item.cantidad ??
    item.quantity
  );
}

function trackingItemUnit(item = {}) {
  return item.unidad || item.unit || "g";
}

function createTargetDraftRequestId(date, mealId) {
  const random =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `menu-target:${date}:${mealId}:${random}`;
}


export default function MealTargetTrackingPanel({
  date,
  mealId,
  mealName,
  mealType = "otra",
  target,
  nativeTarget = false,
  openFoodPickerOnMount = false,
  onBack,
  onChanged,
  onToast,
}) {
  const safeTarget = useMemo(
    () => normalizeTotals(target),
    [target]
  );

  const trackingQuery = useTrackingDay(date);
  const addCalculatedMutation = useAddCalculatedFoodLogs();
  const deleteMutation = useDeleteFoodLog();
  const updateMutation = useUpdateFoodLog();

  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: CLIENT_PLAN_CAPABILITIES_STALE_TIME,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const canAutoCalculate =
    capabilitiesQuery.data?.canAutoCalculateTrackingQuantities === true;

  const owner = useMemo(
    () => trackingDraftStorageOwner(getCachedUser() || {}),
    []
  );

  const [storedDraftState, setStoredDraftState] = useState(() => {
    return (
      loadTrackingDraftState(
        browserStorage(),
        owner
      ) || {
        draftsByMeal: {},
        feedbackByMeal: {},
      }
    );
  });

  const draftKey = useMemo(
    () => trackingDraftKey(date, mealId),
    [date, mealId]
  );

  const drafts = useMemo(
    () => storedDraftState?.draftsByMeal?.[draftKey] || [],
    [draftKey, storedDraftState?.draftsByMeal]
  );

  const trackingDay = useMemo(
    () => trackingQuery.data || {},
    [trackingQuery.data]
  );

  const trackedItems = useMemo(() => {
    const meals = trackingDay?.meals || {};

    return Array.isArray(meals?.[mealId])
      ? meals[mealId]
      : [];
  }, [trackingDay, mealId]);

  const trackedTotals = useMemo(
    () => sumTrackingItems(trackedItems),
    [trackedItems]
  );

  const draftTotals = useMemo(
    () => trackingDraftsNutritionTotals(drafts),
    [drafts]
  );

  const projectedTotals = useMemo(
    () => addTotals(trackedTotals, draftTotals),
    [trackedTotals, draftTotals]
  );

  const remainingProjected = useMemo(
    () => subtractTotals(safeTarget, projectedTotals),
    [safeTarget, projectedTotals]
  );

  const progress =
    safeTarget.kcal > 0
      ? Math.round(
          (trackedTotals.kcal / safeTarget.kcal) * 100
        )
      : 0;

  const progressWidth =
    Math.max(0, Math.min(100, progress));

  const [pickerOpen, setPickerOpen] = useState(openFoodPickerOnMount);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [foodsLoading, setFoodsLoading] =
    useState(false);
  const [foodSearchError, setFoodSearchError] =
    useState("");
  const [selectedFood, setSelectedFood] =
    useState(null);
  const [quantity, setQuantity] = useState("");
  const [quantityMode, setQuantityMode] = useState(TRACKING_PICKER_QUANTITY_MANUAL);

  const [calculating, setCalculating] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] =
    useState(false);

  const [message, setMessage] = useState(null);

  function notify(type, text) {
    setMessage({ type, text });
    onToast?.(text);
  }

  function setMealDrafts(nextValue) {
    setStoredDraftState((current) => {
      const currentDrafts =
        current?.draftsByMeal?.[draftKey] || [];

      const nextDrafts =
        typeof nextValue === "function"
          ? nextValue(currentDrafts)
          : nextValue;

      const nextByMeal = {
        ...(current?.draftsByMeal || {}),
      };

      if (nextDrafts.length) {
        nextByMeal[draftKey] = nextDrafts;
      } else {
        delete nextByMeal[draftKey];
      }

      return {
        ...current,
        draftsByMeal: nextByMeal,
      };
    });
  }

  useEffect(() => {
    saveTrackingDraftState(
      browserStorage(),
      owner,
      {
        draftsByMeal:
          storedDraftState?.draftsByMeal || {},
        feedbackByMeal:
          storedDraftState?.feedbackByMeal || {},
      }
    );
  }, [owner, storedDraftState]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      260
    );

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!pickerOpen) return undefined;

    const term = debouncedSearch.trim();

    if (term.length < 2) {
      setFoodResults([]);
      setFoodsLoading(false);
      setFoodSearchError("");
      return undefined;
    }

    let active = true;

    setFoodsLoading(true);
    setFoodSearchError("");

    listAlimentos({
      search: term,
      limit: 12,
    })
      .then((data) => {
        if (!active) return;

        setFoodResults(
          (
            data?.alimentos ||
            data?.all ||
            []
          ).slice(0, 12)
        );
      })
      .catch((error) => {
        if (!active) return;

        setFoodSearchError(
          error?.message ||
            "No se pudieron buscar alimentos."
        );

        setFoodResults([]);
      })
      .finally(() => {
        if (active) {
          setFoodsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, pickerOpen]);

  function openFoodPicker() {
    setSearch("");
    setDebouncedSearch("");
    setFoodResults([]);
    setFoodSearchError("");
    setSelectedFood(null);

    setQuantity("");
    setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);

    setPickerOpen(true);
  }

  function closeFoodPicker() {
    setPickerOpen(false);
    setSearch("");
    setDebouncedSearch("");
    setFoodResults([]);
    setFoodSearchError("");
    setSelectedFood(null);
    setQuantity("");
    setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);
  }

  function addSelectedFoodToDraft() {
    if (!selectedFood) {
      notify(
        "warning",
        "Elegí un alimento."
      );
      return;
    }

    const quantitySelection = resolveTrackingFoodPickerQuantity({
      mode: quantityMode,
      quantity,
      canAuto: canAutoCalculate,
    });
    const { hasQuantity, parsedQuantity } = quantitySelection;

    if (!hasQuantity && !quantitySelection.automatic) {
      notify(
        "warning",
        "Ingresá una cantidad o elegí Cantidad automática."
      );
      return;
    }

    if (
      hasQuantity &&
      (
        !Number.isFinite(parsedQuantity) ||
        parsedQuantity <= 0
      )
    ) {
      notify(
        "warning",
        "Ingresá una cantidad válida."
      );
      return;
    }

    const unit =
      selectedFood.unidad ||
      selectedFood.unit ||
      "g";

    if (
      hasQuantity &&
      !isTrackingFoodQuantityPhysicallyValid(
        selectedFood,
        unit,
        parsedQuantity
      )
    ) {
      notify(
        "warning",
        `${
          selectedFood.nombre ||
          selectedFood.name ||
          "Este alimento"
        } se mide en unidades enteras.`
      );
      return;
    }

    const draft = createTrackingFoodDraft(
      selectedFood,
      hasQuantity
        ? parsedQuantity
        : "",
      createTargetDraftRequestId(
        date,
        mealId
      ),
      trackingDraftsQuantityMode(drafts)
    );

    setMealDrafts((current) => [
      ...current,
      draft,
    ]);

    closeFoodPicker();
  }

  function updateDraftQuantity(
    draftId,
    nextQuantity
  ) {
    const selectedDraft =
      drafts.find(
        (draft) =>
          draft.id === draftId
      );

    if (!selectedDraft) return;

    const hasQuantity =
      String(nextQuantity).trim() !== "";

    if (
      !hasQuantity &&
      !canAutoCalculate
    ) {
      notify(
        "warning",
        "No podés dejar la cantidad vacía en este plan."
      );
      return;
    }

    if (
      !isTrackingFoodQuantityPhysicallyValid(
        selectedDraft.food ||
          selectedDraft,
        selectedDraft.unit,
        nextQuantity,
        { allowEmpty: true }
      )
    ) {
      notify(
        "warning",
        `${
          selectedDraft.name ||
          "Este alimento"
        } se mide en unidades enteras.`
      );
      return;
    }

    setMealDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== draftId) {
          return draft;
        }

        let nextDraft =
          updateTrackingFoodDraftQuantity(
            draft,
            nextQuantity
          );

        if (hasQuantity) {
          nextDraft =
            markTrackingDraftManual(
              nextDraft
            );
        } else {
          nextDraft =
            markTrackingDraftAutomatic(
              nextDraft
            );
        }

        return nextDraft;
      })
    );
  }

  function toggleDraftMode(draftId) {
    setMealDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== draftId) {
          return draft;
        }

        if (
          isTrackingDraftAutomatic(draft)
        ) {
          if (
            !hasTrackingDraftQuantity(draft)
          ) {
            notify(
              "info",
              "Ingresá una cantidad para dejar este alimento como fijo."
            );

            return draft;
          }

          return markTrackingDraftManual(
            draft
          );
        }

        if (!canAutoCalculate) {
          notify(
            "info",
            "El cálculo automático no está disponible en este plan."
          );

          return draft;
        }

        return updateTrackingFoodDraftQuantity(
          markTrackingDraftAutomatic(
            draft
          ),
          ""
        );
      })
    );
  }

  function removeDraft(draftId) {
    setMealDrafts((current) =>
      current.filter(
        (draft) =>
          draft.id !== draftId
      )
    );
  }

  async function calculateRemaining() {
    if (calculating || saving) return;

    if (!canAutoCalculate) {
      notify(
        "info",
        "El cálculo automático de cantidades no está disponible en tu plan."
      );
      return;
    }

    if (!drafts.length) {
      notify(
        "info",
        "Primero agregá al menos un alimento."
      );
      return;
    }

    if (
      !drafts.some(
        isTrackingDraftAutomatic
      )
    ) {
      notify(
        "info",
        "No hay alimentos Auto. Dejá al menos uno sin cantidad."
      );
      return;
    }

    /*
      IMPORTANTE:
      la meta para el algoritmo no es la meta
      original completa si ya hay consumos
      confirmados.

      Es:

      meta comida - ya consumido
    */
    const calculationTarget =
      positiveTotals(
        subtractTotals(
          safeTarget,
          trackedTotals
        )
      );

    if (
      !hasPositiveTotals(
        calculationTarget
      )
    ) {
      notify(
        "info",
        "Ya alcanzaste o superaste la meta de esta comida."
      );
      return;
    }

    const calculationInput =
      trackingDraftCalculationPayload(
        drafts
      );

    if (
      calculationTarget.kcal > 0 &&
      number(
        calculationInput.fixedTotals
          ?.kcal
      ) >= calculationTarget.kcal
    ) {
      notify(
        "info",
        "Las cantidades fijas ya alcanzan o superan el objetivo restante. Ajustalas o registrá la comida sin calcular."
      );
      return;
    }

    const quantityMode =
      trackingDraftsQuantityMode(
        drafts
      );

    setCalculating(true);

    try {
      const response =
        await calculateTrackingQuantities(
          buildTrackingQuantityCalculationRequest(
            {
              date,
              target:
                calculationTarget,
              trackingQuantityMode:
                quantityMode,
              fixedFoods:
                calculationInput.fixedFoods,
              pendingFoods:
                calculationInput.pendingFoods,
            }
          )
        );

      const invalidMessage =
        trackingQuantityInvalidFoodsMessage(
          response?.optimization
        );

      if (invalidMessage) {
        throw new Error(
          invalidMessage
        );
      }

      if (
        response?.status === "error" ||
        !Array.isArray(
          response?.foods
        ) ||
        !response.foods.length
      ) {
        throw new Error(
          response?.message ||
            "No se encontró una combinación razonable."
        );
      }

      const proposals =
        trackingDraftProposals(
          drafts,
          response.foods
        );

      if (
        proposals.length !==
        drafts.length
      ) {
        throw new Error(
          "No se pudo calcular una cantidad válida para todos los alimentos."
        );
      }

      const responseMode =
        response?.optimization
          ?.policy ===
        "tracking_calorie_fill_v1"
          ? "calorie_fill"
          : quantityMode;

      const nextDrafts =
        applyTrackingDraftProposals(
          drafts,
          proposals,
          responseMode
        );

      if (
        !trackingDraftsReadyToConfirm(
          nextDrafts
        )
      ) {
        throw new Error(
          "Todavía quedó alguna cantidad Auto sin resolver."
        );
      }

      setMealDrafts(nextDrafts);

      notify(
        "success",
        "Cantidades calculadas. Revisalas y confirmá para registrarlas."
      );
    } catch (error) {
      notify(
        "error",
        error?.message ||
          "No se pudieron calcular las cantidades."
      );
    } finally {
      setCalculating(false);
    }
  }

  async function confirmDrafts() {
    if (
      saving ||
      addCalculatedMutation.isPending
    ) {
      return;
    }

    if (!drafts.length) {
      notify(
        "info",
        "No hay alimentos para registrar."
      );
      return;
    }

    if (
      !trackingDraftsReadyToConfirm(
        drafts
      )
    ) {
      notify(
        "info",
        "Todavía hay cantidades pendientes. Completalas o usá Completar restante."
      );
      return;
    }

    const proposals =
      trackingDraftProposals(
        drafts,
        []
      );

    if (
      proposals.length !==
      drafts.length
    ) {
      notify(
        "error",
        "No se pudieron preparar todos los alimentos para guardar."
      );
      return;
    }

    setSaving(true);

    try {
      const items =
        proposals.map(
          (proposal) => {
            const unit =
              proposal.unit ||
              proposal.food?.unidad ||
              "g";

            return {
              ...buildMenuItemSnapshot(
              proposal.food,
              Number(
                proposal.quantity
              ),
              unit
              ),
              quantitySource: proposal.quantitySource || "manual",
            };
          }
        );

      const confirmationPayload = {
          requestId:
            trackingDraftConfirmationRequestId(
              date,
              mealId,
              drafts
            ),
          date,
          mealId,
          mealType,
          mealName,
          items,
      };

      if (trackingDraftConfirmationTransport(drafts) === "calculated") {
        await addCalculatedMutation.mutateAsync(confirmationPayload);
      } else {
        // Una cantidad escrita por la persona es Tracking manual. El endpoint
        // calculado exige una capability distinta y no corresponde para casos
        // como "Arroz, 100 g".
        await addFoodLogsBatch(confirmationPayload);
      }

      setMealDrafts([]);

      await trackingQuery.refetch();

      await Promise.resolve(
        onChanged?.()
      );

      notify(
        "success",
        `${items.length} alimento${
          items.length === 1 ? "" : "s"
        } registrado${
          items.length === 1 ? "" : "s"
        } en Tracking.`
      );
    } catch (error) {
      notify(
        "error",
        error?.message ||
          "No se pudieron registrar los alimentos."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrackedItem(
    item
  ) {
    const logId =
      item?.id || item?._id;

    if (!logId) return;

    try {
      await deleteMutation.mutateAsync({
        logId,
        date,
      });

      await trackingQuery.refetch();

      await Promise.resolve(
        onChanged?.()
      );
    } catch (error) {
      notify(
        "error",
        error?.message ||
          "No se pudo eliminar el alimento."
      );
    }
  }

  async function updateTrackedItemQuantity(item, nextQuantity) {
    const logId = item?.id || item?._id;
    const unit = trackingItemUnit(item);
    const quantityValue = Number(nextQuantity);

    if (!logId) return false;
    if (!isTrackingFoodQuantityPhysicallyValid(item, unit, quantityValue)) {
      notify("error", "Ingresá una cantidad válida para este alimento.");
      return false;
    }

    try {
      // No enviamos mealId: PATCH conserva el mealId persistido y sólo escala
      // la cantidad/snapshot nutricional del FoodLog existente.
      await updateMutation.mutateAsync({
        logId,
        date,
        cantidad: quantityValue,
        unidad: unit,
      });
      await trackingQuery.refetch();
      await Promise.resolve(onChanged?.());
      notify("success", `${trackingItemName(item)} actualizado a ${formatNumber(quantityValue, 1)} ${unit}.`);
      return true;
    } catch (error) {
      notify("error", error?.message || "No se pudo actualizar la cantidad.");
      return false;
    }
  }

  function requestBackToProposal() {
    if (
      !trackedItems.length &&
      !drafts.length
    ) {
      onBack?.();
      return;
    }

    setReturnConfirmOpen(true);
  }

  async function confirmBackToProposal() {
    if (saving) return;

    setSaving(true);

    try {
      /*
        Los mealId que usamos para Por meta
        son exclusivos de este flujo.
        Por eso podemos borrar solamente
        estos registros.
      */
      for (const item of trackedItems) {
        const logId =
          item?.id || item?._id;

        if (!logId) continue;

        await deleteMutation.mutateAsync({
          logId,
          date,
        });
      }

      setMealDrafts([]);

      await trackingQuery.refetch();

      await Promise.resolve(
        onChanged?.()
      );

      setReturnConfirmOpen(false);

      notify(
        "success",
        "Volviste a la propuesta original."
      );

      onBack?.();
    } catch (error) {
      notify(
        "error",
        error?.message ||
          "No se pudo volver a la propuesta."
      );
    } finally {
      setSaving(false);
    }
  }

  const draftsReady =
    drafts.length > 0 &&
    trackingDraftsReadyToConfirm(
      drafts
    );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-4">
      <section className="relative overflow-hidden rounded-[20px] border border-emerald-400/30 bg-[radial-gradient(circle_at_100%_0,rgba(34,197,94,.16),transparent_34%),radial-gradient(circle_at_0_0,rgba(20,184,166,.12),transparent_38%),linear-gradient(145deg,#07141b_0%,#09131a_58%,#071017_100%)] p-2.5 shadow-[0_18px_50px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.035)] sm:p-3.5">

        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/[0.11] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,.09)]">
              <Target size={9} strokeWidth={2.6} /> Por meta
            </span>

            <h4 className="mt-1.5 text-[17px] font-black leading-tight text-white">
              Objetivo del {mealName}
            </h4>

            <p className="mt-0.5 text-[9px] font-bold text-zinc-500 sm:text-[10px]">
              Registrá lo que realmente comas y comparalo con esta meta.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <TargetMetric
            label="KCAL"
            value={formatNumber(
              safeTarget.kcal,
              0
            )}
            tone="kcal"
            icon={Flame}
          />

          <TargetMetric
            label="Proteína"
            value={`${formatNumber(
              safeTarget.proteina,
              0
            )} g`}
            tone="protein"
            icon={Dumbbell}
          />

          <TargetMetric
            label="Carbohidratos"
            value={`${formatNumber(
              safeTarget.carbs,
              0
            )} g`}
            tone="carbs"
            icon={Wheat}
          />

          <TargetMetric
            label="Grasas"
            value={`${formatNumber(
              safeTarget.grasas,
              0
            )} g`}
            tone="fat"
            icon={Droplet}
          />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wide text-zinc-300">
              Consumido hasta ahora
            </span>

            <strong className="text-[13px] font-black text-white">
              {formatNumber(
                trackedTotals.kcal,
                0
              )}{" "}
              /{" "}
              {formatNumber(
                safeTarget.kcal,
                0
              )} kcal
            </strong>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,.6)]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,#18d3ac_0%,#56f49a_46%,#c7ff3f_100%)] shadow-[0_0_12px_rgba(163,255,71,.65)] transition-all"
              style={{
                width: `${progressWidth}%`,
              }}
            />
          </div>

          <div className="mt-1 text-right text-[9px] font-black text-zinc-400">
            {progress}%
          </div>
        </div>

        {drafts.length ? (
          <div className="mt-3 rounded-xl border border-[#D4AF37]/40 bg-[radial-gradient(circle_at_100%_0,rgba(212,175,55,.16),transparent_42%),linear-gradient(135deg,rgba(212,175,55,.12),rgba(212,175,55,.025))] p-2.5 shadow-[inset_0_1px_0_rgba(255,232,163,.035)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#FFE16B]">
                Total proyectado
                <Info size={9} className="text-zinc-400" />
              </span>
              <strong className="text-[12px] font-black text-white">
                {formatNumber(projectedTotals.kcal, 0)} / {formatNumber(safeTarget.kcal, 0)} kcal
              </strong>
            </div>
            <div className="mt-2 grid grid-cols-4 text-center">
              <ProjectedMetric value={formatNumber(projectedTotals.kcal, 0)} label="kcal" tone="kcal" icon={Flame} />
              <ProjectedMetric value={`${formatNumber(projectedTotals.proteina, 0)} g`} label="Proteína" tone="protein" icon={Dumbbell} divided />
              <ProjectedMetric value={`${formatNumber(projectedTotals.carbs, 0)} g`} label="Carbohidratos" tone="carbs" icon={Wheat} divided />
              <ProjectedMetric value={`${formatNumber(projectedTotals.grasas, 0)} g`} label="Grasas" tone="fat" icon={Droplet} divided />
            </div>
          </div>
        ) : null}

        {message ? (
          <div
            className={`mt-3 rounded-xl border px-2.5 py-2 text-[10px] font-bold ${
              message.type === "error"
                ? "border-rose-300/25 bg-rose-300/10 text-rose-100"
                : message.type === "success"
                  ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                  : "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {trackedItems.length ? (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <strong className="text-[10px] font-black uppercase tracking-wide text-zinc-300">
                Alimentos registrados
              </strong>

              <span className="text-[8px] font-bold text-emerald-300">
                Guardado
              </span>
            </div>

            <div className="grid gap-1.5">
              {trackedItems.map(
                (item, index) => (
                  <TrackedFoodRow
                    key={
                      item.id ||
                      item._id ||
                      index
                    }
                    item={item}
                    deleting={
                      deleteMutation.isPending
                    }
                    updating={updateMutation.isPending}
                    onUpdate={(nextQuantity) => updateTrackedItemQuantity(item, nextQuantity)}
                    onDelete={() =>
                      deleteTrackedItem(
                        item
                      )
                    }
                  />
                )
              )}
            </div>
          </div>
        ) : null}

        {drafts.length ? (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <strong className="text-[9px] font-black uppercase tracking-wide text-zinc-400">
                Alimentos en tu {mealName}
              </strong>

              <span className="text-[9px] font-bold text-[#FFE8A3]">
                Todavía no guardado
              </span>
            </div>

            <div className="grid gap-1.5">
              {drafts.map((draft) => (
                <DraftFoodRow
                  key={draft.id}
                  draft={draft}
                  disabled={
                    calculating ||
                    saving
                  }
                  canAuto={
                    canAutoCalculate
                  }
                  onQuantityChange={(
                    value
                  ) =>
                    updateDraftQuantity(
                      draft.id,
                      value
                    )
                  }
                  onToggle={() =>
                    toggleDraftMode(
                      draft.id
                    )
                  }
                  onRemove={() =>
                    removeDraft(
                      draft.id
                    )
                  }
                />
              ))}
            </div>
          </div>
        ) : null}

        {!trackedItems.length &&
        !drafts.length ? (
          <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-center">
            <strong className="text-sm font-black text-zinc-300">
              Todavía no registraste alimentos
            </strong>

            <p className="mt-1 text-xs font-bold text-zinc-500">
              Agregá lo que realmente comiste.
            </p>
          </div>
        ) : null}

        {(trackedItems.length ||
          drafts.length) ? (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/25 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]">
            <span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">
              Restante por consumir
            </span>

            {remainingProjected.kcal >= 0 ? (
              <div className="mt-1.5 grid grid-cols-[1.25fr_repeat(3,1fr)] items-center">
                <strong className="text-lg font-black text-white">
                  {formatNumber(Math.max(0, remainingProjected.kcal), 0)} kcal
                </strong>
                <RemainingMetric value={formatNumber(Math.max(0, remainingProjected.proteina), 0)} tone="protein" icon={Dumbbell} label="P" />
                <RemainingMetric value={formatNumber(Math.max(0, remainingProjected.carbs), 0)} tone="carbs" icon={Wheat} label="C" />
                <RemainingMetric value={formatNumber(Math.max(0, remainingProjected.grasas), 0)} tone="fat" icon={Droplet} label="G" />
              </div>
            ) : (
              <>
                <strong className="mt-1 block text-base font-black text-rose-200">
                  +
                  {formatNumber(
                    Math.abs(
                      remainingProjected.kcal
                    ),
                    0
                  )}{" "}
                  kcal
                </strong>

                <p className="mt-0.5 text-[9px] font-bold text-rose-200/70">
                  Exceso sobre la meta de esta comida.
                </p>
              </>
            )}
          </div>
        ) : null}

        <div className="mt-3 grid gap-1.5">

          <button
            type="button"
            onClick={openFoodPicker}
            disabled={saving}
            className="relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-xl border border-emerald-200/35 bg-[linear-gradient(110deg,#19cda7_0%,#4ceaa0_54%,#a9f65a_100%)] text-xs font-black text-[#032019] shadow-[0_7px_24px_rgba(45,212,191,.20),inset_0_1px_0_rgba(255,255,255,.45)] disabled:opacity-50"
          >
            <Plus size={17} />
            Agregar alimento
            <ChevronRight size={16} className="absolute right-3" />
          </button>

          <button
            type="button"
            onClick={calculateRemaining}
            disabled={
              calculating ||
              saving
            }
            className="relative inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/55 bg-[linear-gradient(110deg,rgba(212,175,55,.20),rgba(96,76,15,.15))] text-[#FFE88B] shadow-[0_7px_22px_rgba(212,175,55,.10),inset_0_1px_0_rgba(255,232,163,.08)] disabled:opacity-50"
          >
            {calculating ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Sparkles size={17} />
            )}

            <span className="flex flex-col items-center leading-tight">
              <strong className="text-xs">
                {calculating ? "Calculando..." : "Completar restante"}
              </strong>
              {!calculating ? (
                <small className="mt-0.5 text-[7px] font-bold text-zinc-500">
                  Agrega automáticamente alimentos para alcanzar tu meta
                </small>
              ) : null}
            </span>
            {!calculating ? <ChevronRight size={16} className="absolute right-3" /> : null}
          </button>

          {drafts.length ? (
            <button
              type="button"
              onClick={confirmDrafts}
              disabled={
                !draftsReady ||
                saving
              }
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/15 text-xs font-black text-emerald-100 disabled:opacity-40"
            >
              {saving ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <CheckCircle2
                  size={17}
                />
              )}

              Confirmar y registrar
            </button>
          ) : null}


{!nativeTarget ? (
  <button
    type="button"
    onClick={
      requestBackToProposal
    }
    disabled={saving}
    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] text-[10px] font-black text-zinc-400 disabled:opacity-50"
  >
    Volver a la propuesta
  </button>
) : null}

        </div>
      </section>

      {pickerOpen ? (
        <TargetFoodPicker
          search={search}
          setSearch={setSearch}
          results={foodResults}
          loading={foodsLoading}
          error={foodSearchError}
          selectedFood={selectedFood}
          setSelectedFood={
            setSelectedFood
          }
          quantity={quantity}
          setQuantity={setQuantity}
          quantityMode={quantityMode}
          setQuantityMode={setQuantityMode}
          canAuto={canAutoCalculate}
          onClose={closeFoodPicker}
          onAdd={
            addSelectedFoodToDraft
          }
        />
      ) : null}

      {returnConfirmOpen ? (
        <ReturnProposalConfirm
          trackedCount={
            trackedItems.length
          }
          draftCount={drafts.length}
          saving={saving}
          onCancel={() =>
            setReturnConfirmOpen(
              false
            )
          }
          onConfirm={
            confirmBackToProposal
          }
        />
      ) : null}
    </div>
  );
}


function TargetMetric({
  label,
  value,
  tone = "kcal",
  icon: Icon,
}) {
  const tones = {
    kcal: "text-[#FFE16B]",
    protein: "text-emerald-300",
    carbs: "text-cyan-300",
    fat: "text-violet-300",
  };

  return (
    <div className="rounded-xl border border-white/[0.09] bg-black/25 px-1 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
      {Icon ? <Icon size={13} className={`mx-auto mb-1 ${tones[tone]}`} strokeWidth={2.5} /> : null}
      <strong className={`block text-[15px] font-black leading-none ${tones[tone]}`}>
        {value}
      </strong>
      <small className="mt-1 block truncate px-0.5 text-[8px] font-bold tracking-tight text-zinc-400">
        {label}
      </small>
    </div>
  );
}

function ProjectedMetric({ value, label, tone = "kcal", icon: Icon, divided = false }) {
  const tones = {
    kcal: "text-[#FFE16B]",
    protein: "text-emerald-300",
    carbs: "text-cyan-300",
    fat: "text-violet-300",
  };

  return (
    <div className={divided ? "border-l border-white/[0.08]" : ""}>
      <div className="flex items-center justify-center gap-1">
        {Icon ? <Icon size={12} className={tones[tone]} strokeWidth={2.5} /> : null}
        <strong className="block text-[13px] font-black text-white">
        {value}
        </strong>
      </div>
      <small className="mt-0.5 block text-[8px] font-bold text-zinc-400">{label}</small>
    </div>
  );
}

function RemainingMetric({ value, label, tone, icon: Icon }) {
  const tones = {
    protein: "text-emerald-300",
    carbs: "text-cyan-300",
    fat: "text-violet-300",
  };

  return (
    <div className="flex items-center justify-center gap-1 border-l border-white/[0.08] text-[10px] font-black text-zinc-200">
      {Icon ? <Icon size={11} className={tones[tone]} strokeWidth={2.5} /> : null}
      <span>{label} {value} g</span>
    </div>
  );
}


function DraftFoodRow({
  draft,
  disabled,
  canAuto,
  onQuantityChange,
  onToggle,
  onRemove,
}) {
  const automatic =
    isTrackingDraftAutomatic(draft);

  const calculated =
    isTrackingDraftCalculated(draft);

  const hasQuantity =
    hasTrackingDraftQuantity(draft);

  const nutrition =
    trackingDraftNutritionTotals(
      draft
    );

  const image =
    getFoodImageUrl(
      draft.food || draft
    );

  return (
    <article className="flex items-center gap-2.5 rounded-xl border border-white/[0.10] bg-[#071018]/90 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">

      {image ? (
        <img
          src={image}
          alt=""
          className="h-11 w-11 shrink-0 rounded-[10px] border border-white/10 object-cover"
        />
      ) : (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-white/10 bg-white/[0.06] text-zinc-500">
          🍽️
        </div>
      )}

      <div className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] font-black text-white">
          {draft.name}
        </strong>

        <span className="mt-1 block text-[9.5px] font-bold leading-snug text-zinc-400">
          {hasQuantity
            ? `${formatNumber(
                nutrition.kcal,
                0
              )} kcal · P ${formatNumber(
                nutrition.proteina,
                1
              )} · C ${formatNumber(
                nutrition.carbs,
                1
              )} · G ${formatNumber(
                nutrition.grasas,
                1
              )}`
            : "Cantidad pendiente"}
        </span>

        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          className={`mt-1.5 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${
            automatic
              ? "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFE8A3]"
              : "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
          }`}
        >
          {automatic
            ? calculated
              ? "AUTO · calculado"
              : "AUTO"
            : "FIJO"}
        </button>

        {!canAuto ? <span className="sr-only">Cantidad automática no disponible</span> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">

        <label className="flex h-8 items-center rounded-lg border border-white/10 bg-black/30 px-1.5">
          <input
            value={draft.quantity}
            inputMode="decimal"
            step={
              trackingFoodRequiresWholeQuantity(
                draft.food || draft,
                draft.unit
              )
                ? "1"
                : "any"
            }
            placeholder="—"
            disabled={disabled}
            onChange={(event) =>
              onQuantityChange(
                event.target.value
              )
            }
            className="w-11 bg-transparent py-1.5 text-right text-[12px] font-black text-white outline-none"
          />

          <span className="ml-1 text-[9px] font-bold text-[#FFE8A3]">
            {draft.unit || "g"}
          </span>
          {canAuto ? <ChevronDown size={11} className="ml-1 text-zinc-500" /> : null}
        </label>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Eliminar ${draft.name}`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-rose-300/30 hover:text-rose-200"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}


function TrackedFoodRow({
  item,
  deleting,
  updating,
  onDelete,
  onUpdate,
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(() => String(trackingItemQuantity(item)));
  const totals =
    normalizeTotals(item);

  const image =
    getFoodImageUrl(
      item?.alimentoSnapshot ||
      item?.food ||
      item
    );

  return (
    <article className="flex items-center gap-2.5 rounded-xl border border-white/[0.10] bg-[#071018]/90 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">

      {image ? (
        <img
          src={image}
          alt=""
          className="h-11 w-11 shrink-0 rounded-[10px] border border-white/10 object-cover"
        />
      ) : (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-white/10 bg-white/[0.06]">
          🍽️
        </div>
      )}

      <div className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] font-black text-white">
          {trackingItemName(item)}
        </strong>

        <span className="mt-1 block text-[9.5px] font-bold leading-snug text-zinc-400">
          {formatNumber(
            totals.kcal,
            0
          )} kcal · P{" "}
          {formatNumber(
            totals.proteina,
            1
          )} · C{" "}
          {formatNumber(
            totals.carbs,
            1
          )} · G{" "}
          {formatNumber(
            totals.grasas,
            1
          )}
        </span>

        {editing ? (
          <label className="mt-1 inline-flex items-center rounded-lg border border-white/10 bg-black/30 px-1.5">
            <input
              value={quantity}
              inputMode="decimal"
              step={trackingFoodRequiresWholeQuantity(item, trackingItemUnit(item)) ? "1" : "any"}
              disabled={updating}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-14 bg-transparent py-1 text-right text-[12px] font-black text-white outline-none"
              aria-label={`Cantidad de ${trackingItemName(item)}`}
            />
            <span className="ml-1 text-[9px] font-bold text-[#FFE8A3]">{trackingItemUnit(item)}</span>
          </label>
        ) : (
          <small className="mt-1 block text-[9px] font-black text-emerald-300">
            {formatNumber(trackingItemQuantity(item), 1)} {trackingItemUnit(item)}
            {item?.quantitySource ? ` · ${item.quantitySource === "automatic" ? "AUTO" : "MANUAL"}` : ""}
          </small>
        )}
      </div>

      {editing ? (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={updating}
            onClick={async () => {
              if (await onUpdate?.(quantity)) setEditing(false);
            }}
            aria-label={`Guardar cantidad de ${trackingItemName(item)}`}
            className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
          >
            {updating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              setQuantity(String(trackingItemQuantity(item)));
              setEditing(false);
            }}
            aria-label="Cancelar edición"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={deleting || updating}
            onClick={() => {
              setQuantity(String(trackingItemQuantity(item)));
              setEditing(true);
            }}
            aria-label={`Editar cantidad de ${trackingItemName(item)}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.08] bg-black/25 px-2 text-[11px] font-black text-zinc-100"
          >
            {formatNumber(trackingItemQuantity(item), 1)} {trackingItemUnit(item)}
            <ChevronDown size={11} className="text-zinc-500" />
          </button>
          <button
            type="button"
            disabled={deleting || updating}
            onClick={onDelete}
            aria-label={`Eliminar ${trackingItemName(item)}`}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </article>
  );
}


function TargetFoodPicker({
  search,
  setSearch,
  results,
  loading,
  error,
  selectedFood,
  setSelectedFood,
  quantity,
  setQuantity,
  quantityMode,
  setQuantityMode,
  canAuto,
  onClose,
  onAdd,
}) {
  const unit =
    selectedFood?.unidad ||
    selectedFood?.unit ||
    "g";

  const quantitySelection = resolveTrackingFoodPickerQuantity({
    mode: quantityMode,
    quantity,
    canAuto,
  });
  const automatic = quantitySelection.automatic;

  const wholeQuantity = selectedFood
    ? trackingFoodRequiresWholeQuantity(selectedFood, unit)
    : false;

  const normalizedUnit = String(unit || "").trim().toLowerCase();
  const quantityStep = wholeQuantity
    ? 1
    : ["g", "gr", "gramos", "ml", "mililitros"].includes(normalizedUnit)
      ? 10
      : 1;
  const defaultManualQuantity = selectedFood
    ? defaultTrackingFoodManualQuantity(selectedFood, unit)
    : 100;

  function selectFoodAsManual(food) {
    const nextUnit = food?.unidad || food?.unit || "g";
    setSelectedFood(food);
    setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);
    setQuantity(String(defaultTrackingFoodManualQuantity(food, nextUnit)));
  }

  function enableManualQuantity() {
    setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);
    if (String(quantity).trim() === "") setQuantity(String(defaultManualQuantity));
  }

  function adjustQuantity(direction) {
    setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);
    const current = Number(quantity);
    const base = Number.isFinite(current) && current > 0
      ? current
      : defaultManualQuantity;
    const minimum = wholeQuantity ? 1 : 0.01;
    const next = Math.max(minimum, base + (direction * quantityStep));
    setQuantity(String(Math.round(next * 100) / 100));
  }

  let preview = null;
  if (selectedFood && !automatic && quantitySelection.hasQuantity) {
    try {
      preview = buildMenuItemSnapshot(selectedFood, Number(quantity), unit);
    } catch {
      preview = null;
    }
  }

  return (
    <section className="fixed inset-0 z-[140] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="target-food-picker-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar selector" />

      <div className="relative flex max-h-[94dvh] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[1.7rem] border border-white/10 bg-[linear-gradient(145deg,#101821_0%,#07111b_48%,#05080d_100%)] shadow-[0_-24px_70px_rgba(0,0,0,.72)] sm:max-h-[90dvh] sm:rounded-[1.7rem]">
        <div className="mx-auto mt-2 h-1 w-14 shrink-0 rounded-full bg-white/20 sm:mt-3" aria-hidden="true" />

        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="min-w-0 flex-1">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-300/10 px-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-teal-200">
              <Target size={14} /> Por meta
            </span>
            <h3 id="target-food-picker-title" className="mt-2 text-[1.45rem] font-black leading-tight text-white">Agregar alimento</h3>
            <p className="mt-1 text-[11px] font-bold leading-snug text-slate-400">La cantidad queda manual y fija por defecto. Podés cambiarla a automática.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D4AF37]/30 bg-white/[0.055] text-white"
            aria-label="Cerrar selector"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-5 sm:pb-5">
          <section className="rounded-[1.15rem] border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h4 className="text-lg font-black text-white">Buscar alimento</h4>
              <p className="mt-0.5 text-[11px] font-bold text-slate-500">Se agregará dentro de la meta de esta comida.</p>
            </div>
            <span className="rounded-full border border-teal-300/25 bg-teal-300/10 px-2.5 py-1 text-[10px] font-black text-teal-100">Agregar a la comida</span>
          </div>

          <label className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#050a0f] px-3 focus-within:border-teal-300/40">
            <Search
              size={19}
              className="shrink-0 text-zinc-500"
            />

            <input
              autoFocus
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedFood(null);
                setQuantity("");
                setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);
              }}
              placeholder="Buscar alimento"
              className="min-w-0 flex-1 bg-transparent text-base font-black text-white outline-none placeholder:text-zinc-600"
            />
            {loading ? <Loader2 size={16} className="shrink-0 animate-spin text-teal-300" /> : null}
          </label>

          {error ? (
              <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs font-bold text-rose-100" role="alert">
                {error}
              </div>
          ) : null}

          {!selectedFood && !loading && results.length ? (
            <div className="mt-3">
              <div className="max-h-[192px] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.08] bg-white/[0.025] [scrollbar-color:rgba(45,212,191,.45)_rgba(255,255,255,.04)] [scrollbar-width:thin]" aria-label="Resultados de alimentos">
              {results.map(
                (food) => {
                  const id =
                    food.id ||
                    food._id;

                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => selectFoodAsManual(food)}
                      className="group flex min-h-16 w-full items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left last:border-b-0 hover:bg-teal-300/[0.07] focus-visible:bg-teal-300/[0.07] focus-visible:outline-none"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        {getFoodImageUrl(food) ? (
                          <img src={getFoodImageUrl(food)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Apple size={18} className="text-zinc-500" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-[13px] font-black text-white">
                          {food.nombre ||
                            food.name}
                        </strong>

                        <span className="mt-0.5 block truncate text-[10px] font-bold text-zinc-500">
                          {formatNumber(food.kcal, 1)} kcal · P {formatNumber(food.proteina ?? food.protein, 1)} · C {formatNumber(food.carbs, 1)} · G {formatNumber(food.grasas ?? food.fat, 1)}
                        </span>
                      </div>

                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-teal-300/25 bg-teal-300/10 text-teal-100 transition group-hover:border-teal-200/50 group-hover:bg-teal-300/20">
                        <Plus size={16} />
                      </span>
                    </button>
                  );
                }
              )}
              </div>

              {results.length > 3 ? (
                <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-black text-teal-200/75">
                  Deslizá dentro de la lista para ver {results.length - 3} resultados más
                  <ChevronDown size={13} aria-hidden="true" />
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedFood ? (
            <div className="mt-3 rounded-[1.05rem] border border-teal-300/25 bg-teal-300/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    {getFoodImageUrl(selectedFood) ? (
                      <img src={getFoodImageUrl(selectedFood)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Apple size={18} className="text-zinc-500" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-teal-300">Alimento seleccionado</span>
                    <strong className="mt-0.5 block truncate text-sm font-black text-white">{selectedFood.nombre || selectedFood.name}</strong>
                    <span className="mt-1 block truncate text-[11px] font-bold text-slate-400">
                      {formatNumber(selectedFood.kcal, 1)} kcal · P {formatNumber(selectedFood.proteina ?? selectedFood.protein, 1)} · C {formatNumber(selectedFood.carbs, 1)} · G {formatNumber(selectedFood.grasas ?? selectedFood.fat, 1)}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => {
                  setSelectedFood(null);
                  setQuantity("");
                  setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);
                }} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-slate-300" aria-label="Cambiar alimento">
                  <X size={15} />
                </button>
              </div>

              <div className="mt-3">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Cantidad</span>
                {automatic && canAuto ? (
                  <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3]">
                    <Sparkles size={15} /> ZumaFit calculará la cantidad al completar el restante.
                  </div>
                ) : (
                  <div className="grid min-h-12 grid-cols-[44px_minmax(0,1fr)_44px] overflow-hidden rounded-xl border border-white/10 bg-[#050a0f] shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
                    <button type="button" onClick={() => adjustQuantity(-1)} className="grid place-items-center border-r border-white/10 text-slate-300" aria-label="Restar cantidad">
                      <Minus size={16} />
                    </button>
                    <span className="flex min-w-0 items-center">
                      <input
                        value={quantity}
                        onChange={(event) => {
                          setQuantityMode(TRACKING_PICKER_QUANTITY_MANUAL);
                          setQuantity(event.target.value);
                        }}
                        inputMode="decimal"
                        className="min-w-0 flex-1 bg-transparent px-2 text-center text-base font-black text-white outline-none"
                        aria-label={`Cantidad de ${selectedFood.nombre || selectedFood.name}`}
                      />
                      <span className="shrink-0 pr-3 text-[13px] font-black text-[#FFE8A3]">{unit}</span>
                    </span>
                    <button type="button" onClick={() => adjustQuantity(1)} className="grid place-items-center border-l border-white/10 text-slate-300" aria-label="Sumar cantidad">
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </div>

              {preview ? (
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-black">
                  <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[#FFD75E]">{formatNumber(preview.kcal, 1)} kcal</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-1 text-emerald-200">P {formatNumber(preview.proteina, 1)} g</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-1 text-cyan-200">C {formatNumber(preview.carbs, 1)} g</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-1 text-amber-200">G {formatNumber(preview.grasas, 1)} g</span>
                </div>
              ) : null}

              <fieldset className="mt-3 grid gap-2" aria-label="Modo de cantidad">
                <button
                  type="button"
                  onClick={enableManualQuantity}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-[13px] font-black ${!automatic ? "border-teal-300/35 bg-teal-300/10 text-teal-100" : "border-white/10 bg-black/15 text-slate-300"}`}
                  aria-pressed={!automatic}
                >
                  <span className={`h-4 w-4 shrink-0 rounded-full border p-[3px] ${!automatic ? "border-teal-200" : "border-white/25"}`}>
                    <span className={`block h-full w-full rounded-full ${!automatic ? "bg-teal-300" : ""}`} />
                  </span>
                  <span>
                    <span className="block">Cantidad manual / fija</span>
                    <small className="mt-0.5 block text-[10px] font-bold text-slate-400">Se conservará exactamente al calcular el restante.</small>
                  </span>
                </button>

                {canAuto ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuantityMode(TRACKING_PICKER_QUANTITY_AUTOMATIC);
                      setQuantity("");
                    }}
                    className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-[13px] font-black ${automatic ? "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]" : "border-white/10 bg-black/15 text-slate-300"}`}
                    aria-pressed={automatic}
                  >
                    <span className={`h-4 w-4 shrink-0 rounded-full border p-[3px] ${automatic ? "border-[#FFE070]" : "border-white/25"}`}>
                      <span className={`block h-full w-full rounded-full ${automatic ? "bg-[#FFD75E]" : ""}`} />
                    </span>
                    <span>
                      <span className="block">Cantidad automática</span>
                      <small className="mt-0.5 block text-[10px] font-bold text-slate-400">ZumaFit propondrá la cantidad al completar la comida.</small>
                    </span>
                  </button>
                ) : null}
              </fieldset>
            </div>
          ) : null}
          </section>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/[0.08] bg-[#080d13] p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black text-zinc-300"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!selectedFood}
            onClick={onAdd}
            className="min-h-11 rounded-xl bg-gradient-to-r from-[#facc15] to-[#f5d76e] text-sm font-black text-black shadow-[0_14px_30px_rgba(212,175,55,.2)] disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400 disabled:opacity-60 disabled:shadow-none"
          >
            <span className="inline-flex items-center gap-1.5"><Plus size={15} /> Agregar</span>
          </button>
        </footer>
      </div>
    </section>
  );
}


function ReturnProposalConfirm({
  trackedCount,
  draftCount,
  saving,
  onCancel,
  onConfirm,
}) {
  return (
    <section className="fixed inset-0 z-[150] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">

      <div className="w-full max-w-sm rounded-3xl border border-[#D4AF37]/25 bg-[#0a121a] p-5 shadow-2xl">

        <span className="text-[10px] font-black uppercase tracking-wide text-[#FFE8A3]">
          Volver a propuesta
        </span>

        <h3 className="mt-2 text-xl font-black text-white">
          ¿Descartar lo registrado?
        </h3>

        <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-400">
          {trackedCount > 0
            ? `Tenés ${trackedCount} alimento${
                trackedCount === 1
                  ? ""
                  : "s"
              } registrado${
                trackedCount === 1
                  ? ""
                  : "s"
              } en esta comida.`
            : "Todavía no confirmaste alimentos."}
        </p>

        {draftCount > 0 ? (
          <p className="mt-2 text-xs font-bold text-zinc-500">
            También se descartará el borrador actual.
          </p>
        ) : null}

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="min-h-11 rounded-xl border border-rose-300/25 bg-rose-300/10 text-sm font-black text-rose-100 disabled:opacity-50"
          >
            {saving
              ? "Descartando..."
              : "Descartar y volver"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}
