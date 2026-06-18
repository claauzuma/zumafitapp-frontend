import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  Utensils,
  X,
} from "lucide-react";

import { listAlimentos } from "../nutricion/nutricionApi.js";
import { buildMenuItemSnapshot, formatNumber, getFoodImageUrl } from "../nutricion/nutricionUtils.js";
import { getProfessionalClients } from "../profesional/profesionalApi.js";
import AppToast from "../ui/AppToast.jsx";
import {
  addSavedMealToTracking,
  assignProfessionalMealTemplate,
  createProfessionalMealTemplate,
  createSavedMeal,
  deleteSavedMeal,
  duplicateSavedMeal,
  listProfessionalMealTemplates,
  listSavedMeals,
  toggleSavedMealFavorite,
  updateProfessionalMealTemplate,
  updateSavedMeal,
} from "./savedMealsApi.js";
import "./savedMeals.css";

const MEAL_TYPES = [
  { value: "todos", label: "Todas" },
  { value: "desayuno", label: "Desayuno" },
  { value: "almuerzo", label: "Almuerzo" },
  { value: "merienda", label: "Merienda" },
  { value: "cena", label: "Cena" },
  { value: "snack", label: "Snack" },
];

const EDITOR_EMPTY = {
  nombre: "",
  descripcion: "",
  tipoComida: "almuerzo",
  tags: "",
  favorita: false,
  items: [],
};

function todayLocalString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mealId(meal = {}) {
  return String(meal.id || meal._id || "");
}

function itemName(item = {}) {
  return item.nombre || item.nombreSnapshot || item.name || "Alimento";
}

function itemImage(item = {}) {
  return item.imagenUrl || item.imageUrl || item.imagen?.url || getFoodImageUrl(item);
}

function itemTotals(item = {}) {
  return {
    kcal: Number(item.kcal || 0),
    proteina: Number(item.proteina ?? item.proteinas ?? 0),
    carbs: Number(item.carbs ?? item.carbohidratos ?? 0),
    grasas: Number(item.grasas ?? 0),
    fibra: Number(item.fibra ?? 0),
  };
}

function mealTotals(meal = {}) {
  const totals = meal.totales || {};
  return {
    kcal: Number(totals.kcal || 0),
    proteina: Number(totals.proteina ?? totals.proteinas ?? 0),
    carbs: Number(totals.carbs ?? totals.carbohidratos ?? 0),
    grasas: Number(totals.grasas ?? 0),
    fibra: Number(totals.fibra ?? 0),
  };
}

function totalItems(items = []) {
  return items.reduce(
    (acc, item) => {
      const totals = itemTotals(item);
      return {
        kcal: acc.kcal + totals.kcal,
        proteina: acc.proteina + totals.proteina,
        carbs: acc.carbs + totals.carbs,
        grasas: acc.grasas + totals.grasas,
        fibra: acc.fibra + totals.fibra,
      };
    },
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0, fibra: 0 }
  );
}

function macroLine(totals = {}) {
  return `P ${formatNumber(totals.proteina, 0)} g · C ${formatNumber(totals.carbs, 0)} g · G ${formatNumber(totals.grasas, 0)} g`;
}

function normalizeEditorMeal(meal = null) {
  if (!meal) return { ...EDITOR_EMPTY, items: [] };
  return {
    id: mealId(meal),
    nombre: meal.nombre || "",
    descripcion: meal.descripcion || "",
    tipoComida: meal.tipoComida || "almuerzo",
    tags: Array.isArray(meal.tags) ? meal.tags.join(", ") : "",
    favorita: !!meal.favorita,
    items: (Array.isArray(meal.items) ? meal.items : []).map((item, index) => ({
      id: String(item.alimentoId || item.id || `${itemName(item)}-${index}`),
      alimentoId: item.alimentoId || item.alimentoObjectId || "",
      nombre: itemName(item),
      cantidad: item.cantidad || 100,
      unidad: item.unidad || "g",
      kcal: item.kcal || 0,
      proteina: item.proteina ?? item.proteinas ?? 0,
      carbs: item.carbs ?? item.carbohidratos ?? 0,
      grasas: item.grasas || 0,
      fibra: item.fibra || 0,
      categoria: item.categoria || item.categoriaSnapshot || "",
      imagenUrl: itemImage(item),
      imagenAlt: item.imagenAlt || item.nombre || "",
    })),
  };
}

