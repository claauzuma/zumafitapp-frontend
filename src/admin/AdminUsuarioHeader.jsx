import React from "react";

export default function AdminUsuarioHeader({ user, onBack, onRefresh }) {
  const profile = user?.profile || {};
  const nombre = profile?.nombre || "—";
  const apellido = profile?.apellido || "";
  const email = user?.email || "—";
  const role = user?.role || "—";
  const tipo = user?.tipo || "—";
  const plan = user?.plan || "free";
  const estado = user?.estado || "activo";

  return (
    <>
      <div className="aud-top">
        <button className="aud-btn" onClick={onBack}>← Volver</button>

        <div className="aud-actions">
          <button className="aud-btn" onClick={onRefresh}>↻ Refrescar</button>
        </div>
      </div>

      <div className="aud-card aud-header">
        <div className="aud-avatar">
          {String(nombre || "U")[0]}{String(apellido || "X")[0]}
        </div>

        <div className="aud-headInfo">
          <div className="aud-name">{nombre} {apellido}</div>

          <div className="aud-sub">
            <span className="aud-mono">{email}</span>
            <span className="aud-dot">•</span>
            <span className="aud-mono">ID: {user?.id || user?._id}</span>
          </div>

          <div className="aud-badges">
            <span className="aud-badge">{role}</span>
            <span className="aud-badge">{tipo}</span>
            <span className="aud-badge aud-badgeInfo">{plan}</span>
            <span className={`aud-badge ${estado === "bloqueado" ? "aud-badgeDanger" : "aud-badgeOk"}`}>
              {estado}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
