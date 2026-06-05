import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Eye,
  FilePlus2,
  Pencil,
  RefreshCw,
  Search,
  Shuffle,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { useAlimentos, useComidas } from "../nutricion/nutricionQueries.js";
import {
  MenuBaseEditor,
  MenuCreationFlow,
} from "../nutricion/NutritionEditors.jsx";
import "../nutricion/nutricion.css";
import {
  NUTRITION_WEEK_DAYS,
  resolveNutritionTarget,
} from "../nutricion/dailyNutritionTargets.js";
import { formatNumber } from "../nutricion/nutricionUtils.js";
import { updateProfessionalClientMenu } from "../profesional/profesionalApi.js";
import {
  invalidateMenusLibrary,
  invalidateProfessionalClient,
  queryClient,
  queryKeys,
} from "../queryClient.js";
import { createMenuBase } from "./menusApi.js";
import { useMenusBase } from "./menusQueries.js";
import "./weeklyClientMenus.css";

const DAY_KEYS = NUTRITION_WEEK_DAYS.map((day) => day.key);

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function targetMacroValue(target, key) {
  if (key === "protein") return toNumber(target?.p, 0);
  if (key === "fat") return toNumber(target?.g, 0);
  return toNumber(target?.c, 0);
}

function formatSigned(value, suffix = "") {
  const number = Math.round(toNumber(value, 0) * 10) / 10;
  if (!number) return `0${suffix}`;
  return `${number > 0 ? "+" : ""}${formatNumber(number, 1)}${suffix}`;
}

