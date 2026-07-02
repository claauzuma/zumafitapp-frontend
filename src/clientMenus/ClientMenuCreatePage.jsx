import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
import AppToast from "../ui/AppToast.jsx";
import ClientMenusPanel from "./ClientMenusPanel.jsx";
import "../nutritionLibrary/nutritionLibrary.css";

function safeReturnPath(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("/app/") || text === "/app/menu/nuevo") return "/app/menu";
  return text;
}

export default function ClientMenuCreatePage() {
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const cachedUser = useMemo(() => getCachedUser(), []);
  const authQuery = useAuthMe({
    enabled: true,
    initialFromCache: true,
    staleTime: 30 * 1000,
    refetchOnMount: false,
  });
  const user = authQuery.data || cachedUser || {};
  const returnTo = safeReturnPath(location.state?.from);
  const editMenuId = location.state?.editMenuId || location.state?.menuId || "";
  const editMenuRequest = editMenuId
    ? {
        id: editMenuId,
        token: location.state?.editToken || `${editMenuId}-route`,
        focusName: location.state?.focus === "name",
      }
    : null;

  return (
    <div className="nl-page client-menu-create-page">
      <section className="nl-shell client-menu-create-shell">
        <ClientMenusPanel
          directCreate
          editMenuRequest={editMenuRequest}
          returnTo={returnTo}
          user={user}
          onToast={setToast}
        />
      </section>
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
