import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../Api";
import "./Perfil.css";

const PERFIL_CACHE_KEY = "zumafit_perfil_cache_v1";
const PERFIL_REFRESH_MS = 30_000;
const PERFIL_ME_ENDPOINT = "/api/usuarios/users/me";
const PERFIL_UPDATED_AT_ENDPOINT = "/api/usuarios/users/me/updatedAt";

function initialsOf(nombre, apellido, fallbackEmail) {
  const n = String(nombre || "").trim();
  const a = String(apellido || "").trim();
  if (n || a) {
    return `${n ? n[0].toUpperCase() : ""}${a ? a[0].toUpperCase() : ""}`.slice(0, 2) || "Z";
  }
  const e = String(fallbackEmail || "").trim();
  return e ? e[0].toUpperCase() : "Z";
}

function fmtValue(v, suffix = "") {
  if (v === null || v === undefined || v === "") return "—";
  return `${v}${suffix}`;
}

function labelGoal(goalType) {
  if (goalType === "perder_peso") return "Perder peso";
  if (goalType === "mantener_peso") return "Mantener peso";
  if (goalType === "ganar_peso") return "Ganar peso";
  return "—";
}

function labelDiet(v) {
  if (v === "equilibrada") return "Equilibrada";
  if (v === "baja_grasa") return "Baja en grasa";
  if (v === "baja_carbo") return "Baja en carbohidratos";
  if (v === "keto") return "Keto";
  return "—";
}

function labelTraining(v) {
  if (v === "none") return "Nada o actividad suave";
  if (v === "lifting") return "Musculación";
  if (v === "cardio") return "Cardio";
  if (v === "both") return "Cardio + musculación";
  return "—";
}

function labelProtein(v) {
  if (v === "low") return "Baja";
  if (v === "moderate") return "Moderada";
  if (v === "high") return "Alta";
  if (v === "extra_high") return "Extra alta";
  return "—";
}

function labelDist(v) {
  if (v === "shift") return "Mover calorías";
  if (v === "even") return "Distribuir parejo";
  return "—";
}

