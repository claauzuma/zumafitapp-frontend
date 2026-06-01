export const DEMO_COMIDAS = [
  {
    id: "demo-desayuno-proteico",
    demo: true,
    nombre: "Desayuno proteico simple",
    type: "Desayuno",
    tags: ["alto en proteína", "rápido"],
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
    tags: ["económico", "meal prep"],
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
    tags: ["saciante", "clásica"],
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
    nombre: "Snack alto en proteína",
    type: "Snack",
    tags: ["alto en proteína", "portátil"],
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

const BASE_MEALS_100 = [
  {
    name: "Desayuno",
    kcal: 340,
    protein: 27,
    carbs: 42,
    fat: 7,
    foods: [
      { name: "Yogur griego descremado", amount: "220 g" },
      { name: "Avena", amount: "35 g" },
      { name: "Frutillas", amount: "100 g" },
    ],
  },
  {
    name: "Almuerzo",
    kcal: 450,
    protein: 33,
    carbs: 58,
    fat: 10,
    foods: [
      { name: "Pechuga de pollo", amount: "120 g" },
      { name: "Arroz cocido", amount: "180 g" },
      { name: "Ensalada verde", amount: "180 g" },
    ],
  },
  {
    name: "Merienda",
    kcal: 260,
    protein: 20,
    carbs: 32,
    fat: 6,
    foods: [
      { name: "Queso untable light", amount: "70 g" },
      { name: "Pan integral", amount: "60 g" },
      { name: "Manzana", amount: "1 unidad" },
    ],
  },
  {
    name: "Cena",
    kcal: 430,
    protein: 31,
    carbs: 45,
    fat: 13,
    foods: [
      { name: "Carne magra", amount: "120 g" },
      { name: "Papa", amount: "230 g" },
      { name: "Verduras al horno", amount: "180 g" },
    ],
  },
];

const BASE_MEALS_180 = [
  {
    name: "Desayuno",
    kcal: 470,
    protein: 48,
    carbs: 44,
    fat: 11,
    foods: [
      { name: "Claras y huevo", amount: "250 g" },
      { name: "Avena", amount: "45 g" },
      { name: "Banana", amount: "80 g" },
    ],
  },
  {
    name: "Almuerzo",
    kcal: 650,
    protein: 58,
    carbs: 70,
    fat: 15,
    foods: [
      { name: "Pechuga de pollo", amount: "200 g" },
      { name: "Arroz cocido", amount: "240 g" },
      { name: "Aceite de oliva", amount: "8 g" },
      { name: "Verduras", amount: "180 g" },
    ],
  },
  {
    name: "Merienda",
    kcal: 390,
    protein: 39,
    carbs: 38,
    fat: 8,
    foods: [
      { name: "Whey protein", amount: "30 g" },
      { name: "Yogur griego", amount: "180 g" },
      { name: "Fruta", amount: "120 g" },
    ],
  },
  {
    name: "Cena",
    kcal: 600,
    protein: 50,
    carbs: 56,
    fat: 18,
    foods: [
      { name: "Pescado blanco", amount: "220 g" },
      { name: "Papa o batata", amount: "260 g" },
      { name: "Ensalada completa", amount: "220 g" },
    ],
  },
];

const RANGE_CONFIG = [
  { min: 1300, max: 1400, goals: ["definición", "recomposición"], kcal100: 1360, kcal180: 1380 },
  { min: 1400, max: 1500, goals: ["definición", "salud"], kcal100: 1460, kcal180: 1490 },
  { min: 1500, max: 1600, goals: ["recomposición", "mantenimiento"], kcal100: 1560, kcal180: 1590 },
  { min: 1600, max: 1700, goals: ["mantenimiento", "rendimiento"], kcal100: 1660, kcal180: 1690 },
  { min: 1800, max: 1900, goals: ["volumen limpio", "rendimiento"], kcal100: 1860, kcal180: 1890 },
];

export const DEMO_MENUS = RANGE_CONFIG.flatMap((range) => [
  buildMenu(range, 100, range.kcal100, BASE_MEALS_100, ["simple", "moderado", range.goals[0]]),
  buildMenu(range, 180, range.kcal180, BASE_MEALS_180, ["alto en proteína", "entrenamiento", range.goals[1]]),
]);

function buildMenu(range, protein, kcal, meals, tags) {
  const proteinScale = protein / meals.reduce((acc, meal) => acc + meal.protein, 0);
  const fat = Math.max(35, Math.round(kcal * 0.27 / 9));
  const carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    id: `demo-menu-${range.min}-${range.max}-${protein}`,
    demo: true,
    name: `${range.min}-${range.max} kcal / ${protein} g proteína`,
    description: protein >= 180 ? "Distribución alta en proteína para días de entrenamiento." : "Menú simple con comidas fáciles de sostener.",
    range: { min: range.min, max: range.max, label: `${range.min}-${range.max} kcal` },
    kcal,
    protein,
    carbs,
    fat,
    mealsCount: meals.length,
    goals: range.goals,
    tags,
    meals: meals.map((meal, index) => ({
      ...meal,
      protein: Math.round(meal.protein * proteinScale),
      order: index + 1,
    })),
  };
}

export function getDemoMenuRanges() {
  return RANGE_CONFIG.map((range) => {
    const menus = DEMO_MENUS.filter((menu) => menu.range.min === range.min && menu.range.max === range.max);
    const proteins = [...new Set(menus.map((menu) => menu.protein))].sort((a, b) => a - b);
    return {
      ...range,
      label: `${range.min}-${range.max} kcal`,
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
