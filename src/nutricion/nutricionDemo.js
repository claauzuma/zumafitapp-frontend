export const DEMO_COMIDAS = [
  {
    id: "demo-desayuno-proteico",
    demo: true,
    nombre: "Desayuno proteico simple",
    type: "Desayuno",
    tags: ["alto en proteina", "rapido"],
    totals: { kcal: 390, protein: 34, carbs: 42, fat: 9, matched: 3 },
    items: [
      { alimento: "Yogur griego", cantidad: 250 },
      { alimento: "Avena", cantidad: 45 },
      { alimento: "Frutos rojos", cantidad: 80 },
    ],
  },
  {
    id: "demo-almuerzo-pollo-arroz",
    demo: true,
    nombre: "Almuerzo pollo y arroz",
    type: "Almuerzo",
    tags: ["economico", "meal prep"],
    totals: { kcal: 560, protein: 48, carbs: 68, fat: 11, matched: 4 },
    items: [
      { alimento: "Pechuga de pollo", cantidad: 160 },
      { alimento: "Arroz", cantidad: 210 },
      { alimento: "Verduras", cantidad: 150 },
      { alimento: "Aceite de oliva", cantidad: 8 },
    ],
  },
  {
    id: "demo-merienda-yogur-fruta",
    demo: true,
    nombre: "Merienda yogur y fruta",
    type: "Merienda",
    tags: ["simple", "dulce"],
    totals: { kcal: 310, protein: 24, carbs: 39, fat: 6, matched: 3 },
    items: [
      { alimento: "Yogur descremado", cantidad: 220 },
      { alimento: "Banana", cantidad: 120 },
      { alimento: "Whey protein", cantidad: 20 },
    ],
  },
  {
    id: "demo-cena-carne-papa",
    demo: true,
    nombre: "Cena carne magra y papa",
    type: "Cena",
    tags: ["saciante", "clasica"],
    totals: { kcal: 520, protein: 42, carbs: 54, fat: 16, matched: 3 },
    items: [
      { alimento: "Carne magra", cantidad: 150 },
      { alimento: "Papa", cantidad: 280 },
      { alimento: "Ensalada", cantidad: 180 },
    ],
  },
  {
    id: "demo-snack-proteico",
    demo: true,
    nombre: "Snack alto en proteina",
    type: "Snack",
    tags: ["alto en proteina", "portable"],
    totals: { kcal: 260, protein: 28, carbs: 18, fat: 8, matched: 2 },
    items: [
      { alimento: "Whey protein", cantidad: 30 },
      { alimento: "Almendras", cantidad: 15 },
    ],
  },
  {
    id: "demo-cena-vegetariana",
    demo: true,
    nombre: "Cena vegetariana completa",
    type: "Cena",
    tags: ["vegetariano", "fibra"],
    totals: { kcal: 470, protein: 28, carbs: 62, fat: 13, matched: 4 },
    items: [
      { alimento: "Lentejas", cantidad: 220 },
      { alimento: "Arroz", cantidad: 120 },
      { alimento: "Verduras", cantidad: 180 },
      { alimento: "Aceite de oliva", cantidad: 6 },
    ],
  },
];

const FOODS = {
  yogurt: { name: "Yogur griego descremado", unit: "g", kcal: 59, protein: 10, carbs: 3.6, fat: 0.4, category: "Proteica" },
  oats: { name: "Avena", unit: "g", kcal: 389, protein: 16.9, carbs: 66, fat: 6.9, category: "Carbohidrato" },
  strawberries: { name: "Frutillas", unit: "g", kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, category: "Fruta" },
  banana: { name: "Banana", unit: "g", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, category: "Fruta" },
  whey: { name: "Whey protein", unit: "g", kcal: 400, protein: 80, carbs: 10, fat: 6.7, category: "Proteica" },
  chicken: { name: "Pechuga de pollo", unit: "g", kcal: 165, protein: 31, carbs: 0, fat: 3.6, category: "Proteica" },
  rice: { name: "Arroz cocido", unit: "g", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, category: "Carbohidrato" },
  vegetables: { name: "Verduras mixtas", unit: "g", kcal: 30, protein: 2, carbs: 5, fat: 0.2, category: "Verdura" },
  oliveOil: { name: "Aceite de oliva", unit: "g", kcal: 900, protein: 0, carbs: 0, fat: 100, category: "Grasa" },
  bread: { name: "Pan integral", unit: "g", kcal: 250, protein: 10, carbs: 45, fat: 4, category: "Carbohidrato" },
  cheese: { name: "Queso untable light", unit: "g", kcal: 110, protein: 12, carbs: 6, fat: 4, category: "Lacteo" },
  almonds: { name: "Almendras", unit: "g", kcal: 579, protein: 21, carbs: 22, fat: 50, category: "Grasa" },
  beef: { name: "Carne magra", unit: "g", kcal: 176, protein: 26, carbs: 0, fat: 8, category: "Proteica" },
  potato: { name: "Papa", unit: "g", kcal: 77, protein: 2, carbs: 17, fat: 0.1, category: "Carbohidrato" },
  tuna: { name: "Atun al natural", unit: "g", kcal: 116, protein: 25, carbs: 0, fat: 1, category: "Proteica" },
  pasta: { name: "Pasta cocida", unit: "g", kcal: 157, protein: 5.8, carbs: 31, fat: 0.9, category: "Carbohidrato" },
  egg: { name: "Huevo", unit: "g", kcal: 143, protein: 13, carbs: 1, fat: 10, category: "Proteica" },
  lentils: { name: "Lentejas cocidas", unit: "g", kcal: 116, protein: 9, carbs: 20, fat: 0.4, category: "Carbohidrato" },
  apple: { name: "Manzana", unit: "g", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, category: "Fruta" },
};

