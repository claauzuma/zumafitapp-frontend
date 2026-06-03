import React, { useMemo, useState } from "react";
import {
  Beef,
  BookOpen,
  ChefHat,
  ChevronRight,
  Copy,
  Database,
  Eye,
  Flame,
  Layers,
  Pencil,
  Plus,
  RefreshCcw,
  Replace,
  Search,
  ShieldCheck,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { createMenuBase, createMenuBaseFromDisplay, deleteMenuBase, duplicateMenuBase, updateMenuBase } from "../menus/menusApi.js";
import { useMenusBase } from "../menus/menusQueries.js";
import { normalizeDemoMenu } from "../menus/menusUtils.js";
import { MealRecipeEditor, MenuBaseEditor, MenuCreationFlow } from "../nutricion/NutritionEditors.jsx";
import { DEMO_COMIDAS } from "../nutricion/nutricionDemo.js";
import { createComida, deleteComida, duplicateComida, updateComida } from "../nutricion/nutricionApi.js";
import { useAlimentos, useComidas, useMenusDemo } from "../nutricion/nutricionQueries.js";
import { filterMeals, formatNumber } from "../nutricion/nutricionUtils.js";
import { compactMacroLine, findIdenticalMeal, findIdenticalMenu } from "../nutricion/nutritionIdentity.js";
import { invalidateComidasLibrary, invalidateMenusLibrary } from "../queryClient.js";
import AppToast from "../ui/AppToast.jsx";
import "../nutricion/nutricion.css";

const TAB_MENUS = "menus";
const TAB_COMIDAS = "comidas";

const MEAL_GROUPS = [
  { id: "desayuno_merienda", label: "Desayuno / Merienda", types: ["desayuno", "merienda"], icon: ChefHat },
  { id: "almuerzo_cena", label: "Almuerzo / Cena", types: ["almuerzo", "cena"], icon: Utensils },
  { id: "snack", label: "Snacks", types: ["snack"], icon: Beef },
  { id: "todos", label: "Todas", types: [], icon: Layers },
];

const GOALS = [
  ["todos", "Todos los objetivos"],
  ["definicion", "Definicion"],
  ["recomposicion", "Recomposicion"],
  ["mantenimiento", "Mantenimiento"],
  ["volumen limpio", "Volumen limpio"],
  ["rendimiento", "Rendimiento"],
  ["saciante", "Saciante"],
];

export default function AdminComidas() {
  const [activeTab, setActiveTab] = useState(TAB_MENUS);
  const [mealFilters, setMealFilters] = useState({ search: "", type: "todos" });
  const [menuFilters, setMenuFilters] = useState({ search: "", goal: "todos", meals: 0 });
  const [selectedRange, setSelectedRange] = useState("");
  const [selectedProtein, setSelectedProtein] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [selectedMealGroup, setSelectedMealGroup] = useState("");
  const [mealEditor, setMealEditor] = useState(null);
  const [menuEditor, setMenuEditor] = useState(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);

  const foodsQuery = useAlimentos({});
  const foods = foodsQuery.data?.all || [];
  const comidasQuery = useComidas(mealFilters, foods, { enabled: !foodsQuery.isLoading });
  const menusQuery = useMenusBase({ search: menuFilters.search, includeComidas: true });
  const demoMenusQuery = useMenusDemo(menuFilters);

  const realMeals = useMemo(() => comidasQuery.data?.comidas || [], [comidasQuery.data?.comidas]);
  const usingDemoMeals = !comidasQuery.isLoading && realMeals.length === 0;
  const displayMeals = usingDemoMeals ? filterMeals(DEMO_COMIDAS, mealFilters) : realMeals;
  const allMeals = useMemo(
    () => (usingDemoMeals ? DEMO_COMIDAS : comidasQuery.data?.all || []),
    [comidasQuery.data?.all, usingDemoMeals]
  );
  const realMenus = useMemo(() => menusQuery.data?.menus || [], [menusQuery.data?.menus]);
  const demoMenus = useMemo(
    () => (demoMenusQuery.data?.menus || []).map((menu) => normalizeDemoMenu(menu)),
    [demoMenusQuery.data?.menus]
  );
  const hasRealMenus = realMenus.length > 0;
  const libraryMenus = useMemo(
    () => filterLibraryMenus(hasRealMenus ? realMenus : demoMenus, menuFilters),
    [demoMenus, hasRealMenus, menuFilters, realMenus]
  );
  const ranges = useMemo(() => rangesFromMenus(libraryMenus), [libraryMenus]);
  const visibleRangeMenus = useMemo(() => {
    if (!selectedRange) return libraryMenus;
    return libraryMenus.filter((menu) => menu.range.label === selectedRange);
  }, [libraryMenus, selectedRange]);

  const proteinsForRange = useMemo(
    () => [...new Set(visibleRangeMenus.map((menu) => Number(menu.protein)).filter(Boolean))].sort((a, b) => a - b),
    [visibleRangeMenus]
  );

  const visibleProteinMenus = useMemo(() => {
    if (!selectedRange || !selectedProtein) return [];
    return libraryMenus.filter(
      (menu) => menu.range.label === selectedRange && Number(menu.protein) === Number(selectedProtein)
    );
  }, [libraryMenus, selectedProtein, selectedRange]);

  const currentView = selectedProtein ? "menus" : selectedRange ? "proteinas" : "rangos";

  const stats = useMemo(() => {
    const mealsWithMacros = allMeals.filter((meal) => meal.demo || meal.totals?.matched > 0).length;
    const activeMenus = realMenus.filter((menu) => String(menu.estado || "").toLowerCase() === "activo").length;
    return {
      menus: hasRealMenus ? realMenus.length : demoMenus.length,
      activeMenus: hasRealMenus ? activeMenus : ranges.length,
      meals: allMeals.length,
      foods: foods.length,
      mealsWithMacros,
    };
  }, [allMeals, demoMenus.length, foods.length, hasRealMenus, ranges.length, realMenus]);

  async function saveOrDuplicateMenu(menu) {
    if (!menu) return;
    try {
      setBusy(`save-${menu.id}`);
      if (menu.demo) {
        const created = await createMenuBaseFromDisplay(menu);
        await invalidateMenusLibrary(created?.id);
        setSelectedMenuId(created?.id || menu.id);
        setToast({ type: "success", message: "Demo guardado como menu base." });
      } else {
        const duplicated = await duplicateMenuBase(menu.baseId || menu.id, {
          nombre: `${menu.name} - copia admin`,
          visibilidad: menu.visibility || "privada",
        });
        await invalidateMenusLibrary(duplicated?.id || menu.id);
        setSelectedMenuId(duplicated?.id || menu.id);
        setToast({ type: "success", message: "Menu base duplicado." });
      }
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo guardar el menu." });
    } finally {
      setBusy("");
    }
  }

  async function saveMealRecipe(payload) {
    try {
      const current = mealEditor?.meal;
      const duplicated = findIdenticalMeal(allMeals, payload, current?.id);
      if (duplicated) {
        setToast({
          type: "warning",
          message: `Ya existe una comida identica: ${duplicated.name || duplicated.nombre || "sin nombre"}. Cambia algo antes de guardar.`,
        });
        return;
      }

      setBusy("meal-save");
      const saved = current?.id && !current?.demo
        ? await updateComida(current.id, payload)
        : await createComida(payload);
      await invalidateComidasLibrary(saved?.id || current?.id);
      setMealEditor(null);
      setToast({ type: "success", message: current?.id && !current?.demo ? "Comida actualizada." : "Comida creada." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo guardar la comida." });
    } finally {
      setBusy("");
    }
  }

  async function duplicateMealRecipe(meal) {
    if (!meal?.id || meal.demo) return;
    try {
      setBusy(`meal-duplicate-${meal.id}`);
      const duplicated = await duplicateComida(meal.id, { nombre: `${meal.name || meal.nombre} copia` });
      await invalidateComidasLibrary(duplicated?.id || meal.id);
      setToast({ type: "success", message: "Comida duplicada." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo duplicar la comida." });
    } finally {
      setBusy("");
    }
  }

  async function removeMealRecipe(meal) {
    if (!meal?.id || meal.demo) return;
    try {
      setBusy(`meal-delete-${meal.id}`);
      await deleteComida(meal.id);
      await invalidateComidasLibrary(meal.id);
      setToast({ type: "success", message: "Comida eliminada." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo eliminar la comida." });
    } finally {
      setBusy("");
    }
  }

  async function saveMenuBase(payload) {
    try {
      const current = menuEditor?.menu;
      const duplicated = findIdenticalMenu(realMenus, payload, current?.id || current?.baseId);
      if (duplicated) {
        setToast({
          type: "warning",
          message: `Ya existe un menu identico: ${duplicated.name || duplicated.nombre || "sin nombre"}. Cambia algo antes de guardar.`,
        });
        return;
      }

      setBusy("menu-save");
      const saved = current?.id && !current?.demo
        ? await updateMenuBase(current.baseId || current.id, payload)
        : await createMenuBase(payload);
      await invalidateMenusLibrary(saved?.id || current?.id);
      setMenuEditor(null);
      setSelectedMenuId(saved?.id || current?.id || "");
      setToast({ type: "success", message: current?.id && !current?.demo ? "Menu actualizado." : "Menu creado." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo guardar el menu." });
    } finally {
      setBusy("");
    }
  }

  async function removeMenuBase(menu) {
    if (!menu?.id || menu.demo) return;
    try {
      setBusy(`menu-delete-${menu.id}`);
      await deleteMenuBase(menu.baseId || menu.id);
      await invalidateMenusLibrary(menu.id);
      setSelectedMenuId("");
      setToast({ type: "success", message: "Menu eliminado." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo eliminar el menu." });
    } finally {
      setBusy("");
    }
  }

  function chooseRange(range) {
    setSelectedRange(range.label);
    setSelectedProtein("");
    setSelectedMenuId("");
  }

  function chooseProtein(protein) {
    setSelectedProtein(String(protein));
    setSelectedMenuId("");
  }

  function resetFlow(level) {
    if (level === "root") {
      setSelectedRange("");
      setSelectedProtein("");
      setSelectedMenuId("");
    }
    if (level === "range") {
      setSelectedProtein("");
      setSelectedMenuId("");
    }
  }

  function refreshVisible() {
    if (activeTab === TAB_MENUS) {
      menusQuery.refetch();
      demoMenusQuery.refetch();
      return;
    }
    comidasQuery.refetch();
    foodsQuery.refetch();
  }

  const loadingMenus = menusQuery.isLoading || demoMenusQuery.isLoading;
  const refreshing =
    activeTab === TAB_MENUS
      ? (menusQuery.isFetching || demoMenusQuery.isFetching) && !loadingMenus
      : comidasQuery.isFetching && !comidasQuery.isLoading;

  return (
    <div className="nf-page">
      <section className="nf-shell">
        <header className="nf-hero">
          <div className="nf-heroCopy">
            <div className="nf-kicker">
              <ShieldCheck size={15} strokeWidth={2.3} aria-hidden="true" />
              Admin nutricion
            </div>
            <div className="nf-titleRow">
              <Utensils size={28} strokeWidth={2.3} aria-hidden="true" />
              <h1 className="nf-title">Nutricion</h1>
            </div>
            <p className="nf-sub">Gestiona menus base, comidas reutilizables y recetas desde una vista clara.</p>
          </div>

          <div className="nf-actions">
            <button
              type="button"
              className="nf-iconBtn"
              onClick={refreshVisible}
              disabled={refreshing}
              title={refreshing ? "Actualizando" : "Actualizar"}
              aria-label="Actualizar nutricion"
            >
              <RefreshCcw className={refreshing ? "refreshing" : ""} size={18} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="nf-summary">
          <Stat label={hasRealMenus ? "Menus base" : "Menus demo"} value={stats.menus} icon={BookOpen} />
          <Stat label={hasRealMenus ? "Activos" : "Rangos"} value={stats.activeMenus} icon={Flame} />
          <Stat label={usingDemoMeals ? "Recetas demo" : "Comidas/recetas"} value={stats.meals} icon={ChefHat} />
          <Stat label="Alimentos" value={stats.foods} icon={Database} />
        </div>

        <NutritionTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === TAB_MENUS ? (
          <MenusTab
            filters={menuFilters}
            setFilters={setMenuFilters}
            hasRealMenus={hasRealMenus}
            ranges={ranges}
            visibleRangeMenus={visibleRangeMenus}
            proteinsForRange={proteinsForRange}
            visibleProteinMenus={visibleProteinMenus}
            selectedRange={selectedRange}
            selectedProtein={selectedProtein}
            selectedMenuId={selectedMenuId}
            currentView={currentView}
            chooseRange={chooseRange}
            chooseProtein={chooseProtein}
            resetFlow={resetFlow}
            setSelectedMenuId={setSelectedMenuId}
            loading={loadingMenus}
            error={menusQuery.error || demoMenusQuery.error}
            onSave={saveOrDuplicateMenu}
            onCreate={() => setMenuEditor({ mode: "create", menu: null })}
            onEdit={(menu) => setMenuEditor({ mode: menu.demo ? "create" : "edit", menu })}
            onDelete={removeMenuBase}
            busy={busy}
          />
        ) : (
          <ComidasTab
            filters={mealFilters}
            setFilters={setMealFilters}
            meals={displayMeals}
            usingDemo={usingDemoMeals}
            loading={foodsQuery.isLoading || comidasQuery.isLoading}
            error={comidasQuery.error || foodsQuery.error}
            withMacros={stats.mealsWithMacros}
            selectedGroup={selectedMealGroup}
            setSelectedGroup={setSelectedMealGroup}
            onCreate={() => setMealEditor({ mode: "create", meal: null })}
            onEdit={(meal) => setMealEditor({ mode: meal.demo ? "create" : "edit", meal })}
            onDuplicate={duplicateMealRecipe}
            onDelete={removeMealRecipe}
            busy={busy}
          />
        )}
      </section>
      {mealEditor ? (
        <MealRecipeEditor
          initialMeal={mealEditor.meal}
          foods={foods}
          foodsLoading={foodsQuery.isLoading}
          onSave={saveMealRecipe}
          onClose={() => setMealEditor(null)}
          saving={busy === "meal-save"}
          title={mealEditor.mode === "edit" ? "Editar comida / receta" : "Crear comida / receta"}
          submitLabel={mealEditor.mode === "edit" ? "Guardar cambios" : "Crear comida"}
          allowSystemVisibility
        />
      ) : null}
      {menuEditor ? (
        menuEditor.mode === "create" && !menuEditor.menu ? (
          <MenuCreationFlow
            foods={foods}
            foodsLoading={foodsQuery.isLoading}
            mealLibrary={allMeals}
            onSave={saveMenuBase}
            onClose={() => setMenuEditor(null)}
            saving={busy === "menu-save"}
            allowSystemVisibility
            canUseSuggestions={true}
          />
        ) : (
          <MenuBaseEditor
            initialMenu={menuEditor.menu}
            foods={foods}
            foodsLoading={foodsQuery.isLoading}
            mealLibrary={allMeals}
            onSave={saveMenuBase}
            onClose={() => setMenuEditor(null)}
            saving={busy === "menu-save"}
            title={menuEditor.mode === "edit" ? "Editar menu base" : "Crear menu base"}
            submitLabel={menuEditor.mode === "edit" ? "Guardar cambios" : "Crear menu"}
            allowSystemVisibility
          />
        )
      ) : null}
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function NutritionTabs({ activeTab, onChange }) {
  return (
    <div className="nf-tabs" role="tablist" aria-label="Secciones de nutricion">
      <button
        type="button"
        className={`nf-tab ${activeTab === TAB_MENUS ? "active" : ""}`}
        onClick={() => onChange(TAB_MENUS)}
        role="tab"
        aria-selected={activeTab === TAB_MENUS}
      >
        <BookOpen size={16} strokeWidth={2.3} aria-hidden="true" />
        Menus
      </button>
      <button
        type="button"
        className={`nf-tab ${activeTab === TAB_COMIDAS ? "active" : ""}`}
        onClick={() => onChange(TAB_COMIDAS)}
        role="tab"
        aria-selected={activeTab === TAB_COMIDAS}
      >
        <ChefHat size={16} strokeWidth={2.3} aria-hidden="true" />
        Comidas / Recetas
      </button>
    </div>
  );
}

function MenusTab({
  filters,
  setFilters,
  hasRealMenus,
  ranges,
  visibleRangeMenus,
  proteinsForRange,
  visibleProteinMenus,
  selectedRange,
  selectedProtein,
  selectedMenuId,
  currentView,
  chooseRange,
  chooseProtein,
  resetFlow,
  setSelectedMenuId,
  loading,
  error,
  onSave,
  onCreate,
  onEdit,
  onDelete,
  busy,
}) {
  const [detailMenuId, setDetailMenuId] = useState("");
  const detailMenu = visibleProteinMenus.find((menu) => menu.id === detailMenuId) || null;

  return (
    <div className="nf-tabPanel">
      <div className="nf-sectionHead">
        <div>
          <h2>Menus base</h2>
          <p>Explora por rango calorico, proteina y detalle de comidas.</p>
        </div>
        <div className="nf-actions">
          <span className="nf-pill good">{hasRealMenus ? "Plantillas reales" : "Biblioteca demo"}</span>
          <button type="button" className="nf-btn gold" onClick={onCreate}>
            <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
            Crear menu
          </button>
        </div>
      </div>

      <div className="nf-toolbar nf-toolbarSlim">
        <label className="nf-searchWrap">
          <Search size={17} strokeWidth={2.2} aria-hidden="true" />
          <input
            className="nf-search"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Buscar menu, tag u objetivo..."
          />
        </label>
        <select
          className="nf-select"
          value={filters.goal}
          onChange={(event) => setFilters((prev) => ({ ...prev, goal: event.target.value }))}
          aria-label="Filtrar por objetivo"
        >
          {GOALS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <nav className="nf-flow" aria-label="Navegacion de menus">
        <button type="button" className={!selectedRange ? "active" : ""} onClick={() => resetFlow("root")}>
          <Utensils size={14} strokeWidth={2.4} aria-hidden="true" />
          Menus
        </button>
        {selectedRange ? (
          <button type="button" className={!selectedProtein ? "active" : ""} onClick={() => resetFlow("range")}>
            <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
            {selectedRange}
          </button>
        ) : null}
        {selectedProtein ? (
          <button type="button" className="active">
            <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
            {selectedProtein} g proteina
          </button>
        ) : null}
      </nav>

      {!hasRealMenus ? (
        <div className="nf-demoNotice nf-infoBanner">
          <Layers size={18} strokeWidth={2.3} aria-hidden="true" />
          <div>
            <strong>Demo no persistente</strong>
            <span>Estas plantillas solo se guardan en DB si tocas Guardar demo.</span>
          </div>
        </div>
      ) : null}

      {loading ? <SkeletonGrid /> : null}
      {error ? <div className="nf-error">{error.message || "No se pudieron cargar menus."}</div> : null}

      {!loading && !error && currentView === "rangos" ? (
        ranges.length ? (
          <div className="nf-rangeGrid">
            {ranges.map((range) => (
              <RangeCard key={range.label} range={range} demo={!hasRealMenus} onSelect={() => chooseRange(range)} />
            ))}
          </div>
        ) : (
          <div className="nf-empty">No hay rangos para esos filtros.</div>
        )
      ) : null}

      {!loading && !error && currentView === "proteinas" ? (
        proteinsForRange.length ? (
          <div className="nf-rangeGrid">
            {proteinsForRange.map((protein) => (
              <ProteinCard
                key={protein}
                protein={protein}
                menus={visibleRangeMenus.filter((menu) => Number(menu.protein) === Number(protein))}
                demo={!hasRealMenus}
                onSelect={() => chooseProtein(protein)}
              />
            ))}
          </div>
        ) : (
          <div className="nf-empty">No hay proteinas disponibles en este rango.</div>
        )
      ) : null}

      {!loading && !error && currentView === "menus" ? (
        visibleProteinMenus.length ? (
          <>
            <div className="nf-cardGrid nf-menuCardsOnly">
              {visibleProteinMenus.map((menu) => (
                <MenuCard
                  key={menu.id}
                  menu={menu}
                  selected={selectedMenuId === menu.id}
                  onView={() => {
                    setSelectedMenuId(menu.id);
                    setDetailMenuId(menu.id);
                  }}
                  onSave={() => onSave(menu)}
                  onEdit={() => onEdit(menu)}
                  onDelete={() => onDelete(menu)}
                  busy={busy === `save-${menu.id}`}
                />
              ))}
            </div>
            <MenuDetailModal
              menu={detailMenu}
              onClose={() => setDetailMenuId("")}
              onSave={detailMenu ? () => onSave(detailMenu) : null}
              onEdit={detailMenu ? () => onEdit(detailMenu) : null}
              onDelete={detailMenu ? () => onDelete(detailMenu) : null}
              busy={busy}
            />
          </>
        ) : (
          <div className="nf-empty">No hay menus para esa proteina.</div>
        )
      ) : null}

      <div className="nf-demoNotice nf-infoBanner">
        <Layers size={18} strokeWidth={2.3} aria-hidden="true" />
        <div>
          <strong>Menus asignados globales</strong>
          <span>Queda pendiente un endpoint admin para listar todos los menus asignados de todos los clientes.</span>
        </div>
      </div>
    </div>
  );
}

function RangeCard({ range, demo, onSelect }) {
  return (
    <article className={`nf-card nf-rangeCard nf-tone-${goalTone(range.goals?.[0])}`} onClick={onSelect}>
      <div className="nf-cardTop">
        <span className={`nf-pill ${demo ? "demo" : "good"}`}>{demo ? "Demo" : "Real"}</span>
        <span className="nf-arrowBubble">
          <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
      </div>
      <div className="nf-rangeVisual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="nf-kcalBig">{range.label}</div>
      <div className="nf-rangeMeta">
        <span><Utensils size={14} strokeWidth={2.3} /> {range.menuCount} menus</span>
        <span><Beef size={14} strokeWidth={2.3} /> {range.proteinMin}-{range.proteinMax} g</span>
      </div>
      <div className="nf-chipRow">
        {range.proteins.slice(0, 4).map((protein) => (
          <span className="nf-pill" key={protein}>{protein} g</span>
        ))}
      </div>
    </article>
  );
}

function ProteinCard({ protein, menus, demo, onSelect }) {
  const avgKcal = menus.length ? menus.reduce((acc, menu) => acc + Number(menu.kcal || 0), 0) / menus.length : 0;
  return (
    <article className="nf-card nf-rangeCard nf-proteinCard" onClick={onSelect}>
      <div className="nf-cardTop">
        <span className={`nf-pill ${demo ? "demo" : "good"}`}>{menus.length} menu(s)</span>
        <span className="nf-arrowBubble">
          <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
      </div>
      <div className="nf-proteinIcon" aria-hidden="true">
        <Beef size={28} strokeWidth={2.2} />
      </div>
      <div className="nf-proteinBig">{protein} g proteina</div>
      <div className="nf-rangeMeta">
        <span><Flame size={14} strokeWidth={2.3} /> {formatNumber(avgKcal)} kcal prom.</span>
        <span><Utensils size={14} strokeWidth={2.3} /> macros listos</span>
      </div>
    </article>
  );
}

function MenuCard({ menu, selected, onView, onSave, onEdit, onDelete, busy }) {
  return (
    <article className={`nf-card nf-menuCard ${selected ? "selected" : ""}`}>
      <div className="nf-cardTop">
        <span className={`nf-pill ${menu.demo ? "demo" : "good"}`}>{menu.demo ? "Ejemplo demo" : "Plantilla real"}</span>
        <button type="button" className="nf-iconBtn" onClick={onView} aria-label={`Ver ${menu.name}`}>
          <Eye size={17} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>
      <h3>{menu.name}</h3>
      <p>{menu.description || "Plantilla nutricional reutilizable."}</p>
      <div className="nf-compactMacro">
        <strong>{formatNumber(menu.kcal)} kcal</strong>
        <span>P {formatNumber(menu.protein)}</span>
        <span>C {formatNumber(menu.carbs)}</span>
        <span>G {formatNumber(menu.fat)}</span>
      </div>
      <div className="nf-chipRow">
        {(menu.tags || []).slice(0, 3).map((tag) => (
          <span className="nf-pill" key={tag}>{tag}</span>
        ))}
      </div>
      <div className="nf-cardActions compact">
        <button type="button" className="nf-btn ghost" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
          {menu.demo ? "Usar demo" : "Editar"}
        </button>
        <button type="button" className="nf-btn gold" onClick={onSave} disabled={busy}>
          <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
          {busy ? "Guardando..." : menu.demo ? "Guardar demo" : "Duplicar"}
        </button>
        {!menu.demo ? (
          <button type="button" className="nf-btn ghost" onClick={onDelete}>
            <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
            Eliminar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MenuDetailModal({ menu, onClose, onSave, onEdit, onDelete, busy }) {
  if (!menu) return null;

  return (
    <div className="nf-detailBackdrop">
      <aside className="nf-detailSheet nf-menuDetail">
        <div className="nf-cardTop">
          <div>
            <span className={`nf-pill ${menu.demo ? "demo" : "good"}`}>{menu.demo ? "Detalle demo" : "Detalle real"}</span>
            <h3>{menu.name}</h3>
            <p>{menu.description || "Plantilla nutricional reutilizable."}</p>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar detalle">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        <div className="nf-detailMacroBand">
          <strong>{formatNumber(menu.kcal)} kcal</strong>
          <span>P {formatNumber(menu.protein)} g</span>
          <span>C {formatNumber(menu.carbs)} g</span>
          <span>G {formatNumber(menu.fat)} g</span>
        </div>

        <div className="nf-chipRow">
          <span className="nf-pill">{menu.range?.label || "Sin rango"}</span>
          <span className="nf-pill">{formatNumber(menu.mealsCount)} comidas</span>
          <span className="nf-pill">{menu.visibility || "demo"}</span>
        </div>

        {onSave ? (
          <div className="nf-cardActions compact">
            <button type="button" className="nf-btn ghost" onClick={onEdit}>
              <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
              {menu.demo ? "Usar como base" : "Editar"}
            </button>
            <button type="button" className="nf-btn gold" onClick={onSave} disabled={busy === `save-${menu.id}`}>
              <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
              {busy === `save-${menu.id}` ? "Guardando..." : menu.demo ? "Guardar demo" : "Duplicar menu"}
            </button>
            {!menu.demo ? (
              <button type="button" className="nf-btn ghost" onClick={onDelete} disabled={busy === `menu-delete-${menu.id}`}>
                <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                Eliminar
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="nf-mealList">
          {(menu.meals || []).length ? (
            menu.meals.map((meal) => (
              <div className="nf-meal" key={meal.id || meal.name}>
                <div className="nf-mealHead">
                  <strong>{meal.name}</strong>
                  <span>{formatNumber(meal.kcal)} kcal</span>
                </div>
                <div className="nf-chipRow">
                  <span className="nf-pill">P {formatNumber(meal.protein)} g</span>
                  <span className="nf-pill">C {formatNumber(meal.carbs)} g</span>
                  <span className="nf-pill">G {formatNumber(meal.fat)} g</span>
                </div>
                <ul className="nf-foodList">
                  {(meal.foods || []).map((food) => (
                    <li key={food.id || `${meal.name}-${food.name}`}>
                      <span>{food.name}</span>
                      <strong>{food.amount || `${formatNumber(food.cantidad)} ${food.unidad || ""}`}</strong>
                      <FoodMacroChips food={food} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div className="nf-empty">Este menu todavia no tiene comidas cargadas.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ComidasTab({
  filters,
  setFilters,
  meals,
  usingDemo,
  loading,
  error,
  withMacros,
  selectedGroup,
  setSelectedGroup,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  busy,
}) {
  const [detailMealId, setDetailMealId] = useState("");
  const groupCards = useMemo(() => {
    return MEAL_GROUPS.map((group) => {
      const groupMeals = mealsForGroup(meals, group.id);
      return {
        ...group,
        meals: groupMeals,
        count: groupMeals.length,
        avg: averageTotals(groupMeals),
      };
    });
  }, [meals]);

  const visibleMeals = selectedGroup ? mealsForGroup(meals, selectedGroup) : [];
  const selectedLabel = MEAL_GROUPS.find((group) => group.id === selectedGroup)?.label || "";
  const detailMeal = visibleMeals.find((meal) => meal.id === detailMealId) || null;

  return (
    <div className="nf-tabPanel">
      <div className="nf-sectionHead">
        <div>
          <h2>Comidas / Recetas</h2>
          <p>Bloques reutilizables: desayunos, almuerzos, meriendas, cenas y snacks.</p>
        </div>
        <div className="nf-actions">
          <span className="nf-pill">{withMacros} con macros</span>
          <button type="button" className="nf-btn gold" onClick={onCreate}>
            <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
            Crear comida/receta
          </button>
        </div>
      </div>

      <div className="nf-toolbar">
        <label className="nf-searchWrap">
          <Search size={17} strokeWidth={2.2} aria-hidden="true" />
          <input
            className="nf-search"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Buscar receta o alimento..."
          />
        </label>
        <button type="button" className="nf-btn ghost" onClick={() => setSelectedGroup("")}>
          <Layers size={16} strokeWidth={2.2} aria-hidden="true" />
          Grupos
        </button>
      </div>

      {usingDemo ? (
        <div className="nf-demoNotice">
          No hay comidas reales todavia. Estas tarjetas son ejemplos demo y no se guardan automaticamente.
        </div>
      ) : (
        <div className="nf-demoNotice nf-infoBanner">
          <ChefHat size={18} strokeWidth={2.3} aria-hidden="true" />
          <div>
            <strong>Modelo actual de comidas</strong>
            <span>Se muestran como recetas reutilizables; los macros se calculan cuando los items coinciden con alimentos reales.</span>
          </div>
        </div>
      )}

      {loading ? <SkeletonGrid /> : null}
      {error ? <div className="nf-error">{error.message || "No se pudieron cargar comidas."}</div> : null}

      {!loading && !error && !selectedGroup ? (
        <div className="nf-rangeGrid">
          {groupCards.map((group) => {
            const Icon = group.icon;
            return (
              <article className="nf-card nf-rangeCard" key={group.id} onClick={() => setSelectedGroup(group.id)}>
                <div className="nf-cardTop">
                  <span className="nf-pill good">{group.count} receta(s)</span>
                  <span className="nf-arrowBubble">
                    <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </div>
                <div className="nf-proteinIcon" aria-hidden="true">
                  <Icon size={28} strokeWidth={2.2} />
                </div>
                <div className="nf-proteinBig">{group.label}</div>
                <div className="nf-rangeMeta">
                  <span><Flame size={14} strokeWidth={2.3} /> {formatNumber(group.avg.kcal)} kcal prom.</span>
                  <span><Beef size={14} strokeWidth={2.3} /> {formatNumber(group.avg.protein)} g P</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && selectedGroup ? (
        <>
          <nav className="nf-flow" aria-label="Navegacion de comidas">
            <button type="button" onClick={() => setSelectedGroup("")}>
              <Utensils size={14} strokeWidth={2.4} aria-hidden="true" />
              Comidas
            </button>
            <button type="button" className="active">{selectedLabel}</button>
          </nav>

          {visibleMeals.length ? (
            <div className="nf-cardGrid">
              {visibleMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onView={() => setDetailMealId(meal.id)}
                  onEdit={() => onEdit(meal)}
                  onDuplicate={() => onDuplicate(meal)}
                  onDelete={() => onDelete(meal)}
                  busy={busy}
                />
              ))}
            </div>
          ) : (
            <div className="nf-empty">No hay comidas para este grupo y filtros.</div>
          )}
          <MealDetailModal
            meal={detailMeal}
            onClose={() => setDetailMealId("")}
            onEdit={detailMeal ? () => onEdit(detailMeal) : null}
            onDuplicate={detailMeal ? () => onDuplicate(detailMeal) : null}
            onDelete={detailMeal ? () => onDelete(detailMeal) : null}
            busy={busy}
          />
        </>
      ) : null}
    </div>
  );
}

function MealCard({ meal, onView, onEdit, onDuplicate, onDelete, busy }) {
  const hasMacros = meal.demo || Number(meal.totals?.matched || 0) > 0;
  return (
    <article className="nf-card nf-mealCardCompact">
      <div className="nf-cardTop">
        <div>
          <div className="nf-chipRow" style={{ marginTop: 0, marginBottom: 8 }}>
            {meal.demo ? <span className="nf-pill demo">Ejemplo demo</span> : null}
            <span className="nf-pill">{meal.type}</span>
          </div>
          <h3>{meal.name || meal.nombre}</h3>
        </div>
        <button type="button" className="nf-iconBtn" onClick={onView} aria-label={`Ver ${meal.name || meal.nombre}`}>
          <Eye size={17} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>

      <div className="nf-compactMacro">
        {hasMacros ? (
          <>
            <strong>{formatNumber(meal.totals.kcal)} kcal</strong>
            <span>P {formatNumber(meal.totals.protein)}</span>
            <span>C {formatNumber(meal.totals.carbs)}</span>
            <span>G {formatNumber(meal.totals.fat)}</span>
          </>
        ) : (
          <span>Macros sin calcular</span>
        )}
      </div>

      {!hasMacros ? <p>Modelo basico actual: no pude cruzar estos items con la base para calcular macros.</p> : null}

      <div className="nf-cardActions compact">
        <button type="button" className="nf-btn ghost" onClick={onView}>
          <Eye size={16} strokeWidth={2.3} aria-hidden="true" />
          Detalle
        </button>
        <button type="button" className="nf-btn ghost" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
          {meal.demo ? "Usar demo" : "Editar"}
        </button>
        {!meal.demo ? (
          <button type="button" className="nf-btn ghost" onClick={onDuplicate} disabled={busy === `meal-duplicate-${meal.id}`}>
            <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
            Duplicar
          </button>
        ) : null}
        {!meal.demo ? (
          <button type="button" className="nf-btn ghost" onClick={onDelete} disabled={busy === `meal-delete-${meal.id}`}>
            <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
            Eliminar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MealDetailModal({ meal, onClose, onEdit, onDuplicate, onDelete, busy }) {
  if (!meal) return null;
  const totals = meal.totals || {};

  return (
    <div className="nf-detailBackdrop">
      <aside className="nf-detailSheet">
        <div className="nf-cardTop">
          <div>
            <span className={`nf-pill ${meal.demo ? "demo" : "good"}`}>{meal.demo ? "Comida demo" : "Comida real"}</span>
            <h3>{meal.name || meal.nombre}</h3>
            <p>{meal.descripcion || "Receta reutilizable para construir menus base."}</p>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar detalle">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        <div className="nf-detailHeroLine">{compactMacroLine(totals)}</div>

        <div className="nf-cardActions compact">
          <button type="button" className="nf-btn ghost" onClick={onEdit}>
            <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
            Editar alimentos
          </button>
          {!meal.demo ? (
            <button type="button" className="nf-btn gold" onClick={onDuplicate} disabled={busy === `meal-duplicate-${meal.id}`}>
              <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
              Clonar
            </button>
          ) : null}
          {!meal.demo ? (
            <button type="button" className="nf-btn ghost" onClick={onDelete} disabled={busy === `meal-delete-${meal.id}`}>
              <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
              Eliminar
            </button>
          ) : null}
        </div>

        <div className="nf-mealList">
          <div className="nf-meal">
            <div className="nf-mealHead">
              <strong>Alimentos</strong>
              <span>{(meal.items || []).length}</span>
            </div>
            <ul className="nf-foodList nf-foodListRich">
              {(meal.items || []).map((item, index) => (
                <li key={`${meal.id}-${index}`}>
                  <span>
                    {item.nombreSnapshot || item.alimento || item.nombre || "Alimento"}
                    <small>{item.cantidad || item.qty || "-"} {item.unidad || "g"} - toca editar para usar equivalencias</small>
                  </span>
                  <strong>
                    <Replace size={13} strokeWidth={2.3} aria-hidden="true" />
                    {formatNumber(item.kcal ?? item.calorias, 0)} kcal
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

function FoodMacroChips({ food = {} }) {
  const hasMacros = [food.kcal, food.protein, food.carbs, food.fat].some(
    (value) => value !== undefined && value !== null && value !== ""
  );
  if (!hasMacros) return null;

  return (
    <span className="nf-foodMacros">
      <b>{formatNumber(food.kcal)} kcal</b>
      <span>P {formatNumber(food.protein)}</span>
      <span>C {formatNumber(food.carbs)}</span>
      <span>G {formatNumber(food.fat)}</span>
    </span>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="nf-stat">
      {Icon ? <Icon className="nf-statIcon" size={18} strokeWidth={2.3} aria-hidden="true" /> : null}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="nf-cardGrid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="nf-skeleton" key={index} />
      ))}
    </div>
  );
}

function rangesFromMenus(menus = []) {
  const map = new Map();
  menus.forEach((menu) => {
    const label = menu.range?.label || "Sin rango";
    const current = map.get(label) || {
      label,
      min: menu.range?.min || 0,
      max: menu.range?.max || 0,
      menuCount: 0,
      proteins: [],
      goals: [],
    };
    current.menuCount += 1;
    current.proteins.push(Number(menu.protein || 0));
    current.goals.push(...(menu.goals || []));
    map.set(label, current);
  });

  return [...map.values()]
    .map((range) => {
      const proteins = [...new Set(range.proteins.filter(Boolean))].sort((a, b) => a - b);
      const goals = [...new Set(range.goals.filter(Boolean))].slice(0, 3);
      return {
        ...range,
        proteins,
        proteinMin: proteins[0] || 0,
        proteinMax: proteins[proteins.length - 1] || 0,
        goals: goals.length ? goals : ["mantenimiento"],
      };
    })
    .sort((a, b) => (a.min || 0) - (b.min || 0));
}

function filterLibraryMenus(menus = [], filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  const goal = String(filters.goal || "todos").trim().toLowerCase();
  const meals = Number(filters.meals || 0);

  return menus.filter((menu) => {
    const haystack = `${menu.name} ${menu.description} ${(menu.tags || []).join(" ")} ${(menu.goals || []).join(" ")}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesGoal = goal === "todos" || (menu.goals || []).some((item) => String(item).toLowerCase() === goal);
    const matchesMeals = !meals || Number(menu.mealsCount) === meals;
    return matchesSearch && matchesGoal && matchesMeals;
  });
}

function mealsForGroup(meals = [], groupId = "todos") {
  if (!groupId || groupId === "todos") return meals;
  return meals.filter((meal) => {
    if (meal.grupoComida === groupId) return true;
    if (groupId === "desayuno_merienda") return ["desayuno", "merienda"].includes(meal.tipoComida);
    if (groupId === "almuerzo_cena") return ["almuerzo", "cena"].includes(meal.tipoComida);
    if (groupId === "snack") return meal.tipoComida === "snack";
    return false;
  });
}

function averageTotals(meals = []) {
  if (!meals.length) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const totals = meals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + Number(meal.totals?.kcal || 0),
      protein: acc.protein + Number(meal.totals?.protein || meal.totals?.proteina || 0),
      carbs: acc.carbs + Number(meal.totals?.carbs || 0),
      fat: acc.fat + Number(meal.totals?.fat || meal.totals?.grasas || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    kcal: totals.kcal / meals.length,
    protein: totals.protein / meals.length,
    carbs: totals.carbs / meals.length,
    fat: totals.fat / meals.length,
  };
}

function goalTone(goal = "") {
  const value = String(goal || "").toLowerCase();
  if (value.includes("defin")) return "cut";
  if (value.includes("recomp")) return "recomp";
  if (value.includes("manten")) return "maintain";
  if (value.includes("rend")) return "performance";
  if (value.includes("volumen")) return "bulk";
  return "neutral";
}
