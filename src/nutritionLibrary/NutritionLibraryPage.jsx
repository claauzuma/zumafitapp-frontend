import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  Loader2,
  Lock,
  Search,
  SlidersHorizontal,
  Star,
  Target,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuthMe } from "../authQueries.js";
import { addSavedMealToTracking } from "../savedMeals/savedMealsApi.js";
import { getProfessionalClients } from "../profesional/profesionalApi.js";
import { formatNumber } from "../nutricion/nutricionUtils.js";
import AppToast from "../ui/AppToast.jsx";
import { activateClientMenu, duplicateClientMenu } from "../clientMenus/clientMenusApi.js";
import { buildContextualMenuDraft } from "./contextualMenuDraft.js";
import { filterContextualMenusForDisplay } from "./contextualMenuDisplayGuard.js";
import { applyLibraryFacetFilters } from "./libraryBrowseFilters.js";
import {
  assignLibraryMeal,
  assignLibraryMenu,
  copyLibraryMeal,
  copyLibraryMenu,
  listLibraryMeals,
  listLibraryMenus,
  setLibraryMealFavorite,
  setLibraryMenuFavorite,
} from "./nutritionLibraryApi.js";
import "./nutritionLibrary.css";

const TABS = {
  professional: [
    { id: "mineMeals", label: "Mis comidas", scope: "mine", kinds: ["meals"] },
    { id: "mineMenus", label: "Mis menus", scope: "mine", kinds: ["menus"] },
    { id: "admin", label: "Biblioteca ZumaFit", scope: "admin", kinds: ["meals", "menus"] },
    { id: "assigned", label: "Asignados", scope: "assigned", kinds: ["meals", "menus"] },
    { id: "favorites", label: "Favoritos", scope: "favorites", kinds: ["meals", "menus"] },
  ],
  client: [
    { id: "mineMeals", label: "Mis comidas", scope: "mine", kinds: ["meals"] },
    { id: "mineMenus", label: "Mis menus", scope: "mine", kinds: ["menus"] },
    { id: "assigned", label: "Del coach", scope: "assigned", kinds: ["meals", "menus"], coachOnly: true },
    { id: "admin", label: "Biblioteca ZumaFit", scope: "admin", kinds: ["meals", "menus"] },
    { id: "favorites", label: "Favoritos", scope: "favorites", kinds: ["meals", "menus"] },
  ],
};

const MEAL_TYPES = [
  ["todos", "Todos"],
  ["desayuno", "Desayuno"],
  ["almuerzo", "Almuerzo"],
  ["merienda", "Merienda"],
  ["cena", "Cena"],
  ["snack", "Snack"],
];

function mealTypeLabel(value = "") {
  return MEAL_TYPES.find(([id]) => id === value)?.[1] || String(value || "Otra").replace(/(^|[_-])\w/g, (letter) => letter.replace(/[_-]/, "").toUpperCase());
}

const TARGET_LIBRARY_FILTERS = [
  { id: "menus", label: "Menús", scope: "discover", kinds: ["menus"], icon: BookOpen },
  { id: "meals", label: "Comidas", scope: "discover", kinds: ["meals"], icon: Utensils },
  { id: "favorites", label: "Favoritos", scope: "favorites", kinds: ["meals", "menus"], icon: Star },
  { id: "mine", label: "Mis guardados", scope: "mine", kinds: ["meals", "menus"], icon: Database },
];

const EMPTY_LIBRARY_FACETS = {
  kind: "",
  totalAvailable: 0,
  types: [],
  calories: [],
  proteins: [],
  complete: true,
};

function itemId(item = {}) {
  return String(item.id || item._id || "");
}

function hasCoach(user = {}) {
  return Boolean(user?.coach?.entrenadorId || user?.coach?.coachId || user?.coachId || user?.entrenadorId);
}

function todayLocalString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDateLabel(value = "") {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "Hoy";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" })
    .format(new Date(year, month - 1, day))
    .replace(".", "");
}

function targetFiltersFromSearch(searchParams) {
  return {
    targetKcal: searchParams.get("targetKcal") || "",
    targetProteina: searchParams.get("targetProtein") || searchParams.get("targetProteina") || "",
    targetCarbs: searchParams.get("targetCarbs") || "",
    targetGrasas: searchParams.get("targetFat") || searchParams.get("targetGrasas") || "",
  };
}

function hasTargetFilters(filters = {}) {
  return Object.values(filters).some((value) => value !== "");
}

function totals(item = {}) {
  const total = item.totales || item.macrosTotales || {};
  return {
    kcal: Number(total.kcal || 0),
    proteina: Number(total.proteina ?? total.proteinas ?? 0),
    carbs: Number(total.carbs ?? total.carbohidratos ?? 0),
    grasas: Number(total.grasas ?? 0),
  };
}

function macroLine(item = {}) {
  const t = totals(item);
  return `P ${formatNumber(t.proteina, 0)} / C ${formatNumber(t.carbs, 0)} / G ${formatNumber(t.grasas, 0)}`;
}

function foodItems(item = {}) {
  return Array.isArray(item.items) ? item.items : Array.isArray(item.alimentos) ? item.alimentos : [];
}

function foodImage(food = {}) {
  return food.imagenUrl || food.imageUrl || food.imagen?.url || food.snapshot?.imagen?.url || food.snapshot?.imagen || "";
}

function defaultTabs(mode, user) {
  const tabs = TABS[mode] || TABS.client;
  return tabs.filter((tab) => !tab.coachOnly || hasCoach(user));
}

