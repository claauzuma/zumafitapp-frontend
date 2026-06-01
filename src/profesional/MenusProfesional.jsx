import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  BadgeInfo,
  BarChart3,
  Beef,
  ChevronRight,
  Eye,
  Flame,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Utensils,
  X,
} from "lucide-react";

import { useMenusDemo } from "../nutricion/nutricionQueries.js";
import { formatNumber, macroLine } from "../nutricion/nutricionUtils.js";
import AppToast from "../ui/AppToast.jsx";
import { createMenuBaseFromDisplay, duplicateMenuBase, assignMenuToClient } from "../menus/menusApi.js";
import { useMenusBase } from "../menus/menusQueries.js";
import { normalizeDemoMenu } from "../menus/menusUtils.js";
import { useProfessionalClients } from "./profesionalQueries.js";
import { invalidateClientMenus, invalidateMenusLibrary } from "../queryClient.js";
import "../nutricion/nutricion.css";

const GOALS = [
  ["todos", "Todos los objetivos"],
  ["definición", "Definición"],
  ["recomposición", "Recomposición"],
  ["mantenimiento", "Mantenimiento"],
  ["volumen limpio", "Volumen limpio"],
  ["rendimiento", "Rendimiento"],
];

export default function MenusProfesional() {
  const { me } = useOutletContext() || {};
  const allowed = canUseMenus(me);

  if (!allowed) {
    return <LockedMenus me={me} />;
  }

  return <MenusWorkspace me={me} />;
}

