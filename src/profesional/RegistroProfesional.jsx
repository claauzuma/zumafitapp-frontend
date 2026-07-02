import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, ShieldCheck } from "lucide-react";

import { registerProfessionalApplication } from "../professionalAccessApi.js";
import BrandLogo from "../ui/BrandLogo.jsx";
import fondoZumaFit from "../assets/fondozumafit.png";

const INITIAL = {
  email: "",
  password: "",
  confirmPassword: "",
  telefono: "",
  nombre: "",
  apellido: "",
  documento: "",
  pais: "",
  provincia: "",
  ciudad: "",
  tipo: "personal_trainer",
  experiencia: "",
  biografia: "",
  modalidad: "online",
  disponibilidad: "",
  training: true,
  nutrition: false,
  certificacion: "",
  institucion: "",
  numero: "",
  matricula: "",
  documentoRespaldoUrl: "",
  vencimiento: "",
  termsAccepted: false,
  truthDeclarationAccepted: false,
  reviewConsentAccepted: false,
};

export default function RegistroProfesional() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const canSubmit = useMemo(
    () => form.termsAccepted && form.truthDeclarationAccepted && form.reviewConsentAccepted && !saving,
    [form, saving]
  );

  function patch(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        account: {
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
          telefono: form.telefono,
        },
        personal: {
          nombre: form.nombre,
          apellido: form.apellido,
          documento: form.documento,
          pais: form.pais,
          provincia: form.provincia,
          ciudad: form.ciudad,
        },
        professional: {
          tipo: form.tipo,
          experiencia: form.experiencia,
          biografia: form.biografia,
          modalidad: form.modalidad,
          disponibilidad: form.disponibilidad,
        },
        requestedScopes: {
          training: form.training,
          nutrition: form.nutrition,
        },
        credentials: {
          certificacion: form.certificacion,
          institucion: form.institucion,
          numero: form.numero,
          matricula: form.matricula,
          documentoRespaldoUrl: form.documentoRespaldoUrl,
          vencimiento: form.vencimiento,
        },
        termsAccepted: form.termsAccepted,
        truthDeclarationAccepted: form.truthDeclarationAccepted,
        reviewConsentAccepted: form.reviewConsentAccepted,
      };
      const data = await registerProfessionalApplication(payload);
      setSuccess(data?.application || data);
    } catch (err) {
      setError(err?.message || "No pudimos enviar tu solicitud.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <main className="rp-page" style={{ "--rp-bg": `url(${fondoZumaFit})` }}>
        <section className="rp-shell">
          <BrandLogo size="client" priority />
          <article className="rp-card center">
            <CheckCircle2 size={42} />
            <span className="rp-kicker">Solicitud recibida</span>
            <h1>Tu perfil queda en revisión</h1>
            <p>
              Creamos tu cuenta profesional en estado pendiente. Un admin debe aprobar tus scopes y tu suscripción antes
              de que puedas administrar clientes.
            </p>
            <Link className="rp-primary" to="/login">Ir a iniciar sesión</Link>
          </article>
        </section>
        <style>{styles}</style>
      </main>
    );
  }

  return (
    <main className="rp-page" style={{ "--rp-bg": `url(${fondoZumaFit})` }}>
      <section className="rp-shell">
        <header className="rp-head">
          <BrandLogo size="client" priority />
          <Link to="/register" className="rp-back">
            <ArrowLeft size={17} />
            Crear cuenta como cliente
          </Link>
        </header>

        <form className="rp-card" onSubmit={submit}>
          <div className="rp-titleRow">
            <span className="rp-icon"><BriefcaseBusiness size={22} /></span>
            <div>
              <span className="rp-kicker">Registro profesional</span>
              <h1>Postulate como coach ZumaFit</h1>
              <p>Tu cuenta queda pendiente hasta que Admin valide credenciales, scopes y plan profesional.</p>
            </div>
          </div>

          <div className="rp-steps" aria-label="Pasos">
            {[1, 2, 3, 4].map((item) => (
              <button key={item} type="button" className={step === item ? "active" : ""} onClick={() => setStep(item)}>
                {item}
              </button>
            ))}
          </div>

          {step === 1 ? (
            <div className="rp-grid">
              <Field label="Email" value={form.email} onChange={(v) => patch("email", v)} type="email" />
              <Field label="Teléfono" value={form.telefono} onChange={(v) => patch("telefono", v)} />
              <Field label="Contraseña" value={form.password} onChange={(v) => patch("password", v)} type="password" />
              <Field label="Confirmación" value={form.confirmPassword} onChange={(v) => patch("confirmPassword", v)} type="password" />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="rp-grid">
              <Field label="Nombre" value={form.nombre} onChange={(v) => patch("nombre", v)} />
              <Field label="Apellido" value={form.apellido} onChange={(v) => patch("apellido", v)} />
              <Field label="Documento" value={form.documento} onChange={(v) => patch("documento", v)} />
              <Field label="País" value={form.pais} onChange={(v) => patch("pais", v)} />
              <Field label="Provincia" value={form.provincia} onChange={(v) => patch("provincia", v)} />
              <Field label="Ciudad" value={form.ciudad} onChange={(v) => patch("ciudad", v)} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="rp-grid">
              <label>
                Tipo profesional
                <select value={form.tipo} onChange={(e) => patch("tipo", e.target.value)}>
                  <option value="personal_trainer">Personal trainer</option>
                  <option value="nutritionist">Nutricionista</option>
                  <option value="integral">Integral</option>
                  <option value="other_verified">Otro verificado</option>
                </select>
              </label>
              <label>
                Modalidad
                <select value={form.modalidad} onChange={(e) => patch("modalidad", e.target.value)}>
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                  <option value="mixta">Mixta</option>
                </select>
              </label>
              <TextArea label="Experiencia" value={form.experiencia} onChange={(v) => patch("experiencia", v)} />
              <TextArea label="Biografía" value={form.biografia} onChange={(v) => patch("biografia", v)} />
              <TextArea label="Disponibilidad" value={form.disponibilidad} onChange={(v) => patch("disponibilidad", v)} />
              <div className="rp-scopeBox">
                <strong>Scopes solicitados</strong>
                <Check label="Entrenamiento" checked={form.training} onChange={(v) => patch("training", v)} />
                <Check label="Nutrición" checked={form.nutrition} onChange={(v) => patch("nutrition", v)} />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="rp-grid">
              <Field label="Certificación" value={form.certificacion} onChange={(v) => patch("certificacion", v)} />
              <Field label="Institución" value={form.institucion} onChange={(v) => patch("institucion", v)} />
              <Field label="Número / credencial" value={form.numero} onChange={(v) => patch("numero", v)} />
              <Field label="Matrícula" value={form.matricula} onChange={(v) => patch("matricula", v)} />
              <Field label="URL de respaldo" value={form.documentoRespaldoUrl} onChange={(v) => patch("documentoRespaldoUrl", v)} />
              <Field label="Vencimiento" value={form.vencimiento} onChange={(v) => patch("vencimiento", v)} type="date" />
              <div className="rp-terms">
                <Check label="Acepto los términos" checked={form.termsAccepted} onChange={(v) => patch("termsAccepted", v)} />
                <Check label="Declaro que la información es real" checked={form.truthDeclarationAccepted} onChange={(v) => patch("truthDeclarationAccepted", v)} />
                <Check label="Acepto revisión administrativa" checked={form.reviewConsentAccepted} onChange={(v) => patch("reviewConsentAccepted", v)} />
              </div>
            </div>
          ) : null}

          {error ? <div className="rp-error">{error}</div> : null}

          <div className="rp-actions">
            <button type="button" className="rp-secondary" disabled={step === 1 || saving} onClick={() => setStep((s) => Math.max(1, s - 1))}>
              Anterior
            </button>
            {step < 4 ? (
              <button type="button" className="rp-primary" onClick={() => setStep((s) => Math.min(4, s + 1))}>
                Continuar
              </button>
            ) : (
              <button type="submit" className="rp-primary" disabled={!canSubmit}>
                {saving ? "Enviando..." : "Enviar solicitud"}
              </button>
            )}
          </div>

          <div className="rp-note">
            <ShieldCheck size={16} />
            No se guardan archivos binarios en MongoDB. Usá referencias seguras si necesitás adjuntar documentación.
          </div>
        </form>
      </section>
      <style>{styles}</style>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label>
      {label}
      <input value={value} type={type} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="wide">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} />
    </label>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="rp-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

