import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../Api.js";
import { getCachedUser, setAuthLogged } from "../authCache.js";

export default function InicioProfesional() {
  const [me, setMe] = useState(() => getCachedUser() || null);
  const [closingWelcome, setClosingWelcome] = useState(false);

  const role = String(me?.role || "").toLowerCase();

  const canTraining = useMemo(() => {
    if (role !== "coach") return false;
    return !!me?.coachProfile?.specialties?.training;
  }, [me, role]);

  const canNutrition = useMemo(() => {
    if (role !== "coach") return false;
    return !!me?.coachProfile?.specialties?.nutrition;
  }, [me, role]);

  const showWelcome = role === "coach" && me?.coachWelcome?.show === true;

  const specialtyLabel = useMemo(() => {
    const training = !!me?.coachWelcome?.specialties?.training;
    const nutrition = !!me?.coachWelcome?.specialties?.nutrition;

    if (training && nutrition) return "Entrenamiento + Nutrición";
    if (training) return "Entrenamiento";
    if (nutrition) return "Nutrición";
    return "Coach";
  }, [me]);



async function handleCloseWelcome() {
  const optimisticUser = me
    ? {
        ...me,
        coachWelcome: {
          ...(me.coachWelcome || {}),
          show: false,
          seenAt: new Date().toISOString(),
        },
      }
    : me;

  setMe(optimisticUser);
  if (optimisticUser) setAuthLogged(optimisticUser);

  try {
    await apiFetch("/api/usuarios/users/me/coach-welcome-seen", {
      method: "PATCH",
    });
  } catch (error) {
    console.error("No se pudo marcar coachWelcome como visto:", error);
  }
}





  if (showWelcome) {
    const firstName = me?.profile?.nombre || "coach";

    return (
      <div className="pro-wrap pro-wrapCenter">
        <div className="pro-inner pro-innerNarrow">
          <div className="pro-welcome pro-welcomeFull">
            <div className="pro-welcomeBadge">Nuevo acceso</div>

            <p className="pro-hello">Hola, {firstName}</p>

            <h1 className="pro-welcomeTitle">Fuiste invitado como coach</h1>

            <p className="pro-welcomeText">
              Ya tenés acceso a tu panel profesional en ZumaFit.
            </p>

            <div className="pro-welcomeMeta">
              <span className="pro-chip">
                Plan: {String(me?.coachWelcome?.plan || "free").toUpperCase()}
              </span>
              <span className="pro-chip">
                Especialidad: {specialtyLabel}
              </span>
            </div>

            <button
              type="button"
              className="pro-btn"
              onClick={handleCloseWelcome}
              disabled={closingWelcome}
            >
              {closingWelcome ? "Cargando..." : "Continuar"}
            </button>
          </div>
        </div>

        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="pro-wrap">
      <div className="pro-inner">
        <div className="pro-hero">
          <h1 className="pro-title">Panel profesional</h1>
          <p className="pro-sub">
            Desde acá vas a poder gestionar clientes, planes y seguimiento.
          </p>
        </div>

        <div className="pro-grid">
          <Link to="/profesional/clientes" className="pro-card">
            <div className="pro-icon">👥</div>
            <div className="pro-cardTitle">Clientes</div>
            <div className="pro-cardText">Ver y administrar tus clientes.</div>
          </Link>

          {canTraining && (
            <Link to="/profesional/rutinas" className="pro-card">
              <div className="pro-icon">🏋️</div>
              <div className="pro-cardTitle">Rutinas</div>
              <div className="pro-cardText">Crear y editar entrenamientos.</div>
            </Link>
          )}

          {canNutrition && (
            <Link to="/profesional/menus" className="pro-card">
              <div className="pro-icon">🥗</div>
              <div className="pro-cardTitle">Menús</div>
              <div className="pro-cardText">
                Armar planes y seguimiento nutricional.
              </div>
            </Link>
          )}

          <Link to="/profesional/perfil" className="pro-card">
            <div className="pro-icon">⚙️</div>
            <div className="pro-cardTitle">Perfil profesional</div>
            <div className="pro-cardText">Datos, foto y configuración.</div>
          </Link>
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
.pro-wrap{
  min-height: calc(100dvh - 56px);
  background:#0b0b0b;
  color:#eaeaea;
  padding:16px;
}

.pro-wrapCenter{
  display:flex;
  align-items:flex-start;
  padding-top:12px;
}

.pro-inner{
  max-width:1100px;
  margin:0 auto;
  width:100%;
}

.pro-innerNarrow{
  max-width:760px;
}

.pro-welcome{
  margin-bottom:18px;
  border:1px solid rgba(245,215,110,.20);
  border-radius:26px;
  background:
    radial-gradient(circle at top, rgba(245,215,110,.08), transparent 35%),
    linear-gradient(180deg, rgba(14,17,23,.96), rgba(10,13,18,.98));
  padding:22px;
  box-shadow:
    0 18px 50px rgba(0,0,0,.30),
    inset 0 1px 0 rgba(255,255,255,.03);
}

.pro-welcomeFull{
  min-height:320px;
  display:flex;
  flex-direction:column;
  justify-content:flex-start;
}

.pro-welcomeBadge{
  display:inline-flex;
  align-items:center;
  width:max-content;
  padding:8px 12px;
  border-radius:999px;
  background:rgba(245,215,110,.10);
  border:1px solid rgba(245,215,110,.20);
  color:#f5d76e;
  font-size:12px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.05em;
}

.pro-hello{
  margin:16px 0 0;
  color:#f5d76e;
  font-size:15px;
  font-weight:900;
  letter-spacing:.01em;
}

.pro-welcomeTitle{
  margin:10px 0 0;
  font-size:40px;
  line-height:1.02;
  font-weight:1000;
  color:#f7f8fa;
  letter-spacing:-.03em;
}

.pro-welcomeText{
  margin:12px 0 0;
  color:#c6cfda;
  font-size:17px;
  line-height:1.55;
  max-width:560px;
}

.pro-welcomeMeta{
  margin-top:18px;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.pro-chip{
  display:inline-flex;
  align-items:center;
  padding:9px 12px;
  border-radius:999px;
  background:#0f141c;
  border:1px solid rgba(245,215,110,.14);
  color:#eaeaea;
  font-size:12px;
  font-weight:900;
}

.pro-btn{
  margin-top:20px;
  width:max-content;
  min-height:48px;
  padding:0 18px;
  border-radius:14px;
  border:1px solid rgba(245,215,110,.34);
  background:rgba(245,215,110,.10);
  color:#f5d76e;
  font-weight:900;
  font-size:15px;
  cursor:pointer;
  transition:.18s ease;
}

.pro-btn:hover{
  transform:translateY(-1px);
  border-color:rgba(245,215,110,.46);
}

.pro-btn:disabled{
  opacity:.7;
  cursor:not-allowed;
  transform:none;
}

.pro-hero{
  margin-bottom:18px;
}

.pro-title{
  margin:0;
  font-size:32px;
  font-weight:1000;
}

.pro-sub{
  margin:8px 0 0;
  color:#b8c0cc;
}

.pro-grid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0,1fr));
  gap:14px;
}

.pro-card{
  text-decoration:none;
  color:inherit;
  border:1px solid rgba(245,215,110,.16);
  border-radius:22px;
  background:linear-gradient(180deg, #0e1117, #0b0f15);
  padding:18px;
  display:flex;
  flex-direction:column;
  gap:8px;
  transition:.18s ease;
}

.pro-card:hover{
  transform:translateY(-2px);
  border-color:rgba(245,215,110,.28);
}

.pro-icon{
  font-size:28px;
}

.pro-cardTitle{
  font-size:20px;
  font-weight:900;
}

.pro-cardText{
  color:#9ea8b7;
}

@media (max-width: 700px){
  .pro-grid{
    grid-template-columns:1fr;
  }

  .pro-welcomeTitle{
    font-size:30px;
  }

  .pro-welcomeText{
    font-size:15px;
  }

  .pro-wrapCenter{
    padding-top:6px;
  }
}
`;
