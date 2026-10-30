import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Dumbbell,
  Gauge,
  ListChecks,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "../Api.js";

const CSS = `
.r-wrap{
  min-height:calc(100dvh - 56px);
  padding:5px clamp(10px,2.4vw,20px) calc(104px + env(safe-area-inset-bottom));
  color:#f8fafc;
  background:
    radial-gradient(520px 260px at 100% -4%,rgba(245,153,0,.09),transparent 66%),
    radial-gradient(420px 300px at -10% 38%,rgba(255,203,61,.035),transparent 72%),
    #07090b;
  overflow-x:hidden;
}
.r-inner{width:100%;max-width:1100px;margin:0 auto;display:grid;gap:12px;}
.r-hero,.r-next,.r-library{position:relative;isolation:isolate;overflow:hidden;}
.r-hero{
  display:grid;
  grid-template-columns:minmax(0,1fr);
  gap:16px;
  padding:18px;
  border:1px solid rgba(245,184,28,.24);
  border-radius:22px;
  background:
    radial-gradient(260px 160px at 100% 0,rgba(245,153,0,.18),transparent 72%),
    linear-gradient(145deg,rgba(17,23,29,.98),rgba(7,11,15,.99));
  box-shadow:0 20px 55px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.045);
  animation:r-rise .21s cubic-bezier(.22,1,.36,1) both;
}
.r-hero::after{
  content:"";
  position:absolute;
  z-index:-1;
  width:190px;
  height:190px;
  right:-72px;
  bottom:-105px;
  border-radius:999px;
  background:radial-gradient(circle,rgba(255,182,26,.22),transparent 69%);
  filter:blur(4px);
}
.r-heading{display:flex;align-items:flex-start;gap:12px;min-width:0;}
.r-headingIcon{
  width:45px;
  height:45px;
  flex:0 0 auto;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,198,51,.34);
  border-radius:14px;
  color:#ffd43b;
  background:linear-gradient(145deg,rgba(245,153,0,.14),rgba(255,220,86,.035));
  box-shadow:0 0 24px rgba(245,153,0,.08),inset 0 1px 0 rgba(255,255,255,.08);
}
.r-eyebrow{display:block;margin:0 0 3px;color:#f6bd38;font-size:9px;font-weight:950;letter-spacing:.15em;text-transform:uppercase;}
.r-title{margin:0;color:#fffaf0;font-size:clamp(25px,5.8vw,34px);font-weight:1000;line-height:1;letter-spacing:-.035em;}
.r-sub{max-width:610px;margin:7px 0 0;color:#aeb8c5;font-size:12.5px;font-weight:650;line-height:1.45;}
.r-origin{
  width:fit-content;
  min-height:27px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  margin-top:10px;
  padding:4px 8px;
  border:1px solid rgba(255,207,63,.22);
  border-radius:999px;
  color:#ffe28a;
  background:rgba(245,153,0,.065);
  font-size:10px;
  font-weight:850;
}
.r-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}
.r-metric{
  min-width:0;
  padding:10px 8px;
  border:1px solid rgba(255,255,255,.075);
  border-radius:14px;
  background:rgba(3,8,12,.53);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
}
.r-metric svg{display:block;margin-bottom:6px;color:#efad20;}
.r-metric strong{display:block;overflow:hidden;color:#f8fafc;font-size:14px;font-weight:950;line-height:1.05;text-overflow:ellipsis;white-space:nowrap;}
.r-metric span{display:block;margin-top:3px;color:#8290a0;font-size:8.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;}

.r-next{
  display:grid;
  gap:15px;
  padding:16px;
  border:1px solid rgba(245,184,28,.34);
  border-radius:22px;
  background:
    linear-gradient(110deg,rgba(245,153,0,.12),rgba(245,153,0,.025) 48%,transparent 74%),
    linear-gradient(155deg,#14171b,#090c10);
  box-shadow:0 18px 46px rgba(0,0,0,.32),0 0 28px rgba(220,135,0,.055),inset 0 1px 0 rgba(255,237,171,.06);
  animation:r-rise .22s cubic-bezier(.22,1,.36,1) .02s both;
}
.r-next::before{
  content:"";
  position:absolute;
  top:0;
  left:20px;
  width:84px;
  height:2px;
  border-radius:999px;
  background:linear-gradient(90deg,#f59f00,#ffe26b,transparent);
  box-shadow:0 0 18px rgba(245,153,0,.42);
}
.r-sectionLabel{display:flex;align-items:center;gap:7px;color:#ffc83d;font-size:9px;font-weight:950;letter-spacing:.14em;text-transform:uppercase;}
.r-nextMain{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;}
.r-nextNumber{
  width:49px;
  height:56px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,204,62,.25);
  border-radius:15px;
  color:#ffd34c;
  background:rgba(245,153,0,.075);
  font-size:22px;
  font-weight:1000;
  letter-spacing:-.04em;
}
.r-nextCopy{min-width:0;}
.r-nextCopy h2{margin:0;color:#fff;font-size:20px;font-weight:950;line-height:1.12;letter-spacing:-.02em;}
.r-nextMeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:7px;color:#aab5c2;font-size:10.5px;font-weight:750;}
.r-nextMeta span{display:inline-flex;align-items:center;gap:4px;}
.r-primary{
  min-height:44px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  width:100%;
  border:1px solid rgba(255,226,118,.75);
  border-radius:13px;
  color:#171004;
  background:linear-gradient(135deg,#f4a600,#ffd54b 58%,#ffe58a);
  box-shadow:0 12px 28px rgba(225,145,0,.18),inset 0 1px 0 rgba(255,255,255,.5);
  font:inherit;
  font-size:13px;
  font-weight:950;
  cursor:pointer;
  transition:transform .14s ease,filter .18s ease,box-shadow .18s ease;
}
.r-primary:hover{filter:brightness(1.045);box-shadow:0 15px 34px rgba(225,145,0,.23),inset 0 1px 0 rgba(255,255,255,.5);}
.r-primary:active{transform:scale(.985);}

.r-library{
  padding:14px;
  border:1px solid rgba(148,163,184,.14);
  border-radius:22px;
  background:linear-gradient(155deg,rgba(14,20,26,.98),rgba(6,10,14,.99));
  box-shadow:0 18px 52px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.035);
  animation:r-rise .23s cubic-bezier(.22,1,.36,1) .04s both;
}
.r-libraryHead{display:grid;gap:10px;margin-bottom:12px;}
.r-libraryTitleRow{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;}
.r-libraryTitleRow h2{margin:0;color:#f8fafc;font-size:18px;font-weight:950;letter-spacing:-.02em;}
.r-count{color:#d0a73e;font-size:10px;font-weight:900;white-space:nowrap;}
.r-searchShell{position:relative;display:flex;align-items:center;}
.r-srOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
.r-searchShell svg{position:absolute;left:12px;color:#8491a1;pointer-events:none;}
.r-search{
  width:100%;
  min-height:45px;
  padding:0 38px;
  border:1px solid rgba(148,163,184,.17);
  border-radius:13px;
  outline:none;
  color:#f8fafc;
  background:rgba(3,8,12,.76);
  font:inherit;
  font-size:12px;
  font-weight:750;
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;
}
.r-search::placeholder{color:#6f7b89;}
.r-search:focus{border-color:rgba(245,184,28,.56);background:#090d11;box-shadow:0 0 0 3px rgba(245,153,0,.1);}
.r-grid{display:grid;grid-template-columns:1fr;gap:9px;}
.r-item{
  position:relative;
  overflow:hidden;
  border:1px solid rgba(148,163,184,.13);
  border-radius:16px;
  background:linear-gradient(150deg,rgba(17,23,29,.96),rgba(7,11,15,.98));
  transition:border-color .2s ease,transform .18s ease,box-shadow .2s ease;
}
.r-item:hover{border-color:rgba(245,184,28,.27);transform:translateY(-1px);box-shadow:0 13px 28px rgba(0,0,0,.22);}
.r-item.is-open{border-color:rgba(245,184,28,.38);box-shadow:0 16px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,225,127,.04);}
.r-itemButton{
  width:100%;
  min-height:72px;
  display:grid;
  grid-template-columns:39px minmax(0,1fr) auto;
  align-items:center;
  gap:10px;
  padding:11px;
  border:0;
  color:inherit;
  background:transparent;
  text-align:left;
  font:inherit;
  cursor:pointer;
}
.r-index{
  width:39px;
  height:39px;
  display:grid;
  place-items:center;
  border:1px solid rgba(245,184,28,.22);
  border-radius:12px;
  color:#f6c84a;
  background:linear-gradient(145deg,rgba(245,153,0,.105),rgba(255,255,255,.015));
  font-size:12px;
  font-weight:950;
}
.r-cardCopy{min-width:0;}
.r-cardCopy strong{display:block;overflow:hidden;color:#f8fafc;font-size:13.5px;font-weight:900;line-height:1.18;text-overflow:ellipsis;white-space:nowrap;}
.r-cardMeta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px;color:#8996a5;font-size:9.5px;font-weight:750;}
.r-cardMeta span{display:inline-flex;align-items:center;gap:3px;}
.r-chevron{color:#c39a31;transition:transform .22s cubic-bezier(.22,1,.36,1);}
.r-item.is-open .r-chevron{transform:rotate(180deg);}
.r-exercises{display:grid;gap:7px;padding:0 12px 12px;border-top:1px solid rgba(255,255,255,.06);animation:r-expand .24s ease both;}
.r-exercise{
  min-height:39px;
  display:grid;
  grid-template-columns:23px minmax(0,1fr);
  align-items:center;
  gap:8px;
  padding:6px 7px;
  border:1px solid rgba(255,255,255,.055);
  border-radius:11px;
  color:#cbd5df;
  background:rgba(1,5,8,.35);
  font-size:11px;
  font-weight:720;
}
.r-exercise:first-child{margin-top:10px;}
.r-exercise span:first-child{width:23px;height:23px;display:grid;place-items:center;border-radius:8px;color:#f5bc31;background:rgba(245,153,0,.075);font-size:9px;font-weight:950;}
.r-empty{display:grid;place-items:center;gap:8px;min-height:180px;padding:24px;border:1px dashed rgba(245,184,28,.22);border-radius:16px;color:#8d99a7;text-align:center;}
.r-empty svg{color:#d8aa36;}
.r-empty strong{color:#e8edf2;font-size:14px;}
.r-empty p{margin:0;font-size:11px;line-height:1.45;}
.r-primary:focus-visible,.r-itemButton:focus-visible,.r-search:focus-visible{outline:2px solid #ffd34e;outline-offset:2px;}
@keyframes r-rise{from{opacity:.76;transform:translateY(4px) scale(.996)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes r-expand{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media (min-width:700px){
  .r-wrap{padding-top:14px;}
  .r-hero{grid-template-columns:minmax(0,1.4fr) minmax(270px,.8fr);align-items:center;padding:22px;}
  .r-next{grid-template-columns:minmax(0,1fr) auto;align-items:end;padding:19px 20px;}
  .r-next .r-sectionLabel,.r-next .r-nextMain{grid-column:1;}
  .r-primary{grid-column:2;grid-row:1 / span 2;width:auto;min-width:170px;}
  .r-library{padding:18px;}
  .r-libraryHead{grid-template-columns:auto minmax(250px,380px);align-items:end;}
  .r-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media (prefers-reduced-motion:reduce){
  .r-hero,.r-next,.r-library,.r-exercises{animation:none!important;}
  .r-item,.r-primary,.r-chevron{transition:none!important;}
}
`;

