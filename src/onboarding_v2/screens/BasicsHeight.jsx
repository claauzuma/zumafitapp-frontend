// src/onboarding_v2/screens/BasicsHeight.jsx
import React, { useEffect, useRef, useState } from "react";

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export default function BasicsHeight({ form, setForm }) {
  const v = clamp(Number(form.alturaCm ?? 170), 120, 230);

  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(v));
  const inputRef = useRef(null);

  // sincroniza el texto si cambia por slider u otra cosa
  useEffect(() => {
    if (!editing) setRaw(String(v));
  }, [v, editing]);

  useEffect(() => {
    if (editing) {
      // focus + seleccionar todo
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select?.();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [editing]);

  function commit() {
    const t = String(raw ?? "").trim();
    if (t === "") {
      setRaw(String(v));
      setEditing(false);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      setRaw(String(v));
      setEditing(false);
      return;
    }
    const fixed = clamp(Math.round(n), 120, 230);
    setForm((p) => ({ ...p, alturaCm: fixed }));
    setRaw(String(fixed));
    setEditing(false);
  }

  function cancel() {
    setRaw(String(v));
    setEditing(false);
  }

  return (
    <>
      <h2 className="ob2-h2">¿Cuál es tu altura?</h2>
      <p className="ob2-p">En centímetros (cm).</p>

      <div className="ob2-card">
        {/* ✅ Misma “cifra grande”, pero clickeable y editable inline */}
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Tocá para editar"
            style={{
              all: "unset",
              display: "block",
              width: "100%",
              cursor: "text",
            }}
          >
            <div className="ob2-bigvalue">
              {v} <span style={{ color: "#bdbdbd", fontSize: 16, fontWeight: 900 }}>cm</span>
            </div>
          </button>
        ) : (
          <div className="ob2-bigvalue" style={{ marginBottom: 0 }}>
            <input
              ref={inputRef}
              className="ob2-input"
              inputMode="numeric"
              type="number"
              min={120}
              max={230}
              step={1}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
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
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#888", textAlign: "center" }}>
              Enter para guardar • Esc para cancelar
            </div>
          </div>
        )}

        <input
          className="ob2-slider"
          type="range"
          min={120}
          max={230}
          step={1}
          value={v}
          onChange={(e) => {
            const n = clamp(Number(e.target.value), 120, 230);
            setForm((p) => ({ ...p, alturaCm: n }));
            if (!editing) setRaw(String(n));
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: 12, marginTop: 10 }}>
          <span>120</span>
          <span>230</span>
        </div>
      </div>
    </>
  );
}
