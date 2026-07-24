import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Crown,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { listAlimentos } from "../nutricion/nutricionApi.js";
import { formatNumber, getFoodImageUrl } from "../nutricion/nutricionUtils.js";
import { calculateTrackingQuantities } from "./trackingApi.js";
import { manualDayStatusText, nutritionTotals } from "./manualDayCompletion.js";

function useDialogKeyboard(panelRef, { onClose, disabled = false } = {}) {
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panelRef.current?.querySelector("button:not([disabled]), input:not([disabled])");
    first?.focus?.();

    function onKeyDown(event) {
      if (event.key === "Escape" && !disabled) {
        event.preventDefault();
        onClose?.();
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
      openerRef.current?.focus?.();
    };
  }, [disabled, onClose, panelRef]);
}

function statusTone(status = "") {
  if (status === "exceeded") return "is-exceeded";
  if (status === "reached" || status === "near") return "is-reached";
  if (status === "missing_target") return "is-missing";
  return "is-remaining";
}

function macroItems(progress = {}) {
  const remaining = progress.remaining || {};
  return [
    { key: "proteina", label: "Proteína", short: "P", value: remaining.proteina },
    { key: "carbs", label: "Carbohidratos", short: "C", value: remaining.carbs },
    { key: "grasas", label: "Grasas", short: "G", value: remaining.grasas },
  ].filter((item) => progress?.configured?.[item.key]);
}

export function ManualCompletionTrackingCard({
  progress,
  plan = null,
  canPlan = false,
  onAddFood,
  onOpenPlanner,
}) {
  if (!progress) return null;
  const macros = macroItems(progress);
  const availableKcal = Math.max(0, Number(progress.available?.kcal) || 0);
  const registeredKcal = Math.max(0, Number(progress.trackedConsumed?.kcal) || 0);
  const remainingKcal = Number(progress.remaining?.kcal) || 0;
  const planCount = Number(plan?.count) || 0;

  return (
    <section className={`td-manualCompletionCard ${statusTone(progress.status)}`}>
      <div className="td-manualCompletionTop">
        <span className="td-manualCompletionIcon" aria-hidden="true">
          <Target size={21} strokeWidth={2.25} />
        </span>
        <div>
          <span className="td-cardEyebrow">Modo del día</span>
          <h2>Resto del día por tu cuenta</h2>
          <p>{manualDayStatusText(progress)}</p>
        </div>
      </div>

      {progress.configured?.kcal ? (
        <>
          <div className="td-manualCompletionKcal">
            <span>
              <small>Registrado en Tracking</small>
              <strong>{formatNumber(registeredKcal, 0)} / {formatNumber(availableKcal, 0)} kcal</strong>
            </span>
            <span>
              <small>{remainingKcal < 0 ? "Excedente" : "Restante actual"}</small>
              <strong>{formatNumber(Math.abs(remainingKcal), 0)} kcal</strong>
            </span>
          </div>
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
        </>
      ) : (
        <div className="td-manualCompletionMissing">
          Podés seguir registrando alimentos. Configurá un objetivo diario para ver el restante.
        </div>
      )}

      {macros.length ? (
        <div className="td-manualCompletionMacros" aria-label="Macros restantes">
          {macros.map((item) => (
            <span key={item.key}>
              <small>{item.short}</small>
              <strong>{formatNumber(Math.max(0, item.value), 1)} g</strong>
            </span>
          ))}
        </div>
      ) : (
        <p className="td-manualCompletionNoMacros">No hay objetivos de macros configurados.</p>
      )}

      {planCount ? (
        <div className="td-manualCompletionPlanState">
          <Sparkles size={15} aria-hidden="true" />
          Organizado en {planCount} momento{planCount === 1 ? "" : "s"} flexible{planCount === 1 ? "" : "s"}.
        </div>
      ) : null}

      <div className="td-manualCompletionActions">
        <button type="button" className="td-primaryBtn" onClick={onAddFood}>
          <Plus size={17} aria-hidden="true" />
          Agregar alimento
        </button>
        {canPlan ? (
          <button type="button" className="td-secondaryBtn" onClick={onOpenPlanner}>
            <Sparkles size={17} aria-hidden="true" />
            Organizar lo que queda
          </button>
        ) : null}
      </div>

      {!canPlan ? (
        <div className="td-manualCompletionProNote">
          <Crown size={15} aria-hidden="true" />
          <span>
            <strong>Organizá lo que te queda</strong>
            Distribuí calorías y calculá cantidades automáticamente con Pro.
          </span>
        </div>
      ) : null}

      <p className="td-manualCompletionHint">
        Calculado según tu objetivo, el menú realmente realizado y lo que ya registraste hoy.
      </p>
    </section>
  );
}