const BASE_ROUTINES = [
  {
    id: "base-full-body",
    name: "Full Body 30’",
    tag: "3× semana",
    duration: "30 min",
    level: "Base",
    items: ["Sentadillas 3×12", "Flexiones 3×10", "Remo con mancuerna 3×12", "Plancha 3×40s"],
  },
  {
    id: "base-legs",
    name: "Pierna + Glúteo",
    tag: "Fuerza",
    duration: "45 min",
    level: "Intermedio",
    items: ["Prensa 4×10", "Peso muerto rumano 3×10", "Hip thrust 4×8", "Gemelos 3×15"],
  },
  {
    id: "base-push",
    name: "Push · Pecho y hombro",
    tag: "Hipertrofia",
    duration: "50 min",
    level: "Intermedio",
    items: ["Press banca 4×8", "Press militar 3×10", "Fondos 3×8", "Extensión tríceps 3×12"],
  },
  {
    id: "base-cardio",
    name: "Cardio + Core",
    tag: "20–30’",
    duration: "25 min",
    level: "Base",
    items: ["Caminata rápida 20’", "Mountain climbers 3×30s", "Crunch 3×15", "Estiramientos 5’"],
  },
];

export default function Rutinas() {
  const [query, setQuery] = useState("");
  const [coachRoutine, setCoachRoutine] = useState(null);
  const [expandedId, setExpandedId] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/usuarios/users/me", { silent401: true })
      .then((user) => {
        if (active && hasCoachRoutine(user?.routine)) setCoachRoutine(user.routine);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const routines = useMemo(
    () => (coachRoutine ? routineToList(coachRoutine) : BASE_ROUTINES),
    [coachRoutine]
  );

  const visibleRoutines = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    if (!normalizedQuery) return routines;
    return routines.filter((routine) => {
      const searchable = [routine.name, routine.tag, routine.level, ...routine.items].join(" ").toLocaleLowerCase("es");
      return searchable.includes(normalizedQuery);
    });
  }, [query, routines]);

  const nextRoutine = routines[0] || null;
  const totalExercises = routines.reduce((total, routine) => total + routine.items.length, 0);

  function revealRoutine(routineId) {
    setExpandedId(routineId);
    window.requestAnimationFrame(() => {
      document.getElementById(`routine-${routineId}`)?.scrollIntoView({ block: "center" });
    });
  }

  return (
    <div className="r-wrap">
      <style>{CSS}</style>

      <div className="r-inner">
        <section className="r-hero" aria-labelledby="routines-title">
          <div className="r-heading">
            <span className="r-headingIcon" aria-hidden="true"><Dumbbell size={23} strokeWidth={2.1} /></span>
            <div>
              <span className="r-eyebrow">Tu entrenamiento</span>
              <h1 id="routines-title" className="r-title">Rutinas</h1>
              <p className="r-sub">Encontrá tu próxima sesión y revisá cada ejercicio sin perder el foco.</p>
              <span className="r-origin">
                {coachRoutine ? <CheckCircle2 size={12} aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
                {coachRoutine ? "Plan asignado por tu coach" : "Plan base ZumaFit"}
              </span>
            </div>
          </div>

          <div className="r-metrics" aria-label="Resumen del plan">
            <div className="r-metric">
              <CalendarDays size={17} aria-hidden="true" />
              <strong>{routines.length}</strong>
              <span>Sesiones</span>
            </div>
            <div className="r-metric">
              <ListChecks size={17} aria-hidden="true" />
              <strong>{totalExercises}</strong>
              <span>Ejercicios</span>
            </div>
            <div className="r-metric">
              <Gauge size={17} aria-hidden="true" />
              <strong>{coachRoutine ? "Coach" : "Base"}</strong>
              <span>Plan</span>
            </div>
          </div>
        </section>

        {nextRoutine ? (
          <section className="r-next" aria-labelledby="next-routine-title">
            <span className="r-sectionLabel"><Sparkles size={12} aria-hidden="true" /> Próxima sesión</span>
            <div className="r-nextMain">
              <span className="r-nextNumber" aria-hidden="true">01</span>
              <div className="r-nextCopy">
                <h2 id="next-routine-title">{nextRoutine.name}</h2>
                <div className="r-nextMeta">
                  <span><Clock3 size={12} aria-hidden="true" /> {nextRoutine.duration}</span>
                  <span><Dumbbell size={12} aria-hidden="true" /> {nextRoutine.items.length} ejercicios</span>
                  <span>{nextRoutine.tag}</span>
                </div>
              </div>
            </div>
            <button className="r-primary" type="button" onClick={() => revealRoutine(nextRoutine.id)}>
              <Play size={15} fill="currentColor" aria-hidden="true" /> Ver sesión
            </button>
          </section>
        ) : null}

        <section className="r-library" aria-labelledby="routine-library-title">
          <div className="r-libraryHead">
            <div className="r-libraryTitleRow">
              <h2 id="routine-library-title">Plan semanal</h2>
              <span className="r-count">{visibleRoutines.length} de {routines.length}</span>
            </div>

            <label className="r-searchShell">
              <span className="r-srOnly">Buscar ejercicio o rutina</span>
              <Search size={16} aria-hidden="true" />
              <input
                className="r-search"
                type="search"
                placeholder="Buscar rutina o ejercicio"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          {visibleRoutines.length ? (
            <div className="r-grid">
              {visibleRoutines.map((routine, index) => {
                const isExpanded = expandedId === routine.id;
                return (
                  <article className={`r-item ${isExpanded ? "is-open" : ""}`} id={`routine-${routine.id}`} key={routine.id}>
                    <button
                      className="r-itemButton"
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`routine-exercises-${routine.id}`}
                      onClick={() => setExpandedId(isExpanded ? "" : routine.id)}
                    >
                      <span className="r-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <span className="r-cardCopy">
                        <strong>{routine.name}</strong>
                        <span className="r-cardMeta">
                          <span><Clock3 size={11} aria-hidden="true" /> {routine.duration}</span>
                          <span>{routine.level}</span>
                          <span>{routine.tag}</span>
                        </span>
                      </span>
                      <ChevronDown className="r-chevron" size={17} aria-hidden="true" />
                    </button>

                    {isExpanded ? (
                      <div className="r-exercises" id={`routine-exercises-${routine.id}`}>
                        {routine.items.map((exercise, exerciseIndex) => (
                          <div className="r-exercise" key={`${routine.id}-${exerciseIndex}`}>
                            <span>{exerciseIndex + 1}</span>
                            <span>{exercise}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="r-empty" role="status">
              <Search size={25} aria-hidden="true" />
              <strong>No encontramos esa rutina</strong>
              <p>Probá buscando por ejercicio, zona corporal o tipo de entrenamiento.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function hasCoachRoutine(routine) {
  return Array.isArray(routine?.currentPlan?.days) && routine.currentPlan.days.length > 0;
}

function normalizeExercise(exercise, index) {
  if (typeof exercise === "string") return exercise;
  if (!exercise || typeof exercise !== "object") return `Ejercicio ${index + 1}`;
  const name = exercise.name || exercise.exercise || `Ejercicio ${index + 1}`;
  const prescription = [exercise.sets ? `${exercise.sets} series` : "", exercise.reps || exercise.duration || ""]
    .filter(Boolean)
    .join(" · ");
  return prescription ? `${name} · ${prescription}` : name;
}

function routineToList(routine) {
  return (routine?.currentPlan?.days || []).map((day, index) => {
    const items = Array.isArray(day?.exercises) && day.exercises.length
      ? day.exercises.map(normalizeExercise)
      : ["Sin ejercicios cargados"];
    return {
      id: String(day?.id || day?._id || `coach-day-${index + 1}`),
      name: day?.name || `Día ${index + 1}`,
      tag: day?.focus || routine?.currentPlan?.name || "Rutina",
      duration: day?.duration || day?.estimatedDuration || `${Math.max(25, items.length * 10)} min`,
      level: day?.level || "Personalizada",
      items,
    };
  });
}
