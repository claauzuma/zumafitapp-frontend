import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Apple,
  Calculator,
  CheckSquare2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Eye,
  MoreHorizontal,
  Moon,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Square,
  Sun,
  Sunrise,
  Target,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { apiFetch } from "../../Api.js";
import { getFoodEquivalents } from "../../menus/menusApi.js";
import { generateMealQuantities, listAlimentos } from "../../nutricion/nutricionApi.js";

const EMPTY_DAYS = [];
const MENU_EMOJI = "\u{1F37D}\uFE0F";
const MENU_BOX_EMOJI = "\u{1F371}";
const EYE_EMOJI = "\u{1F441}\uFE0F";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfWeek(value = todayIso()) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const diff = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function macro(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function displayKcal(value) {
  return `${formatNumber(macro(value))} kcal`;
}

function displayMacros(target = {}) {
  const safeTarget = target && typeof target === "object" ? target : {};
  return `P ${formatNumber(macro(safeTarget.p ?? safeTarget.proteina), 1)} g / C ${formatNumber(macro(safeTarget.c ?? safeTarget.carbs), 1)} g / G ${formatNumber(macro(safeTarget.g ?? safeTarget.grasas), 1)} g`;
}

function displayMenuMacros(totals = {}) {
  const safeTotals = totals && typeof totals === "object" ? totals : {};
  return `P ${formatNumber(macro(safeTotals.proteina ?? safeTotals.protein), 1)} / C ${formatNumber(macro(safeTotals.carbs), 1)} / G ${formatNumber(macro(safeTotals.grasas ?? safeTotals.fat), 1)}`;
}

function signed(value, suffix = "") {
  const number = Math.round(macro(value) * 10) / 10;
  if (!number) return `0${suffix}`;
  return `${number > 0 ? "+" : ""}${formatNumber(number, 1)}${suffix}`;
}

function statusMeta(row) {
  const status = row?.tracking?.status || "pending";
  if (status === "completed") return { label: "Cumplido", tone: "green", percent: 100 };
  if (status === "in_progress") return { label: "En progreso", tone: "blue", percent: row.tracking?.adherencePercent ?? null };
  if (status === "exceeded") return { label: "Excedido", tone: "red", percent: row.tracking?.adherencePercent ?? null };
  if (status === "partial") return { label: "Parcial", tone: "amber", percent: row.tracking?.adherencePercent ?? 50 };
  if (status === "missed") return { label: "No cumplido", tone: "red", percent: 0 };
  return { label: "Pendiente", tone: "slate", percent: null };
}

function menuState(row) {
  const hasMenu = Boolean(row?.assignment?.primaryMenu);
  if (!hasMenu) return { label: "Sin menú", tone: "slate" };
  const targetKcal = macro(row?.target?.kcal);
  const menuKcal = macro(row?.menuTotals?.kcal);
  const proteinDiff = macro(row?.compatibility?.proteinDiff);
  const diff = menuKcal - targetKcal;
  if (targetKcal && Math.abs(diff) <= targetKcal * 0.08 && proteinDiff >= -8) return { label: "Cerca de la meta", tone: "green" };
  if (targetKcal && diff > targetKcal * 0.1) return { label: "Excede kcal", tone: "red" };
  if (targetKcal && diff < -targetKcal * 0.12) return { label: "Bajo en kcal", tone: "amber" };
  if (proteinDiff < -10) return { label: "Bajo en proteína", tone: "amber" };
  return { label: "Revisar", tone: "amber" };
}

function toneClass(tone) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (tone === "red") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (tone === "amber") return "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]";
  if (tone === "blue") return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function progressTone(row) {
  const state = menuState(row);
  if (state.tone === "green") return "from-emerald-400 to-lime-300";
  if (state.tone === "red") return "from-rose-400 to-orange-300";
  if (state.tone === "amber") return "from-[#D4AF37] to-orange-300";
  return "from-zinc-600 to-zinc-500";
}

function menuSnapshot(row) {
  return row?.assignment?.primaryMenu?.menuSnapshot || null;
}

function menuChoices(row) {
  const choices = [];
  const primary = row?.assignment?.primaryMenu;
  if (primary?.menuSnapshot) {
    choices.push({
      key: primary.menuId || primary.menuSnapshot.id || "primary",
      type: "primary",
      label: "Menu principal",
      snapshot: primary.menuSnapshot,
      totals: row?.menuTotals || primary.menuSnapshot.totals || primary.menuSnapshot,
    });
  }
  const alternatives = Array.isArray(row?.assignment?.alternatives) ? row.assignment.alternatives : [];
  alternatives.forEach((alternative, index) => {
    const snapshot = alternative?.menuSnapshot || {};
    if (!snapshot || !Object.keys(snapshot).length) return;
    choices.push({
      key: alternative.menuId || snapshot.id || `alternative-${index}`,
      type: "alternative",
      index,
      label: `Alternativa ${index + 1}`,
      snapshot,
      totals: snapshot.totals || {
        kcal: snapshot.kcal,
        proteina: snapshot.protein,
        carbs: snapshot.carbs,
        grasas: snapshot.fat,
      },
    });
  });
  return choices;
}

function selectedAlternativeIndex(row = {}) {
  const value = row?.tracking?.selectedAlternative?.index;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function choiceMeals(choice = {}) {
  return choice?.snapshot ? snapshotMeals(choice.snapshot) : [];
}

function choiceTotals(choice = {}) {
  const totals = choice?.totals || choice?.snapshot?.totals || choice?.snapshot || {};
  return totalFromLike({
    kcal: totals.kcal,
    proteina: totals.proteina ?? totals.protein,
    carbs: totals.carbs,
    grasas: totals.grasas ?? totals.fat,
  });
}

function choiceStatus(row = {}, choice = {}) {
  const target = targetTotals(row);
  const totals = choiceTotals(choice);
  if (!choice?.snapshot) return { label: "Sin menú", tone: "slate" };
  const diff = totals.kcal - target.kcal;
  if (target.kcal && Math.abs(diff) <= target.kcal * 0.08) return { label: "Cerca de la meta", tone: "green" };
  if (target.kcal && diff > target.kcal * 0.1) return { label: "Excede kcal", tone: "red" };
  if (target.kcal && diff < -target.kcal * 0.12) return { label: "Bajo en kcal", tone: "amber" };
  return { label: "Revisar", tone: "amber" };
}

function menuCountTitle(row) {
  const choices = menuChoices(row);
  if (!choices.length) return "Sin menu asignado";
  if (choices.length === 1) return choices[0].snapshot?.name || "Menu asignado";
  return `Total menus (${choices.length})`;
}

function dayHeading(row) {
  if (!row) return "";
  return row.date === todayIso() ? `Hoy, ${row.dayLabel}` : row.dayLabel;
}

function snapshotMeals(snapshot = {}) {
  const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  if (Array.isArray(safeSnapshot.meals)) return safeSnapshot.meals;
  if (Array.isArray(safeSnapshot.comidas)) return safeSnapshot.comidas;
  return [];
}

function mealName(meal = {}, index = 0) {
  const safeMeal = meal && typeof meal === "object" ? meal : {};
  return safeMeal.name || safeMeal.nombre || safeMeal.tipoComida || safeMeal.type || `Comida ${index + 1}`;
}

function mealTotals(meal = {}) {
  const safeMeal = meal && typeof meal === "object" ? meal : {};
  const totals = safeMeal.totales || safeMeal.totals || safeMeal;
  return {
    kcal: macro(totals.kcal),
    proteina: macro(totals.proteina ?? totals.protein),
    carbs: macro(totals.carbs),
    grasas: macro(totals.grasas ?? totals.fat),
  };
}

function mealId(meal = {}, index = 0) {
  return String(meal.id || meal._id || meal.nombre || meal.name || `meal-${index + 1}`);
}

function emptyTotals() {
  return { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };
}

function totalFromLike(value = {}) {
  return {
    kcal: macro(value.kcal),
    proteina: macro(value.proteina ?? value.protein),
    carbs: macro(value.carbs),
    grasas: macro(value.grasas ?? value.fat),
  };
}

function sumTotals(items = []) {
  return items.reduce((acc, item) => {
    const totals = totalFromLike(item?.totals || item);
    return {
      kcal: acc.kcal + totals.kcal,
      proteina: acc.proteina + totals.proteina,
      carbs: acc.carbs + totals.carbs,
      grasas: acc.grasas + totals.grasas,
    };
  }, emptyTotals());
}

function targetTotals(row = {}) {
  return {
    kcal: macro(row?.target?.kcal),
    proteina: macro(row?.target?.p ?? row?.target?.proteina),
    carbs: macro(row?.target?.c ?? row?.target?.carbs),
    grasas: macro(row?.target?.g ?? row?.target?.grasas),
  };
}

function consumedTotals(row = {}) {
  const trackingTotals = row?.tracking?.consumedTotals;
  if (trackingTotals) return totalFromLike(trackingTotals);
  return emptyTotals();
}

function remainingTotals(row = {}) {
  if (row?.tracking?.remainingTotals) return totalFromLike(row.tracking.remainingTotals);
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  return {
    kcal: target.kcal - consumed.kcal,
    proteina: target.proteina - consumed.proteina,
    carbs: target.carbs - consumed.carbs,
    grasas: target.grasas - consumed.grasas,
  };
}

function positiveTotals(totals = {}) {
  return {
    kcal: Math.max(0, macro(totals.kcal)),
    proteina: Math.max(0, macro(totals.proteina ?? totals.protein)),
    carbs: Math.max(0, macro(totals.carbs)),
    grasas: Math.max(0, macro(totals.grasas ?? totals.fat)),
  };
}

function completedMealIdSet(row = {}) {
  return new Set(Array.isArray(row?.tracking?.completedMenuMealIds) ? row.tracking.completedMenuMealIds.map(String) : []);
}

function useIsMobileMenuLayout() {
  const query = "(max-width: 1023px)";
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return matches;
}

function compactDayLabel(row = {}) {
  return row?.dayLabel || dayHeading(row).replace(/^Hoy,\s*/i, "") || "Día";
}

function completionPercent(row = {}) {
  const status = statusMeta(row);
  if (Number.isFinite(Number(status.percent))) {
    return Math.max(0, Math.min(100, Math.round(Number(status.percent))));
  }
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  if (!target.kcal) return 0;
  return Math.max(0, Math.min(100, Math.round((consumed.kcal / target.kcal) * 100)));
}

function trackingLabel(row = {}) {
  const label = statusMeta(row).label;
  return label === "Cumplido" ? "Completo" : label;
}

function mealFoods(meal = {}) {
  const items = Array.isArray(meal.items)
    ? meal.items
    : Array.isArray(meal.foods)
      ? meal.foods
      : Array.isArray(meal.alimentos)
        ? meal.alimentos
        : [];
  return items.map(normalizeMealFood);
}

function normalizeMealFood(item = {}, index = 0) {
  const safeItem = item && typeof item === "object" ? item : {};
  const name =
    safeItem.nombreSnapshot ||
    safeItem.name ||
    safeItem.nombre ||
    safeItem.alimento ||
    safeItem.label ||
    `Alimento ${index + 1}`;
  const cantidad = safeItem.cantidad ?? safeItem.quantity ?? safeItem.qty;
  const unidad = safeItem.unidad || safeItem.unit || "";
  const amount = safeItem.amount || foodAmount(cantidad, unidad);
  return {
    id: String(safeItem.id || safeItem._id || safeItem.alimentoId || `${name}-${index}`),
    alimentoId: safeItem.alimentoId || safeItem.foodId || safeItem.id || null,
    name,
    amount,
    unidad,
    cantidad,
    totals: totalFromLike({
      kcal: safeItem.kcal,
      proteina: safeItem.proteina ?? safeItem.protein,
      carbs: safeItem.carbs,
      grasas: safeItem.grasas ?? safeItem.fat,
    }),
    category: safeItem.categoriaSnapshot || safeItem.categoria || safeItem.category || "",
    raw: safeItem,
  };
}

function foodAmount(cantidad, unidad = "") {
  const value = Number(cantidad);
  if (!Number.isFinite(value) || value <= 0) return "";
  const digits = Math.abs(value - Math.round(value)) > 0.05 ? 1 : 0;
  return `${formatNumber(value, digits)} ${unidad || ""}`.trim();
}

function foodMacroLine(food = {}) {
  const totals = food.totals || totalFromLike(food);
  const pieces = [];
  if (totals.kcal) pieces.push(displayKcal(totals.kcal));
  if (totals.proteina || totals.carbs || totals.grasas) {
    pieces.push(`P ${formatNumber(totals.proteina, 0)} / C ${formatNumber(totals.carbs, 0)} / G ${formatNumber(totals.grasas, 0)}`);
  }
  return pieces.join(" · ");
}

function mealIconType(meal = {}, index = 0) {
  const text = `${mealName(meal, index)} ${meal.tipoComida || meal.type || ""}`.toLowerCase();
  if (text.includes("desayuno")) return "breakfast";
  if (text.includes("almuerzo")) return "lunch";
  if (text.includes("merienda") || text.includes("snack")) return "snack";
  if (text.includes("cena")) return "dinner";
  return "meal";
}

function trackingPayloadBase(row = {}, overrides = {}) {
  const tracking = row.tracking || {};
  return {
    date: row.date,
    dayKey: row.dayKey,
    completedMenuMealIds: Array.isArray(tracking.completedMenuMealIds) ? tracking.completedMenuMealIds : [],
    manualEntries: Array.isArray(tracking.manualEntries) ? tracking.manualEntries : [],
    generatedRemainingMeals: Array.isArray(tracking.generatedRemainingMeals) ? tracking.generatedRemainingMeals : [],
    selectedAlternative: tracking.selectedAlternative || null,
    ...overrides,
  };
}

function foodPerUnit(food = {}, key = "kcal") {
  const value = macro(food[key] ?? (key === "proteina" ? food.protein : key === "grasas" ? food.fat : 0));
  const basis = food.macroBasis || food.raw?.macroBasis || "";
  const unit = String(food.unidad || food.unit || "g").toLowerCase();
  const isPer100 = basis === "per100" || (unit === "g" && basis !== "perUnit");
  return isPer100 ? value / 100 : value;
}

function normalizeGeneratedFood(food = {}) {
  return {
    id: String(food.foodId || food.id || food.name || food.nombre || Math.random()),
    name: food.name || food.nombre || "Alimento",
    quantity: macro(food.quantity ?? food.cantidad),
    unit: food.unit || food.unidad || "g",
    kcal: macro(food.kcal),
    proteina: macro(food.proteina ?? food.protein),
    carbs: macro(food.carbs),
    grasas: macro(food.grasas ?? food.fat),
  };
}

async function getMenuTrackingWeek(start) {
  const qs = start ? `?start=${encodeURIComponent(start)}` : "";
  return await apiFetch(`/api/usuarios/me/menu-tracking/week${qs}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

async function saveMenuTrackingDay(payload) {
  return await apiFetch("/api/usuarios/me/menu-tracking/day", {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });
}

export default function MenuPlan() {
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek());
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [mobileView, setMobileView] = useState("overview");
  const [mobileDetailChoiceKey, setMobileDetailChoiceKey] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [remainingDraft, setRemainingDraft] = useState(null);
  const [mealDrawer, setMealDrawer] = useState(null);
  const [foodDrawer, setFoodDrawer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const isMobileLayout = useIsMobileMenuLayout();

  async function loadWeek(start = weekStart) {
    setLoading(true);
    setError("");
    try {
      const data = await getMenuTrackingWeek(start);
      setWeekData(data);
      setDetailRow((current) => current ? (data?.days || []).find((day) => day.date === current.date) || current : current);
      const dates = new Set((data?.days || []).map((day) => day.date));
      if (!dates.has(selectedDate)) {
        setSelectedDate(dates.has(todayIso()) ? todayIso() : data?.days?.[0]?.date || start);
      }
    } catch (err) {
      setError(err?.message || "No se pudo cargar tu menú.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeek(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const days = Array.isArray(weekData?.days) ? weekData.days : EMPTY_DAYS;
  const todayRow = useMemo(
    () => days.find((day) => day.date === todayIso()) || days[0] || null,
    [days]
  );
  const selectedRow = useMemo(
    () => days.find((day) => day.date === selectedDate) || todayRow,
    [days, selectedDate, todayRow]
  );
  const permissions = weekData?.permissions || {};
  const canMarkMeals = permissions.canMarkMenuMealsCompleted !== false;
  const canAutoCompleteRemaining = permissions.canAutoCompleteRemainingMeals !== false;

  function moveSelectedDay(amount) {
    const baseDate = selectedRow?.date || todayRow?.date || todayIso();
    const nextDate = addDays(baseDate, amount);
    setSelectedDate(nextDate);
    const nextWeek = mondayOfWeek(nextDate);
    if (nextWeek !== weekStart) setWeekStart(nextWeek);
  }

  async function submitTracking(payload, message = "Registro guardado.") {
    if (!payload?.date) return;
    setSaving(true);
    try {
      await saveMenuTrackingDay(payload);
      await loadWeek(weekStart);
      setToast(message);
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  function toggleMenuMeal(row, meal, index) {
    const id = mealId(meal, index);
    const ids = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    submitTracking(
      trackingPayloadBase(row, {
        completedMenuMealIds: [...ids],
      }),
      ids.has(id) ? "Comida marcada como cumplida." : "Comida desmarcada."
    );
  }

  function useAlternative(row, index) {
    submitTracking(
      trackingPayloadBase(row, {
        selectedAlternative: { index },
      }),
      "Alternativa marcada para hoy."
    );
  }

  function saveGeneratedRemaining(row, generatedMeals) {
    const current = Array.isArray(row?.tracking?.generatedRemainingMeals) ? row.tracking.generatedRemainingMeals : [];
    submitTracking(
      trackingPayloadBase(row, {
        generatedRemainingMeals: [...current, ...generatedMeals],
      }),
      "Comidas restantes guardadas."
    );
    setRemainingDraft(null);
  }

  function markDayMissed(row) {
    submitTracking(
      trackingPayloadBase(row, {
        status: "missed",
        completedMenuMealIds: [],
        manualEntries: [],
        generatedRemainingMeals: [],
      }),
      "Día marcado como no cumplido."
    );
  }

  return (
    <div
      className="min-h-screen bg-[#070707] px-0 pb-24 pt-4 text-zinc-100 sm:px-6 sm:pt-5"
      style={{ background: "#070707", color: "#f4f4f5", minHeight: "60vh" }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-3 sm:gap-5">
        {toast ? (
          <div className="fixed right-4 top-4 z-50 max-w-sm rounded-3xl border border-[#D4AF37]/35 bg-[#11151c] px-4 py-3 text-sm font-bold text-[#FFE8A3] shadow-2xl">
            {toast}
          </div>
        ) : null}

        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={() => loadWeek(weekStart)} /> : null}

        {!loading && !error && weekData ? (
          isMobileLayout ? (
            mobileView === "detail" ? (
              <MobileDayDetailView
                row={selectedRow}
                detailChoiceKey={mobileDetailChoiceKey}
                onBack={() => setMobileView("overview")}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onToggleMeal={toggleMenuMeal}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                onOpenFood={(payload) => setFoodDrawer(payload)}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                saving={saving}
              />
            ) : mobileView === "alternatives" ? (
              <MobileAlternativesView
                row={selectedRow}
                onBack={() => setMobileView("overview")}
                onViewDetail={(choice) => {
                  setMobileDetailChoiceKey(choice?.key || "");
                  setMobileView("detail");
                }}
                onUseAlternative={useAlternative}
                saving={saving}
              />
            ) : (
              <MobileDayMenu
                row={selectedRow}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onOpenDetail={() => {
                  setMobileDetailChoiceKey("");
                  setMobileView("detail");
                }}
                onOpenAlternatives={() => setMobileView("alternatives")}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                saving={saving}
              />
            )
          ) : (
            <>
              <TodayHero
                row={selectedRow}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onView={() => setDetailRow(selectedRow)}
                onToggleMeal={toggleMenuMeal}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                saving={saving}
              />

              <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="grid gap-4">
                  <WeeklySelector
                    days={days}
                    selectedDate={selectedRow?.date}
                    onSelect={(row) => setSelectedDate(row.date)}
                    onView={setDetailRow}
                  />
                </div>

                <div>
                  <DayDetail
                    row={selectedRow}
                    onMarkMissed={markDayMissed}
                    onToggleMeal={toggleMenuMeal}
                    onOpenRemaining={() => setRemainingDraft(selectedRow)}
                    canMarkMeals={canMarkMeals}
                    canAutoCompleteRemaining={canAutoCompleteRemaining}
                    onUseAlternative={useAlternative}
                  />
                </div>
              </section>
            </>
          )
        ) : null}
      </div>

      {detailRow && !isMobileLayout ? (
        <DayDetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onMarkMissed={markDayMissed}
          onToggleMeal={toggleMenuMeal}
          onOpenRemaining={() => setRemainingDraft(detailRow)}
          canMarkMeals={canMarkMeals}
          canAutoCompleteRemaining={canAutoCompleteRemaining}
          onUseAlternative={useAlternative}
        />
      ) : null}

      {remainingDraft ? (
        <RemainingMealsDrawer
          row={remainingDraft}
          saving={saving}
          onClose={() => setRemainingDraft(null)}
          onSave={(generatedMeals) => saveGeneratedRemaining(remainingDraft, generatedMeals)}
        />
      ) : null}

      {mealDrawer ? (
        <MobileMealDetailDrawer
          context={mealDrawer}
          onToggleMeal={toggleMenuMeal}
          onOpenFood={(payload) => setFoodDrawer(payload)}
          onClose={() => setMealDrawer(null)}
          canMarkMeals={canMarkMeals}
          saving={saving}
        />
      ) : null}

      {foodDrawer ? (
        <FoodActionDrawer
          context={foodDrawer}
          onClose={() => setFoodDrawer(null)}
        />
      ) : null}

    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#11151c] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3 text-[#FFE8A3]">
        <RefreshCw size={20} className="animate-spin" />
        <strong>Cargando tu menú semanal...</strong>
      </div>
      <p className="mt-2 text-sm font-semibold text-zinc-400">
        Estoy buscando metas diarias, menú asignado y tracking guardado.
      </p>
      <div className="mt-4 grid gap-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-3xl border border-rose-400/25 bg-rose-400/10 p-5">
      <div className="flex items-center gap-3 text-rose-100">
        <AlertTriangle size={20} />
        <strong>{message}</strong>
      </div>
      <button type="button" onClick={onRetry} className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-black text-black">
        Reintentar
      </button>
    </div>
  );
}

function MobileTopBar({ title, onBack }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        disabled={!onBack}
        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-100 disabled:opacity-70"
        aria-label={onBack ? "Volver" : "Menú"}
      >
        {onBack ? <ChevronLeft size={20} /> : <MoreHorizontal size={20} />}
      </button>
      <h1 className="truncate text-center text-lg font-black text-white">{title}</h1>
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-100"
        aria-label="Acciones"
      >
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}

function MobileDayPicker({ row, onPrevious, onNext }) {
  return (
    <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 rounded-[1.35rem] border border-white/10 bg-[#101824] p-2">
      <button
        type="button"
        onClick={onPrevious}
        className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-black/20 text-zinc-100"
        aria-label="Día anterior"
      >
        <ChevronLeft size={19} />
      </button>
      <div className="min-w-0 text-center">
        <div className="truncate text-base font-black text-white">{compactDayLabel(row)}</div>
        <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{formatDate(row?.date)}</div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="grid h-10 w-10 place-items-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]"
        aria-label="Día siguiente"
      >
        <ChevronRight size={19} />
      </button>
    </div>
  );
}

function MobileCalculateButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[1.15rem] border border-[#D4AF37]/45 bg-[linear-gradient(135deg,rgba(245,215,110,.14),rgba(255,255,255,.045))] px-4 text-left text-[#FFE8A3] shadow-[0_14px_34px_rgba(0,0,0,.36)] disabled:opacity-45"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Calculator size={20} className="shrink-0" />
        <span className="min-w-0 truncate text-sm font-black">Calcular lo que falta</span>
      </span>
      <ChevronRight size={20} className="shrink-0" />
    </button>
  );
}

function MobileMenuSummaryCard({ row, choice, badge = "", selected = false, onViewDetail }) {
  const totals = choiceTotals(choice);
  const meals = choiceMeals(choice);
  const status = choiceStatus(row, choice);
  return (
    <article className={`rounded-[1.25rem] border bg-[#101824] p-4 ${selected ? "border-[#D4AF37]/25" : "border-white/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#FFE8A3]">
            <Utensils size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <strong className="truncate text-base font-black text-white">{choice?.snapshot?.name || choice?.snapshot?.nombre || choice?.label || "Menú"}</strong>
              {badge ? <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-black text-zinc-200">{badge}</span> : null}
            </div>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              {displayKcal(totals.kcal)} · {meals.length} comida{meals.length === 1 ? "" : "s"}
            </p>
            <span className={`mt-2 inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black ${toneClass(status.tone)}`}>
              {status.label}
            </span>
          </div>
        </div>
        {selected ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]">
            <CheckSquare2 size={18} />
          </span>
        ) : null}
      </div>
      {onViewDetail ? (
        <button
          type="button"
          onClick={onViewDetail}
          className="mt-3 inline-flex min-h-8 items-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3]"
        >
          Ver detalle
        </button>
      ) : null}
    </article>
  );
}

function MobileDayMenu({
  row,
  onPrevious,
  onNext,
  onOpenDetail,
  onOpenAlternatives,
  onOpenRemaining,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const choices = menuChoices(row);
  const primary = choices[0] || null;
  const alternativesCount = Math.max(0, choices.length - 1);
  const primaryMeals = primary ? choiceMeals(primary) : [];
  const completed = completedMealIdSet(row);
  const completedCount = primaryMeals.filter((meal, index) => completed.has(mealId(meal, index))).length;
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const percent = completionPercent(row);
  const canCalculateRemaining = positiveTotals(remaining).kcal > 40 && canAutoCompleteRemaining;

  return (
    <section className="mx-auto w-full max-w-[760px] px-1 pb-3">
      <MobileTopBar title="Menú" />
      <MobileDayPicker row={row} onPrevious={onPrevious} onNext={onNext} />

      <section className="mt-3 rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_90%_8%,rgba(245,215,110,.12),transparent_34%),linear-gradient(180deg,#101824,#07101a)] p-4 shadow-[0_14px_40px_rgba(0,0,0,.3)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-black ${toneClass(menuState(row).tone)}`}>
                <Target size={14} />
                {menuState(row).label}
              </span>
              <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black ${toneClass(statusMeta(row).tone)}`}>
                {trackingLabel(row)}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-black text-white">
              Meta <span className="text-[#FFD76B]">{displayKcal(target.kcal)}</span>
            </h2>
            <p className="mt-2 text-sm font-bold text-zinc-400">
              P {formatNumber(target.proteina, 0)} g · C {formatNumber(target.carbs, 0)} g · G {formatNumber(target.grasas, 0)} g
            </p>
          </div>
          <div className="grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full border-[6px] border-white/10 bg-black/20 text-center">
            <div>
              <strong className="block text-2xl font-black text-white">{percent}%</strong>
              <span className="block text-[10px] font-bold text-zinc-500">cumplimiento</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MobileMetric label="Consumido" value={displayKcal(consumed.kcal)} detail={`P ${formatNumber(consumed.proteina, 0)} / C ${formatNumber(consumed.carbs, 0)} / G ${formatNumber(consumed.grasas, 0)}`} tone="green" />
          <MobileMetric label="Faltante" value={displayKcal(remaining.kcal)} detail={`P ${formatNumber(remaining.proteina, 0)} / C ${formatNumber(remaining.carbs, 0)} / G ${formatNumber(remaining.grasas, 0)}`} tone={remaining.kcal < -20 ? "red" : "blue"} />
          <MobileMetric label="Comidas" value={`${completedCount} / ${primaryMeals.length || 0}`} detail="completadas" tone="gold" />
        </div>
      </section>

      {!primary?.snapshot ? (
        <div className="mt-4">
          <MobileEmptyCard
            title="Todavía no tenés menú para este día."
            text="Cuando tu coach lo asigne, lo vas a ver acá."
          />
        </div>
      ) : null}

      <div className="mt-4">
        <MobileCalculateButton onClick={onOpenRemaining} disabled={!canCalculateRemaining || saving} />
      </div>

      <section className="mt-6 grid gap-3">
        <h3 className="px-1 text-base font-black text-zinc-100">Menús disponibles para este día</h3>
        {primary?.snapshot ? (
          <MobileMenuSummaryCard
            row={row}
            choice={primary}
            badge="Asignado"
            selected
            onViewDetail={onOpenDetail}
          />
        ) : null}

        {alternativesCount ? (
          <button
            type="button"
            onClick={onOpenAlternatives}
            className="flex min-h-14 items-center justify-between rounded-[1.2rem] border border-white/10 bg-[#101824] px-4 text-left text-[#FFE8A3]"
          >
            <span className="inline-flex items-center gap-2 text-sm font-black">
              <RefreshCw size={16} />
              Ver alternativas ({alternativesCount})
            </span>
            <ChevronRight size={19} />
          </button>
        ) : null}
      </section>
    </section>
  );
}

function MobileDayDetailView({
  row,
  detailChoiceKey = "",
  onBack,
  onPrevious,
  onNext,
  onToggleMeal,
  onOpenRemaining,
  onOpenMeal,
  onOpenFood,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const tracking = statusMeta(row);
  const choices = menuChoices(row);
  const detailChoice = choices.find((choice) => choice.key === detailChoiceKey) || choices[0] || null;
  const snapshot = detailChoice?.snapshot || null;
  const meals = detailChoice ? choiceMeals(detailChoice) : [];
  const detailStatus = detailChoice ? choiceStatus(row, detailChoice) : menuState(row);
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const percent = completionPercent(row);
  const completed = completedMealIdSet(row);
  const canCalculateRemaining = positiveTotals(remaining).kcal > 40 && canAutoCompleteRemaining;

  return (
    <section className="mx-auto w-full max-w-[760px] px-1 pb-3">
      <MobileTopBar title={detailChoice?.type === "alternative" ? detailChoice.label : "Menú del día"} onBack={onBack} />
      <MobileDayPicker row={row} onPrevious={onPrevious} onNext={onNext} />

      <header className="mt-3 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0,rgba(59,130,246,.16),transparent_34%),linear-gradient(180deg,#101824,#07101a)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.28)]">
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-center text-sm font-bold text-zinc-300">
          <span>Meta <strong className="text-[#FFD76B]">{displayKcal(target.kcal)}</strong></span>
          <span>P <strong className="text-[#FFD76B]">{formatNumber(target.proteina, 0)} g</strong></span>
          <span>C <strong className="text-[#FFD76B]">{formatNumber(target.carbs, 0)} g</strong></span>
          <span>G <strong className="text-[#FFD76B]">{formatNumber(target.grasas, 0)} g</strong></span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-black ${toneClass(detailStatus.tone)}`}>
            <Target size={14} />
            {detailStatus.label}
          </span>
          <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black ${toneClass(tracking.tone)}`}>
            {trackingLabel(row)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MobileMetric label="Consumido" value={displayKcal(consumed.kcal)} detail={`P ${formatNumber(consumed.proteina, 0)} / C ${formatNumber(consumed.carbs, 0)} / G ${formatNumber(consumed.grasas, 0)}`} tone="green" />
          <MobileMetric label="Faltante" value={displayKcal(remaining.kcal)} detail={`P ${formatNumber(remaining.proteina, 0)} / C ${formatNumber(remaining.carbs, 0)} / G ${formatNumber(remaining.grasas, 0)}`} tone={remaining.kcal < -20 ? "red" : "blue"} />
          <MobileMetric label="Cumplimiento" value={`${percent}%`} detail="del día" tone="gold" />
        </div>
      </header>

      <div className="mt-4 grid gap-3">
        <h3 className="px-1 text-lg font-black text-white">Comidas</h3>
        {!snapshot ? (
          <MobileEmptyCard
            title="Todavía no tenés menú para este día."
            text="Cuando tu coach lo asigne, lo vas a ver acá."
          />
        ) : !meals.length ? (
          <MobileEmptyCard
            title="Este menú no tiene comidas cargadas."
            text="Podés revisar otros días o avisarle a tu coach."
          />
        ) : (
          meals.map((meal, index) => (
            <MobileMealCard
              key={mealId(meal, index)}
              row={row}
              meal={meal}
              mealIndex={index}
              done={completed.has(mealId(meal, index))}
              saving={saving}
              canMarkMeals={canMarkMeals}
              onToggleMeal={onToggleMeal}
              onOpenMeal={onOpenMeal}
              onOpenFood={onOpenFood}
            />
          ))
        )}
      </div>

      <div className="sticky bottom-2 z-20 mt-5 pb-1">
        <MobileCalculateButton onClick={onOpenRemaining} disabled={!canCalculateRemaining || saving} />
      </div>
    </section>
  );
}

function MobileAlternativesView({
  row,
  onBack,
  onViewDetail,
  onUseAlternative,
  saving,
}) {
  if (!row) return null;
  const choices = menuChoices(row);
  const selectedIndex = selectedAlternativeIndex(row);

  return (
    <section className="mx-auto w-full max-w-[760px] px-1 pb-3">
      <MobileTopBar title="Alternativas del día" onBack={onBack} />

      <div className="mt-4 grid gap-3">
        {choices.length ? (
          choices.map((choice) => {
            const isPrimary = choice.type === "primary";
            const isSelectedAlternative = choice.type === "alternative" && selectedIndex === choice.index;
            return (
              <article
                key={choice.key}
                className={`rounded-[1.3rem] border bg-[#101824] p-4 ${isPrimary || isSelectedAlternative ? "border-[#D4AF37]/28" : "border-white/10"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <MealTypeIcon meal={{ name: choice?.snapshot?.name || choice.label }} index={0} done={isPrimary || isSelectedAlternative} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-white">
                          {isPrimary ? "Menú Principal" : choice.label}
                        </h3>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-black text-zinc-200">
                          {isPrimary ? "Asignado" : isSelectedAlternative ? "Elegido" : "Alternativa"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-zinc-400">
                        {displayKcal(choiceTotals(choice).kcal)} · {choiceMeals(choice).length} comida{choiceMeals(choice).length === 1 ? "" : "s"}
                      </p>
                      <span className={`mt-2 inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black ${toneClass(choiceStatus(row, choice).tone)}`}>
                        {choiceStatus(row, choice).label}
                      </span>
                    </div>
                  </div>
                  {(isPrimary || isSelectedAlternative) ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]">
                      <CheckSquare2 size={18} />
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!isPrimary ? (
                    <button
                      type="button"
                      disabled={saving || isSelectedAlternative}
                      onClick={() => onUseAlternative(row, choice.index)}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3] disabled:opacity-50"
                    >
                      <CheckSquare2 size={15} />
                      Usar como principal
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onViewDetail(choice)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 text-xs font-black text-zinc-100"
                  >
                    Ver detalle
                    <Eye size={15} />
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <MobileEmptyCard
            title="No hay alternativas para este día."
            text="Cuando haya más menús disponibles, van a aparecer acá."
          />
        )}

        <button
          type="button"
          disabled
          className="flex min-h-14 items-center justify-center gap-2 rounded-[1.2rem] border border-dashed border-sky-300/25 bg-sky-300/[0.04] px-4 text-sm font-black text-sky-200 disabled:opacity-70"
        >
          <Plus size={18} />
          Buscar más alternativas
        </button>
      </div>
    </section>
  );
}

function MobileMetric({ label, value, detail, tone = "blue" }) {
  const toneMap = {
    blue: "text-[#6DB7FF]",
    gold: "text-[#FFD76B]",
    green: "text-emerald-300",
    red: "text-rose-200",
  };
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className={`truncate text-[10px] font-black uppercase tracking-wide ${toneMap[tone] || toneMap.blue}`}>{label}</div>
      <div className="mt-2 truncate text-lg font-black text-white">{value}</div>
      <div className={`mt-2 truncate text-[11px] font-bold ${toneMap[tone] || toneMap.blue}`}>{detail}</div>
    </div>
  );
}

function MobileEmptyCard({ title, text }) {
  return (
    <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-[#101824] p-4">
      <div className="flex items-center gap-3 text-zinc-100">
        <CircleAlert size={19} className="text-[#FFD76B]" />
        <strong className="text-base font-black">{title}</strong>
      </div>
      {text ? <p className="mt-2 text-sm font-bold text-zinc-400">{text}</p> : null}
    </div>
  );
}

function MobileMealCard({
  row,
  meal,
  mealIndex,
  done,
  saving,
  canMarkMeals,
  onToggleMeal,
  onOpenMeal,
  onOpenFood,
}) {
  const foods = mealFoods(meal);
  const totals = mealTotals(meal);

  return (
    <article className={`overflow-hidden rounded-[1.35rem] border bg-[#101824] shadow-[0_14px_36px_rgba(0,0,0,.25)] ${done ? "border-emerald-400/30" : "border-white/10"}`}>
      <div className="flex items-center gap-3 border-b border-white/10 p-3.5">
        <button type="button" onClick={() => onOpenMeal({ row, meal, mealIndex })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <MealTypeIcon meal={meal} index={mealIndex} done={done} />
          <span className="min-w-0">
            <span className="block truncate text-xl font-black text-white">{mealName(meal, mealIndex)}</span>
            <span className="mt-0.5 block truncate text-xs font-bold text-zinc-500">{displayKcal(totals.kcal)}</span>
          </span>
        </button>
        <button
          type="button"
          disabled={!canMarkMeals || saving}
          onClick={() => onToggleMeal(row, meal, mealIndex)}
          className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${done ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100" : "border-[#D4AF37]/35 bg-black/20 text-[#FFD76B]"}`}
          aria-pressed={done}
        >
          <span className="hidden min-[390px]:inline">{done ? "Completa" : "Marcar completo"}</span>
          {done ? <CheckSquare2 size={19} /> : <Square size={19} />}
        </button>
      </div>

      <div className="divide-y divide-white/[0.07]">
        {foods.length ? (
          foods.map((food, foodIndex) => (
            <MobileFoodRow
              key={`${food.id}-${foodIndex}`}
              meal={meal}
              mealIndex={mealIndex}
              food={food}
              foodIndex={foodIndex}
              onOpenFood={onOpenFood}
            />
          ))
        ) : (
          <div className="px-4 py-4 text-sm font-bold text-zinc-500">Sin alimentos cargados.</div>
        )}
      </div>
    </article>
  );
}

function MealTypeIcon({ meal, index, done }) {
  const iconType = mealIconType(meal, index);
  const className = done ? "text-emerald-200" : "text-[#FFD76B]";
  const icons = {
    breakfast: Sunrise,
    lunch: Sun,
    snack: Apple,
    dinner: Moon,
    meal: Utensils,
  };
  const Icon = icons[iconType] || Utensils;
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${done ? "border-emerald-400/25 bg-emerald-400/10" : "border-[#D4AF37]/20 bg-[#D4AF37]/10"}`}>
      <Icon size={25} className={className} />
    </span>
  );
}

function MobileFoodRow({ meal, mealIndex, food, foodIndex, onOpenFood }) {
  return (
    <div className="flex min-h-[64px] items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-base font-bold text-zinc-100">{food.name}</div>
        <div className="mt-1 truncate text-xs font-bold text-zinc-500">
          {[food.amount, foodMacroLine(food)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpenFood({ meal, mealIndex, food, foodIndex })}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-black/20 text-[#FFD76B]"
        aria-label={`Editar ${food.name}`}
      >
        <PencilLine size={18} />
      </button>
    </div>
  );
}

function TodayHero({
  row,
  onPrevious,
  onNext,
  onView,
  onToggleMeal,
  onOpenRemaining,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const state = menuState(row);
  const tracking = statusMeta(row);
  const choices = menuChoices(row);
  const snapshot = choices[0]?.snapshot || null;
  const meals = snapshot ? snapshotMeals(snapshot) : [];
  const targetKcal = macro(row?.target?.kcal);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const menuKcal = macro(row?.menuTotals?.kcal);
  const pct = targetKcal ? Math.min(135, Math.round((consumed.kcal / targetKcal) * 100)) : 0;
  const canCalculateRemaining = positiveTotals(remaining).kcal > 40;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[#D4AF37]/25 bg-gradient-to-br from-[#141a23] via-[#0c1118] to-[#090b0f] p-3 shadow-[0_14px_45px_rgba(0,0,0,0.38)] sm:rounded-[2rem] sm:p-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-zinc-100"
          aria-label="Día anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(state.tone)}`}>{state.label}</span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(tracking.tone)}`}>{tracking.label}</span>
          </div>
          <h2 className="mt-2 truncate text-2xl font-black leading-tight text-white sm:text-3xl">{dayHeading(row)}</h2>
          <p className="text-xs font-bold text-zinc-500">{formatDate(row.date)}</p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-zinc-100"
          aria-label="Día siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={onView}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-black/25 p-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-xl" aria-hidden="true">
            {choices.length > 1 ? MENU_BOX_EMOJI : MENU_EMOJI}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black uppercase tracking-wide text-zinc-300">
              {menuCountTitle(row)}
            </span>
            <span className="mt-1 block text-xl font-black text-[#FFE8A3]">{displayKcal(menuKcal)}</span>
            <span className="block truncate text-sm font-bold text-zinc-300">
              {snapshot ? displayMenuMacros(row?.menuTotals) : "Toca para ver el detalle cuando haya menú"}
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-100">
          <span aria-hidden="true">{EYE_EMOJI}</span>
          <Eye size={15} />
        </span>
      </button>

      <div className="mt-3 grid gap-2 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3">
        <div className="grid grid-cols-3 gap-2">
          <TrackingMiniPanel label="Meta" totals={targetTotals(row)} tone="gold" />
          <TrackingMiniPanel label="Consumido" totals={consumed} tone="green" />
          <TrackingMiniPanel label="Faltante" totals={remaining} tone={remaining.kcal < -20 ? "red" : "blue"} />
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <span className={`block h-full rounded-full bg-gradient-to-r ${progressTone(row)}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-2 text-xs font-bold text-zinc-400">
          Consumido: {displayKcal(consumed.kcal)} / faltan {signed(remaining.kcal, " kcal")} / proteína {signed(remaining.proteina, " g")}
        </div>
      </div>

      {meals.length && canMarkMeals ? (
        <MealChecklist row={row} meals={meals} onToggleMeal={onToggleMeal} saving={saving} compact />
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onView} className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-3 text-xs font-black text-sky-100">
          Ver detalle
        </button>
        <button
          type="button"
          onClick={onOpenRemaining}
          disabled={!canCalculateRemaining || !canAutoCompleteRemaining || saving}
          className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-3 text-xs font-black text-[#FFE8A3] disabled:opacity-45"
        >
          Calcular lo que falta
        </button>
      </div>
    </section>
  );
}

function TrackingMiniPanel({ label, totals, tone = "blue" }) {
  const toneMap = {
    gold: "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]",
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    red: "border-rose-400/25 bg-rose-400/10 text-rose-100",
    blue: "border-sky-400/25 bg-sky-400/10 text-sky-100",
  };
  return (
    <div className={`min-w-0 rounded-2xl border p-2 ${toneMap[tone] || toneMap.blue}`}>
      <div className="truncate text-[10px] font-black uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 truncate text-sm font-black">{displayKcal(totals?.kcal)}</div>
      <div className="truncate text-[11px] font-bold opacity-85">
        P {formatNumber(macro(totals?.proteina), 0)} / C {formatNumber(macro(totals?.carbs), 0)} / G {formatNumber(macro(totals?.grasas), 0)}
      </div>
    </div>
  );
}

function MealChecklist({ row, meals, onToggleMeal, saving, compact = false }) {
  const completed = completedMealIdSet(row);
  return (
    <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
      {meals.map((meal, index) => {
        const id = mealId(meal, index);
        const done = completed.has(id);
        const totals = mealTotals(meal);
        return (
          <button
            key={id}
            type="button"
            disabled={saving}
            onClick={() => onToggleMeal(row, meal, index)}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${done ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-black/20"}`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${done ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-100" : "border-white/15 bg-white/[0.03] text-zinc-400"}`}>
              {done ? <CheckCircle2 size={18} /> : <ClipboardCheck size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-white">{mealName(meal, index)}</span>
              <span className="block truncate text-xs font-bold text-zinc-400">
                {displayKcal(totals.kcal)} / {displayMenuMacros(totals)}
              </span>
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${done ? toneClass("green") : toneClass("slate")}`}>
              {done ? "Cumplida" : "Pendiente"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WeeklySelector({ days, selectedDate, onSelect, onView }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {days.map((row) => {
        const selected = row.date === selectedDate;
        const state = statusMeta(row);
        const menu = menuState(row);
        const targetKcal = macro(row?.target?.kcal);
        const menuKcal = macro(row?.menuTotals?.kcal);
        const pct = targetKcal ? Math.min(135, Math.round((menuKcal / targetKcal) * 100)) : 0;
        const alternatives = row?.assignment?.alternatives?.length || 0;
        const title = menuCountTitle(row);
        return (
          <button
            key={row.date}
            type="button"
            onClick={() => onSelect(row)}
            className={`rounded-3xl border p-4 text-left transition ${selected ? "border-[#D4AF37]/45 bg-[#D4AF37]/10" : "border-white/10 bg-[#0d121a]"} ${row?.assignment?.primaryMenu ? "shadow-[0_0_0_1px_rgba(34,197,94,0.12)]" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-black text-white">{row.dayLabel}</div>
                <div className="text-xs font-bold text-zinc-500">{formatDate(row.date)}</div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(state.tone)}`}>{state.label}</span>
            </div>
            <div className="mt-3 text-sm font-black text-[#FFE8A3]">{displayKcal(row?.target?.kcal)}</div>
            <div className="mt-1 truncate text-sm font-bold text-zinc-300">
              {title}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <span className={`block h-full rounded-full bg-gradient-to-r ${progressTone(row)}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold text-zinc-400">
              <span>{menu.label}</span>
              <span>{alternatives ? `${alternatives} alt.` : "Sin alt."}</span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onView(row);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onView(row);
                }
              }}
              className="mt-3 inline-flex rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200"
            >
              Ver detalle
            </span>
          </button>
        );
      })}
    </section>
  );
}

function DayDetailDrawer({
  row,
  onClose,
  onMarkMissed,
  onToggleMeal,
  onOpenRemaining,
  canMarkMeals,
  canAutoCompleteRemaining,
  onUseAlternative,
}) {
  return (
    <section className="fixed inset-0 z-40 bg-black/70 p-1 backdrop-blur-sm sm:p-3" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090d13] shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Detalle del día</span>
            <h3 className="text-2xl font-black text-white">{row?.dayLabel}</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DayDetail
            row={row}
            onMarkMissed={onMarkMissed}
            onToggleMeal={onToggleMeal}
            onOpenRemaining={onOpenRemaining}
            canMarkMeals={canMarkMeals}
            canAutoCompleteRemaining={canAutoCompleteRemaining}
            onUseAlternative={onUseAlternative}
          />
        </div>
      </div>
    </section>
  );
}

function DayDetail({
  row,
  onMarkMissed,
  onToggleMeal,
  onOpenRemaining,
  canMarkMeals,
  canAutoCompleteRemaining,
  onUseAlternative,
}) {
  if (!row) return null;
  const snapshot = menuSnapshot(row);
  const meals = snapshot ? snapshotMeals(snapshot) : [];
  const choices = menuChoices(row);
  const selectedAlternative = row?.tracking?.selectedAlternative;

  return (
    <section className="grid gap-4 rounded-3xl border border-white/10 bg-[#0d121a] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClass(menuState(row).tone)}`}>{menuState(row).label}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClass(statusMeta(row).tone)}`}>{statusMeta(row).label}</span>
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">{row.dayLabel}</h3>
          <p className="mt-1 text-sm font-bold text-zinc-400">
            Meta {displayKcal(row?.target?.kcal)} / {displayMacros(row?.target)}
          </p>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onOpenRemaining}
            disabled={!canAutoCompleteRemaining}
            className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#FFE8A3] disabled:opacity-45"
          >
            Calcular lo que falta
          </button>
          <button
            type="button"
            onClick={() => onMarkMissed(row)}
            disabled={!canMarkMeals}
            className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-45"
          >
            Día no cumplido
          </button>
        </div>
      </div>

      <div className="grid gap-2 rounded-3xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
        <TrackingMiniPanel label="Meta" totals={targetTotals(row)} tone="gold" />
        <TrackingMiniPanel label="Consumido" totals={consumedTotals(row)} tone="green" />
        <TrackingMiniPanel label="Faltante" totals={remainingTotals(row)} tone={remainingTotals(row).kcal < -20 ? "red" : "blue"} />
      </div>

      {selectedAlternative ? (
        <div className="rounded-3xl border border-sky-400/25 bg-sky-400/10 p-4 text-sm font-bold text-sky-100">
          Hoy elegiste alternativa: {selectedAlternative.name}
        </div>
      ) : null}

      {choices.length ? (
        <MenuChoicesBlock row={row} choices={choices} onUseAlternative={onUseAlternative} />
      ) : (
        <EmptyMenu row={row} />
      )}

      {meals.length && canMarkMeals ? (
        <MealChecklist row={row} meals={meals} onToggleMeal={onToggleMeal} />
      ) : null}

      <GeneratedMealsBlock meals={row?.tracking?.generatedRemainingMeals || []} />

    </section>
  );
}

function MenuChoicesBlock({ row, choices, onUseAlternative }) {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/20 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Menús del día</span>
          <h4 className="mt-1 text-lg font-black text-white">
            {choices.length === 1 ? choices[0].snapshot?.name || "Menu asignado" : `Total menus (${choices.length})`}
          </h4>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-xl" aria-hidden="true">
          {MENU_BOX_EMOJI}
        </span>
      </div>
      <div className="grid gap-2">
        {choices.map((choice) => (
          <article
            key={choice.key}
            className={`rounded-2xl border p-3 ${choice.type === "primary" ? "border-[#D4AF37]/30 bg-[#D4AF37]/10" : "border-sky-400/20 bg-sky-400/10"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
                  {choice.type === "primary" ? "Menu principal" : choice.label}
                </span>
                <h5 className="mt-1 truncate text-base font-black text-white">{choice.snapshot?.name || "Menu"}</h5>
                <p className="mt-1 text-xs font-bold text-zinc-300">
                  {displayKcal(choice.totals?.kcal)} / {displayMenuMacros(choice.totals)}
                </p>
              </div>
              {choice.type === "alternative" ? (
                <button
                  type="button"
                  onClick={() => onUseAlternative(row, choice.index)}
                  className="shrink-0 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-100"
                >
                  Usar hoy
                </button>
              ) : (
                <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-black/20 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
                  Actual
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function EmptyMenu({ row }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
      <div className="flex items-center gap-3 text-zinc-200">
        <CircleAlert size={20} className="text-[#FFE8A3]" />
        <strong>Sin menú asignado para {row?.dayLabel}</strong>
      </div>
      <p className="mt-2 text-sm font-semibold text-zinc-400">
        Si tenés coach, va a aparecer cuando te asigne un menú. Si estás autogestionado, podés seguir usando el tracking detallado.
      </p>
      <a href="/app/tracking" className="mt-4 inline-flex rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-2 text-sm font-black text-[#FFE8A3]">
        Ir al tracking detallado
      </a>
    </div>
  );
}

function GeneratedMealsBlock({ meals = [] }) {
  if (!meals.length) return null;
  return (
    <section className="grid gap-3 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
      <div>
        <span className="text-xs font-black uppercase tracking-wide text-emerald-100">Tracking agregado</span>
        <h4 className="mt-1 text-lg font-black text-white">Comidas calculadas para completar</h4>
      </div>
      {meals.map((meal, index) => {
        const totals = totalFromLike(meal.totals || meal);
        const foods = Array.isArray(meal.foods) ? meal.foods : [];
        return (
          <article key={meal.id || index} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate text-sm text-white">{meal.name || `Comida ${index + 1}`}</strong>
                <p className="text-xs font-bold text-zinc-300">{displayKcal(totals.kcal)} / {displayMenuMacros(totals)}</p>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-100">
                Auto
              </span>
            </div>
            {foods.length ? (
              <div className="mt-2 grid gap-1.5">
                {foods.map((food, foodIndex) => (
                  <div key={food.id || foodIndex} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs font-bold">
                    <span className="min-w-0 truncate text-zinc-100">{food.name}</span>
                    <span className="shrink-0 text-[#FFE8A3]">{formatNumber(food.quantity, 1)} {food.unit || "g"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function MobileMealDetailDrawer({
  context,
  onToggleMeal,
  onOpenFood,
  onClose,
  canMarkMeals,
  saving,
}) {
  const row = context?.row || {};
  const meal = context?.meal || {};
  const mealIndex = context?.mealIndex || 0;
  const done = completedMealIdSet(row).has(mealId(meal, mealIndex));
  const foods = mealFoods(meal);
  const totals = mealTotals(meal);

  return (
    <section className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-3" role="dialog" aria-modal="true">
      <div className="mx-auto flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.6rem] border border-white/10 bg-[#0b121b] shadow-2xl sm:rounded-[1.6rem]">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <MealTypeIcon meal={meal} index={mealIndex} done={done} />
            <div className="min-w-0">
              <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Comida</span>
              <h3 className="mt-1 truncate text-2xl font-black text-white">{mealName(meal, mealIndex)}</h3>
              <p className="mt-1 text-sm font-bold text-zinc-400">
                {displayKcal(totals.kcal)} · {displayMenuMacros(totals)}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <button
            type="button"
            disabled={!canMarkMeals || saving}
            onClick={() => {
              onToggleMeal(row, meal, mealIndex);
              onClose();
            }}
            className={`mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-black disabled:opacity-50 ${done ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100" : "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]"}`}
            aria-pressed={done}
          >
            <span>{done ? "Comida completa" : "Marcar completo"}</span>
            {done ? <CheckSquare2 size={20} /> : <Square size={20} />}
          </button>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
            {foods.length ? (
              <div className="divide-y divide-white/[0.07]">
                {foods.map((food, foodIndex) => (
                  <MobileFoodRow
                    key={`${food.id}-${foodIndex}`}
                    meal={meal}
                    mealIndex={mealIndex}
                    food={food}
                    foodIndex={foodIndex}
                    onOpenFood={onOpenFood}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm font-bold text-zinc-500">Sin alimentos cargados.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FoodActionDrawer({ context, onClose }) {
  const food = useMemo(() => context?.food || {}, [context?.food]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [equivalents, setEquivalents] = useState([]);

  useEffect(() => {
    let active = true;
    if (!food?.name) return undefined;
    setLoading(true);
    setError("");
    setEquivalents([]);
    getFoodEquivalents({
      alimentoOriginal: {
        ...food.raw,
        alimentoId: food.alimentoId,
        nombreSnapshot: food.name,
        cantidad: food.cantidad,
        unidad: food.unidad,
        kcal: food.totals?.kcal,
        proteina: food.totals?.proteina,
        carbs: food.totals?.carbs,
        grasas: food.totals?.grasas,
      },
      cantidad: food.cantidad,
      unidad: food.unidad,
    })
      .then((data) => {
        if (!active) return;
        setEquivalents(Array.isArray(data?.equivalentes) ? data.equivalentes : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "No se pudieron buscar equivalencias.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [food]);

  return (
    <section className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-3" role="dialog" aria-modal="true">
      <div className="mx-auto flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.6rem] border border-white/10 bg-[#0b121b] shadow-2xl sm:rounded-[1.6rem]">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <span className="inline-flex min-h-7 items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3]">
              Alimento
            </span>
            <h3 className="mt-3 truncate text-2xl font-black text-white">{food.name || "Alimento"}</h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              {[food.amount, foodMacroLine(food)].filter(Boolean).join(" · ") || "Sin detalle cargado"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Detalle</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FoodDetailStat label="Cantidad" value={food.amount || "-"} />
              <FoodDetailStat label="Calorías" value={displayKcal(food.totals?.kcal)} />
              <FoodDetailStat label="Proteína" value={`${formatNumber(food.totals?.proteina, 1)} g`} />
              <FoodDetailStat label="Carbs" value={`${formatNumber(food.totals?.carbs, 1)} g`} />
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-sky-200">Equivalencias</div>
                <p className="mt-1 text-xs font-bold text-zinc-500">Opciones compatibles para revisar.</p>
              </div>
              {loading ? <RefreshCw size={17} className="shrink-0 animate-spin text-sky-200" /> : null}
            </div>

            {error ? (
              <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">
                {error}
              </div>
            ) : null}

            {!loading && !error && equivalents.length ? (
              <div className="mt-3 grid gap-2">
                {equivalents.slice(0, 6).map((option, index) => (
                  <article key={`${option.id || option.alimentoId || option.nombre}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-white">{option.nombre || option.name || "Equivalente"}</strong>
                        <span className="mt-1 block text-xs font-bold text-zinc-400">
                          {formatNumber(option.cantidadSugerida, 1)} {option.unidadSugerida || option.unidad || "g"} · {displayKcal(option.totales?.kcal ?? option.kcal)}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
                        Revisar
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {!loading && !error && !equivalents.length ? (
              <div className="mt-3 rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-zinc-500">
                No encontramos equivalencias para este alimento.
              </div>
            ) : null}
          </section>
        </div>

        <footer className="border-t border-white/10 p-4">
          <button type="button" onClick={onClose} className="w-full rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-3 text-sm font-black text-[#FFE8A3]">
            Listo
          </button>
        </footer>
      </div>
    </section>
  );
}

function FoodDetailStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <span className="block truncate text-[10px] font-black uppercase tracking-wide text-zinc-500">{label}</span>
      <strong className="mt-1 block truncate text-sm font-black text-white">{value}</strong>
    </div>
  );
}

function RemainingMealsDrawer({ row, saving, onClose, onSave }) {
  const [count, setCount] = useState(2);
  const [foods, setFoods] = useState([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeMeal, setActiveMeal] = useState(0);
  const [selectedFoods, setSelectedFoods] = useState({});
  const [results, setResults] = useState({});
  const [loadingMeal, setLoadingMeal] = useState(null);
  const [error, setError] = useState("");
  const remaining = positiveTotals(remainingTotals(row));
  const distributions = {
    1: [1],
    2: [0.35, 0.65],
    3: [0.28, 0.34, 0.38],
  };
  const names = count === 1 ? ["Comida restante"] : count === 2 ? ["Merienda", "Cena"] : ["Snack", "Merienda", "Cena"];
  const targets = (distributions[count] || distributions[2]).map((portion, index) => ({
    id: `remaining-${index + 1}`,
    name: names[index] || `Comida ${index + 1}`,
    totals: {
      kcal: Math.round(remaining.kcal * portion),
      proteina: Math.round(remaining.proteina * portion * 10) / 10,
      carbs: Math.round(remaining.carbs * portion * 10) / 10,
      grasas: Math.round(remaining.grasas * portion * 10) / 10,
    },
  }));

  useEffect(() => {
    let alive = true;
    setFoodsLoading(true);
    listAlimentos({})
      .then((data) => {
        if (!alive) return;
        setFoods(data?.all || data?.alimentos || []);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "No se pudieron cargar alimentos.");
      })
      .finally(() => {
        if (alive) setFoodsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredFoods = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    return foods
      .filter((food) => (food._searchText || `${food.name} ${food.nombre} ${food.categoria}`).toLowerCase().includes(term))
      .slice(0, 8);
  }, [foods, search]);

  function addFood(food) {
    setSelectedFoods((current) => {
      const list = current[activeMeal] || [];
      if (list.some((item) => item.id === food.id)) return current;
      return { ...current, [activeMeal]: [...list, food] };
    });
    setSearch("");
    setResults((current) => ({ ...current, [activeMeal]: null }));
  }

  function removeFood(mealIndex, foodId) {
    setSelectedFoods((current) => ({
      ...current,
      [mealIndex]: (current[mealIndex] || []).filter((food) => food.id !== foodId),
    }));
    setResults((current) => ({ ...current, [mealIndex]: null }));
  }

  async function calculateMeal(mealIndex) {
    const target = targets[mealIndex];
    const selected = selectedFoods[mealIndex] || [];
    if (!selected.length) {
      setError("Agregá alimentos para calcular cantidades.");
      return;
    }
    if (!target?.totals?.kcal) {
      setError("No hay macros pendientes para esta comida.");
      return;
    }
    try {
      setError("");
      setLoadingMeal(mealIndex);
      const payload = {
        target: {
          kcal: target.totals.kcal,
          proteina: target.totals.proteina,
          carbs: target.totals.carbs,
          grasas: target.totals.grasas,
        },
        mode: target.totals.carbs || target.totals.grasas ? "full" : "kcalProteina",
        generationType: "selectedOnly",
        fixedFoods: [],
        pendingFoods: selected.map((food) => ({
          foodId: food.id,
          name: food.name || food.nombre,
          unit: food.unidad || food.unit || "g",
          source: "pending",
          kcalPerUnitOrGram: foodPerUnit(food, "kcal"),
          proteinPerUnitOrGram: foodPerUnit(food, "proteina"),
          carbsPerUnitOrGram: foodPerUnit(food, "carbs"),
          fatPerUnitOrGram: foodPerUnit(food, "grasas"),
        })),
        options: {
          redondear: true,
          usarMinMax: true,
        },
      };
      const response = await generateMealQuantities(payload);
      if (response?.status === "error" || !Array.isArray(response?.foods) || !response.foods.length) {
        throw new Error(response?.message || "No se pudo calcular una combinación razonable.");
      }
      setResults((current) => ({ ...current, [mealIndex]: response }));
    } catch (err) {
      setError(err?.message || "No se pudieron generar cantidades.");
    } finally {
      setLoadingMeal(null);
    }
  }

  function resultTotals(result = {}) {
    if (result.totals) return totalFromLike(result.totals);
    return sumTotals((result.foods || []).map(normalizeGeneratedFood));
  }

  function saveGenerated() {
    const generated = targets
      .map((target, index) => {
        const result = results[index];
        if (!result?.foods?.length) return null;
        const foodsFromResult = result.foods.map(normalizeGeneratedFood);
        return {
          id: `generated-${row.date}-${index + 1}-${Date.now()}`,
          name: target.name,
          source: "auto_generated_remaining",
          target: target.totals,
          foods: foodsFromResult,
          totals: resultTotals(result),
        };
      })
      .filter(Boolean);
    if (!generated.length) {
      setError("Generá al menos una comida antes de guardar.");
      return;
    }
    onSave(generated);
  }

  return (
    <section className="fixed inset-0 z-50 bg-black/70 p-1 backdrop-blur-sm sm:p-3" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090d13] shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Tracking flexible</span>
            <h3 className="text-2xl font-black text-white">Calcular lo que falta</h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              Faltan {displayKcal(remaining.kcal)} / P {formatNumber(remaining.proteina, 1)} / C {formatNumber(remaining.carbs, 1)} / G {formatNumber(remaining.grasas, 1)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCount(value);
                    setActiveMeal(0);
                    setResults({});
                  }}
                  className={`rounded-2xl border px-3 py-3 text-sm font-black ${count === value ? "border-[#D4AF37]/45 bg-[#D4AF37]/10 text-[#FFE8A3]" : "border-white/10 bg-white/[0.03] text-zinc-200"}`}
                >
                  {value} comida{value > 1 ? "s" : ""}
                </button>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="grid gap-2">
                {targets.map((target, index) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setActiveMeal(index)}
                    className={`rounded-2xl border p-3 text-left ${activeMeal === index ? "border-[#D4AF37]/40 bg-[#D4AF37]/10" : "border-white/10 bg-black/20"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-white">{target.name}</strong>
                      {results[index] ? <CheckCircle2 size={16} className="text-emerald-300" /> : null}
                    </div>
                    <p className="mt-1 text-xs font-bold text-zinc-400">
                      {displayKcal(target.totals.kcal)} / {displayMenuMacros(target.totals)}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-zinc-500">
                      {(selectedFoods[index] || []).length} alimentos
                    </p>
                  </button>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Alimentos</span>
                    <h4 className="text-lg font-black text-white">{targets[activeMeal]?.name}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => calculateMeal(activeMeal)}
                    disabled={loadingMeal === activeMeal}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#FFE8A3] disabled:opacity-60"
                  >
                    {loadingMeal === activeMeal ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
                    Generar
                  </button>
                </div>

                <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d121a] px-3 py-2">
                  <Search size={16} className="text-zinc-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={foodsLoading ? "Cargando alimentos..." : "Buscar alimento"}
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500"
                  />
                </label>

                {filteredFoods.length ? (
                  <div className="mt-2 grid gap-1.5">
                    {filteredFoods.map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        onClick={() => addFood(food)}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-zinc-200"
                      >
                        <span className="min-w-0 truncate">{food.name || food.nombre}</span>
                        <Plus size={14} className="shrink-0 text-[#FFE8A3]" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {(selectedFoods[activeMeal] || []).map((food) => (
                    <div key={food.id} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="min-w-0 truncate text-sm font-bold text-white">{food.name || food.nombre}</span>
                      <button type="button" onClick={() => removeFood(activeMeal, food.id)} className="grid h-8 w-8 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {!(selectedFoods[activeMeal] || []).length ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-zinc-500">
                      Elegí alimentos y después generá cantidades.
                    </div>
                  ) : null}
                </div>

                {results[activeMeal] ? (
                  <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-100">
                      Resultado {results[activeMeal].quality ? `/${results[activeMeal].quality}` : ""}
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      {results[activeMeal].foods.map((food, index) => {
                        const item = normalizeGeneratedFood(food);
                        return (
                          <div key={item.id || index} className="flex items-center justify-between gap-2 text-sm font-bold text-zinc-100">
                            <span className="min-w-0 truncate">{item.name}</span>
                            <span className="shrink-0 text-[#FFE8A3]">{formatNumber(item.quantity, 1)} {item.unit}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="grid gap-2 border-t border-white/10 p-4 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-black text-zinc-100">
            Cancelar
          </button>
          <button type="button" disabled={saving} onClick={saveGenerated} className="rounded-2xl bg-[#D4AF37] px-4 py-4 text-sm font-black text-black disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar comidas calculadas"}
          </button>
        </footer>
      </div>
    </section>
  );
}
