const DAY_MS = 24 * 60 * 60 * 1000;

export function homeTrialDaysRemaining(trial, now = new Date()) {
  const supplied = Number(trial?.daysRemaining ?? trial?.daysLeft);
  if (Number.isFinite(supplied)) return Math.max(0, Math.ceil(supplied));

  const endsAt = new Date(trial?.endsAt || "");
  const current = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(endsAt.getTime()) || !Number.isFinite(current.getTime())) return null;

  return Math.max(0, Math.ceil((endsAt.getTime() - current.getTime()) / DAY_MS));
}

export function shouldShowHomeTrialReminder(trial, now = new Date(), thresholdDays = 3) {
  if (trial?.active !== true) return false;
  const daysRemaining = homeTrialDaysRemaining(trial, now);
  return daysRemaining !== null && daysRemaining <= thresholdDays;
}
