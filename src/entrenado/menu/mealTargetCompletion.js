export const MEAL_TARGET_KCAL_TOLERANCE = 10;

export function isMealTargetCalorieComplete({
  targetKcal = 0,
  consumedKcal = 0,
  trackedItemsCount = 0,
  tolerance = MEAL_TARGET_KCAL_TOLERANCE,
} = {}) {
  const target = Number(targetKcal);
  const consumed = Number(consumedKcal);
  const allowedDifference = Math.max(0, Number(tolerance) || 0);

  if (!(target > 0) || !Number.isFinite(consumed) || !(Number(trackedItemsCount) > 0)) {
    return false;
  }

  return Math.abs(consumed - target) <= allowedDifference;
}
