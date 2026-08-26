function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function foodItems(meal = {}) {
  return Array.isArray(meal.items) ? meal.items : Array.isArray(meal.alimentos) ? meal.alimentos : [];
}

function foodIdentity(item = {}) {
  return String(item.alimentoId || item.foodId || item.nombreSnapshot || item.nombre || item.name || item.id || "").trim().toLowerCase();
}

export const MENU_MEAL_PROTEIN_MIN = 5;
export const MENU_MEAL_PROTEIN_MAX = 70;

const GENERATION_MEAL_TYPE_BY_MENU_TYPE = Object.freeze({
  desayuno: "breakfast",
  almuerzo: "lunch",
  merienda: "snack",
  cena: "dinner",
  snack: "extraSnack",
  colacion: "extraSnack",
  pre_entreno: "extraSnack",
  post_entreno: "extraSnack",
});

export function generationMealTypeForMenuType(mealType = "") {
  return GENERATION_MEAL_TYPE_BY_MENU_TYPE[String(mealType)] || "";
}

export function isGenericGenerationFood(food = {}) {
  return String(food?.generation?.mode || food?.raw?.generation?.mode || "").toUpperCase() === "GENERIC";
}

function foodPreferenceSets(foods = []) {
  return {
    ids: new Set(foods.map((food) => String(food.id || food._id || food.alimentoId || "")).filter(Boolean)),
    names: new Set(foods.map((food) => String(food.nombre || food.name || "").trim().toLowerCase()).filter(Boolean)),
  };
}

function preferredFoodMatches(meal = {}, preferredFoods = []) {
  const preferred = foodPreferenceSets(preferredFoods);
  const matched = new Set();
  foodItems(meal).forEach((item) => {
    const id = String(item.alimentoId || item.foodId || item.id || "");
    const name = String(item.nombreSnapshot || item.nombre || item.name || "").trim().toLowerCase();
    if (preferred.ids.has(id)) matched.add(`id:${id}`);
    else if (preferred.names.has(name)) matched.add(`name:${name}`);
  });
  return matched.size;
}

export function libraryMealScore(meal = {}, target = {}, preferredFoods = [], tolerance = "balanced") {
  const totals = meal.totales || meal.macrosTotales || {};
  const kcal = number(totals.kcal ?? meal.kcal);
  const protein = number(totals.proteina ?? totals.protein);
  const carbs = number(totals.carbs ?? totals.carbohidratos);
  const fat = number(totals.grasas ?? totals.fat);
  const weights = tolerance === "strict"
    ? { kcal: 6, protein: 3, carbs: 1.5, fat: 1.5 }
    : tolerance === "flexible"
      ? { kcal: 2, protein: 1, carbs: 0.5, fat: 0.5 }
      : { kcal: 4, protein: 2, carbs: 1, fat: 1 };
  const nutritionScore = Math.abs(number(target.kcal) - kcal) * weights.kcal
    + Math.abs(number(target.proteina) - protein) * weights.protein
    + Math.abs(number(target.carbs) - carbs) * weights.carbs
    + Math.abs(number(target.grasas) - fat) * weights.fat;
  return nutritionScore - (preferredFoodMatches(meal, preferredFoods) * 35);
}

export function libraryMealVarietyPenalty(meal = {}, usedFoodIdentities = [], variety = "medium") {
  if (variety === "low" || !usedFoodIdentities?.size && !Array.isArray(usedFoodIdentities)) return 0;
  const used = usedFoodIdentities instanceof Set ? usedFoodIdentities : new Set(usedFoodIdentities);
  const overlaps = new Set(foodItems(meal).map(foodIdentity).filter((identity) => used.has(identity))).size;
  return overlaps * (variety === "high" ? 35 : 12);
}

export function generatedMealFingerprint(meal = {}) {
  return foodItems(meal).map((item) => {
    const food = String(item.alimentoId || item.foodId || item.nombreSnapshot || item.nombre || item.id || "").trim().toLowerCase();
    const quantity = Math.round(number(item.cantidad ?? item.quantity) * 1000) / 1000;
    const unit = String(item.unidadSnapshot || item.unidad || item.unit || "g").trim().toLowerCase();
    return `${food}:${quantity}:${unit}`;
  }).sort().join("|");
}