function MenusWorkspace({ me }) {
  const [filters, setFilters] = useState({ search: "", goal: "todos", meals: 0 });
  const [selectedRange, setSelectedRange] = useState("");
  const [selectedProtein, setSelectedProtein] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [assignMenu, setAssignMenu] = useState(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);

  const menusQuery = useMenusDemo(filters);
  const realMenusQuery = useMenusBase({ search: filters.search, estado: "activo", includeComidas: true });
  const clientsQuery = useProfessionalClients();

  const realMenus = useMemo(() => realMenusQuery.data?.menus || [], [realMenusQuery.data?.menus]);
  const demoMenus = useMemo(
    () => (menusQuery.data?.menus || []).map((menu) => normalizeDemoMenu(menu)),
    [menusQuery.data?.menus]
  );
  const hasRealMenus = realMenus.length > 0;
  const filteredMenus = useMemo(
    () => filterLibraryMenus(hasRealMenus ? realMenus : demoMenus, filters),
    [demoMenus, filters, hasRealMenus, realMenus]
  );
  const ranges = useMemo(() => rangesFromMenus(filteredMenus), [filteredMenus]);
  const loading = menusQuery.isLoading || realMenusQuery.isLoading;
  const refreshing = (menusQuery.isFetching || realMenusQuery.isFetching) && !loading;

  const visibleRanges = useMemo(() => {
    return ranges.filter((range) => range.menuCount > 0);
  }, [ranges]);

  const visibleRangeMenus = useMemo(() => {
    if (!selectedRange) return filteredMenus;
    return filteredMenus.filter((menu) => menu.range.label === selectedRange);
  }, [filteredMenus, selectedRange]);

  const visibleProteinMenus = useMemo(() => {
    if (!selectedRange || !selectedProtein) return [];
    return filteredMenus.filter(
      (menu) => menu.range.label === selectedRange && Number(menu.protein) === Number(selectedProtein)
    );
  }, [filteredMenus, selectedProtein, selectedRange]);

  const proteinsForRange = useMemo(
    () => [...new Set(visibleRangeMenus.map((menu) => menu.protein))].sort((a, b) => a - b),
    [visibleRangeMenus]
  );

  const selectedMenu = useMemo(() => {
    return (
      visibleProteinMenus.find((menu) => menu.id === selectedMenuId) ||
      visibleProteinMenus[0] ||
      visibleRangeMenus.find((menu) => menu.id === selectedMenuId) ||
      null
    );
  }, [selectedMenuId, visibleProteinMenus, visibleRangeMenus]);

  const currentView = selectedProtein ? "menus" : selectedRange ? "proteinas" : "rangos";
  const permissionLabel = permissionSummary(me);

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

  async function refreshMenus() {
    await Promise.all([menusQuery.refetch(), realMenusQuery.refetch()]);
  }

  async function saveTemplate(menu) {
    try {
      setBusy(`save-${menu.id}`);
      if (menu.demo) {
        const created = await createMenuBaseFromDisplay(menu);
        await invalidateMenusLibrary(created?.id);
        setToast({ type: "success", message: "Demo guardado como plantilla privada." });
      } else {
        const duplicated = await duplicateMenuBase(menu.baseId || menu.id, {
          nombre: `${menu.name} - copia`,
          visibilidad: "privada",
        });
        await invalidateMenusLibrary(duplicated?.id);
        setToast({ type: "success", message: "Plantilla duplicada." });
      }
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo guardar la plantilla." });
    } finally {
      setBusy("");
    }
  }

  function openAssign(menu) {
    setAssignMenu(menu);
    setAssignClientId(clientsQuery.data?.clients?.[0]?.id || clientsQuery.data?.clients?.[0]?._id || "");
  }

  async function confirmAssign() {
    if (!assignMenu || !assignClientId) {
      setToast({ type: "warning", message: "Elegí un cliente para asignar el menu." });
      return;
    }

    try {
      setBusy("assign");
      const base = assignMenu.demo ? await createMenuBaseFromDisplay(assignMenu) : assignMenu;
      await assignMenuToClient(assignClientId, {
        menuBaseId: base.baseId || base.id,
        nombre: assignMenu.name,
      });
      await Promise.all([
        invalidateMenusLibrary(base.id),
        invalidateClientMenus(assignClientId),
      ]);
      setToast({ type: "success", message: "Menu asignado al cliente." });
      setAssignMenu(null);
      setAssignClientId("");
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo asignar el menu." });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="nf-page">
      <section className="nf-shell nf-menuShell">
        <header className="nf-hero">
          <div className="nf-heroCopy">
            <div className="nf-kicker nf-kickerGlow">
              <Sparkles size={15} strokeWidth={2.3} aria-hidden="true" />
              Demo profesional
            </div>
            <div className="nf-titleRow">
              <Utensils size={28} strokeWidth={2.3} aria-hidden="true" />
              <h1 className="nf-title">Menús</h1>
            </div>
            <p className="nf-sub">
              Biblioteca visual por rangos de kcal y proteina. Podes guardar plantillas y asignarlas como snapshot editable.
            </p>
          </div>

          <div className="nf-actions">
            <button
              type="button"
              className="nf-iconBtn"
              onClick={refreshMenus}
              disabled={menusQuery.isFetching || realMenusQuery.isFetching}
              title={refreshing ? "Actualizando" : "Actualizar"}
              aria-label="Actualizar menús"
            >
              <RefreshCcw className={refreshing ? "refreshing" : ""} size={18} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="nf-summary">
          <Stat label={hasRealMenus ? "Plantillas" : "Menus demo"} value={filteredMenus.length} icon={Utensils} />
          <Stat label="Rangos" value={ranges.length} icon={Flame} />
          <Stat label="Proteinas" value={proteinSummary(filteredMenus)} icon={Beef} />
          <Stat label="Permiso" value={permissionLabel} icon={Sparkles} />
        </div>

        <div className="nf-toolbar">
          <label className="nf-searchWrap">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <input
              className="nf-search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Buscar objetivo, tag o menú..."
            />
          </label>
          <select
            className="nf-select"
            value={filters.goal}
            onChange={(event) => setFilters((prev) => ({ ...prev, goal: event.target.value }))}
          >
            {GOALS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="nf-select"
            value={filters.meals}
            onChange={(event) => setFilters((prev) => ({ ...prev, meals: Number(event.target.value) }))}
          >
            <option value={0}>Todas las comidas</option>
            <option value={4}>4 comidas</option>
          </select>
        </div>

        <div className="nf-demoNotice nf-infoBanner">
          <BadgeInfo size={18} strokeWidth={2.3} aria-hidden="true" />
          <div>
            <strong>{hasRealMenus ? "Plantillas reales" : "Biblioteca demo"}</strong>
            <span>{hasRealMenus ? "Mostrando plantillas reales guardadas." : "Sin plantillas reales todavia: estas tarjetas demo se pueden guardar y asignar."}</span>
          </div>
        </div>

        <nav className="nf-flow" aria-label="Navegación de menús">
          <button type="button" className={!selectedRange ? "active" : ""} onClick={() => resetFlow("root")}>
            <Utensils size={14} strokeWidth={2.4} aria-hidden="true" />
            Menús
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
              {selectedProtein} g proteína
            </button>
          ) : null}
        </nav>

        {loading ? <SkeletonGrid /> : null}
        {menusQuery.error || realMenusQuery.error ? (
          <div className="nf-error">{realMenusQuery.error?.message || menusQuery.error?.message || "No se pudieron cargar menus."}</div>
        ) : null}

        {!loading && !menusQuery.error && !realMenusQuery.error && currentView === "rangos" ? (
          visibleRanges.length ? (
            <div className="nf-rangeGrid">
              {visibleRanges.map((range) => (
                <RangeCard key={range.label} range={range} onSelect={() => chooseRange(range)} />
              ))}
            </div>
          ) : (
            <div className="nf-empty">No hay rangos para esos filtros.</div>
          )
        ) : null}

        {!loading && !menusQuery.error && !realMenusQuery.error && currentView === "proteinas" ? (
          proteinsForRange.length ? (
            <div className="nf-rangeGrid">
              {proteinsForRange.map((protein) => (
                <ProteinCard
                  key={protein}
                  protein={protein}
                  menus={visibleRangeMenus.filter((menu) => Number(menu.protein) === Number(protein))}
                  onSelect={() => chooseProtein(protein)}
                />
              ))}
            </div>
          ) : (
            <div className="nf-empty">No hay distribuciones de proteína para esos filtros.</div>
          )
        ) : null}

        {!loading && !menusQuery.error && !realMenusQuery.error && currentView === "menus" ? (
          visibleProteinMenus.length ? (
            <div className="nf-menuLayout">
              <div className="nf-cardGrid">
                {visibleProteinMenus.map((menu) => (
                  <MenuCard
                    key={menu.id}
                    menu={menu}
                    selected={selectedMenu?.id === menu.id}
                    onSelect={() => setSelectedMenuId(menu.id)}
                    onSave={() => saveTemplate(menu)}
                    onAssign={() => openAssign(menu)}
                    busy={busy === `save-${menu.id}`}
                  />
                ))}
              </div>
              <MenuDetail menu={selectedMenu} onAssign={selectedMenu ? () => openAssign(selectedMenu) : null} />
            </div>
          ) : (
            <div className="nf-empty">No hay menus para esa proteina y esos filtros.</div>
          )
        ) : null}
        {assignMenu ? (
          <AssignModal
            menu={assignMenu}
            clients={clientsQuery.data?.clients || []}
            clientId={assignClientId}
            onClientChange={setAssignClientId}
            onClose={() => setAssignMenu(null)}
            onConfirm={confirmAssign}
            saving={busy === "assign"}
          />
        ) : null}
      </section>
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function LockedMenus({ me }) {
  const specialties = me?.coachProfile?.specialties || {};
  const features = me?.effectiveCapabilities?.features?.menus || {};
  const reason = !specialties.nutrition
    ? "Este módulo requiere especialidad de nutrición."
    : !Object.values(features || {}).some(Boolean)
      ? "Tu plan efectivo no tiene menús habilitados."
      : "No tenés acceso a menús en este momento.";

  return (
    <div className="nf-page">
      <section className="nf-shell">
        <div className="nf-kicker">
          <ShieldAlert size={15} strokeWidth={2.3} aria-hidden="true" />
          Acceso bloqueado
        </div>
        <div className="nf-titleRow">
          <Utensils size={28} strokeWidth={2.3} aria-hidden="true" />
          <h1 className="nf-title">Menús no disponible</h1>
        </div>
        <p className="nf-sub">{reason}</p>
      </section>
    </div>
  );
}

function RangeCard({ range, onSelect }) {
  const tone = goalTone(range.goals?.[0]);
  return (
    <article className={`nf-card nf-rangeCard nf-tone-${tone}`} onClick={onSelect}>
      <div className="nf-cardTop">
        <span className="nf-pill demo">Demo</span>
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
        <span><Utensils size={14} strokeWidth={2.3} /> {range.menuCount} menús</span>
        <span><Beef size={14} strokeWidth={2.3} /> {range.proteinMin}-{range.proteinMax} g</span>
      </div>
      <div className="nf-chipRow nf-goalChips">
        {range.goals.map((goal) => (
          <span className={`nf-pill nf-goal-${goalTone(goal)}`} key={goal}>
            <Target size={12} strokeWidth={2.4} aria-hidden="true" />
            {goal}
          </span>
        ))}
      </div>
    </article>
  );
}

function ProteinCard({ protein, menus, onSelect }) {
  const avgKcal = menus.length ? menus.reduce((acc, menu) => acc + menu.kcal, 0) / menus.length : 0;
  return (
    <article className="nf-card nf-rangeCard nf-proteinCard" onClick={onSelect}>
      <div className="nf-cardTop">
        <span className="nf-pill demo">Distribución demo</span>
        <span className="nf-arrowBubble">
          <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
      </div>
      <div className="nf-proteinIcon" aria-hidden="true">
        <Beef size={28} strokeWidth={2.2} />
      </div>
      <div className="nf-proteinBig">{protein} g proteína</div>
      <div className="nf-rangeMeta">
        <span><Utensils size={14} strokeWidth={2.3} /> {menus.length} menú(s)</span>
        <span><Flame size={14} strokeWidth={2.3} /> {formatNumber(avgKcal)} kcal prom.</span>
      </div>
      <div className="nf-chipRow">
        <span className="nf-pill good">4 comidas</span>
        <span className="nf-pill">macros listos</span>
      </div>
    </article>
  );
}

function MenuCard({ menu, selected, onSelect, onSave, onAssign, busy }) {
  return (
    <article className={`nf-card nf-menuCard ${selected ? "selected" : ""}`}>
      <div className="nf-cardTop">
        <span className="nf-pill demo">{menu.demo ? "Ejemplo demo" : "Plantilla real"}</span>
        <button type="button" className="nf-iconBtn" onClick={onSelect} aria-label={`Ver ${menu.name}`}>
          <Eye size={17} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>
      <h3>{menu.name}</h3>
      <p>{menu.description}</p>
      <div className="nf-macroGrid">
        <Macro label="Kcal" value={formatNumber(menu.kcal)} icon={Flame} />
        <Macro label="Prot." value={`${formatNumber(menu.protein)} g`} icon={Beef} />
        <Macro label="Carbs" value={`${formatNumber(menu.carbs)} g`} />
        <Macro label="Grasas" value={`${formatNumber(menu.fat)} g`} />
      </div>
      <div className="nf-chipRow">
        {(menu.tags || []).map((tag) => (
          <span className="nf-pill" key={tag}>{tag}</span>
        ))}
      </div>
      <div className="nf-cardActions">
        <button type="button" className="nf-btn ghost" onClick={onSave} disabled={busy}>
          {menu.demo ? "Guardar demo" : "Duplicar"}
        </button>
        <button type="button" className="nf-btn gold" onClick={onAssign}>
          Asignar
        </button>
      </div>
    </article>
  );
}

function MenuDetail({ menu, onAssign }) {
  if (!menu) {
    return (
      <aside className="nf-card nf-detail">
        <h3>Detalle</h3>
        <p>Elegí un menú para ver comidas, cantidades y macros.</p>
      </aside>
    );
  }

  return (
    <aside className="nf-card nf-detail nf-menuDetail">
      <div className="nf-cardTop">
        <span className="nf-pill demo">{menu.demo ? "Detalle demo" : "Detalle plantilla"}</span>
        <Flame size={18} strokeWidth={2.3} aria-hidden="true" />
      </div>
      <h3>{menu.name}</h3>
      <p>{formatNumber(menu.kcal)} kcal · {macroLine(menu)}</p>
      {onAssign ? (
        <div className="nf-cardActions compact">
          <button type="button" className="nf-btn gold" onClick={onAssign}>
            Asignar a cliente
          </button>
        </div>
      ) : null}
      <div className="nf-macroGrid nf-detailMacros">
        <Macro label="Kcal" value={formatNumber(menu.kcal)} icon={Flame} />
        <Macro label="Prot." value={`${formatNumber(menu.protein)} g`} icon={Beef} />
        <Macro label="Carbs" value={`${formatNumber(menu.carbs)} g`} icon={BarChart3} />
        <Macro label="Grasas" value={`${formatNumber(menu.fat)} g`} />
      </div>
      <div className="nf-mealList">
        {menu.meals.map((meal) => (
          <section className="nf-meal" key={meal.name}>
            <div className="nf-mealHead">
              <strong>{meal.name}</strong>
              <span>{formatNumber(meal.kcal)} kcal</span>
            </div>
            <div className="nf-chipRow">
              <span className="nf-pill">{formatNumber(meal.protein)}P</span>
              <span className="nf-pill">{formatNumber(meal.carbs)}C</span>
              <span className="nf-pill">{formatNumber(meal.fat)}G</span>
            </div>
            <ul className="nf-foodList">
              {meal.foods.map((food) => (
                <li key={`${meal.name}-${food.name}`}>
                  <span>{food.name}</span>
                  <strong>{food.amount}</strong>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="nf-stat">
      {Icon ? (
        <span className="nf-statIcon">
          <Icon size={16} strokeWidth={2.3} aria-hidden="true" />
        </span>
      ) : null}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Macro({ label, value, icon: Icon }) {
  return (
    <div className="nf-macroBox">
      <span>
        {Icon ? <Icon size={12} strokeWidth={2.3} aria-hidden="true" /> : null}
        {label}
      </span>
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

function AssignModal({ menu, clients, clientId, onClientChange, onClose, onConfirm, saving }) {
  return (
    <div className="nf-modalBackdrop">
      <div className="nf-modal">
        <div className="nf-cardTop">
          <span className="nf-pill demo">Asignar menu</span>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>
        <h3>{menu.name}</h3>
        <p>Se va a crear una copia editable para el cliente. La plantilla original queda intacta.</p>
        <label className="nf-modalField">
          <span>Cliente</span>
          <select value={clientId} onChange={(event) => onClientChange(event.target.value)}>
            <option value="">Elegir cliente</option>
            {clients.map((client) => {
              const id = client.id || client._id;
              const name = `${client.profile?.nombre || ""} ${client.profile?.apellido || ""}`.trim() || client.email || id;
              return (
                <option value={id} key={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </label>
        <div className="nf-cardActions">
          <button type="button" className="nf-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="nf-btn gold" onClick={onConfirm} disabled={saving || !clientId}>
            {saving ? "Asignando..." : "Asignar"}
          </button>
        </div>
      </div>
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

function proteinSummary(menus = []) {
  const proteins = [...new Set(menus.map((menu) => Number(menu.protein || 0)).filter(Boolean))].sort((a, b) => a - b);
  if (!proteins.length) return "-";
  if (proteins.length === 1) return `${proteins[0]} g`;
  return `${proteins[0]} / ${proteins[proteins.length - 1]} g`;
}

function canUseMenus(user) {
  const specialties = user?.coachProfile?.specialties || {};
  const features = user?.effectiveCapabilities?.features || {};
  if (!specialties.nutrition) return false;
  if (!user?.effectiveCapabilities) return true;
  if (user?.effectiveCapabilities?.isTrialExpired) return false;
  return Object.values(features?.menus || {}).some(Boolean);
}

function permissionSummary(user) {
  const features = user?.effectiveCapabilities?.features?.menus || {};
  if (features.automaticGenerator) return "Automático";
  if (features.semiAutomaticBuilder) return "Semiauto";
  if (features.manualBuilder) return "Manual";
  return "Demo";
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
