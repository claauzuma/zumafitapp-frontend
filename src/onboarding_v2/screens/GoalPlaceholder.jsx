import React from "react";

export default function GoalPlaceholder({ onGoProgram }) {
  return (
    <div className="ob2-card">
      <h2 className="ob2-h2" style={{ marginTop: 0 }}>Objetivo</h2>
      <p className="ob2-p">
        Acá va el onboarding de <b>Objetivo</b>. Cuando me pases las imágenes de “Goal”, lo armamos igual de pro.
      </p>

      <button className="ob2-btn primary" type="button" onClick={onGoProgram}>
        Ir a Programa (placeholder)
      </button>
    </div>
  );
}