export default function NutritionLibraryPage({ mode = "client" }) {
  const professionalMode = mode === "professional";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const initialTargetFilters = useMemo(() => targetFiltersFromSearch(new URLSearchParams(searchKey)), [searchKey]);
  const initialTrackingDate = useMemo(() => {
    const value = searchParams.get("selectedDate") || searchParams.get("date") || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayLocalString();
  }, [searchParams]);
  const contextualTargetMode = !professionalMode && searchParams.get("context") === "day-menu" && hasTargetFilters(initialTargetFilters);
  const compactClientMode = !professionalMode;
  const legacyCreateRedirect = !professionalMode && searchParams.get("tab") === "mineMenus" && searchParams.get("create") === "1";
  const authQuery = useAuthMe({ initialFromCache: true, enabled: !legacyCreateRedirect });
  const user = useMemo(() => authQuery.data || {}, [authQuery.data]);
  const professionalFeatures = user?.effectiveCapabilities?.features?.menus || {};
  const professionalUsage = user?.effectiveCapabilities?.usage || {};
  const professionalLimits = user?.effectiveCapabilities?.limits || {};
  const ownedMenusUsage = Number(professionalUsage.currentCoachOwnedMenus || 0);
  const ownedMealsUsage = Number(professionalUsage.currentCoachOwnedMeals || 0);
  const ownedMenusLimit = Number(professionalLimits.maxCoachOwnedMenus);
  const ownedMealsLimit = Number(professionalLimits.maxCoachOwnedMeals);
  const menuLimitReached = professionalMode && Number.isFinite(ownedMenusLimit) && ownedMenusLimit >= 0 && ownedMenusUsage >= ownedMenusLimit;
  const mealLimitReached = professionalMode && Number.isFinite(ownedMealsLimit) && ownedMealsLimit >= 0 && ownedMealsUsage >= ownedMealsLimit;
  const canUseProfessionalGlobalLibrary =
    professionalFeatures.canUseGlobalMenuTemplates === true &&
    professionalFeatures.canUseGlobalMealTemplates === true;
  const tabs = useMemo(
    () => defaultTabs(professionalMode ? "professional" : "client", user).map((tab) => (
      professionalMode && tab.id === "admin"
        ? { ...tab, locked: !canUseProfessionalGlobalLibrary }
        : tab
    )),
    [canUseProfessionalGlobalLibrary, professionalMode, user]
  );
  const [activeTabId, setActiveTabId] = useState("mineMeals");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [targetSearchOpen, setTargetSearchOpen] = useState(() => hasTargetFilters(initialTargetFilters));
  const [contextTargetEditorOpen, setContextTargetEditorOpen] = useState(false);
  const [contextFilterId, setContextFilterId] = useState("menus");
  const [facetFilters, setFacetFilters] = useState({ calorieBucket: "", proteinBucket: "" });
  const [libraryFacets, setLibraryFacets] = useState(EMPTY_LIBRARY_FACETS);
  const [targetFilters, setTargetFilters] = useState(initialTargetFilters);
  const [trackingDate, setTrackingDate] = useState(initialTrackingDate);
  const [targetMeals, setTargetMeals] = useState("");
  const [meals, setMeals] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuSearchMeta, setMenuSearchMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [assignItem, setAssignItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [applyConfirmItem, setApplyConfirmItem] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const mutationLockRef = useRef(false);
  const currentContextualTarget = useMemo(() => ({
    kcal: Number(targetFilters.targetKcal) || 0,
    proteina: Number(targetFilters.targetProteina) || 0,
    carbs: Number(targetFilters.targetCarbs) || 0,
    grasas: Number(targetFilters.targetGrasas) || 0,
  }), [targetFilters]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId && !tab.locked) || tabs.find((tab) => !tab.locked) || TABS.client[0];
  const contextualSelection = TARGET_LIBRARY_FILTERS.find((filter) => filter.id === contextFilterId) || TARGET_LIBRARY_FILTERS[0];
  const selectedLibraryView = compactClientMode ? contextualSelection : activeTab;
  const clientFacetMode = compactClientMode && !contextualTargetMode && ["menus", "meals"].includes(contextFilterId)
    ? contextFilterId === "menus" ? "menu" : "meal"
    : "";
  const clientFacetFiltersActive = Boolean(clientFacetMode && (
    facetFilters.calorieBucket || facetFilters.proteinBucket || (clientFacetMode === "meal" && type !== "todos")
  ));

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTabId && !tab.locked)) {
      setActiveTabId(tabs.find((tab) => !tab.locked)?.id || "mineMeals");
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (professionalMode) return;
    if (legacyCreateRedirect) return;
    const requestedTab = searchParams.get("tab");
    if (["mineMeals", "mineMenus"].includes(requestedTab)) setContextFilterId("mine");
    else if (requestedTab === "favorites") setContextFilterId("favorites");
    else if (["admin", "assigned"].includes(requestedTab)) setContextFilterId("menus");
  }, [legacyCreateRedirect, professionalMode, searchParams, tabs]);

  useEffect(() => {
    if (professionalMode) return;
    const params = new URLSearchParams(searchKey);
    const filters = targetFiltersFromSearch(params);
    const requestedDate = params.get("selectedDate") || params.get("date") || "";
    if (hasTargetFilters(filters)) {
      setTargetFilters(filters);
      setTargetSearchOpen(true);
    } else if (params.get("context") !== "day-menu") {
      setTargetFilters({ targetKcal: "", targetProteina: "", targetCarbs: "", targetGrasas: "" });
      setTargetMeals("");
      setFacetFilters({ calorieBucket: "", proteinBucket: "" });
      setLibraryFacets(EMPTY_LIBRARY_FACETS);
      setTargetSearchOpen(false);
      setContextTargetEditorOpen(false);
      if (!params.get("tab")) setContextFilterId("menus");
      setSearch("");
      setType("todos");
      setTrackingDate(initialTrackingDate);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) setTrackingDate(requestedDate);
  }, [initialTrackingDate, professionalMode, searchKey]);

  useEffect(() => {
    if (!professionalMode) return undefined;
    let active = true;
    getProfessionalClients()
      .then((data) => {
        if (active) setClients(data?.clients || []);
      })
      .catch(() => {
        if (active) setClients([]);
      });
    return () => {
      active = false;
    };
  }, [professionalMode]);

  useEffect(() => {
    if (legacyCreateRedirect) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = {
          scope: selectedLibraryView.scope,
          search,
          limit: 80,
          ...(contextualTargetMode ? { context: "day-menu", selectedDate: trackingDate, targetMeals } : {}),
          ...(contextualTargetMode || (!compactClientMode && targetSearchOpen) ? targetFilters : {}),
          ...(clientFacetMode ? {
            includeFacets: true,
            calorieBucket: facetFilters.calorieBucket,
            proteinBucket: facetFilters.proteinBucket,
          } : {}),
        };
        const [mealsData, menusData] = await Promise.all([
          selectedLibraryView.kinds.includes("meals")
            ? listLibraryMeals({ ...params, tipoComida: type })
            : Promise.resolve({ comidas: [] }),
          selectedLibraryView.kinds.includes("menus")
            ? listLibraryMenus({ ...params, includeComidas: true })
            : Promise.resolve({ menus: [] }),
        ]);
        if (!active) return;
        const rawMeals = mealsData?.comidas || [];
        const mealFallback = clientFacetMode === "meal"
          ? applyLibraryFacetFilters(rawMeals, { ...facetFilters, type }, { kind: "meal" })
          : null;
        const visibleMeals = clientFacetMode === "meal" && !mealsData?.facets ? mealFallback.items : rawMeals;
        setMeals(visibleMeals);
        const rawMenus = menusData?.menus || [];
        const visibleMenus = contextualTargetMode && selectedLibraryView.scope !== "mine"
          ? filterContextualMenusForDisplay(rawMenus, currentContextualTarget)
          : clientFacetMode === "menu" && !menusData?.facets
            ? applyLibraryFacetFilters(rawMenus, facetFilters, { kind: "menu" }).items
            : rawMenus;
        setMenus(visibleMenus);
        setLibraryFacets(clientFacetMode === "meal"
          ? mealsData?.facets || mealFallback?.facets || EMPTY_LIBRARY_FACETS
          : clientFacetMode === "menu"
            ? menusData?.facets || applyLibraryFacetFilters(rawMenus, facetFilters, { kind: "menu" }).facets
            : EMPTY_LIBRARY_FACETS);
        setMenuSearchMeta(contextualTargetMode ? { ...menusData, clientExcludedCount: rawMenus.length - visibleMenus.length } : null);
      } catch (err) {
        if (active) setError(err?.message || "No se pudo cargar la biblioteca nutricional.");
      } finally {
        if (active) setLoading(false);
      }
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectedLibraryView.scope, selectedLibraryView.kinds, search, type, legacyCreateRedirect, targetFilters, targetSearchOpen, contextualTargetMode, compactClientMode, clientFacetMode, facetFilters, trackingDate, targetMeals, currentContextualTarget]);

  async function refreshCurrent() {
    setLoading(true);
    setError("");
    try {
      const params = {
        scope: selectedLibraryView.scope,
        search,
        limit: 80,
        ...(contextualTargetMode ? { context: "day-menu", selectedDate: trackingDate, targetMeals } : {}),
        ...(contextualTargetMode || (!compactClientMode && targetSearchOpen) ? targetFilters : {}),
        ...(clientFacetMode ? {
          includeFacets: true,
          calorieBucket: facetFilters.calorieBucket,
          proteinBucket: facetFilters.proteinBucket,
        } : {}),
      };
      const [mealsData, menusData] = await Promise.all([
        selectedLibraryView.kinds.includes("meals") ? listLibraryMeals({ ...params, tipoComida: type }) : Promise.resolve({ comidas: [] }),
        selectedLibraryView.kinds.includes("menus") ? listLibraryMenus({ ...params, includeComidas: true }) : Promise.resolve({ menus: [] }),
      ]);
      const rawMeals = mealsData?.comidas || [];
      const mealFallback = clientFacetMode === "meal"
        ? applyLibraryFacetFilters(rawMeals, { ...facetFilters, type }, { kind: "meal" })
        : null;
      setMeals(clientFacetMode === "meal" && !mealsData?.facets ? mealFallback.items : rawMeals);
      const rawMenus = menusData?.menus || [];
      const visibleMenus = contextualTargetMode && selectedLibraryView.scope !== "mine"
        ? filterContextualMenusForDisplay(rawMenus, currentContextualTarget)
        : clientFacetMode === "menu" && !menusData?.facets
          ? applyLibraryFacetFilters(rawMenus, facetFilters, { kind: "menu" }).items
          : rawMenus;
      setMenus(visibleMenus);
      setLibraryFacets(clientFacetMode === "meal"
        ? mealsData?.facets || mealFallback?.facets || EMPTY_LIBRARY_FACETS
        : clientFacetMode === "menu"
          ? menusData?.facets || applyLibraryFacetFilters(rawMenus, facetFilters, { kind: "menu" }).facets
          : EMPTY_LIBRARY_FACETS);
      setMenuSearchMeta(contextualTargetMode ? { ...menusData, clientExcludedCount: rawMenus.length - visibleMenus.length } : null);
    } catch (err) {
      setError(err?.message || "No se pudo cargar la biblioteca nutricional.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(item) {
    if (!itemId(item) || saving || mutationLockRef.current) return;
    const copyLimitReached = item.kind === "menu" ? menuLimitReached : mealLimitReached;
    if (professionalMode && copyLimitReached) {
      const current = item.kind === "menu" ? ownedMenusUsage : ownedMealsUsage;
      const limit = item.kind === "menu" ? ownedMenusLimit : ownedMealsLimit;
      setToast({
        type: "warning",
        message: `Límite del plan alcanzado: ${current} / ${limit} ${item.kind === "menu" ? "menús" : "comidas"}.`,
      });
      return;
    }
    mutationLockRef.current = true;
    setSaving(true);
    try {
      if (item.kind === "menu") await copyLibraryMenu(itemId(item));
      else await copyLibraryMeal(itemId(item));
      setToast({ type: "success", message: item.kind === "menu" ? "Menu guardado en Mis menus." : "Comida guardada en Mis comidas." });
      if (professionalMode) await authQuery.refetch();
      await refreshCurrent();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo guardar la copia." });
    } finally {
      mutationLockRef.current = false;
      setSaving(false);
    }
  }

  function openMenuAsDraft(item, adjustToTarget = false) {
    if (!item || item.kind !== "menu") return;
    const target = currentContextualTarget;
    navigate("/app/menu/nuevo", {
      state: {
        from: `/app/nutricion?${searchKey}`,
        selectedDate: trackingDate,
        dailyTarget: target,
        generatedDraft: buildContextualMenuDraft(item, target, trackingDate, { adjustToTarget }),
      },
    });
  }

  async function handleSaveAlternative(item) {
    if (!itemId(item) || saving || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setSaving(true);
    try {
      const payload = { nombre: `${item.nombre || "Menú"} · alternativa`, fechaInicio: trackingDate };
      if (item.libraryOrigin === "user_owned") await duplicateClientMenu(itemId(item), payload);
      else await copyLibraryMenu(itemId(item), payload);
      setToast({ type: "success", message: "Alternativa guardada en Mis menús." });
      await refreshCurrent();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo guardar la alternativa." });
    } finally {
      mutationLockRef.current = false;
      setSaving(false);
    }
  }

  async function handleApplyConfirmed() {
    const item = applyConfirmItem;
    if (!itemId(item) || saving || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setSaving(true);
    try {
      const payload = { nombre: `${item.nombre || "Menú"} · ${trackingDate}`, fechaInicio: trackingDate };
      const copy = item.libraryOrigin === "user_owned"
        ? await duplicateClientMenu(itemId(item), payload)
        : await copyLibraryMenu(itemId(item), payload);
      if (!itemId(copy)) throw new Error("No se pudo crear una copia segura del menú.");
      await activateClientMenu(itemId(copy));
      setApplyConfirmItem(null);
      setPreviewItem(null);
      setToast({ type: "success", message: `Menú aplicado desde el ${shortDateLabel(trackingDate)}.` });
      await authQuery.refetch();
      await refreshCurrent();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo aplicar el menú." });
    } finally {
      mutationLockRef.current = false;
      setSaving(false);
    }
  }

  async function handleFavorite(item) {
    if (!itemId(item) || saving || mutationLockRef.current) return;
    const next = !(item.favorita || item.favorito);
    mutationLockRef.current = true;
    setSaving(true);
    try {
      if (item.kind === "menu") await setLibraryMenuFavorite(itemId(item), next);
      else await setLibraryMealFavorite(itemId(item), next);
      await refreshCurrent();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo actualizar favorito." });
    } finally {
      mutationLockRef.current = false;
      setSaving(false);
    }
  }

  async function handleAddToTracking(item) {
    if (!itemId(item) || saving || mutationLockRef.current || item.kind !== "comida") return;
    mutationLockRef.current = true;
    setSaving(true);
    try {
      await addSavedMealToTracking(itemId(item), {
        date: trackingDate,
        mealType: item.tipoComida || "snack",
      });
      setToast({ type: "success", message: "Comida agregada al tracking." });
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo agregar al tracking." });
    } finally {
      mutationLockRef.current = false;
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!assignItem || !selectedClientIds.length || saving || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setSaving(true);
    try {
      if (assignItem.kind === "menu") await assignLibraryMenu(itemId(assignItem), selectedClientIds);
      else await assignLibraryMeal(itemId(assignItem), selectedClientIds);
      setToast({ type: "success", message: "Asignacion guardada." });
      setAssignItem(null);
      setSelectedClientIds([]);
      await refreshCurrent();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo asignar." });
    } finally {
      mutationLockRef.current = false;
      setSaving(false);
    }
  }

  const totalItems = meals.length + menus.length;

  function handleLibraryViewChange(filterId) {
    setContextFilterId(filterId);
    setFacetFilters({ calorieBucket: "", proteinBucket: "" });
    setLibraryFacets(EMPTY_LIBRARY_FACETS);
    setType("todos");
    if (!["menus", "meals"].includes(filterId)) setContextTargetEditorOpen(false);
  }

  function selectMealType(nextType) {
    setType(nextType);
    setFacetFilters({ calorieBucket: "", proteinBucket: "" });
  }

  function selectCalorieBucket(value) {
    setFacetFilters({ calorieBucket: value, proteinBucket: "" });
  }

  function clearFacetFilters() {
    setType("todos");
    setFacetFilters({ calorieBucket: "", proteinBucket: "" });
  }

  function openCreateMenu() {
    navigate("/app/menu/nuevo", { state: { from: "/app/nutricion" } });
  }

  function openContextualGenerator(mode) {
    navigate("/app/menu/nuevo?mode=generate", {
      state: {
        from: `/app/nutricion?${searchKey}`,
        selectedDate: trackingDate,
        dailyTarget: {
          kcal: Number(targetFilters.targetKcal) || 0,
          proteina: Number(targetFilters.targetProteina) || 0,
          carbs: Number(targetFilters.targetCarbs) || 0,
          grasas: Number(targetFilters.targetGrasas) || 0,
        },
        generationSettings: { mode, mealCount: 4, distribution: "balanced", allowRepeats: false },
      },
    });
  }

  if (legacyCreateRedirect) {
    return <Navigate to="/app/menu/nuevo" replace state={{ from: "/app/nutricion" }} />;
  }

  return (
    <div className="nl-page">
      <section className={`nl-shell ${compactClientMode ? "nl-contextual" : ""}`}>
        {compactClientMode ? (
          <>
            <header className="nl-context-head">
              <div>
                <span className="nl-kicker"><Database size={14} /> Biblioteca nutricional</span>
                <h1>Mis comidas y menús</h1>
                <p>{contextualTargetMode
                  ? "Encontrá opciones cercanas al objetivo nutricional del día seleccionado."
                  : "Explorá tus opciones y el contenido ZumaFit disponible para tu plan."}</p>
              </div>
              <span className="nl-context-plan">{contextualTargetMode ? "Meta del día" : "Explorar"}</span>
            </header>

            {contextualTargetMode || clientFacetFiltersActive ? (
              <section className="nl-context-target" aria-label={contextualTargetMode ? "Meta nutricional usada para buscar" : "Filtros nutricionales activos"}>
                <span className="nl-context-target-icon">{contextualTargetMode ? <Target size={20} /> : <SlidersHorizontal size={20} />}</span>
                <div className="nl-context-target-copy">
                  <span>{contextualTargetMode ? "Meta del día" : "Filtros activos"}</span>
                  <strong>{contextualTargetMode
                    ? <>{formatNumber(Number(targetFilters.targetKcal) || 0, 0)} <small>kcal</small></>
                    : facetFilters.calorieBucket
                      ? <>{formatNumber(Number(facetFilters.calorieBucket), 0)} <small>kcal aprox.</small></>
                      : "Todas las calorías"}</strong>
                  <b>{contextualTargetMode
                    ? `P${formatNumber(Number(targetFilters.targetProteina) || 0, 0)} / C${formatNumber(Number(targetFilters.targetCarbs) || 0, 0)} / G${formatNumber(Number(targetFilters.targetGrasas) || 0, 0)}`
                    : `${facetFilters.proteinBucket ? `P ${formatNumber(Number(facetFilters.proteinBucket), 0)} g aprox.` : "Proteína libre"}${clientFacetMode === "meal" && type !== "todos" ? ` · ${mealTypeLabel(type)}` : ""}`}</b>
                </div>
                <div className="nl-context-date">
                  {contextualTargetMode ? <CalendarDays size={15} /> : <Utensils size={15} />}
                  <span>{contextualTargetMode ? shortDateLabel(trackingDate) : clientFacetMode === "meal" ? "Comidas" : "Menús"}</span>
                </div>
              </section>
            ) : null}

            <section className="nl-context-search" aria-label={contextualTargetMode ? "Buscar en la biblioteca para esta meta" : "Buscar en la biblioteca nutricional"}>
              <div className="nl-context-search-title">
                <strong><Search size={14} /> {contextualTargetMode ? "Buscar opción ideal" : "Buscar en biblioteca"}</strong>
                <span>{contextualTargetMode ? "Ordenado por cercanía nutricional" : clientFacetFiltersActive ? "Filtros aplicados" : "Sin filtro nutricional"}</span>
              </div>
              <label className="nl-context-searchbox">
                <Search size={15} aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={contextualTargetMode ? "Ej: pollo, pasta, alto en proteína..." : "Buscar menú, comida o ingrediente..."} aria-label="Buscar en la biblioteca" />
                <button type="button" onClick={() => setContextTargetEditorOpen((current) => !current)} disabled={!contextualTargetMode && !clientFacetMode} aria-label={contextualTargetMode ? "Editar objetivo de búsqueda" : clientFacetMode ? "Editar filtros disponibles" : "Los filtros dinámicos están disponibles en Menús o Comidas"} aria-expanded={contextTargetEditorOpen}>
                  <SlidersHorizontal size={15} />
                </button>
              </label>
              <div className="nl-context-filters" role="tablist" aria-label="Tipo de contenido">
                {TARGET_LIBRARY_FILTERS.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <button key={filter.id} type="button" className={contextFilterId === filter.id ? "active" : ""} onClick={() => handleLibraryViewChange(filter.id)} role="tab" aria-selected={contextFilterId === filter.id}>
                      <Icon size={13} /> {filter.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
        <header className="nl-hero">
          <div>
            <span className="nl-kicker">
              <Database size={15} />
              Biblioteca nutricional
            </span>
            <h1>{professionalMode ? "Plantillas y biblioteca" : "Mis comidas y menus"}</h1>
            <p>
              {professionalMode
                ? "Organiza tus plantillas, la biblioteca ZumaFit y lo asignado a clientes."
                : "Accede a tus comidas, menus, favoritos y contenido ZumaFit permitido por tu plan."}
            </p>
          </div>
          {professionalMode ? (
            <div className="nl-heroCounters">
              <div className="nl-heroMetric">
                <strong>{ownedMenusUsage} / {Number.isFinite(ownedMenusLimit) ? ownedMenusLimit : "∞"}</strong>
                <span>menús propios</span>
              </div>
              <div className="nl-heroMetric">
                <strong>{ownedMealsUsage} / {Number.isFinite(ownedMealsLimit) ? ownedMealsLimit : "∞"}</strong>
                <span>comidas propias</span>
              </div>
            </div>
          ) : null}
        </header>
        )}

        {professionalMode && (menuLimitReached || mealLimitReached || ownedMenusLimit - ownedMenusUsage === 1 || ownedMealsLimit - ownedMealsUsage === 1) ? (
          <div className="nl-state compact" role="status">
            {menuLimitReached
              ? "Límite de menús propios alcanzado. "
              : ownedMenusLimit - ownedMenusUsage === 1
                ? "Te queda 1 menú propio disponible. "
                : ""}
            {mealLimitReached
              ? "Límite de comidas propias alcanzado."
              : ownedMealsLimit - ownedMealsUsage === 1
                ? "Te queda 1 comida propia disponible."
                : ""}
          </div>
        ) : null}

        {professionalMode ? <div className="nl-tabs" role="tablist" aria-label="Biblioteca nutricional">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab.id === tab.id ? "active" : ""}
              onClick={() => !tab.locked && setActiveTabId(tab.id)}
              disabled={tab.locked}
              title={tab.locked ? "Disponible en Coach Pro" : undefined}
            >
              {tab.locked ? <Lock size={14} aria-hidden="true" /> : null}
              {tab.label}
            </button>
          ))}
        </div> : null}

        {professionalMode && !canUseProfessionalGlobalLibrary ? (
          <div className="nl-state nl-libraryLocked" role="status">
            <Lock size={17} aria-hidden="true" />
            <span><strong>Biblioteca ZumaFit disponible en Coach Pro.</strong> Podés seguir trabajando con tus propias comidas y menús.</span>
          </div>
        ) : null}

        {professionalMode ? (
          <section className="nl-toolbar">
            <label className="nl-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, tipo o tag" />
            </label>
            {activeTab.kinds.includes("meals") ? (
              <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Tipo de comida">
                {MEAL_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            ) : null}
            {!professionalMode ? (
              <label className="nl-date">
                <span>Tracking</span>
                <input type="date" value={trackingDate} onChange={(event) => setTrackingDate(event.target.value)} />
              </label>
            ) : null}
            <button type="button" className={targetSearchOpen ? "nl-target-filter active" : "nl-target-filter"} onClick={() => setTargetSearchOpen((value) => !value)} aria-expanded={targetSearchOpen}>
              Buscar por objetivo
            </button>
          </section>
        ) : null}

        {compactClientMode && !contextualTargetMode && contextTargetEditorOpen && clientFacetMode ? (
          <LibraryFacetPanel
            kind={clientFacetMode}
            facets={libraryFacets}
            selectedType={type}
            selectedKcal={facetFilters.calorieBucket}
            selectedProtein={facetFilters.proteinBucket}
            loading={loading}
            onTypeChange={selectMealType}
            onKcalChange={selectCalorieBucket}
            onProteinChange={(value) => setFacetFilters((current) => ({ ...current, proteinBucket: value }))}
            onClear={clearFacetFilters}
          />
        ) : null}

        {(compactClientMode && contextualTargetMode && contextTargetEditorOpen) || (professionalMode && targetSearchOpen) ? (
          <section className="nl-target-filter-panel" aria-label="Buscar comidas y menus por objetivo nutricional">
            {[["targetKcal", "kcal"], ["targetProteina", "Proteina"], ["targetCarbs", "Carbohidratos"], ["targetGrasas", "Grasas"]].map(([field, label]) => (
              <label key={field}><span>{label}</span><input type="number" min="0" step="0.1" value={targetFilters[field]} onChange={(event) => setTargetFilters((current) => ({ ...current, [field]: event.target.value }))} placeholder="Libre" aria-label={`Objetivo de ${label}`} /></label>
            ))}
            {contextualTargetMode ? (
              <>
                <label><span>Fecha</span><input type="date" value={trackingDate} onChange={(event) => setTrackingDate(event.target.value)} aria-label="Fecha de la búsqueda contextual" /></label>
                <label><span>Cantidad de comidas</span><select value={targetMeals} onChange={(event) => setTargetMeals(event.target.value)} aria-label="Cantidad de comidas preferida"><option value="">Cualquiera</option>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} {count === 1 ? "comida" : "comidas"}</option>)}</select></label>
                {contextFilterId === "meals" ? <label><span>Tipo de comida</span><select value={type} onChange={(event) => setType(event.target.value)} aria-label="Tipo de comida">{MEAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
              </>
            ) : null}
            <button type="button" onClick={() => {
              setTargetFilters(contextualTargetMode ? initialTargetFilters : { targetKcal: "", targetProteina: "", targetCarbs: "", targetGrasas: "" });
              if (contextualTargetMode) {
                setTrackingDate(initialTrackingDate);
                setTargetMeals("");
              }
            }}>{contextualTargetMode ? "Restaurar meta del día" : "Limpiar filtros"}</button>
          </section>
        ) : null}

        {compactClientMode ? (
          <div className="nl-context-results-head">
            <div>
              <strong>{contextFilterId === "mine"
                ? "Mis menús y comidas guardados"
                : contextualTargetMode || clientFacetFiltersActive
                  ? `${contextFilterId === "menus" ? "Menús" : contextFilterId === "meals" ? "Comidas" : "Favoritos"} cercanos a tus filtros`
                  : `${contextFilterId === "menus" ? "Menús" : contextFilterId === "meals" ? "Comidas" : "Favoritos"} disponibles`}</strong>
              {contextFilterId === "menus" ? <small>Tus menús y la biblioteca pública ZumaFit permitida por tu plan.</small> : null}
            </div>
            <span>{loading ? "Buscando…" : `${totalItems} ${totalItems === 1 ? "resultado" : "resultados"}`}</span>
          </div>
        ) : null}

        {error ? <div className="nl-state error">{error}</div> : null}
        {loading ? <div className="nl-state"><Loader2 className="nl-spin" size={18} /> Cargando biblioteca...</div> : null}
        {!loading && !error && !totalItems ? (
          compactClientMode && contextFilterId === "menus" ? (
            <section className="nl-context-empty" role="status">
              <strong>{contextualTargetMode || clientFacetFiltersActive ? "No encontramos menús suficientemente cercanos a tus filtros." : "Todavía no hay menús disponibles en esta vista."}</strong>
              <p>{contextualTargetMode ? "Los menús inválidos o demasiado alejados no se muestran como coincidencias." : "Podés ajustar los filtros, crear uno propio o revisar tus guardados."}</p>
              {contextualTargetMode && menuSearchMeta?.outOfRangeCount ? <small>{menuSearchMeta.outOfRangeCount} menús quedaron fuera del rango nutricional.</small> : null}
              <div>
                {contextualTargetMode ? <button type="button" onClick={() => openContextualGenerator("combine_library")}>Combinar comidas</button> : null}
                {contextualTargetMode ? <button type="button" onClick={() => openContextualGenerator("from_scratch")}>Generar automáticamente</button> : null}
                <button type="button" onClick={openCreateMenu}>Crear manualmente</button>
                <button type="button" onClick={() => setContextTargetEditorOpen(true)}>Ajustar filtros</button>
              </div>
            </section>
          ) : <div className="nl-state">No hay contenido para este filtro.</div>
        ) : null}

        {!loading && (meals.length || menus.length) ? (
          <section className="nl-grid">
            {meals.map((meal) => (
              <LibraryCard
                key={`meal-${itemId(meal)}`}
                item={meal}
                professionalMode={professionalMode}
                contextual={compactClientMode}
                saving={saving}
                copyLimitReached={mealLimitReached}
                onCopy={handleCopy}
                onFavorite={handleFavorite}
                onAddToTracking={handleAddToTracking}
                onPreview={setPreviewItem}
                onAssign={(value) => {
                  setAssignItem(value);
                  setSelectedClientIds([]);
                }}
              />
            ))}
            {menus.map((menu) => (
              <LibraryCard
                key={`menu-${itemId(menu)}`}
                item={menu}
                professionalMode={professionalMode}
                contextual={compactClientMode}
                saving={saving}
                copyLimitReached={menuLimitReached}
                onCopy={handleCopy}
                onFavorite={handleFavorite}
                onAddToTracking={handleAddToTracking}
                onPreview={setPreviewItem}
                onAssign={(value) => {
                  setAssignItem(value);
                  setSelectedClientIds([]);
                }}
              />
            ))}
          </section>
        ) : null}
      </section>

      {assignItem ? (
        <AssignPanel
          item={assignItem}
          clients={clients}
          selectedClientIds={selectedClientIds}
          setSelectedClientIds={setSelectedClientIds}
          saving={saving}
          onClose={() => setAssignItem(null)}
          onAssign={handleAssign}
        />
      ) : null}

      {previewItem ? (
        <ContextMenuPreview
          item={previewItem}
          target={contextualTargetMode ? currentContextualTarget : {
            kcal: Number(facetFilters.calorieBucket) || 0,
            proteina: Number(facetFilters.proteinBucket) || 0,
            carbs: 0,
            grasas: 0,
          }}
          selectedDate={trackingDate}
          targetActive={contextualTargetMode || clientFacetFiltersActive}
          contextualDayMode={contextualTargetMode}
          canAdjust={contextualTargetMode}
          saving={saving}
          escapeEnabled={!applyConfirmItem}
          onClose={() => setPreviewItem(null)}
          onUseDraft={() => openMenuAsDraft(previewItem, false)}
          onAdjust={() => openMenuAsDraft(previewItem, true)}
          onSave={() => handleCopy(previewItem)}
          onSaveAlternative={() => handleSaveAlternative(previewItem)}
          onRequestApply={() => setApplyConfirmItem(previewItem)}
        />
      ) : null}

      {applyConfirmItem ? (
        <ApplyMenuConfirmation
          item={applyConfirmItem}
          selectedDate={trackingDate}
          saving={saving}
          onCancel={() => setApplyConfirmItem(null)}
          onConfirm={handleApplyConfirmed}
        />
      ) : null}

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function LibraryFacetPanel({ kind, facets = EMPTY_LIBRARY_FACETS, selectedType, selectedKcal, selectedProtein, loading, onTypeChange, onKcalChange, onProteinChange, onClear }) {
  const isMeal = kind === "meal";
  const hasSelection = Boolean(selectedKcal || selectedProtein || (isMeal && selectedType !== "todos"));
  return (
    <section className="nl-facet-panel" aria-label={`Filtrar ${isMeal ? "comidas" : "menús"} disponibles`}>
      <header>
        <div>
          <strong><SlidersHorizontal size={15} /> Filtros disponibles</strong>
          <span>Se crean solamente con {isMeal ? "las comidas" : "los menús"} que podés ver.</span>
        </div>
        <small>{loading ? "Actualizando…" : `${facets.totalAvailable || 0} en biblioteca`}</small>
      </header>

      {isMeal ? (
        <FacetChoiceGroup
          label="Tipo de comida"
          helper="Primero elegí qué momento querés buscar."
          allLabel="Todos"
          value={selectedType === "todos" ? "" : selectedType}
          options={(facets.types || []).map((option) => ({ ...option, label: mealTypeLabel(option.value) }))}
          onChange={(value) => onTypeChange(value || "todos")}
        />
      ) : null}

      <FacetChoiceGroup
        label="Calorías aproximadas"
        helper={`Rangos reales redondeados cada ${isMeal ? "50" : "100"} kcal.`}
        allLabel="Todas"
        value={selectedKcal}
        options={(facets.calories || []).map((option) => ({ ...option, label: `${formatNumber(option.value, 0)} kcal` }))}
        onChange={onKcalChange}
      />

      <FacetChoiceGroup
        label="Proteína aproximada"
        helper={`Opciones existentes${selectedKcal ? " dentro del rango calórico elegido" : " en esta vista"}.`}
        allLabel="Todas"
        value={selectedProtein}
        options={(facets.proteins || []).map((option) => ({ ...option, label: `${formatNumber(option.value, 0)} g` }))}
        onChange={onProteinChange}
      />

      <div className="nl-facet-footer">
        <span>{facets.complete === false ? "Opciones calculadas sobre los resultados cargados." : "Los rangos se actualizan con la biblioteca."}</span>
        <button type="button" onClick={onClear} disabled={!hasSelection}>Limpiar filtros</button>
      </div>
    </section>
  );
}

function FacetChoiceGroup({ label, helper, allLabel, value, options = [], onChange }) {
  return (
    <fieldset className="nl-facet-group">
      <legend>{label}</legend>
      <small>{helper}</small>
      <div>
        <button type="button" className={!value ? "active" : ""} onClick={() => onChange("")} aria-pressed={!value}>
          <strong>{allLabel}</strong>
        </button>
        {options.map((option) => (
          <button key={option.value} type="button" className={String(value) === String(option.value) ? "active" : ""} onClick={() => onChange(String(option.value))} aria-pressed={String(value) === String(option.value)}>
            <strong>{option.label}</strong>
            <span>{option.count}</span>
          </button>
        ))}
      </div>
      {!options.length ? <em>No hay opciones en esta selección.</em> : null}
    </fieldset>
  );
}

function LibraryCard({ item, professionalMode, contextual = false, saving, copyLimitReached, onCopy, onFavorite, onAddToTracking, onAssign, onPreview }) {
  const t = totals(item);
  const isMenu = item.kind === "menu";
  const favorite = !!(item.favorita || item.favorito);
  const permissions = item.permissions || {};
  const foods = foodItems(item);
  const comidas = Array.isArray(item.comidas) ? item.comidas : [];
  const previewFood = isMenu
    ? comidas.flatMap((comida) => foodItems(comida))[0]
    : foods[0];

  if (contextual) {
    return (
      <article
        className={`nl-context-card ${isMenu ? "menu previewable" : "meal"}`}
        role={isMenu ? "button" : undefined}
        tabIndex={isMenu ? 0 : undefined}
        aria-label={isMenu ? `Ver menú ${item.nombre || "sin nombre"}` : undefined}
        onClick={isMenu ? () => onPreview?.(item) : undefined}
        onKeyDown={isMenu ? (event) => {
          if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
          event.preventDefault();
          onPreview?.(item);
        } : undefined}
      >
        <div className="nl-context-card-image">
          <FoodThumb food={previewFood || {}} large />
        </div>
        <div className="nl-context-card-main">
          <div className="nl-context-card-overline">
            <span>{isMenu ? "Menú" : "Comida"}</span>
            {item.equivalence ? <b>{item.equivalence.category || (item.equivalence.requiresAdjustment ? "Cercano, ajustable" : "Coincidencia alta")}{Number.isFinite(Number(item.equivalence.percent)) ? ` · ${formatNumber(item.equivalence.percent, 0)}%` : ""}</b> : null}
          </div>
          <h2>{item.nombre || (isMenu ? "Menú" : "Comida")}</h2>
          <p><strong>{formatNumber(t.kcal, 0)} kcal</strong> · {macroLine(item)}</p>
          {item.equivalence ? (
            <small>Δ {formatNumber(item.equivalence.diff?.kcal, 0)} kcal · P {formatNumber(item.equivalence.diff?.proteina, 1)} · C {formatNumber(item.equivalence.diff?.carbs, 1)} · G {formatNumber(item.equivalence.diff?.grasas, 1)}</small>
          ) : null}
          {item.contextualEligibility?.eligible === false ? <small className="warning">Este menú está incompleto o muy alejado de la meta seleccionada.</small> : null}
          <div className="nl-context-card-tags">
            {isMenu ? <span>{formatNumber(item.cantidadComidas || comidas.length, 0)} comidas</span> : <span>{foods.length} alimentos</span>}
            {(item.badges || []).slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}
          </div>
        </div>
        <div className="nl-context-card-actions">
          {!professionalMode && !isMenu && permissions.canUseInTracking ? (
            <button type="button" className="primary" onClick={(event) => { event.stopPropagation(); onAddToTracking(item); }} disabled={saving}>
              <CheckCircle2 size={14} /> <span>Usar hoy</span>
            </button>
          ) : null}
          {permissions.canCopy ? (
            <button type="button" className={isMenu ? "primary" : "icon"} onClick={(event) => { event.stopPropagation(); onCopy(item); }} disabled={saving || copyLimitReached} aria-label={isMenu ? undefined : "Guardar copia"}>
              <Copy size={14} /> {isMenu ? <span>Guardar menú</span> : null}
            </button>
          ) : null}
          <button type="button" className={`icon ${favorite ? "active" : ""}`} disabled={!permissions.canFavorite || saving} onClick={(event) => { event.stopPropagation(); onFavorite(item); }} aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}>
            <Star size={14} fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`nl-card ${isMenu ? "menu" : "meal"}`}>
      <div className="nl-cardTop">
        <span className="nl-kind">
          {isMenu ? <BookOpen size={15} /> : <Utensils size={15} />}
          {isMenu ? "Menu" : "Comida"}
        </span>
        <button
          type="button"
          className={`nl-icon ${favorite ? "active" : ""}`}
          disabled={!permissions.canFavorite || saving}
          onClick={() => onFavorite(item)}
          aria-label="Favorito"
        >
          <Star size={17} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="nl-badges">
        {(item.badges || []).slice(0, 4).map((badge) => (
          <span key={badge}>{badge}</span>
        ))}
        {item.planMinimo ? <span>Plan {String(item.planMinimo).toUpperCase()}</span> : null}
      </div>

      <h2>{item.nombre || (isMenu ? "Menu" : "Comida")}</h2>
      <div className="nl-cardMeta">
        <strong>{formatNumber(t.kcal, 0)} kcal</strong>
        <span>{macroLine(item)}</span>
      </div>
      {item.equivalence ? (
        <div className="nl-equivalenceMatch" role="status">
          <strong>{item.equivalence.requiresAdjustment ? "Compatible con ajustes" : "Compatibilidad alta"}</strong>
          <span>Δ {formatNumber(item.equivalence.diff?.kcal, 0)} kcal · P {formatNumber(item.equivalence.diff?.proteina, 1)} · C {formatNumber(item.equivalence.diff?.carbs, 1)} · G {formatNumber(item.equivalence.diff?.grasas, 1)}</span>
        </div>
      ) : null}

      {isMenu ? (
        <div className="nl-menuPreview">
          <span>{formatNumber(item.cantidadComidas || comidas.length, 0)} comidas</span>
          {comidas.slice(0, 3).map((comida, index) => (
            <small key={`${comida.nombre || comida.tipoComida}-${index}`}>{comida.tipoComida || "comida"} · {comida.nombre || "Sin nombre"}</small>
          ))}
        </div>
      ) : (
        <div className="nl-foodPreview">
          <div className="nl-thumbs">
            {foods.slice(0, 3).map((food, index) => (
              <FoodThumb key={`${food.nombre || food.alimentoId}-${index}`} food={food} />
            ))}
          </div>
          <span>
            {foods.slice(0, 3).map((food) => food.nombre).filter(Boolean).join(" · ") || "Sin alimentos"}
            {foods.length > 3 ? ` +${foods.length - 3}` : ""}
          </span>
        </div>
      )}

      <div className="nl-actions">
        {!professionalMode && !isMenu && permissions.canUseInTracking ? (
          <button type="button" onClick={() => onAddToTracking(item)} disabled={saving}>
            <CheckCircle2 size={15} />
            Agregar
          </button>
        ) : null}
        {permissions.canCopy ? (
          <button
            type="button"
            onClick={() => onCopy(item)}
            disabled={saving || copyLimitReached}
            title={copyLimitReached ? "Límite de contenido propio alcanzado" : undefined}
          >
            <Copy size={15} />
            Guardar copia
          </button>
        ) : null}
        {professionalMode && permissions.canAssign ? (
          <button type="button" onClick={() => onAssign(item)} disabled={saving}>
            <Users size={15} />
            Asignar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function signed(value, unit = "") {
  const number = Number(value) || 0;
  const prefix = number > 0 ? "+" : number < 0 ? "−" : "±";
  return `${prefix}${formatNumber(Math.abs(number), unit === "kcal" ? 0 : 1)} ${unit}`.trim();
}

function ContextMenuPreview({ item, target, selectedDate, targetActive = false, contextualDayMode = false, canAdjust = false, saving, escapeEnabled = true, onClose, onUseDraft, onAdjust, onSave, onSaveAlternative, onRequestApply }) {
  const closeRef = useRef(null);
  const returnFocusRef = useRef(null);
  const t = totals(item);
  const meals = Array.isArray(item.comidas) ? item.comidas : [];
  const canSaveOriginal = item.libraryOrigin !== "user_owned" && item.permissions?.canCopy;

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, []);

  useEffect(() => {
    if (!escapeEnabled) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [escapeEnabled, onClose, saving]);

  return (
    <section className="nl-modal nl-context-preview-layer" role="dialog" aria-modal="true" aria-labelledby="nl-context-preview-title">
      <div className="nl-context-preview">
        <header>
          <div>
            <span className="nl-kicker"><Eye size={14} /> Vista previa · {item.originLabel || "Biblioteca"}</span>
            <h2 id="nl-context-preview-title">{item.nombre || "Menú"}</h2>
            <p>{formatNumber(t.kcal, 0)} kcal · {macroLine(item)} · {meals.length} comidas</p>
          </div>
          <button ref={closeRef} type="button" className="nl-icon" onClick={onClose} disabled={saving} aria-label="Cerrar vista previa"><X size={18} /></button>
        </header>

        <div className="nl-context-preview-match" role="status">
          <strong>{targetActive ? item.equivalence?.category || "Filtros seleccionados" : "Vista de biblioteca"}{item.equivalence?.percent !== undefined ? ` · ${formatNumber(item.equivalence.percent, 0)}%` : ""}</strong>
          <span>{targetActive
            ? target.kcal > 0
              ? `${formatNumber(target.kcal, 0)} kcal ${contextualDayMode ? `objetivo para el ${shortDateLabel(selectedDate)}` : "como referencia"}`
              : "Referencia de macros activa"
            : "Sin filtro nutricional activo"}</span>
          {targetActive && item.equivalence?.diff ? (
            <small>{signed(item.equivalence.diff.kcal, "kcal")} · P {signed(item.equivalence.diff.proteina, "g")} · C {signed(item.equivalence.diff.carbs, "g")} · G {signed(item.equivalence.diff.grasas, "g")}</small>
          ) : null}
        </div>

        <div className="nl-context-preview-meals" aria-label="Comidas del menú">
          {meals.map((meal, index) => {
            const mealNutrition = totals(meal);
            const items = foodItems(meal);
            return (
              <article key={`${meal.id || meal.nombre || "meal"}-${index}`}>
                <div>
                  <strong>{meal.nombre || meal.tipoComida || `Comida ${index + 1}`}</strong>
                  <span>{formatNumber(mealNutrition.kcal, 0)} kcal · {macroLine(meal)}</span>
                </div>
                <p>{items.map((food) => food.nombre || food.nombreSnapshot).filter(Boolean).join(" · ") || "Sin alimentos visibles"}</p>
              </article>
            );
          })}
        </div>

        <div className="nl-context-preview-actions">
          <button type="button" onClick={onUseDraft} disabled={saving}>Usar como borrador</button>
          <button type="button" onClick={onAdjust} disabled={saving || !canAdjust}>Ajustar a mi objetivo</button>
          <button type="button" onClick={onSave} disabled={saving || !canSaveOriginal}>{canSaveOriginal ? "Guardar en Mis menús" : "Ya está en Mis menús"}</button>
          <button type="button" onClick={onSaveAlternative} disabled={saving}>Guardar como alternativa</button>
          <button type="button" className="primary" onClick={onRequestApply} disabled={saving}>Aplicar desde esta fecha</button>
          <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
        </div>
        <small className="nl-context-preview-note">La vista previa y el guardado no registran consumos. El original permanece intacto.</small>
      </div>
    </section>
  );
}

function ApplyMenuConfirmation({ item, selectedDate, saving, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    cancelRef.current?.focus();
    function closeOnEscape(event) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [onCancel, saving]);

  return (
    <section className="nl-modal nl-context-confirm-layer" role="alertdialog" aria-modal="true" aria-labelledby="nl-context-confirm-title" aria-describedby="nl-context-confirm-copy">
      <div className="nl-context-confirm">
        <span className="nl-context-confirm-icon"><CheckCircle2 size={22} /></span>
        <h2 id="nl-context-confirm-title">Aplicar una copia de este menú</h2>
        <p id="nl-context-confirm-copy">Se creará una alternativa propia de <strong>{item.nombre || "este menú"}</strong> y quedará activa desde el <strong>{shortDateLabel(selectedDate)}</strong>. No se modificará el original ni se registrarán comidas como consumidas.</p>
        <div>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={saving}>Volver</button>
          <button type="button" className="primary" onClick={onConfirm} disabled={saving}>{saving ? <Loader2 size={16} className="nl-spin" /> : <CheckCircle2 size={16} />} Confirmar aplicación</button>
        </div>
      </div>
    </section>
  );
}

function FoodThumb({ food, large = false }) {
  const [failed, setFailed] = useState(false);
  const src = foodImage(food);
  if (failed || !src) return <span className={`nl-thumbFallback ${large ? "large" : ""}`} />;
  return (
    <img
      src={src}
      alt={food.imagenAlt || food.nombre || "Alimento"}
      loading="lazy"
      decoding="async"
      width={large ? 58 : 34}
      height={large ? 58 : 34}
      className={large ? "large" : undefined}
      onError={() => setFailed(true)}
    />
  );
}

function AssignPanel({ item, clients, selectedClientIds, setSelectedClientIds, saving, onClose, onAssign }) {
  function toggle(id) {
    setSelectedClientIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    <section className="nl-modal" role="dialog" aria-modal="true">
      <div className="nl-assign">
        <header>
          <div>
            <span className="nl-kicker">Asignar a clientes</span>
            <h2>{item.nombre}</h2>
          </div>
          <button type="button" className="nl-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="nl-clientList">
          {clients.map((client) => {
            const id = String(client.id || client._id || "");
            const name = client.nombre || client.name || client.email || "Cliente";
            return (
              <label key={id}>
                <input type="checkbox" checked={selectedClientIds.includes(id)} onChange={() => toggle(id)} />
                <span>
                  <strong>{name}</strong>
                  <small>{client.email || "Cliente asignado"}</small>
                </span>
              </label>
            );
          })}
          {!clients.length ? <div className="nl-state compact">No hay clientes disponibles.</div> : null}
        </div>

        <footer>
          <button type="button" className="nl-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="nl-primary" onClick={onAssign} disabled={saving || !selectedClientIds.length}>
            {saving ? <Loader2 size={16} className="nl-spin" /> : <Users size={16} />}
            Asignar
          </button>
        </footer>
      </div>
    </section>
  );
}
