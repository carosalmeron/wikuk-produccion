/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars, no-loop-func */
// ═══════════════════════════════════════════════════════════════════════════════
// WIKUK PRODUCCIÓN 2.0 — FASE 1: Configuración maestra + Auth
// Firebase: Auth (email/pass) + Firestore en tiempo real
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from "react";
import { initializeApp, getApps, deleteApp } from "firebase/app";
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence,
  signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs,
} from "firebase/firestore";

// ── FIREBASE ───────────────────────────────────────────────────────────────────
const APP_VERSION = "v2.11.0";

const firebaseConfig = {
  apiKey: "AIzaSyAwuxF2MYzBjQhr9pD4d2pPSq9_8n65_hA",
  authDomain: "wikuk-produccion.firebaseapp.com",
  projectId: "wikuk-produccion",
  storageBucket: "wikuk-produccion.firebasestorage.app",
  messagingSenderId: "736475581587",
  appId: "1:736475581587:web:7c03223392778273091166",
};
const app = initializeApp(firebaseConfig);
let auth;
try {
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence] });
} catch(e) { auth = getAuth(app); }
const db = getFirestore(app);

// ── TOKENS DE DISEÑO ───────────────────────────────────────────────────────────
const C = {
  bg:"#F8FAFC", card:"#FFFFFF", card2:"#F1F5F9",
  navy:"#0F1E2E", navyL:"#1A3044",
  accent:"#0F172A", accent2:"#3B82F6",
  text:"#0F172A", muted:"#94A3B8", mutedD:"#64748B",
  border:"#E2E8F0",
  green:"#16A34A", red:"#EF4444", amber:"#F59E0B", blue:"#3B82F6", purple:"#8B5CF6",
  greenBg:"#F0FDF4", redBg:"#FEF2F2", amberBg:"#FFFBEB", blueBg:"#EFF6FF",
};
const F = {
  h:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  b:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
};
// Tokens ZONA PLANTA (terminal industrial: alto contraste, táctil grande)
const P = {
  bg:"#f4f4f4", card:"#ffffff", accent:"#e06000", text:"#333333", muted:"#888888",
  border:"#e0e0e0", green:"#1e7e3e", red:"#c0392b", amber:"#b45309",
  fh:"'Barlow Condensed','Arial Narrow',sans-serif",
};
const uid = () => Math.random().toString(36).slice(2, 10);

// ── PLANIFICACIÓN: constantes y utilidades de calendario ───────────────────────
const TARIFA_MO = 15.25;            // €/h coste real (27.444 €/año ÷ 1.800 h)
const LINEAS_FISICAS = 2;
const TURNOS_ABIERTOS = 2;
const SLOTS_DIA = LINEAS_FISICAS * TURNOS_ABIERTOS;   // huecos línea-turno por día
const pad2 = n => String(n).padStart(2, "0");
const eur = n => (Math.round(n)).toLocaleString("es-ES") + " €";
const num = n => (Math.round(n)).toLocaleString("es-ES");

const isoWeek = (fecha) => {
  if (!fecha) return "";
  const t = new Date(fecha + "T12:00:00");
  t.setDate(t.getDate() + 4 - (t.getDay() || 7));
  const y0 = new Date(t.getFullYear(), 0, 1);
  const w = Math.ceil((((t - y0) / 86400000) + 1) / 7);
  return `${t.getFullYear()}-W${pad2(w)}`;
};
const lunesDeSemana = (key) => {
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  const d = new Date(jan4);
  d.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (w - 1) * 7);
  return d;
};
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const diasDeSemana = (key) => {
  const l = lunesDeSemana(key);
  return [0,1,2,3,4].map(i => { const d = new Date(l); d.setDate(l.getDate()+i); return ymd(d); });
};
const diasLaborablesMes = (periodo) => {
  const [y, m] = periodo.split("-").map(Number);
  const out = [];
  const d = new Date(y, m-1, 1);
  while (d.getMonth() === m-1) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) out.push(ymd(d));
    d.setDate(d.getDate()+1);
  }
  return out;
};
const semanasDeMes = (periodo) => [...new Set(diasLaborablesMes(periodo).map(isoWeek))];
const nombreMes = (periodo) => {
  const [y, m] = periodo.split("-").map(Number);
  return new Date(y, m-1, 1).toLocaleDateString("es-ES", { month:"long", year:"numeric" });
};
const rotuloSemana = (key) => {
  const ds = diasDeSemana(key);
  const f = (s) => new Date(s+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
  return `${f(ds[0])} – ${f(ds[4])}`;
};
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; };
const sumaPeriodo = (periodo, delta) => {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m-1+delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
};

// Recursos necesarios para una lista de {producto_id, cantidad}
const calcRecursos = (items, productos) => {
  let uds=0, slots=0, personaTurnos=0, costeMP=0, costeMO=0;
  const materias = {};
  const sinRitmo = [];
  (items||[]).forEach(it => {
    const p = productos.find(x => x.id === it.producto_id);
    if (!p) return;
    const q = parseFloat(it.cantidad)||0;
    uds += q;
    const ritmo = parseFloat(p.uds_turno_linea)||0;
    const pers  = parseInt(p.personas_linea)||3;
    if (ritmo <= 0) { if (!sinRitmo.includes(p.nombre)) sinRitmo.push(p.nombre); }
    const turnos = ritmo > 0 ? q/ritmo : 0;
    slots += turnos * (pers/3);
    personaTurnos += turnos * pers;
    costeMP += (parseFloat(p.coste_mp_objetivo)||0) * q;
    costeMO += turnos * pers * 8 * TARIFA_MO;
    (p.materias_asignadas||[]).forEach(m => {
      const rend = (parseFloat(m.rendimiento)||100)/100;
      const metros = (parseFloat(p.metros_finales)||0) * (parseFloat(m.capas)||0) / (rend||1) * q;
      materias[m.mp_id] = (materias[m.mp_id]||0) + metros;
    });
  });
  return { uds, slots, personaTurnos, costeMP, costeMO, coste: costeMP+costeMO, materias, sinRitmo };
};


const ROLES = {
  operario:    { label:"Operario",             icon:"👷" },
  sup_fabrica: { label:"Supervisor Fábrica",   icon:"🎯" },
  sup_calidad: { label:"Supervisor Calidad",   icon:"🧪" },
  gerencia:    { label:"Gerencia",             icon:"📊" },
};

// ── HOOK: colección Firestore en tiempo real ───────────────────────────────────
function useCol(name, orderField = null) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const ref = orderField
      ? query(collection(db, name), orderBy(orderField))
      : collection(db, name);
    const unsub = onSnapshot(ref, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [name, orderField]);
  return [rows, loading];
}
const save = (col, id, data) => setDoc(doc(db, col, id), data, { merge: true });
const del  = (col, id) => deleteDoc(doc(db, col, id));

