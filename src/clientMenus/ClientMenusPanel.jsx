import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Crown,
  Edit3,
  GripVertical,
  Info,
  Loader2,
  Moon,
  MoreVertical,
  Plus,
  Power,
  Save,
  Search,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { buildMenuItemSnapshot, formatNumber } from "../nutricion/nutricionUtils.js";
import { listAlimentos } from "../nutricion/nutricionApi.js";
import { createNavigationPrefetchHandlers } from "../routes/routePrefetch.js";
import { createSavedMeal } from "../savedMeals/savedMealsApi.js";
import EquivalentMealBuilder from "../entrenado/menu/EquivalentMealBuilder.jsx";
import {
  activateClientMenu,
  createClientMenu,
  deactivateClientMenu,
  deleteClientMenu,
  duplicateClientMenu,
  getClientMenu,
  listClientMenus,
  updateClientMenu,
} from "./clientMenusApi.js";

const MEAL_TYPES = [
  ["desayuno", "Desayuno"],
  ["almuerzo", "Almuerzo"],
  ["merienda", "Merienda"],
  ["cena", "Cena"],
  ["snack", "Snack"],
  ["colacion", "Colacion"],
  ["pre_entreno", "Pre-entreno"],
  ["post_entreno", "Post-entreno"],
  ["otra", "Otra"],
];

const BASE_MEALS = ["desayuno", "almuerzo", "merienda", "cena"];

const MEAL_SUGGESTIONS = [
  ["colacion", "Media manana"],
  ["colacion", "Colacion"],
  ["pre_entreno", "Pre-entreno"],
  ["post_entreno", "Post-entreno"],
  ["snack", "Snack"],
  ["otra", "Otra"],
];

const DAYS = [
  ["monday", "Lunes", "Lun"],
  ["tuesday", "Martes", "Mar"],
  ["wednesday", "Miercoles", "Mie"],
  ["thursday", "Jueves", "Jue"],
  ["friday", "Viernes", "Vie"],
  ["saturday", "Sabado", "Sab"],
  ["sunday", "Domingo", "Dom"],
];

const MAX_MEALS_PER_DAY = 10;

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPositive(value) {
  const next = toNumber(value, 0);
  return next > 0 ? next : 0;
}

function titleForMealType(type = "otra") {
  return MEAL_TYPES.find(([value]) => value === type)?.[1] || "Comida";
}

function iconForMeal(type = "otra") {
  if (type === "desayuno") return <Sun size={24} />;
  if (type === "almuerzo") return <Utensils size={24} />;
  if (type === "merienda") return <Sparkles size={24} />;
  if (type === "cena") return <Moon size={24} />;
  return <Utensils size={24} />;
}

function emptyMeal(type = "almuerzo", overrides = {}) {
  return {
    id: uid("meal"),
    nombre: overrides.nombre || titleForMealType(type),
    tipoComida: type,
    orden: 1,
    items: [],
    target: null,
    ...overrides,
  };
}

function planKey(capabilities = {}, user = {}) {
  return String(
    capabilities?.plan ||
      capabilities?.effectivePersonalPlan ||
      capabilities?.personalPlan ||
      user?.nutritionCapabilities?.plan ||
      user?.plan ||
      "free"
  ).toLowerCase();
}

function planLabel(value = "free") {
  const plan = String(value || "free").toLowerCase();
  if (plan === "premium" || plan === "pro") return "Pro";
  if (plan === "premium2" || plan === "vip") return "VIP";
  return "Free";
}

function menuDayLimit(capabilities = {}, user = {}) {
  const raw =
    capabilities?.limits?.menuDays ??
    capabilities?.limits?.ownMenuDays ??
    capabilities?.limits?.daysPerMenu ??
    capabilities?.maxMenuDays ??
    capabilities?.menuDaysLimit;
  const fromCapabilities = Number(raw);
  if (Number.isFinite(fromCapabilities) && fromCapabilities > 0) return Math.min(7, fromCapabilities);
  return planLabel(planKey(capabilities, user)) === "Free" ? 1 : 7;
}

function ownMenusLimit(capabilities = {}) {
  const raw = capabilities?.limits?.ownMenus ?? capabilities?.maxOwnMenus ?? capabilities?.ownMenusLimit;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function selectedDaysForPlan(capabilities = {}, user = {}) {
  return DAYS.slice(0, menuDayLimit(capabilities, user)).map(([key]) => key);
}

function defaultMeals(count = 4) {
  const mealTypes = {
    3: ["desayuno", "almuerzo", "cena"],
    4: BASE_MEALS,
    5: [...BASE_MEALS, "snack"],
    6: ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack"],
  }[Math.max(3, Math.min(6, Math.round(Number(count) || 4)))] || BASE_MEALS;
  return mealTypes.map((type, index) => ({
    ...emptyMeal(type),
    orden: index + 1,
  }));
}

function emptyDraft(capabilities = {}, user = {}, options = {}) {
  const explicitDayLimit = Number(options.dayLimit);
  const dayLimit = Number.isFinite(explicitDayLimit) && explicitDayLimit > 0
    ? Math.min(7, explicitDayLimit)
    : menuDayLimit(capabilities, user);
  const requestedDays = Array.isArray(options.selectedDays)
    ? [...new Set(options.selectedDays.filter((day) => DAYS.some(([key]) => key === day)))].slice(0, dayLimit)
    : [];
  return {
    nombre: String(options.nombre || "Mi menu").trim() || "Mi menu",
    descripcion: "",
    fechaInicio: /^\d{4}-\d{2}-\d{2}$/.test(String(options.fechaInicio || options.initialDate || "")) ? String(options.fechaInicio || options.initialDate) : localIsoDate(),
    objectiveMode: options.objectiveMode === "custom" ? "custom" : "current",
    menuTarget: options.objectiveMode === "custom" && options.menuTarget ? options.menuTarget : null,
    selectedDays: requestedDays.length ? requestedDays : selectedDaysForPlan(capabilities, user),
    comidas: defaultMeals(options.mealCount),
    isActiveOwnMenu: false,
  };
}

function clientMenuDraftStorageKey(user = {}) {
  const owner = String(user?.id || user?._id || user?.email || "anonymous");
  return `zumafit:client-menu-draft:v1:${owner}`;
}

function loadClientMenuDraft(user = {}) {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(clientMenuDraftStorageKey(user)) || "null");
    return parsed?.version === 1 && parsed?.draft?.nombre && Array.isArray(parsed?.draft?.comidas) ? parsed.draft : null;
  } catch {
    return null;
  }
}

function saveClientMenuDraft(user = {}, draft = null) {
  if (typeof window === "undefined" || !draft) return;
  try { window.localStorage.setItem(clientMenuDraftStorageKey(user), JSON.stringify({ version: 1, draft, updatedAt: new Date().toISOString() })); } catch { /* storage puede estar bloqueado */ }
}

function clearClientMenuDraft(user = {}) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(clientMenuDraftStorageKey(user)); } catch { /* storage puede estar bloqueado */ }
}

function itemTotals(items = []) {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + toNumber(item.kcal),
      proteina: acc.proteina + toNumber(item.proteina),
      carbs: acc.carbs + toNumber(item.carbs),
      grasas: acc.grasas + toNumber(item.grasas),
    }),
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
  );
}

function menuTotals(menu = {}) {
  return (menu.comidas || []).reduce((acc, meal) => {
    const totals = meal.totales || itemTotals(meal.items || []);
    return {
      kcal: acc.kcal + toNumber(totals.kcal),
      proteina: acc.proteina + toNumber(totals.proteina),
      carbs: acc.carbs + toNumber(totals.carbs),
      grasas: acc.grasas + toNumber(totals.grasas),
    };
  }, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

function normalizeItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    id: item.id || uid("item"),
  }));
}

function normalizeMenuForDraft(menu = {}, capabilities = {}, user = {}) {
  const dayKeys = Object.keys(menu.dias || {}).filter(Boolean);
  const planDays = selectedDaysForPlan(capabilities, user);
  const sourceMeals = Array.isArray(menu.comidas) && menu.comidas.length
    ? menu.comidas
    : dayKeys.length
      ? menu.dias[dayKeys[0]]?.comidas || []
      : [];
  const comidas = (Array.isArray(sourceMeals) ? sourceMeals : []).map((meal, index) => ({
    id: meal.id || uid("meal"),
    nombre: meal.nombre || titleForMealType(meal.tipoComida) || `Comida ${index + 1}`,
    tipoComida: meal.tipoComida || "otra",
    orden: meal.orden || index + 1,
    items: normalizeItems(meal.items || meal.alimentos || []),
    target: meal.target || meal.meta || null,
  }));

  return {
    id: menu.id || menu._id,
    nombre: menu.nombre || "Mi menu",
    descripcion: menu.descripcion || "",
    fechaInicio: menu.fechaInicio ? String(menu.fechaInicio).slice(0, 10) : localIsoDate(),
    objectiveMode: menu.objectiveMode || menu.estrategiaObjetivo || "current",
    menuTarget: menu.kcalObjetivo || menu.macrosObjetivo ? {
      kcal: toNumber(menu.kcalObjetivo),
      proteina: toNumber(menu.macrosObjetivo?.proteina),
      carbs: toNumber(menu.macrosObjetivo?.carbs),
      grasas: toNumber(menu.macrosObjetivo?.grasas),
    } : null,
    selectedDays: (dayKeys.length ? dayKeys : planDays).slice(0, menuDayLimit(capabilities, user)),
    comidas: comidas.length ? comidas : defaultMeals(),
    isActiveOwnMenu: !!menu.isActiveOwnMenu,
  };
}

