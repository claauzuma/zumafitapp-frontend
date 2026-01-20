import React from "react";

export default function AdminAlimentos() {
  return (
    <div style={card()}>
      <div style={head()}>
        <div>
          <div style={title()}>Alimentos</div>
          <div style={sub()}>CRUD de alimentos (base maestra). Acá después metemos crear/editar con modal.</div>
        </div>
        <button style={btnPrimary()} disabled>
          + Crear alimento (próximo)
        </button>
      </div>

      <div style={miniCard()}>
        <div style={miniTitle()}>Siguiente paso</div>
        <div style={miniText()}>
          Endpoints recomendados:
          <div style={{ marginTop: 6 }}>
            <code style={code()}>GET /api/alimentos</code> • <code style={code()}>POST /api/alimentos</code> •{" "}
            <code style={code()}>PATCH /api/alimentos/:id</code> • <code style={code()}>DELETE /api/alimentos/:id</code>
          </div>
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
function code() { return { color: "#f5d76e", fontWeight: 900 }; }
