// src/onboarding_v2/components/Ob2PrimaryButton.jsx
import React from "react";

export default function Ob2PrimaryButton({
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      disabled={disabled || loading}
      className={`ob2-btn primary ${loading ? "is-loading" : ""} ${className}`}
    >
      {loading ? <span className="ob2-spinner" /> : null}
      {loading ? "Guardando..." : children}
    </button>
  );
}
