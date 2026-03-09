import React from "react";

export default function BasicsWeight({ form, setForm }) {
  const v = Number(form.pesoKg || 75);

  return (
    <>
      <h2 className="ob2-h2">¿Cuál es tu peso?</h2>
      <p className="ob2-p">En kilogramos (kg).</p>

      <div className="ob2-card">
        <div className="ob2-bigvalue">{v.toFixed(1)} kg</div>

        <input
          className="ob2-slider"
          type="range"
          min={35}
          max={200}
          step={0.1}
          value={v}
          onChange={(e) => setForm((p) => ({ ...p, pesoKg: Number(e.target.value) }))}
        />

        <div style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: 12, marginTop: 10 }}>
          <span>35</span>
          <span>200</span>
        </div>
      </div>
    </>
  );
}