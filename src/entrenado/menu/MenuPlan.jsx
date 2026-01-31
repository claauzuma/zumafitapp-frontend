import React, { useMemo, useRef, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Flame,
  Utensils,
  Settings2,
  Plus,
  X,
  ChevronRight,
  Info,
  Check,
  Trash2,
  Heart,
} from "lucide-react";

/**
 * ✅ Lo que implementa ESTE archivo (todo en 1):
 * - Snacks vuelven (Snack libre + presupuesto + detalle + elegir)
 * - Cards de comidas con fondo un poquito más gris (más “card premium”)
 * - En cada comida: botones a la derecha (❤️ favorito / ➕ manual / 🔄 cambiar / ⚙️ meta / ℹ️ detalle)
 * - En la card (sin entrar al detalle): preview de alimentos y cantidades (comma-separated)
 * - Detalle (sheet):
 *    - NO muestra toda la DB: solo muestra resultados si escribís >=2 letras
 *    - Botón 🔄 Generar arriba (a la derecha del título) y 🗑️ rojo “eliminar todo”
 *    - Cantidades editables “pill”
 *    - Toast profesional (ventanita)
 *    - Regla compleja por macroGroup (protein/carb/fat) SOLO para modo plan/auto
 *       * Si hay 1 alimento del grupo => NO editable (toast)
 *       * Si hay N => se pueden editar N-1 como máximo
 *       * Si intentás editar el N-ésimo => el más viejo vuelve a autoQty
 *    - Modo manual (al entrar con ➕):
 *       * al agregar un alimento entra con qty default (100g si es grs, 1 si es uni) y es editable SIEMPRE
 *       * NO aplica regla compleja por macroGroup (es “lo que comí”)
 * - Sheet ⚙️ para ajustar meta (kcal + macros) por comida
 */

const mealOrder = ["Desayuno", "Almuerzo", "Merienda", "Cena"];

const DAILY_GOAL = { kcal: 2100, p: 130, c: 240, g: 65 };

const FOODS_DB = [
  { id: "pollo", name: "Pollo (pechuga)", unit: "g", kcal100: 165, p100: 31, c100: 0, g100: 3.6, macroGroup: "protein" },
  { id: "carne", name: "Carne magra", unit: "g", kcal100: 180, p100: 26, c100: 0, g100: 8, macroGroup: "protein" },
  { id: "yogur", name: "Yogur griego", unit: "g", kcal100: 97, p100: 9, c100: 4, g100: 5, macroGroup: "protein" },

  { id: "arroz", name: "Arroz (crudo)", unit: "g", kcal100: 365, p100: 7, c100: 80, g100: 0.7, macroGroup: "carb" },
  { id: "pasta", name: "Pasta (cruda)", unit: "g", kcal100: 371, p100: 13, c100: 75, g100: 1.5, macroGroup: "carb" },
  { id: "avena", name: "Avena", unit: "g", kcal100: 389, p100: 17, c100: 66, g100: 7, macroGroup: "carb" },
  { id: "banana", name: "Banana", unit: "g", kcal100: 89, p100: 1.1, c100: 23, g100: 0.3, macroGroup: "carb" },

  { id: "aceite", name: "Aceite de oliva", unit: "g", kcal100: 884, p100: 0, c100: 0, g100: 100, macroGroup: "fat" },

  { id: "verduras", name: "Verduras mixtas", unit: "g", kcal100: 45, p100: 2, c100: 9, g100: 0.2, macroGroup: "other" },
];

const snackSuggestions = [
  { id: "alfajor", label: "Alfajor simple", kcal: 240, p: 4, c: 34, g: 10 },
  { id: "helado", label: "Helado 1 bocha", kcal: 210, p: 4, c: 26, g: 10 },
  { id: "barrita", label: "Barrita proteica", kcal: 220, p: 20, c: 22, g: 6 },
  { id: "whey", label: "Batido whey + banana", kcal: 310, p: 28, c: 35, g: 3 },
  { id: "tostado", label: "Tostado jamón/queso", kcal: 380, p: 22, c: 35, g: 16 },
  { id: "secos", label: "Frutos secos (30g)", kcal: 180, p: 6, c: 6, g: 15 },
];

const MEAL_POOLS = {
  Desayuno: [
    { dish: "Yogur griego + avena + banana", pick: ["yogur", "avena", "banana"] },
    { dish: "Avena + banana", pick: ["avena", "banana"] },
    { dish: "Yogur griego + banana", pick: ["yogur", "banana"] },
  ],
  Almuerzo: [
    { dish: "Pollo + arroz + verduras", pick: ["pollo", "arroz", "verduras", "aceite"] },
    { dish: "Carne + arroz + verduras", pick: ["carne", "arroz", "verduras", "aceite"] },
    { dish: "Pollo + pasta + verduras", pick: ["pollo", "pasta", "verduras", "aceite"] },
  ],
  Merienda: [
    { dish: "Yogur + banana", pick: ["yogur", "banana"] },
    { dish: "Yogur + avena", pick: ["yogur", "avena"] },
    { dish: "Banana + avena", pick: ["banana", "avena"] },
  ],
  Cena: [
    { dish: "Pasta + carne + verduras", pick: ["pasta", "carne", "verduras", "aceite"] },
    { dish: "Pollo + pasta + verduras", pick: ["pollo", "pasta", "verduras", "aceite"] },
    { dish: "Carne + verduras + aceite", pick: ["carne", "verduras", "aceite"] },
  ],
};

/* ===================== HELPERS ===================== */

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDateEs(date = new Date()) {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

/* ===================== ✅ BACKEND FOOD NORMALIZATION + INDEX ===================== */

/**
 * Tu API devuelve:
 * - Alimentos (string) = nombre
 * - Calorias/Proteinas/Grasas/Carbohidratos = macros por 1 "Unidad"
 * - Unidad = "Grs" o "Uni"
 *
 * Nosotros normalizamos a un food que pueda calcular macros correctamente:
 * - Si Unidad = Grs -> perUnit=true, unit="g", y macros son por 1g
 * - Si Unidad = Uni -> perUnit=true, unit="uni", y macros son por 1 unidad
 *
 * (Los foods mock siguen usando kcal100/p100/etc)
 */

function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
}

function inferMacroGroupFromUnitMacros({ p, c, g }) {
  const P = Number(p) || 0;
  const C = Number(c) || 0;
  const G = Number(g) || 0;
  const max = Math.max(P, C, G);
  if (max <= 0) return "other";
  if (max === P) return "protein";
  if (max === C) return "carb";
  if (max === G) return "fat";
  return "other";
}

