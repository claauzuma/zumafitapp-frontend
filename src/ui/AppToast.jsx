import React, { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const AUTO_CLOSE_MS = {
  success: 3600,
  info: 4200,
  warning: 7000,
  error: 0,
};

export default function AppToast({ toast, onClose }) {
  const type = toast?.type || "info";
  const message = toast?.message || "";
  const Icon = ICONS[type] || Info;

  useEffect(() => {
    if (!message) return undefined;

    const ms = toast?.durationMs ?? AUTO_CLOSE_MS[type] ?? 0;
    if (!ms) return undefined;

    const timer = window.setTimeout(() => {
      onClose?.();
    }, ms);

    return () => window.clearTimeout(timer);
  }, [message, onClose, toast?.durationMs, type]);

  if (!message) return null;

  return (
    <div className="zt-host" role="status" aria-live={type === "error" ? "assertive" : "polite"}>
      <div className={`zt-toast ${type}`}>
        <div className="zt-icon">
          <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
        </div>
        <div className="zt-message">{message}</div>
        <button type="button" className="zt-close" onClick={onClose} aria-label="Cerrar notificacion">
          <X size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
.zt-host{
  position:fixed;
  z-index:3000;
  top:18px;
  right:18px;
  width:min(390px, calc(100vw - 28px));
  pointer-events:none;
}

.zt-toast{
  pointer-events:auto;
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  align-items:start;
  gap:11px;
  padding:13px 13px;
  border-radius:16px;
  border:1px solid rgba(245,215,110,.22);
  background:linear-gradient(180deg, rgba(14,18,25,.98), rgba(7,10,15,.98));
  color:#eef2f7;
  box-shadow:0 18px 58px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.04);
  animation:zt-in .18s ease-out;
}

.zt-toast.success,
.zt-toast.info{
  border-color:rgba(245,215,110,.30);
}

.zt-toast.error{
  border-color:rgba(255,95,95,.34);
  background:linear-gradient(180deg, rgba(35,14,20,.98), rgba(12,8,12,.98));
}

.zt-toast.warning{
  border-color:rgba(255,190,80,.32);
}

.zt-icon{
  width:34px;
  height:34px;
  border-radius:12px;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#f5d76e;
  background:rgba(245,215,110,.09);
  border:1px solid rgba(245,215,110,.18);
}

.zt-toast.error .zt-icon{
  color:#ffb8b8;
  background:rgba(255,95,95,.10);
  border-color:rgba(255,95,95,.20);
}

.zt-message{
  min-width:0;
  padding-top:5px;
  font-size:14px;
  line-height:1.35;
  font-weight:900;
  overflow-wrap:anywhere;
}

.zt-close{
  width:30px;
  height:30px;
  border-radius:11px;
  border:1px solid rgba(255,255,255,.09);
  background:#0c1118;
  color:#edf2f7;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
}

@keyframes zt-in{
  from{ opacity:0; transform:translateY(-8px) scale(.98); }
  to{ opacity:1; transform:translateY(0) scale(1); }
}

@media (max-width: 640px){
  .zt-host{
    top:auto;
    right:14px;
    left:14px;
    bottom:14px;
    width:auto;
  }
}
`;
