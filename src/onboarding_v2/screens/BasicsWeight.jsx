// src/onboarding_v2/screens/BasicsWeight.jsx
import React, { useEffect, useRef, useState } from "react";

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

export default function BasicsWeight({ form, setForm }) {
  const v = clamp(Number(form.pesoKg ?? 75), 35, 200);

  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(v.toFixed(1)));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setRaw(String(v.toFixed(1)));
  }, [v, editing]);

  useEffect(() => {
    if (editing) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select?.();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [editing]);

  function commit() {
    const t = String(raw ?? "").trim().replace(",", ".");
    if (t === "") {
      setRaw(String(v.toFixed(1)));
      setEditing(false);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      setRaw(String(v.toFixed(1)));
      setEditing(false);
      return;
    }
    const fixed = clamp(round1(n), 35, 200);
    setForm((p) => ({ ...p, pesoKg: fixed }));
    setRaw(String(fixed.toFixed(1)));
    setEditing(false);
  }

  function cancel() {
    setRaw(String(v.toFixed(1)));
    setEditing(false);
  }

  return (
    <>
      <h2 className="ob2-h2">¿Cuál es tu peso?</h2>
      <p className="ob2-p">En kilogramos (kg).</p>

      <div className="ob2-card">
        {/* ✅ “Número grande” clickeable y editable inline */}
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Tocá para editar"
            style={{ all: "unset", display: "block", width: "100%", cursor: "text" }}
          >
            <div className="ob2-bigvalue">
              {v.toFixed(1)}{" "}
              <span style={{ color: "#bdbdbd", fontSize: 16, fontWeight: 900 }}>kg</span>
            </div>
          </button>
        ) : (
          <div className="ob2-bigvalue" style={{ marginBottom: 0 }}>
            <input
              ref={inputRef}
              className="ob2-input"
              inputMode="decimal"
              type="text"
              value={raw}
              onChange={(e) => {
                // acepta números + punto/coma
                const next = e.target.value
                  .replace(/[^0-9.,]/g, "")
                  .replace(/(,)(?=.*[,])/g, ""); // deja solo 1 coma (simple)
                setRaw(next);
              }}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              style={{
                fontSize: 34,
                fontWeight: 1000,
                textAlign: "center",
              }}
              placeholder="Ej: 75,0"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#888", textAlign: "center" }}>
              Enter para guardar • Esc para cancelar
            </div>
          </div>
        )}

        <input
          className="ob2-slider"
          type="range"
          min={35}
          max={200}
          step={0.1}
          value={v}
          onChange={(e) => {
            const n = clamp(Number(e.target.value), 35, 200);
            setForm((p) => ({ ...p, pesoKg: n }));
            if (!editing) setRaw(String(n.toFixed(1)));
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: 12, marginTop: 10 }}>
          <span>35</span>
          <span>200</span>
        </div>
      </div>
    </>
  );
}
