// src/Rutinas.jsx
import React, { useMemo, useState } from "react";

const CSS = `
.r-wrap{ min-height: calc(100dvh - 56px); background:#0b0b0b; color:#eaeaea; padding:14px 16px 28px; }
.r-inner{ max-width: 1100px; margin:0 auto; display:grid; gap:12px; }
.r-title{ font-size:22px; font-weight:900; margin:0; }
.r-sub{ margin:0; color:#bdbdbd; }
.r-card{ border:1px solid #232323; background: linear-gradient(180deg,#141414,#0f0f0f); border-radius:16px; padding:14px; box-shadow:0 16px 48px rgba(0,0,0,.35); }
.r-toolbar{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between; }
.r-search{
  flex: 1;
  min-width: 240px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #2b2b2b;
  background: #0f0f0f;
  color: #fff;
  outline:none;
}
.r-search:focus{ border-color:#f5d76e; box-shadow:0 0 0 3px rgba(245,215,110,.12); }
.r-grid{ display:grid; grid-template-columns: 1fr; gap:10px; }
.r-item{ border:1px solid #2b2b2b; background:#0f0f0f; border-radius:14px; padding:12px; display:grid; gap:8px; }
.r-top{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.r-name{ font-weight:900; margin:0; }
.r-tag{ font-size:12px; font-weight:900; padding:6px 10px; border-radius:999px; border:1px solid #3a3000; background:#1a1300; color:#facc15; white-space:nowrap; }
.r-list{ margin:0; padding-left:18px; color:#dcdcdc; display:grid; gap:4px; }
@media (min-width: 900px){ .r-grid{ grid-template-columns: 1fr 1fr; } }
`;

const MOCK = [
  {
    name: "Full Body 30’",
    tag: "3× semana",
    items: ["Sentadillas 3×12", "Flexiones 3×10", "Remo con mancuerna 3×12", "Plancha 3×40s"],
  },
  {
    name: "Pierna + Glúteo",
    tag: "Fuerza",
    items: ["Prensa 4×10", "Peso muerto rumano 3×10", "Hip thrust 4×8", "Gemelos 3×15"],
  },
  {
    name: "Push (Pecho/Hombro/Tríceps)",
    tag: "Hipertrofia",
    items: ["Press banca 4×8", "Press militar 3×10", "Fondos 3×8", "Extensión tríceps 3×12"],
  },
  {
    name: "Cardio + Core",
    tag: "20–30’",
    items: ["Caminata rápida 20’", "Mountain climbers 3×30s", "Crunch 3×15", "Estiramientos 5’"],
  },
];

export default function Rutinas() {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return MOCK;
    return MOCK.filter((x) => x.name.toLowerCase().includes(s) || x.items.join(" ").toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="r-wrap">
      <style>{CSS}</style>

      <div className="r-inner">
        <div>
          <h1 className="r-title">🏋️ Rutinas</h1>
          <p className="r-sub">Plantillas iniciales (después las conectamos a tu backend).</p>
        </div>

        <div className="r-card">
          <div className="r-toolbar">
            <input
              className="r-search"
              placeholder="Buscar ejercicio o rutina…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span style={{ color: "#bdbdbd", fontWeight: 900, fontSize: 12 }}>
              {list.length} rutina{list.length === 1 ? "" : "s"}
            </span>
          </div>

          <div style={{ height: 12 }} />

          <div className="r-grid">
            {list.map((r, idx) => (
              <div className="r-item" key={idx}>
                <div className="r-top">
                  <p className="r-name">{r.name}</p>
                  <span className="r-tag">{r.tag}</span>
                </div>
                <ul className="r-list">
                  {r.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
