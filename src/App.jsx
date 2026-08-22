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
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:28,color:C.text,letterSpacing:-0.5}}>wikuk</div>
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
          <Sel label="Producto" value={productoId} onChange={setProductoId} placeholder="Elegir producto…"
            options={productos.map(p=>({value:p.id,label:`${p.nombre}${p.descripcion?` · ${p.descripcion}`:""}`}))}/>
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
      <Header title="📝 PARTE DE PRODUCCIÓN" onBack={onBack} sub={`${orden.numero?`OT ${orden.numero} · `:""}${producto?.nombre||""} · ${hechas}/${orden.cantidad} · faltan ${pdte}`}/>
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
function DiarioScreen({ onBack, productos, lineas, turnos, mps, motivos, usuarios, centros }) {
  const hoy = new Date().toISOString().slice(0,10);
  const [fecha, setFecha] = useState(hoy);
  const [ordenes] = useCol("ordenes");
  const [producciones] = useCol("producciones", "fecha");

  const partes = producciones.filter(p=>p.fecha===fecha);
  const totalUds = partes.reduce((s,p)=>s+(p.cantidad||0),0);
  const planDia = ordenes.filter(o=>o.fecha===fecha).reduce((s,o)=>s+(o.cantidad||0),0);
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
                return (
                  <Card key={p.id} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                      <div style={{fontFamily:F.h,fontWeight:800,fontSize:17,color:C.text}}>
                        {orden?.numero?`OT ${orden.numero} · `:""}{prod?.nombre||"?"} <span style={{color:C.accent}}>· {p.cantidad} uds</span>
                      </div>
                      {lin && <Pill color={C.blue} bg={C.blueBg}>{lin.nombre}</Pill>}
                    </div>
                    {(p.equipo||[]).length>0 &&
                      <div style={{fontSize:13,color:C.muted,marginTop:4}}>👷 {(p.equipo||[]).map(nombreDe).join(" · ")} · {p.horas_equipo||8} h</div>}
                    {(p.consumos||[]).map((cs,i)=>{
                      const m = mps.find(x=>x.id===cs.materia_id);
                      return <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13.5,padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                        <span>{m?.nombre}{cs.lote?<span style={{background:C.card2,borderRadius:8,padding:"1px 7px",fontSize:11,marginLeft:6}}>{cs.lote}</span>:null}
                          <span style={{color:C.muted}}> · {cs.madejas?`${cs.madejas} mad`:""}{cs.metros?` +${cs.metros} m`:""}</span></span>
                        {cs.rendimiento_pct!=null && <b style={{color:cs.rendimiento_pct>=85?C.green:cs.rendimiento_pct>=75?C.amber:C.red}}>{cs.rendimiento_pct}%</b>}
                      </div>;
                    })}
                    {(p.paros||[]).map((pa,i)=>{
                      const mo = motivos.find(x=>x.id===pa.motivo_id);
                      return <div key={i} style={{fontSize:13,color:C.amber,marginTop:4}}>⏸ {mo?.icono} {mo?.nombre}{pa.minutos?` · ${pa.minutos}'`:""}{pa.nota?` — ${pa.nota}`:""}</div>;
                    })}
                    {p.nota && <div style={{fontSize:13,color:C.muted,marginTop:6,background:C.card2,borderRadius:10,padding:"8px 10px"}}>📝 {p.nota}</div>}
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12,color:C.muted}}>
                      <span>{costeFab!=null && <>Fabricación: <b style={{color:prod?.coste_objetivo&&costeFab<=prod.coste_objetivo?C.green:C.red}}>{costeFab.toFixed(2)} €/ud</b>{prod?.coste_objetivo?` (obj ${prod.coste_objetivo})`:""}</>}</span>
                      <span>✍ {p.registrado_por}</span>
                    </div>
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
        linea_id: mapLin[norm(o.l)]||"", turno_id: o.t==="T2"?turnoT2:(o.t==="T1"?turnoT1:""),
        fecha: o.f, cantidad: o.req||o.q||0, cerrada: true, historico: true,
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
          linea_id: mapLin[norm(o.l)]||"", cantidad: o.q, nota: o.nota||"",
          n_personas: o.np||null, origen_personas: o.op||"", equipo: [], paros: [],
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

