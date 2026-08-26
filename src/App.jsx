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
const APP_VERSION = "v2.49.0";

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
// Acepta coma o punto como separador decimal (teclados móviles españoles)
const toNum = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

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
const calcRecursos = (items, productos, persLinea = 3, procesos = []) => {
  let uds=0, slots=0, personaTurnos=0, costeMP=0, costeMO=0, ventas=0, costeFicha=0, minApoyo=0;
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
    slots += turnos * (pers/(persLinea||3));
    personaTurnos += turnos * pers;
    costeMP += (parseFloat(p.coste_mp_objetivo)||0) * q;
    ventas  += (parseFloat(p.precio_venta)||0) * q;
    costeFicha += (parseFloat(p.coste_objetivo)||0) * q;
    costeMO += turnos * pers * 8 * TARIFA_MO;
    // procesos fuera de línea: cuentan en horas y coste, pero no ocupan hueco
    (p.procesos_asignados||[]).forEach(pa => {
      const cat = procesos.find(z => z.id === pa.proceso_id);
      if (!cat?.apoyo) return;
      const base = pa.base_tiempo || cat.base_tiempo || "ud";
      const minUd = base === "m"
        ? (parseFloat(pa.min_obj)||0) * (parseFloat(p.metros_finales)||0)
        : (parseFloat(pa.min_obj)||0);
      minApoyo += minUd * q;
    });
    (p.materias_asignadas||[]).forEach(m => {
      const rend = (parseFloat(m.rendimiento)||100)/100;
      const metros = (parseFloat(p.metros_finales)||0) * (parseFloat(m.capas)||0) / (rend||1) * q;
      materias[m.mp_id] = (materias[m.mp_id]||0) + metros;
    });
  });
  const horasApoyo = minApoyo/60;
  return { uds, slots, personaTurnos, costeMP, costeMO, coste: costeMP+costeMO,
           ventas, costeFicha, horasApoyo, materias, sinRitmo };
};

// ── IMPRESIÓN ──────────────────────────────────────────────────────────────────
const esc = (t) => String(t??"").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const imprimirHTML = (html) => {
  const prev = document.getElementById("wk-print");
  if (prev) prev.remove();
  const d = document.createElement("div");
  d.id = "wk-print";
  d.innerHTML = html;
  document.body.appendChild(d);
  setTimeout(() => { window.print(); }, 150);
};
const PRINT_CSS = `
  #wk-print{display:none;}
  @media print{
    #root{display:none!important;}
    #wk-print{display:block!important;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;}
    #wk-print h1{font-size:19px;margin:0 0 2px;}
    #wk-print h2{font-size:13px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.6px;border-bottom:1.5px solid #111;padding-bottom:3px;}
    #wk-print .sub{font-size:12px;color:#555;margin-bottom:10px;}
    #wk-print table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px;}
    #wk-print th{text-align:left;background:#eee;padding:5px 6px;border:0.5px solid #bbb;font-size:10px;text-transform:uppercase;}
    #wk-print td{padding:5px 6px;border:0.5px solid #ccc;}
    #wk-print td.n,#wk-print th.n{text-align:right;}
    #wk-print .kpis{display:flex;gap:10px;margin-bottom:6px;}
    #wk-print .kpi{flex:1;border:1px solid #999;border-radius:6px;padding:7px 9px;}
    #wk-print .kpi b{display:block;font-size:17px;}
    #wk-print .kpi span{font-size:9.5px;color:#555;text-transform:uppercase;}
    #wk-print .pie{margin-top:18px;font-size:9.5px;color:#666;border-top:0.5px solid #bbb;padding-top:5px;}
    #wk-print .aviso{border:1px solid #b45309;background:#fffbeb;padding:7px 9px;font-size:11px;margin-bottom:8px;border-radius:5px;}
    #wk-print .firma{margin-top:22px;display:flex;gap:30px;font-size:10px;color:#555;}
    #wk-print .firma div{flex:1;border-top:0.5px solid #999;padding-top:4px;}
    @page{margin:14mm;}
  }
`;
// Bloques comunes de un informe de planificación
const bloqueRecursos = (r, mps, dias, persDia) => {
  const filas = Object.entries(r.materias).sort((a,b)=>b[1]-a[1]).map(([id,m])=>{
    const mp = mps.find(x=>x.id===id);
    return `<tr><td>${esc(mp?.nombre||"?")}</td><td class="n">${num(m)}</td><td class="n">${num(m/((mp?.metros_madeja)||90))}</td></tr>`;
  }).join("");
  return `
    <h2>Recursos necesarios</h2>
    <div class="kpis">
      <div class="kpi"><b>${num(r.uds)}</b><span>Unidades</span></div>
      <div class="kpi"><b>${Math.ceil(r.personaTurnos/(dias||1))} / ${persDia}</b><span>Personas al día</span></div>
      <div class="kpi"><b>${r.slots.toFixed(1)}</b><span>Huecos de línea</span></div>
      <div class="kpi"><b>${eur(r.coste)}</b><span>Coste objetivo</span></div>
    </div>
    <table><tr><th>Concepto</th><th class="n">Importe</th></tr>
      <tr><td>Materia prima</td><td class="n">${eur(r.costeMP)}</td></tr>
      <tr><td>Mano de obra (${TARIFA_MO} €/h)</td><td class="n">${eur(r.costeMO)}</td></tr>
      <tr><td><b>Total objetivo</b></td><td class="n"><b>${eur(r.coste)}</b></td></tr>
    </table>
    ${filas ? `<h2>Materias primas a preparar</h2>
    <table><tr><th>Materia</th><th class="n">Metros</th><th class="n">Madejas</th></tr>${filas}</table>` : ""}
    ${r.sinRitmo.length ? `<div class="aviso"><b>Sin ritmo definido:</b> ${esc(r.sinRitmo.join(" · "))}. No cuentan en los recursos.</div>` : ""}
  `;
};
const pieInforme = (perfil) => `<div class="pie">Wikuk Producción ${APP_VERSION} · generado el ${new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}${perfil?.nombre?` por ${esc(perfil.nombre)}`:""}</div>
  <div class="firma"><div>Preparado por</div><div>Revisado por</div><div>Aprobado por</div></div>`;


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
// Formulario que solo se abre cuando se pide (o cuando se está editando algo)
const FormPlegable = ({ abierto, setAbierto, editando, etiqueta, onCancelar, children }) => {
  const visible = abierto || editando;
  if (!visible) return (
    <button onClick={()=>setAbierto(true)}
      style={{width:"100%",background:C.accent,border:"none",color:"#fff",borderRadius:14,padding:"16px",
        fontFamily:F.h,fontWeight:800,fontSize:15.5,cursor:"pointer",marginBottom:14}}>＋ {etiqueta}</button>
  );
  return (
    <Card style={{marginBottom:14}} color={editando?C.amber+"66":undefined}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:editando?C.amber:C.text}}>
          {editando ? "✏️ Editando" : `＋ ${etiqueta}`}
        </span>
        <button onClick={()=>{ setAbierto(false); onCancelar && onCancelar(); }}
          style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
      </div>
      {children}
    </Card>
  );
};

const Field = ({ label, value, onChange, type = "text", placeholder, min, step, dec }) => (
  <div style={{marginBottom:14}}>
    {label && <label style={{display:"block",fontFamily:F.h,fontWeight:600,fontSize:12,color:C.mutedD,marginBottom:5,letterSpacing:0.2}}>{label}</label>}
    <input type={dec?"text":type} inputMode={dec?"decimal":undefined}
      value={value} onChange={e=>onChange(dec?e.target.value.replace(/[^0-9.,]/g,""):e.target.value)} placeholder={placeholder} min={min} step={step}
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
// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL DE PLANTA — pantalla táctil del obrador. Botones grandes, poco texto.
// ═══════════════════════════════════════════════════════════════════════════════
const TT = {                       // medidas pensadas para dedo con guante
  btn: 84, btnSm: 68, radio: 18,
  txt: 22, txtSm: 17, num: 68,
};
const BotonGrande = ({ children, sub, onClick, bg=C.card, color=C.text, borde, alto=TT.btn, disabled }) => (
  <button onClick={onClick} disabled={disabled}
    style={{minHeight:alto,width:"100%",background:disabled?C.card2:bg,color:disabled?C.muted:color,
      border:borde?`3px solid ${borde}`:`2px solid ${C.border}`,borderRadius:TT.radio,
      padding:"12px 16px",fontFamily:F.h,fontWeight:800,fontSize:TT.txt,cursor:disabled?"default":"pointer",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
      boxShadow:disabled?"none":"0 2px 6px rgba(15,23,42,0.10)",lineHeight:1.15}}>
    <span>{children}</span>
    {sub && <span style={{fontSize:14,fontWeight:600,opacity:0.75}}>{sub}</span>}
  </button>
);

function TerminalPlanta({ onBack, perfil, productos, lineas, turnos, centros, mps, motivos, ordenes, moldes=[] }) {
  const hoy = new Date().toISOString().slice(0,10);
  const [lineaId, setLineaId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [ordenId, setOrdenId] = useState("");
  const [uds, setUds] = useState(0);
  const [personas, setPersonas] = useState(0);
  const [paroActivo, setParoActivo] = useState(null);   // {motivo_id, nombre, desde}
  const [paros, setParos] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [vista, setVista] = useState("linea");          // linea·turno·producto·trabajo
  const [modal, setModal] = useState(null);             // paro·lote·fin
  const [ahora, setAhora] = useState(Date.now());
  const [guardando, setGuardando] = useState(false);

  useEffect(()=>{ const t=setInterval(()=>setAhora(Date.now()),1000); return ()=>clearInterval(t); },[]);

  const linea = lineas.find(l=>l.id===lineaId);
  const turno = turnos.find(t=>t.id===turnoId);
  const prod  = productos.find(p=>p.id===productoId);
  const ritmo = toNum(prod?.uds_turno_linea);
  const molde = prod?.molde_id ? (moldes.find(m=>m.id===prod.molde_id)?.nombre) : prod?.molde;
  const pct   = ritmo>0 ? uds/ritmo : 0;

  const mmss = (ms) => { const s=Math.max(0,Math.floor(ms/1000));
    return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; };
  const minParados = paros.reduce((a,p)=>a+(p.minutos||0),0) + (paroActivo ? (ahora-paroActivo.desde)/60000 : 0);

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    const parosFinal = paroActivo
      ? [...paros, { motivo_id:paroActivo.motivo_id, motivo:paroActivo.nombre, minutos: Math.round((ahora-paroActivo.desde)/60000) }]
      : paros;
    await save("producciones", uid(), {
      orden_id: ordenId || "", producto_id: productoId, fecha: hoy,
      turno_id: turnoId, linea_id: lineaId, linea_nombre: linea?.nombre || "",
      cantidad: uds, n_personas: personas || (parseInt(linea?.personas)||3), horas_equipo: 8,
      consumos, paros: parosFinal, nota: "",
      origen: "terminal",
      registrado_por: perfil?.nombre || "terminal", registrado_at: new Date().toISOString(),
    });
    for (const cs of consumos) if (cs.lote && cs.materia_id) {
      const lid = (cs.materia_id+"_"+cs.lote).replace(/[^a-zA-Z0-9_-]/g,"_");
      await save("lotes", lid, { materia_id: cs.materia_id, codigo: cs.lote, ultima_fecha: hoy });
    }
    setModal({ tipo:"hecho", uds, pct });
    setGuardando(false);
  };

  const reiniciar = () => {
    setUds(0); setParos([]); setParoActivo(null); setConsumos([]);
    setProductoId(""); setOrdenId(""); setModal(null); setVista("producto");
  };

  // ── Cabecera fija del terminal
  const Cabecera = ({ titulo, atras }) => (
    <div style={{background:C.navy,padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
      {atras && (
        <button onClick={atras}
          style={{width:64,height:64,borderRadius:16,background:"rgba(255,255,255,0.15)",border:"none",
            color:"#fff",fontSize:30,cursor:"pointer",flexShrink:0}}>‹</button>
      )}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:26,color:"#fff",lineHeight:1.15}}>{titulo}</div>
        <div style={{fontSize:15,color:"rgba(255,255,255,0.65)",marginTop:2}}>
          {new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}
        </div>
      </div>
      <button onClick={onBack}
        style={{height:56,padding:"0 20px",borderRadius:14,background:"rgba(255,255,255,0.15)",border:"none",
          color:"#fff",fontFamily:F.h,fontWeight:700,fontSize:17,cursor:"pointer",flexShrink:0}}>Salir</button>
    </div>
  );

  // ═══ PASO 1 · LÍNEA ═══
  if (vista === "linea") {
    const lc = lineas.filter(l => l.activo !== false && (!perfil?.centro || l.centro === perfil.centro));
    const lista = lc.length ? lc : lineas.filter(l=>l.activo!==false);
    return (
      <div style={{background:C.bg,minHeight:"100vh"}}>
        <Cabecera titulo="¿En qué línea trabajas?"/>
        <div style={{padding:24,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}>
          {lista.map(l=>(
            <BotonGrande key={l.id} alto={130} bg="#fff" borde={C.blue}
              sub={`${parseInt(l.personas)||3} personas`}
              onClick={()=>{ setLineaId(l.id); setPersonas(parseInt(l.personas)||3); setVista("turno"); }}>
              ⚙️ {l.nombre}
            </BotonGrande>
          ))}
          {lista.length===0 && <Empty icon="⚙️" text="No hay líneas dadas de alta"/>}
        </div>
      </div>
    );
  }

  // ═══ PASO 2 · TURNO ═══
  if (vista === "turno") {
    return (
      <div style={{background:C.bg,minHeight:"100vh"}}>
        <Cabecera titulo="¿Qué turno?" atras={()=>setVista("linea")}/>
        <div style={{padding:24,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}>
          {turnos.map(t=>(
            <BotonGrande key={t.id} alto={130} bg="#fff" borde={C.blue}
              sub={t.hora_inicio ? `${t.hora_inicio} – ${t.hora_fin||""}` : null}
              onClick={()=>{ setTurnoId(t.id); setVista("producto"); }}>
              🕐 {t.nombre}
            </BotonGrande>
          ))}
        </div>
      </div>
    );
  }

  // ═══ PASO 3 · QUÉ SE FABRICA ═══
  if (vista === "producto") {
    const abiertas = ordenes.filter(o => !o.cerrada);
    const deLinea  = abiertas.filter(o => !o.linea_id || o.linea_id === lineaId);
    const lista = (deLinea.length ? deLinea : abiertas).slice(0, 12);
    return (
      <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
        <Cabecera titulo="¿Qué vas a fabricar?" atras={()=>setVista("turno")}/>
        <div style={{padding:24}}>
          <div style={{fontSize:17,color:C.mutedD,marginBottom:16}}>
            {linea?.nombre} · {turno?.nombre}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:18}}>
            {lista.map(o=>{
              const p = productos.find(x=>x.id===o.producto_id);
              const m = p?.molde_id ? moldes.find(z=>z.id===p.molde_id)?.nombre : p?.molde;
              return (
                <BotonGrande key={o.id} alto={140} bg="#fff" borde={C.green}
                  onClick={()=>{ setProductoId(o.producto_id); setOrdenId(o.id); setVista("trabajo"); }}>
                  <span style={{fontSize:24}}>{p?.nombre || "?"}</span>
                  <span style={{fontSize:15,fontWeight:600,color:C.mutedD}}>
                    OT {o.numero || "—"} · {num(o.cantidad||0)} uds{m?` · 🔧 ${m}`:""}
                  </span>
                </BotonGrande>
              );
            })}
          </div>
          {lista.length===0 && (
            <div style={{marginTop:20}}><Empty icon="📋" text="No hay órdenes abiertas. Créalas en Órdenes de Producción."/></div>
          )}
        </div>
      </div>
    );
  }

  // ═══ PASO 4 · PANTALLA DE TRABAJO ═══
  const colorPct = pct >= 1 ? C.green : pct >= 0.7 ? C.amber : C.red;
  return (
    <div style={{background: paroActivo ? "#FEF2F2" : C.bg, minHeight:"100vh", paddingBottom:24}}>
      <Cabecera titulo={prod?.nombre || "Producción"} atras={()=>setVista("producto")}/>

      <div style={{padding:"16px 20px",display:"flex",gap:14,flexWrap:"wrap",alignItems:"center",
        background:"#fff",borderBottom:`2px solid ${C.border}`}}>
        {[["⚙️", linea?.nombre], ["🕐", turno?.nombre], ["👥", `${personas} personas`], molde?["🔧", molde]:null]
          .filter(Boolean).map(([i,t],k)=>(
          <span key={k} style={{fontSize:18,fontFamily:F.h,fontWeight:700,color:C.text,
            background:C.card2,borderRadius:12,padding:"10px 16px"}}>{i} {t}</span>
        ))}
      </div>

      {paroActivo && (
        <div style={{background:C.red,color:"#fff",padding:"20px",textAlign:"center"}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:26}}>⏸ LÍNEA PARADA · {paroActivo.nombre}</div>
          <div style={{fontFamily:F.h,fontWeight:900,fontSize:52,letterSpacing:1,marginTop:4}}>{mmss(ahora-paroActivo.desde)}</div>
        </div>
      )}

      {/* CONTADOR */}
      <div style={{padding:"24px 20px",textAlign:"center"}}>
        <div style={{fontSize:17,color:C.mutedD,fontFamily:F.h,fontWeight:700,letterSpacing:1}}>UNIDADES FABRICADAS</div>
        <div style={{fontFamily:F.h,fontWeight:900,fontSize:96,color:colorPct,lineHeight:1.05}}>{num(uds)}</div>
        {ritmo>0 && (
          <>
            <div style={{fontSize:19,color:C.mutedD,marginBottom:10}}>de <b style={{color:C.text}}>{num(ritmo)}</b> del turno</div>
            <div style={{height:22,background:C.card2,borderRadius:11,overflow:"hidden",maxWidth:620,margin:"0 auto"}}>
              <div style={{width:Math.min(100,pct*100)+"%",height:"100%",background:colorPct,borderRadius:11,transition:"width .3s"}}/>
            </div>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:22,color:colorPct,marginTop:8}}>{Math.round(pct*100)}%</div>
          </>
        )}
      </div>

      {/* BOTONES DE CUENTA */}
      <div style={{padding:"0 20px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:18}}>
        <BotonGrande alto={100} bg="#fff" borde={C.border} onClick={()=>setUds(u=>Math.max(0,u-1))}>− 1</BotonGrande>
        <BotonGrande alto={100} bg="#fff" borde={C.border} onClick={()=>setUds(u=>Math.max(0,u-10))}>− 10</BotonGrande>
        <BotonGrande alto={100} bg={C.green} color="#fff" borde={C.green} onClick={()=>setUds(u=>u+1)}>+ 1</BotonGrande>
        <BotonGrande alto={100} bg={C.green} color="#fff" borde={C.green} onClick={()=>setUds(u=>u+10)}>+ 10</BotonGrande>
      </div>

      {/* ACCIONES */}
      <div style={{padding:"0 20px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14}}>
        {paroActivo ? (
          <BotonGrande alto={110} bg={C.green} color="#fff" borde={C.green}
            onClick={()=>{ setParos([...paros,{ motivo_id:paroActivo.motivo_id, motivo:paroActivo.nombre,
                minutos: Math.round((ahora-paroActivo.desde)/60000) }]); setParoActivo(null); }}>
            ▶ REANUDAR
          </BotonGrande>
        ) : (
          <BotonGrande alto={110} bg="#fff" color={C.red} borde={C.red}
            sub={paros.length ? `${paros.length} paros · ${Math.round(minParados)} min` : null}
            onClick={()=>setModal({tipo:"paro"})}>⏸ PARAR LÍNEA</BotonGrande>
        )}
        <BotonGrande alto={110} bg="#fff" color={C.blue} borde={C.blue}
          sub={consumos.length ? `${consumos.length} registrados` : "lote y metros"}
          onClick={()=>setModal({tipo:"lote"})}>📦 MATERIA</BotonGrande>
        <BotonGrande alto={110} bg={C.navy} color="#fff" borde={C.navy}
          disabled={uds<=0} onClick={()=>setModal({tipo:"fin"})}>✔ TERMINAR TURNO</BotonGrande>
      </div>

      {modal?.tipo==="paro"  && <ModalParo motivos={motivos} onCerrar={()=>setModal(null)}
        onElegir={(m)=>{ setParoActivo({motivo_id:m.id, nombre:m.nombre, desde:Date.now()}); setModal(null); }}/>}
      {modal?.tipo==="lote"  && <ModalLote mps={mps} prod={prod} onCerrar={()=>setModal(null)}
        onGuardar={(c)=>{ setConsumos([...consumos,c]); setModal(null); }}/>}
      {modal?.tipo==="fin"   && <ModalFin uds={uds} ritmo={ritmo} prod={prod} paros={paros} minParados={minParados}
        consumos={consumos} guardando={guardando} onCerrar={()=>setModal(null)} onConfirmar={guardar}/>}
      {modal?.tipo==="hecho" && <ModalHecho uds={modal.uds} pct={modal.pct} onSeguir={reiniciar} onSalir={onBack}/>}
    </div>
  );
}

// ── Capa a pantalla completa para los diálogos del terminal
const CapaTerminal = ({ titulo, onCerrar, children, color=C.navy }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.75)",zIndex:60,display:"flex",flexDirection:"column"}}>
    <div style={{background:color,padding:"18px 22px",display:"flex",alignItems:"center",gap:16}}>
      <div style={{flex:1,fontFamily:F.h,fontWeight:800,fontSize:26,color:"#fff"}}>{titulo}</div>
      <button onClick={onCerrar}
        style={{width:64,height:64,borderRadius:16,background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",fontSize:30,cursor:"pointer"}}>✕</button>
    </div>
    <div style={{flex:1,overflowY:"auto",background:C.bg,padding:22}}>{children}</div>
  </div>
);

// ── Motivos de paro, en rejilla grande
const ModalParo = ({ motivos, onElegir, onCerrar }) => (
  <CapaTerminal titulo="¿Por qué para la línea?" onCerrar={onCerrar} color={C.red}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16}}>
      {motivos.map(m=>(
        <BotonGrande key={m.id} alto={120} bg="#fff" borde={C.red} onClick={()=>onElegir(m)}>
          {m.nombre}
        </BotonGrande>
      ))}
      {motivos.length===0 && <Empty icon="⏸" text="No hay motivos de paro configurados"/>}
    </div>
  </CapaTerminal>
);

// ── Teclado numérico grande
const Teclado = ({ valor, onChange, sufijo }) => (
  <>
    <div style={{background:"#fff",border:`2px solid ${C.border}`,borderRadius:16,padding:"18px",
      textAlign:"center",marginBottom:16}}>
      <span style={{fontFamily:F.h,fontWeight:900,fontSize:52,color:C.text}}>{valor || "0"}</span>
      {sufijo && <span style={{fontSize:22,color:C.mutedD,marginLeft:8}}>{sufijo}</span>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
      {["1","2","3","4","5","6","7","8","9",".","0","←"].map(k=>(
        <button key={k} onClick={()=>{
            if (k==="←") onChange(valor.slice(0,-1));
            else if (k==="." && valor.includes(".")) return;
            else onChange(valor + k);
          }}
          style={{height:86,background:k==="←"?C.card2:"#fff",border:`2px solid ${C.border}`,borderRadius:16,
            fontFamily:F.h,fontWeight:800,fontSize:32,color:C.text,cursor:"pointer"}}>{k}</button>
      ))}
    </div>
  </>
);

// ── Registro de materia y lote
function ModalLote({ mps, prod, onGuardar, onCerrar }) {
  const propias = (prod?.materias_asignadas||[]).map(m=>mps.find(x=>x.id===m.mp_id)).filter(Boolean);
  const lista = propias.length ? propias : mps;
  const [mpId, setMpId] = useState(lista.length===1 ? lista[0].id : "");
  const [lote, setLote] = useState("");
  const [metros, setMetros] = useState("");
  const [campo, setCampo] = useState("lote");
  const mp = mps.find(x=>x.id===mpId);

  if (!mpId) return (
    <CapaTerminal titulo="¿Qué materia estás usando?" onCerrar={onCerrar} color={C.blue}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16}}>
        {lista.map(m=>(
          <BotonGrande key={m.id} alto={110} bg="#fff" borde={C.blue} onClick={()=>setMpId(m.id)}>{m.nombre}</BotonGrande>
        ))}
      </div>
    </CapaTerminal>
  );

  return (
    <CapaTerminal titulo={mp?.nombre || "Materia"} onCerrar={onCerrar} color={C.blue}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <BotonGrande alto={90} bg={campo==="lote"?C.blue:"#fff"} color={campo==="lote"?"#fff":C.text}
          borde={C.blue} sub={lote||"sin poner"} onClick={()=>setCampo("lote")}>LOTE</BotonGrande>
        <BotonGrande alto={90} bg={campo==="metros"?C.blue:"#fff"} color={campo==="metros"?"#fff":C.text}
          borde={C.blue} sub={metros?`${metros} m`:"sin poner"} onClick={()=>setCampo("metros")}>METROS</BotonGrande>
      </div>
      <Teclado valor={campo==="lote"?lote:metros}
        onChange={v=>campo==="lote"?setLote(v):setMetros(v)}
        sufijo={campo==="metros"?"m":null}/>
      <div style={{marginTop:16}}>
        <BotonGrande alto={96} bg={C.green} color="#fff" borde={C.green}
          disabled={!lote && !metros}
          onClick={()=>onGuardar({ materia_id:mpId, lote:lote.trim(), metros_consumidos: toNum(metros) })}>
          ✔ GUARDAR
        </BotonGrande>
      </div>
    </CapaTerminal>
  );
}

