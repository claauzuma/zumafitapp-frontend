import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Apple, Check, ChevronLeft, ChevronRight, Columns3, Database, Pencil, Plus, RefreshCcw, RotateCcw, Save, Search, X } from "lucide-react";

import { formatNumber, normalizeFood } from "../nutricion/nutricionUtils.js";
import AdminFoodEditor from "./AdminFoodEditor.jsx";
import { GENERATION_MEAL_TYPES, GENERATION_MODES, GENERATION_ROLES, PORTION_UNITS, enabledSummary, generationForFood, mealTypesSummary } from "./adminFoodGeneration.js";
import {
  ADMIN_FOOD_COLUMN_GROUPS,
  ADMIN_FOOD_COLUMN_LABELS,
  DEFAULT_ADMIN_FOOD_COLUMNS,
  adminFoodGridTemplate,
  applyAdminFoodColumnPreset,
  createInlineFoodDraft,
  detectAdminFoodColumnPreset,
  isInlineFoodDraftDirty,
  loadAdminFoodColumns,
  persistAdminFoodColumns,
  setInlineGenerationValue,
  toggleAdminFoodColumn,
  validateInlineFoodDraft,
} from "./adminFoodTableConfig.js";
import { useAdminFoods, useCreateAdminFood, useUpdateAdminFoodGeneration, useUpdateAdminFoodGenerationInline } from "./adminFoodsQueries.js";
import "../nutricion/nutricion.css";

const INITIAL_FILTERS = Object.freeze({ search: "", category: "todos", unit: "todos", status: "todos", sort: "nombre_asc", mode: "todos", role: "todos", mealType: "todos" });

