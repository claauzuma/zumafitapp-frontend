import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function AdminUsuarioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  // =========================
  // ✅ HARD CODE (por ahora)
  // =========================
  const user = useMemo(
    () => ({
      id,
      email: "cliente.demo@mail.com",
      role: "cliente",
      tipo: "entrenado",
      estado: "activo",
      profile: { nombre: "Luz", apellido: "Martínez", nacimiento: "1998-06-12" },
      metas: { kcal: 2100, p: 140, c: 220, g: 65 },
      coach: { nombre: "Claudio", apellido: "Zumárraga" },
      createdAt: "2026-01-02",
      lastLoginAt: "2026-01-20",
    }),
    [id]
  );

  const kpis = useMemo(
    () => ({
      cumplimiento7d: 76, // %
      rachaDias: 4,
      comidasLogueadas7d: 18,
      kcalPromedio7d: 1970,
      pesoActual: 73.4,
      pesoInicio: 76.0,
      objetivoPeso: 72.0,
      cambio30d: -1.6, // kg
      entrenos7d: 3,
      agua7d: 68, // %
    }),
    []
  );

  const pesos = useMemo(
    () => [
      { fecha: "2025-12-22", peso: 76.0 },
      { fecha: "2025-12-29", peso: 75.2 },
      { fecha: "2026-01-05", peso: 74.6 },
      { fecha: "2026-01-12", peso: 74.1 },
      { fecha: "2026-01-19", peso: 73.4 },
    ],
    []
  );

  const ultimasComidas = useMemo(
    () => [
      {
        fecha: "2026-01-20",
        momento: "Almuerzo",
        kcal: 680,
        p: 42,
        c: 70,
        g: 18,
        cumplio: true,
        items: [
          { alimento: "Arroz", cantidad: 120 },
          { alimento: "Pollo", cantidad: 180 },
          { alimento: "Ensalada", cantidad: 1 },
        ],
      },
      {
        fecha: "2026-01-20",
        momento: "Merienda",
        kcal: 320,
        p: 22,
        c: 30,
        g: 9,
        cumplio: true,
        items: [
          { alimento: "Yogur", cantidad: 1 },
          { alimento: "Granola", cantidad: 40 },
        ],
      },
      {
        fecha: "2026-01-19",
        momento: "Cena",
        kcal: 920,
        p: 55,
        c: 80,
        g: 30,
        cumplio: false,
        motivo: "Se pasó de calorías (+250)",
        items: [
          { alimento: "Pizza", cantidad: 3 },
          { alimento: "Gaseosa", cantidad: 1 },
        ],
      },
    ],
    []
  );

  // =========================
  // ✅ Crear comida para cliente (hardcode)
  // =========================
  const [foodName, setFoodName] = useState("Almuerzo predeterminado");
  const [rows, setRows] = useState([
    { alimento: "Arroz", cantidad: 120 },
    { alimento: "Pollo", cantidad: 180 },
    { alimento: "Ensalada", cantidad: 1 },
  ]);

  function addRow() {
    if (rows.length >= 8) return;
    setRows([...rows, { alimento: "", cantidad: "" }]);
  }
  function removeRow(i) {
    setRows(rows.filter((_, idx) => idx !== i));
  }
  function updateRow(i, key, val) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  function createPreset() {
    // en el futuro: POST /api/comidas ... con userId (admin) o endpoint admin
    alert("✅ (Hardcode) Comida predeterminada creada para el usuario.");
  }

  // =========================
  // UI helpers
  // =========================
  const badge = (text, tone = "base") => (
    <span className={`zu-badge ${tone}`}>{text}</span>
  );

  return (
    <div className="zu-page">
      {/* Top bar */}
      <div className="zu-top">
        <button className="zu-btn" onClick={() => navigate("/admin/usuarios")}>
          ← Volver
        </button>

        <div className="zu-actions">
          <button className="zu-btn" onClick={() => alert("TODO: ver como usuario")}>
            👤 Ver como
          </button>
          <button className="zu-btn" onClick={() => alert("TODO: asignar rutina")}>
            🏋️ Asignar rutina
          </button>
          <button className="zu-btn danger" onClick={() => alert("TODO: bloquear usuario")}>
            ⛔ Bloquear
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="zu-card zu-header">
        <div className="zu-avatar">{initials(user.profile?.nombre, user.profile?.apellido)}</div>

        <div className="zu-headInfo">
          <div className="zu-name">
            {user.profile?.nombre} {user.profile?.apellido}
          </div>
          <div className="zu-sub">
            <span className="mono">{user.email}</span>
            <span className="dot">•</span>
            <span className="mono">ID: {user.id}</span>
          </div>

          <div className="zu-badges">
            {badge(user.role === "admin" ? "admin" : "cliente", user.role === "admin" ? "gold" : "base")}
            {badge(user.tipo || "—", "base")}
            {badge(user.estado || "activo", user.estado === "bloqueado" ? "danger" : "ok")}
            {user.coach ? badge(`Coach: ${user.coach.nombre}`, "info") : null}
          </div>
        </div>

        <div className="zu-meta">
          <div className="zu-metaRow">
            <span>Alta</span>
            <b>{user.createdAt}</b>
          </div>
          <div className="zu-metaRow">
            <span>Último login</span>
            <b>{user.lastLoginAt}</b>
          </div>
          <div className="zu-metaRow">
            <span>Nacimiento</span>
            <b>{user.profile?.nacimiento || "—"}</b>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="zu-grid kpis">
        <Kpi title="Cumplimiento 7 días" value={`${kpis.cumplimiento7d}%`} sub="Objetivo: 80%+" trend={kpis.cumplimiento7d >= 80 ? "up" : "down"} />
        <Kpi title="Racha actual" value={`${kpis.rachaDias} días`} sub="Constancia" trend={kpis.rachaDias >= 3 ? "up" : "down"} />
        <Kpi title="Kcal promedio (7d)" value={`${kpis.kcalPromedio7d}`} sub={`Meta: ${user.metas.kcal} kcal`} trend={Math.abs(kpis.kcalPromedio7d - user.metas.kcal) <= 150 ? "up" : "down"} />
        <Kpi title="Peso actual" value={`${kpis.pesoActual} kg`} sub={`Inicio: ${kpis.pesoInicio} • Obj: ${kpis.objetivoPeso}`} trend={kpis.cambio30d < 0 ? "up" : "down"} />
      </div>

      {/* Progreso visual */}
      <div className="zu-grid two">
        <div className="zu-card">
          <div className="zu-cardTitle">Progreso (últimos 5 pesajes)</div>

          <div className="zu-chart">
            {pesos.map((p) => (
              <div key={p.fecha} className="zu-chartRow">
                <div className="zu-chartLabel mono">{p.fecha.slice(5)}</div>
                <div className="zu-barWrap">
                  <div
                    className="zu-bar"
                    style={{
                      width: `${scale(p.peso, 70, 80)}%`,
                    }}
                  />
                </div>
                <div className="zu-chartVal">{p.peso} kg</div>
              </div>
            ))}
          </div>

          <div className="zu-miniNote">
            Cambio 30 días: <b className={kpis.cambio30d < 0 ? "ok" : "warn"}>{kpis.cambio30d} kg</b>
          </div>
        </div>

        <div className="zu-card">
          <div className="zu-cardTitle">Adherencia (7 días)</div>

          <div className="zu-split">
            <ProgressRing label="Comidas" value={Math.min(100, Math.round((kpis.comidasLogueadas7d / 21) * 100))} />
            <ProgressRing label="Agua" value={kpis.agua7d} />
            <ProgressRing label="Entrenos" value={Math.min(100, Math.round((kpis.entrenos7d / 4) * 100))} />
          </div>

          <div className="zu-miniNote">
            Tip: si baja el cumplimiento, revisá <b>porciones</b> y <b>snacks</b>.
          </div>
        </div>
      </div>

      {/* Últimas comidas */}
      <div className="zu-card">
        <div className="zu-row">
          <div className="zu-cardTitle">Últimas comidas</div>
          <div className="zu-rowRight">
            <button className="zu-btn" onClick={() => alert("TODO: ver historial completo")}>
              📚 Historial
            </button>
          </div>
        </div>

        <div className="zu-meals">
          {ultimasComidas.map((c, idx) => (
            <div key={idx} className={`zu-meal ${c.cumplio ? "ok" : "bad"}`}>
              <div className="zu-mealTop">
                <div>
                  <div className="zu-mealTitle">
                    {c.momento} <span className="mono">{c.fecha}</span>
                  </div>
                  <div className="zu-mealSub">
                    {c.kcal} kcal • P {c.p} • C {c.c} • G {c.g}
                    {!c.cumplio && c.motivo ? <span className="zu-badReason"> • {c.motivo}</span> : null}
                  </div>
                </div>

                <div className="zu-mealBadge">
                  {c.cumplio ? badge("Cumplió", "ok") : badge("No cumplió", "danger")}
                </div>
              </div>

              <div className="zu-items">
                {c.items.map((it, i) => (
                  <span key={i} className="zu-itemPill">
                    {it.alimento} <b>{it.cantidad}</b>
                  </span>
                ))}
              </div>

              <div className="zu-mealActions">
                <button className="zu-btn sm" onClick={() => alert("TODO: abrir detalle comida")}>Ver detalle</button>
                <button className="zu-btn sm" onClick={() => alert("TODO: duplicar como plantilla")}>Duplicar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crear comida para cliente */}
      <div className="zu-card">
        <div className="zu-row">
          <div className="zu-cardTitle">Crear comida predeterminada (Admin)</div>
          <div className="zu-rowRight">
            <button className="zu-btn" onClick={addRow} disabled={rows.length >= 8}>
              + Alimento
            </button>
            <button className="zu-btn gold" onClick={createPreset}>
              Guardar predeterminada
            </button>
          </div>
        </div>

        <div className="zu-formGrid">
          <label className="zu-label">
            Nombre de la comida
            <input className="zu-input" value={foodName} onChange={(e) => setFoodName(e.target.value)} />
          </label>

          <div className="zu-note">
            Esta comida se guarda como plantilla para el usuario. Luego él puede usarla y modificarla.
          </div>
        </div>

        <div className="zu-table">
          <div className="zu-tHead">
            <div>Alimento</div>
            <div>Cantidad</div>
            <div />
          </div>

          {rows.map((r, i) => (
            <div key={i} className="zu-tRow">
              <input
                className="zu-input"
                value={r.alimento}
                placeholder={`Alimento ${i + 1}`}
                onChange={(e) => updateRow(i, "alimento", e.target.value)}
              />
              <input
                className="zu-input"
                value={r.cantidad}
                placeholder="Cantidad"
                onChange={(e) => updateRow(i, "cantidad", e.target.value)}
              />
              <button className="zu-iconBtn" onClick={() => removeRow(i)} title="Quitar">
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}

// =========================
// UI components
// =========================
function Kpi({ title, value, sub, trend = "up" }) {
  return (
    <div className="zu-card kpi">
      <div className="zu-kTitle">{title}</div>
      <div className="zu-kValue">
        {value} <span className={`zu-trend ${trend}`}>{trend === "up" ? "▲" : "▼"}</span>
      </div>
      <div className="zu-kSub">{sub}</div>
    </div>
  );
}

function ProgressRing({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="zu-ring">
      <div className="zu-ringCircle">
        <div className="zu-ringVal">{v}%</div>
      </div>
      <div className="zu-ringLabel">{label}</div>
    </div>
  );
}

// =========================
// Helpers
// =========================
function initials(nombre = "", apellido = "") {
  const a = String(nombre || "").trim()[0] || "U";
  const b = String(apellido || "").trim()[0] || "X";
  return (a + b).toUpperCase();
}

// escala simple para barras (0..100)
function scale(val, min, max) {
  const v = Number(val);
  if (!Number.isFinite(v)) return 0;
  const pct = ((v - min) / (max - min)) * 100;
  return Math.max(8, Math.min(100, pct));
}

// =========================
// Styles (black + gold PRO)
// =========================
const styles = `
.zu-page{
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  color: #eaeaea;
}

.zu-top{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.zu-actions{ display:flex; gap:10px; flex-wrap:wrap; }

.zu-card{
  border: 1px solid #1f1f1f;
  background: linear-gradient(180deg,#0b0b0b,#0b0b0bcc);
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
}

.zu-header{
  display:grid;
  grid-template-columns: 72px 1fr 260px;
  gap: 14px;
  align-items:center;
}

.zu-avatar{
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight: 900;
  color: #f5d76e;
  border: 1px solid rgba(245,215,110,.35);
  background: rgba(245,215,110,.06);
}

.zu-name{
  font-size: 20px;
  font-weight: 900;
  color: #f5d76e;
}
.zu-sub{
  margin-top: 6px;
  opacity: .85;
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items:center;
}
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.dot{ opacity: .6; }
.zu-badges{ display:flex; flex-wrap:wrap; gap: 8px; margin-top: 10px; }

.zu-badge{
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #2b2b2b;
  background: #0f0f0f;
  font-weight: 900;
}
.zu-badge.gold{ border-color: rgba(245,215,110,.35); color:#f5d76e; background: rgba(245,215,110,.05); }
.zu-badge.ok{ border-color: rgba(80,220,140,.35); color:#a8f7cf; background: rgba(80,220,140,.07); }
.zu-badge.danger{ border-color: rgba(255,80,80,.35); color:#ffb1b1; background: rgba(255,80,80,.08); }
.zu-badge.info{ border-color: rgba(120,180,255,.35); color:#b9d7ff; background: rgba(120,180,255,.08); }

.zu-meta{
  border-left: 1px solid #1f1f1f;
  padding-left: 12px;
  display:grid;
  gap: 8px;
}
.zu-metaRow{ display:flex; align-items:center; justify-content: space-between; gap: 10px; opacity: .9; }
.zu-metaRow span{ opacity: .75; }

.zu-btn{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #2b2b2b;
  background: #0f0f0f;
  color: #eaeaea;
  font-weight: 900;
  cursor: pointer;
}
.zu-btn:hover{ border-color: rgba(245,215,110,.25); }
.zu-btn.gold{ border-color: rgba(245,215,110,.35); background: rgba(245,215,110,.06); color:#f5d76e; }
.zu-btn.danger{ border-color: rgba(255,80,80,.35); background: rgba(255,80,80,.08); }
.zu-btn.sm{ padding: 8px 10px; border-radius: 12px; font-weight: 800; }

.zu-grid{ display:grid; gap: 12px; margin-top: 12px; }
.zu-grid.kpis{ grid-template-columns: repeat(4, minmax(0, 1fr)); }
.zu-grid.two{ grid-template-columns: 1.15fr .85fr; }

.kpi{ padding: 14px; }
.zu-kTitle{ opacity:.75; font-weight: 900; }
.zu-kValue{ margin-top: 8px; font-size: 22px; font-weight: 1000; color:#f5d76e; display:flex; gap:10px; align-items: baseline; }
.zu-kSub{ margin-top: 6px; opacity: .8; }
.zu-trend{ font-size: 12px; font-weight: 1000; }
.zu-trend.up{ color: #a8f7cf; }
.zu-trend.down{ color: #ffb1b1; }

.zu-cardTitle{ font-weight: 1000; color: #f5d76e; margin-bottom: 10px; }

.zu-chart{ display:grid; gap: 10px; }
.zu-chartRow{
  display:grid;
  grid-template-columns: 60px 1fr 70px;
  gap: 10px;
  align-items:center;
}
.zu-chartLabel{ opacity:.75; }
.zu-barWrap{
  height: 12px;
  border-radius: 999px;
  border: 1px solid #1f1f1f;
  background: #0f0f0f;
  overflow:hidden;
}
.zu-bar{
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(245,215,110,.35), rgba(245,215,110,.9));
}
.zu-chartVal{ text-align:right; opacity:.9; font-weight: 900; }

.zu-miniNote{ margin-top: 10px; opacity:.85; }
.ok{ color:#a8f7cf; }
.warn{ color:#ffd6a0; }

.zu-split{ display:flex; gap: 12px; justify-content: space-between; flex-wrap: wrap; }
.zu-ring{ width: 140px; display:flex; flex-direction: column; align-items:center; gap: 8px; }
.zu-ringCircle{
  width: 96px;
  height: 96px;
  border-radius: 999px;
  border: 1px solid rgba(245,215,110,.35);
  background: rgba(245,215,110,.06);
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow: 0 0 0 6px rgba(245,215,110,.08);
}
.zu-ringVal{ font-weight: 1000; color:#f5d76e; }
.zu-ringLabel{ opacity:.8; font-weight: 900; }

.zu-row{ display:flex; align-items:center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.zu-rowRight{ display:flex; gap: 10px; flex-wrap: wrap; }

.zu-meals{ display:grid; gap: 10px; }
.zu-meal{
  border-radius: 16px;
  border: 1px solid #1f1f1f;
  background: #0f0f0f;
  padding: 12px;
}
.zu-meal.ok{ border-color: rgba(80,220,140,.25); }
.zu-meal.bad{ border-color: rgba(255,80,80,.25); }
.zu-mealTop{ display:flex; justify-content: space-between; gap: 10px; align-items:flex-start; flex-wrap: wrap; }
.zu-mealTitle{ font-weight: 1000; }
.zu-mealTitle .mono{ opacity:.7; font-weight: 800; margin-left: 8px; }
.zu-mealSub{ opacity:.85; margin-top: 4px; }
.zu-badReason{ color:#ffb1b1; font-weight: 900; }

.zu-items{ display:flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.zu-itemPill{
  border: 1px solid #1f1f1f;
  border-radius: 999px;
  padding: 6px 10px;
  background: #0b0b0b;
  font-weight: 800;
  opacity: .95;
}
.zu-itemPill b{ color:#f5d76e; }

.zu-mealActions{ margin-top: 10px; display:flex; gap: 10px; flex-wrap: wrap; }

.zu-formGrid{
  display:grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 12px;
  align-items:end;
  margin-bottom: 12px;
}
.zu-label{ display:grid; gap: 8px; font-weight: 900; opacity:.9; }
.zu-input{
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #2b2b2b;
  background: #0b0b0b;
  color: #eaeaea;
  outline: none;
}
.zu-input:focus{
  border-color: rgba(245,215,110,.5);
  box-shadow: 0 0 0 4px rgba(245,215,110,.12);
}
.zu-note{
  border: 1px solid #1f1f1f;
  background: rgba(245,215,110,.06);
  padding: 12px;
  border-radius: 16px;
  opacity: .9;
}

.zu-table{ display:grid; gap: 8px; }
.zu-tHead{
  display:grid;
  grid-template-columns: 1fr 160px 44px;
  gap: 10px;
  font-weight: 1000;
  opacity: .8;
  padding: 0 4px;
}
.zu-tRow{
  display:grid;
  grid-template-columns: 1fr 160px 44px;
  gap: 10px;
  align-items:center;
}
.zu-iconBtn{
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid #2b2b2b;
  background: #0f0f0f;
  color: #eaeaea;
  cursor: pointer;
  font-weight: 900;
}
.zu-iconBtn:hover{ border-color: rgba(245,215,110,.25); }

@media (max-width: 980px){
  .zu-header{ grid-template-columns: 72px 1fr; }
  .zu-meta{ border-left: none; padding-left: 0; border-top: 1px solid #1f1f1f; padding-top: 12px; grid-column: 1 / -1; }
  .zu-grid.kpis{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .zu-grid.two{ grid-template-columns: 1fr; }
  .zu-ring{ width: 110px; }
}
@media (max-width: 520px){
  .zu-grid.kpis{ grid-template-columns: 1fr; }
  .zu-formGrid{ grid-template-columns: 1fr; }
  .zu-tHead, .zu-tRow{ grid-template-columns: 1fr 120px 44px; }
}
`;