/**
 * Identidad semántica de una comida generada. Las cantidades no participan:
 * pollo 120 g + arroz 80 g y pollo 150 g + arroz 70 g siguen siendo la misma
 * composición.
 */
export function generatedMealComposition(meal = {}) {
  const byFood = new Map();
  foodItems(meal).forEach((item) => {
    const id = foodIdentity(item);
    if (!id) return;
    const role = String(
      item.generationRole || item.role || item.structuralRole || ""
    ).trim().toUpperCase();
    const current = byFood.get(id);
    if (!current || (!current.role && role)) byFood.set(id, { foodId: id, role });
  });
  const entries = [...byFood.values()].sort((left, right) => (
    left.foodId.localeCompare(right.foodId) || left.role.localeCompare(right.role)
  ));
  const foodIds = entries.map((entry) => entry.foodId);
  const roleFoodPairs = entries.map((entry) => `${entry.foodId}:${entry.role || "_"}`);
  return {
    foodIds,
    roleFoodPairs,
    fingerprint: foodIds.join("|"),
    roleFingerprint: roleFoodPairs.join("|"),
  };
}

export function generatedMealCompositionFingerprint(meal = {}) {
  return generatedMealComposition(meal).fingerprint;
}

export function menuPreferredFoodMatches(menuMeals = [], preferredFoods = []) {
  return menuMeals.reduce((sum, meal) => sum + preferredFoodMatches(meal, preferredFoods), 0);
}

export function validateMenuGenerationPolicy({ generationMode = "", foods = [], useOnlySelectedFoods = false } = {}) {
  if (generationMode === "similar_menu" && useOnlySelectedFoods) {
    return { generationMode, foods, useOnlySelectedFoods, fallback: "automatic_meal" };
  }
  return { generationMode, foods, useOnlySelectedFoods };
}

export function exactMealTypesMatch(meals = [], requestedTypes = []) {
  if (!requestedTypes.length) return true;
  if (meals.length !== requestedTypes.length) return false;
  const actual = meals.map((meal) => String(meal.tipoComida || meal.mealType || "")).sort();
  const expected = requestedTypes.map(String).sort();
  return actual.every((type, index) => type === expected[index]);
}

export function generatedMealFoodIdentities(meal = {}) {
  return foodItems(meal).map(foodIdentity).filter(Boolean);
}

const MEAL_SUITABILITY_FIELDS = {
  desayuno: "aptoDesayuno",
  almuerzo: "aptoAlmuerzo",
  merienda: "aptoMerienda",
  cena: "aptoCena",
  pre_entreno: "aptoPreEntreno",
  post_entreno: "aptoPostEntreno",
};

export function foodSupportsMealType(food = {}, mealType = "") {
  const source = food.raw && typeof food.raw === "object" ? { ...food.raw, ...food } : food;
  const generation = source.generation && typeof source.generation === "object" ? source.generation : null;
  const generationMealType = generationMealTypeForMenuType(mealType);
  if (generation?.mode) {
    return generation.mode === "GENERIC"
      && Boolean(generationMealType)
      && generation.mealTypes?.[generationMealType] === true;
  }
  const fields = Object.values(MEAL_SUITABILITY_FIELDS);
  const hasExplicitSuitability = fields.some((field) => source[field] === true);
  const requestedField = MEAL_SUITABILITY_FIELDS[mealType];
  return !hasExplicitSuitability || !requestedField || source[requestedField] === true;
}

