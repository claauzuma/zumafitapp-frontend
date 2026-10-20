import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Edit3, Heart, LoaderCircle, Save, Sparkles, Target, Trash2, Utensils, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getMenuTrackingWeek } from "../../tracking/trackingApi.js";
import { queryClient } from "../../queryClient.js";
import { applyDayFavorite, deleteDayFavorite, listDayFavorites, updateDayFavorite } from "./dayFavoritesApi.js";
import { dayFavoriteCompatibility } from "./dayFavoritePlan.js";

function localDate() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function monday(date) {
  const value = new Date(`${date}T12:00:00`);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function kcal(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("es-AR")} kcal`;
}

function sourceLabel(source = "") {
  return ({ target: "Por meta", automatic: "Automático", auto: "Automático", coach: "Coach", manual: "Manual", mixed: "Mixto" })[source] || "Plan diario";
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-2 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-zinc-500">{label}</span><strong className="mt-1 block text-xs text-white">{value}</strong></div>;
}

function editableFavorite(favorite = {}) {
  return {
    ...favorite,
    name: favorite.name || "Mi día guardado",
    physicalMeals: (favorite.physicalMeals || []).map((meal) => ({
      ...meal,
      items: (meal.items || []).map((item) => ({ ...item })),
    })),
    targetMeals: (favorite.targetMeals || []).map((meal) => ({
      ...meal,
      target: { ...(meal.target || {}) },
    })),
  };
}

export default function MenuFavoritas() {
  const navigate = useNavigate();
  const [date, setDate] = useState(localDate);
  const [data, setData] = useState({ items: [], usage: { current: 0, limit: 20 } });
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [confirmFavorite, setConfirmFavorite] = useState(null);
  const [editFavorite, setEditFavorite] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([listDayFavorites(), getMenuTrackingWeek(monday(date))])
      .then(([favorites, trackingWeek]) => {
        if (!active) return;
        setData(favorites || { items: [], usage: {} });
        setWeek(trackingWeek || null);
      })
      .catch((loadError) => active && setError(loadError?.message || "No pudimos cargar tus días guardados."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [date]);

  const selectedDay = useMemo(() => (week?.days || []).find((day) => day.date === date) || null, [date, week]);
  const target = selectedDay?.target || {};

  async function applyFavorite(favorite) {
    setBusyId(favorite.id);
    setError("");
    try {
      const result = await applyDayFavorite(favorite.id, date);
      await queryClient.invalidateQueries();
      navigate(`/app/menu?date=${encodeURIComponent(date)}&favoriteApplied=1`, {
        state: { dayFavoriteApplied: result?.favorite?.name, extraFreeCalories: result?.compatibility?.extraFreeCalories || 0 },
      });
    } catch (applyError) {
      setError(applyError?.message || "No pudimos usar este día guardado.");
      setConfirmFavorite(null);
    } finally {
      setBusyId("");
    }
  }

  async function removeFavorite(favorite) {
    if (!window.confirm(`¿Eliminar “${favorite.name}” de tus días guardados?`)) return;
    setBusyId(favorite.id);
    try {
      await deleteDayFavorite(favorite.id);
      setData((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== favorite.id),
        usage: { ...current.usage, current: Math.max(0, Number(current.usage?.current || 1) - 1) },
      }));
    } catch (removeError) {
      setError(removeError?.message || "No pudimos eliminar este día.");
    } finally {
      setBusyId("");
    }
  }

  async function saveFavorite() {
    if (!editFavorite || busyId) return;
    const name = String(editFavorite.name || "").trim();
    if (!name) {
      setError("Escribí un nombre para el día guardado.");
      return;
    }
    if (!(editFavorite.physicalMeals?.length || editFavorite.targetMeals?.length)) {
      setError("El día guardado debe conservar al menos una comida.");
      return;
    }
    setBusyId(editFavorite.id);
    setError("");
    try {
      const result = await updateDayFavorite(editFavorite.id, {
        name,
        physicalMeals: editFavorite.physicalMeals,
        targetMeals: editFavorite.targetMeals,
      });
      setData((current) => ({
        ...current,
        items: current.items.map((item) => item.id === editFavorite.id ? result.favorite : item),
      }));
      setEditFavorite(null);
    } catch (saveError) {
      setError(saveError?.message || "No pudimos modificar este día.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#07090c] px-3 pb-12 pt-4 text-zinc-100 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-start gap-3">
          <Link to="/app/menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200"><ArrowLeft size={19} /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-emerald-300"><Heart size={17} fill="currentColor" /><span className="text-[11px] font-black uppercase tracking-[.18em]">Días guardados</span></div>
            <h1 className="mt-1 text-2xl font-black text-white">Repetí un día que te gustó</h1>
            <p className="mt-1 text-sm font-bold leading-relaxed text-zinc-400">Guardamos la planificación, no el consumo. Tracking siempre empieza con lo que realmente registres ese día.</p>
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-[1.4rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_100%_0,rgba(45,212,191,.14),transparent_34%),linear-gradient(145deg,#101a20,#090d12)] p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3"><label htmlFor="favorite-date" className="text-sm font-black text-white">¿Cuándo querés usarlo?</label><span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black text-zinc-300">{data.usage?.current || 0} / {data.usage?.limit ?? "∞"}</span></div>
          <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5"><CalendarDays className="text-emerald-300" size={20} /><input id="favorite-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-10 w-full bg-transparent text-sm font-black text-white outline-none [color-scheme:dark]" /></div>
          {target?.kcal ? <p className="mt-3 text-xs font-bold text-zinc-300">Objetivo de ese día: <strong className="text-[#FFE080]">{kcal(target.kcal)}</strong></p> : null}
        </section>

        {error ? <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{error}</div> : null}
        {loading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="animate-spin text-emerald-300" size={30} /></div> : null}
        {!loading && !data.items?.length ? (
          <section className="mt-5 rounded-[1.4rem] border border-dashed border-white/15 bg-white/[0.025] p-7 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE080]"><Heart size={24} /></span><h2 className="mt-4 text-lg font-black text-white">Todavía no guardaste ningún día</h2><p className="mt-2 text-sm font-bold leading-relaxed text-zinc-400">Volvé a Menú y tocá “Guardar día” cuando tengas una planificación que quieras repetir.</p><Link to="/app/menu" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#FFC928] to-[#FFE16A] px-5 text-sm font-black text-black">Ir a mi menú</Link>
          </section>
        ) : null}

        <div className="mt-5 grid gap-3">
          {(data.items || []).map((favorite) => {
            const compatibility = dayFavoriteCompatibility(favorite.plannedTotals, { kcal: target.kcal, proteina: target.p, carbs: target.c, grasas: target.g });
            const disabled = !target?.kcal || !compatibility.allowed || busyId === favorite.id;
            return (
              <article key={favorite.id} className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,#111820,#090d12)] shadow-xl">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-200">{sourceLabel(favorite.sourceType)}</span><h2 className="mt-2 truncate text-lg font-black text-white">{favorite.name}</h2><p className="mt-1 text-xl font-black text-[#FFE080]">{kcal(favorite.plannedTotals?.kcal)}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => setEditFavorite(editableFavorite(favorite))} disabled={busyId === favorite.id} className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200 disabled:opacity-40" aria-label={`Editar ${favorite.name}`}><Edit3 size={17} /></button><button type="button" onClick={() => removeFavorite(favorite)} disabled={busyId === favorite.id} className="grid h-10 w-10 place-items-center rounded-xl border border-rose-300/20 bg-rose-300/[0.06] text-rose-200 disabled:opacity-40" aria-label={`Eliminar ${favorite.name}`}><Trash2 size={17} /></button></div></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Metric label="Proteína" value={`${Math.round(favorite.plannedTotals?.proteina || 0)} g`} /><Metric label="Carbohidratos" value={`${Math.round(favorite.plannedTotals?.carbs || 0)} g`} /><Metric label="Grasas" value={`${Math.round(favorite.plannedTotals?.grasas || 0)} g`} /></div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black text-zinc-300">{favorite.physicalMeals?.length ? <span className="rounded-full border border-white/10 px-2.5 py-1"><Utensils size={11} className="mr-1 inline" />{favorite.physicalMeals.length} comidas planificadas</span> : null}{favorite.targetMeals?.length ? <span className="rounded-full border border-white/10 px-2.5 py-1"><Target size={11} className="mr-1 inline" />{favorite.targetMeals.length} metas</span> : null}</div>
                </div>
                <div className={`border-t px-4 py-3 ${compatibility.allowed ? "border-emerald-300/15 bg-emerald-300/[0.045]" : "border-rose-300/15 bg-rose-300/[0.045]"}`}>
                  {!target?.kcal ? <p className="text-xs font-bold text-amber-100">No encontramos una meta para la fecha elegida.</p> : !compatibility.allowed ? <p className="text-xs font-bold text-rose-100">No se puede usar: supera tu objetivo por {kcal(compatibility.missingCalories)}.</p> : compatibility.extraFreeCalories > 0.5 ? <p className="text-xs font-bold text-emerald-100">Podés usarlo. Te quedarán <strong>{kcal(compatibility.extraFreeCalories)}</strong> libres para completar.</p> : <p className="text-xs font-bold text-emerald-100"><CheckCircle2 size={14} className="mr-1 inline" />Coincide con tu objetivo.</p>}
                  <button type="button" disabled={disabled} onClick={() => setConfirmFavorite({ favorite, compatibility })} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-4 text-sm font-black text-[#04110d] disabled:cursor-not-allowed disabled:opacity-35">{busyId === favorite.id ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}Usar este día</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {confirmFavorite ? (
        <div className="fixed inset-0 z-[90] grid place-items-end bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-t-[1.6rem] border border-white/10 bg-[#0d141b] p-5 shadow-2xl sm:rounded-[1.6rem]">
            <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Aplicar planificación</span><h2 className="mt-1 text-xl font-black text-white">{confirmFavorite.favorite.name}</h2></div><button type="button" onClick={() => setConfirmFavorite(null)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-300"><X size={17} /></button></div>
            <p className="mt-4 text-sm font-bold leading-relaxed text-zinc-300">Se aplicará sólo al <strong className="text-white">{date}</strong>. No se copiará ningún consumo ni se crearán FoodLogs.</p>
            {confirmFavorite.compatibility.extraFreeCalories > 0.5 ? <div className="mt-3 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-3 text-sm font-bold text-[#FFE8A3]">La planificación aporta {kcal(confirmFavorite.favorite.plannedTotals?.kcal)} y quedarán {kcal(confirmFavorite.compatibility.extraFreeCalories)} libres.</div> : null}
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmFavorite(null)} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] text-sm font-black text-zinc-300">Cancelar</button><button type="button" onClick={() => applyFavorite(confirmFavorite.favorite)} disabled={Boolean(busyId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 text-sm font-black text-[#04110d] disabled:opacity-50">{busyId ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}Confirmar</button></div>
          </section>
        </div>
      ) : null}

      {editFavorite ? (
        <DayFavoriteEditor
          favorite={editFavorite}
          setFavorite={setEditFavorite}
          saving={busyId === editFavorite.id}
          onClose={() => setEditFavorite(null)}
          onSave={saveFavorite}
        />
      ) : null}
    </main>
  );
}

function DayFavoriteEditor({ favorite, setFavorite, saving, onClose, onSave }) {
  function updatePhysicalMeal(index, patch) {
    setFavorite((current) => ({
      ...current,
      physicalMeals: current.physicalMeals.map((meal, mealIndex) => mealIndex === index ? { ...meal, ...patch } : meal),
    }));
  }

  function updateTargetMeal(index, patch) {
    setFavorite((current) => ({
      ...current,
      targetMeals: current.targetMeals.map((meal, mealIndex) => mealIndex === index ? { ...meal, ...patch } : meal),
    }));
  }

  function removePhysicalItem(mealIndex, itemIndex) {
    setFavorite((current) => ({
      ...current,
      physicalMeals: current.physicalMeals
        .map((meal, index) => index === mealIndex ? { ...meal, items: meal.items.filter((_, foodIndex) => foodIndex !== itemIndex) } : meal)
        .filter((meal) => meal.items.length),
    }));
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-end bg-black/75 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Editar día guardado">
      <section className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-[#0d141b] p-4 shadow-2xl sm:rounded-[1.6rem] sm:p-5">
        <header className="flex items-start justify-between gap-3">
          <div><span className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Día guardado</span><h2 className="mt-1 text-xl font-black text-white">Editar planificación</h2></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-300" aria-label="Cerrar"><X size={17} /></button>
        </header>

        <label className="mt-5 block text-[10px] font-black uppercase tracking-wide text-zinc-400">Nombre
          <input value={favorite.name} onChange={(event) => setFavorite((current) => ({ ...current, name: event.target.value }))} maxLength={80} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-black text-white outline-none focus:border-emerald-300/50" />
        </label>

        <div className="mt-5 grid gap-3">
          {favorite.physicalMeals.map((meal, mealIndex) => (
            <article key={meal.id || `physical-${mealIndex}`} className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-3">
              <div className="flex items-center gap-2">
                <input value={meal.nombre || ""} onChange={(event) => updatePhysicalMeal(mealIndex, { nombre: event.target.value })} className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-black text-white outline-none" aria-label="Nombre de la comida" />
                <button type="button" onClick={() => setFavorite((current) => ({ ...current, physicalMeals: current.physicalMeals.filter((_, index) => index !== mealIndex) }))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-300/20 text-rose-200" aria-label="Quitar comida"><Trash2 size={16} /></button>
              </div>
              <div className="mt-2 grid gap-1.5">
                {(meal.items || []).map((item, itemIndex) => (
                  <div key={`${item.id || item.nombreSnapshot}-${itemIndex}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                    <div className="min-w-0"><strong className="block truncate text-xs text-white">{item.nombreSnapshot || item.nombre || "Alimento"}</strong><span className="text-[10px] font-bold text-zinc-500">{item.cantidad || 0} {item.unidad || "g"} · {kcal(item.kcal)}</span></div>
                    <button type="button" onClick={() => removePhysicalItem(mealIndex, itemIndex)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-200" aria-label="Quitar alimento"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </article>
          ))}

          {favorite.targetMeals.map((meal, mealIndex) => (
            <article key={meal.id || `target-${mealIndex}`} className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.045] p-3">
              <div className="flex items-center gap-2">
                <input value={meal.name || ""} onChange={(event) => updateTargetMeal(mealIndex, { name: event.target.value })} className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-black text-white outline-none" aria-label="Nombre de la meta" />
                <button type="button" onClick={() => setFavorite((current) => ({ ...current, targetMeals: current.targetMeals.filter((_, index) => index !== mealIndex) }))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-300/20 text-rose-200" aria-label="Quitar meta"><Trash2 size={16} /></button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[['kcal', 'Kcal'], ['proteina', 'P'], ['carbs', 'C'], ['grasas', 'G']].map(([key, label]) => <label key={key} className="text-[9px] font-black uppercase text-zinc-500">{label}<input type="number" min="0" step="0.1" value={meal.target?.[key] ?? 0} onChange={(event) => updateTargetMeal(mealIndex, { target: { ...meal.target, [key]: event.target.value } })} className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-xs font-black text-white outline-none" /></label>)}
              </div>
            </article>
          ))}
        </div>

        <p className="mt-4 text-xs font-bold leading-relaxed text-zinc-500">Podés cambiar nombres y metas, o quitar comidas y alimentos. Los cambios afectan sólo este día guardado.</p>
        <footer className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] text-sm font-black text-zinc-300">Cancelar</button>
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 text-sm font-black text-[#04110d] disabled:opacity-50">{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}Guardar cambios</button>
        </footer>
      </section>
    </div>
  );
}