export function RemainingMomentsPlannerDialog({
  currentCount = 0,
  saving = false,
  onClose,
  onSave,
}) {
  const [count, setCount] = useState(currentCount || 1);
  const panelRef = useRef(null);
  useDialogKeyboard(panelRef, { onClose, disabled: saving });

  return (
    <section className="td-modalBackdrop td-bottomSheet" role="dialog" aria-modal="true" aria-labelledby="td-plan-moments-title">
      <button type="button" className="td-dialogBackdropButton" onClick={saving ? undefined : onClose} aria-label="Cerrar" />
      <div className="td-modal td-planMomentsModal" ref={panelRef}>
        <div className="td-modalTop">
          <div>
            <span className="td-kicker">
              <Sparkles size={14} aria-hidden="true" />
              Planificación temporal
            </span>
            <h3 id="td-plan-moments-title">Organizar lo que queda</h3>
          </div>
          <button type="button" className="td-iconBtn" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="td-planMomentsCopy">¿En cuántos momentos querés repartir lo que te queda?</p>
        <div className="td-planMomentOptions" role="radiogroup" aria-label="Cantidad de momentos">
          {[1, 2, 3, 4].map((value) => (
            <button
              type="button"
              role="radio"
              aria-checked={count === value}
              className={count === value ? "active" : ""}
              onClick={() => setCount(value)}
              key={value}
            >
              <strong>{value}</strong>
              <span>momento{value === 1 ? "" : "s"}</span>
            </button>
          ))}
        </div>
        <p className="td-planMomentsHint">
          Son referencias flexibles. Si consumís más en un momento, ZumaFit redistribuye el restante entre los siguientes.
        </p>
        <div className="td-modalActions">
          <button type="button" className="td-secondaryBtn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="td-primaryBtn" onClick={() => onSave(count)} disabled={saving}>
            {saving ? <Loader2 size={17} className="td-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
            {saving ? "Guardando..." : "Organizar momentos"}
          </button>
        </div>
      </div>
    </section>
  );
}

function foodId(food = {}) {
  return String(food.id || food._id || food.alimentoId || food.nombre || food.name || "");
}

function foodName(food = {}) {
  return food.nombre || food.name || food.Alimentos || "Alimento";
}

function quantityFoodPayload(food = {}) {
  const unit = food.unidad || food.unit || "g";
  const isGram = ["g", "gr", "gramo", "gramos", "ml"].includes(String(unit).toLowerCase());
  const divisor = isGram ? 100 : 1;
  return {
    foodId: food.id || food._id || food.alimentoId || null,
    name: foodName(food),
    nombre: foodName(food),
    unit,
    unidad: unit,
    kcalPerUnitOrGram: (Number(food.kcal ?? food.calorias) || 0) / divisor,
    proteinPerUnitOrGram: (Number(food.proteina ?? food.protein) || 0) / divisor,
    carbsPerUnitOrGram: (Number(food.carbs ?? food.carbohidratos) || 0) / divisor,
    fatPerUnitOrGram: (Number(food.grasas ?? food.fat) || 0) / divisor,
    categoria: food.categoria || food.fuente || "",
  };
}

function matchGeneratedFood(generated = {}, selected = []) {
  const generatedId = String(generated.foodId || generated.id || "");
  const normalizedName = String(generated.nombre || generated.name || "").trim().toLowerCase();
  return selected.find((food) => generatedId && foodId(food) === generatedId)
    || selected.find((food) => foodName(food).trim().toLowerCase() === normalizedName)
    || generated;
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

export function AutoQuantityPlannerDialog({
  date,
  moment,
  target,
  saving = false,
  onClose,
  onConfirm,
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const panelRef = useRef(null);
  useDialogKeyboard(panelRef, { onClose, disabled: saving || calculating });
  const totals = useMemo(() => proposalTotals(proposals), [proposals]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingFoods(true);
      listAlimentos({ search: term, limit: 10 })
        .then((data) => {
          if (active) setResults((data?.alimentos || data?.all || []).slice(0, 10));
        })
        .catch((foodError) => {
          if (active) setError(foodError?.message || "No se pudieron buscar alimentos.");
        })
        .finally(() => {
          if (active) setLoadingFoods(false);
        });
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  function toggleFood(food) {
    const id = foodId(food);
    setProposals([]);
    setMessage("");
    setSelected((current) => current.some((entry) => foodId(entry) === id)
      ? current.filter((entry) => foodId(entry) !== id)
      : [...current, food].slice(0, 4));
  }

  async function calculate() {
    if (!selected.length || calculating) return;
    setCalculating(true);
    setError("");
    setMessage("");
    try {
      const response = await calculateTrackingQuantities({
        date,
        target,
        mode: target?.carbs || target?.grasas ? "full" : target?.proteina ? "kcalProteina" : "kcal",
        generationType: "selectedOnly",
        fixedFoods: [],
        pendingFoods: selected.map(quantityFoodPayload),
        options: { redondear: true, usarMinMax: true },
      });
      if (!Array.isArray(response?.foods) || !response.foods.length) {
        throw new Error(response?.message || "No se encontró una combinación razonable.");
      }
      setProposals(response.foods.map((generated) => {
        const quantity = Number(generated.quantity ?? generated.cantidad) || 0;
        return {
          food: matchGeneratedFood(generated, selected),
          generated,
          quantity,
          initialQuantity: quantity,
          unit: generated.unit || generated.unidad || "g",
        };
      }).filter((proposal) => proposal.quantity > 0));
      setMessage(response.message || "Propuesta calculada. Podés ajustar las cantidades antes de confirmar.");
    } catch (calculationError) {
      setError(calculationError?.message || "No se pudieron calcular las cantidades.");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <section className="td-modalBackdrop td-bottomSheet" role="dialog" aria-modal="true" aria-labelledby="td-auto-quantity-title">
      <button type="button" className="td-dialogBackdropButton" onClick={saving || calculating ? undefined : onClose} aria-label="Cerrar" />
      <div className="td-modal td-autoQuantityModal" ref={panelRef}>
        <div className="td-modalTop">
          <div>
            <span className="td-kicker">
              <Calculator size={14} aria-hidden="true" />
              Herramienta Pro
            </span>
            <h3 id="td-auto-quantity-title">Calcular cantidades</h3>
            <p>{moment?.label} · meta actual {formatNumber(target?.kcal || 0, 0)} kcal</p>
          </div>
          <button type="button" className="td-iconBtn" onClick={onClose} disabled={saving || calculating} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <label className="td-autoQuantitySearch">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Buscar alimentos</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar yogur, banana..." />
          {loadingFoods ? <Loader2 size={16} className="td-spin" aria-hidden="true" /> : null}
        </label>

        {results.length ? (
          <div className="td-autoQuantityResults">
            {results.map((food) => {
              const selectedFood = selected.some((entry) => foodId(entry) === foodId(food));
              return (
                <button type="button" className={selectedFood ? "selected" : ""} onClick={() => toggleFood(food)} key={foodId(food)}>
                  <img src={getFoodImageUrl(food)} alt="" />
                  <span>
                    <strong>{foodName(food)}</strong>
                    <small>{formatNumber(food.kcal ?? food.calorias, 0)} kcal por {food.unidad || food.unit || "g"}</small>
                  </span>
                  {selectedFood ? <CheckCircle2 size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ) : null}

        {selected.length ? (
          <div className="td-autoQuantitySelected">
            <span>Seleccionados</span>
            <div>
              {selected.map((food) => (
                <button type="button" onClick={() => toggleFood(food)} key={foodId(food)}>
                  {foodName(food)}
                  <X size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button type="button" className="td-calculateQuantityBtn" onClick={calculate} disabled={!selected.length || calculating || saving}>
          {calculating ? <Loader2 size={18} className="td-spin" aria-hidden="true" /> : <Calculator size={18} aria-hidden="true" />}
          {calculating ? "Calculando..." : proposals.length ? "Recalcular cantidades" : "Calcular cantidades"}
        </button>

        {error ? <div className="td-error" role="alert">{error}</div> : null}
        {message ? <p className="td-autoQuantityMessage">{message}</p> : null}

        {proposals.length ? (
          <div className="td-autoQuantityProposal">
            {proposals.map((proposal, index) => (
              <article key={`${foodId(proposal.food)}-${index}`}>
                <span>
                  <strong>{foodName(proposal.food)}</strong>
                  <small>{formatNumber(proposal.generated?.kcal, 0)} kcal sugeridas</small>
                </span>
                <label>
                  <input
                    value={proposal.quantity}
                    inputMode="decimal"
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
          </div>
        ) : null}

        <div className="td-modalActions">
          <button type="button" className="td-secondaryBtn" onClick={onClose} disabled={saving || calculating}>Cancelar</button>
          <button
            type="button"
            className="td-primaryBtn"
            onClick={() => onConfirm(proposals)}
            disabled={saving || calculating || !proposals.length || proposals.some((proposal) => !(Number(proposal.quantity) > 0))}
          >
            {saving ? <Loader2 size={17} className="td-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
            {saving ? "Guardando..." : "Confirmar como consumido"}
          </button>
        </div>
        <p className="td-autoQuantityFootnote">
          La propuesta no cuenta como consumo hasta que la confirmes.
        </p>
      </div>
    </section>
  );
}

export function ManualMomentStatus({ meal, totals }) {
  if (!meal?.manualCompletionMoment) return null;
  const consumed = Number(totals?.kcal) > 0;
  return (
    <span className={`td-manualMomentStatus ${consumed ? "consumed" : "planned"}`}>
      {consumed ? <CheckCircle2 size={13} aria-hidden="true" /> : <Target size={13} aria-hidden="true" />}
      {consumed ? "Consumido" : "Planificado"}
    </span>
  );
}

export function ManualMomentCalculatorAction({ meal, onCalculate }) {
  if (!meal?.manualCompletionMoment || meal?.manualMomentState === "consumed") return null;
  return (
    <button type="button" className="td-manualMomentCalcBtn" onClick={() => onCalculate(meal)}>
      <Calculator size={16} aria-hidden="true" />
      Calcular cantidades
      <ArrowRight size={15} aria-hidden="true" />
    </button>
  );
}
