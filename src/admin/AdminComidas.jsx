import React, { useMemo, useState } from "react";
import {
  BarChart3,
  Beef,
  BookOpen,
  ChefHat,
  Copy,
  Database,
  Eye,
  Flame,
  Layers,
  RefreshCcw,
  Search,
  ShieldCheck,
  Utensils,
} from "lucide-react";

import { duplicateMenuBase } from "../menus/menusApi.js";
import { useMenusBase } from "../menus/menusQueries.js";
import { DEMO_COMIDAS } from "../nutricion/nutricionDemo.js";
import { useAlimentos, useComidas } from "../nutricion/nutricionQueries.js";
import { filterMeals, formatNumber } from "../nutricion/nutricionUtils.js";
import { invalidateMenusLibrary } from "../queryClient.js";
import AppToast from "../ui/AppToast.jsx";
import "../nutricion/nutricion.css";

const TAB_MENUS = "menus";
const TAB_COMIDAS = "comidas";

export default function AdminComidas() {
  const [activeTab, setActiveTab] = useState(TAB_MENUS);
  const [mealFilters, setMealFilters] = useState({ search: "", type: "todos" });
  const [menuFilters, setMenuFilters] = useState({
    search: "",
    rangoKcal: "todos",
    proteina: "",
    objetivo: "todos",
    estado: "todos",
    visibilidad: "todos",
  });
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);

  const foodsQuery = useAlimentos({});
  const foods = foodsQuery.data?.all || [];
  const comidasQuery = useComidas(mealFilters, foods, { enabled: !foodsQuery.isLoading });
  const menusAllQuery = useMenusBase({ includeComidas: true });
  const menusQuery = useMenusBase({ ...menuFilters, includeComidas: true });

  const realMeals = useMemo(() => comidasQuery.data?.comidas || [], [comidasQuery.data?.comidas]);
  const usingDemoMeals = !comidasQuery.isLoading && realMeals.length === 0;
  const displayMeals = usingDemoMeals ? filterMeals(DEMO_COMIDAS, mealFilters) : realMeals;
  const allMeals = useMemo(
    () => (usingDemoMeals ? DEMO_COMIDAS : comidasQuery.data?.all || []),
    [comidasQuery.data?.all, usingDemoMeals]
  );
  const allMenus = useMemo(() => menusAllQuery.data?.menus || [], [menusAllQuery.data?.menus]);
  const visibleMenus = useMemo(() => menusQuery.data?.menus || [], [menusQuery.data?.menus]);

  const selectedMenu = useMemo(() => {
    if (!visibleMenus.length) return null;
    return visibleMenus.find((menu) => menu.id === selectedMenuId) || visibleMenus[0];
  }, [selectedMenuId, visibleMenus]);

  const typeOptions = useMemo(() => {
    const unique = [...new Set(allMeals.map((meal) => meal.type).filter(Boolean))];
    return ["todos", ...unique.sort((a, b) => a.localeCompare(b))];
  }, [allMeals]);

  const menuOptions = useMemo(() => buildMenuFilterOptions(allMenus), [allMenus]);

  const stats = useMemo(() => {
    const mealsWithMacros = allMeals.filter((meal) => meal.demo || meal.totals?.matched > 0).length;
    const activeMenus = allMenus.filter((menu) => String(menu.estado || "").toLowerCase() === "activo").length;
    return {
      menus: allMenus.length,
      activeMenus,
      meals: allMeals.length,
      foods: foods.length,
      mealsWithMacros,
    };
  }, [allMeals, allMenus, foods.length]);

  async function duplicateMenu(menu) {
    if (!menu?.id) return;
    try {
      setBusy(`duplicate-${menu.id}`);
      const duplicated = await duplicateMenuBase(menu.baseId || menu.id, {
        nombre: `${menu.name} - copia admin`,
        visibilidad: menu.visibility || "privada",
      });
      await invalidateMenusLibrary(duplicated?.id || menu.id);
      setSelectedMenuId(duplicated?.id || menu.id);
      setToast({ type: "success", message: "Menu base duplicado." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo duplicar el menu." });
    } finally {
      setBusy("");
    }
  }

  function refreshVisible() {
    if (activeTab === TAB_MENUS) {
      menusQuery.refetch();
      menusAllQuery.refetch();
      return;
    }
    comidasQuery.refetch();
    foodsQuery.refetch();
  }

  const refreshing =
    activeTab === TAB_MENUS
      ? (menusQuery.isFetching || menusAllQuery.isFetching) && !menusQuery.isLoading
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
          <Stat label="Menus base" value={stats.menus} icon={BookOpen} />
          <Stat label="Menus activos" value={stats.activeMenus} icon={Flame} />
          <Stat label={usingDemoMeals ? "Recetas demo" : "Comidas/recetas"} value={stats.meals} icon={ChefHat} />
          <Stat label="Alimentos" value={stats.foods} icon={Database} />
        </div>

        <NutritionTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === TAB_MENUS ? (
          <MenusTab
            filters={menuFilters}
            setFilters={setMenuFilters}
            options={menuOptions}
            menus={visibleMenus}
            selectedMenu={selectedMenu}
            setSelectedMenuId={setSelectedMenuId}
            loading={menusQuery.isLoading || menusAllQuery.isLoading}
            error={menusQuery.error || menusAllQuery.error}
            onDuplicate={duplicateMenu}
            busy={busy}
          />
        ) : (
          <ComidasTab
            filters={mealFilters}
            setFilters={setMealFilters}
            typeOptions={typeOptions}
            meals={displayMeals}
            usingDemo={usingDemoMeals}
            loading={foodsQuery.isLoading || comidasQuery.isLoading}
            error={comidasQuery.error || foodsQuery.error}
            withMacros={stats.mealsWithMacros}
          />
        )}
      </section>
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
  options,
  menus,
  selectedMenu,
  setSelectedMenuId,
  loading,
  error,
  onDuplicate,
  busy,
}) {
  return (
    <div className="nf-tabPanel">
      <div className="nf-sectionHead">
        <div>
          <h2>Menus base</h2>
          <p>Plantillas reutilizables para partir de un menu sin tocar asignaciones de clientes.</p>
        </div>
        <span className="nf-pill good">Conectado a /api/menus</span>
      </div>

      <div className="nf-toolbar nf-menuFilters">
        <label className="nf-searchWrap">
          <Search size={17} strokeWidth={2.2} aria-hidden="true" />
          <input
            className="nf-search"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Buscar menu, objetivo o tag..."
          />
        </label>

        <select
          className="nf-select"
          value={filters.rangoKcal}
          onChange={(event) => setFilters((prev) => ({ ...prev, rangoKcal: event.target.value }))}
          aria-label="Filtrar por rango kcal"
        >
          {options.ranges.map((range) => (
            <option key={range} value={range}>
              {range === "todos" ? "Todos los rangos" : range}
            </option>
          ))}
        </select>

        <select
          className="nf-select"
          value={filters.proteina}
          onChange={(event) => setFilters((prev) => ({ ...prev, proteina: event.target.value }))}
          aria-label="Filtrar por proteina"
        >
          {options.proteins.map((protein) => (
            <option key={protein.value} value={protein.value}>
              {protein.label}
            </option>
          ))}
        </select>

        <select
          className="nf-select"
          value={filters.objetivo}
          onChange={(event) => setFilters((prev) => ({ ...prev, objetivo: event.target.value }))}
          aria-label="Filtrar por objetivo"
        >
          {options.goals.map((goal) => (
            <option key={goal} value={goal}>
              {goal === "todos" ? "Todos los objetivos" : goal}
            </option>
          ))}
        </select>

        <select
          className="nf-select"
          value={filters.estado}
          onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}
          aria-label="Filtrar por estado"
        >
          {options.states.map((state) => (
            <option key={state} value={state}>
              {state === "todos" ? "Todos los estados" : state}
            </option>
          ))}
        </select>

        <select
          className="nf-select"
          value={filters.visibilidad}
          onChange={(event) => setFilters((prev) => ({ ...prev, visibilidad: event.target.value }))}
          aria-label="Filtrar por visibilidad"
        >
          {options.visibility.map((visibility) => (
            <option key={visibility} value={visibility}>
              {visibility === "todos" ? "Toda visibilidad" : visibility}
            </option>
          ))}
        </select>
      </div>

      {loading ? <SkeletonGrid /> : null}
      {error ? <div className="nf-error">{error.message || "No se pudieron cargar menus."}</div> : null}
      {!loading && !error && menus.length === 0 ? (
        <div className="nf-empty">
          No hay menus base reales para estos filtros. Los demos del panel profesional no se guardan solos.
        </div>
      ) : null}

      {!loading && !error && menus.length > 0 ? (
        <div className="nf-menuLayout">
          <div className="nf-cardGrid nf-adminMenuGrid">
            {menus.map((menu) => (
              <MenuCard
                key={menu.id}
                menu={menu}
                selected={selectedMenu?.id === menu.id}
                onSelect={() => setSelectedMenuId(menu.id)}
                onDuplicate={() => onDuplicate(menu)}
                busy={busy === `duplicate-${menu.id}`}
              />
            ))}
          </div>
          <MenuDetail menu={selectedMenu} onDuplicate={selectedMenu ? () => onDuplicate(selectedMenu) : null} busy={busy} />
        </div>
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

function MenuCard({ menu, selected, onSelect, onDuplicate, busy }) {
  return (
    <article className={`nf-card nf-menuCard ${selected ? "selected" : ""}`}>
      <div className="nf-cardTop">
        <div className="nf-chipRow" style={{ marginTop: 0 }}>
          <span className="nf-pill">{menu.visibility || "sin visibilidad"}</span>
          <span className={`nf-pill ${String(menu.estado).toLowerCase() === "activo" ? "good" : ""}`}>
            {menu.estado || "sin estado"}
          </span>
        </div>
        <button type="button" className="nf-iconBtn" onClick={onSelect} aria-label={`Ver ${menu.name}`}>
          <Eye size={17} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>

      <h3>{menu.name}</h3>
      <p>{menu.description || "Plantilla nutricional reutilizable."}</p>

      <div className="nf-macroGrid">
        <Macro label="Kcal" value={formatNumber(menu.kcal)} />
        <Macro label="Prot." value={`${formatNumber(menu.protein)} g`} />
        <Macro label="Carbs" value={`${formatNumber(menu.carbs)} g`} />
        <Macro label="Grasas" value={`${formatNumber(menu.fat)} g`} />
      </div>

      <div className="nf-items">
        <span className="nf-itemChip">{menu.range?.label || "Sin rango"}</span>
        <span className="nf-itemChip">{menu.goals?.[0] || "mantenimiento"}</span>
        <span className="nf-itemChip">{formatNumber(menu.mealsCount)} comidas</span>
        <span className="nf-itemChip">Owner: {menu.ownerType || "admin"}</span>
      </div>

      <div className="nf-cardActions compact">
        <button type="button" className="nf-btn ghost" onClick={onSelect}>
          <Eye size={16} strokeWidth={2.3} aria-hidden="true" />
          Ver detalle
        </button>
        <button type="button" className="nf-btn ghost" onClick={onDuplicate} disabled={busy}>
          <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
          {busy ? "Duplicando..." : "Duplicar"}
        </button>
      </div>
    </article>
  );
}

function MenuDetail({ menu, onDuplicate, busy }) {
  if (!menu) {
    return (
      <aside className="nf-card nf-detail">
        <h3>Detalle</h3>
        <p>Elegi un menu para ver comidas, alimentos, cantidades y macros.</p>
      </aside>
    );
  }

  return (
    <aside className="nf-card nf-detail nf-menuDetail">
      <div className="nf-cardTop">
        <span className="nf-pill">Detalle plantilla</span>
        <Flame size={18} strokeWidth={2.3} aria-hidden="true" />
      </div>
      <h3>{menu.name}</h3>
      <p>
        {formatNumber(menu.kcal)} kcal - P {formatNumber(menu.protein)} - C {formatNumber(menu.carbs)} - G{" "}
        {formatNumber(menu.fat)}
      </p>

      <div className="nf-macroGrid nf-detailMacros">
        <Macro label="Kcal" value={formatNumber(menu.kcal)} icon={Flame} />
        <Macro label="Prot." value={`${formatNumber(menu.protein)} g`} icon={Beef} />
        <Macro label="Carbs" value={`${formatNumber(menu.carbs)} g`} icon={BarChart3} />
        <Macro label="Grasas" value={`${formatNumber(menu.fat)} g`} />
      </div>

      <div className="nf-items">
        <span className="nf-itemChip">{menu.range?.label || "Sin rango"}</span>
        <span className="nf-itemChip">{menu.visibility || "sin visibilidad"}</span>
        <span className="nf-itemChip">{menu.ownerType || "admin"}</span>
      </div>

      {onDuplicate ? (
        <div className="nf-cardActions compact">
          <button type="button" className="nf-btn gold" onClick={onDuplicate} disabled={busy === `duplicate-${menu.id}`}>
            <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
            {busy === `duplicate-${menu.id}` ? "Duplicando..." : "Duplicar menu"}
          </button>
        </div>
      ) : null}

      <div className="nf-mealList">
        {(menu.meals || []).length ? (
          menu.meals.map((meal) => (
            <div className="nf-meal" key={meal.id}>
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
                  <li key={food.id}>
                    <span>{food.name}</span>
                    <strong>{food.amount || `${formatNumber(food.cantidad)} ${food.unidad || ""}`}</strong>
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
  );
}

function ComidasTab({ filters, setFilters, typeOptions, meals, usingDemo, loading, error, withMacros }) {
  return (
    <div className="nf-tabPanel">
      <div className="nf-sectionHead">
        <div>
          <h2>Comidas / Recetas</h2>
          <p>Bloques reutilizables: desayunos, almuerzos, meriendas, cenas y snacks.</p>
        </div>
        <span className="nf-pill">{withMacros} con macros</span>
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

        <select
          className="nf-select"
          value={filters.type}
          onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
          aria-label="Filtrar por tipo de comida"
        >
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type === "todos" ? "Todos los tipos" : type}
            </option>
          ))}
        </select>

        <button type="button" className="nf-btn ghost" disabled>
          <Layers size={16} strokeWidth={2.2} aria-hidden="true" />
          Read-only
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
      {!loading && !error && meals.length === 0 ? <div className="nf-empty">No hay comidas para esos filtros.</div> : null}

      {!loading && !error && meals.length > 0 ? (
        <div className="nf-cardGrid">
          {meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MealCard({ meal }) {
  const hasMacros = meal.demo || Number(meal.totals?.matched || 0) > 0;
  return (
    <article className="nf-card">
      <div className="nf-cardTop">
        <div>
          <div className="nf-chipRow" style={{ marginTop: 0, marginBottom: 8 }}>
            {meal.demo ? <span className="nf-pill demo">Ejemplo demo</span> : null}
            <span className="nf-pill">{meal.type}</span>
          </div>
          <h3>{meal.name || meal.nombre}</h3>
        </div>
      </div>

      <div className="nf-macroGrid">
        <Macro label="Kcal" value={hasMacros ? formatNumber(meal.totals.kcal) : "-"} />
        <Macro label="Prot." value={hasMacros ? `${formatNumber(meal.totals.protein)} g` : "-"} />
        <Macro label="Carbs" value={hasMacros ? `${formatNumber(meal.totals.carbs)} g` : "-"} />
        <Macro label="Grasas" value={hasMacros ? `${formatNumber(meal.totals.fat)} g` : "-"} />
      </div>

      <div className="nf-items">
        {(meal.items || []).slice(0, 8).map((item, index) => (
          <span className="nf-itemChip" key={`${meal.id}-${index}`}>
            {item.alimento || item.nombre || "Alimento"} - {item.cantidad || item.qty || "-"}
          </span>
        ))}
      </div>

      {!hasMacros ? <p>Modelo basico actual: no pude cruzar estos items con la base para calcular macros.</p> : null}
    </article>
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

function Macro({ label, value, icon: Icon }) {
  return (
    <div className="nf-macroBox">
      <span>{Icon ? <Icon size={13} strokeWidth={2.2} aria-hidden="true" /> : null}{label}</span>
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

function buildMenuFilterOptions(menus = []) {
  const ranges = uniqueOptions(menus.map((menu) => menu.range?.label));
  const goals = uniqueOptions(menus.flatMap((menu) => menu.goals || []));
  const states = uniqueOptions(menus.map((menu) => menu.estado));
  const visibility = uniqueOptions(menus.map((menu) => menu.visibility));
  const proteins = [
    { value: "", label: "Toda proteina" },
    ...[...new Set(menus.map((menu) => Math.round(Number(menu.protein || 0))).filter(Boolean))]
      .sort((a, b) => a - b)
      .map((protein) => ({ value: String(protein), label: `${protein} g proteina` })),
  ];

  return { ranges, goals, states, visibility, proteins };
}

function uniqueOptions(values = []) {
  const unique = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  return ["todos", ...unique.sort((a, b) => a.localeCompare(b))];
}
