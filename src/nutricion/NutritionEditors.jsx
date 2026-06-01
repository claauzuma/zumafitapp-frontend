/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo, useState } from "react";
import {
  Beef,
  BookOpen,
  ChefHat,
  Copy,
  Flame,
  Plus,
  Save,
  Search,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import {
  buildMenuItemSnapshot,
  formatNumber,
  groupFromMealType,
  normalizeMealTypeToken,
  toNumber,
} from "./nutricionUtils.js";

const MEAL_TYPES = [
  ["desayuno", "Desayuno"],
  ["almuerzo", "Almuerzo"],
  ["merienda", "Merienda"],
  ["cena", "Cena"],
  ["snack", "Snack"],
  ["otro", "Sin clasificar"],
];

const VISIBILITY = [
  ["privada", "Privada"],
  ["publica", "Publica"],
  ["sistema", "Sistema"],
];

const STATUS = [
  ["activo", "Activo"],
  ["inactivo", "Inactivo"],
];

export function createEmptyMealDraft() {
  return {
    nombre: "",
    descripcion: "",
    tipoComida: "almuerzo",
    grupoComida: "almuerzo_cena",
    tags: [],
    visibilidad: "privada",
    estado: "activo",
    items: [],
  };
}

export function createEmptyMenuDraft() {
  return {
    nombre: "",
    descripcion: "",
    kcalObjetivo: 0,
    rangoKcal: "",
    macrosObjetivo: { proteina: 0, carbs: 0, grasas: 0 },
    objetivo: "mantenimiento",
    tags: [],
    visibilidad: "privada",
    estado: "activo",
    comidas: [],
  };
}

export function mealDraftToPayload(draft = {}) {
  const items = normalizeItems(draft.items || []);
  return {
    nombre: draft.nombre || "Comida sin nombre",
    descripcion: draft.descripcion || "",
    tipoComida: draft.tipoComida || "otro",
    grupoComida: draft.grupoComida || groupFromMealType(draft.tipoComida),
    items,
    tags: tagsFromInput(draft.tags),
    visibilidad: draft.visibilidad || "privada",
    estado: draft.estado || "activo",
  };
}

export function menuDraftToPayload(draft = {}) {
  const comidas = (draft.comidas || []).map((meal, index) => {
    const normalizedMeal = mealDraftToPayload({
      ...meal,
      nombre: meal.nombre || `Comida ${index + 1}`,
    });
    return {
      id: meal.id || `meal-${index + 1}`,
      nombre: normalizedMeal.nombre,
      orden: index + 1,
      tipoComida: normalizedMeal.tipoComida,
      items: normalizedMeal.items,
      totales: totalsFromItems(normalizedMeal.items),
    };
  });
  const totals = totalsFromMeals(comidas);

  return {
    nombre: draft.nombre || "Menu sin nombre",
    descripcion: draft.descripcion || "",
    kcalObjetivo: toNumber(draft.kcalObjetivo, totals.kcal),
    rangoKcal: draft.rangoKcal || rangeFromKcal(toNumber(draft.kcalObjetivo, totals.kcal)),
    macrosObjetivo: {
      proteina: toNumber(draft.macrosObjetivo?.proteina, totals.proteina),
      carbs: toNumber(draft.macrosObjetivo?.carbs, totals.carbs),
      grasas: toNumber(draft.macrosObjetivo?.grasas, totals.grasas),
    },
    objetivo: draft.objetivo || "mantenimiento",
    cantidadComidas: comidas.length,
    tags: tagsFromInput(draft.tags),
    visibilidad: draft.visibilidad || "privada",
    estado: draft.estado || "activo",
    comidas,
  };
}

export function normalizeMealDraft(raw = {}) {
  const source = raw?.raw || raw || {};
  const tipoComida = normalizeMealTypeToken(source.tipoComida || raw.tipoComida || raw.type || raw.name || raw.nombre);
  return recalcMealDraft({
    id: source.id || source._id || raw.id || "",
    nombre: source.nombre || raw.nombre || raw.name || "",
    descripcion: source.descripcion || raw.descripcion || raw.description || "",
    tipoComida,
    grupoComida: source.grupoComida || raw.grupoComida || groupFromMealType(tipoComida),
    tags: Array.isArray(source.tags || raw.tags) ? source.tags || raw.tags : [],
    visibilidad: source.visibilidad || raw.visibilidad || raw.visibility || "privada",
    estado: source.estado || raw.estado || raw.status || "activo",
    items: normalizeItems(source.items || raw.items || []),
  });
}

export function normalizeMenuDraft(raw = {}) {
  const source = raw?.raw || raw || {};
  const macros = source.macrosObjetivo || source.macros || {};
  const meals = Array.isArray(source.comidas)
    ? source.comidas
    : Array.isArray(source.meals)
      ? source.meals.map((meal) => ({
          nombre: meal.name || meal.nombre,
          tipoComida: meal.type || meal.tipoComida || meal.name,
          items: (meal.foods || meal.items || []).map((food) => {
            const parsed = parseAmount(food.amount);
            return {
              id: food.id,
              alimentoId: food.alimentoId,
              nombreSnapshot: food.name || food.nombreSnapshot,
              cantidad: food.cantidad ?? parsed.cantidad,
              unidad: food.unidad || parsed.unidad,
              kcal: food.kcal,
              proteina: food.proteina ?? food.protein,
              carbs: food.carbs,
              grasas: food.grasas ?? food.fat,
              categoriaSnapshot: food.category || food.categoriaSnapshot,
            };
          }),
        }))
      : [];

  return recalcMenuDraft({
    id: source.id || source._id || raw.id || "",
    nombre: source.nombre || raw.nombre || raw.name || "",
    descripcion: source.descripcion || raw.descripcion || raw.description || "",
    kcalObjetivo: source.kcalObjetivo ?? raw.kcal,
    rangoKcal: source.rangoKcal || raw.range?.label || "",
    macrosObjetivo: {
      proteina: macros.proteina ?? macros.protein ?? raw.protein,
      carbs: macros.carbs ?? raw.carbs,
      grasas: macros.grasas ?? macros.fat ?? raw.fat,
    },
    objetivo: source.objetivo || raw.goals?.[0] || "mantenimiento",
    tags: Array.isArray(source.tags || raw.tags) ? source.tags || raw.tags : [],
    visibilidad: source.visibilidad || raw.visibility || "privada",
    estado: source.estado || raw.estado || "activo",
    comidas: meals.map((meal) => normalizeMealDraft(meal)),
  });
}

export function MealRecipeEditor({
  initialMeal,
  foods = [],
  foodsLoading = false,
  onSave,
  onClose,
  saving = false,
  title = "Comida / receta",
  submitLabel = "Guardar receta",
  allowSystemVisibility = true,
}) {
  const [draft, setDraft] = useState(() => normalizeMealDraft(initialMeal || createEmptyMealDraft()));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setDraft(normalizeMealDraft(initialMeal || createEmptyMealDraft()));
  }, [initialMeal]);

  function update(patch) {
    setDraft((current) => recalcMealDraft({ ...current, ...patch }));
  }

  function updateItem(index, patch) {
    update({
      items: (draft.items || []).map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  }

  function removeItem(index) {
    update({ items: (draft.items || []).filter((_, itemIndex) => itemIndex !== index) });
  }

  function addItem(item) {
    update({ items: [...(draft.items || []), withMacroBase(item)] });
    setPickerOpen(false);
  }

  return (
    <EditorShell title={title} icon={ChefHat} onClose={onClose}>
      <div className="ne-editorGrid">
        <aside className="ne-side">
          <Field label="Nombre" value={draft.nombre} onChange={(value) => update({ nombre: value })} />
          <label className="ne-field">
            <span>Descripcion</span>
            <textarea value={draft.descripcion || ""} onChange={(event) => update({ descripcion: event.target.value })} />
          </label>
          <div className="ne-two">
            <SelectField
              label="Tipo"
              value={draft.tipoComida}
              options={MEAL_TYPES}
              onChange={(value) => update({ tipoComida: value, grupoComida: groupFromMealType(value) })}
            />
            <SelectField
              label="Visibilidad"
              value={draft.visibilidad}
              options={allowSystemVisibility ? VISIBILITY : VISIBILITY.filter(([value]) => value !== "sistema")}
              onChange={(value) => update({ visibilidad: value })}
            />
          </div>
          <SelectField label="Estado" value={draft.estado} options={STATUS} onChange={(value) => update({ estado: value })} />
          <Field
            label="Tags"
            value={tagsFromInput(draft.tags).join(", ")}
            onChange={(value) => update({ tags: value })}
            placeholder="simple, alto en proteina..."
          />
          <MacroSummary totals={draft.totales} />
        </aside>

        <main className="ne-main">
          <div className="ne-sectionTop">
            <div>
              <h3>Alimentos</h3>
              <p>{draft.items.length} ingrediente(s) - {macroSentence(draft.totales)}</p>
            </div>
            <button type="button" className="nf-btn gold" onClick={() => setPickerOpen(true)}>
              <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
              Agregar alimento
            </button>
          </div>

          <FoodItemsEditor items={draft.items} onUpdate={updateItem} onRemove={removeItem} />

          <div className="ne-actions">
            <button type="button" className="nf-btn ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="nf-btn gold" onClick={() => onSave?.(mealDraftToPayload(draft))} disabled={saving}>
              <Save size={16} strokeWidth={2.3} aria-hidden="true" />
              {saving ? "Guardando..." : submitLabel}
            </button>
          </div>
        </main>
      </div>

      {pickerOpen ? (
        <NutritionFoodPicker foods={foods} loading={foodsLoading} onPick={addItem} onClose={() => setPickerOpen(false)} />
      ) : null}
    </EditorShell>
  );
}

export function MenuBaseEditor({
  initialMenu,
  foods = [],
  foodsLoading = false,
  mealLibrary = [],
  onSave,
  onClose,
  saving = false,
  title = "Menu base",
  submitLabel = "Guardar menu",
  allowSystemVisibility = true,
}) {
  const [draft, setDraft] = useState(() => normalizeMenuDraft(initialMenu || createEmptyMenuDraft()));
  const [pickerMealIndex, setPickerMealIndex] = useState(null);
  const [libraryMealId, setLibraryMealId] = useState("");

  useEffect(() => {
    setDraft(normalizeMenuDraft(initialMenu || createEmptyMenuDraft()));
    setLibraryMealId("");
  }, [initialMenu]);

  function update(patch) {
    setDraft((current) => recalcMenuDraft({ ...current, ...patch }));
  }

  function updateMeal(index, patch) {
    update({
      comidas: (draft.comidas || []).map((meal, mealIndex) =>
        mealIndex === index ? recalcMealDraft({ ...meal, ...patch }) : meal
      ),
    });
  }

  function addMeal(meal = null) {
    const next = meal ? normalizeMealDraft(meal) : recalcMealDraft({ ...createEmptyMealDraft(), nombre: `Comida ${draft.comidas.length + 1}` });
    update({ comidas: [...(draft.comidas || []), next] });
  }

  function duplicateMeal(index) {
    const meal = draft.comidas[index];
    if (!meal) return;
    addMeal({ ...meal, id: "", nombre: `${meal.nombre} copia` });
  }

  function removeMeal(index) {
    update({ comidas: draft.comidas.filter((_, mealIndex) => mealIndex !== index) });
  }

  function updateItem(mealIndex, itemIndex, patch) {
    const meal = draft.comidas[mealIndex];
    if (!meal) return;
    updateMeal(mealIndex, {
      items: meal.items.map((item, index) => (index === itemIndex ? { ...item, ...patch } : item)),
    });
  }

  function removeItem(mealIndex, itemIndex) {
    const meal = draft.comidas[mealIndex];
    if (!meal) return;
    updateMeal(mealIndex, {
      items: meal.items.filter((_, index) => index !== itemIndex),
    });
  }

  function addItem(item) {
    if (pickerMealIndex === null) return;
    const meal = draft.comidas[pickerMealIndex];
    updateMeal(pickerMealIndex, {
      items: [...(meal.items || []), withMacroBase(item)],
    });
    setPickerMealIndex(null);
  }

  function useCurrentTotals() {
    const totals = totalsFromMeals(draft.comidas || []);
    update({
      kcalObjetivo: totals.kcal,
      macrosObjetivo: {
        proteina: totals.proteina,
        carbs: totals.carbs,
        grasas: totals.grasas,
      },
      rangoKcal: rangeFromKcal(totals.kcal),
    });
  }

  return (
    <EditorShell title={title} icon={BookOpen} onClose={onClose}>
      <div className="ne-editorGrid">
        <aside className="ne-side">
          <Field label="Nombre" value={draft.nombre} onChange={(value) => update({ nombre: value })} />
          <label className="ne-field">
            <span>Descripcion</span>
            <textarea value={draft.descripcion || ""} onChange={(event) => update({ descripcion: event.target.value })} />
          </label>
          <div className="ne-two">
            <Field label="Kcal objetivo" value={draft.kcalObjetivo} onChange={(value) => update({ kcalObjetivo: value })} />
            <Field label="Rango kcal" value={draft.rangoKcal} onChange={(value) => update({ rangoKcal: value })} />
          </div>
          <div className="ne-three">
            <Field
              label="Proteina"
              value={draft.macrosObjetivo?.proteina}
              onChange={(value) => update({ macrosObjetivo: { ...(draft.macrosObjetivo || {}), proteina: value } })}
            />
            <Field
              label="Carbs"
              value={draft.macrosObjetivo?.carbs}
              onChange={(value) => update({ macrosObjetivo: { ...(draft.macrosObjetivo || {}), carbs: value } })}
            />
            <Field
              label="Grasas"
              value={draft.macrosObjetivo?.grasas}
              onChange={(value) => update({ macrosObjetivo: { ...(draft.macrosObjetivo || {}), grasas: value } })}
            />
          </div>
          <div className="ne-two">
            <SelectField
              label="Visibilidad"
              value={draft.visibilidad}
              options={allowSystemVisibility ? VISIBILITY : VISIBILITY.filter(([value]) => value !== "sistema")}
              onChange={(value) => update({ visibilidad: value })}
            />
            <SelectField label="Estado" value={draft.estado} options={STATUS} onChange={(value) => update({ estado: value })} />
          </div>
          <Field label="Tags" value={tagsFromInput(draft.tags).join(", ")} onChange={(value) => update({ tags: value })} />
          <button type="button" className="nf-btn ghost" onClick={useCurrentTotals}>Usar totales actuales</button>
          <MacroSummary totals={totalsFromMeals(draft.comidas || [])} />
        </aside>

        <main className="ne-main">
          <div className="ne-sectionTop">
            <div>
              <h3>Comidas del menu</h3>
              <p>{draft.comidas.length} comida(s) - {macroSentence(totalsFromMeals(draft.comidas || []))}</p>
            </div>
            <button type="button" className="nf-btn gold" onClick={() => addMeal()}>
              <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
              Agregar comida
            </button>
          </div>

          {mealLibrary.length ? (
            <div className="ne-libraryAdd">
              <select value={libraryMealId} onChange={(event) => setLibraryMealId(event.target.value)}>
                <option value="">Usar comida/receta existente</option>
                {mealLibrary.map((meal) => (
                  <option value={meal.id} key={meal.id}>{meal.name || meal.nombre}</option>
                ))}
              </select>
              <button
                type="button"
                className="nf-btn ghost"
                onClick={() => {
                  const selected = mealLibrary.find((meal) => meal.id === libraryMealId);
                  if (selected) addMeal(selected);
                  setLibraryMealId("");
                }}
                disabled={!libraryMealId}
              >
                <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
                Usar receta
              </button>
            </div>
          ) : null}

          <div className="ne-meals">
            {draft.comidas.map((meal, mealIndex) => (
              <section className="ne-mealBlock" key={`${meal.id || "meal"}-${mealIndex}`}>
                <div className="ne-mealTop">
                  <div className="ne-two">
                    <Field label="Nombre" value={meal.nombre} onChange={(value) => updateMeal(mealIndex, { nombre: value })} />
                    <SelectField
                      label="Tipo"
                      value={meal.tipoComida}
                      options={MEAL_TYPES}
                      onChange={(value) => updateMeal(mealIndex, { tipoComida: value, grupoComida: groupFromMealType(value) })}
                    />
                  </div>
                  <div className="ne-mealActions">
                    <button type="button" className="nf-btn ghost" onClick={() => setPickerMealIndex(mealIndex)}>
                      <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
                      Alimento
                    </button>
                    <button type="button" className="nf-iconBtn" onClick={() => duplicateMeal(mealIndex)} aria-label="Duplicar comida">
                      <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                    <button type="button" className="nf-iconBtn" onClick={() => removeMeal(mealIndex)} aria-label="Eliminar comida">
                      <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p className="ne-muted">{macroSentence(meal.totales)}</p>
                <FoodItemsEditor
                  items={meal.items}
                  onUpdate={(itemIndex, patch) => updateItem(mealIndex, itemIndex, patch)}
                  onRemove={(itemIndex) => removeItem(mealIndex, itemIndex)}
                />
              </section>
            ))}
          </div>

          <div className="ne-actions">
            <button type="button" className="nf-btn ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="nf-btn gold" onClick={() => onSave?.(menuDraftToPayload(draft))} disabled={saving}>
              <Save size={16} strokeWidth={2.3} aria-hidden="true" />
              {saving ? "Guardando..." : submitLabel}
            </button>
          </div>
        </main>
      </div>

      {pickerMealIndex !== null ? (
        <NutritionFoodPicker foods={foods} loading={foodsLoading} onPick={addItem} onClose={() => setPickerMealIndex(null)} />
      ) : null}
    </EditorShell>
  );
}

export function NutritionFoodPicker({ foods = [], loading = false, onPick, onClose }) {
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState(100);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return foods
      .filter((food) => {
        if (!needle) return true;
        return `${food.nombre || food.name} ${food.fuente || food.source} ${food.macroGroup || ""}`.toLowerCase().includes(needle);
      })
      .slice(0, 32);
  }, [foods, search]);

  return (
    <div className="ne-nestedBackdrop">
      <div className="ne-picker">
        <div className="ne-pickerTop">
          <div>
            <span className="nf-pill demo">
              <Search size={14} strokeWidth={2.3} aria-hidden="true" />
              Alimentos reales
            </span>
            <h3>Elegir alimento</h3>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        <div className="ne-pickerControls">
          <label className="nf-searchWrap">
            <Search size={16} strokeWidth={2.3} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar arroz, pollo, yogur..." />
          </label>
          <Field label="Cantidad" value={quantity} onChange={setQuantity} />
        </div>

        {loading ? <div className="nf-empty">Cargando alimentos...</div> : null}
        {!loading && !filtered.length ? <div className="nf-empty">No encontre alimentos.</div> : null}

        <div className="ne-foodGrid">
          {filtered.map((food) => {
            const item = buildMenuItemSnapshot(food, quantity, food.unidad || food.unit || "g");
            return (
              <button type="button" className="ne-foodPick" key={food.id} onClick={() => onPick(withMacroBase(item))}>
                <strong>{food.nombre || food.name}</strong>
                <span>{formatNumber(item.kcal)} kcal - P {formatNumber(item.proteina, 1)} / C {formatNumber(item.carbs, 1)} / G {formatNumber(item.grasas, 1)}</span>
                <small>{item.cantidad} {item.unidad} - {food.fuente || food.source || food.macroGroup}</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditorShell({ title, icon: Icon, onClose, children }) {
  return (
    <div className="ne-backdrop">
      <div className="ne-shell">
        <header className="ne-head">
          <div>
            <span className="nf-pill good">
              {Icon ? <Icon size={14} strokeWidth={2.3} aria-hidden="true" /> : null}
              Editor
            </span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar editor">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function FoodItemsEditor({ items = [], onUpdate, onRemove }) {
  if (!items.length) {
    return <div className="nf-empty">Todavia no agregaste alimentos.</div>;
  }

  return (
    <div className="ne-items">
      {items.map((item, index) => (
        <article className="ne-item" key={`${item.id || item.nombreSnapshot}-${index}`}>
          <div className="ne-itemTitle">
            <strong>{item.nombreSnapshot}</strong>
            <span>{item.cantidad} {item.unidad} - {macroSentence(item)}</span>
          </div>
          <div className="ne-itemGrid">
            <Field label="Cant." value={item.cantidad} onChange={(value) => onUpdate(index, rescaleItem(item, value, item.unidad))} />
            <Field label="Unidad" value={item.unidad} onChange={(value) => onUpdate(index, { unidad: value })} />
            <Field label="Kcal" value={item.kcal} onChange={(value) => onUpdate(index, { kcal: value })} />
            <Field label="P" value={item.proteina} onChange={(value) => onUpdate(index, { proteina: value })} />
            <Field label="C" value={item.carbs} onChange={(value) => onUpdate(index, { carbs: value })} />
            <Field label="G" value={item.grasas} onChange={(value) => onUpdate(index, { grasas: value })} />
            <button type="button" className="nf-iconBtn" onClick={() => onRemove(index)} aria-label="Eliminar alimento">
              <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function MacroSummary({ totals = {} }) {
  return (
    <div className="ne-macroSummary">
      <MacroBox label="Kcal" value={totals.kcal} icon={Flame} />
      <MacroBox label="Prot." value={totals.proteina} suffix="g" icon={Beef} />
      <MacroBox label="Carbs" value={totals.carbs} suffix="g" />
      <MacroBox label="Grasas" value={totals.grasas} suffix="g" />
    </div>
  );
}

function MacroBox({ label, value, suffix = "", icon: Icon }) {
  return (
    <div className="nf-macroBox">
      <span>{Icon ? <Icon size={13} strokeWidth={2.2} aria-hidden="true" /> : null}{label}</span>
      <strong>{formatNumber(value, 1)}{suffix}</strong>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="ne-field">
      <span>{label}</span>
      <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, value, options = [], onChange }) {
  return (
    <label className="ne-field">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function normalizeItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => withMacroBase({
    id: item.id || item._id || `item-${index + 1}`,
    alimentoId: item.alimentoId || null,
    nombreSnapshot: item.nombreSnapshot || item.nombre || item.name || item.alimento || `Alimento ${index + 1}`,
    cantidad: toNumber(item.cantidad ?? item.amount, 0),
    unidad: item.unidad || item.unit || "g",
    kcal: toNumber(item.kcal ?? item.calorias, 0),
    proteina: toNumber(item.proteina ?? item.protein ?? item.proteinas, 0),
    carbs: toNumber(item.carbs ?? item.carbohidratos, 0),
    grasas: toNumber(item.grasas ?? item.fat, 0),
    categoriaSnapshot: item.categoriaSnapshot || item.categoria || item.category || "",
    notas: item.notas || item.notes || "",
  }));
}

function withMacroBase(item = {}) {
  return {
    ...item,
    _macroBase: item._macroBase || {
      cantidad: toNumber(item.cantidad, 0),
      kcal: toNumber(item.kcal, 0),
      proteina: toNumber(item.proteina, 0),
      carbs: toNumber(item.carbs, 0),
      grasas: toNumber(item.grasas, 0),
    },
  };
}

function rescaleItem(item = {}, nextCantidad = item.cantidad, nextUnidad = item.unidad || "g") {
  const base = item._macroBase || withMacroBase(item)._macroBase;
  const baseQty = toNumber(base.cantidad, 0);
  const quantity = toNumber(nextCantidad, toNumber(item.cantidad, 0));
  const factor = baseQty > 0 ? quantity / baseQty : 1;
  return {
    ...item,
    cantidad: quantity,
    unidad: nextUnidad || item.unidad || "g",
    kcal: round(toNumber(base.kcal, item.kcal) * factor),
    proteina: round(toNumber(base.proteina, item.proteina) * factor),
    carbs: round(toNumber(base.carbs, item.carbs) * factor),
    grasas: round(toNumber(base.grasas, item.grasas) * factor),
    _macroBase: base,
  };
}

function recalcMealDraft(draft = {}) {
  const tipoComida = normalizeMealTypeToken(draft.tipoComida || draft.nombre);
  const items = normalizeItems(draft.items || []);
  return {
    ...draft,
    tipoComida,
    grupoComida: draft.grupoComida || groupFromMealType(tipoComida),
    tags: tagsFromInput(draft.tags),
    items,
    totales: totalsFromItems(items),
  };
}

function recalcMenuDraft(draft = {}) {
  const comidas = (draft.comidas || []).map(recalcMealDraft);
  return {
    ...draft,
    tags: tagsFromInput(draft.tags),
    comidas,
  };
}

function totalsFromItems(items = []) {
  return normalizeItems(items).reduce(
    (acc, item) => ({
      kcal: round(acc.kcal + toNumber(item.kcal, 0)),
      proteina: round(acc.proteina + toNumber(item.proteina, 0)),
      carbs: round(acc.carbs + toNumber(item.carbs, 0)),
      grasas: round(acc.grasas + toNumber(item.grasas, 0)),
    }),
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
  );
}

function totalsFromMeals(meals = []) {
  return (meals || []).reduce(
    (acc, meal) => {
      const totals = meal.totales || totalsFromItems(meal.items || []);
      return {
        kcal: round(acc.kcal + toNumber(totals.kcal, 0)),
        proteina: round(acc.proteina + toNumber(totals.proteina, 0)),
        carbs: round(acc.carbs + toNumber(totals.carbs, 0)),
        grasas: round(acc.grasas + toNumber(totals.grasas, 0)),
      };
    },
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
  );
}

function tagsFromInput(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag || "").trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function macroSentence(macros = {}) {
  return `${formatNumber(macros.kcal, 0)} kcal - P ${formatNumber(macros.proteina, 1)} / C ${formatNumber(macros.carbs, 1)} / G ${formatNumber(macros.grasas, 1)}`;
}

function rangeFromKcal(kcal) {
  const n = toNumber(kcal, 0);
  if (!n) return "";
  const min = Math.floor(n / 100) * 100;
  return `${min}-${min + 100} kcal`;
}

function parseAmount(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/([\d.,]+)/);
  const cantidad = match ? Number(match[1].replace(",", ".")) : 0;
  const unidad = text.replace(match?.[1] || "", "").trim() || "g";
  return {
    cantidad: Number.isFinite(cantidad) ? cantidad : 0,
    unidad,
  };
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