function readPerfilCache() {
  try {
    const raw = localStorage.getItem(PERFIL_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writePerfilCache(data) {
  try {
    localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function normalizeUpdatedAt(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? raw : String(parsed);
}

function extractUpdatedAt(payload) {
  return normalizeUpdatedAt(
    payload?.updatedAt ??
      payload?.user?.updatedAt ??
      payload?.profile?.updatedAt ??
      payload?.data?.updatedAt ??
      payload?.result?.updatedAt ??
      null
  );
}

export default function Perfil() {
  const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingBasics, setSavingBasics] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingBasics, setEditingBasics] = useState(false);
  const [msg, setMsg] = useState(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState("");
  const [estado, setEstado] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");

  const [sexo, setSexo] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [alturaCm, setAlturaCm] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  const [grasaPct, setGrasaPct] = useState("");
  const [tendenciaPeso, setTendenciaPeso] = useState("");
  const [frecuenciaEjercicio, setFrecuenciaEjercicio] = useState("");
  const [actividadDiaria, setActividadDiaria] = useState("");
  const [experienciaPesas, setExperienciaPesas] = useState("");
  const [tdeeEstimado, setTdeeEstimado] = useState("");

  const [goal, setGoal] = useState(null);
  const [program, setProgram] = useState(null);

  const [snapPersonal, setSnapPersonal] = useState(null);
  const [snapBasics, setSnapBasics] = useState(null);

  const mountedRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const checkInFlightRef = useRef(false);
  const lastSyncAtRef = useRef(0);
  const lastKnownUpdatedAtRef = useRef(null);

  function hydrateProfile(data) {
    setEmail(data?.email || "");
    setRole(data?.role || "");
    setPlan(data?.plan || "");
    setEstado(data?.estado || "");
    setAvatarUrl(data?.profile?.avatarUrl || "");

    setNombre(data?.profile?.nombre || "");
    setApellido(data?.profile?.apellido || "");
    setTelefono(data?.profile?.telefono || "");
    setCiudad(data?.profile?.ciudad || "");

    setSexo(data?.profile?.basics?.genero || "");
    setFechaNacimiento(data?.profile?.basics?.fechaNacimiento || "");

    setAlturaCm(
      data?.antropometriaActual?.alturaCm !== undefined &&
      data?.antropometriaActual?.alturaCm !== null
        ? String(data.antropometriaActual.alturaCm)
        : ""
    );

    setPesoKg(
      data?.antropometriaActual?.pesoKg !== undefined &&
      data?.antropometriaActual?.pesoKg !== null
        ? String(data.antropometriaActual.pesoKg)
        : ""
    );

    setGrasaPct(
      data?.antropometriaActual?.grasaPct !== undefined &&
      data?.antropometriaActual?.grasaPct !== null
        ? String(data.antropometriaActual.grasaPct)
        : ""
    );

    setTendenciaPeso(data?.profile?.basics?.tendenciaPeso || "");
    setFrecuenciaEjercicio(data?.profile?.basics?.frecuenciaEjercicio || "");
    setActividadDiaria(data?.profile?.basics?.actividadDiaria || "");
    setExperienciaPesas(data?.profile?.basics?.experienciaPesas || "");
    setTdeeEstimado(
      data?.profile?.basics?.tdeeEstimado !== undefined &&
      data?.profile?.basics?.tdeeEstimado !== null
        ? String(data.profile.basics.tdeeEstimado)
        : ""
    );

    setGoal(data?.goal || null);
    setProgram(data?.program || null);
  }

  function commitProfileData(data, options = {}) {
    const { fallbackUpdatedAt = null } = options;

    writePerfilCache(data);
    hydrateProfile(data);

    const nextUpdatedAt = extractUpdatedAt(data) ?? normalizeUpdatedAt(fallbackUpdatedAt);
    if (nextUpdatedAt) {
      lastKnownUpdatedAtRef.current = nextUpdatedAt;
    }
  }

  async function refetchPerfilSilently(options = {}) {
    const {
      showOfflineMessage = false,
      minGapMs = 3000,
      fallbackUpdatedAt = null,
    } = options;

    const now = Date.now();
    if (refreshInFlightRef.current) return null;
    if (now - lastSyncAtRef.current < minGapMs) return null;

    refreshInFlightRef.current = true;
    lastSyncAtRef.current = now;

    try {
      const data = await apiFetch(PERFIL_ME_ENDPOINT);
      if (!mountedRef.current) return null;

      console.log("PERFIL /users/me =>", data);
      commitProfileData(data, { fallbackUpdatedAt });
      return data;
    } catch (e) {
      if (mountedRef.current && showOfflineMessage) {
        setMsg({ type: "warn", text: "Mostrando datos guardados localmente" });
      }
      return null;
    } finally {
      refreshInFlightRef.current = false;
    }
  }

  async function checkPerfilChangesSilently(options = {}) {
    const { showOfflineMessage = false, minGapMs = 3000 } = options;

    const now = Date.now();
    if (checkInFlightRef.current || refreshInFlightRef.current) return null;
    if (now - lastSyncAtRef.current < minGapMs) return null;

    checkInFlightRef.current = true;
    lastSyncAtRef.current = now;

    try {
      const updatedAtResponse = await apiFetch(PERFIL_UPDATED_AT_ENDPOINT);
      if (!mountedRef.current) return null;

      console.log("PERFIL /users/me/updatedAt =>", updatedAtResponse);

      const remoteUpdatedAt = extractUpdatedAt(updatedAtResponse);
      const localUpdatedAt = lastKnownUpdatedAtRef.current;

      if (!remoteUpdatedAt || !localUpdatedAt || remoteUpdatedAt !== localUpdatedAt) {
        return await refetchPerfilSilently({
          showOfflineMessage,
          minGapMs: 0,
          fallbackUpdatedAt: remoteUpdatedAt,
        });
      }

      return null;
    } catch (e) {
      if (mountedRef.current && showOfflineMessage) {
        setMsg({ type: "warn", text: "Mostrando datos guardados localmente" });
      }
      return null;
    } finally {
      checkInFlightRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        setMsg(null);

        const cached = readPerfilCache();

        if (cached) {
          hydrateProfile(cached);

          const cachedUpdatedAt = extractUpdatedAt(cached);
          if (cachedUpdatedAt) {
            lastKnownUpdatedAtRef.current = cachedUpdatedAt;
          }

          setLoading(false);

          await checkPerfilChangesSilently({
            showOfflineMessage: false,
            minGapMs: 0,
          });

          return;
        }

        const data = await apiFetch(PERFIL_ME_ENDPOINT);
        if (!mountedRef.current) return;

        console.log("PERFIL /users/me =>", data);
        commitProfileData(data);
      } catch (e) {
        if (mountedRef.current) {
          const hadCache = !!readPerfilCache();
          if (!hadCache) {
            setMsg({ type: "warn", text: e?.message || "No pude cargar el perfil" });
          } else {
            setMsg({ type: "warn", text: "Mostrando datos guardados localmente" });
          }
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function handleWindowFocus() {
      if (editingPersonal || editingBasics || savingPersonal || savingBasics) return;
      checkPerfilChangesSilently({ showOfflineMessage: false, minGapMs: 3000 });
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (editingPersonal || editingBasics || savingPersonal || savingBasics) return;
      checkPerfilChangesSilently({ showOfflineMessage: false, minGapMs: 3000 });
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [editingPersonal, editingBasics, savingPersonal, savingBasics]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (editingPersonal || editingBasics || savingPersonal || savingBasics) return;
      checkPerfilChangesSilently({ showOfflineMessage: false, minGapMs: 3000 });
    }, PERFIL_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [editingPersonal, editingBasics, savingPersonal, savingBasics]);

  useEffect(() => {
    if (editingPersonal) {
      setSnapPersonal({ nombre, apellido, telefono, ciudad });
    }
  }, [editingPersonal, nombre, apellido, telefono, ciudad]);

  useEffect(() => {
    if (editingBasics) {
      setSnapBasics({
        sexo,
        fechaNacimiento,
        alturaCm,
        pesoKg,
        grasaPct,
        tendenciaPeso,
        frecuenciaEjercicio,
        actividadDiaria,
        experienciaPesas,
        tdeeEstimado,
      });
    }
  }, [
    editingBasics,
    sexo,
    fechaNacimiento,
    alturaCm,
    pesoKg,
    grasaPct,
    tendenciaPeso,
    frecuenciaEjercicio,
    actividadDiaria,
    experienciaPesas,
    tdeeEstimado,
  ]);

  function cancelarEdicionPersonal() {
    if (snapPersonal) {
      setNombre(snapPersonal.nombre);
      setApellido(snapPersonal.apellido);
      setTelefono(snapPersonal.telefono);
      setCiudad(snapPersonal.ciudad);
    }
    setEditingPersonal(false);
    setMsg(null);
  }

  function cancelarEdicionBasics() {
    if (snapBasics) {
      setSexo(snapBasics.sexo);
      setFechaNacimiento(snapBasics.fechaNacimiento);
      setAlturaCm(snapBasics.alturaCm);
      setPesoKg(snapBasics.pesoKg);
      setGrasaPct(snapBasics.grasaPct);
      setTendenciaPeso(snapBasics.tendenciaPeso);
      setFrecuenciaEjercicio(snapBasics.frecuenciaEjercicio);
      setActividadDiaria(snapBasics.actividadDiaria);
      setExperienciaPesas(snapBasics.experienciaPesas);
      setTdeeEstimado(snapBasics.tdeeEstimado);
    }
    setEditingBasics(false);
    setMsg(null);
  }

  async function guardarPersonal() {
    try {
      setSavingPersonal(true);
      setMsg(null);

      const payload = {
        profile: {
          nombre: String(nombre || "").trim(),
          apellido: String(apellido || "").trim(),
          telefono: String(telefono || "").trim(),
          ciudad: String(ciudad || "").trim(),
        },
      };

      await apiFetch(PERFIL_ME_ENDPOINT, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const fresh = await refetchPerfilSilently({ showOfflineMessage: false, minGapMs: 0 });
      setEditingPersonal(false);
      setMsg({ type: "ok", text: "Datos personales actualizados ✅" });
      return fresh;
    } catch (e) {
      setMsg({ type: "warn", text: e?.message || "No pude guardar datos personales" });
    } finally {
      setSavingPersonal(false);
    }
  }

  async function guardarBasics() {
    try {
      setSavingBasics(true);
      setMsg(null);

      const payload = {
        sexo: sexo || null,
        fechaNacimiento: fechaNacimiento || null,
        alturaCm: alturaCm === "" ? null : Number(alturaCm),
        pesoKg: pesoKg === "" ? null : Number(pesoKg),
        grasaPct: grasaPct === "" ? null : Number(grasaPct),
        tendenciaPeso: tendenciaPeso || null,
        frecuenciaEjercicio: frecuenciaEjercicio || null,
        actividadDiaria: actividadDiaria || null,
        experienciaPesas: experienciaPesas || null,
      };

      if (tdeeEstimado !== "") {
        payload.tdeeEstimado = Number(tdeeEstimado);
      }

      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify({
          step: 1,
          data: payload,
        }),
      });

      const fresh = await refetchPerfilSilently({ showOfflineMessage: false, minGapMs: 0 });
      setEditingBasics(false);
      setMsg({ type: "ok", text: "Datos físicos actualizados ✅" });
      return fresh;
    } catch (e) {
      setMsg({ type: "warn", text: e?.message || "No pude guardar tus datos físicos" });
    } finally {
      setSavingBasics(false);
    }
  }

  const avatarText = initialsOf(nombre, apellido, email);
  const fullName = `${nombre || ""} ${apellido || ""}`.trim() || "Tu perfil";

  return (
    <div className="p-wrap">
      <div className="p-inner">
        <div className="p-head">
          <div className="p-titleWrap">
            <div className="p-titleRow">
              <span className="p-titleIcon" aria-hidden="true">👤</span>
              <h1 className="p-title">Perfil</h1>
            </div>
            <p className="p-sub">
              Tus datos, tu estado actual y la configuración principal de tu plan.
            </p>
          </div>

          <div className="p-badges">
            {msg && <div className={`badge ${msg.type}`}>{msg.text}</div>}
          </div>
        </div>

        <div className="p-hero">
          <div className="p-heroRow">
            <div className="avatar">
              {loading ? (
                "…"
              ) : avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="avatarImg" />
              ) : (
                avatarText
              )}
            </div>

            <div className="p-heroContent">
              <h2 className="heroName">{loading ? "Cargando..." : fullName}</h2>
              <p className="heroEmail">{loading ? "…" : email || "—"}</p>

              <div className="heroMeta">
                <div className="badge soft">Rol: {role || "cliente"}</div>
                <div className="badge gold">Plan: {plan || "free"}</div>
                <div className="badge badge-status">
                  <span className="statusDot" aria-hidden="true" />
                  {estado || "activo"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-grid">
          <div className="card">
            <div className="cardTop">
              <h2>Tu cuerpo</h2>
              {!editingBasics ? (
                <button
                  className="btn ghost"
                  onClick={() => {
                    setMsg(null);
                    setEditingBasics(true);
                  }}
                  disabled={loading || savingBasics}
                >
                  Editar
                </button>
              ) : null}
            </div>

            {!editingBasics ? (
              <>
                <div className="kpiRow">
                  <div className="kpi gold">
                    <div className="k">Peso actual</div>
                    <div className="v">{fmtValue(pesoKg, " kg")}</div>
                  </div>
                  <div className="kpi">
                    <div className="k">Altura</div>
                    <div className="v">{fmtValue(alturaCm, " cm")}</div>
                  </div>
                  <div className="kpi">
                    <div className="k">% graso</div>
                    <div className="v">{fmtValue(grasaPct, "%")}</div>
                  </div>
                </div>

                <p className="sectionNote">
                  Estos datos son los que usamos para personalizar tu plan y tus cálculos.
                </p>
              </>
            ) : (
              <div className="form">
                <div className="formGrid">
                  <div className="field">
                    <label>Sexo</label>
                    <select className="select" value={sexo} onChange={(e) => setSexo(e.target.value)} disabled={savingBasics}>
                      <option value="">Seleccionar</option>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Fecha de nacimiento</label>
                    <input
                      className="input"
                      type="date"
                      value={fechaNacimiento}
                      onChange={(e) => setFechaNacimiento(e.target.value)}
                      disabled={savingBasics}
                    />
                  </div>

                  <div className="field">
                    <label>Altura (cm)</label>
                    <input
                      className="input"
                      type="number"
                      value={alturaCm}
                      onChange={(e) => setAlturaCm(e.target.value)}
                      disabled={savingBasics}
                    />
                  </div>

                  <div className="field">
                    <label>Peso (kg)</label>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      value={pesoKg}
                      onChange={(e) => setPesoKg(e.target.value)}
                      disabled={savingBasics}
                    />
                  </div>

                  <div className="field">
                    <label>% graso</label>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      value={grasaPct}
                      onChange={(e) => setGrasaPct(e.target.value)}
                      disabled={savingBasics}
                    />
                  </div>

                  <div className="field">
                    <label>Tendencia de peso</label>
                    <select
                      className="select"
                      value={tendenciaPeso}
                      onChange={(e) => setTendenciaPeso(e.target.value)}
                      disabled={savingBasics}
                    >
                      <option value="">Seleccionar</option>
                      <option value="bajando">Bajando</option>
                      <option value="estable">Estable</option>
                      <option value="subiendo">Subiendo</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Frecuencia de ejercicio</label>
                    <select
                      className="select"
                      value={frecuenciaEjercicio}
                      onChange={(e) => setFrecuenciaEjercicio(e.target.value)}
                      disabled={savingBasics}
                    >
                      <option value="">Seleccionar</option>
                      <option value="0">Nada</option>
                      <option value="1_3">1 a 3 veces</option>
                      <option value="4_5">4 a 5 veces</option>
                      <option value="6_plus">6 o más</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Actividad diaria</label>
                    <select
                      className="select"
                      value={actividadDiaria}
                      onChange={(e) => setActividadDiaria(e.target.value)}
                      disabled={savingBasics}
                    >
                      <option value="">Seleccionar</option>
                      <option value="sedentario">Sedentario</option>
                      <option value="ligero">Ligero</option>
                      <option value="moderado">Moderado</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Experiencia en pesas</label>
                    <select
                      className="select"
                      value={experienciaPesas}
                      onChange={(e) => setExperienciaPesas(e.target.value)}
                      disabled={savingBasics}
                    >
                      <option value="">Seleccionar</option>
                      <option value="ninguna">Ninguna</option>
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>TDEE estimado</label>
                    <input
                      className="input"
                      type="number"
                      value={tdeeEstimado}
                      onChange={(e) => setTdeeEstimado(e.target.value)}
                      disabled={savingBasics}
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn solid" onClick={guardarBasics} disabled={savingBasics}>
                    {savingBasics ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button className="btn ghost" onClick={cancelarEdicionBasics} disabled={savingBasics}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="cardTop">
              <h2>Objetivo actual</h2>
              <button className="btn ghost" disabled>
                Editar después
              </button>
            </div>

            <div className="list">
              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Meta</div>
                  <div className="infoValue">{labelGoal(goal?.type)}</div>
                </div>
              </div>

              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Peso objetivo</div>
                  <div className="infoValue">{fmtValue(goal?.targetWeightKg, " kg")}</div>
                </div>
              </div>

              {"targetRangeKg" in (goal || {}) ? (
                <div className="infoRow">
                  <div className="infoLeft">
                    <div className="infoLabel">Rango objetivo</div>
                    <div className="infoValue">
                      {goal?.targetRangeKg?.min != null && goal?.targetRangeKg?.max != null
                        ? `${goal.targetRangeKg.min} a ${goal.targetRangeKg.max} kg`
                        : "—"}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Ritmo</div>
                  <div className="infoValue">{fmtValue(goal?.ratePctBWPerWeek, "% / semana")}</div>
                </div>
              </div>

              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Calorías iniciales</div>
                  <div className="infoValue">{fmtValue(goal?.initialBudgetKcal, " kcal")}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardTop">
              <h2>Programa actual</h2>
              <button className="btn ghost" disabled>
                Ver/editar después
              </button>
            </div>

            <div className="list">
              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Dieta</div>
                  <div className="infoValue">{labelDiet(program?.diet)}</div>
                </div>
              </div>

              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Entrenamiento</div>
                  <div className="infoValue">{labelTraining(program?.training)}</div>
                </div>
              </div>

              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Distribución calórica</div>
                  <div className="infoValue">{labelDist(program?.calorieDist)}</div>
                  {Array.isArray(program?.shiftDays) && program.shiftDays.length > 0 ? (
                    <div className="infoHint">Días shift: {program.shiftDays.join(", ")}</div>
                  ) : null}
                </div>
              </div>

              <div className="infoRow">
                <div className="infoLeft">
                  <div className="infoLabel">Proteína</div>
                  <div className="infoValue">{labelProtein(program?.protein)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardTop">
              <h2>Datos personales</h2>
              {!editingPersonal ? (
                <button
                  className="btn ghost"
                  onClick={() => {
                    setMsg(null);
                    setEditingPersonal(true);
                  }}
                  disabled={loading || savingPersonal}
                >
                  Editar
                </button>
              ) : null}
            </div>

            {!editingPersonal ? (
              <div className="list">
                <div className="infoRow">
                  <div className="infoLeft">
                    <div className="infoLabel">Nombre completo</div>
                    <div className="infoValue">{fullName}</div>
                  </div>
                </div>

                <div className="infoRow">
                  <div className="infoLeft">
                    <div className="infoLabel">Teléfono</div>
                    <div className="infoValue">{telefono || "—"}</div>
                  </div>
                </div>

                <div className="infoRow">
                  <div className="infoLeft">
                    <div className="infoLabel">Ciudad</div>
                    <div className="infoValue">{ciudad || "—"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form">
                <div className="formGrid">
                  <div className="field">
                    <label>Nombre</label>
                    <input
                      className="input"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      disabled={savingPersonal}
                      placeholder="Ej: Claudio"
                    />
                  </div>

                  <div className="field">
                    <label>Apellido</label>
                    <input
                      className="input"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      disabled={savingPersonal}
                      placeholder="Ej: Zumárraga"
                    />
                  </div>

                  <div className="field">
                    <label>Teléfono</label>
                    <input
                      className="input"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      disabled={savingPersonal}
                      placeholder="Ej: +54 11..."
                    />
                  </div>

                  <div className="field">
                    <label>Ciudad</label>
                    <input
                      className="input"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      disabled={savingPersonal}
                      placeholder="Ej: Buenos Aires"
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn solid" onClick={guardarPersonal} disabled={savingPersonal}>
                    {savingPersonal ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button className="btn ghost" onClick={cancelarEdicionPersonal} disabled={savingPersonal}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="cardTop">
            <h2>Cuenta</h2>
          </div>

          <div className="accountList">
            <div className="accountItem">
              <div>
                <div className="accountItemTitle">Plan y suscripción</div>
                <div className="accountItemSub">Estado actual del plan y acceso a funciones premium.</div>
              </div>
              <div className="badge gold">{plan || "free"}</div>
            </div>

            <div className="accountItem">
              <div>
                <div className="accountItemTitle">Correo de acceso</div>
                <div className="accountItemSub">{email || "—"}</div>
              </div>
            </div>

            <div className="accountItem">
              <div>
                <div className="accountItemTitle">Seguridad</div>
                <div className="accountItemSub">Cambio de contraseña y opciones de acceso, más adelante.</div>
              </div>
              <button className="btn ghost" disabled>
                Próximamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}