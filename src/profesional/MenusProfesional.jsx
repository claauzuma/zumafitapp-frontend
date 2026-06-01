import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  BadgeInfo,
  BarChart3,
  Beef,
  BookOpen,
  ChefHat,
  ChevronRight,
  Copy,
  Eye,
  Flame,
  Layers,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { MealRecipeEditor, MenuBaseEditor } from "../nutricion/NutritionEditors.jsx";
import { createComida, deleteComida, duplicateComida, updateComida } from "../nutricion/nutricionApi.js";
import { useAlimentos, useComidas, useMenusDemo } from "../nutricion/nutricionQueries.js";
import { formatNumber, macroLine } from "../nutricion/nutricionUtils.js";
import AppToast from "../ui/AppToast.jsx";
import {
  assignMenuToClient,
  createMenuBase,
  createMenuBaseFromDisplay,
  deleteMenuBase,
  duplicateMenuBase,
  updateMenuBase,
} from "../menus/menusApi.js";
import { useMenusBase } from "../menus/menusQueries.js";
import { normalizeDemoMenu } from "../menus/menusUtils.js";
import { useProfessionalClients } from "./profesionalQueries.js";
import { invalidateClientMenus, invalidateComidasLibrary, invalidateMenusLibrary } from "../queryClient.js";
import "../nutricion/nutricion.css";

const GOALS = [
  ["todos", "Todos los objetivos"],
  ["definición", "Definición"],
  ["recomposición", "Recomposición"],
  ["mantenimiento", "Mantenimiento"],
  ["volumen limpio", "Volumen limpio"],
  ["rendimiento", "Rendimiento"],
];

const TAB_MENUS = "menus";
const TAB_COMIDAS = "comidas";

