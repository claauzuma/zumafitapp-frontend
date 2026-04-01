// src/InicioEntrenado.jsx
import React, { useMemo } from "react";
import { getCachedUser } from "../authCache"; // ✅ ojo el path (si InicioEntrenado.jsx está en src/)

const CSS = `
*{ box-sizing:border-box; }

html, body, #root{
  margin:0;
  padding:0;
  width:100%;
}

.wrap{
  color:#eaeaea;
  width:100%;
  max-width:none;   /* antes: 1200px */
  margin:0;         /* antes: 0 auto */
  padding:0;        /* sin padding */
}

.card{
  border:1px solid #232323;
  background: linear-gradient(180deg,#141414,#0f0f0f);
  border-radius:16px;
  padding:14px;
}

.h1{
  font-size: 26px;
  font-weight: 900;
  margin: 0 0 8px;
  line-height: 1.1;
}

.p{
  margin:0;
  color:#cfcfcf;
}

.grid{
  margin-top: 14px;
  display:grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

@media (min-width: 900px){
  .grid{
    grid-template-columns: 1fr 1fr;
  }
}

.badge{
  display:inline-flex;
  align-items:center;
  gap:8px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  padding:8px 10px;
  border-radius: 999px;
  font-weight:900;
  color:#f5d76e;
  font-size: 12px;
}

.kicker{
  margin-top: 10px;
  color:#f5d76e;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: .06em;
  text-transform: uppercase;
}
`;

// Helpers
function titleCaseFirstName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  const first = s.split(/\s+/)[0]; // ✅ primera palabra
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function getSaludo(genero) {
  const g = String(genero || "").toLowerCase();
  if (g === "masculino" || g === "hombre" || g === "m") return "Bienvenido";
  if (g === "femenino" || g === "mujer" || g === "f") return "Bienvenida";
  return "Bienvenido/a";
}

export default function InicioEntrenado() {
  const user = useMemo(() => getCachedUser(), []);

  const genero = user?.profile?.genero || user?.genero;

  // ✅ prioriza profile.nombre, y si no existe usa user.nombre
  // (si guardás nombre+apellido en profile.nombre, esto deja solo el primer nombre)
  const nombre = titleCaseFirstName(user?.profile?.nombre || user?.nombre || "");

  const titulo = nombre ? `${getSaludo(genero)}, ${nombre}` : getSaludo(genero);

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <div className="card">
        <div className="badge">✅ Sesión activa</div>

        <div className="kicker">Inicio</div>
        <h1 className="h1">{titulo}</h1>

        <p className="p">
          Acá vas a ver un resumen rápido y accesos a tus secciones.
        </p>
      </div>

      <div className="grid">
        <div className="card">
          <strong>🍽️ Menú</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Generá o ajustá comidas según tus objetivos.
          </p>
        </div>

        <div className="card">
          <strong>🏋️ Rutina</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Tu entrenamiento del día / semana.
          </p>
        </div>

        <div className="card">
          <strong>📈 Progresos</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Medidas, fotos, rendimiento, constancia.
          </p>
        </div>

        <div className="card">
          <strong>👤 Perfil / ⚙️ Ajustes</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Preferencias, metas y datos personales.
          </p>
        </div>
      </div>
    </div>
  );
}