export default function AdminAlimentos() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(40);
  const [editorFood, setEditorFood] = useState(undefined);
  const [feedback, setFeedback] = useState("");
  const [columns, setColumns] = useState(() => loadAdminFoodColumns());
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [dirtyRows, setDirtyRows] = useState(() => new Set());
  const [discardRevisions, setDiscardRevisions] = useState({});
  const pickerRef = useRef(null);
  const debouncedSearch = useDebouncedValue(filters.search, 320);
  const queryFilters = useMemo(() => ({ ...filters, search: debouncedSearch, page, limit }), [debouncedSearch, filters, limit, page]);
  const foodsQuery = useAdminFoods(queryFilters);
  const updateGeneration = useUpdateAdminFoodGeneration();
  const createFood = useCreateAdminFood();
  const documents = useMemo(() => foodsQuery.data?.documents || [], [foodsQuery.data?.documents]);
  const foods = useMemo(() => documents.map(normalizeFood), [documents]);
  const summary = foodsQuery.data?.summary || {};
  const facets = foodsQuery.data?.facets || {};
  const totalPages = Math.max(1, Number(foodsQuery.data?.totalPages) || 1);
  const currentPage = Math.min(page, totalPages);
  const loading = foodsQuery.isLoading;
  const refreshing = foodsQuery.isFetching && !loading;
  const gridTemplate = useMemo(() => adminFoodGridTemplate(columns), [columns]);
  const preset = detectAdminFoodColumnPreset(columns);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  
  useEffect(() => {
  persistAdminFoodColumns(columns);
}, [columns]);

  useEffect(() => {
    if (!columnPickerOpen) return undefined;
    const close = (event) => { if (!pickerRef.current?.contains(event.target)) setColumnPickerOpen(false); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setColumnPickerOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [columnPickerOpen]);

  const changeFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const updateDirtyState = useCallback((foodId, dirty) => {
    setDirtyRows((current) => { const next = new Set(current); if (dirty) next.add(foodId); else next.delete(foodId); return next; });
  }, []);

  const requestOpenEditor = useCallback((food) => {
    const id = String(food?.raw?._id || food?.id || "");
    if (dirtyRows.has(id) && !window.confirm(`Hay cambios inline sin guardar en ${food.name}. ¿Querés descartarlos y abrir el editor completo?`)) return;
    if (dirtyRows.has(id)) {
      setDirtyRows((current) => { const next = new Set(current); next.delete(id); return next; });
      setDiscardRevisions((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
    }
    setEditorFood(food);
  }, [dirtyRows]);

  const saveEditor = async (payload) => {
    if (editorFood) {
      await updateGeneration.mutateAsync({ foodId: editorFood.raw?._id || editorFood.id, generation: payload });
      setFeedback(`Metadata de ${editorFood.name} actualizada.`);
    } else {
      const response = await createFood.mutateAsync(payload);
      setFeedback(`${response.food?.Alimentos || response.food?.nombre || "Alimento"} fue creado correctamente.`);
    }
    setEditorFood(undefined);
    window.setTimeout(() => setFeedback(""), 4500);
  };

  return (
    <div className="nf-page">
      <section className="nf-shell">
        <header className="nf-hero">
          <div className="nf-heroCopy">
            <div className="nf-kicker"><Database size={15} aria-hidden="true" /> Base real · fooddatabase2</div>
            <div className="nf-titleRow"><Apple size={28} aria-hidden="true" /><h1 className="nf-title">Catálogo de alimentos</h1></div>
            <p className="nf-sub">Configurá rápidamente el futuro pool automático desde la tabla o usá el editor completo.</p>
          </div>
          <div className="nf-actions"><button type="button" className="nf-btn gold" onClick={() => setEditorFood(null)}><Plus size={17} aria-hidden="true" /> Agregar alimento</button><button type="button" className="nf-iconBtn" onClick={() => foodsQuery.refetch()} disabled={foodsQuery.isFetching} aria-label="Actualizar catálogo de alimentos"><RefreshCcw className={refreshing ? "refreshing" : ""} size={18} aria-hidden="true" /></button></div>
        </header>

        <div className="nf-summary"><Stat label="Registros en BD" value={formatNumber(summary.total)} /><Stat label="Coincidencias" value={formatNumber(summary.filtered)} /><Stat label="A revisar" value={formatNumber(summary.review)} tone={Number(summary.review) > 0 ? "warning" : ""} /><Stat label="Nombre + unidad repetidos" value={formatNumber(summary.duplicates)} tone={Number(summary.duplicates) > 0 ? "warning" : ""} /></div>

        <div className="nf-toolbar nf-foodToolbar">
          <label className="nf-searchWrap"><Search size={17} aria-hidden="true" /><input className="nf-search" value={filters.search} onChange={(event) => changeFilter("search", event.target.value)} placeholder="Buscar alimento, categoría o tag..." aria-label="Buscar en el catálogo de alimentos" /></label>
          <FilterSelect value={filters.category} onChange={(value) => changeFilter("category", value)} label="Filtrar por categoría" first="Todas las categorías" options={facets.categories || []} />
          <FilterSelect value={filters.unit} onChange={(value) => changeFilter("unit", value)} label="Filtrar por unidad" first="Todas las unidades" options={facets.units || []} />
          <select className="nf-select" value={filters.status} onChange={(event) => changeFilter("status", event.target.value)} aria-label="Filtrar por estado"><option value="todos">Todos los estados</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="revision">Requieren revisión</option><option value="duplicados">Nombre + unidad repetidos</option></select>
          <select className="nf-select" value={filters.sort} onChange={(event) => changeFilter("sort", event.target.value)} aria-label="Ordenar catálogo"><option value="nombre_asc">Nombre A–Z</option><option value="nombre_desc">Nombre Z–A</option><option value="kcal_desc">Más kcal por unidad</option><option value="proteina_desc">Más proteína por unidad</option><option value="recientes">Actualizados recientemente</option></select>
          <select className="nf-select" value={filters.mode} onChange={(event) => changeFilter("mode", event.target.value)} aria-label="Filtrar por modo de generación"><option value="todos">Todos los modos</option>{GENERATION_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select>
          <select className="nf-select" value={filters.role} onChange={(event) => changeFilter("role", event.target.value)} aria-label="Filtrar por rol"><option value="todos">Todos los roles</option>{GENERATION_ROLES.map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</select>
          <select className="nf-select" value={filters.mealType} onChange={(event) => changeFilter("mealType", event.target.value)} aria-label="Filtrar por momento"><option value="todos">Todos los momentos</option>{GENERATION_MEAL_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </div>

        <div className="nf-adminFoodTableTools">
          <div><strong>Vista de trabajo</strong><span>{dirtyRows.size ? `${dirtyRows.size} fila${dirtyRows.size === 1 ? "" : "s"} con cambios sin guardar` : "Los cambios sólo se envían al pulsar Guardar."}</span></div>
          <div className="nf-adminFoodPresets" role="group" aria-label="Presets de columnas">{[["default", "Predeterminado"], ["nutrition", "Nutrición"], ["generator", "Generador"], ["portions", "Porciones"]].map(([key, label]) => <button key={key} type="button" className={preset === key ? "active" : ""} aria-pressed={preset === key} onClick={() => setColumns(key === "default" ? [...DEFAULT_ADMIN_FOOD_COLUMNS] : applyAdminFoodColumnPreset(key))}>{label}</button>)}{preset === "custom" ? <span className="nf-customColumnPreset">Personalizado</span> : null}</div>
          <div className="nf-columnPickerWrap" ref={pickerRef}><button type="button" className={`nf-btn ghost ${columnPickerOpen ? "active" : ""}`} onClick={() => setColumnPickerOpen((value) => !value)} aria-expanded={columnPickerOpen} aria-haspopup="dialog"><Columns3 size={16} aria-hidden="true" /> Columnas</button>{columnPickerOpen ? <ColumnPicker columns={columns} onChange={setColumns} onClose={() => setColumnPickerOpen(false)} /> : null}</div>
        </div>

        <div className="nf-foodCatalogNote" role="note"><Database size={16} aria-hidden="true" /><span>La tabla edita únicamente <b>generation</b> y <b>portionRule</b>. Los datos nutricionales legacy permanecen sólo lectura.</span></div>
        {feedback ? <div className="nf-foodFeedback" role="status">{feedback}</div> : null}
        {loading ? <SkeletonGrid /> : null}
        {foodsQuery.error ? <div className="nf-error">{foodsQuery.error.message || "No se pudo cargar el catálogo de alimentos."}</div> : null}
        {!loading && !foodsQuery.error && foods.length === 0 ? <div className="nf-empty">No hay alimentos para esos filtros.</div> : null}

        {!loading && !foodsQuery.error && foods.length > 0 ? <><div className="nf-table nf-foodDesktop nf-adminFoodTable" style={{ "--nf-admin-food-grid": gridTemplate }}><div className="nf-tableHead">{columns.map((column) => <span key={column} className={column === "food" ? "sticky-left" : column === "save" ? "sticky-right" : ""}>{ADMIN_FOOD_COLUMN_LABELS[column]}</span>)}</div>{foods.map((food) => { const id = String(food.raw?._id || food.id); return <InlineFoodRow key={`${id}:${discardRevisions[id] || 0}`} food={food} columns={columns} onEdit={requestOpenEditor} onDirtyChange={updateDirtyState} />; })}</div><div className="nf-cardGrid nf-mobileCards">{foods.map((food) => <FoodCard key={food.raw?._id || food.id} food={food} onEdit={() => requestOpenEditor(food)} />)}</div><Pagination page={currentPage} totalPages={totalPages} limit={limit} total={Number(foodsQuery.data?.total) || 0} visible={foods.length} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} /></> : null}
      </section>
      {editorFood !== undefined ? <AdminFoodEditor key={editorFood?.raw?._id || "new-food"} food={editorFood} saving={updateGeneration.isPending || createFood.isPending} onClose={() => setEditorFood(undefined)} onSave={saveEditor} /> : null}
    </div>
  );
}

const InlineFoodRow = memo(function InlineFoodRow({ food, columns, onEdit, onDirtyChange }) {
  const foodId = String(food.raw?._id || food.id);
  const [baseDraft, setBaseDraft] = useState(() => createInlineFoodDraft(food));
  const [draft, setDraft] = useState(() => createInlineFoodDraft(food));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const mutation = useUpdateAdminFoodGenerationInline();
  const dirty = isInlineFoodDraftDirty(draft, baseDraft);

  useEffect(() => { if (!dirty) { const next = createInlineFoodDraft(food); setBaseDraft(next); setDraft(next); } }, [food.raw?.generation, food, dirty]);
  useEffect(() => { onDirtyChange(foodId, dirty); return () => onDirtyChange(foodId, false); }, [dirty, foodId, onDirtyChange]);

  const setValue = (path, value) => { setDraft((current) => setInlineGenerationValue(current, path, value)); setError(""); setSaved(false); };
  const setAllowedValuesText = (value) => { setDraft((current) => ({ ...current, allowedValuesText: value })); setError(""); setSaved(false); };
  const save = async () => {
    const validation = validateInlineFoodDraft(draft);
    if (validation.error) { setError(validation.error); return; }
    try {
      const response = await mutation.mutateAsync({ foodId, generation: validation.generation });
      const next = createInlineFoodDraft(response.food);
      setBaseDraft(next); setDraft(next); setError(""); setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (saveError) { setError(saveError?.message || "No se pudo guardar."); }
  };

  return <div className={`nf-foodRow nf-inlineFoodRow ${dirty ? "is-dirty" : ""}`}>
    {columns.map((column) => <InlineCell key={column} column={column} food={food} draft={draft} setAllowedValuesText={setAllowedValuesText} setValue={setValue} dirty={dirty} saved={saved} saving={mutation.isPending} onSave={save} onEdit={() => onEdit(food)} />)}
    {error ? <div className="nf-inlineRowError" role="alert">{error}</div> : null}
  </div>;
});

function InlineCell({ column, food, draft, setAllowedValuesText, setValue, dirty, saved, saving, onSave, onEdit }) {
  const generation = draft.generation;
  if (column === "food") return <div className="nf-nameCell sticky-left"><strong>{food.name}</strong><small>ID {food.alimentoId ?? "—"} · {food.subcategoria || food.source || "Sin subcategoría"}</small></div>;
  if (column === "status") return <FoodStateBadges food={food} />;
  if (column === "kcal") return <span className="nf-macro">{formatNumber(food.kcal, 2)}</span>;
  if (column === "protein") return <span className="nf-macro">{formatNumber(food.protein, 2)} g</span>;
  if (column === "carbs") return <span className="nf-macro">{formatNumber(food.carbs, 2)} g</span>;
  if (column === "fat") return <span className="nf-macro">{formatNumber(food.fat, 2)} g</span>;
  if (column === "unit") return <span className="nf-macro">{food.unit}</span>;
  if (column === "mode") return <select className="nf-inlineSelect" value={generation.mode} onChange={(event) => setValue(["mode"], event.target.value)} aria-label={`Modo de generación de ${food.name}`}>{GENERATION_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select>;
  if (column === "rolesSummary") return <small className="nf-generationSummary">{enabledSummary(generation.roles, GENERATION_ROLES)}</small>;
  if (column === "momentsSummary") return <small className="nf-generationSummary">{mealTypesSummary(generation.mealTypes)}</small>;
  if (GENERATION_ROLES.some(([key]) => key === column)) return <InlineToggle checked={generation.roles[column]} onChange={(checked) => setValue(["roles", column], checked)} label={`${column} de ${food.name}`} />;
  if (GENERATION_MEAL_TYPES.some(([key]) => key === column)) return <InlineToggle checked={generation.mealTypes[column]} onChange={(checked) => setValue(["mealTypes", column], checked)} label={`${ADMIN_FOOD_COLUMN_LABELS[column]} de ${food.name}`} />;
  if (column === "portionUnit") return <select className="nf-inlineSelect compact" value={generation.portionRule.unit || ""} onChange={(event) => setValue(["portionRule", "unit"], event.target.value || null)} aria-label={`Unidad técnica de ${food.name}`}><option value="">—</option>{PORTION_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>;
  if (["min", "max", "step"].includes(column)) return <input className="nf-inlineNumber" type="number" min="0" step="any" value={generation.portionRule[column] ?? ""} onChange={(event) => setValue(["portionRule", column], event.target.value)} placeholder="—" aria-label={`${ADMIN_FOOD_COLUMN_LABELS[column]} de ${food.name}`} />;
  if (column === "allowedValues") return <input className="nf-inlineValues" value={draft.allowedValuesText} onChange={(event) => setAllowedValuesText(event.target.value)} placeholder="1, 2, 3" aria-label={`Valores permitidos de ${food.name}`} />;
  if (column === "edit") return <button type="button" className="nf-iconBtn nf-editFoodBtn" onClick={onEdit} aria-label={`Editar ${food.name}`} title="Editor completo"><Pencil size={16} aria-hidden="true" /></button>;
  if (column === "save") return <div className="nf-inlineSaveCell sticky-right"><button type="button" className={`nf-inlineSave ${dirty ? "ready" : ""} ${saved ? "saved" : ""}`} onClick={onSave} disabled={!dirty || saving} aria-label={`Guardar cambios de ${food.name}`}>{saved ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}<span>{saving ? "Guardando…" : saved ? "Guardado" : "Guardar"}</span></button></div>;
  return null;
}

function InlineToggle({ checked, onChange, label }) { return <label className={`nf-inlineToggle ${checked ? "checked" : ""}`} title={label}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} /><span aria-hidden="true">{checked ? <Check size={13} /> : null}</span></label>; }

function ColumnPicker({ columns, onChange, onClose }) {
  return <div className="nf-columnPicker" role="dialog" aria-label="Elegir columnas visibles"><header><div><strong>Columnas visibles</strong><span>La selección queda guardada en este dispositivo.</span></div><button type="button" onClick={onClose} aria-label="Cerrar selector de columnas"><X size={17} /></button></header><div className="nf-columnPickerGroups">{ADMIN_FOOD_COLUMN_GROUPS.map((group) => <section key={group.id}><h3>{group.label}</h3><div>{group.columns.map(([key, label]) => <label key={key} className={key === "food" ? "locked" : ""}><input type="checkbox" checked={columns.includes(key)} disabled={key === "food"} onChange={() => onChange(toggleAdminFoodColumn(columns, key))} /><span>{label}</span></label>)}</div></section>)}</div><button type="button" className="nf-columnReset" onClick={() => onChange([...DEFAULT_ADMIN_FOOD_COLUMNS])}><RotateCcw size={15} /> Restablecer columnas</button></div>;
}

function FoodCard({ food, onEdit }) { const generation = generationForFood(food); return <article className="nf-card"><div className="nf-cardTop"><div><h3>{food.name}</h3><small className="nf-foodRecordId">ID {food.alimentoId ?? "—"}</small></div><GenerationMode food={food} /></div><FoodStateBadges food={food} /><p>{food.subcategoria || food.source || "Alimento de la base maestra"} · {food.unit}</p><div className="nf-macroGrid"><Macro label="Kcal" value={formatNumber(food.kcal, 2)} /><Macro label="Prot." value={`${formatNumber(food.protein, 2)} g`} /><Macro label="Carbs" value={`${formatNumber(food.carbs, 2)} g`} /><Macro label="Grasas" value={`${formatNumber(food.fat, 2)} g`} /></div><div className="nf-foodGenerationCard"><span><b>Roles:</b> {enabledSummary(generation.roles, GENERATION_ROLES)}</span><span><b>Momentos:</b> {mealTypesSummary(generation.mealTypes)}</span></div><button type="button" className="nf-btn ghost nf-foodCardEdit" onClick={onEdit} aria-label={`Editar ${food.name}`}><Pencil size={15} /> Editar metadata</button></article>; }
function GenerationMode({ food }) { const generation = generationForFood(food); return <span className={`nf-generationMode ${generation.mode.toLowerCase()}`}>{generation.mode}</span>; }
function FoodStateBadges({ food }) { const raw = food.raw || {}; return <span className="nf-foodStateBadges">{raw.activo === false ? <span className="nf-pill muted">Inactivo</span> : null}{raw.requiereRevision === true ? <span className="nf-pill warning"><AlertTriangle size={11} /> Revisar</span> : null}{raw.duplicadoNombreUnidad === true ? <span className="nf-pill warning">Duplicado</span> : null}</span>; }
function FilterSelect({ value, onChange, label, first, options }) { return <select className="nf-select" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}><option value="todos">{first}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
function Stat({ label, value, tone = "" }) { return <div className={`nf-stat ${tone}`.trim()}><span>{label}</span><strong>{value}</strong></div>; }
function Macro({ label, value }) { return <div className="nf-macroBox"><span>{label}</span><strong>{value}</strong></div>; }
function useDebouncedValue(value, delay) { const [debounced, setDebounced] = useState(value); useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [delay, value]); return debounced; }
function Pagination({ page, totalPages, limit, total, visible, onPage, onLimit }) { const from = total > 0 ? (page - 1) * limit + 1 : 0; const to = total > 0 ? Math.min(total, from + visible - 1) : 0; return <nav className="nf-foodPagination" aria-label="Paginación del catálogo"><span>Mostrando <strong>{formatNumber(from)}–{formatNumber(to)}</strong> de <strong>{formatNumber(total)}</strong></span><label><span>Por página</span><select value={limit} onChange={(event) => onLimit(Number(event.target.value))}>{[20,40,80,100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="nf-foodPageActions"><button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Página anterior"><ChevronLeft size={18} /></button><span>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span><button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Página siguiente"><ChevronRight size={18} /></button></div></nav>; }
function SkeletonGrid() { return <div className="nf-cardGrid">{Array.from({ length: 6 }).map((_, index) => <div className="nf-skeleton" key={index} />)}</div>; }
