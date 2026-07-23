export const COACH_PROFESSIONAL_PLAN_OPTIONS = Object.freeze([
  Object.freeze({ value: "coach_initial", label: "Inicial" }),
  Object.freeze({ value: "coach_pro", label: "Pro" }),
  Object.freeze({ value: "coach_ai", label: "VIP" }),
]);

function token(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

export function normalizeCoachProfessionalPlan(value = "") {
  const plan = token(value);
  if (["coach_initial", "initial", "inicial", "trial", "trial_pro", "free"].includes(plan)) {
    return "coach_initial";
  }
  if (["coach_pro", "pro", "premium", "plus"].includes(plan)) return "coach_pro";
  if (["coach_ai", "coach_vip", "vip", "premium2"].includes(plan)) return "coach_ai";
  return null;
}

export function coachProfessionalPlanFromUser(user = {}) {
  return (
    normalizeCoachProfessionalPlan(
      user?.coachSubscription?.plan ||
      user?.effectiveCapabilities?.professionalSubscription?.plan ||
      user?.professionalPlan ||
      user?.effectiveCapabilities?.planCode ||
      user?.plan
    ) || "coach_initial"
  );
}

export function coachProfessionalPlanLabel(value = "") {
  const plan = normalizeCoachProfessionalPlan(value);
  if (plan === "coach_ai") return "VIP";
  if (plan === "coach_pro") return "Pro";
  return "Inicial";
}

export function coachProfessionalPlanSummary(value = "") {
  const plan = normalizeCoachProfessionalPlan(value);
  if (plan === "coach_ai") return "Plan profesional avanzado con acceso a toda la biblioteca, incluidas las plantillas premium.";
  if (plan === "coach_pro") return "Plan profesional con acceso a la biblioteca global basic/pro de ZumaFit.";
  return "Plan básico para coaches que trabajan con sus propios menús y comidas.";
}

export function legacyCoachPlanCode(value = "") {
  const plan = normalizeCoachProfessionalPlan(value);
  if (plan === "coach_ai") return "vip";
  if (plan === "coach_pro") return "pro";
  if (plan === "coach_initial") return "trial_pro";
  return null;
}

export function coachTrialState(user = {}, now = new Date()) {
  const status = token(user?.subscription?.status || user?.coachSubscription?.status);
  const isTrial = ["trial", "trialing"].includes(status);
  const endsAt =
    user?.effectiveCapabilities?.trialEndsAt ||
    user?.coachOverrides?.trialEndsAt ||
    user?.subscription?.trialEndsAt ||
    user?.coachWelcome?.trialEndsAt ||
    null;
  const endDate = endsAt ? new Date(endsAt) : null;
  const hasValidEnd = endDate && Number.isFinite(endDate.getTime());
  const expired = isTrial && !!hasValidEnd && endDate.getTime() < now.getTime();

  return {
    isTrial,
    status: isTrial ? (expired ? "expired" : "active") : "not_applicable",
    endsAt: hasValidEnd ? endDate : null,
    expired,
  };
}

export function clientPlanLabel(value = "") {
  const plan = token(value);
  if (["premium2", "vip"].includes(plan)) return "VIP";
  if (["premium", "pro", "plus"].includes(plan)) return "Pro";
  return "Free";
}
