import React from "react";
import "./brandLogo.css";

const LOGO_SRC = "/images/brand/logo.png";

export default function BrandLogo({
  className = "",
  imgClassName = "",
  size = "md",
  priority = false,
}) {
  const sizeClass = size ? `brand-logo--${size}` : "";

  return (
    <span className={`brand-logo ${sizeClass} ${className}`.trim()} aria-label="ZumaFit">
      <img
        src={LOGO_SRC}
        alt="ZumaFit"
        className={`brand-logo-img ${imgClassName}`.trim()}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </span>
  );
}
