import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { listAlimentos } from "../nutricion/nutricionApi.js";
import { buildMenuItemSnapshot, formatNumber, getFoodImageUrl } from "../nutricion/nutricionUtils.js";
import AppToast from "../ui/AppToast.jsx";
import {
  useAddFoodLog,
  useDeleteFoodLog,
  useTrackingDay,
  useUpdateFoodLog,
} from "../tracking/trackingQueries.js";
import "./trackingDiario.css";

const TRACKING_MEAL_SETTINGS_KEY = "zumafit_tracking_meal_settings_v1";

const DEFAULT_MEALS = [
  { id: "desayuno", label: "Desayuno", type: "desayuno", target: emptyTotals() },
  { id: "almuerzo", label: "Almuerzo", type: "almuerzo", target: emptyTotals() },
  { id: "merienda", label: "Merienda", type: "merienda", target: emptyTotals() },
  { id: "cena", label: "Cena", type: "cena", target: emptyTotals() },
];

const MEAL_TYPE_OPTIONS = [
  { value: "desayuno", label: "Desayuno" },
  { value: "almuerzo", label: "Almuerzo" },
  { value: "merienda", label: "Merienda" },
  { value: "cena", label: "Cena" },
  { value: "snack", label: "Snack" },
  { value: "libre", label: "Libre" },
];