const MENU_CONFIGS = [
  { range: [1300, 1400], proteins: [100, 120], goals: ["definicion", "saciante"], names: ["Definicion simple 1400", "Dia simple sin complicarse"] },
  { range: [1400, 1500], proteins: [100, 120, 140], goals: ["definicion", "salud"], names: ["Menu saciante economico", "Desayunos simples + cenas livianas", "Fitness clasico pollo/arroz"] },
  { range: [1500, 1600], proteins: [100, 120, 140], goals: ["recomposicion", "mantenimiento"], names: ["Recomposicion equilibrada", "Dia practico oficina", "Alto en proteina 1600"] },
  { range: [1600, 1700], proteins: [120, 140, 160], goals: ["recomposicion", "rendimiento"], names: ["Mantenimiento flexible", "Fitness clasico pollo/arroz", "Alto en proteina 1600"] },
  { range: [1700, 1800], proteins: [120, 140, 160], goals: ["mantenimiento", "rendimiento"], names: ["Dia practico oficina", "Rendimiento limpio", "Menu saciante economico"] },
  { range: [1800, 1900], proteins: [140, 160, 180], goals: ["rendimiento", "volumen limpio"], names: ["Rendimiento limpio", "Alto en proteina 1800", "Fitness clasico pollo/arroz"] },
  { range: [1900, 2000], proteins: [140, 160, 180], goals: ["rendimiento", "volumen limpio"], names: ["Mantenimiento flexible", "Dia practico oficina", "Volumen limpio moderado"] },
  { range: [2000, 2100], proteins: [160, 180, 200], goals: ["volumen limpio", "rendimiento"], names: ["Volumen limpio 2000", "Rendimiento limpio", "Alto en proteina 2000"] },
  { range: [2100, 2200], proteins: [160, 180, 200], goals: ["volumen limpio", "rendimiento"], names: ["Volumen limpio 2200", "Fitness clasico pollo/arroz", "Dia fuerte de entrenamiento"] },
  { range: [2200, 2300], proteins: [180, 200], goals: ["volumen limpio", "rendimiento"], names: ["Volumen limpio 2200", "Rendimiento limpio alto en proteina"] },
];

export const DEMO_MENUS = MENU_CONFIGS.flatMap((config) =>
  config.proteins.map((protein, index) =>
    buildMenu({
      min: config.range[0],
      max: config.range[1],
      kcal: config.range[0] + 60 + index * 15,
      protein,
      goals: config.goals,
      name: config.names[index % config.names.length],
      variant: index,
    })
  )
);

export function getDemoMenuRanges() {
  return MENU_CONFIGS.map((config) => {
    const label = `${config.range[0]}-${config.range[1]} kcal`;
    const menus = DEMO_MENUS.filter((menu) => menu.range.label === label);
    const proteins = [...new Set(menus.map((menu) => menu.protein))].sort((a, b) => a - b);
    return {
      min: config.range[0],
      max: config.range[1],
      goals: config.goals,
      label,
      menuCount: menus.length,
      proteins,
      proteinMin: proteins[0],
      proteinMax: proteins[proteins.length - 1],
    };
  });
}

export function getDemoMenusByRange(rangeLabel) {
  return DEMO_MENUS.filter((menu) => menu.range.label === rangeLabel);
}

export function getDemoMenusByProtein(rangeLabel, protein) {
  return DEMO_MENUS.filter((menu) => menu.range.label === rangeLabel && Number(menu.protein) === Number(protein));
}

function buildMenu({ min, max, kcal, protein, goals, name, variant }) {
  const meals = buildMeals({ kcal, protein, variant });
  const totals = totalMeals(meals);
  const tags = buildTags({ protein, goals, kcal, variant });

  return {
    id: `demo-menu-${min}-${max}-${protein}-${variant}`,
    demo: true,
    name,
    description: descriptionFor({ protein, goals, kcal }),
    range: { min, max, label: `${min}-${max} kcal` },
    kcal: Math.round(totals.kcal),
    protein,
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    mealsCount: meals.length,
    goals,
    tags,
    meals,
  };
}