function defaultQuantity(unit = "") {
  const normalized = String(unit || "").toLowerCase();
  return ["unidad", "u", "porcion"].some((part) => normalized.includes(part)) ? 1 : 100;
}

function foodDisplayName(food = {}) {
  return food.nombre || food.name || food.Alimentos || food.alimentos || "Alimento";
}

function foodDisplayUnit(food = {}) {
  return food.unidad || food.unit || food.Unidad || food.unidadBase || "g";
}

function suggestedFoodQuantity(food = {}) {
  const unit = foodDisplayUnit(food);
  return firstNumber(food.porcionSugerida, food.raw?.porcionSugerida, defaultQuantity(unit));
}

function normalizeFoodSearchResults(payload) {
  if (Array.isArray(payload)) return payload.filter(Boolean);
  if (Array.isArray(payload?.alimentos)) return payload.alimentos.filter(Boolean);
  if (Array.isArray(payload?.items)) return payload.items.filter(Boolean);
  if (Array.isArray(payload?.data)) return payload.data.filter(Boolean);
  if (Array.isArray(payload?.rows)) return payload.rows.filter(Boolean);
  if (Array.isArray(payload?.results)) return payload.results.filter(Boolean);
  if (Array.isArray(payload?.all)) return payload.all.filter(Boolean);
  return [];
}

function focusAfterPaint(ref) {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => ref?.current?.focus?.());
}

function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) document.body.style.paddingRight = `${scrollBarWidth}px`;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [active]);
}

