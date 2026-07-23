import React from "react";
import { useOutletContext } from "react-router-dom";
import { coachProfessionalPlanFromUser, coachProfessionalPlanLabel } from "../professionalPlans.js";

const META = {
  clientes: {
    title: "Clientes",
    text: "La base de clientes esta conectada desde admin. Falta construir la gestion profesional directa.",
  },
  rutinas: {
    title: "Rutinas",
    text: "Modulo preparado para armador manual, biblioteca, plantillas y generador segun permisos.",
  },
  menus: {
    title: "Menus",
    text: "Modulo preparado para armador manual, bibliotecas, plantillas y generador segun permisos.",
  },
  progreso: {
    title: "Progreso",
    text: "Modulo preparado para seguimiento basico y metricas avanzadas segun plan.",
  },
  perfil: {
    title: "Perfil profesional",
    text: "Modulo preparado para datos visibles del coach y configuracion de cuenta.",
  },
};

export default function ProfesionalPlaceholder({ type }) {
  const { me } = useOutletContext() || {};
  const meta = META[type] || META.clientes;
  const allowed = isAllowed(type, me);

  return (
    <div className="pp-wrap">
      <div className={`pp-card ${allowed ? "" : "locked"}`}>
        <div className="pp-kicker">{coachProfessionalPlanLabel(coachProfessionalPlanFromUser(me))}</div>
        <h1 className="pp-title">{allowed ? meta.title : "Modulo no disponible"}</h1>
        <p className="pp-text">
          {allowed
            ? meta.text
            : "Este acceso no corresponde a la especialidad o al plan efectivo del coach."}
        </p>
        <div className="pp-grid">
          <Info label="Especialidad" value={specialtyLabel(me)} />
          <Info label="Clientes" value={capacityLabel(me)} />
          <Info
            label="Metricas avanzadas"
            value={me?.effectiveCapabilities?.features?.metrics?.advanced ? "Habilitadas" : "No habilitadas"}
          />
          <Info
            label="Exportaciones"
            value={me?.effectiveCapabilities?.features?.exports?.enabled ? "Habilitadas" : "No habilitadas"}
          />
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}

function isAllowed(type, user) {
  const specialties = user?.coachProfile?.specialties || {};
  const features = user?.effectiveCapabilities?.features || {};

  if (type === "rutinas") {
    return !!specialties.training && (!user?.effectiveCapabilities || Object.values(features?.routines || {}).some(Boolean));
  }
  if (type === "menus") {
    return !!specialties.nutrition && (!user?.effectiveCapabilities || Object.values(features?.menus || {}).some(Boolean));
  }

  return true;
}

function Info({ label, value }) {
  return (
    <div className="pp-box">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function specialtyLabel(user) {
  const training = !!user?.coachProfile?.specialties?.training;
  const nutrition = !!user?.coachProfile?.specialties?.nutrition;
  if (training && nutrition) return "Entrenamiento + Nutricion";
  if (training) return "Entrenamiento";
  if (nutrition) return "Nutricion";
  return "Sin especialidad";
}

function capacityLabel(user) {
  const effective = user?.effectiveCapabilities || {};
  const current = effective?.currentClients ?? 0;
  const max = effective?.maxClients ?? "sin limite";
  if (effective?.isTrialExpired) return `${current}/${max} - prueba vencida`;
  return `${current}/${max}`;
}

const styles = `
.pp-wrap{
  color:#eaeaea;
  min-width:0;
  width:100%;
}
.pp-card{
  min-width:0;
  border:1px solid rgba(245,215,110,.15);
  background:linear-gradient(180deg, #0e1117, #0b0f15);
  border-radius:22px;
  padding:18px;
}
.pp-card.locked{
  border-color:rgba(255,190,80,.20);
  background:linear-gradient(180deg, rgba(40,28,14,.50), #0b0f15);
}
.pp-kicker{
  display:inline-flex;
  min-height:30px;
  align-items:center;
  padding:0 10px;
  border-radius:999px;
  border:1px solid rgba(245,215,110,.18);
  background:rgba(245,215,110,.07);
  color:#f5d76e;
  font-size:12px;
  font-weight:900;
}
.pp-title{
  margin:14px 0 0;
  font-size:30px;
}
.pp-text{
  margin:8px 0 0;
  color:#b8c0cc;
  line-height:1.55;
}
.pp-grid{
  margin-top:16px;
  display:grid;
  grid-template-columns:repeat(4, minmax(0,1fr));
  gap:12px;
}
.pp-box{
  min-width:0;
  border:1px solid rgba(255,255,255,.08);
  background:#0b1016;
  border-radius:16px;
  padding:14px;
  display:flex;
  flex-direction:column;
  gap:6px;
}
.pp-box span{
  color:#97a3b4;
  font-size:12px;
  text-transform:uppercase;
  font-weight:900;
}
.pp-box strong{
  color:#f5f7fa;
  overflow-wrap:anywhere;
}
@media (max-width: 900px){
  .pp-grid{
    grid-template-columns:1fr;
  }
}
@media (max-width: 430px){
  .pp-card{
    padding:14px;
    border-radius:18px;
  }

  .pp-title{
    font-size:25px;
  }
}
`;