function normalizeBackendFood(raw) {
  const name = raw?.Alimentos ?? raw?.alimentos ?? raw?.nombre ?? raw?.name ?? "Sin nombre";
  const id = raw?.id ?? raw?._id ?? slugify(name);

  const unidadRaw = String(raw?.Unidad ?? raw?.unidad ?? "").trim().toLowerCase();
  const isGrams = unidadRaw.startsWith("gr"); // "grs", "gr", etc
  const unit = isGrams ? "g" : "uni";

  // macros por 1 unidad (1g o 1 uni)
  const kcalPerUnit = Number(raw?.Calorias ?? raw?.calorias ?? 0) || 0;
  const pPerUnit = Number(raw?.Proteinas ?? raw?.proteinas ?? 0) || 0;
  const cPerUnit = Number(raw?.Carbohidratos ?? raw?.carbohidratos ?? 0) || 0;
  const gPerUnit = Number(raw?.Grasas ?? raw?.grasas ?? 0) || 0;

  return {
    id,
    name,
    unit,

    // ✅ modo “por unidad” (1g o 1 uni)
    perUnit: true,
    kcalPerUnit,
    pPerUnit,
    cPerUnit,
    gPerUnit,

    // Para tu lógica de regla compleja
    macroGroup: inferMacroGroupFromUnitMacros({ p: pPerUnit, c: cPerUnit, g: gPerUnit }),

    raw,
  };
}

// Índice runtime: mezcla FOODS_DB (mock) + backend foods
const FOODS_INDEX = new Map(FOODS_DB.map((f) => [f.id, f]));

function upsertFoodsToIndex(list) {
  if (!Array.isArray(list)) return;
  for (const f of list) {
    if (f?.id) FOODS_INDEX.set(f.id, f);
  }
}

function getFood(foodId) {
  return FOODS_INDEX.get(foodId);
}

function getGroup(foodId) {
  return getFood(foodId)?.macroGroup || "other";
}

function groupLabel(group) {
  if (group === "protein") return "proteico";
  if (group === "carb") return "carbohidrato";
  if (group === "fat") return "grasa";
  return "otro";
}

function sumMacros(items) {
  return items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + (it.kcal || 0),
      p: acc.p + (it.p || 0),
      c: acc.c + (it.c || 0),
      g: acc.g + (it.g || 0),
    }),
    { kcal: 0, p: 0, c: 0, g: 0 }
  );
}

/**
 * ✅ Cálculo macros:
 * - Si food.perUnit == true: macros = qty * macrosPorUnidad
 *   (qty en gramos si unit="g", o qty en unidades si unit="uni")
 * - Si no (mock): usa per100g (qty/100)
 */
function calcMealFromIngredients(ingredients) {
  let kcal = 0,
    p = 0,
    c = 0,
    g = 0;

  for (const ing of ingredients) {
    if (typeof ing.qty !== "number" || ing.qty <= 0) continue;
    const food = getFood(ing.foodId);
    if (!food) continue;

    if (food.perUnit) {
      const factor = ing.qty; // qty * (por 1 unidad)
      kcal += (food.kcalPerUnit || 0) * factor;
      p += (food.pPerUnit || 0) * factor;
      c += (food.cPerUnit || 0) * factor;
      g += (food.gPerUnit || 0) * factor;
    } else {
      const factor = ing.qty / 100; // qty en gramos
      kcal += (food.kcal100 || 0) * factor;
      p += (food.p100 || 0) * factor;
      c += (food.c100 || 0) * factor;
      g += (food.g100 || 0) * factor;
    }
  }

  return {
    kcal: Math.round(kcal),
    p: Math.round(p),
    c: Math.round(c),
    g: Math.round(g),
  };
}

/** Cantidades aleatorias (por ahora) según macroGroup */
function randomQtyForFood(food) {
  // ✅ backend foods:
  if (food?.perUnit) {
    // si es por unidad, tiramos cantidades más chicas
    if (food.unit === "uni") return clamp(Math.round(1 + Math.random() * 3), 1, 10); // 1 a 10 unidades
    // si es por gramo (1g), cantidades tipo gramos
    return clamp(Math.round(60 + Math.random() * 240), 20, 600);
  }

  // ✅ mock foods:
  const g = food.macroGroup;
  if (g === "protein") return clamp(Math.round(80 + Math.random() * 220), 60, 350);
  if (g === "carb") return clamp(Math.round(40 + Math.random() * 140), 20, 250);
  if (g === "fat") return clamp(Math.round(5 + Math.random() * 20), 3, 40);
  return clamp(Math.round(80 + Math.random() * 240), 50, 400);
}

/** Genera qty aleatoria y setea autoQty, resetea manual */
function regenMealRandom(meal) {
  const nextIngredients = meal.ingredients.map((ing) => {
    const food = getFood(ing.foodId);
    if (!food) return ing;
    const qty = randomQtyForFood(food);
    return { ...ing, qty, autoQty: qty, isManual: false };
  });

  return {
    ...meal,
    ingredients: nextIngredients,
    manualOrder: { protein: [], carb: [], fat: [] },
  };
}

function makeEmptyDay() {
  const targets = { Desayuno: 420, Almuerzo: 680, Merienda: 360, Cena: 720 };
  return mealOrder.map((type, idx) => ({
    id: `meal-${type}-${Date.now()}-${idx}`,
    type,
    dish: "",
    kcalTarget: targets[type] || 600,
    status: "planned",
    ingredients: [],
    manualOrder: { protein: [], carb: [], fat: [] },

    // ✅ NUEVO
    isFavorite: false,
    targetOverride: null,          // {kcal,p,c,g} o null
    targetSource: "auto",          // "auto" | "override"
    planType: "auto",              // "auto" | "manual"
  }));
}

function estimateMealTargets(kcalTarget) {
  const pKcal = DAILY_GOAL.p * 4;
  const cKcal = DAILY_GOAL.c * 4;
  const gKcal = DAILY_GOAL.g * 9;
  const totalMacroKcal = pKcal + cKcal + gKcal || 1;

  const pShare = pKcal / totalMacroKcal;
  const cShare = cKcal / totalMacroKcal;
  const gShare = gKcal / totalMacroKcal;

  const p = Math.round((kcalTarget * pShare) / 4);
  const c = Math.round((kcalTarget * cShare) / 4);
  const g = Math.round((kcalTarget * gShare) / 9);

  return { kcal: Math.round(kcalTarget), p, c, g };
}

function getMealTargets(meal) {
  if (meal?.targetOverride && typeof meal.targetOverride.kcal === "number") return meal.targetOverride;
  return estimateMealTargets(meal?.kcalTarget ?? 600);
}

/* ===================== MAIN APP ===================== */

