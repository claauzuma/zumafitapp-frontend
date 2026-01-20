import React from "react";

export default function AdminComidas() {
  return (
    <div style={card()}>
      <div style={head()}>
        <div>
          <div style={title()}>Comidas</div>
          <div style={sub()}>Revisá comidas creadas por usuarios y armá plantillas (si querés).</div>
        </div>
      </div>

      <div style={miniCard()}>
        <div style={miniTitle()}>Tip</div>
        <div style={miniText()}>
          Tu backend ya tiene <code style={code()}>/api/comidas</code>. Acá después mostramos tabla con filtros por <b>userId</b> y nombre.
        </div>
      </div>
    </div>
  );
}

const card = () => ({ border: "1px solid rgba(255,255,255,.10)", borderRadius: 18, background: "rgba(15,15,15,.75)", padding: 16, color: "#eaeaea" });
const head = () => ({ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" });
const title = () => ({ fontSize: 22, fontWeight: 950, color: "#f5d76e" });
const sub = () => ({ color: "rgba(234,234,234,.75)", marginTop: 6, fontWeight: 700 });
const miniCard = () => ({ border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 14, background: "rgba(0,0,0,.25)", marginTop: 14 });
const miniTitle = () => ({ fontWeight: 900, marginBottom: 6 });
const miniText = () => ({ color: "rgba(234,234,234,.75)", fontWeight: 700, lineHeight: 1.35 });
const code = () => ({ color: "#f5d76e", fontWeight: 900 });