// ── UI BASE ────────────────────────────────────────────────────────────────────
const Header = ({ title, onBack, sub, right }) => (
  <div style={{display:"flex",alignItems:"center",padding:"14px 16px",background:C.navy,gap:12,position:"sticky",top:0,zIndex:10}}>
    {onBack && <button onClick={onBack} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",fontFamily:F.h,fontSize:18,fontWeight:700,cursor:"pointer",lineHeight:1}}>‹</button>}
    <div style={{flex:1}}>
      <h1 style={{fontFamily:F.h,fontWeight:800,fontSize:19,color:"#fff",letterSpacing:0.2,margin:0}}>{title}</h1>
      {sub && <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:1}}>{sub}</div>}
    </div>
    {right}
  </div>
);
const Card = ({ children, style = {}, color, onClick }) => (
  <div onClick={onClick} style={{background:C.card,border:`1px solid ${color||C.border}`,borderRadius:16,padding:16,cursor:onClick?"pointer":"default",boxShadow:"0 1px 2px rgba(15,23,42,0.04)",...style}}>{children}</div>
);
const Btn = ({ children, onClick, v = "primary", disabled, style = {} }) => {
  const vs = {
    primary:  { background:C.accent, color:"#fff", border:"none" },
    secondary:{ background:"#fff", color:C.text, border:`1px solid ${C.border}` },
    ghost:    { background:C.blueBg, color:C.blue, border:`1px solid ${C.blue}33` },
    danger:   { background:C.redBg, color:C.red, border:`1px solid ${C.red}33` },
    green:    { background:C.greenBg, color:C.green, border:`1px solid ${C.green}33` },
  };
  return <button onClick={disabled?undefined:onClick} style={{fontFamily:F.h,fontWeight:700,fontSize:15,borderRadius:12,padding:"14px 20px",cursor:disabled?"not-allowed":"pointer",width:"100%",textAlign:"center",opacity:disabled?0.35:1,...vs[v],...style}}>{children}</button>;
};
const Field = ({ label, value, onChange, type = "text", placeholder, min, step }) => (
  <div style={{marginBottom:14}}>
    {label && <label style={{display:"block",fontFamily:F.h,fontWeight:600,fontSize:12,color:C.mutedD,marginBottom:5,letterSpacing:0.2}}>{label}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} step={step}
      style={{width:"100%",background:"#fff",border:`1px solid ${C.border}`,color:C.text,borderRadius:12,padding:"12px 14px",fontFamily:F.b,fontSize:15,outline:"none",boxSizing:"border-box"}}/>
  </div>
);
const Sel = ({ label, value, onChange, options = [], placeholder }) => (
  <div style={{marginBottom:14}}>
    {label && <label style={{display:"block",fontFamily:F.h,fontWeight:600,fontSize:12,color:C.mutedD,marginBottom:5,letterSpacing:0.2}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",background:"#fff",border:`1px solid ${C.border}`,color:value?C.text:C.muted,borderRadius:12,padding:"12px 14px",fontFamily:F.b,fontSize:15,outline:"none",appearance:"none",boxSizing:"border-box"}}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Toast = ({ msg, ok = true }) => (
  <div style={{background:ok?C.greenBg:C.redBg,border:`1.5px solid ${ok?C.green:C.red}`,borderRadius:12,padding:"13px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
    <span style={{fontSize:18}}>{ok?"✓":"!"}</span>
    <span style={{fontFamily:F.b,fontWeight:600,fontSize:15,color:ok?C.green:C.red}}>{msg}</span>
  </div>
);
const Pill = ({ children, color = C.muted, bg = "#fff" }) => (
  <span style={{background:bg,border:`1.5px solid ${color}`,color,borderRadius:20,padding:"3px 12px",fontSize:12,fontFamily:F.h,fontWeight:700,letterSpacing:0.4}}>{children}</span>
);
const IconBtn = ({ onClick, danger, children }) => (
  <button onClick={onClick} style={{background:"#fff",border:`1.5px solid ${danger?C.red:C.border}`,color:danger?C.red:C.muted,borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:15}}>{children}</button>
);
const Empty = ({ icon, text }) => (
  <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
    <div style={{fontSize:46,marginBottom:10}}>{icon}</div>
    <p style={{fontFamily:F.h,fontSize:16}}>{text}</p>
  </div>
);

// ── LOGO ───────────────────────────────────────────────────────────────────────
const WikukBrand = ({ size = "large" }) => {
  const L = size === "large";
  return (
    <svg width={L?200:110} height={L?64:36} viewBox={`0 0 ${L?200:110} ${L?64:36}`}>
      <text x="2" y={(L?64:36)*0.82} fontFamily="'Arial Black',Arial" fontWeight="900" fontSize={L?58:32} letterSpacing="-1.5" fill="#1a1a1a">wikuk</text>
      <text x={L?183:101} y={L?12:7} fontFamily="Arial" fontSize={L?13:7} fill="#1a1a1a" opacity="0.5">®</text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN + BOOTSTRAP PRIMER ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ noUsers }) {
  const [modo, setModo] = useState(noUsers ? "registro" : "login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(()=>{ if(noUsers) setModo("registro"); },[noUsers]);

  const login = async () => {
    setBusy(true); setErr("");
    try { await signInWithEmailAndPassword(auth, email.trim(), pass); }
    catch { setErr("Email o contraseña incorrectos"); }
    setBusy(false);
  };

  const registrar = async () => {
    if (!name.trim() || !email.trim() || pass.length < 6) { setErr("Completa todo (contraseña mín. 6 caracteres)"); return; }
    setBusy(true); setErr("");
    try {
      // ¿Existe ya alguna cuenta de gerencia activa?
      const snap = await getDocs(collection(db, "usuarios"));
      const hayGerencia = snap.docs.some(d => d.data().rol === "gerencia" && d.data().activo !== false);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      await save("usuarios", cred.user.uid, {
        nombre: name.trim(), email: email.trim(),
        rol: hayGerencia ? "operario" : "gerencia",
        turno: "", centro: "", centros: [],
        coste_hora: 0, horas_dia: 8, activo: true,
      });
    } catch (e) {
      setErr(e.code === "auth/email-already-in-use"
        ? "Ese email ya tiene cuenta — usa Entrar"
        : "Error: " + e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:72,height:72,borderRadius:20,background:C.navy,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:34,marginBottom:14}}>🏭</div>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:28,color:C.text,letterSpacing:-0.5}}>wikuk <span style={{fontSize:12,fontWeight:400,color:C.muted}}>{APP_VERSION}</span></div>
          <p style={{color:C.mutedD,fontSize:15,marginTop:4,fontFamily:F.b}}>
            {modo==="registro" ? "Crear cuenta" : "Control de Producción"}
          </p>
        </div>
        <Card>
          {err && <Toast msg={err} ok={false}/>}
          {modo==="registro" && <Field label="Tu nombre" value={name} onChange={setName} placeholder="Ej: Antonio Caro"/>}
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@empresa.com"/>
          <Field label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••"/>
          <Btn onClick={modo==="registro" ? registrar : login} disabled={busy}>
            {busy ? "…" : modo==="registro" ? "Crear cuenta" : "Entrar"}
          </Btn>
          <button onClick={()=>{setModo(m=>m==="registro"?"login":"registro");setErr("");}}
            style={{background:"none",border:"none",color:C.accent,fontFamily:F.b,fontSize:14,fontWeight:600,cursor:"pointer",width:"100%",marginTop:14,textAlign:"center"}}>
            {modo==="registro" ? "¿Ya tienes cuenta? Entrar" : "¿Primera vez? Crear cuenta"}
          </button>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USUARIOS (crea cuenta Auth con app secundaria para no cerrar sesión del admin)
// ═══════════════════════════════════════════════════════════════════════════════
function UsuariosScreen({ onBack, turnos, centros }) {
  const [usuarios] = useCol("usuarios", "nombre");
  const [edit, setEdit] = useState(null); // null | {} | {id,...}
  const [msg, setMsg] = useState(null);

  if (edit !== null) return <UsuarioForm onBack={()=>setEdit(null)} ep={edit.id?edit:null} turnos={turnos} centros={centros} onDone={m=>{setEdit(null);setMsg(m);setTimeout(()=>setMsg(null),2500);}}/>;

  const grupos = ["gerencia","sup_fabrica","sup_calidad","operario"];
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="USUARIOS" onBack={onBack} sub={`${usuarios.length} registrados`}/>
      <div style={{padding:14}}>
        {msg && <Toast msg={msg}/>}
        <Btn onClick={()=>setEdit({})} style={{marginBottom:14}}>＋ Nuevo Usuario</Btn>
        {usuarios.length===0 && <Empty icon="👥" text="Sin usuarios"/>}
        {grupos.map(rol=>{
          const rows = usuarios.filter(u=>u.rol===rol);
          if(!rows.length) return null;
          return (
            <div key={rol} style={{marginBottom:16}}>
              <div style={{fontFamily:F.h,fontWeight:700,fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>
                {ROLES[rol].icon} {ROLES[rol].label} · {rows.length}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {rows.map(u=>(
                  <Card key={u.id} style={{opacity:u.activo?1:0.5}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text}}>{u.nombre} {!u.activo&&<Pill>INACTIVO</Pill>}</div>
                        <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                          {u.email}
                          {u.rol==="operario" && <> · 🏭 {centros.find(c=>c.id===u.centro)?.nombre||"sin centro"} · {turnos.find(t=>t.id===u.turno)?.nombre||"sin turno"} · {u.coste_hora||0}€/h</>}
                          {(u.rol==="sup_fabrica"||u.rol==="sup_calidad") && u.centros?.length>0 && <> · 🏭 {u.centros.map(id=>centros.find(c=>c.id===id)?.nombre).filter(Boolean).join(", ")}</>}
                        </div>
                      </div>
                      <IconBtn onClick={()=>setEdit(u)}>✏️</IconBtn>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsuarioForm({ onBack, ep, turnos, centros, onDone }) {
  const [nombre, setNombre] = useState(ep?.nombre||"");
  const [email, setEmail]   = useState(ep?.email||"");
  const [pass, setPass]     = useState("");
  const [rol, setRol]       = useState(ep?.rol||"operario");
  const [turno, setTurno]   = useState(ep?.turno||"");
  const [centro, setCentro] = useState(ep?.centro||"");           // operario: un centro
  const [centrosSup, setCentrosSup] = useState(ep?.centros||[]);  // supervisores: varios
  const [costeHora, setCosteHora] = useState(ep?.coste_hora?.toString()||"");
  const [horasDia, setHorasDia]   = useState(ep?.horas_dia?.toString()||"8");
  const [activo, setActivo] = useState(ep?.activo!==false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleCentroSup = id => setCentrosSup(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const guardar = async () => {
    if (!nombre.trim()) { setErr("Falta el nombre"); return; }
    if (rol==="operario" && !centro) { setErr("Asigna un centro al operario"); return; }
    setBusy(true); setErr("");
    const data = {
      nombre: nombre.trim(), email: email.trim(), rol,
      turno, centro: rol==="operario" ? centro : "",
      centros: (rol==="sup_fabrica"||rol==="sup_calidad") ? centrosSup : [],
      coste_hora: parseFloat(costeHora)||0,
      horas_dia: parseFloat(horasDia)||8, activo,
    };
    try {
      if (ep) {
        await save("usuarios", ep.id, data);
        onDone("Usuario actualizado");
      } else {
        if (!email.trim() || pass.length < 6) { setErr("Email y contraseña (mín. 6) obligatorios"); setBusy(false); return; }
        // App secundaria: crear usuario sin cerrar la sesión del admin
        const secondary = initializeApp(firebaseConfig, "secondary-"+uid());
        try {
          const sAuth = getAuth(secondary);
          const cred = await createUserWithEmailAndPassword(sAuth, email.trim(), pass);
          await save("usuarios", cred.user.uid, data);
          await signOut(sAuth);
          onDone("Usuario creado — ya puede iniciar sesión");
        } finally { deleteApp(secondary).catch(()=>{}); }
      }
    } catch (e) {
      setErr(e.code==="auth/email-already-in-use" ? "Ese email ya está registrado" : "Error: "+e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title={ep?"EDITAR USUARIO":"NUEVO USUARIO"} onBack={onBack}/>
      <div style={{padding:14}}>
        {err && <Toast msg={err} ok={false}/>}
        <Card style={{marginBottom:14}}>
          <Field label="Nombre completo" value={nombre} onChange={setNombre} placeholder="Ej: Vanesa García"/>
          <Field label="Email (para iniciar sesión)" value={email} onChange={ep?()=>{}:setEmail} type="email" placeholder="vanesa@wikuk.com"/>
          {!ep && <Field label="Contraseña inicial" value={pass} onChange={setPass} type="password" placeholder="mín. 6 caracteres"/>}
          <Sel label="Rol" value={rol} onChange={setRol}
            options={Object.entries(ROLES).map(([v,r])=>({value:v,label:`${r.icon} ${r.label}`}))}/>
          {rol==="operario" && <>
            <Sel label="Centro de trabajo" value={centro} onChange={setCentro} placeholder="Seleccionar centro…"
              options={centros.map(c=>({value:c.id,label:`🏭 ${c.nombre}`}))}/>
            <Sel label="Turno" value={turno} onChange={setTurno} placeholder="Seleccionar turno…"
              options={turnos.map(t=>({value:t.id,label:`${t.nombre} (${t.hora_inicio}–${t.hora_fin})`}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Coste hora (€)" value={costeHora} onChange={setCosteHora} type="number" placeholder="12.50" min="0" step="0.01"/>
              <Field label="Horas / día" value={horasDia} onChange={setHorasDia} type="number" placeholder="8" min="1" step="0.5"/>
            </div>
          </>}
          {(rol==="sup_fabrica"||rol==="sup_calidad") && <>
            <div style={{fontFamily:F.h,fontWeight:700,fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Centros que supervisa</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
              {centros.map(c=>(
                <button key={c.id} onClick={()=>toggleCentroSup(c.id)}
                  style={{background:"#fff",border:`1.5px solid ${centrosSup.includes(c.id)?C.green:C.border}`,color:centrosSup.includes(c.id)?C.green:C.muted,borderRadius:20,padding:"6px 14px",fontSize:14,fontFamily:F.h,fontWeight:600,cursor:"pointer"}}>
                  {centrosSup.includes(c.id)?"✓ ":""}🏭 {c.nombre}
                </button>
              ))}
              {centros.length===0 && <span style={{fontSize:13,color:C.muted}}>Primero crea centros de trabajo</span>}
            </div>
          </>}
          <button onClick={()=>setActivo(a=>!a)}
            style={{background:"#fff",border:`1.5px solid ${activo?C.green:C.border}`,color:activo?C.green:C.muted,borderRadius:20,padding:"6px 16px",fontSize:14,fontFamily:F.h,fontWeight:600,cursor:"pointer"}}>
            {activo?"✓ Activo":"◯ Inactivo"}
          </button>
        </Card>
        <Btn onClick={guardar} disabled={busy}>{busy?"Guardando…":"💾 Guardar"}</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENTROS DE TRABAJO
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// CARGA INICIAL — catálogo wikuk completo en 1 clic
// ═══════════════════════════════════════════════════════════════════════════════
function SeedScreen({ onBack }) {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const add = (m) => setLog(l=>[...l, m]);

  const run = async () => {
    if (running) return;
    if (!window.confirm("Se creará el catálogo completo: centro, líneas, turnos, motivos, procesos, 26 materias, 3 proveedores y 31 productos con escandallo. ¿Continuar?")) return;
    setRunning(true);
    try {
      // 1) CENTRO
      const centroId = uid();
      await save("centros", centroId, { nombre:"Obrador", ubicacion:"Baza", tarifa_mo:12.5, activo:true });
      add("🏭 Centro Obrador (tarifa 12,50 €/h)");
      // 2) LÍNEAS
      for (const n of ["Maextra","Especta","MX368"]) await save("lineas", uid(), { centro:centroId, nombre:n, activo:true });
      add("⚙️ 3 líneas: Maextra · Especta · MX368");
      // 3) TURNOS
      await save("turnos", uid(), { nombre:"Turno 1 · Mañana", hora_inicio:"06:00", hora_fin:"14:00" });
      await save("turnos", uid(), { nombre:"Turno 2 · Tarde", hora_inicio:"14:00", hora_fin:"22:00" });
      add("🕐 2 turnos (06-14 / 14-22)");
      // 4) MOTIVOS
      const mot = [["🔧","Avería máquina"],["📦","Falta materia prima"],["🔄","Cambio de formato"],["🧽","Limpieza"],["🧪","Pruebas"],["🎓","Formación"],["☕","Descanso"],["🔩","Poner flexibles"],["🫧","Desalar materia"],["🕳️","Desmoldar/secado"],["✏️","Otro"]];
      for (const [ic,nm] of mot) await save("motivos_paro", uid(), { nombre:nm, icono:ic });
      add(`⏸ ${mot.length} motivos de paro`);
      // 5) PROCESOS
      const procs = [["Desalar",false,true],["Entubar fina",false,false],["Entubar grueso",false,false],["Entubar malla",false,true],["Ensanchar",false,false],["Estirar",false,false],["Enrollar",false,false],["Plisar",false,false],["Secado/moldes",true,false],["Preparar mercancía",false,true]];
      for (const [nm,dif,ap] of procs) await save("procesos", uid(), { nombre:nm, diferido:dif, apoyo:ap });
      add(`⚙️ ${procs.length} procesos (secado diferido; desalar/malla/preparar como apoyo)`);
      // 6) PROVEEDORES
      for (const p of ["Proveedor MBL","Proveedor China","Proveedor grueso"]) await save("proveedores", uid(), { nombre:p, activo:true });
      add("🚚 3 proveedores (renombra con los reales)");
      // 7) MATERIAS
      const mats = [
        ["MBL60.90","m",90,0.133,85],["MBL65.90","m",90,0.133,85],["MBL55.60","m",60,0.133,85],["MBL60.60","m",60,0.133,85],
        ["MCL50.80","m",80,0.133,85],["MCL55.90","m",90,0.133,85],["TR1409","m",90,0.133,85],["B6.9K.BG","m",90,0.09,85],
        ["C4.8R","m",90,0.09,95],["C5.8R.BG","m",90,0.09,95],["C5.8BG","m",90,0.09,95],["C6.9R.BG","m",90,0.09,95],
        ["C6.8N.N32","m",90,0.09,95],["C7.9R.BG","m",90,0.09,95],["C7.9R.B6","m",90,0.09,95],["C7.8F","m",90,0.09,95],
        ["C8.8F","m",90,0.09,95],["C50.8K.BG","m",90,0.09,95],["CP155.81","m",90,0.09,95],["CP159.82","m",90,0.09,95],
        ["CPA258.80","m",90,0.09,95],["40/42-90m","m",90,0.09,95],["48/52-verra-Chile","m",90,0,85],["52/56-prueba","m",90,0,85],
        ["ORH4.10","m",9,0.55,110],["MALLA","m",10,0,100],
      ];
      const matId = {};
      for (const [cod,un,mm,pr,ro] of mats) {
        const id = uid(); matId[cod]=id;
        await save("materias_primas", id, { nombre:cod, unidad:un, precio_ud:pr, rendimiento_objetivo:ro, metros_madeja:mm });
      }
      add(`📦 ${mats.length} materias (85/95/110%, metros/madeja del código)`);
      // 8) PRODUCTOS  [codigo, obj, coste_fab, escandallo:[mat,capas]]
      const P1=[["MXP26.10F1"],["MXP28.10F2"],["MX28.10F2"],["MXP30.10F3"],["MX30.10F3"],["MXP32.10F4"],["MX32.10F4"],["MX34.10F4"],["MX36.10F4"],["MXP38.10R1"],["MXP40.10R3"],["MXP40.10"],["MXP42.10"],["MXP45.10"],["MX150.10F4"],["MX155.10F4"]];
      for (const [cod] of P1) await save("productos", uid(), { nombre:cod, centro:centroId, unidad:"Stick", metros_finales:10, objetivo_diario:300, coste_objetivo:1.25, procesos_asignados:[], materias_asignadas:[] });
      const mk=(cod,obj,coste,esc)=>save("productos", uid(), { nombre:cod, centro:centroId, unidad:"Stick", metros_finales:10, objetivo_diario:obj, coste_objetivo:coste, procesos_asignados:[], materias_asignadas:esc.map(([m,k])=>({mp_id:matId[m],capas:k})) });
      await mk("MX238.10R3",100,3.50,[["MBL60.90",2]]);
      await mk("MX258.10-10R4",100,3.50,[["MBL60.90",2]]);
      await mk("MX264.10R4",100,3.50,[["MBL65.90",2]]);
      await mk("MX268.10R4",100,3.50,[["MBL65.90",2]]);
      await mk("MX358.10R3",70,5.25,[["MBL60.90",3]]);
      await mk("MX360.10R3",70,5.25,[["MBL60.90",3]]);
      await mk("MX364.10R4",70,5.25,[["MBL65.90",3]]);
      await mk("MX368.10R4",70,5.25,[["MBL65.90",3]]);
      await mk("MX364.10R4M",45,7.75,[["MBL65.90",3],["MALLA",1]]);
      await mk("MX368.10R4M",45,7.75,[["MBL65.90",3],["MALLA",1]]);
      await mk("ESP60.10",50,7.75,[["MBL65.90",2],["ORH4.10",1]]);
      await mk("ESP65.10",50,7.75,[["MBL65.90",2],["ORH4.10",1]]);
      await mk("ESP70",50,7.75,[["MBL65.90",2],["ORH4.10",1]]);
      await mk("ESP75.63",38,9.25,[["MBL65.90",3],["ORH4.10",1]]);
      add("🏷️ 31 productos con escandallo, objetivo diario y coste de fabricación");
      // 9) COSTES
      await save("config_costes", centroId, { amortizacion_mes:2431, alquiler_mes:1200, luz_agua_mes:900, fijos_mensuales:4531, horas_persona_mes:1848 });
      add("💰 Costes Obrador: 2.431+1.200+900 = 4.531 €/mes ÷ 1.848 h = 2,45 €/h");
      add("✅ CARGA COMPLETA — revisa cada maestro y ajusta lo que quieras");
      setDone(true);
    } catch(e) {
      add("❌ Error: "+e.message);
    }
    setRunning(false);
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="CARGA INICIAL WIKUK" onBack={onBack} sub="El catálogo validado, en un clic"/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <div style={{fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:12}}>
            Crea de golpe: 1 centro · 3 líneas · 2 turnos · 11 motivos · 10 procesos · 26 materias · 3 proveedores · 31 productos con escandallo · costes reales. Todo editable después.
          </div>
          {!done && <Btn onClick={run} disabled={running}>{running?"⏳ Cargando…":"🚀 Cargar catálogo completo"}</Btn>}
        </Card>
        {log.length>0 && (
          <Card>
            {log.map((m,i)=><div key={i} style={{padding:"6px 0",fontSize:14,color:C.text,borderBottom:`1px solid ${C.border}`}}>{m}</div>)}
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINCRONIZAR CATÁLOGO — lee grupo-consolidado-crm (solo lectura) y enriquece productos
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2 · ÓRDENES DE PRODUCCIÓN + registro diario
// ═══════════════════════════════════════════════════════════════════════════════
function OrdenesScreen({ onBack, perfil, productos, lineas, turnos, centros, mps, motivos, usuarios }) {
  const [ordenes] = useCol("ordenes", "fecha");
  const [producciones] = useCol("producciones", "fecha");
  const [showForm, setShowForm] = useState(false);
  const [editOrden, setEditOrden] = useState(null);
  const [regOrden, setRegOrden] = useState(null); // orden a la que registrar producción
  const [filtro, setFiltro] = useState("activas");

  const prodDe = (oid) => producciones.filter(p=>p.orden_id===oid).reduce((s,p)=>s+(parseFloat(p.cantidad)||0),0);
  const estadoDe = (o) => {
    const hechas = prodDe(o.id);
    if (o.cerrada) return "CERRADA";
    if (hechas >= (o.cantidad||0) && o.cantidad>0) return "COMPLETA";
    if (hechas > 0) return "PARCIAL";
    return "PLANIFICADA";
  };
  const EST = { PLANIFICADA:{c:C.muted,bg:C.card2,t:"⚪ Planificada"}, PARCIAL:{c:C.amber,bg:C.amberBg,t:"🟡 En curso"},
                COMPLETA:{c:C.green,bg:C.greenBg,t:"🟢 Completa"}, CERRADA:{c:C.blue,bg:C.blueBg,t:"✔ Cerrada"} };

  const visibles = ordenes.filter(o=>{
    const e = estadoDe(o);
    if (filtro==="activas") return e!=="CERRADA";
    if (filtro==="cerradas") return e==="CERRADA";
    return true;
  }).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));

  if (showForm || editOrden) return <OrdenForm onBack={()=>{setShowForm(false);setEditOrden(null);}} ep={editOrden}
    productos={productos} lineas={lineas} turnos={turnos} centros={centros}/>;
  if (regOrden) return <RegistrarProduccion onBack={()=>setRegOrden(null)} orden={regOrden} perfil={perfil}
    turnos={turnos} hechas={prodDe(regOrden.id)} producciones={producciones.filter(p=>p.orden_id===regOrden.id)}
    productos={productos} mps={mps} motivos={motivos} usuarios={usuarios}/>;

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="ÓRDENES DE PRODUCCIÓN" onBack={onBack} sub="Nº OT · producto · cantidad · lo pendiente vive aquí"/>
      <div style={{padding:14}}>
        <Btn onClick={()=>setShowForm(true)}>＋ Nueva Orden</Btn>
        <div style={{display:"flex",gap:6,margin:"14px 0"}}>
          {[["activas","Activas"],["cerradas","Cerradas"],["todas","Todas"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFiltro(k)}
              style={{background:filtro===k?C.text:"#fff",color:filtro===k?"#fff":C.muted,border:`1px solid ${filtro===k?C.text:C.border}`,borderRadius:20,padding:"6px 16px",fontSize:13,fontFamily:F.h,fontWeight:700,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        {visibles.length===0 && <Empty icon="📋" text="Sin órdenes aquí. Crea la primera con ＋ Nueva Orden."/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {visibles.map(o=>{
            const p = productos.find(x=>x.id===o.producto_id);
            const l = lineas.find(x=>x.id===o.linea_id);
            const hechas = prodDe(o.id);
            const est = estadoDe(o); const E = EST[est];
            const pdte = Math.max(0,(o.cantidad||0)-hechas);
            const pct = o.cantidad>0 ? Math.min(100, hechas/o.cantidad*100) : 0;
            return (
              <Card key={o.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontFamily:F.h,fontWeight:800,fontSize:18,color:C.text}}>
                      {o.numero?`OT ${o.numero} · `:""}{p?.nombre||"?"}
                    </div>
                    {prodSub(p) && <div style={{fontSize:12,color:C.muted,marginTop:1}}>{prodSub(p)}</div>}
                    <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                      {o.fecha} · {l?.nombre||"sin línea"} · {o.tipo||"Plan"}{o.cliente?` · 👤 ${o.cliente}`:""}
                    </div>
                  </div>
                  <Pill color={E.c} bg={E.bg}>{E.t}</Pill>
                </div>
                <div style={{marginTop:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:4}}>
                    <span style={{fontFamily:F.h,fontWeight:800,color:C.text}}>{hechas} / {o.cantidad||0} {p?.unidad||"ud"}</span>
                    {pdte>0 && est!=="CERRADA" && <span style={{color:C.amber,fontWeight:700}}>faltan {pdte}</span>}
                  </div>
                  <div style={{height:8,background:C.card2,borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:pct>=100?C.green:C.accent,borderRadius:4}}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                  {!o.cerrada && <Btn v="secondary" onClick={()=>setRegOrden(o)}>➕ Producción</Btn>}
                  <IconBtn onClick={()=>setEditOrden(o)}>✏️</IconBtn>
                  {!o.cerrada && est!=="PLANIFICADA" &&
                    <button onClick={()=>{if(window.confirm(`¿Cerrar la orden con ${hechas}/${o.cantidad}?`))save("ordenes",o.id,{cerrada:true,cerrada_por:perfil?.nombre||"",cerrada_at:new Date().toISOString()});}}
                      style={{background:"#fff",border:`1.5px solid ${C.green}`,color:C.green,borderRadius:10,padding:"8px 14px",fontFamily:F.h,fontWeight:700,fontSize:14,cursor:"pointer"}}>✔ Cerrar</button>}
                  {o.cerrada && <button onClick={()=>save("ordenes",o.id,{cerrada:false})}
                      style={{background:"#fff",border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"8px 14px",fontSize:13,cursor:"pointer"}}>↺ Reabrir</button>}
                  <IconBtn danger onClick={()=>{
                    const n = producciones.filter(x=>x.orden_id===o.id).length;
                    if (n>0) { window.alert(`⛔ No se puede borrar: tiene ${n} registros de producción. Ciérrala en su lugar.`); return; }
                    if(window.confirm("¿Eliminar orden sin producción?")) del("ordenes",o.id);
                  }}>🗑️</IconBtn>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrdenForm({ onBack, ep, productos, lineas, turnos, centros }) {
  const hoy = new Date().toISOString().slice(0,10);
  const [numero, setNumero] = useState(ep?.numero||"");
  const [tipo, setTipo] = useState(ep?.tipo||"Plan");
  const [cliente, setCliente] = useState(ep?.cliente||"");
  const [productoId, setProductoId] = useState(ep?.producto_id||"");
  const [lineaId, setLineaId] = useState(ep?.linea_id||"");
  const [turnoId, setTurnoId] = useState(ep?.turno_id||"");
  const [fecha, setFecha] = useState(ep?.fecha||hoy);
  const [cantidad, setCantidad] = useState(ep?.cantidad?.toString()||"");

  const prod = productos.find(p=>p.id===productoId);
  useEffect(()=>{ if(prod && !ep && !cantidad) setCantidad((prod.objetivo_diario||"").toString()); },[productoId]);
  const lineasDelCentro = lineas.filter(l=>!prod?.centro || l.centro===prod.centro);

  const guardar = async () => {
    if (!productoId || !fecha) { window.alert("Producto y fecha son obligatorios"); return; }
    await save("ordenes", ep?.id||uid(), {
      numero: numero.trim(), tipo, cliente: cliente.trim(),
      producto_id: productoId, centro: prod?.centro||"", linea_id: lineaId, turno_id: turnoId,
      fecha, cantidad: parseFloat(cantidad)||0, cerrada: ep?.cerrada||false,
      created_at: ep?.created_at||new Date().toISOString(),
    });
    onBack();
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title={ep?"EDITAR ORDEN":"NUEVA ORDEN"} onBack={onBack}/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Nº OT (SAP)" value={numero} onChange={setNumero} placeholder="1936"/>
            <Sel label="Tipo" value={tipo} onChange={setTipo}
              options={[{value:"Plan",label:"Plan"},{value:"Pedido",label:"Pedido"},{value:"Encargo",label:"Encargo cliente"}]}/>
          </div>
          {tipo!=="Plan" && <Field label="Cliente (opcional)" value={cliente} onChange={setCliente} placeholder="Ej: Ismael / nº pedido"/>}
          <ProductoBuscador value={productoId} onChange={setProductoId} productos={productos}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Sel label="Línea" value={lineaId} onChange={setLineaId} placeholder="Línea…"
              options={lineasDelCentro.map(l=>({value:l.id,label:l.nombre}))}/>
            <Sel label="Turno" value={turnoId} onChange={setTurnoId} placeholder="Turno…"
              options={turnos.map(t=>({value:t.id,label:t.nombre}))}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Fecha" value={fecha} onChange={setFecha} type="date"/>
            <Field label="Cantidad" value={cantidad} onChange={setCantidad} type="number" placeholder={prod?`obj: ${prod.objetivo_diario}`:"uds"} min="0" step="0.5"/>
          </div>
          {prod && <div style={{background:C.card2,borderRadius:10,padding:"10px 12px",fontSize:13,color:C.muted}}>
            🎯 Objetivo diario del producto: <b>{prod.objetivo_diario||"—"}</b> · Coste obj: <b>{prod.coste_objetivo||"—"} €/{prod.unidad}</b>
          </div>}
          <div style={{marginTop:12}}><Btn onClick={guardar}>💾 {ep?"Guardar cambios":"Crear Orden"}</Btn></div>
        </Card>
      </div>
    </div>
  );
}

function RegistrarProduccion({ onBack, orden, perfil, turnos, hechas, producciones, productos, mps, motivos, usuarios }) {
  const hoy = new Date().toISOString().slice(0,10);
  const producto = productos.find(p=>p.id===orden.producto_id);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [turnoId, setTurnoId] = useState(orden.turno_id||"");
  const [nota, setNota] = useState("");
  // Equipo
  const operarios = usuarios.filter(u=>u.rol==="operario" && u.activo!==false);
  const [equipo, setEquipo] = useState([]);
  const [horas, setHoras] = useState("8");
  // Consumos por lote
  const [consumos, setConsumos] = useState([]);
  const [cMat, setCMat] = useState("");
  const [cLote, setCLote] = useState("");
  const [cMad, setCMad] = useState("");
  const [cMet, setCMet] = useState("");
  // Paros
  const [paros, setParos] = useState([]);
  const [pMot, setPMot] = useState("");
  const [pMin, setPMin] = useState("");
  const [pNota, setPNota] = useState("");

  const pdte = Math.max(0,(orden.cantidad||0)-hechas);
  const escandallo = producto?.materias_asignadas||[];
  const matsEscandallo = escandallo.map(x=>mps.find(m=>m.id===x.mp_id)).filter(Boolean);
  const matsResto = mps.filter(m=>!escandallo.some(x=>x.mp_id===m.id));

  const capasDe = (mpId) => escandallo.find(x=>x.mp_id===mpId)?.capas||0;
  const metrosConsumo = (cs) => {
    const m = mps.find(x=>x.id===cs.materia_id);
    return (parseFloat(cs.madejas)||0)*(m?.metros_madeja||90) + (parseFloat(cs.metros)||0);
  };
  const rendConsumo = (cs) => {
    const q = parseFloat(cantidad)||0;
    const capas = capasDe(cs.materia_id);
    const cons = metrosConsumo(cs);
    if (!q || !capas || !cons || !producto?.metros_finales) return null;
    return Math.round(q*producto.metros_finales*capas/cons*1000)/10;
  };

  const addConsumo = () => {
    if (!cMat || (!cMad && !cMet)) { window.alert("Elige materia y pon madejas o metros"); return; }
    setConsumos(prev=>[...prev,{materia_id:cMat, lote:cLote.trim(), madejas:parseFloat(cMad)||0, metros:parseFloat(cMet)||0}]);
    setCLote(""); setCMad(""); setCMet("");
  };
  const addParo = () => {
    if (!pMot) return;
    setParos(prev=>[...prev,{motivo_id:pMot, minutos:parseFloat(pMin)||0, nota:pNota.trim()}]);
    setPMot(""); setPMin(""); setPNota("");
  };

  const registrar = async () => {
    const q = parseFloat(cantidad);
    if (!q || q<=0) { window.alert("Cantidad inválida"); return; }
    const consumosFinal = consumos.map(cs=>({ ...cs,
      metros_consumidos: metrosConsumo(cs), rendimiento_pct: rendConsumo(cs), capas: capasDe(cs.materia_id) }));
    await save("producciones", uid(), {
      orden_id: orden.id, producto_id: orden.producto_id, fecha, turno_id: turnoId, linea_id: orden.linea_id||"",
      cantidad: q, nota: nota.trim(),
      equipo, n_personas: equipo.length||null, horas_equipo: parseFloat(horas)||8,
      consumos: consumosFinal, paros,
      registrado_por: perfil?.nombre||perfil?.id||"", registrado_at: new Date().toISOString(),
    });
    // Upsert lotes vistos (para el ranking de proveedores)
    for (const cs of consumosFinal) {
      if (cs.lote) {
        const lid = (cs.materia_id+"_"+cs.lote).replace(/[^a-zA-Z0-9_-]/g,"_");
        await save("lotes", lid, { materia_id: cs.materia_id, codigo: cs.lote, ultima_fecha: fecha });
      }
    }
    onBack();
  };

  const SelMat = ({value,onChange}) => (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"12px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:15,fontFamily:F.b,background:"#fff",color:C.text,marginBottom:10}}>
      <option value="">Materia…</option>
      {matsEscandallo.length>0 && <optgroup label="── Del escandallo ──">
        {matsEscandallo.map(m=><option key={m.id} value={m.id}>{m.nombre} · {capasDe(m.id)} capa{capasDe(m.id)>1?"s":""}</option>)}
      </optgroup>}
      <optgroup label="── Otras ──">
        {matsResto.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
      </optgroup>
    </select>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="📝 PARTE DE PRODUCCIÓN" onBack={onBack} sub={`${orden.numero?`OT ${orden.numero} · `:""}${producto?.nombre||""}${prodSub(producto)?` · ${prodSub(producto)}`:""} · ${hechas}/${orden.cantidad}`}/>
      <div style={{padding:14}}>

        <Card style={{marginBottom:12}}>
          <Field label="Cantidad producida" value={cantidad} onChange={setCantidad} type="number" placeholder={pdte>0?`faltan ${pdte}`:"uds"} min="0" step="0.5"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Fecha" value={fecha} onChange={setFecha} type="date"/>
            <Sel label="Turno" value={turnoId} onChange={setTurnoId} placeholder="Turno…"
              options={turnos.map(t=>({value:t.id,label:t.nombre}))}/>
          </div>
        </Card>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:15,color:C.text,marginBottom:8}}>👥 EQUIPO</div>
          {operarios.length===0 && <div style={{fontSize:13,color:C.muted}}>Sin operarios dados de alta — crea usuarios con rol operario y aparecerán aquí como fichas.</div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {operarios.map(u=>{
              const on = equipo.includes(u.id);
              return <button key={u.id} onClick={()=>setEquipo(prev=>on?prev.filter(x=>x!==u.id):[...prev,u.id])}
                style={{background:on?C.accent:"#fff",color:on?"#fff":C.muted,border:`1.5px solid ${on?C.accent:C.border}`,borderRadius:20,padding:"7px 14px",fontSize:14,fontFamily:F.h,fontWeight:700,cursor:"pointer"}}>
                {on?"✓ ":""}{u.nombre}
              </button>;
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:C.card2,borderRadius:12,padding:"10px 12px",fontSize:14,color:C.muted}}>Personas: <b style={{color:C.text}}>{equipo.length||"—"}</b></div>
            <Field label="Horas del equipo" value={horas} onChange={setHoras} type="number" min="0" step="0.5"/>
          </div>
        </Card>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:15,color:C.text,marginBottom:2}}>📦 CONSUMOS POR LOTE</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Madejas O metros directos · el rendimiento se calcula solo con el escandallo ({producto?.metros_finales||"?"} m/ud)</div>
          {consumos.map((cs,i)=>{
            const m = mps.find(x=>x.id===cs.materia_id);
            const r = rendConsumo(cs);
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:14,gap:6,flexWrap:"wrap"}}>
                <span><b>{m?.nombre}</b>{cs.lote?<span style={{background:C.card2,borderRadius:8,padding:"2px 8px",fontSize:12,marginLeft:6}}>{cs.lote}</span>:null}
                  <span style={{color:C.muted}}> · {cs.madejas?`${cs.madejas} mad`:""}{cs.madejas&&cs.metros?" + ":""}{cs.metros?`${cs.metros} m`:""} = {metrosConsumo(cs).toFixed(0)} m</span></span>
                <span>{r!=null && <b style={{color:r>=85?C.green:r>=75?C.amber:C.red}}>{r}%</b>}
                  <button onClick={()=>setConsumos(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:C.red,cursor:"pointer",marginLeft:8}}>✕</button></span>
              </div>
            );
          })}
          <div style={{marginTop:10}}>
            <SelMat value={cMat} onChange={setCMat}/>
            <div style={{display:"grid",gridTemplateColumns:"1.2fr 0.9fr 0.9fr",gap:8}}>
              <Field value={cLote} onChange={setCLote} placeholder="Lote (ej 26.12/29)"/>
              <Field value={cMad} onChange={setCMad} type="number" placeholder="madejas" min="0" step="0.5"/>
              <Field value={cMet} onChange={setCMet} type="number" placeholder="+ metros" min="0" step="0.1"/>
            </div>
            <Btn v="ghost" onClick={addConsumo}>＋ Añadir consumo</Btn>
          </div>
        </Card>

        <Card style={{marginBottom:12}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:15,color:C.text,marginBottom:8}}>⏸ PAROS DEL DÍA</div>
          {paros.map((pa,i)=>{
            const mo = motivos.find(x=>x.id===pa.motivo_id);
            return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:14}}>
              <span>{mo?.icono} {mo?.nombre}{pa.minutos?` · ${pa.minutos}'`:""}{pa.nota?` · ${pa.nota}`:""}</span>
              <button onClick={()=>setParos(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:C.red,cursor:"pointer"}}>✕</button>
            </div>;
          })}
          <div style={{display:"grid",gridTemplateColumns:"1.4fr 0.6fr",gap:8,marginTop:8}}>
            <Sel value={pMot} onChange={setPMot} placeholder="Motivo…" options={motivos.map(m=>({value:m.id,label:`${m.icono} ${m.nombre}`}))}/>
            <Field value={pMin} onChange={setPMin} type="number" placeholder="min" min="0"/>
          </div>
          <Field value={pNota} onChange={setPNota} placeholder="Nota del paro (opcional)"/>
          <Btn v="ghost" onClick={addParo}>＋ Añadir paro</Btn>
        </Card>

        <Card style={{marginBottom:12}}>
          <Field label="Observaciones del parte" value={nota} onChange={setNota} placeholder="Ej: tiras largas, no iban rancias · prueba OK"/>
          <Btn onClick={registrar}>💾 Guardar Parte</Btn>
        </Card>

        {producciones.length>0 && (
          <Card>
            <div style={{fontFamily:F.h,fontWeight:700,fontSize:13,color:C.mutedD,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Partes de esta orden</div>
            {producciones.sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).map(r=>(
              <div key={r.id} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13.5}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                  <span><b>{r.fecha}</b> · {r.cantidad} uds{r.n_personas?` · ${r.n_personas}p`:""}
                    {(r.consumos||[]).map((cs,i)=>cs.rendimiento_pct!=null?<span key={i} style={{marginLeft:6,fontWeight:800,color:cs.rendimiento_pct>=85?C.green:cs.rendimiento_pct>=75?C.amber:C.red}}>{cs.rendimiento_pct}%</span>:null)}
                  </span>
                  <span style={{color:C.muted,fontSize:12}}>{r.registrado_por}
                    <button onClick={()=>{if(window.confirm("¿Eliminar parte?"))del("producciones",r.id);}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",marginLeft:6}}>✕</button></span>
                </div>
                {r.nota && <div style={{color:C.muted,fontSize:12,marginTop:2}}>📝 {r.nota}</div>}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 DIARIO DE FABRICACIÓN — el parte oficial del día (sustituye al WhatsApp)
// ═══════════════════════════════════════════════════════════════════════════════
const prodSub = (p) => {
  if (!p) return "";
  const cal = p.calibre_catalogo || ((p.nombre||"").match(/(?:MX|MXP|ESP)P?(\d{2})/)||[])[1] || "";
  return [p.descripcion, cal?`cal ${cal}`:"", p.metros_finales?`${p.metros_finales} m`:""].filter(Boolean).join(" · ");
};

function DiarioScreen({ onBack, productos, lineas, turnos, mps, motivos, usuarios, centros }) {
  const hoy = new Date().toISOString().slice(0,10);
  const [fecha, setFecha] = useState(hoy);
  const [ordenes] = useCol("ordenes");
  const [producciones] = useCol("producciones", "fecha");

  const partes = producciones.filter(p=>p.fecha===fecha);
  const totalUds = partes.reduce((s,p)=>s+(p.cantidad||0),0);
  const planDe = (o)=>{ if(o.plan_origen==="PROD"){ const pr=productos.find(p=>p.id===o.producto_id); return pr?.objetivo_diario||0; } return o.cantidad||0; };
  const ordenesDia = ordenes.filter(o=>o.fecha===fecha);
  const planDia = ordenesDia.reduce((s,o)=>s+planDe(o),0);
  const [abierto, setAbierto] = useState(null);
  const totalParosMin = partes.reduce((s,p)=>s+(p.paros||[]).reduce((x,pa)=>x+(pa.minutos||0),0),0);
  const rendimientos = partes.flatMap(p=>(p.consumos||[]).map(cs=>cs.rendimiento_pct).filter(r=>r!=null));
  const rendMedio = rendimientos.length? Math.round(rendimientos.reduce((a,b)=>a+b,0)/rendimientos.length) : null;
  const nombreDe = (uid) => usuarios.find(u=>u.id===uid)?.nombre||uid;
  const tarifa = (centros[0]?.tarifa_mo||12.5);

  const porTurno = {};
  partes.forEach(p=>{ const k=p.turno_id||"_"; (porTurno[k]=porTurno[k]||[]).push(p); });

  const mover = (d) => {
    const x = new Date(fecha); x.setDate(x.getDate()+d);
    setFecha(x.toISOString().slice(0,10));
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="📖 DIARIO DE FABRICACIÓN" onBack={onBack} sub="El documento oficial del día"/>
      <div style={{padding:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <IconBtn onClick={()=>mover(-1)}>◀</IconBtn>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
            style={{flex:1,padding:"12px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:16,fontFamily:F.h,fontWeight:700,textAlign:"center",background:"#fff",color:C.text}}/>
          <IconBtn onClick={()=>mover(1)}>▶</IconBtn>
          <IconBtn onClick={()=>window.print()}>🖨️</IconBtn>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[[totalUds+(planDia?` / ${planDia}`:""),"Uds"+(planDia?" / plan":"")],
            [planDia?Math.round(totalUds/planDia*100)+"%":"—","Cumplim."],
            [rendMedio!=null?rendMedio+"%":"—","Rend. medio"],
            [totalParosMin?totalParosMin+"'":"0'","Paros"]].map(([n,l],i)=>(
            <Card key={i} style={{textAlign:"center",padding:"12px 6px"}}>
              <div style={{fontFamily:F.h,fontWeight:900,fontSize:20,color:C.text}}>{n}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
            </Card>
          ))}
        </div>

        {partes.length===0 && <Empty icon="📖" text={`Sin partes el ${fecha}. Se registran desde Órdenes → ➕ Producción.`}/>}

        {Object.entries(porTurno).map(([tid, ps])=>{
          const t = turnos.find(x=>x.id===tid);
          return (
            <div key={tid} style={{marginBottom:16}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.mutedD,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
                🕐 {t?.nombre||"Sin turno"} {t?` · ${t.hora_inicio}-${t.hora_fin}`:""}
              </div>
              {ps.map(p=>{
                const prod = productos.find(x=>x.id===p.producto_id);
                const orden = ordenes.find(x=>x.id===p.orden_id);
                const lin = lineas.find(x=>x.id===p.linea_id);
                const costeFab = p.n_personas&&p.horas_equipo&&p.cantidad ? (p.n_personas*p.horas_equipo*tarifa/p.cantidad) : null;
                const rendsMP = (p.consumos||[]).map(cs=>cs.rendimiento_pct).filter(r=>r!=null);
                const rendMP = rendsMP.length? rendsMP.reduce((a,b)=>a+b,0)/rendsMP.length : null;
                const objUds = orden ? (orden.plan_origen==="PROD" ? (prod?.objetivo_diario||0) : (orden.cantidad||0)) : (prod?.objetivo_diario||0);
                const rendEq = objUds>0 ? p.cantidad/objUds*100 : null;
                const det = abierto===p.id;
                const colPct = (v)=> v>=95?C.green: v>=75?C.amber: C.red;
                const colMP = (v)=> v>=85?C.green: v>=75?C.amber: C.red;
                return (
                  <Card key={p.id} style={{marginBottom:8,cursor:"pointer"}} onClick={()=>setAbierto(det?null:p.id)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                      <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,color:C.text}}>
                        {orden?.numero?`OT ${orden.numero} · `:""}{prod?.nombre||"?"}
                      </div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {lin && <Pill color={C.blue} bg={C.blueBg}>{lin.nombre}</Pill>}
                        <span style={{color:C.muted,fontSize:13}}>{det?"▲":"▼"}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:8}}>
                      <span style={{fontFamily:F.h,fontWeight:900,fontSize:26,color:C.text}}>{p.cantidad}<span style={{fontSize:15,color:C.muted,fontWeight:700}}> / {objUds||"—"} uds</span></span>
                      {rendEq!=null && <b style={{color:colPct(rendEq),fontSize:16}}>{rendEq.toFixed(0)}%</b>}
                    </div>
                    {objUds>0 && <div style={{height:7,background:C.card2,borderRadius:4,overflow:"hidden",marginTop:4}}>
                      <div style={{width:Math.min(100,rendEq)+"%",height:"100%",background:colPct(rendEq),borderRadius:4}}/></div>}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
                      <div style={{background:C.card2,borderRadius:10,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:C.muted,fontWeight:800}}>📦 REND. MATERIA</div>
                        <b style={{fontSize:16,color:rendMP!=null?colMP(rendMP):C.muted}}>{rendMP!=null?rendMP.toFixed(0)+"%":"—"}</b>
                        <span style={{fontSize:11,color:C.muted}}> obj 85%</span>
                      </div>
                      <div style={{background:C.card2,borderRadius:10,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:C.muted,fontWeight:800}}>👷 REND. EQUIPO</div>
                        <b style={{fontSize:16,color:rendEq!=null?colPct(rendEq):C.muted}}>{rendEq!=null?rendEq.toFixed(0)+"%":"—"}</b>
                        <span style={{fontSize:11,color:C.muted}}> {p.n_personas||((p.equipo||[]).length)||"?"}p · {p.horas_equipo||8}h</span>
                      </div>
                    </div>
                    {det && <div style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                      <div style={{fontSize:11,color:C.mutedD,fontWeight:800,marginBottom:4}}>👷 EQUIPO</div>
                      <div style={{fontSize:13.5,color:C.text,marginBottom:10}}>
                        {(p.equipo||[]).length>0 ? (p.equipo||[]).map(nombreDe).join(" · ")
                          : (p.equipo_nombres||[]).length>0 ? p.equipo_nombres.join(" · ")
                          : `${p.n_personas||"?"} personas (estimado — sin nombres en el histórico)`} · {p.horas_equipo||8} h
                        {costeFab!=null && <span style={{color:C.muted}}> · fabricación <b style={{color:prod?.coste_objetivo&&costeFab<=prod.coste_objetivo?C.green:C.red}}>{costeFab.toFixed(2)} €/ud</b> (obj {prod?.coste_objetivo||"—"})</span>}
                      </div>
                      <div style={{fontSize:11,color:C.mutedD,fontWeight:800,marginBottom:4}}>📦 MATERIA PRIMA · LOTES</div>
                      {(p.consumos||[]).length===0 && <div style={{fontSize:13,color:C.muted}}>Sin consumos registrados</div>}
                      {(p.consumos||[]).map((cs,i)=>{
                        const m = mps.find(x=>x.id===cs.materia_id);
                        const teor = prod?.metros_finales && cs.capas ? (p.cantidad*prod.metros_finales*cs.capas) : null;
                        return <div key={i} style={{fontSize:13,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span><b>{m?.nombre||"?"}</b>{cs.lote?<span style={{background:C.card2,borderRadius:8,padding:"1px 7px",fontSize:11,marginLeft:6}}>{cs.lote}</span>:null}</span>
                            {cs.rendimiento_pct!=null && <b style={{color:colMP(cs.rendimiento_pct)}}>{cs.rendimiento_pct}%</b>}
                          </div>
                          <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                            {cs.madejas?`${cs.madejas} madejas`:""}{cs.metros?` + ${cs.metros} m`:""} → {(cs.metros_consumidos||0).toFixed(0)} m consumidos{teor?` · teórico ${teor.toFixed(0)} m (${cs.capas} capa${cs.capas>1?"s":""})`:""}{m?.rendimiento_objetivo?` · obj ${m.rendimiento_objetivo}%`:""}
                          </div>
                        </div>;
                      })}
                      {(p.paros||[]).length>0 && <>
                        <div style={{fontSize:11,color:C.mutedD,fontWeight:800,margin:"10px 0 4px"}}>⏸ PAROS</div>
                        {det && (p.paros||[]).map((pa,i)=>{
                          const mo = motivos.find(x=>x.id===pa.motivo_id);
                          return <div key={i} style={{fontSize:13,color:C.amber}}>{mo?.icono} {mo?.nombre}{pa.minutos?` · ${pa.minutos}'`:""}{pa.nota?` — ${pa.nota}`:""}</div>;
                        })}
                      </>}
                      {p.nota && <div style={{fontSize:13,color:C.muted,marginTop:10,background:C.card2,borderRadius:10,padding:"8px 10px"}}>📝 {p.nota}</div>}
                      <div style={{textAlign:"right",fontSize:12,color:C.muted,marginTop:8}}>✍ {p.registrado_por}</div>
                    </div>}
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⏱️ TERMINAL OPERARIO — 3 toques: mi orden → mi proceso → tiempo y cantidad
// ═══════════════════════════════════════════════════════════════════════════════
function TerminalOperario({ perfil, productos }) {
  const [lineas] = useCol("lineas");
  const [turnos] = useCol("turnos");
  const [ordenes] = useCol("ordenes");
  const [paso, setPaso] = useState(1);
  const [orden, setOrden] = useState(null);
  const [proceso, setProceso] = useState(null);
  const [inicio, setInicio] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  const [cantidad, setCantidad] = useState("");
  const [fin, setFin] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [procesosCat] = useCol("procesos");

  useEffect(()=>{ const t=setInterval(()=>setAhora(Date.now()),1000); return ()=>clearInterval(t); },[]);

  const hoy = new Date().toISOString().slice(0,10);
  const misOrdenes = ordenes.filter(o=>!o.cerrada && (!o.centro || o.centro===perfil.centro));
  const prodDeOrden = orden ? productos.find(p=>p.id===orden.producto_id) : null;
  const procesosDelProducto = (prodDeOrden?.procesos_asignados||[]).map(pa=>({
    ...pa, cat: procesosCat.find(x=>x.id===pa.proceso_id) })).filter(x=>x.cat);

  const minutos = inicio ? (fin||ahora - inicio)/60000 : 0;
  const minReal = inicio && fin ? (fin-inicio)/60000 : minutos;
  const fmt = (ms) => { const s=Math.floor(ms/1000); return `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor(s/60)%60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; };

  const guardarRegistro = async () => {
    const q = parseFloat(cantidad);
    if (!q || q<=0) { window.alert("Pon la cantidad"); return; }
    const mins = Math.round(minReal*10)/10;
    const minUd = Math.round(mins/q*100)/100;
    const obj = proceso.min_obj || null;
    const delta = obj ? Math.round((obj-minUd)/obj*100) : null;
    await save("registros_operario", uid(), {
      operario_id: perfil.id, operario: perfil.nombre,
      orden_id: orden.id, producto_id: orden.producto_id, proceso_id: proceso.proceso_id,
      fecha: hoy, minutos: mins, cantidad: q, min_por_ud: minUd,
      obj_min_ud: obj, delta_pct: delta, registrado_at: new Date().toISOString(),
    });
    setFeedback({minUd, obj, delta, q, mins});
  };
  const resetear = () => { setPaso(1); setOrden(null); setProceso(null); setInicio(null); setFin(null); setCantidad(""); setFeedback(null); };

  const BigBtn = ({children, onClick, color=P.accent, sub}) => (
    <button onClick={onClick} style={{width:"100%",background:P.card,border:`3px solid ${color}`,borderRadius:18,padding:"22px 16px",cursor:"pointer",marginBottom:12,textAlign:"left"}}>
      <div style={{fontFamily:P.fh,fontWeight:900,fontSize:22,color:P.text,letterSpacing:0.5}}>{children}</div>
      {sub && <div style={{fontSize:14,color:P.muted,marginTop:4}}>{sub}</div>}
    </button>
  );

  if (feedback) {
    const bien = feedback.delta!=null && feedback.delta>=0;
    return (
      <div style={{maxWidth:600,margin:"0 auto",textAlign:"center",paddingTop:30}}>
        <div style={{fontSize:80}}>{feedback.delta==null?"✅":bien?"🏆":"💪"}</div>
        <div style={{fontFamily:P.fh,fontWeight:900,fontSize:34,color:bien?"#1e7e3e":P.text,margin:"10px 0"}}>
          {feedback.q} uds en {feedback.mins}'
        </div>
        <div style={{fontFamily:P.fh,fontWeight:800,fontSize:24,color:P.muted}}>{feedback.minUd} min/ud</div>
        {feedback.delta!=null && (
          <div style={{fontFamily:P.fh,fontWeight:900,fontSize:26,color:bien?"#1e7e3e":"#c0392b",marginTop:10}}>
            {bien?`✓ Vas ${feedback.delta}% mejor que el objetivo`:`Objetivo ${feedback.obj} min/ud — a ${-feedback.delta}%`}
          </div>
        )}
        <button onClick={resetear} style={{marginTop:26,background:P.accent,border:"none",color:"#fff",borderRadius:16,padding:"20px 44px",fontFamily:P.fh,fontWeight:900,fontSize:24,cursor:"pointer"}}>SIGUIENTE TAREA →</button>
      </div>
    );
  }

  if (paso===3 && orden && proceso) return (
    <div style={{maxWidth:600,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:14}}>
        <div style={{fontFamily:P.fh,fontWeight:800,fontSize:18,color:P.muted}}>{prodDeOrden?.nombre} · {proceso.cat.nombre}</div>
        {proceso.min_obj ? <div style={{fontSize:14,color:P.muted}}>🎯 objetivo {proceso.min_obj} min/ud</div> : null}
      </div>
      <div style={{background:inicio&&!fin?"#1e7e3e":P.card,border:`3px solid ${inicio&&!fin?"#1e7e3e":P.border}`,borderRadius:22,padding:"34px 16px",textAlign:"center",marginBottom:14}}>
        <div style={{fontFamily:P.fh,fontWeight:900,fontSize:56,color:inicio&&!fin?"#fff":P.text,letterSpacing:2}}>{inicio?fmt((fin||ahora)-inicio):"00:00:00"}</div>
        <div style={{fontFamily:P.fh,fontWeight:800,fontSize:18,color:inicio&&!fin?"rgba(255,255,255,.8)":P.muted,marginTop:4}}>{!inicio?"LISTO":fin?"TERMINADO":"⏺ PRODUCIENDO"}</div>
      </div>
      {!inicio && <button onClick={()=>setInicio(Date.now())} style={{width:"100%",background:"#1e7e3e",border:"none",color:"#fff",borderRadius:18,padding:"26px",fontFamily:P.fh,fontWeight:900,fontSize:28,cursor:"pointer"}}>▶ EMPEZAR</button>}
      {inicio && !fin && <button onClick={()=>setFin(Date.now())} style={{width:"100%",background:"#c0392b",border:"none",color:"#fff",borderRadius:18,padding:"26px",fontFamily:P.fh,fontWeight:900,fontSize:28,cursor:"pointer"}}>⏹ TERMINAR</button>}
      {fin && <>
        <input value={cantidad} onChange={e=>setCantidad(e.target.value)} type="number" inputMode="decimal" placeholder="¿Cuántas unidades?"
          style={{width:"100%",padding:"20px",borderRadius:16,border:`3px solid ${P.accent}`,fontSize:26,fontFamily:P.fh,fontWeight:800,textAlign:"center",marginTop:12,background:"#fff",color:P.text}}/>
        <button onClick={guardarRegistro} style={{width:"100%",marginTop:12,background:P.accent,border:"none",color:"#fff",borderRadius:18,padding:"24px",fontFamily:P.fh,fontWeight:900,fontSize:26,cursor:"pointer"}}>💾 GUARDAR</button>
      </>}
      <button onClick={resetear} style={{width:"100%",marginTop:12,background:"none",border:`2px solid ${P.border}`,color:P.muted,borderRadius:14,padding:"14px",fontFamily:P.fh,fontWeight:700,fontSize:16,cursor:"pointer"}}>← Cambiar tarea</button>
    </div>
  );

  if (paso===2 && orden) return (
    <div style={{maxWidth:600,margin:"0 auto"}}>
      <div style={{fontFamily:P.fh,fontWeight:900,fontSize:22,color:P.text,marginBottom:14,textAlign:"center"}}>2 · ¿QUÉ PROCESO HACES?</div>
      {procesosDelProducto.length===0 && <div style={{textAlign:"center",color:P.muted,fontSize:15,padding:20}}>Este producto no tiene procesos asignados aún — pide a oficina que los configure en la ficha del producto.</div>}
      {procesosDelProducto.map(pa=>(
        <BigBtn key={pa.proceso_id} onClick={()=>{setProceso(pa);setPaso(3);}}
          sub={pa.min_obj?`🎯 ${pa.min_obj} min/ud`:null}>{pa.cat.diferido?"⏭ ":""}{pa.cat.apoyo?"🤝 ":""}{pa.cat.nombre}</BigBtn>
      ))}
      <button onClick={()=>{setPaso(1);setOrden(null);}} style={{width:"100%",background:"none",border:`2px solid ${P.border}`,color:P.muted,borderRadius:14,padding:"14px",fontFamily:P.fh,fontWeight:700,fontSize:16,cursor:"pointer"}}>← Otra orden</button>
    </div>
  );

  return (
    <div style={{maxWidth:600,margin:"0 auto"}}>
      <div style={{fontFamily:P.fh,fontWeight:900,fontSize:22,color:P.text,marginBottom:14,textAlign:"center"}}>1 · ¿EN QUÉ ORDEN TRABAJAS?</div>
      {misOrdenes.length===0 && <div style={{textAlign:"center",color:P.muted,fontSize:15,padding:20}}>No hay órdenes abiertas ahora mismo.</div>}
      {misOrdenes.map(o=>{
        const p = productos.find(x=>x.id===o.producto_id);
        const l = lineas.find(x=>x.id===o.linea_id);
        return <BigBtn key={o.id} onClick={()=>{setOrden(o);setPaso(2);}}
          sub={`${o.fecha}${l?` · ${l.nombre}`:""} · ${o.cantidad} uds`}>{o.numero?`OT ${o.numero} · `:""}{p?.nombre||"?"}</BigBtn>;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📥 IMPORTAR HISTÓRICO — sube el JSON generado desde el Excel maestro
// ═══════════════════════════════════════════════════════════════════════════════
function ImportHistoricoScreen({ onBack, productos, mps, lineas, turnos }) {
  const [data, setData] = useState(null);
  const [estado, setEstado] = useState("idle");
  const [prog, setProg] = useState("");
  const [resumen, setResumen] = useState(null);

  const leerFichero = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try {
      const j = JSON.parse(r.result);
      if (!Array.isArray(j.ordenes)) throw new Error("Formato inesperado");
      setData(j); setEstado("preview");
    } catch(err){ window.alert("JSON inválido: "+err.message); } };
    r.readAsText(f);
  };

  const norm = (s)=>String(s||"").trim().toUpperCase();
  const mapProd = {}; productos.forEach(p=>mapProd[norm(p.nombre)]=p.id);
  const mapMat = {}; mps.forEach(m=>mapMat[norm(m.nombre)]=m.id);
  const mapLin = {}; lineas.forEach(l=>mapLin[norm(l.nombre)]=l.id);
  const turnoT1 = turnos.slice().sort((a,b)=>(a.hora_inicio||"").localeCompare(b.hora_inicio||""))[0]?.id||"";
  const turnoT2 = turnos.slice().sort((a,b)=>(a.hora_inicio||"").localeCompare(b.hora_inicio||""))[1]?.id||"";

  const analizar = () => {
    let ok=0, sinProd=new Set(), sinMat=new Set();
    data.ordenes.forEach(o=>{
      if (mapProd[norm(o.p)]) ok++; else sinProd.add(o.p);
      (o.cons||[]).forEach(cs=>{ if(cs[0] && !mapMat[norm(cs[0])]) sinMat.add(cs[0]); });
    });
    return {ok, sinProd:[...sinProd], sinMat:[...sinMat]};
  };

  const importar = async () => {
    setEstado("importando");
    let no=0, np=0, skip=0;
    for (const o of data.ordenes) {
      const pid = mapProd[norm(o.p)];
      if (!pid) { skip++; continue; }
      const oid = "H_"+(o.f||"")+"_"+norm(o.p).replace(/[^A-Z0-9]/g,"")+"_"+no;
      await save("ordenes", oid, {
        numero: o.n?String(o.n):"", tipo: o.tipo||"Plan", cliente: o.cli||"",
        producto_id: pid, centro: productos.find(x=>x.id===pid)?.centro||"",
        linea_id: mapLin[norm(o.l)]||"", linea_nombre: o.l||"", turno_id: o.t==="T2"?turnoT2:(o.t==="T1"?turnoT1:""),
        fecha: o.f, cantidad: o.req||o.q||0, plan_origen: o.req?"REQ":"PROD", cerrada: true, historico: true,
        created_at: new Date().toISOString(),
      });
      no++;
      if (o.q) {
        const consumos = (o.cons||[]).map(cs=>({
          materia_id: mapMat[norm(cs[0])]||"", lote: cs[1]||"", madejas: cs[2]||0, metros: cs[3]||0,
          rendimiento_pct: cs[4]!=null?cs[4]:null,
          metros_consumidos: (cs[2]||0)*(mps.find(m=>m.id===mapMat[norm(cs[0])])?.metros_madeja||90)+(cs[3]||0),
        }));
        await save("producciones", "P"+oid, {
          orden_id: oid, producto_id: pid, fecha: o.f, turno_id: o.t==="T2"?turnoT2:turnoT1,
          linea_id: mapLin[norm(o.l)]||"", linea_nombre: o.l||"", cantidad: o.q, nota: o.nota||"",
          n_personas: o.np||null, origen_personas: o.op||"", equipo: [], equipo_nombres: o.eq||[], paros: [],
          consumos, historico: true, registrado_por: "histórico",
          registrado_at: new Date().toISOString(),
        });
        np++;
        for (const cs of consumos) if (cs.lote && cs.materia_id) {
          const lid = (cs.materia_id+"_"+cs.lote).replace(/[^a-zA-Z0-9_-]/g,"_");
          await save("lotes", lid, { materia_id: cs.materia_id, codigo: cs.lote, ultima_fecha: o.f });
        }
      }
      if ((no+np)%20===0) setProg(`${no} órdenes · ${np} partes…`);
    }
    setResumen({no, np, skip}); setEstado("fin");
  };

  const an = data ? analizar() : null;

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="📥 IMPORTAR HISTÓRICO" onBack={onBack} sub="El Excel maestro (abril-agosto) a Firebase, de una vez"/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          {estado==="idle" && <>
            <div style={{fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:12}}>
              Sube el fichero <b>historico-wikuk.json</b>. Casará productos y materias por código con tus maestros, creará las órdenes cerradas con sus partes, consumos por lote y rendimientos. Ejecútalo UNA sola vez (si se repite, sobrescribe los mismos registros, no duplica).
            </div>
            <input type="file" accept=".json,application/json" onChange={leerFichero}
              style={{width:"100%",padding:"14px",borderRadius:12,border:`2px dashed ${C.accent}`,fontSize:14,background:"#fff"}}/>
          </>}
          {estado==="preview" && an && <>
            <div style={{background:C.card2,borderRadius:12,padding:14,marginBottom:12,fontSize:14,lineHeight:1.8}}>
              📦 {data.ordenes.length} órdenes en el fichero · <b style={{color:C.green}}>{an.ok} casan</b> con tus productos<br/>
              {an.sinProd.length>0 && <span style={{color:C.amber}}>⚠ Sin producto en el maestro ({an.sinProd.length}): {an.sinProd.slice(0,6).join(", ")}{an.sinProd.length>6?"…":""} — se omitirán</span>}
              {an.sinMat.length>0 && <><br/><span style={{color:C.amber}}>⚠ Materias no encontradas: {an.sinMat.slice(0,6).join(", ")} — sus consumos entrarán sin enlazar</span></>}
            </div>
            <Btn onClick={importar}>🚀 Importar {an.ok} órdenes con sus partes</Btn>
          </>}
          {estado==="importando" && <div style={{fontFamily:F.h,fontSize:17,color:C.muted}}>⏳ Importando… {prog}</div>}
          {estado==="fin" && resumen && <div style={{fontSize:15,lineHeight:1.9}}>
            ✅ <b>{resumen.no} órdenes</b> y <b>{resumen.np} partes</b> importados{resumen.skip?` · ${resumen.skip} omitidos sin producto`:""}.<br/>
            Ya puedes navegar el 📖 Diario hasta abril y ver el dashboard con historia real.
          </div>}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 ANALÍTICA — evolución, costes ref vs real, lotes, equipos, turnos, operarios
// ═══════════════════════════════════════════════════════════════════════════════
function AnaliticaScreen({ onBack, productos, mps, lineas, turnos, usuarios, centros }) {
  const [ordenes] = useCol("ordenes");
  const [producciones] = useCol("producciones");
  const [regsOp] = useCol("registros_operario");
  const [cfg] = useCol("config_costes");
  const [tab, setTab] = useState("dx");

  const centro = centros[0];
  const estructura = cfg[0] && cfg[0].horas_persona_mes ? cfg[0].fijos_mensuales/cfg[0].horas_persona_mes : 2.45;
  const tarifaCargada = (centro?.tarifa_mo||12.5) + estructura;
  const prodMap = {}; productos.forEach(p=>prodMap[p.id]=p);
  const mpMap = {}; mps.forEach(m=>mpMap[m.id]=m);
  const linMap = {}; lineas.forEach(l=>linMap[l.id]=l);
  const P2 = producciones.filter(p=>p.fecha && p.cantidad>0);

  const costeReal = (p) => p.n_personas && p.cantidad ? (p.n_personas*(p.horas_equipo||8)*tarifaCargada/p.cantidad) : null;
  const Bar = ({pct,color,label,value}) => (
    <div style={{display:"flex",alignItems:"center",gap:8,margin:"5px 0"}}>
      <span style={{width:74,fontSize:12,fontWeight:700,color:C.mutedD,flexShrink:0}}>{label}</span>
      <div style={{flex:1,height:20,background:C.card2,borderRadius:6,overflow:"hidden"}}>
        <div style={{width:Math.min(100,pct)+"%",height:"100%",background:color,borderRadius:6,display:"flex",alignItems:"center",paddingLeft:7,fontSize:11,fontWeight:800,color:"#fff",whiteSpace:"nowrap"}}>{value}</div>
      </div>
    </div>
  );
  const colR = (r)=> r>=85?C.green: r>=75?C.amber: C.red;

  // ── EVOLUCIÓN mensual ──
  const meses = {};
  P2.forEach(p=>{
    const m = p.fecha.slice(0,7);
    const d = meses[m] = meses[m]||{uds:0,val:0,persDias:{},dias:new Set()};
    d.uds += p.cantidad; d.dias.add(p.fecha);
    const pr = prodMap[p.producto_id];
    d.val += p.cantidad*(pr?.coste_objetivo||3.5);
    if (p.n_personas) { const k=p.fecha+"_"+(p.linea_id||"x"); d.persDias[k]=Math.max(d.persDias[k]||0,p.n_personas); }
  });
  const mesesArr = Object.entries(meses).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,d])=>{
    const pd = Object.values(d.persDias).reduce((s,n)=>s+n,0);
    return {mes:m, uds:d.uds, dias:d.dias.size, valPD: pd? d.val/pd : null};
  });
  const maxUds = Math.max(1,...mesesArr.map(x=>x.uds));

  // ── COSTES por producto: real vs objetivo ──
  const porProd = {};
  P2.forEach(p=>{
    const cr = costeReal(p); if (cr==null) return;
    const d = porProd[p.producto_id] = porProd[p.producto_id]||{sum:0,uds:0,n:0};
    d.sum += cr*p.cantidad; d.uds += p.cantidad; d.n++;
  });
  const costesArr = Object.entries(porProd).map(([pid,d])=>({
    nombre: prodMap[pid]?.nombre||"?", obj: prodMap[pid]?.coste_objetivo||0,
    real: d.sum/d.uds, uds: d.uds, n: d.n,
  })).filter(x=>x.uds>=10).sort((a,b)=>b.uds-a.uds);

  // ── LOTES: rendimiento medio ──
  const porLote = {};
  P2.forEach(p=>(p.consumos||[]).forEach(cs=>{
    if (!cs.lote || cs.rendimiento_pct==null) return;
    const k = (mpMap[cs.materia_id]?.nombre||"?")+" · "+cs.lote;
    const d = porLote[k] = porLote[k]||{sum:0,n:0};
    d.sum += cs.rendimiento_pct; d.n++;
  }));
  const lotesArr = Object.entries(porLote).map(([k,d])=>({lote:k, rend:d.sum/d.n, n:d.n}))
    .filter(x=>x.n>=3).sort((a,b)=>b.rend-a.rend);

  // ── EQUIPOS: uds/persona-día por línea y tamaño (solo DECLARADO) ──
  const eq = {};
  P2.filter(p=>p.origen_personas==="DECLARADO"||((p.equipo||[]).length>0)).forEach(p=>{
    const lin = linMap[p.linea_id]?.nombre||"—";
    const np = Math.round(p.n_personas||((p.equipo||[]).length)); if(!np) return;
    const k = lin+"|"+np;
    const d = eq[k] = eq[k]||{uds:0,dias:new Set(),np,lin};
    d.uds += p.cantidad; d.dias.add(p.fecha);
  });
  const eqArr = Object.values(eq).map(d=>({...d, udsDia:d.uds/d.dias.size, porPers:d.uds/d.dias.size/d.np, n:d.dias.size}))
    .filter(x=>x.n>=2).sort((a,b)=>a.lin.localeCompare(b.lin)||a.np-b.np);

  // ── TURNOS ──
  const porTurno = {};
  P2.forEach(p=>{
    const t = turnos.find(x=>x.id===p.turno_id)?.nombre||"—";
    const d = porTurno[t] = porTurno[t]||{uds:0,dias:new Set(),coste:0,cuds:0};
    d.uds+=p.cantidad; d.dias.add(p.fecha);
    const cr = costeReal(p); if(cr!=null){ d.coste+=cr*p.cantidad; d.cuds+=p.cantidad; }
  });

  // ── OPERARIOS (partes con equipo nominal + terminal) ──
  const porOp = {};
  P2.forEach(p=>{
    (p.equipo||[]).forEach(uid2=>{
      const nom = usuarios.find(u=>u.id===uid2)?.nombre||uid2;
      const d = porOp[nom] = porOp[nom]||{uds:0,dias:new Set()};
      d.uds += p.cantidad/(p.equipo.length||1); d.dias.add(p.fecha);
    });
  });
  const opsArr = Object.entries(porOp).map(([n,d])=>({nombre:n, udsDia:d.uds/d.dias.size, n:d.dias.size})).sort((a,b)=>b.udsDia-a.udsDia);
  const regsPorOp = {};
  regsOp.forEach(r=>{
    const d = regsPorOp[r.operario] = regsPorOp[r.operario]||{sum:0,n:0,mejor:null};
    if (r.delta_pct!=null){ d.sum+=r.delta_pct; d.n++; }
  });

  // ── P&G: prorrateo de MO por día-línea + pérdida MP vs rendimiento objetivo ──
  const grupos = {};
  P2.forEach(p=>{ const k=p.fecha+"|"+(p.linea_nombre||linMap[p.linea_id]?.nombre||p.linea_id||("prod_"+(prodMap[p.producto_id]?.nombre||"x").slice(0,4)))+"|"+(p.turno_id||""); const g=grupos[k]=grupos[k]||{np:0,rows:[]}; g.np=Math.max(g.np,p.n_personas||0); g.rows.push(p); });
  const partesPG = [];
  Object.values(grupos).forEach(g=>{
    const np = g.np||3;
    const udsTot = g.rows.reduce((s,p)=>s+p.cantidad,0)||1;
    const costeDia = np*8*tarifaCargada;
    g.rows.forEach(p=>{
      const pr = prodMap[p.producto_id];
      const real = costeDia*(p.cantidad/udsTot);
      const val = p.cantidad*(pr?.coste_objetivo||3.5);
      let mp = 0;
      (p.consumos||[]).forEach(cs=>{
        const m = mpMap[cs.materia_id]; if(!m||cs.rendimiento_pct==null||cs.rendimiento_pct<=0) return;
        const objR = (m.rendimiento_objetivo||85)/100, r2 = cs.rendimiento_pct/100;
        if (r2<objR) { const teor=(cs.metros_consumidos||0)*r2; mp += (teor/r2 - teor/objR)*(m.precio_ud||0); }
      });
      partesPG.push({fecha:p.fecha, cod:pr?.nombre||"?", val, real, desvMO:real-val, mp, uds:p.cantidad,
        np:np, org:p.origen_personas||"", linea:(p.linea_nombre||linMap[p.linea_id]?.nombre||""), turno:turnos.find(t=>t.id===p.turno_id)?.nombre||"",
        lotes:[...new Set((p.consumos||[]).map(cs=>cs.lote).filter(Boolean))], obj:pr?.coste_objetivo||0});
    });
  });
  const [periodo, setPeriodo] = useState("mes");
  const [openProd, setOpenProd] = useState(null);
  const [openLote, setOpenLote] = useState(null);
  const [diaSel, setDiaSel] = useState(null);
  const fmtD = (f)=>{ try{ const d=new Date(f+"T12:00:00");
    return ["dom","lun","mar","mié","jue","vie","sáb"][d.getDay()]+" "+d.getDate()+" "+["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][d.getMonth()]; }catch(e){return f;} };
  const perKey = (f)=>{ if(periodo==="mes") return f.slice(0,7);
    const d=new Date(f+"T12:00:00"); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day);
    return "sem "+d.toISOString().slice(5,10); };
  const pg = {};
  partesPG.forEach(x=>{ const k=perKey(x.fecha); const d=pg[k]=pg[k]||{val:0,desvMO:0,mp:0,uds:0,coste:0,obj:0,valObj:0}; d.val+=x.val; d.desvMO+=x.desvMO; d.mp+=x.mp; d.uds+=x.uds||0; d.coste+=x.real; });
  ordenes.filter(o=>o.fecha).forEach(o=>{ const k=perKey(o.fecha); if(!pg[k]) return; const pr=prodMap[o.producto_id];
    const planUds = o.plan_origen==="PROD" ? (pr?.objetivo_diario||0) : (o.cantidad||0);
    pg[k].obj += planUds; pg[k].valObj += planUds*(pr?.coste_objetivo||3.5); });
  const pgArr = Object.entries(pg).sort((a,b)=>a[0].localeCompare(b[0]));
  const totMO = partesPG.reduce((s,x)=>s+x.desvMO,0), totMP = partesPG.reduce((s,x)=>s+x.mp,0);
  // Diagnóstico
  const dxProd = {};
  partesPG.forEach(x=>{ const d=dxProd[x.cod]=dxProd[x.cod]||{desv:0,uds:0,real:0,val:0}; d.desv+=x.desvMO+x.mp; d.real+=x.real; d.val+=x.val; });
  const dxProdArr = Object.entries(dxProd).map(([cod,d])=>({cod,...d})).sort((a,b)=>b.desv-a.desv).slice(0,3);
  const dxLotes = Object.entries((()=>{ const o={}; P2.forEach(p=>(p.consumos||[]).forEach(cs=>{
    const m=mpMap[cs.materia_id]; if(!m||cs.rendimiento_pct==null||!cs.lote) return;
    const objR=(m.rendimiento_objetivo||85)/100, r2=cs.rendimiento_pct/100; if(r2>=objR||r2<=0) return;
    const teor=(cs.metros_consumidos||0)*r2; const perd=(teor/r2-teor/objR)*(m.precio_ud||0);
    const k=m.nombre+" · "+cs.lote; o[k]=(o[k]||0)+perd; })); return o; })()).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const dxParos = Object.entries((()=>{ const o={}; P2.forEach(p=>(p.paros||[]).forEach(pa=>{
    const mo=null; const nom=(pa.motivo_id&&"paro")||"paro"; o[pa.motivo_id]=(o[pa.motivo_id]||0)+(pa.minutos||0); })); return o; })()).sort((a,b)=>b[1]-a[1]).slice(0,2);
  const hoy14 = (d)=>{ const x=new Date(); x.setDate(x.getDate()-d); return x.toISOString().slice(0,10); };
  const desvUlt = partesPG.filter(x=>x.fecha>=hoy14(14)).reduce((s,x)=>s+x.desvMO+x.mp,0);
  const desvPrev = partesPG.filter(x=>x.fecha>=hoy14(28)&&x.fecha<hoy14(14)).reduce((s,x)=>s+x.desvMO+x.mp,0);
  const eur = (n)=> (n>=0?"+":"−")+Math.abs(n).toFixed(0)+" €";

  const TABS = [["dx","🚨 Diagnóstico"],["resultado","💶 Resultado"],["evolucion","📈 Evolución"],["costes","💰 Costes"],["lotes","📦 Lotes"],["equipos","👥 Equipos"],["turnos","🕐 Turnos"]];
  const vacio = P2.length===0;

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="📊 ANALÍTICA" onBack={onBack} sub={`${P2.length} partes · tarifa cargada ${tarifaCargada.toFixed(2)} €/h (MO ${centro?.tarifa_mo||"?"} + estructura ${estructura.toFixed(2)})`}/>
      <div style={{padding:14}}>
        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {TABS.map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{background:tab===k?C.text:"#fff",color:tab===k?"#fff":C.muted,border:`1px solid ${tab===k?C.text:C.border}`,borderRadius:20,padding:"7px 14px",fontSize:13,fontFamily:F.h,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{l}</button>
          ))}
        </div>
        {vacio && <Empty icon="📊" text="Sin datos aún. Importa el histórico o registra partes y esto cobra vida."/>}

        {!vacio && tab==="dx" && <>
          <div style={{background:C.navy,color:"#fff",borderRadius:16,padding:16,marginBottom:12}}>
            <div style={{fontSize:11,letterSpacing:1,color:"rgba(255,255,255,.5)",fontWeight:800,marginBottom:6}}>RESULTADO DEL PERIODO vs ESTÁNDAR</div>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:30,color:(totMO+totMP)>0?"#FCA5A5":"#86EFAC"}}>{eur(-(totMO+totMP)).replace("+","+").replace("−","−")} {(totMO+totMP)>0?"— sobrecoste":"— ahorro"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.65)",marginTop:4}}>MO {eur(totMO)} · Materia por rendimiento {totMP.toFixed(0)} € · {desvPrev!==0 && <span>tendencia 14 días: <b style={{color:desvUlt<desvPrev?"#86EFAC":"#FCA5A5"}}>{desvUlt<desvPrev?"mejorando ↓":"empeorando ↑"}</b></span>}</div>
          </div>
          {dxProdArr.map((x,i)=>(
            <Card key={x.cod} style={{marginBottom:10,borderLeft:`4px solid ${i===0?C.red:C.amber}`}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:15}}>🔴 {i+1} · {x.cod} concentra <span style={{color:C.red}}>{x.desv.toFixed(0)} €</span> de sobrecoste</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>Coste real {x.real.toFixed(0)} € vs objetivo {x.val.toFixed(0)} € ({x.val>0?"+"+((x.real-x.val)/x.val*100).toFixed(0)+"%":"—"})</div>
              <div style={{fontSize:13,color:C.mutedD,marginTop:2,lineHeight:1.6}}>➜ Acciones: revisar si el estándar es realista, atacar el ritmo (mira los mejores días en 📈), o reasignar equipo (👥).</div>
            </Card>
          ))}
          {dxLotes.map(([k,v],i)=>(
            <Card key={k} style={{marginBottom:10,borderLeft:`4px solid ${C.amber}`}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:15}}>📦 Lote problemático: {k}</div>
              <div style={{fontSize:13,color:C.mutedD,marginTop:4,lineHeight:1.6}}>Te ha costado <b style={{color:C.red}}>{v.toFixed(0)} €</b> extra de materia por rendir bajo objetivo. ➜ Reclamar al proveedor / priorizar los lotes verdes de 📦 Lotes.</div>
            </Card>
          ))}
          <Card style={{marginBottom:10,borderLeft:`4px solid ${C.blue}`}}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15}}>👥 La 3ª persona no se paga</div>
            <div style={{fontSize:13,color:C.mutedD,marginTop:4,lineHeight:1.6}}>Donde hay datos declarados, los equipos de 2 producen más por persona y más barato por ud (ver 👥 Equipos). ➜ Prueba 2 semanas la configuración 2+2+2 con apoyo rotatorio, medida con el sistema.</div>
          </Card>
        </>}

        {!vacio && tab==="resultado" && <>
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[["mes","Por mes"],["semana","Por semana"]].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriodo(k)} style={{background:periodo===k?C.text:"#fff",color:periodo===k?"#fff":C.muted,border:`1px solid ${periodo===k?C.text:C.border}`,borderRadius:20,padding:"6px 14px",fontSize:13,fontFamily:F.h,fontWeight:700,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <Card style={{marginBottom:10,background:C.card2,border:"none"}}>
            <div style={{fontSize:13,color:C.mutedD,lineHeight:1.7}}>
              <b>La cuenta, simple:</b> si el plan es 100 sticks a 1 € y produces 50 con el mismo equipo, tu coste real es 2 €/ud. Aquí, cada periodo: lo previsto, lo producido, lo que costó el equipo, y el <b>resultado en €</b>.
            </div>
          </Card>
          {pgArr.map(([k,d])=>{
            const resultado = d.val - d.coste - d.mp;
            const pctPlan = d.obj>0 ? d.uds/d.obj*100 : null;
            const cReal = d.uds>0 ? (d.coste+d.mp)/d.uds : 0;
            const cObj = d.uds>0 ? d.val/d.uds : 0;
            return (
              <Card key={k} style={{marginBottom:10,borderLeft:`4px solid ${resultado>=0?C.green:C.red}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <b style={{fontFamily:F.h,fontSize:16}}>{k}</b>
                  <span style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:resultado>=0?C.green:C.red}}>{resultado>=0?"+":"−"}{Math.abs(resultado).toFixed(0)} €</span>
                </div>
                <div style={{marginTop:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}>
                    <span>📦 Producido <b>{d.uds.toFixed(0)}</b>{d.obj>0?<span style={{color:C.muted}}> de {d.obj.toFixed(0)} previstas</span>:null}</span>
                    {pctPlan!=null && <b style={{color:pctPlan>=95?C.green:pctPlan>=75?C.amber:C.red}}>{pctPlan.toFixed(0)}%</b>}
                  </div>
                  {pctPlan!=null && <div style={{height:7,background:C.card2,borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:Math.min(100,pctPlan)+"%",height:"100%",background:pctPlan>=95?C.green:pctPlan>=75?C.amber:C.red,borderRadius:4}}/></div>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10,fontSize:12.5}}>
                  <div style={{background:C.card2,borderRadius:10,padding:"8px 10px"}}><div style={{color:C.muted,fontSize:10.5}}>VALOR PRODUCIDO</div><b>{d.val.toFixed(0)} €</b></div>
                  <div style={{background:C.card2,borderRadius:10,padding:"8px 10px"}}><div style={{color:C.muted,fontSize:10.5}}>COSTE EQUIPO+MP</div><b>{(d.coste+d.mp).toFixed(0)} €</b></div>
                  <div style={{background:C.card2,borderRadius:10,padding:"8px 10px"}}><div style={{color:C.muted,fontSize:10.5}}>€/UD REAL·OBJ</div><b style={{color:cReal<=cObj?C.green:C.red}}>{cReal.toFixed(2)}</b><span style={{color:C.muted}}> · {cObj.toFixed(2)}</span></div>
                </div>
              </Card>
            );
          })}
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:15}}>
              <b>Total periodo</b>
              <b style={{fontFamily:F.h,fontSize:18,color:(totMO+totMP)<=0?C.green:C.red}}>{(totMO+totMP)<=0?"+":"−"}{Math.abs(totMO+totMP).toFixed(0)} €</b>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>Equipo {totMO>0?"−":"+"}{Math.abs(totMO).toFixed(0)} € vs estándar · Materia −{totMP.toFixed(0)} € por rendimiento</div>
          </Card>
        </>}

        {!vacio && tab==="evolucion" && <>
          <Card style={{marginBottom:12}}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,marginBottom:10,color:C.text}}>Sticks por mes</div>
            {mesesArr.map(x=><Bar key={x.mes} label={x.mes.slice(5)+"/"+x.mes.slice(2,4)} pct={x.uds/maxUds*100} color={C.accent2} value={`${x.uds.toFixed(0)} uds · ${x.dias} días`}/>)}
          </Card>
          <Card>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,marginBottom:4,color:C.text}}>€ de fabricación producidos por persona·día</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Valor a coste estándar ÷ personas. Equilibrio: {(tarifaCargada*8).toFixed(0)} € (una persona/día). Normaliza el cambio de mix.</div>
            {mesesArr.filter(x=>x.valPD).map(x=>{
              const eq8 = tarifaCargada*8;
              return <Bar key={x.mes} label={x.mes.slice(5)+"/"+x.mes.slice(2,4)} pct={x.valPD/eq8*66} color={x.valPD>=eq8?C.green:x.valPD>=eq8*0.85?C.amber:C.red} value={`${x.valPD.toFixed(0)} €`}/>;
            })}
          </Card>
        </>}

        {!vacio && tab==="costes" && (()=>{
          const porProd2 = {};
          partesPG.forEach(x=>{ const d=porProd2[x.cod]=porProd2[x.cod]||{uds:0,real:0,val:0,obj:x.obj,rows:[]}; d.uds+=x.uds; d.real+=x.real; d.val+=x.val; d.rows.push(x); });
          const arr = Object.entries(porProd2).map(([cod,d])=>({cod,...d,desv:d.real-d.val})).filter(x=>x.uds>=10).sort((a,b)=>b.desv-a.desv);
          return (
          <Card>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,marginBottom:4,color:C.text}}>Coste real vs objetivo · toca para abrir jornadas</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:10}}>MO del equipo repartida entre las órdenes de cada línea-día por unidades</div>
            {arr.map(x=>{
              const rud=x.real/x.uds, oud=x.obj||x.val/x.uds;
              const open = openProd===x.cod;
              return (
                <div key={x.cod}>
                  <div onClick={()=>setOpenProd(open?null:x.cod)} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}>
                      <b>{open?"▾":"▸"} {x.cod}</b>
                      <span><b style={{color:rud<=oud?C.green:C.red}}>{rud.toFixed(2)} €</b><span style={{color:C.muted,fontSize:12}}> / obj {oud.toFixed(2)}</span>
                        <b style={{marginLeft:8,color:x.desv>0?C.red:C.green}}>{x.desv>0?"−":"+"}{Math.abs(x.desv).toFixed(0)} €</b></span>
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>{x.uds.toFixed(0)} uds · {x.rows.length} jornadas</div>
                  </div>
                  {open && (()=>{
                    const rs = x.rows.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
                    const buenos = rs.filter(r=>r.real/r.uds<=x.obj*1.02).length;
                    const peor = rs.reduce((m,r)=>(r.real-r.val)>(m.real-m.val)?r:m,rs[0]);
                    const mejor = rs.reduce((m,r)=>(r.real/r.uds)<(m.real/m.uds)?r:m,rs[0]);
                    const con26U = rs.filter(r=>r.lotes.some(l=>l.includes("26U")));
                    const sel = rs.find(r=>r.fecha===diaSel) || null;
                    const colorDe = (r)=>{ const k=(r.real/r.uds)/(x.obj||1); return k<=1.02?"#16A34A":k<=1.2?"#84CC16":k<=1.5?"#F59E0B":"#EF4444"; };
                    return (
                      <div style={{background:C.bg,borderRadius:12,padding:"10px 12px",marginBottom:6}}>
                        <div style={{fontSize:13,color:C.mutedD,lineHeight:1.6,marginBottom:8}}>
                          <b>{rs.length} jornadas</b>: {buenos} en estándar o mejor · el mejor día hizo <b style={{color:C.green}}>{mejor.uds} uds a {(mejor.real/mejor.uds).toFixed(2)} €</b>
                          {con26U.length>0 && <> · <b style={{color:C.red}}>{con26U.length} días con lote 26U</b> concentran {con26U.reduce((s,r)=>s+Math.max(0,r.real-r.val),0).toFixed(0)} € de sobrecoste</>}
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:10}}>
                          {rs.map((r,i)=>(
                            <div key={i} onClick={(e)=>{e.stopPropagation();setDiaSel(diaSel===r.fecha?null:r.fecha);}}
                              title={r.fecha}
                              style={{width:16,height:16,borderRadius:4,background:colorDe(r),cursor:"pointer",
                                      outline: diaSel===r.fecha?`2px solid ${C.text}`:"none", outlineOffset:1,
                                      opacity: r.lotes.some(l=>l.includes("26U"))?1:0.92,
                                      border: r.lotes.some(l=>l.includes("26U"))?"1.5px solid #7F1D1D":"none"}}/>
                          ))}
                        </div>
                        <div style={{fontSize:10.5,color:C.muted,marginBottom:8}}>◼ un cuadrado = un día (izq→der en el tiempo) · verde cumple · rojo caro · borde oscuro = lote 26U · toca uno</div>
                        {sel && (()=>{ const dd=sel.real-sel.val; const cumple=sel.real/sel.uds<=x.obj*1.02;
                          return (
                          <div style={{background:"#fff",border:`1.5px solid ${cumple?C.green:C.red}`,borderRadius:12,padding:"10px 12px"}}>
                            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15}}>{fmtD(sel.fecha)} <span style={{color:cumple?C.green:C.red}}>{cumple?"✓ cumplió":"✕ caro"}</span></div>
                            <div style={{fontSize:13.5,lineHeight:1.8,marginTop:4}}>
                              Se hicieron <b>{sel.uds} uds</b> con <b>{sel.np} personas</b>{sel.org==="DECLARADO"?"":" (estimadas)"} en {sel.linea}{sel.turno?` · ${sel.turno}`:""}.<br/>
                              Salió a <b style={{color:cumple?C.green:C.red}}>{(sel.real/sel.uds).toFixed(2)} €/ud</b> contra {x.obj.toFixed(2)} de estándar → <b style={{color:dd>0?C.red:C.green}}>{dd>0?`${dd.toFixed(0)} € más caro`:`${Math.abs(dd).toFixed(0)} € mejor`}</b> que el estándar.
                              {sel.lotes.length>0 && <><br/>Lote: {sel.lotes.map((l,j)=><span key={j} style={{background:l.includes("26U")?"#FEF2F2":C.card2,color:l.includes("26U")?C.red:C.mutedD,borderRadius:6,padding:"1px 8px",fontSize:12,marginRight:4,fontWeight:700}}>{l}{l.includes("26U")?" ⚠":""}</span>)}</>}
                            </div>
                          </div>);
                        })()}
                        {!sel && peor && (peor.real-peor.val)>20 && (
                          <div style={{fontSize:12.5,color:C.muted}}>💡 Empieza por el más rojo: {fmtD(peor.fecha)} costó {(peor.real-peor.val).toFixed(0)} € de más{peor.lotes.some(l=>l.includes("26U"))?" — llevaba lote 26U":""}.</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </Card>
          );
        })()}

        {!vacio && tab==="lotes" && (()=>{
          const porLote2 = {};
          P2.forEach(p=>(p.consumos||[]).forEach(cs=>{
            if (!cs.lote || cs.rendimiento_pct==null) return;
            const m = mpMap[cs.materia_id];
            const k = (m?.nombre||"?")+" · "+cs.lote;
            const d = porLote2[k]=porLote2[k]||{sum:0,n:0,rows:[],obj:m?.rendimiento_objetivo||85};
            d.sum+=cs.rendimiento_pct; d.n++;
            d.rows.push({fecha:p.fecha, prod:prodMap[p.producto_id]?.nombre||"?", rend:cs.rendimiento_pct, mad:cs.madejas, mts:cs.metros});
          }));
          const arr = Object.entries(porLote2).map(([k,d])=>({k,...d,rend:d.sum/d.n})).filter(x=>x.n>=2).sort((a,b)=>a.rend-b.rend);
          return (
          <Card>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,marginBottom:4,color:C.text}}>Lotes por rendimiento · toca para abrir jornadas</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Los peores arriba. Semirrizado ORH: &gt;100% es normal (objetivo 110)</div>
            {arr.map(x=>{
              const open = openLote===x.k;
              return (
                <div key={x.k}>
                  <div onClick={()=>setOpenLote(open?null:x.k)} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13.5,cursor:"pointer",gap:8}}>
                    <span>{open?"▾":"▸"} {x.k} <span style={{color:C.muted,fontSize:11}}>({x.n})</span></span>
                    <b style={{color:x.rend>=x.obj?C.green:x.rend>=x.obj-10?C.amber:C.red}}>{x.rend.toFixed(1)}%</b>
                  </div>
                  {open && x.rows.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map((r,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0 6px 16px",borderBottom:`1px solid ${C.card2}`,background:C.bg,fontSize:12.5}}>
                      <span>{fmtD(r.fecha)} · {r.prod} · {r.mad?`${r.mad} mad`:""}{r.mts?` +${r.mts} m`:""}</span>
                      <b style={{color:r.rend>=x.obj?C.green:r.rend>=x.obj-10?C.amber:C.red}}>{r.rend}%</b>
                    </div>
                  ))}
                </div>
              );
            })}
            {arr.length===0 && <div style={{fontSize:13,color:C.muted}}>Aún sin lotes con ≥2 jornadas.</div>}
          </Card>
          );
        })()}

        {!vacio && tab==="equipos" && (
          <Card>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,marginBottom:4,color:C.text}}>¿2 ó 3 personas? — por línea</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Solo días con equipo declarado. La cifra que manda: uds por persona.</div>
            {eqArr.map((x,i)=>(
              <div key={i} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}>
                  <b>{x.lin} · {x.np} personas</b>
                  <span><b style={{color:C.accent2}}>{x.porPers.toFixed(1)}</b><span style={{fontSize:12,color:C.muted}}> uds/pers·día</span></span>
                </div>
                <div style={{fontSize:12,color:C.muted}}>{x.udsDia.toFixed(1)} uds/día · {x.n} días · fabricación {(x.np*8*tarifaCargada/x.udsDia).toFixed(2)} €/ud</div>
              </div>
            ))}
            {eqArr.length===0 && <div style={{fontSize:13,color:C.muted}}>Aún sin días con equipo declarado — registra partes marcando las fichas de operarios.</div>}
            {opsArr.length>0 && <>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,margin:"16px 0 4px",color:C.text}}>Por operario (uds atribuidas/día)</div>
              {opsArr.map(x=>(
                <div key={x.nombre} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:13.5}}>
                  <span>👷 {x.nombre} <span style={{color:C.muted,fontSize:11}}>({x.n} días)</span></span>
                  <b>{x.udsDia.toFixed(1)}</b>
                </div>
              ))}
            </>}
          </Card>
        )}

        {!vacio && tab==="turnos" && (
          <Card>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,marginBottom:10,color:C.text}}>Comparativa por turno</div>
            {Object.entries(porTurno).map(([t,d])=>(
              <div key={t} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}>
                  <b>🕐 {t}</b>
                  <span><b>{d.uds.toFixed(0)}</b><span style={{fontSize:12,color:C.muted}}> uds · {d.dias.size} días</span></span>
                </div>
                <div style={{fontSize:12,color:C.muted}}>{(d.uds/d.dias.size).toFixed(1)} uds/día{d.cuds?` · fabricación media ${(d.coste/d.cuds).toFixed(2)} €/ud`:""}</div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function SyncCatalogoScreen({ onBack, productos }) {
  const [estado, setEstado] = useState("idle"); // idle | leyendo | preview | aplicando | fin
  const [cat, setCat] = useState([]);
  const [matches, setMatches] = useState([]);
  const [nuevos, setNuevos] = useState([]);
  const [crearNuevos, setCrearNuevos] = useState(false);
  const [log, setLog] = useState("");
  const [lote, setLote] = useState(null); // {ts, items}
  const [deshaciendo, setDeshaciendo] = useState(false);

  useEffect(() => {
    const creados = productos.filter(p => p.desde_catalogo && p.sync_catalogo);
    if (!creados.length) { setLote(null); return; }
    const ultimoTs = creados.reduce((a,p)=> p.sync_catalogo>a?p.sync_catalogo:a, creados[0].sync_catalogo);
    const items = creados.filter(p => p.sync_catalogo === ultimoTs);
    setLote({ ts: ultimoTs, items });
  }, [productos]);

  // Señal universal (vale para CUALQUIER versión de la app): un producto real
  // nunca se puede guardar sin centro — el formulario lo impide. Todo lo que
  // esté "sin centro" viene de una creación masiva del catálogo, sea de hoy o de antes.
  const sinCentro = productos.filter(p => !p.centro);
  const [deshaciendoSC, setDeshaciendoSC] = useState(false);
  const deshacerSinCentro = async () => {
    if (!sinCentro.length) return;
    const conf = window.prompt(`Vas a BORRAR ${sinCentro.length} productos SIN CENTRO asignado (la señal de que se crearon por error desde el catálogo).\n\nEscribe el número ${sinCentro.length} para confirmar:`);
    if (conf !== String(sinCentro.length)) return;
    setDeshaciendoSC(true);
    let n=0;
    for (const p of sinCentro) { await del("productos", p.id); n++; setLog(`Borrando… ${n}/${sinCentro.length}`); }
    setLog(`✅ Limpieza completa: ${n} productos sin centro eliminados.`);
    setDeshaciendoSC(false);
  };

  const deshacerLote = async () => {
    if (!lote) return;
    if (!window.confirm(`Esto BORRARÁ los ${lote.items.length} productos creados automáticamente el ${new Date(lote.ts).toLocaleString()}.\n\nSolo se tocan productos marcados "desde_catalogo" de ese lote exacto — nada más.\n\n¿Confirmas?`)) return;
    setDeshaciendo(true);
    let n=0;
    for (const p of lote.items) { await del("productos", p.id); n++; setLog(`Borrando… ${n}/${lote.items.length}`); }
    setLog(`✅ Deshecho: ${n} productos eliminados.`);
    setDeshaciendo(false);
  };

  const FB = "https://firestore.googleapis.com/v1/projects/grupo-consolidado-crm/databases/(default)/documents";
  const sv = (f,k) => (f[k]&&(f[k].stringValue??f[k].doubleValue??f[k].integerValue))||"";

  const leer = async () => {
    setEstado("leyendo"); setLog("Leyendo catálogo…");
    try {
      let acc=[], pt=null;
      do {
        const u = FB+"/productos?pageSize=300"+(pt?("&pageToken="+pt):"");
        const d = await (await fetch(u)).json();
        (d.documents||[]).forEach(doc=>{
          const f=doc.fields||{};
          acc.push({ codigo:String(sv(f,"codigo")).trim(), descripcion:sv(f,"nombre"), formato:sv(f,"formato"),
                     calibre:sv(f,"calibre")||sv(f,"ca"), metros:sv(f,"medida")||sv(f,"metros")||sv(f,"me"),
                     precio:sv(f,"precio"), categoria:sv(f,"categoria") });
        });
        pt = d.nextPageToken;
      } while (pt);
      setCat(acc);
      const byCode = {}; acc.forEach(x=>{ if(x.codigo) byCode[x.codigo.toUpperCase()]=x; });
      const mt=[], propios=new Set();
      productos.forEach(p=>{
        const k=(p.nombre||"").trim().toUpperCase(); propios.add(k);
        if (byCode[k]) mt.push({ p, c: byCode[k] });
      });
      const nv = acc.filter(x=>x.codigo && !propios.has(x.codigo.toUpperCase()));
      setMatches(mt); setNuevos(nv);
      setEstado("preview");
      setLog(`Catálogo: ${acc.length} productos · coinciden ${mt.length} · nuevos ${nv.length}`);
    } catch(e) { setEstado("idle"); setLog("❌ Error leyendo catálogo: "+e.message); }
  };

  const aplicar = async () => {
    setEstado("aplicando");
    let na=0, nc=0;
    for (const {p,c} of matches) {
      const upd = { descripcion:c.descripcion||"", calibre_catalogo:c.calibre||"", formato_catalogo:c.formato||"",
                    medida_catalogo:c.metros||"", precio_venta:parseFloat(String(c.precio).replace(",","."))||null,
                    categoria_catalogo:c.categoria||"", sync_catalogo: new Date().toISOString() };
      const mNum = parseFloat(String(c.metros).replace(",","."));
      if (!p.metros_finales && mNum>0 && mNum<=60) upd.metros_finales = mNum;
      await save("productos", p.id, upd); na++;
      setLog(`Actualizando… ${na}/${matches.length}`);
    }
    if (crearNuevos) {
      const conf = window.prompt(`Vas a CREAR ${nuevos.length} productos nuevos sin centro ni escandallo.\n\nEscribe el número ${nuevos.length} para confirmar:`);
      if (conf !== String(nuevos.length)) { setLog("❌ Creación de nuevos cancelada (no coincidía el número)."); setEstado("fin"); return; }
      for (const c of nuevos) {
        await save("productos", uid(), { nombre:c.codigo, descripcion:c.descripcion||"", calibre_catalogo:c.calibre||"",
          formato_catalogo:c.formato||"", medida_catalogo:c.metros||"", precio_venta:parseFloat(String(c.precio).replace(",","."))||null,
          categoria_catalogo:c.categoria||"", centro:"", unidad:"Stick", metros_finales:0, objetivo_diario:0, coste_objetivo:0,
          procesos_asignados:[], materias_asignadas:[], desde_catalogo:true, sync_catalogo:new Date().toISOString() });
        nc++;
      }
    }
    setLog(`✅ Sincronizado: ${na} productos enriquecidos${crearNuevos?` · ${nc} creados desde el catálogo (sin centro/escandallo — complétalos)`:""}`);
    setEstado("fin");
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="SINCRONIZAR CATÁLOGO" onBack={onBack} sub="Lee el catálogo del CRM (solo lectura) y enriquece tus productos por código"/>
      <div style={{padding:14}}>
        {sinCentro.length>0 && (
          <Card style={{marginBottom:14,border:`1.5px solid ${C.red||"#DC2626"}`}}>
            <div style={{fontSize:14,fontWeight:700,color:C.red||"#DC2626",marginBottom:4}}>⚠️ {sinCentro.length} productos SIN CENTRO asignado</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:10}}>
              Ningún producto real puede guardarse sin centro — esto detecta creaciones masivas accidentales de CUALQUIER momento, no solo la de hoy.
            </div>
            <div style={{maxHeight:140,overflowY:"auto",background:C.bg,borderRadius:8,padding:8,marginBottom:10,fontSize:12,color:C.muted}}>
              {sinCentro.slice(0,15).map(p=><div key={p.id}>{p.nombre}</div>)}
              {sinCentro.length>15 && <div style={{fontWeight:700,marginTop:4}}>… y {sinCentro.length-15} más</div>}
            </div>
            <Btn onClick={deshacerSinCentro} disabled={deshaciendoSC} style={{background:C.red||"#DC2626"}}>
              {deshaciendoSC?"⏳ Borrando…":`🗑️ Borrar los ${sinCentro.length} sin centro`}
            </Btn>
          </Card>
        )}
        {lote && lote.items.length>0 && (
          <Card style={{marginBottom:14,border:`1.5px solid ${C.red||"#DC2626"}`}}>
            <div style={{fontSize:14,fontWeight:700,color:C.red||"#DC2626",marginBottom:4}}>⚠️ Último lote creado automáticamente</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:10}}>
              {lote.items.length} productos · {new Date(lote.ts).toLocaleString()}. Si fue sin querer, deshazlo aquí (borra solo este lote).
            </div>
            <Btn onClick={deshacerLote} disabled={deshaciendo} style={{background:C.red||"#DC2626"}}>
              {deshaciendo?"⏳ Borrando…":`🗑️ Deshacer (borrar ${lote.items.length})`}
            </Btn>
          </Card>
        )}
        <Card style={{marginBottom:14}}>
          <div style={{fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:12}}>
            Fuente: <b>grupo-consolidado-crm</b> · colección <b>productos</b>. Casa por código y trae: descripción, calibre, formato, medida, precio de venta y categoría. Nunca escribe en el catálogo.
          </div>
          {estado==="idle" && <Btn onClick={leer}>🔗 Leer catálogo</Btn>}
          {estado==="preview" && <>
            <div style={{background:C.card2,borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.text}}>{matches.length} coincidencias · {nuevos.length} solo en catálogo</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>Se actualizarán los {matches.length} coincidentes. Los metros finales solo se rellenan si están vacíos (tus valores mandan).</div>
            </div>
            <button onClick={()=>setCrearNuevos(v=>!v)}
              style={{background:"#fff",border:`1.5px solid ${crearNuevos?C.blue:C.border}`,color:crearNuevos?C.blue:C.muted,borderRadius:20,padding:"8px 16px",fontSize:14,fontFamily:F.h,fontWeight:700,cursor:"pointer",marginBottom:12,display:"block"}}>
              {crearNuevos?"☑":"☐"} Crear también los {nuevos.length} productos nuevos del catálogo
            </button>
            <Btn onClick={aplicar}>💾 Aplicar sincronización</Btn>
          </>}
          {(estado==="leyendo"||estado==="aplicando") && <div style={{fontFamily:F.h,fontSize:16,color:C.muted}}>⏳ {log}</div>}
          {(estado==="fin"||estado==="idle") && log && <div style={{marginTop:10,fontSize:14,color:C.text}}>{log}</div>}
          {estado==="fin" && <div style={{marginTop:10}}><Btn v="secondary" onClick={()=>{setEstado("idle");setLog("");}}>↺ Volver a sincronizar</Btn></div>}
        </Card>
        {estado==="preview" && matches.length>0 && (
          <Card>
            <div style={{fontFamily:F.h,fontWeight:700,fontSize:13,color:C.mutedD,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Vista previa (primeros 10)</div>
            {matches.slice(0,10).map(({p,c},i)=>(
              <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
                <b>{p.nombre}</b> ← <span style={{color:C.blue}}>{c.descripcion||"(sin descripción)"}</span>
                <span style={{color:C.muted}}> · cal {c.calibre||"—"} · {c.metros||"—"} m · {c.precio?c.precio+" €":""}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function CentrosScreen({ onBack }) {
  const [centros] = useCol("centros", "nombre");
  const [refLineas] = useCol("lineas");
  const [refProds] = useCol("productos");
  const [refUsers] = useCol("usuarios");
  const enUso = (id) => {
    const n = refLineas.filter(l=>l.centro===id).length
            + refProds.filter(p=>p.centro===id).length
            + refUsers.filter(u=>u.centro===id || (u.centros||[]).includes(id)).length;
    return n;
  };
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [editId, setEditId] = useState(null);

  const add = async () => {
    if (!nombre.trim()) return;
    await save("centros", editId||uid(), { nombre: nombre.trim(), ubicacion: ubicacion.trim(), tarifa_mo: parseFloat(tarifa)||0, activo: true });
    setNombre(""); setUbicacion(""); setTarifa(""); setEditId(null);
  };
  const startEdit = (x) => { setEditId(x.id); setNombre(x.nombre||""); setUbicacion(x.ubicacion||""); setTarifa(x.tarifa_mo?.toString()||""); window.scrollTo(0,0); };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="CENTROS DE TRABAJO" onBack={onBack} sub="Cada centro produce de forma independiente"/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <Field label="Nombre del centro" value={nombre} onChange={setNombre} placeholder="Ej: Planta Baza"/>
          <Field label="Ubicación (opcional)" value={ubicacion} onChange={setUbicacion} placeholder="Ej: Baza, Granada"/>
          <Field label="Tarifa MO de referencia (€/hora)" value={tarifa} onChange={setTarifa} type="number" placeholder="12.50" min="0" step="0.01"/>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Centro"}</Btn>
          {editId && <button onClick={()=>{setEditId(null);setNombre("");setUbicacion("");setTarifa("");}} style={{marginLeft:8,background:"none",border:"none",color:C.muted,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>Cancelar</button>}
        </Card>
        {centros.length===0 && <Empty icon="🏭" text="Sin centros. Crea al menos uno para poder asignar operarios y productos."/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {centros.map(c=>(
            <Card key={c.id} style={{opacity:c.activo!==false?1:0.5}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:F.h,fontWeight:700,fontSize:18,color:C.text}}>🏭 {c.nombre} {c.activo===false&&<Pill>INACTIVO</Pill>}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:2}}>{c.ubicacion||""}{c.tarifa_mo?` · MO ref: ${c.tarifa_mo} €/h`:""}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <IconBtn onClick={()=>startEdit(c)}>✏️</IconBtn>
                  <button onClick={()=>save("centros",c.id,{activo:c.activo===false})}
                    style={{background:"#fff",border:`1.5px solid ${c.activo!==false?C.green:C.border}`,color:c.activo!==false?C.green:C.muted,borderRadius:20,padding:"4px 12px",fontSize:12,fontFamily:F.h,fontWeight:600,cursor:"pointer"}}>
                    {c.activo!==false?"✓ Activo":"Reactivar"}
                  </button>
                  <IconBtn danger onClick={()=>{
                      const n = enUso(c.id);
                      if (n>0) { window.alert(`⛔ No se puede borrar: ${n} registros (líneas, productos o usuarios) dependen de este centro. Desactívalo si no quieres usarlo.`); return; }
                      if(window.confirm("¿Eliminar centro?")) del("centros",c.id);
                    }}>🗑️</IconBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LÍNEAS DE PRODUCCIÓN (por centro)
// ═══════════════════════════════════════════════════════════════════════════════
function LineasScreen({ onBack, centros }) {
  const [lineas] = useCol("lineas", "nombre");
  const [centro, setCentro] = useState("");
  const [nombre, setNombre] = useState("");
  const [editId, setEditId] = useState(null);
  const startEdit = (x)=>{ setEditId(x.id); setNombre(x.nombre||""); setCentro(x.centro||""); window.scrollTo(0,0); };
  useEffect(()=>{ if(!centro && centros.length) setCentro(centros[0].id); },[centros.length]);

  const add = async () => {
    if (!nombre.trim() || !centro) return;
    await save("lineas", editId||uid(), { centro, nombre: nombre.trim(), activo: true });
    setNombre(""); setEditId(null);
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="LÍNEAS DE PRODUCCIÓN" onBack={onBack} sub="Una orden nace y muere en su línea"/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <Sel label="Centro" value={centro} onChange={setCentro} placeholder="Centro…"
            options={centros.map(x=>({value:x.id,label:`🏭 ${x.nombre}`}))}/>
          <Field label="Nombre de la línea" value={nombre} onChange={setNombre} placeholder="Ej: Maextra / Especta / MX368"/>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Línea"}</Btn>
          {editId && <button onClick={()=>{setEditId(null);setNombre("");}} style={{marginLeft:8,background:"none",border:"none",color:C.muted,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>Cancelar</button>}
        </Card>
        {centros.map(ct=>{
          const rows = lineas.filter(l=>l.centro===ct.id);
          if(!rows.length) return null;
          return (
            <div key={ct.id} style={{marginBottom:14}}>
              <div style={{fontFamily:F.h,fontWeight:700,fontSize:13,color:C.mutedD,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>🏭 {ct.nombre} · {rows.length} líneas</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {rows.map(l=>(
                  <Card key={l.id} style={{opacity:l.activo!==false?1:0.5}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontFamily:F.h,fontWeight:700,fontSize:16,color:C.text}}>⚙️ {l.nombre}</div>
                      <div style={{display:"flex",gap:6}}>
                        <IconBtn onClick={()=>startEdit(l)}>✏️</IconBtn>
                        <button onClick={()=>save("lineas",l.id,{activo:l.activo===false})}
                          style={{background:"#fff",border:`1px solid ${l.activo!==false?C.green:C.border}`,color:l.activo!==false?C.green:C.muted,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                          {l.activo!==false?"✓ Activa":"Reactivar"}
                        </button>
                        <IconBtn danger onClick={()=>{if(window.confirm("¿Eliminar línea?"))del("lineas",l.id);}}>🗑️</IconBtn>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
        {lineas.length===0 && <Empty icon="⚙️" text="Sin líneas. Solo los centros con maquinaria en líneas las necesitan — el resto trabaja como centro único."/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTIVOS DE PARO (catálogo configurable)
// ═══════════════════════════════════════════════════════════════════════════════
function MotivosScreen({ onBack }) {
  const [motivos] = useCol("motivos_paro", "nombre");
  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("");
  const [editId, setEditId] = useState(null);
  const startEdit = (m)=>{ setEditId(m.id); setNombre(m.nombre||""); setIcono(m.icono||""); window.scrollTo(0,0); };
  const add = async () => {
    if (!nombre.trim()) return;
    await save("motivos_paro", editId||uid(), { nombre: nombre.trim(), icono: icono.trim()||"⏸" });
    setNombre(""); setIcono(""); setEditId(null);
  };
  const sugerencias = [["🔧","Avería máquina"],["📦","Falta materia prima"],["🔄","Cambio de formato"],["🧽","Limpieza"],["🧪","Pruebas"],["🎓","Formación"],["☕","Descanso"],["✏️","Otro"]];
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="MOTIVOS DE PARO" onBack={onBack} sub="Los botones que verá el operario al parar"/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <div style={{display:"grid",gridTemplateColumns:"70px 1fr",gap:10}}>
            <Field label="Icono" value={icono} onChange={setIcono} placeholder="🔧"/>
            <Field label="Motivo" value={nombre} onChange={setNombre} placeholder="Ej: Avería máquina"/>
          </div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Motivo"}</Btn>
          {editId && <button onClick={()=>{setEditId(null);setNombre("");setIcono("");}} style={{marginLeft:8,background:"none",border:"none",color:C.muted,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>Cancelar</button>}
          {motivos.length===0 && (
            <div style={{marginTop:12}}>
              <div style={{fontSize:12,color:C.mutedD,marginBottom:8}}>Sugerencia rápida — pulsa para crear los 8 típicos:</div>
              <Btn v="secondary" onClick={async()=>{for(const [ic,nm] of sugerencias){await save("motivos_paro",uid(),{nombre:nm,icono:ic});}}}>⚡ Crear los 8 motivos estándar</Btn>
            </div>
          )}
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {motivos.map(m=>(
            <Card key={m.id} style={{textAlign:"center",position:"relative"}}>
              <div style={{fontSize:28}}>{m.icono}</div>
              <div style={{fontFamily:F.h,fontWeight:700,fontSize:14,color:C.text,marginTop:4}}>{m.nombre}</div>
              <button onClick={()=>startEdit(m)}
                style={{position:"absolute",top:6,left:8,background:"none",border:"none",cursor:"pointer",fontSize:13}}>✏️</button>
              <button onClick={()=>{if(window.confirm("¿Eliminar motivo?"))del("motivos_paro",m.id);}}
                style={{position:"absolute",top:6,right:8,background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13}}>✕</button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TURNOS
// ═══════════════════════════════════════════════════════════════════════════════
function TurnosScreen({ onBack }) {
  const [turnos] = useCol("turnos", "hora_inicio");
  const [nombre, setNombre] = useState("");
  const [hi, setHi] = useState("06:00");
  const [hf, setHf] = useState("14:00");
  const [editId, setEditId] = useState(null);
  const startEdit = (t)=>{ setEditId(t.id); setNombre(t.nombre||""); setHi(t.hora_inicio||"06:00"); setHf(t.hora_fin||"14:00"); window.scrollTo(0,0); };

  const add = async () => {
    if (!nombre.trim()) return;
    await save("turnos", editId||uid(), { nombre: nombre.trim(), hora_inicio: hi, hora_fin: hf });
    setNombre(""); setEditId(null);
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="TURNOS" onBack={onBack}/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <Field label="Nombre del turno" value={nombre} onChange={setNombre} placeholder="Ej: Mañana"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Inicio" value={hi} onChange={setHi} type="time"/>
            <Field label="Fin" value={hf} onChange={setHf} type="time"/>
          </div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Turno"}</Btn>
          {editId && <button onClick={()=>{setEditId(null);setNombre("");}} style={{marginLeft:8,background:"none",border:"none",color:C.muted,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>Cancelar</button>}
        </Card>
        {turnos.length===0 && <Empty icon="🕐" text="Sin turnos. Crea Mañana y Tarde."/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {turnos.map(t=>(
            <Card key={t.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{fontFamily:F.h,fontWeight:700,fontSize:18,color:C.text}}>{t.nombre}</span>
                  <span style={{color:C.accent,fontSize:15,marginLeft:12,fontFamily:F.h,fontWeight:600}}>{t.hora_inicio} – {t.hora_fin}</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <IconBtn onClick={()=>startEdit(t)}>✏️</IconBtn>
                  <IconBtn danger onClick={()=>{if(window.confirm("¿Eliminar turno?"))del("turnos",t.id);}}>🗑️</IconBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESOS (catálogo global)
// ═══════════════════════════════════════════════════════════════════════════════
function ProcesosScreen({ onBack }) {
  const [procesos] = useCol("procesos", "nombre");
  const [refProds] = useCol("productos");
  const procEnUso = (id) => refProds.filter(p=>(p.procesos_asignados||[]).some(x=>x.proceso_id===id)).length;
  const [nombre, setNombre] = useState("");
  const [diferido, setDiferido] = useState(false);
  const [apoyo, setApoyo] = useState(false);
  const [editId, setEditId] = useState(null);
  const startEdit = (p)=>{ setEditId(p.id); setNombre(p.nombre||""); setDiferido(!!p.diferido); setApoyo(!!p.apoyo); window.scrollTo(0,0); };

  const add = async () => {
    if (!nombre.trim()) return;
    await save("procesos", editId||uid(), { nombre: nombre.trim(), diferido, apoyo });
    setNombre(""); setDiferido(false); setApoyo(false); setEditId(null);
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="CATÁLOGO DE PROCESOS" onBack={onBack} sub="Reutilizables en todos los productos"/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <Field label="Nombre del proceso" value={nombre} onChange={setNombre} placeholder="Ej: Plisado"/>
          <button onClick={()=>setDiferido(d=>!d)}
            style={{background:"#fff",border:`1.5px solid ${diferido?C.amber:C.border}`,color:diferido?C.amber:C.muted,borderRadius:20,padding:"6px 16px",fontSize:14,fontFamily:F.h,fontWeight:600,cursor:"pointer",marginBottom:12}}>
            {diferido?"⏭ Diferido (se hace al día siguiente)":"◯ Diferido (día siguiente)"}
          </button>
          <button onClick={()=>setApoyo(a=>!a)}
            style={{background:"#fff",border:`1px solid ${apoyo?C.blue:C.border}`,color:apoyo?C.blue:C.muted,borderRadius:20,padding:"6px 16px",fontSize:14,fontFamily:F.h,fontWeight:600,cursor:"pointer",marginBottom:12,marginLeft:8}}>
            {apoyo?"🤝 Apoyo compartido (se reparte entre líneas)":"◯ Apoyo compartido"}
          </button>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Proceso"}</Btn>
          {editId && <button onClick={()=>{setEditId(null);setNombre("");setDiferido(false);setApoyo(false);}} style={{marginLeft:8,background:"none",border:"none",color:C.muted,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>Cancelar</button>}
        </Card>
        {procesos.length===0 && <Empty icon="⚙️" text="Sin procesos. Ej: Estirar, Ensanchar, Plisar…"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {procesos.map(p=>(
            <Card key={p.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text}}>
                  {p.nombre} {p.diferido && <Pill color={C.amber} bg={C.amberBg}>⏭ DIFERIDO</Pill>} {p.apoyo && <Pill color={C.blue} bg={C.blueBg}>🤝 APOYO</Pill>}
                </div>
                <IconBtn onClick={()=>startEdit(p)}>✏️</IconBtn>
                <IconBtn danger onClick={()=>{
                  const n = procEnUso(p.id);
                  if (n>0) { window.alert(`⛔ No se puede borrar: ${n} productos usan este proceso. Quítalo primero de esos productos.`); return; }
                  if(window.confirm("¿Eliminar proceso del catálogo?")) del("procesos",p.id);
                }}>🗑️</IconBtn>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAS PRIMAS (con rendimiento objetivo y precio)
// ═══════════════════════════════════════════════════════════════════════════════
function MateriasPrimasScreen({ onBack }) {
  const [mps] = useCol("materias_primas", "nombre");
  const [refProdsMp] = useCol("productos");
  const mpEnUso = (id) => refProdsMp.filter(p=>(p.materias_asignadas||[]).some(x=>x.mp_id===id)).length;
  const [edit, setEdit] = useState(null);

  if (edit !== null) return <MpForm onBack={()=>setEdit(null)} ep={edit.id?edit:null}/>;
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="MATERIAS PRIMAS" onBack={onBack}/>
      <div style={{padding:14}}>
        <Btn onClick={()=>setEdit({})} style={{marginBottom:14}}>＋ Nueva Materia Prima</Btn>
        {mps.length===0 && <Empty icon="📦" text="Sin materias primas"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {mps.map(m=>(
            <Card key={m.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text}}>{m.nombre}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                    {m.precio_ud}€/{m.unidad} · {m.metros_madeja||90} m/madeja · Rend. obj: <span style={{color:C.blue,fontWeight:700}}>{m.rendimiento_objetivo}%</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <IconBtn onClick={()=>setEdit(m)}>✏️</IconBtn>
                  <IconBtn danger onClick={()=>{
                    const n = mpEnUso(m.id);
                    if (n>0) { window.alert(`⛔ No se puede borrar: ${n} productos llevan esta materia en su escandallo. Quítala primero de esos productos.`); return; }
                    if(window.confirm("¿Eliminar materia?")) del("materias_primas",m.id);
                  }}>🗑️</IconBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
function MpForm({ onBack, ep }) {
  const [nombre, setNombre] = useState(ep?.nombre||"");
  const [unidad, setUnidad] = useState(ep?.unidad||"metros");
  const [precio, setPrecio] = useState(ep?.precio_ud?.toString()||"");
  const [rend, setRend]     = useState(ep?.rendimiento_objetivo?.toString()||"100");
  const [mMadeja, setMMadeja] = useState(ep?.metros_madeja?.toString()||"90");
  const guardar = async () => {
    if (!nombre.trim()) return;
    await save("materias_primas", ep?.id||uid(), {
      nombre: nombre.trim(), unidad: unidad.trim()||"ud",
      precio_ud: parseFloat(precio)||0,
      rendimiento_objetivo: parseFloat(rend)||100,
      metros_madeja: parseFloat(mMadeja)||90,
    });
    onBack();
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title={ep?"EDITAR MATERIA PRIMA":"NUEVA MATERIA PRIMA"} onBack={onBack}/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <Field label="Nombre" value={nombre} onChange={setNombre} placeholder="Ej: Cerdo 32/34"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Unidad" value={unidad} onChange={setUnidad} placeholder="metros, kg…"/>
            <Field label="Precio / unidad (€)" value={precio} onChange={setPrecio} type="number" placeholder="0.45" min="0" step="0.001"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Rendimiento objetivo (%)" value={rend} onChange={setRend} type="number" placeholder="85" min="1" step="0.1"/>
            <Field label="Metros por madeja" value={mMadeja} onChange={setMMadeja} type="number" placeholder="90" min="0.1" step="0.1"/>
          </div>
        </Card>
        <Btn onClick={guardar}>💾 Guardar</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDORES
// ═══════════════════════════════════════════════════════════════════════════════
function ProveedoresScreen({ onBack, mps }) {
  const [provs] = useCol("proveedores", "nombre");
  const [edit, setEdit] = useState(null);
  if (edit !== null) return <ProvForm onBack={()=>setEdit(null)} ep={edit.id?edit:null} mps={mps}/>;
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="PROVEEDORES" onBack={onBack}/>
      <div style={{padding:14}}>
        <Btn onClick={()=>setEdit({})} style={{marginBottom:14}}>＋ Nuevo Proveedor</Btn>
        {provs.length===0 && <Empty icon="🚚" text="Sin proveedores"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {provs.map(p=>(
            <Card key={p.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text}}>{p.nombre}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                    {p.contacto||"—"}
                    {p.materias?.length>0 && <> · {p.materias.map(id=>mps.find(m=>m.id===id)?.nombre).filter(Boolean).join(", ")}</>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <IconBtn onClick={()=>setEdit(p)}>✏️</IconBtn>
                  <IconBtn danger onClick={()=>{if(window.confirm("¿Eliminar?"))del("proveedores",p.id);}}>🗑️</IconBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
function ProvForm({ onBack, ep, mps }) {
  const [nombre, setNombre] = useState(ep?.nombre||"");
  const [contacto, setContacto] = useState(ep?.contacto||"");
  const [materias, setMaterias] = useState(ep?.materias||[]);
  const toggleMp = id => setMaterias(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const guardar = async () => {
    if (!nombre.trim()) return;
    await save("proveedores", ep?.id||uid(), { nombre: nombre.trim(), contacto: contacto.trim(), materias });
    onBack();
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title={ep?"EDITAR PROVEEDOR":"NUEVO PROVEEDOR"} onBack={onBack}/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <Field label="Nombre" value={nombre} onChange={setNombre} placeholder="Ej: STAR"/>
          <Field label="Contacto (opcional)" value={contacto} onChange={setContacto} placeholder="email / teléfono"/>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Materias que suministra</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {mps.map(m=>(
              <button key={m.id} onClick={()=>toggleMp(m.id)}
                style={{background:"#fff",border:`1.5px solid ${materias.includes(m.id)?C.green:C.border}`,color:materias.includes(m.id)?C.green:C.muted,borderRadius:20,padding:"6px 14px",fontSize:14,fontFamily:F.h,fontWeight:600,cursor:"pointer"}}>
                {materias.includes(m.id)?"✓ ":""}{m.nombre}
              </button>
            ))}
            {mps.length===0 && <span style={{fontSize:13,color:C.muted}}>Primero crea materias primas</span>}
          </div>
        </Card>
        <Btn onClick={guardar}>💾 Guardar</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTOS (coste objetivo + procesos con tiempo + materias con consumo)
// ═══════════════════════════════════════════════════════════════════════════════

function prodInfo(nombre){
  const n=String(nombre||"");
  let m, fam="", cal="", capas="";
  if((m=n.match(/^ESP(\d{2})/))){ fam="Especta"; cal=m[1]; capas="2 capas + semirrizado"; }
  else if((m=n.match(/^MX(\d)(\d{2})\..*M$/))){ fam="Maextra +"; cal=m[2]; capas=m[1]+" capas + MALLA"; }
  else if((m=n.match(/^MX(\d)(\d{2})\.\d+(-\d+)?R/))){ fam="Maextra +"; cal=m[2]; capas=m[1]+" capas"; }
  else if((m=n.match(/^MXP?(\d{2,3})\./))){ fam="Maextra Pro"; cal=m[1]; capas="fina"; }
  const mm=n.match(/\.(\d+)/); const metros=mm?mm[1]:"10";
  if(!fam) return {desc:"", linea2:""};
  return {desc:fam+" ("+capas+")", linea2:fam+" ("+capas+") · Ø"+cal+" · "+metros+" m"};
}

function ProductoBuscador({ label="Producto", value, onChange, productos, placeholder="Buscar por código, descripción o calibre…" }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const sel = productos.find(p=>p.id===value) || null;
  const info = p => {
    const cat=[p.descripcion, p.calibre_catalogo?`Ø${p.calibre_catalogo}`:null, p.metros_finales?`${p.metros_finales} m`:(p.medida_catalogo?`${p.medida_catalogo} m`:null)].filter(Boolean).join(" · ");
    return cat || prodInfo(p.nombre).linea2 || "";
  };
  const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const términos = norm(q).split(/\s+/).filter(Boolean);
  const results = q.trim()==="" ? productos : productos.filter(p=>{
    const hay = norm(p.nombre+" "+(p.descripcion||"")+" "+(p.calibre_catalogo||""));
    return términos.every(t=>hay.includes(t));
  });
  return (
    <div style={{marginBottom:14}}>
      {label && <label style={{display:"block",fontFamily:F.h,fontWeight:600,fontSize:12,color:C.mutedD,marginBottom:5,letterSpacing:0.2}}>{label}</label>}
      {!abierto && sel && (
        <div onClick={()=>{setAbierto(true);setQ("");}} style={{background:"#fff",border:`1.5px solid ${C.blue}`,borderRadius:12,padding:"12px 14px",cursor:"pointer"}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:17,color:C.text}}>{sel.nombre}</div>
          {info(sel) && <div style={{fontSize:13,color:C.blue,fontWeight:600,marginTop:2}}>{info(sel)}</div>}
        </div>
      )}
      {(abierto || !sel) && (
        <div style={{position:"relative"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:13,top:12,fontSize:15,color:C.muted}}>🔍</span>
            <input autoFocus={abierto} value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setAbierto(true)}
              placeholder={placeholder}
              style={{width:"100%",background:"#fff",border:`1px solid ${C.border}`,color:C.text,borderRadius:12,padding:"12px 14px 12px 36px",fontFamily:F.b,fontSize:15,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {abierto && (
            <div style={{marginTop:6,maxHeight:280,overflowY:"auto",background:"#fff",border:`1px solid ${C.border}`,borderRadius:12}}>
              {results.length===0 && <div style={{padding:14,fontSize:13,color:C.muted}}>Sin resultados</div>}
              {results.slice(0,60).map(p=>(
                <div key={p.id} onClick={()=>{onChange(p.id);setAbierto(false);setQ("");}}
                  style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                  <div style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.text}}>{p.nombre}</div>
                  {info(p) && <div style={{fontSize:12.5,color:C.blue,fontWeight:600,marginTop:1}}>{info(p)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductosScreen({ onBack, procesos, mps, centros }) {
  const [productos] = useCol("productos", "nombre");
  const [edit, setEdit] = useState(null);
  const [busq, setBusq] = useState("");
  const normB = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const infoLB = p => [p.descripcion, p.calibre_catalogo?`Ø${p.calibre_catalogo}`:null, p.metros_finales?`${p.metros_finales} m`:(p.medida_catalogo?`${p.medida_catalogo} m`:null)].filter(Boolean).join(" · ") || prodInfo(p.nombre).linea2 || "";
  const términosB = normB(busq).split(/\s+/).filter(Boolean);
  const productosFiltrados = términosB.length===0 ? productos : productos.filter(p=>{
    const hay = normB(p.nombre+" "+(p.descripcion||"")+" "+(p.calibre_catalogo||""));
    return términosB.every(t=>hay.includes(t));
  });
  if (edit !== null) return <ProductoForm onBack={()=>setEdit(null)} ep={edit.id?edit:null} procesos={procesos} mps={mps} centros={centros}/>;

  const duplicar = async p => {
    const { id, ...data } = p;
    await save("productos", uid(), { ...data, nombre: `${p.nombre} (copia)` });
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="PRODUCTOS" onBack={onBack}/>
      <div style={{padding:14}}>
        <Btn onClick={()=>setEdit({})} style={{marginBottom:14}}>＋ Nuevo Producto</Btn>
        <div style={{position:"relative",marginBottom:14}}>
          <span style={{position:"absolute",left:13,top:12,fontSize:15,color:C.muted}}>🔍</span>
          <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar por código, descripción o calibre…"
            style={{width:"100%",background:"#fff",border:`1px solid ${C.border}`,color:C.text,borderRadius:12,padding:"12px 14px 12px 36px",fontFamily:F.b,fontSize:15,outline:"none",boxSizing:"border-box"}}/>
        </div>
        {productos.length===0 && <Empty icon="🏷️" text="Sin productos"/>}
        {productos.length>0 && productosFiltrados.length===0 && <Empty icon="🔍" text="Sin resultados para tu búsqueda"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {productosFiltrados.map(p=>(
            <Card key={p.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:F.h,fontWeight:800,fontSize:22,color:C.text,letterSpacing:.3}}>{p.nombre}</div>
                  {(()=>{const cat=[p.descripcion, p.calibre_catalogo?`Ø${p.calibre_catalogo}`:null, p.metros_finales?`${p.metros_finales} m`:null].filter(Boolean).join(" · "); const l=cat||prodInfo(p.nombre).linea2; return l?<div style={{fontSize:13.5,color:C.blue,fontWeight:600,marginTop:1}}>{l}</div>:null;})()}
                  <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                    🏭 {centros.find(c=>c.id===p.centro)?.nombre||"sin centro"}
                    {" · "}Obj: <span style={{color:C.blue,fontWeight:700}}>{p.objetivo_diario||0}/día</span>
                    {p.uds_turno_linea>0
                      ? <>{" · "}<span style={{color:C.green,fontWeight:700}}>⏱️ {p.uds_turno_linea}/turno · {p.personas_linea||3}p</span></>
                      : <>{" · "}<span style={{color:C.red,fontWeight:700}}>⏱️ sin ritmo</span></>}
                    {" · "}Coste obj: <span style={{color:C.text,fontWeight:700}}>{p.coste_objetivo}€/{p.unidad}</span>
                    {" · "}{p.procesos_asignados?.length||0} procesos · {p.materias_asignadas?.length||0} materias
                  </div>
                  {p.precio_venta>0 && (
                    <div style={{marginTop:4,display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{background:C.greenBg,border:`1.5px solid ${C.green}`,borderRadius:8,padding:"2px 9px",fontSize:12.5,fontFamily:F.h,fontWeight:800,color:C.green}}>
                        💶 Venta: {p.precio_venta.toFixed(2)} €
                      </span>
                      {p.coste_objetivo>0 && (
                        <span style={{fontSize:12,color:C.muted,fontWeight:600}}>
                          margen {(p.precio_venta-p.coste_objetivo).toFixed(2)} € · {((p.precio_venta-p.coste_objetivo)/p.precio_venta*100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <IconBtn onClick={()=>setEdit(p)}>✏️</IconBtn>
                  <IconBtn onClick={()=>duplicar(p)}>📋</IconBtn>
                  <IconBtn danger onClick={()=>{if(window.confirm("¿Eliminar producto?"))del("productos",p.id);}}>🗑️</IconBtn>
                </div>
              </div>
              {p.procesos_asignados?.length>0 && (
                <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",flexWrap:"wrap",gap:6}}>
                  {p.procesos_asignados.map(pa=>{
                    const pr = procesos.find(x=>x.id===pa.proceso_id);
                    return <span key={pa.proceso_id} style={{background:"#fff",border:`1.5px solid ${pa.define_cantidad?C.green:C.border}`,borderRadius:8,padding:"4px 10px",fontSize:13,color:pa.define_cantidad?C.green:C.muted}}>
                      {pa.define_cantidad?"★ ":""}{pr?.diferido?"⏭ ":""}{pr?.nombre||"?"} <span style={{color:C.accent,fontWeight:700}}>{pa.min_obj}min</span>
                    </span>;
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductoForm({ onBack, ep, procesos, mps, centros }) {
  const [nombre, setNombre] = useState(ep?.nombre||"");
  const [centro, setCentro] = useState(ep?.centro||"");
  const [unidad, setUnidad] = useState(ep?.unidad||"Stick");
  const [coste, setCoste]   = useState(ep?.coste_objetivo?.toString()||"");
  const [precioVenta, setPrecioVenta] = useState(ep?.precio_venta?.toString()||"");
  const [mFinales, setMFinales] = useState(ep?.metros_finales?.toString()||"");
  const [objDiario, setObjDiario] = useState(ep?.objetivo_diario?.toString()||"");
  const [udsTurno, setUdsTurno] = useState(ep?.uds_turno_linea?.toString()||"");
  const [persLinea, setPersLinea] = useState(ep?.personas_linea?.toString()||"3");
  const [pa, setPa]         = useState(ep?.procesos_asignados||[]); // [{proceso_id,min_obj,define_cantidad}]
  const [ma, setMa]         = useState(ep?.materias_asignadas||[]); // [{mp_id,capas,precio_ud,rendimiento}]
  const [selProc, setSelProc] = useState("");
  const [minObj, setMinObj]   = useState("");
  const [selMp, setSelMp]     = useState("");
  const [capas, setCapas]     = useState("");
  const [precioMp, setPrecioMp] = useState("");
  const [rendMp, setRendMp]     = useState("");

  const tarifaMO = centros.find(c=>c.id===centro)?.tarifa_mo || 12.5;

  const onSelMp = (id) => {
    setSelMp(id);
    const m = mps.find(x=>x.id===id);
    setPrecioMp(m?.precio_ud?.toString()||"");
    setRendMp(m?.rendimiento_objetivo?.toString()||"85");
  };

  // Coste de materia prima objetivo por línea del escandallo: metros teóricos ÷ rendimiento × precio
  const costeMatLinea = (capasN, precioN, rendN) => {
    const metros = (parseFloat(mFinales)||0) * capasN;
    const rend = rendN>0 ? rendN/100 : 1;
    return rend>0 ? (metros/rend)*precioN : 0;
  };
  const costeMPTotal = ma.reduce((s,x)=>s+costeMatLinea(x.capas, x.precio_ud||0, x.rendimiento||100), 0);
  // Coste de mano de obra objetivo por proceso: minutos/ud ÷ 60 × tarifa del centro
  const costeProcLinea = (minObjN) => (minObjN/60)*tarifaMO;
  const costeMOTotal = pa.reduce((s,x)=>s+costeProcLinea(x.min_obj||0), 0);
  const costeCalculado = costeMPTotal + costeMOTotal;
  const costeFinal = parseFloat(coste)||0;
  const pv = parseFloat(precioVenta)||0;
  const margenPct = pv>0 ? ((pv-costeFinal)/pv*100) : null;

  const addProc = () => {
    if (!selProc || !minObj) return;
    if (pa.find(x=>x.proceso_id===selProc)) return;
    setPa(prev=>[...prev,{proceso_id:selProc,min_obj:parseFloat(minObj),define_cantidad:prev.length===0}]);
    setSelProc(""); setMinObj("");
  };
  const addMp = () => {
    if (!selMp || !capas) return;
    if (ma.find(x=>x.mp_id===selMp)) return;
    setMa(prev=>[...prev,{mp_id:selMp,capas:parseInt(capas),precio_ud:parseFloat(precioMp)||0,rendimiento:parseFloat(rendMp)||100}]);
    setSelMp(""); setCapas(""); setPrecioMp(""); setRendMp("");
  };
  const guardar = async () => {
    if (!nombre.trim()) return;
    if (!centro) { alert("Asigna el producto a un centro"); return; }
    await save("productos", ep?.id||uid(), {
      nombre: nombre.trim(), centro, unidad: unidad.trim()||"ud",
      coste_objetivo: parseFloat(coste)||0,
      coste_mp_objetivo: costeMPTotal, coste_mo_objetivo: costeMOTotal,
      precio_venta: pv||null,
      metros_finales: parseFloat(mFinales)||0,
      objetivo_diario: parseFloat(objDiario)||0,
      uds_turno_linea: parseFloat(udsTurno)||0,
      personas_linea: parseInt(persLinea)||3,
      procesos_asignados: pa, materias_asignadas: ma,
    });
    onBack();
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title={ep?"EDITAR PRODUCTO":"NUEVO PRODUCTO"} onBack={onBack}/>
      <div style={{padding:14}}>
        <Card style={{marginBottom:14}}>
          <Field label="Nombre" value={nombre} onChange={setNombre} placeholder="Ej: Maextra Pro 26"/>
          <Sel label="Centro de trabajo" value={centro} onChange={setCentro} placeholder="Seleccionar centro…"
            options={centros.map(c=>({value:c.id,label:`🏭 ${c.nombre}`}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Unidad" value={unidad} onChange={setUnidad} placeholder="Stick"/>
            <Field label="Metros finales/ud" value={mFinales} onChange={setMFinales} type="number" placeholder="10" min="0" step="0.1"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Objetivo diario (uds)" value={objDiario} onChange={setObjDiario} type="number" placeholder="100" min="0" step="1"/>
            <Field label="Precio medio de venta (€)" value={precioVenta} onChange={setPrecioVenta} type="number" placeholder="9.00" min="0" step="0.01"/>
          </div>
        </Card>

        {/* RITMO — base de la planificación */}
        <Card style={{marginBottom:14}} color={C.blue+"55"}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:3}}>⏱️ Ritmo de fabricación</div>
          <div style={{fontSize:12,color:C.mutedD,marginBottom:12,lineHeight:1.5}}>Cuántas unidades salen de <b>una línea en un turno</b>. Es la base de toda la planificación: sin este dato el plan no puede calcular recursos.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Uds por turno-línea" value={udsTurno} onChange={setUdsTurno} type="number" placeholder="150" min="0" step="1"/>
            <Field label="Personas por línea" value={persLinea} onChange={setPersLinea} type="number" placeholder="3" min="1" step="1"/>
          </div>
          {parseFloat(udsTurno)>0 && (
            <div style={{background:C.blueBg,borderRadius:10,padding:"10px 12px",fontSize:13,color:C.text,lineHeight:1.6}}>
              Consume <b>{((parseInt(persLinea)||3)/3).toFixed(2).replace(/\.00$/,"")}</b> hueco{((parseInt(persLinea)||3)/3)!==1?"s":""} de línea · MO objetivo <b>{(((parseInt(persLinea)||3)*8*TARIFA_MO)/parseFloat(udsTurno)).toFixed(2)} €/ud</b>
              <div style={{fontSize:11,color:C.mutedD,marginTop:3}}>{parseInt(persLinea)||3} personas × 8 h × {TARIFA_MO} €/h ÷ {udsTurno} uds</div>
            </div>
          )}
        </Card>

        {/* PROCESOS */}
        <Card style={{marginBottom:14}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text,marginBottom:4}}>PROCESOS</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Del catálogo global, con tiempo objetivo por {unidad||"ud"}. ★ = define la cantidad producida</div>
          <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:8}}>Tarifa del centro: {tarifaMO.toFixed(2)} €/h — el coste de mano de obra se calcula solo</div>
          {pa.map(x=>{
            const pr = procesos.find(z=>z.id===x.proceso_id);
            const cst = costeProcLinea(x.min_obj||0);
            return (
              <div key={x.proceso_id} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{fontFamily:F.h,fontWeight:600,fontSize:16,color:C.text}}>{pr?.diferido?"⏭ ":""}{pr?.nombre||"?"}</span>
                    <span style={{color:C.accent,fontSize:14,marginLeft:10,fontWeight:600}}>{x.min_obj} min/{unidad||"ud"}</span>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <button onClick={()=>setPa(prev=>prev.map(z=>({...z,define_cantidad:z.proceso_id===x.proceso_id})))}
                      style={{background:"#fff",border:`1.5px solid ${x.define_cantidad?C.green:C.border}`,color:x.define_cantidad?C.green:C.muted,borderRadius:20,padding:"3px 12px",fontSize:12,fontFamily:F.h,fontWeight:600,cursor:"pointer"}}>
                      {x.define_cantidad?"★ Define qty":"◯"}
                    </button>
                    <button onClick={()=>setPa(prev=>prev.filter(z=>z.proceso_id!==x.proceso_id))}
                      style={{background:"none",border:"none",color:C.red,fontSize:18,cursor:"pointer"}}>✕</button>
                  </div>
                </div>
                <div style={{fontSize:12.5,color:C.green,fontWeight:700,marginTop:2}}>→ {cst.toFixed(3)} €/{unidad||"ud"} de mano de obra</div>
              </div>
            );
          })}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:8,marginTop:12,alignItems:"end"}}>
            <Sel value={selProc} onChange={setSelProc} placeholder="Proceso…"
              options={procesos.filter(p=>!pa.find(x=>x.proceso_id===p.id)).map(p=>({value:p.id,label:p.nombre}))}/>
            <Field label="Tiempo (min/ud)" value={minObj} onChange={setMinObj} type="number" placeholder="min/ud" min="0.01" step="0.01"/>
            <button onClick={addProc} style={{background:C.accent,border:"none",color:"#fff",borderRadius:11,padding:"13px 18px",fontFamily:F.h,fontWeight:700,fontSize:17,cursor:"pointer",marginBottom:14}}>＋</button>
          </div>
          {pa.length>0 && (
            <div style={{marginTop:10,paddingTop:10,borderTop:`1.5px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontFamily:F.h,fontWeight:700,fontSize:14,color:C.text}}>COSTE OBJETIVO MANO DE OBRA</span>
              <span style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.green}}>{costeMOTotal.toFixed(2)} €/{unidad||"ud"}</span>
            </div>
          )}
        </Card>

        {/* MATERIAS */}
        <Card style={{marginBottom:14}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text,marginBottom:4}}>ESCANDALLO DE MATERIAS — por capas</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Teórico = {mFinales||"?"} m finales × nº capas ÷ rendimiento × precio</div>
          {ma.map(x=>{
            const m = mps.find(z=>z.id===x.mp_id);
            const cst = costeMatLinea(x.capas, x.precio_ud||0, x.rendimiento||100);
            return (
              <div key={x.mp_id} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{fontFamily:F.h,fontWeight:600,fontSize:16,color:C.text}}>{m?.nombre||"?"}</span>
                    <span style={{color:C.blue,fontSize:14,marginLeft:10,fontWeight:700}}>{x.capas} capa{x.capas>1?"s":""}</span>
                  </div>
                  <button onClick={()=>setMa(prev=>prev.filter(z=>z.mp_id!==x.mp_id))}
                    style={{background:"none",border:"none",color:C.red,fontSize:18,cursor:"pointer"}}>✕</button>
                </div>
                <div style={{fontSize:12.5,color:C.muted,marginTop:2}}>
                  {((parseFloat(mFinales)||0)*x.capas).toFixed(1)} m/ud · {x.precio_ud} €/m · rend. {x.rendimiento}%
                  <span style={{color:C.green,fontWeight:700,marginLeft:8}}>→ {cst.toFixed(3)} €/{unidad||"ud"}</span>
                </div>
              </div>
            );
          })}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginTop:12}}>
            <Sel value={selMp} onChange={onSelMp} placeholder="Materia prima…"
              options={mps.filter(m=>!ma.find(x=>x.mp_id===m.id)).map(m=>({value:m.id,label:m.nombre}))}/>
            <Field label="Capas" value={capas} onChange={setCapas} type="number" placeholder="1-4" min="1" step="1"/>
          </div>
          {selMp && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,alignItems:"end"}}>
              <Field label="Precio (€/m)" value={precioMp} onChange={setPrecioMp} type="number" placeholder="0.09" min="0" step="0.001"/>
              <Field label="Rendimiento (%)" value={rendMp} onChange={setRendMp} type="number" placeholder="85" min="1" step="1"/>
              <button onClick={addMp} style={{background:C.accent,border:"none",color:"#fff",borderRadius:11,padding:"13px 18px",fontFamily:F.h,fontWeight:700,fontSize:17,cursor:"pointer",marginBottom:14}}>＋</button>
            </div>
          )}
          {ma.length>0 && (
            <div style={{marginTop:10,paddingTop:10,borderTop:`1.5px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontFamily:F.h,fontWeight:700,fontSize:14,color:C.text}}>COSTE OBJETIVO MATERIA PRIMA</span>
              <span style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.green}}>{costeMPTotal.toFixed(2)} €/{unidad||"ud"}</span>
            </div>
          )}
        </Card>

        {/* RESUMEN DE COSTE OBJETIVO */}
        <Card style={{marginBottom:14,background:C.blueBg,border:`1.5px solid ${C.blue}`}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.blue,marginBottom:10}}>💶 COSTE OBJETIVO DE PRODUCTO FINAL</div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:14}}>
            <span style={{color:C.text}}>Materia prima</span><span style={{fontWeight:700,color:C.text}}>{costeMPTotal.toFixed(2)} €</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:14}}>
            <span style={{color:C.text}}>Mano de obra</span><span style={{fontWeight:700,color:C.text}}>{costeMOTotal.toFixed(2)} €</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:`1px solid ${C.blue}55`,marginTop:6}}>
            <span style={{fontFamily:F.h,fontWeight:800,fontSize:15,color:C.blue}}>TOTAL CALCULADO</span>
            <span style={{fontFamily:F.h,fontWeight:800,fontSize:18,color:C.blue}}>{costeCalculado.toFixed(2)} €/{unidad||"ud"}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end",marginTop:10}}>
            <Field label="Coste objetivo a guardar (€/ud)" value={coste} onChange={setCoste} type="number" placeholder="3.50" min="0" step="0.01"/>
            {costeCalculado>0 && <button onClick={()=>setCoste(costeCalculado.toFixed(2))}
              style={{background:"#fff",border:`1.5px solid ${C.blue}`,color:C.blue,borderRadius:11,padding:"12px 14px",fontFamily:F.h,fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:14,whiteSpace:"nowrap"}}>
              ↧ Usar calculado
            </button>}
          </div>
          {pv>0 && costeFinal>0 && (
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"#fff",borderRadius:10,marginTop:4}}>
              <span style={{fontSize:13,color:C.muted}}>Margen vs. venta ({pv.toFixed(2)} €)</span>
              <span style={{fontFamily:F.h,fontWeight:800,fontSize:15,color:margenPct>=25?C.green:margenPct>=10?C.accent:C.red}}>
                {(pv-costeFinal).toFixed(2)} € · {margenPct.toFixed(0)}%
              </span>
            </div>
          )}
        </Card>
        <Btn onClick={guardar}>💾 Guardar Producto</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COSTES FIJOS
// ═══════════════════════════════════════════════════════════════════════════════
function CostesScreen({ onBack, centros }) {
  const [cfg] = useCol("config_costes");
  const [sel, setSel] = useState("");
  const [amort, setAmort] = useState("");
  const [alquiler, setAlquiler] = useState("");
  const [luz, setLuz] = useState("");
  const [horas, setHoras] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(()=>{
    if (!sel && centros.length) setSel(centros[0].id);
  },[centros.length]);
  useEffect(()=>{
    const c = cfg.find(x=>x.id===sel);
    setAmort(c?.amortizacion_mes?.toString()||"");
    setAlquiler(c?.alquiler_mes?.toString()||"");
    setLuz(c?.luz_agua_mes?.toString()||"");
    setHoras(c?.horas_persona_mes?.toString()||"");
  },[sel, cfg.length]);

  const total = (parseFloat(amort)||0)+(parseFloat(alquiler)||0)+(parseFloat(luz)||0);
  const guardar = async () => {
    if (!sel) return;
    await save("config_costes", sel, {
      amortizacion_mes:parseFloat(amort)||0, alquiler_mes:parseFloat(alquiler)||0,
      luz_agua_mes:parseFloat(luz)||0, fijos_mensuales:total,
      horas_persona_mes:parseFloat(horas)||0,
    });
    setMsg("Guardado"); setTimeout(()=>setMsg(null),2000);
  };
  const costeHoraFijo = total&&horas ? (total/parseFloat(horas)).toFixed(2) : null;
  const centroSel = centros.find(x=>x.id===sel);
  const cargada = costeHoraFijo && centroSel?.tarifa_mo ? (parseFloat(costeHoraFijo)+centroSel.tarifa_mo).toFixed(2) : null;
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="COSTES FIJOS POR CENTRO" onBack={onBack} sub="Cada centro reparte sus fijos por hora trabajada"/>
      <div style={{padding:14}}>
        {msg && <Toast msg={msg}/>}
        <Sel label="Centro" value={sel} onChange={setSel} placeholder="Seleccionar centro…"
          options={centros.map(c=>({value:c.id,label:`🏭 ${c.nombre}`}))}/>
        {sel && <>
          <Card style={{marginBottom:14}}>
            <Field label="Amortización maquinaria (€/mes)" value={amort} onChange={setAmort} type="number" placeholder="Ej: 2431 (350.000÷12 años÷12)" min="0" step="1"/>
            <Field label="Alquiler nave (€/mes)" value={alquiler} onChange={setAlquiler} type="number" placeholder="Ej: 1200" min="0" step="1"/>
            <Field label="Luz + agua (€/mes)" value={luz} onChange={setLuz} type="number" placeholder="Ej: 900" min="0" step="1"/>
            <Field label="Horas-persona trabajadas / mes" value={horas} onChange={setHoras} type="number" placeholder="Ej: 1848 (11 operarios × 168 h)" min="1"/>
            {costeHoraFijo && (
              <div style={{background:C.card2,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:13,color:C.muted}}>Estructura: {total.toFixed(0)} €/mes ÷ {horas} h</div>
                <span style={{fontSize:14,color:C.muted}}>Estructura por hora-persona: </span>
                <span style={{fontFamily:F.h,fontWeight:800,fontSize:20,color:C.blue}}>{costeHoraFijo} €/h</span>
                {cargada && <div style={{marginTop:4,fontSize:14,color:C.muted}}>Tarifa cargada del centro (MO {centroSel.tarifa_mo} + estructura): <span style={{fontFamily:F.h,fontWeight:800,fontSize:18,color:C.text}}>{cargada} €/h</span></div>}
              </div>
            )}
          </Card>
          <Btn onClick={guardar}>💾 Guardar</Btn>
        </>}
        {/* Resumen de todos los centros */}
        {cfg.length>0 && (
          <Card style={{marginTop:14}}>
            <div style={{fontFamily:F.h,fontWeight:700,fontSize:14,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Resumen</div>
            {centros.map(c=>{
              const x = cfg.find(z=>z.id===c.id);
              if (!x) return null;
              const ch = x.horas_persona_mes ? (x.fijos_mensuales/x.horas_persona_mes).toFixed(2) : "—";
              return (
                <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:14,color:C.text,fontFamily:F.h,fontWeight:600}}>🏭 {c.nombre}</span>
                  <span style={{fontSize:14,color:C.muted}}>{x.fijos_mensuales}€/mes → <span style={{color:C.accent,fontWeight:700}}>{ch}€/h</span></span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME (menú por rol)
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// PLANIFICACIÓN — plan mensual → recursos → organizador → cuadre → cierre semanal
// ═══════════════════════════════════════════════════════════════════════════════
function PlanificacionScreen({ onBack, perfil, productos, mps, producciones }) {
  const [tab, setTab] = useState("mes");
  const [periodo, setPeriodo] = useState(periodoActual());
  const semanas = semanasDeMes(periodo);
  const semanaHoy = isoWeek(new Date().toISOString().slice(0,10));
  const [semana, setSemana] = useState(semanas.includes(semanaHoy) ? semanaHoy : semanas[0]);
  useEffect(()=>{ const ss = semanasDeMes(periodo); if(!ss.includes(semana)) setSemana(ss[0]); },[periodo]);

  const [planesMes]  = useCol("planes_mes");
  const [planesSem]  = useCol("planes_semana");
  const planMes = planesMes.find(p => p.id === periodo) || { items: [] };
  const planSem = planesSem.find(p => p.id === semana) || { items: [], slots_disponibles: SLOTS_DIA*5 };

  const guardarMes = (data) => save("planes_mes", periodo, { periodo, ...data });
  const guardarSem = (data) => save("planes_semana", semana, { semana, periodo, ...data });

  const TABS = [["mes","📅 Mes"],["semana","🗓️ Semana"],["cierre","🔒 Cierre"]];

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:40}}>
      <Header title="PLANIFICACIÓN" onBack={onBack} sub={nombreMes(periodo)}/>
      <div style={{display:"flex",gap:6,padding:"10px 12px",background:C.navy,position:"sticky",top:0,zIndex:9}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{flex:1,background:tab===k?"#fff":"rgba(255,255,255,0.12)",color:tab===k?C.navy:"#fff",
              border:"none",borderRadius:10,padding:"11px 4px",fontFamily:F.h,fontWeight:800,fontSize:13,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{padding:12,maxWidth:900,margin:"0 auto"}}>
        {tab==="mes" && <PlanMesTab periodo={periodo} setPeriodo={setPeriodo} plan={planMes} guardar={guardarMes}
          productos={productos} mps={mps} semanas={semanas} planesSem={planesSem}/>}
        {tab==="semana" && <PlanSemanaTab semana={semana} setSemana={setSemana} semanas={semanas} plan={planSem}
          guardar={guardarSem} productos={productos} mps={mps} perfil={perfil}/>}
        {tab==="cierre" && <CierreSemanaTab semana={semana} setSemana={setSemana} semanas={semanas} plan={planSem}
          guardar={guardarSem} productos={productos} mps={mps} producciones={producciones} perfil={perfil}/>}
      </div>
    </div>
  );
}

// ── Tarjeta reutilizable de recursos ───────────────────────────────────────────
const RecursosCard = ({ r, mps, dias, titulo="Recursos necesarios" }) => (
  <Card style={{marginBottom:12}}>
    <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>🧮 {titulo}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
      {[[num(r.uds),"Unidades"],
        [r.slots.toFixed(1),"Turnos-línea"],
        [Math.ceil(r.personaTurnos/(dias||1)/1)+" p","Personas/día medio"],
        [eur(r.coste),"Coste objetivo"]].map(([v,l],i)=>(
        <div key={i} style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
          <div style={{fontFamily:F.h,fontWeight:900,fontSize:20,color:C.text}}>{v}</div>
          <div style={{fontSize:10.5,color:C.mutedD,marginTop:2}}>{l}</div>
        </div>
      ))}
    </div>
    <div style={{fontSize:12.5,color:C.mutedD,lineHeight:1.7,borderTop:`1px solid ${C.border}`,paddingTop:9}}>
      Materia prima <b style={{color:C.text}}>{eur(r.costeMP)}</b> · Mano de obra <b style={{color:C.text}}>{eur(r.costeMO)}</b>
    </div>
    {Object.keys(r.materias).length>0 && (
      <div style={{marginTop:9,borderTop:`1px solid ${C.border}`,paddingTop:9}}>
        <div style={{fontSize:11,color:C.mutedD,fontWeight:800,textTransform:"uppercase",letterSpacing:0.4,marginBottom:6}}>📦 Materias primas</div>
        {Object.entries(r.materias).sort((a,b)=>b[1]-a[1]).map(([id,m])=>{
          const mp = mps.find(x=>x.id===id);
          const madejas = m/((mp?.metros_madeja)||90);
          return (
            <div key={id} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0"}}>
              <span style={{color:C.text}}>{mp?.nombre||"?"}</span>
              <span style={{fontWeight:700,color:C.text}}>{num(m)} m <span style={{color:C.muted,fontWeight:400}}>· {num(madejas)} madejas</span></span>
            </div>
          );
        })}
      </div>
    )}
    {r.sinRitmo.length>0 && (
      <div style={{marginTop:10,background:C.redBg,border:`1.5px solid ${C.red}`,borderRadius:10,padding:"10px 12px"}}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:13,color:C.red,marginBottom:3}}>⚠️ Sin ritmo definido</div>
        <div style={{fontSize:12.5,color:C.red,lineHeight:1.6}}>{r.sinRitmo.join(" · ")}</div>
        <div style={{fontSize:11.5,color:C.mutedD,marginTop:5}}>No cuentan para los recursos. Ponles "uds por turno-línea" en su ficha de producto.</div>
      </div>
    )}
  </Card>
);

// ── Editor de líneas del plan ──────────────────────────────────────────────────
const ItemsEditor = ({ items, setItems, productos, bloqueado }) => {
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("");
  const add = () => {
    if (!pid || !(parseFloat(qty)>0)) { window.alert("Elige producto y cantidad"); return; }
    if (items.some(i=>i.producto_id===pid)) { window.alert("Ese producto ya está en el plan. Edita su cantidad."); return; }
    setItems([...items, { id: uid(), producto_id: pid, cantidad: parseFloat(qty) }]);
    setPid(""); setQty("");
  };
  return (
    <Card style={{marginBottom:12}}>
      <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>📋 Qué fabricar</div>
      {items.length===0 && <div style={{fontSize:13,color:C.muted,padding:"6px 0 12px"}}>Todavía no hay nada planificado.</div>}
      {items.map(it=>{
        const p = productos.find(x=>x.id===it.producto_id);
        const ritmo = parseFloat(p?.uds_turno_linea)||0;
        const pers = parseInt(p?.personas_linea)||3;
        const turnos = ritmo>0 ? (it.cantidad/ritmo)*(pers/3) : 0;
        return (
          <div key={it.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:`1px solid ${C.card2}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:F.h,fontWeight:700,fontSize:14.5,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p?.nombre||"(producto borrado)"}</div>
              <div style={{fontSize:11.5,color:C.mutedD,marginTop:1}}>
                {ritmo>0 ? `${turnos.toFixed(1)} turnos-línea · ${pers}p` : "⚠️ sin ritmo"}
              </div>
            </div>
            <input type="number" value={it.cantidad} disabled={bloqueado}
              onChange={e=>setItems(items.map(x=>x.id===it.id?{...x,cantidad:parseFloat(e.target.value)||0}:x))}
              style={{width:82,padding:"9px 8px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:15,fontFamily:F.h,fontWeight:700,textAlign:"right",background:"#fff",color:C.text}}/>
            {!bloqueado && <IconBtn danger onClick={()=>setItems(items.filter(x=>x.id!==it.id))}>🗑️</IconBtn>}
          </div>
        );
      })}
      {!bloqueado && (
        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          <ProductoBuscador label="Añadir producto" value={pid} onChange={setPid} productos={productos}/>
          <div style={{display:"flex",gap:8}}>
            <input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Unidades"
              style={{flex:1,padding:"13px 14px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:15,fontFamily:F.b,background:"#fff",color:C.text}}/>
            <button onClick={add} style={{background:C.accent,color:"#fff",border:"none",borderRadius:12,padding:"13px 22px",fontFamily:F.h,fontWeight:800,fontSize:15,cursor:"pointer"}}>+ Añadir</button>
          </div>
        </div>
      )}
    </Card>
  );
};

// ── TAB 1: PLAN MENSUAL ────────────────────────────────────────────────────────
function PlanMesTab({ periodo, setPeriodo, plan, guardar, productos, mps, semanas, planesSem }) {
  const items = plan.items || [];
  const setItems = (v) => guardar({ items: v });
  const dias = diasLaborablesMes(periodo).length;
  const capacidad = dias * SLOTS_DIA;
  const r = calcRecursos(items, productos);
  const ocupacion = capacidad>0 ? r.slots/capacidad : 0;
  const estado = ocupacion > 1.001 ? "falta" : ocupacion < 0.95 ? "sobra" : "ok";
  const col = estado==="ok"?C.green:estado==="falta"?C.red:C.amber;
  const bg  = estado==="ok"?C.greenBg:estado==="falta"?C.redBg:C.amberBg;

  const repartir = async () => {
    if (items.length===0) { window.alert("No hay nada que repartir"); return; }
    const yaCerradas = semanas.filter(s => planesSem.find(p=>p.id===s)?.cerrado_plan);
    const libres = semanas.filter(s => !yaCerradas.includes(s));
    if (libres.length===0) { window.alert("Todas las semanas del mes están cerradas"); return; }
    if (!window.confirm(`Repartir el plan entre ${libres.length} semana(s) a partes iguales.\n\nSe sobrescribe lo que haya en esas semanas. ¿Seguir?`)) return;
    for (const s of libres) {
      const its = items.map(it => ({ id: uid(), producto_id: it.producto_id, cantidad: Math.round((it.cantidad/libres.length)*10)/10 }));
      await save("planes_semana", s, { semana: s, periodo, items: its, slots_disponibles: SLOTS_DIA*5, cerrado_plan: false, desde_plan_mes: true });
    }
    window.alert("Repartido. Revísalo y cuádralo en la pestaña Semana.");
  };

  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <button onClick={()=>setPeriodo(sumaPeriodo(periodo,-1))} style={{background:"#fff",border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 16px",fontSize:17,fontWeight:800,color:C.text,cursor:"pointer"}}>‹</button>
        <div style={{flex:1,textAlign:"center",fontFamily:F.h,fontWeight:800,fontSize:17,color:C.text,textTransform:"capitalize"}}>{nombreMes(periodo)}</div>
        <button onClick={()=>setPeriodo(sumaPeriodo(periodo,1))} style={{background:"#fff",border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 16px",fontSize:17,fontWeight:800,color:C.text,cursor:"pointer"}}>›</button>
      </div>

      <ItemsEditor items={items} setItems={setItems} productos={productos}/>
      <RecursosCard r={r} mps={mps} dias={dias} titulo="Recursos del mes"/>

      <Card style={{marginBottom:12}} color={col+"66"}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>⚖️ Capacidad del mes</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:C.text}}>{r.slots.toFixed(0)}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Necesito</div>
          </div>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:C.text}}>{capacidad}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Tengo ({dias} días × {SLOTS_DIA})</div>
          </div>
        </div>
        <div style={{height:10,background:C.card2,borderRadius:5,overflow:"hidden",marginBottom:10}}>
          <div style={{width:Math.min(100,ocupacion*100)+"%",height:"100%",background:col,borderRadius:5}}/>
        </div>
        <div style={{background:bg,border:`1.5px solid ${col}`,borderRadius:10,padding:"11px 13px",fontSize:13.5,color:col,fontFamily:F.h,fontWeight:700,lineHeight:1.5}}>
          {estado==="ok" && `✔ Cuadrado — ${Math.round(ocupacion*100)}% de ocupación`}
          {estado==="falta" && `⛔ Falta capacidad — te sobran ${(r.slots-capacidad).toFixed(1)} turnos-línea de trabajo`}
          {estado==="sobra" && `⚠️ Sobra capacidad — quedan ${(capacidad-r.slots).toFixed(1)} turnos-línea libres. Mete más producción.`}
        </div>
      </Card>

      <Btn onClick={repartir} v="ghost">📤 Repartir en las {semanas.length} semanas del mes</Btn>
    </>
  );
}

// ── TAB 2: PLAN SEMANAL + CUADRE ───────────────────────────────────────────────
function PlanSemanaTab({ semana, setSemana, semanas, plan, guardar, productos, mps, perfil }) {
  const items = plan.items || [];
  const bloqueado = !!plan.cerrado_plan;
  const setItems = (v) => guardar({ items: v });
  const dispo = plan.slots_disponibles ?? SLOTS_DIA*5;
  const r = calcRecursos(items, productos);
  const dif = r.slots - dispo;
  const estado = dif > 0.2 ? "falta" : dif < -0.5 ? "sobra" : "ok";
  const col = estado==="ok"?C.green:estado==="falta"?C.red:C.amber;
  const bg  = estado==="ok"?C.greenBg:estado==="falta"?C.redBg:C.amberBg;

  const cerrarPlan = async () => {
    if (items.length===0) { window.alert("No hay nada planificado"); return; }
    if (estado!=="ok") {
      const msg = estado==="falta"
        ? `El plan NO cuadra: necesitas ${r.slots.toFixed(1)} turnos-línea y tienes ${dispo}.`
        : `El plan NO cuadra: te sobran ${(-dif).toFixed(1)} turnos-línea sin producción asignada.`;
      const motivo = window.prompt(msg + "\n\nPuedes cerrarlo igualmente, pero el desfase saldrá en el informe al CEO.\nEscribe el motivo para forzar el cierre (o Cancelar):");
      if (!motivo || !motivo.trim()) return;
      await guardar({ cerrado_plan:true, forzado:true, motivo_forzado:motivo.trim(), slots_plan:r.slots, slots_dispo:dispo,
        coste_objetivo:r.coste, uds_objetivo:r.uds, cerrado_por:perfil?.nombre||"", cerrado_at:new Date().toISOString() });
      return;
    }
    await guardar({ cerrado_plan:true, forzado:false, motivo_forzado:"", slots_plan:r.slots, slots_dispo:dispo,
      coste_objetivo:r.coste, uds_objetivo:r.uds, cerrado_por:perfil?.nombre||"", cerrado_at:new Date().toISOString() });
  };

  return (
    <>
      <SelectorSemana semana={semana} setSemana={setSemana} semanas={semanas}/>

      {bloqueado && (
        <div style={{background:plan.forzado?C.amberBg:C.greenBg,border:`1.5px solid ${plan.forzado?C.amber:C.green}`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:plan.forzado?C.amber:C.green}}>
            {plan.forzado?"⚠️ Plan cerrado forzando el cuadre":"🔒 Plan cerrado y cuadrado"}
          </div>
          {plan.forzado && <div style={{fontSize:12.5,color:C.mutedD,marginTop:4,lineHeight:1.5}}>Motivo: {plan.motivo_forzado}</div>}
          <button onClick={()=>{ if(window.confirm("¿Reabrir el plan de esta semana?")) guardar({cerrado_plan:false}); }}
            style={{background:"#fff",border:`1px solid ${C.border}`,color:C.mutedD,borderRadius:10,padding:"7px 14px",fontSize:12.5,fontWeight:700,cursor:"pointer",marginTop:8}}>↺ Reabrir</button>
        </div>
      )}

      <ItemsEditor items={items} setItems={setItems} productos={productos} bloqueado={bloqueado}/>
      <RecursosCard r={r} mps={mps} dias={5} titulo="Recursos de la semana"/>

      <Card style={{marginBottom:12}} color={col+"66"}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>⚖️ Cuadre</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:24,color:C.text}}>{r.slots.toFixed(1)}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Necesito</div>
          </div>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:24,color:C.text}}>{dispo}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Tengo</div>
          </div>
        </div>
        {!bloqueado && (
          <div style={{marginBottom:12}}>
            <div style={{fontFamily:F.h,fontWeight:700,fontSize:12,color:C.mutedD,marginBottom:6}}>TURNOS-LÍNEA DISPONIBLES ESTA SEMANA</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>guardar({slots_disponibles:Math.max(0,dispo-1)})} style={{width:52,height:52,borderRadius:12,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>−</button>
              <div style={{flex:1,height:52,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12,background:C.card2,fontFamily:F.h,fontWeight:900,fontSize:26,color:C.text}}>{dispo}</div>
              <button onClick={()=>guardar({slots_disponibles:dispo+1})} style={{width:52,height:52,borderRadius:12,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>+</button>
            </div>
            <div style={{fontSize:11.5,color:C.mutedD,marginTop:6,lineHeight:1.5}}>Semana completa = {SLOTS_DIA*5} ({LINEAS_FISICAS} líneas × {TURNOS_ABIERTOS} turnos × 5 días). Baja el número por bajas, vacaciones o festivos.</div>
          </div>
        )}
        <div style={{background:bg,border:`1.5px solid ${col}`,borderRadius:10,padding:"11px 13px",fontSize:13.5,color:col,fontFamily:F.h,fontWeight:700,lineHeight:1.5}}>
          {estado==="ok" && "✔ Cuadra. Puedes cerrar el plan."}
          {estado==="falta" && `⛔ Faltan ${dif.toFixed(1)} turnos-línea. Quita producción o suma gente.`}
          {estado==="sobra" && `⚠️ Sobran ${(-dif).toFixed(1)} turnos-línea. Mete más producción.`}
        </div>
      </Card>

      {!bloqueado && <Btn onClick={cerrarPlan} v={estado==="ok"?"primary":"secondary"}>
        {estado==="ok" ? "🔒 Cerrar plan de la semana" : "🔒 Cerrar forzando (pedirá motivo)"}
      </Btn>}
    </>
  );
}

const SelectorSemana = ({ semana, setSemana, semanas }) => (
  <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:12}}>
    {semanas.map(s=>(
      <button key={s} onClick={()=>setSemana(s)}
        style={{flexShrink:0,background:semana===s?C.accent:"#fff",color:semana===s?"#fff":C.mutedD,
          border:`1.5px solid ${semana===s?C.accent:C.border}`,borderRadius:12,padding:"10px 14px",
          fontFamily:F.h,fontWeight:700,fontSize:13,cursor:"pointer"}}>
        <div>{s.split("-W")[1]}</div>
        <div style={{fontSize:10.5,opacity:0.75,fontWeight:600}}>{rotuloSemana(s)}</div>
      </button>
    ))}
  </div>
);

// ── TAB 3: CIERRE SEMANAL ──────────────────────────────────────────────────────
function CierreSemanaTab({ semana, setSemana, semanas, plan, guardar, productos, mps, producciones, perfil }) {
  const items = plan.items || [];
  const dias = diasDeSemana(semana);
  const partes = producciones.filter(p => dias.includes(p.fecha));

  const mpPrecio = (id) => parseFloat(mps.find(m=>m.id===id)?.precio_ud)||0;
  const costeRealParte = (p) => {
    const mat = (p.consumos||[]).reduce((s,cs)=>s+(parseFloat(cs.metros_consumidos)||0)*mpPrecio(cs.materia_id),0);
    const mo  = (parseInt(p.n_personas)||3)*(parseFloat(p.horas_equipo)||8)*TARIFA_MO;
    return { mat, mo };
  };

  const ids = [...new Set([...items.map(i=>i.producto_id), ...partes.map(p=>p.producto_id)])];
  const filas = ids.map(pid => {
    const prod = productos.find(x=>x.id===pid);
    const it = items.find(i=>i.producto_id===pid);
    const ps = partes.filter(p=>p.producto_id===pid);
    const udsObj = it ? (parseFloat(it.cantidad)||0) : 0;
    const udsReal = ps.reduce((s,p)=>s+(parseFloat(p.cantidad)||0),0);
    const ritmo = parseFloat(prod?.uds_turno_linea)||0;
    const pers = parseInt(prod?.personas_linea)||3;
    const turnosObj = ritmo>0 ? udsObj/ritmo : 0;
    const cObjMP = (parseFloat(prod?.coste_mp_objetivo)||0)*udsObj;
    const cObjMO = turnosObj*pers*8*TARIFA_MO;
    let cRealMP=0, cRealMO=0;
    ps.forEach(p=>{ const c=costeRealParte(p); cRealMP+=c.mat; cRealMO+=c.mo; });
    const ritmoReal = ps.length>0 ? udsReal/ps.length : 0;
    return { pid, nombre:prod?.nombre||"?", udsObj, udsReal, cObjMP, cObjMO, cRealMP, cRealMO,
      cObj:cObjMP+cObjMO, cReal:cRealMP+cRealMO, ritmo, ritmoReal, partes:ps.length };
  }).sort((a,b)=>b.cReal-a.cReal);

  const T = filas.reduce((a,f)=>({udsObj:a.udsObj+f.udsObj,udsReal:a.udsReal+f.udsReal,
    cObj:a.cObj+f.cObj,cReal:a.cReal+f.cReal,
    dMP:a.dMP+(f.cRealMP-f.cObjMP),dMO:a.dMO+(f.cRealMO-f.cObjMO)}),
    {udsObj:0,udsReal:0,cObj:0,cReal:0,dMP:0,dMO:0});
  const cumpl = T.udsObj>0 ? T.udsReal/T.udsObj : 0;
  const desvio = T.cReal - T.cObj;

  const pendientes = filas.filter(f=>f.udsObj-f.udsReal > 0.5);
  const cerrado = !!plan.cerrado_cierre;

  const arrastrar = async () => {
    if (pendientes.length===0) { window.alert("No queda nada pendiente"); return; }
    const idx = semanas.indexOf(semana);
    const sig = semanas[idx+1];
    if (!sig) { window.alert("No hay semana siguiente dentro de este mes. Cambia de mes y añádelo a mano."); return; }
    const lista = pendientes.map(f=>`· ${f.nombre}: ${num(f.udsObj-f.udsReal)} uds`).join("\n");
    if (!window.confirm(`Arrastrar a la semana ${sig.split("-W")[1]}:\n\n${lista}\n\n¿Seguir?`)) return;
    const ref = await getDocs(collection(db,"planes_semana"));
    const doc0 = ref.docs.find(d=>d.id===sig);
    const prev = doc0?.data()?.items || [];
    const merged = [...prev];
    pendientes.forEach(f=>{
      const ex = merged.find(x=>x.producto_id===f.pid);
      if (ex) ex.cantidad = (parseFloat(ex.cantidad)||0) + (f.udsObj-f.udsReal);
      else merged.push({ id:uid(), producto_id:f.pid, cantidad: f.udsObj-f.udsReal });
    });
    await save("planes_semana", sig, { semana:sig, items:merged, cerrado_plan:false, con_arrastre:true });
    window.alert("Arrastrado. Revisa el cuadre de esa semana.");
  };

  const actualizarRitmo = async (f) => {
    if (!(f.ritmoReal>0)) return;
    if (!window.confirm(`Poner el ritmo estándar de ${f.nombre} en ${f.ritmoReal.toFixed(0)} uds por turno-línea?\n\nAhora está en ${f.ritmo||"—"}.`)) return;
    await save("productos", f.pid, { uds_turno_linea: Math.round(f.ritmoReal) });
  };

  const correo = () => {
    const L = [];
    L.push(`CIERRE SEMANA ${semana.split("-W")[1]} (${rotuloSemana(semana)})`);
    L.push("");
    L.push(`Unidades: ${num(T.udsReal)} de ${num(T.udsObj)} objetivo (${Math.round(cumpl*100)}%)`);
    L.push(`Coste: ${eur(T.cReal)} real frente a ${eur(T.cObj)} objetivo`);
    L.push(`Desvio: ${desvio>=0?"+":""}${eur(desvio)} (materia ${T.dMP>=0?"+":""}${eur(T.dMP)} / mano de obra ${T.dMO>=0?"+":""}${eur(T.dMO)})`);
    if (plan.forzado) L.push(`AVISO: el plan se cerro forzando el cuadre. Motivo: ${plan.motivo_forzado}`);
    L.push("");
    L.push("POR PRODUCTO");
    filas.forEach(f=>L.push(`${f.nombre}: ${num(f.udsReal)}/${num(f.udsObj)} uds · ${eur(f.cReal)} vs ${eur(f.cObj)} obj`));
    if (pendientes.length>0) {
      L.push("");
      L.push("PENDIENTE DE FABRICAR");
      pendientes.forEach(f=>L.push(`${f.nombre}: ${num(f.udsObj-f.udsReal)} uds`));
    }
    L.push("");
    L.push(`Cerrado por ${perfil?.nombre||""} · wikuk ${APP_VERSION}`);
    const body = encodeURIComponent(L.join("\n"));
    window.location.href = `mailto:?subject=${encodeURIComponent("Cierre semana "+semana.split("-W")[1]+" · Wikuk producción")}&body=${body}`;
  };

  return (
    <>
      <SelectorSemana semana={semana} setSemana={setSemana} semanas={semanas}/>

      {!plan.cerrado_plan && (
        <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:12,padding:"12px 14px",marginBottom:12,fontSize:13,color:C.amber,fontFamily:F.h,fontWeight:700,lineHeight:1.5}}>
          ⚠️ Esta semana no tiene el plan cerrado. El comparativo es solo orientativo.
        </div>
      )}

      <Card style={{marginBottom:12}}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>🎯 Objetivo frente a real</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{background:C.card2,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:cumpl>=1?C.green:C.amber}}>{num(T.udsReal)}<span style={{fontSize:14,color:C.muted}}>/{num(T.udsObj)}</span></div>
            <div style={{fontSize:10.5,color:C.mutedD,marginTop:2}}>Unidades ({Math.round(cumpl*100)}%)</div>
          </div>
          <div style={{background:C.card2,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:desvio<=0?C.green:C.red}}>{desvio>=0?"+":""}{eur(desvio)}</div>
            <div style={{fontSize:10.5,color:C.mutedD,marginTop:2}}>Desvío de coste</div>
          </div>
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,fontSize:13,lineHeight:1.9,color:C.mutedD}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>Coste objetivo</span><b style={{color:C.text}}>{eur(T.cObj)}</b></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>Coste real</span><b style={{color:C.text}}>{eur(T.cReal)}</b></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>· por rendimiento (materia)</span><b style={{color:T.dMP<=0?C.green:C.red}}>{T.dMP>=0?"+":""}{eur(T.dMP)}</b></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>· por productividad (horas)</span><b style={{color:T.dMO<=0?C.green:C.red}}>{T.dMO>=0?"+":""}{eur(T.dMO)}</b></div>
        </div>
      </Card>

      {filas.length===0 && <Empty icon="📭" text="Sin plan ni partes en esta semana"/>}

      {filas.map(f=>{
        const pct = f.udsObj>0 ? f.udsReal/f.udsObj : (f.udsReal>0?1:0);
        const dv = f.cReal - f.cObj;
        return (
          <Card key={f.pid} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:7}}>
              <b style={{fontFamily:F.h,fontSize:15,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nombre}</b>
              <span style={{fontFamily:F.h,fontWeight:900,fontSize:15,color:pct>=1?C.green:C.amber,flexShrink:0}}>{num(f.udsReal)}/{num(f.udsObj)}</span>
            </div>
            <div style={{height:7,background:C.card2,borderRadius:4,overflow:"hidden",marginBottom:9}}>
              <div style={{width:Math.min(100,pct*100)+"%",height:"100%",background:pct>=1?C.green:C.accent,borderRadius:4}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,color:C.mutedD}}>
              <span>Coste {eur(f.cReal)} <span style={{color:C.muted}}>vs {eur(f.cObj)}</span></span>
              <b style={{color:dv<=0?C.green:C.red}}>{dv>=0?"+":""}{eur(dv)}</b>
            </div>
            {f.partes>0 && (
              <div style={{marginTop:9,paddingTop:9,borderTop:`1px solid ${C.card2}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <div style={{fontSize:12.5,color:C.mutedD,lineHeight:1.5}}>
                  Ritmo real <b style={{color:C.text}}>{f.ritmoReal.toFixed(0)}</b> uds/turno · estándar <b style={{color:C.text}}>{f.ritmo||"—"}</b>
                </div>
                {Math.abs(f.ritmoReal-f.ritmo)>=1 && (
                  <button onClick={()=>actualizarRitmo(f)} style={{flexShrink:0,background:C.blueBg,border:`1px solid ${C.blue}44`,color:C.blue,borderRadius:10,padding:"7px 11px",fontSize:12,fontWeight:800,cursor:"pointer"}}>Actualizar</button>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {pendientes.length>0 && (
        <Card style={{marginBottom:12}} color={C.amber+"66"}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.amber,marginBottom:8}}>↪️ Pendiente de fabricar</div>
          {pendientes.map(f=>(
            <div key={f.pid} style={{display:"flex",justifyContent:"space-between",fontSize:13.5,padding:"5px 0"}}>
              <span style={{color:C.text}}>{f.nombre}</span><b style={{color:C.amber}}>{num(f.udsObj-f.udsReal)} uds</b>
            </div>
          ))}
          <div style={{marginTop:10}}><Btn v="secondary" onClick={arrastrar}>Arrastrar a la semana siguiente</Btn></div>
        </Card>
      )}

      <div style={{display:"grid",gap:9}}>
        <Btn v="ghost" onClick={correo}>✉️ Enviar informe por correo</Btn>
        {!cerrado
          ? <Btn onClick={()=>{ if(window.confirm("¿Cerrar la semana? Queda registrado el comparativo.")) guardar({cerrado_cierre:true, cierre_uds_real:T.udsReal, cierre_coste_real:T.cReal, cierre_desvio:desvio, cerrado_cierre_por:perfil?.nombre||"", cerrado_cierre_at:new Date().toISOString()}); }}>🔒 Cerrar la semana</Btn>
          : <div style={{background:C.greenBg,border:`1.5px solid ${C.green}`,borderRadius:12,padding:"12px 14px",fontFamily:F.h,fontWeight:800,fontSize:14,color:C.green,textAlign:"center"}}>
              ✔ Semana cerrada por {plan.cerrado_cierre_por||"—"}
            </div>}
      </div>
    </>
  );
}

function Home({ perfil, onGo, onLogout, counts, ordenes=[], producciones=[], productos=[] }) {
  const hoy = new Date().toISOString().slice(0,10);
  const partesHoy = producciones.filter(p=>p.fecha===hoy);
  const udsHoy = partesHoy.reduce((s,p)=>s+(p.cantidad||0),0);
  const activas = ordenes.filter(o=>!o.cerrada);
  const planHome = (o)=>{ if(o.plan_origen==="PROD"){ const pr=productos.find(p=>p.id===o.producto_id); return pr?.objetivo_diario||0; } return o.cantidad||0; };
  const planHoy = ordenes.filter(o=>o.fecha===hoy).reduce((s,o)=>s+planHome(o),0);
  const prodDe = (oid) => producciones.filter(p=>p.orden_id===oid).reduce((s,p)=>s+(p.cantidad||0),0);
  const verDash = perfil.rol!=="operario";
  const ultimaFecha = producciones.reduce((m,p)=>p.fecha>m?p.fecha:m,"");
  const esHoy = partesHoy.length>0;
  const fechaDash = esHoy ? hoy : ultimaFecha;
  const partesDash = esHoy ? partesHoy : producciones.filter(p=>p.fecha===ultimaFecha);
  const udsDash = partesDash.reduce((s,p)=>s+(p.cantidad||0),0);
  const planDash = ordenes.filter(o=>o.fecha===fechaDash).reduce((s,o)=>s+planHome(o),0);
  const fmtFecha = (f)=>{ try { return new Date(f+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"2-digit"}); } catch(e){ return f; } };
  const esGerencia = perfil.rol === "gerencia";
  const tiles = [
    { id:"planificacion", icon:"📅", bg:"#EEF2FF", label:"Planificación", sub:"Mes · semana · cuadre · cierre",     roles:["gerencia","sup_fabrica"] },
    { id:"ordenes",   icon:"📋", bg:"#ECFDF5", label:"Órdenes de Producción", sub:"Planificar y registrar",           roles:["gerencia","sup_fabrica","sup_oficina"] },
    { id:"diario",    icon:"📖", bg:"#EFF6FF", label:"Diario de Fabricación", sub:"El parte oficial del día",          roles:["gerencia","sup_fabrica","sup_oficina"] },
    { id:"analitica", icon:"📊", bg:"#FDF2F8", label:"Analítica",         sub:"Evolución · costes · lotes · equipos", roles:["gerencia","sup_fabrica"] },
    { id:"seed",      icon:"🚀", bg:"#FFF7ED", label:"Carga Inicial",     sub:"Catálogo completo en 1 clic",          roles:["gerencia"] },
    { id:"synccat",   icon:"🔗", bg:"#F5F3FF", label:"Sincronizar Catálogo", sub:"Descripciones desde el CRM",         roles:["gerencia"] },
    { id:"importhist",icon:"📥", bg:"#FFFBEB", label:"Importar Histórico", sub:"Excel maestro → Firebase",              roles:["gerencia"] },
    { id:"centros",   icon:"🏭", bg:"#EFF6FF", label:"Centros de Trabajo", sub:`${counts.centros} centros`,           roles:["gerencia"] },
    { id:"lineas",    icon:"⚙️", bg:"#F1F5F9", label:"Líneas de Producción", sub:`${counts.lineas} líneas`,            roles:["gerencia"] },
    { id:"usuarios",  icon:"👥", bg:"#F5F3FF", label:"Usuarios",          sub:`${counts.usuarios} registrados`,      roles:["gerencia"] },
    { id:"turnos",    icon:"🕐", bg:"#FFFBEB", label:"Turnos",            sub:`${counts.turnos} configurados`,        roles:["gerencia"] },
    { id:"procesos",  icon:"⚙️", bg:"#F1F5F9", label:"Procesos",          sub:`${counts.procesos} en catálogo`,       roles:["gerencia","sup_fabrica"] },
    { id:"mps",       icon:"📦", bg:"#F0FDF4", label:"Materias Primas",   sub:`${counts.mps} con objetivo`,           roles:["gerencia","sup_fabrica","sup_calidad"] },
    { id:"provs",     icon:"🚚", bg:"#EFF6FF", label:"Proveedores",       sub:`${counts.provs} activos`,              roles:["gerencia","sup_calidad"] },
    { id:"productos", icon:"🏷️", bg:"#FFFBEB", label:"Productos",         sub:`${counts.productos} con coste obj.`,   roles:["gerencia","sup_fabrica"] },
    { id:"motivos",   icon:"⏸", bg:"#FEF2F2", label:"Motivos de Paro",   sub:`${counts.motivos} configurados`,       roles:["gerencia","sup_fabrica"] },
    { id:"costes",    icon:"💰", bg:"#F0FDF4", label:"Costes Fijos",      sub:"Reparto por hora",                     roles:["gerencia"] },
  ].filter(t=>t.roles.includes(perfil.rol));

  return (
    <div style={{background:C.bg,minHeight:"100vh"}}>
      <div style={{background:C.navy,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:20,color:"#fff",letterSpacing:-0.3}}>wikuk <span style={{fontWeight:400,fontSize:13,color:"rgba(255,255,255,0.55)"}}>· Producción {APP_VERSION}</span></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13,color:"#fff",fontWeight:600,fontFamily:F.b}}>{perfil.nombre}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>{ROLES[perfil.rol]?.icon} {ROLES[perfil.rol]?.label}</div>
          </div>
          <button onClick={onLogout} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",fontFamily:F.h,fontWeight:600,fontSize:13,cursor:"pointer"}}>Salir</button>
        </div>
      </div>
      <div style={{padding:"14px 12px",maxWidth:900,margin:"0 auto"}}>
        <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:12,padding:"12px 16px",marginBottom:14}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:15,color:C.amber}}>🏭 FASE 2 — Órdenes y producción</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>Crea órdenes con nº OT y registra la producción diaria. Próximo: terminal de planta con paros y consumos por lote.</div>
        </div>
        {perfil.rol==="operario" && (
          <TerminalOperario perfil={perfil} productos={productos}/>
        )}
        {verDash && (activas.length>0 || producciones.length>0) && (
          <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:14,marginBottom:14,boxShadow:"0 1px 2px rgba(15,23,42,.04)"}}>
            <div style={{fontSize:11,color:C.mutedD,fontWeight:800,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10,display:"flex",justifyContent:"space-between"}}>
              <span>📅 {esHoy?"HOY":"ÚLTIMA JORNADA"} · {fmtFecha(fechaDash)}</span>
              <button onClick={()=>onGo("diario")} style={{background:"none",border:"none",color:C.blue,fontSize:11,fontWeight:800,cursor:"pointer"}}>Ver diario →</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[[activas.length,"Órdenes activas",C.accent],
                [planDash?`${udsDash}/${planDash}`:String(udsDash),(esHoy?"Uds hoy":"Uds ese día")+(planDash?" / plan":""),C.text],
                [planDash?Math.round(udsDash/planDash*100)+"%":"—","Del plan",planDash&&udsDash/planDash>=1?C.green:C.amber]].map(([n,l,col],i)=>(
                <div key={i} style={{background:C.card2,borderRadius:12,padding:"10px 6px",textAlign:"center"}}>
                  <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:col}}>{n}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
            {!esHoy && activas.length===0 && partesDash.slice(0,4).map(p2=>{
              const pr = productos.find(x=>x.id===p2.producto_id);
              return (
                <div key={p2.id} onClick={()=>onGo("diario")} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.card2}`,cursor:"pointer",fontSize:13}}>
                  <b style={{color:C.text}}>{pr?.nombre||"?"}</b>
                  <span style={{fontWeight:800,color:C.accent}}>{p2.cantidad} uds{p2.n_personas?` · ${p2.n_personas}p`:""}</span>
                </div>
              );
            })}
            {activas.slice(0,4).map(o=>{
              const p = productos.find(x=>x.id===o.producto_id);
              const hechas = prodDe(o.id);
              const pct = o.cantidad>0?Math.min(100,hechas/o.cantidad*100):0;
              return (
                <div key={o.id} onClick={()=>onGo("ordenes")} style={{padding:"9px 0",borderBottom:`1px solid ${C.card2}`,cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,gap:8}}>
                    <b style={{color:C.text}}>{o.numero?`OT ${o.numero} · `:""}{p?.nombre||"?"}</b>
                    <span style={{fontWeight:800,color:pct>=100?C.green:C.amber,flexShrink:0}}>{hechas}/{o.cantidad}{pct>=100?" ✓":""}</span>
                  </div>
                  <div style={{height:6,background:C.card2,borderRadius:3,overflow:"hidden",marginTop:4}}>
                    <div style={{width:pct+"%",height:"100%",background:pct>=100?C.green:C.accent,borderRadius:3}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!esGerencia && perfil.rol!=="operario" && tiles.length===0 && <Empty icon="⏳" text="Tu área estará disponible en la Fase 2"/>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:10}}>
          {tiles.map(t=>(
            <button key={t.id} onClick={()=>onGo(t.id)}
              style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",textAlign:"left",boxShadow:"0 1px 2px rgba(15,23,42,0.04)",animation:"fadeUp .3s ease"}}>
              <span style={{width:46,height:46,borderRadius:13,background:t.bg||C.blueBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:23,flexShrink:0}}>{t.icon}</span>
              <span style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:F.h,fontWeight:700,fontSize:16,color:C.text}}>{t.label}</div>
                <div style={{color:C.mutedD,fontSize:13,marginTop:2}}>{t.sub}</div>
              </span>
              <span style={{color:C.muted,fontSize:18}}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined=cargando
  const [noUsers, setNoUsers] = useState(false);
  const [view, setView] = useState("home");

  const [usuarios] = useCol("usuarios", "nombre");
  const [centros]  = useCol("centros", "nombre");
  const [lineas]   = useCol("lineas", "nombre");
  const [motivos]  = useCol("motivos_paro", "nombre");
  const [turnos]   = useCol("turnos");
  const [procesos] = useCol("procesos", "nombre");
  const [mps]      = useCol("materias_primas", "nombre");
  const [provs]    = useCol("proveedores", "nombre");
  const [productos]= useCol("productos", "nombre");
  const [ordenesRoot] = useCol("ordenes");
  const [produccionesRoot] = useCol("producciones");
  useEffect(() => {
    // Migración automática: la Carga Inicial v1 guardó materias en colección "materias" (nombre erróneo)
    if (!authUser) return;
    (async () => {
      try {
        const dst = await getDocs(collection(db, "materias_primas"));
        if (!dst.empty) return;
        const src = await getDocs(collection(db, "materias"));
        if (src.empty) return;
        for (const d of src.docs) await setDoc(doc(db, "materias_primas", d.id), d.data());
        console.log("Migradas", src.size, "materias");
      } catch(e) { console.warn("migración materias:", e.message); }
    })();
  }, [authUser]);

  const [bootSlow, setBootSlow] = useState(false);
  const [diag, setDiag] = useState(null);
  useEffect(() => onAuthStateChanged(auth, u => setAuthUser(u)), []);
  useEffect(() => { const t = setTimeout(()=>setBootSlow(true), 8000); return ()=>clearTimeout(t); }, []);
  useEffect(() => {
    if (!bootSlow || authUser!==undefined) return;
    const test = async (url) => { try { const r = await fetch(url); return r.ok || r.status===400 || r.status===403; } catch(e){ return false; } };
    (async()=>{
      const fs = await test("https://firestore.googleapis.com/v1/projects/wikuk-produccion/databases/(default)/documents/centros?pageSize=1");
      const au = await test("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=AIzaSyAwuxF2MYzBjQhr9pD4d2pPSq9_8n65_hA");
      setDiag({fs, au});
    })();
  }, [bootSlow]);
  useEffect(() => {
    // Bootstrap: ¿existe algún usuario?
    getDocs(collection(db, "usuarios")).then(s => setNoUsers(s.empty)).catch(()=>{});
  }, [authUser]);

  const perfil = authUser ? usuarios.find(u => u.id === authUser.uid) : null;

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&display=swap');
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0;color-scheme:light;}
    html,body,#root{background:#F8FAFC!important;color:#0F172A!important;width:100%;min-height:100vh;overscroll-behavior:none;}
    input,select,textarea{background:#fff!important;color:#0F172A!important;font-family:inherit;}
    select option{background:#fff!important;color:#0F172A!important;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  `;

  if (authUser === undefined) return (
    <div style={{fontFamily:F.b}}><style>{STYLES}</style>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:14,padding:24}}>
        <div style={{fontFamily:F.h,fontSize:20,color:C.muted}}>{bootSlow?"Sin respuesta del servidor":"Cargando…"} <span style={{fontSize:12,opacity:0.5}}>{APP_VERSION}</span></div>
        {bootSlow && <>
          <div style={{fontSize:14,color:C.muted,textAlign:"center",lineHeight:1.8,maxWidth:340}}>
            {diag===null && "Diagnosticando conexión…"}
            {diag && <>
              <div>Base de datos: {diag.fs?"✅ conecta":"❌ bloqueada"}</div>
              <div>Servidor de login: {diag.au?"✅ conecta":"❌ bloqueado"}</div>
              <div style={{marginTop:8,fontSize:13}}>
                {!diag.au && diag.fs && "Tu red o un bloqueador (ad-block, DNS privado tipo AdGuard, VPN) está cortando el servidor de login de Google. Desactívalo o cambia de red."}
                {!diag.fs && "Sin salida a los servidores de Google. Cambia de red (wifi ↔ datos)."}
                {diag.fs && diag.au && "Los servidores responden pero la sesión local está atascada. Pulsa Entrar igualmente, o borra los DATOS del sitio (ⓘ junto a la URL → Configuración de sitios → Borrar datos)."}
              </div>
            </>}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
            <button onClick={()=>window.location.reload()} style={{background:"#e06000",border:"none",color:"#fff",borderRadius:12,padding:"12px 28px",fontFamily:F.h,fontWeight:800,fontSize:16,cursor:"pointer"}}>🔄 Reintentar</button>
            {diag && diag.fs && diag.au && <button onClick={()=>setAuthUser(null)} style={{background:"#fff",border:"1.5px solid #e06000",color:"#e06000",borderRadius:12,padding:"12px 22px",fontFamily:F.h,fontWeight:800,fontSize:16,cursor:"pointer"}}>→ Entrar igualmente</button>}
          </div>
        </>}
      </div>
    </div>
  );

  if (!authUser) return (
    <div style={{fontFamily:F.b}}><style>{STYLES}</style>
      <LoginScreen noUsers={noUsers}/>
    </div>
  );

  if (!perfil) return (
    <div style={{fontFamily:F.b}}><style>{STYLES}</style>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:14,padding:20}}>
        <div style={{fontSize:44}}>⏳</div>
        <p style={{fontFamily:F.h,fontSize:17,color:C.muted,textAlign:"center"}}>Cargando tu perfil…<br/>Si tarda, pide a gerencia que verifique tu usuario.</p>
        <button onClick={()=>signOut(auth)} style={{background:"#fff",border:`1.5px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"10px 22px",fontFamily:F.h,fontWeight:700,fontSize:15,cursor:"pointer"}}>Cerrar sesión</button>
      </div>
    </div>
  );

  const back = () => setView("home");
  const counts = { centros:centros.length, lineas:lineas.length, motivos:motivos.length, usuarios:usuarios.length, turnos:turnos.length, procesos:procesos.length, mps:mps.length, provs:provs.length, productos:productos.length };

  return (
    <div style={{fontFamily:F.b}}>
      <style>{STYLES}</style>
      {view==="home"      && <Home perfil={perfil} onGo={setView} onLogout={()=>signOut(auth)} counts={counts} ordenes={ordenesRoot} producciones={produccionesRoot} productos={productos}/>}
      {view==="planificacion" && <PlanificacionScreen onBack={back} perfil={perfil} productos={productos} mps={mps} producciones={produccionesRoot}/>}
      {view==="ordenes"   && <OrdenesScreen onBack={back} perfil={perfil} productos={productos} lineas={lineas} turnos={turnos} centros={centros} mps={mps} motivos={motivos} usuarios={usuarios}/>}
      {view==="diario"    && <DiarioScreen onBack={back} productos={productos} lineas={lineas} turnos={turnos} mps={mps} motivos={motivos} usuarios={usuarios} centros={centros}/>}
      {view==="analitica" && <AnaliticaScreen onBack={back} productos={productos} mps={mps} lineas={lineas} turnos={turnos} usuarios={usuarios} centros={centros}/>}
      {view==="seed"      && <SeedScreen onBack={back}/>}
      {view==="synccat"   && <SyncCatalogoScreen onBack={back} productos={productos}/>}
      {view==="importhist"&& <ImportHistoricoScreen onBack={back} productos={productos} mps={mps} lineas={lineas} turnos={turnos}/>}
      {view==="centros"   && <CentrosScreen onBack={back}/>}
      {view==="lineas"    && <LineasScreen onBack={back} centros={centros}/>}
      {view==="motivos"   && <MotivosScreen onBack={back}/>}
      {view==="usuarios"  && <UsuariosScreen onBack={back} turnos={turnos} centros={centros}/>}
      {view==="turnos"    && <TurnosScreen onBack={back}/>}
      {view==="procesos"  && <ProcesosScreen onBack={back}/>}
      {view==="mps"       && <MateriasPrimasScreen onBack={back}/>}
      {view==="provs"     && <ProveedoresScreen onBack={back} mps={mps}/>}
      {view==="productos" && <ProductosScreen onBack={back} procesos={procesos} mps={mps} centros={centros}/>}
      {view==="costes"    && <CostesScreen onBack={back} centros={centros}/>}
    </div>
  );
}
