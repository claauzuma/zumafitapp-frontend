import { useEffect, useMemo, useState } from 'react'
import './mobile.css'

/**
 * MobileMenu.jsx — v4.2
 * - Encabezado con día (Lunes/Martes/...) en dorado
 * - Flechas para navegar días (ayer/mañana)
 * - Persistencia por día (cada fecha guarda su propio menú)
 * - Mantiene lógica N−1, clasificación EXCLUSIVA y meal-name
 */

// ===================== “DB” de alimentos =====================
const FOODS_DB = [
  { name: 'Pechuga de pollo',    kcal100:165, p:31,  c:0,   f:3.6 },
  { name: 'Arroz blanco cocido', kcal100:130, p:2.7, c:28,  f:0.3 },
  { name: 'Ensalada',            kcal100:25,  p:1,   c:4,   f:0.2 },
  { name: 'Avena',               kcal100:389, p:17,  c:66,  f:7 },
  { name: 'Leche descremada',    kcal100:35,  p:3.4, c:5,   f:0.2 },
  { name: 'Yogur griego',        kcal100:59,  p:10,  c:3.6, f:0.4 },
  { name: 'Carne magra',         kcal100:180, p:26,  c:0,   f:8 },
  { name: 'Batata al horno',     kcal100:86,  p:1.6, c:20.1,f:0.1 },
  { name: 'Aceite de oliva',     kcal100:884, p:0,   c:0,   f:100 },
  { name: 'Banana',              kcal100:89,  p:1.1, c:23,  f:0.3 },
  { name: 'Pan integral',        kcal100:247, p:13,  c:41,  f:4.2 },
  { name: 'Queso crema light',   kcal100:162, p:8.2, c:6.6, f:12.8 },
  { name: 'Clara de huevo',      kcal100:52,  p:11,  c:.7,  f:.2 },
  { name: 'Atún al natural',     kcal100:116, p:26,  c:0,   f:1 },
]
const byName = new Map(FOODS_DB.map(f => [f.name.toLowerCase(), f]))
const findFood = (q) => byName.get(q.toLowerCase()) || null

// ===================== Mock API =====================
const MockApi = {
  async generate({ meal, targets, desired, includeExtras }) {
    await delay(600)
    let base = desired?.length
      ? desired.map(d => ({ name: d.name, grams: Number(d.grams) || guessGrams(d.name, targets?.kcal || 600) }))
      : (PRESETS[meal] || [])

    let items = base.map(b => ({
      name: b.name,
      grams: b.grams,
      kcal100: (findFood(b.name)?.kcal100 ?? 100),
      macros100: pickMacros(b.name),
    }))

    if (includeExtras) {
      const t = calcTotals(items.map(mapDtoToItem))
      if (targets?.kcal && t.kcal < targets.kcal - 60) {
        items.push({ name:'Pechuga de pollo', grams:120, kcal100:165, macros100: pickMacros('Pechuga de pollo') })
        const t2 = calcTotals(items.map(mapDtoToItem))
        if (t2.kcal < targets.kcal - 40) {
          const miss = Math.min(15, Math.max(0, Math.round((targets.kcal - t2.kcal)/9)))
          if (miss>0) items.push({ name:'Aceite de oliva', grams:miss, kcal100:884, macros100: pickMacros('Aceite de oliva') })
        }
      }
    } else {
      if (targets?.kcal && items.length>0) {
        const t = calcTotals(items.map(mapDtoToItem)).kcal
        if (t>0) {
          const factor = Math.max(0.2, Math.min(2, targets.kcal / t))
          items = items.map(it => ({ ...it, grams: Math.max(1, Math.round(it.grams*factor)) }))
        }
      }
    }
    return { meal, items }

    function pickMacros(name){ const f=findFood(name); return f ? {p:f.p, c:f.c, f:f.f} : {p:5,c:10,f:2} }
    function guessGrams(name,kcalTarget){ const per100=(findFood(name)?.kcal100 ?? 120); const split=Math.max(1,Math.min(3,Math.round((kcalTarget||600)/400))); return Math.round(((kcalTarget/split)/per100)*100) }
  },
}

