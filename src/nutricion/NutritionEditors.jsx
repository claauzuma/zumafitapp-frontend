/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  Beef,
  BookOpen,
  ChefHat,
  Copy,
  Flame,
  Pencil,
  Plus,
  Replace,
  Save,
  Search,
  Settings,
  Shuffle,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { getFoodEquivalents } from "../menus/menusApi.js";
import { generateMealQuantities } from "./nutricionApi.js";
import {
  buildFoodIndex,
  buildMenuItemSnapshot,
  cleanText,
  formatNumber,
  groupFromMealType,
  normalizeMealTypeToken,
  toNumber,
} from "./nutricionUtils.js";
import { compactMacroLine, kcalRangeFromValue } from "./nutritionIdentity.js";

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

const TEMPLATE_TIERS = [
  ["global_basic", "Global basic"],
  ["global_pro", "Coach Pro"],
  ["global_premium", "Coach AI / VIP"],
];

function tierFromLegacyPlan(value = "") {
  const plan = String(value || "").trim().toLowerCase();
  if (["vip", "premium", "global_premium"].includes(plan)) return "global_premium";
  if (["pro", "global_pro"].includes(plan)) return "global_pro";
  return "global_basic";
}

const MEAL_LIBRARY_GROUPS = [
  ["todas", "Todas"],
  ["desayuno_merienda", "Desayuno / Merienda"],
  ["almuerzo_cena", "Almuerzo / Cena"],
  ["snack", "Snack"],
];

const RECIPE_KCAL_FILTERS = [
  ["todas", "Todas"],
  ["lt300", "<300"],
  ["300-500", "300-500"],
  ["500-700", "500-700"],
  ["gte700", "700+"],
];

const RECIPE_PROTEIN_FILTERS = [
  ["todas", "Todas"],
  ["lt20", "<20g"],
  ["20-40", "20-40g"],
  ["gte40", "40g+"],
];

const DEFAULT_QUANTITY_SETTINGS = {
  mode: "kcalProteina",
  generationType: "selectedOnly",
};

const GUIDED_MEAL_TEMPLATES = {
  3: [
    ["Desayuno", "desayuno", 30],
    ["Almuerzo", "almuerzo", 40],
    ["Cena", "cena", 30],
  ],
  4: [
    ["Desayuno", "desayuno", 25],
    ["Almuerzo", "almuerzo", 35],
    ["Merienda", "merienda", 15],
    ["Cena", "cena", 25],
  ],
  5: [
    ["Desayuno", "desayuno", 20],
    ["Almuerzo", "almuerzo", 30],
    ["Merienda", "merienda", 15],
    ["Cena", "cena", 25],
    ["Snack", "snack", 10],
  ],
};

export function createEmptyMealDraft() {
  return {
    nombre: "",
    descripcion: "",
    tipoComida: "almuerzo",
    grupoComida: "almuerzo_cena",
    tags: [],
    visibilidad: "privada",
    templateTier: "global_basic",
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
    templateTier: "global_basic",
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
    templateTier: draft.templateTier || "global_basic",
    estado: draft.estado || "activo",
  };
}

export function buildQuantityGenerationPayload(meal = {}) {
  const target = mealTargetFromMeal(meal);
  const normalizedItems = normalizeItems(meal.items || []);
  const fixedFoods = normalizedItems
    .filter((item) => quantitySourceOf(item) === "manual")
    .map((item) => ({
      foodId: item.alimentoId || item.id || null,
      name: item.nombreSnapshot,
      quantity: toNumber(item.cantidad, 0),
      unit: item.unidad || "g",
      kcal: toNumber(item.kcal, 0),
      protein: toNumber(item.proteina, 0),
      carbs: toNumber(item.carbs, 0),
      fat: toNumber(item.grasas, 0),
      source: "manual",
    }));
  const pendingFoods = normalizedItems
    .filter(isQuantityCalculable)
    .map((item) => {
      const base = item._macroBase || {};
      const baseQty = toNumber(base.cantidad, 100) || 100;
      return {
        foodId: item.alimentoId || item.id || null,
        name: item.nombreSnapshot,
        unit: item.unidad || "g",
        source: quantitySourceOf(item),
        currentQuantity: isQuantityAutomatic(item) ? toNumber(item.cantidad, 0) : null,
        kcalPerUnitOrGram: round(toNumber(base.kcal, 0) / baseQty),
        proteinPerUnitOrGram: round(toNumber(base.proteina, 0) / baseQty),
        carbsPerUnitOrGram: round(toNumber(base.carbs, 0) / baseQty),
        fatPerUnitOrGram: round(toNumber(base.grasas, 0) / baseQty),
      };
    });

  return {
    mealTarget: {
      kcal: target.kcal || null,
      protein: target.proteina || null,
      carbs: null,
      fat: null,
    },
    fixedFoods,
    pendingFoods,
  };
}

function buildQuantityGenerationRequest(meal = {}, settings = DEFAULT_QUANTITY_SETTINGS) {
  const basePayload = buildQuantityGenerationPayload(meal);
  return {
    target: {
      kcal: basePayload.mealTarget.kcal,
      proteina: basePayload.mealTarget.protein,
      carbs: meal.objetivoCarbs ?? meal.objetivoCarbohidratos ?? null,
      grasas: meal.objetivoGrasas ?? null,
    },
    mode: settings.mode || DEFAULT_QUANTITY_SETTINGS.mode,
    generationType: settings.generationType || DEFAULT_QUANTITY_SETTINGS.generationType,
    fixedFoods: basePayload.fixedFoods,
    pendingFoods: basePayload.pendingFoods,
    options: {
      redondear: true,
      usarMinMax: true,
      generarVariante: settings.generateVariant === true,
      variantSeed: settings.variantSeed || 1,
    },
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
      grupoComida: normalizedMeal.grupoComida,
      objetivoKcal: meal.objetivoKcal,
      objetivoProteina: meal.objetivoProteina,
      items: normalizedMeal.items,
      totales: totalsFromItems(normalizedMeal.items),
    };
  });
  const totals = totalsFromMeals(comidas);
  const hasComidasTotals = totals.kcal > 0 || totals.proteina > 0 || totals.carbs > 0 || totals.grasas > 0;
  const kcalObjetivo = hasComidasTotals ? totals.kcal : toNumber(draft.kcalObjetivo, totals.kcal);
  const macrosObjetivo = {
    proteina: hasComidasTotals ? totals.proteina : toNumber(draft.macrosObjetivo?.proteina, totals.proteina),
    carbs: hasComidasTotals ? totals.carbs : toNumber(draft.macrosObjetivo?.carbs, totals.carbs),
    grasas: hasComidasTotals ? totals.grasas : toNumber(draft.macrosObjetivo?.grasas, totals.grasas),
  };

  return {
    nombre: draft.nombre || "Menu sin nombre",
    descripcion: draft.descripcion || "",
    kcalObjetivo,
    rangoKcal: kcalRangeFromValue(kcalObjetivo),
    macrosObjetivo,
    objetivo: draft.objetivo || "mantenimiento",
    cantidadComidas: comidas.length,
    tags: tagsFromInput(draft.tags),
    visibilidad: draft.visibilidad || "privada",
    templateTier: draft.templateTier || "global_basic",
    estado: draft.estado || "activo",
    comidas,
  };
}