// ── Confirmación antes de cerrar el turno
const ModalFin = ({ uds, ritmo, prod, paros, minParados, consumos, guardando, onConfirmar, onCerrar }) => {
  const pct = ritmo>0 ? uds/ritmo : 0;
  const falta = ritmo>0 ? ritmo-uds : 0;
  return (
    <CapaTerminal titulo="¿Cerramos el turno?" onCerrar={onCerrar} color={C.navy}>
      <div style={{background:"#fff",border:`2px solid ${C.border}`,borderRadius:18,padding:22,marginBottom:18,textAlign:"center"}}>
        <div style={{fontSize:19,color:C.mutedD}}>{prod?.nombre}</div>
        <div style={{fontFamily:F.h,fontWeight:900,fontSize:76,color:pct>=1?C.green:C.amber,lineHeight:1.1}}>{num(uds)}</div>
        <div style={{fontSize:19,color:C.mutedD}}>unidades{ritmo>0 && <> · {Math.round(pct*100)}% del turno</>}</div>
        {falta > 0.5 && (
          <div style={{background:C.amberBg,border:`2px solid ${C.amber}`,borderRadius:14,padding:"14px",marginTop:16,
            fontFamily:F.h,fontWeight:800,fontSize:19,color:C.amber}}>
            Faltan {num(falta)} para el objetivo
          </div>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <div style={{background:"#fff",border:`2px solid ${C.border}`,borderRadius:16,padding:"16px",textAlign:"center"}}>
          <div style={{fontFamily:F.h,fontWeight:900,fontSize:34,color:paros.length?C.red:C.green}}>{Math.round(minParados)}</div>
          <div style={{fontSize:15,color:C.mutedD}}>min parados · {paros.length} paros</div>
        </div>
        <div style={{background:"#fff",border:`2px solid ${C.border}`,borderRadius:16,padding:"16px",textAlign:"center"}}>
          <div style={{fontFamily:F.h,fontWeight:900,fontSize:34,color:consumos.length?C.green:C.red}}>{consumos.length}</div>
          <div style={{fontSize:15,color:C.mutedD}}>lotes registrados</div>
        </div>
      </div>
      {consumos.length===0 && (
        <div style={{background:C.redBg,border:`2px solid ${C.red}`,borderRadius:14,padding:"16px",marginBottom:18,
          fontSize:18,color:C.red,fontWeight:700,textAlign:"center",lineHeight:1.5}}>
          ⚠️ No has registrado ningún lote de materia
        </div>
      )}
      <div style={{display:"grid",gap:12}}>
        <BotonGrande alto={104} bg={C.green} color="#fff" borde={C.green} disabled={guardando}
          onClick={onConfirmar}>{guardando ? "Guardando…" : "✔ SÍ, CERRAR TURNO"}</BotonGrande>
        <BotonGrande alto={88} bg="#fff" borde={C.border} onClick={onCerrar}>← Seguir trabajando</BotonGrande>
      </div>
    </CapaTerminal>
  );
};

// ── Confirmación final
const ModalHecho = ({ uds, pct, onSeguir, onSalir }) => (
  <div style={{position:"fixed",inset:0,background:C.green,zIndex:70,display:"flex",flexDirection:"column",
    alignItems:"center",justifyContent:"center",padding:30,gap:22}}>
    <div style={{fontSize:96}}>✔</div>
    <div style={{fontFamily:F.h,fontWeight:900,fontSize:40,color:"#fff",textAlign:"center"}}>Parte guardado</div>
    <div style={{fontFamily:F.h,fontWeight:900,fontSize:72,color:"#fff"}}>{num(uds)} uds</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,width:"100%",maxWidth:620,marginTop:10}}>
      <BotonGrande alto={100} bg="#fff" color={C.green} borde="#fff" onClick={onSeguir}>▶ OTRO PRODUCTO</BotonGrande>
      <BotonGrande alto={100} bg="rgba(255,255,255,0.2)" color="#fff" borde="#fff" onClick={onSalir}>SALIR</BotonGrande>
    </div>
  </div>
);

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
  const [turnosAb, setTurnosAb] = useState("2");
  const [editId, setEditId] = useState(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const add = async () => {
    if (!nombre.trim()) return;
    await save("centros", editId||uid(), { nombre: nombre.trim(), ubicacion: ubicacion.trim(),
      tarifa_mo: toNum(tarifa)||0, turnos_abiertos: parseInt(turnosAb)||2, activo: true });
    setNombre(""); setUbicacion(""); setTarifa(""); setTurnosAb("2"); setEditId(null); setNuevoAbierto(false);
  };
  const startEdit = (x) => { setNuevoAbierto(false); setEditId(x.id); setNombre(x.nombre||""); setUbicacion(x.ubicacion||"");
    setTarifa(x.tarifa_mo?.toString()||""); setTurnosAb((x.turnos_abiertos||2).toString()); window.scrollTo(0,0); };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="CENTROS DE TRABAJO" onBack={onBack} sub="Cada centro produce de forma independiente"/>
      <div style={{padding:14}}>
        <FormPlegable abierto={nuevoAbierto} setAbierto={setNuevoAbierto} editando={!!editId} etiqueta="Centro" onCancelar={()=>{setEditId(null);setNombre("");setUbicacion("");setTarifa("");setTurnosAb("2");}}>
          <Field label="Nombre del centro" value={nombre} onChange={setNombre} placeholder="Ej: Planta Baza"/>
          <Field label="Ubicación (opcional)" value={ubicacion} onChange={setUbicacion} placeholder="Ej: Baza, Granada"/>
          <Field dec label="Tarifa MO de referencia (€/hora)" value={tarifa} onChange={setTarifa} placeholder="15.25" min="0" step="0.01"/>
          <div style={{background:C.blueBg,borderRadius:11,padding:"12px 13px",marginBottom:14}}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:13,color:C.blue,marginBottom:3}}>👥 Capacidad del centro</div>
            <div style={{fontSize:12,color:C.mutedD,marginBottom:11,lineHeight:1.5}}>Cuántos turnos tiene abiertos este centro.</div>
            <Field dec label="Turnos abiertos" value={turnosAb} onChange={setTurnosAb} placeholder="2" min="1" step="1"/>
            <div style={{fontSize:12,color:C.mutedD,marginTop:-8,lineHeight:1.5}}>Las personas de cada línea se ponen en <b>Líneas de Producción</b>, una por una.</div>
          </div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Centro"}</Btn>
        </FormPlegable>
        {centros.length===0 && <Empty icon="🏭" text="Sin centros. Crea al menos uno para poder asignar operarios y productos."/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {centros.map(c=>(
            <Card key={c.id} style={{opacity:c.activo!==false?1:0.5}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:F.h,fontWeight:700,fontSize:18,color:C.text}}>🏭 {c.nombre} {c.activo===false&&<Pill>INACTIVO</Pill>}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:2}}>{c.ubicacion||""}{c.tarifa_mo?` · MO ref: ${c.tarifa_mo} €/h`:""}</div>
                  <div style={{fontSize:12.5,color:C.mutedD,marginTop:3}}>🕐 {c.turnos_abiertos||2} turno{(c.turnos_abiertos||2)!==1?"s":""} abierto{(c.turnos_abiertos||2)!==1?"s":""}</div>
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
  const [pers, setPers] = useState("3");
  const [editId, setEditId] = useState(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const startEdit = (x)=>{ setNuevoAbierto(false); setEditId(x.id); setNombre(x.nombre||""); setCentro(x.centro||""); setPers((x.personas||3).toString()); window.scrollTo(0,0); };
  useEffect(()=>{ if(!centro && centros.length) setCentro(centros[0].id); },[centros.length]);

  const add = async () => {
    if (!nombre.trim() || !centro) return;
    await save("lineas", editId||uid(), { centro, nombre: nombre.trim(), personas: parseInt(pers)||3, activo: true });
    setNombre(""); setPers("3"); setEditId(null); setNuevoAbierto(false);
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="LÍNEAS DE PRODUCCIÓN" onBack={onBack} sub="Una orden nace y muere en su línea"/>
      <div style={{padding:14}}>
        <FormPlegable abierto={nuevoAbierto} setAbierto={setNuevoAbierto} editando={!!editId} etiqueta="Línea" onCancelar={()=>{setEditId(null);setNombre("");setPers("3");}}>
          <Sel label="Centro" value={centro} onChange={setCentro} placeholder="Centro…"
            options={centros.map(x=>({value:x.id,label:`🏭 ${x.nombre}`}))}/>
          <Field label="Nombre de la línea" value={nombre} onChange={setNombre} placeholder="Ej: Maextra / Especta / MX368"/>
          <Field dec label="Personas en la línea" value={pers} onChange={setPers} placeholder="3" min="1" step="1"/>
          <div style={{fontSize:12,color:C.mutedD,marginTop:-8,marginBottom:12,lineHeight:1.5}}>Cuánta gente trabaja en esta línea en un turno. Es lo que la planificación usa para saber si cuadra la plantilla.</div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Línea"}</Btn>
        </FormPlegable>
        {centros.map(ct=>{
          const rows = lineas.filter(l=>l.centro===ct.id);
          if(!rows.length) return null;
          return (
            <div key={ct.id} style={{marginBottom:14}}>
              <div style={{fontFamily:F.h,fontWeight:700,fontSize:13,color:C.mutedD,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>🏭 {ct.nombre} · {rows.length} línea{rows.length!==1?"s":""} · {rows.reduce((a,x)=>a+(parseInt(x.personas)||3),0)} personas/turno</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {rows.map(l=>(
                  <Card key={l.id} style={{opacity:l.activo!==false?1:0.5}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:F.h,fontWeight:700,fontSize:16,color:C.text,wordBreak:"break-word",lineHeight:1.35}}>⚙️ {l.nombre}</div>
                        <div style={{fontSize:12.5,color:C.mutedD,marginTop:2}}>👥 {parseInt(l.personas)||3} persona{(parseInt(l.personas)||3)!==1?"s":""} por turno</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
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
// ═══════════════════════════════════════════════════════════════════════════════
// MOLDES — catálogo cerrado. La planificación agrupa productos por molde.
// ═══════════════════════════════════════════════════════════════════════════════
function MoldesScreen({ onBack, productos }) {
  const [moldes] = useCol("moldes", "nombre");
  const [nombre, setNombre] = useState("");
  const [calibre, setCalibre] = useState("");
  const [minutos, setMinutos] = useState("30");
  const [editId, setEditId] = useState(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const startEdit = (m) => { setNuevoAbierto(false); setEditId(m.id); setNombre(m.nombre||"");
    setCalibre(m.calibre||""); setMinutos((m.minutos_cambio ?? 30).toString()); window.scrollTo(0,0); };
  const add = async () => {
    if (!nombre.trim()) { window.alert("Ponle nombre al molde"); return; }
    const rep = moldes.find(m => m.id !== editId && (m.nombre||"").trim().toLowerCase() === nombre.trim().toLowerCase());
    if (rep) { window.alert("Ya existe un molde con ese nombre."); return; }
    await save("moldes", editId||uid(), { nombre: nombre.trim(), calibre: calibre.trim(), minutos_cambio: toNum(minutos)||30 });
    setNombre(""); setCalibre(""); setMinutos("30"); setEditId(null); setNuevoAbierto(false);
  };

  // Moldes escritos a mano en productos que aún no están en el catálogo
  const sueltos = [...new Set(productos.map(p => (p.molde||"").trim()).filter(Boolean))]
    .filter(t => !moldes.some(m => (m.nombre||"").trim().toLowerCase() === t.toLowerCase()));

  const importar = async () => {
    if (!window.confirm(`Se van a crear ${sueltos.length} molde(s) a partir de lo escrito en los productos:\n\n${sueltos.join(" · ")}\n\n¿Seguir?`)) return;
    for (const t of sueltos) await save("moldes", uid(), { nombre: t, calibre: "", minutos_cambio: 30 });
    window.alert("Creados. Revisa los minutos de cambio de cada uno.");
  };

  const usos = (m) => productos.filter(p => p.molde_id === m.id || (p.molde||"").trim().toLowerCase() === (m.nombre||"").trim().toLowerCase()).length;

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="MOLDES" onBack={onBack} sub="Productos con el mismo molde se fabrican seguidos"/>
      <div style={{padding:14}}>
        <FormPlegable abierto={nuevoAbierto} setAbierto={setNuevoAbierto} editando={!!editId} etiqueta="Molde"
          onCancelar={()=>{setEditId(null);setNombre("");setCalibre("");setMinutos("30");}}>
          <Field label="Nombre del molde" value={nombre} onChange={setNombre} placeholder="Ej: M-68"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Calibre (opcional)" value={calibre} onChange={setCalibre} placeholder="68"/>
            <Field dec label="Cambio (min)" value={minutos} onChange={setMinutos} placeholder="30" min="0" step="1"/>
          </div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Molde"}</Btn>
        </FormPlegable>

        {sueltos.length>0 && (
          <Card style={{marginBottom:14}} color={C.amber+"66"}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.amber,marginBottom:5}}>⚠️ Moldes escritos a mano</div>
            <div style={{fontSize:12.5,color:C.mutedD,lineHeight:1.6,marginBottom:10}}>
              Hay {sueltos.length} molde(s) escrito(s) en productos que no están en este catálogo: {sueltos.join(" · ")}.
              Mientras no estén aquí, la planificación no puede agruparlos.
            </div>
            <Btn v="secondary" onClick={importar}>Crearlos en el catálogo</Btn>
          </Card>
        )}

        {moldes.length===0 && <Empty icon="🔧" text="Sin moldes. Crea los que tengáis en planta y asígnalos en la ficha de cada producto."/>}

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {moldes.map(m=>{
            const n = usos(m);
            return (
              <Card key={m.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.text}}>🔧 {m.nombre}</div>
                    <div style={{fontSize:12.5,color:C.mutedD,marginTop:2}}>
                      {m.calibre?`Calibre ${m.calibre} · `:""}Cambio {m.minutos_cambio ?? 30} min · {n} producto{n!==1?"s":""}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <IconBtn onClick={()=>startEdit(m)}>✏️</IconBtn>
                    <IconBtn danger onClick={()=>{
                      if (n>0) { window.alert(`No se puede borrar: lo usan ${n} producto(s). Cámbialos primero.`); return; }
                      if (window.confirm(`¿Eliminar el molde ${m.nombre}?`)) del("moldes", m.id);
                    }}>🗑️</IconBtn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MotivosScreen({ onBack }) {
  const [motivos] = useCol("motivos_paro", "nombre");
  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("");
  const [editId, setEditId] = useState(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
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
        <FormPlegable abierto={nuevoAbierto} setAbierto={setNuevoAbierto} editando={!!editId} etiqueta="Motivo" onCancelar={()=>{setEditId(null);}}>
          <div style={{display:"grid",gridTemplateColumns:"70px 1fr",gap:10}}>
            <Field label="Icono" value={icono} onChange={setIcono} placeholder="🔧"/>
            <Field label="Motivo" value={nombre} onChange={setNombre} placeholder="Ej: Avería máquina"/>
          </div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Motivo"}</Btn>
          {motivos.length===0 && (
            <div style={{marginTop:12}}>
              <div style={{fontSize:12,color:C.mutedD,marginBottom:8}}>Sugerencia rápida — pulsa para crear los 8 típicos:</div>
              <Btn v="secondary" onClick={async()=>{for(const [ic,nm] of sugerencias){await save("motivos_paro",uid(),{nombre:nm,icono:ic});}}}>⚡ Crear los 8 motivos estándar</Btn>
            </div>
          )}
        </FormPlegable>
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
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
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
        <FormPlegable abierto={nuevoAbierto} setAbierto={setNuevoAbierto} editando={!!editId} etiqueta="Turno" onCancelar={()=>{setEditId(null);}}>
          <Field label="Nombre del turno" value={nombre} onChange={setNombre} placeholder="Ej: Mañana"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Inicio" value={hi} onChange={setHi} type="time"/>
            <Field label="Fin" value={hf} onChange={setHf} type="time"/>
          </div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Turno"}</Btn>
        </FormPlegable>
        {turnos.length===0 && <Empty icon="🕐" text="Sin turnos. Crea Mañana y Tarde."/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {turnos.map(t=>(
            <Card key={t.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text,wordBreak:"break-word",lineHeight:1.35}}>{t.nombre}</div>
                  <div style={{color:C.accent,fontSize:14,fontFamily:F.h,fontWeight:600,marginTop:2}}>{t.hora_inicio} – {t.hora_fin}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
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
  const [tProc, setTProc] = useState("");
  const [tObj, setTObj]   = useState("");
  const [base, setBase]   = useState("ud");   // ud · m
  const [editId, setEditId] = useState(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const startEdit = (p)=>{ setNuevoAbierto(false); setEditId(p.id); setNombre(p.nombre||""); setDiferido(!!p.diferido); setApoyo(!!p.apoyo);
    setTProc(p.tiempo_proceso?.toString()||""); setTObj(p.tiempo_objetivo?.toString()||"");
    setBase(p.base_tiempo||"ud"); window.scrollTo(0,0); };

  const add = async () => {
    if (!nombre.trim()) return;
    await save("procesos", editId||uid(), { nombre: nombre.trim(), diferido, apoyo,
      tiempo_proceso: toNum(tProc), tiempo_objetivo: toNum(tObj), base_tiempo: base });
    setNombre(""); setDiferido(false); setApoyo(false); setTProc(""); setTObj(""); setBase("ud"); setEditId(null); setNuevoAbierto(false);
  };
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="CATÁLOGO DE PROCESOS" onBack={onBack} sub="Reutilizables en todos los productos"/>
      <div style={{padding:14}}>
        <FormPlegable abierto={nuevoAbierto} setAbierto={setNuevoAbierto} editando={!!editId} etiqueta="Proceso" onCancelar={()=>{setEditId(null);}}>
          <Field label="Nombre del proceso" value={nombre} onChange={setNombre} placeholder="Ej: Plisado"/>
          <div style={{background:C.blueBg,borderRadius:11,padding:"12px 13px",marginBottom:14}}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:13,color:C.blue,marginBottom:3}}>⏱️ Tiempos</div>
            <div style={{fontSize:12,color:C.mutedD,marginBottom:10,lineHeight:1.5}}>
              Los dos se precargan al meter este proceso en un producto, donde se pueden cambiar.
              El <b>tiempo de proceso</b> es el que calcula el coste; el <b>objetivo</b> es la meta.
            </div>
            <div style={{fontSize:11,color:C.mutedD,fontWeight:800,marginBottom:6}}>¿CÓMO SE MIDE ESTE PROCESO?</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[["ud","Por unidad","cada stick"],["m","Por metro","desalado, estirado…"]].map(([k,t,d])=>(
                <button key={k} onClick={()=>setBase(k)}
                  style={{background:base===k?C.blue:"#fff",color:base===k?"#fff":C.text,
                    border:`1.5px solid ${base===k?C.blue:C.border}`,borderRadius:11,padding:"11px 6px",
                    fontFamily:F.h,fontWeight:800,fontSize:13.5,cursor:"pointer",textAlign:"center"}}>
                  <div>{t}</div>
                  <div style={{fontSize:10,fontWeight:600,opacity:0.75,marginTop:2}}>{d}</div>
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field dec label={`Tiempo de proceso (min/${base})`} value={tProc} onChange={setTProc} placeholder={base==="m"?"0.14":"1.40"} min="0" step="0.01"/>
              <Field dec label={`Tiempo objetivo (min/${base})`} value={tObj} onChange={setTObj} placeholder={base==="m"?"0.07":"1.20"} min="0" step="0.01"/>
            </div>
            {base==="m" && (
              <div style={{background:"#fff",borderRadius:9,padding:"9px 11px",marginBottom:10,fontSize:12,color:C.mutedD,lineHeight:1.55}}>
                En cada producto se convertirá a minutos por unidad multiplicando por sus metros: <b>min/m × metros por ud</b>.
              </div>
            )}
            {toNum(tProc)>0 && toNum(tObj)>0 && (
              <div style={{fontSize:12.5,color:toNum(tObj)<toNum(tProc)?C.green:C.mutedD,fontWeight:700,lineHeight:1.5}}>
                {toNum(tObj)<toNum(tProc)
                  ? `Margen de mejora: ${(toNum(tProc)-toNum(tObj)).toFixed(2)} min/ud (${Math.round((1-toNum(tObj)/toNum(tProc))*100)}%)`
                  : "El objetivo no es más exigente que el tiempo actual."}
              </div>
            )}
          </div>
          <button onClick={()=>setDiferido(d=>!d)}
            style={{background:"#fff",border:`1.5px solid ${diferido?C.amber:C.border}`,color:diferido?C.amber:C.muted,borderRadius:20,padding:"6px 16px",fontSize:14,fontFamily:F.h,fontWeight:600,cursor:"pointer",marginBottom:12}}>
            {diferido?"⏭ Diferido (se hace al día siguiente)":"◯ Diferido (día siguiente)"}
          </button>
          <button onClick={()=>setApoyo(a=>!a)}
            style={{background:"#fff",border:`1px solid ${apoyo?C.blue:C.border}`,color:apoyo?C.blue:C.muted,borderRadius:20,padding:"6px 16px",fontSize:14,fontFamily:F.h,fontWeight:600,cursor:"pointer",marginBottom:12,marginLeft:8}}>
            {apoyo?"🤝 Fuera de línea (lo hace un operario de apoyo)":"◯ Fuera de línea (apoyo)"}
          </button>
          <div style={{fontSize:12,color:C.mutedD,lineHeight:1.55,marginBottom:12}}>
            <b>Fuera de línea</b>: lo hace alguien que no está en el equipo de la línea, como el desalado.
            Su tiempo cuenta en el coste y en la plantilla, pero no ocupa hueco de línea en la planificación.
          </div>
          <Btn v="ghost" onClick={add}>{editId?"💾 Guardar cambios":"＋ Añadir Proceso"}</Btn>
        </FormPlegable>
        {procesos.length===0 && <Empty icon="⚙️" text="Sin procesos. Ej: Estirar, Ensanchar, Plisar…"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {procesos.map(p=>(
            <Card key={p.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:F.h,fontWeight:700,fontSize:16.5,color:C.text,lineHeight:1.35,wordBreak:"break-word"}}>{p.nombre}</div>
                  <div style={{fontSize:12.5,color:C.mutedD,marginTop:3}}>
                    {toNum(p.tiempo_proceso)>0 || toNum(p.tiempo_objetivo)>0
                      ? <>⏱️ actual <b style={{color:C.text}}>{toNum(p.tiempo_proceso)||"—"}</b> · objetivo <b style={{color:C.blue}}>{toNum(p.tiempo_objetivo)||"—"}</b> min/{p.base_tiempo||"ud"}
                          {(p.base_tiempo==="m") && <span style={{color:C.blue,fontWeight:700}}> · por metro</span>}</>
                      : <span style={{color:C.amber,fontWeight:700}}>⚠️ sin tiempos definidos</span>}
                  </div>
                  {(p.diferido || p.apoyo) && (
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
                      {p.diferido && <Pill color={C.amber} bg={C.amberBg}>⏭ DIFERIDO</Pill>}
                      {p.apoyo && <Pill color={C.blue} bg={C.blueBg}>🤝 FUERA DE LÍNEA</Pill>}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  <IconBtn onClick={()=>startEdit(p)}>✏️</IconBtn>
                  <IconBtn danger onClick={()=>{
                    const n = procEnUso(p.id);
                    if (n>0) { window.alert(`⛔ No se puede borrar: ${n} productos usan este proceso. Quítalo primero de esos productos.`); return; }
                    if(window.confirm("¿Eliminar proceso del catálogo?")) del("procesos",p.id);
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
  const [moldes] = useCol("moldes", "nombre");
  const [edit, setEdit] = useState(null);
  const [busq, setBusq] = useState("");
  const normB = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const infoLB = p => [p.descripcion, p.calibre_catalogo?`Ø${p.calibre_catalogo}`:null, p.metros_finales?`${p.metros_finales} m`:(p.medida_catalogo?`${p.medida_catalogo} m`:null)].filter(Boolean).join(" · ") || prodInfo(p.nombre).linea2 || "";
  const términosB = normB(busq).split(/\s+/).filter(Boolean);
  const productosFiltrados = términosB.length===0 ? productos : productos.filter(p=>{
    const hay = normB(p.nombre+" "+(p.descripcion||"")+" "+(p.calibre_catalogo||""));
    return términosB.every(t=>hay.includes(t));
  });
  if (edit !== null) return <ProductoForm moldes={moldes} onBack={()=>setEdit(null)} ep={edit.id?edit:null} procesos={procesos} mps={mps} centros={centros}/>;

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
                    {p.molde && <>{" · "}<span style={{color:C.blue,fontWeight:700}}>🔧 {p.molde}</span></>}
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

// Input pequeño para editar en línea dentro del escandallo
const NumIn = ({ value, onChange, suf, w=72, step="0.01", ph="" }) => (
  <div style={{display:"flex",alignItems:"center",gap:4}}>
    <input type="text" inputMode="decimal" value={value??""} placeholder={ph}
      onChange={e=>onChange(e.target.value.replace(/[^0-9.,]/g,""))}
      style={{width:w,padding:"9px 8px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:15,
        fontFamily:F.h,fontWeight:700,textAlign:"right",background:"#fff",color:C.text,boxSizing:"border-box"}}/>
    {suf && <span style={{fontSize:12,color:C.mutedD,whiteSpace:"nowrap"}}>{suf}</span>}
  </div>
);

function ProductoForm({ onBack, ep, procesos, mps, centros, moldes = [] }) {
  const [nombre, setNombre] = useState(ep?.nombre||"");
  const [centro, setCentro] = useState(ep?.centro||"");
  const [unidad, setUnidad] = useState(ep?.unidad||"Stick");
  const [coste, setCoste]   = useState(ep?.coste_objetivo?.toString()||"");
  const [precioVenta, setPrecioVenta] = useState(ep?.precio_venta?.toString()||"");
  const [mFinales, setMFinales] = useState(ep?.metros_finales?.toString()||"");
  const [objDiario, setObjDiario] = useState(ep?.objetivo_diario?.toString()||"");
  const [udsTurno, setUdsTurno] = useState(ep?.uds_turno_linea?.toString()||"");
  const [persLinea, setPersLinea] = useState(ep?.personas_linea?.toString()||"3");
  const [moldeId, setMoldeId] = useState(ep?.molde_id
    || (ep?.molde ? (moldes.find(m=>(m.nombre||"").trim().toLowerCase()===(ep.molde||"").trim().toLowerCase())?.id || "") : ""));
  const [pa, setPa]         = useState(ep?.procesos_asignados||[]); // [{proceso_id,min_obj,define_cantidad}]
  const [ma, setMa]         = useState(ep?.materias_asignadas||[]); // [{mp_id,capas,precio_ud,rendimiento}]
  const [selProc, setSelProc] = useState("");
  const [minReal, setMinReal] = useState("");
  const [minObj, setMinObj]   = useState("");
  const [capasProc, setCapasProc] = useState("");
  // el tiempo objetivo del catálogo se precarga, pero se puede cambiar aquí
  useEffect(()=>{
    if (!selProc) { setMinReal(""); setMinObj(""); return; }
    const c = procesos.find(p=>p.id===selProc);
    const tr = toNum(c?.tiempo_proceso), to = toNum(c?.tiempo_objetivo);
    setMinReal(tr>0 ? String(tr) : (to>0 ? String(to) : ""));
    setMinObj(to>0 ? String(to) : (tr>0 ? String(tr) : ""));
    setCapasProc(c?.base_tiempo === "m" ? "1" : "");
  },[selProc]);
  const [selMp, setSelMp]     = useState("");
  const [capas, setCapas]     = useState("");
  const [precioMp, setPrecioMp] = useState("");
  const [rendMp, setRendMp]     = useState("");

  const tarifaMO = centros.find(c=>c.id===centro)?.tarifa_mo || TARIFA_MO;

  const onSelMp = (id) => {
    setSelMp(id);
    const m = mps.find(x=>x.id===id);
    setPrecioMp(m?.precio_ud?.toString()||"");
    setRendMp(m?.rendimiento_objetivo?.toString()||"85");
  };

  // Coste de materia prima objetivo por línea del escandallo: metros teóricos ÷ rendimiento × precio
  const costeMatLinea = (capasN, precioN, rendN) => {
    const metros = toNum(mFinales) * capasN;
    const rend = rendN>0 ? rendN/100 : 1;
    return rend>0 ? (metros/rend)*precioN : 0;
  };
  const costeMPTotal = ma.reduce((s,x)=>s+costeMatLinea(toNum(x.capas), toNum(x.precio_ud), toNum(x.rendimiento)||100), 0);
  // Coste de mano de obra objetivo por proceso: minutos/ud ÷ 60 × tarifa del centro
  const costeProcLinea = (minObjN) => (minObjN/60)*tarifaMO;
  // Un proceso por metro trata los metros de las capas que él toca
  const metrosUd  = toNum(mFinales);
  const capasProcDe = (x) => toNum(x.capas) || 1;
  const metrosDe  = (x) => metrosUd * capasProcDe(x);
  // campo="real" es lo que cuesta hoy · campo="obj" es la meta
  const minPorUd = (x, campo="real") => {
    const cat = procesos.find(p=>p.id===x.proceso_id);
    const b = x.base_tiempo || cat?.base_tiempo || "ud";
    const t = campo==="obj" ? toNum(x.min_obj) : (toNum(x.min_real) || toNum(x.min_obj));
    return b === "m" ? t * metrosDe(x) : t;
  };
  const costeMOTotal = pa.reduce((s,x)=>s+costeProcLinea(minPorUd(x,"real")), 0);
  // ── Velocidad que debería dar la línea con estos tiempos
  const MIN_TURNO = 450;            // 7,5 h productivas (8 h menos 0,5 de descanso)
  const enLinea = pa.filter(x => !procesos.find(p=>p.id===x.proceso_id)?.apoyo);
  const nPers = parseInt(persLinea)||3;
  const minLinea = (campo) => enLinea.reduce((a,x)=>a+minPorUd(x,campo), 0);
  const cuello = (campo) => enLinea.reduce((a,x)=>Math.max(a, minPorUd(x,campo)), 0);
  // El equipo se reparte el trabajo: minutos disponibles ÷ minutos por stick
  const minEquipo  = MIN_TURNO * nPers;
  const velEquipo  = (campo) => minLinea(campo)>0 ? minEquipo/minLinea(campo) : 0;
  const velPuestos = velEquipo;   // referencia única
  const costeMOMeta  = pa.reduce((s,x)=>s+costeProcLinea(minPorUd(x,"obj")), 0);
  const costeCalculado = costeMPTotal + costeMOTotal;
  const costeFinal = toNum(coste);
  const pv = toNum(precioVenta);
  const margenPct = pv>0 ? ((pv-costeFinal)/pv*100) : null;

  const addProc = () => {
    if (!selProc) return;
    if (!(toNum(minReal) > 0) && !(toNum(minObj) > 0)) { window.alert("Pon al menos el tiempo real"); return; }
    if (pa.find(x=>x.proceso_id===selProc)) return;
    const catSel = procesos.find(p=>p.id===selProc);
    if (catSel?.base_tiempo === "m" && !(toNum(capasProc) > 0)) { window.alert("Pon cuántas capas trata este proceso"); return; }
    setPa(prev=>[...prev,{proceso_id:selProc,min_real:toNum(minReal)||toNum(minObj),min_obj:toNum(minObj),
      base_tiempo: catSel?.base_tiempo||"ud",
      capas: catSel?.base_tiempo==="m" ? (toNum(capasProc)||1) : null,
      define_cantidad:prev.length===0}]);
    setSelProc(""); setMinReal(""); setMinObj(""); setCapasProc("");
  };
  const addMp = () => {
    if (!selMp) { window.alert("Elige una materia prima"); return; }
    if (ma.find(x=>x.mp_id===selMp)) { window.alert("Esa materia ya está en el escandallo. Edítala arriba."); return; }
    const g = mps.find(z=>z.id===selMp);
    setMa(prev=>[...prev,{ mp_id:selMp,
      capas: toNum(capas)||1,
      precio_ud: toNum(precioMp)||parseFloat(g?.precio_ud)||0,
      rendimiento: toNum(rendMp)||parseFloat(g?.rendimiento_objetivo)||85 }]);
    setSelMp(""); setCapas(""); setPrecioMp(""); setRendMp("");
  };
  const guardar = async () => {
    if (!nombre.trim()) return;
    if (!centro) { alert("Asigna el producto a un centro"); return; }
    await save("productos", ep?.id||uid(), {
      nombre: nombre.trim(), centro, unidad: unidad.trim()||"ud",
      coste_objetivo: toNum(coste),
      coste_mp_objetivo: costeMPTotal, coste_mo_objetivo: costeMOTotal, coste_mo_meta: costeMOMeta,
      precio_venta: pv||null,
      metros_finales: toNum(mFinales),
      objetivo_diario: toNum(objDiario),
      uds_turno_linea: toNum(udsTurno),
      personas_linea: parseInt(persLinea)||3,
      molde_id: moldeId,
      molde: moldes.find(m=>m.id===moldeId)?.nombre || "",
      procesos_asignados: pa.map(x=>({...x, min_real: toNum(x.min_real)||toNum(x.min_obj), min_obj: toNum(x.min_obj), capas: x.capas==null?null:(toNum(x.capas)||1)})),
      materias_asignadas: ma.map(x=>({...x, capas: toNum(x.capas), precio_ud: toNum(x.precio_ud), rendimiento: toNum(x.rendimiento)||85 })),
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
            <Field dec label="Metros finales/ud" value={mFinales} onChange={setMFinales} type="number" placeholder="10" min="0" step="0.1"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field dec label="Objetivo diario (uds)" value={objDiario} onChange={setObjDiario} type="number" placeholder="100" min="0" step="1"/>
            <Field dec label="Precio medio de venta (€)" value={precioVenta} onChange={setPrecioVenta} type="number" placeholder="9.00" min="0" step="0.01"/>
          </div>
        </Card>

        {/* RITMO — base de la planificación */}
        <Card style={{marginBottom:14}} color={C.blue+"55"}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:3}}>⏱️ Ritmo de fabricación</div>
          <div style={{fontSize:12,color:C.mutedD,marginBottom:12,lineHeight:1.5}}>Cuántas unidades salen de <b>una línea en un turno</b>. Es la base de toda la planificación: sin este dato el plan no puede calcular recursos.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field dec label="Uds por turno-línea" value={udsTurno} onChange={setUdsTurno} type="number" placeholder="150" min="0" step="1"/>
            <Field dec label="Personas que necesita" value={persLinea} onChange={setPersLinea} placeholder="3" min="1" step="1"/>
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:12,marginBottom:12}}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:13,color:C.text,marginBottom:3}}>🔧 Molde</div>
            <div style={{fontSize:12,color:C.mutedD,marginBottom:11,lineHeight:1.5}}>Elígelo del catálogo. Los productos que comparten molde se pueden fabricar seguidos sin parar la línea.</div>
            {moldes.length===0
              ? <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:10,padding:"10px 12px",fontSize:12.5,color:C.amber,fontWeight:700,lineHeight:1.5}}>
                  No hay moldes en el catálogo. Créalos en la pantalla <b>Moldes</b> y vuelve aquí.
                </div>
              : <>
                  <Sel label="Molde que utiliza" value={moldeId} onChange={setMoldeId} placeholder="Sin molde asignado"
                    options={moldes.map(m=>({value:m.id,label:`🔧 ${m.nombre}${m.calibre?` · cal ${m.calibre}`:""}`}))}/>
                  {moldeId && (()=>{ const m = moldes.find(z=>z.id===moldeId); return (
                    <div style={{fontSize:12,color:C.mutedD,marginTop:-8,lineHeight:1.5}}>Cambiar a este molde cuesta <b>{m?.minutos_cambio ?? 30} min</b>. Se edita en la pantalla Moldes.</div>
                  ); })()}
                </>}
          </div>
          {(() => {
            const nP = parseInt(persLinea)||3;
            const costeTurno = nP * 8 * TARIFA_MO;
            const puesto = toNum(udsTurno);
            const teor = velPuestos("real");
            const fila = (tit, uds, sub, destacar) => (
              <div style={{background: destacar ? C.blueBg : "#fff", border:`1.5px solid ${destacar?C.blue:C.border}`,
                borderRadius:11,padding:"11px 12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                  <span style={{fontFamily:F.h,fontWeight:800,fontSize:13,color:C.text}}>{tit}</span>
                  <span style={{flexShrink:0,textAlign:"right"}}>
                    <span style={{fontFamily:F.h,fontWeight:900,fontSize:19,color:C.text}}>{Math.floor(uds)}</span>
                    <span style={{fontSize:11.5,color:C.mutedD,fontWeight:600}}> uds/turno</span>
                  </span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginTop:3}}>
                  <span style={{fontSize:11,color:C.mutedD,lineHeight:1.5}}>{sub}</span>
                  <b style={{fontSize:15,color:C.green,flexShrink:0}}>{uds>0 ? (costeTurno/uds).toFixed(2) : "—"} €/ud</b>
                </div>
              </div>
            );
            if (!puesto && !teor) return null;
            return (
              <>
                <div style={{fontFamily:F.h,fontWeight:800,fontSize:12,color:C.mutedD,marginBottom:7,letterSpacing:0.3}}>
                  MANO DE OBRA SEGÚN EL RITMO
                </div>
                {puesto>0 && fila("Con el ritmo que has puesto", puesto,
                  `${nP} personas × 8 h × ${TARIFA_MO} €/h ÷ ${num(puesto)} uds`, true)}
                {teor>0 && fila("Con los tiempos de los procesos", teor,
                  `${minLinea("real").toFixed(2)} min por ${unidad||"ud"} ÷ ${nP} personas`, false)}
                {puesto>0 && teor>0 && Math.abs(puesto-teor) > 0.5 && (
                  <div style={{background: puesto>teor ? C.redBg : C.greenBg,
                    border:`1.5px solid ${puesto>teor?C.red:C.green}`,borderRadius:10,padding:"10px 12px",
                    fontSize:12.5,color:puesto>teor?C.red:C.green,fontWeight:700,lineHeight:1.6}}>
                    {puesto>teor
                      ? <>⚠️ El ritmo puesto es un {Math.round((puesto/teor-1)*100)}% más rápido de lo que dan los procesos.
                          Estás costeando a <b>{(costeTurno/puesto).toFixed(2)} €</b> algo que sale por <b>{(costeTurno/teor).toFixed(2)} €</b>:
                          te dejas <b>{((costeTurno/teor)-(costeTurno/puesto)).toFixed(2)} €/ud</b> sin contar.</>
                      : <>El ritmo puesto es más lento que los procesos, así que el coste va del lado seguro:
                          <b> {((costeTurno/puesto)-(costeTurno/teor)).toFixed(2)} €/ud</b> de más.</>}
                  </div>
                )}
                {teor>0 && (
                  <button onClick={()=>setUdsTurno(String(Math.floor(teor)))}
                    style={{width:"100%",marginTop:8,background:"#fff",border:`1.5px solid ${C.blue}55`,color:C.blue,
                      borderRadius:10,padding:"10px",fontFamily:F.h,fontWeight:800,fontSize:12.5,cursor:"pointer"}}>
                    Usar {Math.floor(teor)} uds/turno, el que dan los procesos
                  </button>
                )}
                <div style={{fontSize:11,color:C.mutedD,marginTop:8,lineHeight:1.55}}>
                  Consume <b>{(nP/3).toFixed(2).replace(/\.00$/,"")}</b> hueco{(nP/3)!==1?"s":""} de línea.
                  {enLinea.length===0 && " Añade procesos abajo para que se calcule la velocidad teórica."}
                </div>
              </>
            );
          })()}
        </Card>

        {/* PROCESOS */}
        <Card style={{marginBottom:14}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text,marginBottom:4}}>PROCESOS</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Del catálogo global, con tiempo objetivo por {unidad||"ud"}. ★ = define la cantidad producida</div>
          <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:8}}>Tarifa del centro: {tarifaMO.toFixed(2)} €/h — el coste de mano de obra se calcula solo</div>
          {Math.abs(tarifaMO - TARIFA_MO) > 0.01 && (
            <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:12.5,color:C.amber,fontWeight:700,lineHeight:1.55}}>
              ⚠️ Este centro tiene {tarifaMO.toFixed(2)} €/h, pero el coste real de nómina es {TARIFA_MO} €/h. El coste de mano de obra te está saliendo {tarifaMO<TARIFA_MO?"más barato":"más caro"} de lo que es. Corrígelo en Costes Fijos.
            </div>
          )}
          {pa.map(x=>{
            const pr = procesos.find(z=>z.id===x.proceso_id);
            const cst = costeProcLinea(minPorUd(x,"real"));
            return (
              <div key={x.proceso_id} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:F.h,fontWeight:700,fontSize:15.5,color:C.text,wordBreak:"break-word",lineHeight:1.35}}>{pr?.diferido?"⏭ ":""}{pr?.nombre||"?"}</div>
                    <div style={{color:C.accent,fontSize:13,fontWeight:600,marginTop:2}}>min/{unidad||"ud"}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <button onClick={()=>setPa(prev=>prev.map(z=>({...z,define_cantidad:z.proceso_id===x.proceso_id})))}
                      style={{background:"#fff",border:`1.5px solid ${x.define_cantidad?C.green:C.border}`,color:x.define_cantidad?C.green:C.muted,borderRadius:20,padding:"3px 12px",fontSize:12,fontFamily:F.h,fontWeight:600,cursor:"pointer"}}>
                      {x.define_cantidad?"★ Define qty":"◯"}
                    </button>
                    <button onClick={()=>setPa(prev=>prev.filter(z=>z.proceso_id!==x.proceso_id))}
                      style={{background:"none",border:"none",color:C.red,fontSize:18,cursor:"pointer"}}>✕</button>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:6,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:10.5,color:C.mutedD,fontWeight:800,marginBottom:3}}>REAL</div>
                    <NumIn value={x.min_real ?? x.min_obj} step="0.01" suf={`min/${(x.base_tiempo||pr?.base_tiempo)==="m" ? "m" : (unidad||"ud")}`}
                      onChange={v=>setPa(prev=>prev.map(z=>z.proceso_id===x.proceso_id?{...z,min_real:v}:z))}/>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,color:C.blue,fontWeight:800,marginBottom:3}}>OBJETIVO</div>
                    <NumIn value={x.min_obj} step="0.01" suf={`min/${(x.base_tiempo||pr?.base_tiempo)==="m" ? "m" : (unidad||"ud")}`}
                      onChange={v=>setPa(prev=>prev.map(z=>z.proceso_id===x.proceso_id?{...z,min_obj:v}:z))}/>
                  </div>
                  <span style={{marginLeft:"auto",textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:F.h,fontWeight:900,fontSize:17,color:C.text,lineHeight:1.1}}>
                      {minPorUd(x,"real").toFixed(2)}
                    </div>
                    <div style={{fontSize:10.5,color:C.mutedD}}>min/{unidad||"ud"}</div>
                  </span>
                  <span style={{fontSize:12.5,color:cst>0?C.green:C.red,fontWeight:800,width:"100%"}}>
                    {cst>0 ? `→ ${cst.toFixed(3)} €/${unidad||"ud"} de mano de obra` : "⚠️ falta el tiempo"}
                  </span>
                  {(()=>{ const co = costeProcLinea(minPorUd(x,"obj"));
                    if (!(cst>0) || Math.abs(cst-co) < 0.0005) return null;
                    return <span style={{fontSize:11.5,color:C.blue,fontWeight:700}}>
                      (al objetivo {co.toFixed(3)} €)
                    </span>; })()}
                  {(()=>{ const b = x.base_tiempo||pr?.base_tiempo||"ud";
                    if (b!=="m") return null;
                    return (
                      <span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:11.5,color:C.mutedD,fontWeight:700}}>×</span>
                        <NumIn value={x.capas ?? 1} step="1" w={56} suf="capas"
                          onChange={v=>setPa(prev=>prev.map(z=>z.proceso_id===x.proceso_id?{...z,capas:v}:z))}/>
                        <span style={{fontSize:11.5,color:C.blue,fontWeight:700}}>
                          = {metrosDe(x)} m/ud → {minPorUd(x).toFixed(2)} min/{unidad||"ud"}
                        </span>
                      </span>
                    ); })()}
                  {(()=>{ const tc = toNum(pr?.tiempo_objetivo), b = x.base_tiempo||pr?.base_tiempo||"ud";
                    if (!tc || Math.abs(tc - toNum(x.min_obj)) < 0.005) return null;
                    return <span style={{fontSize:11.5,color:C.amber,fontWeight:700}}>
                      (catálogo: {tc} min/{b})
                    </span>; })()}
                </div>
              </div>
            );
          })}
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <Sel label="Añadir proceso" value={selProc} onChange={setSelProc} placeholder="Elegir del catálogo…"
              options={procesos.filter(p=>!pa.find(x=>x.proceso_id===p.id)).map(p=>({
                value:p.id,
                label:`${p.nombre}${toNum(p.tiempo_proceso)>0?`  ·  ${toNum(p.tiempo_proceso)} min/${p.base_tiempo||"ud"}`:""}` }))}/>
            {selProc && (()=>{
              const c = procesos.find(p=>p.id===selProc);
              const tObj = toNum(c?.tiempo_objetivo), tAct = toNum(c?.tiempo_proceso);
              return (
                <div style={{background:tObj||tAct?C.blueBg:C.amberBg,borderRadius:10,padding:"10px 12px",marginBottom:12,
                  fontSize:12.5,color:tObj||tAct?C.text:C.amber,fontWeight:tObj||tAct?400:700,lineHeight:1.6}}>
                  {tObj||tAct
                    ? <>Del catálogo: proceso <b>{tAct||"—"}</b> · objetivo <b>{tObj||"—"}</b> min/{c?.base_tiempo||"ud"}. Se han puesto los dos; cámbialos si este producto tarda distinto.
                        {c?.base_tiempo==="m" && <div style={{marginTop:4,color:C.blue,fontWeight:700}}>
                          Se mide por metro: dime cuántas capas trata en este producto.
                        </div>}</>
                    : <>⚠️ Este proceso no tiene tiempos en el catálogo. Escríbelo aquí o defínelos en Procesos.</>}
                </div>
              );
            })()}
            {(() => {
              const porM = procesos.find(p=>p.id===selProc)?.base_tiempo === "m";
              const mReales = toNum(mFinales) * (toNum(capasProc)||0);
              return (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr", gap:10}}>
                    <Field dec label={`Tiempo REAL (min/${porM ? "m" : (unidad||"ud")})`} value={minReal} onChange={setMinReal} placeholder="1.40" min="0.01" step="0.01"/>
                    <Field dec label={`Objetivo (min/${porM ? "m" : (unidad||"ud")})`} value={minObj} onChange={setMinObj} placeholder="1.20" min="0.01" step="0.01"/>
                  </div>
                  {porM && <Field dec label="¿Cuántas capas trata?" value={capasProc} onChange={setCapasProc} placeholder="2" min="1" step="1"/>}
                  <div style={{fontSize:11.5,color:C.mutedD,lineHeight:1.55,marginBottom:10}}>
                    El coste del producto se calcula con el <b>tiempo real</b>. El objetivo sirve para ver cuánto se ganaría alcanzándolo.
                  </div>
                  {porM && (
                    <div style={{background: mReales>0 ? C.blueBg : C.amberBg, borderRadius:10,padding:"10px 12px",marginBottom:12,
                      fontSize:12.5,color: mReales>0 ? C.text : C.amber, fontWeight: mReales>0 ? 400 : 700, lineHeight:1.6}}>
                      {mReales>0
                        ? <>Metros reales: <b>{toNum(mFinales)} m × {toNum(capasProc)} capa{toNum(capasProc)!==1?"s":""} = {mReales} m/ud</b>
                            <div style={{color:C.blue,fontWeight:700,marginTop:2}}>{toNum(minObj)||0} × {mReales} = {((toNum(minObj)||0)*mReales).toFixed(2)} min/{unidad||"ud"}</div></>
                        : <>⚠️ Pon cuántas capas trata este proceso. El MX3xx lleva 3, el MX2xx y el Especta 2.</>}
                    </div>
                  )}
                  <button onClick={addProc} style={{width:"100%",background:C.accent,border:"none",color:"#fff",borderRadius:12,padding:"15px",fontFamily:F.h,fontWeight:800,fontSize:15,cursor:"pointer",marginBottom:14}}>＋ Añadir proceso</button>
                </>
              );
            })()}
          </div>
          {pa.length>0 && (() => {
            const totReal = pa.reduce((a,x)=>a+minPorUd(x,"real"), 0);
            const totObj  = pa.reduce((a,x)=>a+minPorUd(x,"obj"), 0);
            const totLinea = minLinea("real");
            const totApoyo = totReal - totLinea;
            return (
              <div style={{background:C.card2,borderRadius:11,padding:"12px 13px",marginTop:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontFamily:F.h,fontWeight:800,fontSize:13.5,color:C.text}}>TIEMPO TOTAL POR {(unidad||"UD").toUpperCase()}</span>
                  <b style={{fontFamily:F.h,fontSize:22,color:C.text}}>{totReal.toFixed(2)} <span style={{fontSize:12,color:C.mutedD,fontWeight:600}}>min</span></b>
                </div>
                <div style={{fontSize:11.5,color:C.mutedD,marginTop:4,lineHeight:1.6}}>
                  {totApoyo>0.005
                    ? <>{totLinea.toFixed(2)} min en línea + {totApoyo.toFixed(2)} min fuera de línea</>
                    : <>Todo en línea</>}
                  {totObj>0 && Math.abs(totReal-totObj)>0.005 &&
                    <> · al objetivo serían <b style={{color:C.green}}>{totObj.toFixed(2)} min</b> ({(totReal-totObj).toFixed(2)} menos)</>}
                </div>
              </div>
            );
          })()}

          {pa.length>0 && costeMOMeta>0 && Math.abs(costeMOTotal-costeMOMeta)>0.005 && (
            <div style={{background:C.blueBg,borderRadius:10,padding:"10px 12px",marginTop:10,fontSize:12.5,color:C.text,lineHeight:1.6}}>
              Si se alcanzaran los objetivos: <b>{costeMOMeta.toFixed(2)} €/{unidad||"ud"}</b>
              <b style={{color:C.green}}> · {(costeMOTotal-costeMOMeta).toFixed(2)} € menos por unidad</b>
            </div>
          )}
          {pa.length>0 && (
            <div style={{marginTop:10,paddingTop:10,borderTop:`1.5px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontFamily:F.h,fontWeight:700,fontSize:14,color:C.text}}>MANO DE OBRA (tiempos reales)</span>
              <span style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.green}}>{costeMOTotal.toFixed(2)} €/{unidad||"ud"}</span>
            </div>
          )}
        </Card>

        {/* VELOCIDAD QUE DEBERÍA DAR LA LÍNEA */}
        {enLinea.length>0 && minLinea("real")>0 && (
          <Card style={{marginBottom:14}} color={C.blue+"66"}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:12}}>🏃 Cuántas se pueden hacer en un turno</div>

            {(() => {
              const tot = pa.reduce((a,x)=>a+minPorUd(x,"real"), 0);
              const apoyo = tot - minLinea("real");
              return (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"7px 0",fontSize:13.5}}>
                  <span style={{color:C.mutedD}}>
                    Trabajo <b style={{color:C.text}}>en línea</b> por {unidad||"unidad"}
                    {apoyo>0.005 && <div style={{fontSize:11,color:C.muted}}>de {tot.toFixed(2)} min totales · {apoyo.toFixed(2)} los hace apoyo</div>}
                  </span>
                  <b style={{fontSize:17,color:C.text,flexShrink:0}}>{minLinea("real").toFixed(2)} min</b>
                </div>
              );
            })()}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"7px 0",fontSize:13.5,borderTop:`1px solid ${C.border}`}}>
              <span style={{color:C.mutedD}}>Minutos del turno · {nPers} persona{nPers!==1?"s":""} × 7,5 h</span>
              <b style={{fontSize:17,color:C.text}}>{num(minEquipo)} min</b>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"9px 0",fontSize:14,
              borderTop:`1.5px solid ${C.blue}55`,marginTop:2}}>
              <span style={{fontFamily:F.h,fontWeight:800,color:C.blue}}>SE PUEDEN HACER</span>
              <b style={{fontFamily:F.h,fontSize:24,color:C.blue}}>{Math.floor(velEquipo("real"))} <span style={{fontSize:13,color:C.mutedD,fontWeight:600}}>por turno</span></b>
            </div>
            <div style={{fontSize:11.5,color:C.mutedD,lineHeight:1.55,marginBottom:12}}>
              {num(minEquipo)} ÷ {minLinea("real").toFixed(2)} = {Math.floor(velEquipo("real"))}. Jornada de 8 h menos 0,5 de descanso. No cuentan los procesos fuera de línea.
            </div>

            {(() => {
              const tot = pa.reduce((a,x)=>a+minPorUd(x,"real"), 0);
              const apoyoMin = tot - minLinea("real");
              if (apoyoMin <= 0.005) return null;
              const uds = Math.floor(velEquipo("real"));
              const minNec = apoyoMin * uds;
              const persNec = minNec / MIN_TURNO;
              const cuellos = persNec > 1.05;
              return (
                <div style={{background: cuellos ? C.amberBg : C.card2, border: cuellos?`1.5px solid ${C.amber}`:"none",
                  borderRadius:11,padding:"11px 12px",marginBottom:10,fontSize:12.5,color:C.text,lineHeight:1.6}}>
                  <div style={{fontFamily:F.h,fontWeight:800,fontSize:12.5,color:cuellos?C.amber:C.mutedD,marginBottom:3}}>
                    🤝 EL APOYO TIENE QUE SEGUIR EL RITMO
                  </div>
                  Para sacar {uds} {unidad||"uds"} hacen falta <b>{num(Math.round(minNec))} min</b> de trabajo fuera de línea
                  ({apoyoMin.toFixed(2)} min × {uds}) = <b style={{color:cuellos?C.amber:C.text}}>{persNec.toFixed(1)} personas</b> de apoyo.
                  {cuellos && <div style={{color:C.amber,fontWeight:700,marginTop:4}}>
                    Con 1 sola persona de apoyo la línea no pasaría de <b>{Math.floor(MIN_TURNO/apoyoMin)} {unidad||"uds"}</b> por turno: el apoyo sería el freno.
                  </div>}
                </div>
              );
            })()}

            <button onClick={()=>setUdsTurno(String(Math.floor(velEquipo("real"))))}
              style={{width:"100%",background:C.blueBg,border:`1.5px solid ${C.blue}55`,color:C.blue,
                borderRadius:11,padding:"12px",fontFamily:F.h,fontWeight:800,fontSize:13.5,cursor:"pointer",marginBottom:10}}>
              Usar {Math.floor(velEquipo("real"))} como ritmo del producto
            </button>

            {toNum(udsTurno)>0 && velEquipo("real")>0 && (() => {
              const puesto = toNum(udsTurno), teor = velEquipo("real"), dif = puesto/teor;
              const col = dif > 1.05 ? C.red : dif < 0.85 ? C.amber : C.green;
              return (
                <div style={{background: dif>1.05?C.redBg : dif<0.85?C.amberBg : C.greenBg,
                  border:`1.5px solid ${col}`,borderRadius:11,padding:"11px 13px",
                  fontSize:12.5,color:col,fontWeight:700,lineHeight:1.6}}>
                  {dif > 1.05
                    ? <>⚠️ Tienes puesto {num(puesto)}, un {Math.round((dif-1)*100)}% más de lo que dan estos tiempos.</>
                    : dif < 0.85
                      ? <>Tienes puesto {num(puesto)}, un {Math.round((1-dif)*100)}% menos. Puede haber paros o tiempos que faltan.</>
                      : <>✔ Cuadra con el ritmo que tienes puesto ({num(puesto)}).</>}
                </div>
              );
            })()}

            {velEquipo("obj") > velEquipo("real") + 0.5 && (
              <div style={{fontSize:12,color:C.mutedD,marginTop:9,lineHeight:1.6,borderTop:`1px solid ${C.border}`,paddingTop:9}}>
                Con los tiempos objetivo saldrían <b style={{color:C.green}}>{Math.floor(velEquipo("obj"))} por turno</b>,
                {" "}<b style={{color:C.green}}>{Math.floor(velEquipo("obj")-velEquipo("real"))} más</b>.
              </div>
            )}
          </Card>
        )}

        {/* MATERIAS */}
        <Card style={{marginBottom:14}}>
          <div style={{fontFamily:F.h,fontWeight:700,fontSize:17,color:C.text,marginBottom:4}}>ESCANDALLO DE MATERIAS — por capas</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Teórico = {mFinales||"?"} m finales × nº capas ÷ rendimiento × precio</div>
          {ma.map(x=>{
            const m = mps.find(z=>z.id===x.mp_id);
            const cst = costeMatLinea(toNum(x.capas), toNum(x.precio_ud), toNum(x.rendimiento)||100);
            const upd = (campo,val)=>setMa(prev=>prev.map(z=>z.mp_id===x.mp_id?{...z,[campo]:val}:z));
            const falta = !(toNum(x.precio_ud)>0) || !(toNum(x.rendimiento)>0);
            return (
              <div key={x.mp_id} style={{padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontFamily:F.h,fontWeight:700,fontSize:16,color:C.text}}>{m?.nombre||"?"}</span>
                  <button onClick={()=>{ if(window.confirm(`¿Quitar ${m?.nombre||"esta materia"} del escandallo?`)) setMa(prev=>prev.filter(z=>z.mp_id!==x.mp_id)); }}
                    style={{background:"none",border:"none",color:C.red,fontSize:18,cursor:"pointer"}}>✕</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                  <div>
                    <div style={{fontSize:11,color:C.mutedD,fontWeight:700,marginBottom:3}}>CAPAS</div>
                    <NumIn value={x.capas} onChange={v=>upd("capas",v)} step="1" w="100%"/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:C.mutedD,fontWeight:700,marginBottom:3}}>€/METRO</div>
                    <NumIn value={x.precio_ud} onChange={v=>upd("precio_ud",v)} step="0.001" ph="0.090" w="100%"/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:C.mutedD,fontWeight:700,marginBottom:3}}>REND. %</div>
                    <NumIn value={x.rendimiento} onChange={v=>upd("rendimiento",v)} step="1" ph="85" w="100%"/>
                  </div>
                </div>
                <div style={{fontSize:12.5,color:falta?C.red:C.mutedD,background:falta?C.redBg:C.card2,borderRadius:9,padding:"7px 10px"}}>
                  {(toNum(mFinales)*toNum(x.capas)).toFixed(1)} m/ud
                  {falta
                    ? <b style={{marginLeft:8}}>⚠️ falta {!(toNum(x.precio_ud)>0)?"precio":""}{(!(toNum(x.precio_ud)>0)&&!(toNum(x.rendimiento)>0))?" y ":""}{!(toNum(x.rendimiento)>0)?"rendimiento":""}</b>
                    : <span style={{color:C.green,fontWeight:800,marginLeft:8}}>→ {cst.toFixed(3)} €/{unidad||"ud"}</span>}
                </div>
              </div>
            );
          })}
          {ma.some(x=>!(toNum(x.precio_ud)>0)||!(toNum(x.rendimiento)>0)) && (
            <button onClick={()=>setMa(prev=>prev.map(x=>{
              const g = mps.find(z=>z.id===x.mp_id);
              return { ...x,
                precio_ud: toNum(x.precio_ud)>0 ? x.precio_ud : (parseFloat(g?.precio_ud)||0),
                rendimiento: toNum(x.rendimiento)>0 ? x.rendimiento : (parseFloat(g?.rendimiento_objetivo)||85) };
            }))}
              style={{width:"100%",marginTop:10,background:C.blueBg,border:`1.5px solid ${C.blue}55`,color:C.blue,borderRadius:11,padding:"12px",fontFamily:F.h,fontWeight:800,fontSize:14,cursor:"pointer"}}>
              ↧ Rellenar lo que falta con los datos de la materia
            </button>
          )}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginTop:12}}>
            <Sel value={selMp} onChange={onSelMp} placeholder="Materia prima…"
              options={mps.filter(m=>!ma.find(x=>x.mp_id===m.id)).map(m=>({value:m.id,label:m.nombre}))}/>
            <Field dec label="Capas" value={capas} onChange={setCapas} type="number" placeholder="1-4" min="1" step="1"/>
          </div>
          {selMp && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Field dec label="Precio (€/m)" value={precioMp} onChange={setPrecioMp} type="number" placeholder="0.09" min="0" step="0.001"/>
                <Field dec label="Rendimiento (%)" value={rendMp} onChange={setRendMp} type="number" placeholder="85" min="1" step="1"/>
              </div>
              <button onClick={addMp} style={{width:"100%",background:C.accent,border:"none",color:"#fff",borderRadius:12,padding:"14px",fontFamily:F.h,fontWeight:800,fontSize:15,cursor:"pointer"}}>
                ＋ Añadir al escandallo
              </button>
              <div style={{fontSize:11.5,color:C.mutedD,marginTop:6,lineHeight:1.5}}>Si lo dejas en blanco lo añade igual y luego lo editas arriba.</div>
            </>
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
          {(ma.some(x=>!(toNum(x.precio_ud)>0)||!(toNum(x.rendimiento)>0)) || pa.some(x=>!(toNum(x.min_obj)>0))) && (
            <div style={{background:C.redBg,border:`1.5px solid ${C.red}`,borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:12.5,color:C.red,fontWeight:700,lineHeight:1.5}}>
              ⚠️ El coste está incompleto: hay líneas sin precio, sin rendimiento o sin tiempo. Rellénalas arriba.
            </div>
          )}
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

          {pa.length>0 && costeMOMeta>0 && (() => {
            const ahorro = costeMOTotal - costeMOMeta;
            const totalMeta = costeMPTotal + costeMOMeta;
            if (Math.abs(ahorro) < 0.005) return (
              <div style={{background:"#fff",borderRadius:10,padding:"10px 12px",marginTop:8,fontSize:12.5,color:C.mutedD,lineHeight:1.6}}>
                Los tiempos reales ya están en el objetivo: no hay margen de mejora por aquí.
              </div>
            );
            return (
              <div style={{background:"#fff",borderRadius:10,padding:"11px 13px",marginTop:8,fontSize:12.5,color:C.text,lineHeight:1.7}}>
                <div style={{fontFamily:F.h,fontWeight:800,fontSize:12.5,color:C.mutedD,marginBottom:4}}>SI SE ALCANZARAN LOS OBJETIVOS</div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span>Mano de obra al objetivo</span>
                  <b>{costeMOMeta.toFixed(2)} €</b>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span>Total del producto</span>
                  <b>{totalMeta.toFixed(2)} €/{unidad||"ud"}</b>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",color:ahorro>0?C.green:C.red,fontWeight:800,borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:4}}>
                  <span>{ahorro>0?"Se ahorraría":"Costaría más"}</span>
                  <span>{Math.abs(ahorro).toFixed(2)} €/{unidad||"ud"}
                    {costeCalculado>0 && <span style={{fontWeight:600}}> · {Math.round(Math.abs(ahorro)/costeCalculado*100)}%</span>}</span>
                </div>
                {toNum(objDiario)>0 && ahorro>0 && (
                  <div style={{fontSize:11.5,color:C.mutedD,marginTop:4}}>
                    A {num(toNum(objDiario))} uds/día son <b style={{color:C.green}}>{eur(ahorro*toNum(objDiario)*21)}</b> al mes.
                  </div>
                )}
              </div>
            );
          })()}
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end",marginTop:10}}>
            <Field dec label="Coste objetivo a guardar (€/ud)" value={coste} onChange={setCoste} type="number" placeholder="3.50" min="0" step="0.01"/>
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
  const [abierto, setAbierto] = useState(false);


  const guardado = cfg.find(x=>x.id===sel);
  // recarga los valores al cambiar de centro o cuando llegan los datos de Firebase
  const huella = guardado ? `${guardado.amortizacion_mes}|${guardado.alquiler_mes}|${guardado.luz_agua_mes}|${guardado.horas_persona_mes}` : "";
  useEffect(()=>{
    setAmort(guardado?.amortizacion_mes?.toString()||"");
    setAlquiler(guardado?.alquiler_mes?.toString()||"");
    setLuz(guardado?.luz_agua_mes?.toString()||"");
    setHoras(guardado?.horas_persona_mes?.toString()||"");
  },[sel, huella]);

  const total = toNum(amort)+toNum(alquiler)+toNum(luz);
  const guardar = async () => {
    if (!sel) return;
    await save("config_costes", sel, {
      amortizacion_mes:toNum(amort), alquiler_mes:toNum(alquiler),
      luz_agua_mes:toNum(luz), fijos_mensuales:total,
      horas_persona_mes:toNum(horas),
    });
    setMsg("Guardado"); setTimeout(()=>setMsg(null),2000);
  };
  const costeHoraFijo = total && toNum(horas) ? (total/toNum(horas)).toFixed(2) : null;
  const centroSel = centros.find(x=>x.id===sel);
  const cargada = costeHoraFijo && centroSel?.tarifa_mo ? (toNum(costeHoraFijo)+toNum(centroSel.tarifa_mo)).toFixed(2) : null;
  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:30}}>
      <Header title="COSTES FIJOS POR CENTRO" onBack={onBack} sub="Cada centro reparte sus fijos por hora trabajada"/>
      <div style={{padding:14}}>
        {msg && <Toast msg={msg}/>}
        {/* Lo que ya está creado */}
        {centros.filter(c=>cfg.find(z=>z.id===c.id)).length===0 && !abierto && !sel && (
          <Empty icon="💰" text="Sin costes fijos. Añade los de cada centro."/>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          {centros.map(c=>{
            const x = cfg.find(z=>z.id===c.id);
            if (!x) return null;
            const ch = x.horas_persona_mes ? (x.fijos_mensuales/x.horas_persona_mes).toFixed(2) : "—";
            return (
              <Card key={c.id} color={sel===c.id?C.amber+"66":undefined}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:F.h,fontWeight:700,fontSize:16,color:C.text}}>🏭 {c.nombre}</div>
                    <div style={{fontSize:12.5,color:C.mutedD,marginTop:2}}>
                      {num(x.fijos_mensuales)} €/mes → <b style={{color:C.accent}}>{ch} €/h</b>
                    </div>
                    <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>
                      Amort. {num(x.amortizacion_mes||0)} · Alquiler {num(x.alquiler_mes||0)} · Luz {num(x.luz_agua_mes||0)}
                    </div>
                  </div>
                  <IconBtn onClick={()=>{ setAbierto(false); setSel(c.id); window.scrollTo(0,0); }}>✏️</IconBtn>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Formulario, solo cuando se pide */}
        {!abierto && !sel && (
          <button onClick={()=>setAbierto(true)}
            style={{width:"100%",background:C.accent,border:"none",color:"#fff",borderRadius:14,padding:"16px",
              fontFamily:F.h,fontWeight:800,fontSize:15.5,cursor:"pointer"}}>＋ Costes de un centro</button>
        )}

        {(abierto || sel) && (
          <Card style={{marginBottom:14}} color={sel?C.amber+"66":undefined}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:sel?C.amber:C.text}}>
                {sel ? `✏️ Editando ${centros.find(c=>c.id===sel)?.nombre||""}` : "＋ Costes de un centro"}
              </span>
              <button onClick={()=>{ setAbierto(false); setSel(""); }}
                style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
            </div>

            {!sel && (
              <Sel label="Centro" value={sel} onChange={setSel} placeholder="Elegir centro…"
                options={centros.filter(c=>!cfg.find(z=>z.id===c.id)).map(c=>({value:c.id,label:`🏭 ${c.nombre}`}))}/>
            )}

            {sel && <>
              <Field dec label="Amortización maquinaria (€/mes)" value={amort} onChange={setAmort} placeholder="Ej: 2431 (350.000÷12 años÷12)" min="0" step="1"/>
              <Field dec label="Alquiler nave (€/mes)" value={alquiler} onChange={setAlquiler} placeholder="Ej: 1200" min="0" step="1"/>
              <Field dec label="Luz + agua (€/mes)" value={luz} onChange={setLuz} placeholder="Ej: 900" min="0" step="1"/>
              <Field dec label="Horas-persona trabajadas / mes" value={horas} onChange={setHoras} placeholder="Ej: 1848 (11 operarios × 168 h)" min="1"/>
              {costeHoraFijo && (
                <div style={{background:C.card2,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                  <div style={{fontSize:12.5,color:C.mutedD}}>{total.toFixed(0)} €/mes ÷ {horas} h</div>
                  <span style={{fontSize:13.5,color:C.mutedD}}>Estructura por hora-persona: </span>
                  <span style={{fontFamily:F.h,fontWeight:800,fontSize:20,color:C.blue}}>{costeHoraFijo} €/h</span>
                  {cargada && <div style={{marginTop:4,fontSize:13,color:C.mutedD}}>Tarifa cargada del centro (MO {centroSel.tarifa_mo} + estructura): <b style={{fontSize:17,color:C.text}}>{cargada} €/h</b></div>}
                </div>
              )}
              <Btn onClick={async()=>{ await guardar(); setAbierto(false); setSel(""); }}>{guardado?"💾 Guardar cambios":"💾 Guardar"}</Btn>
            </>}
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
function PlanificacionScreen({ onBack, perfil, productos, mps, producciones, centros, lineas, moldes=[], procesos=[] }) {
  const [tab, setTab] = useState("mes");
  const [centroId, setCentroId] = useState("");
  const centro = centros.find(c=>c.id===centroId);
  const lineasCentro = lineas.filter(l=>l.centro===centroId && l.activo!==false);
  const cfgLineas = lineasCentro.length>0
    ? lineasCentro.map(l=>({ id: l.id, nombre: l.nombre, personas: parseInt(l.personas)||3 }))
    : [{id:"_l1",nombre:"Línea 1",personas:3},{id:"_l2",nombre:"Línea 2",personas:3}];
  const nombresLinea = cfgLineas.map(l=>l.nombre);
  const nLineas = cfgLineas.length;
  const turnosCentro = parseInt(centro?.turnos_abiertos) || 2;
  const slotsDia = nLineas * turnosCentro;
  const persPorTurno = cfgLineas.reduce((a,l)=>a+l.personas, 0);
  const persDia = persPorTurno * turnosCentro;
  const persLinea = Math.round(persPorTurno/nLineas) || 3;
  const prodCentro = productos.filter(p => p.centro === centroId);
  const [periodo, setPeriodo] = useState(periodoActual());
  const semanas = semanasDeMes(periodo);
  const semanaHoy = isoWeek(new Date().toISOString().slice(0,10));
  const [semana, setSemana] = useState(semanas.includes(semanaHoy) ? semanaHoy : semanas[0]);
  useEffect(()=>{ const ss = semanasDeMes(periodo); if(!ss.includes(semana)) setSemana(ss[0]); },[periodo]);
  useEffect(()=>{ if(tab==="reparto") setTab("semana"); },[tab]);

  const [costesCfg] = useCol("config_costes");
  const ggMes = toNum(costesCfg.find(c => c.id === centroId)?.fijos_mensuales);
  const [planesMesAll] = useCol("planes_mes");
  const [planesSemAll] = useCol("planes_semana");
  const idMes = `${periodo}__${centroId}`;
  const idSem = `${semana}__${centroId}`;
  const planesSem = planesSemAll.filter(p => p.centro === centroId);
  const planMes = planesMesAll.find(p => p.id === idMes) || { items: [] };
  const planSem = planesSemAll.find(p => p.id === idSem) || { items: [], slots_disponibles: slotsDia*5 };

  const guardarMes = (data) => save("planes_mes", idMes, { periodo, centro: centroId, ...data });
  const guardarSem = (data) => save("planes_semana", idSem, { semana, periodo, centro: centroId, ...data });

  // ── Rescate de planes creados antes de separar por centro (no llevan centro dentro)
  const huerfanosMes = planesMesAll.filter(p => !p.centro);
  const huerfanosSem = planesSemAll.filter(p => !p.centro);
  const nHuerfanos = huerfanosMes.length + huerfanosSem.length;
  const adoptar = async () => {
    if (!centroId) return;
    if (!window.confirm(`Se van a asignar ${nHuerfanos} planificación(es) antigua(s) al centro "${centro?.nombre}".\n\nSi eran de otro centro, cámbiate a ese centro antes de hacerlo. ¿Seguir?`)) return;
    for (const p of huerfanosMes) {
      const per = p.periodo || p.id;
      const { id: _im, ...datosMes } = p;
      await save("planes_mes", `${per}__${centroId}`, { ...datosMes, periodo: per, centro: centroId });
      await del("planes_mes", p.id);
    }
    for (const p of huerfanosSem) {
      const sem = p.semana || p.id;
      const { id: _is, ...datosSem } = p;
      await save("planes_semana", `${sem}__${centroId}`, { ...datosSem, semana: sem, centro: centroId });
      await del("planes_semana", p.id);
    }
    window.alert("Recuperadas. Revisa el mes y la semana que estabas usando.");
  };

  // Copia el calendario de la semana actual al resto de semanas abiertas del mes
  const replicarEnMes = async (calBase) => {
    const origen = diasDeSemana(semana);
    const destino = semanas.filter(sm => sm !== semana &&
      !planesSemAll.find(p => p.id === `${sm}__${centroId}`)?.cerrado_plan);
    if (destino.length === 0) { window.alert("No hay más semanas abiertas en este mes."); return 0; }
    for (const sm of destino) {
      const ds = diasDeSemana(sm);
      const mapa = {};
      const nuevo = calBase
        .map(x => { if (x.grupo && !mapa[x.grupo]) mapa[x.grupo] = uid();
          return { ...x, id: uid(), grupo: x.grupo ? mapa[x.grupo] : uid(), fecha: ds[origen.indexOf(x.fecha)] }; })
        .filter(x => x.fecha);
      await save("planes_semana", `${sm}__${centroId}`, { semana: sm, periodo, centro: centroId, calendario: nuevo });
    }
    return destino.length;
  };

  const TABS = [["mes","📅 Mes"],["semana","🗓️ Planificar"],["cierre","🔒 Cierre"]];

  // ── Primero se elige el centro: no se carga nada hasta entonces
  if (!centroId) return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:40}}>
      <Header title="PLANIFICACIÓN" onBack={onBack} sub="Elige el centro de trabajo"/>
      <div style={{padding:14,maxWidth:900,margin:"0 auto"}}>
        {centros.length===0 && <Empty icon="🏭" text="No hay centros de trabajo. Créalos en Archivos maestros."/>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {centros.map(c=>{
            const ls = lineas.filter(l=>l.centro===c.id && l.activo!==false);
            const tt = parseInt(c.turnos_abiertos)||2;
            const pers = ls.reduce((a,l)=>a+(parseInt(l.personas)||3),0) * tt;
            const nProd = productos.filter(p=>p.centro===c.id).length;
            return (
              <button key={c.id} onClick={()=>setCentroId(c.id)}
                style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",
                  display:"flex",alignItems:"center",gap:14,cursor:"pointer",textAlign:"left",width:"100%"}}>
                <span style={{width:52,height:52,borderRadius:14,background:C.blueBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>🏭</span>
                <span style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:F.h,fontWeight:800,fontSize:17,color:C.text}}>{c.nombre}</div>
                  <div style={{fontSize:13,color:C.mutedD,marginTop:3}}>
                    {ls.length} línea{ls.length!==1?"s":""} · {tt} turno{tt!==1?"s":""} · {pers} personas/día
                  </div>
                  <div style={{fontSize:12,color:nProd?C.mutedD:C.red,marginTop:2,fontWeight:nProd?400:700}}>
                    {nProd ? `${nProd} productos asignados` : "⚠️ sin productos asignados"}
                  </div>
                </span>
                <span style={{color:C.muted,fontSize:20,flexShrink:0}}>›</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:40}}>
      <Header title={(centro?.nombre||"PLANIFICACIÓN").toUpperCase()} onBack={()=>setCentroId("")}
        sub="Planificación · toca ‹ para cambiar de centro"/>
      <div style={{position:"sticky",top:0,zIndex:16,boxShadow:"0 2px 10px rgba(15,23,42,0.10)"}}>
        {/* EL MES, siempre arriba y visible desde cualquier pestaña */}
        <div style={{background:C.navy,padding:"8px 12px 10px",display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setPeriodo(sumaPeriodo(periodo,-1))}
            style={{width:50,height:50,borderRadius:13,background:"rgba(255,255,255,0.15)",border:"none",
              color:"#fff",fontSize:24,fontWeight:800,cursor:"pointer",flexShrink:0}}>‹</button>
          <div style={{flex:1,textAlign:"center",minWidth:0}}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:20,color:"#fff",textTransform:"capitalize",lineHeight:1.15}}>{nombreMes(periodo)}</div>
            <div style={{fontSize:11.5,color:"rgba(255,255,255,0.6)"}}>{diasLaborablesMes(periodo).length} días laborables · {semanas.length} semanas</div>
          </div>
          <button onClick={()=>setPeriodo(sumaPeriodo(periodo,1))}
            style={{width:50,height:50,borderRadius:13,background:"rgba(255,255,255,0.15)",border:"none",
              color:"#fff",fontSize:24,fontWeight:800,cursor:"pointer",flexShrink:0}}>›</button>
        </div>
        <div style={{display:"flex",gap:6,padding:"0 12px 10px",background:C.navy}}>
          {TABS.map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{flex:1,background:tab===k?"#fff":"rgba(255,255,255,0.12)",color:tab===k?C.navy:"#fff",
                border:"none",borderRadius:10,padding:"11px 2px",fontFamily:F.h,fontWeight:800,fontSize:12,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        {(tab==="semana" || tab==="cierre") && (
          <div style={{display:"flex",gap:5,overflowX:"auto",padding:"7px 12px 8px",background:C.navy,borderTop:"1px solid rgba(255,255,255,0.10)"}}>
            {semanas.map(sm=>(
              <button key={sm} onClick={()=>setSemana(sm)}
                style={{flexShrink:0,background:semana===sm?"#fff":"rgba(255,255,255,0.10)",
                  color:semana===sm?C.navy:"rgba(255,255,255,0.85)",border:"none",borderRadius:9,
                  padding:"7px 11px",fontFamily:F.h,fontWeight:800,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                S{sm.split("-W")[1]} <span style={{fontWeight:600,opacity:0.7,fontSize:10.5}}>{rotuloSemana(sm).split(" – ")[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{padding:12,maxWidth:900,margin:"0 auto"}}>
        {nHuerfanos>0 && (
          <Card style={{marginBottom:12}} color={C.amber+"88"}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.amber,marginBottom:5}}>🛟 Planificaciones antiguas sin centro</div>
            <div style={{fontSize:12.5,color:C.mutedD,lineHeight:1.6,marginBottom:10}}>
              Hay {nHuerfanos} planificación{nHuerfanos!==1?"es":""} guardada{nHuerfanos!==1?"s":""} antes de separar por centro: {huerfanosMes.map(p=>p.periodo||p.id).concat(huerfanosSem.map(p=>p.semana||p.id)).join(" · ")}.
              No se ven porque no saben a qué centro pertenecen. Ponte en el centro correcto y adóptalas.
            </div>
            <Btn v="secondary" onClick={adoptar}>Asignarlas a “{centro?.nombre||"este centro"}”</Btn>
          </Card>
        )}
        {lineasCentro.length===0 && (
          <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:12,padding:"11px 14px",marginBottom:12,fontSize:12.5,color:C.amber,fontFamily:F.h,fontWeight:700,lineHeight:1.5}}>
            ⚠️ Este centro no tiene líneas dadas de alta. Se está calculando con 2 líneas por defecto. Créalas en Líneas de Producción.
          </div>
        )}
        {prodCentro.length===0 && (
          <div style={{background:C.redBg,border:`1.5px solid ${C.red}`,borderRadius:12,padding:"11px 14px",marginBottom:12,fontSize:12.5,color:C.red,fontFamily:F.h,fontWeight:700,lineHeight:1.5}}>
            ⛔ Ningún producto está asignado a este centro. Asígnalos en su ficha antes de planificar.
          </div>
        )}
        {tab==="mes" && <PlanMesTab periodo={periodo} plan={planMes} guardar={guardarMes}
          productos={prodCentro} mps={mps} semanas={semanas} planesSem={planesSem} slotsDia={slotsDia} persLinea={persLinea} persDia={persDia} turnosCentro={turnosCentro} centroNombre={centro?.nombre||""} perfil={perfil} ggMes={ggMes} procesos={procesos} irReparto={()=>setTab("semana")}/>}
        {tab==="semana" && <PlanSemanaTab semana={semana} setSemana={setSemana} semanas={semanas} plan={planSem}
          guardar={guardarSem} productos={prodCentro} mps={mps} perfil={perfil} slotsDia={slotsDia} persLinea={persLinea} persDia={persDia} turnosCentro={turnosCentro} cfgLineas={cfgLineas} centroNombre={centro?.nombre||""} replicarEnMes={replicarEnMes} nSemanasMes={semanas.length} moldes={moldes}
          planMes={planMes} semanasMes={planesSem}/>}
        {tab==="cierre" && <CierreSemanaTab semana={semana} setSemana={setSemana} semanas={semanas} plan={planSem}
          guardar={guardarSem} productos={prodCentro} mps={mps} producciones={producciones} perfil={perfil}/>}
      </div>
    </div>
  );
}

// ── Tarjeta reutilizable de recursos ───────────────────────────────────────────
const RecursosCard = ({ r, mps, dias, slotsDia=SLOTS_DIA, persDia=12, turnosCentro=TURNOS_ABIERTOS, titulo="Recursos necesarios" }) => (
  <Card style={{marginBottom:12}}>
    <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>🧮 {titulo}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
      {[[num(r.uds),"Unidades a fabricar"],
        [eur(r.coste),"Coste objetivo"],
        [Math.ceil(r.personaTurnos/(dias||1))+" personas","Cada día, en total"],
        [(r.slots/(dias||1)).toFixed(1)+" de "+slotsDia,"Líneas ocupadas al día"]].map(([v,l],i)=>(
        <div key={i} style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
          <div style={{fontFamily:F.h,fontWeight:900,fontSize:20,color:C.text}}>{v}</div>
          <div style={{fontSize:10.5,color:C.mutedD,marginTop:2}}>{l}</div>
        </div>
      ))}
    </div>
    <div style={{background:C.blueBg,borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:12.5,color:C.text,lineHeight:1.6}}>
      Repartido en <b>{dias} día{dias!==1?"s":""}</b>: necesitas <b>{Math.ceil(r.personaTurnos/(dias||1))} personas cada día</b> y tener funcionando <b>{(r.slots/(dias||1)).toFixed(1)}</b> de los {slotsDia} huecos línea-turno del centro.
      <div style={{fontSize:11.5,color:C.mutedD,marginTop:3}}>Centro completo = {slotsDia/turnosCentro} línea{slotsDia/turnosCentro!==1?"s":""} × {turnosCentro} turno{turnosCentro!==1?"s":""} = <b>{persDia} personas</b> al día.</div>
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
const ItemsEditor = ({ items, setItems, productos, bloqueado, persLinea=3 }) => {
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("");
  const [editando, setEditando] = useState(null);   // id de la línea que se está modificando
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
        const turnos = ritmo>0 ? (it.cantidad/ritmo)*(pers/persLinea) : 0;
        return (
          <div key={it.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:`1px solid ${C.card2}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p?.nombre||"(producto borrado)"}</div>
              {prodSub(p) && <div style={{fontSize:12.5,color:C.blue,fontWeight:600,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prodSub(p)}</div>}
              <div style={{fontSize:11.5,color:C.mutedD,marginTop:2}}>
                {ritmo>0 ? `⏱️ ${num(ritmo)} uds/turno · ${pers} persona${pers!==1?"s":""} · ${turnos.toFixed(1)} huecos` : "⚠️ sin ritmo"}
                {p?.molde ? ` · 🔧 ${p.molde}` : ""}
              </div>
            </div>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:19,color:C.text,minWidth:56,textAlign:"right"}}>{num(it.cantidad)}</div>
            {!bloqueado && <IconBtn onClick={()=>setEditando(it.id)}>✏️</IconBtn>}
            {!bloqueado && <IconBtn danger onClick={()=>{ if(window.confirm(`¿Quitar ${p?.nombre||"esta línea"} del plan?`)) setItems(items.filter(x=>x.id!==it.id)); }}>🗑️</IconBtn>}
          </div>
        );
      })}
      {editando && (() => {
        const it = items.find(x=>x.id===editando);
        if (!it) return null;
        return <LineaEditor it={it} productos={productos} otros={items.filter(x=>x.id!==it.id)}
          onGuardar={(nuevoPid,nuevaQty)=>{ setItems(items.map(x=>x.id===it.id?{...x,producto_id:nuevoPid,cantidad:nuevaQty}:x)); setEditando(null); }}
          onQuitar={()=>{ setItems(items.filter(x=>x.id!==it.id)); setEditando(null); }}
          onCerrar={()=>setEditando(null)}/>;
      })()}

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

// ── Hoja para modificar una línea del plan ─────────────────────────────────────
function LineaEditor({ it, productos, otros, onGuardar, onQuitar, onCerrar }) {
  const [pid, setPid] = useState(it.producto_id);
  const [q, setQ] = useState(String(it.cantidad ?? ""));
  const p = productos.find(x => x.id === pid);
  const ritmo = toNum(p?.uds_turno_linea);
  const paso = ritmo > 0 ? Math.max(1, Math.round(ritmo/2)) : 10;

  const guardar = () => {
    const n = toNum(q);
    if (!pid) { window.alert("Elige un producto"); return; }
    if (n <= 0) { window.alert("Pon las unidades"); return; }
    if (pid !== it.producto_id && otros.some(x => x.producto_id === pid)) {
      window.alert("Ese producto ya está en el plan. Edita la línea que ya existe."); return;
    }
    onGuardar(pid, n);
  };

  return (
    <div onClick={onCerrar} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:50,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",width:"100%",borderRadius:"20px 20px 0 0",padding:18,maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 14px"}}/>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:17,color:C.text,marginBottom:14}}>✏️ Modificar línea del plan</div>

        <ProductoBuscador label="Producto" value={pid} onChange={setPid} productos={productos}/>
        {p && prodSub(p) && (
          <div style={{background:C.card2,borderRadius:11,padding:"10px 12px",marginBottom:14}}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,color:C.text}}>{p.nombre}</div>
            <div style={{fontSize:12.5,color:C.blue,fontWeight:600,marginTop:2}}>{prodSub(p)}</div>
          </div>
        )}

        <div style={{fontSize:11,color:C.mutedD,fontWeight:800,marginBottom:6}}>UNIDADES</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button onClick={()=>setQ(String(Math.max(0, toNum(q)-paso)))}
            style={{width:56,height:56,borderRadius:13,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>−</button>
          <input type="text" inputMode="decimal" value={q} onChange={e=>setQ(e.target.value.replace(/[^0-9.,]/g,""))}
            style={{flex:1,height:56,textAlign:"center",borderRadius:13,border:`1.5px solid ${C.border}`,background:"#fff",color:C.text,fontFamily:F.h,fontWeight:900,fontSize:26,boxSizing:"border-box"}}/>
          <button onClick={()=>setQ(String(toNum(q)+paso))}
            style={{width:56,height:56,borderRadius:13,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>+</button>
        </div>

        <div style={{background: ritmo>0 ? C.blueBg : C.redBg, borderRadius:11, padding:"11px 13px", marginBottom:16,
          fontSize:12.5, color: ritmo>0 ? C.text : C.red, lineHeight:1.6}}>
          {ritmo>0
            ? <>Ritmo <b>{ritmo} uds</b> por turno con <b>{parseInt(p?.personas_linea)||3} personas</b> · son <b>{(toNum(q)/ritmo).toFixed(1)} turnos</b> de trabajo</>
            : <>⚠️ Este producto no tiene ritmo definido. No contará en el cuadre hasta que lo pongas en su ficha.</>}
        </div>

        <div style={{display:"grid",gap:8}}>
          <Btn onClick={guardar}>✔ Guardar cambios</Btn>
          <Btn v="danger" onClick={()=>{ if(window.confirm("¿Quitar esta línea del plan?")) onQuitar(); }}>🗑️ Quitar del plan</Btn>
          <Btn v="secondary" onClick={onCerrar}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

// ── TAB 1: PLAN MENSUAL ────────────────────────────────────────────────────────
function PlanMesTab({ periodo, plan, guardar, productos, mps, semanas, planesSem, slotsDia=SLOTS_DIA, persLinea=3, persDia=12, turnosCentro=TURNOS_ABIERTOS, centroNombre="", perfil, ggMes=0, procesos=[], irReparto }) {
  const items = plan.items || [];
  const setItems = (v) => guardar({ items: v });
  const dias = diasLaborablesMes(periodo).length;
  const r = calcRecursos(items, productos, persLinea, procesos);
  // El plan manda: la plantilla sale de lo que hace falta para fabricarlo
  const persLineaDia = Math.ceil(Math.ceil(r.personaTurnos/(dias||1)) / persLinea) * persLinea;
  const persApoyoDia = Math.ceil((r.horasApoyo||0) / (dias||1) / 8);
  const persNecesarias = Math.min(persDia, persLineaDia) + persApoyoDia;
  const persProg = persNecesarias;   // siempre lo que pide el plan
  const slotsEfect = Math.max(1, Math.min(slotsDia, Math.floor(Math.min(persDia, persLineaDia) / persLinea)));
  const capacidad = dias * slotsEfect;
  const ocupacion = capacidad>0 ? r.slots/capacidad : 0;
  const nLineasTxt = `${slotsDia/turnosCentro} línea${slotsDia/turnosCentro!==1?"s":""}`;

  // Gastos generales que le tocan a un producto, según el criterio elegido
  // Turnos-línea que ocupa un producto en el plan
  const turnosDe = (p, q) => {
    const ritmo = toNum(p?.uds_turno_linea), pers = parseInt(p?.personas_linea)||3;
    if (ritmo <= 0 || !q) return 0;
    return (q/ritmo) * Math.max(1, Math.ceil(pers/persLinea));
  };
  // Los 4.531 € enteros, repartidos por el trabajo que cada producto le da a la línea
  const ggPorTurno = r.slots > 0 ? ggMes / r.slots : 0;
  const ggDeProducto = (p, q) => ggPorTurno * turnosDe(p, q);
  const estado = ocupacion > 1.001 ? "falta" : ocupacion < 0.95 ? "sobra" : "ok";
  const col = estado==="ok"?C.green:estado==="falta"?C.red:C.amber;
  const bg  = estado==="ok"?C.greenBg:estado==="falta"?C.redBg:C.amberBg;

  const imprimir = () => {
    if (items.length===0) { window.alert("No hay nada planificado este mes"); return; }
    const ocupImp = capacidad>0 ? Math.min(1, r.slots/capacidad) : 0;
    const costeCalcP = r.costeMO + ggMes;
    const desvP = costeCalcP - r.costeFicha;
    const totalP = r.costeMP + r.costeMO + ggMes;
    const benefP = r.ventas - totalP;
    const margenP = r.ventas>0 ? benefP/r.ventas : 0;
    const filas = items.map(it=>{
      const p = productos.find(x=>x.id===it.producto_id);
      const ritmo = toNum(p?.uds_turno_linea), pers = parseInt(p?.personas_linea)||3;
      const huecos = ritmo>0 ? (toNum(it.cantidad)/ritmo)*(pers/persLinea) : 0;
      return `<tr><td><b>${esc(p?.nombre||"?")}</b>${prodSub(p)?`<br/><span style="font-size:9.5px;color:#666">${esc(prodSub(p))}</span>`:""}</td><td class="n">${num(it.cantidad)}</td><td class="n">${ritmo||"—"}</td><td class="n">${pers}</td><td>${esc(p?.molde||"—")}</td><td class="n">${huecos.toFixed(1)}</td></tr>`;
    }).join("");
    // economía producto a producto
    const critTxt = `entre los ${r.slots.toFixed(1)} turnos de línea del plan, a ${eur(ggPorTurno)} el turno`;
    const economia = items.map(it=>{
      const p = productos.find(x=>x.id===it.producto_id);
      const q = toNum(it.cantidad);
      const ritmo = toNum(p?.uds_turno_linea), pers = parseInt(p?.personas_linea)||3;
      const mpUd = toNum(p?.coste_mp_objetivo);
      const moUd = ritmo>0 ? (pers*8*TARIFA_MO)/ritmo : 0;
      const ggUd = q>0 ? ggDeProducto(p, q)/q : 0;
      const costeUd = mpUd + moUd + ggUd;
      const pvUd = toNum(p?.precio_venta);
      const margUd = pvUd>0 ? pvUd - costeUd : 0;
      const margPc = pvUd>0 ? margUd/pvUd : 0;
      const rojo = pvUd>0 && margUd < 0;
      return `<tr${rojo?' style="background:#FCEBEB"':''}>
        <td><b>${esc(p?.nombre||"?")}</b>${prodSub(p)?`<br/><span style="font-size:9px;color:#666">${esc(prodSub(p))}</span>`:""}</td>
        <td class="n">${num(q)}</td>
        <td class="n">${turnosDe(p,q)>0?turnosDe(p,q).toFixed(1):"—"}</td>
        <td class="n">${mpUd?mpUd.toFixed(2):"—"}</td>
        <td class="n">${moUd?moUd.toFixed(2):"—"}</td>
        <td class="n">${ggUd.toFixed(2)}</td>
        <td class="n"><b>${costeUd.toFixed(2)}</b></td>
        <td class="n">${pvUd?pvUd.toFixed(2):"—"}</td>
        <td class="n">${pvUd?margUd.toFixed(2):"—"}</td>
        <td class="n"><b>${pvUd?Math.round(margPc*100)+"%":"—"}</b></td>
        <td class="n">${pvUd?((margUd*q)>=0?"+":"")+eur(margUd*q):"—"}</td></tr>`;
    }).join("");

    const porSemana = semanas.map(sm=>{
      const ps = planesSem.find(x=>x.semana===sm);
      const rs = calcRecursos(ps?.items||[], productos, persLinea);
      return `<tr><td>Semana ${sm.split("-W")[1]}</td><td>${esc(rotuloSemana(sm))}</td><td class="n">${num(rs.uds)}</td><td class="n">${Math.ceil(rs.personaTurnos/5)}</td><td class="n">${eur(rs.coste)}</td><td>${ps?.cerrado_plan?"Cerrada":"Abierta"}</td></tr>`;
    }).join("");
    imprimirHTML(`
      <h1>Planificación mensual — ${esc(nombreMes(periodo))}</h1>
      <div class="sub">${esc(centroNombre)} · ${nLineasTxt} · ${turnosCentro} turno${turnosCentro!==1?"s":""} · ${dias} días laborables · plantilla programada ${persProg} personas/día (${slotsEfect} de ${slotsDia} huecos)</div>
      <h2>Qué se va a fabricar</h2>
      <table><tr><th>Producto</th><th class="n">Uds</th><th class="n">Ritmo</th><th class="n">Pers.</th><th>Molde</th><th class="n">Huecos</th></tr>${filas}</table>

      <h2>Coste, precio y margen por producto</h2>
      <table>
        <tr><th>Producto</th><th class="n">Uds</th><th class="n">Turnos línea</th><th class="n">Materia €/ud</th><th class="n">MO €/ud</th><th class="n">Generales €/ud</th><th class="n">Coste €/ud</th><th class="n">Venta €/ud</th><th class="n">Margen €/ud</th><th class="n">Margen %</th><th class="n">Beneficio</th></tr>
        ${economia}
        <tr><td><b>TOTAL</b></td><td class="n"><b>${num(r.uds)}</b></td><td class="n"><b>${r.slots.toFixed(1)}</b></td>
            <td class="n"><b>${r.uds>0?(r.costeMP/r.uds).toFixed(2):"—"}</b></td>
            <td class="n"><b>${r.uds>0?(r.costeMO/r.uds).toFixed(2):"—"}</b></td>
            <td class="n"><b>${r.uds>0?(ggMes/r.uds).toFixed(2):"—"}</b></td>
            <td class="n"><b>${r.uds>0?(totalP/r.uds).toFixed(2):"—"}</b></td>
            <td class="n"><b>${r.uds>0?(r.ventas/r.uds).toFixed(2):"—"}</b></td>
            <td class="n"><b>${r.uds>0?((r.ventas-totalP)/r.uds).toFixed(2):"—"}</b></td>
            <td class="n"><b>${Math.round(margenP*100)}%</b></td>
            <td class="n"><b>${benefP>=0?"+":""}${eur(benefP)}</b></td></tr>
      </table>
      <div style="font-size:9.5px;color:#666;margin-bottom:6px">
        Generales: los ${eur(ggMes)} del mes repartidos <b>${critTxt}</b>. Cuanto más trabajo lleven las líneas, menos carga cada unidad.
        Mano de obra a ${TARIFA_MO} €/h según las personas y turnos de cada producto.
      </div>
      ${bloqueRecursos(r, mps, dias, persDia)}
      <h2>Reparto por semanas</h2>
      <table><tr><th>Semana</th><th>Fechas</th><th class="n">Uds</th><th class="n">Pers./día</th><th class="n">Coste obj.</th><th>Estado</th></tr>${porSemana}</table>
      <h2>Coste objetivo: fichas frente a plan</h2>
      <table>
        <tr><th>Concepto</th><th class="n">Importe</th><th class="n">€/ud</th></tr>
        <tr><td>Coste objetivo según fichas de producto</td><td class="n">${eur(r.costeFicha)}</td><td class="n">${r.uds>0?(r.costeFicha/r.uds).toFixed(2):"0.00"}</td></tr>
        <tr><td>Mano de obra del plan (${TARIFA_MO} €/h)</td><td class="n">${eur(r.costeMO)}</td><td class="n">${r.uds>0?(r.costeMO/r.uds).toFixed(2):"0.00"}</td></tr>
        <tr><td>Gastos generales del mes (completos)</td><td class="n">${eur(ggMes)}</td><td class="n">${r.uds>0?(ggMes/r.uds).toFixed(2):"0.00"} medio</td></tr>
        <tr><td><b>Coste objetivo del plan</b></td><td class="n"><b>${eur(costeCalcP)}</b></td><td class="n"><b>${r.uds>0?(costeCalcP/r.uds).toFixed(2):"0.00"}</b></td></tr>
        <tr><td>Desvío frente a las fichas</td><td class="n">${desvP>=0?"+":""}${eur(desvP)}</td><td class="n">${r.costeFicha>0?`${(desvP/r.costeFicha*100).toFixed(0)}%`:"—"}</td></tr>
      </table>

      <h2>Beneficio estimado del mes</h2>
      <div class="kpis">
        <div class="kpi"><b>${eur(r.ventas)}</b><span>Ventas previstas</span></div>
        <div class="kpi"><b>${eur(totalP)}</b><span>Coste total</span></div>
        <div class="kpi"><b>${benefP>=0?"+":""}${eur(benefP)}</b><span>Beneficio (${Math.round(margenP*100)}%)</span></div>
      </div>
      <table>
        <tr><th>Concepto</th><th class="n">Importe</th><th class="n">% ventas</th></tr>
        <tr><td>Materia prima</td><td class="n">${eur(r.costeMP)}</td><td class="n">${r.ventas>0?Math.round(r.costeMP/r.ventas*100):"—"}%</td></tr>
        <tr><td>Mano de obra</td><td class="n">${eur(r.costeMO)}</td><td class="n">${r.ventas>0?Math.round(r.costeMO/r.ventas*100):"—"}%</td></tr>
        <tr><td>Gastos generales del mes</td><td class="n">${eur(ggMes)}</td><td class="n">${r.ventas>0?Math.round(ggMes/r.ventas*100):"—"}%</td></tr>
        <tr><td><b>Coste total</b></td><td class="n"><b>${eur(totalP)}</b></td><td class="n"><b>${r.ventas>0?Math.round(totalP/r.ventas*100):"—"}%</b></td></tr>
        <tr><td><b>Beneficio estimado</b></td><td class="n"><b>${benefP>=0?"+":""}${eur(benefP)}</b></td><td class="n"><b>${Math.round(margenP*100)}%</b></td></tr>
      </table>

      ${ocupImp<0.9 ? `<div class="aviso"><b>Fábrica al ${Math.round(ocupImp*100)}%.</b> Los ${eur(ggMes)} de gastos fijos se pagan igual y cargan ${r.uds>0?(ggMes/r.uds).toFixed(2):"0.00"} €/ud. Llenando las líneas bajarían a ${r.uds>0?(ggMes/(r.uds/(ocupImp||1))).toFixed(2):"0.00"} €/ud.</div>` : ""}

      <h2>Capacidad</h2>
      <table>
        <tr><td>Personas necesarias al día</td><td class="n">${Math.ceil(r.personaTurnos/(dias||1))}</td></tr>
        <tr><td>Personas programadas al día</td><td class="n">${persProg}</td></tr>
        <tr><td>Plantilla completa del centro</td><td class="n">${persDia}</td></tr>
        <tr><td>Huecos línea-turno abiertos al día</td><td class="n">${slotsEfect} de ${slotsDia}</td></tr>
        <tr><td>Ocupación de la fábrica</td><td class="n">${Math.round(ocupacion*100)}%</td></tr>
      </table>
      ${pieInforme(perfil)}
    `);
  };

  return (
    <>
      <ItemsEditor items={items} setItems={setItems} productos={productos} persLinea={persLinea}/>
      <RecursosCard r={r} mps={mps} dias={dias} slotsDia={slotsDia} persDia={persDia} turnosCentro={turnosCentro} titulo="Recursos del mes"/>

      {(() => {
        const ocup = capacidad>0 ? Math.min(1, r.slots/capacidad) : 0;
        const costeCalc = r.costeMO + ggMes;                // MO de las líneas + TODOS los generales
        const desv = costeCalc - r.costeFicha;              // frente al coste de ficha
        const total = r.costeMP + r.costeMO + ggMes;
        const benef = r.ventas - total;
        const margen = r.ventas>0 ? benef/r.ventas : 0;
        const fila = (l, v, extra, cl) => (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:13,padding:"6px 0"}}>
            <span style={{color:C.mutedD}}>{l}{extra && <span style={{fontSize:11,color:C.muted}}> · {extra}</span>}</span>
            <b style={{color:cl||C.text,flexShrink:0,marginLeft:10}}>{v}</b>
          </div>
        );
        return (
          <>
            <Card style={{marginBottom:12}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:3}}>🎯 Coste objetivo: ficha frente a plan</div>
              <div style={{fontSize:11.5,color:C.mutedD,lineHeight:1.55,marginBottom:9}}>
                La ficha del producto lleva un coste estimado por unidad. El plan lo recalcula con la gente que va a intervenir según líneas y turnos, más los gastos generales repartidos.
              </div>
              {fila("Coste objetivo según fichas", eur(r.costeFicha), `${r.uds>0?(r.costeFicha/r.uds).toFixed(2):"0.00"} €/ud`)}
              {fila("Mano de obra del plan", eur(r.costeMO), `${TARIFA_MO} €/h`)}
              {fila("Gastos generales del mes", eur(ggMes), `${eur(ggPorTurno)} por turno de línea`)}
              <div style={{background:C.card2,borderRadius:9,padding:"9px 11px",margin:"4px 0 2px",fontSize:11.5,color:C.mutedD,lineHeight:1.6}}>
                Los {eur(ggMes)} van enteros a lo que fabricas: entre los <b>{r.slots.toFixed(1)} turnos de línea</b> de este plan salen a <b>{eur(ggPorTurno)} cada turno</b>.
                Cuanto más trabajo le des a las líneas, menos carga cada unidad.
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:4}}>
                {fila("Coste objetivo del plan", eur(costeCalc), `${r.uds>0?(costeCalc/r.uds).toFixed(2):"0.00"} €/ud`)}
                {fila("Desvío frente a las fichas", `${desv>=0?"+":""}${eur(desv)}`, r.costeFicha>0?`${(desv/r.costeFicha*100).toFixed(0)}%`:"", desv<=0?C.green:C.red)}
              </div>
              {ggMes===0 && (
                <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:10,padding:"9px 11px",marginTop:8,fontSize:12,color:C.amber,fontWeight:700,lineHeight:1.5}}>
                  ⚠️ Este centro no tiene gastos generales configurados. Ponlos en Costes Fijos o el coste saldrá corto.
                </div>
              )}
            </Card>

            <Card style={{marginBottom:12}} color={(benef>=0?C.green:C.red)+"66"}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:9}}>💶 Beneficio estimado del mes</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <div style={{background:C.card2,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontFamily:F.h,fontWeight:900,fontSize:20,color:C.text}}>{eur(r.ventas)}</div>
                  <div style={{fontSize:10.5,color:C.mutedD,marginTop:2}}>Ventas previstas</div>
                </div>
                <div style={{background:C.card2,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontFamily:F.h,fontWeight:900,fontSize:20,color:benef>=0?C.green:C.red}}>{benef>=0?"+":""}{eur(benef)}</div>
                  <div style={{fontSize:10.5,color:C.mutedD,marginTop:2}}>Beneficio ({Math.round(margen*100)}%)</div>
                </div>
              </div>
              {fila("Materia prima", eur(r.costeMP), r.ventas>0?`${Math.round(r.costeMP/r.ventas*100)}% de ventas`:"")}
              {fila("Mano de obra", eur(r.costeMO), r.ventas>0?`${Math.round(r.costeMO/r.ventas*100)}%`:"")}
              {fila("Gastos generales del mes", eur(ggMes), r.ventas>0?`${Math.round(ggMes/r.ventas*100)}%`:"", C.text)}
              <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:4}}>
                {fila("Coste total", eur(total), r.uds>0?`${(total/r.uds).toFixed(2)} €/ud`:"")}
              </div>
              <div style={{background:ocup<0.9?C.amberBg:C.card2,border:ocup<0.9?`1.5px solid ${C.amber}`:"none",
                borderRadius:10,padding:"10px 12px",marginTop:9,fontSize:12,color:ocup<0.9?C.amber:C.mutedD,lineHeight:1.6,fontWeight:ocup<0.9?700:400}}>
                {ocup<0.9
                  ? <>La fábrica va al <b>{Math.round(ocup*100)}%</b> y los {eur(ggMes)} se pagan igual. Cada unidad carga <b>{r.uds>0?(ggMes/r.uds).toFixed(2):"0.00"} €</b> de gastos fijos.
                      Llenando las líneas, ese mismo gasto se repartiría entre <b>{num(Math.round(r.uds/(ocup||1)))} uds</b> y bajaría a <b>{r.uds>0?(ggMes/(r.uds/(ocup||1))).toFixed(2):"0.00"} €/ud</b>.</>
                  : <>Fábrica prácticamente llena: los gastos fijos se reparten entre el máximo de unidades posible.</>}
              </div>
              {r.ventas===0 && (
                <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:10,padding:"9px 11px",marginTop:8,fontSize:12,color:C.amber,fontWeight:700,lineHeight:1.5}}>
                  ⚠️ Ningún producto del plan tiene precio de venta. Ponlo en su ficha para ver el beneficio.
                </div>
              )}
            </Card>
          </>
        );
      })()}

      <Card style={{marginBottom:12}} color={col+"66"}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>⚖️ Capacidad del mes</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:col}}>{Math.ceil(r.personaTurnos/(dias||1))}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Personas que necesito al día</div>
          </div>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:C.text}}>{persProg}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Personas que hacen falta</div>
          </div>
        </div>

        <div style={{background:C.blueBg,borderRadius:12,padding:"12px 13px",marginBottom:11}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:12.5,color:C.blue,marginBottom:6}}>
            👥 PERSONAL QUE NECESITA ESTE PLAN
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6}}>
            <span style={{fontFamily:F.h,fontWeight:900,fontSize:32,color:C.text,lineHeight:1}}>{persProg}</span>
            <span style={{fontSize:13,color:C.mutedD}}>personas al día</span>
          </div>
          <div style={{fontSize:12,color:C.mutedD,lineHeight:1.6}}>
            <b>{Math.min(persDia, persLineaDia)} en línea</b> ({Math.floor(slotsEfect/turnosCentro)} línea{Math.floor(slotsEfect/turnosCentro)!==1?"s":""} × {turnosCentro} turno{turnosCentro!==1?"s":""}, {slotsEfect} de {slotsDia} huecos)
            {persApoyoDia>0 && <> + <b style={{color:C.blue}}>{persApoyoDia} de apoyo</b> fuera de línea ({Math.round(r.horasApoyo)} h al mes: desalado y similares)</>}.
 Sale solo de lo que has puesto a fabricar: cambia el plan y cambia esta cifra.
          </div>
          {persNecesarias >= persDia && r.slots > capacidad && (
            <div style={{background:C.redBg,border:`1.5px solid ${C.red}`,borderRadius:9,padding:"9px 10px",marginTop:8,fontSize:12,color:C.red,fontWeight:700,lineHeight:1.5}}>
              ⛔ Ni con el centro entero ({persDia} personas) cabe este plan. Quita producción o abre otro turno.
            </div>
          )}
        </div>
        <div style={{height:10,background:C.card2,borderRadius:5,overflow:"hidden",marginBottom:10}}>
          <div style={{width:Math.min(100,ocupacion*100)+"%",height:"100%",background:col,borderRadius:5}}/>
        </div>
        <div style={{background:bg,border:`1.5px solid ${col}`,borderRadius:10,padding:"11px 13px",fontSize:13.5,color:col,fontFamily:F.h,fontWeight:700,lineHeight:1.5}}>
          {estado==="ok" && `✔ Cuadrado — la fábrica va al ${Math.round(ocupacion*100)}%`}
          {estado==="falta" && `⛔ No cabe — harían falta ${Math.ceil(r.personaTurnos/(dias||1)) - persProg} personas más al día, o ${Math.ceil((r.slots-capacidad)/slotsDia)} día(s) más de fábrica`}
          {estado==="sobra" && `⚠️ Sobra fábrica — quedan ${((capacidad-r.slots)/slotsDia).toFixed(1)} días libres. Mete más producción.`}
        </div>
      </Card>

      <div style={{display:"grid",gap:9}}>
        <Btn onClick={irReparto} v="ghost">🗓️ Planificar estas unidades en el calendario →</Btn>
        <Btn onClick={imprimir} v="secondary">🖨️ Imprimir la planificación del mes</Btn>
      </div>
    </>
  );
}


