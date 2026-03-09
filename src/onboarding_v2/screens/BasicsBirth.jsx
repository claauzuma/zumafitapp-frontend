import React from "react";

export default function BasicsBirth({ form, setForm }) {
  return (
    <>
      <h2 className="ob2-h2">¿Cuándo naciste?</h2>
      <p className="ob2-p">Usamos tu edad para estimar tu gasto calórico.</p>

      <div className="ob2-card">
        <input
          className="ob2-input"
          type="date"
          value={form.fechaNacimiento}
          onChange={(e) => setForm((p) => ({ ...p, fechaNacimiento: e.target.value }))}
        />
        <p className="ob2-p" style={{ marginTop: 10, fontSize: 12 }}>
          Tip: si querés, después lo podés cambiar en Ajustes.
        </p>
      </div>
    </>
  );
}