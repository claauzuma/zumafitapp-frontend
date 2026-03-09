import React from "react";

export default function BasicsHeight({ form, setForm }) {
  const v = Number(form.alturaCm || 170);

  return (
    <>
      <h2 className="ob2-h2">¿Cuál es tu altura?</h2>
      <p className="ob2-p">En centímetros (cm).</p>

      <div className="ob2-card">
        <div className="ob2-bigvalue">{v} cm</div>

        <input
          className="ob2-slider"
          type="range"
          min={120}
          max={220}
          step={1}
          value={v}
          onChange={(e) => setForm((p) => ({ ...p, alturaCm: Number(e.target.value) }))}
        />

        <div style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: 12, marginTop: 10 }}>
          <span>120</span>
          <span>220</span>
        </div>
      </div>
    </>
  );
}