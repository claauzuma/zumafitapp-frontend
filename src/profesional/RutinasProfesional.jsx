import React from "react";
import { useOutletContext } from "react-router-dom";

import RutinasWorkspace from "../rutinas/RutinasWorkspace.jsx";

export default function RutinasProfesional() {
  const { me } = useOutletContext() || {};
  const allowed = canUseRoutines(me);

  if (!allowed) {
    return (
      <div className="pp-wrap">
        <div className="pp-card locked">
          <div className="pp-kicker">Rutinas</div>
          <h1 className="pp-title">Modulo no disponible</h1>
          <p className="pp-text">
            Este acceso requiere especialidad de entrenamiento y permisos activos de rutinas.
          </p>
        </div>
      </div>
    );
  }

  return <RutinasWorkspace mode="coach" me={me} />;
}

function canUseRoutines(user) {
  const specialties = user?.coachProfile?.specialties || {};
  const features = user?.effectiveCapabilities?.features || {};
  if (!specialties.training) return false;
  if (!user?.effectiveCapabilities) return true;
  if (user?.effectiveCapabilities?.isTrialExpired) return false;
  return Object.values(features?.routines || {}).some(Boolean);
}