export default function MenuPlan() {
  const [dayMeals, setDayMeals] = useState(() => makeEmptyDay());
  const [snackBudget, setSnackBudget] = useState(300);
  const [snacks, setSnacks] = useState([]);
  const [showSheet, setShowSheet] = useState(null);
  const [logs, setLogs] = useState([]); // reservado por si querés “comí otra cosa”
  const [genPressed, setGenPressed] = useState(false);

  const snacksSum = useMemo(() => sumMacros(snacks), [snacks]);
  const snackRemaining = useMemo(() => Math.max(0, snackBudget - snacksSum.kcal), [snackBudget, snacksSum.kcal]);

  const mealsConsumedSum = useMemo(() => {
    const doneMeals = dayMeals.filter((m) => m.status === "done");
    return doneMeals.reduce(
      (acc, m) => {
        const mac = calcMealFromIngredients(m.ingredients);
        return { kcal: acc.kcal + mac.kcal, p: acc.p + mac.p, c: acc.c + mac.c, g: acc.g + mac.g };
      },
      { kcal: 0, p: 0, c: 0, g: 0 }
    );
  }, [dayMeals]);

  const logsSum = useMemo(() => sumMacros(logs), [logs]);

  const consumedTotal = useMemo(
    () => ({
      kcal: mealsConsumedSum.kcal + logsSum.kcal + snacksSum.kcal,
      p: mealsConsumedSum.p + logsSum.p + snacksSum.p,
      c: mealsConsumedSum.c + logsSum.c + snacksSum.c,
      g: mealsConsumedSum.g + logsSum.g + snacksSum.g,
    }),
    [mealsConsumedSum, logsSum, snacksSum]
  );

  const remaining = useMemo(
    () => ({
      kcal: DAILY_GOAL.kcal - consumedTotal.kcal,
      p: DAILY_GOAL.p - consumedTotal.p,
      c: DAILY_GOAL.c - consumedTotal.c,
      g: DAILY_GOAL.g - consumedTotal.g,
    }),
    [consumedTotal]
  );

  const remainingState = remaining.kcal >= 0 ? "onTrack" : "over";
  const remainingLabel =
    remainingState === "onTrack"
      ? `Te quedan ${Math.max(0, Math.round(remaining.kcal))} kcal`
      : `Te pasaste ${Math.abs(Math.round(remaining.kcal))} kcal`;

  function toggleMealDone(id) {
    setDayMeals((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const canDone = m.ingredients.length > 0 && m.ingredients.every((i) => typeof i.qty === "number" && i.qty > 0);
        if (m.status !== "done" && !canDone) return m;
        return { ...m, status: m.status === "done" ? "planned" : "done" };
      })
    );
  }

  /** Genera día completo: comidas random + qty random */
  function generateDay() {
    setGenPressed(true);
    setTimeout(() => setGenPressed(false), 180);

    setDayMeals((prev) =>
      prev.map((m) => {
        const entry = pickRandom(MEAL_POOLS[m.type] || []);
        if (!entry) return m;

        const baseIngs = entry.pick.map((foodId) => ({
          id: uid(`ing-${foodId}`),
          foodId,
          qty: null,
          autoQty: null,
          isManual: false,
        }));

        const withRandom = baseIngs.map((ing) => {
          const food = getFood(ing.foodId);
          const qty = food ? randomQtyForFood(food) : null;
          return { ...ing, qty, autoQty: qty, isManual: false };
        });

        return {
          ...m,
          dish: entry.dish,
          ingredients: withRandom,
          status: "planned",
          manualOrder: { protein: [], carb: [], fat: [] },
        };
      })
    );

    setLogs([]);
    setSnacks([]);
  }

  function openMealDetail(mealId) {
    setShowSheet({ type: "mealDetail", payload: { mealId, mode: "plan" } });
  }

  function openManualMealEntry(mealId) {
    setDayMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const name = m.dish?.trim() ? m.dish : `${m.type} (manual)`;
        return {
          ...m,
          dish: name,
          status: "planned",
          planType: "manual",
          ingredients: [],
          manualOrder: { protein: [], carb: [], fat: [] },
        };
      })
    );

    setShowSheet({ type: "mealDetail", payload: { mealId, mode: "manual" } });
  }

  function openMealTargets(mealId) {
    setShowSheet({ type: "mealTargets", payload: { mealId } });
  }

  function toggleFavorite(mealId) {
    setDayMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, isFavorite: !m.isFavorite } : m)));
  }

  function addSnack(s) {
    setSnacks((prev) => [...prev, { ...s, id: uid("sn") }]);
    setShowSheet(null);
  }

  function removeSnack(snackId) {
    setSnacks((prev) => prev.filter((x) => x.id !== snackId));
  }

  function addIngredientToMeal(mealId, foodId, opts = {}) {
    setDayMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const exists = m.ingredients.some((i) => i.foodId === foodId);
        if (exists) return m;

        const qty = typeof opts.qty === "number" ? opts.qty : null;
        const autoQty = typeof opts.autoQty === "number" ? opts.autoQty : qty;

        return {
          ...m,
          ingredients: [
            ...m.ingredients,
            {
              id: uid(`ing-${foodId}`),
              foodId,
              qty,
              autoQty,
              isManual: !!opts.isManual,
            },
          ],
        };
      })
    );
  }

  function removeIngredient(mealId, ingId) {
    setDayMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;

        const nextIngredients = m.ingredients.filter((x) => x.id !== ingId);

        const nextManualOrder = { ...m.manualOrder };
        for (const k of ["protein", "carb", "fat"]) {
          nextManualOrder[k] = (nextManualOrder[k] || []).filter((id) => id !== ingId);
        }

        return { ...m, ingredients: nextIngredients, manualOrder: nextManualOrder };
      })
    );
  }

  function regenMeal(mealId) {
    setDayMeals((prev) => prev.map((m) => (m.id === mealId ? regenMealRandom(m) : m)));
  }

  function changeMealForType(mealId) {
    setDayMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const entry = pickRandom(MEAL_POOLS[m.type] || []);
        if (!entry) return m;

        const baseIngs = entry.pick.map((foodId) => ({
          id: uid(`ing-${foodId}`),
          foodId,
          qty: null,
          autoQty: null,
          isManual: false,
        }));

        const withRandom = baseIngs.map((ing) => {
          const food = getFood(ing.foodId);
          const qty = food ? randomQtyForFood(food) : null;
          return { ...ing, qty, autoQty: qty, isManual: false };
        });

        return { ...m, dish: entry.dish, ingredients: withRandom, status: "planned", manualOrder: { protein: [], carb: [], fat: [] } };
      })
    );
  }

  function ensureManualAllowed(meal, ingId) {
    const ing = meal.ingredients.find((x) => x.id === ingId);
    if (!ing) return meal;

    const group = getGroup(ing.foodId);
    if (group === "other") {
      return makeIngredientManual(meal, ingId);
    }

    const sameGroup = meal.ingredients.filter((x) => getGroup(x.foodId) === group);
    const count = sameGroup.length;

    if (count <= 1) {
      return meal;
    }

    const allowed = count - 1;
    const order = (meal.manualOrder?.[group] || []).slice();

    const already = order.includes(ingId);
    const nextOrder = already ? [...order.filter((x) => x !== ingId), ingId] : [...order, ingId];

    let nextMeal = makeIngredientManual(meal, ingId);

    if (nextOrder.length > allowed) {
      const toReset = nextOrder[0];
      nextMeal = resetToAuto(nextMeal, toReset);
      nextOrder.shift();
    }

    return {
      ...nextMeal,
      manualOrder: {
        ...(nextMeal.manualOrder || { protein: [], carb: [], fat: [] }),
        [group]: nextOrder,
      },
    };
  }

  function makeIngredientManual(meal, ingId) {
    const nextIngredients = meal.ingredients.map((i) => {
      if (i.id !== ingId) return i;
      if (typeof i.autoQty !== "number") return i;
      return { ...i, isManual: true };
    });

    return { ...meal, ingredients: nextIngredients };
  }

  function resetToAuto(meal, ingId) {
    const nextIngredients = meal.ingredients.map((i) => {
      if (i.id !== ingId) return i;
      if (typeof i.autoQty !== "number") return { ...i, isManual: false };
      return { ...i, qty: i.autoQty, isManual: false };
    });

    const nextManualOrder = { ...(meal.manualOrder || { protein: [], carb: [], fat: [] }) };
    for (const k of ["protein", "carb", "fat"]) {
      nextManualOrder[k] = (nextManualOrder[k] || []).filter((id) => id !== ingId);
    }

    return { ...meal, ingredients: nextIngredients, manualOrder: nextManualOrder };
  }

  function setIngredientQty(mealId, ingId, nextQty, opts = {}) {
    setDayMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;

        if (opts.bypassRules) {
          return {
            ...m,
            ingredients: m.ingredients.map((i) => {
              if (i.id !== ingId) return i;
              const qty = clamp(nextQty, 0, 9999);
              const autoQty = typeof i.autoQty === "number" ? i.autoQty : qty;
              return { ...i, qty, autoQty, isManual: true };
            }),
          };
        }

        let nextMeal = ensureManualAllowed(m, ingId);

        nextMeal = {
          ...nextMeal,
          ingredients: nextMeal.ingredients.map((i) => {
            if (i.id !== ingId) return i;
            if (typeof i.qty !== "number") return i;
            return { ...i, qty: clamp(nextQty, 0, 9999) };
          }),
        };

        return nextMeal;
      })
    );
  }

  function updateMealTargets(mealId, targets) {
    setDayMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;

        if (!targets) {
          return { ...m, targetOverride: null, targetSource: "auto" };
        }

        return {
          ...m,
          kcalTarget: typeof targets.kcal === "number" ? targets.kcal : m.kcalTarget,
          targetOverride: targets,
          targetSource: "override",
        };
      })
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-100">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full blur-3xl bg-[#D4AF37]/15" />
        <div className="absolute top-24 -right-32 h-80 w-80 rounded-full blur-3xl bg-[#D4AF37]/10" />
      </div>

      <div className="relative mx-auto w-full max-w-[520px] px-4 pb-28 pt-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <Flame className="mt-0.5 h-10 w-10 text-rose-500 shrink-0 drop-shadow-[0_6px_20px_rgba(244,63,94,0.25)]" />
            <div className="min-w-0">
              <div className="text-sm text-zinc-400">Hoy</div>
              <div className="text-lg font-semibold capitalize truncate">{formatDateEs()}</div>
            </div>
          </div>

          {/* Preferencias: SOLO icono */}
          <button
            onClick={() => setShowSheet({ type: "settings" })}
            className="shrink-0 inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#0b0b0b] p-2.5 hover:border-[#D4AF37]/45 transition"
            aria-label="Preferencias"
            title="Preferencias"
          >
            <Settings2 className="h-5 w-5 text-[#D4AF37]" />
          </button>
        </div>

        {/* Meta de hoy */}
        <div className="mt-4 rounded-3xl border border-[#D4AF37]/25 bg-[#0b0b0b]/80 p-4 shadow-[0_0_0_1px_rgba(212,175,55,0.06)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-200">Meta de hoy</div>
            <div className={["text-xs font-medium", remainingState === "onTrack" ? "text-[#D4AF37]" : "text-rose-300"].join(" ")}>
              {remainingLabel}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MacroPill label="Kcal" value={`${consumedTotal.kcal}/${DAILY_GOAL.kcal}`} accent />
            <MacroPill label="P" value={`${consumedTotal.p}/${DAILY_GOAL.p}g`} />
            <MacroPill label="C" value={`${consumedTotal.c}/${DAILY_GOAL.c}g`} />
            <MacroPill label="G" value={`${consumedTotal.g}/${DAILY_GOAL.g}g`} />
          </div>

          <div className="mt-4">
            <button
              onClick={generateDay}
              className={[
                "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-[#080808] transition",
                "bg-[#D4AF37] hover:brightness-95 active:brightness-90",
                genPressed ? "shadow-[0_0_0_2px_rgba(212,175,55,0.30),0_14px_30px_rgba(0,0,0,0.45)] translate-y-[1px]" : "shadow-[0_10px_24px_rgba(0,0,0,0.35)]",
              ].join(" ")}
            >
              <Sparkles className="h-4 w-4" />
              Generar día
            </button>
          </div>
        </div>

        {/* Snack libre */}
        <div className="mt-4 rounded-3xl border-2 border-[#D4AF37]/25 bg-[#0b0b0b]/75 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 grid place-items-center shrink-0">
                  <Utensils className="h-4 w-4 text-[#D4AF37]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-zinc-400">Snack libre</div>
                  <div className="text-base font-semibold">{Math.max(0, snackRemaining)} kcal libres</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-zinc-400">Usalo cuando quieras. Si te salís del plan, podés reajustar.</div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowSheet({ type: "snackDetail" })}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#D4AF37]/25 bg-[#0b0b0b] px-3 py-2 text-sm hover:border-[#D4AF37]/45 transition"
              >
                <Info className="h-4 w-4 text-[#D4AF37]" />
                Detalle
              </button>

              <button
                onClick={() => setShowSheet({ type: "snackPick" })}
                disabled={snackRemaining <= 0}
                className={[
                  "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                  snackRemaining <= 0
                    ? "border-[#D4AF37]/10 bg-[#0b0b0b]/40 text-zinc-500 cursor-not-allowed"
                    : "border-[#D4AF37]/25 bg-[#0b0b0b] hover:border-[#D4AF37]/45 text-zinc-200",
                ].join(" ")}
              >
                <Plus className="h-4 w-4 text-[#D4AF37]" />
                Elegir
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>200</span>
              <span className="text-[#D4AF37] font-medium">{snackBudget} kcal</span>
              <span>500</span>
            </div>
            <input
              type="range"
              min={200}
              max={500}
              value={snackBudget}
              onChange={(e) => setSnackBudget(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-[#D4AF37]"
            />
          </div>
        </div>

        {/* Plan de comidas */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-200">Plan de comidas</div>
          </div>

          <div className="mt-3 space-y-3">
            {dayMeals.map((m) => (
              <MealCard
                key={m.id}
                meal={m}
                onDone={() => toggleMealDone(m.id)}
                onDetail={() => openMealDetail(m.id)}
                onManualAdd={() => openManualMealEntry(m.id)}
                onChangeMeal={() => changeMealForType(m.id)}
                onToggleFav={() => toggleFavorite(m.id)}
                onEditTargets={() => openMealTargets(m.id)}
                canDone={m.ingredients.length > 0 && m.ingredients.every((i) => typeof i.qty === "number" && i.qty > 0)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      {!showSheet && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#070707] to-transparent">
          <div className="mx-auto w-full max-w-[520px] px-4 pb-4">
            <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#0b0b0b]/90 p-3 backdrop-blur shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setDayMeals((prev) =>
                      prev.map((m) => {
                        if (m.status === "done") return m;
                        if (!m.ingredients?.length) return m;
                        return regenMealRandom(m);
                      })
                    );
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] px-4 py-3 text-sm font-semibold text-[#080808] hover:brightness-95 active:brightness-90 transition"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reajustar
                </button>

                <button
                  onClick={() => setShowSheet({ type: "snackPick" })}
                  className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-3 hover:border-[#D4AF37]/45 transition"
                  aria-label="Sumar snack"
                  title="Sumar snack"
                >
                  <Plus className="h-5 w-5 text-[#D4AF37]" />
                </button>
              </div>

              <div className="mt-2 text-center text-xs text-zinc-400">Reajustar genera nuevas cantidades automáticas.</div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      {showSheet && (
        <BottomSheet onClose={() => setShowSheet(null)}>
          {showSheet.type === "settings" && (
            <SheetSection title="Preferencias rápidas" subtitle="(demo)">
              <div className="grid grid-cols-2 gap-2">
                <ChipButton label="Sin cocinar" />
                <ChipButton label="Económico" />
                <ChipButton label="Rápido (≤15min)" />
                <ChipButton label="Más llenador" />
              </div>
              <div className="mt-4">
                <Button label="Aplicar" variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setShowSheet(null)} />
              </div>
            </SheetSection>
          )}

          {showSheet.type === "snackPick" && <SnackPickSheet remaining={snackRemaining} suggestions={snackSuggestions} onPick={addSnack} />}

          {showSheet.type === "snackDetail" && (
            <SnackDetailSheet
              snacks={snacks}
              snackBudget={snackBudget}
              onRemove={removeSnack}
              onAdd={() => setShowSheet({ type: "snackPick" })}
              onClose={() => setShowSheet(null)}
            />
          )}

          {showSheet.type === "mealTargets" && (
            <MealTargetsSheet
              meal={dayMeals.find((m) => m.id === showSheet.payload.mealId)}
              onClose={() => setShowSheet(null)}
              onSave={(targets) => {
                updateMealTargets(showSheet.payload.mealId, targets);
                setShowSheet(null);
              }}
              onClear={() => {
                updateMealTargets(showSheet.payload.mealId, null);
                setShowSheet(null);
              }}
            />
          )}

          {showSheet.type === "mealDetail" && (
            <MealDetailSheet
              meal={dayMeals.find((m) => m.id === showSheet.payload.mealId)}
              mode={showSheet.payload.mode || "plan"}
              onClose={() => setShowSheet(null)}
              onUpdateMeal={(patch) => {
                const mealId = showSheet.payload.mealId;
                setDayMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, ...patch } : m)));
              }}
              onAddFood={(foodId, opts) => addIngredientToMeal(showSheet.payload.mealId, foodId, opts)}
              onRemoveIng={(ingId) => removeIngredient(showSheet.payload.mealId, ingId)}
              onGenerate={() => regenMeal(showSheet.payload.mealId)}
              onSetQty={(ingId, qty, opts) => setIngredientQty(showSheet.payload.mealId, ingId, qty, opts)}
            />
          )}
        </BottomSheet>
      )}
    </div>
  );
}

/* ===================== UI COMPONENTS ===================== */

function MacroPill({ label, value, accent }) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs",
        accent ? "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]" : "border-[#D4AF37]/15 bg-[#070707] text-zinc-200",
      ].join(" ")}
    >
      <span className={accent ? "font-semibold" : "text-zinc-400"}>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Button({ label, icon, onClick, variant = "primary", disabled }) {
  const base = "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:brightness-95";
  const styles =
    variant === "primary"
      ? "bg-[#D4AF37] text-[#080808] hover:brightness-95"
      : "border border-[#D4AF37]/25 bg-[#070707] text-zinc-200 hover:border-[#D4AF37]/45";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[base, styles, disabled ? "opacity-50 cursor-not-allowed hover:brightness-100" : ""].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

function MealCard({ meal, onDone, onDetail, onManualAdd, onChangeMeal, onToggleFav, onEditTargets, canDone }) {
  const done = meal.status === "done";
  const hasDish = Boolean(meal.dish);

  const actual = useMemo(() => calcMealFromIngredients(meal.ingredients), [meal.ingredients]);
  const target = useMemo(() => getMealTargets(meal), [meal.kcalTarget, meal.targetOverride]);

  const hasReal = useMemo(
    () => meal.ingredients?.some((i) => typeof i.qty === "number" && i.qty > 0),
    [meal.ingredients]
  );

  const preview = useMemo(() => {
    if (!meal.ingredients?.length) return "";
    const parts = meal.ingredients
      .filter((ing) => typeof ing.qty === "number" && ing.qty > 0)
      .slice(0, 5)
      .map((ing) => {
        const f = getFood(ing.foodId);
        if (!f) return null;
        return `${f.name} ${Math.round(ing.qty)}${f.unit}`;
      })
      .filter(Boolean);
    if (!parts.length) return "";
    const more = meal.ingredients.length > parts.length ? ` +${meal.ingredients.length - parts.length}` : "";
    return parts.join(", ") + more;
  }, [meal.ingredients]);

  return (
    <div
      className={[
        "rounded-3xl border-2 p-4 transition",
        done ? "border-[#D4AF37]/70 bg-emerald-950/35" : "border-[#D4AF37]/25 bg-[#0f0f10]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className={[
                "h-8 w-8 rounded-2xl grid place-items-center border shrink-0",
                done ? "bg-emerald-500/10 border-[#D4AF37]/70" : "bg-[#070707] border-[#D4AF37]/20",
              ].join(" ")}
            >
              {done ? <Check className="h-4 w-4 text-emerald-300" /> : <Utensils className="h-4 w-4 text-[#D4AF37]" />}
            </div>

            <div className="min-w-0">
              <div className="text-sm text-zinc-400">{meal.type}</div>

              <div className="flex items-center gap-2">
                {hasDish ? (
                  <div className="truncate text-base font-semibold">{meal.dish}</div>
                ) : (
                  <div className="text-base font-semibold text-zinc-500">Sin comida creada</div>
                )}

                {meal.planType === "manual" && (
                  <span className="shrink-0 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-0.5 text-[11px] font-semibold text-[#D4AF37]">
                    Manual
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <div className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Meta:</span>{" "}
              <span className="text-[#D4AF37] font-semibold">
                {target.kcal} kcal · P {target.p}g · C {target.c}g · G {target.g}g
              </span>
              {meal.targetSource === "override" && (
                <span className="ml-2 rounded-lg border border-[#D4AF37]/20 bg-[#070707] px-2 py-0.5 text-[10px] text-[#D4AF37]">
                  ajustada
                </span>
              )}
            </div>

            <div className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Real:</span>{" "}
              <span className={hasReal ? "text-zinc-200 font-semibold" : "text-zinc-500"}>
                {actual.kcal} kcal · P {actual.p}g · C {actual.c}g · G {actual.g}g
              </span>
            </div>
          </div>

          {preview && <div className="mt-2 text-xs text-zinc-400 line-clamp-2">{preview}</div>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          onClick={onToggleFav}
          className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-2.5 hover:border-[#D4AF37]/45 transition"
          title={meal.isFavorite ? "Quitar favorito" : "Marcar favorito"}
          aria-label="Favorito"
        >
          <Heart className={["h-5 w-5", meal.isFavorite ? "text-rose-400" : "text-[#D4AF37]"].join(" ")} fill={meal.isFavorite ? "currentColor" : "none"} />
        </button>

        <button
          onClick={onManualAdd}
          className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-2.5 hover:border-[#D4AF37]/45 transition"
          title="Registrar comida manual (lo que comiste)"
          aria-label="Registrar manual"
        >
          <Plus className="h-5 w-5 text-[#D4AF37]" />
        </button>

        <button
          onClick={onChangeMeal}
          className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-2.5 hover:border-[#D4AF37]/45 transition"
          title="Cambiar comida"
          aria-label="Cambiar"
        >
          <RefreshCw className="h-5 w-5 text-[#D4AF37]" />
        </button>

        <button
          onClick={onEditTargets}
          className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-2.5 hover:border-[#D4AF37]/45 transition"
          title="Ajustar meta de esta comida"
          aria-label="Ajustar meta"
        >
          <Settings2 className="h-5 w-5 text-[#D4AF37]" />
        </button>

        <button
          onClick={onDetail}
          className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-2.5 hover:border-[#D4AF37]/45 transition"
          title="Detalle"
          aria-label="Detalle"
        >
          <Info className="h-5 w-5 text-[#D4AF37]" />
        </button>
      </div>

      <div className="mt-4">
        <button
          onClick={onDone}
          disabled={!done && !canDone}
          className={[
            "w-full rounded-2xl px-3 py-3 text-sm font-semibold transition",
            done
              ? "bg-emerald-700/40 border border-[#D4AF37]/70 text-zinc-50"
              : !canDone
              ? "border border-[#D4AF37]/10 bg-[#070707]/40 text-zinc-500 cursor-not-allowed"
              : "border border-[#D4AF37]/25 bg-[#070707] text-zinc-200 hover:border-[#D4AF37]/45",
          ].join(" ")}
          title={!done && !canDone ? "Agregá alimentos y tocá Generar en Detalle (o usá ➕ manual)" : ""}
        >
          {done ? "Hecho" : "Marcar hecho"}
        </button>
      </div>
    </div>
  );
}

function BottomSheet({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[520px]">
        <div className="rounded-t-[28px] border-x border-t border-[#D4AF37]/25 bg-[#0b0b0b] shadow-[0_-20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="h-1.5 w-12 rounded-full bg-[#D4AF37]/25 mx-auto" />
          </div>
          <div className="max-h-[78vh] overflow-y-auto px-4 pb-8">
            {children}
            <div className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetSection({ title, subtitle, children }) {
  return (
    <div className="pb-2">
      <div>
        <div className="text-lg font-semibold">{title}</div>
        {subtitle && <div className="mt-1 text-sm text-zinc-400">{subtitle}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ChipButton({ label }) {
  return (
    <button className="rounded-2xl border border-[#D4AF37]/15 bg-[#070707] px-3 py-3 text-sm text-zinc-200 hover:border-[#D4AF37]/35 transition">
      {label}
    </button>
  );
}

function SnackPickSheet({ remaining, suggestions, onPick }) {
  return (
    <SheetSection title="Elegí tu snack" subtitle={`Te quedan ~${remaining} kcal (demo)`}>
      <div className="grid gap-2">
        {suggestions
          .filter((s) => s.kcal <= remaining + 80)
          .slice(0, 12)
          .map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className="w-full rounded-2xl border border-[#D4AF37]/10 bg-[#070707] px-3 py-3 text-left hover:border-[#D4AF37]/30 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.label}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {s.kcal} kcal • P {s.p} • C {s.c} • G {s.g}
                  </div>
                </div>
                <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0b0b0b] px-2 py-1 text-xs text-[#D4AF37]">Agregar</div>
              </div>
            </button>
          ))}
      </div>
    </SheetSection>
  );
}

function SnackDetailSheet({ snacks, snackBudget, onRemove, onAdd, onClose }) {
  const total = snacks.reduce((a, s) => a + s.kcal, 0);
  const remaining = Math.max(0, snackBudget - total);

  return (
    <SheetSection title="Detalle de snack" subtitle={`${total} kcal usadas • ${remaining} kcal libres`}>
      {snacks.length === 0 ? (
        <div className="rounded-2xl border border-[#D4AF37]/10 bg-[#070707] p-4 text-sm text-zinc-300">Todavía no registraste snacks.</div>
      ) : (
        <div className="space-y-2">
          {snacks.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-[#D4AF37]/10 bg-[#070707] px-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{s.label}</div>
                <div className="text-xs text-zinc-400">
                  {s.kcal} kcal • P {s.p} • C {s.c} • G {s.g}
                </div>
              </div>
              <button
                onClick={() => onRemove(s.id)}
                className="rounded-xl border border-[#D4AF37]/20 bg-[#0b0b0b] p-2 hover:border-[#D4AF37]/45 transition"
                aria-label="Eliminar snack"
              >
                <X className="h-4 w-4 text-[#D4AF37]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button label="Agregar" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onAdd} />
        <Button label="Cerrar" variant="ghost" icon={<ChevronRight className="h-4 w-4" />} onClick={onClose} />
      </div>
    </SheetSection>
  );
}

/* ===================== MEAL TARGETS SHEET (⚙️) ===================== */

function MealTargetsSheet({ meal, onClose, onSave, onClear }) {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }

  if (!meal) {
    return (
      <SheetSection title="Meta" subtitle="No se encontró la comida">
        <Button label="Cerrar" variant="primary" onClick={onClose} />
      </SheetSection>
    );
  }

  const current = getMealTargets(meal);

  const [kcal, setKcal] = useState(String(current.kcal ?? ""));
  const [p, setP] = useState(String(current.p ?? ""));
  const [c, setC] = useState(String(current.c ?? ""));
  const [g, setG] = useState(String(current.g ?? ""));

  function parseNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function handleSave() {
    const kcalN = parseNum(kcal);
    const pN = parseNum(p);
    const cN = parseNum(c);
    const gN = parseNum(g);

    if (kcalN == null || pN == null || cN == null || gN == null) {
      showToast("Completá números válidos (kcal, P, C, G).");
      return;
    }

    onSave?.({
      kcal: Math.round(kcalN),
      p: Math.round(pN),
      c: Math.round(cN),
      g: Math.round(gN),
    });
  }

  return (
    <div className="pb-2 relative">
      {toast && (
        <div className="sticky top-0 z-20">
          <div className="mx-auto mt-2 w-full rounded-2xl border border-[#D4AF37]/20 bg-[#0b0b0b] px-4 py-3 text-sm text-zinc-200 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
            <span className="text-[#D4AF37] font-semibold">Info:</span> {toast}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold">Meta — {meal.type}</div>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-2.5 hover:border-[#D4AF37]/45 transition"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <ChevronRight className="h-5 w-5 text-[#D4AF37]" />
        </button>
      </div>

      <div className="mt-3 rounded-3xl border border-[#D4AF37]/15 bg-[#070707] p-4">
        <div className="text-sm text-zinc-400">Ajustá las calorías y macros objetivo para esta comida.</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Field label="Kcal" value={kcal} onChange={setKcal} />
          <Field label="Proteína (g)" value={p} onChange={setP} />
          <Field label="Carbo (g)" value={c} onChange={setC} />
          <Field label="Grasa (g)" value={g} onChange={setG} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button label="Guardar" variant="primary" icon={<Check className="h-4 w-4" />} onClick={handleSave} />
          <button
            onClick={() => onClear?.()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition border border-rose-500/25 bg-[#070707] text-rose-300 hover:border-rose-500/45"
          >
            <Trash2 className="h-4 w-4" />
            Resetear
          </button>
        </div>

        <div className="mt-4">
          <Button label="Cerrar" variant="ghost" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div className="rounded-2xl border border-[#D4AF37]/10 bg-[#0b0b0b] p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="number"
        inputMode="numeric"
        className="mt-2 w-full rounded-2xl border border-[#D4AF37]/10 bg-[#070707] px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#D4AF37]/35"
      />
    </div>
  );
}

/* ===================== MEAL DETAIL SHEET ===================== */

function MealDetailSheet({ meal, mode = "plan", onClose, onUpdateMeal, onAddFood, onRemoveIng, onGenerate, onSetQty }) {
  const [foodQuery, setFoodQuery] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // ✅ BACKEND foods (cache local del sheet)
  const [remoteFoods, setRemoteFoods] = useState([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [foodsError, setFoodsError] = useState(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }

  if (!meal) {
    return (
      <SheetSection title="Detalle" subtitle="No se encontró la comida">
        <Button label="Cerrar" variant="primary" onClick={onClose} />
      </SheetSection>
    );
  }

  const mealMacros = calcMealFromIngredients(meal.ingredients);
  const hasAnyFoods = meal.ingredients.length > 0;

  const q = foodQuery.trim().toLowerCase();
  const shouldShowResults = q.length >= 2;

  // ✅ Trae la lista del backend cuando empezás a buscar (>=2 letras). Usa debounce + abort.
  React.useEffect(() => {
    if (!shouldShowResults) return;

    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setFoodsLoading(true);
        setFoodsError(null);

        // ✅ Con proxy Vite: pega a http://localhost:8080/api/alimentos
        const r = await fetch("/api/alimentos", { signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const data = await r.json();
        const normalized = Array.isArray(data) ? data.map(normalizeBackendFood) : [];

        // ✅ metemos los foods en el índice global para que getFood() los encuentre y calcule macros bien
        upsertFoodsToIndex(normalized);

        setRemoteFoods(normalized);
      } catch (e) {
        if (e?.name !== "AbortError") {
          setFoodsError("No pude traer alimentos del backend (/api/alimentos).");
        }
      } finally {
        setFoodsLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [shouldShowResults]);

  const filteredFoods = shouldShowResults
    ? remoteFoods.filter((f) => (f.name || "").toLowerCase().includes(q)).slice(0, 12)
    : [];

  function canEditIngredient(ing) {
    if (mode === "manual") return true;
    const group = getGroup(ing.foodId);
    if (group === "other") return true;
    const sameGroup = meal.ingredients.filter((x) => getGroup(x.foodId) === group);
    return sameGroup.length > 1;
  }

  function onTryEdit(ing) {
    if (mode === "manual") return true;

    const group = getGroup(ing.foodId);

    if (typeof ing.qty !== "number") {
      showToast("Primero tocá Generar para obtener cantidades.");
      return false;
    }

    if (group !== "other") {
      const sameGroup = meal.ingredients.filter((x) => getGroup(x.foodId) === group);
      if (sameGroup.length <= 1) {
        showToast(`No podés editar esta cantidad: es el único alimento ${groupLabel(group)}. Agregá otro para habilitar edición.`);
        return false;
      }
    }
    return true;
  }

  function handleClearAll() {
    if (!hasAnyFoods) {
      showToast("No hay alimentos para eliminar.");
      return;
    }
    onUpdateMeal({
      ingredients: [],
      manualOrder: { protein: [], carb: [], fat: [] },
    });
    showToast("Listo: eliminé todos los alimentos.");
  }

  function handleGenerate() {
    if (!hasAnyFoods) {
      showToast("Primero agregá al menos un alimento.");
      return;
    }
    if (!meal.dish?.trim()) onUpdateMeal({ dish: `${meal.type} (${mode === "manual" ? "manual" : "personalizado"})` });
    onGenerate();
    showToast("Listo: generé cantidades nuevas (auto).");
  }

  return (
    <div className="pb-2 relative">
      {toast && (
        <div className="sticky top-0 z-20">
          <div className="mx-auto mt-2 w-full rounded-2xl border border-[#D4AF37]/20 bg-[#0b0b0b] px-4 py-3 text-sm text-zinc-200 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
            <span className="text-[#D4AF37] font-semibold">Info:</span> {toast}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold">
          {meal.type}{" "}
          <span className="text-xs font-semibold text-zinc-500">
            {mode === "manual" ? "• registro manual" : "• plan"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            className="inline-flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#070707] p-2.5 hover:border-[#D4AF37]/45 transition"
            aria-label="Generar"
            title="Generar cantidades"
          >
            <RefreshCw className="h-5 w-5 text-[#D4AF37]" />
          </button>

          <button
            onClick={handleClearAll}
            className="inline-flex items-center justify-center rounded-2xl border border-rose-500/25 bg-[#070707] p-2.5 hover:border-rose-500/45 transition"
            aria-label="Eliminar todos"
            title="Eliminar todos los alimentos"
          >
            <Trash2 className="h-5 w-5 text-rose-400" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <input
          value={meal.dish}
          onChange={(e) => onUpdateMeal({ dish: e.target.value })}
          placeholder="Ej: Pasta + carne + verduras"
          className="w-full rounded-3xl border border-[#D4AF37]/15 bg-[#070707] px-4 py-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#D4AF37]/35"
        />
      </div>

      <div className="mt-4 rounded-3xl border border-[#D4AF37]/15 bg-[#070707] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-base font-semibold">Alimentos</div>
          <div className="text-sm font-semibold text-[#D4AF37] whitespace-nowrap">
            {mealMacros.kcal} kcal • P {mealMacros.p} • C {mealMacros.c} • G {mealMacros.g}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {!hasAnyFoods ? (
            <div className="rounded-2xl border border-[#D4AF37]/10 bg-[#0b0b0b] p-3 text-sm text-zinc-300">No agregaste alimentos todavía.</div>
          ) : (
            meal.ingredients.map((ing) => {
              const food = getFood(ing.foodId);
              if (!food) return null;

              const ready = typeof ing.qty === "number";

              return (
                <div key={ing.id} className="rounded-3xl border border-[#D4AF37]/10 bg-[#0b0b0b] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate">{food.name}</div>
                      <div className="text-sm text-zinc-400">
                        {ready ? (ing.isManual ? "Cantidad (manual)" : "Cantidad (auto)") : "Pendiente de generar"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <QtyPillEditor
                        value={ready ? ing.qty : null}
                        unit={food.unit}
                        editable={ready && canEditIngredient(ing)}
                        isManual={!!ing.isManual}
                        onBeforeEdit={() => onTryEdit(ing)}
                        onChange={(val) =>
                          onSetQty(
                            ing.id,
                            val,
                            mode === "manual"
                              ? { bypassRules: true }
                              : undefined
                          )
                        }
                        onBlockedClick={() => onTryEdit(ing)}
                      />

                      <button
                        onClick={() => onRemoveIng(ing.id)}
                        className="rounded-2xl border border-[#D4AF37]/20 bg-[#070707] p-2 hover:border-[#D4AF37]/45 transition"
                        aria-label="Quitar alimento"
                        title="Quitar"
                      >
                        <X className="h-4 w-4 text-[#D4AF37]" />
                      </button>
                    </div>
                  </div>

                  {!ready && (
                    <div className="mt-4 rounded-2xl border border-[#D4AF37]/10 bg-[#070707] px-4 py-3 text-sm text-zinc-400">
                      Tocá <span className="text-[#D4AF37] font-semibold">Generar</span> para obtener cantidad.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold">Agregar alimentos</div>
          <input
            value={foodQuery}
            onChange={(e) => setFoodQuery(e.target.value)}
            placeholder="Buscar alimento (mín. 2 letras)"
            className="mt-2 w-full rounded-2xl border border-[#D4AF37]/15 bg-[#0b0b0b] px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#D4AF37]/35"
          />

          {shouldShowResults && (
            <div className="mt-2 grid gap-2">
              {foodsLoading && (
                <div className="rounded-2xl border border-[#D4AF37]/10 bg-[#0b0b0b] p-3 text-sm text-zinc-300">
                  Cargando alimentos...
                </div>
              )}

              {!foodsLoading && foodsError && (
                <div className="rounded-2xl border border-rose-500/25 bg-[#0b0b0b] p-3 text-sm text-rose-300">
                  {foodsError}
                </div>
              )}

              {!foodsLoading && !foodsError && filteredFoods.length === 0 ? (
                <div className="rounded-2xl border border-[#D4AF37]/10 bg-[#0b0b0b] p-3 text-sm text-zinc-300">No encontré resultados.</div>
              ) : (
                filteredFoods.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      const defaultQty = f.unit === "uni" ? 1 : 100; // ✅ manual: 1 uni o 100g
                      if (mode === "manual") {
                        onAddFood(f.id, { qty: defaultQty, autoQty: defaultQty, isManual: true });
                      } else {
                        onAddFood(f.id);
                      }
                      setFoodQuery("");
                      showToast(`Agregado: ${f.name}${mode === "manual" ? ` (${defaultQty}${f.unit} editable)` : ""}`);
                    }}
                    className="w-full rounded-2xl border border-[#D4AF37]/10 bg-[#0b0b0b] px-3 py-3 text-left hover:border-[#D4AF37]/30 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{f.name}</div>

                      {/* ✅ Mostramos referencia por 1 unidad */}
                      <div className="text-xs text-zinc-400">
                        {f.perUnit ? `${f.kcalPerUnit} kcal/${f.unit}` : `${f.kcal100} kcal/100g`}
                      </div>
                    </div>

                    {f.perUnit && (
                      <div className="mt-1 text-[11px] text-zinc-500">
                        P {Math.round((f.pPerUnit || 0) * 10) / 10} • C {Math.round((f.cPerUnit || 0) * 10) / 10} • G {Math.round((f.gPerUnit || 0) * 10) / 10} (por 1 {f.unit})
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {!shouldShowResults && <div className="mt-2 text-xs text-zinc-500">Escribí para buscar (así no te muestro toda la base).</div>}
        </div>

        <div className="mt-4">
          <Button label="Cerrar" variant="ghost" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

/** Pastilla editable pro */
function QtyPillEditor({ value, unit, editable, isManual, onBeforeEdit, onChange, onBlockedClick }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef(null);

  React.useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  function startEdit() {
    if (!editable) {
      onBlockedClick?.();
      return;
    }
    const ok = onBeforeEdit?.();
    if (ok === false) return;

    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setEditing(false);
      return;
    }
    onChange?.(n);
    setEditing(false);
  }

  if (value == null) {
    return <div className="rounded-2xl border border-[#D4AF37]/10 bg-[#070707] px-3 py-2 text-xs text-zinc-400">—</div>;
  }

  return (
    <div
      className={[
        "rounded-2xl border bg-[#070707] px-3 py-2 text-sm font-semibold transition select-none",
        editable ? "border-[#D4AF37]/25 hover:border-[#D4AF37]/45 cursor-pointer" : "border-[#D4AF37]/10 opacity-80 cursor-not-allowed",
        isManual ? "text-[#D4AF37]" : "text-[#D4AF37]",
      ].join(" ")}
      onClick={startEdit}
      title={editable ? "Click para editar" : "No editable"}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") startEdit();
      }}
    >
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            className="w-20 bg-transparent outline-none text-[#D4AF37] placeholder:text-[#D4AF37]/40"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <span className="text-[#D4AF37]">{unit}</span>
        </div>
      ) : (
        <span className="whitespace-nowrap">
          {Math.round(value)} {unit}
        </span>
      )}
    </div>
  );
}
