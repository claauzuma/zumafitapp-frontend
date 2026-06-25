import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  Route,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { formatNumber } from "../nutricion/nutricionUtils.js";
import PlanLimitNotice from "../clientPlans/PlanLimitNotice.jsx";
import { clientPlanLabel as getClientPlanLabel } from "../clientPlans/clientPlanUtils.js";
import {
  activateClientMenu,
  deactivateClientMenu,
  listClientMenus,
} from "./clientMenusApi.js";

function idOf(value = {}) {
  return String(value?.id || value?._id || "");
}

function hasCoach(user = {}) {
  return Boolean(
    user?.coach?.entrenadorId ||
    user?.coach?.coachId ||
    user?.coachId ||
    user?.entrenadorId ||
    user?.profesionalId
  );
}

function libraryLabel(capabilities = {}) {
  if (capabilities?.canUsePremiumLibrary) return "Biblioteca completa";
  if (capabilities?.canUseGlobalLibrary) return "Biblioteca global";
  if (capabilities?.canUseBasicLibrary) return "Biblioteca basica";
  return "Biblioteca no disponible";
}

function menuTotals(menu = {}) {
  const totals = menu.macrosTotales || menu.totales || {};
  return {
    kcal: Number(totals.kcal || 0),
    proteina: Number(totals.proteina ?? totals.proteinas ?? 0),
    carbs: Number(totals.carbs ?? totals.carbohidratos ?? 0),
    grasas: Number(totals.grasas ?? 0),
  };
}

function daysCount(menu = {}) {
  const days = Object.keys(menu.dias || {});
  return days.length || menu.selectedDays?.length || 0;
}

function mealsCount(menu = {}) {
  return Number(menu.cantidadComidas || menu.comidas?.length || 0);
}

