import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit3,
  Loader2,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { apiFetch } from "../Api.js";
import { buildMenuItemSnapshot, formatNumber } from "../nutricion/nutricionUtils.js";
import {
  activateClientMenu,
  createClientMenu,
  deactivateClientMenu,
  deleteClientMenu,
  duplicateClientMenu,
  getClientMenu,
  listClientMenus,
  updateClientMenu,
} from "./clientMenusApi.js";

const MEAL_TYPES = [
  ["desayuno", "Desayuno"],
  ["almuerzo", "Almuerzo"],
  ["merienda", "Merienda"],
  ["cena", "Cena"],
  ["snack", "Snack"],
  ["otra", "Otra"],
];

const DAYS = [
  ["monday", "Lun"],
  ["tuesday", "Mar"],
  ["wednesday", "Mie"],
  ["thursday", "Jue"],
  ["friday", "Vie"],
  ["saturday", "Sab"],
  ["sunday", "Dom"],
];

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyMeal(type = "almuerzo") {
  return {
    id: uid("meal"),
    nombre: MEAL_TYPES.find(([value]) => value === type)?.[1] || "Comida",
    tipoComida: type,
    orden: 1,
    items: [],
  };
}

function emptyDraft() {
  return {
    nombre: "Mi menu",
    descripcion: "",
    selectedDays: DAYS.map(([key]) => key),
    comidas: [emptyMeal("desayuno"), emptyMeal("almuerzo"), emptyMeal("cena")].map((meal, index) => ({
      ...meal,
      orden: index + 1,
    })),
  };
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function itemTotals(items = []) {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + toNumber(item.kcal),
      proteina: acc.proteina + toNumber(item.proteina),
      carbs: acc.carbs + toNumber(item.carbs),
      grasas: acc.grasas + toNumber(item.grasas),
    }),
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
  );
}

