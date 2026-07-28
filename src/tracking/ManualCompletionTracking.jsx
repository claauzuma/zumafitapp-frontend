import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { formatNumber } from "../nutricion/nutricionUtils.js";
import { calculateTrackingQuantities } from "./trackingApi.js";
import { manualDayStatusText, nutritionTotals } from "./manualDayCompletion.js";
import {
  buildTrackingQuantityReview,
  trackingQuantityCaloriePrecisionKind,
  trackingQuantityInvalidFoods,
  trackingQuantityInvalidFoodsMessage,
  trackingQuantitySecondaryMacroLimitations,
} from "./trackingQuantityReview.js";
import {
  buildTrackingQuantityCalculationRequest,
  hasTrackingDraftQuantity,
  isTrackingFoodQuantityPhysicallyValid,
  isTrackingDraftAutomatic,
  isTrackingDraftCalculated,
  normalizeTrackingQuantityMode,
  TRACKING_QUANTITY_MODE_CALORIE_FILL,
  TRACKING_QUANTITY_MODE_OPTIONS,
  trackingDraftCalculationPayload,
  trackingDraftProposals,
  trackingDraftsQuantityMode,
  trackingFoodRequiresWholeQuantity,
  updateTrackingDraftsQuantityMode,
  updateTrackingFoodDraftQuantity,
} from "./trackingQuantityDrafts.js";

function useDialogKeyboard(panelRef, { onClose, disabled = false } = {}) {
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);
  onCloseRef.current = onClose;
  disabledRef.current = disabled;

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panelRef.current?.querySelector("[data-dialog-initial-focus]:not(:disabled), button:not(:disabled), input:not(:disabled)");
    (first || panelRef.current)?.focus?.();

    function onKeyDown(event) {
      if (event.key === "Escape" && !disabledRef.current) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.tabIndex >= 0);
      if (!focusable.length) return;
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (openerRef.current?.isConnected) openerRef.current.focus?.();
    };
  }, [panelRef]);
}

function statusTone(status = "") {
  if (status === "exceeded") return "is-exceeded";
  if (status === "reached" || status === "near") return "is-reached";
  if (status === "missing_target") return "is-missing";
  return "";
}

function macroItems(progress = {}) {
  const consumed = progress.trackedConsumed || {};
  const available = progress.available || {};
  return [
    { key: "proteina", label: "Proteína", short: "P", consumed: consumed.proteina, target: available.proteina },
    { key: "carbs", label: "Carbohidratos", short: "C", consumed: consumed.carbs, target: available.carbs },
    { key: "grasas", label: "Grasas", short: "G", consumed: consumed.grasas, target: available.grasas },
  ].filter((item) => progress?.configured?.[item.key]);
}