function SyncCatalogoScreen({ onBack, productos }) {
  const [estado, setEstado] = useState("idle"); // idle | leyendo | preview | aplicando | fin
  const [cat, setCat] = useState([]);
  const [matches, setMatches] = useState([]);
  const [nuevos, setNuevos] = useState([]);
  const [crearNuevos, setCrearNuevos] = useState(false);
  const [log, setLog] = useState("");

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
function ProductosScreen({ onBack, procesos, mps, centros }) {
  const [productos] = useCol("productos", "nombre");
  const [edit, setEdit] = useState(null);
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
        {productos.length===0 && <Empty icon="🏷️" text="Sin productos"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {productos.map(p=>(
            <Card key={p.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:F.h,fontWeight:700,fontSize:18,color:C.text}}>{p.nombre}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                    🏭 {centros.find(c=>c.id===p.centro)?.nombre||"sin centro"}
                    {" · "}Obj: <span style={{color:C.blue,fontWeight:700}}>{p.objetivo_diario||0}/día</span>
                    {" · "}Coste obj: <span style={{color:C.text,fontWeight:700}}>{p.coste_objetivo}€/{p.unidad}</span>
                    {" · "}{p.procesos_asignados?.length||0} procesos · {p.materias_asignadas?.length||0} materias
                  </div>
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
  const [mFinales, setMFinales] = useState(ep?.metros_finales?.toString()||"");
  const [objDiario, setObjDiario] = useState(ep?.objetivo_diario?.toString()||"");
  const [pa, setPa]         = useState(ep?.procesos_asignados||[]); // [{proceso_id,min_obj,define_cantidad}]
  const [ma, setMa]         = useState(ep?.materias_asignadas||[]); // [{mp_id,capas}]
  const [selProc, setSelProc] = useState("");
  const [minObj, setMinObj]   = useState("");
  const [selMp, setSelMp]     = useState("");
  const [capas, setCapas]     = useState("");

  const addProc = () => {
    if (!selProc || !minObj) return;
    if (pa.find(x=>x.proceso_id===selProc)) return;
    setPa(prev=>[...prev,{proceso_id:selProc,min_obj:parseFloat(minObj),define_cantidad:prev.length===0}]);
    setSelProc(""); setMinObj("");
  };
  const addMp = () => {
    if (!selMp || !capas) return;
    if (ma.find(x=>x.mp_id===selMp)) return;
    setMa(prev=>[...prev,{mp_id:selMp,capas:parseInt(capas)}]);
    setSelMp(""); setCapas("");
  };
  const guardar = async () => {
    if (!nombre.trim()) return;
    if (!centro) { alert("Asigna el producto a un centro"); return; }
    await save("productos", ep?.id||uid(), {
      nombre: nombre.trim(), centro, unidad: unidad.trim()||"ud",
      coste_objetivo: parseFloat(coste)||0,
      metros_finales: parseFloat(mFinales)||0,
      objetivo_diario: parseFloat(objDiario)||0,
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
            <Field label="Coste objetivo (€/ud)" value={coste} onChange={setCoste} type="number" placeholder="3.50" min="0" step="0.01"/>
          </div>
        </Card>

        {/* PROCESOS */}
        <Card style={{marginBottom:14}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text,marginBottom:4}}>PROCESOS</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Del catálogo global, con tiempo objetivo por {unidad||"ud"}. ★ = define la cantidad producida</div>
          {pa.map(x=>{
            const pr = procesos.find(z=>z.id===x.proceso_id);
            return (
              <div key={x.proceso_id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
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
            );
          })}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:8,marginTop:12,alignItems:"end"}}>
            <Sel value={selProc} onChange={setSelProc} placeholder="Proceso…"
              options={procesos.filter(p=>!pa.find(x=>x.proceso_id===p.id)).map(p=>({value:p.id,label:p.nombre}))}/>
            <Field value={minObj} onChange={setMinObj} type="number" placeholder="min/ud" min="0.01" step="0.01"/>
            <button onClick={addProc} style={{background:C.accent,border:"none",color:"#fff",borderRadius:11,padding:"13px 18px",fontFamily:F.h,fontWeight:700,fontSize:17,cursor:"pointer",marginBottom:14}}>＋</button>
          </div>
        </Card>

        {/* MATERIAS */}
        <Card style={{marginBottom:14}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text,marginBottom:4}}>ESCANDALLO DE MATERIAS — por capas</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Teórico = {mFinales||"?"} m finales × nº capas de cada materia</div>
          {ma.map(x=>{
            const m = mps.find(z=>z.id===x.mp_id);
            return (
              <div key={x.mp_id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <span style={{fontFamily:F.h,fontWeight:600,fontSize:16,color:C.text}}>{m?.nombre||"?"}</span>
                  <span style={{color:C.blue,fontSize:14,marginLeft:10,fontWeight:700}}>{x.capas} capa{x.capas>1?"s":""} → {((parseFloat(mFinales)||0)*x.capas).toFixed(1)} m/ud</span>
                  <span style={{color:C.muted,fontSize:12,marginLeft:8}}>obj {m?.rendimiento_objetivo}%</span>
                </div>
                <button onClick={()=>setMa(prev=>prev.filter(z=>z.mp_id!==x.mp_id))}
                  style={{background:"none",border:"none",color:C.red,fontSize:18,cursor:"pointer"}}>✕</button>
              </div>
            );
          })}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:8,marginTop:12,alignItems:"end"}}>
            <Sel value={selMp} onChange={setSelMp} placeholder="Materia prima…"
              options={mps.filter(m=>!ma.find(x=>x.mp_id===m.id)).map(m=>({value:m.id,label:m.nombre}))}/>
            <Field value={capas} onChange={setCapas} type="number" placeholder="capas (1-4)" min="1" step="1"/>
            <button onClick={addMp} style={{background:C.accent,border:"none",color:"#fff",borderRadius:11,padding:"13px 18px",fontFamily:F.h,fontWeight:700,fontSize:17,cursor:"pointer",marginBottom:14}}>＋</button>
          </div>
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
function Home({ perfil, onGo, onLogout, counts, ordenes=[], producciones=[], productos=[] }) {
  const hoy = new Date().toISOString().slice(0,10);
  const partesHoy = producciones.filter(p=>p.fecha===hoy);
  const udsHoy = partesHoy.reduce((s,p)=>s+(p.cantidad||0),0);
  const activas = ordenes.filter(o=>!o.cerrada);
  const planHoy = ordenes.filter(o=>o.fecha===hoy).reduce((s,o)=>s+(o.cantidad||0),0);
  const prodDe = (oid) => producciones.filter(p=>p.orden_id===oid).reduce((s,p)=>s+(p.cantidad||0),0);
  const verDash = perfil.rol!=="operario";
  const esGerencia = perfil.rol === "gerencia";
  const tiles = [
    { id:"ordenes",   icon:"📋", bg:"#ECFDF5", label:"Órdenes de Producción", sub:"Planificar y registrar",           roles:["gerencia","sup_fabrica","sup_oficina"] },
    { id:"diario",    icon:"📖", bg:"#EFF6FF", label:"Diario de Fabricación", sub:"El parte oficial del día",          roles:["gerencia","sup_fabrica","sup_oficina"] },
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
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:20,color:"#fff",letterSpacing:-0.3}}>wikuk <span style={{fontWeight:400,fontSize:13,color:"rgba(255,255,255,0.55)"}}>· Producción</span></div>
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
        {verDash && (activas.length>0 || partesHoy.length>0) && (
          <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:14,marginBottom:14,boxShadow:"0 1px 2px rgba(15,23,42,.04)"}}>
            <div style={{fontSize:11,color:C.mutedD,fontWeight:800,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10,display:"flex",justifyContent:"space-between"}}>
              <span>📅 HOY · {new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"2-digit"})}</span>
              <button onClick={()=>onGo("diario")} style={{background:"none",border:"none",color:C.blue,fontSize:11,fontWeight:800,cursor:"pointer"}}>Ver diario →</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[[activas.length,"Órdenes activas",C.accent],
                [planHoy?`${udsHoy}/${planHoy}`:String(udsHoy),"Uds hoy"+(planHoy?" / plan":""),C.text],
                [planHoy?Math.round(udsHoy/planHoy*100)+"%":"—","Del plan",planHoy&&udsHoy/planHoy>=1?C.green:C.amber]].map(([n,l,col],i)=>(
                <div key={i} style={{background:C.card2,borderRadius:12,padding:"10px 6px",textAlign:"center"}}>
                  <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:col}}>{n}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
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
        <div style={{fontFamily:F.h,fontSize:20,color:C.muted}}>{bootSlow?"Sin respuesta del servidor":"Cargando…"}</div>
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
  const [ordenesRoot] = useCol("ordenes");
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
  const [produccionesRoot] = useCol("producciones");
  const counts = { centros:centros.length, lineas:lineas.length, motivos:motivos.length, usuarios:usuarios.length, turnos:turnos.length, procesos:procesos.length, mps:mps.length, provs:provs.length, productos:productos.length };

  return (
    <div style={{fontFamily:F.b}}>
      <style>{STYLES}</style>
      {view==="home"      && <Home perfil={perfil} onGo={setView} onLogout={()=>signOut(auth)} counts={counts} ordenes={ordenesRoot} producciones={produccionesRoot} productos={productos}/>}
      {view==="ordenes"   && <OrdenesScreen onBack={back} perfil={perfil} productos={productos} lineas={lineas} turnos={turnos} centros={centros} mps={mps} motivos={motivos} usuarios={usuarios}/>}
      {view==="diario"    && <DiarioScreen onBack={back} productos={productos} lineas={lineas} turnos={turnos} mps={mps} motivos={motivos} usuarios={usuarios} centros={centros}/>}
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