function buildMeals({ kcal, protein, variant }) {
  const p = protein / 140;
  const k = kcal / 1700;
  const meals = [
    meal("Desayuno", [
      item("yogurt", 170 * p + 20),
      item("oats", 28 * k + 8),
      item(variant % 2 ? "banana" : "strawberries", variant % 2 ? 80 * k : 110 * k),
      ...(protein >= 160 ? [item("whey", 12 + (protein - 160) * 0.18)] : []),
    ]),
    meal("Almuerzo", [
      item(variant % 3 === 1 ? "tuna" : "chicken", 115 * p + 15),
      item(variant % 3 === 2 ? "pasta" : "rice", 145 * k + 20),
      item("vegetables", 160),
      item("oliveOil", 5 * k + 2),
    ]),
    meal("Merienda", [
      item(protein >= 160 ? "whey" : "cheese", protein >= 160 ? 18 * p : 80 * p),
      item("bread", 45 * k + 6),
      item(variant % 2 ? "apple" : "banana", 95 * k),
      ...(kcal >= 1800 ? [item("almonds", 8 * k)] : []),
    ]),
    meal("Cena", [
      item(variant % 2 ? "beef" : "chicken", 105 * p + 12),
      item(variant % 2 ? "potato" : "rice", 210 * k + 25),
      item("vegetables", 190),
      item("oliveOil", 5 * k + 2),
    ]),
  ];

  if (kcal >= 1950 || protein >= 180) {
    meals.push(
      meal("Snack", [
        item("yogurt", 110 * p),
        item("whey", 10 + (protein >= 200 ? 8 : 0)),
        item("banana", 75 * k),
      ])
    );
  }

  return tuneCalories(meals, kcal);
}

function tuneCalories(meals, targetKcal) {
  const current = totalMeals(meals);
  const diff = targetKcal - current.kcal;
  if (diff <= 45) return meals;

  const extraItems =
    diff > 260
      ? [item("rice", (diff * 0.58) / 1.3), item("almonds", (diff * 0.22) / 5.79), item("banana", (diff * 0.2) / 0.89)]
      : diff > 130
        ? [item("rice", (diff * 0.7) / 1.3), item("banana", (diff * 0.3) / 0.89)]
        : [item("banana", diff / 0.89)];

  const index = meals.findIndex((mealItem) => mealItem.name === "Merienda");
  const next = meals.map((mealItem, mealIndex) => {
    if (mealIndex !== index) return mealItem;
    return meal(mealItem.name, [...mealItem.foods, ...extraItems]);
  });

  return next;
}

function item(key, rawQty) {
  const food = FOODS[key];
  const cantidad = Math.max(1, Math.round(rawQty));
  const factor = cantidad / 100;
  return {
    name: food.name,
    amount: `${cantidad} ${food.unit}`,
    cantidad,
    unidad: food.unit,
    kcal: round(food.kcal * factor),
    protein: round(food.protein * factor),
    carbs: round(food.carbs * factor),
    fat: round(food.fat * factor),
    category: food.category,
  };
}

function meal(name, foods) {
  const totals = foods.reduce(
    (acc, food) => ({
      kcal: acc.kcal + food.kcal,
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fat: acc.fat + food.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    name,
    kcal: round(totals.kcal),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    foods,
  };
}

function totalMeals(meals) {
  return meals.reduce(
    (acc, mealItem) => ({
      kcal: round(acc.kcal + mealItem.kcal),
      protein: round(acc.protein + mealItem.protein),
      carbs: round(acc.carbs + mealItem.carbs),
      fat: round(acc.fat + mealItem.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function buildTags({ protein, goals, kcal, variant }) {
  const tags = [protein >= 160 ? "alto en proteina" : "simple", goals[0]];
  if (kcal <= 1600) tags.push("saciante");
  if (variant % 2 === 0) tags.push("facil de preparar");
  if (variant % 3 === 1) tags.push("economico");
  if (kcal >= 2000) tags.push("volumen limpio");
  return [...new Set(tags)].slice(0, 4);
}

function descriptionFor({ protein, goals, kcal }) {
  if (kcal >= 2000) return "Plan pensado para entrenamientos fuertes, con carbohidratos claros y proteina alta.";
  if (protein >= 160) return "Distribucion alta en proteina con comidas simples para sostener adherencia.";
  if (goals.includes("definicion")) return "Menu liviano y saciante para definicion sin cocinar demasiado.";
  return "Menu equilibrado para recomposicion, mantenimiento o dias de oficina.";
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