export function normalizeMealDraft(raw = {}, foods = []) {
  const source = raw?.raw || raw || {};
  const tipoComida = normalizeMealTypeToken(source.tipoComida || raw.tipoComida || raw.type || raw.name || raw.nombre);
  const items = pickFirstItemList(source, raw);
  return recalcMealDraft({
    id: source.id || source._id || raw.id || "",
    nombre: source.nombre || raw.nombre || raw.name || "",
    descripcion: source.descripcion || raw.descripcion || raw.description || "",
    tipoComida,
    grupoComida: source.grupoComida || raw.grupoComida || groupFromMealType(tipoComida),
    objetivoKcal: source.objetivoKcal ?? raw.objetivoKcal,
    objetivoProteina: source.objetivoProteina ?? raw.objetivoProteina,
    tags: Array.isArray(source.tags || raw.tags) ? source.tags || raw.tags : [],
    visibilidad: source.visibilidad || raw.visibilidad || raw.visibility || "privada",
    templateTier: source.templateTier || raw.templateTier || tierFromLegacyPlan(source.planMinimo || raw.planMinimo),
    estado: source.estado || raw.estado || raw.status || "activo",
    items: normalizeItems(items, foods),
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
    templateTier: source.templateTier || raw.templateTier || tierFromLegacyPlan(source.planMinimo || raw.planMinimo),
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
  visibilityOptions = VISIBILITY,
}) {
  const [draft, setDraft] = useState(() => normalizeMealDraft(initialMeal || createEmptyMealDraft()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [equivalentRequest, setEquivalentRequest] = useState(null);

  useEffect(() => {
    setDraft(normalizeMealDraft(initialMeal || createEmptyMealDraft()));
  }, [initialMeal]);

  const update = useCallback((patch) => {
    setDraft((current) => recalcMealDraft({ ...current, ...patch }));
  }, []);

  const updateItem = useCallback((index, patch) => {
    setDraft((current) => recalcMealDraft({
      ...current,
      items: (current.items || []).map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }, []);

  const removeItem = useCallback((index) => {
    setDraft((current) => recalcMealDraft({
      ...current,
      items: (current.items || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const addItem = useCallback((item) => {
    setPickerOpen(false);
    runAfterNextPaint(() => {
      setDraft((current) => recalcMealDraft({
        ...current,
        items: [...(current.items || []), withMacroBase(item)],
      }));
    });
  }, []);

  const replaceItem = useCallback((index, nextItem) => {
    setDraft((current) => recalcMealDraft({
      ...current,
      items: (current.items || []).map((item, itemIndex) => (itemIndex === index ? withMacroBase(nextItem) : item)),
    }));
    setEquivalentRequest(null);
  }, []);

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
              options={allowSystemVisibility ? visibilityOptions : visibilityOptions.filter(([value]) => value !== "sistema")}
              onChange={(value) => update({ visibilidad: value })}
            />
          </div>
          {allowSystemVisibility ? (
            <SelectField
              label="Nivel biblioteca"
              value={draft.templateTier || "global_basic"}
              options={TEMPLATE_TIERS}
              onChange={(value) => update({ templateTier: value })}
            />
          ) : null}
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

          <FoodItemsEditor
            items={draft.items}
            onUpdate={updateItem}
            onRemove={removeItem}
            onReplace={(index, item) => setEquivalentRequest({ index, item })}
          />

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
      {equivalentRequest ? (
        <FoodEquivalentPicker
          item={equivalentRequest.item}
          onPick={(nextItem) => replaceItem(equivalentRequest.index, nextItem)}
          onClose={() => setEquivalentRequest(null)}
        />
      ) : null}
    </EditorShell>
  );
}

export function MenuCreationFlow({
  foods = [],
  foodsLoading = false,
  mealLibrary = [],
  onSave,
  onClose,
  saving = false,
  allowSystemVisibility = true,
  canUseSuggestions = true,
  guidedDefaults = null,
}) {
  const [step, setStep] = useState("choice");
  const [initialMenu, setInitialMenu] = useState(null);
  const [notice, setNotice] = useState("");
  const [guided, setGuided] = useState(() => ({
    nombre: guidedDefaults?.nombre || "",
    kcal: guidedDefaults?.kcal ?? 1800,
    proteina: guidedDefaults?.proteina ?? guidedDefaults?.protein ?? 140,
    carbs: guidedDefaults?.carbs ?? "",
    grasas: guidedDefaults?.grasas ?? guidedDefaults?.fat ?? "",
    mealCount: 4,
    customMealCount: 4,
    distributionMode: "auto",
    buildMode: "empty",
    percents: [],
  }));

  const mealCount = guided.mealCount === "custom"
    ? clampNumber(toNumber(guided.customMealCount, 4), 1, 8)
    : Number(guided.mealCount || 4);
  const autoSlots = useMemo(() => guidedSlotsForCount(mealCount), [mealCount]);

  useEffect(() => {
    setGuided((current) => {
      if (current.distributionMode !== "custom") return current;
      const currentPercents = Array.isArray(current.percents) ? current.percents : [];
      return {
        ...current,
        percents: autoSlots.map((slot, index) => currentPercents[index] ?? slot.percent),
      };
    });
  }, [autoSlots]);

  const targetMeals = useMemo(() => {
    const slots = guided.distributionMode === "custom"
      ? applyCustomPercents(autoSlots, guided.percents)
      : autoSlots;
    return buildGuidedMealTargets({
      slots,
      kcal: guided.kcal,
      proteina: guided.proteina,
    });
  }, [autoSlots, guided.distributionMode, guided.kcal, guided.percents, guided.proteina]);

  function openManualEditor() {
    setInitialMenu({
      ...createEmptyMenuDraft(),
      nombre: guidedDefaults?.nombre || "",
      kcalObjetivo: guidedDefaults?.kcal ?? 0,
      macrosObjetivo: {
        proteina: guidedDefaults?.proteina ?? guidedDefaults?.protein ?? 0,
        carbs: guidedDefaults?.carbs ?? 0,
        grasas: guidedDefaults?.grasas ?? guidedDefaults?.fat ?? 0,
      },
    });
    setNotice("");
    setStep("editor");
  }

  function openGuidedEditor() {
    const baseMenu = buildGuidedMenuDraft({
      guided,
      targetMeals,
      mealLibrary,
      foods,
      canUseSuggestions,
    });
    setInitialMenu(baseMenu.menu);
    setNotice(baseMenu.notice);
    setStep("editor");
  }

  if (step === "editor") {
    return (
      <MenuBaseEditor
        initialMenu={initialMenu}
        foods={foods}
        foodsLoading={foodsLoading}
        mealLibrary={mealLibrary}
        onSave={onSave}
        onClose={onClose}
        saving={saving}
        title="Crear menu base"
        submitLabel="Crear menu"
        allowSystemVisibility={allowSystemVisibility}
        notice={notice}
      />
    );
  }

  if (step === "guided") {
    return (
      <EditorShell title="Crear menu" icon={Target} onClose={onClose}>
        <div className="ne-createIntro">
          <p>Defini kcal, macros y cantidad de comidas. ZumaFit prepara una estructura inicial editable.</p>
        </div>
        <div className="ne-guidedLayout">
          <section className="ne-guidedPanel">
            <Field label="Nombre del menu" value={guided.nombre} onChange={(value) => setGuided((prev) => ({ ...prev, nombre: value }))} />
            <div className="ne-three">
              <Field label="Kcal objetivo" value={guided.kcal} onChange={(value) => setGuided((prev) => ({ ...prev, kcal: value }))} />
              <Field label="Proteina objetivo" value={guided.proteina} onChange={(value) => setGuided((prev) => ({ ...prev, proteina: value }))} />
              <Field label="Carbs opcional" value={guided.carbs} onChange={(value) => setGuided((prev) => ({ ...prev, carbs: value }))} />
            </div>
            <Field label="Grasas opcional" value={guided.grasas} onChange={(value) => setGuided((prev) => ({ ...prev, grasas: value }))} />

            <GuidedChipGroup
              label="Cantidad de comidas"
              value={guided.mealCount}
              options={[
                [3, "3"],
                [4, "4"],
                [5, "5"],
                ["custom", "Personalizado"],
              ]}
              onChange={(value) => setGuided((prev) => ({ ...prev, mealCount: value }))}
            />
            {guided.mealCount === "custom" ? (
              <Field
                label="Comidas"
                value={guided.customMealCount}
                onChange={(value) => setGuided((prev) => ({ ...prev, customMealCount: value }))}
              />
            ) : null}

            <GuidedChipGroup
              label="Tipo de distribucion"
              value={guided.distributionMode}
              options={[
                ["auto", "Automatica"],
                ["custom", "Personalizada"],
              ]}
              onChange={(value) => setGuided((prev) => ({ ...prev, distributionMode: value }))}
            />

            {guided.distributionMode === "custom" ? (
              <div className="ne-customPercents">
                {autoSlots.map((slot, index) => (
                  <Field
                    key={`${slot.tipo}-${index}`}
                    label={`${slot.nombre} %`}
                    value={guided.percents?.[index] ?? slot.percent}
                    onChange={(value) =>
                      setGuided((prev) => {
                        const next = [...(prev.percents || autoSlots.map((item) => item.percent))];
                        next[index] = value;
                        return { ...prev, percents: next };
                      })
                    }
                  />
                ))}
              </div>
            ) : null}

            <div className="ne-guidedBuild">
              <span>Armado inicial</span>
              <button
                type="button"
                className={guided.buildMode === "empty" ? "active" : ""}
                onClick={() => setGuided((prev) => ({ ...prev, buildMode: "empty" }))}
              >
                Crear estructura vacia
              </button>
              <button
                type="button"
                className={guided.buildMode === "suggest" ? "active" : ""}
                onClick={() => setGuided((prev) => ({ ...prev, buildMode: "suggest" }))}
                disabled={!canUseSuggestions}
                title={!canUseSuggestions ? "Disponible con permiso semiautomatico o automatico" : ""}
              >
                Sugerir comidas automaticamente
              </button>
              {!canUseSuggestions ? <small>Tu plan no habilita sugerencias automaticas.</small> : null}
            </div>
          </section>

          <aside className="ne-guidedPreview">
            <span className="nf-pill good">
              <Flame size={14} strokeWidth={2.3} aria-hidden="true" />
              Distribucion estimada
            </span>
            <h3>{formatNumber(guided.kcal)} kcal</h3>
            <p>P {formatNumber(guided.proteina, 1)} g objetivo</p>
            <div className="ne-distributionList">
              {targetMeals.map((meal, index) => (
                <div key={`${meal.tipo}-${index}`}>
                  <strong>{meal.nombre}</strong>
                  <span>{formatNumber(meal.objetivoKcal)} kcal · P {formatNumber(meal.objetivoProteina, 1)} g</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
        <div className="ne-actions">
          <button type="button" className="nf-btn ghost" onClick={() => setStep("choice")}>Volver</button>
          <button type="button" className="nf-btn gold" onClick={openGuidedEditor}>
            <Sparkles size={16} strokeWidth={2.3} aria-hidden="true" />
            Continuar al editor
          </button>
        </div>
      </EditorShell>
    );
  }

  return (
    <EditorShell title="Crear menu" icon={BookOpen} onClose={onClose}>
      <div className="ne-createIntro">
        <h3>Elegi como queres armar este menu.</h3>
      </div>
      <div className="ne-createChoiceGrid">
        <button type="button" className="ne-createChoiceCard" onClick={openManualEditor}>
          <span className="nf-pill good">
            <BookOpen size={14} strokeWidth={2.3} aria-hidden="true" />
            Manual libre
          </span>
          <strong>Manual libre</strong>
          <small>Arma el menu desde cero agregando comidas, recetas y alimentos.</small>
          <em>Elegir</em>
        </button>
        <button type="button" className="ne-createChoiceCard featured" onClick={() => setStep("guided")}>
          <span className="nf-pill demo">
            <Target size={14} strokeWidth={2.3} aria-hidden="true" />
            Guiado
          </span>
          <strong>Guiado por meta calorica</strong>
          <small>Defini kcal, macros y cantidad de comidas. ZumaFit prepara la estructura inicial.</small>
          <em>Elegir</em>
        </button>
      </div>
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
  notice = "",
}) {
  const [draft, setDraft] = useState(() => normalizeMenuDraft(initialMenu || createEmptyMenuDraft()));
  const [pickerMealIndex, setPickerMealIndex] = useState(null);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [equivalentRequest, setEquivalentRequest] = useState(null);
  const [mealEquivalentRequest, setMealEquivalentRequest] = useState(null);
  const [quantityGenerationRequest, setQuantityGenerationRequest] = useState(null);
  const [quantitySettings, setQuantitySettings] = useState(DEFAULT_QUANTITY_SETTINGS);
  const [quantityNotice, setQuantityNotice] = useState("");
  const [quantityQuickState, setQuantityQuickState] = useState({});
  const [quantityVariantSeeds, setQuantityVariantSeeds] = useState({});
  const [mobileEditingMealIndex, setMobileEditingMealIndex] = useState(null);
  const [mobileMenuSettingsOpen, setMobileMenuSettingsOpen] = useState(false);
  const isMobileEditor = useMediaQuery("(max-width: 720px)");
  const draftRef = useRef(draft);
  const quantitySettingsRef = useRef(quantitySettings);
  const quantityQuickStateRef = useRef(quantityQuickState);
  const quantityVariantSeedsRef = useRef(quantityVariantSeeds);

  draftRef.current = draft;
  quantitySettingsRef.current = quantitySettings;
  quantityQuickStateRef.current = quantityQuickState;
  quantityVariantSeedsRef.current = quantityVariantSeeds;

  useEffect(() => {
    setDraft(normalizeMenuDraft(initialMenu || createEmptyMenuDraft()));
    setAddMealOpen(false);
    setQuantityNotice("");
    setQuantityQuickState({});
    setQuantityVariantSeeds({});
    setMobileEditingMealIndex(null);
    setMobileMenuSettingsOpen(false);
  }, [initialMenu]);

  useEffect(() => {
    if (!isMobileEditor) {
      setMobileEditingMealIndex(null);
      setMobileMenuSettingsOpen(false);
    }
  }, [isMobileEditor]);

  const update = useCallback((patch) => {
    setDraft((current) => ({
      ...current,
      ...patch,
      ...(Object.prototype.hasOwnProperty.call(patch, "tags") ? { tags: tagsFromInput(patch.tags) } : {}),
    }));
  }, []);

  const updateMeal = useCallback((index, patch) => {
    setDraft((current) => {
      const meals = current.comidas || [];
      const meal = meals[index];
      if (!meal) return current;
      const nextDraft = { ...meal, ...patch };
      const nextMeal = Object.prototype.hasOwnProperty.call(patch, "items")
        ? recalcMealDraft(nextDraft)
        : {
            ...nextDraft,
            ...(Object.prototype.hasOwnProperty.call(patch, "tags") ? { tags: tagsFromInput(patch.tags) } : {}),
          };
      return {
        ...current,
        comidas: meals.map((currentMeal, mealIndex) => (mealIndex === index ? nextMeal : currentMeal)),
      };
    });
  }, []);

  const mealFromLibrary = useCallback((meal) => {
    return {
      ...normalizeMealDraft(meal, foods),
      id: generatedClientId("meal"),
    };
  }, [foods]);

  const addMeal = useCallback((meal = null) => {
    setAddMealOpen(false);
    runAfterNextPaint(() => {
      setDraft((current) => {
        const meals = current.comidas || [];
        const nextMeal = meal
          ? mealFromLibrary(meal)
          : recalcMealDraft({
              ...createEmptyMealDraft(),
              nombre: `Comida manual ${meals.length + 1}`,
            });
        return { ...current, comidas: [...meals, nextMeal] };
      });
    });
  }, [mealFromLibrary]);

  const duplicateMeal = useCallback((index) => {
    setDraft((current) => {
      const meals = current.comidas || [];
      const meal = meals[index];
      if (!meal) return current;
      const duplicate = recalcMealDraft({
        ...meal,
        id: generatedClientId("meal"),
        nombre: `${meal.nombre} copia`,
      });
      return { ...current, comidas: [...meals, duplicate] };
    });
  }, []);

  const removeMeal = useCallback((index) => {
    setDraft((current) => ({
      ...current,
      comidas: (current.comidas || []).filter((_, mealIndex) => mealIndex !== index),
    }));
  }, []);

  const removeMealMobileAware = useCallback((index) => {
    setMobileEditingMealIndex((current) => {
      if (current === null) return current;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
    removeMeal(index);
  }, [removeMeal]);

  const updateItem = useCallback((mealIndex, itemIndex, patch) => {
    setDraft((current) => {
      const meals = current.comidas || [];
      const meal = meals[mealIndex];
      if (!meal) return current;
      const nextMeal = recalcMealDraft({
        ...meal,
        items: (meal.items || []).map((item, index) => (index === itemIndex ? { ...item, ...patch } : item)),
      });
      return {
        ...current,
        comidas: meals.map((currentMeal, index) => (index === mealIndex ? nextMeal : currentMeal)),
      };
    });
  }, []);

  const removeItem = useCallback((mealIndex, itemIndex) => {
    setDraft((current) => {
      const meals = current.comidas || [];
      const meal = meals[mealIndex];
      if (!meal) return current;
      const nextMeal = recalcMealDraft({
        ...meal,
        items: (meal.items || []).filter((_, index) => index !== itemIndex),
      });
      return {
        ...current,
        comidas: meals.map((currentMeal, index) => (index === mealIndex ? nextMeal : currentMeal)),
      };
    });
  }, []);

  const replaceItem = useCallback((mealIndex, itemIndex, nextItem) => {
    setDraft((current) => {
      const meals = current.comidas || [];
      const meal = meals[mealIndex];
      if (!meal) return current;
      const nextMeal = recalcMealDraft({
        ...meal,
        items: (meal.items || []).map((item, index) => (index === itemIndex ? withMacroBase(nextItem) : item)),
      });
      return {
        ...current,
        comidas: meals.map((currentMeal, index) => (index === mealIndex ? nextMeal : currentMeal)),
      };
    });
    setEquivalentRequest(null);
  }, []);

  const addItem = useCallback((item) => {
    if (pickerMealIndex === null) return;
    const targetMealIndex = pickerMealIndex;
    setPickerMealIndex(null);
    runAfterNextPaint(() => {
      setDraft((current) => {
        const meals = current.comidas || [];
        const meal = meals[targetMealIndex];
        if (!meal) return current;
        const nextMeal = recalcMealDraft({
          ...meal,
          items: [...(meal.items || []), withMacroBase(item)],
        });
        return {
          ...current,
          comidas: meals.map((currentMeal, index) => (index === targetMealIndex ? nextMeal : currentMeal)),
        };
      });
    });
  }, [pickerMealIndex]);

  const prepareQuantityGeneration = useCallback((mealIndex, options = {}) => {
    const meal = draftRef.current.comidas?.[mealIndex];
    if (!meal) return;
    setQuantityGenerationRequest({
      mealIndex,
      meal,
      showSettings: options.showSettings === true,
      autoCalculate: options.autoCalculate !== false,
    });
    setQuantityNotice("");
  }, []);

  const openQuantityGenerationSettings = useCallback((mealIndex) => {
    prepareQuantityGeneration(mealIndex, {
      showSettings: true,
      autoCalculate: false,
    });
  }, [prepareQuantityGeneration]);

  const openFoodPicker = useCallback((mealIndex) => {
    setPickerMealIndex(mealIndex);
  }, []);

  const openMealEquivalent = useCallback((mealIndex, meal) => {
    setMealEquivalentRequest({ mealIndex, meal });
  }, []);

  const openItemEquivalent = useCallback((mealIndex, itemIndex, item) => {
    setEquivalentRequest({ mealIndex, itemIndex, item });
  }, []);

  const updateMenuField = useCallback((field, value) => {
    update({ [field]: value });
  }, [update]);

  const updateMenuMacro = useCallback((field, value) => {
    setDraft((current) => ({
      ...current,
      macrosObjetivo: {
        ...(current.macrosObjetivo || {}),
        [field]: value,
      },
    }));
  }, []);

  const applyQuantityGeneration = useCallback((mealIndex, result, options = {}) => {
    const meal = draftRef.current.comidas?.[mealIndex];
    if (!meal || !result?.foods?.length) return [];
    const generatedByName = new Map(
      result.foods.map((food) => [cleanText(food.name || food.nombre), food])
    );
    const used = new Set();
    const appliedNames = new Set();
    const nextItems = (meal.items || []).map((item) => {
      const key = cleanText(item.nombreSnapshot || item.nombre || item.name);
      const generated = generatedByName.get(key);
      if (!generated) return isQuantityCalculable(item) ? markItemPending(item) : item;
      used.add(key);
      if (generated.source !== "fixed") appliedNames.add(key);
      return itemFromQuantityGeneration(generated, item);
    });

    result.foods
      .filter((food) => food.source === "addedCandidate")
      .forEach((food) => {
        const key = cleanText(food.name || food.nombre);
        if (!used.has(key)) {
          nextItems.push(itemFromQuantityGeneration(food));
          appliedNames.add(key);
        }
      });

    updateMeal(mealIndex, { items: nextItems });
    if (options.closeModal !== false) setQuantityGenerationRequest(null);
    if (options.showNotice !== false) setQuantityNotice(result.message || "Cantidades aplicadas correctamente.");
    return [...appliedNames];
  }, [updateMeal]);

  const calculateQuantitiesInline = useCallback(async (mealIndex, options = {}) => {
    const meal = draftRef.current.comidas?.[mealIndex];
    if (!meal) return;
    const generateVariant = options.generateVariant === true;

    setQuantityQuickState((current) => ({
      ...current,
      [mealIndex]: { loading: true, type: "", message: "", highlightedNames: [], pendingResult: null },
    }));

    try {
      const latestMeal = draftRef.current.comidas?.[mealIndex] || meal;
      const settings = quantitySettingsRef.current;
      const result = await generateMealQuantities(buildQuantityGenerationRequest(latestMeal, {
        ...settings,
        generateVariant,
        variantSeed: options.variantSeed || 1,
      }));
      if (!result?.foods?.length || result.status === "error") {
        setQuantityQuickState((current) => ({
          ...current,
          [mealIndex]: {
            loading: false,
            type: "error",
            message: result?.message || "No se pudieron calcular cantidades para esta comida.",
            highlightedNames: [],
            pendingResult: null,
          },
        }));
        return;
      }

      if (generateVariant && result.variantApplied !== true) {
        setQuantityQuickState((current) => ({
          ...current,
          [mealIndex]: {
            loading: false,
            type: "warning",
            message: result.message || "No se encontro una variante mejor con estos alimentos.",
            highlightedNames: [],
            pendingResult: null,
          },
        }));
        return;
      }

      const feedback = quantityResultFeedback(result, settings.mode);
      if (feedback.type !== "success") {
        setQuantityQuickState((current) => ({
          ...current,
          [mealIndex]: {
            loading: false,
            type: feedback.type,
            message: feedback.message,
            highlightedNames: [],
            pendingResult: result,
          },
        }));
        return;
      }

      const highlightedNames = applyQuantityGeneration(mealIndex, result, {
        closeModal: false,
        showNotice: false,
      });
      setQuantityQuickState((current) => ({
        ...current,
        [mealIndex]: {
          loading: false,
          type: feedback.type,
          message: feedback.message,
          highlightedNames,
          pendingResult: null,
        },
      }));

      if (feedback.type === "success") {
        window.setTimeout(() => {
          setQuantityQuickState((current) => ({
            ...current,
            [mealIndex]: { ...current[mealIndex], highlightedNames: [] },
          }));
        }, 2600);
      }
    } catch (error) {
      setQuantityQuickState((current) => ({
        ...current,
        [mealIndex]: {
          loading: false,
          type: "error",
          message: error?.message || "No se pudieron calcular cantidades.",
          highlightedNames: [],
          pendingResult: null,
        },
      }));
    } finally {
      setQuantityQuickState((current) => {
        const mealState = current[mealIndex];
        if (!mealState?.loading) return current;
        return {
          ...current,
          [mealIndex]: {
            ...mealState,
            loading: false,
          },
        };
      });
    }
  }, [applyQuantityGeneration]);

  const generateQuantityVariantInline = useCallback((mealIndex) => {
    const nextSeed = (quantityVariantSeedsRef.current[mealIndex] || 0) + 1;
    const nextSeeds = { ...quantityVariantSeedsRef.current, [mealIndex]: nextSeed };
    quantityVariantSeedsRef.current = nextSeeds;
    setQuantityVariantSeeds(nextSeeds);
    calculateQuantitiesInline(mealIndex, {
      generateVariant: true,
      variantSeed: nextSeed,
    });
  }, [calculateQuantitiesInline]);

  const applyInlineQuantityResult = useCallback((mealIndex) => {
    const quickState = quantityQuickStateRef.current[mealIndex];
    if (!quickState?.pendingResult) return;
    const highlightedNames = applyQuantityGeneration(mealIndex, quickState.pendingResult, {
      closeModal: false,
      showNotice: false,
    });
    setQuantityQuickState((current) => ({
      ...current,
      [mealIndex]: {
        ...current[mealIndex],
        loading: false,
        type: "warning",
        message: "Cantidades aplicadas con advertencias. Revisalas antes de guardar.",
        highlightedNames,
        pendingResult: null,
      },
    }));
  }, [applyQuantityGeneration]);

  function useCurrentTotals() {
    const totals = menuTotals;
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

  const menuTotals = useMemo(() => totalsFromMeals(draft.comidas || []), [draft.comidas]);
  const pendingMenuItems = useMemo(
    () => (draft.comidas || []).reduce((total, meal) => total + countPendingItems(meal.items || []), 0),
    [draft.comidas]
  );

  return (
    <EditorShell title={title} icon={BookOpen} onClose={onClose}>
      {isMobileEditor ? (
        <MobileMenuEditor
          draft={draft}
          menuTotals={menuTotals}
          pendingMenuItems={pendingMenuItems}
          quickStateByMeal={quantityQuickState}
          notice={notice}
          quantityNotice={quantityNotice}
          saving={saving}
          submitLabel={submitLabel}
          allowSystemVisibility={allowSystemVisibility}
          mobileMenuSettingsOpen={mobileMenuSettingsOpen}
          editingMealIndex={mobileEditingMealIndex}
          mealLibraryLength={mealLibrary.length}
          onOpenMenuSettings={() => setMobileMenuSettingsOpen(true)}
          onCloseMenuSettings={() => setMobileMenuSettingsOpen(false)}
          onEditMeal={setMobileEditingMealIndex}
          onCloseMeal={() => setMobileEditingMealIndex(null)}
          onAddMeal={() => setAddMealOpen(true)}
          onCancel={onClose}
          onSave={() => onSave?.(menuDraftToPayload(draftRef.current))}
          onUpdateMenuField={updateMenuField}
          onUpdateMenuMacro={updateMenuMacro}
          onUpdateMenu={update}
          onUseCurrentTotals={useCurrentTotals}
          onUpdateMeal={updateMeal}
          onDuplicateMeal={duplicateMeal}
          onRemoveMeal={removeMealMobileAware}
          onOpenMealEquivalent={openMealEquivalent}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onOpenItemEquivalent={openItemEquivalent}
          onOpenFoodPicker={openFoodPicker}
          onCalculateQuantities={calculateQuantitiesInline}
          onGenerateVariant={generateQuantityVariantInline}
          onApplyInlineResult={applyInlineQuantityResult}
          onOpenQuantitySettings={openQuantityGenerationSettings}
        />
      ) : (
        <div className="ne-editorGrid">
        <aside className="ne-side">
          <BufferedField label="Nombre" value={draft.nombre} fieldKey="nombre" onCommit={updateMenuField} />
          <BufferedTextarea label="Descripcion" value={draft.descripcion || ""} fieldKey="descripcion" onCommit={updateMenuField} />
          <div className="ne-two">
            <BufferedField label="Kcal objetivo" value={draft.kcalObjetivo} fieldKey="kcalObjetivo" onCommit={updateMenuField} />
            <BufferedField label="Rango kcal" value={draft.rangoKcal} fieldKey="rangoKcal" onCommit={updateMenuField} />
          </div>
          <div className="ne-three">
            <BufferedField
              label="Proteina"
              value={draft.macrosObjetivo?.proteina}
              fieldKey="proteina"
              onCommit={updateMenuMacro}
            />
            <BufferedField
              label="Carbs"
              value={draft.macrosObjetivo?.carbs}
              fieldKey="carbs"
              onCommit={updateMenuMacro}
            />
            <BufferedField
              label="Grasas"
              value={draft.macrosObjetivo?.grasas}
              fieldKey="grasas"
              onCommit={updateMenuMacro}
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
          {allowSystemVisibility ? (
            <SelectField
              label="Nivel biblioteca"
              value={draft.templateTier || "global_basic"}
              options={TEMPLATE_TIERS}
              onChange={(value) => update({ templateTier: value })}
            />
          ) : null}
          <BufferedField label="Tags" value={tagsFromInput(draft.tags).join(", ")} fieldKey="tags" onCommit={updateMenuField} />
          <button type="button" className="nf-btn ghost" onClick={useCurrentTotals}>Usar totales actuales</button>
          <MacroSummary totals={menuTotals} />
        </aside>

        <main className="ne-main">
          {notice ? <div className="ne-editorNotice">{notice}</div> : null}
          {quantityNotice ? <div className="ne-editorNotice">{quantityNotice}</div> : null}
          {pendingMenuItems ? (
            <div className="ne-editorNotice warning">
              Este menu tiene {pendingMenuItems} alimento(s) sin cantidad. Podes guardarlo como borrador o completar cantidades antes de usarlo.
            </div>
          ) : null}
          <div className="ne-sectionTop">
            <div>
              <h3>Comidas del menu</h3>
              <p>{draft.comidas.length} comida(s) - {macroSentence(menuTotals)}</p>
            </div>
            <button type="button" className="nf-btn gold" onClick={() => setAddMealOpen(true)}>
              <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
              Agregar comida
            </button>
          </div>

          <div className="ne-meals">
            {draft.comidas.map((meal, mealIndex) => (
              <MealEditorBlock
                meal={meal}
                mealIndex={mealIndex}
                quickState={quantityQuickState[mealIndex]}
                mealLibraryLength={mealLibrary.length}
                key={`${meal.id || "meal"}-${mealIndex}`}
                onUpdateMeal={updateMeal}
                onDuplicateMeal={duplicateMeal}
                onRemoveMeal={removeMeal}
                onOpenMealEquivalent={openMealEquivalent}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onOpenItemEquivalent={openItemEquivalent}
                onOpenFoodPicker={openFoodPicker}
                onCalculateQuantities={calculateQuantitiesInline}
                onGenerateVariant={generateQuantityVariantInline}
                onApplyInlineResult={applyInlineQuantityResult}
                onOpenQuantitySettings={openQuantityGenerationSettings}
              />
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
      )}

      {pickerMealIndex !== null ? (
        <NutritionFoodPicker foods={foods} loading={foodsLoading} onPick={addItem} onClose={() => setPickerMealIndex(null)} />
      ) : null}
      {addMealOpen ? (
        <AddMenuMealPicker
          mealLibrary={mealLibrary}
          foods={foods}
          onManual={() => addMeal()}
          onRecipe={(meal) => addMeal(meal)}
          onClose={() => setAddMealOpen(false)}
        />
      ) : null}
      {equivalentRequest ? (
        <FoodEquivalentPicker
          item={equivalentRequest.item}
          onPick={(nextItem) => replaceItem(equivalentRequest.mealIndex, equivalentRequest.itemIndex, nextItem)}
          onClose={() => setEquivalentRequest(null)}
        />
      ) : null}
      {mealEquivalentRequest ? (
        <MealEquivalentPicker
          meal={mealEquivalentRequest.meal}
          mealLibrary={mealLibrary}
          foods={foods}
          onPick={(nextMeal) => {
            const currentMeal = mealEquivalentRequest.meal;
            updateMeal(mealEquivalentRequest.mealIndex, {
              ...mealFromLibrary(nextMeal),
              objetivoKcal: currentMeal?.objetivoKcal,
              objetivoProteina: currentMeal?.objetivoProteina,
            });
            setMealEquivalentRequest(null);
          }}
          onClose={() => setMealEquivalentRequest(null)}
        />
      ) : null}
      {quantityGenerationRequest ? (
        <QuantityGenerationPicker
          meal={quantityGenerationRequest.meal}
          initialSettings={quantitySettings}
          showSettingsInitially={quantityGenerationRequest.showSettings}
          autoCalculate={quantityGenerationRequest.autoCalculate}
          onSettingsChange={setQuantitySettings}
          onClose={() => setQuantityGenerationRequest(null)}
          onApply={(result) => applyQuantityGeneration(quantityGenerationRequest.mealIndex, result)}
        />
      ) : null}
    </EditorShell>
  );
}

function QuantityGenerationPicker({
  meal = {},
  initialSettings = DEFAULT_QUANTITY_SETTINGS,
  showSettingsInitially = false,
  autoCalculate = false,
  onSettingsChange,
  onClose,
  onApply,
}) {
  const [mode, setMode] = useState(initialSettings.mode || DEFAULT_QUANTITY_SETTINGS.mode);
  const [generationType, setGenerationType] = useState(
    initialSettings.generationType || DEFAULT_QUANTITY_SETTINGS.generationType
  );
  const [showSettings, setShowSettings] = useState(showSettingsInitially);
  const [autoRan, setAutoRan] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const calculableCount = countCalculableItems(meal.items || []);
  const target = mealTargetFromMeal(meal);
  const modeLabels = {
    kcal: "Solo calorias",
    kcalProteina: "Calorias + proteina",
    full: "Macros completos",
  };
  const generationLabels = {
    selectedOnly: "Solo estos alimentos",
    completeMeal: "Completar comida",
  };

  const calculate = useCallback(async (nextMode = mode, nextGenerationType = generationType) => {
    try {
      setLoading(true);
      setError("");
      setResult(null);
      onSettingsChange?.({
        mode: nextMode,
        generationType: nextGenerationType,
      });
      await waitForNextPaint();
      const response = await generateMealQuantities(buildQuantityGenerationRequest(meal, {
        mode: nextMode,
        generationType: nextGenerationType,
      }));
      setResult(response);
    } catch (err) {
      setError(err?.message || "No se pudieron calcular cantidades.");
    } finally {
      setLoading(false);
    }
  }, [generationType, meal, mode, onSettingsChange]);

  useEffect(() => {
    if (!autoCalculate || autoRan) return;
    setAutoRan(true);
    calculate();
  }, [autoCalculate, autoRan, calculate]);

  function updateMode(nextMode) {
    setMode(nextMode);
    setResult(null);
    setError("");
    onSettingsChange?.({ mode: nextMode, generationType });
  }

  function updateGenerationType(nextGenerationType) {
    setGenerationType(nextGenerationType);
    setResult(null);
    setError("");
    onSettingsChange?.({ mode, generationType: nextGenerationType });
  }

  const canApply = result && result.status !== "error" && result.foods?.length;

  return (
    <div className="ne-nestedBackdrop">
      <div className="ne-picker ne-quantityPicker">
        <div className="ne-pickerTop">
          <div>
            <span className="nf-pill demo">
              <Sparkles size={14} strokeWidth={2.3} aria-hidden="true" />
              Generador
            </span>
            <h3>{showSettings ? "Configurar calculo" : "Calcular cantidades"}</h3>
            <p className="ne-muted">
              {showSettings
                ? "Elegi que queres priorizar y ZumaFit calculara las cantidades pendientes."
                : "ZumaFit calcula directo con la configuracion actual y siempre te muestra preview antes de aplicar."}
            </p>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        <div className="ne-quantityTarget">
          <span>Objetivo comida</span>
          <strong>{formatNumber(target.kcal)} kcal - P {formatNumber(target.proteina, 1)} g</strong>
          <small>{calculableCount} alimento(s) calculable(s). Pendientes y automaticos se recalculan; los manuales quedan fijos.</small>
        </div>

        {showSettings ? (
          <div className="ne-quantityOptions">
            <QuantityOptionGroup
              title="Prioridad"
              value={mode}
              options={[
                ["kcal", "Solo calorias", "Llega lo mas cerca posible a kcal objetivo."],
                ["kcalProteina", "Calorias + proteina", "Recomendado para fitness."],
                ["full", "Macros completos", "Mas estricto: kcal, P, C y G."],
              ]}
              onChange={updateMode}
            />
            <QuantityOptionGroup
              title="Alcance"
              value={generationType}
              options={[
                ["selectedOnly", "Solo estos alimentos", "Calcula solo los alimentos pendientes elegidos."],
                ["completeMeal", "Completar comida", "Puede sumar 1-3 alimentos compatibles si ayudan."],
              ]}
              onChange={updateGenerationType}
            />
          </div>
        ) : (
          <div className="ne-quantityModeSummary">
            <span>Configuracion actual</span>
            <strong>{modeLabels[mode] || modeLabels.kcalProteina} · {generationLabels[generationType] || generationLabels.selectedOnly}</strong>
            <button type="button" className="nf-btn ghost mini" onClick={() => setShowSettings(true)}>
              <Settings size={15} strokeWidth={2.3} aria-hidden="true" />
              Abrir ajustes
            </button>
          </div>
        )}

        {error ? <div className="nf-error">{error}</div> : null}
        {result ? <QuantityGenerationPreview result={result} mode={mode} /> : null}

        <div className="ne-quantityActions">
          <button type="button" className="nf-btn ghost" onClick={onClose}>Cancelar</button>
          {!showSettings && error ? (
            <button type="button" className="nf-btn ghost" onClick={() => setShowSettings(true)}>
              <Settings size={16} strokeWidth={2.3} aria-hidden="true" />
              Abrir ajustes
            </button>
          ) : null}
          <button type="button" className="nf-btn ghost" onClick={() => calculate()} disabled={loading}>
            <Sparkles size={16} strokeWidth={2.3} aria-hidden="true" />
            {loading ? "Calculando..." : result ? "Recalcular" : "Calcular"}
          </button>
          <button type="button" className="nf-btn gold" onClick={() => onApply(result)} disabled={!canApply}>
            Aplicar cantidades
          </button>
        </div>
      </div>
    </div>
  );
}

function QuantityOptionGroup({ title, value, options = [], onChange }) {
  return (
    <div className="ne-quantityOptionGroup">
      <span>{title}</span>
      <div>
        {options.map(([optionValue, label, description]) => (
          <button
            type="button"
            className={value === optionValue ? "active" : ""}
            onClick={() => onChange(optionValue)}
            key={optionValue}
          >
            <strong>{label}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuantityGenerationPreview({ result = {} }) {
  const quality = result.quality || "revisar";
  const qualityLabel = {
    muy_cerca: "Muy cerca",
    aceptable: "Aceptable",
    revisar: "Revisar",
    sin_solucion: "Sin solucion buena",
  }[quality] || "Revisar";

  return (
    <div className={`ne-quantityPreview ${quality}`}>
      <div className="ne-quantityPreviewTop">
        <span className={`ne-compatBadge ${quality === "muy_cerca" ? "very" : quality === "aceptable" ? "close" : "review"}`}>
          {qualityLabel}
        </span>
        <p>{result.message}</p>
      </div>
      {result.errors?.length ? (
        <div className="nf-error">{result.errors.join(" ")}</div>
      ) : null}
      {result.warnings?.length ? (
        <div className="ne-editorNotice warning">{result.warnings.join(" ")}</div>
      ) : null}
      <div className="ne-quantityFoodList">
        {(result.foods || []).map((food, index) => (
          <div className="ne-quantityFoodRow" key={`${food.name}-${index}`}>
            <div>
              <strong>{food.name || food.nombre}</strong>
              <span>{sourceLabel(food.source)}</span>
            </div>
            <div>
              <strong>{formatNumber(food.quantity ?? food.cantidad, 1)} {food.unit || food.unidad || "g"}</strong>
              <small>{formatNumber(food.kcal, 0)} kcal - P {formatNumber(food.proteina ?? food.protein, 1)} / C {formatNumber(food.carbs, 1)} / G {formatNumber(food.grasas ?? food.fat, 1)}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="ne-quantityTotals">
        <div>
          <span>Totales</span>
          <strong>{formatNumber(result.totals?.calorias, 0)} kcal - P {formatNumber(result.totals?.proteina, 1)} / C {formatNumber(result.totals?.carbohidratos, 1)} / G {formatNumber(result.totals?.grasas, 1)}</strong>
        </div>
        <div>
          <span>Diferencia</span>
          <strong>{formatSigned(result.diff?.calorias, 1)} kcal / P {formatSigned(result.diff?.proteina, 1)} / C {formatSigned(result.diff?.carbohidratos, 1)} / G {formatSigned(result.diff?.grasas, 1)}</strong>
        </div>
      </div>
    </div>
  );
}

const MealGoalPanel = React.memo(function MealGoalPanel({ meal = {}, onSearchCompatible }) {
  const summary = useMemo(() => {
    const target = mealTargetFromMeal(meal);
    const actual = meal.totales || totalsFromItems(meal.items || []);
    const pendingCount = countPendingItems(meal.items || []);
    return {
      target,
      actual,
      pendingCount,
      status: mealGoalStatus(meal, { target, actual, pendingCount }),
    };
  }, [meal]);
  const { target, actual, pendingCount, status } = summary;
  const hasItems = !!meal.items?.length;

  return (
    <div className={`ne-mealGoalPanel ${status.level}`}>
      <div className="ne-mealGoalStats">
        <div>
          <span>Objetivo</span>
          <strong>{formatNumber(target.kcal)} kcal - P {formatNumber(target.proteina, 1)} g</strong>
        </div>
        <div>
          <span>{pendingCount ? "Actual fijo" : "Actual"}</span>
          <strong>{formatNumber(actual.kcal)} kcal - P {formatNumber(actual.proteina, 1)} g</strong>
        </div>
        {pendingCount ? (
          <div>
            <span>Pendientes</span>
            <strong>{pendingCount} alimento(s)</strong>
          </div>
        ) : null}
        <div>
          <span>Diferencia</span>
          <strong>{formatSigned(toNumber(actual.kcal, 0) - target.kcal)} kcal / P {formatSigned(toNumber(actual.proteina, 0) - target.proteina, 1)} g</strong>
        </div>
      </div>
      <div className="ne-mealGoalBottom">
        <span className={`ne-goalBadge ${status.level}`}>{status.label}</span>
        {status.message ? <p>{status.message}</p> : null}
        {hasItems && status.level !== "complete" ? (
          <p>No bloquea el guardado. Podes ajustar cantidades, buscar alternativa o aceptar igual.</p>
        ) : null}
        {onSearchCompatible ? (
          <button type="button" className="nf-btn ghost mini" onClick={onSearchCompatible}>
            <Replace size={14} strokeWidth={2.3} aria-hidden="true" />
            Buscar alternativa
          </button>
        ) : null}
      </div>
    </div>
  );
}, (previous, next) => (
  previous.meal === next.meal &&
  Boolean(previous.onSearchCompatible) === Boolean(next.onSearchCompatible)
));

function AddMenuMealPicker({ mealLibrary = [], foods = [], onManual, onRecipe, onClose }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("todas");
  const [kcalFilter, setKcalFilter] = useState("todas");
  const [proteinFilter, setProteinFilter] = useState("todas");
  const deferredSearch = useDeferredValue(search);
  const foodLookup = useMemo(() => buildFoodLookup(foods), [foods]);

  const recipes = useMemo(
    () =>
      mealLibrary
        .map((meal) => {
          const normalized = normalizeMealDraft(meal, foodLookup);
          return {
            ...normalized,
            _searchText: cleanText(
              `${normalized.nombre} ${normalized.tipoComida} ${(normalized.tags || []).join(" ")} ${mealFoodNames(normalized).join(" ")}`
            ),
          };
        })
        .filter((meal) => meal.id || meal.nombre || meal.items?.length),
    [foodLookup, mealLibrary]
  );

  const filteredRecipes = useMemo(() => {
    const needle = cleanText(deferredSearch);
    return recipes.filter((meal) => {
      const matchesGroup = group === "todas" || mealGroupKey(meal) === group;
      const matchesKcal = matchesRecipeKcal(meal.totales?.kcal, kcalFilter);
      const matchesProtein = matchesRecipeProtein(meal.totales?.proteina, proteinFilter);
      const matchesSearch =
        !needle ||
        meal._searchText.includes(needle);
      return matchesGroup && matchesKcal && matchesProtein && matchesSearch;
    });
  }, [deferredSearch, group, kcalFilter, proteinFilter, recipes]);

  return (
    <div className="ne-nestedBackdrop">
      <div className="ne-picker ne-addMealPicker">
        <div className="ne-pickerTop">
          <div>
            <span className="nf-pill good">
              <ChefHat size={14} strokeWidth={2.3} aria-hidden="true" />
              Comidas del menu
            </span>
            <h3>Agregar comida</h3>
            <p className="ne-muted">Elegi una receta guardada o crea una comida manual.</p>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        <div className="ne-addMealActions">
          <button type="button" className="ne-addMealAction primary" onClick={onManual}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>
              <strong>Crear comida manual</strong>
              <small>Empeza vacio y agrega alimentos reales.</small>
            </span>
          </button>
          <div className="ne-addMealAction">
            <BookOpen size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>
              <strong>Usar receta guardada</strong>
              <small>Copia alimentos y macros como snapshot del menu.</small>
            </span>
          </div>
        </div>

        {recipes.length ? (
          <>
            <div className="ne-recipeSearch">
              <Search size={17} strokeWidth={2.3} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar receta, tipo o tag..."
              />
            </div>
            <div className="ne-recipeTabs" role="tablist" aria-label="Filtrar recetas">
              {MEAL_LIBRARY_GROUPS.map(([value, label]) => (
                <button
                  type="button"
                  className={group === value ? "active" : ""}
                  onClick={() => setGroup(value)}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ne-recipeFiltersInline">
              <RecipeQuickFilters
                title="Kcal"
                value={kcalFilter}
                options={RECIPE_KCAL_FILTERS}
                onChange={setKcalFilter}
              />
              <RecipeQuickFilters
                title="Proteina"
                value={proteinFilter}
                options={RECIPE_PROTEIN_FILTERS}
                onChange={setProteinFilter}
              />
            </div>
          </>
        ) : null}

        {!recipes.length ? (
          <div className="nf-empty">No hay recetas guardadas todavia. Podes crear una comida manual.</div>
        ) : null}
        {recipes.length && !filteredRecipes.length ? (
          <div className="nf-empty">No encontre recetas con esos filtros.</div>
        ) : null}

        <div className="ne-recipeGrid">
          {filteredRecipes.map((meal, index) => {
            const preview = mealFoodPreview(meal);
            return (
              <article
                className="ne-recipeCard is-clickable"
                key={`${meal.id || meal.nombre}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() => onRecipe(meal)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRecipe(meal);
                  }
                }}
              >
                <div>
                  <span className="nf-pill">{mealTypeLabel(meal.tipoComida)}</span>
                  <h4>{mealDisplayName(meal)}</h4>
                  <p className="ne-recipeMacroLine">{macroDotLine(meal.totales)}</p>
                </div>
                <p className="ne-recipeIncludes">{preview}</p>
                <div className="ne-recipeMeta">
                  <span>{meal.items?.length || 0} alimento(s)</span>
                  <span>{meal.grupoComida || groupFromMealType(meal.tipoComida)}</span>
                  {meal.items?.some((item) => item._macroNotice === "recalculated") ? <span>Macros recalculadas</span> : null}
                  {hasSuspiciousMealTotals(meal.totales) ? <span>Revisar macros</span> : null}
                </div>
                <button
                  type="button"
                  className="nf-btn gold ne-recipeUseBtn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRecipe(meal);
                  }}
                >
                  <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
                  Usar en menu
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecipeQuickFilters({ title, value, options = [], onChange }) {
  return (
    <div className="ne-recipeFilterGroup">
      <span>{title}</span>
      <div>
        {options.map(([optionValue, label]) => (
          <button
            type="button"
            className={value === optionValue ? "active" : ""}
            onClick={() => onChange(optionValue)}
            key={optionValue}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GuidedChipGroup({ label, value, options = [], onChange }) {
  return (
    <div className="ne-guidedChips">
      <span>{label}</span>
      <div>
        {options.map(([optionValue, optionLabel]) => (
          <button
            type="button"
            className={value === optionValue ? "active" : ""}
            onClick={() => onChange(optionValue)}
            key={optionValue}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NutritionFoodPicker({ foods = [], loading = false, onPick, onClose }) {
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState(100);
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const needle = cleanText(deferredSearch);
    const matches = [];
    for (const food of foods) {
      const searchText = food._searchText || cleanText(
        `${food.nombre || food.name || ""} ${food.fuente || food.source || ""} ${food.macroGroup || ""}`
      );
      if (!needle || searchText.includes(needle)) matches.push(food);
      if (matches.length >= 32) break;
    }
    return matches;
  }, [deferredSearch, foods]);

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
          <Field label="Cantidad rapida" value={quantity} onChange={setQuantity} />
        </div>

        {loading ? <div className="nf-empty">Cargando alimentos...</div> : null}
        {!loading && !filtered.length ? <div className="nf-empty">No encontre alimentos.</div> : null}

        <div className="ne-foodGrid">
          {filtered.map((food, index) => {
            const key = String(food.id || food._id || `${food.nombre || food.name || "food"}-${index}`);
            return (
              <NutritionFoodCard food={food} defaultQuantity={quantity} onPick={onPick} key={key} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const NutritionFoodCard = React.memo(function NutritionFoodCard({ food = {}, defaultQuantity = 100, onPick }) {
  const [quantity, setQuantity] = useState(defaultQuantity);
  const unit = food.unidad || food.unit || "g";
  const hasQuantity = String(quantity ?? "").trim() !== "" && toNumber(quantity, 0) > 0;
  const item = useMemo(
    () => (hasQuantity ? buildMenuItemSnapshot(food, quantity, unit) : null),
    [food, hasQuantity, quantity, unit]
  );

  useEffect(() => {
    setQuantity(defaultQuantity);
  }, [defaultQuantity]);

  return (
    <article className="ne-foodPick ne-foodPickCard">
      <div className="ne-foodPickMain">
        <strong>{food.nombre || food.name}</strong>
        <span>
          {hasQuantity
            ? `${formatNumber(item.kcal)} kcal - P ${formatNumber(item.proteina, 1)} / C ${formatNumber(item.carbs, 1)} / G ${formatNumber(item.grasas, 1)}`
            : "Cantidad pendiente - se calcula despues"}
        </span>
        <small>{hasQuantity ? `${quantity} ${unit}` : "Sin cantidad"} - {food.fuente || food.source || food.macroGroup}</small>
      </div>
      <div className="ne-foodPickAdd">
        <label>
          <span>Cant.</span>
          <input
            value={quantity ?? ""}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="decimal"
            enterKeyHint="done"
          />
        </label>
        <button
          type="button"
          className="nf-btn gold mini"
          onClick={() => onPick(hasQuantity
            ? withMacroBase({ ...item, fixedQuantity: true, quantityPending: false, quantitySource: "manual" })
            : buildPendingMenuItem(food, unit))}
        >
          <Plus size={14} strokeWidth={2.3} aria-hidden="true" />
          Agregar
        </button>
        <button type="button" className="nf-btn ghost mini" onClick={() => onPick(buildPendingMenuItem(food, unit))}>
          Sin cantidad
        </button>
      </div>
    </article>
  );
});

function FoodEquivalentPicker({ item, onPick, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getFoodEquivalents({
          alimentoOriginal: item,
          cantidad: item?.cantidad,
          unidad: item?.unidad,
        });
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err?.message || "No se pudieron buscar equivalencias.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [item]);

  const options = data?.equivalentes || [];

  return (
    <div className="ne-nestedBackdrop">
      <div className="ne-picker ne-equivalentPicker">
        <div className="ne-pickerTop">
          <div>
            <span className="nf-pill good">
              <Replace size={14} strokeWidth={2.3} aria-hidden="true" />
              Equivalencias
            </span>
            <h3>Reemplazar alimento</h3>
            <p className="ne-muted">{item?.nombreSnapshot} - {macroSentence(item)}</p>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        {loading ? <div className="nf-empty">Buscando alternativas buenas...</div> : null}
        {error ? <div className="nf-error">{error}</div> : null}
        {!loading && !error && !options.length ? <div className="nf-empty">No encontre equivalencias claras para este alimento.</div> : null}

        <div className="ne-foodGrid">
          {options.map((option) => (
            <button
              type="button"
              className="ne-foodPick ne-equivalentPick"
              key={`${option.id}-${option.cantidadSugerida}`}
              onClick={() => onPick(itemFromEquivalent(option, item))}
            >
              <strong>{option.nombre}</strong>
              <span>{formatNumber(option.cantidadSugerida)} {option.unidadSugerida || option.unidad || "g"} sugeridos</span>
              <small>{compactMacroLine({
                kcal: option.totales?.kcal,
                proteina: option.totales?.proteina,
                carbs: option.totales?.carbs,
                grasas: option.totales?.grasas,
              })}</small>
              <span>Dif. {formatNumber(option.diferencia?.kcal, 1)} kcal / P {formatNumber(option.diferencia?.proteina, 1)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MealEquivalentPicker({ meal, mealLibrary = [], foods = [], onPick, onClose }) {
  const foodLookup = useMemo(() => buildFoodLookup(foods), [foods]);
  const current = useMemo(() => normalizeMealDraft(meal || {}, foodLookup), [foodLookup, meal]);
  const target = useMemo(() => mealTargetFromMeal(current), [current]);
  const suggestions = useMemo(
    () =>
      mealLibrary
        .map((raw) => normalizeMealDraft(raw, foodLookup))
        .filter((candidate) => candidate.items?.length)
        .filter((candidate) => String(candidate.id || "") !== String(current.id || ""))
        .filter((candidate) => mealGroupKey(candidate) === mealGroupKey(current))
        .map((candidate) => {
          const compatibility = recipeCompatibility(candidate, target);
          return { ...candidate, compatibility };
        })
        .sort((a, b) => a.compatibility.score - b.compatibility.score)
        .slice(0, 8),
    [current, foodLookup, mealLibrary, target]
  );

  return (
    <div className="ne-nestedBackdrop">
      <div className="ne-picker ne-equivalentPicker">
        <div className="ne-pickerTop">
          <div>
            <span className="nf-pill good">
              <ChefHat size={14} strokeWidth={2.3} aria-hidden="true" />
              Receta compatible
            </span>
            <h3>Buscar receta compatible</h3>
            <p className="ne-muted">
              Objetivo: {formatNumber(target.kcal)} kcal - P {formatNumber(target.proteina, 1)} g
            </p>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>

        {!suggestions.length ? <div className="nf-empty">No hay recetas compatibles para este grupo todavia.</div> : null}
        <div className="ne-foodGrid">
          {suggestions.map((candidate) => {
            const compatibility = candidate.compatibility;
            return (
              <button
                type="button"
                className="ne-foodPick ne-equivalentPick ne-compatiblePick"
                key={candidate.id || candidate.nombre}
                onClick={() => onPick(candidate)}
              >
                <strong>{candidate.nombre}</strong>
                <span>{mealTypeLabel(candidate.tipoComida)} - {mealFoodPreview(candidate)}</span>
                <small>{macroDotLine(candidate.totales)}</small>
                <span className={`ne-compatBadge ${compatibility.level}`}>
                  {compatibility.label}
                </span>
                <span>
                  {formatSigned(compatibility.diffKcal)} kcal / P {formatSigned(compatibility.diffProteina, 1)} g
                </span>
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

const MobileMenuEditor = React.memo(function MobileMenuEditor({
  draft = {},
  menuTotals = {},
  pendingMenuItems = 0,
  quickStateByMeal = {},
  notice = "",
  quantityNotice = "",
  saving = false,
  submitLabel = "Guardar menu",
  allowSystemVisibility = true,
  mobileMenuSettingsOpen = false,
  editingMealIndex = null,
  mealLibraryLength = 0,
  onOpenMenuSettings,
  onCloseMenuSettings,
  onEditMeal,
  onCloseMeal,
  onAddMeal,
  onCancel,
  onSave,
  onUpdateMenuField,
  onUpdateMenuMacro,
  onUpdateMenu,
  onUseCurrentTotals,
  onUpdateMeal,
  onDuplicateMeal,
  onRemoveMeal,
  onOpenMealEquivalent,
  onUpdateItem,
  onRemoveItem,
  onOpenItemEquivalent,
  onOpenFoodPicker,
  onCalculateQuantities,
  onGenerateVariant,
  onApplyInlineResult,
  onOpenQuantitySettings,
}) {
  const meals = draft.comidas || [];
  const editingMeal = editingMealIndex !== null ? meals[editingMealIndex] : null;
  const targetProtein = draft.macrosObjetivo?.proteina;

  return (
    <main className="ne-mobileMenuEditor">
      <section className="ne-mobileMenuOverview">
        <div className="ne-mobileMenuOverviewTop">
          <div>
            <span className="nf-pill demo">Resumen del menu</span>
            <h3>{draft.nombre || "Menu sin nombre"}</h3>
            {draft.descripcion ? <p>{draft.descripcion}</p> : null}
          </div>
          <button type="button" className="nf-btn ghost mini" onClick={onOpenMenuSettings}>
            <Settings size={15} strokeWidth={2.3} aria-hidden="true" />
            Datos
          </button>
        </div>

        <div className="ne-mobileMenuTargetLine">
          <span>Objetivo</span>
          <strong>
            {draft.kcalObjetivo ? `${formatNumber(draft.kcalObjetivo)} kcal` : "Kcal libre"}
            {targetProtein ? ` · P ${formatNumber(targetProtein, 1)} g` : ""}
          </strong>
        </div>

        <div className="ne-mobileMenuMacroLine">
          <strong>{formatNumber(menuTotals.kcal)} kcal</strong>
          <span>P {formatNumber(menuTotals.proteina, 1)}</span>
          <span>C {formatNumber(menuTotals.carbs, 1)}</span>
          <span>G {formatNumber(menuTotals.grasas, 1)}</span>
        </div>
      </section>

      {notice ? <div className="ne-editorNotice">{notice}</div> : null}
      {quantityNotice ? <div className="ne-editorNotice">{quantityNotice}</div> : null}
      {pendingMenuItems ? (
        <div className="ne-editorNotice warning">
          Este menu tiene {pendingMenuItems} alimento(s) sin cantidad.
        </div>
      ) : null}

      <div className="ne-mobileMealsTop">
        <div>
          <h3>Comidas</h3>
          <p>{meals.length} comida(s)</p>
        </div>
        <button type="button" className="nf-btn gold mini" onClick={onAddMeal}>
          <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
          Agregar comida
        </button>
      </div>

      <div className="ne-mobileMealSummaries">
        {meals.map((meal, mealIndex) => (
          <MobileMealSummaryCard
            meal={meal}
            mealIndex={mealIndex}
            quickState={quickStateByMeal[mealIndex]}
            onEdit={onEditMeal}
            onDuplicate={onDuplicateMeal}
            onRemove={onRemoveMeal}
            key={`${meal.id || "meal"}-${mealIndex}`}
          />
        ))}
        {!meals.length ? (
          <div className="nf-empty">Todavia no agregaste comidas a este menu.</div>
        ) : null}
      </div>

      <div className="ne-mobileMenuActions">
        <button type="button" className="nf-btn ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="nf-btn gold" onClick={onSave} disabled={saving}>
          <Save size={16} strokeWidth={2.3} aria-hidden="true" />
          {saving ? "Guardando..." : submitLabel}
        </button>
      </div>

      {mobileMenuSettingsOpen ? (
        <MobileMenuSettingsDrawer
          draft={draft}
          menuTotals={menuTotals}
          allowSystemVisibility={allowSystemVisibility}
          onUpdateMenuField={onUpdateMenuField}
          onUpdateMenuMacro={onUpdateMenuMacro}
          onUpdateMenu={onUpdateMenu}
          onUseCurrentTotals={onUseCurrentTotals}
          onClose={onCloseMenuSettings}
        />
      ) : null}

      {editingMeal ? (
        <MobileMealEditorDrawer
          meal={editingMeal}
          mealIndex={editingMealIndex}
          quickState={quickStateByMeal[editingMealIndex]}
          mealLibraryLength={mealLibraryLength}
          onClose={onCloseMeal}
          onUpdateMeal={onUpdateMeal}
          onDuplicateMeal={onDuplicateMeal}
          onRemoveMeal={onRemoveMeal}
          onOpenMealEquivalent={onOpenMealEquivalent}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          onOpenItemEquivalent={onOpenItemEquivalent}
          onOpenFoodPicker={onOpenFoodPicker}
          onCalculateQuantities={onCalculateQuantities}
          onGenerateVariant={onGenerateVariant}
          onApplyInlineResult={onApplyInlineResult}
          onOpenQuantitySettings={onOpenQuantitySettings}
        />
      ) : null}
    </main>
  );
});

const MobileMealSummaryCard = React.memo(function MobileMealSummaryCard({
  meal = {},
  mealIndex,
  quickState,
  onEdit,
  onDuplicate,
  onRemove,
}) {
  const [pendingAction, setPendingAction] = useState("");
  const summary = useMemo(() => {
    const items = meal.items || [];
    const actual = meal.totales || totalsFromItems(items);
    const target = mealTargetFromMeal(meal);
    const pendingCount = countPendingItems(items);
    const hasTarget = Boolean(meal.objetivoKcal || meal.objetivoProteina);
    const status = hasTarget
      ? mealGoalStatus(meal, { actual, target, pendingCount })
      : !items.length
        ? { level: "empty", label: "Vacia" }
        : pendingCount
          ? { level: "pending", label: "Pendiente" }
          : { level: "complete", label: "Lista" };
    return {
      actual,
      target,
      hasTarget,
      pendingCount,
      itemCount: items.length,
      status,
    };
  }, [meal]);

  const runSummaryAction = useCallback((actionName, action) => {
    flushSync(() => setPendingAction(actionName));
    runAfterNextPaint(() => {
      action(mealIndex);
      setPendingAction("");
    });
  }, [mealIndex]);

  const editMeal = useCallback(() => onEdit(mealIndex), [mealIndex, onEdit]);
  const duplicateMeal = useCallback((event) => {
    event.stopPropagation();
    runSummaryAction("duplicate", onDuplicate);
  }, [onDuplicate, runSummaryAction]);
  const removeMeal = useCallback((event) => {
    event.stopPropagation();
    runSummaryAction("remove", onRemove);
  }, [onRemove, runSummaryAction]);

  return (
    <article
      className={`ne-mobileMealSummary ${pendingAction ? "is-actionPending" : ""}`}
      onClick={editMeal}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") editMeal();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="ne-mobileMealSummaryTop">
        <div>
          <span>{mealTypeLabel(meal.tipoComida)}</span>
          <h4>{meal.nombre || "Comida sin nombre"}</h4>
        </div>
        <span className={`ne-goalBadge ${summary.status.level}`}>{summary.status.label}</span>
      </div>

      <div className="ne-mobileMealCompare">
        <span>
          Objetivo
          <strong>
            {summary.hasTarget
              ? `${formatNumber(summary.target.kcal)} kcal · P ${formatNumber(summary.target.proteina, 1)} g`
              : "Sin objetivo parcial"}
          </strong>
        </span>
        <span>
          Actual
          <strong>{formatNumber(summary.actual.kcal)} kcal · P {formatNumber(summary.actual.proteina, 1)} g</strong>
        </span>
      </div>

      <div className="ne-mobileMealSummaryBottom">
        <p>
          {summary.itemCount} alimento(s)
          {summary.pendingCount ? ` · ${summary.pendingCount} pendiente(s)` : ""}
          {quickState?.loading ? " · Calculando..." : ""}
        </p>
        <div className="ne-mobileMealSummaryActions">
          <button type="button" className="nf-btn ghost mini" onClick={(event) => {
            event.stopPropagation();
            editMeal();
          }}>
            Editar
          </button>
          <button type="button" className="nf-iconBtn" onClick={duplicateMeal} aria-label="Duplicar comida" disabled={!!pendingAction}>
            <Copy size={15} strokeWidth={2.3} aria-hidden="true" />
          </button>
          <button type="button" className="nf-iconBtn" onClick={removeMeal} aria-label="Eliminar comida" disabled={!!pendingAction}>
            <Trash2 size={15} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
});

function MobileMealEditorDrawer({
  meal,
  mealIndex,
  quickState,
  mealLibraryLength,
  onClose,
  ...mealEditorProps
}) {
  const closeDrawer = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(onClose, 0);
  }, [onClose]);

  return (
    <div className="ne-mobileMealDrawerBackdrop">
      <section className="ne-mobileMealDrawer" role="dialog" aria-modal="true" aria-label="Editar comida">
        <header className="ne-mobileMealDrawerHead">
          <div>
            <span>Editar comida</span>
            <h3>{meal.nombre || "Comida sin nombre"}</h3>
          </div>
          <button type="button" className="nf-btn gold mini" onClick={closeDrawer}>
            Listo
          </button>
        </header>
        <div className="ne-mobileMealDrawerBody">
          <MealEditorBlock
            meal={meal}
            mealIndex={mealIndex}
            quickState={quickState}
            mealLibraryLength={mealLibraryLength}
            {...mealEditorProps}
          />
        </div>
      </section>
    </div>
  );
}

function MobileMenuSettingsDrawer({
  draft = {},
  menuTotals = {},
  allowSystemVisibility = true,
  onUpdateMenuField,
  onUpdateMenuMacro,
  onUpdateMenu,
  onUseCurrentTotals,
  onClose,
}) {
  const closeDrawer = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(onClose, 0);
  }, [onClose]);

  return (
    <div className="ne-mobileMealDrawerBackdrop">
      <section className="ne-mobileMealDrawer ne-mobileMenuSettingsDrawer" role="dialog" aria-modal="true" aria-label="Datos del menu">
        <header className="ne-mobileMealDrawerHead">
          <div>
            <span>Menu base</span>
            <h3>Datos del menu</h3>
          </div>
          <button type="button" className="nf-btn gold mini" onClick={closeDrawer}>Listo</button>
        </header>
        <div className="ne-mobileMenuSettingsBody">
          <BufferedField label="Nombre" value={draft.nombre} fieldKey="nombre" onCommit={onUpdateMenuField} />
          <BufferedTextarea label="Descripcion" value={draft.descripcion || ""} fieldKey="descripcion" onCommit={onUpdateMenuField} />
          <div className="ne-two">
            <BufferedField label="Kcal objetivo" value={draft.kcalObjetivo} fieldKey="kcalObjetivo" onCommit={onUpdateMenuField} />
            <BufferedField label="Rango kcal" value={draft.rangoKcal} fieldKey="rangoKcal" onCommit={onUpdateMenuField} />
          </div>
          <div className="ne-three">
            <BufferedField label="Proteina" value={draft.macrosObjetivo?.proteina} fieldKey="proteina" onCommit={onUpdateMenuMacro} />
            <BufferedField label="Carbs" value={draft.macrosObjetivo?.carbs} fieldKey="carbs" onCommit={onUpdateMenuMacro} />
            <BufferedField label="Grasas" value={draft.macrosObjetivo?.grasas} fieldKey="grasas" onCommit={onUpdateMenuMacro} />
          </div>
          <div className="ne-two">
            <SelectField
              label="Visibilidad"
              value={draft.visibilidad}
              options={allowSystemVisibility ? VISIBILITY : VISIBILITY.filter(([value]) => value !== "sistema")}
              onChange={(value) => onUpdateMenu({ visibilidad: value })}
            />
            <SelectField label="Estado" value={draft.estado} options={STATUS} onChange={(value) => onUpdateMenu({ estado: value })} />
          </div>
          {allowSystemVisibility ? (
            <SelectField
              label="Nivel biblioteca"
              value={draft.templateTier || "global_basic"}
              options={TEMPLATE_TIERS}
              onChange={(value) => onUpdateMenu({ templateTier: value })}
            />
          ) : null}
          <BufferedField label="Tags" value={tagsFromInput(draft.tags).join(", ")} fieldKey="tags" onCommit={onUpdateMenuField} />
          <button type="button" className="nf-btn ghost" onClick={onUseCurrentTotals}>Usar totales actuales</button>
          <MacroSummary totals={menuTotals} />
        </div>
      </section>
    </div>
  );
}

const MealEditorBlock = React.memo(function MealEditorBlock({
  meal = {},
  mealIndex,
  quickState,
  mealLibraryLength = 0,
  onUpdateMeal,
  onDuplicateMeal,
  onRemoveMeal,
  onOpenMealEquivalent,
  onUpdateItem,
  onRemoveItem,
  onOpenItemEquivalent,
  onOpenFoodPicker,
  onCalculateQuantities,
  onGenerateVariant,
  onApplyInlineResult,
  onOpenQuantitySettings,
}) {
  const [pendingMealAction, setPendingMealAction] = useState("");
  const items = useMemo(() => meal.items || [], [meal.items]);
  const hasTarget = Boolean(meal.objetivoKcal || meal.objetivoProteina);
  const hasItems = items.length > 0;
  const macroLine = useMemo(() => macroSentence(meal.totales), [meal.totales]);
  const calculableCount = useMemo(() => countCalculableItems(items), [items]);
  const variantAvailable = useMemo(() => canGenerateQuantityVariant(items), [items]);

  const updateName = useCallback((value) => {
    onUpdateMeal(mealIndex, { nombre: value });
  }, [mealIndex, onUpdateMeal]);

  const updateType = useCallback((value) => {
    onUpdateMeal(mealIndex, { tipoComida: value, grupoComida: groupFromMealType(value) });
  }, [mealIndex, onUpdateMeal]);

  const updateItem = useCallback((itemIndex, patch) => {
    onUpdateItem(mealIndex, itemIndex, patch);
  }, [mealIndex, onUpdateItem]);

  const removeItem = useCallback((itemIndex) => {
    onRemoveItem(mealIndex, itemIndex);
  }, [mealIndex, onRemoveItem]);

  const openItemEquivalent = useCallback((itemIndex, item) => {
    onOpenItemEquivalent(mealIndex, itemIndex, item);
  }, [mealIndex, onOpenItemEquivalent]);

  const openMealEquivalent = useCallback(() => {
    onOpenMealEquivalent(mealIndex, meal);
  }, [meal, mealIndex, onOpenMealEquivalent]);

  const openFoodPicker = useCallback(() => {
    onOpenFoodPicker(mealIndex);
  }, [mealIndex, onOpenFoodPicker]);

  const runMealAction = useCallback((actionName, action) => {
    flushSync(() => setPendingMealAction(actionName));
    runAfterNextPaint(() => {
      action(mealIndex);
      setPendingMealAction("");
    });
  }, [mealIndex]);

  const duplicateMeal = useCallback(() => {
    runMealAction("duplicate", onDuplicateMeal);
  }, [onDuplicateMeal, runMealAction]);

  const removeMeal = useCallback(() => {
    runMealAction("remove", onRemoveMeal);
  }, [onRemoveMeal, runMealAction]);

  return (
    <section className={`ne-mealBlock ${pendingMealAction ? "is-actionPending" : ""}`}>
      <div className="ne-mealTop">
        <div className="ne-two">
          <BufferedField label="Nombre" value={meal.nombre} onCommit={updateName} />
          <SelectField label="Tipo" value={meal.tipoComida} options={MEAL_TYPES} onChange={updateType} />
        </div>
        <div className="ne-mealActions">
          {mealLibraryLength && hasItems ? (
            <button type="button" className="nf-btn ghost mini" onClick={openMealEquivalent}>
              <Replace size={16} strokeWidth={2.3} aria-hidden="true" />
              Buscar receta compatible
            </button>
          ) : null}
          <button type="button" className="nf-iconBtn" onClick={duplicateMeal} aria-label="Duplicar comida" disabled={!!pendingMealAction}>
            <Copy size={16} strokeWidth={2.3} aria-hidden="true" />
          </button>
          <button type="button" className="nf-iconBtn" onClick={removeMeal} aria-label="Eliminar comida" disabled={!!pendingMealAction}>
            <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="ne-muted">{macroLine}</p>
      {hasTarget ? (
        <div className="ne-mealTarget">
          Objetivo: {meal.objetivoKcal ? `${formatNumber(meal.objetivoKcal)} kcal` : "kcal libre"}
          {meal.objetivoProteina ? ` · P ${formatNumber(meal.objetivoProteina, 1)} g` : ""}
        </div>
      ) : null}
      {hasTarget ? (
        <MealGoalPanel meal={meal} onSearchCompatible={mealLibraryLength ? openMealEquivalent : null} />
      ) : null}

      <FoodItemsEditor
        items={items}
        onUpdate={updateItem}
        onRemove={removeItem}
        onReplace={openItemEquivalent}
        allowQuantityAutomation={hasTarget}
        highlightedNames={quickState?.highlightedNames}
        emptyText="Agrega alimentos para construir esta comida."
      />

      {quickState?.message ? (
        <div className={`ne-quantityInlineFeedback ${quickState.type || "warning"}`}>
          <span>{quickState.message}</span>
          {quickState.pendingResult ? (
            <div className="ne-quantityInlineFeedbackActions">
              <button type="button" className="nf-btn gold mini" onClick={() => onApplyInlineResult(mealIndex)}>
                Aplicar igual
              </button>
              <button type="button" className="nf-btn ghost mini" onClick={() => onOpenQuantitySettings(mealIndex)}>
                Revisar ajustes
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ne-mealFooterActions">
        <button type="button" className="nf-btn gold mini" onClick={openFoodPicker}>
          <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
          Agregar alimento
        </button>
        {hasTarget && calculableCount ? (
          <div className="ne-quantityQuickActions">
            <ImmediateQuantityCalculateButton
              mealIndex={mealIndex}
              loading={quickState?.loading}
              onCalculate={onCalculateQuantities}
            />
            {variantAvailable ? (
              <button
                type="button"
                className="nf-btn ghost mini ne-quantityVariantBtn"
                onClick={() => onGenerateVariant(mealIndex)}
                disabled={quickState?.loading}
                title="Redistribuye cantidades entre alimentos automaticos del mismo grupo manteniendo el objetivo."
              >
                <Shuffle size={15} strokeWidth={2.3} aria-hidden="true" />
                <span>Variante</span>
              </button>
            ) : null}
            <button
              type="button"
              className="nf-iconBtn ne-quantitySettingsBtn"
              onClick={() => onOpenQuantitySettings(mealIndex)}
              aria-label="Ajustar calculo"
              title="Ajustar calculo"
            >
              <Settings size={16} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {mealLibraryLength && !hasItems ? (
          <button type="button" className="nf-btn ghost mini" onClick={openMealEquivalent}>
            <Replace size={16} strokeWidth={2.3} aria-hidden="true" />
            Buscar receta compatible
          </button>
        ) : null}
      </div>
    </section>
  );
});

const ImmediateQuantityCalculateButton = React.memo(function ImmediateQuantityCalculateButton({
  mealIndex,
  loading = false,
  onCalculate,
}) {
  const buttonRef = useRef(null);
  const labelRef = useRef(null);
  const runningRef = useRef(false);

  const setVisualBusy = useCallback((nextBusy) => {
    runningRef.current = nextBusy;

    if (buttonRef.current) {
      buttonRef.current.disabled = nextBusy;
      buttonRef.current.setAttribute("aria-busy", nextBusy ? "true" : "false");
      buttonRef.current.classList.toggle("is-immediateBusy", nextBusy);
    }

    if (labelRef.current) {
      labelRef.current.textContent = nextBusy ? "Calculando..." : "Calcular cantidades";
    }
  }, []);

  useEffect(() => {
    setVisualBusy(Boolean(loading));
  }, [loading, setVisualBusy]);

  const handleClick = useCallback(async () => {
    if (runningRef.current || loading) return;
    // El feedback se activa dentro del click. Deshabilitar durante pointerdown
    // cancela el click posterior en algunos navegadores Android.
    setVisualBusy(true);

    try {
      // Un solo yield corto para dejar pintar el texto. No doble requestAnimationFrame.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      await onCalculate?.(mealIndex);
    } finally {
      setVisualBusy(false);
    }
  }, [loading, mealIndex, onCalculate, setVisualBusy]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="nf-btn ghost mini"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
    >
      <Sparkles size={16} strokeWidth={2.3} aria-hidden="true" />
      <span ref={labelRef}>{loading ? "Calculando..." : "Calcular cantidades"}</span>
    </button>
  );
});

const MobileQuantityTrigger = React.memo(function MobileQuantityTrigger({
  item = {},
  pending = false,
  automatic = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`ne-mobileQuantityTrigger ${pending ? "pending" : ""} ${automatic ? "automatic" : ""}`}
      onClick={onClick}
      aria-label={`Editar cantidad de ${item.nombreSnapshot || "alimento"}`}
    >
      <strong>{pending ? "Sin cantidad" : `${formatNumber(item.cantidad, 1)} ${item.unidad || "g"}`}</strong>
      <small>{pending ? "Pendiente" : automatic ? "Automatico" : "Manual"}</small>
    </button>
  );
});

const MobileQuantityEditor = React.memo(function MobileQuantityEditor({
  item = {},
  allowQuantityAutomation = false,
  onApply,
  onClose,
}) {
  const pending = isQuantityPending(item);
  const automatic = isQuantityAutomatic(item);
  const [quantityLocal, setQuantityLocal] = useState(pending ? "" : String(item.cantidad ?? ""));
  const [unitLocal, setUnitLocal] = useState(item.unidad || "g");

  const nextItemFromLocal = useCallback(() => {
    const normalizedQuantity = String(quantityLocal ?? "").trim();
    if (!normalizedQuantity || toNumber(normalizedQuantity, 0) <= 0) {
      return markItemPending(item, unitLocal);
    }
    return rescaleItem(item, normalizedQuantity, unitLocal);
  }, [item, quantityLocal, unitLocal]);

  const saveChanges = useCallback(() => {
    onApply?.(nextItemFromLocal());
  }, [nextItemFromLocal, onApply]);

  const leavePending = useCallback(() => {
    onApply?.(markItemPending(item, unitLocal));
  }, [item, onApply, unitLocal]);

  const toggleQuantitySource = useCallback(() => {
    const nextItem = nextItemFromLocal();
    if (isQuantityPending(nextItem)) return;
    onApply?.(automatic ? markItemManual(nextItem) : markItemAutomatic(nextItem));
  }, [automatic, nextItemFromLocal, onApply]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="ne-mobileQuantityBackdrop" role="presentation" onClick={onClose}>
      <section
        className="ne-mobileQuantityDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ne-mobileQuantityTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ne-mobileQuantityHead">
          <div>
            <span>Editar alimento</span>
            <h3 id="ne-mobileQuantityTitle">{item.nombreSnapshot || "Alimento"}</h3>
          </div>
          <button type="button" className="nf-iconBtn" onClick={onClose} aria-label="Cerrar edicion">
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </header>

        <div className="ne-mobileQuantityFields">
          <label className="ne-mobileQuantityField">
            <span>Cantidad</span>
            <input
              value={quantityLocal}
              onChange={(event) => setQuantityLocal(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveChanges();
                if (event.key === "Escape") onClose?.();
              }}
              placeholder="Sin cantidad"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="ne-mobileQuantityField unit">
            <span>Unidad</span>
            <input
              value={unitLocal}
              onChange={(event) => setUnitLocal(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveChanges();
                if (event.key === "Escape") onClose?.();
              }}
              placeholder="g"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <p className="ne-mobileQuantityHint">
          Los macros se recalculan una sola vez cuando guardas.
        </p>

        {!pending && allowQuantityAutomation ? (
          <button type="button" className="nf-btn ghost ne-mobileQuantitySourceBtn" onClick={toggleQuantitySource}>
            {automatic ? "Fijar manual" : "Volver a automatico"}
          </button>
        ) : null}

        <div className="ne-mobileQuantityActions">
          <button type="button" className="nf-btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="nf-btn ghost" onClick={leavePending}>Dejar pendiente</button>
          <button type="button" className="nf-btn gold" onClick={saveChanges}>
            <Save size={16} strokeWidth={2.3} aria-hidden="true" />
            Guardar cambios
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
});

const FoodItemsEditor = React.memo(function FoodItemsEditor({
  items = [],
  onUpdate,
  onRemove,
  onReplace,
  allowQuantityAutomation = false,
  highlightedNames = [],
  emptyText = "Todavia no agregaste alimentos.",
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [mobileEditingIndex, setMobileEditingIndex] = useState(null);
  const [pendingAction, setPendingAction] = useState("");
  const isMobile = useMediaQuery("(max-width: 720px)");
  const highlightedSet = useMemo(
    () => new Set((highlightedNames || []).map(cleanText)),
    [highlightedNames]
  );

  const runItemAction = useCallback((actionKey, action) => {
    flushSync(() => setPendingAction(actionKey));
    runAfterNextPaint(() => {
      action();
      setPendingAction("");
    });
  }, []);

  if (!items.length) {
    return <div className="nf-empty">{emptyText}</div>;
  }

  return (
    <>
      <div className="ne-items">
        {items.map((item, index) => {
          const isEditing = !isMobile && editingIndex === index;
          const pending = isQuantityPending(item);
          const automatic = isQuantityAutomatic(item);
          const quantitySource = quantitySourceOf(item);
          const highlighted = highlightedSet.has(cleanText(item.nombreSnapshot || item.nombre || item.name));
          const actionBusy = pendingAction.endsWith(`-${index}`);
          return (
            <article
              className={`ne-item ${isEditing ? "is-editing" : ""} is-${quantitySource} ${highlighted ? "is-calculated" : ""} ${actionBusy ? "is-actionPending" : ""}`}
              key={`${item.id || item.nombreSnapshot}-${index}`}
            >
              <div className="ne-itemSummary">
                <div className="ne-itemIdentity">
                  <strong>{item.nombreSnapshot}</strong>
                  {isMobile ? (
                    <MobileQuantityTrigger
                      item={item}
                      pending={pending}
                      automatic={automatic}
                      onClick={() => setMobileEditingIndex(index)}
                    />
                  ) : (
                    <InlineQuantityInput
                      item={item}
                      pending={pending}
                      automatic={automatic}
                      onCommit={(nextItem) => onUpdate(index, nextItem)}
                    />
                  )}
                </div>
                <div className={`ne-itemNumbers ${pending ? "pending" : ""}`}>
                  {pending ? (
                    <span>Macros pendientes</span>
                  ) : (
                    <>
                      <strong>{formatNumber(item.kcal)} kcal</strong>
                      <span>P {formatNumber(item.proteina, 1)}</span>
                      <span>C {formatNumber(item.carbs, 1)}</span>
                      <span>G {formatNumber(item.grasas, 1)}</span>
                    </>
                  )}
                </div>
                <div className="ne-itemActions">
                  {automatic ? (
                    <button
                      type="button"
                      className="ne-quantityStateBadge automatic"
                      onClick={() => runItemAction(`source-${index}`, () => onUpdate(index, markItemManual(item)))}
                      title="Cantidad generada. Se recalcula si volves a calcular cantidades. Toca para fijarla."
                      aria-label="Fijar cantidad automatica como manual"
                      disabled={actionBusy}
                    >
                      Automatico
                    </button>
                  ) : !pending && allowQuantityAutomation ? (
                    <button
                      type="button"
                      className="ne-quantityStateBadge manual"
                      onClick={() => runItemAction(`source-${index}`, () => onUpdate(index, markItemAutomatic(item)))}
                      title="Cantidad fija. Toca para permitir que vuelva a calcularse automaticamente."
                      aria-label="Volver cantidad manual a automatica"
                      disabled={actionBusy}
                    >
                      Manual
                    </button>
                  ) : (
                    <span
                      className={`ne-quantityStateBadge ${pending ? "pending" : "manual"}`}
                      title={pending ? "Sin cantidad. Entra en el proximo calculo." : "Cantidad fija. No se modifica al recalcular."}
                    >
                      {pending ? "Pendiente" : "Manual"}
                    </span>
                  )}
                  <button
                    type="button"
                    className={`nf-iconBtn ${isEditing ? "active" : ""}`}
                    onClick={() => {
                      if (isMobile) setMobileEditingIndex(index);
                      else setEditingIndex(isEditing ? null : index);
                    }}
                    aria-label={isEditing ? "Cerrar edicion de alimento" : "Editar alimento"}
                  >
                    <Pencil size={15} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                  {onReplace ? (
                    <button type="button" className="nf-iconBtn" onClick={() => onReplace(index, item)} aria-label="Reemplazar alimento">
                      <Replace size={15} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="nf-iconBtn"
                    onClick={() => {
                      setEditingIndex(null);
                      setMobileEditingIndex(null);
                      runItemAction(`remove-${index}`, () => onRemove(index));
                    }}
                    aria-label="Eliminar alimento"
                    disabled={actionBusy}
                  >
                    <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {isEditing ? (
                <div className="ne-itemGrid">
                  <Field
                    label="Cant."
                    value={pending ? "" : item.cantidad}
                    placeholder="Pendiente"
                    onChange={(value) => onUpdate(index, rescaleItem(item, value, item.unidad))}
                  />
                  <Field label="Unidad" value={item.unidad} onChange={(value) => onUpdate(index, markItemManual({ ...item, unidad: value }))} />
                  <Field label="Kcal" value={item.kcal} onChange={(value) => onUpdate(index, markItemManual({ ...item, kcal: value }))} />
                  <Field label="P" value={item.proteina} onChange={(value) => onUpdate(index, markItemManual({ ...item, proteina: value }))} />
                  <Field label="C" value={item.carbs} onChange={(value) => onUpdate(index, markItemManual({ ...item, carbs: value }))} />
                  <Field label="G" value={item.grasas} onChange={(value) => onUpdate(index, markItemManual({ ...item, grasas: value }))} />
                  {!pending ? (
                    <button
                      type="button"
                      className="nf-btn ghost mini ne-sourceEditBtn"
                      onClick={() => onUpdate(index, automatic ? markItemManual(item) : markItemAutomatic(item))}
                    >
                      {automatic ? "Fijar manual" : "Volver a automatico"}
                    </button>
                  ) : null}
                  <button type="button" className="nf-btn ghost mini ne-pendingEditBtn" onClick={() => onUpdate(index, markItemPending(item))}>
                    Dejar pendiente
                  </button>
                  <button type="button" className="nf-btn ghost mini ne-closeEditBtn" onClick={() => setEditingIndex(null)}>
                    Cerrar
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {isMobile && mobileEditingIndex !== null && items[mobileEditingIndex] ? (
        <MobileQuantityEditor
          item={items[mobileEditingIndex]}
          allowQuantityAutomation={allowQuantityAutomation}
          onApply={(nextItem) => {
            const itemIndex = mobileEditingIndex;
            setMobileEditingIndex(null);
            runItemAction(`edit-${itemIndex}`, () => onUpdate(itemIndex, nextItem));
          }}
          onClose={() => setMobileEditingIndex(null)}
        />
      ) : null}
    </>
  );
}, (previous, next) => (
  previous.items === next.items &&
  previous.allowQuantityAutomation === next.allowQuantityAutomation &&
  previous.highlightedNames === next.highlightedNames &&
  previous.emptyText === next.emptyText
));

const INLINE_QUANTITY_COMMIT_DELAY = 1200;

const InlineQuantityInput = React.memo(function InlineQuantityInput({ item = {}, pending = false, automatic = false, onCommit }) {
  const externalValue = pending ? "" : String(item.cantidad ?? "");
  const inputRef = useRef(null);
  const draftValueRef = useRef(externalValue);
  const externalValueRef = useRef(externalValue);
  const itemRef = useRef(item);
  const onCommitRef = useRef(onCommit);
  const focusedRef = useRef(false);
  const composingRef = useRef(false);
  const timerRef = useRef(null);
  const skipBlurCommitRef = useRef(false);
  const lastCommittedValueRef = useRef(null);

  itemRef.current = item;
  onCommitRef.current = onCommit;

  useEffect(() => {
    externalValueRef.current = externalValue;
    if (!focusedRef.current && inputRef.current) {
      inputRef.current.value = externalValue;
      draftValueRef.current = externalValue;
      lastCommittedValueRef.current = null;
    }
  }, [externalValue]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const clearScheduledCommit = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const commit = useCallback((nextValue = draftValueRef.current) => {
    clearScheduledCommit();
    const normalizedValue = String(nextValue ?? "").trim();
    if (
      normalizedValue === externalValueRef.current ||
      normalizedValue === lastCommittedValueRef.current
    ) {
      return;
    }
    lastCommittedValueRef.current = normalizedValue;
    onCommitRef.current?.(rescaleItem(itemRef.current, normalizedValue, itemRef.current.unidad));
  }, [clearScheduledCommit]);

  const scheduleCommit = useCallback((nextValue) => {
    clearScheduledCommit();
    timerRef.current = window.setTimeout(() => {
      if (!composingRef.current) commit(nextValue);
    }, INLINE_QUANTITY_COMMIT_DELAY);
  }, [clearScheduledCommit, commit]);

  return (
    <label className={`ne-inlineQuantity ${pending ? "pending" : ""} ${automatic ? "automatic" : ""}`}>
      <input
        ref={inputRef}
        defaultValue={externalValue}
        onFocus={(event) => {
          focusedRef.current = true;
          if (window.matchMedia?.("(pointer: fine)")?.matches) event.currentTarget.select();
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          draftValueRef.current = nextValue;
          if (!composingRef.current) scheduleCommit(nextValue);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
          clearScheduledCommit();
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          draftValueRef.current = event.currentTarget.value;
          scheduleCommit(event.currentTarget.value);
        }}
        onBlur={() => {
          focusedRef.current = false;
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          commit(draftValueRef.current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(draftValueRef.current);
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            clearScheduledCommit();
            skipBlurCommitRef.current = true;
            draftValueRef.current = externalValueRef.current;
            event.currentTarget.value = externalValueRef.current;
            event.currentTarget.blur();
          }
        }}
        placeholder="--"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        aria-label={`Cantidad de ${item.nombreSnapshot}`}
      />
      <span>{item.unidad || "g"}</span>
      <small>{pending ? "pendiente" : automatic ? "automatica" : "manual"}</small>
    </label>
  );
}, (previous, next) => (
  previous.item === next.item &&
  previous.pending === next.pending &&
  previous.automatic === next.automatic
));

const MacroSummary = React.memo(function MacroSummary({ totals = {} }) {
  return (
    <div className="ne-macroSummary">
      <MacroBox label="Kcal" value={totals.kcal} icon={Flame} />
      <MacroBox label="Prot." value={totals.proteina} suffix="g" icon={Beef} />
      <MacroBox label="Carbs" value={totals.carbs} suffix="g" />
      <MacroBox label="Grasas" value={totals.grasas} suffix="g" />
    </div>
  );
});

function MacroBox({ label, value, suffix = "", icon: Icon }) {
  return (
    <div className="nf-macroBox">
      <span>{Icon ? <Icon size={13} strokeWidth={2.2} aria-hidden="true" /> : null}{label}</span>
      <strong>{formatNumber(value, 1)}{suffix}</strong>
    </div>
  );
}

const BUFFERED_FIELD_COMMIT_DELAY = 1600;

const BufferedField = React.memo(function BufferedField({
  label,
  value,
  onCommit,
  fieldKey,
  placeholder = "",
}) {
  const externalValue = String(value ?? "");
  const inputRef = useRef(null);
  const focusedRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  const externalValueRef = useRef(externalValue);
  const lastCommittedRef = useRef(null);
  const skipBlurCommitRef = useRef(false);

  onCommitRef.current = onCommit;
  externalValueRef.current = externalValue;

  useEffect(() => {
    if (!focusedRef.current && inputRef.current && inputRef.current.value !== externalValue) {
      inputRef.current.value = externalValue;
      lastCommittedRef.current = null;
    }
  }, [externalValue]);

  const commit = useCallback((nextValue) => {
    const normalized = String(nextValue ?? "");
    if (normalized === externalValueRef.current || normalized === lastCommittedRef.current) return;
    lastCommittedRef.current = normalized;
    if (fieldKey !== undefined) onCommitRef.current?.(fieldKey, normalized);
    else onCommitRef.current?.(normalized);
  }, [fieldKey]);

  return (
    <label className="ne-field">
      <span>{label}</span>
      <input
        ref={inputRef}
        defaultValue={externalValue}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => {
          // Importante: no setState acá.
          // Escribir queda en el input nativo y no re-renderiza React por tecla.
          inputRef.current = event.currentTarget;
        }}
        onBlur={(event) => {
          focusedRef.current = false;
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          commit(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            skipBlurCommitRef.current = true;
            event.currentTarget.value = externalValueRef.current;
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
});

const BufferedTextarea = React.memo(function BufferedTextarea({
  label,
  value,
  onCommit,
  fieldKey,
  placeholder = "",
}) {
  const externalValue = String(value ?? "");
  const textareaRef = useRef(null);
  const focusedRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  const externalValueRef = useRef(externalValue);
  const lastCommittedRef = useRef(null);
  const skipBlurCommitRef = useRef(false);

  onCommitRef.current = onCommit;
  externalValueRef.current = externalValue;

  useEffect(() => {
    if (!focusedRef.current && textareaRef.current && textareaRef.current.value !== externalValue) {
      textareaRef.current.value = externalValue;
      lastCommittedRef.current = null;
    }
  }, [externalValue]);

  const commit = useCallback((nextValue) => {
    const normalized = String(nextValue ?? "");
    if (normalized === externalValueRef.current || normalized === lastCommittedRef.current) return;
    lastCommittedRef.current = normalized;
    if (fieldKey !== undefined) onCommitRef.current?.(fieldKey, normalized);
    else onCommitRef.current?.(normalized);
  }, [fieldKey]);

  return (
    <label className="ne-field">
      <span>{label}</span>
      <textarea
        ref={textareaRef}
        defaultValue={externalValue}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => {
          // No setState por tecla.
          textareaRef.current = event.currentTarget;
        }}
        onBlur={(event) => {
          focusedRef.current = false;
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          commit(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            skipBlurCommitRef.current = true;
            event.currentTarget.value = externalValueRef.current;
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
});

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

function normalizeItems(items = [], foodsOrLookup = []) {
  const sourceItems = Array.isArray(items) ? items : [];
  if (sourceItems.every(isNormalizedMenuItem)) return sourceItems;
  const foodLookup = foodsOrLookup?.byName && foodsOrLookup?.byId
    ? foodsOrLookup
    : foodsOrLookup?.length
      ? buildFoodLookup(foodsOrLookup)
      : null;
  return sourceItems.map((item, index) => {
    if (isNormalizedMenuItem(item)) return item;
    const rawQuantity = item.cantidad ?? item.amount ?? item.qty;
    const quantitySource = quantitySourceOf({ ...item, cantidad: rawQuantity });
    const pending = quantitySource === "pending";
    const normalized = {
      id: item.id || item._id || `item-${index + 1}`,
      alimentoId: item.alimentoId || null,
      nombreSnapshot: item.nombreSnapshot || item.nombre || item.name || item.alimento || `Alimento ${index + 1}`,
      cantidad: pending ? "" : toNumber(rawQuantity, 0),
      unidad: item.unidad || item.unit || "g",
      kcal: pending ? 0 : toNumber(item.kcal ?? item.calorias, 0),
      proteina: pending ? 0 : toNumber(item.proteina ?? item.protein ?? item.proteinas, 0),
      carbs: pending ? 0 : toNumber(item.carbs ?? item.carbohidratos, 0),
      grasas: pending ? 0 : toNumber(item.grasas ?? item.fat, 0),
      categoriaSnapshot: item.categoriaSnapshot || item.categoria || item.category || "",
      notas: item.notas || item.notes || "",
      quantityPending: pending,
      fixedQuantity: quantitySource === "manual",
      quantitySource,
      _macroBase: item._macroBase || null,
    };

    const food = foodLookup ? findFoodForItem(normalized, item, foodLookup) : null;
    if (pending) return withMacroBase(normalized);
    const hasSnapshot = normalized.kcal > 0 || normalized.proteina > 0 || normalized.carbs > 0 || normalized.grasas > 0;
    if (hasSnapshot) {
      if (shouldRecalculateSuspiciousSnapshot(normalized, food)) {
        return snapshotFromFood(normalized, food, "recalculated");
      }
      return withMacroBase(normalized);
    }

    if (!food || normalized.cantidad <= 0) return withMacroBase(normalized);

    return snapshotFromFood(normalized, food);
  });
}

function isNormalizedMenuItem(item = {}) {
  return Boolean(
    item &&
    item.nombreSnapshot &&
    item._macroBase &&
    item.quantitySource &&
    Object.prototype.hasOwnProperty.call(item, "cantidad") &&
    Object.prototype.hasOwnProperty.call(item, "kcal") &&
    Object.prototype.hasOwnProperty.call(item, "proteina") &&
    Object.prototype.hasOwnProperty.call(item, "carbs") &&
    Object.prototype.hasOwnProperty.call(item, "grasas")
  );
}

function buildFoodLookup(foods = []) {
  const byName = buildFoodIndex(foods);
  const byId = new Map();
  foods.forEach((food) => {
    [food?.id, food?._id, food?.raw?._id, food?.raw?.id].filter(Boolean).forEach((id) => {
      byId.set(String(id), food);
    });
  });
  return { byName, byId };
}

function findFoodForItem(normalized = {}, raw = {}, lookup) {
  const id = normalized.alimentoId || raw.alimentoId || raw.id || raw._id;
  if (id && lookup?.byId?.has(String(id))) return lookup.byId.get(String(id));
  const sourceName = cleanText(normalized.nombreSnapshot || raw.alimento || raw.nombre || raw.name);
  return lookup?.byName?.get(sourceName) || null;
}

function snapshotFromFood(item = {}, food = {}, notice = "") {
  const snapshot = buildMenuItemSnapshot(food, item.cantidad, item.unidad || food.unidad || food.unit || "g");
  return withMacroBase({
    ...item,
    ...snapshot,
    id: item.id,
    notas: item.notas,
    fixedQuantity: true,
    quantityPending: false,
    quantitySource: "manual",
    _macroNotice: notice || item._macroNotice || "",
  });
}

function buildPendingMenuItem(food = {}, unit = food?.unidad || food?.unit || "g") {
  const base = buildMenuItemSnapshot(food, 100, unit);
  return withMacroBase({
    ...base,
    cantidad: "",
    unidad: base.unidad || unit || "g",
    kcal: 0,
    proteina: 0,
    carbs: 0,
    grasas: 0,
    fixedQuantity: false,
    quantityPending: true,
    quantitySource: "pending",
    notas: "Cantidad pendiente de calcular",
    _macroBase: {
      cantidad: 100,
      kcal: base.kcal,
      proteina: base.proteina,
      carbs: base.carbs,
      grasas: base.grasas,
    },
  });
}

function shouldRecalculateSuspiciousSnapshot(item = {}, food = null) {
  if (!food || toNumber(item.cantidad, 0) <= 0) return false;

  const recalculated = buildMenuItemSnapshot(food, item.cantidad, item.unidad || food.unidad || food.unit || "g");
  const currentTotal =
    toNumber(item.kcal, 0) + toNumber(item.proteina, 0) + toNumber(item.carbs, 0) + toNumber(item.grasas, 0);
  const recalculatedTotal =
    toNumber(recalculated.kcal, 0) +
    toNumber(recalculated.proteina, 0) +
    toNumber(recalculated.carbs, 0) +
    toNumber(recalculated.grasas, 0);
  const looksAbsurd =
    toNumber(item.kcal, 0) > 2500 ||
    toNumber(item.proteina, 0) > 300 ||
    toNumber(item.carbs, 0) > 600 ||
    toNumber(item.grasas, 0) > 250;
  const looksUnderScaled =
    toNumber(recalculated.kcal, 0) > 25 &&
    toNumber(item.kcal, 0) > 0 &&
    currentTotal > 0 &&
    currentTotal / recalculatedTotal < 0.25;

  return recalculatedTotal > 0 && ((looksAbsurd && currentTotal / recalculatedTotal > 4) || looksUnderScaled);
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

function quantitySourceOf(item = {}) {
  const explicit = cleanText(item.quantitySource || item.quantityStatus || item.quantityMode);
  if (["pending", "pendiente"].includes(explicit)) return "pending";
  if (["automatic", "automatico", "automatica", "generated", "sugerido"].includes(explicit)) return "automatic";
  if (["manual", "fixed", "fijo", "fija"].includes(explicit)) return "manual";
  if (item.quantityPending === true || item.cantidad === "" || toNumber(item.cantidad, 0) <= 0) return "pending";
  if (item.fixedQuantity === false) return "automatic";
  return "manual";
}

function isQuantityPending(item = {}) {
  return quantitySourceOf(item) === "pending";
}

function isQuantityAutomatic(item = {}) {
  return quantitySourceOf(item) === "automatic";
}

function isQuantityCalculable(item = {}) {
  return quantitySourceOf(item) !== "manual";
}

function countPendingItems(items = []) {
  return (items || []).filter(isQuantityPending).length;
}

function countCalculableItems(items = []) {
  return (items || []).filter(isQuantityCalculable).length;
}

function quantityMacroRole(item = {}) {
  const base = item._macroBase || item;
  const protein = toNumber(base.proteina ?? item.proteina, 0);
  const carbs = toNumber(base.carbs ?? base.carbohidratos ?? item.carbs, 0);
  const fat = toNumber(base.grasas ?? item.grasas, 0);
  const max = Math.max(protein, carbs, fat);
  if (max <= 0) return "";
  if (max === protein) return "protein";
  if (max === carbs) return "carb";
  return "fat";
}

function canGenerateQuantityVariant(items = []) {
  const roleCounts = new Map();
  (items || [])
    .filter(isQuantityAutomatic)
    .forEach((item) => {
      const role = quantityMacroRole(item);
      if (!role) return;
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    });
  return [...roleCounts.values()].some((count) => count >= 2);
}

function markItemPending(item = {}, nextUnidad = item.unidad || "g") {
  const base = item._macroBase || withMacroBase(item)._macroBase;
  return {
    ...item,
    cantidad: "",
    unidad: nextUnidad || item.unidad || "g",
    kcal: 0,
    proteina: 0,
    carbs: 0,
    grasas: 0,
    fixedQuantity: false,
    quantityPending: true,
    quantitySource: "pending",
    _macroBase: base,
  };
}

function markItemAutomatic(item = {}) {
  if (toNumber(item.cantidad, 0) <= 0) return markItemPending(item);
  return {
    ...item,
    fixedQuantity: false,
    quantityPending: false,
    quantitySource: "automatic",
    _macroBase: {
      cantidad: toNumber(item.cantidad, 1) || 1,
      kcal: toNumber(item.kcal, 0),
      proteina: toNumber(item.proteina, 0),
      carbs: toNumber(item.carbs, 0),
      grasas: toNumber(item.grasas, 0),
    },
  };
}

function markItemManual(item = {}) {
  if (toNumber(item.cantidad, 0) <= 0) return markItemPending(item);
  return {
    ...item,
    fixedQuantity: true,
    quantityPending: false,
    quantitySource: "manual",
  };
}

function rescaleItem(item = {}, nextCantidad = item.cantidad, nextUnidad = item.unidad || "g") {
  const base = item._macroBase || withMacroBase(item)._macroBase;
  const baseQty = toNumber(base.cantidad, 0);
  if (String(nextCantidad ?? "").trim() === "" || toNumber(nextCantidad, 0) <= 0) {
    return markItemPending(item, nextUnidad);
  }
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
    fixedQuantity: true,
    quantityPending: false,
    quantitySource: "manual",
    _macroBase: base,
  };
}

function itemFromEquivalent(option = {}, original = {}) {
  return withMacroBase({
    ...original,
    alimentoId: option.id || option.alimentoId || null,
    nombreSnapshot: option.nombre || "Alimento equivalente",
    cantidad: toNumber(option.cantidadSugerida, original.cantidad || 100),
    unidad: option.unidadSugerida || option.unidad || original.unidad || "g",
    kcal: toNumber(option.totales?.kcal, option.kcal),
    proteina: toNumber(option.totales?.proteina, option.proteina),
    carbs: toNumber(option.totales?.carbs, option.carbs),
    grasas: toNumber(option.totales?.grasas, option.grasas),
    categoriaSnapshot: option.categoria || option.categoriaSnapshot || "",
    notas: original.notas || "",
    fixedQuantity: true,
    quantityPending: false,
    quantitySource: "manual",
  });
}

function itemFromQuantityGeneration(food = {}, original = {}) {
  const cantidad = toNumber(food.quantity ?? food.cantidad, original.cantidad || 0);
  const quantitySource = food.source === "fixed" ? "manual" : "automatic";
  const item = {
    ...original,
    id: original.id || generatedClientId("item"),
    alimentoId: food.foodId || food.alimentoId || original.alimentoId || null,
    nombreSnapshot: food.name || food.nombre || original.nombreSnapshot || "Alimento",
    cantidad,
    unidad: food.unit || food.unidad || original.unidad || "g",
    kcal: toNumber(food.kcal ?? food.calorias, 0),
    proteina: toNumber(food.proteina ?? food.protein ?? food.proteinas, 0),
    carbs: toNumber(food.carbs ?? food.carbohidratos, 0),
    grasas: toNumber(food.grasas ?? food.fat, 0),
    categoriaSnapshot: food.categoriaSnapshot || food.categoria || original.categoriaSnapshot || "",
    notas: food.source === "addedCandidate" ? "Agregado por calculo de cantidades" : original.notas || "",
    fixedQuantity: quantitySource === "manual",
    quantityPending: false,
    quantitySource,
  };

  return {
    ...item,
    _macroBase: {
      cantidad: cantidad || 1,
      kcal: item.kcal,
      proteina: item.proteina,
      carbs: item.carbs,
      grasas: item.grasas,
    },
  };
}

function sourceLabel(source = "") {
  if (source === "fixed") return "Fijo";
  if (source === "addedCandidate") return "Agregado compatible";
  if (source === "generated") return "Cantidad sugerida";
  return "Sugerido";
}

function quantityResultFeedback(result = {}, mode = "kcalProteina") {
  const diff = result.diff || {};
  const kcalDiff = toNumber(diff.calorias, 0);
  const proteinDiff = toNumber(diff.proteina, 0);
  const carbsDiff = toNumber(diff.carbohidratos, 0);
  const fatDiff = toNumber(diff.grasas, 0);
  const issues = [];

  if (Math.abs(kcalDiff) > 10) {
    issues.push(`Diferencia de ${formatSigned(kcalDiff, 1)} kcal respecto del objetivo.`);
  }
  if ((mode === "kcalProteina" || mode === "full") && proteinDiff < -3) {
    issues.push(`Faltan ${formatNumber(Math.abs(proteinDiff), 1)} g de proteina.`);
  }
  if (mode === "full" && Math.abs(carbsDiff) > 4) {
    issues.push(`Carbohidratos ${formatSigned(carbsDiff, 1)} g respecto del objetivo.`);
  }
  if (mode === "full" && Math.abs(fatDiff) > 4) {
    issues.push(`Grasas ${formatSigned(fatDiff, 1)} g respecto del objetivo.`);
  }
  if (result.status === "warning" || ["revisar", "sin_solucion"].includes(result.quality)) {
    issues.unshift(result.message || "El resultado necesita revision.");
  }
  if (Array.isArray(result.warnings) && result.warnings.length) {
    issues.push(...result.warnings);
  }

  const uniqueIssues = [...new Set(issues.filter(Boolean))];
  return uniqueIssues.length
    ? { type: "warning", message: uniqueIssues.join(" ") }
    : { type: "success", message: "" };
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
    totales: totalsFromNormalizedItems(items),
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
  const sourceItems = Array.isArray(items) ? items : [];
  return totalsFromNormalizedItems(
    sourceItems.every(isNormalizedMenuItem) ? sourceItems : normalizeItems(sourceItems)
  );
}

function totalsFromNormalizedItems(items = []) {
  return (items || []).reduce(
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

function useMediaQuery(query) {
  const getMatches = useCallback(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
    [query]
  );
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener?.("change", updateMatches);
    return () => mediaQuery.removeEventListener?.("change", updateMatches);
  }, [query]);

  return matches;
}

function runAfterNextPaint(callback) {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    globalThis.setTimeout(callback, 0);
    return;
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
}

function waitForNextPaint() {
  return new Promise((resolve) => runAfterNextPaint(resolve));
}

function generatedClientId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickFirstItemList(...sources) {
  const itemKeys = ["items", "alimentos", "foods"];
  for (const source of sources) {
    for (const key of itemKeys) {
      if (Array.isArray(source?.[key]) && source[key].length) return source[key];
    }
  }
  return [];
}

function mealTypeLabel(type = "") {
  const normalized = normalizeMealTypeToken(type);
  return MEAL_TYPES.find(([value]) => value === normalized)?.[1] || "Receta";
}

function mealGroupKey(meal = {}) {
  return meal.grupoComida || groupFromMealType(meal.tipoComida);
}

function mealDisplayName(meal = {}) {
  const name = meal.nombre || meal.name || "";
  const typeLabel = mealTypeLabel(meal.tipoComida || meal.type);
  if (!name) return typeLabel;
  return cleanText(name) === cleanText(typeLabel) ? typeLabel : name;
}

function mealFoodNames(meal = {}) {
  return Array.from(
    new Set(
      (meal.items || [])
        .map((item) => item.nombreSnapshot || item.nombre || item.name || item.alimento)
        .filter(Boolean)
    )
  );
}

function mealFoodPreview(meal = {}) {
  const names = mealFoodNames(meal);
  if (!names.length) return "Sin alimentos cargados";
  const visible = names.slice(0, 3).join(", ");
  const rest = names.length > 3 ? ` +${names.length - 3}` : "";
  return `Incluye: ${visible}${rest}`;
}

function matchesRecipeKcal(value, filter) {
  const kcal = toNumber(value, 0);
  if (filter === "lt300") return kcal > 0 && kcal < 300;
  if (filter === "300-500") return kcal >= 300 && kcal < 500;
  if (filter === "500-700") return kcal >= 500 && kcal < 700;
  if (filter === "gte700") return kcal >= 700;
  return true;
}

function matchesRecipeProtein(value, filter) {
  const protein = toNumber(value, 0);
  if (filter === "lt20") return protein > 0 && protein < 20;
  if (filter === "20-40") return protein >= 20 && protein < 40;
  if (filter === "gte40") return protein >= 40;
  return true;
}

function macroDotLine(macros = {}) {
  if (hasSuspiciousMealTotals(macros)) return "Macros a revisar";
  return `${formatNumber(macros.kcal, 0)} kcal · P ${formatNumber(macros.proteina, 1)} · C ${formatNumber(macros.carbs, 1)} · G ${formatNumber(macros.grasas, 1)}`;
}

function hasSuspiciousMealTotals(macros = {}) {
  return (
    toNumber(macros.kcal, 0) > 5000 ||
    toNumber(macros.proteina, 0) > 300 ||
    toNumber(macros.carbs, 0) > 800 ||
    toNumber(macros.grasas, 0) > 300
  );
}

function mealTargetFromMeal(meal = {}) {
  const totals = meal.totales || totalsFromItems(meal.items || []);
  return {
    kcal: toNumber(meal.objetivoKcal, totals.kcal),
    proteina: toNumber(meal.objetivoProteina, totals.proteina),
  };
}

function mealGoalStatus(meal = {}, derived = {}) {
  const target = derived.target || mealTargetFromMeal(meal);
  const actual = derived.actual || meal.totales || totalsFromItems(meal.items || []);
  const compatibility = recipeCompatibility({ totales: actual }, target);
  const pendingCount = derived.pendingCount ?? countPendingItems(meal.items || []);
  if (!meal.items?.length) {
    return {
      level: "empty",
      label: "Vacia",
      message: "Agrega alimentos o busca una receta compatible para completar esta comida.",
    };
  }
  if (pendingCount) {
    return {
      level: "pending",
      label: "Pendiente de calcular",
      message: `El actual fijo solo suma alimentos con cantidad. Quedan ${pendingCount} alimento(s) pendiente(s).`,
    };
  }

  if (compatibility.level === "very") {
    return { level: "complete", label: "Completa", message: "" };
  }
  if (compatibility.level === "close") {
    return { level: "close", label: "Cerca del objetivo", message: goalWarningText(actual, target) };
  }
  if (compatibility.level === "highKcal") {
    return { level: "high", label: "Excede kcal", message: goalWarningText(actual, target) };
  }
  if (compatibility.level === "lowProtein") {
    return { level: "low", label: "Baja en proteina", message: goalWarningText(actual, target) };
  }

  return { level: "review", label: "Revisar", message: goalWarningText(actual, target) };
}

function recipeCompatibility(recipe = {}, target = {}) {
  const totals = recipe.totales || recipe.totals || {};
  const kcal = toNumber(totals.kcal, 0);
  const protein = toNumber(totals.proteina ?? totals.protein, 0);
  const targetKcal = toNumber(target.kcal, 0);
  const targetProtein = toNumber(target.proteina ?? target.protein, 0);
  const diffKcal = round(kcal - targetKcal);
  const diffProteina = round(protein - targetProtein);
  const absKcal = Math.abs(diffKcal);
  const absProtein = Math.abs(diffProteina);
  const score = absKcal + absProtein * 8;
  const kcalPct = targetKcal > 0 ? absKcal / targetKcal : 0;
  const proteinPct = targetProtein > 0 ? absProtein / targetProtein : 0;

  if (hasSuspiciousMealTotals(totals)) {
    return { score: score + 9999, diffKcal, diffProteina, level: "review", label: "Revisar macros" };
  }
  if (targetKcal > 0 && targetProtein > 0 && kcalPct <= 0.15 && proteinPct <= 0.20) {
    return { score, diffKcal, diffProteina, level: "very", label: "Muy compatible" };
  }
  if (targetKcal > 0 && targetProtein > 0 && kcalPct <= 0.25 && proteinPct <= 0.35) {
    return { score, diffKcal, diffProteina, level: "close", label: "Cercana" };
  }
  if (targetKcal > 0 && kcal > targetKcal * 1.25) {
    return { score: score + 500, diffKcal, diffProteina, level: "highKcal", label: "Alta en kcal" };
  }
  if (targetProtein > 0 && protein < targetProtein * 0.65) {
    return { score: score + 450, diffKcal, diffProteina, level: "lowProtein", label: "Baja en proteina" };
  }
  return { score: score + 250, diffKcal, diffProteina, level: "review", label: "Revisar ajuste" };
}

function goalWarningText(actual = {}, target = {}) {
  const diffKcal = round(toNumber(actual.kcal, 0) - toNumber(target.kcal, 0));
  const diffProtein = round(toNumber(actual.proteina, 0) - toNumber(target.proteina, 0));
  const parts = [];
  if (Math.abs(diffKcal) > 15) {
    parts.push(diffKcal > 0 ? `supera el objetivo por ${formatNumber(diffKcal)} kcal` : `queda corta por ${formatNumber(Math.abs(diffKcal))} kcal`);
  }
  if (Math.abs(diffProtein) > 2) {
    parts.push(diffProtein > 0 ? `supera la proteina por ${formatNumber(diffProtein, 1)} g` : `queda corta en proteina por ${formatNumber(Math.abs(diffProtein), 1)} g`);
  }
  return parts.length ? `Esta comida ${parts.join(" y ")}.` : "";
}

function formatSigned(value, digits = 0) {
  const n = toNumber(value, 0);
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "-"}${formatNumber(Math.abs(n), digits)}`;
}

function clampNumber(value, min, max) {
  const n = toNumber(value, min);
  return Math.min(max, Math.max(min, Math.round(n)));
}

function guidedSlotsForCount(count = 4) {
  const normalizedCount = clampNumber(count, 1, 8);
  const template = GUIDED_MEAL_TEMPLATES[normalizedCount];
  if (template) {
    return template.map(([nombre, tipo, percent]) => ({
      nombre,
      tipo,
      percent,
      grupoComida: groupFromMealType(tipo),
    }));
  }

  const names = [
    ["Desayuno", "desayuno"],
    ["Almuerzo", "almuerzo"],
    ["Merienda", "merienda"],
    ["Cena", "cena"],
    ["Snack", "snack"],
  ];
  const basePercent = 100 / normalizedCount;
  return Array.from({ length: normalizedCount }, (_, index) => {
    const [nombre, tipo] = names[index] || [`Comida ${index + 1}`, "otro"];
    return {
      nombre,
      tipo,
      percent: round(basePercent),
      grupoComida: groupFromMealType(tipo),
    };
  });
}

function applyCustomPercents(slots = [], percents = []) {
  const rawPercents = slots.map((slot, index) => toNumber(percents[index], slot.percent));
  const total = rawPercents.reduce((acc, value) => acc + Math.max(0, value), 0);
  if (total <= 0) return slots;
  return slots.map((slot, index) => ({
    ...slot,
    percent: round((Math.max(0, rawPercents[index]) / total) * 100),
  }));
}

function buildGuidedMealTargets({ slots = [], kcal = 0, proteina = 0 }) {
  const totalKcal = toNumber(kcal, 0);
  const totalProtein = toNumber(proteina, 0);
  return slots.map((slot, index) => {
    const isLast = index === slots.length - 1;
    const previousKcal = slots
      .slice(0, index)
      .reduce((acc, item) => acc + round((totalKcal * toNumber(item.percent, 0)) / 100), 0);
    const previousProtein = slots
      .slice(0, index)
      .reduce((acc, item) => acc + round((totalProtein * toNumber(item.percent, 0)) / 100), 0);

    return {
      ...slot,
      objetivoKcal: isLast ? round(totalKcal - previousKcal) : round((totalKcal * toNumber(slot.percent, 0)) / 100),
      objetivoProteina: isLast
        ? round(totalProtein - previousProtein)
        : round((totalProtein * toNumber(slot.percent, 0)) / 100),
    };
  });
}

function buildGuidedMenuDraft({ guided = {}, targetMeals = [], mealLibrary = [], foods = [], canUseSuggestions = true }) {
  const menuBase = {
    ...createEmptyMenuDraft(),
    nombre: guided.nombre || `Menu ${formatNumber(guided.kcal)} kcal`,
    kcalObjetivo: toNumber(guided.kcal, 0),
    rangoKcal: kcalRangeFromValue(guided.kcal),
    macrosObjetivo: {
      proteina: toNumber(guided.proteina, 0),
      carbs: toNumber(guided.carbs, 0),
      grasas: toNumber(guided.grasas, 0),
    },
  };

  if (guided.buildMode === "suggest" && canUseSuggestions) {
    const suggested = suggestMealsForTargets(targetMeals, mealLibrary, foods);
    return {
      menu: recalcMenuDraft({ ...menuBase, comidas: suggested.meals }),
      notice:
        suggested.matched >= targetMeals.length
          ? "Se cargaron recetas compatibles como punto de partida. Podes editarlas antes de guardar."
          : "Todavia no hay suficientes recetas compatibles. Te dejamos una estructura editable para completar manualmente.",
    };
  }

  return {
    menu: recalcMenuDraft({
      ...menuBase,
      comidas: targetMeals.map((target) => createGuidedEmptyMeal(target)),
    }),
    notice: "",
  };
}

function createGuidedEmptyMeal(target = {}) {
  return recalcMealDraft({
    ...createEmptyMealDraft(),
    id: generatedClientId("meal"),
    nombre: target.nombre || "Comida",
    tipoComida: target.tipo || "otro",
    grupoComida: target.grupoComida || groupFromMealType(target.tipo),
    objetivoKcal: target.objetivoKcal,
    objetivoProteina: target.objetivoProteina,
  });
}

function suggestMealsForTargets(targetMeals = [], mealLibrary = [], foods = []) {
  const foodLookup = buildFoodLookup(foods);
  const candidates = mealLibrary
    .map((meal) => normalizeMealDraft(meal, foodLookup))
    .filter((meal) => meal.items?.length);
  const used = new Set();
  let matched = 0;

  const meals = targetMeals.map((target) => {
    const sameGroup = candidates.filter((meal) => mealGroupKey(meal) === target.grupoComida && !used.has(meal.id || meal.nombre));
    if (!sameGroup.length) return createGuidedEmptyMeal(target);

    const best = sameGroup
      .map((meal) => {
        const compatibility = recipeCompatibility(meal, {
          kcal: target.objetivoKcal,
          proteina: target.objetivoProteina,
        });
        return { meal, score: compatibility.score };
      })
      .sort((a, b) => a.score - b.score)[0]?.meal;

    if (!best) return createGuidedEmptyMeal(target);
    used.add(best.id || best.nombre);
    matched += 1;
    return recalcMealDraft({
      ...best,
      id: generatedClientId("meal"),
      nombre: best.nombre || target.nombre,
      tipoComida: target.tipo,
      grupoComida: target.grupoComida,
      objetivoKcal: target.objetivoKcal,
      objetivoProteina: target.objetivoProteina,
    });
  });

  return { meals, matched };
}