export function ManualCompletionTrackingCard({
  progress,
  organizationCount = 0,
  pendingTotals = {},
  projectedTotals = {},
}) {
  if (!progress) return null;
  const macros = macroItems(progress);
  const availableKcal = Math.max(0, Number(progress.available?.kcal) || 0);
  const registeredKcal = Math.max(0, Number(progress.trackedConsumed?.kcal) || 0);
  const remainingKcal = Number(progress.remaining?.kcal) || 0;
  const mealCount = Math.max(0, Number(organizationCount) || 0);
  const registeredPercent = availableKcal > 0
    ? Math.max(0, Math.round((registeredKcal / availableKcal) * 100))
    : 0;
  const ringPercent = Math.min(100, registeredPercent);
  const pendingKcal = Number(pendingTotals?.kcal) || 0;
  const hasPendingKcalChange = Math.abs(pendingKcal) > 0.5;

  return (
    <section className={`td-manualCompletionCard ${statusTone(progress.status)}`}>
      <div className="td-manualCompletionTop">
        <span className="td-manualCompletionIcon" aria-hidden="true">
          <Target size={23} strokeWidth={2.2} />
        </span>

        <div className="td-manualCompletionCopy">
          <span className="td-cardEyebrow">Modo del día</span>
          <h2>Resto del día por tu cuenta</h2>
          <p>{manualDayStatusText(progress)}</p>
          {progress.configured?.kcal ? (
            <small className="td-manualCompletionConsumedLine">
              {formatNumber(registeredKcal, 0)} de {formatNumber(availableKcal, 0)} kcal registradas
            </small>
          ) : null}
          {hasPendingKcalChange ? (
            <small className="td-manualCompletionPendingLine" role="status">
              {pendingKcal > 0 ? "+ " : "− "}
              {formatNumber(Math.abs(pendingKcal), 0)} kcal por confirmar · Total diario proyectado {formatNumber(projectedTotals?.kcal, 0)} kcal
            </small>
          ) : null}
        </div>

        {progress.configured?.kcal ? (
          <div className="td-manualCompletionStatus">
            <span className="td-manualCompletionRemaining">
              <small>{remainingKcal < 0 ? "Excedente" : "Restante actual"}</small>
              <strong>{formatNumber(Math.abs(remainingKcal), 0)} kcal</strong>
            </span>
            <span
              className="td-manualCompletionRing"
              style={{ "--td-progress": `${ringPercent * 3.6}deg` }}
              aria-label={`${registeredPercent}% del objetivo disponible`}
            >
              <span>
                <strong>{registeredPercent}%</strong>
                <small>del objetivo</small>
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {progress.configured?.kcal ? (
        <div
          className="td-manualCompletionBar"
          role="progressbar"
          aria-label="Calorías registradas respecto del objetivo disponible"
          aria-valuemin="0"
          aria-valuemax={Math.max(1, Math.round(availableKcal))}
          aria-valuenow={Math.min(Math.max(0, Math.round(registeredKcal)), Math.max(1, Math.round(availableKcal)))}
        >
          <span style={{ width: `${availableKcal > 0 ? Math.min(100, registeredKcal / availableKcal * 100) : 0}%` }} />
        </div>
      ) : (
        <div className="td-manualCompletionMissing">
          Podés seguir registrando alimentos. Configurá un objetivo diario para ver el restante.
        </div>
      )}

      {macros.length ? (
        <div className="td-manualCompletionMacros" aria-label="Macros registradas respecto del objetivo disponible">
          {macros.map((item) => {
            const target = Math.max(0, Number(item.target) || 0);
            const consumed = Math.max(0, Number(item.consumed) || 0);
            const percent = target > 0 ? Math.min(100, consumed / target * 100) : 0;
            return (
              <article className={item.key === "carbs" ? "is-carbs" : item.key === "grasas" ? "is-grasas" : undefined} key={item.key}>
                <span className="td-manualCompletionMacroTop">
                  <small>{item.short}</small>
                  <strong>
                    {formatNumber(consumed, 1)} <i aria-hidden="true">/</i> {formatNumber(target, 1)} g
                  </strong>
                </span>
                <span className="td-manualCompletionMacroBar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </span>
                <span className="sr-only">{item.label}: registrado sobre objetivo disponible</span>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="td-manualCompletionNoMacros">No hay objetivos de macros configurados.</p>
      )}

      {mealCount > 1 ? (
        <div className="td-manualCompletionPlanState">
          <Sparkles size={15} aria-hidden="true" />
          Organizado en {mealCount} comidas flexibles.
        </div>
      ) : null}

      <p className="td-manualCompletionHint">
        Calculado según tu objetivo, el menú realizado, calorías libres registradas y lo que ya cargaste hoy.
      </p>
    </section>
  );
}

function foodId(food = {}) {
  return String(food.id || food._id || food.alimentoId || food.nombre || food.name || "");
}

function foodName(food = {}) {
  return food.nombre || food.name || food.Alimentos || "Alimento";
}

function proposalTotals(proposals = []) {
  return proposals.reduce((acc, proposal) => {
    const initial = Math.max(0.0001, Number(proposal.initialQuantity) || Number(proposal.quantity) || 1);
    const factor = (Number(proposal.quantity) || 0) / initial;
    const totals = nutritionTotals(proposal.generated || {});
    return {
      kcal: acc.kcal + totals.kcal * factor,
      proteina: acc.proteina + totals.proteina * factor,
      carbs: acc.carbs + totals.carbs * factor,
      grasas: acc.grasas + totals.grasas * factor,
    };
  }, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

function signedNutritionValue(value, digits = 1) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${formatNumber(number, digits)}`;
}

function macroShortLabel(macro = "") {
  const normalized = String(macro).trim().toLowerCase();
  if (["p", "protein", "proteina", "proteína"].includes(normalized)) return "P";
  if (["c", "carbs", "carbohidratos"].includes(normalized)) return "C";
  if (["g", "fat", "grasas"].includes(normalized)) return "G";
  return String(macro || "Macro");
}

export function AutoQuantityPlannerDialog({
  date,
  meal,
  target,
  configured = {},
  drafts = [],
  saving = false,
  onClose,
  onApply,
  onAddFood,
  onDraftsChange,
}) {
  const initialNeedsCalculationRef = useRef(
    drafts.some((draft) => isTrackingDraftAutomatic(draft) && !isTrackingDraftCalculated(draft))
  );
  const [workingDrafts, setWorkingDrafts] = useState(() => drafts);
  const [trackingQuantityMode, setTrackingQuantityMode] = useState(
    () => trackingDraftsQuantityMode(drafts)
  );
  const [proposals, setProposals] = useState(() => (
    initialNeedsCalculationRef.current ? [] : trackingDraftProposals(drafts, [])
  ));
  const [calculationResult, setCalculationResult] = useState(null);
  const [calculatedMode, setCalculatedMode] = useState(() => {
    const calculatedDraft = drafts.find(isTrackingDraftCalculated);
    if (!calculatedDraft) return null;
    return normalizeTrackingQuantityMode(
      calculatedDraft.calculatedWithTrackingQuantityMode,
      trackingDraftsQuantityMode(drafts)
    );
  });
  const [calculating, setCalculating] = useState(initialNeedsCalculationRef.current);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() => (
    initialNeedsCalculationRef.current
      ? ""
      : "El borrador conserva la última propuesta. Recalculá sólo si querés redistribuir el restante."
  ));
  const [interactionStatus, setInteractionStatus] = useState("");
  const [proposalManuallyEdited, setProposalManuallyEdited] = useState(false);
  const panelRef = useRef(null);
  const autoStartedRef = useRef(false);
  useDialogKeyboard(panelRef, { onClose, disabled: saving || calculating });
  const totals = useMemo(() => proposalTotals(proposals), [proposals]);
  const calculationInput = useMemo(
    () => trackingDraftCalculationPayload(workingDrafts),
    [workingDrafts]
  );
  const targetAfterFixed = Math.max(
    0,
    (Number(target?.kcal) || 0) - (Number(calculationInput.fixedTotals?.kcal) || 0)
  );
  const review = useMemo(
    () => buildTrackingQuantityReview({
      target,
      proposal: totals,
      configured,
      optimization: calculationResult?.optimization,
    }),
    [calculationResult?.optimization, configured, target, totals]
  );
  const optimization = calculationResult?.optimization || null;
  const resultMode = optimization?.policy === "tracking_calorie_fill_v1"
    ? TRACKING_QUANTITY_MODE_CALORIE_FILL
    : calculatedMode || trackingQuantityMode;
  const calorieFillResult = resultMode === TRACKING_QUANTITY_MODE_CALORIE_FILL;
  const modeNeedsRecalculation = Boolean(
    calculatedMode && calculatedMode !== trackingQuantityMode
  );
  const calorieDeficit = Math.max(0, (Number(target?.kcal) || 0) - totals.kcal);
  const calorieTolerance = calorieFillResult
    ? Math.max(0, Number(optimization?.calorieTolerance) || 1)
    : 0;
  const calorieTargetCompleted = calorieFillResult &&
    review.respectsCalorieCeiling &&
    (
      (!proposalManuallyEdited && optimization?.calorieTargetCompleted === true) ||
      calorieDeficit <= calorieTolerance + 1e-6
    );
  const maxConstraintsLimited = !calorieFillResult && optimization?.maxConstraintsLimited === true;
  const exceededRecommendedPortions = calorieFillResult &&
    !proposalManuallyEdited &&
    Array.isArray(optimization?.exceededRecommendedPortions)
    ? optimization.exceededRecommendedPortions
    : [];
  const invalidFoods = calorieFillResult
    ? trackingQuantityInvalidFoods(optimization)
    : [];
  const macroLimitations = calorieFillResult && !proposalManuallyEdited
    ? trackingQuantitySecondaryMacroLimitations(optimization, review.proteinLevel !== null)
    : [];
  const caloriePrecisionKind = calorieFillResult && !proposalManuallyEdited
    ? trackingQuantityCaloriePrecisionKind(optimization)
    : "";
  const discreteLimited = caloriePrecisionKind === "discrete";
  const granularityLimited = caloriePrecisionKind === "granularity";
  const selectedModeOption = TRACKING_QUANTITY_MODE_OPTIONS.find(
    (option) => option.value === trackingQuantityMode
  ) || TRACKING_QUANTITY_MODE_OPTIONS[0];
  const visibleWarnings = (calculationResult?.warnings || []).filter((warning) => {
    if (
      maxConstraintsLimited &&
      warning === "Las cantidades máximas configuradas para algunos alimentos limitan esta propuesta."
    ) return false;
    if (calorieFillResult && /m[aá]xim|porci[oó]n recomendada/i.test(warning)) return false;
    if (review.proteinLevel && /prote[ií]na/i.test(warning)) return false;
    if (macroLimitations.length && /macro|carbohidrato|grasa/i.test(warning)) return false;
    if (discreteLimited && /unidad(?:es)? entera/i.test(warning)) return false;
    if (granularityLimited && /granular|precisi[oó]n|paso f[ií]sico/i.test(warning)) return false;
    if (invalidFoods.length && /informaci[oó]n cal[oó]rica|kcal.*inv[aá]lid/i.test(warning)) return false;
    return true;
  });

  const replaceWorkingDrafts = useCallback((nextDrafts) => {
    setWorkingDrafts(nextDrafts);
    onDraftsChange?.(nextDrafts);
  }, [onDraftsChange]);

  const changeTrackingQuantityMode = useCallback((nextMode) => {
    const normalizedMode = normalizeTrackingQuantityMode(nextMode);
    if (normalizedMode === trackingQuantityMode) return;
    replaceWorkingDrafts(updateTrackingDraftsQuantityMode(workingDrafts, normalizedMode));
    setTrackingQuantityMode(normalizedMode);
    setError("");
    setInteractionStatus(
      normalizedMode === calculatedMode
        ? "La propuesta visible corresponde nuevamente al método seleccionado."
        : "Método cambiado. Conservamos alimentos y cantidades; tocá Recalcular restante para actualizar la propuesta."
    );
  }, [calculatedMode, replaceWorkingDrafts, trackingQuantityMode, workingDrafts]);

  const editProposalQuantity = useCallback((proposalIndex, nextQuantity) => {
    const editedProposal = proposals[proposalIndex];
    if (editedProposal && !isTrackingFoodQuantityPhysicallyValid(
      editedProposal.food || {},
      editedProposal.unit,
      nextQuantity,
      { allowEmpty: true }
    )) {
      setInteractionStatus(
        `${foodName(editedProposal.food)} se mide en unidades enteras. Ingresá un número entero.`
      );
      return;
    }
    setProposals((current) => current.map((proposal, index) => (
      index === proposalIndex
        ? { ...proposal, quantity: nextQuantity, fixed: Number(nextQuantity) > 0 }
        : proposal
    )));
    setProposalManuallyEdited(true);
    if (!(Number(nextQuantity) > 0) || !editedProposal) return;

    const nextDrafts = workingDrafts.map((draft) => (
      draft.id === editedProposal.draftId
        ? updateTrackingFoodDraftQuantity(draft, nextQuantity)
        : draft
    ));
    replaceWorkingDrafts(nextDrafts);
    setInteractionStatus(
      `${foodName(editedProposal.food)} quedó como Manual. Recalculá para distribuir únicamente el restante entre los alimentos Auto.`
    );
  }, [proposals, replaceWorkingDrafts, workingDrafts]);

  const calculate = useCallback(async () => {
    if (!calculationInput.pendingFoods.length) {
      setCalculating(false);
      setError("");
      setMessage("Todos los alimentos ya tienen una cantidad. Podés confirmarlos sin recalcular.");
      setCalculationResult(null);
      setCalculatedMode(trackingQuantityMode);
      setProposals(trackingDraftProposals(workingDrafts, []));
      return;
    }
    setCalculating(true);
    setError("");
    setMessage("");
    setInteractionStatus("");
    try {
      const response = await calculateTrackingQuantities(buildTrackingQuantityCalculationRequest({
        date,
        target,
        trackingQuantityMode,
        fixedFoods: calculationInput.fixedFoods,
        pendingFoods: calculationInput.pendingFoods,
      }));
      const responseMode = response?.optimization?.policy === "tracking_calorie_fill_v1"
        ? TRACKING_QUANTITY_MODE_CALORIE_FILL
        : normalizeTrackingQuantityMode(
            response?.optimization?.requestedMode,
            trackingQuantityMode
          );
      const invalidFoodsMessage = trackingQuantityInvalidFoodsMessage(response?.optimization);
      if (invalidFoodsMessage) {
        const validProposals = Array.isArray(response?.foods)
          ? trackingDraftProposals(workingDrafts, response.foods)
          : [];
        setProposals(validProposals);
        setProposalManuallyEdited(false);
        setCalculationResult(response);
        setCalculatedMode(responseMode);
        setMessage("");
        setError("");
        return;
      }
      if (response?.status === "error" || !Array.isArray(response?.foods) || !response.foods.length) {
        throw new Error(response?.message || "No se encontró una combinación razonable.");
      }
      const nextProposals = trackingDraftProposals(workingDrafts, response.foods);
      if (nextProposals.length !== workingDrafts.length) {
        throw new Error("No se pudo obtener una cantidad válida para todos los alimentos pendientes.");
      }
      setProposals(nextProposals);
      setProposalManuallyEdited(false);
      setCalculationResult(response);
      setCalculatedMode(responseMode);
      setMessage("Propuesta calculada. Podés ajustar las cantidades antes de confirmar.");
    } catch (calculationError) {
      const errorOptimization = calculationError?.optimization || null;
      const specificInvalidFoodsMessage = trackingQuantityInvalidFoodsMessage(errorOptimization);
      if (errorOptimization) {
        const errorResponse = {
          status: calculationError?.status || "error",
          message: calculationError?.message || "",
          warnings: Array.isArray(calculationError?.warnings) ? calculationError.warnings : [],
          foods: Array.isArray(calculationError?.foods) ? calculationError.foods : [],
          optimization: errorOptimization,
        };
        setCalculationResult(errorResponse);
        setCalculatedMode(
          errorOptimization.policy === "tracking_calorie_fill_v1"
            ? TRACKING_QUANTITY_MODE_CALORIE_FILL
            : trackingQuantityMode
        );
        setProposals(trackingDraftProposals(workingDrafts, errorResponse.foods));
        setProposalManuallyEdited(false);
      }
      setError(specificInvalidFoodsMessage
        ? ""
        : calculationError?.message || "No se pudieron calcular las cantidades.");
    } finally {
      setCalculating(false);
    }
  }, [calculationInput, date, target, trackingQuantityMode, workingDrafts]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (initialNeedsCalculationRef.current) void calculate();
  }, [calculate]);

  const hasInvalidProposal = proposals.some((proposal) => (
    !(Number(proposal.quantity) > 0) ||
    !isTrackingFoodQuantityPhysicallyValid(
      proposal.food || {},
      proposal.unit,
      proposal.quantity
    )
  ));
  const proposalCoversAllDrafts = proposals.length === workingDrafts.length;
  const hasPreviousProposalOrFixed = proposals.length > 0 ||
    workingDrafts.some(hasTrackingDraftQuantity);
  const calculateLabel = hasPreviousProposalOrFixed
    ? "Recalcular restante"
    : error ? "Reintentar cálculo" : "Calcular cantidades";

  return (
    <section className="td-modalBackdrop td-bottomSheet td-autoQuantityBackdrop" role="dialog" aria-modal="true" aria-labelledby="td-auto-quantity-title">
      <button
        type="button"
        className="td-dialogBackdropButton"
        onClick={onClose}
        disabled={saving || calculating}
        aria-label="Cerrar"
      />
      <div className="td-modal td-autoQuantityModal" ref={panelRef} tabIndex={-1}>
        <div className="td-modalTop td-autoQuantityHeader">
          <div>
            <span className="td-kicker">
              <Calculator size={14} aria-hidden="true" />
              Herramienta Pro
            </span>
            <h3 id="td-auto-quantity-title">Calcular cantidades</h3>
            <p>{meal?.label} · objetivo disponible {formatNumber(target?.kcal || 0, 0)} kcal</p>
          </div>
          <button type="button" className="td-iconBtn" onClick={onClose} disabled={saving || calculating} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <fieldset className="td-quantityModeSelector" disabled={saving || calculating}>
          <legend>Método de cálculo</legend>
          <div className="td-quantityModeSegments">
            {TRACKING_QUANTITY_MODE_OPTIONS.map((option) => (
              <label
                className={trackingQuantityMode === option.value ? "is-active" : ""}
                key={option.value}
              >
                <input
                  type="radio"
                  name={`tracking-quantity-mode-${meal?.id || "meal"}`}
                  value={option.value}
                  checked={trackingQuantityMode === option.value}
                  tabIndex={trackingQuantityMode === option.value ? 0 : -1}
                  onChange={(event) => changeTrackingQuantityMode(event.target.value)}
                  aria-describedby="td-quantity-mode-description"
                  data-dialog-initial-focus={trackingQuantityMode === option.value ? "true" : undefined}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p id="td-quantity-mode-description">
            {selectedModeOption.description}
          </p>
        </fieldset>

        {interactionStatus ? (
          <p className="td-autoQuantityModeStatus" role="status">{interactionStatus}</p>
        ) : null}

        <div className="td-autoQuantityDrafts" aria-label="Alimentos de esta comida">
          <div className="td-autoQuantityDraftsTop">
            <strong>Alimentos a preparar</strong>
            <span>
              {calculationInput.fixedFoods.length} fijos · {calculationInput.pendingFoods.length} pendientes
            </span>
          </div>
          {workingDrafts.map((draft) => (
            <div className="td-autoQuantityDraftRow" key={draft.id}>
              <span>
                <strong>{draft.name || foodName(draft.food)}</strong>
                <small>
                  {isTrackingDraftAutomatic(draft)
                    ? draft.quantity
                      ? `${formatNumber(draft.quantity, 1)} ${draft.unit || "g"} · se recalculará`
                      : "Cantidad pendiente"
                    : `${formatNumber(draft.quantity, 1)} ${draft.unit || "g"} · cantidad fija`}
                </small>
              </span>
              <b className={isTrackingDraftAutomatic(draft) ? "is-pending" : "is-fixed"}>
                {isTrackingDraftAutomatic(draft) ? "Auto" : "Manual"}
              </b>
            </div>
          ))}
          {calculationInput.fixedFoods.length ? (
            <p>
              Las cantidades fijas aportan {formatNumber(calculationInput.fixedTotals?.kcal || 0, 0)} kcal.
              Quedan aproximadamente {formatNumber(targetAfterFixed, 0)} kcal para distribuir.
            </p>
          ) : null}
        </div>

        {calculating ? (
          <div className="td-autoQuantityCalculating" role="status">
            <Loader2 size={19} className="td-spin" aria-hidden="true" />
            Calculando una propuesta con los alimentos pendientes...
          </div>
        ) : null}

        {error ? <div className="td-error" role="alert">{error}</div> : null}
        {message ? <p className="td-autoQuantityMessage">{message}</p> : null}

        {optimization && calorieFillResult ? (
          <div className="td-autoQuantityFeedback" aria-label="Resultado del método Completar calorías">
            {calorieTargetCompleted ? (
              <div className="td-autoQuantityCalorieSuccess" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>
                  <strong>Objetivo calórico completado.</strong>
                  <small>La propuesta queda a {formatNumber(calorieDeficit, 1)} kcal del objetivo sin superar el techo.</small>
                </span>
              </div>
            ) : discreteLimited ? (
              <div className="td-autoQuantityDiscreteInfo" role="status">
                <Info size={18} aria-hidden="true" />
                <span>
                  <strong>Quedan aproximadamente {formatNumber(calorieDeficit, 0)} kcal.</strong>
                  <small>Con las unidades enteras seleccionadas no es posible acercarse más.</small>
                </span>
              </div>
            ) : granularityLimited ? (
              <div className="td-autoQuantityDiscreteInfo" role="status">
                <Info size={18} aria-hidden="true" />
                <span>
                  <strong>Quedan aproximadamente {formatNumber(calorieDeficit, 1)} kcal.</strong>
                  <small>Con la precisión física disponible no es posible acercarse más sin superar el techo.</small>
                </span>
              </div>
            ) : calorieDeficit > calorieTolerance && !invalidFoods.length ? (
              <div className="td-autoQuantityCalorieWarning" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>Todavía faltan aproximadamente {formatNumber(calorieDeficit, 0)} kcal.</strong>
                  <small>Revisá los alimentos sin información válida o agregá otra opción antes de continuar.</small>
                </span>
              </div>
            ) : null}

            {exceededRecommendedPortions.length ? (
              <details className="td-autoQuantityInfoDetails">
                <summary>
                  <Info size={17} aria-hidden="true" />
                  Porciones recomendadas superadas
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <p>Es intencional en este método. Revisá las cantidades antes de confirmar.</p>
                <ul>
                  {exceededRecommendedPortions.map((portion, index) => (
                    <li key={`${portion.foodId || portion.name}-${index}`}>
                      <strong>{portion.name || "Alimento"}</strong>: {formatNumber(portion.proposedQuantity, 1)} {portion.unit || ""}
                      {Number(portion.recommendedMax) > 0
                        ? ` (porción recomendada hasta ${formatNumber(portion.recommendedMax, 1)} ${portion.unit || ""})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {macroLimitations.length ? (
              <div className="td-autoQuantityMacroInfo" role="status">
                <Info size={18} aria-hidden="true" />
                <span>
                  <strong>No es posible acercarse a todos los macronutrientes con estos alimentos.</strong>
                  <small>
                    {macroLimitations.map((limitation) => (
                      `${macroShortLabel(limitation.macro)}: faltan ${formatNumber(limitation.deficit, 1)} g`
                    )).join(" · ")}
                  </small>
                </span>
              </div>
            ) : null}

            {invalidFoods.length ? (
              <div className="td-autoQuantityInvalidFoods" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>No se pudo calcular una cantidad para algunos alimentos.</strong>
                  <small>
                    {invalidFoods.map((food) => (
                      `${food.name || "Alimento"}: no tiene información calórica válida`
                    )).join(". ")}
                  </small>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {optimization && !calorieFillResult ? (
          <div className="td-autoQuantityPolicy">
            <span role="status">
              <strong>
                {optimization.normalCalorieZoneReached
                  ? `Zona calórica ${formatNumber(optimization.calorieZoneFloor, 0)}–${formatNumber(optimization.calorieCeiling, 0)} kcal`
                  : `Todavía faltan aproximadamente ${formatNumber(calorieDeficit, 0)} kcal para completar esta comida.`}
              </strong>
              <small>El techo de {formatNumber(optimization.calorieCeiling, 0)} kcal nunca se supera.</small>
            </span>
            {optimization.constraints?.length ? (
              <details className="td-autoQuantityConstraintDetails" open>
                <summary>
                  Restricciones aplicadas
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <ul aria-label="Restricciones aplicadas">
                  {optimization.constraints.map((constraint, index) => {
                    const draft = workingDrafts.find((entry) => (
                      String(entry.name || foodName(entry.food)).trim().toLowerCase() ===
                      String(constraint.name || "").trim().toLowerCase()
                    ));
                    const unit = constraint.unit || draft?.unit || "g";
                    return (
                      <li key={`${constraint.foodId || constraint.name}-${index}`}>
                        <strong>{constraint.name}</strong>: {formatNumber(constraint.min, 1)}–{formatNumber(constraint.max, 1)} {unit}, paso {formatNumber(constraint.step, 1)}
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
            {maxConstraintsLimited ? (
              <div className="td-autoQuantityConstraintWarning" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>Los alimentos seleccionados alcanzaron sus cantidades máximas configuradas.</strong>
                  <small>
                    {(optimization.limitingConstraints || []).map((constraint) => {
                      const draft = workingDrafts.find((entry) => (
                        String(entry.name || foodName(entry.food)).trim().toLowerCase() ===
                        String(constraint.name || "").trim().toLowerCase()
                      ));
                      const unit = constraint.unit || draft?.unit || "g";
                      return `${constraint.name}: máximo ${formatNumber(constraint.max, 1)} ${unit}`;
                    }).join(". ")}
                  </small>
                  {trackingQuantityMode !== TRACKING_QUANTITY_MODE_CALORIE_FILL ? (
                    <button
                      type="button"
                      className="td-unlimitedCaloriesCta"
                      onClick={() => changeTrackingQuantityMode(TRACKING_QUANTITY_MODE_CALORIE_FILL)}
                    >
                      Completar calorías sin límites
                    </button>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {proposals.length ? (
          <div className="td-autoQuantityProposal">
            {proposals.map((proposal, index) => (
              <article key={`${foodId(proposal.food)}-${index}`}>
                <span>
                  <strong>{foodName(proposal.food)}</strong>
                  <small>
                    {proposal.fixed ? "Cantidad manual respetada" : `${formatNumber(proposal.generated?.kcal, 0)} kcal sugeridas`}
                  </small>
                </span>
                <label>
                  <input
                    value={proposal.quantity}
                    inputMode="decimal"
                    step={trackingFoodRequiresWholeQuantity(proposal.food, proposal.unit) ? "1" : "any"}
                    aria-invalid={!isTrackingFoodQuantityPhysicallyValid(
                      proposal.food || {},
                      proposal.unit,
                      proposal.quantity
                    )}
                    aria-label={`Cantidad de ${foodName(proposal.food)}`}
                    onChange={(event) => editProposalQuantity(index, event.target.value)}
                  />
                  <span>{proposal.unit}</span>
                </label>
              </article>
            ))}
            <div className="td-autoQuantityTotals">
              <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
              <span>P {formatNumber(totals.proteina, 1)} · C {formatNumber(totals.carbs, 1)} · G {formatNumber(totals.grasas, 1)}</span>
            </div>
            <details className="td-autoQuantityComparison">
              <summary>
                Ver detalle nutricional
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="td-autoQuantityComparisonHead">
                <strong>Resultado nutricional</strong>
                <span>Objetivo</span>
                <span>Propuesta</span>
                <span>Desvío</span>
              </div>
              {review.rows.filter((row) => row.configured).map((row) => (
                <div className="td-autoQuantityComparisonRow" key={row.key}>
                  <strong>{row.short}</strong>
                  <span>{formatNumber(row.target, row.key === "kcal" ? 0 : 1)} {row.unit}</span>
                  <span>{formatNumber(row.proposed, row.key === "kcal" ? 0 : 1)} {row.unit}</span>
                  <b>{signedNutritionValue(row.difference, row.key === "kcal" ? 0 : 1)} {row.unit}</b>
                </div>
              ))}
            </details>
            {!review.respectsCalorieCeiling ? (
              <div className="td-autoQuantityCalorieWarning" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>La propuesta supera el techo por {formatNumber(review.calorieExcess, 1)} kcal.</strong>
                  <small>Reducí una cantidad o recalculá antes de continuar.</small>
                </span>
              </div>
            ) : null}
            {!calorieFillResult && review.requiresCalorieZoneWarning && !maxConstraintsLimited ? (
              <div className="td-autoQuantityCalorieWarning" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>Esta selección no alcanza la zona calórica esperada.</strong>
                  <small>
                    El mejor nivel disponible es {formatNumber(calculationResult?.optimization?.bestReachableCalories, 0)} kcal.
                    Podés agregar o reemplazar un alimento antes de continuar.
                  </small>
                </span>
              </div>
            ) : null}
            {review.proteinLevel ? (
              <div className={`td-autoQuantityProteinWarning ${review.proteinLevel === "near" ? "is-near" : "is-high"}`} role="alert">
                <AlertTriangle size={19} aria-hidden="true" />
                <span>
                  <strong>
                    {review.proteinLevel === "near"
                      ? `Faltan aproximadamente ${formatNumber(review.proteinDeficit, 1)} g de proteína.`
                      : `Esta combinación queda ${formatNumber(review.proteinDeficit, 1)} g por debajo de tu meta de proteína.`}
                  </strong>
                  <small>
                    {review.proteinLevel === "near"
                      ? "¿Querés continuar con esta combinación?"
                      : "Te conviene agregar o reemplazar un alimento proteico."}
                  </small>
                </span>
              </div>
            ) : null}
            {review.secondaryMacroRows.length ? (
              <p className="td-autoQuantitySecondaryNotice">
                <strong>Mejor aproximación disponible:</strong>{" "}
                {review.secondaryMacroRows.map((row) => (
                  `${row.short} ${signedNutritionValue(row.difference)} g`
                )).join(" · ")}
              </p>
            ) : null}
            {visibleWarnings.length ? (
              <p className="td-autoQuantityWarnings">{visibleWarnings.join(" ")}</p>
            ) : null}
          </div>
        ) : null}

        <div className="td-autoQuantityFooter">
          {!calculating && calculationInput.pendingFoods.length ? (
            <button
              type="button"
              className="td-calculateQuantityBtn"
              onClick={calculate}
              disabled={saving || hasInvalidProposal}
            >
              <Calculator size={18} aria-hidden="true" />
              {calculateLabel}
            </button>
          ) : null}

          {modeNeedsRecalculation ? (
            <p className="td-autoQuantityModeReminder" role="status">
              La propuesta visible pertenece al método anterior. Recalculá el restante para usar {trackingQuantityMode === TRACKING_QUANTITY_MODE_CALORIE_FILL ? "Completar calorías" : "Respetar porciones"}.
            </p>
          ) : null}

          <p className="td-autoQuantityProposalNotice">
            Esta es una propuesta local. El total real del Tracking cambia recién al tocar Confirmar consumo desde la comida.
          </p>
          <div className="td-modalActions td-autoQuantityDecisionActions">
            <button type="button" className="td-secondaryBtn" onClick={onAddFood} disabled={saving || calculating}>
              <Plus size={17} aria-hidden="true" />
              Agregar otro alimento
            </button>
            <button type="button" className="td-secondaryBtn" onClick={onClose} disabled={saving || calculating}>
              Volver al borrador
            </button>
            <button
              type="button"
              className="td-primaryBtn"
              onClick={() => onApply(proposals, trackingQuantityMode)}
              disabled={
                saving ||
                calculating ||
                modeNeedsRecalculation ||
                !review.canContinue ||
                !proposals.length ||
                !proposalCoversAllDrafts ||
                hasInvalidProposal
              }
            >
              <CheckCircle2 size={17} aria-hidden="true" />
              {review.proteinLevel ? "Continuar igualmente" : "Usar esta propuesta"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ManualMomentStatus({ meal, totals }) {
  if (!meal?.manualCompletionMoment) return null;
  const consumed = Number(totals?.kcal) > 0;
  return (
    <span className={`td-manualMomentStatus ${consumed ? "consumed" : ""}`}>
      {consumed ? <CheckCircle2 size={13} aria-hidden="true" /> : <Target size={13} aria-hidden="true" />}
      {consumed ? "Consumido" : "Planificado"}
    </span>
  );
}