function menuTotals(menu = {}) {
  const meals = Array.isArray(menu.meals)
    ? menu.meals
    : Array.isArray(menu.comidas)
      ? menu.comidas
      : [];
  if (toNumber(menu.kcal, 0) || toNumber(menu.protein, 0) || toNumber(menu.carbs, 0) || toNumber(menu.fat, 0)) {
    return {
      kcal: toNumber(menu.kcal, 0),
      protein: toNumber(menu.protein, 0),
      carbs: toNumber(menu.carbs, 0),
      fat: toNumber(menu.fat, 0),
    };
  }
  return meals.reduce(
    (acc, meal) => {
      const totals = meal.totales || meal.totals || meal;
      return {
        kcal: acc.kcal + toNumber(totals.kcal, 0),
        protein: acc.protein + toNumber(totals.proteina ?? totals.protein, 0),
        carbs: acc.carbs + toNumber(totals.carbs, 0),
        fat: acc.fat + toNumber(totals.grasas ?? totals.fat, 0),
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function normalizeAssignments(source = {}) {
  const raw = source && typeof source === "object" ? source : {};
  return DAY_KEYS.reduce((acc, key) => {
    const entry = raw[key];
    if (!entry) return acc;
    const snapshot = normalizeSnapshot(entry.menuSnapshot || entry.snapshot || entry);
    acc[key] = {
      menuId: entry.menuId || entry.menuBaseId || snapshot.baseId || snapshot.id || "",
      menuSnapshot: snapshot,
      source: entry.source || "base",
      assignedAt: entry.assignedAt || new Date().toISOString(),
    };
    return acc;
  }, {});
}

function normalizeSnapshot(menu = {}) {
  const meals = Array.isArray(menu.meals)
    ? menu.meals
    : Array.isArray(menu.comidas)
      ? menu.comidas.map((meal) => ({
          id: meal.id,
          name: meal.nombre || meal.name,
          type: meal.tipoComida || meal.type,
          order: meal.orden || meal.order,
          kcal: meal.totales?.kcal || meal.kcal,
          protein: meal.totales?.proteina ?? meal.protein,
          carbs: meal.totales?.carbs ?? meal.carbs,
          fat: meal.totales?.grasas ?? meal.fat,
          foods: Array.isArray(meal.items)
            ? meal.items.map((item) => ({
                id: item.id,
                name: item.nombreSnapshot || item.name || item.nombre,
                cantidad: item.cantidad,
                unidad: item.unidad,
                kcal: item.kcal,
                protein: item.proteina ?? item.protein,
                carbs: item.carbs,
                fat: item.grasas ?? item.fat,
              }))
            : meal.foods || [],
        }))
      : [];
  const totals = menuTotals({ ...menu, meals });
  return {
    id: String(menu.id || menu._id || menu.baseId || menu.menuBaseId || ""),
    baseId: String(menu.baseId || menu.menuBaseId || menu.id || menu._id || ""),
    name: menu.name || menu.nombre || "Menú sin nombre",
    description: menu.description || menu.descripcion || "",
    kcal: totals.kcal,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    mealsCount: toNumber(menu.mealsCount ?? menu.cantidadComidas, meals.length),
    meals,
  };
}

function snapshotFromMenu(menu = {}) {
  return normalizeSnapshot(menu);
}

function snapshotToEditorMenu(snapshot = {}) {
  return {
    id: snapshot.baseId || snapshot.id || "",
    nombre: snapshot.name || "Menú del día",
    descripcion: snapshot.description || "",
    kcalObjetivo: snapshot.kcal || 0,
    macrosObjetivo: {
      proteina: snapshot.protein || 0,
      carbs: snapshot.carbs || 0,
      grasas: snapshot.fat || 0,
    },
    cantidadComidas: snapshot.mealsCount || snapshot.meals?.length || 0,
    visibilidad: "privada",
    estado: "activo",
    comidas: (snapshot.meals || []).map((meal, mealIndex) => ({
      id: meal.id || `meal-${mealIndex + 1}`,
      nombre: meal.name || `Comida ${mealIndex + 1}`,
      orden: meal.order || mealIndex + 1,
      tipoComida: meal.type || "otro",
      items: (meal.foods || []).map((food, foodIndex) => ({
        id: food.id || `item-${mealIndex + 1}-${foodIndex + 1}`,
        alimentoId: food.alimentoId || null,
        nombreSnapshot: food.name || food.nombreSnapshot || `Alimento ${foodIndex + 1}`,
        cantidad: food.cantidad,
        unidad: food.unidad || "g",
        kcal: food.kcal,
        proteina: food.protein ?? food.proteina,
        carbs: food.carbs,
        grasas: food.fat ?? food.grasas,
      })),
    })),
  };
}

function menuToAssignment(menu = {}, source = "base") {
  const snapshot = snapshotFromMenu(menu);
  return {
    menuId: snapshot.baseId || snapshot.id || "",
    menuSnapshot: snapshot,
    source,
    assignedAt: new Date().toISOString(),
  };
}

function getCompatibility(menu = {}, target = {}) {
  if (!menu) {
    return {
      key: "empty",
      label: "Sin menú",
      tone: "empty",
      kcalDiff: -toNumber(target?.kcal, 0),
      proteinDiff: -targetMacroValue(target, "protein"),
    };
  }
  const totals = menuTotals(menu);
  const targetKcal = toNumber(target?.kcal, 0);
  const targetProtein = targetMacroValue(target, "protein");
  const kcalDiff = totals.kcal - targetKcal;
  const proteinDiff = totals.protein - targetProtein;
  const kcalPct = targetKcal > 0 ? Math.abs(kcalDiff) / targetKcal : 0;

  if (targetKcal && kcalPct <= 0.08 && proteinDiff >= -8) {
    return { key: "good", label: "Cerca", tone: "good", kcalDiff, proteinDiff };
  }
  if (targetKcal && kcalDiff > targetKcal * 0.1) {
    return { key: "high", label: "Excede kcal", tone: "warning", kcalDiff, proteinDiff };
  }
  if (targetKcal && kcalDiff < -targetKcal * 0.12) {
    return { key: "low", label: "Bajo en kcal", tone: "review", kcalDiff, proteinDiff };
  }
  if (targetProtein && proteinDiff < -10) {
    return { key: "protein", label: "Bajo en proteína", tone: "review", kcalDiff, proteinDiff };
  }
  return { key: "review", label: "Revisar", tone: "review", kcalDiff, proteinDiff };
}

function sortByCompatibility(menus = [], target = {}) {
  return [...menus].sort((a, b) => scoreMenu(a, target) - scoreMenu(b, target));
}

function scoreMenu(menu = {}, target = {}) {
  const totals = menuTotals(menu);
  const kcalScore = Math.abs(totals.kcal - toNumber(target?.kcal, 0));
  const proteinScore = Math.max(0, targetMacroValue(target, "protein") - totals.protein) * 8;
  return kcalScore + proteinScore;
}

function defaultMode(access = {}) {
  if (access?.menuModes?.manual) return "manual";
  if (access?.menuModes?.semiautomatic) return "semiautomatic";
  if (access?.menuModes?.automatic) return "automatic";
  return "manual";
}

export default function WeeklyClientMenuPlanner({ clientId, client, access, nutritionTargets, onToast }) {
  const [assignments, setAssignments] = useState(() => normalizeAssignments(client?.menu?.weeklyPlan?.assignedMenusByDay));
  const [selectedDayKey, setSelectedDayKey] = useState("monday");
  const [picker, setPicker] = useState(null);
  const [creator, setCreator] = useState(null);
  const [editor, setEditor] = useState(null);
  const [detailDayKey, setDetailDayKey] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const menusQuery = useMenusBase({ estado: "activo", includeComidas: true });
  const creationOpen = Boolean(creator || editor);
  const foodsQuery = useAlimentos({ search: "" }, { enabled: creationOpen });
  const foods = foodsQuery.data?.all || foodsQuery.data?.alimentos || [];
  const comidasQuery = useComidas({}, foods, { enabled: creationOpen });
  const mealLibrary = comidasQuery.data?.all || comidasQuery.data?.comidas || [];

  useEffect(() => {
    setAssignments(normalizeAssignments(client?.menu?.weeklyPlan?.assignedMenusByDay));
  }, [client?.menu?.weeklyPlan?.assignedMenusByDay]);

  const libraryMenus = useMemo(() => menusQuery.data?.menus || [], [menusQuery.data?.menus]);

  const weekRows = useMemo(
    () =>
      NUTRITION_WEEK_DAYS.map((day) => {
        const target = resolveNutritionTarget(nutritionTargets, day.key);
        const assignment = assignments[day.key] || null;
        const snapshot = assignment?.menuSnapshot ? normalizeSnapshot(assignment.menuSnapshot) : null;
        const totals = snapshot ? menuTotals(snapshot) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        const compatibility = getCompatibility(snapshot, target);
        return { day, target, assignment, snapshot, totals, compatibility };
      }),
    [assignments, nutritionTargets]
  );

  const selectedDay = weekRows.find((row) => row.day.key === selectedDayKey) || weekRows[0];
  const detailRow = weekRows.find((row) => row.day.key === detailDayKey) || null;

  async function persistAssignments(nextAssignments, successMessage = "Plan semanal actualizado.") {
    setAssignments(nextAssignments);
    setBusy("weekly-save");
    try {
      const data = await updateProfessionalClientMenu(clientId, {
        menu: {
          mode: { type: defaultMode(access), lockedByCoach: client?.menu?.mode?.lockedByCoach },
          weeklyPlan: { assignedMenusByDay: nextAssignments },
          coachNotes: client?.menu?.coachNotes || "",
        },
      });
      queryClient.setQueryData(queryKeys.professionalClientDetail(clientId), data);
      await invalidateProfessionalClient(clientId, data?.client);
      onToast?.({ type: "success", message: successMessage });
    } catch (error) {
      setAssignments(normalizeAssignments(client?.menu?.weeklyPlan?.assignedMenusByDay));
      onToast?.({ type: "error", message: error?.message || "No se pudo guardar la asignación semanal." });
    } finally {
      setBusy("");
    }
  }

  async function assignMenu(dayKey, menu, message = "Menú asignado al día.") {
    const next = {
      ...assignments,
      [dayKey]: menuToAssignment(menu),
    };
    setPicker(null);
    await persistAssignments(next, message);
  }

  async function clearDay(dayKey) {
    const next = { ...assignments };
    delete next[dayKey];
    setDetailDayKey("");
    await persistAssignments(next, "Menú quitado del día.");
  }

  async function saveCreatedMenu(payload) {
    if (!creator) return;
    if (!access?.canCreateMenu) {
      onToast?.({ type: "error", message: "Tu plan no permite crear menús propios." });
      return;
    }
    try {
      setBusy("create-menu");
      const created = await createMenuBase(payload);
      await invalidateMenusLibrary(created?.id);
      await assignMenu(creator.dayKey, created, "Menú creado y asignado al día.");
      setCreator(null);
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo crear el menú." });
    } finally {
      setBusy("");
    }
  }

  async function saveEditedDayMenu(payload) {
    if (!editor) return;
    if (!access?.canCreateMenu) {
      onToast?.({ type: "error", message: "Tu plan no permite editar creando una plantilla propia." });
      return;
    }
    try {
      setBusy("edit-menu");
      const created = await createMenuBase({
        ...payload,
        nombre: payload.nombre || `${editor.snapshot?.name || "Menú"} editado`,
      });
      await invalidateMenusLibrary(created?.id);
      await assignMenu(editor.dayKey, created, "Menú editado y reasignado al día.");
      setEditor(null);
      setDetailDayKey(editor.dayKey);
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo editar el menú del día." });
    } finally {
      setBusy("");
    }
  }

  function openPicker(dayKey, mode = "choose") {
    setPicker({ dayKey, mode });
    setSearch("");
  }

  const pickerRow = picker ? weekRows.find((row) => row.day.key === picker.dayKey) : null;
  const pickerMenus = useMemo(() => {
    if (!pickerRow) return [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? libraryMenus.filter((menu) => `${menu.name} ${menu.description} ${(menu.tags || []).join(" ")}`.toLowerCase().includes(term))
      : libraryMenus;
    return sortByCompatibility(filtered, pickerRow.target);
  }, [libraryMenus, pickerRow, search]);

  return (
    <div className="wmp">
      <section className="wmp-hero">
        <div>
          <span className="wmp-kicker">
            <Utensils size={16} strokeWidth={2.3} aria-hidden="true" />
            Plan semanal por día
          </span>
          <h2>Menús del cliente</h2>
          <p>Asigná una plantilla por día, revisá diferencias contra la meta y ajustá sin cargar toda la semana completa.</p>
        </div>
        <button
          type="button"
          className="wmp-btn ghost"
          onClick={() => onToast?.({ type: "info", message: "Exportar PDF queda como segunda etapa para hacerlo bien y liviano." })}
        >
          <Download size={16} strokeWidth={2.3} aria-hidden="true" />
          PDF etapa 2
        </button>
      </section>

      <section className="wmp-weekSummary" aria-label="Resumen semanal de menús">
        {weekRows.map((row) => (
          <DayMenuCard
            key={row.day.key}
            row={row}
            selected={selectedDayKey === row.day.key}
            busy={busy === "weekly-save"}
            onSelect={() => setSelectedDayKey(row.day.key)}
            onView={() => setDetailDayKey(row.day.key)}
            onChoose={() => openPicker(row.day.key, "choose")}
            onCreate={() => access?.canCreateMenu && setCreator({ dayKey: row.day.key })}
            onAlternative={() => openPicker(row.day.key, "alternative")}
            onEdit={() => row.snapshot && access?.canCreateMenu && setEditor({ dayKey: row.day.key, snapshot: row.snapshot })}
            onClear={() => clearDay(row.day.key)}
            canCreate={!!access?.canCreateMenu}
          />
        ))}
      </section>

      {selectedDay ? (
        <section className="wmp-focus">
          <div>
            <span>Día seleccionado</span>
            <strong>{selectedDay.day.label}</strong>
            <small>
              Meta {displayKcal(selectedDay.target.kcal)} / P {displayMacro(selectedDay.target.p)} / C {displayMacro(selectedDay.target.c)} / G {displayMacro(selectedDay.target.g)}
            </small>
          </div>
          <div className="wmp-focusActions">
            <button type="button" className="wmp-btn gold" onClick={() => openPicker(selectedDay.day.key, "choose")}>
              <Search size={16} strokeWidth={2.3} aria-hidden="true" />
              Elegir menú
            </button>
            <button type="button" className="wmp-btn" onClick={() => setCreator({ dayKey: selectedDay.day.key })} disabled={!access?.canCreateMenu}>
              <FilePlus2 size={16} strokeWidth={2.3} aria-hidden="true" />
              Crear menú
            </button>
          </div>
        </section>
      ) : null}

      {picker ? (
        <MenuPickerDrawer
          row={pickerRow}
          menus={pickerMenus}
          search={search}
          loading={menusQuery.isLoading}
          mode={picker.mode}
          onSearch={setSearch}
          onClose={() => setPicker(null)}
          onPick={(menu) => assignMenu(picker.dayKey, menu, picker.mode === "alternative" ? "Alternativa asignada al día." : "Menú asignado al día.")}
        />
      ) : null}

      {detailRow ? (
        <MenuDayDetailDrawer
          row={detailRow}
          onClose={() => setDetailDayKey("")}
          onChoose={() => openPicker(detailRow.day.key, "choose")}
          onAlternative={() => openPicker(detailRow.day.key, "alternative")}
          onEdit={() => detailRow.snapshot && access?.canCreateMenu && setEditor({ dayKey: detailRow.day.key, snapshot: detailRow.snapshot })}
          onClear={() => clearDay(detailRow.day.key)}
          canCreate={!!access?.canCreateMenu}
        />
      ) : null}

      {creator ? (
        <MenuCreationFlow
          foods={foods}
          foodsLoading={foodsQuery.isLoading}
          mealLibrary={mealLibrary}
          onSave={saveCreatedMenu}
          onClose={() => setCreator(null)}
          saving={busy === "create-menu"}
          allowSystemVisibility={false}
          canUseSuggestions={Boolean(access?.canUseMenuSuggestions)}
          guidedDefaults={guidedDefaultsForDay(weekRows.find((row) => row.day.key === creator.dayKey))}
        />
      ) : null}

      {editor ? (
        <MenuBaseEditor
          initialMenu={snapshotToEditorMenu(editor.snapshot)}
          foods={foods}
          foodsLoading={foodsQuery.isLoading}
          mealLibrary={mealLibrary}
          onSave={saveEditedDayMenu}
          onClose={() => setEditor(null)}
          saving={busy === "edit-menu"}
          title={`Editar menú de ${NUTRITION_WEEK_DAYS.find((day) => day.key === editor.dayKey)?.label || "día"}`}
          submitLabel="Guardar y asignar"
          allowSystemVisibility={false}
        />
      ) : null}
    </div>
  );
}

function DayMenuCard({ row, selected, busy, canCreate, onSelect, onView, onChoose, onCreate, onAlternative, onEdit, onClear }) {
  const targetKcal = toNumber(row.target.kcal, 0);
  const percent = targetKcal > 0 ? Math.min(130, (row.totals.kcal / targetKcal) * 100) : 0;
  const overflow = percent > 100;
  const barTone = !row.snapshot ? "empty" : overflow ? "overflow" : row.compatibility.key === "good" ? "good" : row.compatibility.key === "low" ? "low" : "review";
  return (
    <article className={`wmp-dayCard ${selected ? "selected" : ""}`} onClick={onSelect}>
      <header>
        <div>
          <strong>{row.day.label}</strong>
          <span className={`wmp-source ${row.target.customized ? "custom" : ""}`}>
            {row.target.customized ? "Personalizado" : "General"}
          </span>
        </div>
        <span className={`wmp-status ${row.compatibility.tone}`}>{row.compatibility.label}</span>
      </header>

      <div className="wmp-menuName">
        {row.snapshot ? row.snapshot.name : "Sin menú asignado"}
      </div>

      <div className="wmp-targetLine">
        <span>Meta {displayKcal(row.target.kcal)}</span>
        <span>Menú {displayKcal(row.totals.kcal)}</span>
      </div>
      <div className={`wmp-bar ${barTone}`} aria-label={`Progreso calórico ${Math.round(percent)}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="wmp-macroLine">
        <span>P {displayMacro(row.target.p)} a {displayMacro(row.totals.protein)}</span>
        <span>{formatSigned(row.compatibility.kcalDiff, " kcal")}</span>
      </div>

      <div className="wmp-cardActions" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="wmp-iconBtn" onClick={row.snapshot ? onView : onChoose} title={row.snapshot ? "Ver detalle" : "Elegir menú"}>
          {row.snapshot ? <Eye size={16} /> : <Search size={16} />}
        </button>
        <button
          type="button"
          className="wmp-iconBtn"
          onClick={row.snapshot ? onEdit : onCreate}
          disabled={!canCreate}
          title={canCreate ? (row.snapshot ? "Editar menú" : "Crear menú") : "Tu plan no permite crear menús propios"}
        >
          {row.snapshot ? <Pencil size={16} /> : <FilePlus2 size={16} />}
        </button>
        {row.snapshot ? (
          <>
            <button type="button" className="wmp-iconBtn" onClick={onAlternative} title="Buscar alternativa">
              <Shuffle size={16} />
            </button>
            <button type="button" className="wmp-iconBtn danger" onClick={onClear} disabled={busy} title="Quitar menú">
              <Trash2 size={16} />
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function MenuPickerDrawer({ row, menus, search, loading, mode, onSearch, onClose, onPick }) {
  return (
    <section className="wmp-drawer" role="dialog" aria-modal="true" aria-label="Elegir menú">
      <div className="wmp-drawerPanel picker">
        <header className="wmp-drawerHead">
          <div>
            <span>{mode === "alternative" ? "Alternativas compatibles" : "Elegir menú"}</span>
            <h3>{row?.day?.label || "Día"}</h3>
            <p>Meta {displayKcal(row?.target?.kcal)} / P {displayMacro(row?.target?.p)} / C {displayMacro(row?.target?.c)} / G {displayMacro(row?.target?.g)}</p>
          </div>
          <button type="button" className="wmp-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} strokeWidth={2.3} />
          </button>
        </header>

        <label className="wmp-pickerSearch">
          <Search size={18} strokeWidth={2.2} aria-hidden="true" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por nombre, tag u objetivo" />
        </label>

        <div className="wmp-pickerList">
          {loading ? <div className="wmp-empty">Cargando menús...</div> : null}
          {!loading && menus.length === 0 ? <div className="wmp-empty">No hay menús que coincidan.</div> : null}
          {menus.map((menu) => {
            const compatibility = getCompatibility(menu, row?.target);
            const totals = menuTotals(menu);
            return (
              <article className="wmp-pickerCard" key={menu.id || menu.baseId || menu.name}>
                <div>
                  <span className={`wmp-status ${compatibility.tone}`}>{compatibility.label}</span>
                  <strong>{menu.name}</strong>
                  <p>{displayKcal(totals.kcal)} / P {displayMacro(totals.protein)} / C {displayMacro(totals.carbs)} / G {displayMacro(totals.fat)}</p>
                  <small>{menu.mealsCount || menu.meals?.length || 0} comidas / Dif. {formatSigned(compatibility.kcalDiff, " kcal")} / P {formatSigned(compatibility.proteinDiff, " g")}</small>
                </div>
                <button type="button" className="wmp-btn gold" onClick={() => onPick(menu)}>
                  Usar este menú
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MenuDayDetailDrawer({ row, canCreate, onClose, onChoose, onAlternative, onEdit, onClear }) {
  const menu = row.snapshot;
  return (
    <section className="wmp-drawer" role="dialog" aria-modal="true" aria-label="Detalle del menú del día">
      <div className="wmp-drawerPanel detail">
        <header className="wmp-drawerHead">
          <div>
            <span>Detalle del día</span>
            <h3>{row.day.label}</h3>
            <p>Meta {displayKcal(row.target.kcal)} / P {displayMacro(row.target.p)} / C {displayMacro(row.target.c)} / G {displayMacro(row.target.g)}</p>
          </div>
          <button type="button" className="wmp-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} strokeWidth={2.3} />
          </button>
        </header>

        {!menu ? (
          <div className="wmp-detailEmpty">
            <AlertTriangle size={22} strokeWidth={2.3} />
            <strong>Este día todavía no tiene menú.</strong>
            <button type="button" className="wmp-btn gold" onClick={onChoose}>Elegir menú</button>
          </div>
        ) : (
          <>
            <section className="wmp-detailSummary">
              <div>
                <span className={`wmp-status ${row.compatibility.tone}`}>{row.compatibility.label}</span>
                <h4>{menu.name}</h4>
                <p>{menu.description || "Plantilla asignada a este día."}</p>
              </div>
              <div className="wmp-detailTotals">
                <strong>{displayKcal(row.totals.kcal)}</strong>
                <span>P {displayMacro(row.totals.protein)} / C {displayMacro(row.totals.carbs)} / G {displayMacro(row.totals.fat)}</span>
                <small>Dif. {formatSigned(row.compatibility.kcalDiff, " kcal")} / P {formatSigned(row.compatibility.proteinDiff, " g")}</small>
              </div>
            </section>

            <div className="wmp-detailActions">
              <button type="button" className="wmp-btn" onClick={onEdit} disabled={!canCreate}>
                <Pencil size={16} /> Editar
              </button>
              <button type="button" className="wmp-btn" onClick={onChoose}>
                <RefreshCw size={16} /> Cambiar
              </button>
              <button type="button" className="wmp-btn" onClick={onAlternative}>
                <Shuffle size={16} /> Alternativa
              </button>
              <button type="button" className="wmp-btn danger" onClick={onClear}>
                <Trash2 size={16} /> Quitar
              </button>
            </div>

            <div className="wmp-mealList">
              {(menu.meals || []).map((meal) => (
                <article className="wmp-mealCard" key={meal.id || meal.name}>
                  <header>
                    <strong>{meal.name}</strong>
                    <span>{displayKcal(meal.kcal)} / P {displayMacro(meal.protein)} / C {displayMacro(meal.carbs)} / G {displayMacro(meal.fat)}</span>
                  </header>
                  {(meal.foods || []).length ? (
                    <div className="wmp-foodRows">
                      {meal.foods.map((food) => (
                        <div key={food.id || `${meal.id}-${food.name}`}>
                          <span>{food.name}</span>
                          <small>{formatNumber(food.cantidad, 1)} {food.unidad || "g"} / {displayKcal(food.kcal)} / P {displayMacro(food.protein)}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="wmp-foodEmpty">Sin alimentos cargados.</p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function guidedDefaultsForDay(row) {
  const target = row?.target || {};
  return {
    nombre: row?.day?.label ? `Menú ${row.day.label}` : "",
    kcal: toNumber(target.kcal, 1800) || 1800,
    proteina: toNumber(target.p, 140) || 140,
    carbs: target.c || "",
    grasas: target.g || "",
  };
}

function displayKcal(value) {
  return `${formatNumber(toNumber(value, 0), 0)} kcal`;
}

function displayMacro(value) {
  return `${formatNumber(toNumber(value, 0), 1)} g`;
}