function rescaleItem(item = {}, nextCantidad = item.cantidad) {
  const currentQty = Math.max(toNumber(item.cantidad, 0), 0.0001);
  const nextQty = clampPositive(nextCantidad);
  const factor = nextQty / currentQty;
  return {
    ...item,
    cantidad: nextQty,
    kcal: Math.round(toNumber(item.kcal) * factor * 10) / 10,
    proteina: Math.round(toNumber(item.proteina) * factor * 10) / 10,
    carbs: Math.round(toNumber(item.carbs) * factor * 10) / 10,
    grasas: Math.round(toNumber(item.grasas) * factor * 10) / 10,
  };
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function nutritionTargetFromUser(user = {}) {
  const metas = user?.metasActuales || user?.metas || {};
  const macros = metas?.macros || metas?.macrosObjetivo || user?.macrosObjetivo || {};
  const kcal = firstNumber(
    metas.kcal,
    metas.calorias,
    metas.caloriasObjetivo,
    metas.objetivoCalorico,
    user?.objetivoCalorico,
    user?.kcalObjetivo
  );
  const proteina = firstNumber(macros.p, macros.proteina, macros.proteinas, macros.protein, user?.proteinaObjetivo);
  const carbs = firstNumber(macros.c, macros.carbs, macros.carbohidratos, user?.carbsObjetivo);
  const grasas = firstNumber(macros.g, macros.grasas, macros.fat, user?.grasasObjetivo);
  if (!kcal && !proteina && !carbs && !grasas) return null;
  return { kcal, proteina, carbs, grasas };
}

function missingFromTarget(totals = {}, target = null) {
  if (!target) return null;
  return {
    kcal: Math.max(0, toNumber(target.kcal) - toNumber(totals.kcal)),
    proteina: Math.max(0, toNumber(target.proteina) - toNumber(totals.proteina)),
    carbs: Math.max(0, toNumber(target.carbs) - toNumber(totals.carbs)),
    grasas: Math.max(0, toNumber(target.grasas) - toNumber(totals.grasas)),
  };
}

function progressPercent(value, target) {
  const goal = toNumber(target);
  if (!goal) return 0;
  return Math.max(0, Math.min(100, (toNumber(value) / goal) * 100));
}

function planTone(plan) {
  const label = planLabel(plan).toLowerCase();
  return label === "vip" ? "vip" : label === "pro" ? "pro" : "free";
}

function hasMenuFood(draft = {}) {
  return (draft.comidas || []).some((meal) => (meal.items || []).length);
}

function menuId(menu = {}) {
  return String(menu.id || menu._id || "");
}

export default function ClientMenusPanel({
  onToast,
  createSignal = 0,
  editMenuRequest = null,
  user = {},
  directCreate = false,
  initialDraft = null,
  initialDate = "",
  initialTarget = null,
  initialMealCount = 4,
  initialSetup = null,
  activeMenuComparison = null,
  returnTo = "/app/menu",
  onUsageChange,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menus, setMenus] = useState([]);
  const [capabilities, setCapabilities] = useState(user?.nutritionCapabilities || null);
  const [pagination, setPagination] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(() => (
    directCreate && !editMenuRequest?.id
      ? { mode: "create", draft: initialDraft || (initialSetup ? emptyDraft(user?.nutritionCapabilities || {}, user, { initialDate, mealCount: initialMealCount, ...initialSetup }) : loadClientMenuDraft(user)) || emptyDraft(user?.nutritionCapabilities || {}, user, { initialDate, mealCount: initialMealCount }) }
      : null
  ));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [limitPrompt, setLimitPrompt] = useState(false);
  const savingRef = useRef(false);
  const loadSeq = useRef(0);
  const handledCreateSignal = useRef(0);
  const handledEditToken = useRef(null);

  const loadMenus = useCallback(async () => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setError("");
    try {
      const data = await listClientMenus({ includeComidas: true, limit: 40, search: debouncedSearch });
      if (loadSeq.current !== seq) return;
      setMenus(data?.items || []);
      setCapabilities(data?.capabilities || user?.nutritionCapabilities || null);
      setPagination(data?.pagination || null);
      setActiveMenu(data?.activeMenu || null);
    } catch (err) {
      if (loadSeq.current !== seq) return;
      setError(err?.message || "No se pudieron cargar tus menus.");
    } finally {
      if (loadSeq.current === seq) setLoading(false);
    }
  }, [debouncedSearch, user?.nutritionCapabilities]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const totalMenus = pagination?.total ?? menus.length;
  const ownLimit = ownMenusLimit(capabilities);
  const limitReached = Number.isFinite(ownLimit) && totalMenus >= ownLimit;
  const plan = planKey(capabilities, user);
  const dayLimit = menuDayLimit(capabilities, user);
  const canOpenCreate = capabilities?.canCreateOwnMenu !== false && !limitReached;
  const hasEditMenuRequest = Boolean(editMenuRequest?.id);

  const openCreate = useCallback(() => {
    if (!canOpenCreate) {
      setLimitPrompt(true);
      return;
    }
    if (!directCreate) {
      navigate("/app/menu/nuevo", {
        state: { from: location.pathname },
      });
      return;
    }
    setEditor({ mode: "create", draft: emptyDraft(capabilities, user, { initialDate, mealCount: initialMealCount, ...(initialSetup || {}) }) });
  }, [canOpenCreate, capabilities, directCreate, initialDate, initialMealCount, initialSetup, location.pathname, navigate, user]);

  useEffect(() => {
    if (!directCreate || loading) return;
    if (hasEditMenuRequest) return;
    if (limitReached || capabilities?.canCreateOwnMenu === false) {
      setEditor(null);
      setLimitPrompt(true);
      return;
    }
    setEditor((current) => {
      if (initialDraft && current?.mode === "create" && current.draft !== initialDraft) {
        return { mode: "create", draft: initialDraft };
      }
      return current || { mode: "create", draft: initialDraft || emptyDraft(capabilities, user, { initialDate, mealCount: initialMealCount, ...(initialSetup || {}) }) };
    });
  }, [capabilities, directCreate, hasEditMenuRequest, initialDate, initialDraft, initialMealCount, initialSetup, limitReached, loading, user]);

  useEffect(() => {
    if (!createSignal || handledCreateSignal.current === createSignal || loading) return;
    handledCreateSignal.current = createSignal;
    openCreate();
  }, [createSignal, loading, openCreate]);

  useEffect(() => {
    const requestId = editMenuRequest?.id ? String(editMenuRequest.id) : "";
    const token = editMenuRequest?.token || requestId;
    if (!requestId || handledEditToken.current === token || loading) return;
    const localMenu = menus.find((menu) => menuId(menu) === requestId);

    async function openRequestedMenu() {
      handledEditToken.current = token;
      try {
        const menu = localMenu || await getClientMenu(requestId);
        if (menu) {
          const normalized = normalizeMenuForDraft(menu, capabilities, user);
          if (editMenuRequest?.focusName) normalized.focusName = true;
          setEditor({ mode: "edit", draft: normalized });
        }
      } catch (err) {
        onToast?.({ type: "error", message: err?.message || "No pudimos abrir ese menu." });
      }
    }

    openRequestedMenu();
  }, [capabilities, editMenuRequest, loading, menus, onToast, user]);

  const limitText = useMemo(() => {
    return Number.isFinite(ownLimit) ? `${totalMenus} de ${ownLimit} menus` : `${totalMenus} menus`;
  }, [ownLimit, totalMenus]);

  async function runAction(fn, successMessage) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await fn();
      if (successMessage) onToast?.({ type: "success", message: successMessage });
      await loadMenus();
      onUsageChange?.();
      return true;
    } catch (err) {
      onToast?.({ type: "error", message: err?.error || err?.message || "No se pudo completar la accion." });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function openEdit(menu) {
    setEditor({ mode: "edit", draft: normalizeMenuForDraft(menu, capabilities, user) });
  }

  function closeEditor(options = {}) {
    if (directCreate && !options?.skipConfirm) {
      const ok = window.confirm("Salir del creador sin guardar los cambios?");
      if (!ok) return;
      clearClientMenuDraft(user);
      navigate(returnTo || "/app/menu", { replace: true });
      return;
    }
    if (directCreate) {
      clearClientMenuDraft(user);
      navigate(returnTo || "/app/menu", { replace: true });
      return;
    }
    setEditor(null);
  }

  async function handleSave(draft, activate = false) {
    const isEditingActiveMenu = editor?.mode === "edit" && draft?.isActiveOwnMenu;
    const cleanDraft = { ...draft };
    delete cleanDraft.focusName;
    delete cleanDraft.isActiveOwnMenu;
    const selectedTarget = cleanDraft.objectiveMode === "custom" ? cleanDraft.menuTarget : initialTarget || nutritionTargetFromUser(user);
    const payload = {
      ...cleanDraft,
      activate,
      estrategiaObjetivo: cleanDraft.objectiveMode || "current",
      kcalObjetivo: toNumber(selectedTarget?.kcal),
      macrosObjetivo: {
        proteina: toNumber(selectedTarget?.proteina),
        carbs: toNumber(selectedTarget?.carbs),
        grasas: toNumber(selectedTarget?.grasas),
      },
    };
    delete payload.menuTarget;
    delete payload.objectiveMode;
    const ok = await runAction(async () => {
      if (editor.mode === "edit" && draft.id) await updateClientMenu(draft.id, payload);
      else await createClientMenu(payload);
      setEditor(null);
      clearClientMenuDraft(user);
    }, isEditingActiveMenu ? "Cambios guardados." : activate ? "Menu guardado y activado." : "Menu guardado.");
    if (ok && activate) navigate("/app/menu", { replace: true });
    if (ok && !activate && directCreate) {
      navigate(isEditingActiveMenu ? returnTo || "/app/menu" : "/app/nutricion?tab=mineMenus", { replace: true });
    }
  }

  async function handleDelete(menu) {
    const active = !!menu.isActiveOwnMenu;
    const ok = window.confirm(active
      ? "Este es tu menu activo. Si lo eliminas tambien se desactiva tu planificacion propia. Continuar?"
      : `Eliminar "${menu.nombre}"?`);
    if (!ok) return;
    await runAction(() => deleteClientMenu(menuId(menu), { confirmActiveDelete: active }), "Menu eliminado.");
  }

  async function handleSaveMealFromMenu(meal = {}) {
    if (!(meal.items || []).length) {
      onToast?.({ type: "warning", message: "Agrega al menos un alimento antes de guardar esta comida." });
      return;
    }
    await runAction(() => createSavedMeal({
      nombre: meal.nombre || titleForMealType(meal.tipoComida),
      descripcion: "Guardada desde mi menu propio.",
      tipoComida: meal.tipoComida || "otra",
      tags: ["menu propio"],
      favorita: false,
      items: (meal.items || []).map((item) => ({
        alimentoId: item.alimentoId || item.id,
        nombre: item.nombreSnapshot || item.nombre,
        cantidad: Number(item.cantidad) || 0,
        unidad: item.unidad || "g",
        kcal: item.kcal,
        proteina: item.proteina,
        proteinas: item.proteina,
        carbs: item.carbs,
        carbohidratos: item.carbs,
        grasas: item.grasas,
        fibra: item.fibra || 0,
        categoria: item.categoriaSnapshot || item.categoria || "",
        imagenUrl: item.imagenUrl,
        imagenAlt: item.imagenAlt || item.nombreSnapshot || item.nombre || "",
      })),
    }), "Comida guardada en Mis comidas.");
  }

  async function handleDeleteAndCreate() {
    const menu = menus[0];
    if (!menu) {
      setLimitPrompt(false);
      openCreate();
      return;
    }
    const ok = window.confirm(`Para crear otro menu en Free tenes que eliminar "${menu.nombre}". Queres eliminarlo y empezar uno nuevo?`);
    if (!ok) return;
    await runAction(async () => {
      await deleteClientMenu(menuId(menu), { confirmActiveDelete: !!menu.isActiveOwnMenu });
      const data = await listClientMenus({ includeComidas: true, limit: 40, search: debouncedSearch });
      setMenus(data?.items || []);
      setCapabilities(data?.capabilities || user?.nutritionCapabilities || null);
      setPagination(data?.pagination || null);
      setActiveMenu(data?.activeMenu || null);
      setEditor({ mode: "create", draft: emptyDraft(data?.capabilities || capabilities, user, { initialDate, mealCount: initialMealCount, ...(initialSetup || {}) }) });
      setLimitPrompt(false);
    }, "Menu anterior eliminado. Ya podes crear uno nuevo.");
  }

  if (directCreate) {
    return (
      <section className="client-menu-create-route" aria-busy={loading ? "true" : "false"}>
        {editor ? (
          <MenuEditor
            mode={editor.mode}
            draft={editor.draft}
            saving={saving}
            loadingContext={loading}
            contextError={error}
            onRetryContext={loadMenus}
            wizardStep={initialSetup ? 3 : null}
            onDraftChange={(draft) => saveClientMenuDraft(user, draft)}
            canActivate={capabilities?.canActivateOwnMenu !== false && capabilities?.activeMenuSource !== "coach"}
            capabilities={capabilities}
            user={user}
            currentTargetOverride={initialTarget}
            activeMenuComparison={activeMenuComparison}
            onClose={closeEditor}
            onSave={handleSave}
            onSaveMeal={handleSaveMealFromMenu}
            onOpenPlans={() => navigate("/app/planes")}
            embedded
          />
        ) : null}

        {limitPrompt ? (
          <LimitPrompt
            plan={plan}
            menu={menus[0]}
            saving={saving}
            onClose={() => navigate(returnTo || "/app/menu", { replace: true })}
            onDeleteAndCreate={handleDeleteAndCreate}
            onOpenPlans={() => navigate("/app/planes")}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="client-menus">
      <header className="client-menus-head">
        <div>
          <span className="nl-kicker">Planificacion propia</span>
          <h2>Mis menus</h2>
          <p>Crealos, editalos y activa uno como tu planificacion. Tracking sigue disponible siempre.</p>
        </div>
        <div className="client-menus-actions">
          <span className="client-limit">{limitText}</span>
          <span className="client-limit">Plan {planLabel(plan)}</span>
          <button
            type="button"
            className="nl-primary"
            onClick={openCreate}
            disabled={saving || capabilities?.canCreateOwnMenu === false}
            {...createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false })}
          >
            <Plus size={16} />
            Crear menu
          </button>
        </div>
      </header>

      {dayLimit <= 1 ? (
        <div className="client-menu-warning">
          <Info size={17} />
          <span>En Free, tu menu usa un unico dia base. Con Pro podes planificar hasta siete dias por menu.</span>
        </div>
      ) : null}

      {limitReached ? (
        <div className="client-menu-warning" role="status">
          <AlertTriangle size={17} />
          <span>
            <strong>{plan === "free" ? "Limite Free alcanzado." : `Limite ${planLabel(plan)} alcanzado.`}</strong>{" "}
            {plan === "free" ? "Actualiza a Pro para crear mas menus." : "Elimina un menu antes de duplicar otro."}
          </span>
        </div>
      ) : null}

      <label className="client-menu-search">
        <Search size={16} />
        <span className="sr-only">Buscar menu propio</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar en mis menus"
          aria-label="Buscar en mis menus"
        />
      </label>

      {capabilities?.hasCoach && capabilities?.activeMenuSource === "coach" ? (
        <div className="client-menu-warning">
          <AlertTriangle size={17} />
          <span>Tu menu esta gestionado por tu coach. Podes guardar menus propios, pero no activarlos mientras ese plan este vigente.</span>
        </div>
      ) : null}

      {activeMenu ? (
        <div className="client-active-strip">
          <CheckCircle2 size={17} />
          <span>Menu propio activo: <strong>{activeMenu.nombre}</strong></span>
          <button type="button" onClick={() => runAction(deactivateClientMenu, "Ahora estas usando solo Tracking.")} disabled={saving}>
            Usar solo Tracking
          </button>
        </div>
      ) : null}

      {error ? <div className="nl-state error">{error}</div> : null}
      {loading ? <div className="nl-state"><Loader2 className="nl-spin" size={18} /> Cargando tus menus...</div> : null}

      {!loading && !error && !menus.length ? (
        debouncedSearch ? (
          <div className="client-empty-menu" role="status">
            <Search size={22} />
            <strong>Sin resultados</strong>
            <span>No encontramos menus propios que coincidan con esa busqueda.</span>
          </div>
        ) : (
          <button
            type="button"
            className="client-empty-menu"
            onClick={openCreate}
            {...createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false })}
          >
            <Plus size={22} />
            <strong>Crear mi primer menu</strong>
            <span>Arrancas con Desayuno, Almuerzo, Merienda y Cena. Despues podes renombrarlas o eliminarlas.</span>
          </button>
        )
      ) : null}

      {!loading && menus.length ? (
        <div className="client-menu-grid">
          {menus.map((menu) => (
            <ClientMenuCard
              key={menuId(menu)}
              menu={menu}
              saving={saving}
              capabilities={capabilities}
              canActivate={capabilities?.canActivateOwnMenu !== false && capabilities?.activeMenuSource !== "coach"}
              canDuplicate={capabilities?.canDuplicateOwnMenu !== false && !limitReached}
              onEdit={() => openEdit(menu)}
              onActivate={() => runAction(() => activateClientMenu(menuId(menu)), "Menu activado.")}
              onDuplicate={() => runAction(() => duplicateClientMenu(menuId(menu)), "Menu duplicado.")}
              onDelete={() => handleDelete(menu)}
            />
          ))}
        </div>
      ) : null}

      {editor ? (
        <MenuEditor
          mode={editor.mode}
          draft={editor.draft}
          saving={saving}
          canActivate={capabilities?.canActivateOwnMenu !== false && capabilities?.activeMenuSource !== "coach"}
          capabilities={capabilities}
          user={user}
          currentTargetOverride={initialTarget}
          activeMenuComparison={activeMenuComparison}
          onClose={closeEditor}
          onSave={handleSave}
          onSaveMeal={handleSaveMealFromMenu}
          onOpenPlans={() => navigate("/app/planes")}
        />
      ) : null}

      {limitPrompt ? (
        <LimitPrompt
          plan={plan}
          menu={menus[0]}
          saving={saving}
          onClose={() => setLimitPrompt(false)}
          onDeleteAndCreate={handleDeleteAndCreate}
          onOpenPlans={() => navigate("/app/planes")}
        />
      ) : null}
    </section>
  );
}

