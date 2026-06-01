import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  Plus,
  Search,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { useAlimentos } from "../nutricion/nutricionQueries.js";
import { buildMenuItemSnapshot, formatNumber } from "../nutricion/nutricionUtils.js";
import AppToast from "../ui/AppToast.jsx";
import {
  useAddFoodLog,
  useDeleteFoodLog,
  useTrackingDay,
  useUpdateFoodLog,
} from "../tracking/trackingQueries.js";
import "./trackingDiario.css";

const MEALS = [
  { id: "desayuno", label: "Desayuno" },
  { id: "almuerzo", label: "Almuerzo" },
  { id: "merienda", label: "Merienda" },
  { id: "cena", label: "Cena" },
  { id: "snack", label: "Snack" },
];

export default function TrackingDiario() {
  const [date, setDate] = useState(todayLocalString());
  const [modalMeal, setModalMeal] = useState("");
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [toast, setToast] = useState(null);

  const foodsQuery = useAlimentos({});
  const trackingQuery = useTrackingDay(date);
  const addMutation = useAddFoodLog();
  const updateMutation = useUpdateFoodLog();
  const deleteMutation = useDeleteFoodLog();

  const isSaving = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const tracking = trackingQuery.data || emptyTrackingDay(date);
  const log = normalizeMeals(tracking.meals);
  const totals = tracking.totals || emptyTotals();
  const objective = tracking.objetivo || null;
  const remaining = tracking.remaining || remainingTotals(objective, totals);
  const objectiveTitle = tracking.planificado ? "Planificado" : objective ? "Objetivo diario" : "Objetivo";
  const objectiveHint = tracking.planificado
    ? tracking.planificado.nombre || "Menu asignado activo"
    : tracking.objetivoSource === "metasActuales"
      ? "Metas actuales"
      : tracking.objetivoSource === "default"
        ? "Meta visual inicial"
        : "Sin menu asignado";

  const foods = useMemo(() => {
    const all = foodsQuery.data?.all || foodsQuery.data?.alimentos || [];
    const needle = search.trim().toLowerCase();
    return all
      .filter((food) => {
        if (!needle) return true;
        return `${food.nombre || food.name} ${food.fuente || food.source} ${food.macroGroup || ""}`
          .toLowerCase()
          .includes(needle);
      })
      .slice(0, 24);
  }, [foodsQuery.data, search]);

  function openAdd(mealId) {
    setModalMeal(mealId);
    setSearch("");
    setQuantity(100);
  }

  function shiftDate(days) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    setDate(toDateInputValue(next));
  }

  function addFood(food) {
    if (!modalMeal || addMutation.isPending) return;
    addMutation.mutate(
      {
        date,
        mealType: modalMeal,
        food: foodPayload(food),
        cantidad: quantity,
        unidad: food.unidad || food.unit || "g",
      },
      {
        onSuccess: () => {
          setModalMeal("");
          setToast({ type: "success", message: "Alimento guardado en tu diario." });
        },
        onError: (error) => {
          setToast({ type: "error", message: error?.message || "No se pudo agregar el alimento." });
        },
      }
    );
  }

  function updateQuantity(mealId, item, nextQuantity) {
    const quantityValue = Number(nextQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setToast({ type: "warning", message: "Ingresa una cantidad valida." });
      return;
    }

    updateMutation.mutate(
      {
        logId: item.id,
        date,
        mealType: mealId,
        cantidad: quantityValue,
        unidad: item.unidad || "g",
      },
      {
        onSuccess: () => setToast({ type: "success", message: "Cantidad actualizada." }),
        onError: (error) => setToast({ type: "error", message: error?.message || "No se pudo actualizar." }),
      }
    );
  }

  function removeFood(item) {
    if (!item?.id || deleteMutation.isPending) return;
    deleteMutation.mutate(
      { logId: item.id, date },
      {
        onSuccess: () => setToast({ type: "success", message: "Alimento eliminado." }),
        onError: (error) => setToast({ type: "error", message: error?.message || "No se pudo eliminar." }),
      }
    );
  }

  return (
    <div className="td-page">
      <section className="td-shell">
        <header className="td-hero">
          <div>
            <div className="td-kicker">
              <CalendarDays size={15} strokeWidth={2.3} aria-hidden="true" />
              Diario guardado
            </div>
            <h1>Tracking diario</h1>
            <p>Registra lo que comiste y compara tus macros reales contra tu objetivo diario.</p>
          </div>
          <div className="td-dateNav" aria-label="Selector de fecha">
            <button type="button" onClick={() => shiftDate(-1)} aria-label="Dia anterior">
              <ChevronLeft size={17} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <div className="td-date">{formatDateLabel(date)}</div>
            <button type="button" onClick={() => shiftDate(1)} aria-label="Dia siguiente">
              <ChevronRight size={17} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        </header>

        {trackingQuery.isLoading ? (
          <div className="td-saveNotice">
            <Loader2 size={16} className="td-spin" aria-hidden="true" />
            Cargando tu diario guardado...
          </div>
        ) : (
          <div className="td-saveNotice">
            <Flame size={16} aria-hidden="true" />
            {isSaving ? "Guardando cambios..." : "Los cambios se guardan en tu cuenta."}
          </div>
        )}
        {trackingQuery.error ? (
          <div className="td-error">No se pudo cargar el tracking diario.</div>
        ) : null}

        <section className="td-summary">
          <MacroProgress label="Kcal" value={totals.kcal} target={objective?.kcal} tone="kcal" />
          <MacroProgress label="Proteina" value={totals.proteina} target={objective?.proteina} suffix="g" tone="protein" />
          <MacroProgress label="Carbs" value={totals.carbs} target={objective?.carbs} suffix="g" tone="carbs" />
          <MacroProgress label="Grasas" value={totals.grasas} target={objective?.grasas} suffix="g" tone="fat" />
        </section>

        <section className="td-planCard">
          <div>
            <span>{objectiveTitle}</span>
            <strong>{objective ? macroLine(objective) : "Sin objetivo configurado"}</strong>
            <small>{objectiveHint}</small>
          </div>
          <div>
            <span>Registrado</span>
            <strong>{macroLine(totals)}</strong>
            <small>Totales recalculados en backend</small>
          </div>
          <div>
            <span>Restante</span>
            <strong>{remaining ? macroLine(remaining) : "Sin comparacion"}</strong>
            <small>{tracking.planificado ? "Contra menu asignado" : "Contra objetivo diario"}</small>
          </div>
        </section>

        <section className="td-meals">
          {MEALS.map((meal) => {
            const items = log[meal.id] || [];
            const mealTotals = totalItems(items);
            return (
              <article className="td-meal" key={meal.id}>
                <div className="td-mealHead">
                  <div>
                    <h2>{meal.label}</h2>
                    <p>{macroLine(mealTotals)}</p>
                  </div>
                  <button
                    type="button"
                    className="td-iconBtn"
                    onClick={() => openAdd(meal.id)}
                    aria-label={`Agregar en ${meal.label}`}
                  >
                    <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>

                {items.length ? (
                  <div className="td-foodList">
                    {items.map((item) => (
                      <div className="td-food" key={item.id}>
                        <div className="td-foodMain">
                          <strong>{item.nombreSnapshot}</strong>
                          <span>
                            {formatNumber(item.kcal)} kcal - P {formatNumber(item.proteina, 1)} / C{" "}
                            {formatNumber(item.carbs, 1)} / G {formatNumber(item.grasas, 1)}
                          </span>
                        </div>
                        <div className="td-foodActions">
                          <input
                            key={`${item.id}-${item.cantidad}`}
                            defaultValue={item.cantidad}
                            onBlur={(event) => updateQuantity(meal.id, item, event.target.value)}
                            aria-label="Cantidad"
                          />
                          <span>{item.unidad}</span>
                          <button
                            type="button"
                            onClick={() => removeFood(item)}
                            aria-label="Eliminar alimento"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={15} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="td-empty">Todavia no registraste alimentos en esta comida.</div>
                )}
              </article>
            );
          })}
        </section>
      </section>

      {modalMeal ? (
        <div className="td-modalBackdrop">
          <div className="td-modal">
            <div className="td-modalTop">
              <div>
                <span className="td-kicker">
                  <Utensils size={14} strokeWidth={2.3} aria-hidden="true" />
                  Agregar alimento
                </span>
                <h3>{MEALS.find((meal) => meal.id === modalMeal)?.label}</h3>
              </div>
              <button type="button" className="td-iconBtn" onClick={() => setModalMeal("")} aria-label="Cerrar">
                <X size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>

            <div className="td-addGrid">
              <label className="td-search">
                <Search size={16} strokeWidth={2.2} aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar arroz, pollo, yogur..." />
              </label>
              <label className="td-qty">
                <span>Cantidad</span>
                <input value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </label>
            </div>

            {foodsQuery.isLoading ? <div className="td-empty">Cargando alimentos...</div> : null}
            {foodsQuery.error ? <div className="td-error">No se pudieron cargar alimentos reales.</div> : null}

            <div className="td-foodPicker">
              {foods.map((food) => {
                const preview = buildMenuItemSnapshot(food, quantity, food.unidad || food.unit || "g");
                return (
                  <button
                    type="button"
                    className="td-pickCard"
                    key={food.id}
                    onClick={() => addFood(food)}
                    disabled={addMutation.isPending}
                  >
                    <strong>{food.nombre || food.name}</strong>
                    <span>
                      {formatNumber(preview.kcal)} kcal - P {formatNumber(preview.proteina, 1)} / C{" "}
                      {formatNumber(preview.carbs, 1)} / G {formatNumber(preview.grasas, 1)}
                    </span>
                  </button>
                );
              })}
            </div>

            {!foodsQuery.isLoading && !foods.length ? (
              <div className="td-empty">No encontre alimentos con esa busqueda.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function MacroProgress({ label, value, target, suffix = "", tone }) {
  const hasTarget = Number(target) > 0;
  const pct = hasTarget ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return (
    <div className={`td-macro ${tone}`}>
      <div className="td-macroTop">
        <span>{label}</span>
        <strong>
          {formatNumber(value, 0)}
          {suffix}
        </strong>
      </div>
      <div className="td-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <small>
        Objetivo {hasTarget ? formatNumber(target, 0) : "-"}
        {hasTarget ? suffix : ""}
      </small>
    </div>
  );
}

function emptyTrackingDay(date) {
  return {
    date,
    objetivo: null,
    objetivoSource: "",
    totals: emptyTotals(),
    remaining: null,
    planificado: null,
    meals: normalizeMeals({}),
  };
}

function normalizeMeals(raw = {}) {
  return MEALS.reduce((acc, meal) => {
    acc[meal.id] = Array.isArray(raw?.[meal.id]) ? raw[meal.id] : [];
    return acc;
  }, {});
}

function totalItems(items = []) {
  return items.reduce(
    (acc, item) =>
      addTotals(acc, {
        kcal: item.kcal,
        proteina: item.proteina,
        carbs: item.carbs,
        grasas: item.grasas,
      }),
    emptyTotals()
  );
}

function emptyTotals() {
  return { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };
}

function addTotals(a, b) {
  return {
    kcal: round((a.kcal || 0) + (b.kcal || 0)),
    proteina: round((a.proteina || 0) + (b.proteina || 0)),
    carbs: round((a.carbs || 0) + (b.carbs || 0)),
    grasas: round((a.grasas || 0) + (b.grasas || 0)),
  };
}

function remainingTotals(objective, totals) {
  if (!objective) return null;
  return {
    kcal: round((objective.kcal || 0) - (totals.kcal || 0)),
    proteina: round((objective.proteina || 0) - (totals.proteina || 0)),
    carbs: round((objective.carbs || 0) - (totals.carbs || 0)),
    grasas: round((objective.grasas || 0) - (totals.grasas || 0)),
  };
}

function macroLine(macros = {}) {
  return `${formatNumber(macros.kcal, 0)} kcal - P ${formatNumber(macros.proteina, 0)} / C ${formatNumber(macros.carbs, 0)} / G ${formatNumber(macros.grasas, 0)}`;
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function todayLocalString() {
  return toDateInputValue(new Date());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date) {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

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
  };
}
