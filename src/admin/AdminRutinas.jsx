import React from "react";

export default function AdminRutinas() {
  return (
    <div style={card()}>
      <div style={head()}>
        <div>
          <div style={title()}>Rutinas</div>
          <div style={sub()}>Plantillas + asignación por usuario (lo más pro).</div>
        </div>
        <button style={btnPrimary()} disabled>
          + Crear rutina (próximo)
        </button>
      </div>

      <div style={miniCard()}>
        <div style={miniTitle()}>Modelo recomendado</div>
        <div style={miniText()}>
          1) Admin crea <b>plantillas</b> de rutinas <br />
          2) Admin asigna rutina a usuario desde “Detalle usuario” <br />
          3) Cliente ve “Rutina de hoy” en su Home
        </div>
      </div>
    </div>
  );
}

function card() { return { border: "1px solid rgba(255,255,255,.10)", borderRadius: 18, background: "rgba(15,15,15,.75)", padding: 16, color: "#eaeaea" }; }
function head() { return { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }; }
function title() { return { fontSize: 22, fontWeight: 950, color: "#f5d76e" }; }
function sub() { return { color: "rgba(234,234,234,.75)", marginTop: 6, fontWeight: 700 }; }
function miniCard() { return { border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 14, background: "rgba(0,0,0,.25)", marginTop: 14 }; }
function miniTitle() { return { fontWeight: 900, marginBottom: 6 }; }
function miniText() { return { color: "rgba(234,234,234,.75)", fontWeight: 700, lineHeight: 1.35 }; }
function btnPrimary() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(245,215,110,.35)",
    background: "rgba(245,215,110,.10)",
    color: "#f5d76e",
    fontWeight: 950,
    cursor: "not-allowed",
  };
}