function ClientMenuCard({ menu, saving, capabilities, canActivate, canDuplicate, onEdit, onActivate, onDuplicate, onDelete }) {
  const totals = menu.macrosTotales || menuTotals(menu);
  const dayCount = Object.keys(menu.dias || {}).length || menu.selectedDays?.length || 0;
  const updatedAt = menu.updatedAt ? new Date(menu.updatedAt) : null;
  const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime())
    ? updatedAt.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
    : "Sin fecha";
  return (
    <article className={`client-menu-card ${menu.isActiveOwnMenu ? "active" : ""}`}>
      <div className="client-card-top">
        <div>
          <span className="client-badge">{menu.isActiveOwnMenu ? "Activo" : menu.source === "copied_from_admin" ? "Copia ZumaFit" : "Propio"}</span>
          <h3>{menu.nombre}</h3>
        </div>
        {menu.isActiveOwnMenu ? <CheckCircle2 size={22} /> : null}
      </div>
      <p>{menu.descripcion || "Menu personal guardado en tu biblioteca."}</p>
      <div className="client-menu-macros">
        <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
        <span>P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}</span>
      </div>
      <small>
        {dayCount ? `${dayCount} dias - ` : ""}
        {formatNumber(menu.cantidadComidas || menu.comidas?.length || 0, 0)} comidas - Act. {updatedLabel}
      </small>
      <div className="client-card-actions">
        {capabilities?.canActivateOwnMenu !== false ? (
          <button type="button" onClick={onActivate} disabled={saving || menu.isActiveOwnMenu || !canActivate}>
            <Power size={15} />
            Activar
          </button>
        ) : null}
        {capabilities?.canEditOwnMenu !== false ? (
          <button type="button" onClick={onEdit} disabled={saving}>
            <Edit3 size={15} />
            Editar
          </button>
        ) : null}
        {capabilities?.canDuplicateOwnMenu !== false ? (
          <button
            type="button"
            onClick={onDuplicate}
            disabled={saving || !canDuplicate}
            title={!canDuplicate ? "Limite del plan alcanzado" : undefined}
          >
            <Copy size={15} />
            Duplicar
          </button>
        ) : null}
        {capabilities?.canDeleteOwnMenu !== false ? (
          <button type="button" className="danger" onClick={onDelete} disabled={saving}>
            <Trash2 size={15} />
            Eliminar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MenuEditor({
  mode,
  draft: initialDraft,
  saving,
  canActivate,
  capabilities,
  user,
  currentTargetOverride = null,
  activeMenuComparison = null,
  embedded = false,
  loadingContext = false,
  contextError = "",
  onClose,
  onSave,
  onSaveMeal,
  onOpenPlans,
  onRetryContext,
  onDraftChange,
  wizardStep = null,
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [addOpen, setAddOpen] = useState(false);
  const [customMealName, setCustomMealName] = useState("");
  const [customMealType, setCustomMealType] = useState("snack");
  const [dayLimitMessage, setDayLimitMessage] = useState("");
  const [missingOpen, setMissingOpen] = useState(false);
  const [nameEditing, setNameEditing] = useState(Boolean(initialDraft.focusName));
  const [descriptionOpen, setDescriptionOpen] = useState(Boolean(initialDraft.descripcion));
  const [mealBuilder, setMealBuilder] = useState(null);
  const totals = useMemo(() => menuTotals(draft), [draft]);
  const currentTarget = useMemo(() => currentTargetOverride || nutritionTargetFromUser(user), [currentTargetOverride, user]);
  const target = draft.objectiveMode === "custom" ? draft.menuTarget : currentTarget;
  const missing = useMemo(() => missingFromTarget(totals, target), [target, totals]);
  const dayLimit = menuDayLimit(capabilities, user);
  const singleDay = dayLimit <= 1;
  const canActivateDraft = canActivate && hasMenuFood(draft);
  const editingActiveMenu = mode === "edit" && !!draft.isActiveOwnMenu;
  const plan = planKey(capabilities, user);
  const tone = planTone(plan);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialDraft), [draft, initialDraft]);

  useEffect(() => {
    if (embedded) onDraftChange?.(draft);
  }, [draft, embedded, onDraftChange]);

  const handleClose = useCallback(() => {
    if (dirty) {
      const ok = window.confirm("Tenes cambios sin guardar. Queres descartarlos?");
      if (!ok) return;
    }
    onClose({ skipConfirm: true });
  }, [dirty, onClose]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, saving]);

  function updateMeal(mealId, patch) {
    setDraft((current) => ({
      ...current,
      comidas: current.comidas.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)),
    }));
  }

  function addMeal(type = "snack", name = "") {
    setDraft((current) => {
      if ((current.comidas || []).length >= MAX_MEALS_PER_DAY) return current;
      const meal = {
        ...emptyMeal(type, { nombre: name || titleForMealType(type) }),
        orden: current.comidas.length + 1,
      };
      return { ...current, comidas: [...current.comidas, meal] };
    });
    setAddOpen(false);
    setCustomMealName("");
  }

  function removeMeal(mealId) {
    setDraft((current) => ({
      ...current,
      comidas: current.comidas.filter((meal) => meal.id !== mealId).map((meal, index) => ({ ...meal, orden: index + 1 })),
    }));
  }

  function duplicateMeal(mealId) {
    setDraft((current) => {
      if ((current.comidas || []).length >= MAX_MEALS_PER_DAY) return current;
      const index = current.comidas.findIndex((meal) => meal.id === mealId);
      if (index < 0) return current;
      const source = current.comidas[index];
      const duplicate = {
        ...source,
        id: uid("meal"),
        nombre: `${source.nombre || titleForMealType(source.tipoComida)} copia`,
        items: (source.items || []).map((item) => ({ ...item, id: uid("item") })),
      };
      const comidas = [...current.comidas];
      comidas.splice(index + 1, 0, duplicate);
      return { ...current, comidas: comidas.map((meal, mealIndex) => ({ ...meal, orden: mealIndex + 1 })) };
    });
  }

  function moveMeal(mealId, direction) {
    setDraft((current) => {
      const index = current.comidas.findIndex((meal) => meal.id === mealId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.comidas.length) return current;
      const next = [...current.comidas];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return { ...current, comidas: next.map((meal, mealIndex) => ({ ...meal, orden: mealIndex + 1 })) };
    });
  }

  function distributedTargetForMeal() {
    const count = Math.max(1, draft.comidas?.length || 1);
    if (!target) return null;
    return {
      kcal: Math.round((toNumber(target.kcal) / count) * 10) / 10,
      proteina: Math.round((toNumber(target.proteina) / count) * 10) / 10,
      carbs: Math.round((toNumber(target.carbs) / count) * 10) / 10,
      grasas: Math.round((toNumber(target.grasas) / count) * 10) / 10,
    };
  }

  function openMealBuilder(meal) {
    const mealTarget = meal.target || distributedTargetForMeal();
    if (!mealTarget?.kcal) return;
    if (!meal.target) updateMeal(meal.id, { target: mealTarget });
    setMealBuilder({
      row: { date: draft.fechaInicio || localIsoDate(), tracking: { menuId: draft.id || "new-own-menu" } },
      baseMeal: { ...meal, target: mealTarget, totals: mealTarget, totales: mealTarget },
      meal: { ...meal, target: mealTarget, totals: mealTarget, totales: mealTarget },
      mealIndex: Math.max(0, draft.comidas.findIndex((entry) => entry.id === meal.id)),
      menuId: draft.id || "new-own-menu",
      menuVersion: String(initialDraft.updatedAt || "draft-1"),
    });
  }

  async function applyBuiltMeal({ replacementMeal, saveTemplate = false } = {}) {
    const originalId = mealBuilder?.baseMeal?.id;
    if (!originalId || !replacementMeal) return;
    updateMeal(originalId, {
      items: normalizeItems(replacementMeal.items || replacementMeal.foods || []),
      target: mealBuilder.baseMeal.target || null,
    });
    if (saveTemplate) {
      await createSavedMeal({
        nombre: replacementMeal.nombre || replacementMeal.name || "Mi comida equivalente",
        descripcion: "Guardada desde mi menu",
        tipoComida: replacementMeal.mealType || mealBuilder.baseMeal.tipoComida || "otro",
        origen: "menuPropioEquivalente",
        favorita: true,
        items: replacementMeal.items || [],
        equivalenceReference: replacementMeal.equivalenceReference || null,
      });
    }
    setMealBuilder(null);
  }

  function toggleDay(dayKey) {
    setDayLimitMessage("");
    setDraft((current) => {
      if (singleDay) {
        setDayLimitMessage("Tu plan Free permite un unico dia base. Con Pro podes organizar una semana completa.");
        return { ...current, selectedDays: [current.selectedDays[0] || dayKey] };
      }
      const exists = current.selectedDays.includes(dayKey);
      const selectedDays = exists
        ? current.selectedDays.filter((day) => day !== dayKey)
        : [...current.selectedDays, dayKey];
      if (!exists && selectedDays.length > dayLimit) {
        setDayLimitMessage(`Tu plan permite hasta ${dayLimit} dias por menu.`);
        return current;
      }
      return { ...current, selectedDays: selectedDays.length ? selectedDays : [dayKey] };
    });
  }

  return (
    <section
      className={embedded ? "client-editor-embedded" : "nl-modal client-editor-modal"}
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby="client-menu-editor-title"
    >
      <div className={`client-editor client-editor-pro plan-${tone}`}>
        {wizardStep ? <span className="client-editor-wizard-step">Paso {wizardStep} de 3</span> : null}
        <header className="client-editor-top">
          <button type="button" className="nl-icon" onClick={handleClose} aria-label="Volver">
            <ChevronDown size={18} />
          </button>
          <div className="client-editor-title-block">
            <span className="nl-kicker">{mode === "edit" ? "Editar menú diario" : wizardStep ? "Completar comidas" : "Crear menú diario"}</span>
            <div className="client-editor-title-row">
              {nameEditing ? (
                <input
                  className="client-editor-name-input"
                  value={draft.nombre}
                  maxLength={180}
                  autoFocus
                  onBlur={() => setNameEditing(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setNameEditing(false);
                    if (event.key === "Escape") setNameEditing(false);
                  }}
                  onChange={(event) => setDraft({ ...draft, nombre: event.target.value })}
                  aria-label="Nombre del menu"
                />
              ) : (
                <h2 id="client-menu-editor-title">{draft.nombre || "Mi menu"}</h2>
              )}
              <button type="button" className="client-inline-icon" onClick={() => setNameEditing(true)} aria-label="Editar nombre del menu">
                <Edit3 size={17} />
              </button>
            </div>
            <p className="client-plan-inline">
              <span className={`client-plan-chip ${tone}`}><Crown size={15} /> Plan {planLabel(plan)}</span>
              <span>{singleDay ? "1 dia base" : `Hasta ${dayLimit} dias`}</span>
              {singleDay ? <Info size={15} aria-hidden="true" /> : null}
            </p>
          </div>
          <button type="button" className="nl-icon" onClick={handleClose} aria-label="Cerrar creador">
            <X size={18} />
          </button>
        </header>

        <div className="client-editor-info">
          <Info size={22} />
          <p>{wizardStep ? `Completá las ${draft.comidas.length} comidas iniciales. Podés renombrarlas, ordenarlas o agregar otras.` : `Empezás con ${draft.comidas.length} comidas. Podés renombrarlas, eliminarlas, ordenarlas o agregar otras.`}</p>
        </div>

        {wizardStep ? (
          <section className="client-wizard-config-summary" aria-label="Configuración elegida">
            <span><CalendarDays size={15} /><small>Comienza</small><strong>{draft.fechaInicio || "–"}</strong></span>
            <span><Target size={15} /><small>Objetivo</small><strong>{target?.kcal ? `${formatNumber(target.kcal, 0)} kcal` : "Sin meta"}</strong></span>
            <span><Utensils size={15} /><small>Días</small><strong>{draft.selectedDays?.length || 1}</strong></span>
          </section>
        ) : null}

        {activeMenuComparison?.current && activeMenuComparison?.proposed ? (
          <section className="client-menu-comparison" aria-label="Comparacion con el menu activo">
            <div><span>Menu actual</span><strong>{formatNumber(activeMenuComparison.current.kcal, 0)} kcal</strong><small>P {formatNumber(activeMenuComparison.current.proteina, 0)} · C {formatNumber(activeMenuComparison.current.carbs, 0)} · G {formatNumber(activeMenuComparison.current.grasas, 0)}</small></div>
            <ChevronRight size={18} aria-hidden="true" />
            <div><span>Nueva propuesta</span><strong>{formatNumber(activeMenuComparison.proposed.kcal, 0)} kcal</strong><small>P {formatNumber(activeMenuComparison.proposed.proteina, 0)} · C {formatNumber(activeMenuComparison.proposed.carbs, 0)} · G {formatNumber(activeMenuComparison.proposed.grasas, 0)}</small></div>
            <p>Tu menu actual sigue intacto. Guardar crea una alternativa; solo “Guardar y activar” cambia el menu vigente.</p>
          </section>
        ) : null}

        {loadingContext ? (
          <div className="client-menu-context-status" role="status">
            <Loader2 size={15} className="nl-spin" />
            <span>Verificando disponibilidad de menu...</span>
          </div>
        ) : null}

        {contextError ? (
          <div className="client-menu-warning compact error">
            <AlertTriangle size={15} />
            <span>No pudimos verificar tus menus. Podes seguir editando y reintentar antes de guardar.</span>
            <button type="button" onClick={onRetryContext}>Reintentar</button>
          </div>
        ) : null}

        <div className="client-description-panel">
          {descriptionOpen ? (
            <label>
              Descripcion opcional
              <input
                value={draft.descripcion}
                maxLength={2500}
                onChange={(event) => setDraft({ ...draft, descripcion: event.target.value })}
                placeholder="Ej: menu base de entrenamiento"
                aria-label="Descripcion del menu"
              />
            </label>
          ) : (
            <button type="button" onClick={() => setDescriptionOpen(true)}>
              <Plus size={16} />
              Agregar descripcion
            </button>
          )}
        </div>

        {!wizardStep ? <section className="client-menu-objective">
          <div className="client-menu-objective-head">
            <div><strong>Objetivo y comienzo</strong><span>El menu se crea sin registrar consumo.</span></div>
            <label><span>Fecha de inicio</span><input type="date" value={draft.fechaInicio || ""} onChange={(event) => setDraft({ ...draft, fechaInicio: event.target.value })} aria-label="Fecha de inicio del menu" /></label>
          </div>
          <div className="client-menu-objective-mode" role="group" aria-label="Objetivo nutricional del menu">
            <button type="button" className={draft.objectiveMode !== "custom" ? "active" : ""} onClick={() => setDraft({ ...draft, objectiveMode: "current" })}>Usar mi objetivo actual</button>
            <button type="button" className={draft.objectiveMode === "custom" ? "active" : ""} onClick={() => setDraft({ ...draft, objectiveMode: "custom", menuTarget: draft.menuTarget || currentTarget || { kcal: 0, proteina: 0, carbs: 0, grasas: 0 } })}>Objetivo propio</button>
          </div>
          {draft.objectiveMode === "custom" ? <div className="client-menu-objective-grid">{[["kcal", "kcal"], ["proteina", "Proteina"], ["carbs", "Carbohidratos"], ["grasas", "Grasas"]].map(([field, label]) => <label key={field}><span>{label}</span><input type="number" min="0" step="0.1" value={draft.menuTarget?.[field] || ""} onChange={(event) => setDraft({ ...draft, menuTarget: { ...(draft.menuTarget || {}), [field]: clampPositive(event.target.value) } })} aria-label={`${label} objetivo del menu`} /></label>)}</div> : null}
        </section> : null}

        {!wizardStep && !singleDay ? (
          <div className="client-days" aria-label="Dias del menu">
            {DAYS.map(([key, , shortLabel]) => (
              <button key={key} type="button" className={draft.selectedDays.includes(key) ? "active" : ""} onClick={() => toggleDay(key)}>
                {shortLabel}
              </button>
            ))}
          </div>
        ) : null}
        {dayLimitMessage ? (
          <div className="client-menu-warning compact">
            <AlertTriangle size={15} />
            <span>{dayLimitMessage}</span>
            <button type="button" onClick={onOpenPlans}>Ver Pro</button>
          </div>
        ) : null}

        <div className="client-editor-layout">
          <main className="client-editor-main">
            <div className="client-meal-list">
              {draft.comidas.map((meal, index) => (
                <MealEditor
                  key={meal.id}
                  meal={meal}
                  index={index}
                  canMoveUp={index > 0}
                  canMoveDown={index < draft.comidas.length - 1}
                  onChange={(patch) => updateMeal(meal.id, patch)}
                  onRemove={() => removeMeal(meal.id)}
                  onDuplicate={() => duplicateMeal(meal.id)}
                  onMoveUp={() => moveMeal(meal.id, -1)}
                  onMoveDown={() => moveMeal(meal.id, 1)}
                  onSaveMeal={() => onSaveMeal?.(meal)}
                  dailyTarget={target}
                  mealCount={draft.comidas.length}
                  canAuto={capabilities?.canAutoCalculateTrackingQuantities === true}
                  onOpenBuilder={() => openMealBuilder(meal)}
                />
              ))}
            </div>

            <section className="client-add-meal-panel">
              <button type="button" className="client-add-meal" onClick={() => setAddOpen((value) => !value)}>
                <Plus size={20} />
                <strong>Agregar otra comida</strong>
                <small>Colacion, pre-entreno, post-entreno u otra</small>
              </button>
              {addOpen ? (
                <div className="client-add-meal-options">
                  <div className="client-meal-suggestions">
                    {MEAL_SUGGESTIONS.map(([type, label]) => (
                      <button key={`${type}-${label}`} type="button" onClick={() => addMeal(type, label)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="client-custom-meal">
                    <select value={customMealType} onChange={(event) => setCustomMealType(event.target.value)} aria-label="Tipo de nueva comida">
                      {MEAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <input value={customMealName} onChange={(event) => setCustomMealName(event.target.value)} placeholder="Nombre propio" />
                    <button type="button" onClick={() => addMeal(customMealType, customMealName.trim() || titleForMealType(customMealType))}>
                      Agregar
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            {!hasMenuFood(draft) ? (
              <div className="client-menu-warning compact">
                <AlertTriangle size={15} />
                <span>Podes guardar el menu como base, pero para activarlo necesita al menos una comida con alimentos.</span>
              </div>
            ) : null}
          </main>

          <aside className="client-editor-side">
            <NutritionSummary totals={totals} target={target} />
            <section className="client-missing-box">
              <button type="button" onClick={() => setMissingOpen((value) => !value)}>
                <Sparkles size={17} />
                Calcular lo que falta
                <ChevronRight size={17} className={missingOpen ? "rotate" : ""} />
              </button>
              {missingOpen ? (
                <div className="client-missing-detail">
                  {missing ? (
                    <>
                      <strong>Te faltan aproximadamente</strong>
                      <div>
                        <span>{formatNumber(missing.kcal, 0)} kcal</span>
                        <span>P {formatNumber(missing.proteina, 0)} g</span>
                        <span>C {formatNumber(missing.carbs, 0)} g</span>
                        <span>G {formatNumber(missing.grasas, 0)} g</span>
                      </div>
                      <p>No se generan alimentos automaticamente: usa este calculo para agregar alimentos manualmente.</p>
                    </>
                  ) : (
                    <p>Configura tu objetivo nutricional para comparar planificado contra meta.</p>
                  )}
                </div>
              ) : null}
            </section>
          </aside>
        </div>

        <footer className="client-save-bar">
          <div>
            <span>Planificado</span>
            <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
            <small>P {formatNumber(totals.proteina, 0)}g - C {formatNumber(totals.carbs, 0)}g - G {formatNumber(totals.grasas, 0)}g</small>
          </div>
          <div className="client-save-actions">
            <button
              type="button"
              className={editingActiveMenu ? "nl-primary" : "nl-secondary"}
              onClick={() => onSave(draft, false)}
              disabled={saving}
            >
              {saving ? <Loader2 size={15} className="nl-spin" /> : <Save size={15} />}
              {editingActiveMenu ? "Guardar cambios" : activeMenuComparison ? "Guardar alternativa" : "Guardar menu"}
            </button>
            {!editingActiveMenu ? (
              <button type="button" className="nl-primary" onClick={() => onSave(draft, true)} disabled={saving || !canActivateDraft}>
                {saving ? <Loader2 size={15} className="nl-spin" /> : <Power size={15} />}
                {activeMenuComparison ? "Usar desde la fecha elegida" : "Guardar y activar"}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
      {mealBuilder ? (
        <EquivalentMealBuilder
          key={`${mealBuilder.menuId}-${mealBuilder.baseMeal?.id}`}
          context={mealBuilder}
          canAuto={capabilities?.canAutoCalculateTrackingQuantities === true}
          maxFoods={Math.max(1, Number(capabilities?.limits?.equivalentMealFoods) || 6)}
          saving={saving}
          onClose={() => setMealBuilder(null)}
          onApply={applyBuiltMeal}
        />
      ) : null}
    </section>
  );
}

function NutritionSummary({ totals = {}, target = null }) {
  const kcalTarget = toNumber(target?.kcal);
  const planned = toNumber(totals.kcal);
  const kcalGap = kcalTarget ? kcalTarget - planned : 0;
  const overTarget = kcalTarget && kcalGap < 0;
  const ringPct = progressPercent(planned, kcalTarget);

  return (
    <section className="client-editor-summary pro">
      <header>
        <span>Resumen del dia</span>
      </header>
      <div className="client-summary-top">
        <div>
          <span>Objetivo</span>
          <strong>{kcalTarget ? formatNumber(kcalTarget, 0) : "-"} kcal</strong>
        </div>
        <div className="client-summary-ring" style={{ "--pct": `${ringPct}%` }}>
          <strong>{formatNumber(ringPct, 0)}%</strong>
          <span>Planificado</span>
          <small>{formatNumber(planned, 0)} kcal</small>
        </div>
        <div>
          <span>{overTarget ? "Exceso estimado" : "Faltante"}</span>
          <strong>{kcalTarget ? formatNumber(Math.abs(kcalGap), 0) : "-"} kcal</strong>
        </div>
      </div>
      <div className="client-summary-bars">
        <SummaryBar label="Proteinas" value={totals.proteina} target={target?.proteina} color="blue" />
        <SummaryBar label="Carbohidratos" value={totals.carbs} target={target?.carbs} color="green" />
        <SummaryBar label="Grasas" value={totals.grasas} target={target?.grasas} color="yellow" />
      </div>
    </section>
  );
}

function SummaryBar({ label, value, target, color }) {
  const pct = progressPercent(value, target);
  return (
    <div className={`client-summary-bar ${color}`}>
      <div>
        <span>{label}</span>
        <strong>{formatNumber(value, 0)} / {target ? formatNumber(target, 0) : "-"} g</strong>
      </div>
      <i><b style={{ "--fill": `${pct}%` }} /></i>
    </div>
  );
}

function MealEditor({
  meal,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onSaveMeal,
  dailyTarget,
  mealCount = 1,
  canAuto = false,
  onOpenBuilder,
}) {
  const totals = itemTotals(meal.items || []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const addFoodButtonRef = useRef(null);
  const items = meal.items || [];
  const foodCount = items.length;
  const hasItems = foodCount > 0;
  const regionId = `${meal.id}-body`;

  useBodyScrollLock(menuOpen || pickerOpen || renameOpen);

  useEffect(() => {
    if (!menuOpen && !pickerOpen && !renameOpen) return undefined;

    function handleEscape(event) {
      if (event.key !== "Escape") return;
      if (pickerOpen) {
        setPickerOpen(false);
        focusAfterPaint(addFoodButtonRef);
        return;
      }
      if (renameOpen) {
        setRenameOpen(false);
        focusAfterPaint(menuButtonRef);
        return;
      }
      setMenuOpen(false);
      focusAfterPaint(menuButtonRef);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen, pickerOpen, renameOpen]);

  function closeMenu() {
    setMenuOpen(false);
    focusAfterPaint(menuButtonRef);
  }

  function closePicker() {
    setPickerOpen(false);
    focusAfterPaint(addFoodButtonRef);
  }

  function closeRename() {
    setRenameOpen(false);
    focusAfterPaint(menuButtonRef);
  }

  function addFood(food, quantityOverride, unitOverride) {
    const unit = unitOverride || foodDisplayUnit(food);
    const quantity = clampPositive(quantityOverride || defaultQuantity(unit));
    if (!quantity) return;
    const snapshot = buildMenuItemSnapshot(food, quantity, unit);
    onChange({
      items: [
        ...(meal.items || []),
        {
          ...snapshot,
          id: uid("item"),
        },
      ],
    });
    closePicker();
    setExpanded(true);
  }

  function updateItem(itemId, patch) {
    onChange({
      items: (meal.items || []).map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  }

  function removeItem(itemId) {
    onChange({ items: (meal.items || []).filter((item) => item.id !== itemId) });
  }

  function handleRemoveMeal() {
    const ok = window.confirm(`Eliminar "${meal.nombre || "esta comida"}" del menu?`);
    if (!ok) {
      closeMenu();
      return;
    }
    setMenuOpen(false);
    onRemove();
    focusAfterPaint(menuButtonRef);
  }

  function handleRename(next) {
    onChange(next);
    setRenameOpen(false);
    setMenuOpen(false);
    focusAfterPaint(menuButtonRef);
  }

  function updateTarget(field, value) {
    const next = { ...(meal.target || {}), [field]: clampPositive(value) };
    onChange({ target: Object.values(next).some((entry) => toNumber(entry) > 0) ? next : null });
  }

  function distributeDailyTarget() {
    const count = Math.max(1, Number(mealCount) || 1);
    if (!dailyTarget) return;
    onChange({
      target: {
        kcal: Math.round((toNumber(dailyTarget.kcal) / count) * 10) / 10,
        proteina: Math.round((toNumber(dailyTarget.proteina) / count) * 10) / 10,
        carbs: Math.round((toNumber(dailyTarget.carbs) / count) * 10) / 10,
        grasas: Math.round((toNumber(dailyTarget.grasas) / count) * 10) / 10,
      },
    });
  }

  return (
    <article className={`client-meal-editor pro ${expanded ? "expanded" : ""} ${hasItems ? "ready" : "empty"}`}>
      <div className="client-meal-collapsed">
        <div className="client-meal-drag" aria-hidden="true"><GripVertical size={22} /></div>
        <div className="client-meal-icon">{iconForMeal(meal.tipoComida)}</div>
        <button
          type="button"
          className="client-meal-main"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={regionId}
        >
          <span className="client-meal-heading-line">
            <strong>{meal.nombre || titleForMealType(meal.tipoComida)}</strong>
            {hasItems ? <em className="client-meal-origin-badge">Menu propio</em> : null}
          </span>
          <span>{hasItems ? `${foodCount} alimento${foodCount === 1 ? "" : "s"}` : "Sin alimentos"}</span>
          {hasItems ? (
            <small>{formatNumber(totals.kcal, 0)} kcal · P {formatNumber(totals.proteina, 0)} · C {formatNumber(totals.carbs, 0)} · G {formatNumber(totals.grasas, 0)}</small>
          ) : null}
        </button>
        <button
          type="button"
          className="client-meal-round"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Colapsar comida" : "Expandir comida"}
          aria-expanded={expanded}
          aria-controls={regionId}
        >
          <ChevronDown size={17} className={expanded ? "rotate" : ""} />
        </button>
        <div className="client-meal-menu-wrap">
          <button
            ref={menuButtonRef}
            type="button"
            className="client-meal-round"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Opciones de comida"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={17} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="client-meal-expanded" id={regionId}>
          {items.length ? (
            <div className="client-food-lines pro menu-ready">
              {items.map((item) => (
                <div key={item.id} className="client-food-line menu-ready">
                  <div className="client-food-line-main">
                    <strong>{item.nombreSnapshot || item.nombre}</strong>
                    <span>{formatNumber(item.kcal, 0)} kcal · P {formatNumber(item.proteina, 0)} · C {formatNumber(item.carbs, 0)} · G {formatNumber(item.grasas, 0)}</span>
                  </div>
                  <label className="client-food-quantity-pill">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(event) => updateItem(item.id, rescaleItem(item, event.target.value))}
                      aria-label={`Cantidad de ${item.nombreSnapshot || item.nombre}`}
                    />
                    <small>{item.unidad}</small>
                  </label>
                  <button type="button" className="client-food-remove" onClick={() => removeItem(item.id)} aria-label={`Eliminar ${item.nombreSnapshot || item.nombre}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="client-meal-empty-line">
              <strong>Sin alimentos</strong>
              <span>Agrega el primer alimento para armar esta comida.</span>
            </div>
          )}

          <div className={`client-meal-controls ${hasItems ? "ready" : "empty"}`}>
            <button ref={addFoodButtonRef} type="button" className="client-meal-add-food" onClick={() => setPickerOpen(true)}>
              <Plus size={16} />
              Agregar alimento
            </button>
            {hasItems ? (
              <button type="button" className="client-meal-save-food" onClick={onSaveMeal}>
                <Save size={15} />
                Guardar en Mis comidas
              </button>
            ) : null}
          </div>

          <section className="client-own-meal-target" aria-label={`Meta de ${meal.nombre || "la comida"}`}>
            <div className="client-own-meal-target-head">
              <div>
                <strong>Meta de esta comida</strong>
                <span>{meal.target ? "Orienta el calculo; no registra consumo." : "Opcional: la comida empieza sin meta."}</span>
              </div>
              <button type="button" onClick={() => onChange({ target: null })} disabled={!meal.target}>Sin meta</button>
            </div>
            <div className="client-own-meal-target-grid">
              {[["kcal", "kcal"], ["proteina", "P"], ["carbs", "C"], ["grasas", "G"]].map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input type="number" min="0" step="0.1" value={meal.target?.[field] || ""} onChange={(event) => updateTarget(field, event.target.value)} placeholder="Libre" aria-label={`${label} objetivo de ${meal.nombre || "la comida"}`} />
                </label>
              ))}
            </div>
            <div className="client-own-meal-target-actions">
              <button type="button" onClick={distributeDailyTarget} disabled={!dailyTarget}>Distribuir objetivo diario</button>
              {canAuto ? <button type="button" onClick={onOpenBuilder} disabled={!meal.target?.kcal && !dailyTarget?.kcal}>Calcular o buscar equivalente</button> : null}
            </div>
          </section>
        </div>
      ) : null}

      {pickerOpen ? (
        <FoodPickerDialog meal={meal} onPick={addFood} onClose={closePicker} />
      ) : null}

      {renameOpen ? (
        <RenameMealDialog
          meal={meal}
          onClose={closeRename}
          onSave={handleRename}
        />
      ) : null}

      {menuOpen ? (
        <MealOptionsSheet
          meal={meal}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onClose={closeMenu}
          onRename={() => {
            setMenuOpen(false);
            setRenameOpen(true);
          }}
          onMoveUp={() => {
            onMoveUp();
            closeMenu();
          }}
          onMoveDown={() => {
            onMoveDown();
            closeMenu();
          }}
          onRemove={handleRemoveMeal}
          onDuplicate={() => { onDuplicate(); closeMenu(); }}
        />
      ) : null}
    </article>
  );
}

function localIsoDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function MealOptionsSheet({
  meal,
  canMoveUp,
  canMoveDown,
  onClose,
  onRename,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDuplicate,
}) {
  if (typeof document === "undefined") return null;
  const titleId = `${meal.id}-options-title`;

  return createPortal(
    <section className="client-options-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="client-options-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div>
            <span className="nl-kicker">Opciones de comida</span>
            <strong id={titleId}>{meal.nombre || titleForMealType(meal.tipoComida)}</strong>
          </div>
          <button type="button" className="nl-icon" onClick={onClose} aria-label="Cerrar opciones">
            <X size={18} />
          </button>
        </header>
        <div className="client-options-list" role="menu">
          <button type="button" role="menuitem" onClick={onRename}>
            <Edit3 size={16} />
            Renombrar
          </button>
          <button type="button" role="menuitem" onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUp size={16} />
            Mover arriba
          </button>
          <button type="button" role="menuitem" onClick={onMoveDown} disabled={!canMoveDown}>
            <ArrowDown size={16} />
            Mover abajo
          </button>
          <button type="button" role="menuitem" onClick={onDuplicate}>
            <Copy size={16} />
            Duplicar comida
          </button>
          <button type="button" role="menuitem" className="danger" onClick={onRemove}>
            <Trash2 size={16} />
            Eliminar comida
          </button>
        </div>
      </div>
    </section>,
    document.body
  );
}

const RENAME_OPTIONS = [
  { key: "desayuno", type: "desayuno", label: "Desayuno" },
  { key: "media-manana", type: "colacion", label: "Media manana" },
  { key: "almuerzo", type: "almuerzo", label: "Almuerzo" },
  { key: "merienda", type: "merienda", label: "Merienda" },
  { key: "cena", type: "cena", label: "Cena" },
  { key: "pre-entreno", type: "pre_entreno", label: "Pre-entreno" },
  { key: "post-entreno", type: "post_entreno", label: "Post-entreno" },
  { key: "colacion", type: "colacion", label: "Colacion" },
  { key: "custom", type: "otra", label: "Nombre personalizado", custom: true },
];

function initialRenameKey(meal = {}) {
  const currentName = String(meal.nombre || "").trim();
  const exactByName = RENAME_OPTIONS.find((option) => !option.custom && option.label.toLowerCase() === currentName.toLowerCase());
  if (exactByName) return exactByName.key;
  const fallback = RENAME_OPTIONS.find((option) => !option.custom && option.type === meal.tipoComida);
  return currentName && currentName !== fallback?.label ? "custom" : fallback?.key || "custom";
}

function RenameMealDialog({ meal, onClose, onSave }) {
  const [selectedKey, setSelectedKey] = useState(() => initialRenameKey(meal));
  const [customName, setCustomName] = useState(() => (
    initialRenameKey(meal) === "custom"
      ? String(meal.nombre || titleForMealType(meal.tipoComida)).slice(0, 48)
      : ""
  ));
  const [error, setError] = useState("");
  if (typeof document === "undefined") return null;

  const selectedOption = RENAME_OPTIONS.find((option) => option.key === selectedKey) || RENAME_OPTIONS[0];
  const isCustom = selectedOption.custom;
  const finalName = (isCustom ? customName : selectedOption.label).trim();
  const canSave = finalName.length > 0 && finalName.length <= 48;

  function save() {
    if (!canSave) {
      setError("El nombre no puede quedar vacio.");
      return;
    }
    onSave({
      tipoComida: isCustom ? (meal.tipoComida || "otra") : selectedOption.type,
      nombre: finalName,
    });
  }

  return createPortal(
    <section
      className="client-rename-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-rename-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="client-rename-sheet">
        <header>
          <div>
            <span className="nl-kicker">Renombrar comida</span>
            <strong id="client-rename-title">{meal.nombre || "Comida"}</strong>
          </div>
          <button type="button" className="nl-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="client-rename-options" role="radiogroup" aria-label="Nombre de comida">
          {RENAME_OPTIONS.map((option) => {
            const active = selectedKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={active ? "active" : ""}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setSelectedKey(option.key);
                  setError("");
                }}
              >
                <span>{option.label}</span>
                {active ? <CheckCircle2 size={15} /> : null}
              </button>
            );
          })}
        </div>
        {isCustom ? (
          <label className="client-custom-name">
            Nombre de la comida
            <input
              value={customName}
              onChange={(event) => {
                setCustomName(event.target.value.slice(0, 48));
                setError("");
              }}
              autoFocus
              maxLength={48}
              placeholder="Ej: Brunch proteico"
            />
          </label>
        ) : null}
        {error ? <div className="client-rename-error" role="alert">{error}</div> : null}
        <footer>
          <button type="button" className="nl-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="nl-primary" onClick={save} disabled={!canSave}>Guardar nombre</button>
        </footer>
      </div>
    </section>,
    document.body
  );
}

function FoodPickerDialog({ meal, onPick, onClose }) {
  if (typeof document === "undefined") return null;
  const titleId = `${meal.id}-food-picker-title`;

  return createPortal(
    <section
      className="client-food-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="client-food-picker-sheet">
        <header>
          <div>
            <span className="nl-kicker">Agregar alimento</span>
            <strong id={titleId}>{meal.nombre}</strong>
          </div>
          <button type="button" className="nl-icon" onClick={onClose} aria-label="Cerrar buscador de alimentos">
            <X size={18} />
          </button>
        </header>
        <FoodPicker onPick={onPick} mealName={meal.nombre || titleForMealType(meal.tipoComida)} />
      </div>
    </section>,
    document.body
  );
}

function FoodPicker({ onPick, mealName }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("100");
  const [servings, setServings] = useState("1");
  const [unit, setUnit] = useState("g");
  const [selectionError, setSelectionError] = useState("");
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (selectedFood) return undefined;
    const term = debouncedSearch.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      setError("");
      return undefined;
    }

    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setSearched(true);
    setError("");

    listAlimentos({ search: term, limit: 12 })
      .then((data) => {
        if (requestSeq.current !== seq) return;
        setResults(normalizeFoodSearchResults(data).slice(0, 12));
      })
      .catch((searchError) => {
        if (requestSeq.current !== seq) return;
        setError(searchError?.message || "No pudimos buscar alimentos.");
        setResults([]);
      })
      .finally(() => {
        if (requestSeq.current === seq) setLoading(false);
      });

    return () => {
      if (requestSeq.current === seq) requestSeq.current += 1;
    };
  }, [debouncedSearch, retryKey, selectedFood]);

  function selectFood(food) {
    const nextUnit = foodDisplayUnit(food);
    const nextQuantity = suggestedFoodQuantity(food);
    setSelectedFood(food);
    setUnit(nextUnit);
    setQuantity(String(nextQuantity));
    setServings("1");
    setSelectionError("");
  }

  function addSelectedFood() {
    const baseQuantity = Number(quantity);
    const portions = Number(servings);
    if (!selectedFood || !Number.isFinite(baseQuantity) || baseQuantity <= 0 || !Number.isFinite(portions) || portions <= 0) {
      setSelectionError("Ingresa una cantidad y porciones validas.");
      return;
    }
    const finalUnit = unit.trim();
    if (!finalUnit) {
      setSelectionError("La unidad no puede quedar vacia.");
      return;
    }
    onPick(selectedFood, Math.round(baseQuantity * portions * 100) / 100, finalUnit);
  }

  if (selectedFood) {
    const effectiveQuantity = Math.max(Number(quantity) || 0, 0) * Math.max(Number(servings) || 0, 0);
    const preview = buildMenuItemSnapshot(selectedFood, effectiveQuantity, unit || foodDisplayUnit(selectedFood));
    return (
      <div className="client-food-picker pro">
        <button type="button" className="client-food-back" onClick={() => setSelectedFood(null)}>
          <ChevronRight size={16} />
          Volver a resultados
        </button>
        <section className="client-food-selected">
          <div>
            <span className="nl-kicker">Seleccionado</span>
            <strong>{foodDisplayName(selectedFood)}</strong>
            <small>{mealName}</small>
          </div>
          <div className="client-food-selected-grid">
            <label>
              Cantidad
              <input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label>
              Unidad
              <input value={unit} onChange={(event) => setUnit(event.target.value.slice(0, 18))} />
            </label>
            <label>
              Porciones
              <input type="number" min="0.01" step="0.01" value={servings} onChange={(event) => setServings(event.target.value)} />
            </label>
          </div>
          <div className="client-food-selected-macros">
            <strong>{formatNumber(preview.kcal, 0)} kcal</strong>
            <span>P {formatNumber(preview.proteina, 1)} - C {formatNumber(preview.carbs, 1)} - G {formatNumber(preview.grasas, 1)}</span>
          </div>
          {selectionError ? <div className="client-food-empty error" role="alert">{selectionError}</div> : null}
          <footer>
            <button type="button" className="nl-secondary" onClick={() => setSelectedFood(null)}>Cancelar</button>
            <button type="button" className="nl-primary" onClick={addSelectedFood}>
              <Plus size={16} />
              Agregar a {mealName}
            </button>
          </footer>
        </section>
      </div>
    );
  }

  return (
    <div className="client-food-picker pro">
      <label className="client-food-searchbox">
        <Search size={15} />
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setError("");
          }}
          placeholder="Buscar alimento para agregar"
          autoFocus
        />
        {loading ? <Loader2 size={15} className="nl-spin" /> : null}
      </label>

      {search.trim().length < 2 ? (
        <div className="client-food-empty">Escribi al menos 2 caracteres para buscar.</div>
      ) : null}

      {loading ? <div className="client-food-empty">Buscando alimentos...</div> : null}

      {error ? (
        <div className="client-food-empty error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Reintentar</button>
        </div>
      ) : null}

      {!loading && !error && results.length ? (
        <div className="client-food-results">
          {results.map((food, index) => {
            const id = String(food.id || food._id || food.alimentoId || foodDisplayName(food) || index);
            const unitLabel = foodDisplayUnit(food);
            const qty = suggestedFoodQuantity(food);
            const preview = buildMenuItemSnapshot(food, qty, unitLabel);
            return (
              <button key={`${id}-${index}`} type="button" onClick={() => selectFood(food)}>
                <div>
                  <span>{foodDisplayName(food)}</span>
                  <small>{formatNumber(qty, 0)} {unitLabel} - {formatNumber(preview.kcal, 0)} kcal</small>
                </div>
                <em>P {formatNumber(preview.proteina, 1)} / C {formatNumber(preview.carbs, 1)} / G {formatNumber(preview.grasas, 1)}</em>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && searched && debouncedSearch.length >= 2 && !results.length ? (
        <div className="client-food-empty">No encontramos alimentos para "{debouncedSearch}".</div>
      ) : null}
    </div>
  );
}

function LimitPrompt({ plan, menu, saving, onClose, onDeleteAndCreate, onOpenPlans }) {
  return (
    <section className="nl-modal" role="dialog" aria-modal="true" aria-labelledby="client-limit-title">
      <div className="client-limit-dialog">
        <header>
          <div>
            <span className="nl-kicker"><Crown size={15} /> Plan {planLabel(plan)}</span>
            <h2 id="client-limit-title">Ya usaste el menu disponible.</h2>
          </div>
          <button type="button" className="nl-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <p>En Free podes tener un menu propio. Podes editar o eliminar tu menu actual, o pasar a Pro para crear mas.</p>
        {menu ? <strong className="client-limit-current">{menu.nombre}</strong> : null}
        <div className="client-limit-actions">
          <button type="button" className="nl-secondary" onClick={onClose}>Ver mi menu</button>
          <button type="button" className="nl-secondary danger" onClick={onDeleteAndCreate} disabled={saving}>
            <Trash2 size={16} />
            Eliminar y crear otro
          </button>
          <button type="button" className="nl-primary" onClick={onOpenPlans}>Ver Pro</button>
        </div>
      </div>
    </section>
  );
}
