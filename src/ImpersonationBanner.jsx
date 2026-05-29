import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getImpersonationSession, isImpersonating } from "./authCache.js";
import { getCurrentImpersonation, stopAdminImpersonation } from "./impersonationApi.js";

export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getImpersonationSession());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!isImpersonating()) {
      setSession(null);
      return () => {
        alive = false;
      };
    }

    getCurrentImpersonation().then((current) => {
      if (!alive) return;
      setSession(current || null);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const active = !!session?.active || isImpersonating();
    document.body.classList.toggle("impersonation-readonly", active);

    return () => {
      document.body.classList.remove("impersonation-readonly");
    };
  }, [session]);

  const target = session?.targetUser || null;
  const fullName = useMemo(() => {
    const nombre = String(target?.profile?.nombre || "").trim();
    const apellido = String(target?.profile?.apellido || "").trim();
    return `${nombre} ${apellido}`.trim() || "Usuario";
  }, [target]);

  if (!session?.active && !isImpersonating()) return null;

  async function handleBack() {
    if (leaving) return;
    setLeaving(true);
    try {
      const returnTo = await stopAdminImpersonation();
      navigate(returnTo || "/admin/usuarios", { replace: true });
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="imp-banner" role="status">
      <style>{styles}</style>
      <div className="imp-avatar">
        {getAvatarUrl(target) ? (
          <img src={getAvatarUrl(target)} alt={fullName} />
        ) : (
          <span>{initials(target)}</span>
        )}
      </div>

      <div className="imp-copy">
        <div className="imp-title">Modo simulacion · Solo lectura</div>
        <div className="imp-sub">
          Estas viendo la app como: <strong>{fullName}</strong>
          {target?.email ? ` (${target.email})` : ""}. Ingresaste desde el Panel Admin.
        </div>
      </div>

      <button className="imp-btn" type="button" onClick={handleBack} disabled={leaving} data-impersonation-allow="true">
        {leaving ? "Volviendo..." : "Volver al Panel Admin"}
      </button>
    </div>
  );
}

function getAvatarUrl(user) {
  return (
    user?.profile?.avatarUrl ||
    user?.profile?.foto ||
    user?.profile?.avatar ||
    user?.avatarUrl ||
    user?.avatar ||
    ""
  );
}

function initials(user) {
  const nombre = String(user?.profile?.nombre || "").trim();
  const apellido = String(user?.profile?.apellido || "").trim();
  const a = nombre[0] || "U";
  const b = apellido[0] || "X";
  return `${a}${b}`.toUpperCase();
}

const styles = `
.imp-banner{
  position:sticky;
  top:0;
  z-index:120;
  display:flex;
  align-items:center;
  gap:12px;
  padding:10px 14px;
  border-bottom:1px solid rgba(245,215,110,.28);
  background:linear-gradient(90deg, rgba(245,215,110,.18), rgba(16,20,28,.98));
  color:#f8fafc;
  box-shadow:0 10px 30px rgba(0,0,0,.28);
}
.imp-avatar{
  width:42px;
  height:42px;
  border-radius:14px;
  overflow:hidden;
  border:1px solid rgba(245,215,110,.36);
  background:#0b0f15;
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#f5d76e;
  font-weight:1000;
}
.imp-avatar img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.imp-copy{
  min-width:0;
  flex:1 1 auto;
}
.imp-title{
  color:#f5d76e;
  font-weight:1000;
}
.imp-sub{
  margin-top:2px;
  color:#d9e2ee;
  font-size:13px;
  line-height:1.35;
}
.imp-btn{
  min-height:40px;
  padding:0 14px;
  border-radius:14px;
  border:1px solid rgba(245,215,110,.42);
  background:#0b0f15;
  color:#f5d76e;
  font-weight:900;
  cursor:pointer;
  flex:0 0 auto;
}
.imp-btn:disabled{
  opacity:.7;
  cursor:not-allowed;
}
body.impersonation-readonly button[type="submit"],
body.impersonation-readonly input[type="submit"]{
  opacity:.62;
  cursor:not-allowed;
  pointer-events:none;
}
@media (max-width: 720px){
  .imp-banner{
    align-items:flex-start;
    flex-wrap:wrap;
  }
  .imp-btn{
    width:100%;
  }
}
`;
