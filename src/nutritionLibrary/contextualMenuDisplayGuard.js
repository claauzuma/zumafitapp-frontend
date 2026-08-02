const TOTAL_ALIASES = {
  kcal: ["kcal", "calorias", "calories"],
  proteina: ["proteina", "proteinas", "protein"],
  carbs: ["carbs", "carbohidratos", "carbohydrates"],
  grasas: ["grasas", "grasa", "fat", "fats"],
};

function readNumber(source = {}, aliases = []) {
  for (const key of aliases) {
    if (!Object.prototype.hasOwnProperty.call(source || {}, key)) continue;
    const value = Number(source[key]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function completeTotals(source = {}) {
  const result = {};
  for (const [key, aliases] of Object.entries(TOTAL_ALIASES)) {
    const value = readNumber(source, aliases);
    if (value === null) return null;
    result[key] = value;
  }
  return result;
}

function entityTotals(entity = {}) {
  for (const source of [entity.macrosTotales, entity.totales, entity.totalesActuales, entity.macros]) {
    const result = completeTotals(source || {});
    if (result) return result;
  }
  return null;
}

function itemTotals(item = {}) {
  const snapshot = item.snapshot || {};
  return completeTotals({
    kcal: item.kcal ?? snapshot.kcal,
    proteina: item.proteina ?? item.proteinas ?? snapshot.proteina ?? snapshot.proteinas,
    carbs: item.carbs ?? item.carbohidratos ?? snapshot.carbs ?? snapshot.carbohidratos,
    grasas: item.grasas ?? item.grasa ?? snapshot.grasas ?? snapshot.grasa,
  });
}

function add(left, right) {
  return {
    kcal: left.kcal + right.kcal,
    proteina: left.proteina + right.proteina,
    carbs: left.carbs + right.carbs,
    grasas: left.grasas + right.grasas,
  };
}

export function reconstructMenuForDisplay(menu = {}) {
  const meals = Array.isArray(menu.comidas) ? menu.comidas : Array.isArray(menu.meals) ? menu.meals : [];
  if (!meals.length) return null;
  let total = { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };
  for (const meal of meals) {
    const items = Array.isArray(meal.items) ? meal.items : Array.isArray(meal.alimentos) ? meal.alimentos : [];
    if (!items.length || items.some((item) => !Number.isFinite(Number(item.cantidad ?? item.quantity)) || Number(item.cantidad ?? item.quantity) <= 0)) return null;
    let itemSum = { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };
    let complete = true;
    for (const item of items) {
      const nutrition = itemTotals(item);
      if (!nutrition) {
        complete = false;
        break;
      }
      itemSum = add(itemSum, nutrition);
    }
    const mealTotal = complete && itemSum.kcal > 0 ? itemSum : entityTotals(meal);
    if (!mealTotal || mealTotal.kcal <= 0) return null;
    total = add(total, mealTotal);
  }
  return total.kcal > 0 ? total : null;
}

function validTarget(target = {}) {
  const values = [target.kcal, target.proteina, target.carbs, target.grasas].map(Number);
  if (!values.every(Number.isFinite) || values[0] <= 0 || values.slice(1).some((value) => value < 0)) return null;
  return { kcal: values[0], proteina: values[1], carbs: values[2], grasas: values[3] };
}

function levelFor(totals, target) {
  const kcalDiff = Math.abs(totals.kcal - target.kcal);
  const proteinDiff = Math.abs(totals.proteina - target.proteina);
  const high = kcalDiff <= target.kcal * 0.10 && proteinDiff <= Math.max(target.proteina * 0.15, 20);
  const acceptable = kcalDiff <= target.kcal * 0.15 && proteinDiff <= Math.max(target.proteina * 0.20, 25);
  return high ? "high" : acceptable ? "acceptable" : "outside";
}

export function filterContextualMenusForDisplay(menus = [], targetInput = {}) {
  const target = validTarget(targetInput);
  if (!target) return [];
  const candidates = (Array.isArray(menus) ? menus : []).flatMap((menu) => {
    if (menu?.contextualEligibility?.eligible === false) return [];
    const reconstructed = reconstructMenuForDisplay(menu);
    if (!reconstructed) return [];
    const level = levelFor(reconstructed, target);
    return level === "outside" ? [] : [{ menu, level }];
  });
  const high = candidates.filter((candidate) => candidate.level === "high");
  const selected = high.length >= 3 ? high : candidates;
  return selected.map((candidate) => candidate.menu);
}