const PRESETS = {
  Desayuno: [{ name:'Avena', grams:60 },{ name:'Leche descremada', grams:250 },{ name:'Banana', grams:100 }],
  Almuerzo: [{ name:'Pechuga de pollo', grams:180 },{ name:'Arroz blanco cocido', grams:200 },{ name:'Aceite de oliva', grams:10 }],
  Merienda: [{ name:'Yogur griego', grams:200 },{ name:'Banana', grams:120 },{ name:'Pan integral', grams:60 }],
  Cena:     [{ name:'Carne magra', grams:180 },{ name:'Batata al horno', grams:220 },{ name:'Ensalada', grams:150 }],
}
function delay(ms){ return new Promise(r => setTimeout(r, ms)) }

// ===================== App =====================
const DEFAULT_DATA = {
  Desayuno: [],
  Almuerzo: [ itemFromDB('Pechuga de pollo',180), itemFromDB('Arroz blanco cocido',200) ],
  Merienda: [ itemFromDB('Yogur griego',170) ],
  Cena:     [ itemFromDB('Carne magra',180), itemFromDB('Batata al horno',200) ],
}

function itemFromDB(name, grams=100) {
  const f = findFood(name) || { kcal100:100, p:5, c:10, f:2 }
  return {
    id: cryptoId(),
    name,
    grams,
    baseGrams: grams,
    kcal100: f.kcal100,
    macros100: { p:f.p, c:f.c, f:f.f }
  }
}
function cryptoId(){ try{ return (self.crypto||window.crypto).randomUUID().slice(0,8) }catch{ return Math.random().toString(36).slice(2,10) } }

const CATEGORIES = ['Desayuno','Almuerzo','Merienda','Cena']

// Storage por día (migración desde v4 plano)
const STORAGE_KEY = 'zumafit-menu-v5-days'
const TODAY_ISO = toISODate(new Date())

// ====== Clasificación EXCLUSIVA (macro dominante) ======
function dominantMacroOf(it){
  const { p, c, f } = it.macros100 || { p:0, c:0, f:0 }
  // desempate: protein > carbs > fat
  if (p >= c && p >= f) return 'protein'
  if (c >= f) return 'carbs'
  return 'fat'
}
function macrosOf(it){ return [dominantMacroOf(it)] }

/* ===== Helpers N−1 ===== */
function countInArrByMacro(arr, macro){
  return arr.reduce((n,it)=> n + (dominantMacroOf(it) === macro ? 1 : 0), 0)
}
function allowedEditedFor(arr, macro){ return Math.max(0, countInArrByMacro(arr, macro) - 1) }

// ====== Nombre de la comida ======
function buildMealName(items){
  if (!items || items.length===0) return { title:'', tag:'' }
  const totals = items.map(calcOne).reduce((acc,t)=>({ p:acc.p+t.p, c:acc.c+t.c, f:acc.f+t.f }), {p:0,c:0,f:0})
  const macro = totals.p >= totals.c && totals.p >= totals.f ? 'protein'
              : totals.c >= totals.f ? 'carbs' : 'fat'
  const tag = macro === 'protein' ? 'Plato proteico'
           : macro === 'carbs'   ? 'Plato alto en carbohidratos'
           : 'Plato alto en grasas'
  const top = [...items].sort((a,b)=> b.grams - a.grams).slice(0,3).map(x=> x.name)
  let title = ''
  if (top.length === 1) title = top[0]
  else if (top.length === 2) title = `${top[0]} con ${top[1]}`
  else title = `${top[0]}, ${top[1]} y ${top[2]}`
  return { title, tag }
}

