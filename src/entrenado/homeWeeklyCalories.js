const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCalories(value) {
  return Math.max(0, Math.round(finiteNumber(value)));
}

function localDateFromKey(dateKey = "") {
  const match = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(dateKey, amount) {
  const date = localDateFromKey(dateKey);
  if (!date) return "";
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function readCalories(value = {}) {
  const source = value?.totals || value?.totales || value?.nutrition || value || {};
  return roundCalories(source.kcal ?? source.calories ?? source.calorias ?? source.cal);
}

function targetCalories(row = {}, fallback = 0) {
  return readCalories(row?.target || row?.objetivo || {}) || roundCalories(fallback);
}

function consumedCalories(row = {}) {
  return readCalories(row?.tracking?.consumedTotals || row?.tracking?.totals || {});
}

function dayTone(row, date, todayDateKey) {
  const status = String(row?.tracking?.status || "pending").toLowerCase();
  if (date <= todayDateKey && status === "completed") return "complete";
  if (date < todayDateKey) return "missed";
  return "pending";
}

export function buildWeeklyCalorieSummary({
  rows = [],
  weekStart,
  todayDateKey,
  fallbackTargetKcal = 0,
} = {}) {
  const byDate = new Map(
    (Array.isArray(rows) ? rows : [])
      .filter((row) => row?.date)
      .map((row) => [String(row.date), row])
  );

  const days = DAY_LABELS.map((label, index) => {
    const date = addDays(weekStart, index);
    const row = byDate.get(date) || null;
    const consumedKcal = consumedCalories(row || {});
    const targetKcal = targetCalories(row || {}, fallbackTargetKcal);
    const tone = dayTone(row, date, todayDateKey);
    const isProjected = tone === "pending" && consumedKcal <= 0 && targetKcal > 0;
    const chartKcal = targetKcal || consumedKcal;
    const statusLabel = tone === "complete"
      ? "cumplido"
      : tone === "missed"
        ? "no cumplido"
        : date === todayDateKey
          ? "pendiente hoy"
          : "pendiente";

    return {
      date,
      label,
      row,
      tone,
      statusLabel,
      isToday: date === todayDateKey,
      isProjected,
      consumedKcal,
      targetKcal,
      chartKcal,
    };
  });

  const scaleMax = Math.max(
    1,
    roundCalories(fallbackTargetKcal),
    ...days.map((day) => Math.max(day.chartKcal, day.targetKcal))
  );
  const targeted = days.filter((day) => day.targetKcal > 0);
  const averageTargetKcal = targeted.length
    ? Math.round(targeted.reduce((sum, day) => sum + day.targetKcal, 0) / targeted.length)
    : 0;

  return {
    days: days.map((day) => ({
      ...day,
      heightPercent: day.chartKcal > 0
        ? Math.max(8, Math.min(100, Math.round((day.chartKcal / scaleMax) * 100)))
        : 4,
    })),
    averageKcal: averageTargetKcal,
    averageTargetKcal,
    scaleMax,
    recordedDays: days.filter((day) => day.date <= todayDateKey && day.consumedKcal > 0).length,
    targetDays: targeted.length,
  };
}
