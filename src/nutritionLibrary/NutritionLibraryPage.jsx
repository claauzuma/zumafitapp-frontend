import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Database,
  Loader2,
  Search,
  Star,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuthMe } from "../authQueries.js";
import { addSavedMealToTracking } from "../savedMeals/savedMealsApi.js";
import { getProfessionalClients } from "../profesional/profesionalApi.js";
import { formatNumber } from "../nutricion/nutricionUtils.js";
import { RouteChunkErrorBoundary } from "../routes/RouteLoading.jsx";
import AppToast from "../ui/AppToast.jsx";
import ClientNutritionHome from "../clientMenus/ClientNutritionHome.jsx";
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

const ClientMenusPanel = lazy(() => import("../clientMenus/ClientMenusPanel.jsx"));

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
  const legacyCreateRedirect = !professionalMode && searchParams.get("tab") === "mineMenus" && searchParams.get("create") === "1";
  const authQuery = useAuthMe({ initialFromCache: true, enabled: !legacyCreateRedirect });
  const user = useMemo(() => authQuery.data || {}, [authQuery.data]);
  const tabs = useMemo(() => defaultTabs(professionalMode ? "professional" : "client", user), [professionalMode, user]);
  const [activeTabId, setActiveTabId] = useState("mineMeals");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [trackingDate, setTrackingDate] = useState(todayLocalString());
  const [meals, setMeals] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [assignItem, setAssignItem] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [editMenuRequest, setEditMenuRequest] = useState(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0] || TABS.client[0];
  const clientOwnMenusTab = !professionalMode && activeTab.id === "mineMenus";

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id || "mineMeals");
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (professionalMode) return;
    if (legacyCreateRedirect) return;
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "mineMenus") setActiveTabId("mineMenus");
  }, [legacyCreateRedirect, professionalMode, searchParams]);

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
    if (clientOwnMenusTab) {
      setMeals([]);
      setMenus([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = {
          scope: activeTab.scope,
          search,
          limit: 80,
        };
        const [mealsData, menusData] = await Promise.all([
          activeTab.kinds.includes("meals")
            ? listLibraryMeals({ ...params, tipoComida: type })
            : Promise.resolve({ comidas: [] }),
          activeTab.kinds.includes("menus")
            ? listLibraryMenus({ ...params, includeComidas: true })
            : Promise.resolve({ menus: [] }),
        ]);
        if (!active) return;
        setMeals(mealsData?.comidas || []);
        setMenus(menusData?.menus || []);
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
  }, [activeTab.scope, activeTab.kinds, search, type, clientOwnMenusTab, legacyCreateRedirect]);

  async function refreshCurrent() {
    setLoading(true);
    setError("");
    try {
      const params = { scope: activeTab.scope, search, limit: 80 };
      const [mealsData, menusData] = await Promise.all([
        activeTab.kinds.includes("meals") ? listLibraryMeals({ ...params, tipoComida: type }) : Promise.resolve({ comidas: [] }),
        activeTab.kinds.includes("menus") ? listLibraryMenus({ ...params, includeComidas: true }) : Promise.resolve({ menus: [] }),
      ]);
      setMeals(mealsData?.comidas || []);
      setMenus(menusData?.menus || []);
    } catch (err) {
      setError(err?.message || "No se pudo cargar la biblioteca nutricional.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(item) {
    if (!itemId(item) || saving) return;
    setSaving(true);
    try {
      if (item.kind === "menu") await copyLibraryMenu(itemId(item));
      else await copyLibraryMeal(itemId(item));
      setToast({ type: "success", message: item.kind === "menu" ? "Menu guardado en Mis menus." : "Comida guardada en Mis comidas." });
      await refreshCurrent();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo guardar la copia." });
    } finally {
      setSaving(false);
    }
  }

  async function handleFavorite(item) {
    if (!itemId(item) || saving) return;
    const next = !(item.favorita || item.favorito);
    setSaving(true);
    try {
      if (item.kind === "menu") await setLibraryMenuFavorite(itemId(item), next);
      else await setLibraryMealFavorite(itemId(item), next);
      await refreshCurrent();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo actualizar favorito." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddToTracking(item) {
    if (!itemId(item) || saving || item.kind !== "comida") return;
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
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!assignItem || !selectedClientIds.length || saving) return;
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
      setSaving(false);
    }
  }

  const totalItems = meals.length + menus.length;

  function openMyMenusTab() {
    setActiveTabId("mineMenus");
  }

  function openCreateMenu() {
    navigate("/app/menu/nuevo", { state: { from: "/app/nutricion" } });
  }

  function openEditMenu(menuId) {
    if (!menuId) {
      setActiveTabId("mineMenus");
      return;
    }
    setActiveTabId("mineMenus");
    setEditMenuRequest({ id: String(menuId), token: Date.now() });
  }

  function openLibraryTab() {
    setActiveTabId("admin");
  }

  if (legacyCreateRedirect) {
    return <Navigate to="/app/menu/nuevo" replace state={{ from: "/app/nutricion" }} />;
  }

  return (
    <div className="nl-page">
      <section className="nl-shell">
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
          <div className="nl-heroMetric">
            <strong>{totalItems}</strong>
            <span>items visibles</span>
          </div>
        </header>

        {!professionalMode ? (
          <ClientNutritionHome
            user={user}
            onToast={setToast}
            onCreateMenu={openCreateMenu}
            onOpenMyMenus={openMyMenusTab}
            onOpenLibrary={openLibraryTab}
            onEditMenu={openEditMenu}
          />
        ) : null}

        <div className="nl-tabs" role="tablist" aria-label="Biblioteca nutricional">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab.id === tab.id ? "active" : ""}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!clientOwnMenusTab ? (
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
          </section>
        ) : null}

        {clientOwnMenusTab ? (
          <RouteChunkErrorBoundary>
            <Suspense fallback={<div className="nl-state"><Loader2 className="nl-spin" size={18} /> Cargando constructor de menus...</div>}>
              <ClientMenusPanel
                onToast={setToast}
                editMenuRequest={editMenuRequest}
                user={user}
              />
            </Suspense>
          </RouteChunkErrorBoundary>
        ) : null}

        {!clientOwnMenusTab && error ? <div className="nl-state error">{error}</div> : null}
        {!clientOwnMenusTab && loading ? <div className="nl-state"><Loader2 className="nl-spin" size={18} /> Cargando biblioteca...</div> : null}
        {!clientOwnMenusTab && !loading && !error && !totalItems ? <div className="nl-state">No hay contenido para este filtro.</div> : null}

        {!clientOwnMenusTab && !loading && (meals.length || menus.length) ? (
          <section className="nl-grid">
            {meals.map((meal) => (
              <LibraryCard
                key={`meal-${itemId(meal)}`}
                item={meal}
                professionalMode={professionalMode}
                saving={saving}
                onCopy={handleCopy}
                onFavorite={handleFavorite}
                onAddToTracking={handleAddToTracking}
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
                saving={saving}
                onCopy={handleCopy}
                onFavorite={handleFavorite}
                onAddToTracking={handleAddToTracking}
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

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function LibraryCard({ item, professionalMode, saving, onCopy, onFavorite, onAddToTracking, onAssign }) {
  const t = totals(item);
  const isMenu = item.kind === "menu";
  const favorite = !!(item.favorita || item.favorito);
  const permissions = item.permissions || {};
  const foods = foodItems(item);
  const comidas = Array.isArray(item.comidas) ? item.comidas : [];

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
          <button type="button" onClick={() => onCopy(item)} disabled={saving}>
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

function FoodThumb({ food }) {
  const [failed, setFailed] = useState(false);
  const src = foodImage(food);
  if (failed || !src) return <span className="nl-thumbFallback" />;
  return (
    <img
      src={src}
      alt={food.imagenAlt || food.nombre || "Alimento"}
      loading="lazy"
      decoding="async"
      width={34}
      height={34}
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