function editorPayload(editor = {}) {
  return {
    nombre: editor.nombre,
    descripcion: editor.descripcion,
    tipoComida: editor.tipoComida,
    tags: String(editor.tags || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 24),
    favorita: !!editor.favorita,
    items: (editor.items || []).map((item) => ({
      alimentoId: item.alimentoId || item.id,
      nombre: item.nombre,
      cantidad: Number(item.cantidad) || 0,
      unidad: item.unidad || "g",
      kcal: item.kcal,
      proteina: item.proteina,
      proteinas: item.proteina,
      carbs: item.carbs,
      carbohidratos: item.carbs,
      grasas: item.grasas,
      fibra: item.fibra,
      categoria: item.categoria,
      imagenUrl: item.imagenUrl,
      imagenAlt: item.imagenAlt,
    })),
  };
}

function canEditMeal(meal = {}, mode = "client") {
  if (mode === "professional") return meal.ownerType === "coach" || meal.ownerType === "admin";
  return meal.ownerType === "user" || meal.ownerType === "cliente" || meal.ownerType === "client";
}

export default function SavedMealsPage({ mode = "client" }) {
  const professionalMode = mode === "professional";
  const [scope, setScope] = useState(professionalMode ? "templates" : "mine");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [trackingDate, setTrackingDate] = useState(todayLocalString());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState(() => normalizeEditorMeal());
  const [detailMeal, setDetailMeal] = useState(null);
  const [assignMeal, setAssignMeal] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  const title = professionalMode ? "Plantillas de comidas" : "Mis comidas";
  const subtitle = professionalMode ? "Biblioteca profesional" : "Biblioteca personal";

  useEffect(() => {
    loadMeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, type, favoriteOnly]);

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

  async function loadMeals() {
    setLoading(true);
    setError("");
    try {
      const filters = {
        scope,
        search,
        tipoComida: type,
        favorita: favoriteOnly ? true : "",
        limit: 80,
      };
      const data = professionalMode
        ? await listProfessionalMealTemplates(filters)
        : await listSavedMeals(filters);
      setMeals(data?.comidas || []);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar las comidas.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditor(normalizeEditorMeal());
    setEditorOpen(true);
  }

  function openEdit(meal) {
    setEditor(normalizeEditorMeal(meal));
    setEditorOpen(true);
  }

  async function saveEditor() {
    if (saving) return;
    if (!editor.nombre.trim()) {
      setToast({ type: "warning", message: "Ingresa un nombre." });
      return;
    }
    if (!editor.items.length) {
      setToast({ type: "warning", message: "Agrega al menos un alimento." });
      return;
    }
    if (editor.items.some((item) => Number(item.cantidad) <= 0)) {
      setToast({ type: "warning", message: "Revisa las cantidades." });
      return;
    }

    setSaving(true);
    try {
      const payload = editorPayload(editor);
      if (editor.id) {
        if (professionalMode) await updateProfessionalMealTemplate(editor.id, payload);
        else await updateSavedMeal(editor.id, payload);
      } else if (professionalMode) {
        await createProfessionalMealTemplate(payload);
      } else {
        await createSavedMeal(payload);
      }
      setEditorOpen(false);
      setToast({ type: "success", message: "Comida guardada." });
      await loadMeals();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(meal) {
    if (!mealId(meal) || saving) return;
    setSaving(true);
    try {
      await deleteSavedMeal(mealId(meal));
      setToast({ type: "success", message: "Comida eliminada." });
      await loadMeals();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo eliminar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(meal) {
    if (!mealId(meal) || saving) return;
    setSaving(true);
    try {
      await duplicateSavedMeal(mealId(meal), { nombre: `Copia de ${meal.nombre || "comida"}` });
      setToast({ type: "success", message: "Copia creada." });
      await loadMeals();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo duplicar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleFavorite(meal) {
    if (!mealId(meal) || saving) return;
    setSaving(true);
    try {
      await toggleSavedMealFavorite(mealId(meal));
      await loadMeals();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo marcar favorita." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddToTracking(meal) {
    if (!mealId(meal) || saving) return;
    setSaving(true);
    try {
      await addSavedMealToTracking(mealId(meal), {
        date: trackingDate,
        mealType: meal.tipoComida || "snack",
      });
      setToast({ type: "success", message: "Comida agregada al tracking." });
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo agregar al tracking." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!assignMeal || !selectedClientIds.length || saving) return;
    setSaving(true);
    try {
      await assignProfessionalMealTemplate(mealId(assignMeal), selectedClientIds);
      setToast({ type: "success", message: "Comida asignada." });
      setAssignMeal(null);
      setSelectedClientIds([]);
      await loadMeals();
    } catch (err) {
      setToast({ type: "error", message: err?.message || "No se pudo asignar." });
    } finally {
      setSaving(false);
    }
  }

  const filteredMeals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return meals;
    return meals.filter((meal) => {
      const text = `${meal.nombre || ""} ${meal.descripcion || ""} ${(meal.tags || []).join(" ")} ${(meal.items || []).map(itemName).join(" ")}`.toLowerCase();
      return text.includes(term);
    });
  }, [meals, search]);

  return (
    <div className="sm-page">
      <section className="sm-shell">
        <header className="sm-top">
          <div>
            <span className="sm-kicker"><Utensils size={15} /> {subtitle}</span>
            <h1>{title}</h1>
          </div>
          <button type="button" className="sm-primary" onClick={openCreate}>
            <Plus size={17} />
            Nueva comida
          </button>
        </header>

        <section className="sm-toolbar">
          {!professionalMode ? (
            <div className="sm-tabs" role="tablist">
              <button type="button" className={scope === "mine" ? "active" : ""} onClick={() => setScope("mine")}>Mis comidas</button>
              <button type="button" className={scope === "assigned" ? "active" : ""} onClick={() => setScope("assigned")}>Comidas del coach</button>
            </div>
          ) : null}
          <label className="sm-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadMeals()} placeholder="Buscar comida" />
          </label>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {MEAL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="button" className={`sm-filter ${favoriteOnly ? "active" : ""}`} onClick={() => setFavoriteOnly((value) => !value)}>
            <Star size={15} fill={favoriteOnly ? "currentColor" : "none"} />
            Favoritas
          </button>
          {!professionalMode ? (
            <label className="sm-date">
              <span>Tracking</span>
              <input type="date" value={trackingDate} onChange={(event) => setTrackingDate(event.target.value)} />
            </label>
          ) : null}
          <button type="button" className="sm-filter" onClick={loadMeals} disabled={loading}>
            {loading ? <Loader2 size={15} className="sm-spin" /> : <Search size={15} />}
            Aplicar
          </button>
        </section>

        {error ? <div className="sm-error">{error}</div> : null}
        {loading ? <div className="sm-empty"><Loader2 className="sm-spin" size={18} /> Cargando comidas...</div> : null}
        {!loading && !filteredMeals.length ? <div className="sm-empty">No hay comidas para esos filtros.</div> : null}

        <section className="sm-grid">
          {filteredMeals.map((meal) => (
            <SavedMealCard
              key={mealId(meal)}
              meal={meal}
              editable={canEditMeal(meal, mode)}
              professionalMode={professionalMode}
              saving={saving}
              onAddToTracking={handleAddToTracking}
              onView={setDetailMeal}
              onEdit={openEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onFavorite={handleFavorite}
              onAssign={(item) => {
                setAssignMeal(item);
                setSelectedClientIds([]);
              }}
            />
          ))}
        </section>
      </section>

      {editorOpen ? (
        <SavedMealEditor
          editor={editor}
          setEditor={setEditor}
          saving={saving}
          professionalMode={professionalMode}
          onClose={() => setEditorOpen(false)}
          onSave={saveEditor}
        />
      ) : null}

      {detailMeal ? (
        <SavedMealDetail
          meal={detailMeal}
          editable={canEditMeal(detailMeal, mode)}
          professionalMode={professionalMode}
          saving={saving}
          onClose={() => setDetailMeal(null)}
          onAddToTracking={handleAddToTracking}
          onEdit={(meal) => {
            setDetailMeal(null);
            openEdit(meal);
          }}
          onDuplicate={handleDuplicate}
          onDelete={(meal) => {
            setDetailMeal(null);
            handleDelete(meal);
          }}
          onFavorite={handleFavorite}
          onAssign={(meal) => {
            setDetailMeal(null);
            setAssignMeal(meal);
            setSelectedClientIds([]);
          }}
        />
      ) : null}

      {assignMeal ? (
        <AssignDrawer
          meal={assignMeal}
          clients={clients}
          selectedClientIds={selectedClientIds}
          setSelectedClientIds={setSelectedClientIds}
          saving={saving}
          onClose={() => setAssignMeal(null)}
          onAssign={handleAssign}
        />
      ) : null}

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function SavedMealCard({ meal, editable, professionalMode, saving, onAddToTracking, onView, onEdit, onDuplicate, onDelete, onFavorite, onAssign }) {
  const totals = mealTotals(meal);
  const items = Array.isArray(meal.items) ? meal.items : [];
  const hidden = Math.max(0, items.length - 3);
  return (
    <article className="sm-card">
      <div className="sm-cardHead">
        <div className="sm-cardTitle">
          <strong>{meal.nombre || "Comida"}</strong>
          <span>{meal.tipoComida || "otro"} · {formatNumber(totals.kcal, 0)} kcal</span>
        </div>
        <button type="button" className={`sm-star ${meal.favorita ? "active" : ""}`} disabled={!editable || saving} onClick={() => onFavorite(meal)} aria-label="Favorita">
          <Star size={18} fill={meal.favorita ? "currentColor" : "none"} />
        </button>
      </div>
      {meal.descripcion ? <p className="sm-desc">{meal.descripcion}</p> : null}
      <div className="sm-macros">{macroLine(totals)}</div>
      <div className="sm-thumbs">
        {items.slice(0, 3).map((item, index) => (
          <FoodThumb key={`${itemName(item)}-${index}`} item={item} />
        ))}
        <span className="sm-foodNames">
          {items.slice(0, 3).map(itemName).join(" · ")}
          {hidden ? ` +${hidden}` : ""}
        </span>
      </div>
      <div className="sm-actions">
        <button type="button" onClick={() => onView(meal)} disabled={saving}>
          <Eye size={15} />
          Detalle
        </button>
        {!professionalMode ? (
          <button type="button" onClick={() => onAddToTracking(meal)} disabled={saving}>
            <CheckCircle2 size={15} />
            Agregar al dia
          </button>
        ) : (
          <button type="button" onClick={() => onAssign(meal)} disabled={saving}>
            <Users size={15} />
            Asignar
          </button>
        )}
        {editable ? (
          <button type="button" onClick={() => onEdit(meal)} disabled={saving}>
            <Edit3 size={15} />
            Editar
          </button>
        ) : (
          <button type="button" onClick={() => onDuplicate(meal)} disabled={saving}>
            <Copy size={15} />
            Guardar copia
          </button>
        )}
        {editable ? (
          <button type="button" onClick={() => onDuplicate(meal)} disabled={saving}>
            <Copy size={15} />
            Duplicar
          </button>
        ) : null}
        {editable ? (
          <button type="button" className="danger" onClick={() => onDelete(meal)} disabled={saving}>
            <Trash2 size={15} />
            Eliminar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SavedMealDetail({ meal, editable, professionalMode, saving, onClose, onAddToTracking, onEdit, onDuplicate, onDelete, onFavorite, onAssign }) {
  const totals = mealTotals(meal);
  const items = Array.isArray(meal.items) ? meal.items : [];

  return (
    <section className="sm-modal" role="dialog" aria-modal="true">
      <div className="sm-detail">
        <header className="sm-editorTop">
          <div>
            <span className="sm-kicker">Detalle</span>
            <h2>{meal.nombre || "Comida guardada"}</h2>
            <p>{meal.tipoComida || "otro"} · {formatNumber(totals.kcal, 0)} kcal</p>
          </div>
          <button type="button" className="sm-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        {meal.descripcion ? <p className="sm-detailDesc">{meal.descripcion}</p> : null}

        <div className="sm-detailTotals">
          <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
          <span>P {formatNumber(totals.proteina, 0)} g</span>
          <span>C {formatNumber(totals.carbs, 0)} g</span>
          <span>G {formatNumber(totals.grasas, 0)} g</span>
          <span>Fibra {formatNumber(totals.fibra, 0)} g</span>
        </div>

        <div className="sm-detailItems">
          {items.map((item, index) => {
            const totalsItem = itemTotals(item);
            return (
              <div className="sm-detailItem" key={`${itemName(item)}-${index}`}>
                <FoodThumb item={item} />
                <div>
                  <strong>{itemName(item)}</strong>
                  <span>{formatNumber(item.cantidad, 1)} {item.unidad || "g"} · {formatNumber(totalsItem.kcal, 0)} kcal</span>
                </div>
                <small>P {formatNumber(totalsItem.proteina, 1)} / C {formatNumber(totalsItem.carbs, 1)} / G {formatNumber(totalsItem.grasas, 1)}</small>
              </div>
            );
          })}
          {!items.length ? <div className="sm-empty compact">Sin alimentos cargados.</div> : null}
        </div>

        <footer className="sm-editorFooter">
          {!professionalMode ? (
            <button type="button" className="sm-primary" onClick={() => onAddToTracking(meal)} disabled={saving}>
              <CheckCircle2 size={17} />
              Agregar al tracking
            </button>
          ) : (
            <button type="button" className="sm-primary" onClick={() => onAssign(meal)} disabled={saving}>
              <Users size={17} />
              Asignar
            </button>
          )}
          {editable ? (
            <button type="button" className="sm-filter" onClick={() => onEdit(meal)} disabled={saving}>
              <Edit3 size={16} />
              Editar
            </button>
          ) : (
            <button type="button" className="sm-filter" onClick={() => onDuplicate(meal)} disabled={saving}>
              <Copy size={16} />
              Guardar copia
            </button>
          )}
          <button type="button" className={`sm-filter ${meal.favorita ? "active" : ""}`} onClick={() => onFavorite(meal)} disabled={!editable || saving}>
            <Star size={16} fill={meal.favorita ? "currentColor" : "none"} />
            Favorita
          </button>
          {editable ? (
            <button type="button" className="sm-filter danger" onClick={() => onDelete(meal)} disabled={saving}>
              <Trash2 size={16} />
              Eliminar
            </button>
          ) : null}
        </footer>
      </div>
    </section>
  );
}

function FoodThumb({ item }) {
  const [failed, setFailed] = useState(false);
  const src = itemImage(item);
  if (failed || !src) return null;
  return (
    <img
      src={src}
      alt={item.imagenAlt || itemName(item)}
      loading="lazy"
      decoding="async"
      width={34}
      height={34}
      onError={() => setFailed(true)}
    />
  );
}

function SavedMealEditor({ editor, setEditor, saving, professionalMode, onClose, onSave }) {
  const [foodSearch, setFoodSearch] = useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const totals = totalItems(editor.items);

  useEffect(() => {
    const term = foodSearch.trim();
    if (term.length < 2) {
      setFoodResults([]);
      return undefined;
    }
    let active = true;
    setLoadingFoods(true);
    const timer = window.setTimeout(() => {
      listAlimentos({ search: term, limit: 12 })
        .then((data) => {
          if (active) setFoodResults((data?.alimentos || data?.all || []).slice(0, 12));
        })
        .catch(() => {
          if (active) setFoodResults([]);
        })
        .finally(() => {
          if (active) setLoadingFoods(false);
        });
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [foodSearch]);

  function addFood(food) {
    const snapshot = buildMenuItemSnapshot(food, 100, food.unidad || food.unit || "g");
    setEditor((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: String(food.id || food._id || food.alimentoId || snapshot.nombreSnapshot),
          alimentoId: food.alimentoId || food.id || food._id,
          nombre: snapshot.nombreSnapshot,
          cantidad: 100,
          unidad: snapshot.unidad,
          kcal: snapshot.kcal,
          proteina: snapshot.proteina,
          carbs: snapshot.carbs,
          grasas: snapshot.grasas,
          fibra: snapshot.fibra || 0,
          categoria: snapshot.categoriaSnapshot,
          imagenUrl: snapshot.imagenUrl || getFoodImageUrl(food),
          imagenAlt: snapshot.imagen?.alt || food.nombre || food.name,
        },
      ],
    }));
    setFoodSearch("");
    setFoodResults([]);
  }

  function updateItem(index, patch) {
    setEditor((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        const quantity = Number(next.cantidad);
        if (Number.isFinite(quantity) && quantity > 0 && item.alimentoId) {
          const ratio = Number(item.cantidad) > 0 ? quantity / Number(item.cantidad) : 1;
          return {
            ...next,
            kcal: Math.round((item.kcal || 0) * ratio * 10) / 10,
            proteina: Math.round((item.proteina || 0) * ratio * 10) / 10,
            carbs: Math.round((item.carbs || 0) * ratio * 10) / 10,
            grasas: Math.round((item.grasas || 0) * ratio * 10) / 10,
            fibra: Math.round((item.fibra || 0) * ratio * 10) / 10,
          };
        }
        return next;
      }),
    }));
  }

  function removeItem(index) {
    setEditor((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  return (
    <section className="sm-modal" role="dialog" aria-modal="true">
      <div className="sm-editor">
        <header className="sm-editorTop">
          <div>
            <span className="sm-kicker">{professionalMode ? "Plantilla" : "Comida guardada"}</span>
            <h2>{editor.id ? "Editar comida" : "Nueva comida"}</h2>
          </div>
          <button type="button" className="sm-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="sm-editorGrid">
          <label>
            <span>Nombre</span>
            <input value={editor.nombre} onChange={(event) => setEditor((current) => ({ ...current, nombre: event.target.value }))} />
          </label>
          <label>
            <span>Tipo</span>
            <select value={editor.tipoComida} onChange={(event) => setEditor((current) => ({ ...current, tipoComida: event.target.value }))}>
              {MEAL_TYPES.filter((item) => item.value !== "todos").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="wide">
            <span>Descripcion</span>
            <textarea value={editor.descripcion} onChange={(event) => setEditor((current) => ({ ...current, descripcion: event.target.value }))} />
          </label>
          <label className="wide">
            <span>Tags</span>
            <input value={editor.tags} onChange={(event) => setEditor((current) => ({ ...current, tags: event.target.value }))} placeholder="simple, alto en proteina" />
          </label>
          <label className="sm-check">
            <input type="checkbox" checked={editor.favorita} onChange={(event) => setEditor((current) => ({ ...current, favorita: event.target.checked }))} />
            Favorita
          </label>
        </div>

        <div className="sm-totalBox">
          <strong>{formatNumber(totals.kcal, 0)} kcal</strong>
          <span>{macroLine(totals)}</span>
        </div>

        <label className="sm-search editorSearch">
          <Search size={16} />
          <input value={foodSearch} onChange={(event) => setFoodSearch(event.target.value)} placeholder="Buscar alimento" />
          {loadingFoods ? <Loader2 size={15} className="sm-spin" /> : null}
        </label>

        {foodResults.length ? (
          <div className="sm-foodResults">
            {foodResults.map((food) => (
              <button type="button" key={String(food.id || food._id || food.alimentoId || food.nombre)} onClick={() => addFood(food)}>
                <span>
                  <strong>{food.nombre || food.name}</strong>
                  <small>{formatNumber(food.kcal, 0)} kcal · P {formatNumber(food.proteina ?? food.protein, 1)} / C {formatNumber(food.carbs, 1)} / G {formatNumber(food.grasas ?? food.fat, 1)}</small>
                </span>
                <Plus size={16} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="sm-editorItems">
          {editor.items.map((item, index) => (
            <div className="sm-editorItem" key={`${item.id}-${index}`}>
              <FoodThumb item={item} />
              <div className="sm-editorItemMain">
                <strong>{item.nombre}</strong>
                <span>{formatNumber(item.kcal, 0)} kcal · P {formatNumber(item.proteina, 1)} / C {formatNumber(item.carbs, 1)} / G {formatNumber(item.grasas, 1)}</span>
              </div>
              <input value={item.cantidad} onChange={(event) => updateItem(index, { cantidad: event.target.value })} inputMode="decimal" aria-label="Cantidad" />
              <span className="sm-unit">{item.unidad}</span>
              <button type="button" className="sm-icon danger" onClick={() => removeItem(index)} aria-label="Quitar">
                <X size={16} />
              </button>
            </div>
          ))}
          {!editor.items.length ? <div className="sm-empty compact">Sin alimentos agregados.</div> : null}
        </div>

        <footer className="sm-editorFooter">
          <button type="button" className="sm-filter" onClick={onClose}>Cancelar</button>
          <button type="button" className="sm-primary" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={17} className="sm-spin" /> : <CheckCircle2 size={17} />}
            Guardar
          </button>
        </footer>
      </div>
    </section>
  );
}

function AssignDrawer({ meal, clients, selectedClientIds, setSelectedClientIds, saving, onClose, onAssign }) {
  function toggle(id) {
    setSelectedClientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className="sm-modal" role="dialog" aria-modal="true">
      <div className="sm-assign">
        <header className="sm-editorTop">
          <div>
            <span className="sm-kicker">Asignar</span>
            <h2>{meal.nombre}</h2>
          </div>
          <button type="button" className="sm-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="sm-clientList">
          {clients.map((client) => {
            const id = String(client.id || client._id);
            const name = client.profile?.nombre || client.email || "Cliente";
            return (
              <label key={id} className="sm-clientPick">
                <input type="checkbox" checked={selectedClientIds.includes(id)} onChange={() => toggle(id)} />
                <span>
                  <strong>{name}</strong>
                  <small>{client.email}</small>
                </span>
              </label>
            );
          })}
          {!clients.length ? <div className="sm-empty compact">No hay clientes disponibles.</div> : null}
        </div>
        <footer className="sm-editorFooter">
          <button type="button" className="sm-filter" onClick={onClose}>Cancelar</button>
          <button type="button" className="sm-primary" onClick={onAssign} disabled={saving || !selectedClientIds.length}>
            {saving ? <Loader2 size={17} className="sm-spin" /> : <Users size={17} />}
            Asignar
          </button>
        </footer>
      </div>
    </section>
  );
}
