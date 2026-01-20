import React from "react";

export default function AdminUsuarios() {
  return (
    <div style={card()}>
      <div style={head()}>
        <div>
          <div style={title()}>Usuarios</div>
          <div style={sub()}>Buscá usuarios, editá perfil, asigná rutinas y revisá progreso.</div>
        </div>
        <button style={btnPrimary()} disabled>
          + Crear usuario (próximo)
        </button>
      </div>

      <div style={grid()}>
        <div style={miniCard()}>
          <div style={miniTitle()}>Acción rápida</div>
          <div style={miniText()}>Entrá a un usuario y administrá comidas/rutinas/progresos desde un solo lugar.</div>
        </div>
        <div style={miniCard()}>
          <div style={miniTitle()}>Siguiente paso backend</div>
          <div style={miniText()}>
            Ideal: <code style={code()}>GET /api/usuarios/users</code> (admin) + <code style={code()}>GET /api/usuarios/users/:id</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function card() {
  return {
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 18,
    background: "rgba(15,15,15,.75)",
    padding: 16,
    color: "#eaeaea",
  };
}
function head() { return { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }; }
function title() { return { fontSize: 22, fontWeight: 950, color: "#f5d76e" }; }
function sub() { return { color: "rgba(234,234,234,.75)", marginTop: 6, fontWeight: 700 }; }
function grid() { return { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 14 }; }
function miniCard() { return { border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 14, background: "rgba(0,0,0,.25)" }; }
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
