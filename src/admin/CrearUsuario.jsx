import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../Api.js";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", emoji: "👑" },
  { value: "coach", label: "Coach", emoji: "🧠" },
];

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "vip", label: "VIP" },
];

export default function CrearUsuario() {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    role: "coach",
    plan: "free",
    coachProfile: {
      specialties: {
        training: true,
        nutrition: false,
      },
    },
  });

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((r) => r.value === form.role) || ROLE_OPTIONS[1],
    [form.role]
  );

  const isAdmin = form.role === "admin";
  const isCoach = form.role === "coach";
  const showPlan = isCoach;

  const specialtyLabel = useMemo(() => {
    const training = !!form?.coachProfile?.specialties?.training;
    const nutrition = !!form?.coachProfile?.specialties?.nutrition;

    if (training && nutrition) return "Entrenamiento + Nutrición";
    if (training) return "Entrenamiento";
    if (nutrition) return "Nutrición";
    return "Sin especialidad";
  }, [form]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setCoachSpecialty(name, value) {
    setForm((prev) => ({
      ...prev,
      coachProfile: {
        ...prev.coachProfile,
        specialties: {
          ...prev.coachProfile?.specialties,
          [name]: value,
        },
      },
    }));
  }

  function validate() {
    if (!form.nombre.trim()) return "Ingresá el nombre.";
    if (!form.apellido.trim()) return "Ingresá el apellido.";
    if (!form.email.trim()) return "Ingresá el email.";

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!emailOk) return "Ingresá un email válido.";

    if (!form.role) return "Elegí un rol.";
    if (showPlan && !form.plan) return "Elegí un plan.";

    if (isCoach) {
      const training = !!form?.coachProfile?.specialties?.training;
      const nutrition = !!form?.coachProfile?.specialties?.nutrition;

      if (!training && !nutrition) {
        return "Elegí al menos una especialidad para el coach.";
      }
    }

    return "";
  }

  function normalizePayload() {
    return {
      email: form.email.trim().toLowerCase(),
      role: form.role,
      plan: showPlan ? form.plan : null,
      profile: {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
      },
      coachProfile: isCoach
        ? {
            specialties: {
              training: !!form?.coachProfile?.specialties?.training,
              nutrition: !!form?.coachProfile?.specialties?.nutrition,
            },
          }
        : null,
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      return;
    }

    const payload = normalizePayload();

    try {
      setSaving(true);

      await apiFetch("/api/usuarios/admin/invitations", {
        method: "POST",
        body: payload,
        timeoutMs: 12000,
      });

      setOkMsg("Invitación creada correctamente.");

      setTimeout(() => {
        navigate("/admin/usuarios");
      }, 700);
    } catch (e2) {
      setErr(e2?.message || "No se pudo crear la invitación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="iu-page">
      <div className="iu-shell">
        <div className="iu-topbar">
          <button
            className="iu-backBtn"
            onClick={() => navigate("/admin/usuarios")}
            type="button"
          >
            ← Volver
          </button>
        </div>

        <div className="iu-layout">
          <section className="iu-card iu-main">
            <div className="iu-hero">
              <div>
                <div className="iu-kicker">Panel Admin</div>
                <h1 className="iu-title">Invitar usuario</h1>
                <p className="iu-sub">
                  Creá admins o coaches con una invitación simple por email. El
                  acceso profesional y sus módulos se definen por rol y
                  especialidades.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="iu-form">
              <div className="iu-grid">
                <div className="iu-field">
                  <label className="iu-label">Nombre</label>
                  <input
                    className="iu-input"
                    value={form.nombre}
                    onChange={(e) => setField("nombre", e.target.value)}
                    placeholder="Juan"
                  />
                </div>

                <div className="iu-field">
                  <label className="iu-label">Apellido</label>
                  <input
                    className="iu-input"
                    value={form.apellido}
                    onChange={(e) => setField("apellido", e.target.value)}
                    placeholder="Pérez"
                  />
                </div>

                <div className="iu-field iu-full">
                  <label className="iu-label">Email</label>
                  <input
                    className="iu-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="usuario@email.com"
                  />
                </div>
              </div>

              <div className="iu-block">
                <div className="iu-blockHead">
                  <h2 className="iu-h2">Rol</h2>
                  <p className="iu-small">
                    Elegí si va a ser admin o coach.
                  </p>
                </div>

                <div className="iu-roleGrid compact">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      className={`iu-roleCard ${
                        form.role === role.value ? "active" : ""
                      }`}
                      onClick={() => setField("role", role.value)}
                    >
                      <div className="iu-roleEmoji">{role.emoji}</div>
                      <div className="iu-roleLabel">{role.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {isCoach && (
                <div className="iu-block">
                  <div className="iu-blockHead">
                    <h2 className="iu-h2">Especialidades del coach</h2>
                    <p className="iu-small">
                      Definí qué módulos va a tener habilitados.
                    </p>
                  </div>

                  <div className="iu-specialties">
                    <button
                      type="button"
                      className={`iu-specialtyBtn ${
                        form?.coachProfile?.specialties?.training ? "active" : ""
                      }`}
                      onClick={() =>
                        setCoachSpecialty(
                          "training",
                          !form?.coachProfile?.specialties?.training
                        )
                      }
                    >
                      🏋️ Entrenamiento
                    </button>

                    <button
                      type="button"
                      className={`iu-specialtyBtn ${
                        form?.coachProfile?.specialties?.nutrition ? "active" : ""
                      }`}
                      onClick={() =>
                        setCoachSpecialty(
                          "nutrition",
                          !form?.coachProfile?.specialties?.nutrition
                        )
                      }
                    >
                      🥗 Nutrición
                    </button>
                  </div>

                  <div className="iu-note">
                    Configuración actual: <strong>{specialtyLabel}</strong>
                  </div>
                </div>
              )}

              {showPlan ? (
                <div className="iu-block">
                  <div className="iu-blockHead">
                    <h2 className="iu-h2">Plan</h2>
                    <p className="iu-small">
                      Podés cambiarlo más adelante si querés.
                    </p>
                  </div>

                  <div className="iu-planRow">
                    {PLAN_OPTIONS.map((plan) => (
                      <button
                        key={plan.value}
                        type="button"
                        className={`iu-planBtn ${
                          form.plan === plan.value ? "active" : ""
                        }`}
                        onClick={() => setField("plan", plan.value)}
                      >
                        {plan.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="iu-note">
                  Los admins no necesitan plan ni especialidades.
                </div>
              )}

              {err ? <div className="iu-alert error">{err}</div> : null}
              {okMsg ? <div className="iu-alert ok">{okMsg}</div> : null}

              <div className="iu-actions">
                <button
                  type="button"
                  className="iu-btn iu-btnGhost"
                  onClick={() => navigate("/admin/usuarios")}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="iu-btn iu-btnGold"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Crear invitación"}
                </button>
              </div>
            </form>
          </section>

          <aside className="iu-card iu-side">
            <div className="iu-sideHead">
              <span className="iu-sidePill">Vista previa</span>
            </div>

            <div className="iu-preview">
              <div className="iu-avatar">
                {initials(form.nombre, form.apellido)}
              </div>

              <div className="iu-name">
                {(form.nombre.trim() || "Nombre") +
                  " " +
                  (form.apellido.trim() || "Apellido")}
              </div>

              <div className="iu-email">
                {form.email.trim() || "usuario@email.com"}
              </div>

              <div className="iu-tags">
                <span className="iu-tag">{selectedRole.label}</span>
                {isCoach ? <span className="iu-tag">{specialtyLabel}</span> : null}
                {showPlan ? (
                  <span className="iu-tag">{form.plan.toUpperCase()}</span>
                ) : null}
              </div>
            </div>

            <div className="iu-note">
              Para coaches, la invitación va a guardar{" "}
              <strong>coachProfile.specialties</strong>. Después, cuando entre,
              el sistema crea el usuario real con esos permisos.
            </div>
          </aside>
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}

function initials(nombre = "", apellido = "") {
  const a = String(nombre || "").trim()[0] || "U";
  const b = String(apellido || "").trim()[0] || "X";
  return (a + b).toUpperCase();
}

const styles = `
.iu-page{
  min-height:100dvh;
  background:
    radial-gradient(circle at top, rgba(245,215,110,.08), transparent 30%),
    linear-gradient(180deg, #07090d 0%, #090c11 100%);
  color:#eaeaea;
  padding:16px;
}

.iu-shell{
  max-width:1180px;
  margin:0 auto;
}

.iu-topbar{
  margin-bottom:14px;
}

.iu-backBtn{
  border:1px solid rgba(245,215,110,.24);
  background:#0d1117;
  color:#f5d76e;
  border-radius:14px;
  padding:10px 14px;
  font-weight:800;
  cursor:pointer;
  transition:.18s ease;
}

.iu-backBtn:hover{
  transform:translateY(-1px);
  border-color: rgba(245,215,110,.36);
}

.iu-layout{
  display:grid;
  grid-template-columns: minmax(0, 1.2fr) 360px;
  gap:16px;
  align-items:start;
}

.iu-card{
  border:1px solid rgba(245,215,110,.14);
  background:linear-gradient(180deg, rgba(14,17,23,.94), rgba(10,13,18,.96));
  border-radius:26px;
  box-shadow:
    0 18px 50px rgba(0,0,0,.28),
    inset 0 1px 0 rgba(255,255,255,.03);
}

.iu-main{
  padding:24px;
}

.iu-side{
  padding:18px;
  position:sticky;
  top:14px;
}

.iu-kicker{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 12px;
  border-radius:999px;
  background:rgba(245,215,110,.08);
  border:1px solid rgba(245,215,110,.16);
  color:#f5d76e;
  font-size:12px;
  font-weight:900;
  letter-spacing:.4px;
  text-transform:uppercase;
}

.iu-title{
  margin:14px 0 0;
  font-size:38px;
  line-height:1.05;
  letter-spacing:-.03em;
  color:#f7f8fa;
}

.iu-sub{
  margin:10px 0 0;
  max-width:720px;
  color:#a8b1bf;
  font-size:15px;
  line-height:1.55;
}

.iu-form{
  margin-top:24px;
  display:flex;
  flex-direction:column;
  gap:22px;
}

.iu-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

.iu-field{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.iu-full{
  grid-column:1 / -1;
}

.iu-label{
  font-size:12px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:#c5ced8;
}

.iu-input{
  width:100%;
  min-height:50px;
  border-radius:16px;
  border:1px solid #26303c;
  background:#0b0f15;
  color:#eaeaea;
  padding:0 14px;
  outline:none;
  transition:.18s ease;
  font-size:15px;
}

.iu-input:focus{
  border-color: rgba(245,215,110,.42);
  box-shadow:0 0 0 4px rgba(245,215,110,.10);
}

.iu-block{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.iu-blockHead{
  display:flex;
  flex-direction:column;
  gap:4px;
}

.iu-h2{
  margin:0;
  font-size:19px;
  color:#f4f6f8;
}

.iu-small{
  margin:0;
  color:#97a3b4;
  font-size:13px;
}

.iu-roleGrid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:12px;
}

.iu-roleGrid.compact{
  grid-template-columns:repeat(2, minmax(0, 1fr));
}

.iu-roleCard{
  min-height:96px;
  border-radius:20px;
  border:1px solid #28313d;
  background:#0b0f15;
  color:#eaeaea;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  justify-content:center;
  gap:8px;
  padding:16px;
  cursor:pointer;
  transition:.18s ease;
  text-align:left;
}

.iu-roleCard:hover{
  transform:translateY(-2px);
  border-color:rgba(245,215,110,.30);
}

.iu-roleCard.active{
  border-color:rgba(245,215,110,.45);
  background:linear-gradient(180deg, rgba(245,215,110,.08), rgba(245,215,110,.03));
  box-shadow:0 0 0 4px rgba(245,215,110,.08);
}

.iu-roleEmoji{
  font-size:24px;
}

.iu-roleLabel{
  font-size:15px;
  font-weight:900;
  line-height:1.2;
}

.iu-specialties{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:12px;
}

.iu-specialtyBtn{
  min-height:56px;
  padding:12px 16px;
  border-radius:16px;
  border:1px solid #2a3440;
  background:#0b0f15;
  color:#d7dde5;
  font-weight:900;
  cursor:pointer;
  transition:.18s ease;
  text-align:left;
}

.iu-specialtyBtn.active{
  border-color:rgba(245,215,110,.45);
  background:rgba(245,215,110,.08);
  color:#f5d76e;
  box-shadow:0 0 0 4px rgba(245,215,110,.08);
}

.iu-planRow{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.iu-planBtn{
  min-width:92px;
  padding:12px 16px;
  border-radius:14px;
  border:1px solid #2a3440;
  background:#0b0f15;
  color:#d7dde5;
  font-weight:900;
  cursor:pointer;
  transition:.18s ease;
}

.iu-planBtn.active{
  border-color:rgba(245,215,110,.45);
  background:rgba(245,215,110,.08);
  color:#f5d76e;
}

.iu-sideHead{
  display:flex;
  justify-content:flex-start;
  margin-bottom:12px;
}

.iu-sidePill{
  padding:8px 12px;
  border-radius:999px;
  border:1px solid rgba(245,215,110,.16);
  color:#f5d76e;
  background:rgba(245,215,110,.06);
  font-size:12px;
  font-weight:900;
}

.iu-preview{
  border:1px solid rgba(245,215,110,.14);
  background:linear-gradient(180deg, #0d1118, #0a0e14);
  border-radius:22px;
  padding:22px 16px;
  display:flex;
  flex-direction:column;
  align-items:center;
  text-align:center;
}

.iu-avatar{
  width:92px;
  height:92px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  background:radial-gradient(circle at top, rgba(245,215,110,.16), rgba(255,255,255,.02));
  border:1px solid rgba(245,215,110,.22);
  color:#f5d76e;
  font-size:28px;
  font-weight:1000;
}

.iu-name{
  margin-top:14px;
  font-size:20px;
  font-weight:900;
  color:#f4f6f8;
  line-height:1.2;
}

.iu-email{
  margin-top:8px;
  color:#9eadbf;
  font-size:14px;
  word-break:break-word;
}

.iu-tags{
  margin-top:14px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:center;
}

.iu-tag{
  border:1px solid #28313d;
  background:#0b0f15;
  color:#d7dde5;
  border-radius:999px;
  padding:7px 10px;
  font-size:11px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.05em;
}

.iu-note{
  margin-top:14px;
  border:1px dashed rgba(245,215,110,.18);
  background:rgba(245,215,110,.04);
  color:#d4dbe4;
  border-radius:16px;
  padding:12px 14px;
  font-size:13px;
  line-height:1.5;
}

.iu-alert{
  border-radius:14px;
  padding:12px 14px;
  font-weight:800;
}

.iu-alert.error{
  border:1px solid rgba(255,80,80,.24);
  background:rgba(255,80,80,.08);
  color:#ffb9b9;
}

.iu-alert.ok{
  border:1px solid rgba(80,220,140,.24);
  background:rgba(80,220,140,.08);
  color:#bff7d5;
}

.iu-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  flex-wrap:wrap;
}

.iu-btn{
  min-height:48px;
  padding:0 16px;
  border-radius:14px;
  font-weight:900;
  cursor:pointer;
  transition:.18s ease;
}

.iu-btnGhost{
  border:1px solid #2b313a;
  background:#0d1117;
  color:#e5e7eb;
}

.iu-btnGold{
  border:1px solid rgba(245,215,110,.34);
  background:rgba(245,215,110,.08);
  color:#f5d76e;
}

.iu-btn:hover{
  transform:translateY(-1px);
}

@media (max-width: 980px){
  .iu-layout{
    grid-template-columns:1fr;
  }

  .iu-side{
    position:static;
  }
}

@media (max-width: 640px){
  .iu-page{
    padding:10px;
  }

  .iu-main,
  .iu-side{
    padding:16px;
  }

  .iu-title{
    font-size:30px;
  }

  .iu-grid{
    grid-template-columns:1fr;
  }

  .iu-roleGrid,
  .iu-roleGrid.compact,
  .iu-specialties{
    grid-template-columns:1fr;
  }

  .iu-actions{
    flex-direction:column-reverse;
  }

  .iu-btn{
    width:100%;
  }
}
`;