const styles = `
.rp-page{
  min-height:100dvh;
  color:#f5f7fa;
  padding:18px;
  background:
    linear-gradient(180deg, rgba(2,5,8,.30), rgba(2,5,8,.72) 38%, #020507 100%),
    linear-gradient(90deg, rgba(2,5,8,.94), rgba(2,5,8,.58)),
    var(--rp-bg);
  background-size:cover;
  background-position:center top;
}
.rp-shell{width:min(980px,100%);margin:0 auto}
.rp-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}
.rp-back,.rp-secondary{border:1px solid rgba(255,255,255,.12);background:#111821;color:#eef2f6;border-radius:16px;min-height:44px;padding:0 14px;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:900}
.rp-card{border:1px solid rgba(245,215,110,.20);border-radius:28px;background:radial-gradient(circle at top right,rgba(245,215,110,.14),transparent 32%),linear-gradient(145deg,rgba(17,24,32,.94),rgba(8,12,18,.96));box-shadow:0 28px 80px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.05);padding:22px;backdrop-filter:blur(14px)}
.rp-card.center{display:grid;place-items:start;gap:12px;max-width:620px;margin:36px auto}
.rp-titleRow{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start}
.rp-icon{width:48px;height:48px;border-radius:16px;border:1px solid rgba(245,215,110,.22);background:rgba(245,215,110,.10);color:#f5d76e;display:grid;place-items:center}
.rp-kicker{display:inline-flex;color:#f5d76e;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.04em}
.rp-card h1{margin:6px 0 0;font-size:clamp(28px,6vw,46px);line-height:1.02;letter-spacing:0}
.rp-card p{margin:9px 0 0;color:#bbc6d2;line-height:1.5}
.rp-steps{display:flex;gap:8px;margin:22px 0}
.rp-steps button{width:40px;height:40px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:#0c1219;color:#fff;font-weight:1000}
.rp-steps .active{background:#f5d76e;color:#0b0b0b;border-color:#f5d76e}
.rp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.rp-grid label{display:grid;gap:7px;color:#c9d3df;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
.rp-grid input,.rp-grid select,.rp-grid textarea{width:100%;border:1px solid rgba(255,255,255,.10);background:#081018;color:#f7fafc;border-radius:14px;min-height:46px;padding:0 13px;font:inherit;font-weight:800;outline:none}
.rp-grid textarea{padding:12px 13px;resize:vertical;text-transform:none;font-weight:700;line-height:1.4}
.wide{grid-column:1/-1}
.rp-scopeBox,.rp-terms{grid-column:1/-1;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.03);padding:14px;display:grid;gap:10px}
.rp-check{display:flex!important;grid-template-columns:none!important;align-items:center;gap:10px;text-transform:none!important;letter-spacing:0!important;color:#eef2f6!important;font-size:14px!important}
.rp-check input{width:18px!important;height:18px!important;min-height:0!important;padding:0!important;accent-color:#f5d76e}
.rp-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
.rp-primary{border:0;background:linear-gradient(135deg,#ffca20,#ffe57a);color:#090909;border-radius:16px;min-height:46px;padding:0 18px;font-weight:1000;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.rp-primary:disabled{opacity:.55}
.rp-error{margin-top:16px;border:1px solid rgba(255,90,90,.32);background:rgba(255,90,90,.10);color:#ffd1d1;border-radius:16px;padding:12px;font-weight:800}
.rp-note{margin-top:16px;color:#aeb9c5;display:flex;gap:8px;align-items:center;font-size:13px}
@media (max-width:720px){.rp-page{padding:12px}.rp-head{align-items:flex-start}.rp-card{padding:16px;border-radius:22px}.rp-titleRow{grid-template-columns:1fr}.rp-grid{grid-template-columns:1fr}.rp-actions{display:grid;grid-template-columns:1fr}.rp-secondary,.rp-primary{width:100%;justify-content:center}}
`;