const MEAL_GROUPS = [
  { id: "desayuno_merienda", label: "Desayuno / Merienda", icon: ChefHat },
  { id: "almuerzo_cena", label: "Almuerzo / Cena", icon: Utensils },
  { id: "snack", label: "Snacks", icon: Beef },
  { id: "todos", label: "Todas", icon: Layers },
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
  const [activeTab, setActiveTab] = useState(TAB_MENUS);
  const [filters, setFilters] = useState({ search: "", goal: "todos", meals: 0 });
  const [selectedRange, setSelectedRange] = useState("");
  const [selectedProtein, setSelectedProtein] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [selectedMealGroup, setSelectedMealGroup] = useState("");
  const [menuEditor, setMenuEditor] = useState(null);
  const [mealEditor, setMealEditor] = useState(null);
  const [assignMenu, setAssignMenu] = useState(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);

  const menusQuery = useMenusDemo(filters);
  const realMenusQuery = useMenusBase({ search: filters.search, estado: "activo", includeComidas: true });
  const clientsQuery = useProfessionalClients();
  const foodsQuery = useAlimentos({});
  const foods = foodsQuery.data?.all || [];
  const comidasQuery = useComidas({ search: "" }, foods, { enabled: !foodsQuery.isLoading });
  const meals = comidasQuery.data?.comidas || [];
  const permissions = menuPermissions(me);

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
    if (!permissions.canCreateMenu && menu.demo) {
      setToast({ type: "warning", message: "Tu plan no permite crear plantillas propias." });
      return;
    }
    if (!permissions.canDuplicateMenu && !menu.demo) {
      setToast({ type: "warning", message: "Tu plan no permite duplicar plantillas." });
      return;
    }
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

  async function saveMenuDraft(payload) {
    try {
      const current = menuEditor?.menu;
      const editingOwn = current?.id && !current?.demo && canEditOwnMenu(current, me);
      setBusy("menu-save");
      const saved = editingOwn
        ? await updateMenuBase(current.baseId || current.id, payload)
        : await createMenuBase(payload);
      await invalidateMenusLibrary(saved?.id || current?.id);
      setMenuEditor(null);
      setToast({ type: "success", message: editingOwn ? "Plantilla actualizada." : "Plantilla creada." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo guardar la plantilla." });
    } finally {
      setBusy("");
    }
  }

  async function removeMenu(menu) {
    if (!canEditOwnMenu(menu, me)) return;
    try {
      setBusy(`menu-delete-${menu.id}`);
      await deleteMenuBase(menu.baseId || menu.id);
      await invalidateMenusLibrary(menu.id);
      setToast({ type: "success", message: "Plantilla eliminada." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo eliminar la plantilla." });
    } finally {
      setBusy("");
    }
  }

  async function saveMealRecipe(payload) {
    try {
      const current = mealEditor?.meal;
      const editingOwn = current?.id && !current?.demo && canEditOwnMeal(current, me);
      setBusy("meal-save");
      const saved = editingOwn ? await updateComida(current.id, payload) : await createComida(payload);
      await invalidateComidasLibrary(saved?.id || current?.id);
      setMealEditor(null);
      setToast({ type: "success", message: editingOwn ? "Comida actualizada." : "Comida creada." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo guardar la comida." });
    } finally {
      setBusy("");
    }
  }

  async function duplicateMealRecipe(meal) {
    if (!meal?.id || meal.demo || !permissions.canDuplicateMenu) return;
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
    if (!canEditOwnMeal(meal, me)) return;
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

        <div className="nf-tabs" role="tablist" aria-label="Nutricion profesional">
          <button
            type="button"
            className={`nf-tab ${activeTab === TAB_MENUS ? "active" : ""}`}
            onClick={() => setActiveTab(TAB_MENUS)}
            role="tab"
            aria-selected={activeTab === TAB_MENUS}
          >
            <BookOpen size={16} strokeWidth={2.3} aria-hidden="true" />
            Menus
          </button>
          <button
            type="button"
            className={`nf-tab ${activeTab === TAB_COMIDAS ? "active" : ""}`}
            onClick={() => setActiveTab(TAB_COMIDAS)}
            role="tab"
            aria-selected={activeTab === TAB_COMIDAS}
          >
            <ChefHat size={16} strokeWidth={2.3} aria-hidden="true" />
            Comidas / Recetas
          </button>
        </div>

        {activeTab === TAB_MENUS ? (
          <>
            <div className="nf-sectionHead">
              <div>
                <h2>Biblioteca de menus</h2>
                <p>Explora, crea plantillas propias y asigna snapshots editables a tus clientes.</p>
              </div>
              {permissions.canCreateMenu ? (
                <button type="button" className="nf-btn gold" onClick={() => setMenuEditor({ mode: "create", menu: null })}>
                  <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
                  Crear menu
                </button>
              ) : null}
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
                    onEdit={
                      canEditOwnMenu(menu, me)
                        ? () => setMenuEditor({ mode: "edit", menu })
                        : permissions.canCreateMenu
                          ? () => setMenuEditor({ mode: "create", menu })
                          : null
                    }
                    onDelete={canEditOwnMenu(menu, me) ? () => removeMenu(menu) : null}
                    onAssign={() => openAssign(menu)}
                    busy={busy === `save-${menu.id}`}
                  />
                ))}
              </div>
              <MenuDetail
                menu={selectedMenu}
                onAssign={selectedMenu ? () => openAssign(selectedMenu) : null}
                onEdit={
                  selectedMenu && canEditOwnMenu(selectedMenu, me)
                    ? () => setMenuEditor({ mode: "edit", menu: selectedMenu })
                    : selectedMenu && permissions.canCreateMenu
                      ? () => setMenuEditor({ mode: "create", menu: selectedMenu })
                      : null
                }
                onDelete={selectedMenu && canEditOwnMenu(selectedMenu, me) ? () => removeMenu(selectedMenu) : null}
              />
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
          </>
        ) : (
          <CoachComidasTab
            meals={meals}
            selectedGroup={selectedMealGroup}
            setSelectedGroup={setSelectedMealGroup}
            loading={foodsQuery.isLoading || comidasQuery.isLoading}
            error={foodsQuery.error || comidasQuery.error}
            permissions={permissions}
            me={me}
            onCreate={() => setMealEditor({ mode: "create", meal: null })}
            onEdit={(meal) => setMealEditor({ mode: canEditOwnMeal(meal, me) ? "edit" : "create", meal })}
            onDuplicate={duplicateMealRecipe}
            onDelete={removeMealRecipe}
            busy={busy}
          />
        )}
      </section>
      {menuEditor ? (
        <MenuBaseEditor
          initialMenu={menuEditor.menu}
          foods={foods}
          foodsLoading={foodsQuery.isLoading}
          mealLibrary={meals}
          onSave={saveMenuDraft}
          onClose={() => setMenuEditor(null)}
          saving={busy === "menu-save"}
          title={menuEditor.mode === "edit" ? "Editar plantilla propia" : "Crear plantilla propia"}
          submitLabel={menuEditor.mode === "edit" ? "Guardar cambios" : "Crear menu"}
          allowSystemVisibility={false}
        />
      ) : null}
      {mealEditor ? (
        <MealRecipeEditor
          initialMeal={mealEditor.meal}
          foods={foods}
          foodsLoading={foodsQuery.isLoading}
          onSave={saveMealRecipe}
          onClose={() => setMealEditor(null)}
          saving={busy === "meal-save"}
          title={mealEditor.mode === "edit" ? "Editar comida propia" : "Crear comida propia"}
          submitLabel={mealEditor.mode === "edit" ? "Guardar cambios" : "Crear comida"}
          allowSystemVisibility={false}
        />
      ) : null}
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function CoachComidasTab({
  meals,
  selectedGroup,
  setSelectedGroup,
  loading,
  error,
  permissions,
  me,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  busy,
}) {
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

  return (
    <div className="nf-tabPanel">
      <div className="nf-sectionHead">
        <div>
          <h2>Comidas / Recetas</h2>
          <p>Crea bloques propios para armar plantillas de menu mas rapido.</p>
        </div>
        {permissions.canCreateMeal ? (
          <button type="button" className="nf-btn gold" onClick={onCreate}>
            <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
            Crear comida
          </button>
        ) : null}
      </div>

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
              {visibleMeals.map((meal) => {
                const own = canEditOwnMeal(meal, me);
                return (
                  <CoachMealCard
                    key={meal.id}
                    meal={meal}
                    own={own}
                    canDuplicate={permissions.canDuplicateMenu}
                    onEdit={() => onEdit(meal)}
                    onDuplicate={() => onDuplicate(meal)}
                    onDelete={() => onDelete(meal)}
                    busy={busy}
                  />
                );
              })}
            </div>
          ) : (
            <div className="nf-empty">No hay comidas para este grupo.</div>
          )}
        </>
      ) : null}
    </div>
  );
}

function CoachMealCard({ meal, own, canDuplicate, onEdit, onDuplicate, onDelete, busy }) {
  return (
    <article className="nf-card">
      <div className="nf-cardTop">
        <span className={`nf-pill ${own ? "good" : "demo"}`}>{own ? "Propia" : "Biblioteca"}</span>
        <span className="nf-pill">{meal.type}</span>
      </div>
      <h3>{meal.name || meal.nombre}</h3>
      <p>{meal.descripcion || "Receta reutilizable para tus menus."}</p>
      <div className="nf-macroGrid">
        <Macro label="Kcal" value={formatNumber(meal.totals?.kcal)} icon={Flame} />
        <Macro label="Prot." value={`${formatNumber(meal.totals?.protein || meal.totals?.proteina)} g`} icon={Beef} />
        <Macro label="Carbs" value={`${formatNumber(meal.totals?.carbs)} g`} />
        <Macro label="Grasas" value={`${formatNumber(meal.totals?.fat || meal.totals?.grasas)} g`} />
      </div>
      <div className="nf-items">
        {(meal.items || []).slice(0, 5).map((item, index) => (
          <span className="nf-itemChip" key={`${meal.id}-${index}`}>
            {item.nombreSnapshot || item.alimento || "Alimento"}
          </span>
        ))}
      </div>
      <div className="nf-cardActions compact">
        {(own || canDuplicate) ? (
          <button type="button" className="nf-btn ghost" onClick={onEdit}>
            <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
            {own ? "Editar" : "Usar como base"}
          </button>
        ) : null}
        {!own && canDuplicate ? (
          <button type="button" className="nf-btn ghost" onClick={onDuplicate} disabled={busy === `meal-duplicate-${meal.id}`}>
            <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
            Duplicar
          </button>
        ) : null}
        {own ? (
          <button type="button" className="nf-btn ghost" onClick={onDelete} disabled={busy === `meal-delete-${meal.id}`}>
            <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
            Eliminar
          </button>
        ) : null}
      </div>
    </article>
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

function MenuCard({ menu, selected, onSelect, onSave, onEdit, onDelete, onAssign, busy }) {
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
        {onEdit ? (
          <button type="button" className="nf-btn ghost" onClick={onEdit}>
            <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
            {menu.demo ? "Usar demo" : "Editar"}
          </button>
        ) : null}
        <button type="button" className="nf-btn ghost" onClick={onSave} disabled={busy}>
          {menu.demo ? "Guardar demo" : "Duplicar"}
        </button>
        {onDelete ? (
          <button type="button" className="nf-btn ghost" onClick={onDelete}>
            <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
            Eliminar
          </button>
        ) : null}
        <button type="button" className="nf-btn gold" onClick={onAssign}>
          Asignar
        </button>
      </div>
    </article>
  );
}

function MenuDetail({ menu, onAssign, onEdit, onDelete }) {
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
          {onEdit ? (
            <button type="button" className="nf-btn ghost" onClick={onEdit}>
              <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
              {menu.demo ? "Usar como base" : "Editar"}
            </button>
          ) : null}
          <button type="button" className="nf-btn gold" onClick={onAssign}>
            Asignar a cliente
          </button>
          {onDelete ? (
            <button type="button" className="nf-btn ghost" onClick={onDelete}>
              <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
              Eliminar
            </button>
          ) : null}
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

function menuPermissions(user) {
  const features = user?.effectiveCapabilities?.features?.menus || {};
  return {
    canCreateMenu: !!(features.ownTemplates || features.manualBuilder),
    canCreateMeal: !!(features.ownTemplates || features.manualBuilder || features.foodLibrarySearch),
    canDuplicateMenu: !!features.duplicatePlans,
    canUseLibrary: !!(features.menuLibrarySearch || features.foodLibrarySearch || features.manualBuilder || features.ownTemplates),
  };
}

function getUserId(user) {
  return String(user?.id || user?._id || "").trim();
}

function canEditOwnMenu(menu, user) {
  if (!menu || menu.demo) return false;
  return String(menu.ownerType || "").toLowerCase() === "coach" && String(menu.ownerId || "") === getUserId(user);
}

function canEditOwnMeal(meal, user) {
  if (!meal || meal.demo) return false;
  return String(meal.ownerType || "").toLowerCase() === "coach" && String(meal.ownerId || meal.userId || "") === getUserId(user);
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