export default function TrackingDiario() {
  const [date, setDate] = useState(todayLocalString());
  const [modalMeal, setModalMeal] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [foodSearchError, setFoodSearchError] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("100");
  const [mealSettings, setMealSettings] = useState(() => loadMealSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(() => loadMealSettings());
  const [toast, setToast] = useState(null);

  const trackingQuery = useTrackingDay(date);
  const addMutation = useAddFoodLog();
  const updateMutation = useUpdateFoodLog();
  const deleteMutation = useDeleteFoodLog();

  const isSaving = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const tracking = trackingQuery.data || emptyTrackingDay(date);
  const configuredMeals = useMemo(() => normalizeMealSettings(mealSettings), [mealSettings]);
  const log = useMemo(() => normalizeMeals(tracking.meals, configuredMeals), [tracking.meals, configuredMeals]);
  const meals = useMemo(() => mealsWithLoggedExtras(configuredMeals, log), [configuredMeals, log]);
  const totals = tracking.totals || emptyTotals();
  const objective = tracking.objetivo || null;
  const remaining = tracking.remaining || remainingTotals(objective, totals);
  const issues = useMemo(() => trackingIssues(objective, totals), [objective, totals]);
  const objectiveTitle = tracking.planificado ? "Planificado" : objective ? "Objetivo diario" : "Objetivo";
  const objectiveHint = tracking.planificado
    ? tracking.planificado.nombre || "Menu asignado activo"
    : tracking.objetivoSource === "metasActuales"
      ? "Metas actuales"
      : tracking.objetivoSource === "default"
        ? "Meta visual inicial"
        : "Sin menu asignado";

  const searchReady = debouncedSearch.trim().length >= 2;
  const selectedPreview = useMemo(() => {
    if (!selectedFood) return null;
    const selectedQuantity = Number(quantity);
    if (!Number.isFinite(selectedQuantity) || selectedQuantity <= 0) return null;
    return buildMenuItemSnapshot(selectedFood, selectedQuantity, selectedFood.unidad || selectedFood.unit || "g");
  }, [quantity, selectedFood]);
  const projectedIssues = useMemo(() => {
    if (!selectedPreview) return [];
    return trackingIssues(objective, addTotals(totals, selectedPreview));
  }, [objective, selectedPreview, totals]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!modalMeal) return undefined;
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
    listAlimentos({ search: term, limit: 12 })
      .then((data) => {
        if (!active) return;
        setFoodResults((data?.alimentos || data?.all || []).slice(0, 12));
      })
      .catch((error) => {
        if (!active) return;
        setFoodSearchError(error?.message || "No se pudieron buscar alimentos.");
        setFoodResults([]);
      })
      .finally(() => {
        if (active) setFoodsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, modalMeal]);

  function openAdd(mealId) {
    setModalMeal(mealId);
    setSearch("");
    setDebouncedSearch("");
    setFoodResults([]);
    setFoodSearchError("");
    setSelectedFood(null);
    setQuantity("100");
  }

  function shiftDate(days) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    setDate(toDateInputValue(next));
  }

  function addFood() {
    if (!modalMeal || !selectedFood || addMutation.isPending) return;
    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setToast({ type: "warning", message: "Ingresa una cantidad valida." });
      return;
    }
    const payload = {
      date,
      mealType: modalMeal,
      food: foodPayload(selectedFood),
      cantidad: quantityValue,
      unidad: selectedFood.unidad || selectedFood.unit || "g",
    };

    setModalMeal("");
    setSearch("");
    setDebouncedSearch("");
    setFoodResults([]);
    setFoodSearchError("");
    setSelectedFood(null);
    setQuantity("100");

    addMutation.mutate(
      payload,
      {
        onSuccess: () => {
          setToast({ type: "success", message: "Alimento guardado en tu diario." });
        },
        onError: (error) => {
          setToast({ type: "error", message: error?.message || "No se pudo agregar el alimento." });
        },
      }
    );
  }

  function openSettings() {
    setSettingsDraft(normalizeMealSettings(mealSettings));
    setSettingsOpen(true);
  }

  function saveSettings() {
    const next = normalizeMealSettings(settingsDraft);
    setMealSettings(next);
    saveMealSettings(next);
    setSettingsOpen(false);
    setToast({ type: "success", message: "Ajustes de comidas guardados." });
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
          <div className="td-heroTools">
            <div className="td-dateNav" aria-label="Selector de fecha">
              <button type="button" onClick={() => shiftDate(-1)} aria-label="Dia anterior">
                <ChevronLeft size={17} strokeWidth={2.4} aria-hidden="true" />
              </button>
              <div className="td-date">{formatDateLabel(date)}</div>
              <button type="button" onClick={() => shiftDate(1)} aria-label="Dia siguiente">
                <ChevronRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
            <button type="button" className="td-settingsBtn" onClick={openSettings}>
              <SlidersHorizontal size={17} />
              Ajustes
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

        <section className="td-goalCard">
          <div className="td-goalMain">
            <span>{objectiveTitle}</span>
            <strong>{objective ? macroLine(objective) : "Sin objetivo configurado"}</strong>
            <small>{objectiveHint}</small>
          </div>
          <div className="td-goalStats">
            <MiniTotals label="Registrado" totals={totals} />
            <MiniTotals label="Restante" totals={remaining} muted={!remaining} />
          </div>
        </section>

        <section className="td-summary">
          <MacroProgress label="Kcal" value={totals.kcal} target={objective?.kcal} tone="kcal" />
          <MacroProgress label="Proteina" value={totals.proteina} target={objective?.proteina} suffix="g" tone="protein" />
          <MacroProgress label="Carbs" value={totals.carbs} target={objective?.carbs} suffix="g" tone="carbs" />
          <MacroProgress label="Grasas" value={totals.grasas} target={objective?.grasas} suffix="g" tone="fat" />
        </section>

        {issues.length ? <TrackingIssueList issues={issues} /> : null}

        <section className="td-meals">
          {meals.map((meal) => {
            const items = log[meal.id] || [];
            const mealTotals = totalItems(items);
            return (
              <article className="td-meal" key={meal.id}>
                <div className="td-mealHead">
                  <div>
                    <h2>{meal.label}</h2>
                    <p>{macroLine(mealTotals)}</p>
                    <div className="td-mealMeta">
                      <span>{mealTypeLabel(meal.type)}</span>
                      <span>{mealTargetLine(meal.target)}</span>
                    </div>
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
                  <div className="td-empty compact">Todavia no registraste alimentos en esta comida.</div>
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
                <h3>{meals.find((meal) => meal.id === modalMeal)?.label}</h3>
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
            </div>

            {!searchReady ? (
              <div className="td-empty compact">Escribi al menos 2 letras para buscar en la base real.</div>
            ) : null}
            {foodsLoading ? <div className="td-empty compact"><Loader2 size={15} className="td-spin" /> Buscando alimentos...</div> : null}
            {foodSearchError ? <div className="td-error">{foodSearchError}</div> : null}

            {searchReady && foodResults.length ? (
              <div className="td-foodPicker">
                {foodResults.map((food) => {
                  const active = selectedFood && foodIdOf(selectedFood) === foodIdOf(food);
                return (
                  <button
                    type="button"
                    className={`td-pickCard ${active ? "active" : ""}`}
                    key={foodIdOf(food)}
                    onClick={() => setSelectedFood(food)}
                    disabled={addMutation.isPending}
                  >
                    <strong>{food.nombre || food.name}</strong>
                    <span>{foodMacroPreview(food)}</span>
                    {active ? <CheckCircle2 size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                  </button>
                );
                })}
              </div>
            ) : null}

            {searchReady && !foodsLoading && !foodResults.length && !foodSearchError ? (
              <div className="td-empty compact">No encontre alimentos con esa busqueda.</div>
            ) : null}

            {selectedFood ? (
              <section className="td-selectedFood">
                <div>
                  <span>Seleccionado</span>
                  <strong>{selectedFood.nombre || selectedFood.name}</strong>
                  <small>{selectedPreview ? macroLine(selectedPreview) : "Indica una cantidad valida"}</small>
                </div>
                <label className="td-qty inline">
                  <span>Cantidad</span>
                  <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" />
                  <small>{selectedFood.unidad || selectedFood.unit || "g"}</small>
                </label>
              </section>
            ) : null}

            {projectedIssues.length ? <TrackingIssueList issues={projectedIssues} compact /> : null}

            <button
              type="button"
              className="td-primaryBtn"
              disabled={!selectedFood || addMutation.isPending}
              onClick={addFood}
            >
              {addMutation.isPending ? <Loader2 size={17} className="td-spin" /> : <Plus size={17} />}
              Agregar al diario
            </button>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <MealSettingsDrawer
          settings={settingsDraft}
          onChange={setSettingsDraft}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
        />
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

function MiniTotals({ label, totals, muted = false }) {
  return (
    <div className={`td-miniTotals ${muted ? "muted" : ""}`}>
      <span>{label}</span>
      <strong>{totals ? displayCompactKcal(totals.kcal) : "-"}</strong>
      <small>{totals ? macroLineShort(totals) : "Sin comparacion"}</small>
    </div>
  );
}

function TrackingIssueList({ issues = [], compact = false }) {
  if (!issues.length) return null;
  return (
    <div className={`td-issues ${compact ? "compact" : ""}`}>
      {issues.map((issue) => (
        <div key={`${issue.type}-${issue.message}`} className={`td-issue ${issue.tone}`}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function MealSettingsDrawer({ settings, onChange, onClose, onSave }) {
  const normalized = normalizeMealSettings(settings);
  const count = normalized.length;

  function setCount(nextCount) {
    const safeCount = Math.max(1, Math.min(6, Number(nextCount) || 4));
    const next = [...normalized];
    while (next.length < safeCount) {
      const index = next.length;
      next.push({
        id: `comida-${index + 1}`,
        label: `Comida ${index + 1}`,
        type: "libre",
        target: emptyTotals(),
      });
    }
    onChange(next.slice(0, safeCount));
  }

  function updateMeal(index, patch) {
    onChange(normalized.map((meal, mealIndex) => (
      mealIndex === index ? { ...meal, ...patch } : meal
    )));
  }

  function updateTarget(index, key, value) {
    const meal = normalized[index] || {};
    updateMeal(index, {
      target: {
        ...(meal.target || emptyTotals()),
        [key]: value,
      },
    });
  }

  return (
    <div className="td-modalBackdrop">
      <div className="td-modal td-settingsModal">
        <div className="td-modalTop">
          <div>
            <span className="td-kicker">
              <SlidersHorizontal size={14} strokeWidth={2.3} aria-hidden="true" />
              Ajustes del diario
            </span>
            <h3>Comidas y metas</h3>
          </div>
          <button type="button" className="td-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <section className="td-settingsIntro">
          <div>
            <span>Cantidad de comidas</span>
            <strong>{count}</strong>
          </div>
          <select value={count} onChange={(event) => setCount(event.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>{value} comida{value > 1 ? "s" : ""}</option>
            ))}
          </select>
        </section>

        <div className="td-settingsList">
          {normalized.map((meal, index) => (
            <article className="td-settingMeal" key={meal.id || index}>
              <div className="td-settingGrid">
                <label>
                  <span>Nombre</span>
                  <input
                    value={meal.label}
                    onChange={(event) => updateMeal(index, { label: event.target.value })}
                    placeholder={`Comida ${index + 1}`}
                  />
                </label>
                <label>
                  <span>Tipo</span>
                  <select value={meal.type || "libre"} onChange={(event) => updateMeal(index, { type: event.target.value })}>
                    {MEAL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="td-targetGrid">
                <TargetInput label="Kcal" value={meal.target?.kcal} onChange={(value) => updateTarget(index, "kcal", value)} />
                <TargetInput label="P" value={meal.target?.proteina} onChange={(value) => updateTarget(index, "proteina", value)} />
                <TargetInput label="C" value={meal.target?.carbs} onChange={(value) => updateTarget(index, "carbs", value)} />
                <TargetInput label="G" value={meal.target?.grasas} onChange={(value) => updateTarget(index, "grasas", value)} />
              </div>
            </article>
          ))}
        </div>

        <div className="td-settingsHint">
          Deja una meta vacia para que esa comida quede libre. El control importante sigue siendo la meta total del dia.
        </div>

        <button type="button" className="td-primaryBtn" onClick={onSave}>
          <CheckCircle2 size={17} />
          Guardar ajustes
        </button>
      </div>
    </div>
  );
}

function TargetInput({ label, value, onChange }) {
  return (
    <label className="td-targetInput">
      <span>{label}</span>
      <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} inputMode="decimal" placeholder="Libre" />
    </label>
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

function normalizeMeals(raw = {}, meals = DEFAULT_MEALS) {
  const base = meals.reduce((acc, meal) => {
    acc[meal.id] = Array.isArray(raw?.[meal.id]) ? raw[meal.id] : [];
    return acc;
  }, {});
  Object.entries(raw || {}).forEach(([key, value]) => {
    if (!base[key] && Array.isArray(value)) base[key] = value;
  });
  return base;
}

function normalizeMealSettings(value = []) {
  const input = Array.isArray(value) && value.length ? value : DEFAULT_MEALS;
  return input.slice(0, 6).map((meal, index) => ({
    id: String(meal.id || `comida-${index + 1}`),
    label: String(meal.label || meal.name || `Comida ${index + 1}`).trim() || `Comida ${index + 1}`,
    type: String(meal.type || "libre"),
    target: sanitizeTotals(meal.target || {}),
  }));
}

function mealsWithLoggedExtras(meals = [], log = {}) {
  const known = new Set(meals.map((meal) => meal.id));
  const extras = Object.keys(log || {})
    .filter((key) => !known.has(key) && Array.isArray(log[key]) && log[key].length)
    .map((key) => ({
      id: key,
      label: mealTypeLabel(key),
      type: key,
      target: emptyTotals(),
    }));
  return [...meals, ...extras];
}

function loadMealSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(TRACKING_MEAL_SETTINGS_KEY) || "null");
    return normalizeMealSettings(stored);
  } catch {
    return normalizeMealSettings(DEFAULT_MEALS);
  }
}

function saveMealSettings(settings) {
  try {
    localStorage.setItem(TRACKING_MEAL_SETTINGS_KEY, JSON.stringify(normalizeMealSettings(settings)));
  } catch {
    // localStorage puede no estar disponible en todos los entornos.
  }
}

function sanitizeTotals(value = {}) {
  return {
    kcal: optionalNumber(value.kcal),
    proteina: optionalNumber(value.proteina),
    carbs: optionalNumber(value.carbs),
    grasas: optionalNumber(value.grasas),
  };
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : "";
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

function macroLineShort(macros = {}) {
  return `P ${formatNumber(macros.proteina, 0)} / C ${formatNumber(macros.carbs, 0)} / G ${formatNumber(macros.grasas, 0)}`;
}

function displayCompactKcal(value) {
  return `${formatNumber(value, 0)} kcal`;
}

function mealTargetLine(target = {}) {
  const safe = sanitizeTotals(target);
  if (!safe.kcal && !safe.proteina && !safe.carbs && !safe.grasas) return "Meta libre";
  const parts = [];
  if (safe.kcal) parts.push(`${formatNumber(safe.kcal, 0)} kcal`);
  if (safe.proteina) parts.push(`P ${formatNumber(safe.proteina, 0)}`);
  if (safe.carbs) parts.push(`C ${formatNumber(safe.carbs, 0)}`);
  if (safe.grasas) parts.push(`G ${formatNumber(safe.grasas, 0)}`);
  return parts.join(" / ");
}

function mealTypeLabel(value = "") {
  const found = MEAL_TYPE_OPTIONS.find((option) => option.value === value);
  if (found) return found.label;
  return String(value || "Comida").replace(/[-_]/g, " ");
}

function foodIdOf(food = {}) {
  return String(food.id || food._id || food.alimentoId || food.nombre || food.name || "");
}

function foodMacroPreview(food = {}) {
  const kcal = food.kcal ?? food.calorias ?? food.calories ?? 0;
  const protein = food.proteina ?? food.protein ?? 0;
  const carbs = food.carbs ?? food.carbohidratos ?? 0;
  const fat = food.grasas ?? food.fat ?? 0;
  return `${formatNumber(kcal, 0)} kcal - P ${formatNumber(protein, 1)} / C ${formatNumber(carbs, 1)} / G ${formatNumber(fat, 1)} por ${food.unidad || food.unit || "g"}`;
}

function trackingIssues(objective, totals = {}) {
  if (!objective) return [];
  const issues = [];
  const kcalTarget = Number(objective.kcal) || 0;
  const proteinTarget = Number(objective.proteina) || 0;
  const kcal = Number(totals.kcal) || 0;
  const protein = Number(totals.proteina) || 0;
  const kcalRemaining = kcalTarget - kcal;
  const proteinRemaining = Math.max(0, proteinTarget - protein);

  if (kcalTarget && kcal > kcalTarget + 25) {
    issues.push({
      type: "kcal-over",
      tone: "bad",
      message: `Te pasaste ${formatNumber(kcal - kcalTarget, 0)} kcal de la meta diaria.`,
    });
  }

  if (proteinTarget && proteinRemaining > 5 && kcalTarget && kcalRemaining < proteinRemaining * 4) {
    issues.push({
      type: "protein-risk",
      tone: "warn",
      message: "Con las calorias que quedan no llegarias a la proteina objetivo. Conviene ajustar la comida.",
    });
  }

  return issues;
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
    imagen: food.imagen,
    imagenUrl: getFoodImageUrl(food),
  };
}
