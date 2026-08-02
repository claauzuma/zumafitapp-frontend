import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, LockKeyhole, Search, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { authorizeClientMenuGeneration, getClientNutritionCapabilities } from "./clientMenusApi.js";
import { listAlimentos } from "../nutricion/nutricionApi.js";
import {
  GENERATOR_DAY_KEYS,
  GENERATOR_MEAL_TYPES,
  generateClientMenuPreview,
  nutritionTargetForMenuGeneration,
} from "./clientMenuGeneration.js";
import { dayKeyFromIsoDate, mealTypesForCount } from "../entrenado/menu/menuQuickActions.js";

const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MEAL_LABELS = {
  desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena",
  snack: "Snack", colacion: "Colacion", pre_entreno: "Pre-entreno", post_entreno: "Post-entreno",
};

function foodKey(food = {}) {
  return String(food.id || food._id || food.alimentoId || "");
}

export default function ClientMenuGenerator({ user = {}, targetOverride = null, initialSettings = null, selectedDate = "", onGenerated, onCancel }) {
  const navigate = useNavigate();
  const target = useMemo(() => targetOverride?.kcal ? targetOverride : nutritionTargetForMenuGeneration(user), [targetOverride, user]);
  const [capabilities, setCapabilities] = useState(user?.nutritionCapabilities || null);
  const [name, setName] = useState("Mi menu generado");
  const [selectedDays, setSelectedDays] = useState([dayKeyFromIsoDate(selectedDate)]);
  const [mealTypes, setMealTypes] = useState(() => mealTypesForCount(initialSettings?.mealCount || 4));
  const [distribution, setDistribution] = useState(initialSettings?.distribution === "equal" ? "equal" : "balanced");
  const [sourceMode, setSourceMode] = useState(initialSettings?.mode === "from_scratch" ? "foods" : "combined");
  const [allowRepeats, setAllowRepeats] = useState(initialSettings?.allowRepeats === true);
  const [assisted, setAssisted] = useState(false);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getClientNutritionCapabilities()
      .then((value) => { if (active) setCapabilities(value); })
      .catch(() => { if (active) setCapabilities(user?.nutritionCapabilities || null); });
    return () => { active = false; };
  }, [user?.nutritionCapabilities]);

  useEffect(() => {
    if (foodSearch.trim().length < 2) { setFoodResults([]); return undefined; }
    let active = true;
    const timer = window.setTimeout(() => {
      listAlimentos({ search: foodSearch, limit: 12 })
        .then((value) => { if (active) setFoodResults(value?.alimentos || []); })
        .catch(() => { if (active) setFoodResults([]); });
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [foodSearch]);

  const plan = String(capabilities?.plan || user?.personalPlan || user?.plan || "free").toLowerCase();
  const allowed = capabilities?.canGenerateAutomaticMenu === true && capabilities?.hasCoach !== true && capabilities?.clientType !== "with_coach";
  const dayLimit = Math.max(1, Number(capabilities?.limits?.menuDays) || (plan === "free" ? 1 : 7));
  const maxFoods = Math.max(1, Number(capabilities?.limits?.equivalentMealFoods) || (plan === "vip" ? 10 : 6));

  function toggleDay(day) {
    setSelectedDays((current) => current.includes(day)
      ? (current.length > 1 ? current.filter((value) => value !== day) : current)
      : current.length < dayLimit ? [...current, day] : current);
  }

  function toggleMeal(type) {
    setMealTypes((current) => current.includes(type)
      ? (current.length > 1 ? current.filter((value) => value !== type) : current)
      : current.length < 10 ? [...current, type] : current);
  }

  function toggleFood(food) {
    const id = foodKey(food);
    setSelectedFoods((current) => current.some((value) => foodKey(value) === id)
      ? current.filter((value) => foodKey(value) !== id)
      : current.length < maxFoods ? [...current, food] : current);
  }

  async function generate() {
    if (!allowed || loading) return;
    if (!target.kcal) { setError("Primero defini un objetivo diario con calorias."); return; }
    if ((sourceMode === "foods" || sourceMode === "combined") && sourceMode === "foods" && !selectedFoods.length) {
      setError("Selecciona al menos un alimento para generar desde alimentos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const authorization = await authorizeClientMenuGeneration();
      if (authorization?.policy !== "tracking_calorie_fill_v1" || authorization?.previewOnly !== true) {
        throw new Error("El servidor no autorizo una vista previa segura.");
      }
      const preview = await generateClientMenuPreview({
        target, mealTypes, selectedDays, selectedDate, distribution, sourceMode, foods: selectedFoods,
        allowRepeats, assisted, name,
        preferFavorites: initialSettings?.preferFavorites === true,
        firstMealTime: initialSettings?.firstMealTime || "",
      });
      onGenerated(preview);
    } catch (generationError) {
      setError(generationError?.message || "No pudimos generar la vista previa.");
    } finally {
      setLoading(false);
    }
  }

  if (capabilities && !allowed) {
    return (
      <section className="client-generator client-generator-locked" aria-labelledby="generator-title">
        <LockKeyhole size={28} />
        <span className="nl-kicker">Generacion automatica</span>
        <h1 id="generator-title">{capabilities?.hasCoach ? "Tu planificacion la gestiona tu coach" : "Disponible en Pro y VIP"}</h1>
        <p>{capabilities?.hasCoach ? "Podes usar el menu asignado y Tracking. La generacion autonoma no reemplaza silenciosamente el plan profesional." : "Free permite crear un menu manual de un dia. Pro y VIP agregan generacion automatica con la misma logica segura de Tracking."}</p>
        <div className="client-generator-actions">
          <button type="button" className="nl-secondary" onClick={onCancel}>Crear manualmente</button>
          <button type="button" className="nl-primary" onClick={() => navigate("/app/planes")}>Ver planes</button>
        </div>
      </section>
    );
  }

  return (
    <section className="client-generator" aria-labelledby="generator-title">
      <header className="client-generator-head">
        <button type="button" className="nl-icon" onClick={onCancel} aria-label="Volver al creador manual"><ArrowLeft size={18} /></button>
        <div><span className="nl-kicker">Vista previa sin registrar consumo</span><h1 id="generator-title">Generar menu automatico</h1></div>
      </header>

      <div className="client-generator-target">
        <strong>Objetivo diario actual</strong>
        <span>{Math.round(target.kcal)} kcal · P {Math.round(target.proteina)} · C {Math.round(target.carbs)} · G {Math.round(target.grasas)}</span>
      </div>

      <div className="client-generator-grid">
        <label className="client-generator-field"><span>Nombre del menu</span><input value={name} maxLength={180} onChange={(event) => setName(event.target.value)} /></label>
        <label className="client-generator-field"><span>Origen de las propuestas</span><select value={sourceMode} onChange={(event) => setSourceMode(event.target.value)}><option value="combined">Biblioteca + alimentos</option><option value="library">Solo biblioteca</option><option value="foods">Alimentos elegidos</option></select></label>
        <label className="client-generator-field"><span>Distribucion diaria</span><select value={distribution} onChange={(event) => setDistribution(event.target.value)}><option value="balanced">Segun tipo de comida</option><option value="equal">Partes iguales</option></select></label>
      </div>

      <fieldset className="client-generator-options"><legend>Dias ({selectedDays.length}/{dayLimit})</legend><div>{GENERATOR_DAY_KEYS.slice(0, dayLimit).map((day, index) => <button key={day} type="button" className={selectedDays.includes(day) ? "active" : ""} onClick={() => toggleDay(day)} aria-pressed={selectedDays.includes(day)}>{DAY_LABELS[index]}</button>)}</div></fieldset>
      <fieldset className="client-generator-options"><legend>Comidas del dia</legend><div>{GENERATOR_MEAL_TYPES.map((type) => <button key={type} type="button" className={mealTypes.includes(type) ? "active" : ""} onClick={() => toggleMeal(type)} aria-pressed={mealTypes.includes(type)}>{mealTypes.includes(type) ? <Check size={13} /> : null}{MEAL_LABELS[type]}</button>)}</div></fieldset>

      {sourceMode !== "library" ? (
        <section className="client-generator-foods">
          <label><Search size={16} /><input value={foodSearch} onChange={(event) => setFoodSearch(event.target.value)} placeholder="Buscar alimentos base" aria-label="Buscar alimentos para generar el menu" /></label>
          {selectedFoods.length ? <div className="client-generator-selected">{selectedFoods.map((food) => <button key={foodKey(food)} type="button" onClick={() => toggleFood(food)}>{food.nombre}<X size={12} /></button>)}</div> : null}
          {foodResults.length ? <div className="client-generator-results">{foodResults.map((food) => <button key={foodKey(food)} type="button" disabled={!selectedFoods.some((value) => foodKey(value) === foodKey(food)) && selectedFoods.length >= maxFoods} onClick={() => toggleFood(food)}>{food.nombre}<small>{food.unidad || "g"}</small></button>)}</div> : null}
          <small>Hasta {maxFoods} alimentos por propuesta. Si no elegis ninguno en modo combinado, se usa la biblioteca.</small>
        </section>
      ) : null}

      <div className="client-generator-switches">
        <label><input type="checkbox" checked={allowRepeats} onChange={(event) => setAllowRepeats(event.target.checked)} /> Permitir repetir comidas</label>
        {sourceMode !== "library" ? <label><input type="checkbox" checked={assisted} onChange={(event) => setAssisted(event.target.checked)} /> Permitir que el motor sugiera una fuente faltante</label> : null}
      </div>
      {error ? <div className="client-menu-warning compact error" role="alert">{error}</div> : null}
      <footer className="client-generator-actions"><button type="button" className="nl-secondary" onClick={onCancel} disabled={loading}>Cancelar</button><button type="button" className="nl-primary" onClick={generate} disabled={loading || !allowed}>{loading ? <Loader2 className="nl-spin" size={16} /> : <Sparkles size={16} />} Generar vista previa</button></footer>
    </section>
  );
}
