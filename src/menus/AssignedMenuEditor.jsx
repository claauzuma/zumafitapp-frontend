import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Copy,
  Eye,
  FilePlus2,
  Lock,
  Pencil,
  Plus,
  RefreshCcw,
  Replace,
  Save,
  Search,
  Trash2,
  Unlock,
  Utensils,
  X,
} from "lucide-react";

import { useAlimentos } from "../nutricion/nutricionQueries.js";
import { formatNumber } from "../nutricion/nutricionUtils.js";
import { invalidateClientMenus, invalidateMenusLibrary, queryClient, queryKeys } from "../queryClient.js";
import {
  deleteClientMenu,
  duplicateClientMenu,
  getFoodEquivalents,
  saveClientMenuAsTemplate,
  updateClientMenu,
} from "./menusApi.js";
import { useClientActiveMenu, useClientMenus } from "./menusQueries.js";
import {
  formatMacroDiff,
  itemFromEquivalent,
  itemFromFood,
  macroDiff,
  normalizeAssignedMenu,
  recalcAssignedMenu,
  rescaleMenuItem,
} from "./menusUtils.js";
import "./menusAssigned.css";

const WEEK_DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

export default function AssignedMenuEditor({ clientId, client, access, onToast }) {
  const activeMenuQuery = useClientActiveMenu(clientId);
  const historyQuery = useClientMenus(clientId, { limit: 20 });
  const foodsQuery = useAlimentos({ search: "" });
  const [draft, setDraft] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState("");
  const [foodModal, setFoodModal] = useState(null);
  const [foodSearch, setFoodSearch] = useState("");
  const [equivalents, setEquivalents] = useState(null);

  const activeMenu = activeMenuQuery.data || null;

  useEffect(() => {
    setDraft(activeMenu ? recalcAssignedMenu(normalizeAssignedMenu(activeMenu)) : null);
    setSelectedDay(0);
    setEditing(null);
  }, [activeMenu]);

  const days = useMemo(() => buildWeekDays(draft), [draft]);
  const activeDay = days[selectedDay] || days[0] || null;
  const diff = useMemo(() => (draft ? macroDiff(draft.totalesActuales || {}, draft) : null), [draft]);

  const foods = useMemo(() => {
    const search = foodSearch.trim().toLowerCase();
    const list = foodsQuery.data?.all || foodsQuery.data?.alimentos || [];
    return list
      .filter((food) => {
        if (!search) return true;
        return `${food.name} ${food.source} ${food.macroGroup}`.toLowerCase().includes(search);
      })
      .slice(0, 24);
  }, [foodSearch, foodsQuery.data]);

  function updateDraft(patch) {
    setDraft((current) => recalcAssignedMenu({ ...(current || {}), ...patch }));
  }

  function updateMeal(mealIndex, patch) {
    updateDraft({
      comidas: (draft?.comidas || []).map((meal, index) => (index === mealIndex ? { ...meal, ...patch } : meal)),
    });
  }

  function updateItem(mealIndex, itemIndex, patch) {
    updateDraft({
      comidas: (draft?.comidas || []).map((meal, index) => {
        if (index !== mealIndex) return meal;
        return {
          ...meal,
          items: (meal.items || []).map((item, i) => (i === itemIndex ? { ...item, ...patch } : item)),
        };
      }),
    });
  }

  function removeItem(mealIndex, itemIndex) {
    updateDraft({
      comidas: (draft?.comidas || []).map((meal, index) => {
        if (index !== mealIndex) return meal;
        return {
          ...meal,
          items: (meal.items || []).filter((_, i) => i !== itemIndex),
        };
      }),
    });
  }

  function addMeal() {
    const nextIndex = (draft?.comidas || []).length + 1;
    updateDraft({
      comidas: [
        ...(draft?.comidas || []),
        {
          id: `meal-${Date.now()}`,
          nombre: `Comida ${nextIndex}`,
          orden: nextIndex,
          tipoComida: "otro",
          items: [],
        },
      ],
    });
  }

  function removeMeal(mealIndex) {
    updateDraft({
      comidas: (draft?.comidas || []).filter((_, index) => index !== mealIndex),
    });
  }

  function addFoodToMeal(food) {
    if (!foodModal) return;
    const nextItem = itemFromFood(food);
    updateDraft({
      comidas: (draft?.comidas || []).map((meal, index) => {
        if (index !== foodModal.mealIndex) return meal;
        return { ...meal, items: [...(meal.items || []), nextItem] };
      }),
    });
    setFoodModal(null);
    setFoodSearch("");
  }

  async function loadEquivalents(mealIndex, itemIndex) {
    const item = draft?.comidas?.[mealIndex]?.items?.[itemIndex];
    if (!item) return;
    try {
      setSaving(`eq-${mealIndex}-${itemIndex}`);
      const data = await getFoodEquivalents({
        alimentoOriginal: item,
        cantidad: item.cantidad,
        unidad: item.unidad,
      });
      setEquivalents({ mealIndex, itemIndex, item, data });
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudieron buscar equivalencias." });
    } finally {
      setSaving("");
    }
  }

  function applyEquivalent(eq) {
    const nextItem = itemFromEquivalent(eq, equivalents.item);
    updateItem(equivalents.mealIndex, equivalents.itemIndex, nextItem);
    setEquivalents(null);
  }

  async function saveDraft() {
    if (!draft?.id) return;
    try {
      setSaving("save");
      const payload = {
        nombre: draft.nombre,
        descripcion: draft.descripcion,
        fechaInicio: draft.fechaInicio,
        fechaFin: draft.fechaFin,
        estado: draft.estado,
        kcalObjetivo: draft.kcalObjetivo,
        macrosObjetivo: draft.macrosObjetivo,
        comidas: draft.comidas,
        notasCoach: draft.notasCoach,
      };
      const updated = await updateClientMenu(clientId, draft.id, payload);
      queryClient.setQueryData(queryKeys.clientActiveMenu(clientId), updated);
      await invalidateClientMenus(clientId, draft.id);
      onToast?.({ type: "success", message: "Menu asignado actualizado." });
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo guardar el menu." });
    } finally {
      setSaving("");
    }
  }

  async function duplicateCurrent() {
    if (!draft?.id) return;
    try {
      setSaving("duplicate");
      await duplicateClientMenu(clientId, draft.id, {
        nombre: `${draft.nombre || "Menu"} - Semana 2`,
        activar: false,
      });
      await invalidateClientMenus(clientId);
      onToast?.({ type: "success", message: "Menu duplicado como borrador pausado." });
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo duplicar el menu." });
    } finally {
      setSaving("");
    }
  }

  async function saveTemplate() {
    if (!draft?.id) return;
    try {
      setSaving("template");
      const template = await saveClientMenuAsTemplate(clientId, draft.id, {
        nombre: `${draft.nombre || "Menu"} - plantilla`,
      });
      await Promise.all([invalidateMenusLibrary(template?.id), invalidateClientMenus(clientId)]);
      onToast?.({ type: "success", message: "Guardado como plantilla propia." });
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo guardar como plantilla." });
    } finally {
      setSaving("");
    }
  }

  async function deleteCurrent() {
    if (!draft?.id) return;
    try {
      setSaving("delete");
      await deleteClientMenu(clientId, draft.id);
      await invalidateClientMenus(clientId, draft.id);
      onToast?.({ type: "success", message: "Menu asignado eliminado." });
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo eliminar el menu." });
    } finally {
      setSaving("");
    }
  }

  if (!access?.nutrition) {
    return <div className="ma-empty">Tu especialidad o plan no permite gestionar menus para clientes.</div>;
  }

  if (activeMenuQuery.isLoading) {
    return <div className="ma-empty">Cargando menu activo...</div>;
  }

  if (!draft) {
    return (
      <div className="ma-panel">
        <div className="ma-head">
          <div>
            <span className="ma-pill gold">
              <Utensils size={14} />
              Sin menu activo
            </span>
            <h3 className="ma-title">Todavia no hay menu asignado</h3>
            <p className="ma-sub">
              Elegi una plantilla desde la biblioteca de menus y asignala a {client?.profile?.nombre || "este cliente"}.
            </p>
          </div>
          <Link className="ma-btn gold" to="/profesional/menus">
            <Plus size={16} />
            Ir a menus
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ma-panel">
      <MenuSummary
        draft={draft}
        diff={diff}
        days={days}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onOpenEditor={() => setEditorOpen(true)}
        onOpenPreview={() => setPreviewOpen(true)}
        onRefresh={() => activeMenuQuery.refetch()}
        onDuplicate={duplicateCurrent}
        onTemplate={saveTemplate}
        onDelete={deleteCurrent}
        saving={saving}
        historyCount={historyQuery.data?.menus?.length || 0}
      />

      {activeDay ? (
        <DayPreview
          day={activeDay}
          onOpenEditor={() => setEditorOpen(true)}
          onOpenPreview={() => setPreviewOpen(true)}
        />
      ) : null}

      {editorOpen ? (
        <EditorOverlay
          draft={draft}
          day={activeDay}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSave={saveDraft}
          saving={saving}
          editing={editing}
          setEditing={setEditing}
          updateDraft={updateDraft}
          updateMeal={updateMeal}
          updateItem={updateItem}
          removeItem={removeItem}
          addMeal={addMeal}
          removeMeal={removeMeal}
          openFoodModal={setFoodModal}
          loadEquivalents={loadEquivalents}
        />
      ) : null}

      {previewOpen ? (
        <ClientPreviewOverlay
          draft={draft}
          day={activeDay}
          client={client}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      {foodModal ? (
        <FoodModal
          foods={foods}
          loading={foodsQuery.isLoading}
          search={foodSearch}
          onSearch={setFoodSearch}
          onPick={addFoodToMeal}
          onClose={() => setFoodModal(null)}
        />
      ) : null}

      {equivalents ? (
        <EquivalentsModal
          data={equivalents.data}
          item={equivalents.item}
          onPick={applyEquivalent}
          onClose={() => setEquivalents(null)}
        />
      ) : null}
    </div>
  );
}

function MenuSummary({
  draft,
  diff,
  days,
  selectedDay,
  onSelectDay,
  onOpenEditor,
  onOpenPreview,
  onRefresh,
  onDuplicate,
  onTemplate,
  onDelete,
  saving,
  historyCount,
}) {
  const totals = draft.totalesActuales || {};
  const target = {
    kcal: draft.kcalObjetivo,
    proteina: draft.macrosObjetivo?.proteina,
    carbs: draft.macrosObjetivo?.carbs,
    grasas: draft.macrosObjetivo?.grasas,
  };

  return (
    <>
      <div className="ma-head ma-planHead">
        <div>
          <span className="ma-pill gold">
            <Calendar size={14} />
            Semana nutricional
          </span>
          <h3 className="ma-title">{draft.nombre}</h3>
          <p className="ma-sub">
            {periodLabel(draft)} · Snapshot editable del cliente, sin modificar la plantilla base.
          </p>
        </div>
        <div className="ma-actions">
          <button className="ma-btn" type="button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            Actualizar
          </button>
          <button className="ma-btn" type="button" onClick={onOpenPreview}>
            <Eye size={16} />
            Vista cliente
          </button>
          <button className="ma-btn gold" type="button" onClick={onOpenEditor}>
            <Pencil size={16} />
            Abrir editor
          </button>
        </div>
      </div>

      <div className="ma-dashboard">
        <MacroBox label="Kcal" value={totals.kcal} target={target.kcal} diff={diff?.kcal} tone="kcal" />
        <MacroBox label="Proteina" value={totals.proteina} target={target.proteina} diff={diff?.proteina} suffix=" g" tone="protein" />
        <MacroBox label="Carbs" value={totals.carbs} target={target.carbs} diff={diff?.carbs} suffix=" g" tone="carbs" />
        <MacroBox label="Grasas" value={totals.grasas} target={target.grasas} diff={diff?.grasas} suffix=" g" tone="fat" />
      </div>

      <div className="ma-weekHeader">
        <div>
          <h4>Distribucion semanal</h4>
          <p>{days.some((day) => day.real) ? "Dias reales del menu asignado." : "Vista compatible: el menu actual se muestra como base de la semana."}</p>
        </div>
        <div className="ma-actions">
          <button className="ma-btn" type="button" onClick={onDuplicate} disabled={saving === "duplicate"}>
            <Copy size={16} />
            Duplicar semana
          </button>
          <button className="ma-btn" type="button" onClick={onTemplate} disabled={saving === "template"}>
            <FilePlus2 size={16} />
            Guardar plantilla
          </button>
          <button className="ma-btn danger" type="button" onClick={onDelete} disabled={saving === "delete"}>
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </div>

      <div className="ma-weekGrid">
        {days.map((day, index) => (
          <button
            type="button"
            className={`ma-dayCard ${selectedDay === index ? "active" : ""} ${day.available ? "" : "muted"}`}
            key={day.key}
            onClick={() => onSelectDay(index)}
          >
            <span>{day.name}</span>
            <strong>{day.available ? `${formatNumber(day.totals.kcal, 0)} kcal` : day.status}</strong>
            <small>{day.available ? `P ${formatNumber(day.totals.proteina, 0)} · C ${formatNumber(day.totals.carbs, 0)} · G ${formatNumber(day.totals.grasas, 0)}` : "Listo para estructura semanal"}</small>
          </button>
        ))}
      </div>

      {historyCount > 1 ? (
        <div className="ma-empty compact">Hay {historyCount} menus asignados en el historial de este cliente.</div>
      ) : null}
    </>
  );
}

function DayPreview({ day, onOpenEditor, onOpenPreview }) {
  return (
    <section className="ma-dayPreview">
      <div className="ma-sectionHead">
        <div>
          <span className="ma-pill">{day.status}</span>
          <h4>{day.name}</h4>
          <p>{formatNumber(day.totals.kcal, 0)} kcal · P {formatNumber(day.totals.proteina, 0)} · C {formatNumber(day.totals.carbs, 0)} · G {formatNumber(day.totals.grasas, 0)}</p>
        </div>
        <div className="ma-actions">
          <button className="ma-btn" type="button" onClick={onOpenPreview}>
            <Eye size={16} />
            Vista cliente
          </button>
          <button className="ma-btn gold" type="button" onClick={onOpenEditor}>
            <Pencil size={16} />
            Editar dia
          </button>
        </div>
      </div>

      {day.available ? (
        <div className="ma-mealPreviewGrid">
          {day.comidas.map((meal, mealIndex) => (
            <MealCardCompact meal={meal} key={meal.id || mealIndex} />
          ))}
        </div>
      ) : (
        <div className="ma-empty">Este dia todavia no tiene comidas propias. El modelo queda preparado para estructura semanal real.</div>
      )}
    </section>
  );
}

function EditorOverlay({
  draft,
  day,
  onClose,
  onSave,
  saving,
  editing,
  setEditing,
  updateDraft,
  updateMeal,
  updateItem,
  removeItem,
  addMeal,
  removeMeal,
  openFoodModal,
  loadEquivalents,
}) {
  return (
    <div className="ma-drawerBackdrop ma-fullscreenBackdrop">
      <div className="ma-fullEditor">
        <div className="ma-editorTop">
          <div>
            <span className="ma-pill gold">
              <Pencil size={14} />
              Editor semanal
            </span>
            <h3 className="ma-title">{day?.name || "Menu actual"}</h3>
            <p className="ma-sub">{draft.nombre} · {periodLabel(draft)}</p>
          </div>
          <div className="ma-actions">
            <button className="ma-btn" type="button" onClick={addMeal}>
              <Plus size={16} />
              Agregar comida
            </button>
            <button className="ma-btn gold" type="button" onClick={onSave} disabled={saving === "save"}>
              <Save size={16} />
              {saving === "save" ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="ma-btn icon" onClick={onClose} aria-label="Cerrar editor">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ma-editorLayout">
          <aside className="ma-editorSide">
            <Field label="Nombre del menu" value={draft.nombre} onChange={(value) => updateDraft({ nombre: value })} />
            <div className="ma-smallGrid">
              <Field label="Kcal objetivo" value={draft.kcalObjetivo} onChange={(value) => updateDraft({ kcalObjetivo: value })} />
              <Field
                label="Proteina"
                value={draft.macrosObjetivo?.proteina}
                onChange={(value) => updateDraft({ macrosObjetivo: { ...(draft.macrosObjetivo || {}), proteina: value } })}
              />
              <Field
                label="Carbs"
                value={draft.macrosObjetivo?.carbs}
                onChange={(value) => updateDraft({ macrosObjetivo: { ...(draft.macrosObjetivo || {}), carbs: value } })}
              />
              <Field
                label="Grasas"
                value={draft.macrosObjetivo?.grasas}
                onChange={(value) => updateDraft({ macrosObjetivo: { ...(draft.macrosObjetivo || {}), grasas: value } })}
              />
            </div>
            <Field
              label="Estado"
              type="select"
              value={draft.estado}
              onChange={(value) => updateDraft({ estado: value })}
              options={[
                ["activo", "Activo"],
                ["pausado", "Pausado"],
                ["finalizado", "Finalizado"],
              ]}
            />
            <label className="ma-field">
              <span>Notas del coach</span>
              <textarea value={draft.notasCoach || ""} onChange={(event) => updateDraft({ notasCoach: event.target.value })} />
            </label>
          </aside>

          <main className="ma-editorMeals">
            {!day?.available ? (
              <div className="ma-empty">Este dia todavia no tiene comidas editables. Hoy se edita el menu actual asignado.</div>
            ) : null}
            {(draft.comidas || []).map((meal, mealIndex) => (
              <EditableMeal
                key={meal.id || mealIndex}
                meal={meal}
                mealIndex={mealIndex}
                editing={editing}
                setEditing={setEditing}
                updateMeal={updateMeal}
                updateItem={updateItem}
                removeItem={removeItem}
                removeMeal={removeMeal}
                openFoodModal={openFoodModal}
                loadEquivalents={loadEquivalents}
                saving={saving}
              />
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}

function EditableMeal({
  meal,
  mealIndex,
  editing,
  setEditing,
  updateMeal,
  updateItem,
  removeItem,
  removeMeal,
  openFoodModal,
  loadEquivalents,
  saving,
}) {
  return (
    <section className="ma-mealPro">
      <div className="ma-mealProHead">
        <div>
          <input
            className="ma-titleInput"
            value={meal.nombre || ""}
            onChange={(event) => updateMeal(mealIndex, { nombre: event.target.value })}
          />
          <p>{macroSentence(meal.totales)}</p>
        </div>
        <div className="ma-rowActions">
          <button className="ma-btn" type="button" onClick={() => openFoodModal({ mealIndex })}>
            <Plus size={16} />
            Alimento
          </button>
          <button className="ma-btn icon danger" type="button" onClick={() => removeMeal(mealIndex)} aria-label="Eliminar comida">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="ma-foodListPro">
        {(meal.items || []).map((item, itemIndex) => {
          const key = `${mealIndex}-${itemIndex}`;
          const isEditing = editing === key;
          return (
            <article className={`ma-foodItem ${isEditing ? "editing" : ""}`} key={item.id || key}>
              <div className="ma-foodMain">
                <div>
                  <strong>{item.nombreSnapshot}</strong>
                  <span>{formatAmount(item)} · {macroSentence(item)}</span>
                  {item.notas ? <small>{item.notas}</small> : null}
                  {item.locked ? <small className="ma-lockText">Bloqueado para reemplazos automaticos futuros</small> : null}
                </div>
                <div className="ma-miniMacros">
                  <MacroChip label="kcal" value={item.kcal} tone="kcal" />
                  <MacroChip label="P" value={item.proteina} tone="protein" />
                  <MacroChip label="C" value={item.carbs} tone="carbs" />
                  <MacroChip label="G" value={item.grasas} tone="fat" />
                </div>
              </div>

              {isEditing ? (
                <ItemEditForm
                  item={item}
                  onChange={(patch) => updateItem(mealIndex, itemIndex, patch)}
                  onCancel={() => setEditing(null)}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="ma-foodActions">
                  <button className="ma-miniBtn" type="button" onClick={() => setEditing(key)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    className="ma-miniBtn"
                    type="button"
                    onClick={() => loadEquivalents(mealIndex, itemIndex)}
                    disabled={saving === `eq-${mealIndex}-${itemIndex}`}
                  >
                    <Replace size={14} />
                    Reemplazar
                  </button>
                  <button
                    className="ma-miniBtn"
                    type="button"
                    onClick={() => updateItem(mealIndex, itemIndex, { locked: !item.locked })}
                  >
                    {item.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    {item.locked ? "Bloq." : "Libre"}
                  </button>
                  <button className="ma-miniBtn danger" type="button" onClick={() => removeItem(mealIndex, itemIndex)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ItemEditForm({ item, onChange, onCancel, onDone }) {
  return (
    <div className="ma-editBox">
      <Field label="Alimento" value={item.nombreSnapshot} onChange={(value) => onChange({ nombreSnapshot: value })} />
      <div className="ma-smallGrid">
        <Field label="Cantidad" value={item.cantidad} onChange={(value) => onChange(rescaleMenuItem(item, value, item.unidad))} />
        <Field label="Unidad" value={item.unidad} onChange={(value) => onChange({ unidad: value })} />
        <Field label="Kcal" value={item.kcal} onChange={(value) => onChange({ kcal: value })} />
        <Field label="P" value={item.proteina} onChange={(value) => onChange({ proteina: value })} />
        <Field label="C" value={item.carbs} onChange={(value) => onChange({ carbs: value })} />
        <Field label="G" value={item.grasas} onChange={(value) => onChange({ grasas: value })} />
      </div>
      <label className="ma-field">
        <span>Notas</span>
        <textarea value={item.notas || ""} onChange={(event) => onChange({ notas: event.target.value })} />
      </label>
      <div className="ma-actions">
        <button className="ma-btn ghost" type="button" onClick={onCancel}>Cancelar</button>
        <button className="ma-btn gold" type="button" onClick={onDone}>Listo</button>
      </div>
    </div>
  );
}

function ClientPreviewOverlay({ draft, day, client, onClose }) {
  return (
    <div className="ma-drawerBackdrop ma-fullscreenBackdrop">
      <div className="ma-clientPreview">
        <div className="ma-editorTop">
          <div>
            <span className="ma-pill gold">
              <Eye size={14} />
              Vista cliente
            </span>
            <h3 className="ma-title">{day?.name || "Menu actual"}</h3>
            <p className="ma-sub">{clientName(client)} · {formatNumber(day?.totals?.kcal, 0)} kcal</p>
          </div>
          <button type="button" className="ma-btn icon" onClick={onClose} aria-label="Cerrar preview">
            <X size={18} />
          </button>
        </div>

        {draft.notasCoach ? (
          <div className="ma-note">
            <strong>Nota del coach</strong>
            <span>{draft.notasCoach}</span>
          </div>
        ) : null}

        <div className="ma-clientMeals">
          {(day?.comidas || []).map((meal, index) => (
            <MealCardCompact meal={meal} key={meal.id || index} clientView />
          ))}
        </div>
      </div>
    </div>
  );
}

function MealCardCompact({ meal, clientView = false }) {
  return (
    <section className={`ma-mealCard ${clientView ? "client" : ""}`}>
      <div className="ma-mealCardHead">
        <div>
          <h5>{meal.nombre}</h5>
          <p>{macroSentence(meal.totales)}</p>
        </div>
        <span>{formatNumber(meal.totales?.kcal, 0)} kcal</span>
      </div>
      <div className="ma-compactFoods">
        {(meal.items || []).map((item, index) => (
          <div className="ma-compactFood" key={item.id || index}>
            <div>
              <strong>{item.nombreSnapshot}</strong>
              <span>{formatAmount(item)} · {macroSentence(item)}</span>
            </div>
            <div className="ma-miniMacros">
              <MacroChip label="P" value={item.proteina} tone="protein" />
              <MacroChip label="C" value={item.carbs} tone="carbs" />
              <MacroChip label="G" value={item.grasas} tone="fat" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MacroBox({ label, value, target, diff, suffix = "", tone = "" }) {
  const abs = Math.abs(Number(diff || 0));
  const ok = abs <= (label === "Kcal" ? 60 : 8);
  return (
    <div className={`ma-macro ${ok ? "good" : "warn"} ${tone}`}>
      <span>{label}</span>
      <strong>{formatNumber(value, 1)}{suffix}</strong>
      <small>Obj. {formatNumber(target, 1)}{suffix} · {formatMacroDiff(diff, suffix)}</small>
    </div>
  );
}

function MacroChip({ label, value, tone }) {
  return <span className={`ma-macroChip ${tone}`}>{label} {formatNumber(value, 1)}</span>;
}

function Field({ label, value, onChange, type = "input", options = [] }) {
  return (
    <label className="ma-field">
      <span>{label}</span>
      {type === "select" ? (
        <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
          {options.map(([optionValue, optionLabel]) => (
            <option value={optionValue} key={optionValue}>{optionLabel}</option>
          ))}
        </select>
      ) : (
        <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function FoodModal({ foods, loading, search, onSearch, onPick, onClose }) {
  return (
    <div className="ma-drawerBackdrop">
      <div className="ma-drawer">
        <div className="ma-head">
          <div>
            <span className="ma-pill gold">
              <Search size={14} />
              Biblioteca
            </span>
            <h3 className="ma-title">Elegir alimento</h3>
          </div>
          <button type="button" className="ma-btn icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <label className="ma-field">
          <span>Buscar</span>
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Arroz, pollo, yogur..." />
        </label>
        {loading ? <div className="ma-empty">Cargando alimentos...</div> : null}
        <div className="ma-foodGrid">
          {foods.map((food) => (
            <button className="ma-foodCard" type="button" key={food.id} onClick={() => onPick(food)}>
              <strong>{food.name}</strong>
              <span>{formatNumber(food.kcal, 1)} kcal · {formatNumber(food.protein, 1)}P / {formatNumber(food.carbs, 1)}C / {formatNumber(food.fat, 1)}G</span>
              <span>{food.macroGroup || food.source}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EquivalentsModal({ data, item, onPick, onClose }) {
  const options = data?.equivalentes || [];
  return (
    <div className="ma-drawerBackdrop">
      <div className="ma-drawer">
        <div className="ma-head">
          <div>
            <span className="ma-pill gold">
              <Replace size={14} />
              Reemplazar alimento
            </span>
            <h3 className="ma-title">{item?.nombreSnapshot}</h3>
            <p className="ma-sub">{formatAmount(item)} · {macroSentence(item)}</p>
          </div>
          <button type="button" className="ma-btn icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {options.length ? (
          <div className="ma-foodGrid">
            {options.map((eq) => (
              <button className="ma-foodCard eq" type="button" key={`${eq.id}-${eq.cantidadSugerida}`} onClick={() => onPick(eq)}>
                <strong>{eq.nombre}</strong>
                <span>{formatNumber(eq.cantidadSugerida)} {eq.unidadSugerida || eq.unidad} sugeridos</span>
                <span>{formatNumber(eq.totales?.kcal, 1)} kcal · {formatNumber(eq.totales?.proteina, 1)}P / {formatNumber(eq.totales?.carbs, 1)}C / {formatNumber(eq.totales?.grasas, 1)}G</span>
                <small>Dif. {formatMacroDiff(eq.diferencia?.kcal)} kcal · P {formatMacroDiff(eq.diferencia?.proteina, " g")}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="ma-empty">No encontre equivalencias buenas para este alimento.</div>
        )}
      </div>
    </div>
  );
}

function buildWeekDays(menu) {
  if (!menu) return [];
  const current = {
    key: "actual",
    name: dayNameFromDate(menu.fechaInicio) || "Dia actual",
    status: menu.estado || "activo",
    available: true,
    real: !Array.isArray(menu.dias),
    comidas: menu.comidas || [],
    totals: menu.totalesActuales || totalsForMeals(menu.comidas || []),
  };

  const hasDays = Array.isArray(menu.dias) && menu.dias.length;
  if (hasDays) {
    return menu.dias.slice(0, 7).map((day, index) => {
      const comidas = Array.isArray(day.comidas) ? day.comidas : [];
      return {
        key: day.id || `day-${index}`,
        name: day.nombre || WEEK_DAYS[index] || `Dia ${index + 1}`,
        status: day.estado || "activo",
        available: comidas.length > 0,
        real: true,
        comidas,
        totals: day.totales || totalsForMeals(comidas),
      };
    });
  }

  return WEEK_DAYS.map((name, index) => {
    if (index === 0) return { ...current, key: "day-0", name: dayNameFromDate(menu.fechaInicio) || name };
    return {
      key: `day-${index}`,
      name,
      status: index >= 5 ? "flexible" : "pendiente",
      available: false,
      real: false,
      comidas: [],
      totals: { kcal: 0, proteina: 0, carbs: 0, grasas: 0 },
    };
  });
}

function totalsForMeals(meals = []) {
  return meals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + Number(meal.totales?.kcal || 0),
      proteina: acc.proteina + Number(meal.totales?.proteina || 0),
      carbs: acc.carbs + Number(meal.totales?.carbs || 0),
      grasas: acc.grasas + Number(meal.totales?.grasas || 0),
    }),
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
  );
}

function periodLabel(menu) {
  const start = formatDate(menu?.fechaInicio);
  const end = formatDate(menu?.fechaFin);
  if (start && end) return `${start} al ${end}`;
  if (start) return `Semana desde ${start}`;
  return "Periodo semanal";
}

function dayNameFromDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const day = date.getDay();
  const mondayFirst = day === 0 ? 6 : day - 1;
  return WEEK_DAYS[mondayFirst] || "";
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatAmount(item = {}) {
  return `${formatNumber(item.cantidad, 1)} ${item.unidad || "g"}`;
}

function macroSentence(macros = {}) {
  return `${formatNumber(macros.kcal, 0)} kcal · P ${formatNumber(macros.proteina, 1)} · C ${formatNumber(macros.carbs, 1)} · G ${formatNumber(macros.grasas, 1)}`;
}

function clientName(client) {
  return `${client?.profile?.nombre || ""} ${client?.profile?.apellido || ""}`.trim() || client?.email || "Cliente";
}
