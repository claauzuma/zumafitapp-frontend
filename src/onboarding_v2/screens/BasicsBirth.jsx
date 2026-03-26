import React, { useMemo } from "react";

function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isAtLeast18(birthYYYYMMDD) {
  if (!birthYYYYMMDD) return true; // no mostramos error si está vacío
  const birth = new Date(`${birthYYYYMMDD}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return true;

  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return birth <= cutoff;
}

export default function BasicsBirth({ form, setForm }) {
  // fecha máxima permitida = hoy - 18 años
  const maxDate = useMemo(() => {
    const today = new Date();
    const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    return formatDateYYYYMMDD(cutoff);
  }, []);

  const isValid = isAtLeast18(form.fechaNacimiento);

  return (
    <>
      <h2 className="ob2-h2">¿Cuándo naciste?</h2>
      <p className="ob2-p">Usamos tu edad para estimar tu gasto calórico.</p>

      <div className="ob2-card">
        <input
          className="ob2-input"
          type="date"
          value={form.fechaNacimiento}
          max={maxDate}
          onChange={(e) => setForm((p) => ({ ...p, fechaNacimiento: e.target.value }))}
        />

        {!isValid ? (
          <p className="ob2-p" style={{ marginTop: 10, color: "#ffd9a1" }}>
            Debes ser mayor de 18 años para registrarte
          </p>
        ) : (
          <p className="ob2-p" style={{ marginTop: 10, fontSize: 12 }}>
            Tip: si querés, después lo podés cambiar en Ajustes.
          </p>
        )}
      </div>
    </>
  );
}
