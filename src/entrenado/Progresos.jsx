// src/Progresos.jsx
import React, { useMemo, useState } from "react";

const CSS = `
.g-wrap{ min-height: calc(100dvh - 56px); background:#0b0b0b; color:#eaeaea; padding:14px 16px 28px; }
.g-inner{ max-width: 1100px; margin:0 auto; display:grid; gap:12px; }
.g-title{ font-size:22px; font-weight:900; margin:0; }
.g-sub{ margin:0; color:#bdbdbd; }
.g-grid{ display:grid; grid-template-columns: 1fr; gap:10px; }
.g-card{ border:1px solid #232323; background: linear-gradient(180deg,#141414,#0f0f0f); border-radius:16px; padding:14px; box-shadow:0 16px 48px rgba(0,0,0,.35); }
.kpi-row{ display:grid; grid-template-columns: 1fr; gap:10px; }
.kpi{ border:1px solid #2b2b2b; background:#0f0f0f; border-radius:14px; padding:12px; }
.kpi b{ color:#f5d76e; }
.kpi .big{ font-size:22px; font-weight:1000; margin-top:4px; }
.table{ width:100%; border-collapse: collapse; overflow:hidden; border-radius:14px; border:1px solid #2b2b2b; }
.table th, .table td{ padding:10px 10px; text-align:left; border-bottom:1px solid #242424; font-size:13px; }
.table th{ color:#bdbdbd; font-weight:900; background:#0f0f0f; }
.table tr:last-child td{ border-bottom:none; }
.pill{ display:inline-flex; padding:6px 10px; border-radius:999px; border:1px solid #3a3000; background:#1a1300; color:#facc15; font-weight:900; font-size:12px; }
@media (min-width: 900px){
  .g-grid{ grid-template-columns: 0.9fr 1.1fr; }
  .kpi-row{ grid-template-columns: 1fr 1fr; }
}
`;

const MOCK = [
  { date: "2026-01-01", weight: 78.4, steps: 8200, training: "Full Body" },
  { date: "2026-01-02", weight: 78.1, steps: 9400, training: "Cardio+Core" },
  { date: "2026-01-03", weight: 77.9, steps: 7600, training: "Push" },
];

export default function Progresos() {
  const [data] = useState(MOCK);

  const kpis = useMemo(() => {
    const last = data[data.length - 1];
    const first = data[0];
    const delta = first && last ? (last.weight - first.weight).toFixed(1) : "0.0";
    const avgSteps =
      data.length ? Math.round(data.reduce((a, x) => a + (x.steps || 0), 0) / data.length) : 0;
    return { last, delta, avgSteps };
  }, [data]);

  return (
    <div className="g-wrap">
      <style>{CSS}</style>

      <div className="g-inner">
        <div>
          <h1 className="g-title">📈 Progresos</h1>
          <p className="g-sub">Mock por ahora. Después lo conectamos a tu backend (pesos, medidas, fotos, etc.).</p>
        </div>

        <div className="g-grid">
          <div className="g-card">
            <div className="kpi-row">
              <div className="kpi">
                <div style={{ color: "#bdbdbd", fontWeight: 900, fontSize: 12 }}>Peso actual</div>
                <div className="big">{kpis.last?.weight ?? "—"} kg</div>
              </div>
              <div className="kpi">
                <div style={{ color: "#bdbdbd", fontWeight: 900, fontSize: 12 }}>Cambio (período)</div>
                <div className="big">{kpis.delta} kg</div>
              </div>
              <div className="kpi">
                <div style={{ color: "#bdbdbd", fontWeight: 900, fontSize: 12 }}>Promedio pasos</div>
                <div className="big">{kpis.avgSteps}</div>
              </div>
              <div className="kpi">
                <div style={{ color: "#bdbdbd", fontWeight: 900, fontSize: 12 }}>Último entrenamiento</div>
                <div className="big" style={{ fontSize: 16 }}>{kpis.last?.training ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="g-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 1000 }}>Historial</div>
              <span className="pill">Últimos {data.length} días</span>
            </div>

            <div style={{ height: 10 }} />

            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Peso</th>
                  <th>Pasos</th>
                  <th>Rutina</th>
                </tr>
              </thead>
              <tbody>
                {data.map((x, i) => (
                  <tr key={i}>
                    <td>{x.date}</td>
                    <td>{x.weight} kg</td>
                    <td>{x.steps}</td>
                    <td>{x.training}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 10, color: "#bdbdbd", fontSize: 12 }}>
              Tip: después acá metemos gráfico (peso por día / kcal / macros / rachas).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
