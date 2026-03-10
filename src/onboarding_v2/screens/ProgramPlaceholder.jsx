// src/onboarding_v2/screens/ProgramPlaceholder.jsx
import React, { useState } from "react";

export default function ProgramPlaceholder({ onFinish }) {
  const [loading, setLoading] = useState(false);

  async function handleFinish() {
    if (!onFinish || loading) return;
    setLoading(true);
    try {
      await onFinish(); // ✅ OnboardingWizard se encarga de PATCH step3 + /me + cache + navigate
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ob2-card">
      <h2 className="ob2-h2" style={{ marginTop: 0 }}>
        Programa
      </h2>

      <p className="ob2-p">
        Acá va el onboarding de <b>Programa</b> (con pasos opcionales). Cuando me pases esas imágenes, lo replicamos.
      </p>

      <button className="ob2-btn primary" type="button" onClick={handleFinish} disabled={loading || !onFinish}>
        {loading ? "Finalizando…" : "Terminar (placeholder)"}
      </button>
    </div>
  );
}