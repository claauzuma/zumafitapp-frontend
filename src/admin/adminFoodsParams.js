export function buildAdminFoodsQuery(filters = {}) {
  const params = new URLSearchParams();
  const values = {
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 40,
    search: String(filters.search || "").trim(),
    category: String(filters.category || "todos").trim(),
    unit: String(filters.unit || "todos").trim(),
    status: String(filters.status || "todos").trim(),
    sort: String(filters.sort || "nombre_asc").trim(),
    mode: String(filters.mode || "todos").trim(),
    role: String(filters.role || "todos").trim(),
    mealType: String(filters.mealType || "todos").trim(),
  };

  Object.entries(values).forEach(([key, value]) => {
    if (value === "" || value === "todos") return;
    params.set(key, String(value));
  });

  return params.toString();
}
