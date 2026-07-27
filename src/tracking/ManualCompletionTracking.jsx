import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { formatNumber } from "../nutricion/nutricionUtils.js";
import { calculateTrackingQuantities } from "./trackingApi.js";
import { manualDayStatusText, nutritionTotals } from "./manualDayCompletion.js";
import { buildTrackingQuantityReview } from "./trackingQuantityReview.js";
import {
  isTrackingDraftAutomatic,
  trackingDraftCalculationPayload,
  trackingDraftProposals,
} from "./trackingQuantityDrafts.js";

function useDialogKeyboard(panelRef, { onClose, disabled = false } = {}) {
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);
  onCloseRef.current = onClose;
  disabledRef.current = disabled;

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panelRef.current?.querySelector("[data-dialog-initial-focus]:not([disabled]), button:not([disabled]), input:not([disabled])");
    (first || panelRef.current)?.focus?.();

    function onKeyDown(event) {
      if (event.key === "Escape" && !disabledRef.current) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )];
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
  const pendingKcal = Math.max(0, Number(pendingTotals?.kcal) || 0);

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
          {pendingKcal > 0 ? (
            <small className="td-manualCompletionPendingLine" role="status">
              + {formatNumber(pendingKcal, 0)} kcal por confirmar · Total diario proyectado {formatNumber(projectedTotals?.kcal, 0)} kcal
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
}) {
  const [proposals, setProposals] = useState([]);
  const [calculationResult, setCalculationResult] = useState(null);
  const [calculating, setCalculating] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const panelRef = useRef(null);
  const autoStartedRef = useRef(false);
  useDialogKeyboard(panelRef, { onClose, disabled: saving || calculating });
  const totals = useMemo(() => proposalTotals(proposals), [proposals]);
  const calculationInput = useMemo(
    () => trackingDraftCalculationPayload(drafts),
    [drafts]
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
  const maxConstraintsLimited = calculationResult?.optimization?.maxConstraintsLimited === true;
  const visibleWarnings = (calculationResult?.warnings || []).filter((warning) => !(
    maxConstraintsLimited &&
    warning === "Las cantidades máximas configuradas para algunos alimentos limitan esta propuesta."
  ));

  const calculate = useCallback(async () => {
    if (!calculationInput.pendingFoods.length) {
      setCalculating(false);
      setError("");
      setMessage("Todos los alimentos ya tienen una cantidad. Podés confirmarlos sin recalcular.");
      setCalculationResult(null);
      setProposals(trackingDraftProposals(drafts, []));
      return;
    }
    setCalculating(true);
    setError("");
    setMessage("");
    setProposals([]);
    setCalculationResult(null);
    try {
      const response = await calculateTrackingQuantities({
        date,
        target,
        mode: "kcalProteina",
        generationType: "selectedOnly",
        fixedFoods: calculationInput.fixedFoods,
        pendingFoods: calculationInput.pendingFoods,
        options: { redondear: true, usarMinMax: true },
      });
      if (response?.status === "error" || !Array.isArray(response?.foods) || !response.foods.length) {
        throw new Error(response?.message || "No se encontró una combinación razonable.");
      }
      const nextProposals = trackingDraftProposals(drafts, response.foods);
      if (nextProposals.length !== drafts.length) {
        throw new Error("No se pudo obtener una cantidad válida para todos los alimentos pendientes.");
      }
      setProposals(nextProposals);
      setCalculationResult(response);
      setMessage(response.message || "Propuesta calculada. Podés ajustar las cantidades antes de confirmar.");
    } catch (calculationError) {
      setError(calculationError?.message || "No se pudieron calcular las cantidades.");
    } finally {
      setCalculating(false);
    }
  }, [calculationInput, date, drafts, target]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void calculate();
  }, [calculate]);

  return (
    <section className="td-modalBackdrop td-bottomSheet td-autoQuantityBackdrop" role="dialog" aria-modal="true" aria-labelledby="td-auto-quantity-title">
      <button type="button" className="td-dialogBackdropButton" onClick={saving || calculating ? undefined : onClose} aria-label="Cerrar" />
      <div className="td-modal td-autoQuantityModal" ref={panelRef} tabIndex={-1}>
        <div className="td-modalTop">
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

        <div className="td-autoQuantityDrafts" aria-label="Alimentos de esta comida">
          <div className="td-autoQuantityDraftsTop">
            <strong>Alimentos a preparar</strong>
            <span>
              {calculationInput.fixedFoods.length} fijos · {calculationInput.pendingFoods.length} pendientes
            </span>
          </div>
          {drafts.map((draft) => (
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
                {isTrackingDraftAutomatic(draft) ? "Auto" : "Fijo"}
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

        {calculationResult?.optimization ? (
          <div className="td-autoQuantityPolicy" role="status">
            <span>
              <strong>
                {calculationResult.optimization.normalCalorieZoneReached
                  ? `Zona calórica ${formatNumber(calculationResult.optimization.calorieZoneFloor, 0)}–${formatNumber(calculationResult.optimization.calorieCeiling, 0)} kcal`
                  : `Mejor nivel calórico alcanzable: ${formatNumber(calculationResult.optimization.bestReachableCalories, 0)} kcal`}
              </strong>
              <small>El techo de {formatNumber(calculationResult.optimization.calorieCeiling, 0)} kcal nunca se supera.</small>
            </span>
            {calculationResult.optimization.constraints?.length ? (
              <ul aria-label="Restricciones aplicadas">
                {calculationResult.optimization.constraints.map((constraint, index) => {
                  const draft = drafts.find((entry) => (
                    String(entry.name || foodName(entry.food)).trim().toLowerCase() ===
                    String(constraint.name || "").trim().toLowerCase()
                  ));
                  const unit = draft?.unit || "g";
                  return (
                    <li key={`${constraint.name}-${index}`}>
                      <strong>{constraint.name}</strong>: {formatNumber(constraint.min, 1)}–{formatNumber(constraint.max, 1)} {unit}, paso {formatNumber(constraint.step, 1)}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {maxConstraintsLimited ? (
              <div className="td-autoQuantityConstraintWarning" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>Las cantidades máximas configuradas para algunos alimentos limitan esta propuesta.</strong>
                  <small>
                    {(calculationResult.optimization.limitingConstraints || []).map((constraint) => {
                      const draft = drafts.find((entry) => (
                        String(entry.name || foodName(entry.food)).trim().toLowerCase() ===
                        String(constraint.name || "").trim().toLowerCase()
                      ));
                      const unit = draft?.unit || "g";
                      const targets = (constraint.targets || []).join(" y ");
                      return `${constraint.name}: máximo ${formatNumber(constraint.max, 1)} ${unit}${targets ? `; limita ${targets}` : ""}`;
                    }).join(". ")}
                  </small>
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
                    readOnly={proposal.fixed}
                    aria-label={`Cantidad de ${foodName(proposal.food)}`}
                    onChange={(event) => setProposals((current) => current.map((entry, entryIndex) => (
                      entryIndex === index ? { ...entry, quantity: event.target.value } : entry
                    )))}
                  />
                  <span>{proposal.unit}</span>
                </label>
              </article>
            ))}
            <div className="td-autoQuantityTotals">
              <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
              <span>P {formatNumber(totals.proteina, 1)} · C {formatNumber(totals.carbs, 1)} · G {formatNumber(totals.grasas, 1)}</span>
            </div>
            <div className="td-autoQuantityComparison" aria-label="Comparación entre objetivo y propuesta">
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
            </div>
            {!review.respectsCalorieCeiling ? (
              <div className="td-autoQuantityCalorieWarning" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>La propuesta supera el techo por {formatNumber(review.calorieExcess, 1)} kcal.</strong>
                  <small>Reducí una cantidad o recalculá antes de continuar.</small>
                </span>
              </div>
            ) : null}
            {review.requiresCalorieZoneWarning ? (
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

        {!calculating && calculationInput.pendingFoods.length ? (
          <button type="button" className="td-calculateQuantityBtn" onClick={calculate} disabled={saving}>
            <Calculator size={18} aria-hidden="true" />
            {proposals.length ? "Recalcular propuesta" : "Reintentar cálculo"}
          </button>
        ) : null}

        <p className="td-autoQuantityProposalNotice">
          Esta es una propuesta. El total superior del Tracking se actualizará recién cuando confirmes el consumo desde la comida.
        </p>
        <div className={`td-modalActions td-autoQuantityDecisionActions ${review.proteinLevel ? "has-protein-warning" : ""}`}>
          {review.proteinLevel ? (
            <button type="button" className="td-secondaryBtn" onClick={onAddFood} disabled={saving || calculating}>
              <Plus size={17} aria-hidden="true" />
              Agregar otro alimento
            </button>
          ) : null}
          <button type="button" className="td-secondaryBtn" onClick={onClose} disabled={saving || calculating}>
            Revisar selección
          </button>
          <button
            type="button"
            className="td-primaryBtn"
            onClick={() => onApply(proposals)}
            disabled={
              saving ||
              calculating ||
              !review.canContinue ||
              !proposals.length ||
              proposals.some((proposal) => !(Number(proposal.quantity) > 0))
            }
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            {review.proteinLevel ? "Continuar igualmente" : "Usar esta propuesta"}
          </button>
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
