import React, { useEffect, useMemo, useState } from "react";
import { Apple, Database, Filter, RefreshCcw, Search } from "lucide-react";

import { useAlimentos } from "../nutricion/nutricionQueries.js";
import { formatNumber } from "../nutricion/nutricionUtils.js";
import "../nutricion/nutricion.css";

export default function AdminAlimentos() {
  const [filters, setFilters] = useState({ search: "", category: "todos" });
  const debouncedFilters = useDebouncedValue(filters, 320);
  const alimentosQuery = useAlimentos(debouncedFilters);
  const foods = useMemo(() => alimentosQuery.data?.alimentos || [], [alimentosQuery.data?.alimentos]);
  const allFoods = useMemo(() => alimentosQuery.data?.all || [], [alimentosQuery.data?.all]);
  const loading = alimentosQuery.isLoading;
  const refreshing = alimentosQuery.isFetching && !loading;

  const categories = useMemo(() => {
    const unique = [...new Set(allFoods.map((food) => food.macroGroup).filter(Boolean))];
    return ["todos", ...unique.sort((a, b) => a.localeCompare(b))];
  }, [allFoods]);

  const stats = useMemo(() => {
    const totalProtein = allFoods.reduce((acc, food) => acc + Number(food.protein || 0), 0);
    const avgProtein = allFoods.length ? totalProtein / allFoods.length : 0;
    return {
      total: allFoods.length,
      visible: foods.length,
      categories: Math.max(0, categories.length - 1),
      avgProtein,
    };
  }, [allFoods, categories.length, foods.length]);

  return (
    <div className="nf-page">
      <section className="nf-shell">
        <header className="nf-hero">
          <div className="nf-heroCopy">
            <div className="nf-kicker">
              <Database size={15} strokeWidth={2.3} aria-hidden="true" />
              Base real
            </div>
            <div className="nf-titleRow">
              <Apple size={28} strokeWidth={2.3} aria-hidden="true" />
              <h1 className="nf-title">Alimentos</h1>
            </div>
            <p className="nf-sub">
              Exploración de la base maestra conectada a fooddatabase2 con macros, unidad y categoría inferida.
            </p>
          </div>

          <div className="nf-actions">
            <button
              type="button"
              className="nf-iconBtn"
              onClick={() => alimentosQuery.refetch()}
              disabled={alimentosQuery.isFetching}
              title={refreshing ? "Actualizando" : "Actualizar"}
              aria-label="Actualizar alimentos"
            >
              <RefreshCcw className={refreshing ? "refreshing" : ""} size={18} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="nf-summary">
          <Stat label="Alimentos" value={stats.total} />
          <Stat label="Visibles" value={stats.visible} />
          <Stat label="Categorías" value={stats.categories} />
          <Stat label="Prom. proteína" value={`${formatNumber(stats.avgProtein, 1)} g`} />
        </div>

        <div className="nf-toolbar">
          <label className="nf-searchWrap">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <input
              className="nf-search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Buscar alimento o categoría..."
            />
          </label>

          <select
            className="nf-select"
            value={filters.category}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            aria-label="Filtrar por categoría"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "todos" ? "Todas las categorías" : category}
              </option>
            ))}
          </select>

          <button type="button" className="nf-btn ghost" disabled>
            <Filter size={16} strokeWidth={2.2} aria-hidden="true" />
            Lectura
          </button>
        </div>

        {loading ? <SkeletonGrid /> : null}
        {alimentosQuery.error ? <div className="nf-error">{alimentosQuery.error.message || "No se pudieron cargar alimentos."}</div> : null}
        {!loading && !alimentosQuery.error && foods.length === 0 ? (
          <div className="nf-empty">No hay alimentos para esos filtros.</div>
        ) : null}

        {!loading && !alimentosQuery.error && foods.length > 0 ? (
          <>
            <div className="nf-table nf-foodDesktop">
              <div className="nf-tableHead">
                <span>Alimento</span>
                <span>Categoría</span>
                <span>Cantidad</span>
                <span>Kcal</span>
                <span>Proteína</span>
                <span>Carbs</span>
                <span>Grasas</span>
              </div>
              {foods.slice(0, 160).map((food) => (
                <FoodRow key={food.id} food={food} />
              ))}
            </div>

            <div className="nf-cardGrid nf-mobileCards">
              {foods.slice(0, 80).map((food) => (
                <FoodCard key={food.id} food={food} />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function useDebouncedValue(value, delay = 320) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

function Stat({ label, value }) {
  return (
    <div className="nf-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FoodRow({ food }) {
  return (
    <div className="nf-foodRow">
      <div className="nf-nameCell">
        <strong>{food.name}</strong>
        <small>{food.source || "Sin fuente"}</small>
      </div>
      <span className="nf-pill">{food.macroGroup}</span>
      <QuantityRule food={food} />
      <span className="nf-macro">{formatNumber(food.kcal, 2)}</span>
      <span className="nf-macro">{formatNumber(food.protein, 2)} g</span>
      <span className="nf-macro">{formatNumber(food.carbs, 2)} g</span>
      <span className="nf-macro">{formatNumber(food.fat, 2)} g</span>
    </div>
  );
}

function FoodCard({ food }) {
  return (
    <article className="nf-card">
      <div className="nf-cardTop">
        <h3>{food.name}</h3>
        <span className="nf-pill">{food.macroGroup}</span>
      </div>
      <p>{food.source || "Alimento de la base maestra"} · <QuantityRuleText food={food} /></p>
      <div className="nf-macroGrid">
        <Macro label="Kcal" value={formatNumber(food.kcal, 2)} />
        <Macro label="Prot." value={`${formatNumber(food.protein, 2)} g`} />
        <Macro label="Carbs" value={`${formatNumber(food.carbs, 2)} g`} />
        <Macro label="Grasas" value={`${formatNumber(food.fat, 2)} g`} />
      </div>
    </article>
  );
}

function Macro({ label, value }) {
  return (
    <div className="nf-macroBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuantityRule({ food }) {
  return (
    <span className="nf-foodQuantity">
      <strong>{food.unit}</strong>
      <small><QuantityRuleText food={food} compact /></small>
    </span>
  );
}

function QuantityRuleText({ food, compact = false }) {
  const suggested = Number(food.porcionSugerida);
  const min = Number(food.porcionMin);
  const max = Number(food.porcionMax);
  const step = Number(food.multiplo);
  const parts = [];
  if (Number.isFinite(suggested) && suggested > 0) parts.push(`sugerida ${formatNumber(suggested, 1)}`);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    parts.push(`${compact ? "rango" : "rango de cálculo"} ${formatNumber(min, 1)}–${formatNumber(max, 1)}`);
  }
  if (Number.isFinite(step) && step > 0) parts.push(`paso ${formatNumber(step, 1)}`);
  if (compact) return parts.length ? parts.join(" · ") : "sin límites explícitos";
  return `${food.unit}${parts.length ? ` · ${parts.join(" · ")}` : " · sin límites explícitos"}`;
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
