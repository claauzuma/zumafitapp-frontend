export const ROLE_ADMIN = "admin";
export const ROLE_CLIENTE = "cliente";
export const ROLE_ENTRENADOR = "entrenador";
export const ROLE_NUTRICIONISTA = "nutricionista";
export const ROLE_ENTRENADOR_NUTRICIONISTA = "entrenador_nutricionista";

export function isProfessionalRole(role) {
  return [
    ROLE_ENTRENADOR,
    ROLE_NUTRICIONISTA,
    ROLE_ENTRENADOR_NUTRICIONISTA,
  ].includes(role);
}

export function canTraining(role) {
  return [
    ROLE_ENTRENADOR,
    ROLE_ENTRENADOR_NUTRICIONISTA,
  ].includes(role);
}

export function canNutrition(role) {
  return [
    ROLE_NUTRICIONISTA,
    ROLE_ENTRENADOR_NUTRICIONISTA,
  ].includes(role);
}