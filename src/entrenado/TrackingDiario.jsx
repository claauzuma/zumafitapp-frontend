import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Crosshair,
  Flag,
  Loader2,
  MoreVertical,
  MoonStar,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Sun,
  Sunrise,
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
  useDeleteTrackingMeal,
  useMenuTrackingWeek,
  useTrackingDay,
  useUpdateFoodLog,
  useUpdateTrackingMealsConfig,
} from "../tracking/trackingQueries.js";
import "./trackingDiario.css";

const TRACKING_MEAL_TYPES = ["desayuno", "almuerzo", "merienda", "cena", "snack", "otra"];

const MEAL_TYPE_OPTIONS = [
  { value: "desayuno", label: "Desayuno" },
  { value: "almuerzo", label: "Almuerzo" },
  { value: "merienda", label: "Merienda" },
  { value: "cena", label: "Cena" },
  { value: "snack", label: "Snack" },
  { value: "otra", label: "Otra" },
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState([]);
  const [openMealMenu, setOpenMealMenu] = useState("");
  const [isDailySummaryExpanded, setIsDailySummaryExpanded] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [goalMealId, setGoalMealId] = useState("");
  const [goalDraft, setGoalDraft] = useState(() => emptyTotals());
  const [deleteMealCandidate, setDeleteMealCandidate] = useState(null);
  const [toast, setToast] = useState(null);

  const weekStart = useMemo(() => mondayOfWeek(date), [date]);
  const trackingQuery = useTrackingDay(date);
  const menuTrackingQuery = useMenuTrackingWeek(weekStart);
  const addMutation = useAddFoodLog();
  const updateMutation = useUpdateFoodLog();
  const deleteMutation = useDeleteFoodLog();
  const updateMealsMutation = useUpdateTrackingMealsConfig();
  const deleteMealMutation = useDeleteTrackingMeal();

  const isSaving =
    addMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    updateMealsMutation.isPending ||
    deleteMealMutation.isPending;
  const tracking = trackingQuery.data || emptyTrackingDay(date);
  const configuredMeals = useMemo(() => normalizeMealSettings(tracking.mealsConfig || []), [tracking.mealsConfig]);
  const log = useMemo(() => normalizeMeals(tracking.meals, configuredMeals), [tracking.meals, configuredMeals]);
  const meals = useMemo(() => mealsWithLoggedExtras(configuredMeals, log), [configuredMeals, log]);
  const trackedTotals = tracking.totals || emptyTotals();
  const menuTrackingDay = useMemo(
    () => (menuTrackingQuery.data?.days || []).find((day) => day.date === date) || null,
    [date, menuTrackingQuery.data]
  );
  const menuConsumedTotals = useMemo(() => normalizeMenuConsumedTotals(menuTrackingDay), [menuTrackingDay]);
  const totals = useMemo(() => addTotals(trackedTotals, menuConsumedTotals), [menuConsumedTotals, trackedTotals]);
  const objective = tracking.objetivo || null;
  const remaining = remainingTotals(objective, totals);
  const issues = useMemo(() => trackingIssues(objective, totals), [objective, totals]);

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
  const diaryStatusText = trackingQuery.isLoading
    ? "Cargando diario"
    : isSaving
      ? "Guardando cambios"
      : "Diario guardado";

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

  useEffect(() => {
    if (!openMealMenu) return undefined;

    function closeMenuFromOutside(event) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-td-meal-menu]")) return;
      setOpenMealMenu("");
    }

    function closeMenuWithEscape(event) {
      if (event.key === "Escape") setOpenMealMenu("");
    }

    document.addEventListener("pointerdown", closeMenuFromOutside);
    document.addEventListener("keydown", closeMenuWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuFromOutside);
      document.removeEventListener("keydown", closeMenuWithEscape);
    };
  }, [openMealMenu]);

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
    const selectedMeal = meals.find((meal) => meal.id === modalMeal);
    if (!selectedMeal) {
      setToast({ type: "error", message: "Primero crea la comida donde queres cargar el alimento." });
      return;
    }
    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setToast({ type: "warning", message: "Ingresa una cantidad valida." });
      return;
    }
    const payload = {
      date,
      mealId: selectedMeal.id,
      mealType: selectedMeal.type,
      mealName: selectedMeal.label,
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
    setSettingsDraft(normalizeMealSettings(configuredMeals));
    setSettingsOpen(true);
  }

  function saveSettings() {
    const next = normalizeMealSettings(settingsDraft);
    updateMealsMutation.mutate(
      { date, mealsConfig: toBackendMealsConfig(next) },
      {
        onSuccess: () => {
          setSettingsOpen(false);
          setToast({ type: "success", message: "Ajustes de comidas guardados para este dia." });
        },
        onError: (error) => setToast({ type: "error", message: error?.message || "No se pudieron guardar los ajustes." }),
      }
    );
  }

  function updateQuantity(meal, item, nextQuantity) {
    const quantityValue = Number(nextQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setToast({ type: "warning", message: "Ingresa una cantidad valida." });
      return;
    }

    updateMutation.mutate(
      {
        logId: item.id,
        date,
        mealId: meal.id,
        mealType: meal.type,
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

  function clearMeal(mealId, items = []) {
    if (!items.length || deleteMutation.isPending) {
      setToast({ type: "warning", message: "No hay alimentos para vaciar." });
      return;
    }
    items.forEach((item) => {
      if (item?.id) deleteMutation.mutate({ logId: item.id, date });
    });
    setOpenMealMenu("");
    setToast({ type: "success", message: "Comida vaciada." });
  }

  function persistMealsConfig(nextMeals, successMessage = "Cambios guardados.") {
    updateMealsMutation.mutate(
      { date, mealsConfig: toBackendMealsConfig(nextMeals) },
      {
        onSuccess: () => setToast({ type: "success", message: successMessage }),
        onError: (error) => setToast({ type: "error", message: error?.message || "No se pudo guardar la comida." }),
      }
    );
  }

  function createMealSection(type, customName = "") {
    const safeType = normalizeTrackingMealType(type);
    if (!safeType) return;
    const current = normalizeMealSettings(configuredMeals);
    const newMeal = createMealConfig(safeType, customName, current);
    const next = [...current, newMeal];
    setAddMealOpen(false);
    persistMealsConfig(next, `${newMeal.label} agregada al diario.`);
  }

  function openMealGoal(meal) {
    setOpenMealMenu("");
    setGoalMealId(meal.id);
    setGoalDraft(sanitizeTotals(meal.target || {}));
  }

  function saveMealGoal() {
    const target = sanitizeTotals(autofillMealGoalCalories(goalDraft));
    const next = normalizeMealSettings(configuredMeals).map((meal) => (
      meal.id === goalMealId ? { ...meal, target } : meal
    ));
    setGoalMealId("");
    persistMealsConfig(next, hasMealTarget(target) ? "Meta de comida guardada." : "Meta de comida quitada.");
  }

  function removeMealGoal(mealId) {
    const next = normalizeMealSettings(configuredMeals).map((meal) => (
      meal.id === mealId ? { ...meal, target: emptyTotals() } : meal
    ));
    setOpenMealMenu("");
    setGoalMealId("");
    persistMealsConfig(next, "Meta de comida quitada.");
  }

  function requestDeleteMeal(meal, items = []) {
    setOpenMealMenu("");
    setDeleteMealCandidate({ meal, itemsCount: items.length });
  }

  function confirmDeleteMeal() {
    const meal = deleteMealCandidate?.meal;
    if (!meal?.id || deleteMealMutation.isPending) return;
    deleteMealMutation.mutate(
      { date, mealId: meal.id },
      {
        onSuccess: () => {
          setDeleteMealCandidate(null);
          setToast({ type: "success", message: `${meal.label} eliminada del dia.` });
        },
        onError: (error) => setToast({ type: "error", message: error?.message || "No se pudo eliminar la comida." }),
      }
    );
  }

  function calculateRemainingTargets() {
    if (!objective) {
      setToast({ type: "warning", message: "No hay una meta diaria para calcular el restante." });
      return;
    }

    const positiveRemaining = positiveTotals(remaining || emptyTotals());
    if (!hasPositiveTotals(positiveRemaining)) {
      setToast({ type: "info", message: "No queda restante para distribuir." });
      return;
    }

    const emptyMeals = meals.filter((meal) => !(log[meal.id] || []).length);
    const targetMeals = emptyMeals.length ? emptyMeals : meals.filter((meal) => !hasMealTarget(meal.target));
    if (!targetMeals.length) {
      setToast({ type: "warning", message: "No hay comidas pendientes para calcular el restante." });
      return;
    }

    const distribution = distributeRemainingTarget(positiveRemaining, targetMeals.length);
    const targetsByMealId = new Map(targetMeals.map((meal, index) => [meal.id, distribution[index] || emptyTotals()]));
    const next = normalizeMealSettings(configuredMeals).map((meal) => (
      targetsByMealId.has(meal.id) ? { ...meal, target: targetsByMealId.get(meal.id) } : meal
    ));

    persistMealsConfig(
      next,
      targetMeals.length === 1
        ? `Restante asignado a ${targetMeals[0].label}.`
        : `Restante distribuido en ${targetMeals.length} comidas.`
    );
  }

  function mealMenuFeedback(label) {
    setOpenMealMenu("");
    setToast({ type: "info", message: `${label} va a estar disponible desde el flujo de comidas guardadas.` });
  }

  return (
    <div className="td-page">
      <section className="td-shell">
        <header className="td-hero">
          <div>
            <div className="td-kicker">
              <CalendarDays size={15} strokeWidth={2.3} aria-hidden="true" />
              {diaryStatusText}
            </div>
            <h1>Tracking diario</h1>
            <p>Registra lo que comiste y compara tus macros reales contra tu objetivo diario.</p>
          </div>
        </header>

        <div className="td-dateNav" aria-label="Selector de fecha">
          <button type="button" onClick={() => shiftDate(-1)} aria-label="Dia anterior">
            <ChevronLeft size={21} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <div className="td-date">
            <CalendarDays size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>{formatDateLabel(date)}</span>
          </div>
          <button type="button" onClick={() => shiftDate(1)} aria-label="Dia siguiente">
            <ChevronRight size={21} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </div>

        <button type="button" className="td-actionRow" onClick={openSettings}>
          <span className="td-actionIcon">
            <SlidersHorizontal size={20} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span>Ajustes</span>
          <ChevronRight size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>

        {trackingQuery.error ? (
          <div className="td-error">No se pudo cargar el tracking diario.</div>
        ) : null}

        <DailySummaryCard
          expanded={isDailySummaryExpanded}
          onToggle={() => setIsDailySummaryExpanded((current) => !current)}
          menuTotals={menuConsumedTotals}
          objective={objective || emptyTotals()}
          remaining={remaining || emptyTotals()}
          totals={totals}
        />

        <button
          type="button"
          className="td-calcRemainingBtn"
          onClick={calculateRemainingTargets}
          disabled={updateMealsMutation.isPending}
        >
          <Crosshair size={18} strokeWidth={2.3} aria-hidden="true" />
          <span>
            <strong>Calcular restante</strong>
            <small>Distribuir lo que falta entre las comidas pendientes</small>
          </span>
        </button>

        {issues.length ? <TrackingIssueList issues={issues} /> : null}

        <section className={`td-meals ${meals.length ? "" : "is-empty"}`}>
          {meals.length ? meals.map((meal) => {
            const items = log[meal.id] || [];
            const mealTotals = totalItems(items);
            const mealMenuOpen = openMealMenu === meal.id;
            const mealHasTarget = hasMealTarget(meal.target);
            return (
              <article className={`td-meal ${mealMenuOpen ? "menu-open" : ""}`} key={meal.id}>
                <div className="td-mealHead">
                  <div className="td-mealTitleRow">
                    <MealTypeBadge type={meal.type} />
                    <div>
                      <h2>{meal.label}</h2>
                      <p>{macroLine(mealTotals)}</p>
                      <div className="td-mealMeta">
                        <span>{mealTypeLabel(meal.type)}</span>
                        {mealHasTarget ? <span className="goal">Meta {mealTargetLine(meal.target)}</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="td-mealButtons">
                    <button
                      type="button"
                      className="td-iconBtn add"
                      onClick={() => openAdd(meal.id)}
                      aria-label={`Agregar en ${meal.label}`}
                    >
                      <Plus size={23} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                    <div className="td-menuWrap" data-td-meal-menu>
                      <button
                        type="button"
                        className={`td-iconBtn menu ${mealMenuOpen ? "active" : ""}`}
                        onClick={() => setOpenMealMenu((current) => current === meal.id ? "" : meal.id)}
                        aria-expanded={mealMenuOpen}
                        aria-label={`Opciones de ${meal.label}`}
                      >
                        <MoreVertical size={22} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                      {mealMenuOpen ? (
                        <MealOptionsMenu
                          onSaveMeal={() => mealMenuFeedback("Guardar como comida")}
                          onFavorite={() => mealMenuFeedback("Guardar como favorita")}
                          onUseSaved={() => mealMenuFeedback("Usar comida guardada")}
                          onGenerate={() => mealMenuFeedback("Generar comida segun objetivo")}
                          hasTarget={mealHasTarget}
                          onSetGoal={() => openMealGoal(meal)}
                          onRemoveGoal={() => removeMealGoal(meal.id)}
                          onClear={() => clearMeal(meal.id, items)}
                          onDeleteMeal={() => requestDeleteMeal(meal, items)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                {items.length ? (
                  <div className="td-foodList">
                    {items.map((item) => (
                      <div className="td-food" key={item.id}>
                        <FoodLogThumb item={item} />
                        <div className="td-foodMain">
                          <strong>{item.nombreSnapshot}</strong>
                          <span>
                            {formatNumber(item.kcal)} kcal
                          </span>
                          <small>
                            P {formatNumber(item.proteina, 1)}g · C {formatNumber(item.carbs, 1)}g · G {formatNumber(item.grasas, 1)}g
                          </small>
                        </div>
                        <div className="td-foodActions">
                          <label>
                            <input
                              key={`${item.id}-${item.cantidad}`}
                              defaultValue={item.cantidad}
                              onBlur={(event) => updateQuantity(meal, item, event.target.value)}
                              aria-label="Cantidad"
                            />
                            <span>{item.unidad}</span>
                          </label>
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
                  <button type="button" className="td-emptyMeal" onClick={() => openAdd(meal.id)}>
                    <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
                    <span>Todavia no registraste alimentos en esta comida</span>
                    <strong>Agregar alimento</strong>
                  </button>
                )}
              </article>
            );
          }) : (
            <div className="td-dayEmpty">
              <span className="td-addMealIcon">
                <Plus size={22} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <div>
                <strong>Todavia no hay comidas en este dia</strong>
                <p>Agrega la primera seccion y carga alimentos cuando los registres.</p>
              </div>
              <button type="button" className="td-primaryBtn" onClick={() => setAddMealOpen(true)}>
                <Plus size={17} />
                Agregar comida
              </button>
            </div>
          )}

          {meals.length ? (
            <button type="button" className="td-addMealCard" onClick={() => setAddMealOpen(true)}>
              <span className="td-addMealIcon">
                <Plus size={22} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span>
                <strong>Agregar comida</strong>
                <small>Crear una nueva seccion para snack u otra comida del dia.</small>
              </span>
            </button>
          ) : null}
        </section>
      </section>

      {deleteMealCandidate ? (
        <div className="td-modalBackdrop">
          <div className="td-modal td-compactModal">
            <div className="td-modalTop">
              <div>
                <span className="td-kicker">
                  <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                  Eliminar comida
                </span>
                <h3>{deleteMealCandidate.meal?.label}</h3>
              </div>
              <button type="button" className="td-iconBtn" onClick={() => setDeleteMealCandidate(null)} aria-label="Cerrar">
                <X size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
            <p className="td-confirmText">
              {deleteMealCandidate.itemsCount
                ? `Esta comida tiene ${deleteMealCandidate.itemsCount} alimento${deleteMealCandidate.itemsCount > 1 ? "s" : ""}. Se van a borrar la card, su meta y sus alimentos del dia.`
                : "Se va a borrar la card y su meta de este dia."}
            </p>
            <div className="td-modalActions">
              <button type="button" className="td-secondaryBtn" onClick={() => setDeleteMealCandidate(null)}>
                Cancelar
              </button>
              <button type="button" className="td-dangerBtn" onClick={confirmDeleteMeal} disabled={deleteMealMutation.isPending}>
                {deleteMealMutation.isPending ? <Loader2 size={17} className="td-spin" /> : <Trash2 size={17} />}
                Eliminar comida
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {addMealOpen ? (
        <AddMealTypeModal
          onClose={() => setAddMealOpen(false)}
          onCreate={createMealSection}
        />
      ) : null}

      {goalMealId ? (
        <MealGoalModal
          meal={meals.find((meal) => meal.id === goalMealId)}
          draft={goalDraft}
          remaining={remaining || emptyTotals()}
          setDraft={setGoalDraft}
          onClose={() => setGoalMealId("")}
          onSave={saveMealGoal}
          onRemove={() => removeMealGoal(goalMealId)}
        />
      ) : null}

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function MealTypeBadge({ type = "" }) {
  const normalized = String(type || "").toLowerCase();
  const Icon = normalized === "desayuno"
    ? Sunrise
    : normalized === "almuerzo"
      ? Sun
      : normalized === "cena"
        ? MoonStar
        : Utensils;
  return (
    <span className={`td-mealBadge ${normalized || "otra"}`} aria-hidden="true">
      <Icon size={24} strokeWidth={1.9} />
    </span>
  );
}

function MealOptionsMenu({
  hasTarget,
  onSaveMeal,
  onFavorite,
  onUseSaved,
  onGenerate,
  onSetGoal,
  onRemoveGoal,
  onClear,
  onDeleteMeal,
}) {
  return (
    <div className="td-mealMenu" role="menu">
      <button type="button" onClick={onSaveMeal} role="menuitem">
        <Bookmark size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>Guardar como comida</span>
      </button>
      <button type="button" onClick={onFavorite} role="menuitem">
        <Star size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>Guardar como favorita</span>
      </button>
      <button type="button" onClick={onUseSaved} role="menuitem">
        <ClipboardList size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>Usar comida guardada</span>
      </button>
      <button type="button" onClick={onGenerate} role="menuitem">
        <Crosshair size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>Generar comida segun objetivo</span>
      </button>
      <button type="button" onClick={onSetGoal} role="menuitem">
        <Flag size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>{hasTarget ? "Editar meta de esta comida" : "Definir meta de esta comida"}</span>
      </button>
      {hasTarget ? (
        <button type="button" onClick={onRemoveGoal} role="menuitem">
          <X size={20} strokeWidth={2.2} aria-hidden="true" />
          <span>Quitar meta de esta comida</span>
        </button>
      ) : null}
      <span className="td-menuDivider" aria-hidden="true" />
      <button type="button" className="danger" onClick={onClear} role="menuitem">
        <Trash2 size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>Vaciar comida</span>
      </button>
      <button type="button" className="danger strong" onClick={onDeleteMeal} role="menuitem">
        <Trash2 size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>Eliminar comida</span>
      </button>
    </div>
  );
}

function AddMealTypeModal({ onClose, onCreate }) {
  const [selectedType, setSelectedType] = useState("snack");
  const [customName, setCustomName] = useState("");
  const selectedLabel = mealTypeLabel(selectedType);

  function confirmCreate() {
    onCreate(selectedType, customName);
  }

  return (
    <div className="td-modalBackdrop">
      <div className="td-modal td-compactModal">
        <div className="td-modalTop">
          <div>
            <span className="td-kicker">
              <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
              Nueva comida
            </span>
            <h3>Agregar comida</h3>
          </div>
          <button type="button" className="td-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <div className="td-typeGrid">
          {MEAL_TYPE_OPTIONS.map((option) => (
            <button
              type="button"
              className={selectedType === option.value ? "active" : ""}
              key={option.value}
              onClick={() => setSelectedType(option.value)}
            >
              <MealTypeBadge type={option.value} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <label className="td-nameField">
          <span>Nombre opcional</span>
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder={selectedLabel}
          />
        </label>

        <button type="button" className="td-primaryBtn" onClick={confirmCreate}>
          <Plus size={17} />
          Crear {customName.trim() || selectedLabel}
        </button>
      </div>
    </div>
  );
}

function MealGoalModal({ meal, draft, remaining, setDraft, onClose, onSave, onRemove }) {
  const title = meal?.label || "Comida";
  const macroKcal = macroCaloriesFromTotals(draft || {});
  const hasMacroDraft = macroKcal > 0;
  const kcalValue = hasMacroDraft ? inputNumber(macroKcal) : draft?.kcal;
  const remainingKcal = Number(remaining?.kcal) || 0;
  const exceedsRemaining = remainingKcal > 0 && Number(kcalValue) > remainingKcal;

  function update(key, value) {
    setDraft((current) => ({
      ...autofillMealGoalCalories({
        ...(current || emptyTotals()),
        [key]: value,
      }),
    }));
  }

  return (
    <div className="td-modalBackdrop">
      <div className="td-modal td-compactModal">
        <div className="td-modalTop">
          <div>
            <span className="td-kicker">
              <Flag size={14} strokeWidth={2.4} aria-hidden="true" />
              Meta por comida
            </span>
            <h3>{title}</h3>
          </div>
          <button type="button" className="td-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <p className="td-goalIntro">Defini una meta sutil para esta comida. Si queda vacia, no se muestra nada en la card.</p>

        <div className="td-goalGrid">
          <TargetInput
            label="Kcal"
            value={kcalValue}
            onChange={(value) => update("kcal", value)}
            placeholder={hasMacroDraft ? "Auto" : "Libre"}
            readOnly={hasMacroDraft}
          />
          <TargetInput label="Proteina" value={draft?.proteina} onChange={(value) => update("proteina", value)} />
          <TargetInput label="Carbs" value={draft?.carbs} onChange={(value) => update("carbs", value)} />
          <TargetInput label="Grasas" value={draft?.grasas} onChange={(value) => update("grasas", value)} />
        </div>

        {hasMacroDraft ? (
          <div className="td-goalAutoNote">
            Kcal calculadas desde macros: P x4 + C x4 + G x9.
          </div>
        ) : null}

        {exceedsRemaining ? (
          <div className="td-goalWarning">
            <AlertTriangle size={16} strokeWidth={2.4} aria-hidden="true" />
            <span>
              Esta meta supera las kcal restantes del dia: {displayCompactKcal(remainingKcal)} disponibles.
            </span>
          </div>
        ) : null}

        <div className="td-modalActions">
          <button type="button" className="td-secondaryBtn" onClick={onRemove}>
            <X size={16} strokeWidth={2.4} />
            Quitar meta
          </button>
          <button type="button" className="td-primaryBtn" onClick={onSave}>
            <CheckCircle2 size={17} />
            Guardar meta
          </button>
        </div>
      </div>
    </div>
  );
}

function FoodLogThumb({ item = {} }) {
  const [failed, setFailed] = useState(false);
  const src = item.imagenUrl || item.imageUrl || item.imagen?.url || "";
  const fallback = getFoodImageUrl({
    nombre: item.nombreSnapshot,
    name: item.nombreSnapshot,
    categoria: item.categoriaSnapshot,
  });
  const initial = String(item.nombreSnapshot || "?").trim().charAt(0).toUpperCase() || "?";

  if (failed || (!src && !fallback)) {
    return <span className="td-foodThumb fallback" aria-hidden="true">{initial}</span>;
  }

  return (
    <img
      className="td-foodThumb"
      src={src || fallback}
      alt={item.nombreSnapshot || "Alimento"}
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        if (fallback && event.currentTarget.src !== fallback && !event.currentTarget.src.endsWith(fallback)) {
          event.currentTarget.src = fallback;
          return;
        }
        setFailed(true);
      }}
    />
  );
}

function DailySummaryCard({ expanded, onToggle, menuTotals = emptyTotals(), objective, totals, remaining }) {
  const target = objective || emptyTotals();
  const consumed = totals || emptyTotals();
  const rest = remaining || emptyTotals();
  const hasMenuTotals = hasPositiveTotals(menuTotals);
  const progress = macroProgressPct(consumed.kcal, target.kcal);
  const progressLabel = Math.round(progress);
  const hasKcalTarget = Number(target.kcal) > 0;
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;
  const primaryMetrics = [
    {
      label: "Objetivo",
      value: hasKcalTarget ? displayCompactKcal(target.kcal) : "Libre",
      tone: "goal",
    },
    {
      label: "Consumido",
      value: displayCompactKcal(consumed.kcal),
      tone: "consumed",
    },
    {
      label: "Restante",
      value: hasKcalTarget ? displayCompactKcal(rest.kcal) : "-",
      tone: "remaining",
    },
  ];

  return (
    <section className={`td-dailySummary ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="td-dailySummaryToggle"
        aria-expanded={expanded}
        aria-controls="td-daily-summary-detail"
        onClick={onToggle}
      >
        <span className="td-dailySummaryContent">
          <span className="td-dailySummaryLabelRow">
            <span className="td-dailySummaryTitle">Resumen diario</span>
          </span>
          <span className="td-dailySummaryMetrics" aria-label="Resumen de calorias">
            {primaryMetrics.map((metric) => (
              <span className={`td-dailyMetric ${metric.tone}`} key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label.toLowerCase()}</span>
              </span>
            ))}
          </span>
          <span className="td-dailySummaryMacroPills">
            <span>
              <small>Consumidos</small>
              <strong>{macroLineCurrent(consumed)}</strong>
            </span>
            {hasKcalTarget ? (
              <span>
                <small>Restantes</small>
                <strong>{macroLineCurrent(rest)}</strong>
              </span>
            ) : null}
            {hasMenuTotals ? (
              <span className="menu">
                <small>Menu hecho</small>
                <strong>{displayCompactKcal(menuTotals.kcal)} · {macroLineCurrent(menuTotals)}</strong>
              </span>
            ) : null}
          </span>
        </span>
        <span className="td-dailySummarySide">
          <span
            className="td-dailySummaryPct"
            style={{
              background: `conic-gradient(#ffe25e ${progress * 3.6}deg, rgba(255,255,255,0.13) 0deg)`,
            }}
            aria-hidden="true"
          >
            <span>
              <strong>{progressLabel}%</strong>
              <small>cumplimiento</small>
            </span>
          </span>
          <span className="td-dailySummaryChevron">
            <ChevronIcon size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="td-dailySummaryDetail" id="td-daily-summary-detail">
          <span className="td-dailySummaryDetailTitle">Progreso de macros</span>
          <div className="td-summaryMetricGrid">
            <MacroProgress label="Calorías" value={consumed.kcal} target={target.kcal} suffix="kcal" tone="kcal" />
            <MacroProgress label="Proteína" value={consumed.proteina} target={target.proteina} suffix="g" tone="protein" />
            <MacroProgress label="Carbs" value={consumed.carbs} target={target.carbs} suffix="g" tone="carbs" />
            <MacroProgress label="Grasas" value={consumed.grasas} target={target.grasas} suffix="g" tone="fat" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MacroProgress({ label, value, target, suffix = "", tone }) {
  const pct = macroProgressPct(value, target);

  return (
    <div className={`td-summaryMetric ${tone}`}>
      <div className="td-summaryMetricTop">
        <span className="td-summaryMetricName">{label}</span>
        <strong>{progressValueLabel(value, target, suffix)}</strong>
      </div>
      <div className="td-summaryBar">
        <span style={{ width: `${pct}%` }} />
      </div>
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
    const safeCount = Math.max(0, Math.min(8, Number(nextCount) || 0));
    const next = [...normalized];
    while (next.length < safeCount) {
      const type = nextAvailableMealType(next);
      next.push(createMealConfig(type, "", next));
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
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
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
                  <select value={meal.type || "otra"} onChange={(event) => updateMeal(index, { type: event.target.value })}>
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

function TargetInput({ label, value, onChange, placeholder = "Libre", readOnly = false }) {
  return (
    <label className="td-targetInput">
      <span>{label}</span>
      <input
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        readOnly={readOnly}
      />
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
    mealsConfig: [],
    meals: {},
  };
}

function normalizeMeals(raw = {}, meals = []) {
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
  const input = Array.isArray(value) ? value : [];
  const used = new Set();
  return input.slice(0, 24).map((meal, index) => {
    const type = normalizeTrackingMealType(meal.type || meal.tipo || meal.mealType) || normalizeTrackingMealType(meal.id) || "snack";
    let id = normalizeMealId(meal.id || meal.mealId || meal.mealConfigId);
    if (!id) id = createMealId(type);
    if (used.has(id)) id = createMealId(type);
    used.add(id);
    return {
      id,
      label: String(meal.label || meal.nombre || meal.name || mealTypeLabel(type) || `Comida ${index + 1}`).trim() || `Comida ${index + 1}`,
      type,
      target: sanitizeTotals(meal.target || meal.meta || {}),
      order: Number.isFinite(Number(meal.order ?? meal.orden)) ? Number(meal.order ?? meal.orden) : index,
    };
  }).sort((a, b) => (a.order || 0) - (b.order || 0)).map((meal, index) => ({ ...meal, order: index }));
}

function mealsWithLoggedExtras(meals = [], log = {}) {
  const known = new Set(meals.map((meal) => meal.id));
  const extras = Object.keys(log || {})
    .filter((key) => !known.has(key) && Array.isArray(log[key]) && log[key].length)
    .map((key) => {
      const first = (log[key] || [])[0] || {};
      const type = normalizeTrackingMealType(first.mealType || key) || "snack";
      return {
      id: key,
      label: mealTypeLabel(type),
      type,
      target: emptyTotals(),
      order: meals.length,
    };
    });
  return [...meals, ...extras];
}

function createMealConfig(type = "snack", customName = "", existingMeals = []) {
  const safeType = normalizeTrackingMealType(type) || "snack";
  return {
    id: createMealId(safeType),
    label: cleanMealName(customName) || mealTypeLabel(safeType),
    type: safeType,
    target: emptyTotals(),
    order: existingMeals.length,
  };
}

function toBackendMealsConfig(meals = []) {
  return normalizeMealSettings(meals).map((meal, index) => ({
    mealId: meal.id,
    tipo: meal.type,
    nombre: meal.label,
    orden: index,
    meta: hasMealTarget(meal.target) ? sanitizeTotalsForServer(meal.target) : null,
  }));
}

function createMealId(type = "snack") {
  const random =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${normalizeTrackingMealType(type) || "meal"}_${random}`;
}

function normalizeMealId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
}

function cleanMealName(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);
}

function sanitizeTotalsForServer(value = {}) {
  const safe = sanitizeTotals(value);
  return {
    kcal: Number(safe.kcal) || 0,
    proteina: Number(safe.proteina) || 0,
    carbs: Number(safe.carbs) || 0,
    grasas: Number(safe.grasas) || 0,
  };
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

function normalizeMenuConsumedTotals(day = null) {
  const tracking = day?.tracking || {};
  const consumed = totalsFromAny(tracking.consumedTotals || {});
  if (hasPositiveTotals(consumed)) return consumed;
  return (tracking.completedMenuMeals || []).reduce((acc, meal) => addTotals(acc, totalsFromAny(meal)), emptyTotals());
}

function totalsFromAny(value = {}) {
  const safe = value && typeof value === "object" ? value : {};
  const nested = safe.totals || safe.totales || safe.macros || safe.macrosTotales || {};
  return {
    kcal: round(readNumber(nested.kcal ?? nested.calorias ?? safe.kcal ?? safe.calorias ?? safe.calories)),
    proteina: round(readNumber(nested.proteina ?? nested.proteinas ?? nested.p ?? safe.proteina ?? safe.proteinas ?? safe.p)),
    carbs: round(readNumber(nested.carbs ?? nested.carbohidratos ?? nested.c ?? safe.carbs ?? safe.carbohidratos ?? safe.c)),
    grasas: round(readNumber(nested.grasas ?? nested.g ?? safe.grasas ?? safe.g)),
  };
}

function readNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveTotals(value = {}) {
  const totals = totalsFromAny(value);
  return {
    kcal: Math.max(0, totals.kcal),
    proteina: Math.max(0, totals.proteina),
    carbs: Math.max(0, totals.carbs),
    grasas: Math.max(0, totals.grasas),
  };
}

function hasPositiveTotals(value = {}) {
  const totals = positiveTotals(value);
  return Boolean(totals.kcal || totals.proteina || totals.carbs || totals.grasas);
}

function macroCaloriesFromTotals(value = {}) {
  const totals = totalsFromAny(value);
  return round((totals.proteina || 0) * 4 + (totals.carbs || 0) * 4 + (totals.grasas || 0) * 9);
}

function autofillMealGoalCalories(value = {}) {
  const next = { ...(value || {}) };
  const macroKcal = macroCaloriesFromTotals(next);
  if (macroKcal > 0) next.kcal = inputNumber(macroKcal);
  return next;
}

function distributeRemainingTarget(remaining = {}, count = 1) {
  const safeCount = Math.max(1, Number(count) || 1);
  const base = balancedRemainingTarget(remaining);
  const keys = ["kcal", "proteina", "carbs", "grasas"];
  const rows = Array.from({ length: safeCount }, () => emptyTotals());

  keys.forEach((key) => {
    const values = splitNumber(base[key], safeCount);
    values.forEach((value, index) => {
      rows[index][key] = value;
    });
  });

  return rows.map((row) => autofillMealGoalCalories(row));
}

function balancedRemainingTarget(remaining = {}) {
  const positive = positiveTotals(remaining);
  const macroKcal = macroCaloriesFromTotals(positive);

  if (macroKcal > 0) {
    const factor = positive.kcal > 0 && macroKcal > positive.kcal ? positive.kcal / macroKcal : 1;
    const scaled = {
      kcal: 0,
      proteina: round(positive.proteina * factor),
      carbs: round(positive.carbs * factor),
      grasas: round(positive.grasas * factor),
    };
    return {
      ...scaled,
      kcal: macroCaloriesFromTotals(scaled),
    };
  }

  return {
    kcal: positive.kcal,
    proteina: 0,
    carbs: 0,
    grasas: 0,
  };
}

function splitNumber(value = 0, count = 1) {
  const safeCount = Math.max(1, Number(count) || 1);
  const total = round(Math.max(0, Number(value) || 0));
  const base = Math.floor((total / safeCount) * 10) / 10;
  const values = Array.from({ length: safeCount }, () => base);
  values[safeCount - 1] = round(total - base * (safeCount - 1));
  return values;
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

function macroLineCurrent(macros = {}) {
  return `P ${formatNumber(macros.proteina, 0)} / C ${formatNumber(macros.carbs, 0)} / G ${formatNumber(macros.grasas, 0)}`;
}

function macroProgressPct(value, target) {
  const targetValue = Number(target);
  if (!Number.isFinite(targetValue) || targetValue <= 0) return 0;
  const currentValue = Number(value) || 0;
  return Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
}

function progressValueLabel(value, target, suffix = "") {
  const unit = suffix ? ` ${suffix}` : "";
  if (Number(target) > 0) return `${formatNumber(value, 0)} / ${formatNumber(target, 0)}${unit}`;
  return `${formatNumber(value, 0)}${unit}`;
}

function displayCompactKcal(value) {
  return `${formatNumber(value, 0)} kcal`;
}

function inputNumber(value) {
  const number = round(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return Number.isInteger(number) ? String(number) : String(number);
}

function mealTargetLine(target = {}) {
  const safe = sanitizeTotals(target);
  const parts = [];
  if (safe.kcal) parts.push(`${formatNumber(safe.kcal, 0)} kcal`);
  if (safe.proteina) parts.push(`P ${formatNumber(safe.proteina, 0)}`);
  if (safe.carbs) parts.push(`C ${formatNumber(safe.carbs, 0)}`);
  if (safe.grasas) parts.push(`G ${formatNumber(safe.grasas, 0)}`);
  return parts.join(" / ");
}

function hasMealTarget(target = {}) {
  const safe = sanitizeTotals(target);
  return Boolean(safe.kcal || safe.proteina || safe.carbs || safe.grasas);
}

function normalizeTrackingMealType(value = "") {
  const token = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (token === "libre" || token === "otro") return "otra";
  return TRACKING_MEAL_TYPES.includes(token) ? token : "";
}

function nextAvailableMealType(meals = []) {
  const used = new Set((meals || []).map((meal) => meal.type || meal.id).filter(Boolean));
  return TRACKING_MEAL_TYPES.find((type) => !used.has(type)) || "otra";
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

function mondayOfWeek(date) {
  const parsed = new Date(`${date}T12:00:00`);
  const day = parsed.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  parsed.setDate(parsed.getDate() + diff);
  return toDateInputValue(parsed);
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