// ── CALENDARIO INTERACTIVO DE LA SEMANA ────────────────────────────────────────
const DIA_CORTO = (f) => {
  const d = new Date(f+"T12:00:00");
  return d.toLocaleDateString("es-ES",{weekday:"short"}).replace(".","") + " " + d.getDate();
};
const codigoCorto = (n="") => n.split(" ")[0].slice(0,13);

function CalendarioSemana({ semana, plan, guardar, productos, bloqueado, cfgLineas, turnosCentro=2, replicarEnMes, nSemanasMes=4, moldes=[], itemsMes=[], colocadoEnMes=()=>0 }) {
  const moldeDe = (p) => p?.molde_id || (p?.molde ? `txt:${(p.molde||"").trim().toLowerCase()}` : "");
  const nombreMolde = (k) => !k ? "Sin molde"
    : (k.startsWith("txt:") ? k.slice(4) : (moldes.find(m=>m.id===k)?.nombre || "Molde"));
  const minutosMolde = (k) => k && !k.startsWith("txt:") ? (moldes.find(m=>m.id===k)?.minutos_cambio ?? 30) : 30;
  const CFG = (cfgLineas && cfgLineas.length) ? cfgLineas : [{nombre:"Línea 1",personas:3},{nombre:"Línea 2",personas:3}];
  const LINEAS_CAL = CFG.map(l=>l.nombre);
  const persDeLinea = (n) => CFG.find(l=>l.nombre===n)?.personas || 3;
  const TURNOS_CAL = Array.from({length: turnosCentro}, (_,i)=>`T${i+1}`);
  const dias = diasDeSemana(semana);
  // Una tirada (grupo) solo puede ocupar líneas del MISMO día y turno. Las copias
  // antiguas heredaban el grupo entre días: se separan al vuelo para no falsear ritmos.
  const cal = (() => {
    const raw = plan.calendario || [];
    const porGrupo = {};
    raw.forEach(x => { if (x.grupo) (porGrupo[x.grupo] = porGrupo[x.grupo] || []).push(x); });
    const rotos = new Set(Object.keys(porGrupo).filter(g =>
      new Set(porGrupo[g].map(x => `${x.fecha}|${x.turno}`)).size > 1));
    if (!rotos.size) return raw;
    const mapa = {};
    return raw.map(x => {
      if (!x.grupo || !rotos.has(x.grupo)) return x;
      const k = `${x.grupo}|${x.fecha}|${x.turno}`;
      if (!mapa[k]) mapa[k] = uid();
      return { ...x, grupo: mapa[k] };
    });
  })();
  const items = itemsMes;                  // el plan del mes manda
  const moldesLinea = plan.moldes_linea || {};      // { nombreLinea: moldeId }
  const montarMolde = (l, mid) => guardar({ moldes_linea: { ...moldesLinea, [l]: mid } });
  const [edit, setEdit] = useState(null);   // {fecha,turno,linea} o null
  const [cogido, setCogido] = useState(null);       // producto seleccionado en la bandeja
  const [lineaSel, setLineaSel] = useState(null);   // línea sobre la que se trabaja
  const [pideMolde, setPideMolde] = useState(null); // línea a la que montar molde

  const ritmoDe = (p) => parseFloat(p?.uds_turno_linea)||0;
  const persDe  = (p) => parseInt(p?.personas_linea)||3;
  const enSlot = (f,t,l) => cal.find(x=>x.fecha===f && x.turno===t && x.linea===l);

  const setCal = (nuevo) => guardar({ calendario: nuevo });

  // ── Propuesta automática a partir del objetivo de la semana
  const proponer = () => {
    if (items.length===0) { window.alert("Esta semana no tiene objetivo. Ponlo en Reparto o abajo en 'Objetivo de la semana'."); return; }
    if (cal.length>0 && !window.confirm("Se va a rehacer el calendario entero de la semana. ¿Seguir?")) return;
    const pend = {};
    items.forEach(it=>{ pend[it.producto_id] = (pend[it.producto_id]||0) + (parseFloat(it.cantidad)||0); });
    const out = [];
    const ultimoMolde = {};
    for (const f of dias) {
      for (const t of TURNOS_CAL) {
        const libres = [...LINEAS_CAL];
        while (libres.length>0) {
          // preferimos seguir con el mismo molde que ya tenía esa línea: evita paradas por cambio
          const moldeActual = ultimoMolde[libres[0]];
          const candidatos = Object.keys(pend)
            .filter(k => pend[k] > 0.5 && ritmoDe(productos.find(p=>p.id===k))>0)
            .sort((a,b) => {
              const ma = moldeDe(productos.find(p=>p.id===a));
              const mb = moldeDe(productos.find(p=>p.id===b));
              return (mb===moldeActual?1:0) - (ma===moldeActual?1:0);
            });
          const pid = candidatos[0];
          if (!pid) break;
          const prod = productos.find(p=>p.id===pid);
          const ritmo = ritmoDe(prod), pers = persDe(prod);
          // cuántas líneas hacen falta para juntar las personas que pide el producto
          let acum = 0, nSlots = 0;
          for (const l of libres) { acum += persDeLinea(l); nSlots++; if (acum >= pers) break; }
          if (acum < pers) break;
          const q = Math.min(ritmo, pend[pid]);
          const g = uid();
          const usadas = libres.splice(0, nSlots);
          usadas.forEach(l => {
            out.push({ id:uid(), grupo:g, fecha:f, turno:t, linea:l, producto_id:pid, cantidad: Math.round(q/nSlots*10)/10 });
            ultimoMolde[l] = moldeDe(productos.find(p=>p.id===pid));
          });
          pend[pid] = Math.round((pend[pid]-q)*10)/10;
        }
      }
    }
    setCal(out);
    const resto = Object.entries(pend).filter(([,v])=>v>0.5);
    if (resto.length>0) {
      const txt = resto.map(([k,v])=>`· ${productos.find(p=>p.id===k)?.nombre||"?"}: ${num(v)} uds`).join("\n");
      window.alert(`No cabe todo en la semana.\n\nSe queda fuera:\n${txt}\n\nAjústalo a mano o pásalo a otra semana.`);
    }
  };

  const quitar = (slot) => {
    const e = enSlot(slot.fecha, slot.turno, slot.linea);
    if (!e) { setEdit(null); return; }
    setCal(cal.filter(x => e.grupo ? x.grupo!==e.grupo : x.id!==e.id));
    setEdit(null);
  };
  // ── Repetir un patrón en más sitios ─────────────────────────────────────────
  const resumenDe = (entradas) => {
    const t = {};
    entradas.forEach(x => { t[x.producto_id] = (t[x.producto_id]||0) + toNum(x.cantidad); });
    return Object.entries(t).map(([pid,q]) => `· ${productos.find(p=>p.id===pid)?.nombre||"?"}: ${num(q)} uds`).join("\n");
  };

  const repetirTurnoEnDia = (f, t) => {
    const patron = cal.filter(x => x.fecha===f && x.turno===t);
    if (!patron.length) { window.alert("Este turno está vacío. Planifícalo primero."); return; }
    const otros = TURNOS_CAL.filter(z => z !== t);
    if (!otros.length) { window.alert("Este centro solo tiene un turno."); return; }
    if (!window.confirm(`Copiar el ${t} del ${DIA_CORTO(f)} a ${otros.join(" y ")} de ese mismo día.\n\nCada turno quedará con:\n${resumenDe(patron)}\n\n¿Seguir?`)) return;
    let base = cal.filter(x => !(x.fecha===f && otros.includes(x.turno)));
    otros.forEach(t2 => { const mapa = {};
      patron.forEach(x => { if (x.grupo && !mapa[x.grupo]) mapa[x.grupo] = uid();
        base.push({ ...x, id: uid(), grupo: x.grupo ? mapa[x.grupo] : uid(), turno: t2 }); }); });
    setCal(base);
  };

  const repetirDiaEnSemana = (f) => {
    const patron = cal.filter(x => x.fecha===f);
    if (!patron.length) { window.alert("Este día está vacío. Planifícalo primero."); return; }
    const otros = dias.filter(z => z !== f);
    if (!window.confirm(`Copiar el ${DIA_CORTO(f)} entero a los otros ${otros.length} días de la semana.\n\nCada día quedará con:\n${resumenDe(patron)}\n\n¿Seguir?`)) return;
    let base = cal.filter(x => x.fecha === f);
    otros.forEach(f2 => { const mapa = {};
      patron.forEach(x => { if (x.grupo && !mapa[x.grupo]) mapa[x.grupo] = uid();
        base.push({ ...x, id: uid(), grupo: x.grupo ? mapa[x.grupo] : uid(), fecha: f2 }); }); });
    setCal(base);
  };

  const repetirSemanaEnMes = async () => {
    if (!cal.length) { window.alert("La semana está vacía. Planifícala primero."); return; }
    if (!replicarEnMes) return;
    if (!window.confirm(`Copiar esta semana entera a las demás semanas abiertas del mes.\n\nCada semana quedará con:\n${resumenDe(cal)}\n\nLas semanas ya cerradas no se tocan. ¿Seguir?`)) return;
    const n = await replicarEnMes(cal);
    if (n) window.alert(`Copiada a ${n} semana${n!==1?"s":""}. Revisa el cuadre de cada una.`);
  };

  // ¿este hueco obliga a cambiar el molde respecto al anterior de la misma línea?
  const secuencia = (l) => {
    const out = [];
    dias.forEach(f => TURNOS_CAL.forEach(t => {
      const e = cal.find(x=>x.fecha===f && x.turno===t && x.linea===l);
      if (e) out.push({ f, t, molde: moldeDe(productos.find(p=>p.id===e.producto_id)) });
    }));
    return out;
  };
  const hayCambioMolde = (f,t,l) => {
    const sq = secuencia(l);
    const i = sq.findIndex(x=>x.f===f && x.t===t);
    return i > 0 && sq[i].molde !== sq[i-1].molde;
  };
  const cambiosSemana = LINEAS_CAL.reduce((a,l)=>{
    const sq = secuencia(l);
    return a + sq.filter((x,i)=> i>0 && x.molde !== sq[i-1].molde).length;
  },0);
  const minutosCambio = LINEAS_CAL.reduce((a,l)=>{
    const sq = secuencia(l);
    return a + sq.reduce((b,x,i)=>{
      if (i===0 || x.molde===sq[i-1].molde) return b;
      return b + minutosMolde(x.molde);
    },0);
  },0);

  // ── Agrupación por molde: qué se puede encadenar sin parar la línea ─────────
  const slotsPorLinea = dias.length * TURNOS_CAL.length;
  const grupos = (() => {
    const g = {};
    (items||[]).forEach(it => {
      const p = productos.find(x=>x.id===it.producto_id);
      const ritmo = ritmoDe(p);
      if (!p || ritmo<=0) return;
      const k = moldeDe(p);
      const turnos = toNum(it.cantidad)/ritmo;
      const slots = turnos * Math.max(1, Math.ceil(persDe(p)/(CFG[0]?.personas||3)));
      (g[k] = g[k] || { molde:k, productos:[], slots:0 });
      g[k].productos.push({ p, uds: toNum(it.cantidad), turnos, slots });
      g[k].slots += slots;
    });
    return Object.values(g).sort((a,b)=>b.slots-a.slots);
  })();
  const combinables = grupos.filter(g => g.molde && g.productos.length > 1);

  // Coloca el calendario agrupando por molde: cada línea agota un molde antes de cambiar
  const colocarPorMolde = () => {
    if (!grupos.length) { window.alert("Esta semana no tiene objetivo con ritmo definido."); return; }
    if (cal.length>0 && !window.confirm("Se va a rehacer el calendario entero agrupando por molde. ¿Seguir?")) return;
    const ocupado = {};
    const libre = (f,t,l) => !ocupado[`${f}|${t}|${l}`];
    const marcar = (f,t,l) => { ocupado[`${f}|${t}|${l}`] = true; };
    const out = [];
    const sobra = [];

    // 1) productos que necesitan más de una línea: van por día/turno ocupando líneas contiguas
    const multi = [];
    grupos.forEach(g => g.productos.forEach(x => {
      if (persDe(x.p) > (CFG[0]?.personas||3)) multi.push(x);
    }));
    multi.forEach(x => {
      let pend = x.uds;
      for (const f of dias) { for (const t of TURNOS_CAL) {
        if (pend <= 0.5) break;
        const libres = LINEAS_CAL.filter(l => libre(f,t,l));
        let acum = 0; const usadas = [];
        for (const l of libres) { usadas.push(l); acum += persDeLinea(l); if (acum >= persDe(x.p)) break; }
        if (acum < persDe(x.p)) continue;
        const q = Math.min(ritmoDe(x.p), pend);
        const g2 = uid();
        usadas.forEach(l => { marcar(f,t,l); out.push({ id:uid(), grupo:g2, fecha:f, turno:t, linea:l,
          producto_id:x.p.id, cantidad: Math.round(q/usadas.length*10)/10 }); });
        pend = Math.round((pend-q)*10)/10;
      }}
      if (pend > 0.5) sobra.push(`· ${x.p.nombre}: ${num(pend)} uds`);
    });

    // 2) el resto: línea por línea, agotando cada molde antes de pasar al siguiente
    const cola = [];
    grupos.forEach(g => g.productos.forEach(x => {
      if (persDe(x.p) <= (CFG[0]?.personas||3)) cola.push({ ...x, molde:g.molde, pend:x.uds });
    }));
    let i = 0;
    for (const l of LINEAS_CAL) {
      for (const f of dias) { for (const t of TURNOS_CAL) {
        if (!libre(f,t,l)) continue;
        while (i < cola.length && cola[i].pend <= 0.5) i++;
        if (i >= cola.length) break;
        const x = cola[i];
        const q = Math.min(ritmoDe(x.p), x.pend);
        marcar(f,t,l);
        out.push({ id:uid(), grupo:uid(), fecha:f, turno:t, linea:l, producto_id:x.p.id, cantidad:Math.round(q*10)/10 });
        x.pend = Math.round((x.pend-q)*10)/10;
      }}
    }
    cola.filter(x=>x.pend>0.5).forEach(x=>sobra.push(`· ${x.p.nombre}: ${num(x.pend)} uds`));

    setCal(out);
    if (sobra.length) window.alert(`Colocado agrupando por molde.\n\nNo cabe todo en la semana. Se queda fuera:\n${sobra.join("\n")}`);
  };

  // Molde que la línea tiene montado alrededor de este hueco (el anterior, o el siguiente)
  const moldeMontado = (f, t, l) => {
    const orden = [];
    dias.forEach(ff => TURNOS_CAL.forEach(tt => orden.push({ f:ff, t:tt })));
    const i = orden.findIndex(o => o.f===f && o.t===t);
    for (let k = i-1; k >= 0; k--) {
      const e = enSlot(orden[k].f, orden[k].t, l);
      if (e) return moldeDe(productos.find(p=>p.id===e.producto_id));
    }
    for (let k = i+1; k < orden.length; k++) {
      const e = enSlot(orden[k].f, orden[k].t, l);
      if (e) return moldeDe(productos.find(p=>p.id===e.producto_id));
    }
    return "";
  };

  const vaciarDia = (f) => {
    if (!window.confirm(`¿Vaciar todo el ${DIA_CORTO(f)}?`)) return;
    setCal(cal.filter(x=>x.fecha!==f));
  };

  // Lo que debería salir de ese hueco según el ritmo del producto
  const objetivoSlot = (e) => {
    const p = productos.find(z=>z.id===e.producto_id);
    const r = ritmoDe(p);
    if (r <= 0) return 0;
    const nSlots = e.grupo ? Math.max(1, cal.filter(x=>x.grupo===e.grupo).length) : 1;
    return r / nSlots;
  };
  const faltaEnSlot = (e) => { const o = objetivoSlot(e); return o > 0 ? o - toNum(e.cantidad) : 0; };

  // ── Un color por MOLDE: mismo color = misma línea sin parar a cambiar
  const paleta = ["#DBEAFE","#DCFCE7","#FEF3C7","#FCE7F3","#E0E7FF","#FFE4E6","#CCFBF1","#F3E8FF"];
  const bordes = ["#3B82F6","#16A34A","#F59E0B","#EC4899","#6366F1","#F43F5E","#14B8A6","#A855F7"];
  const moldesEnCal = [...new Set(cal.map(x => moldeDe(productos.find(p=>p.id===x.producto_id))))];
  const colorMoldeK = (k) => { const i = Math.max(0, moldesEnCal.indexOf(k));
    return { bg: paleta[i%paleta.length], bd: bordes[i%bordes.length] }; };
  const colorDe = (pid) => colorMoldeK(moldeDe(productos.find(p=>p.id===pid)));

  // Lo colocado esta semana
  const colocadoSem = {};
  cal.forEach(x=>{ colocadoSem[x.producto_id] = (colocadoSem[x.producto_id]||0) + (parseFloat(x.cantidad)||0); });
  // Lo colocado en TODO el mes: otras semanas (guardado) + esta (en curso)
  const colocado = {};
  items.forEach(it => {
    const pid = it.producto_id;
    const guardadoSem = (plan.calendario||[]).filter(x=>x.producto_id===pid).reduce((a,x)=>a+toNum(x.cantidad),0);
    colocado[pid] = colocadoEnMes(pid) - guardadoSem + (colocadoSem[pid]||0);
  });
  Object.keys(colocadoSem).forEach(pid => { if (!(pid in colocado)) colocado[pid] = colocadoSem[pid]; });
  const objetivo = {};
  items.forEach(it=>{ objetivo[it.producto_id] = (objetivo[it.producto_id]||0) + (parseFloat(it.cantidad)||0); });
  const asignar = (slot, pid, cantidad) => {
    const prod = productos.find(p=>p.id===pid);
    // El calendario no puede fabricar más de lo planificado: eso se cambia en la pestaña Mes
    const obj = objetivo[pid] || 0;
    if (obj > 0) {
      const eActual = enSlot(slot.fecha, slot.turno, slot.linea);
      const yaAqui = eActual && eActual.producto_id === pid
        ? (eActual.grupo ? cal.filter(x=>x.grupo===eActual.grupo) : [eActual]).reduce((a,x)=>a+toNum(x.cantidad),0)
        : 0;
      const resto = (colocado[pid] || 0) - yaAqui;
      const libre = obj - resto;
      if (cantidad > libre + 0.5) {
        window.alert(
          `No cabe: de ${prod?.nombre} el reparto de esta semana son ${num(obj)} uds.\n\n` +
          `Ya hay ${num(resto)} colocadas en otros huecos, así que aquí caben ${num(Math.max(0,libre))} como mucho.\n\n` +
          `Si de verdad quieres fabricar más, súbelo primero en 📅 Mes.`);
        return;
      }
    }
    const need = persDe(prod);
    const i0 = LINEAS_CAL.indexOf(slot.linea);
    const usadas = [];
    let acum = 0;
    for (let i=i0; i<LINEAS_CAL.length && acum<need; i++) { usadas.push(LINEAS_CAL[i]); acum += persDeLinea(LINEAS_CAL[i]); }
    for (let i=i0-1; i>=0 && acum<need; i--) { usadas.unshift(LINEAS_CAL[i]); acum += persDeLinea(LINEAS_CAL[i]); }
    let base = cal.filter(x => !(x.fecha===slot.fecha && x.turno===slot.turno && usadas.includes(x.linea)));
    // si alguna de las líneas ocupadas formaba pareja, se retira la pareja entera
    const rotos = cal.filter(x => x.fecha===slot.fecha && x.turno===slot.turno && usadas.includes(x.linea) && x.grupo);
    base = base.filter(x => !rotos.some(rz => rz.grupo === x.grupo));
    const g = uid();
    usadas.forEach(l => base.push({ id:uid(), grupo:g, fecha:slot.fecha, turno:slot.turno, linea:l,
      producto_id:pid, cantidad: Math.round(cantidad/usadas.length*10)/10 }));
    setCal(base);
    setEdit(null);
  };
  // Soltar el producto cogido en un hueco, avisando si cambia el molde de la línea
  const soltarEn = (f, t, l) => {
    if (!cogido) return;
    const p = productos.find(z=>z.id===cogido);
    const r = ritmoDe(p);
    if (r <= 0) { window.alert("Este producto no tiene ritmo definido. Ponlo en su ficha."); return; }
    const falta = (objetivo[cogido]||0) - (colocado[cogido]||0);
    if (falta <= 0.5) {
      window.alert(
        `${p.nombre} ya está entero en el mes: ${num(colocado[cogido]||0)} de ${num(objetivo[cogido]||0)} uds.\n\n` +
        `Para fabricar más, súbelo en 📅 Mes.`);
      setCogido(null);
      return;
    }

    const montado = moldesLinea[l] || moldeMontado(f, t, l);
    const mio = moldeDe(p);
    if (montado && montado !== mio) {
      const min = minutosMolde(mio);
      if (!window.confirm(
        `⚠️ CAMBIO DE MOLDE\n\nLa ${l} ya trabaja esta semana con el molde ${nombreMolde(montado)}.\n` +
        `Poner aquí ${p.nombre} obliga a montar el molde ${nombreMolde(mio)}: unos ${min} min de parada.\n\n¿Lo pones igualmente?`)) return;
    }
    asignar({ fecha:f, turno:t, linea:l }, cogido, Math.round(Math.min(r, falta)));
  };

  const todos = [...new Set([...Object.keys(objetivo), ...Object.keys(colocado)])];

  return (
    <>
      {!bloqueado && (
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:12}}>
          <button onClick={proponer} style={{background:C.accent,border:"none",color:"#fff",borderRadius:12,padding:"14px",fontFamily:F.h,fontWeight:800,fontSize:14.5,cursor:"pointer"}}>⚡ Proponer calendario</button>
          <button onClick={()=>{ if(window.confirm("¿Vaciar la semana entera?")) setCal([]); }}
            style={{background:"#fff",border:`1.5px solid ${C.border}`,color:C.mutedD,borderRadius:12,padding:"14px",fontFamily:F.h,fontWeight:800,fontSize:14.5,cursor:"pointer"}}>Vaciar</button>
        </div>
      )}

      {!bloqueado && cal.length>0 && nSemanasMes>1 && (
        <button onClick={repetirSemanaEnMes}
          style={{width:"100%",background:C.blueBg,border:`1.5px solid ${C.blue}55`,color:C.blue,borderRadius:12,padding:"13px",
            fontFamily:F.h,fontWeight:800,fontSize:14,cursor:"pointer",marginBottom:12}}>
          ⧉ Repetir esta semana en todo el mes
        </button>
      )}

      {/* MOLDE MONTADO EN CADA LÍNEA */}
      {!bloqueado && (
        <Card style={{marginBottom:10}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:13.5,color:C.text,marginBottom:3}}>🔧 Qué molde lleva cada línea</div>
          <div style={{fontSize:11.5,color:C.mutedD,lineHeight:1.55,marginBottom:10}}>
            Monta un molde y abajo saldrán solo los productos que se hacen con él.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
            {CFG.map(l=>{
              const mid = moldesLinea[l.nombre] || "";
              const m = moldes.find(z=>z.id===mid);
              const c = mid ? colorMoldeK(mid) : null;
              const sel = lineaSel === l.nombre;
              return (
                <div key={l.nombre} onClick={()=>{ setLineaSel(l.nombre); setCogido(null); if(!mid) setPideMolde(l.nombre); }}
                  style={{cursor:"pointer",borderRadius:12,padding:"10px 11px",
                    background: mid ? c.bg : "#fff",
                    border: `${sel?3:1.5}px solid ${sel ? C.accent : (mid ? c.bd : C.border)}`}}>
                  <div style={{fontFamily:F.h,fontWeight:800,fontSize:13.5,color:C.text}}>⚙️ {l.nombre}</div>
                  <div style={{fontSize:11,color:C.mutedD,marginBottom:6}}>{l.personas} personas</div>
                  <div onClick={(e)=>{ e.stopPropagation(); setLineaSel(l.nombre); setPideMolde(l.nombre); }}
                    style={{fontFamily:F.h,fontWeight:800,fontSize:12.5,color: mid?C.text:C.muted,
                      background:"#fff",border:`1.5px ${mid?"solid":"dashed"} ${mid?c.bd:C.border}`,
                      borderRadius:9,padding:"8px",textAlign:"center"}}>
                    {m ? `🔧 ${m.nombre}` : "＋ montar molde"}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!bloqueado && items.length>0 && lineaSel && moldesLinea[lineaSel] && (
        <div style={{position:"sticky",top:96,zIndex:12,background:C.bg,paddingBottom:8,marginBottom:6}}>
          <Card style={{padding:"11px 12px",marginBottom:0}} color={cogido?C.blue+"88":undefined}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:13,color:C.text,marginBottom:3}}>
              {cogido ? `Ahora toca un hueco de ${lineaSel}` : `${lineaSel} · molde ${nombreMolde(moldesLinea[lineaSel])}`}
            </div>
            {(() => {
              if (!cogido) return (
                <div style={{fontSize:11.5,color:C.mutedD,lineHeight:1.5,marginBottom:9}}>
                  Toca la caja del producto y después el hueco de la línea donde va.
                </div>
              );
              const p = productos.find(z=>z.id===cogido);
              const r = ritmoDe(p);
              const falta = (objetivo[cogido]||0) - (colocado[cogido]||0);
              const q = r>0 ? Math.min(r, falta>0.5 ? falta : r) : 0;
              const pers = persDe(p);
              const nL = Math.max(1, Math.ceil(pers/(CFG[0]?.personas||3)));
              return (
                <div style={{background:C.blueBg,borderRadius:10,padding:"9px 11px",marginBottom:9,fontSize:12,color:C.text,lineHeight:1.6}}>
                  {r>0
                    ? <>Cada hueco que toques coge <b>{num(q)} uds</b>{q<r && <span style={{color:C.amber,fontWeight:700}}> (es lo que queda; el turno completo son {num(r)})</span>}
                        {nL>1 && <> · ocupa <b>{nL} líneas</b> del turno, {num(Math.round(q/nL))} en cada una</>}
                        <div style={{fontSize:11,color:C.mutedD,marginTop:2}}>{pers} personas · quedan {num(Math.max(0,falta))} por colocar</div></>
                    : <span style={{color:C.red,fontWeight:700}}>Este producto no tiene ritmo definido: ponlo en su ficha antes de colocarlo.</span>}
                </div>
              );
            })()}
            {(() => {
              const pend = items.reduce((a,it)=>a+Math.max(0,(objetivo[it.producto_id]||0)-(colocado[it.producto_id]||0)),0);
              const exc  = items.reduce((a,it)=>a+Math.max(0,(colocado[it.producto_id]||0)-(objetivo[it.producto_id]||0)),0);
              const ok = pend<0.5 && exc<0.5;
              return (
                <div style={{display:"flex",gap:6,marginBottom:9}}>
                  <div style={{flex:1,background:ok?C.greenBg:C.card2,borderRadius:9,padding:"7px 9px",textAlign:"center"}}>
                    <div style={{fontFamily:F.h,fontWeight:900,fontSize:16,color:ok?C.green:C.text,lineHeight:1.1}}>{ok?"✔":num(pend)}</div>
                    <div style={{fontSize:9.5,color:C.mutedD}}>{ok?"todo colocado":"uds por colocar"}</div>
                  </div>
                  {exc>0.5 && (
                    <div style={{flex:1,background:C.amberBg,border:`1px solid ${C.amber}`,borderRadius:9,padding:"7px 9px",textAlign:"center"}}>
                      <div style={{fontFamily:F.h,fontWeight:900,fontSize:16,color:C.amber,lineHeight:1.1}}>+{num(exc)}</div>
                      <div style={{fontSize:9.5,color:C.amber}}>uds de más</div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:3}}>
              {items.filter(it=>moldeDe(productos.find(z=>z.id===it.producto_id))===moldesLinea[lineaSel]).map(it=>{
                const p = productos.find(z=>z.id===it.producto_id);
                const falta = (objetivo[it.producto_id]||0) - (colocado[it.producto_id]||0);
                const justo = Math.abs(falta) <= 0.5;
                const pasado = falta < -0.5;
                const k = moldeDe(p);
                const c = colorMoldeK(k);
                const on = cogido === it.producto_id;
                const colNum = on ? "#fff" : justo ? C.green : pasado ? C.amber : C.text;
                return (
                  <button key={it.producto_id} onClick={()=>setCogido(on?null:it.producto_id)}
                    style={{flexShrink:0,minWidth:126,textAlign:"left",cursor:"pointer",
                      background:on?c.bd:(justo?C.card2:pasado?C.amberBg:c.bg),
                      border:`2px solid ${on?c.bd:(justo?C.border:pasado?C.amber:c.bd)}`,
                      borderRadius:12,padding:"9px 11px",opacity:justo&&!on?0.6:1}}>
                    <div style={{fontFamily:F.h,fontWeight:800,fontSize:12.5,color:on?"#fff":C.text,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{codigoCorto(p?.nombre||"?")}</div>
                    <div style={{fontFamily:F.h,fontWeight:900,fontSize:19,color:colNum,lineHeight:1.15}}>
                      {justo ? "✔ 0" : pasado ? `+${num(-falta)}` : num(falta)}
                    </div>
                    <div style={{fontSize:10,color:on?"rgba(255,255,255,0.85)":C.mutedD,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {justo ? "justo" : pasado ? "de más" : "por colocar"} · 🔧 {nombreMolde(k)}
                    </div>
                    <div style={{fontSize:9.5,color:on?"rgba(255,255,255,0.8)":C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {num(colocado[it.producto_id]||0)} de {num(objetivo[it.producto_id]||0)}
                    </div>
                    <div style={{fontSize:10.5,fontWeight:800,marginTop:3,
                      color:on?"#fff":(ritmoDe(p)>0?C.blue:C.red),overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {ritmoDe(p)>0
                        ? `${num(falta>0.5 ? Math.min(ritmoDe(p), falta) : ritmoDe(p))} por turno`
                        : "⚠️ sin ritmo"}
                    </div>
                  </button>
                );
              })}
            </div>
            {cogido && (
              <button onClick={()=>setCogido(null)}
                style={{width:"100%",marginTop:8,background:"#fff",border:`1.5px solid ${C.border}`,color:C.mutedD,
                  borderRadius:10,padding:"9px",fontFamily:F.h,fontWeight:800,fontSize:12.5,cursor:"pointer"}}>Soltar sin colocar</button>
            )}
          </Card>
        </div>
      )}

      {cal.length>0 && moldesEnCal.length>0 && (
        <Card style={{marginBottom:10,padding:"11px 12px"}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:12.5,color:C.text,marginBottom:7}}>Qué significa cada color</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:7}}>
            {moldesEnCal.map(k=>{
              const c = colorMoldeK(k);
              return (
                <span key={k||"sin"} style={{display:"inline-flex",alignItems:"center",gap:6,background:c.bg,
                  border:`1.5px solid ${c.bd}`,borderRadius:9,padding:"6px 10px",fontSize:12,fontWeight:700,color:C.text}}>
                  🔧 {nombreMolde(k)}
                </span>
              );
            })}
          </div>
          <div style={{fontSize:11.5,color:C.mutedD,lineHeight:1.6}}>
            <div style={{marginBottom:6}}>
              <b>El color del hueco = el molde.</b> Si una línea cambia de color de un turno al siguiente hay que parar a cambiarlo: se marca con <b style={{color:C.amber}}>⇄</b>.
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{flexShrink:0,width:46,height:5,background:C.card2,borderRadius:3,overflow:"hidden",display:"inline-block"}}>
                <span style={{display:"block",width:"100%",height:"100%",background:C.green,borderRadius:3}}/>
              </span>
              <span><b>La barrita verde llena</b>: el turno va al ritmo estándar (50/50).</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{flexShrink:0,width:46,height:5,background:C.card2,borderRadius:3,overflow:"hidden",display:"inline-block"}}>
                <span style={{display:"block",width:"55%",height:"100%",background:C.amber,borderRadius:3}}/>
              </span>
              <span><b>Ámbar a medias</b>: va por debajo del ritmo y te dice cuántas uds pierdes.</span>
            </div>
          </div>
        </Card>
      )}

      {dias.map(f=>{
        const delDia = cal.filter(x=>x.fecha===f);
        const udsDia = delDia.reduce((s,x)=>s+(parseFloat(x.cantidad)||0),0);
        const objDia = delDia.reduce((s,x)=>s+objetivoSlot(x),0);
        const cortoDia = objDia>0 && objDia - udsDia > 0.5;
        const persDia = delDia.reduce((s,x)=>s+persDeLinea(x.linea),0);
        return (
          <Card key={f} style={{marginBottom:10,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:15,color:C.text,textTransform:"capitalize"}}>{DIA_CORTO(f)}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:12,color:C.mutedD}}>
                  {delDia.length}/{LINEAS_CAL.length*TURNOS_CAL.length} huecos · <b style={{color:cortoDia?C.amber:C.text}}>{num(udsDia)}</b>{objDia>0 && <span>/{num(objDia)}</span>} uds · {persDia}p
                </span>
                {!bloqueado && delDia.length>0 && <button onClick={()=>repetirDiaEnSemana(f)} title="Repetir este día en toda la semana"
                  style={{background:C.blueBg,border:`1px solid ${C.blue}44`,color:C.blue,borderRadius:8,padding:"5px 9px",fontSize:12,fontWeight:800,cursor:"pointer"}}>⧉ semana</button>}
                {!bloqueado && delDia.length>0 && <button onClick={()=>vaciarDia(f)} style={{background:"none",border:"none",color:C.red,fontSize:15,cursor:"pointer"}}>✕</button>}
              </div>
            </div>
            {TURNOS_CAL.map(t=>(
              <div key={t} style={{display:"flex",alignItems:"stretch",gap:6,marginBottom:6}}>
                <div style={{width:34,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:C.card2,borderRadius:9,padding:"4px 0"}}>
                  <span style={{fontFamily:F.h,fontWeight:800,fontSize:12,color:C.mutedD}}>{t}</span>
                  {!bloqueado && cal.some(x=>x.fecha===f && x.turno===t) && TURNOS_CAL.length>1 && (
                    <button onClick={()=>repetirTurnoEnDia(f,t)} title="Repetir en los demás turnos del día"
                      style={{background:"none",border:"none",color:C.blue,fontSize:13,cursor:"pointer",padding:0,lineHeight:1}}>⧉</button>
                  )}
                </div>
                {LINEAS_CAL.map(l=>{
                  const e = enSlot(f,t,l);
                  const prod = e && productos.find(p=>p.id===e.producto_id);
                  const c = e ? colorDe(e.producto_id) : null;
                  const cambio = e && hayCambioMolde(f,t,l);
                  return (
                    <button key={l} onClick={()=>{ if(bloqueado) return;
                        if (cogido && !e) soltarEn(f,t,l); else setEdit({fecha:f,turno:t,linea:l}); }}
                      style={{flex:1,minWidth:0,minHeight:60,
                        background:e?c.bg:(cogido?"#F0F9FF":"#fff"),
                        border:e?`1.5px solid ${c.bd}`:`1.5px dashed ${cogido?C.blue:C.border}`,
                        borderRadius:11,padding:"8px 7px",cursor:bloqueado?"default":"pointer",textAlign:"left",overflow:"hidden"}}>
                      {e ? (
                        <>
                          <div style={{fontFamily:F.h,fontWeight:800,fontSize:12.5,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{codigoCorto(prod?.nombre||"?")}</div>
                          {(() => {
                            const obj = objetivoSlot(e);
                            const dif = obj>0 ? toNum(e.cantidad) - obj : 0;
                            const bajo = obj>0 && dif < -0.5;
                            return (
                              <>
                                <div style={{display:"flex",alignItems:"baseline",gap:4,marginTop:1}}>
                                  <span style={{fontFamily:F.h,fontWeight:900,fontSize:17,color:bajo?C.amber:c.bd}}>{num(e.cantidad)}</span>
                                  {obj>0 && <span style={{fontSize:10.5,color:C.mutedD}}>/{num(obj)}</span>}
                                </div>
                                {obj>0 && (
                                  <div style={{height:4,background:"rgba(0,0,0,0.10)",borderRadius:2,overflow:"hidden",margin:"2px 0 1px"}}>
                                    <div style={{width:Math.min(100,(toNum(e.cantidad)/obj)*100)+"%",height:"100%",
                                      background:bajo?C.amber:C.green,borderRadius:2}}/>
                                  </div>
                                )}
                                {bajo && <div style={{fontSize:9.5,color:C.amber,fontWeight:800}}>↓ {num(-dif)} menos</div>}
                              </>
                            );
                          })()}
                          <div style={{fontSize:10,color:C.mutedD,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {moldeDe(prod) ? `🔧 ${nombreMolde(moldeDe(prod))}` : l} · {(e.grupo ? cal.filter(x=>x.grupo===e.grupo) : [e]).reduce((a,z)=>a+persDeLinea(z.linea),0)||persDeLinea(l)}p
                            {cambio && <span style={{color:C.amber,fontWeight:800}}> ⇄</span>}
                          </div>
                        </>
                      ) : (
                        <div style={{color:cogido?C.blue:C.muted,fontSize:11.5,fontWeight:cogido?800:400,textAlign:"center",paddingTop:16,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {bloqueado ? "—" : (cogido ? "soltar aquí" : `+ ${l} · ${persDeLinea(l)}p`)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </Card>
        );
      })}

      {!bloqueado && grupos.length>0 && (
        <Card style={{marginBottom:12}} color={C.blue+"55"}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:3}}>💡 Agrupación por molde</div>
          <div style={{fontSize:12,color:C.mutedD,lineHeight:1.55,marginBottom:11}}>
            Lo que hay que fabricar esta semana, ordenado por molde. Los productos de un mismo bloque se pueden encadenar sin parar la línea.
          </div>
          {grupos.map(g=>{
            const dias2 = g.slots/TURNOS_CAL.length;
            const juntos = g.productos.length>1 && g.molde;
            return (
              <div key={g.molde||"sin"} style={{background:juntos?C.blueBg:C.card2,borderRadius:11,padding:"11px 12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
                  <b style={{fontFamily:F.h,fontSize:14,color:juntos?C.blue:C.text}}>🔧 {nombreMolde(g.molde)}</b>
                  <span style={{fontSize:12.5,color:C.mutedD,flexShrink:0}}>{g.slots.toFixed(1)} huecos · {dias2.toFixed(1)} día{dias2!==1?"s":""} de línea</span>
                </div>
                {g.productos.map(x=>(
                  <div key={x.p.id} style={{display:"flex",justifyContent:"space-between",fontSize:12.5,color:C.mutedD,padding:"2px 0"}}>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.p.nombre}</span>
                    <span style={{flexShrink:0,marginLeft:8}}>{num(x.uds)} uds · {(x.slots/TURNOS_CAL.length).toFixed(1)} d</span>
                  </div>
                ))}
                {juntos && (
                  <div style={{fontSize:12,color:C.blue,fontWeight:700,marginTop:6,lineHeight:1.5}}>
                    ✔ {g.productos.length} productos con el mismo molde: {dias2.toFixed(1)} días seguidos en una línea, sin cambios.
                  </div>
                )}
                {!g.molde && (
                  <div style={{fontSize:12,color:C.amber,fontWeight:700,marginTop:6,lineHeight:1.5}}>
                    ⚠️ Sin molde asignado en su ficha. No se pueden agrupar.
                  </div>
                )}
              </div>
            );
          })}
          {combinables.length>0 && (
            <div style={{background:C.greenBg,borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:12.5,color:C.green,fontWeight:700,lineHeight:1.55}}>
              💡 Hay {combinables.length} molde{combinables.length!==1?"s":""} con varios productos. Colocándolos seguidos te ahorras {combinables.reduce((a,g)=>a+(g.productos.length-1)*minutosMolde(g.molde),0)} min de cambios.
            </div>
          )}
          <Btn v="secondary" onClick={colocarPorMolde}>⚡ Colocar agrupado por molde</Btn>
        </Card>
      )}

      {cal.length>0 && (() => {
        const flojos = cal.filter(e => faltaEnSlot(e) > 0.5);
        const perdidas = flojos.reduce((a,e) => a + faltaEnSlot(e), 0);
        const vacios = LINEAS_CAL.length*TURNOS_CAL.length*dias.length - cal.length;
        if (!flojos.length && !vacios) return (
          <Card style={{marginBottom:12}} color={C.green+"55"}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.green}}>✔ Semana llena y a ritmo</div>
            <div style={{fontSize:12.5,color:C.mutedD,marginTop:3,lineHeight:1.55}}>Todos los huecos están ocupados y ninguno va por debajo del ritmo estándar.</div>
          </Card>
        );
        return (
          <Card style={{marginBottom:12}} color={C.amber+"66"}>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.amber,marginBottom:8}}>
              {flojos.length>0 ? "⚠️ Capacidad que se queda sin usar" : `⚠️ Quedan ${vacios} huecos por llenar`}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:9}}>
              <div style={{flex:1,background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
                <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:vacios?C.amber:C.green}}>{vacios}</div>
                <div style={{fontSize:10.5,color:C.mutedD}}>Huecos vacíos</div>
              </div>
              <div style={{flex:1,background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
                <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:flojos.length?C.amber:C.green}}>{flojos.length}</div>
                <div style={{fontSize:10.5,color:C.mutedD}}>Turnos flojos</div>
              </div>
              <div style={{flex:1,background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
                <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:C.amber}}>{num(perdidas)}</div>
                <div style={{fontSize:10.5,color:C.mutedD}}>Uds que dejas de hacer</div>
              </div>
            </div>
            {flojos.slice(0,6).map((e,i)=>{
              const p = productos.find(z=>z.id===e.producto_id);
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12.5,color:C.mutedD,padding:"3px 0"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{DIA_CORTO(e.fecha)} · {e.turno} · {e.linea} — {codigoCorto(p?.nombre||"?")}</span>
                  <b style={{color:C.amber,flexShrink:0,marginLeft:8}}>{num(e.cantidad)}/{num(objetivoSlot(e))}</b>
                </div>
              );
            })}
            {flojos.length>6 && <div style={{fontSize:11.5,color:C.mutedD,marginTop:4}}>…y {flojos.length-6} más</div>}
            <div style={{fontSize:11.5,color:C.mutedD,marginTop:8,lineHeight:1.55}}>
              {flojos.length>0
                ? <>Un turno <b>flojo</b> lleva menos unidades de las que da el ritmo estándar (la barrita sale ámbar a medias). Súbelo tocando el hueco.</>
                : <>Los turnos colocados van todos a ritmo <b style={{color:C.green}}>(barritas verdes llenas)</b>. Lo que falta son <b>{vacios} huecos sin nada</b>: coge un producto de la bandeja de arriba y suéltalo, o baja los huecos disponibles de la semana si esos turnos no se van a trabajar.</>}
            </div>
          </Card>
        );
      })()}

      {cal.length>0 && (
        <Card style={{marginBottom:12}} color={cambiosSemana>0?C.amber+"55":C.green+"55"}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:7}}>🔧 Cambios de molde</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <div style={{flex:1,background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
              <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:cambiosSemana>0?C.amber:C.green}}>{cambiosSemana}</div>
              <div style={{fontSize:10.5,color:C.mutedD}}>Cambios en la semana</div>
            </div>
            <div style={{flex:1,background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
              <div style={{fontFamily:F.h,fontWeight:900,fontSize:22,color:C.text}}>{Math.round(minutosCambio/60*10)/10} h</div>
              <div style={{fontSize:10.5,color:C.mutedD}}>Tiempo perdido</div>
            </div>
          </div>
          <div style={{fontSize:12,color:C.mutedD,lineHeight:1.55}}>
            {cambiosSemana===0
              ? "Ningún cambio de molde: cada línea encadena el mismo molde toda la semana."
              : "Los huecos marcados con ⇄ obligan a cambiar el molde. Agrupa productos del mismo molde seguidos en la misma línea para quitarlos."}
          </div>
        </Card>
      )}

      <Card style={{marginBottom:12}}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:9}}>📊 Colocado frente al objetivo</div>
        {todos.length===0 && <div style={{fontSize:13,color:C.muted}}>Sin nada en el calendario todavía.</div>}
        {todos.map(pid=>{
          const p = productos.find(x=>x.id===pid);
          const obj = objetivo[pid]||0, col2 = colocado[pid]||0;
          const dif = col2-obj;
          const ok = Math.abs(dif) < 0.5;
          return (
            <div key={pid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${C.card2}`}}>
              <span style={{minWidth:0,overflow:"hidden"}}>
                <div style={{fontSize:13.5,color:C.text,fontFamily:F.h,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p?.nombre||"?"}</div>
                {prodSub(p) && <div style={{fontSize:11.5,color:C.mutedD,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prodSub(p)}</div>}
              </span>
              <span style={{flexShrink:0,fontFamily:F.h,fontWeight:800,fontSize:13.5,color:ok?C.green:C.amber}}>
                {num(col2)}/{num(obj)} {ok?"✔":(dif<0?`(faltan ${num(-dif)})`:`(+${num(dif)})`)}
              </span>
            </div>
          );
        })}
      </Card>

      {/* HOJA: elegir el molde de una línea */}
      {pideMolde && (
        <div onClick={()=>setPideMolde(null)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:50,display:"flex",alignItems:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",width:"100%",borderRadius:"20px 20px 0 0",padding:18,maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 14px"}}/>
            <div style={{fontFamily:F.h,fontWeight:800,fontSize:17,color:C.text,marginBottom:3}}>¿Qué molde monta {pideMolde}?</div>
            <div style={{fontSize:12.5,color:C.mutedD,lineHeight:1.55,marginBottom:14}}>
              Mientras esté montado, esa línea solo hará productos de ese molde. Cambiarlo cuesta una parada.
            </div>
            {moldes.length===0 && <Empty icon="🔧" text="No hay moldes en el catálogo"/>}
            <div style={{display:"grid",gap:9,marginBottom:12}}>
              {moldes.map(m=>{
                const c = colorMoldeK(m.id);
                const pend = items.filter(it => moldeDe(productos.find(z=>z.id===it.producto_id))===m.id
                  && ((objetivo[it.producto_id]||0) - (colocado[it.producto_id]||0)) > 0.5).length;
                const puesto = moldesLinea[pideMolde] === m.id;
                return (
                  <button key={m.id} onClick={()=>{ montarMolde(pideMolde, m.id); setLineaSel(pideMolde); setPideMolde(null); }}
                    style={{textAlign:"left",cursor:"pointer",background:c.bg,border:`${puesto?3:2}px solid ${c.bd}`,
                      borderRadius:14,padding:"14px 15px"}}>
                    <div style={{fontFamily:F.h,fontWeight:800,fontSize:16,color:C.text}}>🔧 {m.nombre}{puesto && " · puesto"}</div>
                    <div style={{fontSize:12.5,color:C.mutedD,marginTop:2}}>
                      {m.calibre?`cal ${m.calibre} · `:""}cambio {m.minutos_cambio ?? 30} min
                    </div>
                    <div style={{fontSize:12.5,fontWeight:700,color:pend?C.text:C.muted,marginTop:3}}>
                      {pend ? `${pend} producto${pend!==1?"s":""} por planificar` : "nada pendiente con este molde"}
                    </div>
                  </button>
                );
              })}
            </div>
            {moldesLinea[pideMolde] && (
              <Btn v="secondary" onClick={()=>{ montarMolde(pideMolde, ""); setPideMolde(null); }}>Quitar el molde de esta línea</Btn>
            )}
          </div>
        </div>
      )}

      {edit && <SlotEditor slot={edit} entrada={enSlot(edit.fecha,edit.turno,edit.linea)} productos={productos}
        items={items} colocado={colocado} objetivo={objetivo} persLinea={persDeLinea(edit.linea)}
        calSlot={(pid)=>{ const e = enSlot(edit.fecha,edit.turno,edit.linea);
          return e && e.producto_id===pid
            ? (e.grupo ? cal.filter(x=>x.grupo===e.grupo) : [e]).reduce((a,x)=>a+toNum(x.cantidad),0) : 0; }}
        moldeLinea={moldeMontado(edit.fecha, edit.turno, edit.linea)}
        nombreMolde={nombreMolde} moldeDe={moldeDe}
        onAsignar={asignar} onQuitar={()=>quitar(edit)} onCerrar={()=>setEdit(null)}/>}
    </>
  );
}

// ── Editor de un hueco del calendario ──────────────────────────────────────────
function SlotEditor({ slot, entrada, productos, items, colocado, objetivo, persLinea=3, moldeLinea="", nombreMolde=(x)=>x, moldeDe=()=>"", calSlot=()=>0, onAsignar, onQuitar, onCerrar }) {
  const [pid, setPid] = useState(entrada?.producto_id || "");
  const [q, setQ] = useState(entrada ? String(entrada.cantidad) : "");
  const p = productos.find(z=>z.id===pid);
  const prod = p;
  const ritmo = parseFloat(prod?.uds_turno_linea)||0;
  const pers = parseInt(prod?.personas_linea)||3;
  const dobles = pers > persLinea;

  useEffect(()=>{ if(pid && !entrada) setQ(String(ritmo||"")); },[pid]);

  const sugeridos = items.map(it=>it.producto_id).filter((v,i,a)=>a.indexOf(v)===i);

  return (
    <div onClick={onCerrar} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:50,display:"flex",alignItems:"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",width:"100%",borderRadius:"20px 20px 0 0",padding:18,maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 14px"}}/>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:17,color:C.text,marginBottom:3,textTransform:"capitalize"}}>{DIA_CORTO(slot.fecha)} · {slot.turno} · {slot.linea}</div>
        <div style={{fontSize:12.5,color:C.mutedD,marginBottom:14}}>Elige qué se fabrica en este hueco.</div>

        {(() => {
          if (!moldeLinea) return null;
          const eq = sugeridos
            .map(id => productos.find(x=>x.id===id))
            .filter(p => p && moldeDe(p) === moldeLinea)
            .map(p => ({ p, falta: (objetivo[p.id]||0) - (colocado[p.id]||0) }));
          if (!eq.length) return null;
          return (
            <div style={{background:C.greenBg,border:`1.5px solid ${C.green}55`,borderRadius:12,padding:"12px 13px",marginBottom:14}}>
              <div style={{fontFamily:F.h,fontWeight:800,fontSize:13,color:C.green,marginBottom:3}}>
                🔧 Equivalentes — molde {nombreMolde(moldeLinea)}
              </div>
              <div style={{fontSize:11.5,color:C.mutedD,lineHeight:1.5,marginBottom:9}}>
                Esta línea ya tiene montado ese molde. Cualquiera de estos entra sin parar a cambiarlo.
              </div>
              <Sel value={pid} onChange={setPid} placeholder="Elegir equivalente…"
                options={eq.map(({p,falta})=>({ value:p.id,
                  label:`${p.nombre}${falta>0.5?`  ·  faltan ${num(falta)}`:"  ·  completo"}` }))}/>
            </div>
          );
        })()}

        {sugeridos.length>0 && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:C.mutedD,fontWeight:800,marginBottom:6}}>TODO EL OBJETIVO DE LA SEMANA</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {sugeridos.map(id=>{
                const p = productos.find(x=>x.id===id);
                const falta = (objetivo[id]||0)-(colocado[id]||0);
                return (
                  <button key={id} onClick={()=>setPid(id)}
                    style={{background:pid===id?C.accent:"#fff",color:pid===id?"#fff":C.text,border:`1.5px solid ${pid===id?C.accent:C.border}`,
                      borderRadius:11,padding:"9px 12px",fontFamily:F.h,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                    <div>{codigoCorto(p?.nombre||"?")}</div>
                    {prodSub(p) && <div style={{fontSize:10.5,opacity:0.75,fontWeight:600}}>{prodSub(p)}</div>}
                    {falta>0.5 && <div style={{opacity:0.7,fontSize:11}}>faltan {num(falta)}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ProductoBuscador label="O busca otro producto" value={pid} onChange={setPid} productos={productos}/>

        {pid && (
          <>
            <div style={{background:ritmo>0?C.blueBg:C.redBg,borderRadius:11,padding:"11px 13px",marginBottom:12,fontSize:12.5,color:ritmo>0?C.text:C.red,lineHeight:1.6}}>
              {ritmo>0
                ? <>Ritmo estándar <b>{ritmo} uds</b> por turno con <b>{pers} personas</b>{p?.molde && <> · molde <b>🔧 {p.molde}</b></>}{dobles && <b style={{color:C.amber}}> — ocupa {Math.ceil(pers/persLinea)} líneas del turno</b>}</>
                : <>⚠️ Este producto no tiene ritmo definido. Ponlo en su ficha o el cuadre no contará bien.</>}
            </div>
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                <span style={{fontSize:11,color:C.mutedD,fontWeight:800}}>UNIDADES EN ESTE HUECO</span>
                {ritmo>0 && <button onClick={()=>{ const obj=objetivo[pid]||0;
                    const libre = obj ? obj - ((colocado[pid]||0) - calSlot(pid)) : ritmo;
                    setQ(String(Math.max(0, Math.round(Math.min(ritmo, libre))))); }}
                  style={{background:"none",border:"none",color:C.blue,fontSize:11.5,fontWeight:800,cursor:"pointer",padding:0}}>
                  poner el estándar ({ritmo})
                </button>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>setQ(String(Math.max(0,(parseFloat(q)||0)-5)))} style={{width:56,height:56,borderRadius:13,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>−</button>
                <input type="number" value={q} onChange={e=>setQ(e.target.value)}
                  style={{flex:1,height:56,textAlign:"center",borderRadius:13,border:`1.5px solid ${C.border}`,background:"#fff",color:C.text,fontFamily:F.h,fontWeight:900,fontSize:26,boxSizing:"border-box"}}/>
                <button onClick={()=>setQ(String((parseFloat(q)||0)+5))} style={{width:56,height:56,borderRadius:13,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>+</button>
              </div>
            </div>
          </>
        )}

        {pid && (() => {
          const obj = objetivo[pid]||0;
          if (!obj) return null;
          const libre = obj - ((colocado[pid]||0) - calSlot(pid));
          if (toNum(q) <= libre + 0.5) return null;
          return (
            <div style={{background:C.redBg,border:`1.5px solid ${C.red}`,borderRadius:11,padding:"11px 13px",marginBottom:14,
              fontSize:12.5,color:C.red,fontWeight:700,lineHeight:1.55}}>
              ⛔ Te pasas del reparto: de este producto la semana tiene <b>{num(obj)} uds</b> y en este hueco caben <b>{num(Math.max(0,libre))}</b> como mucho.
              Para fabricar más, súbelo en 📅 Mes.
            </div>
          );
        })()}

        {pid && ritmo>0 && toNum(q)>0 && toNum(q) < ritmo - 0.5 && (
          <div style={{background:C.amberBg,border:`1.5px solid ${C.amber}`,borderRadius:11,padding:"11px 13px",marginBottom:14,
            fontSize:12.5,color:C.amber,fontWeight:700,lineHeight:1.55}}>
            ⚠️ Por debajo del estándar: el ritmo de este turno son <b>{num(ritmo)} uds</b> y estás poniendo <b>{num(toNum(q))}</b>.
            Te dejas <b>{num(ritmo-toNum(q))} uds</b> sin fabricar en este hueco.
          </div>
        )}
        {pid && ritmo>0 && toNum(q) > ritmo + 0.5 && (
          <div style={{background:C.blueBg,borderRadius:11,padding:"11px 13px",marginBottom:14,fontSize:12.5,color:C.text,lineHeight:1.55}}>
            Por encima del estándar: son <b>{(toNum(q)/ritmo).toFixed(1)} turnos</b> de trabajo, no cabe en uno solo.
          </div>
        )}

        <div style={{display:"grid",gap:8}}>
          <Btn onClick={()=>{ if(!pid){window.alert("Elige un producto");return;} const n=parseFloat(q)||0; if(n<=0){window.alert("Pon las unidades");return;} onAsignar(slot,pid,n); }}>
            ✔ Poner en este hueco
          </Btn>
          {entrada && <Btn v="danger" onClick={onQuitar}>🗑️ Vaciar el hueco</Btn>}
          <Btn v="secondary" onClick={onCerrar}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

// ── TAB 2: PLAN SEMANAL + CUADRE ───────────────────────────────────────────────
function PlanSemanaTab({ semana, setSemana, semanas, plan, guardar, productos, mps, perfil, slotsDia=SLOTS_DIA, persLinea=3, persDia=12, turnosCentro=TURNOS_ABIERTOS, cfgLineas, centroNombre="", replicarEnMes, nSemanasMes=4, moldes=[], planMes={}, semanasMes=[] }) {
  // Sin Reparto: el objetivo es el plan del MES y se va gastando al colocar en cualquier semana
  const itemsMes = planMes.items || [];
  const colocadoEnMes = (pid) => semanasMes.reduce((a,w) =>
    a + (w.calendario||[]).filter(x=>x.producto_id===pid).reduce((b,x)=>b+toNum(x.cantidad),0), 0);
  const items = plan.items || [];
  const bloqueado = !!plan.cerrado_plan;
  const setItems = (v) => guardar({ items: v });
  const dispo = plan.slots_disponibles ?? slotsDia*5;
  const cal = plan.calendario || [];
  const [verObjetivo, setVerObjetivo] = useState(false);
  // El cuadre manda sobre lo que hay puesto en el calendario; si aún no hay calendario, sobre el objetivo
  const base = cal.length>0
    ? cal.map(x=>({ producto_id:x.producto_id, cantidad:x.cantidad }))
    : items;
  const r = calcRecursos(base, productos, persLinea);
  const dif = r.slots - dispo;
  const estado = dif > 0.2 ? "falta" : dif < -0.5 ? "sobra" : "ok";
  const col = estado==="ok"?C.green:estado==="falta"?C.red:C.amber;
  const bg  = estado==="ok"?C.greenBg:estado==="falta"?C.redBg:C.amberBg;

  // ═══ LAS TRES COMPROBACIONES ANTES DE CERRAR ═══════════════════════════════
  const CFGL = (cfgLineas && cfgLineas.length) ? cfgLineas : [{id:"_l1",nombre:"Línea 1",personas:3}];
  const TT = Array.from({length: turnosCentro}, (_,i)=>`T${i+1}`);
  const diasSem = diasDeSemana(semana);
  const totalHuecos = CFGL.length * TT.length * diasSem.length;
  const ritmoP = (pid) => toNum(productos.find(x=>x.id===pid)?.uds_turno_linea);
  const objSlot = (e) => {
    const rr = ritmoP(e.producto_id);
    if (rr <= 0) return 0;
    const n = e.grupo ? Math.max(1, cal.filter(x=>x.grupo===e.grupo).length) : 1;
    return rr / n;
  };

  // 1 · CAPACIDAD DE LÍNEA
  const huecosVacios = totalHuecos - cal.length;
  const flojos = cal.filter(e => objSlot(e) > 0 && objSlot(e) - toNum(e.cantidad) > 0.5);
  const udsPerdidas = flojos.reduce((a,e) => a + (objSlot(e) - toNum(e.cantidad)), 0);
  const check1 = huecosVacios === 0 && flojos.length === 0;

  // 2 · TURNOS CUADRADOS (personas necesarias frente a las disponibles, día a día)
  const persDeL = (n) => CFGL.find(l=>l.nombre===n)?.personas || 3;
  const diasDescuadrados = diasSem.filter(f => {
    const p = cal.filter(x=>x.fecha===f).reduce((a,x)=>a+persDeL(x.linea),0);
    return p !== persDia;
  });
  const check2 = cal.length>0 && diasDescuadrados.length === 0;

  // 3 · LO REPARTIDO, COLOCADO EN EL CALENDARIO
  const colocadoDe = (pid) => cal.filter(x=>x.producto_id===pid).reduce((a,x)=>a+toNum(x.cantidad),0);
  const descuadres = (plan.items||[]).map(it => ({
    pid: it.producto_id, obj: toNum(it.cantidad), col: colocadoDe(it.producto_id) }))
    .filter(x => Math.abs(x.obj - x.col) > 0.5);
  const sueltosEnCal = [...new Set(cal.map(x=>x.producto_id))]
    .filter(pid => !(plan.items||[]).some(it => it.producto_id === pid));
  const check3 = (plan.items||[]).length>0 && descuadres.length === 0 && sueltosEnCal.length === 0;

  const checks = [
    { ok: check1, titulo: "Capacidad de línea completa",
      detalle: check1 ? "Todos los huecos ocupados y a ritmo"
        : `${huecosVacios} hueco${huecosVacios!==1?"s":""} vacío${huecosVacios!==1?"s":""} · ${flojos.length} turno${flojos.length!==1?"s":""} por debajo del ritmo (${num(udsPerdidas)} uds)` },
    { ok: check2, titulo: "Turnos cuadrados con la plantilla",
      detalle: check2 ? `${persDia} personas todos los días`
        : (cal.length===0 ? "Sin calendario" : `${diasDescuadrados.length} día(s) descuadrado(s): ${diasDescuadrados.map(DIA_CORTO).join(" · ")}`) },
    { ok: check3, titulo: "Lo repartido está todo colocado",
      detalle: check3 ? "El calendario coincide con el reparto de la semana"
        : ((plan.items||[]).length===0 ? "Esta semana no tiene reparto"
          : [descuadres.length?`${descuadres.length} producto(s) descuadrado(s)`:"",
             sueltosEnCal.length?`${sueltosEnCal.length} en el calendario sin estar en el reparto`:""].filter(Boolean).join(" · ")) },
  ];
  const todoOk = checks.every(c => c.ok);

  const imprimir = () => {
    const CFG = (cfgLineas && cfgLineas.length) ? cfgLineas : [{nombre:"Línea 1",personas:3},{nombre:"Línea 2",personas:3}];
    const TT = Array.from({length: turnosCentro}, (_,i)=>`T${i+1}`);
    const ds = diasDeSemana(semana);
    const cabecera = ds.map(f=>`<th class="n">${esc(DIA_CORTO(f))}</th>`).join("");
    const cuerpo = TT.map(t => CFG.map(l => {
      const celdas = ds.map(f=>{
        const e = cal.find(x=>x.fecha===f && x.turno===t && x.linea===l.nombre);
        if (!e) return `<td class="n" style="color:#aaa">—</td>`;
        const p = productos.find(z=>z.id===e.producto_id);
        return `<td class="n"><b>${esc(codigoCorto(p?.nombre||"?"))}</b><br/>${num(e.cantidad)} uds${p?.molde?`<br/><span style="font-size:9px;color:#666">🔧 ${esc(p.molde)}</span>`:""}</td>`;
      }).join("");
      return `<tr><td><b>${esc(t)}</b> · ${esc(l.nombre)}<br/><span style="font-size:9px;color:#666">${l.personas}p</span></td>${celdas}</tr>`;
    }).join("")).join("");
    const porProducto = Object.entries(cal.reduce((a,x)=>{ a[x.producto_id]=(a[x.producto_id]||0)+toNum(x.cantidad); return a; },{}))
      .map(([pid,q])=>{
        const p = productos.find(z=>z.id===pid);
        return `<tr><td><b>${esc(p?.nombre||"?")}</b>${prodSub(p)?`<br/><span style="font-size:9.5px;color:#666">${esc(prodSub(p))}</span>`:""}</td><td class="n">${num(q)}</td><td class="n">${eur(toNum(p?.coste_objetivo)*q)}</td></tr>`;
      }).join("");
    const porDia = diasDeSemana(semana).map(f=>{
      const dd = cal.filter(x=>x.fecha===f);
      const pd = dd.reduce((a,x)=>a+(CFG.find(l=>l.nombre===x.linea)?.personas||3),0);
      return `<tr><td>${esc(DIA_CORTO(f))}</td><td class="n">${dd.length}/${CFG.length*TT.length}</td><td class="n">${num(dd.reduce((a,x)=>a+toNum(x.cantidad),0))}</td><td class="n">${pd}</td></tr>`;
    }).join("");
    imprimirHTML(`
      <h1>Planificación semanal — Semana ${semana.split("-W")[1]}</h1>
      <div class="sub">${esc(centroNombre)} · ${esc(rotuloSemana(semana))} · plantilla ${persDia} personas/día${plan.cerrado_plan?" · PLAN CERRADO":""}</div>
      ${plan.forzado ? `<div class="aviso"><b>Cerrado sin cuadrar.</b> Motivo: ${esc(plan.motivo_forzado||"")}${(plan.fallos_cierre||[]).length?` · Falla: ${esc((plan.fallos_cierre||[]).join(" · "))}`:""}</div>` : ""}
      <h2>Comprobaciones</h2>
      <table><tr><th>Comprobación</th><th>Estado</th><th>Detalle</th></tr>
        ${checks.map(c=>`<tr><td>${esc(c.titulo)}</td><td>${c.ok?"OK":"NO"}</td><td>${esc(c.detalle)}</td></tr>`).join("")}
      </table>
      <h2>Calendario de producción</h2>
      <table><tr><th>Turno · Línea</th>${cabecera}</tr>${cuerpo || `<tr><td colspan="${ds.length+1}">Sin calendario</td></tr>`}</table>
      <h2>Carga por día</h2>
      <table><tr><th>Día</th><th class="n">Huecos</th><th class="n">Uds</th><th class="n">Personas</th></tr>${porDia}</table>
      ${porProducto ? `<h2>Total por producto</h2><table><tr><th>Producto</th><th class="n">Uds</th><th class="n">Coste obj.</th></tr>${porProducto}</table>` : ""}
      ${bloqueRecursos(r, mps, 5, persDia)}
      ${pieInforme(perfil)}
    `);
  };

  const cerrarPlan = async () => {
    if (items.length===0) { window.alert("No hay nada planificado"); return; }
    const base = { slots_plan:r.slots, slots_dispo:dispo, coste_objetivo:r.coste, uds_objetivo:r.uds,
      huecos_vacios:huecosVacios, turnos_flojos:flojos.length, uds_perdidas:Math.round(udsPerdidas),
      cerrado_por:perfil?.nombre||"", cerrado_at:new Date().toISOString() };
    if (!todoOk) {
      const fallos = checks.filter(c=>!c.ok).map((c,i)=>`${i+1}. ${c.titulo}: ${c.detalle}`).join("\n");
      const motivo = window.prompt(
        "No se cumplen todas las comprobaciones:\n\n" + fallos +
        "\n\nPuedes cerrar igualmente, pero quedará registrado y saldrá en el informe al CEO.\nEscribe el motivo (o Cancelar):");
      if (!motivo || !motivo.trim()) return;
      await guardar({ ...base, cerrado_plan:true, forzado:true, motivo_forzado:motivo.trim(),
        fallos_cierre: checks.filter(c=>!c.ok).map(c=>c.titulo) });
      return;
    }
    await guardar({ ...base, cerrado_plan:true, forzado:false, motivo_forzado:"", fallos_cierre:[] });
  };

  return (
    <>
      {bloqueado && (
        <div style={{background:plan.forzado?C.amberBg:C.greenBg,border:`1.5px solid ${plan.forzado?C.amber:C.green}`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:plan.forzado?C.amber:C.green}}>
            {plan.forzado?"⚠️ Plan cerrado forzando el cuadre":"🔒 Plan cerrado y cuadrado"}
          </div>
          {plan.forzado && <>
            <div style={{fontSize:12.5,color:C.mutedD,marginTop:4,lineHeight:1.5}}>Motivo: {plan.motivo_forzado}</div>
            {(plan.fallos_cierre||[]).length>0 && <div style={{fontSize:12,color:C.amber,marginTop:3,fontWeight:700,lineHeight:1.5}}>Sin cuadrar: {(plan.fallos_cierre||[]).join(" · ")}</div>}
          </>}
          <button onClick={()=>{ if(window.confirm("¿Reabrir el plan de esta semana?")) guardar({cerrado_plan:false}); }}
            style={{background:"#fff",border:`1px solid ${C.border}`,color:C.mutedD,borderRadius:10,padding:"7px 14px",fontSize:12.5,fontWeight:700,cursor:"pointer",marginTop:8}}>↺ Reabrir</button>
        </div>
      )}

      <CalendarioSemana semana={semana} plan={plan} guardar={guardar} productos={productos} bloqueado={bloqueado} cfgLineas={cfgLineas} turnosCentro={turnosCentro} replicarEnMes={replicarEnMes} nSemanasMes={nSemanasMes} moldes={moldes}
        itemsMes={itemsMes} colocadoEnMes={colocadoEnMes}/>

      <button onClick={()=>setVerObjetivo(v=>!v)}
        style={{width:"100%",background:"#fff",border:`1.5px solid ${C.border}`,color:C.mutedD,borderRadius:12,padding:"13px",fontFamily:F.h,fontWeight:800,fontSize:13.5,cursor:"pointer",marginBottom:12}}>
        {verObjetivo?"▲ Ocultar":"▼ Ver y editar"} el objetivo de la semana ({items.length} producto{items.length!==1?"s":""})
      </button>
      {verObjetivo && <ItemsEditor items={items} setItems={setItems} productos={productos} bloqueado={bloqueado} persLinea={persLinea}/>}

      <RecursosCard r={r} mps={mps} dias={5} slotsDia={slotsDia} persDia={persDia} turnosCentro={turnosCentro} titulo={cal.length>0?"Recursos del calendario":"Recursos del objetivo"}/>

      <Card style={{marginBottom:12}} color={col+"66"}>
        <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,marginBottom:10}}>⚖️ Cuadre</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:24,color:col}}>{Math.ceil(r.personaTurnos/5)}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Personas al día que necesito</div>
          </div>
          <div style={{background:C.card2,borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontFamily:F.h,fontWeight:900,fontSize:24,color:C.text}}>{Math.round(dispo/(slotsDia*5)*persDia)}</div>
            <div style={{fontSize:10.5,color:C.mutedD}}>Personas al día que tengo</div>
          </div>
        </div>
        {!bloqueado && (
          <div style={{marginBottom:12}}>
            <div style={{fontFamily:F.h,fontWeight:700,fontSize:12,color:C.mutedD,marginBottom:6}}>LÍNEAS-TURNO DISPONIBLES ESTA SEMANA</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>guardar({slots_disponibles:Math.max(0,dispo-1)})} style={{width:52,height:52,borderRadius:12,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>−</button>
              <div style={{flex:1,height:52,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12,background:C.card2,fontFamily:F.h,fontWeight:900,fontSize:26,color:C.text}}>{dispo}</div>
              <button onClick={()=>guardar({slots_disponibles:dispo+1})} style={{width:52,height:52,borderRadius:12,border:`1.5px solid ${C.border}`,background:"#fff",fontSize:24,color:C.text,cursor:"pointer"}}>+</button>
            </div>
            <div style={{fontSize:11.5,color:C.mutedD,marginTop:6,lineHeight:1.5}}>
              Ahora mismo: <b style={{color:C.text}}>{Math.round(dispo/(slotsDia*5)*persDia)} personas al día</b>. Semana completa = {slotsDia*5} huecos ({slotsDia/turnosCentro} línea{slotsDia/turnosCentro!==1?"s":""} × {turnosCentro} turno{turnosCentro!==1?"s":""} × 5 días) = {persDia} personas al día. Baja el número por bajas o festivos.
            </div>
          </div>
        )}
        <div style={{background:bg,border:`1.5px solid ${col}`,borderRadius:10,padding:"11px 13px",fontSize:13.5,color:col,fontFamily:F.h,fontWeight:700,lineHeight:1.5}}>
          {estado==="ok" && "✔ Cuadra. Puedes cerrar el plan."}
          {estado==="falta" && `⛔ Faltan ${Math.ceil(dif*persLinea/5)} personas al día. Quita producción o suma gente.`}
          {estado==="sobra" && `⚠️ Sobran ${Math.max(1,Math.floor(-dif*persLinea/5))} personas al día sin trabajo asignado. Mete más producción.`}
        </div>
      </Card>

      {!bloqueado && (
        <Card style={{marginBottom:12}} color={(todoOk?C.green:C.amber)+"77"}>
          <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:todoOk?C.green:C.amber,marginBottom:3}}>
            {todoOk ? "✔ Listo para cerrar" : "Antes de cerrar la semana"}
          </div>
          <div style={{fontSize:12,color:C.mutedD,lineHeight:1.55,marginBottom:11}}>
            Tres cosas tienen que cuadrar. Puedes cerrar sin ellas, pero queda registrado.
          </div>
          {checks.map((c,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 0",
              borderBottom: i<checks.length-1 ? `1px solid ${C.card2}` : "none"}}>
              <div style={{flexShrink:0,width:26,height:26,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",
                background:c.ok?C.greenBg:C.amberBg,border:`1.5px solid ${c.ok?C.green:C.amber}`,
                color:c.ok?C.green:C.amber,fontSize:14,fontWeight:900}}>{c.ok?"✔":i+1}</div>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:F.h,fontWeight:700,fontSize:13.5,color:C.text}}>{c.titulo}</div>
                <div style={{fontSize:12,color:c.ok?C.mutedD:C.amber,marginTop:2,lineHeight:1.5,fontWeight:c.ok?400:700}}>{c.detalle}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{display:"grid",gap:9}}>
        <Btn onClick={imprimir} v="secondary">🖨️ Imprimir la planificación de la semana</Btn>
        {!bloqueado && <Btn onClick={cerrarPlan} v={todoOk?"primary":"secondary"}>
          {todoOk ? "🔒 Cerrar plan de la semana" : "🔒 Cerrar sin cuadrar (pedirá motivo)"}
        </Btn>}
      </div>
    </>
  );
}


// ── TAB 3: CIERRE SEMANAL ──────────────────────────────────────────────────────
function CierreSemanaTab({ semana, setSemana, semanas, plan, guardar, productos, mps, producciones, perfil }) {
  // Si hay calendario, ese es el objetivo real de la semana
  const cal = plan.calendario || [];
  const items = cal.length>0
    ? Object.entries(cal.reduce((a,x)=>{ a[x.producto_id]=(a[x.producto_id]||0)+(parseFloat(x.cantidad)||0); return a; },{}))
        .map(([producto_id,cantidad])=>({ id:producto_id, producto_id, cantidad }))
    : (plan.items || []);
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
              <div style={{minWidth:0}}>
                <b style={{fontFamily:F.h,fontSize:15,color:C.text,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nombre}</b>
                {prodSub(productos.find(x=>x.id===f.pid)) && <div style={{fontSize:11.5,color:C.mutedD,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prodSub(productos.find(x=>x.id===f.pid))}</div>}
              </div>
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
    { id:"planificacion", grupo:"proc", icon:"📅", bg:"#EEF2FF", label:"Planificación", sub:"Mes · semana · cuadre · cierre", roles:["gerencia","sup_fabrica"] },
    { id:"terminal",  grupo:"proc", icon:"🖥️", bg:"#ECFDF5", label:"Terminal de Planta",   sub:"Pantalla táctil del obrador",        roles:["gerencia","sup_fabrica","sup_oficina","operario"] },
    { id:"ordenes",   grupo:"proc", icon:"📋", bg:"#ECFDF5", label:"Órdenes de Producción", sub:"Planificar y registrar",     roles:["gerencia","sup_fabrica","sup_oficina"] },
    { id:"diario",    grupo:"proc", icon:"📖", bg:"#EFF6FF", label:"Diario de Fabricación", sub:"El parte oficial del día",          roles:["gerencia","sup_fabrica","sup_oficina"] },
    { id:"analitica", grupo:"proc", icon:"📊", bg:"#FDF2F8", label:"Analítica",         sub:"Evolución · costes · lotes · equipos", roles:["gerencia","sup_fabrica"] },
    { id:"seed", grupo:"herr",      icon:"🚀", bg:"#FFF7ED", label:"Carga Inicial",     sub:"Catálogo completo en 1 clic",          roles:["gerencia"] },
    { id:"synccat", grupo:"herr",   icon:"🔗", bg:"#F5F3FF", label:"Sincronizar Catálogo", sub:"Descripciones desde el CRM",         roles:["gerencia"] },
    { id:"importhist", grupo:"herr",icon:"📥", bg:"#FFFBEB", label:"Importar Histórico", sub:"Excel maestro → Firebase",              roles:["gerencia"] },
    { id:"centros", grupo:"maestros",   icon:"🏭", bg:"#EFF6FF", label:"Centros de Trabajo", sub:`${counts.centros} centros`,           roles:["gerencia"] },
    { id:"lineas", grupo:"maestros",    icon:"⚙️", bg:"#F1F5F9", label:"Líneas de Producción", sub:`${counts.lineas} líneas`,            roles:["gerencia"] },
    { id:"usuarios", grupo:"maestros",  icon:"👥", bg:"#F5F3FF", label:"Usuarios",          sub:`${counts.usuarios} registrados`,      roles:["gerencia"] },
    { id:"turnos", grupo:"maestros",    icon:"🕐", bg:"#FFFBEB", label:"Turnos",            sub:`${counts.turnos} configurados`,        roles:["gerencia"] },
    { id:"procesos", grupo:"maestros",  icon:"⚙️", bg:"#F1F5F9", label:"Procesos",          sub:`${counts.procesos} en catálogo`,       roles:["gerencia","sup_fabrica"] },
    { id:"mps", grupo:"maestros",       icon:"📦", bg:"#F0FDF4", label:"Materias Primas",   sub:`${counts.mps} con objetivo`,           roles:["gerencia","sup_fabrica","sup_calidad"] },
    { id:"provs", grupo:"maestros",     icon:"🚚", bg:"#EFF6FF", label:"Proveedores",       sub:`${counts.provs} activos`,              roles:["gerencia","sup_calidad"] },
    { id:"productos", grupo:"maestros", icon:"🏷️", bg:"#FFFBEB", label:"Productos",         sub:`${counts.productos} con coste obj.`,   roles:["gerencia","sup_fabrica"] },
    { id:"motivos", grupo:"maestros",   icon:"⏸", bg:"#FEF2F2", label:"Motivos de Paro",   sub:`${counts.motivos} configurados`,       roles:["gerencia","sup_fabrica"] },
    { id:"costes", grupo:"maestros",    icon:"💰", bg:"#F0FDF4", label:"Costes Fijos",      sub:"Reparto por hora",                     roles:["gerencia"] },
    { id:"moldes", grupo:"maestros",    icon:"🔧", bg:"#F1F5F9", label:"Moldes",            sub:`${counts.moldes||0} en catálogo`,      roles:["gerencia","sup_fabrica"] },
  ].filter(t=>t.roles.includes(perfil.rol));

  const SECCIONES = [
    ["proc",     "🏭 Producción",        "El día a día: planificar, fabricar y medir"],
    ["maestros", "🗂️ Archivos maestros", "Lo que se configura una vez"],
    ["herr",     "🛠️ Herramientas",      "Cargas e importaciones"],
  ];

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
          {SECCIONES.map(([g, titulo, desc]) => {
            const grupo = tiles.filter(t => t.grupo === g);
            if (!grupo.length) return null;
            return (
              <div key={g} style={{gridColumn:"1 / -1"}}>
                <div style={{padding:"14px 2px 8px"}}>
                  <div style={{fontFamily:F.h,fontWeight:800,fontSize:14,color:C.text,letterSpacing:0.2}}>{titulo}</div>
                  <div style={{fontSize:12,color:C.mutedD,marginTop:1}}>{desc}</div>
                </div>
                <div style={{display:"grid",gap:10}}>
                  {grupo.map(t=>(
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
            );
          })}
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
  const [moldes]   = useCol("moldes", "nombre");
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
  ` + PRINT_CSS;

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
  const counts = { centros:centros.length, lineas:lineas.length, motivos:motivos.length, usuarios:usuarios.length, turnos:turnos.length, procesos:procesos.length, mps:mps.length, provs:provs.length, productos:productos.length, moldes:moldes.length };

  return (
    <div style={{fontFamily:F.b}}>
      <style>{STYLES}</style>
      {view==="home"      && <Home perfil={perfil} onGo={setView} onLogout={()=>signOut(auth)} counts={counts} ordenes={ordenesRoot} producciones={produccionesRoot} productos={productos}/>}
      {view==="moldes"    && <MoldesScreen onBack={back} productos={productos}/>}
      {view==="terminal"  && <TerminalPlanta onBack={back} perfil={perfil} productos={productos} lineas={lineas}
        turnos={turnos} centros={centros} mps={mps} motivos={motivos} ordenes={ordenesRoot} moldes={moldes}/>}
      {view==="planificacion" && <PlanificacionScreen onBack={back} perfil={perfil} productos={productos} mps={mps} producciones={produccionesRoot} centros={centros} lineas={lineas} moldes={moldes} procesos={procesos}/>}
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