function updatedLabel(menu = {}) {
  const date = menu.updatedAt ? new Date(menu.updatedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function coachPlanName(user = {}) {
  const entries = Object.values(user?.menu?.weeklyPlan?.assignedMenusByDay || {});
  const entry = entries.find(Boolean) || {};
  return entry.nombre || entry.name || entry.menuNombre || entry.menuName || "Plan semanal asignado";
}

function coachName(user = {}) {
  return (
    user?.coach?.coachName ||
    user?.coach?.nombre ||
    user?.clientCoachNotice?.coachName ||
    user?.coachProfile?.nombre ||
    "tu coach"
  );
}

function primaryState({ capabilities, activeMenu, ownMenus, user }) {
  const source = capabilities?.activeMenuSource || user?.menu?.activeSource || "none";
  const withCoach = capabilities?.hasCoach ?? hasCoach(user);
  const hasProfessional = source === "coach" && withCoach;

  if (hasProfessional) return "coach-active";
  if (source === "own" && activeMenu) return "own-active";
  if (source === "own" && !activeMenu) return "own-missing";
  if (withCoach) return "coach-no-plan";
  if ((ownMenus || []).length) return "recent-own";
  return "self-empty";
}

function ActionButton({ children, variant = "secondary", ...props }) {
  return (
    <button type="button" className={`nh-action ${variant}`} {...props}>
      {children}
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

export default function ClientNutritionHome({
  user = {},
  onToast,
  onCreateMenu,
  onOpenMyMenus,
  onOpenLibrary,
  onEditMenu,
}) {
  const navigate = useNavigate();
  const [menus, setMenus] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [capabilities, setCapabilities] = useState(user?.nutritionCapabilities || null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listClientMenus({ includeComidas: false, limit: 3 });
      if (!mounted.current) return;
      setMenus(data?.items || []);
      setActiveMenu(data?.activeMenu || null);
      setCapabilities(data?.capabilities || user?.nutritionCapabilities || null);
      setPagination(data?.pagination || null);
    } catch (err) {
      if (mounted.current) setError(err?.message || "No pudimos cargar tu informacion nutricional.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user?.nutritionCapabilities]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const usedMenus = Number(pagination?.total ?? menus.length);
  const ownMenusLimit = Number(capabilities?.limits?.ownMenus);
  const limitReached = Number.isFinite(ownMenusLimit) && usedMenus >= ownMenusLimit;
  const state = useMemo(
    () => primaryState({ capabilities, activeMenu, ownMenus: menus, user }),
    [activeMenu, capabilities, menus, user]
  );
  const rawPlan = capabilities?.plan || user?.nutritionCapabilities?.plan || user?.plan;
  const plan = rawPlan ? getClientPlanLabel(rawPlan) : "Plan";

  async function runAction(fn, message) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (message) onToast?.({ type: "success", message });
      await load();
    } catch (err) {
      onToast?.({ type: "error", message: err?.message || "No se pudo completar la accion." });
    } finally {
      setBusy(false);
    }
  }

  function goTracking() {
    navigate("/app/tracking");
  }

  function goMenuDay() {
    navigate("/app/menu");
  }

  function goSettings() {
    navigate("/app/ajustes");
  }

  function createMenu() {
    if (limitReached || capabilities?.canCreateOwnMenu === false) {
      onOpenMyMenus?.();
      return;
    }
    onCreateMenu?.();
  }

  if (loading) {
    return (
      <section className="nutrition-home nh-loading" aria-busy="true" aria-live="polite">
        <div className="nh-skeleton wide" />
        <div className="nh-skeleton-grid">
          <div className="nh-skeleton" />
          <div className="nh-skeleton" />
          <div className="nh-skeleton" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="nutrition-home nh-error">
        <AlertTriangle size={22} />
        <div>
          <h2>No pudimos cargar tu informacion nutricional.</h2>
          <p>{error}</p>
        </div>
        <button type="button" className="nh-action secondary" onClick={load}>
          <RefreshCw size={16} />
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <section className="nutrition-home" aria-label="Inicio de nutricion">
      <div className="nh-plan-strip">
        <span>Plan {plan}</span>
        <span>{usedMenus} de {Number.isFinite(ownMenusLimit) ? ownMenusLimit : "sin limite"} menus propios</span>
        <span>{libraryLabel(capabilities)}</span>
        <button type="button" onClick={() => navigate("/app/planes")}>Ver beneficios</button>
      </div>

      {user?.clientCoachNotice?.type === "coach_unlinked" && user?.clientCoachNotice?.status === "unread" ? (
        <div className="nh-transition-note">
          <span className="nh-kicker"><Sparkles size={15} /> Autogestionado</span>
          <strong>Ahora gestionas tu nutricion de forma independiente.</strong>
          <p>El menu profesional anterior ya no esta disponible. Tus menus propios, comidas y Tracking siguen guardados.</p>
        </div>
      ) : null}

      {user?.metasActuales?.needsReview === true ? (
        <div className="nh-review-note">
          <div>
            <strong>Revisa tu objetivo nutricional</strong>
            <p>Tu objetivo anterior provenia de tu coach. Configuramos una alternativa para que puedas continuar.</p>
          </div>
          <button type="button" onClick={goSettings}>Revisar objetivo</button>
        </div>
      ) : null}

      {state === "own-active" ? (
        <OwnActiveState
          menu={activeMenu}
          busy={busy}
          onMenuDay={goMenuDay}
          onTracking={goTracking}
          onEdit={() => onEditMenu?.(idOf(activeMenu))}
          onChange={onOpenMyMenus}
          onDeactivate={() => runAction(deactivateClientMenu, "Ahora estas usando solo Tracking.")}
        />
      ) : null}

      {state === "coach-active" ? (
        <CoachActiveState
          user={user}
          onMenuDay={goMenuDay}
          onTracking={goTracking}
          onOpenMyMenus={onOpenMyMenus}
        />
      ) : null}

      {state === "coach-no-plan" ? (
        <CoachNoPlanState
          limitReached={limitReached}
          capabilities={capabilities}
          usedMenus={usedMenus}
          ownMenusLimit={ownMenusLimit}
          onCreate={createMenu}
          onOpenMyMenus={onOpenMyMenus}
          onOpenPlans={() => navigate("/app/planes")}
          onTracking={goTracking}
        />
      ) : null}

      {state === "own-missing" ? (
        <MissingActiveState onOpenMyMenus={onOpenMyMenus} onTracking={goTracking} />
      ) : null}

      {state === "recent-own" ? (
        <RecentMenusState
          menus={menus}
          busy={busy}
          onOpenMyMenus={onOpenMyMenus}
          onCreate={createMenu}
          onTracking={goTracking}
          onActivate={(menu) => runAction(() => activateClientMenu(idOf(menu)), "Menu activado.")}
        />
      ) : null}

      {state === "self-empty" ? (
        <SelfEmptyState
          capabilities={capabilities}
          limitReached={limitReached}
          usedMenus={usedMenus}
          ownMenusLimit={ownMenusLimit}
          onCreate={createMenu}
          onOpenMyMenus={onOpenMyMenus}
          onOpenLibrary={onOpenLibrary}
          onOpenPlans={() => navigate("/app/planes")}
          onTracking={goTracking}
        />
      ) : null}
    </section>
  );
}

function SelfEmptyState({
  capabilities,
  limitReached,
  usedMenus,
  ownMenusLimit,
  onCreate,
  onOpenMyMenus,
  onOpenLibrary,
  onOpenPlans,
  onTracking,
}) {
  const createBlocked = limitReached || capabilities?.canCreateOwnMenu === false;
  const createBlockedTitle = limitReached ? "Limite alcanzado" : "No disponible en tu plan";
  const createBlockedText = limitReached
    ? `Usas ${usedMenus} de ${ownMenusLimit} menus disponibles en tu plan.`
    : "Tu plan actual no permite crear menus propios.";

  return (
    <>
      <div className="nh-hero-card">
        <span className="nh-kicker"><Sparkles size={15} /> Inicio inteligente</span>
        <h2>Organiza tu alimentacion a tu manera</h2>
        <p>Podes crear tu propio menu, adaptar uno de ZumaFit o registrar libremente lo que comes.</p>
      </div>

      {createBlocked ? (
        <PlanLimitNotice
          type={limitReached ? "menus" : "days"}
          plan={capabilities?.plan}
          current={usedMenus}
          limit={ownMenusLimit}
          primaryLabel="Administrar mis menus"
          plansLabel="Ver beneficios"
          onPrimary={onOpenMyMenus}
          onPlans={onOpenPlans}
        />
      ) : null}

      <div className="nh-option-grid">
        <OptionCard
          icon={<ClipboardList size={20} />}
          title="Crear mi propio menu"
          description="Arma una planificacion personalizada con tus comidas, alimentos, cantidades y objetivos."
          locked={createBlocked}
          lockedTitle={createBlockedTitle}
          lockedText={createBlockedText}
          actionLabel={createBlocked ? "Administrar mis menus" : "Crear menu"}
          onClick={createBlocked ? onOpenMyMenus : onCreate}
        />
        <OptionCard
          icon={<BookOpen size={20} />}
          title="Explorar ZumaFit"
          description="Elegi un menu preparado, guardalo como propio y adaptalo a tus preferencias."
          actionLabel="Explorar biblioteca"
          onClick={onOpenLibrary}
        />
        <OptionCard
          icon={<Utensils size={20} />}
          title="Usar solo Tracking"
          description="Registra lo que comes realmente sin seguir una planificacion fija."
          actionLabel="Ir a Tracking"
          onClick={onTracking}
          note="Podes crear o activar un menu mas adelante."
        />
      </div>
    </>
  );
}

function OwnActiveState({ menu, busy, onMenuDay, onTracking, onEdit, onChange, onDeactivate }) {
  const totals = menuTotals(menu);
  return (
    <article className="nh-feature-card own">
      <div className="nh-feature-main">
        <span className="nh-kicker"><CheckCircle2 size={15} /> Tu menu activo</span>
        <h2>{menu?.nombre || "Menu propio"}</h2>
        <p>
          {daysCount(menu) || 7} dias - {mealsCount(menu)} comidas - {formatNumber(totals.kcal, 0)} kcal promedio
        </p>
        <small>Ultima modificacion: {updatedLabel(menu)}</small>
      </div>
      <div className="nh-feature-actions">
        <ActionButton variant="primary" onClick={onMenuDay}>Ver menu del dia</ActionButton>
        <ActionButton onClick={onEdit}><Pencil size={15} /> Editar menu</ActionButton>
        <ActionButton onClick={onChange}>Cambiar menu</ActionButton>
        <button type="button" className="nh-link-action" onClick={onDeactivate} disabled={busy}>
          {busy ? <Loader2 size={15} className="nl-spin" /> : <Power size={15} />}
          Usar solo Tracking
        </button>
      </div>
      <div className="nh-tracking-note">
        <strong>Registrar lo que comiste</strong>
        <span>El menu es tu planificacion. Tracking representa lo que consumiste realmente.</span>
        <button type="button" onClick={onTracking}>Ir a Tracking</button>
      </div>
    </article>
  );
}

function CoachActiveState({ user, onMenuDay, onTracking, onOpenMyMenus }) {
  return (
    <article className="nh-feature-card coach">
      <div className="nh-feature-main">
        <span className="nh-kicker"><Route size={15} /> Plan asignado por tu coach</span>
        <h2>{coachPlanName(user)}</h2>
        <p>Coach: {coachName(user)}</p>
        <small>Podes registrar tu consumo real en Tracking sin modificar el plan profesional.</small>
      </div>
      <div className="nh-feature-actions">
        <ActionButton variant="primary" onClick={onMenuDay}>Ver menu</ActionButton>
        <ActionButton onClick={onTracking}>Ir a Tracking</ActionButton>
        <button type="button" className="nh-link-action" onClick={onOpenMyMenus}>
          Ver mis menus guardados
        </button>
      </div>
      <div className="nh-info-note">
        Podes crear y guardar menus propios, pero no activarlos mientras este plan profesional este vigente.
      </div>
    </article>
  );
}

function CoachNoPlanState({ limitReached, capabilities, usedMenus, ownMenusLimit, onCreate, onOpenMyMenus, onOpenPlans, onTracking }) {
  return (
    <article className="nh-feature-card neutral">
      <div className="nh-feature-main">
        <span className="nh-kicker"><AlertTriangle size={15} /> Sin plan profesional activo</span>
        <h2>Todavia no tenes un plan activo de tu coach.</h2>
        <p>Mientras tanto podes usar Tracking o crear tu propia planificacion.</p>
      </div>
      <div className="nh-feature-actions">
        {limitReached || capabilities?.canCreateOwnMenu === false ? (
          <ActionButton variant="primary" onClick={onOpenMyMenus}>Administrar mis menus</ActionButton>
        ) : (
          <ActionButton variant="primary" onClick={onCreate}>Crear mi menu</ActionButton>
        )}
        <ActionButton onClick={onOpenMyMenus}>Mis menus</ActionButton>
        <ActionButton onClick={onTracking}>Ir a Tracking</ActionButton>
      </div>
      {limitReached ? (
        <PlanLimitNotice
          type="menus"
          plan={capabilities?.plan}
          current={usedMenus}
          limit={ownMenusLimit}
          primaryLabel="Administrar mis menus"
          plansLabel="Ver beneficios"
          onPrimary={onOpenMyMenus}
          onPlans={onOpenPlans}
        />
      ) : null}
    </article>
  );
}

function MissingActiveState({ onOpenMyMenus, onTracking }) {
  return (
    <article className="nh-feature-card warning">
      <div className="nh-feature-main">
        <span className="nh-kicker"><AlertTriangle size={15} /> Menu activo no encontrado</span>
        <h2>No pudimos encontrar tu menu activo.</h2>
        <p>Elegi otro menu guardado o continua registrando tu consumo con Tracking.</p>
      </div>
      <div className="nh-feature-actions">
        <ActionButton variant="primary" onClick={onOpenMyMenus}>Elegir otro menu</ActionButton>
        <ActionButton onClick={onTracking}>Ir a Tracking</ActionButton>
      </div>
    </article>
  );
}

function RecentMenusState({ menus, busy, onOpenMyMenus, onCreate, onTracking, onActivate }) {
  return (
    <>
      <div className="nh-section-title">
        <div>
          <span className="nh-kicker"><ClipboardList size={15} /> Menus guardados</span>
          <h2>Continua con uno de tus menus</h2>
        </div>
        <button type="button" onClick={onOpenMyMenus}>Ver todos</button>
      </div>
      <div className="nh-recent-grid">
        {menus.slice(0, 3).map((menu) => (
          <RecentMenuCard key={idOf(menu)} menu={menu} busy={busy} onActivate={() => onActivate(menu)} onOpen={onOpenMyMenus} />
        ))}
      </div>
      <div className="nh-secondary-row">
        <button type="button" onClick={onOpenMyMenus}>Ver todos mis menus</button>
        <button type="button" onClick={onCreate}>Crear otro menu</button>
        <button type="button" onClick={onTracking}>Usar solo Tracking</button>
      </div>
    </>
  );
}

function RecentMenuCard({ menu, busy, onActivate, onOpen }) {
  const totals = menuTotals(menu);
  return (
    <article className="nh-recent-card">
      <h3>{menu.nombre || "Menu propio"}</h3>
      <p>{daysCount(menu) || 7} dias - {mealsCount(menu)} comidas</p>
      <strong>{formatNumber(totals.kcal, 0)} kcal promedio</strong>
      <small>Actualizado: {updatedLabel(menu)}</small>
      <div>
        <button type="button" onClick={onOpen}>Ver</button>
        <button type="button" onClick={onActivate} disabled={busy}>
          {busy ? <Loader2 size={15} className="nl-spin" /> : null}
          Activar
        </button>
      </div>
    </article>
  );
}

function OptionCard({ icon, title, description, actionLabel, onClick, locked = false, lockedTitle = "Limite alcanzado", lockedText = "", note = "" }) {
  return (
    <article className={`nh-option-card ${locked ? "locked" : ""}`}>
      <div className="nh-option-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {locked ? (
        <div className="nh-locked">
          <strong>{lockedTitle}</strong>
          <span>{lockedText}</span>
        </div>
      ) : null}
      {note ? <small>{note}</small> : null}
      <button type="button" onClick={onClick}>
        {actionLabel}
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </article>
  );
}
