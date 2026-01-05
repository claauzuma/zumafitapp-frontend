// src/InicioEntrenado.jsx
import React from "react";

const CSS = `
.wrap{
  padding: 16px;
  color:#eaeaea;
  max-width: 1100px;
  margin: 0 auto;
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
  .grid{ grid-template-columns: 1fr 1fr; }
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
`;

export default function InicioEntrenado() {
  return (
    <div className="wrap">
      <style>{CSS}</style>

      <div className="card">
        <div className="badge">✅ Sesión activa</div>
        <h1 className="h1" style={{ marginTop: 10 }}>Inicio</h1>
        <p className="p">
          Acá vas a ver un resumen rápido y accesos a tus secciones.
        </p>
      </div>

      <div className="grid">
        <div className="card">
          <strong>🍽️ Menú</strong>
          <p className="p" style={{ marginTop: 6 }}>Generá o ajustá comidas según tus objetivos.</p>
        </div>
        <div className="card">
          <strong>🏋️ Rutina</strong>
          <p className="p" style={{ marginTop: 6 }}>Tu entrenamiento del día / semana.</p>
        </div>
        <div className="card">
          <strong>📈 Progresos</strong>
          <p className="p" style={{ marginTop: 6 }}>Medidas, fotos, rendimiento, constancia.</p>
        </div>
        <div className="card">
          <strong>👤 Perfil / ⚙️ Ajustes</strong>
          <p className="p" style={{ marginTop: 6 }}>Preferencias, metas y datos personales.</p>
        </div>
      </div>
    </div>
  );
}
