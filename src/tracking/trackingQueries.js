import { useMutation, useQuery } from "@tanstack/react-query";

import { buildMenuItemSnapshot, getFoodImageUrl } from "../nutricion/nutricionUtils.js";
import { STALE_TIMES, invalidateTrackingDay, queryClient, queryKeys } from "../queryClient.js";
import {
  addFoodLog,
  deleteFoodLog,
  deleteTrackingMeal,
  getMenuTrackingWeek,
  getTrackingDay,
  updateFoodLog,
  updateTrackingMealsConfig,
} from "./trackingApi.js";

export function useTrackingDay(date) {
  return useQuery({
    queryKey: queryKeys.trackingDay(date),
    queryFn: () => getTrackingDay(date),
    enabled: Boolean(date),
    staleTime: STALE_TIMES.trackingDay,
  });
}

export function useMenuTrackingWeek(start) {
  return useQuery({
    queryKey: ["menuTrackingWeek", start],
    queryFn: () => getMenuTrackingWeek(start),
    enabled: Boolean(start),
    staleTime: STALE_TIMES.trackingDay,
  });
}

export function useAddFoodLog() {
  return useMutation({
    mutationFn: addFoodLog,
    onMutate: async (variables) => {
      const date = variables?.date;
      if (!date) return null;

      const queryKey = queryKeys.trackingDay(date);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimisticLog = buildOptimisticLog(variables);

      queryClient.setQueryData(queryKey, (current) => {
        const day = current || emptyTrackingDay(date);
        const mealType = variables?.mealType || "snack";
        const mealId = variables?.mealId || mealType;
        const meals = { ...(day.meals || {}) };
        meals[mealId] = [...(meals[mealId] || []), optimisticLog];
        const mealsConfig = ensureMealConfig(day.mealsConfig, {
          mealId,
          tipo: mealType,
          nombre: variables?.mealName,
        });
        return recomputeTrackingDay({ ...day, date, meals, mealsConfig });
      });

      return { date, previous };
    },
    onError: (_error, _variables, context) => {
      restoreTrackingDay(context);
    },
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}

export function useUpdateTrackingMealsConfig() {
  return useMutation({
    mutationFn: updateTrackingMealsConfig,
    onMutate: async (variables) => {
      const date = variables?.date;
      if (!date) return null;

      const queryKey = queryKeys.trackingDay(date);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (current) => {
        const day = current || emptyTrackingDay(date);
        const mealsConfig = normalizeOptimisticMealsConfig(variables?.mealsConfig || variables?.meals || []);
        const meals = {};
        mealsConfig.forEach((meal) => {
          meals[meal.mealId] = Array.isArray(day.meals?.[meal.mealId]) ? day.meals[meal.mealId] : [];
        });
        Object.entries(day.meals || {}).forEach(([mealId, items]) => {
          if (Array.isArray(items) && items.length && !meals[mealId]) meals[mealId] = items;
        });
        return recomputeTrackingDay({ ...day, date, mealsConfig, meals });
      });

      return { date, previous };
    },
    onError: (_error, _variables, context) => {
      restoreTrackingDay(context);
    },
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}

export function useDeleteTrackingMeal() {
  return useMutation({
    mutationFn: ({ mealId, ...payload }) => deleteTrackingMeal(mealId, payload),
    onMutate: async (variables) => {
      const date = variables?.date;
      const mealId = variables?.mealId;
      if (!date || !mealId) return null;

      const queryKey = queryKeys.trackingDay(date);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (current) => {
        if (!current) return current;
        const meals = { ...(current.meals || {}) };
        delete meals[mealId];
        const mealsConfig = (current.mealsConfig || []).filter((meal) => meal.mealId !== mealId && meal.id !== mealId);
        return recomputeTrackingDay({ ...current, meals, mealsConfig });
      });

      return { date, previous };
    },
    onError: (_error, _variables, context) => {
      restoreTrackingDay(context);
    },
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}

export function useUpdateFoodLog() {
  return useMutation({
    mutationFn: ({ logId, ...payload }) => updateFoodLog(logId, payload),
    onMutate: async (variables) => {
      const date = variables?.date;
      if (!date || !variables?.logId) return null;

      const queryKey = queryKeys.trackingDay(date);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (current) => {
        if (!current?.meals) return current;
        const next = moveAndScaleLog(current, variables);
        return recomputeTrackingDay(next);
      });

      return { date, previous };
    },
    onError: (_error, _variables, context) => {
      restoreTrackingDay(context);
    },
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}

export function useDeleteFoodLog() {
  return useMutation({
    mutationFn: ({ logId }) => deleteFoodLog(logId),
    onMutate: async (variables) => {
      const date = variables?.date;
      if (!date || !variables?.logId) return null;

      const queryKey = queryKeys.trackingDay(date);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (current) => {
        if (!current?.meals) return current;
        const meals = Object.fromEntries(
          Object.entries(current.meals || {}).map(([mealType, items]) => [
            mealType,
            (items || []).filter((item) => !sameLog(item, variables.logId)),
          ])
        );
        return recomputeTrackingDay({ ...current, meals });
      });

      return { date, previous };
    },
    onError: (_error, _variables, context) => {
      restoreTrackingDay(context);
    },
    onSuccess: async (data, variables) => {
      const date = data?.date || variables?.date;
      if (date) queryClient.setQueryData(queryKeys.trackingDay(date), data);
      await invalidateTrackingDay(date);
    },
  });
}

function restoreTrackingDay(context) {
  if (!context?.date) return;
  queryClient.setQueryData(queryKeys.trackingDay(context.date), context.previous);
}

function emptyTrackingDay(date) {
  return {
    date,
    objetivo: null,
    objetivoSource: "",
    totals: emptyTotals(),
    remaining: null,
    planificado: null,
    mealsConfig: [],
    meals: {},
  };
}

function buildOptimisticLog(variables = {}) {
  const food = variables.food || {};
  const cantidad = toNumber(variables.cantidad, 100);
  const unidad = variables.unidad || food.unidad || food.unit || "g";
  const snapshot = buildMenuItemSnapshot(food, cantidad, unidad);
  const now = new Date().toISOString();
  const mealType = variables.mealType || "snack";
  const mealId = variables.mealId || mealType;
  const id = `optimistic-${variables.date || "day"}-${mealId || "meal"}-${now}-${Math.random()
    .toString(36)
    .slice(2)}`;

  return {
    id,
    _id: id,
    date: variables.date,
    mealType,
    mealId,
    alimentoId: snapshot.alimentoId || food.alimentoId || food.id || food._id || null,
    nombreSnapshot: snapshot.nombreSnapshot || food.nombre || food.name || "Alimento",
    cantidad: snapshot.cantidad,
    unidad: snapshot.unidad || unidad,
    kcal: snapshot.kcal || 0,
    proteina: snapshot.proteina || 0,
    carbs: snapshot.carbs || 0,
    grasas: snapshot.grasas || 0,
    fuente: food.fuente || food.source || "",
    categoriaSnapshot: snapshot.categoriaSnapshot || food.categoria || food.macroGroup || "",
    imagen: snapshot.imagen || food.imagen || null,
    imagenUrl: snapshot.imagenUrl || getFoodImageUrl(food),
    optimistic: true,
    createdAt: now,
    updatedAt: now,
  };
}

function moveAndScaleLog(day, variables = {}) {
  let updatedLog = null;
  const sourceMeals = day.meals || {};
  const meals = {};

  Object.entries(sourceMeals).forEach(([mealId, items]) => {
    meals[mealId] = [];
    (items || []).forEach((item) => {
      if (sameLog(item, variables.logId)) {
        updatedLog = scaleLog(item, variables);
      } else {
        meals[mealId].push(item);
      }
    });
  });

  if (updatedLog) {
    const nextMealType = variables.mealType || updatedLog.mealType || "snack";
    const nextMealId = variables.mealId || updatedLog.mealId || nextMealType;
    updatedLog.mealType = nextMealType;
    updatedLog.mealId = nextMealId;
    meals[nextMealId] = [...(meals[nextMealId] || []), updatedLog];
  }

  return { ...day, meals };
}

function normalizeOptimisticMealsConfig(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((meal, index) => ({
      mealId: String(meal.mealId || meal.id || `meal_${index}`),
      tipo: meal.tipo || meal.type || meal.mealType || "snack",
      nombre: meal.nombre || meal.label || "Comida",
      orden: Number.isFinite(Number(meal.orden ?? meal.order)) ? Number(meal.orden ?? meal.order) : index,
      meta: meal.meta || meal.target || null,
    }))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map((meal, index) => ({ ...meal, orden: index }));
}

function ensureMealConfig(current = [], meal = {}) {
  const mealId = String(meal.mealId || meal.id || meal.tipo || meal.type || "snack");
  const exists = (current || []).some((item) => String(item.mealId || item.id) === mealId);
  if (exists) return current;
  return [
    ...(current || []),
    {
      mealId,
      tipo: meal.tipo || meal.type || "snack",
      nombre: meal.nombre || meal.label || "Comida",
      orden: Array.isArray(current) ? current.length : 0,
      meta: null,
    },
  ];
}

function scaleLog(item = {}, variables = {}) {
  const nextQuantity = Math.max(0, toNumber(variables.cantidad, item.cantidad || 0));
  const previousQuantity = toNumber(item.cantidad, 0);
  const factor = previousQuantity > 0 ? nextQuantity / previousQuantity : 1;

  return {
    ...item,
    cantidad: nextQuantity,
    unidad: variables.unidad || item.unidad || "g",
    kcal: round((item.kcal || 0) * factor),
    proteina: round((item.proteina || 0) * factor),
    carbs: round((item.carbs || 0) * factor),
    grasas: round((item.grasas || 0) * factor),
    optimistic: true,
    updatedAt: new Date().toISOString(),
  };
}

function recomputeTrackingDay(day = {}) {
  const totals = Object.values(day.meals || {})
    .flatMap((items) => (Array.isArray(items) ? items : []))
    .reduce(
      (acc, item) =>
        addTotals(acc, {
          kcal: item.kcal,
          proteina: item.proteina,
          carbs: item.carbs,
          grasas: item.grasas,
        }),
      emptyTotals()
    );

  return {
    ...day,
    totals,
    remaining: remainingTotals(day.objetivo, totals),
  };
}

function sameLog(item = {}, logId = "") {
  const id = String(logId || "");
  return String(item.id || "") === id || String(item._id || "") === id;
}

function emptyTotals() {
  return { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };
}

function addTotals(a = {}, b = {}) {
  return {
    kcal: round((a.kcal || 0) + (b.kcal || 0)),
    proteina: round((a.proteina || 0) + (b.proteina || 0)),
    carbs: round((a.carbs || 0) + (b.carbs || 0)),
    grasas: round((a.grasas || 0) + (b.grasas || 0)),
  };
}

function remainingTotals(objective, totals) {
  if (!objective) return null;
  return {
    kcal: round((objective.kcal || 0) - (totals.kcal || 0)),
    proteina: round((objective.proteina || 0) - (totals.proteina || 0)),
    carbs: round((objective.carbs || 0) - (totals.carbs || 0)),
    grasas: round((objective.grasas || 0) - (totals.grasas || 0)),
  };
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
