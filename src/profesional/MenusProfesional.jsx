import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  Beef,
  BookOpen,
  CalendarDays,
  ChefHat,
  ChevronRight,
  CheckCircle,
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

import { MealRecipeEditor, MenuBaseEditor, MenuCreationFlow } from "../nutricion/NutritionEditors.jsx";
import { createComida, deleteComida, duplicateComida, updateComida } from "../nutricion/nutricionApi.js";
import { useAlimentos, useComidas, useMenusDemo } from "../nutricion/nutricionQueries.js";
import { formatNumber, macroLine } from "../nutricion/nutricionUtils.js";
import { compactMacroLine, findIdenticalMeal, findIdenticalMenu } from "../nutricion/nutritionIdentity.js";
import AppToast from "../ui/AppToast.jsx";
import {
  createMenuBase,
  createMenuBaseFromDisplay,
  deleteMenuBase,
  duplicateMenuBase,
  updateMenuBase,
} from "../menus/menusApi.js";
import { useMenusBase } from "../menus/menusQueries.js";
import { normalizeDemoMenu } from "../menus/menusUtils.js";
import {
  createDailyTargetsDraft,
  NUTRITION_WEEK_DAYS,
  resolveNutritionWeek,
} from "../nutricion/dailyNutritionTargets.js";
import { updateProfessionalClientMenu } from "./profesionalApi.js";
import { useProfessionalClients } from "./profesionalQueries.js";
import {
  invalidateClientMenus,
  invalidateComidasLibrary,
  invalidateMenusLibrary,
  invalidateProfessionalClient,
  queryClient,
  queryKeys,
} from "../queryClient.js";
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
  const [detailMenuId, setDetailMenuId] = useState("");
  const [selectedMealGroup, setSelectedMealGroup] = useState("");
  const [menuEditor, setMenuEditor] = useState(null);
  const [mealEditor, setMealEditor] = useState(null);
  const [assignMenu, setAssignMenu] = useState(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [assignDayKey, setAssignDayKey] = useState("");
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
  const detailMenu = useMemo(
    () => visibleProteinMenus.find((menu) => menu.id === detailMenuId) || null,
    [detailMenuId, visibleProteinMenus]
  );

  const currentView = selectedProtein ? "menus" : selectedRange ? "proteinas" : "rangos";
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
      const duplicated = findIdenticalMenu(realMenus, payload, current?.id || current?.baseId);
      if (duplicated) {
        setToast({
          type: "warning",
          message: `Ya existe una plantilla identica: ${duplicated.name || duplicated.nombre || "sin nombre"}. Cambia algo antes de guardar.`,
        });
        return;
      }

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
      const duplicated = findIdenticalMeal(meals, payload, current?.id);
      if (duplicated) {
        setToast({
          type: "warning",
          message: `Ya existe una comida identica: ${duplicated.name || duplicated.nombre || "sin nombre"}. Cambia algo antes de guardar.`,
        });
        return;
      }

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
    setAssignDayKey("");
  }

  function changeAssignClient(clientId) {
    setAssignClientId(clientId);
    setAssignDayKey("");
  }

  async function confirmAssign() {
    const selectedClient = (clientsQuery.data?.clients || []).find((client) => String(client.id || client._id) === String(assignClientId));
    const dayRow = selectedClient && assignDayKey ? buildAssignDayRows(selectedClient, assignMenu).find((row) => row.day.key === assignDayKey) : null;
    const compatibility = dayRow ? getAssignCompatibility(assignMenu, dayRow.target) : null;

    if (!assignMenu || !assignClientId || !assignDayKey) {
      setToast({ type: "warning", message: "Elegí cliente y día para asignar el menú." });
      return;
    }
    if (!selectedClient || !dayRow?.hasValidTarget || !compatibility?.canAssign) {
      setToast({ type: "warning", message: compatibility?.reason || "El menú no coincide con la meta del día." });
      return;
    }

    try {
      setBusy("assign");
      const base = assignMenu.demo ? await createMenuBaseFromDisplay(assignMenu) : assignMenu;
      const nextAssignments = buildNextWeeklyAssignments(selectedClient, assignDayKey, base);
      const data = await updateProfessionalClientMenu(assignClientId, {
        menu: {
          mode: {
            type: preferredMenuModeForClient(selectedClient, permissions),
            lockedByCoach: selectedClient?.menu?.mode?.lockedByCoach,
          },
          weeklyPlan: {
            assignedMenusByDay: nextAssignments,
          },
          coachNotes: selectedClient?.menu?.coachNotes || "",
        },
      });
      queryClient.setQueryData(queryKeys.professionalClientDetail(assignClientId), data);
      await Promise.all([
        invalidateMenusLibrary(base.id),
        invalidateClientMenus(assignClientId),
        invalidateProfessionalClient(assignClientId, data?.client),
        clientsQuery.refetch(),
      ]);
      setToast({ type: "success", message: dayRow.assignment ? "Menú reemplazado en el día." : "Menú asignado al día." });
      setAssignMenu(null);
      setAssignClientId("");
      setAssignDayKey("");
    } catch (error) {
      setToast({ type: "error", message: error?.message || "No se pudo asignar el menú." });
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

        <div className="nf-toolbar nf-toolbarSlim">
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
            <>
              <div className="nf-cardGrid nf-menuCardsOnly">
                {visibleProteinMenus.map((menu) => (
                  <MenuCard
                    key={menu.id}
                    menu={menu}
                    selected={selectedMenu?.id === menu.id}
                    onView={() => {
                      setSelectedMenuId(menu.id);
                      setDetailMenuId(menu.id);
                    }}
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
              <MenuDetailModal
                menu={detailMenu}
                onClose={() => setDetailMenuId("")}
                onAssign={detailMenu ? () => openAssign(detailMenu) : null}
                onEdit={
                  detailMenu && canEditOwnMenu(detailMenu, me)
                    ? () => setMenuEditor({ mode: "edit", menu: detailMenu })
                    : detailMenu && permissions.canCreateMenu
                      ? () => setMenuEditor({ mode: "create", menu: detailMenu })
                      : null
                }
                onDelete={detailMenu && canEditOwnMenu(detailMenu, me) ? () => removeMenu(detailMenu) : null}
              />
            </>
          ) : (
            <div className="nf-empty">No hay menus para esa proteina y esos filtros.</div>
          )
        ) : null}
        {assignMenu ? (
          <AssignModal
            menu={assignMenu}
            clients={clientsQuery.data?.clients || []}
            clientId={assignClientId}
            dayKey={assignDayKey}
            onClientChange={changeAssignClient}
            onDayChange={setAssignDayKey}
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
        menuEditor.mode === "create" && !menuEditor.menu ? (
          <MenuCreationFlow
            foods={foods}
            foodsLoading={foodsQuery.isLoading}
            mealLibrary={meals}
            onSave={saveMenuDraft}
            onClose={() => setMenuEditor(null)}
            saving={busy === "menu-save"}
            allowSystemVisibility={false}
            canUseSuggestions={permissions.canUseMenuSuggestions}
          />
        ) : (
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
        )
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
                    onView={() => setDetailMealId(meal.id)}
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
          <CoachMealDetailModal
            meal={detailMeal}
            own={detailMeal ? canEditOwnMeal(detailMeal, me) : false}
            canDuplicate={permissions.canDuplicateMenu}
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

function CoachMealCard({ meal, own, canDuplicate, onView, onEdit, onDuplicate, onDelete, busy }) {
  return (
    <article className="nf-card nf-mealCardCompact">
      <div className="nf-cardTop">
        <div className="nf-chipRow" style={{ marginTop: 0 }}>
          <span className={`nf-pill ${own ? "good" : "demo"}`}>{own ? "Propia" : "Biblioteca"}</span>
          <span className="nf-pill">{meal.type}</span>
        </div>
        <button type="button" className="nf-iconBtn" onClick={onView} aria-label={`Ver ${meal.name || meal.nombre}`}>
          <Eye size={17} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>
      <h3>{meal.name || meal.nombre}</h3>
      <div className="nf-compactMacro">
        <strong>{formatNumber(meal.totals?.kcal)} kcal</strong>
        <span>P {formatNumber(meal.totals?.protein || meal.totals?.proteina)}</span>
        <span>C {formatNumber(meal.totals?.carbs)}</span>
        <span>G {formatNumber(meal.totals?.fat || meal.totals?.grasas)}</span>
      </div>
      <div className="nf-cardActions compact">
        <button type="button" className="nf-btn ghost" onClick={onView}>
          <Eye size={16} strokeWidth={2.3} aria-hidden="true" />
          Detalle
        </button>
        {(own || canDuplicate) ? (
          <button type="button" className="nf-btn ghost" onClick={onEdit}>
            <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
            {own ? "Editar" : "Usar como base"}
          </button>
        ) : null}
        {canDuplicate ? (
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

function CoachMealDetailModal({ meal, own, canDuplicate, onClose, onEdit, onDuplicate, onDelete, busy }) {
  if (!meal) return null;
  const totals = meal.totals || {};

  return (
    <div className="nf-detailBackdrop">
      <aside className="nf-detailSheet">
        <div className="nf-cardTop">
          <div>
            <span className={`nf-pill ${own ? "good" : "demo"}`}>{own ? "Comida propia" : "Biblioteca"}</span>
            <h3>{meal.name || meal.nombre}</h3>
            <p>{meal.descripcion || "Receta reutilizable para armar menus mas rapido."}</p>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar detalle">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>
        <div className="nf-detailHeroLine">{compactMacroLine(totals)}</div>
        <div className="nf-cardActions compact">
          {(own || canDuplicate) ? (
            <button type="button" className="nf-btn ghost" onClick={onEdit}>
              <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
              {own ? "Editar alimentos" : "Usar como base"}
            </button>
          ) : null}
          {canDuplicate ? (
            <button type="button" className="nf-btn gold" onClick={onDuplicate} disabled={busy === `meal-duplicate-${meal.id}`}>
              <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
              Clonar
            </button>
          ) : null}
          {own ? (
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
                    <small>{item.cantidad || item.qty || "-"} {item.unidad || "g"} - equivalencias desde editar</small>
                  </span>
                  <strong>{formatNumber(item.kcal ?? item.calorias, 0)} kcal</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
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

function MenuCard({ menu, selected, onView, onSave, onEdit, onDelete, onAssign, busy }) {
  return (
    <article className={`nf-card nf-menuCard ${selected ? "selected" : ""}`}>
      <div className="nf-cardTop">
        <span className="nf-pill demo">{menu.demo ? "Ejemplo demo" : "Plantilla real"}</span>
        <button type="button" className="nf-iconBtn" onClick={onView} aria-label={`Ver ${menu.name}`}>
          <Eye size={17} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>
      <h3>{menu.name}</h3>
      <p>{menu.description}</p>
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

function MenuDetailModal({ menu, onClose, onAssign, onEdit, onDelete }) {
  if (!menu) {
    return null;
  }

  return (
    <div className="nf-detailBackdrop">
    <aside className="nf-detailSheet nf-menuDetail">
      <div className="nf-cardTop">
        <div>
          <span className="nf-pill demo">{menu.demo ? "Detalle demo" : "Detalle plantilla"}</span>
          <h3>{menu.name}</h3>
          <p>{menu.description || `${formatNumber(menu.kcal)} kcal - ${macroLine(menu)}`}</p>
        </div>
        <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar detalle">
          <X size={18} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>
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
      <div className="nf-detailMacroBand">
        <strong>{formatNumber(menu.kcal)} kcal</strong>
        <span>P {formatNumber(menu.protein)} g</span>
        <span>C {formatNumber(menu.carbs)} g</span>
        <span>G {formatNumber(menu.fat)} g</span>
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
                  <FoodMacroChips food={food} />
                </li>
              ))}
            </ul>
          </section>
        ))}
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

function SkeletonGrid() {
  return (
    <div className="nf-cardGrid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="nf-skeleton" key={index} />
      ))}
    </div>
  );
}

function AssignModal({ menu, clients, clientId, dayKey, onClientChange, onDayChange, onClose, onConfirm, saving }) {
  const selectedClient = clients.find((client) => String(client.id || client._id) === String(clientId)) || null;
  const dayRows = useMemo(() => (selectedClient ? buildAssignDayRows(selectedClient, menu) : []), [menu, selectedClient]);
  const selectedRow = dayRows.find((row) => row.day.key === dayKey) || null;
  const compatibility = selectedRow ? getAssignCompatibility(menu, selectedRow.target) : null;
  const canAssign = Boolean(clientId && dayKey && selectedRow?.hasValidTarget && compatibility?.canAssign);
  const actionLabel = selectedRow?.assignment ? "Reemplazar menú del día" : "Asignar menú al día";

  return (
    <div className="nf-modalBackdrop">
      <div className="nf-modal nf-assignModal">
        <div className="nf-cardTop">
          <span className="nf-pill demo">
            <Utensils size={13} strokeWidth={2.4} />
            Asignar menú
          </span>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>
        <h3>{menu.name}</h3>
        <p>Se va a crear una copia editable para el cliente. La plantilla original queda intacta.</p>
        <div className="nf-assignMenuBand">
          <span><Flame size={14} /> {formatNumber(menu.kcal)} kcal</span>
          <span><Beef size={14} /> P {formatNumber(menu.protein)} g</span>
          <span>C {formatNumber(menu.carbs)} g</span>
          <span>G {formatNumber(menu.fat)} g</span>
        </div>
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

        {selectedClient ? (
          <section className="nf-assignSection">
            <div className="nf-assignSectionHead">
              <span><CalendarDays size={14} /> Día de asignación</span>
              <small>Elegí el día según la meta nutricional del cliente.</small>
            </div>
            <div className="nf-assignDayGrid">
              {dayRows.map((row) => {
                const selected = row.day.key === dayKey;
                return (
                  <button
                    key={row.day.key}
                    type="button"
                    className={`nf-assignDayCard ${selected ? "selected" : ""} ${row.assignment ? "hasMenu" : ""}`}
                    onClick={() => onDayChange(row.day.key)}
                  >
                    <div className="nf-assignDayTop">
                      <strong>{row.day.label}</strong>
                      <span className={`nf-assignBadge ${row.target.customized ? "custom" : row.target.adjusted ? "adjusted" : ""}`}>
                        {row.target.statusLabel || "General"}
                      </span>
                    </div>
                    {row.hasValidTarget ? (
                      <>
                        <span className="nf-assignKcal">{formatNumber(row.target.kcal)} kcal</span>
                        <small>P {formatNumber(row.target.p)} / C {formatNumber(row.target.c)} / G {formatNumber(row.target.g)}</small>
                      </>
                    ) : (
                      <small className="warning">Sin macros configurados</small>
                    )}
                    <span className="nf-assignExisting">
                      {row.assignment ? row.assignment.name : "Sin menú"}
                      {row.menuCount ? ` · ${row.menuCount} menú(s)` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {selectedRow ? (
          <section className={`nf-compatCard ${compatibility?.tone || "empty"}`}>
            <div className="nf-compatTitle">
              {compatibility?.canAssign ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <strong>Compatibilidad con el día</strong>
              <span>{compatibility?.label || "Sin evaluar"}</span>
            </div>
            <div className="nf-compatGrid">
              <div>
                <span>Meta del día</span>
                <strong>{formatNumber(selectedRow.target.kcal)} kcal</strong>
                <small>P {formatNumber(selectedRow.target.p)} / C {formatNumber(selectedRow.target.c)} / G {formatNumber(selectedRow.target.g)}</small>
              </div>
              <div>
                <span>Menú</span>
                <strong>{formatNumber(menu.kcal)} kcal</strong>
                <small>P {formatNumber(menu.protein)} / C {formatNumber(menu.carbs)} / G {formatNumber(menu.fat)}</small>
              </div>
              <div>
                <span>Diferencia</span>
                <strong>{formatSignedNumber(compatibility?.kcalDiff, " kcal")}</strong>
                <small>P {formatSignedNumber(compatibility?.proteinDiff, " g")}</small>
              </div>
            </div>
            {selectedRow.assignment ? (
              <div className="nf-assignWarning">
                Este día ya tiene un menú asignado: <strong>{selectedRow.assignment.name}</strong>. Si continuás, se reemplazará.
              </div>
            ) : null}
            {!compatibility?.canAssign ? (
              <div className="nf-assignWarning">{compatibility?.reason || "Este menú no coincide con la meta del día."}</div>
            ) : null}
          </section>
        ) : selectedClient ? (
          <div className="nf-assignHint">Elegí un día para ver la compatibilidad antes de asignar.</div>
        ) : null}

        <div className="nf-cardActions">
          <button type="button" className="nf-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="nf-btn gold" onClick={onConfirm} disabled={saving || !canAssign}>
            {saving ? "Asignando..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildAssignDayRows(client, menu) {
  const nutritionWeek = resolveNutritionWeek(nutritionDraftFromClient(client));
  return NUTRITION_WEEK_DAYS.map((day) => {
    const target = nutritionWeek.targets[day.key];
    const assignment = getWeeklyAssignmentForDay(client, day.key);
    const hasValidTarget = Number(target?.kcal) > 0 && Number(target?.p) > 0;
    const menuCount = (assignment ? 1 : 0) + (assignment?.alternatives?.length || 0);
    return {
      day,
      target,
      assignment,
      hasValidTarget,
      menuCount,
      compatibility: getAssignCompatibility(menu, target),
    };
  });
}

function nutritionDraftFromClient(client = {}) {
  const macros = client?.metasActuales?.macros || {};
  return {
    kcal: client?.metasActuales?.kcal || "",
    p: macros.p ?? macros.proteina ?? macros.protein ?? "",
    c: macros.c ?? macros.carbs ?? macros.carbohidratos ?? "",
    g: macros.g ?? macros.grasas ?? macros.fat ?? "",
    dailyTargets: createDailyTargetsDraft(client),
  };
}

function getAssignCompatibility(menu = {}, target = {}) {
  const targetKcal = Number(target?.kcal || 0);
  const targetProtein = Number(target?.p || 0);
  const menuKcal = Number(menu?.kcal || 0);
  const menuProtein = Number(menu?.protein ?? menu?.proteina ?? 0);

  if (!targetKcal || !targetProtein) {
    return {
      label: "Sin meta",
      tone: "empty",
      canAssign: false,
      kcalDiff: menuKcal,
      proteinDiff: menuProtein,
      reason: "Este cliente no tiene macros configurados para ese día. Configurá nutrición primero.",
    };
  }

  const kcalDiff = menuKcal - targetKcal;
  const proteinDiff = menuProtein - targetProtein;
  const kcalTolerance = targetKcal * 0.10;
  const proteinTolerance = 10;
  const kcalOk = Math.abs(kcalDiff) <= kcalTolerance;
  const proteinOk = Math.abs(proteinDiff) <= proteinTolerance;

  if (kcalOk && proteinOk) {
    return {
      label: "Compatible",
      tone: "good",
      canAssign: true,
      kcalDiff,
      proteinDiff,
      reason: "",
    };
  }

  const close = Math.abs(kcalDiff) <= targetKcal * 0.15 && Math.abs(proteinDiff) <= 15;
  const reasons = [];
  if (!kcalOk) {
    reasons.push(kcalDiff > 0
      ? `Este menú excede la meta del día por +${formatNumber(kcalDiff)} kcal.`
      : `Este menú queda bajo en calorías por ${formatNumber(kcalDiff)} kcal.`);
  }
  if (!proteinOk) {
    reasons.push(proteinDiff > 0
      ? `Este menú supera la proteína objetivo por +${formatNumber(proteinDiff)} g.`
      : `Este menú queda corto en proteína por ${formatNumber(proteinDiff)} g.`);
  }

  return {
    label: close ? "Cerca" : "No compatible",
    tone: close ? "review" : "warning",
    canAssign: false,
    kcalDiff,
    proteinDiff,
    reason: `${reasons.join(" ")} Ajustá el menú o elegí otro día.`,
  };
}

function getWeeklyAssignmentForDay(client = {}, dayKey = "") {
  const entry = client?.menu?.weeklyPlan?.assignedMenusByDay?.[dayKey];
  if (!entry || typeof entry !== "object") return null;
  const primary = entry.primaryMenu && typeof entry.primaryMenu === "object" ? entry.primaryMenu : entry;
  const snapshot = primary.menuSnapshot || primary.snapshot || primary;
  const name = snapshot.name || snapshot.nombre || "Menú asignado";
  const alternatives = Array.isArray(entry.alternatives) ? entry.alternatives : [];
  return {
    ...primary,
    name,
    alternatives,
  };
}

function buildNextWeeklyAssignments(client = {}, dayKey = "", menu = {}) {
  const currentAssignments = client?.menu?.weeklyPlan?.assignedMenusByDay || {};
  const currentEntry = currentAssignments?.[dayKey] || {};
  const snapshot = snapshotFromAssignableMenu(menu);
  const primaryMenu = {
    menuId: snapshot.baseId || snapshot.id || menu.baseId || menu.id || "",
    menuSnapshot: snapshot,
    source: "template",
    assignedAt: new Date().toISOString(),
  };
  const alternatives = Array.isArray(currentEntry?.alternatives)
    ? currentEntry.alternatives.filter((alternative) => !sameAssignedSnapshot(alternative, primaryMenu))
    : [];
  return {
    ...currentAssignments,
    [dayKey]: {
      ...primaryMenu,
      primaryMenu,
      alternatives: alternatives.slice(0, 10),
    },
  };
}

function snapshotFromAssignableMenu(menu = {}) {
  const meals = Array.isArray(menu.meals)
    ? menu.meals
    : Array.isArray(menu.comidas)
      ? menu.comidas.map((meal, index) => ({
          id: meal.id || meal._id || `meal-${index + 1}`,
          name: meal.nombre || meal.name || `Comida ${index + 1}`,
          type: meal.tipoComida || meal.type || "otro",
          order: meal.orden || meal.order || index + 1,
          kcal: meal.totales?.kcal ?? meal.kcal,
          protein: meal.totales?.proteina ?? meal.totales?.protein ?? meal.protein,
          carbs: meal.totales?.carbs ?? meal.carbs,
          fat: meal.totales?.grasas ?? meal.totales?.fat ?? meal.fat,
          foods: Array.isArray(meal.items) ? meal.items.map((item) => ({
            id: item.id,
            name: item.nombreSnapshot || item.nombre || item.name,
            cantidad: item.cantidad,
            unidad: item.unidad || "g",
            kcal: item.kcal,
            protein: item.proteina ?? item.protein,
            carbs: item.carbs,
            fat: item.grasas ?? item.fat,
          })) : meal.foods || [],
        }))
      : [];
  return {
    id: String(menu.id || menu._id || ""),
    baseId: String(menu.baseId || menu.menuBaseId || menu.id || menu._id || ""),
    name: menu.name || menu.nombre || "Menú sin nombre",
    description: menu.description || menu.descripcion || "",
    kcal: Number(menu.kcal || menu.kcalObjetivo || 0),
    protein: Number(menu.protein ?? menu.proteina ?? menu.macrosObjetivo?.proteina ?? 0),
    carbs: Number(menu.carbs ?? menu.macrosObjetivo?.carbs ?? 0),
    fat: Number(menu.fat ?? menu.grasas ?? menu.macrosObjetivo?.grasas ?? 0),
    mealsCount: Number(menu.mealsCount ?? menu.cantidadComidas ?? meals.length) || meals.length,
    meals,
  };
}

function sameAssignedSnapshot(a = {}, b = {}) {
  const left = String(a.menuId || a.menuSnapshot?.baseId || a.menuSnapshot?.id || a.menuSnapshot?.name || "").toLowerCase();
  const right = String(b.menuId || b.menuSnapshot?.baseId || b.menuSnapshot?.id || b.menuSnapshot?.name || "").toLowerCase();
  return Boolean(left && right && left === right);
}

function preferredMenuModeForClient(client = {}, permissions = {}) {
  const current = String(client?.menu?.mode?.type || "").trim();
  if (current === "automatic" && permissions.canUseAutomaticMode) return current;
  if ((current === "semiautomatic" || current === "hybrid") && permissions.canUseSemiautomaticMode) return "semiautomatic";
  if (current === "manual" && permissions.canUseManualMode) return "manual";
  if (permissions.canUseManualMode) return "manual";
  if (permissions.canUseSemiautomaticMode) return "semiautomatic";
  if (permissions.canUseAutomaticMode) return "automatic";
  return current || "manual";
}

function formatSignedNumber(value, suffix = "") {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number === 0) return `0${suffix}`;
  return `${number > 0 ? "+" : ""}${formatNumber(number)}${suffix}`;
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

function menuPermissions(user) {
  const features = user?.effectiveCapabilities?.features?.menus || {};
  return {
    canCreateMenu: !!(features.ownTemplates || features.manualBuilder),
    canCreateMeal: !!(features.ownTemplates || features.manualBuilder || features.foodLibrarySearch),
    canDuplicateMenu: !!features.duplicatePlans,
    canUseLibrary: !!(features.menuLibrarySearch || features.foodLibrarySearch || features.manualBuilder || features.ownTemplates),
    canUseMenuSuggestions: !!(features.semiAutomaticBuilder || features.automaticGenerator),
    canUseManualMode: !!features.manualBuilder,
    canUseSemiautomaticMode: !!features.semiAutomaticBuilder,
    canUseAutomaticMode: !!features.automaticGenerator,
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

function goalTone(goal = "") {
  const value = String(goal || "").toLowerCase();
  if (value.includes("defin")) return "cut";
  if (value.includes("recomp")) return "recomp";
  if (value.includes("manten")) return "maintain";
  if (value.includes("rend")) return "performance";
  if (value.includes("volumen")) return "bulk";
  return "neutral";
}
