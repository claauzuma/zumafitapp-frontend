import { coachProfessionalPlanLabel } from "../professionalPlans.js";

export function fullName(user) {
  const nombre = String(user?.profile?.nombre || "").trim();
  const apellido = String(user?.profile?.apellido || "").trim();
  return `${nombre} ${apellido}`.trim() || "Sin nombre";
}

export function initials(user) {
  const nombre = String(user?.profile?.nombre || "").trim();
  const apellido = String(user?.profile?.apellido || "").trim();
  const a = nombre[0] || "Z";
  const b = apellido[0] || "F";
  return `${a}${b}`.toUpperCase();
}

export function avatarUrl(user) {
  return (
    user?.profile?.avatarUrl ||
    user?.profile?.foto ||
    user?.profile?.avatar ||
    user?.avatarUrl ||
    user?.avatar ||
    ""
  );
}

export function planLabel(plan) {
  return coachProfessionalPlanLabel(plan);
}

export function specialtyLabel(user) {
  const training = !!user?.coachProfile?.specialties?.training;
  const nutrition = !!user?.coachProfile?.specialties?.nutrition;
  if (training && nutrition) return "Entrenamiento + Nutrición";
  if (training) return "Entrenamiento";
  if (nutrition) return "Nutrición";
  return "Sin especialidad";
}

export function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtKcal(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)} kcal` : String(value);
}

export function goalLabel(goalType) {
  if (!goalType) return "-";
  if (goalType === "perder_peso") return "Pérdida de grasa";
  if (goalType === "ganar_peso") return "Ganancia muscular";
  if (goalType === "mantener_peso") return "Mantenimiento";
  return String(goalType);
}

export function capacityLabel(user) {
  const effective = user?.effectiveCapabilities || {};
  const current = effective?.currentClients ?? user?.coachStats?.currentClients ?? 0;
  const max = effective?.maxClients ?? "sin límite";
  if (effective?.isTrialExpired) return `${current}/${max} - prueba vencida`;
  return `${current}/${max}`;
}