export function buildIncludedFoodAssignments(
  foods = [],
  mealTypes = []
) {
  const types = [
    ...new Set(
      (Array.isArray(mealTypes) ? mealTypes : [])
        .map(String)
        .filter(Boolean)
    ),
  ];

  const byMeal = Object.fromEntries(
    types.map((type) => [
      type,
      {
        required: [],
        preferred: [],
        allowed: [],
      },
    ])
  );

  let anyCursor = 0;

  function addUnique(list, food) {
    const identity = foodIdentity(food);

    if (!identity) {
      if (!list.includes(food)) {
        list.push(food);
      }

      return;
    }

    const alreadyExists = list.some(
      (entry) =>
        foodIdentity(entry) === identity
    );

    if (!alreadyExists) {
      list.push(food);
    }
  }

  (Array.isArray(foods) ? foods : []).forEach(
    (food) => {
      const requestedType = String(
        food?.targetMealType || "any"
      );

      /*
       * ==========================================
       * ALIMENTO ELEGIDO EXPLÍCITAMENTE
       * ==========================================
       *
       * Si el usuario eligió:
       *
       * Pan -> Desayuno
       *
       * entra en Desayuno aunque:
       *
       * - no sea GENERIC
       * - breakfast sea false
       *
       * La elección explícita tiene prioridad.
       */
      const explicitMealType =
        requestedType !== "any" &&
        types.includes(requestedType)
          ? requestedType
          : "";

      if (explicitMealType) {
        const assignment =
          byMeal[explicitMealType];

        if (!assignment) return;

        addUnique(
          assignment.allowed,
          food
        );

        addUnique(
          assignment.preferred,
          food
        );

        /*
         * En la nueva UI:
         *
         * si el usuario agregó el alimento
         * en "Incluir", debe aparecer.
         *
         * Sólo deja de ser obligatorio si
         * explícitamente viene:
         *
         * mustAppear: false
         */
        if (food?.mustAppear !== false) {
          addUnique(
            assignment.required,
            food
          );
        }

        return;
      }

      /*
       * ==========================================
       * "CUALQUIER COMIDA"
       * ==========================================
       *
       * También es una selección explícita del
       * usuario.
       *
       * Por eso NO usamos foodSupportsMealType().
       *
       * Puede participar en cualquiera de las
       * comidas configuradas.
       */
      types.forEach((type) => {
        addUnique(
          byMeal[type].allowed,
          food
        );

        addUnique(
          byMeal[type].preferred,
          food
        );
      });

      /*
       * Si tiene que aparecer pero no se indicó
       * una comida concreta, lo hacemos obligatorio
       * en UNA sola comida.
       *
       * No queremos:
       *
       * Pan -> desayuno + almuerzo + cena
       *
       * sólo porque decía "Cualquier comida".
       */
      if (
        food?.mustAppear !== false &&
        types.length
      ) {
        const requiredType =
          types[
            anyCursor % types.length
          ];

        anyCursor += 1;

        if (byMeal[requiredType]) {
          addUnique(
            byMeal[requiredType].required,
            food
          );
        }
      }
    }
  );

  return byMeal;
}



export function generatedMealNutritionTotals(meal = {}) {
  const items = foodItems(meal);
  if (items.length) {
    return items.reduce((totals, item) => ({
      kcal: totals.kcal + number(item.kcal ?? item.calorias),
      proteina: totals.proteina + number(item.proteina ?? item.protein),
      carbs: totals.carbs + number(item.carbs ?? item.carbohidratos),
      grasas: totals.grasas + number(item.grasas ?? item.fat),
    }), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  }
  const totals = meal.totales || meal.totals || meal.macrosTotales || {};
  return {
    kcal: number(totals.kcal ?? meal.kcal),
    proteina: number(totals.proteina ?? totals.protein),
    carbs: number(totals.carbs ?? totals.carbohidratos),
    grasas: number(totals.grasas ?? totals.fat),
  };
}

export function mealProteinWithinGenerationRange(meal = {}) {
  const protein = generatedMealNutritionTotals(meal).proteina;
  return protein >= MENU_MEAL_PROTEIN_MIN - 1e-6 && protein <= MENU_MEAL_PROTEIN_MAX + 1e-6;
}

export function curateGenerationFoodPool({ foods = [], preferredFoods = [], mealType = "", limit = 6 } = {}) {
  const max = Math.max(1, Number(limit) || 6);
  const compatible = foods.filter((food) => isGenericGenerationFood(food) && foodSupportsMealType(food, mealType));
  const compatibleByIdentity = new Map(compatible.map((food) => [foodIdentity(food), food]));
  const selected = [];
  const selectedIds = new Set();
  const add = (food) => {
    const identity = foodIdentity(food);
    if (!identity || selectedIds.has(identity) || selected.length >= max) return;
    selectedIds.add(identity);
    selected.push(food);
  };
  preferredFoods
    .filter((food) => isGenericGenerationFood(food) && foodSupportsMealType(food, mealType))
    .slice(0, 2)
    .forEach(add);
  ["esProteinaPrincipal", "esCarboPrincipal", "esGrasaPrincipal", "esVegetalLibre"].forEach((role) => {
    add(compatible.find((food) => food?.[role] === true || food?.raw?.[role] === true));
  });
  compatibleByIdentity.forEach(add);
  return selected;
}