// ====== Utilidades fecha ======
function toISODate(d){
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
function addDaysISO(iso, delta){
  const [y,m,d] = iso.split('-').map(Number)
  const nd = new Date(y, m-1, d+delta)
  return toISODate(nd)
}
function weekdayLongEs(iso){
  const [y,m,d] = iso.split('-').map(Number)
  const dt = new Date(y, m-1, d)
  const s = dt.toLocaleDateString('es-AR', { weekday:'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ===================== Componente =====================
export default function MobileMenu() {
  // Rol
  const [isAdmin, setIsAdmin] = useState(false)

  // Estado por día: store { [isoDate]: dataDeEseDia }
  const [dayStore, setDayStore] = useState(() => {
    // migración: si existía v4 (plano), lo guardamos como hoy
    const oldV4 = localStorage.getItem('zumafit-menu-v4')
    const v5 = localStorage.getItem(STORAGE_KEY)
    if (v5){
      try { return JSON.parse(v5) || { [TODAY_ISO]: DEFAULT_DATA } } catch { /* ignore */ }
    }
    if (oldV4){
      try {
        const parsed = JSON.parse(oldV4)
        return { [TODAY_ISO]: parsed }
      } catch {}
    }
    return { [TODAY_ISO]: DEFAULT_DATA }
  })

  // Fecha activa
  const [activeDate, setActiveDate] = useState(TODAY_ISO)

  // Datos del día activo
  const [data, setData] = useState(() => dayStore[activeDate] || DEFAULT_DATA)

  // Al cambiar data → persistir en store del día
  useEffect(() => {
    setDayStore(prev => {
      const next = { ...prev, [activeDate]: data }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [data, activeDate])

  // Cambiar de día
  const goRelDay = (delta) => {
    const nextISO = addDaysISO(activeDate, delta)
    setActiveDate(nextISO)
    setData(dayStore[nextISO] || DEFAULT_DATA)
    // reset de LRU por macro al cambiar de día
    setMacroEdited({ protein:[], carbs:[], fat:[] })
  }

  // Buscador
  const [query, setQuery] = useState('')
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return FOODS_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0,10)
  }, [query])

  // Estado general
  const [editingId, setEditingId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [targets, setTargets] = useState({ kcal:700, protein:45, carbs:80, fat:20 })
  const [includeExtras, setIncludeExtras] = useState(true)

  // LRU por macro (día actual)
  const [macroEdited, setMacroEdited] = useState({ protein:[], carbs:[], fat:[] })

  // Items de la comida activa
  const [active, setActive] = useState('Almuerzo')
  const items = useMemo(()=> data[active] || [], [data, active])

  // Totales
  const totalsCategory = useMemo(()=> calcTotals(items), [items])
  const totalsAll = useMemo(()=> CATEGORIES.reduce((acc,cat)=> sumTotals(acc, calcTotals(data[cat]||[])), emptyTotals()), [data])

  // Nombre lindo de la comida
  const mealName = useMemo(()=> buildMealName(items), [items])

  // --- Acciones ---
  function addFromDB(foodName, grams=100){
    const f = findFood(foodName); if(!f) return
    const it = itemFromDB(f.name, grams)
    setData(prev => ({ ...prev, [active]: [...(prev[active]||[]), it] }))
    setQuery(''); showToast(`Agregado: ${foodName}`)
  }
  function handleDelete(id){
    if (!confirm('¿Eliminar este alimento?')) return
    setData(prev => ({ ...prev, [active]: prev[active].filter(x=> x.id!==id) }))
    setMacroEdited(me => ({
      protein: me.protein.filter(x => x !== id),
      carbs:   me.carbs.filter(x => x !== id),
      fat:     me.fat.filter(x => x !== id),
    }))
  }
  function updateItem(id, patch){
    setData(prev => ({ ...prev, [active]: prev[active].map(x=> x.id===id ? {...x, ...patch} : x) }))
  }

  function takeControlAndRevertPrevious(currentId){
    if (isAdmin) return true
    const list = data[active] || []
    const current = list.find(i => i.id === currentId)
    if (!current) return false
    const currentMacros = macrosOf(current) // 1 elemento
    // bloqueo: si solo hay 1 en ese macro, no se puede editar
    for (const m of currentMacros){
      if (allowedEditedFor(list, m) === 0) {
        showToast('Necesitás al menos 2 alimentos de ese macro para editar.')
        return false
      }
    }

    let allowedToEdit = true
    setData(prev => {
      const work = { ...prev }
      const arr  = [...(work[active] || [])]
      const newME = {
        protein: [...macroEdited.protein],
        carbs:   [...macroEdited.carbs],
        fat:     [...macroEdited.fat],
      }
      let changed = false

      for (const m of currentMacros){
        const lru = newME[m]
        const pos = lru.indexOf(currentId)
        if (pos !== -1) lru.splice(pos,1)
        lru.push(currentId)

        const allowed = allowedEditedFor(arr, m)
        while (lru.length > allowed){
          const oldestId = lru.shift()
          if (oldestId && oldestId !== currentId){
            const prevItem = arr.find(x => x.id === oldestId)
            if (prevItem && typeof prevItem.baseGrams === 'number'){
              prevItem.grams = prevItem.baseGrams
              changed = true
            }
          } else {
            allowedToEdit = false
          }
        }
      }

      if (changed) work[active] = arr
      setMacroEdited(newME)
      return work
    })
    return allowedToEdit
  }

  function adjustGrams(id, delta){
    const it = (data[active] || []).find(x => x.id === id); if(!it) return
    if (!isAdmin && !takeControlAndRevertPrevious(id)) return
    const newGrams = Math.max(0, Math.round((it.grams + delta) * 10) / 10)
    updateItem(id, { grams:newGrams })
  }
  function directSetGrams(id, val){
    const n = toNum(val); if (!Number.isFinite(n)) return
    if (!isAdmin && !takeControlAndRevertPrevious(id)) return
    updateItem(id, { grams: Math.max(0, n) })
  }

  async function generateFromMock(){
    try{
      setIsLoading(true)
      const body = { meal:active, targets, includeExtras, desired: items.map(x=>({name:x.name, grams:x.grams})) }
      const payload = await MockApi.generate(body)
      const newItems = (payload.items || []).map(dto => ({
        id: cryptoId(),
        name: dto.name,
        grams: dto.grams,
        baseGrams: dto.grams,
        kcal100: dto.kcal100,
        macros100: dto.macros100
      }))
      setData(prev=> ({ ...prev, [active]: newItems }))
      setMacroEdited({ protein:[], carbs:[], fat:[] })
      showToast(includeExtras ? 'Generado (incluyendo extras) ✅' : 'Generado (solo estos) ✅')
    }catch(e){
      console.error(e); showToast('Error generando el menú')
    }finally{ setIsLoading(false) }
  }

  function showToast(msg){ setToast(msg); setTimeout(() => setToast(''), 1800) }

  // ===================== UI =====================
  const dayLabel = weekdayLongEs(activeDate)

  return (
    <div className="page">
      <Header
        dayLabel={dayLabel}
        dateISO={activeDate}
        onPrev={()=> goRelDay(-1)}
        onNext={()=> goRelDay(1)}
      />

      <RoleSwitch isAdmin={isAdmin} onChange={setIsAdmin} />

      {/* Tabs */}
      <div className="tabs">
        {CATEGORIES.map(cat=>(
          <button key={cat} className={`tab ${active===cat?'active':''}`} onClick={()=>setActive(cat)}>{cat}</button>
        ))}
      </div>

      {/* Objetivos + generar + modo */}
      <div className="targets">
        <div className="row">
          <label>Kcal<input type="number" value={targets.kcal} onChange={e=> setTargets({...targets, kcal: toNum(e.target.value)})} /></label>
          <label>P (g)<input type="number" value={targets.protein} onChange={e=> setTargets({...targets, protein: toNum(e.target.value)})} /></label>
          <label>C (g)<input type="number" value={targets.carbs} onChange={e=> setTargets({...targets, carbs: toNum(e.target.value)})} /></label>
          <label>G (g)<input type="number" value={targets.fat} onChange={e=> setTargets({...targets, fat: toNum(e.target.value)})} /></label>
        </div>
        <div className="genRow">
          <div className="segmented">
            <button className={includeExtras?'seg active':'seg'} onClick={()=>setIncludeExtras(true)}>Incluir alimentos</button>
            <button className={!includeExtras?'seg active':'seg'} onClick={()=>setIncludeExtras(false)}>Solo estos alimentos</button>
          </div>
          <button className="cta" onClick={generateFromMock} disabled={isLoading}>{isLoading?'Generando…':'🎯 Generar menú'}</button>
        </div>
      </div>

      {/* Buscador con sugerencias */}
      <div className="search">
        <div className="searchBox">
          <input value={query} onChange={e=> setQuery(e.target.value)} placeholder="Buscar alimento del catálogo…" />
          {query && suggestions.length>0 && (
            <div className="suggestions">
              {suggestions.map(s=>(
                <button key={s.name} className="suggItem" onClick={()=> addFromDB(s.name,100)}>
                  {s.name} <span className="meta">{s.kcal100} kcal · P{s.p} C{s.c} G{s.f}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="add" onClick={()=>{
          const f=findFood(query); if(!f){ alert('No existe en catálogo. Elegí una sugerencia.'); return }
          addFromDB(f.name,100)
        }} disabled={!findFood(query)}>+ Agregar</button>
      </div>

      {/* Nombre de la comida */}
      {(mealName.title || mealName.tag) && (
        <div
          className="mealName"
          style={{
            maxWidth: 480, margin: '8px auto 4px', padding: '10px 12px',
            border: '1px solid #232323', borderRadius: 12, background: '#121212',
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:8
          }}
        >
          <div style={{fontWeight:800}}>{mealName.title}</div>
          <div style={{fontSize:12, padding:'4px 8px', borderRadius:999, background:'#161616', border:'1px solid #2b2b2b', color:'#cfcfcf'}}>
            {mealName.tag}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="list">
        {items.map(x=>(
          <FoodCard
            key={x.id} item={x} isAdmin={isAdmin}
            onMinus={()=> adjustGrams(x.id, -10)}
            onPlus={()=> adjustGrams(x.id, +10)}
            onDirectChange={(val)=> directSetGrams(x.id, val)}
            onEdit={()=> setEditingId(x.id)}
            onDelete={()=> handleDelete(x.id)}
          />
        ))}
        {items.length===0 && <p className="empty">No hay alimentos en esta categoría.</p>}
      </div>

      <TotalsBar title={`Totales ${active}`} totals={totalsCategory} />

      <footer className="footer">
        <div><strong>Total día:</strong> {fmt(totalsAll.kcal)} kcal</div>
        <div className="macro-row"><span>P: {fmt(totalsAll.p)}g</span><span>C: {fmt(totalsAll.c)}g</span><span>G: {fmt(totalsAll.f)}g</span></div>
      </footer>

      {editingId && (
        <EditModal
          item={items.find(i=> i.id===editingId)}
          onClose={()=> setEditingId(null)}
          onSave={(patch)=>{ updateItem(editingId, patch); setEditingId(null) }}
          isAdmin={isAdmin}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ====== Componentes menores ======
function RoleSwitch({ isAdmin, onChange }) {
  return (
    <div className="roleSwitch">
      <span className="roleLabel">Modo:</span>
      <label className={`roleOpt ${isAdmin ? 'active' : ''}`}>
        <input type="radio" name="role" checked={isAdmin} onChange={()=> onChange(true)} />
        Admin
      </label>
      <label className={`roleOpt ${!isAdmin ? 'active' : ''}`}>
        <input type="radio" name="role" checked={!isAdmin} onChange={()=> onChange(false)} />
        No admin
      </label>
    </div>
  )
}

function Header({ dayLabel, dateISO, onPrev, onNext }){
  return (
    <header className="header">
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <button className="navArrow" aria-label="Día anterior" onClick={onPrev}>‹</button>
        <div>
          <h1 style={{margin:0, display:'flex', alignItems:'center', gap:8}}>
            Menú diario
            <span className="dayChip">{dayLabel}</span>
          </h1>
          <span className="date">{dateISO}</span>
        </div>
        <button className="navArrow" aria-label="Día siguiente" onClick={onNext}>›</button>
      </div>
    </header>
  )
}

function FoodCard({ item, isAdmin, onMinus, onPlus, onDirectChange, onEdit, onDelete }) {
  const t = calcOne(item)
  const dom = dominantMacroOf(item)
  const chip = dom === 'protein' ? '🥩' : dom === 'carbs' ? '🍞' : '🥑'
  const chipClass = dom === 'protein' ? 'protein' : dom === 'carbs' ? 'carbs' : 'fat'

  return (
    <div className="card">
      <div className="card-left">
        <div className="badges">
          <span className={`chip ${chipClass}`} title={
            dom==='protein'?'Alto en proteína': dom==='carbs'?'Alto en carbohidratos':'Alto en grasas'
          }>{chip}</span>
        </div>
        <div className="title">{item.name}</div>
        <div className="sub">{item.grams} g · {fmt(t.kcal)} kcal</div>
        <div className="macros"><span>P {fmt(t.p)}g</span><span>C {fmt(t.c)}g</span><span>G {fmt(t.f)}g</span></div>
      </div>
      <div className="card-right">
        <div className="qty">
          <button className="round" onClick={onMinus}>-</button>
          <input className="gramsInput" value={item.grams} onChange={(e)=> onDirectChange(e.target.value)} inputMode="numeric" />
          <button className="round" onClick={onPlus}>+</button>
        </div>
        <div className="actions">
          {isAdmin && <button onClick={onEdit} className="secondary">Editar</button>}
          <button onClick={onDelete} className="danger">Eliminar</button>
        </div>
      </div>
    </div>
  )
}

function TotalsBar({ title, totals }) {
  return (
    <div className="totals">
      <div className="t-left"><strong>{title}</strong></div>
      <div className="t-right">
        <span>{fmt(totals.kcal)} kcal</span>
        <span>P {fmt(totals.p)}g</span>
        <span>C {fmt(totals.c)}g</span>
        <span>G {fmt(totals.f)}g</span>
      </div>
    </div>
  )
}

function EditModal({ item, onClose, onSave, isAdmin }) {
  if (!isAdmin) return null
  const [form, setForm] = useState(()=> ({
    name:item.name, grams:item.grams, kcal100:item.kcal100,
    p:item.macros100.p, c:item.macros100.c, f:item.macros100.f
  }))
  const update = (k,v)=> setForm(s=> ({...s,[k]:v}))
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=> e.stopPropagation()}>
        <h3>Editar alimento</h3>
        <div className="grid">
          <label>Nombre<input value={form.name} onChange={e=>update('name', e.target.value)} /></label>
          <label>Gramos<input type="number" value={form.grams} onChange={e=>update('grams', toNum(e.target.value))} /></label>
          <label>Kcal x100g<input type="number" value={form.kcal100} onChange={e=>update('kcal100', toNum(e.target.value))} /></label>
          <label>Proteína x100g<input type="number" value={form.p} onChange={e=>update('p', toNum(e.target.value))} /></label>
          <label>Carbos x100g<input type="number" value={form.c} onChange={e=>update('c', toNum(e.target.value))} /></label>
          <label>Grasa x100g<input type="number" value={form.f} onChange={e=>update('f', toNum(e.target.value))} /></label>
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={()=> onSave({
            name: form.name.trim() || item.name,
            grams: Math.max(0, Number(form.grams)||0),
            kcal100: Math.max(0, Number(form.kcal100)||0),
            macros100: { p: toNum(form.p), c: toNum(form.c), f: toNum(form.f) },
          })}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

// ===================== Helpers =====================
function calcOne(it){ const f=it.grams/100; return { kcal:it.kcal100*f, p:it.macros100.p*f, c:it.macros100.c*f, f:it.macros100.f*f } }
function emptyTotals(){ return { kcal:0,p:0,c:0,f:0 } }
function sumTotals(a,b){ return { kcal:a.kcal+b.kcal, p:a.p+b.p, c:a.c+b.c, f:a.f+b.f } }
function calcTotals(list){ return list.map(calcOne).reduce(sumTotals, emptyTotals()) }
function fmt(n){ return Math.round(n*10)/10 }
function toNum(v){ const n=parseFloat(v); return Number.isFinite(n)? n : 0 }
function mapDtoToItem(dto){ return { id: cryptoId(), name:dto.name, grams:dto.grams, kcal100:dto.kcal100, macros100:dto.macros100 } }

export { }