function menuTotals(menu = {}) {
  return (menu.comidas || []).reduce((acc, meal) => {
    const totals = meal.totales || itemTotals(meal.items || []);
    return {
      kcal: acc.kcal + toNumber(totals.kcal),
      proteina: acc.proteina + toNumber(totals.proteina),
      carbs: acc.carbs + toNumber(totals.carbs),
      grasas: acc.grasas + toNumber(totals.grasas),
    };
  }, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

function normalizeMenuForDraft(menu = {}) {
  const comidas = (Array.isArray(menu.comidas) ? menu.comidas : []).map((meal, index) => ({
    id: meal.id || uid("meal"),
    nombre: meal.nombre || `Comida ${index + 1}`,
    tipoComida: meal.tipoComida || "otra",
    orden: meal.orden || index + 1,
    items: (Array.isArray(meal.items) ? meal.items : []).map((item) => ({
      ...item,
      id: item.id || uid("item"),
    })),
  }));

  return {
    id: menu.id || menu._id,
    nombre: menu.nombre || "Mi menu",
    descripcion: menu.descripcion || "",
    selectedDays: Object.keys(menu.dias || {}).length ? Object.keys(menu.dias) : DAYS.map(([key]) => key),
    comidas: comidas.length ? comidas : [emptyMeal()],
  };
}

function defaultQuantity(unit = "") {
  const normalized = String(unit || "").toLowerCase();
  return ["unidad", "u", "porcion"].some((part) => normalized.includes(part)) ? 1 : 100;
}

function rescaleItem(item = {}, nextCantidad = item.cantidad) {
  const currentQty = Math.max(toNumber(item.cantidad, 0), 0.0001);
  const nextQty = Math.max(toNumber(nextCantidad, 0), 0);
  const factor = nextQty / currentQty;
  return {
    ...item,
    cantidad: nextQty,
    kcal: Math.round(toNumber(item.kcal) * factor * 10) / 10,
    proteina: Math.round(toNumber(item.proteina) * factor * 10) / 10,
    carbs: Math.round(toNumber(item.carbs) * factor * 10) / 10,
    grasas: Math.round(toNumber(item.grasas) * factor * 10) / 10,
  };
}

export default function ClientMenusPanel({ onToast, createSignal = 0, editMenuRequest = null }) {
  const [menus, setMenus] = useState([]);
  const [capabilities, setCapabilities] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const savingRef = useRef(false);
  const loadSeq = useRef(0);
  const handledCreateSignal = useRef(0);
  const handledEditToken = useRef(null);

  const loadMenus = useCallback(async () => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setError("");
    try {
      const data = await listClientMenus({ includeComidas: true, limit: 40, search: debouncedSearch });
      if (loadSeq.current !== seq) return;
      setMenus(data?.items || []);
      setCapabilities(data?.capabilities || null);
      setPagination(data?.pagination || null);
      setActiveMenu(data?.activeMenu || null);
    } catch (err) {
      if (loadSeq.current !== seq) return;
      setError(err?.message || "No se pudieron cargar tus menus.");
    } finally {
      if (loadSeq.current === seq) setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!createSignal || handledCreateSignal.current === createSignal) return;
    handledCreateSignal.current = createSignal;
    setEditor({ mode: "create", draft: emptyDraft() });
  }, [createSignal]);

  useEffect(() => {
    const requestId = editMenuRequest?.id ? String(editMenuRequest.id) : "";
    const token = editMenuRequest?.token || requestId;
    if (!requestId || handledEditToken.current === token || loading) return;
    const localMenu = menus.find((menu) => String(menu.id) === requestId || String(menu._id) === requestId);

    async function openRequestedMenu() {
      handledEditToken.current = token;
      try {
        const menu = localMenu || await getClientMenu(requestId);
        if (menu) setEditor({ mode: "edit", draft: normalizeMenuForDraft(menu) });
      } catch (err) {
        onToast?.({ type: "error", message: err?.message || "No pudimos abrir ese menu." });
      }
    }

    openRequestedMenu();
  }, [editMenuRequest, loading, menus, onToast]);

  const limitText = useMemo(() => {
    const total = pagination?.total ?? menus.length;
    const limit = capabilities?.limits?.ownMenus;
    return Number.isFinite(Number(limit)) ? `${total} de ${limit} menus` : `${total} menus`;
  }, [capabilities, menus.length, pagination]);

  async function runAction(fn, successMessage) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await fn();
      if (successMessage) onToast?.({ type: "success", message: successMessage });
      await loadMenus();
    } catch (err) {
      onToast?.({ type: "error", message: err?.error || err?.message || "No se pudo completar la accion." });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function openCreate() {
    setEditor({ mode: "create", draft: emptyDraft() });
  }

  function openEdit(menu) {
    setEditor({ mode: "edit", draft: normalizeMenuForDraft(menu) });
  }

  async function handleSave(draft, activate = false) {
    await runAction(async () => {
      const payload = { ...draft, activate };
      if (editor.mode === "edit" && draft.id) await updateClientMenu(draft.id, payload);
      else await createClientMenu(payload);
      setEditor(null);
    }, activate ? "Menu guardado y activado." : "Menu guardado.");
  }

  async function handleDelete(menu) {
    const active = !!menu.isActiveOwnMenu;
    const ok = window.confirm(active
      ? "Este es tu menu activo. Si lo eliminas tambien se desactiva tu planificacion propia. Continuar?"
      : `Eliminar "${menu.nombre}"?`);
    if (!ok) return;
    await runAction(() => deleteClientMenu(menu.id, { confirmActiveDelete: active }), "Menu eliminado.");
  }

  return (
    <section className="client-menus">
      <header className="client-menus-head">
        <div>
          <span className="nl-kicker">Planificacion propia</span>
          <h2>Mis menus</h2>
          <p>Crealos, editalos y activa uno como tu planificacion. Tracking sigue disponible siempre.</p>
        </div>
        <div className="client-menus-actions">
          <span className="client-limit">{limitText}</span>
          <button type="button" className="nl-primary" onClick={openCreate} disabled={saving || capabilities?.canCreateOwnMenu === false}>
            <Plus size={16} />
            Crear menu
          </button>
        </div>
      </header>

      <label className="client-menu-search">
        <Search size={16} />
        <span className="sr-only">Buscar menu propio</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar en mis menus"
          aria-label="Buscar en mis menus"
        />
      </label>

      {capabilities?.hasCoach && capabilities?.activeMenuSource === "coach" ? (
        <div className="client-menu-warning">
          <AlertTriangle size={17} />
          <span>Tenes un menu activo asignado por tu coach. Podes guardar menus propios, pero no activarlos mientras ese plan este vigente.</span>
        </div>
      ) : null}

      {activeMenu ? (
        <div className="client-active-strip">
          <CheckCircle2 size={17} />
          <span>Menu propio activo: <strong>{activeMenu.nombre}</strong></span>
          <button type="button" onClick={() => runAction(deactivateClientMenu, "Ahora estas usando solo Tracking.")} disabled={saving}>
            Usar solo Tracking
          </button>
        </div>
      ) : null}

      {error ? <div className="nl-state error">{error}</div> : null}
      {loading ? <div className="nl-state"><Loader2 className="nl-spin" size={18} /> Cargando tus menus...</div> : null}

      {!loading && !error && !menus.length ? (
        debouncedSearch ? (
          <div className="client-empty-menu" role="status">
            <Search size={22} />
            <strong>Sin resultados</strong>
            <span>No encontramos menus propios que coincidan con esa busqueda.</span>
          </div>
        ) : (
          <button type="button" className="client-empty-menu" onClick={openCreate}>
            <Plus size={22} />
            <strong>Crear mi primer menu</strong>
            <span>Organiza comidas propias o copia uno de la biblioteca ZumaFit y adaptalo.</span>
          </button>
        )
      ) : null}

      {!loading && menus.length ? (
        <div className="client-menu-grid">
          {menus.map((menu) => (
            <ClientMenuCard
              key={menu.id}
              menu={menu}
              saving={saving}
              capabilities={capabilities}
              canActivate={capabilities?.canActivateOwnMenu !== false && capabilities?.activeMenuSource !== "coach"}
              onEdit={() => openEdit(menu)}
              onActivate={() => runAction(() => activateClientMenu(menu.id), "Menu activado.")}
              onDuplicate={() => runAction(() => duplicateClientMenu(menu.id), "Menu duplicado.")}
              onDelete={() => handleDelete(menu)}
            />
          ))}
        </div>
      ) : null}

      {editor ? (
        <MenuEditor
          mode={editor.mode}
          draft={editor.draft}
          saving={saving}
          canActivate={capabilities?.canActivateOwnMenu !== false && capabilities?.activeMenuSource !== "coach"}
          onClose={() => setEditor(null)}
          onSave={handleSave}
        />
      ) : null}
    </section>
  );
}

function ClientMenuCard({ menu, saving, capabilities, canActivate, onEdit, onActivate, onDuplicate, onDelete }) {
  const totals = menu.macrosTotales || menuTotals(menu);
  const dayCount = Object.keys(menu.dias || {}).length || menu.selectedDays?.length || 0;
  const updatedAt = menu.updatedAt ? new Date(menu.updatedAt) : null;
  const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime())
    ? updatedAt.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
    : "Sin fecha";
  return (
    <article className={`client-menu-card ${menu.isActiveOwnMenu ? "active" : ""}`}>
      <div className="client-card-top">
        <div>
          <span className="client-badge">{menu.isActiveOwnMenu ? "Activo" : menu.source === "copied_from_admin" ? "Copia ZumaFit" : "Propio"}</span>
          <h3>{menu.nombre}</h3>
        </div>
        {menu.isActiveOwnMenu ? <CheckCircle2 size={22} /> : null}
      </div>
      <p>{menu.descripcion || "Menu personal guardado en tu biblioteca."}</p>
      <div className="client-menu-macros">
        <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
        <span>P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}</span>
      </div>
      <small>
        {dayCount ? `${dayCount} dias - ` : ""}
        {formatNumber(menu.cantidadComidas || menu.comidas?.length || 0, 0)} comidas - Act. {updatedLabel}
      </small>
      <div className="client-card-actions">
        {capabilities?.canActivateOwnMenu !== false ? (
          <button type="button" onClick={onActivate} disabled={saving || menu.isActiveOwnMenu || !canActivate}>
            <Power size={15} />
            Activar
          </button>
        ) : null}
        {capabilities?.canEditOwnMenu !== false ? (
          <button type="button" onClick={onEdit} disabled={saving}>
            <Edit3 size={15} />
            Editar
          </button>
        ) : null}
        {capabilities?.canDuplicateOwnMenu !== false ? (
          <button type="button" onClick={onDuplicate} disabled={saving}>
            <Copy size={15} />
            Duplicar
          </button>
        ) : null}
        {capabilities?.canDeleteOwnMenu !== false ? (
          <button type="button" className="danger" onClick={onDelete} disabled={saving}>
            <Trash2 size={15} />
            Eliminar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MenuEditor({ mode, draft: initialDraft, saving, canActivate, onClose, onSave }) {
  const [draft, setDraft] = useState(initialDraft);
  const totals = useMemo(() => menuTotals(draft), [draft]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  function updateMeal(mealId, patch) {
    setDraft((current) => ({
      ...current,
      comidas: current.comidas.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)),
    }));
  }

  function addMeal(type = "snack") {
    setDraft((current) => ({
      ...current,
      comidas: [
        ...current.comidas,
        {
          ...emptyMeal(type),
          orden: current.comidas.length + 1,
        },
      ],
    }));
  }

  function removeMeal(mealId) {
    setDraft((current) => ({
      ...current,
      comidas: current.comidas.filter((meal) => meal.id !== mealId).map((meal, index) => ({ ...meal, orden: index + 1 })),
    }));
  }

  function toggleDay(dayKey) {
    setDraft((current) => {
      const exists = current.selectedDays.includes(dayKey);
      const selectedDays = exists
        ? current.selectedDays.filter((day) => day !== dayKey)
        : [...current.selectedDays, dayKey];
      return { ...current, selectedDays: selectedDays.length ? selectedDays : [dayKey] };
    });
  }

  return (
    <section className="nl-modal" role="dialog" aria-modal="true">
      <div className="client-editor">
        <header>
          <div>
            <span className="nl-kicker">{mode === "edit" ? "Editar menu" : "Nuevo menu"}</span>
            <h2>{draft.nombre || "Mi menu"}</h2>
          </div>
          <button type="button" className="nl-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="client-editor-grid">
          <label>
            Nombre
            <input
              value={draft.nombre}
              maxLength={180}
              onChange={(event) => setDraft({ ...draft, nombre: event.target.value })}
              aria-label="Nombre del menu"
            />
          </label>
          <label>
            Descripcion
            <input
              value={draft.descripcion}
              maxLength={2500}
              onChange={(event) => setDraft({ ...draft, descripcion: event.target.value })}
              aria-label="Descripcion del menu"
            />
          </label>
        </div>

        <div className="client-days">
          {DAYS.map(([key, label]) => (
            <button key={key} type="button" className={draft.selectedDays.includes(key) ? "active" : ""} onClick={() => toggleDay(key)}>
              {label}
            </button>
          ))}
        </div>

        <div className="client-editor-summary">
          <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
          <span>P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}</span>
        </div>

        <div className="client-meal-list">
          {draft.comidas.map((meal) => (
            <MealEditor
              key={meal.id}
              meal={meal}
              onChange={(patch) => updateMeal(meal.id, patch)}
              onRemove={() => removeMeal(meal.id)}
            />
          ))}
        </div>

        <button type="button" className="client-add-meal" onClick={() => addMeal("snack")}>
          <Plus size={16} />
          Agregar comida
        </button>

        <footer>
          <button type="button" className="nl-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="nl-secondary" onClick={() => onSave(draft, false)} disabled={saving}>
            {saving ? <Loader2 size={15} className="nl-spin" /> : <CheckCircle2 size={15} />}
            Guardar
          </button>
          <button type="button" className="nl-primary" onClick={() => onSave(draft, true)} disabled={saving || !canActivate}>
            <Power size={15} />
            Guardar y activar
          </button>
        </footer>
      </div>
    </section>
  );
}

function MealEditor({ meal, onChange, onRemove }) {
  const totals = itemTotals(meal.items || []);

  function addFood(food) {
    const unit = food.Unidad || food.unidad || food.unit || "g";
    const quantity = defaultQuantity(unit);
    const snapshot = buildMenuItemSnapshot(food, quantity, unit);
    onChange({
      items: [
        ...(meal.items || []),
        {
          ...snapshot,
          id: uid("item"),
        },
      ],
    });
  }

  function updateItem(itemId, patch) {
    onChange({
      items: (meal.items || []).map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  }

  function removeItem(itemId) {
    onChange({ items: (meal.items || []).filter((item) => item.id !== itemId) });
  }

  return (
    <article className="client-meal-editor">
      <div className="client-meal-row">
        <select
          value={meal.tipoComida}
          onChange={(event) => {
            const label = MEAL_TYPES.find(([value]) => value === event.target.value)?.[1] || meal.nombre;
            onChange({ tipoComida: event.target.value, nombre: label });
          }}
        >
          {MEAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={meal.nombre} onChange={(event) => onChange({ nombre: event.target.value })} />
        <button type="button" className="nl-icon" onClick={onRemove} aria-label="Eliminar comida">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="client-meal-mini">
        {formatNumber(totals.kcal, 0)} kcal - P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}
      </div>

      <FoodPicker onPick={addFood} />

      <div className="client-food-lines">
        {(meal.items || []).map((item) => (
          <div key={item.id} className="client-food-line">
            <div>
              <strong>{item.nombreSnapshot}</strong>
              <span>{formatNumber(item.kcal, 0)} kcal - P {formatNumber(item.proteina, 0)} - C {formatNumber(item.carbs, 0)} - G {formatNumber(item.grasas, 0)}</span>
            </div>
            <input
              type="number"
              min="0"
              value={item.cantidad}
              onChange={(event) => updateItem(item.id, rescaleItem(item, event.target.value))}
            />
            <small>{item.unidad}</small>
            <button type="button" onClick={() => removeItem(item.id)} aria-label="Eliminar alimento">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}

function FoodPicker({ onPick }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (search.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await apiFetch(`/api/alimentos?search=${encodeURIComponent(search.trim())}&limit=8`, {
          method: "GET",
          timeoutMs: 9000,
        });
        if (active) setResults(Array.isArray(data) ? data : data?.alimentos || []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="client-food-picker">
      <label>
        <Search size={15} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alimento para agregar" />
        {loading ? <Loader2 size={15} className="nl-spin" /> : null}
      </label>
      {results.length ? (
        <div className="client-food-results">
          {results.map((food, index) => {
            const id = String(food._id || food.id || food.Alimentos || food.nombre || index);
            const name = food.Alimentos || food.nombre || food.name || "Alimento";
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onPick(food);
                  setSearch("");
                  setResults([]);
                }}
              >
                <span>{name}</span>
                <small>{food.Unidad || food.unidad || "g"}</small>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
