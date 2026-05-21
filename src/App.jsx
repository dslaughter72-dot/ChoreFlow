import { useState, useEffect, useCallback } from "react";
import {
  registerFamily, loginFamily, logoutFamily,
  onAuthChange, syncToCloud, loadFromCloud, listenToCloud
} from "./firebase";

// ── CONSTANTS ────────────────────────────────────────────────
const TIME_SLOTS = [
  { id:"morning",  label:"Morning",  icon:"🌅", color:"#f59e0b", light:"#fef3c7" },
  { id:"anytime",  label:"Anytime",  icon:"☀️",  color:"#7c3aed", light:"#ede9fe" },
  { id:"evening",  label:"Evening",  icon:"🌙", color:"#1d4ed8", light:"#dbeafe" },
];
const TIER = {
  1: { label:"Expected",   color:"#059669", light:"#d1fae5", icon:"✅" },
  2: { label:"Paid Chore", color:"#d97706", light:"#fef3c7", icon:"💰" },
};
const KID_PRESETS = [
  { color:"#7c3aed", light:"#ede9fe", mid:"#c4b5fd" },
  { color:"#db2777", light:"#fce7f3", mid:"#f9a8d4" },
  { color:"#0891b2", light:"#cffafe", mid:"#67e8f9" },
  { color:"#16a34a", light:"#dcfce7", mid:"#86efac" },
  { color:"#ea580c", light:"#ffedd5", mid:"#fdba74" },
  { color:"#2563eb", light:"#dbeafe", mid:"#93c5fd" },
  { color:"#c026d3", light:"#fae8ff", mid:"#e879f9" },
];
const KID_EMOJIS  = ["🧒","🧑","👦","👧","🧑‍🦱","🧑‍🦰","🧑‍🦳"];
const REWARD_ICONS= ["🎮","🍕","🎬","👟","🎯","🏖️","🎪","🛍️","🍦","📱","🎨","🎲"];

const DEFAULT_POOL = [
  { id:"p1", name:"Mow the lawn",            pay:20 },
  { id:"p2", name:"Clean out the refrigerator", pay:15 },
  { id:"p3", name:"Clean the baseboards",    pay:10 },
  { id:"p4", name:"Wash the car",            pay:15 },
  { id:"p5", name:"Deep clean the bathroom", pay:15 },
  { id:"p6", name:"Organize the garage",     pay:25 },
];
const DEFAULT_REWARDS = [
  { id:"r1", name:"Movie night pick",    icon:"🎬", points:50  },
  { id:"r2", name:"Pizza night",         icon:"🍕", points:75  },
  { id:"r3", name:"Stay up 1 hour late", icon:"🌙", points:40  },
  { id:"r4", name:"$5 spending money",   icon:"💵", points:100 },
  { id:"r5", name:"Choose dinner",       icon:"🍽️", points:60  },
];
const DEFAULT_KIDS = [
  { id:1, name:"Kid 1", emoji:"🧑", ...KID_PRESETS[0], pin:"1234", largeIcons:false,
    chores:[
      { id:1, name:"Make bed",    tier:1, pay:0, timeSlot:"morning" },
      { id:2, name:"Clean room",  tier:1, pay:0, timeSlot:"anytime" },
      { id:3, name:"Do laundry",  tier:2, pay:5, timeSlot:"anytime" },
      { id:4, name:"Cook dinner", tier:2, pay:5, timeSlot:"evening" },
    ]},
];

const todayKey = () => new Date().toISOString().slice(0,10);
const weekKey  = () => { const d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1); return new Date(d.setDate(diff)).toISOString().slice(0,10); };
const monthKey = () => new Date().toISOString().slice(0,7);

// ── STYLES ───────────────────────────────────────────────────
const font    = "'Nunito',sans-serif";
const textPri = "#111827";
const textSec = "#6b7280";
const border  = "#e5e7eb";
const white   = "#ffffff";
const bg      = "#f9fafb";

const S = {
  card:  (x={}) => ({ background:white, border:`1px solid ${border}`, borderRadius:20, padding:"16px 18px", margin:"10px 14px 0", ...x }),
  pill:  (b,c)  => ({ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:20, background:b, color:c }),
  statC: (b,c)  => ({ flex:1, background:b, borderRadius:16, padding:"12px 10px", textAlign:"center", border:`1.5px solid ${c}44` }),
  inp:   { background:"#f3f4f6", border:"1.5px solid #e5e7eb", borderRadius:12, color:textPri, padding:"9px 14px", fontSize:14, width:"100%", boxSizing:"border-box", fontFamily:font },
  sel:   { background:"#f3f4f6", border:"1.5px solid #e5e7eb", borderRadius:12, color:textPri, padding:"9px 14px", fontSize:14, fontFamily:font },
  btn:   (b,c="#fff") => ({ background:b, color:c, border:"none", borderRadius:12, padding:"10px 18px", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:font }),
  kidTab:(a,k) => ({ padding:"7px 14px", borderRadius:20, border:`2px solid ${a?k.color:border}`, background:a?k.light:"transparent", color:a?k.color:textSec, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }),
};

// ── AUTH SCREEN ──────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode,    setMode]    = useState("welcome"); // welcome | login | signup
  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [confirm, setConfirm] = useState("");
  const [name,    setName]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "signup") {
        if (!name.trim())         { setLoading(false); return setError("Please enter your name."); }
        if (password !== confirm) { setLoading(false); return setError("Passwords don't match."); }
        if (password.length < 6)  { setLoading(false); return setError("Password must be at least 6 characters."); }
        const uid = await registerFamily(email, password);
        onAuth(uid, name);
      } else {
        const uid = await loginFamily(email, password);
        onAuth(uid, null);
      }
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setError("Account exists. Try logging in.");
      else if (e.code === "auth/user-not-found")  setError("No account found. Try signing up.");
      else if (e.code === "auth/wrong-password")  setError("Incorrect password.");
      else if (e.code === "auth/invalid-email")   setError("Please enter a valid email.");
      else if (e.code === "auth/invalid-credential") setError("Incorrect email or password.");
      else setError("Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  // ── WELCOME PAGE (first screen) ──
  if (mode === "welcome") return (
    <div style={{ minHeight:"100vh", fontFamily:font, position:"relative", overflow:"hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}} @keyframes floatB{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}`}</style>

      {/* Background */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,#1a1a2e 0%,#2d1b4e 40%,#1a2a4e 100%)" }}/>
      <div style={{ position:"absolute", top:-60, right:-60, width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,#ff6b3522,transparent)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", bottom:-80, left:-80, width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle,#7c3aed22,transparent)", pointerEvents:"none" }}/>

      {/* Floating stars */}
      <div style={{ position:"absolute", top:50, left:30, fontSize:28, animation:"float 4s ease-in-out infinite", opacity:.5 }}>⭐</div>
      <div style={{ position:"absolute", top:90, right:40, fontSize:20, animation:"floatB 3.5s ease-in-out infinite", opacity:.4 }}>✨</div>
      <div style={{ position:"absolute", bottom:140, right:30, fontSize:24, animation:"float 5s ease-in-out infinite", opacity:.35 }}>🌟</div>
      <div style={{ position:"absolute", bottom:200, left:24, fontSize:18, animation:"floatB 4.5s ease-in-out infinite", opacity:.35 }}>⭐</div>

      <div style={{ position:"relative", zIndex:5, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"40px 24px", textAlign:"center" }}>

        {/* Broom icon + logo */}
        <div style={{ fontSize:64, marginBottom:10, filter:"drop-shadow(0 4px 16px rgba(255,107,53,0.5))", animation:"float 4s ease-in-out infinite" }}>🧹</div>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:44, color:"#fff", letterSpacing:1, marginBottom:8, lineHeight:1 }}>
          Chore<span style={{ color:"#FFD93D" }}>Flow</span>
        </div>
        <div style={{ fontSize:16, color:"rgba(255,255,255,0.65)", fontWeight:700, marginBottom:12, maxWidth:300, lineHeight:1.6 }}>
          Making chores fun,<br/>one family at a time 🌟
        </div>

        {/* First time tip box */}
        <div style={{ background:"rgba(255,217,61,0.12)", border:"1.5px solid rgba(255,217,61,0.35)", borderRadius:18, padding:"16px 20px", marginBottom:36, maxWidth:340, width:"100%", textAlign:"left" }}>
          <div style={{ fontSize:14, fontWeight:900, color:"#FFD93D", marginBottom:6 }}>👋 First time here?</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:1.7, fontWeight:600 }}>
            1. Create your family account below<br/>
            2. Log in as <strong style={{ color:"#fff" }}>Parent</strong> using PIN <strong style={{ color:"#FFD93D" }}>0000</strong><br/>
            3. Add your kids & set everything up<br/>
            4. Update your PIN in the Edit tab!
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:340 }}>
          <button onClick={()=>setMode("signup")} style={{ background:"linear-gradient(135deg,#FF6B35,#ff9a6c)", border:"none", borderRadius:18, padding:"18px", fontSize:17, fontWeight:900, color:"#fff", cursor:"pointer", fontFamily:font, boxShadow:"0 8px 28px rgba(255,107,53,0.45)" }}>
            🚀 Create Family Account
          </button>
          <button onClick={()=>setMode("login")} style={{ background:"rgba(255,255,255,0.08)", border:"2px solid rgba(255,255,255,0.2)", borderRadius:18, padding:"16px", fontSize:16, fontWeight:800, color:"#fff", cursor:"pointer", fontFamily:font }}>
            Already have an account? Log In →
          </button>
        </div>

        <div style={{ marginTop:24, fontSize:12, color:"rgba(255,255,255,0.3)", fontWeight:700 }}>🔒 Your family data is private & secure</div>
        <div style={{ marginTop:10, fontSize:12, color:"rgba(255,255,255,0.25)", fontWeight:600 }}>
          Need help? <a href="mailto:info@mychoreflow.com" style={{ color:"rgba(255,217,61,0.5)", textDecoration:"none", fontWeight:700 }}>info@mychoreflow.com</a>
        </div>
      </div>
    </div>
  );

  // ── LOGIN / SIGNUP FORM ──
  return (
    <div style={{ minHeight:"100vh", position:"relative", overflow:"hidden", fontFamily:font }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,#1a1a2e 0%,#2d1b4e 40%,#1a2a4e 100%)" }}/>

      <div style={{ position:"relative", zIndex:5, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:24 }}>
        <button onClick={()=>setMode("welcome")} style={{ position:"absolute", top:24, left:24, background:"rgba(255,255,255,0.1)", border:"none", borderRadius:10, color:"rgba(255,255,255,0.7)", fontSize:14, padding:"8px 14px", cursor:"pointer", fontFamily:font, fontWeight:700 }}>← Back</button>

        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:28, color:"#fff", marginBottom:4 }}>🧹 Chore<span style={{ color:"#FFD93D" }}>Flow</span></div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)", marginBottom:28, fontWeight:700 }}>
          {mode==="signup" ? "Create your family account" : "Welcome back!"}
        </div>

        <div style={{ background:"rgba(255,255,255,0.05)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:24, padding:28, width:"100%", maxWidth:380 }}>
          {mode==="signup" && <>
            <div style={{ fontWeight:700, fontSize:13, color:"rgba(255,255,255,0.7)", marginBottom:6 }}>Your Name</div>
            <input style={{ ...S.inp, marginBottom:14, background:"rgba(255,255,255,0.08)", border:"1.5px solid rgba(255,255,255,0.15)", color:"#fff" }} placeholder="e.g. The Johnson Family" value={name} onChange={e=>setName(e.target.value)}/>
          </>}

          <div style={{ fontWeight:700, fontSize:13, color:"rgba(255,255,255,0.7)", marginBottom:6 }}>Email</div>
          <input style={{ ...S.inp, marginBottom:14, background:"rgba(255,255,255,0.08)", border:"1.5px solid rgba(255,255,255,0.15)", color:"#fff" }} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>

          <div style={{ fontWeight:700, fontSize:13, color:"rgba(255,255,255,0.7)", marginBottom:6 }}>Password</div>
          <input style={{ ...S.inp, marginBottom:mode==="signup"?14:24, background:"rgba(255,255,255,0.08)", border:"1.5px solid rgba(255,255,255,0.15)", color:"#fff" }} type="password" placeholder={mode==="signup"?"At least 6 characters":"••••••••"} value={password} onChange={e=>setPassword(e.target.value)}/>

          {mode==="signup" && <>
            <div style={{ fontWeight:700, fontSize:13, color:"rgba(255,255,255,0.7)", marginBottom:6 }}>Confirm Password</div>
            <input style={{ ...S.inp, marginBottom:24, background:"rgba(255,255,255,0.08)", border:"1.5px solid rgba(255,255,255,0.15)", color:"#fff" }} type="password" placeholder="Re-enter password" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
          </>}

          {error && <div style={{ background:"rgba(220,38,38,0.2)", color:"#fca5a5", fontSize:13, fontWeight:700, padding:"10px 14px", borderRadius:10, marginBottom:16, border:"1px solid rgba(220,38,38,0.3)" }}>{error}</div>}

          <button onClick={submit} disabled={loading} style={{ ...S.btn(loading?"#555":"#FF6B35"), width:"100%", padding:14, fontSize:15, opacity:loading?.7:1, borderRadius:14 }}>
            {loading ? "Please wait..." : mode==="login" ? "Log In →" : "Create Account →"}
          </button>

          <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:"rgba(255,255,255,0.4)", fontWeight:700 }}>
            {mode==="login" ? <>New family? <button onClick={()=>{setMode("signup");setError("");}} style={{ background:"none", border:"none", color:"#FFD93D", fontWeight:800, cursor:"pointer", fontFamily:font, fontSize:13 }}>Sign up free →</button></> 
            : <>Have an account? <button onClick={()=>{setMode("login");setError("");}} style={{ background:"none", border:"none", color:"#FFD93D", fontWeight:800, cursor:"pointer", fontFamily:font, fontSize:13 }}>Log in →</button></>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PIN PAD ──────────────────────────────────────────────────
function PinPad({ title, subtitle, color="#7c3aed", light="#ede9fe", pinCheck, onSuccess, onBack }) {
  const [digits,setDigits]=useState([]);
  const [shake, setShake] =useState(false);
  const [error, setError] =useState("");
  const press = d => {
    if (digits.length>=4) return;
    const next=[...digits,d]; setDigits(next); setError("");
    if (next.length===4) setTimeout(()=>{
      if (pinCheck(next.join(""))) onSuccess();
      else { setShake(true); setError("Wrong PIN — try again"); setDigits([]); setTimeout(()=>setShake(false),500); }
    },150);
  };
  const kS = c => ({ width:72,height:72,borderRadius:20,border:`2px solid ${c}33`,background:`${c}12`,color:textPri,fontSize:22,fontWeight:800,cursor:"pointer",fontFamily:font });
  return (
    <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:28,background:"#f8f7ff",fontFamily:font }}>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{ width:80,height:80,borderRadius:24,background:light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,marginBottom:16 }}>🔐</div>
      <div style={{ fontSize:22,fontWeight:900,color,marginBottom:4,textAlign:"center" }}>{title}</div>
      <div style={{ fontSize:14,color:textSec,marginBottom:32,textAlign:"center" }}>{subtitle}</div>
      <div style={{ display:"flex",gap:16,marginBottom:24,animation:shake?"shake .4s":"none" }}>
        {[0,1,2,3].map(i=><div key={i} style={{ width:16,height:16,borderRadius:"50%",border:`2px solid ${color}`,background:digits[i]!==undefined?color:"transparent",transition:"background .15s" }}/>)}
      </div>
      {error && <div style={{ color:"#dc2626",fontSize:13,fontWeight:700,marginBottom:12 }}>{error}</div>}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16 }}>
        {[1,2,3,4,5,6,7,8,9].map(n=><button key={n} onClick={()=>press(String(n))} style={kS(color)}>{n}</button>)}
        <div/><button onClick={()=>press("0")} style={kS(color)}>0</button>
        <button onClick={()=>setDigits(p=>p.slice(0,-1))} style={kS("#9ca3af")}>⌫</button>
      </div>
      {onBack && <button onClick={onBack} style={{ background:"transparent",border:"none",color:"#9ca3af",fontSize:14,cursor:"pointer",fontWeight:700,fontFamily:font }}>← Back</button>}
    </div>
  );
}

// ── WELCOME ──────────────────────────────────────────────────
function Welcome({ kids, familyName, onKid, onParent, onWallboard }) {
  const isFirstTime = kids.length === 1 && kids[0].name === "Kid 1";
  return (
    <div style={{ minHeight:"100vh", fontFamily:font, position:"relative", overflow:"hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-12px) rotate(5deg)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(-5deg)} }
        .kid-btn:hover { transform: translateY(-3px) !important; }
      `}</style>

      {/* Gradient background */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,#1a1a2e 0%,#2d1b4e 40%,#1a2a4e 100%)" }}/>

      {/* Floating color blobs */}
      <div style={{ position:"absolute", top:-60, right:-60, width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,#ff6b3522,transparent)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", bottom:-80, left:-80, width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle,#7c3aed22,transparent)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", top:"40%", left:-40, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,#ffd93d11,transparent)", pointerEvents:"none" }}/>

      {/* Floating emoji decorations */}
      <div style={{ position:"absolute", top:40, left:30, fontSize:28, animation:"float 4s ease-in-out infinite", opacity:.4 }}>⭐</div>
      <div style={{ position:"absolute", top:80, right:40, fontSize:22, animation:"floatB 3.5s ease-in-out infinite", opacity:.4 }}>✨</div>
      <div style={{ position:"absolute", bottom:120, right:30, fontSize:26, animation:"float 5s ease-in-out infinite", opacity:.3 }}>🌟</div>
      <div style={{ position:"absolute", bottom:180, left:20, fontSize:20, animation:"floatB 4.5s ease-in-out infinite", opacity:.3 }}>⭐</div>

      {/* Content */}
      <div style={{ position:"relative", zIndex:5, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"28px 24px" }}>

        {/* Logo */}
        <div style={{ marginBottom:6, fontSize:56, filter:"drop-shadow(0 4px 12px rgba(255,107,53,0.4))" }}>🧹</div>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:36, color:"#fff", letterSpacing:1, marginBottom:4, textShadow:"0 2px 20px rgba(255,107,53,0.3)" }}>
          Chore<span style={{ color:"#FFD93D" }}>Flow</span>
        </div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)", marginBottom:28, fontWeight:700 }}>
          {familyName ? `Welcome back, ${familyName}! 👋` : "Making chores fun, one family at a time"}
        </div>

        {/* First time tip */}
        {isFirstTime && (
          <div style={{ background:"rgba(255,217,61,0.15)", border:"1.5px solid rgba(255,217,61,0.4)", borderRadius:16, padding:"12px 18px", marginBottom:20, maxWidth:340, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#FFD93D", marginBottom:4 }}>👋 First time here?</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", lineHeight:1.6 }}>
              Tap <strong style={{ color:"#fff" }}>Parent</strong> below to get started.<br/>
              Your default PIN is <strong style={{ color:"#FFD93D" }}>0000</strong> — update it once you're in!
            </div>
          </div>
        )}

        {/* Kid buttons */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:360, marginBottom:14 }}>
          {!isFirstTime && kids.map(k=>(
            <button key={k.id} className="kid-btn" onClick={()=>onKid(k)} style={{ background:`linear-gradient(135deg,${k.color}22,${k.color}11)`, border:`2px solid ${k.color}66`, borderRadius:22, padding:"16px 20px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", fontFamily:font, backdropFilter:"blur(10px)", transition:"transform .2s", width:"100%" }}>
              <div style={{ width:52, height:52, borderRadius:16, background:k.light, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0, boxShadow:`0 4px 12px ${k.color}44` }}>{k.emoji}</div>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:18, fontWeight:900, color:"#fff" }}>{k.name}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", fontWeight:600 }}>Tap to enter your PIN</div>
              </div>
              <div style={{ marginLeft:"auto", color:k.mid, fontSize:22 }}>›</div>
            </button>
          ))}
        </div>

        {/* Parent + Wallboard buttons */}
        <div style={{ display:"flex", gap:10, width:"100%", maxWidth:360 }}>
          <button onClick={onParent} style={{ flex:1, background:"rgba(255,107,53,0.9)", border:"none", borderRadius:20, padding:"16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontFamily:font, boxShadow:"0 8px 24px rgba(255,107,53,0.4)", transition:"transform .2s" }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>👩‍💼</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:14, fontWeight:900, color:"#fff" }}>Parent</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)" }}>Admin view</div>
            </div>
          </button>
          <button onClick={onWallboard} style={{ flex:1, background:"rgba(124,58,237,0.9)", border:"none", borderRadius:20, padding:"16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontFamily:font, boxShadow:"0 8px 24px rgba(124,58,237,0.4)", transition:"transform .2s" }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📺</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:14, fontWeight:900, color:"#fff" }}>WallBoard</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)" }}>All kids at once</div>
            </div>
          </button>
        </div>

        {/* Bottom tagline */}
        <div style={{ marginTop:28, fontSize:12, color:"rgba(255,255,255,0.3)", fontWeight:700, textAlign:"center" }}>
          🔒 Your family's data is private & secure
        </div>
        <div style={{ marginTop:8, fontSize:12, color:"rgba(255,255,255,0.25)", fontWeight:600, textAlign:"center" }}>
          Need help? <a href="mailto:info@mychoreflow.com" style={{ color:"rgba(255,217,61,0.5)", textDecoration:"none", fontWeight:700 }}>info@mychoreflow.com</a>
        </div>
      </div>
    </div>
  );
}

// ── WALLBOARD ────────────────────────────────────────────────
function WallBoard({ kids, completions, earnings, onBack }) {
  const TK=todayKey();
  const [tick,setTick]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setTick(x=>x+1),60000); return ()=>clearInterval(t); },[]);
  const now=new Date(), timeStr=now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}), dateStr=now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  return (
    <div style={{ minHeight:"100vh",background:"#0f0a1e",fontFamily:font,padding:"24px 28px",color:"#fff" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28 }}>
        <div>
          <div style={{ fontSize:32,fontWeight:900,background:"linear-gradient(90deg,#c084fc,#67e8f9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>🧹 ChoreFlow</div>
          <div style={{ fontSize:14,color:"#a5b4fc",marginTop:2 }}>{dateStr}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:36,fontWeight:900,color:"#fff" }}>{timeStr}</div>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,color:"#a5b4fc",fontSize:12,padding:"5px 14px",cursor:"pointer",fontFamily:font,marginTop:4 }}>← Exit</button>
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.min(kids.length,4)},1fr)`,gap:20 }}>
        {kids.map(k=>{
          const done=k.chores.filter(c=>completions[k.id]?.[TK]?.[c.id]).length,total=k.chores.length,pct=total>0?Math.round((done/total)*100):0,owed=earnings[k.id]?.total||0;
          let streak=0; for(const d of Object.keys(completions[k.id]||{}).sort().reverse()){ if(k.chores.filter(c=>completions[k.id]?.[d]?.[c.id]).length===k.chores.length)streak++; else break; }
          return (
            <div key={k.id} style={{ background:`linear-gradient(160deg,${k.color}22,${k.light}44)`,border:`2px solid ${k.color}55`,borderRadius:24,padding:20 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
                <div style={{ width:56,height:56,borderRadius:18,background:k.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30 }}>{k.emoji}</div>
                <div><div style={{ fontSize:20,fontWeight:900,color:"#fff" }}>{k.name}</div><div style={{ fontSize:13,color:"#cbd5e1" }}>{done}/{total} done</div></div>
              </div>
              <div style={{ fontSize:48,fontWeight:900,color:pct===100?"#34d399":k.mid,lineHeight:1 }}>{pct}<span style={{ fontSize:24 }}>%</span></div>
              {pct===100&&<div style={{ fontSize:18,marginTop:4 }}>🎉 All done!</div>}
              <div style={{ height:10,borderRadius:8,background:"rgba(255,255,255,0.15)",margin:"12px 0" }}>
                <div style={{ height:"100%",width:`${pct}%`,background:pct===100?"#34d399":k.color,borderRadius:8,transition:"width .8s" }}/>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                <div style={{ background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"10px",textAlign:"center" }}><div style={{ fontSize:18,fontWeight:900,color:"#fbbf24" }}>${owed.toFixed(2)}</div><div style={{ fontSize:11,color:"#94a3b8" }}>Owed</div></div>
                <div style={{ background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"10px",textAlign:"center" }}><div style={{ fontSize:18,fontWeight:900,color:"#34d399" }}>{streak}🔥</div><div style={{ fontSize:11,color:"#94a3b8" }}>Streak</div></div>
              </div>
              <div style={{ marginTop:14 }}>
                {TIME_SLOTS.map(slot=>{
                  const sc=k.chores.filter(c=>(c.timeSlot||"anytime")===slot.id);
                  if(!sc.length) return null;
                  return (<div key={slot.id} style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)",marginBottom:4 }}>{slot.icon} {slot.label}</div>
                    {sc.map(c=>{const isDone=completions[k.id]?.[TK]?.[c.id]; return (
                      <div key={c.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 0" }}>
                        <div style={{ width:18,height:18,borderRadius:5,border:`2px solid ${isDone?k.color:"rgba(255,255,255,0.3)"}`,background:isDone?k.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                          {isDone&&<span style={{ color:"#fff",fontSize:10,fontWeight:900 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:12,color:isDone?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.85)",textDecoration:isDone?"line-through":"none",fontWeight:600 }}>{c.name}</span>
                      </div>
                    );})}
                  </div>);
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────
export default function ChoreTracker() {
  // ── Firebase auth state
  const [uid,        setUid]        = useState(null);
  const [familyName, setFamilyName] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const [syncing,    setSyncing]    = useState(false);

  // ── App data
  const [kids,        setKids]       = useState(DEFAULT_KIDS);
  const [completions, setCompletions]= useState({});
  const [earnings,    setEarnings]   = useState({});
  const [pool,        setPool]       = useState(DEFAULT_POOL);
  const [poolClaims,  setPoolClaims] = useState({});
  const [rewards,     setRewards]    = useState(DEFAULT_REWARDS);
  const [redeemed,    setRedeemed]   = useState({});
  const [parentPin,   setParentPin]  = useState("0000");

  // ── UI state
  const [screen,      setScreen]     = useState("welcome");
  const [pendingKid,  setPendingKid] = useState(null);
  const [activeKid,   setActiveKid]  = useState(null);
  const [view,        setView]       = useState("today");
  const [editTab,     setEditTab]    = useState(0);
  const [newChore,    setNewChore]   = useState({name:"",tier:1,pay:0,timeSlot:"morning"});
  const [newPool,     setNewPool]    = useState({name:"",pay:10});
  const [newReward,   setNewReward]  = useState({name:"",icon:"🎮",points:50});
  const [newParPin,   setNewParPin]  = useState("");
  const [showPay,     setShowPay]    = useState(null);
  const [showAddKid,  setShowAddKid] = useState(false);
  const [showRmKid,   setShowRmKid]  = useState(false);
  const [newKid,      setNewKid]     = useState({name:"",pin:"",emoji:"🧒",...KID_PRESETS[0],largeIcons:false});
  const [editSection, setEditSection]= useState("profile");
  const [saveStatus,  setSaveStatus]  = useState("");

  // ── Listen for Firebase auth changes
  useEffect(()=>{
    const unsub = onAuthChange(async user => {
      if (user) {
        setUid(user.uid);
        // Load family data from cloud
        setSyncing(true);
        const data = await loadFromCloud(user.uid);
        if (data) {
          if (data.kids)        setKids(data.kids.map(k=>({...k,chores:k.chores.map(c=>({...c,timeSlot:c.timeSlot||"anytime"}))})));
          if (data.completions) setCompletions(data.completions);
          if (data.earnings)    setEarnings(data.earnings);
          if (data.pool)        setPool(data.pool);
          if (data.poolClaims)  setPoolClaims(data.poolClaims);
          if (data.rewards)     setRewards(data.rewards);
          if (data.redeemed)    setRedeemed(data.redeemed);
          if (data.parentPin)   setParentPin(data.parentPin);
          if (data.familyName)  setFamilyName(data.familyName);
        }
        setSyncing(false);
      } else {
        setUid(null);
      }
      setAuthReady(true);
    });
    return ()=>unsub();
  },[]);

  // ── Sync to cloud whenever data changes
  const doSync = useCallback(async ()=>{
    if (!uid) return;
    setSaveStatus('saving');
    await syncToCloud(uid,{ kids, completions, earnings, pool, poolClaims, rewards, redeemed, parentPin, familyName });
    setSaveStatus('saved');
    setTimeout(()=>setSaveStatus(''), 2000);
  },[uid, kids, completions, earnings, pool, poolClaims, rewards, redeemed, parentPin, familyName]);

  // Save immediately when any data changes
  useEffect(()=>{
    if (!uid) return;
    const timer = setTimeout(()=>{ doSync(); }, 500); // small delay to batch rapid changes
    return ()=>clearTimeout(timer);
  },[uid, kids, completions, earnings, pool, poolClaims, rewards, redeemed, parentPin]);

  const handleAuth = (newUid, name) => {
    setUid(newUid);
    if (name) { setFamilyName(name); }
  };

  const handleLogout = async () => {
    // Save everything to cloud BEFORE logging out
    if (uid) {
      await syncToCloud(uid,{ kids, completions, earnings, pool, poolClaims, rewards, redeemed, parentPin, familyName });
    }
    await logoutFamily();
    setUid(null); setScreen("welcome"); setActiveKid(null); setPendingKid(null); setView("today");
    setKids(DEFAULT_KIDS); setCompletions({}); setEarnings({}); setPool(DEFAULT_POOL);
    setPoolClaims({}); setRewards(DEFAULT_REWARDS); setRedeemed({}); setParentPin("0000"); setFamilyName("");
  };

  // ── Loading screen
  if (!authReady) return (
    <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f5f3ff",fontFamily:font }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{ fontSize:52,marginBottom:16 }}>🧹</div>
      <div style={{ fontSize:18,fontWeight:800,color:"#7c3aed" }}>Loading ChoreFlow...</div>
    </div>
  );

  // ── Not logged in → show auth screen
  if (!uid) return <AuthScreen onAuth={handleAuth}/>;

  // ── Syncing indicator
  if (syncing) return (
    <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f5f3ff",fontFamily:font }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{ fontSize:52,marginBottom:16 }}>☁️</div>
      <div style={{ fontSize:18,fontWeight:800,color:"#7c3aed" }}>Syncing your family data...</div>
    </div>
  );

  const isParent = screen==="parent_app";
  const kid = isParent ? kids[editTab] : activeKid ? kids.find(k=>k.id===activeKid.id)||kids[0] : kids[0];

  if (screen==="wallboard") return <WallBoard kids={kids} completions={completions} earnings={earnings} onBack={()=>setScreen("welcome")}/>;
  if (screen==="welcome")   return <Welcome kids={kids} familyName={familyName} onKid={k=>{setPendingKid(k);setScreen("kid_pin");}} onParent={()=>setScreen("parent_pin")} onWallboard={()=>setScreen("wallboard")}/>;
  if (screen==="kid_pin")   return <PinPad title={`Hi ${pendingKid?.name}! 👋`} subtitle="Enter your PIN" color={pendingKid?.color} light={pendingKid?.light} pinCheck={p=>p===pendingKid?.pin} onSuccess={()=>{setActiveKid(pendingKid);setScreen("kid_app");setView("today");}} onBack={()=>{setScreen("welcome");setPendingKid(null);}}/>;
  if (screen==="parent_pin")return <PinPad title="Parent Login" subtitle="Enter your admin PIN" color="#7c3aed" light="#ede9fe" pinCheck={p=>p===parentPin} onSuccess={()=>{setScreen("parent_app");setView("edit");}} onBack={()=>setScreen("welcome")}/>;

  const TK=todayKey(),WK=weekKey(),MK=monthKey();
  const getDone=(kidId,choreId)=>completions[kidId]?.[TK]?.[choreId]||false;
  const addEarn=(kidId,delta)=>setEarnings(p=>({...p,[kidId]:{total:Math.max(0,(p[kidId]?.total||0)+delta),week:{...(p[kidId]?.week||{}),[WK]:Math.max(0,(p[kidId]?.week?.[WK]||0)+delta)},month:{...(p[kidId]?.month||{}),[MK]:Math.max(0,(p[kidId]?.month?.[MK]||0)+delta)},paid:p[kidId]?.paid||0,points:p[kidId]?.points||0}}));

  const toggleChore=chore=>{ const was=getDone(kid.id,chore.id); setCompletions(p=>({...p,[kid.id]:{...p[kid.id],[TK]:{...(p[kid.id]?.[TK]||{}),[chore.id]:!was}}})); if(chore.pay>0) addEarn(kid.id,was?-chore.pay:chore.pay); };
  const claimPool=pc=>setPoolClaims(p=>({...p,[pc.id]:{kidId:kid.id,done:false}}));
  const completePool=pc=>{ const was=poolClaims[pc.id]?.done; setPoolClaims(p=>({...p,[pc.id]:{...p[pc.id],done:!was}})); addEarn(kid.id,was?-pc.pay:pc.pay); };
  const resetPool=id=>setPoolClaims(p=>{const n={...p};delete n[id];return n;});
  const redeemReward=reward=>{ const pts=earnings[kid.id]?.points||0; if(pts<reward.points)return; setEarnings(p=>({...p,[kid.id]:{...p[kid.id],points:(p[kid.id]?.points||0)-reward.points}})); setRedeemed(p=>({...p,[kid.id]:{...p[kid.id],[reward.id]:(p[kid.id]?.[reward.id]||0)+1}})); };

  const kEarn=earnings[kid.id]||{};
  const owed=kEarn.total||0,paid=kEarn.paid||0,wEarn=kEarn.week?.[WK]||0,mEarn=kEarn.month?.[MK]||0,pts=kEarn.points||0;
  const myPool=pool.filter(p=>poolClaims[p.id]?.kidId===kid.id);
  const todayDone=kid.chores.filter(c=>getDone(kid.id,c.id)).length+myPool.filter(p=>poolClaims[p.id]?.done).length;
  const todayTotal=kid.chores.length+myPool.filter(p=>!poolClaims[p.id]?.done).length;
  const pct=todayTotal>0?Math.round((todayDone/todayTotal)*100):0;
  let streak=0; for(const d of Object.keys(completions[kid.id]||{}).sort().reverse()){ if(kid.chores.filter(c=>completions[kid.id]?.[d]?.[c.id]).length===kid.chores.length)streak++; else break; }
  const streakPts=streak*5;
  const weekDays=Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-d.getDay()+1+i); const key=d.toISOString().slice(0,10); return {key,label:new Date(key+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}),done:kid.chores.filter(c=>completions[kid.id]?.[key]?.[c.id]).length,total:kid.chores.length}; });

  const markPaid=(kidId,amt)=>{ setEarnings(p=>({...p,[kidId]:{...p[kidId],total:0,paid:(p[kidId]?.paid||0)+amt}})); setShowPay(null); };
  const addKid=()=>{ if(!newKid.name.trim()||newKid.pin.length!==4)return; setKids(p=>[...p,{id:Date.now(),...newKid,chores:[{id:1,name:"Make bed",tier:1,pay:0,timeSlot:"morning"},{id:2,name:"Clean room",tier:1,pay:0,timeSlot:"anytime"}]}]); setNewKid({name:"",pin:"",emoji:"🧒",...KID_PRESETS[0],largeIcons:false}); setShowAddKid(false); setEditTab(kids.length); };
  const removeKid=idx=>{ const id=kids[idx].id; setKids(p=>p.filter((_,i)=>i!==idx)); setCompletions(p=>{const n={...p};delete n[id];return n;}); setEarnings(p=>{const n={...p};delete n[id];return n;}); setEditTab(0); setShowRmKid(false); };
  const updKid=(idx,f,v)=>setKids(p=>p.map((k,i)=>i===idx?{...k,[f]:v}:k));
  const addChore=idx=>{ if(!newChore.name.trim())return; setKids(p=>p.map((k,i)=>i===idx?{...k,chores:[...k.chores,{id:Date.now(),...newChore,pay:parseFloat(newChore.pay)||0}]}:k)); setNewChore({name:"",tier:1,pay:0,timeSlot:"morning"}); };
  const rmChore=(idx,cid)=>setKids(p=>p.map((k,i)=>i===idx?{...k,chores:k.chores.filter(c=>c.id!==cid)}:k));
  const updChorePay=(idx,cid,v)=>setKids(p=>p.map((k,i)=>i===idx?{...k,chores:k.chores.map(c=>c.id===cid?{...c,pay:parseFloat(v)||0}:c)}:k));
  const updChoreSlot=(idx,cid,v)=>setKids(p=>p.map((k,i)=>i===idx?{...k,chores:k.chores.map(c=>c.id===cid?{...c,timeSlot:v}:c)}:k));
  const addPoolChore=()=>{ if(!newPool.name.trim())return; setPool(p=>[...p,{id:"p"+Date.now(),name:newPool.name,pay:parseFloat(newPool.pay)||10}]); setNewPool({name:"",pay:10}); };
  const rmPool=id=>{ setPool(p=>p.filter(c=>c.id!==id)); setPoolClaims(p=>{const n={...p};delete n[id];return n;}); };
  const updPoolPay=(id,v)=>setPool(p=>p.map(c=>c.id===id?{...c,pay:parseFloat(v)||0}:c));
  const addReward=()=>{ if(!newReward.name.trim())return; setRewards(p=>[...p,{id:"r"+Date.now(),...newReward,points:parseInt(newReward.points)||50}]); setNewReward({name:"",icon:"🎮",points:50}); };
  const rmReward=id=>setRewards(p=>p.filter(r=>r.id!==id));

  const tabS=active=>({ flex:1,padding:"10px 0",background:active?kid.color:"transparent",color:active?"#fff":textSec,fontWeight:800,fontSize:11,cursor:"pointer",border:"none",fontFamily:font,transition:"all .2s",borderRadius:0 });
  const tabs=isParent?["today","progress","pool","rewards","edit"]:["today","progress","pool","rewards"];

  const Modal=({children})=>(
    <div style={{ position:"fixed",inset:0,background:"#00000055",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20 }}>
      <div style={{ background:white,borderRadius:24,padding:26,maxWidth:380,width:"100%",maxHeight:"90vh",overflowY:"auto" }}>{children}</div>
    </div>
  );

  const ChoreRow=({chore,done,onTap})=>{ const t=TIER[chore.tier]||TIER[1]; return (
    <div onClick={onTap} style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:done?`${t.light}88`:"#f9fafb",borderRadius:14,marginBottom:6,border:`1.5px solid ${done?t.color+"66":border}`,cursor:"pointer" }}>
      <div style={{ width:26,height:26,borderRadius:8,border:`2.5px solid ${done?t.color:"#d1d5db"}`,background:done?t.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s" }}>
        {done&&<span style={{ color:"#fff",fontSize:13,fontWeight:900 }}>✓</span>}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:800,fontSize:14,color:done?"#9ca3af":textPri,textDecoration:done?"line-through":"none" }}>{chore.name}</div>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:3 }}>
          <span style={{ ...S.pill(t.light,t.color),fontSize:10 }}>{t.icon} {t.label}</span>
          {chore.pay>0&&<span style={{ fontSize:11,color:t.color,fontWeight:700 }}>+${chore.pay.toFixed(2)}</span>}
        </div>
      </div>
      {done&&<span style={{ fontSize:16 }}>✅</span>}
    </div>
  );};

  const LargeChoreRow=({chore,done,onTap})=>{ const t=TIER[chore.tier]||TIER[1],slot=TIME_SLOTS.find(s=>s.id===(chore.timeSlot||"anytime"))||TIME_SLOTS[1]; return (
    <div onClick={onTap} style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"18px 14px",background:done?`${t.light}cc`:"#f9fafb",borderRadius:20,border:`2.5px solid ${done?t.color+"88":border}`,cursor:"pointer",textAlign:"center" }}>
      <div style={{ width:64,height:64,borderRadius:20,background:done?t.color:t.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:10 }}>{done?"✅":slot.icon}</div>
      <div style={{ fontWeight:900,fontSize:15,color:done?"#9ca3af":textPri,textDecoration:done?"line-through":"none",marginBottom:4 }}>{chore.name}</div>
      {chore.pay>0&&<div style={{ fontSize:12,color:t.color,fontWeight:800 }}>+${chore.pay.toFixed(2)}</div>}
      {done&&<div style={{ fontSize:11,color:t.color,fontWeight:700,marginTop:4 }}>Done! 🎉</div>}
      <span style={{ ...S.pill(t.light,t.color),fontSize:10,marginTop:6 }}>{t.icon} {t.label}</span>
    </div>
  );};

  return (
    <div style={{ background:bg,minHeight:"100vh",fontFamily:font,color:textPri,paddingBottom:90 }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={{ background:white,borderBottom:`1px solid ${border}`,padding:"16px 18px 12px",position:"sticky",top:0,zIndex:50 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isParent&&view!=="edit"?10:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            {!isParent&&<div style={{ width:38,height:38,borderRadius:12,background:kid.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{kid.emoji}</div>}
            <div>
              <div style={{ fontSize:18,fontWeight:900,color:isParent?"#7c3aed":kid.color }}>{isParent?"👩‍💼 Parent View":kid.name}</div>
              {!isParent&&<div style={{ fontSize:11,color:textSec }}>Today's chores</div>}
            </div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            {saveStatus==='saving'&&<div style={{ fontSize:11,color:"#9ca3af",fontWeight:700 }}>☁️ Saving...</div>}
            {saveStatus==='saved'&&<div style={{ fontSize:11,color:"#059669",fontWeight:700 }}>✅ Saved!</div>}
            <button onClick={doSync} style={{ background:"#7c3aed",border:"none",borderRadius:10,color:"#fff",fontSize:12,padding:"6px 12px",cursor:"pointer",fontFamily:font,fontWeight:800 }}>💾 Save</button>
            {isParent&&<button onClick={()=>setScreen("wallboard")} style={{ background:"#1e1b4b",border:"none",borderRadius:10,color:"#a5b4fc",fontSize:12,padding:"6px 10px",cursor:"pointer",fontFamily:font,fontWeight:800 }}>📺</button>}
            {isParent&&<button onClick={()=>setScreen("welcome")} style={{ background:"#f3f4f6",border:"none",borderRadius:10,color:textSec,fontSize:12,padding:"6px 10px",cursor:"pointer",fontFamily:font,fontWeight:800 }}>🏠</button>}
            {!isParent&&<button onClick={()=>setScreen("welcome")} style={{ background:"#f3f4f6",border:"none",borderRadius:10,color:textSec,fontSize:11,padding:"5px 10px",cursor:"pointer",fontFamily:font,fontWeight:700 }}>Switch</button>}
            <button onClick={handleLogout} style={{ background:"#f3f4f6",border:"none",borderRadius:10,color:textSec,fontSize:11,padding:"5px 10px",cursor:"pointer",fontFamily:font,fontWeight:700 }}>🚪 Out</button>
          </div>
        </div>
        {isParent&&view!=="edit"&&(
          <div style={{ display:"flex",gap:8,overflowX:"auto",paddingBottom:2 }}>
            {kids.map((k,i)=><button key={k.id} style={S.kidTab(editTab===i,k)} onClick={()=>setEditTab(i)}>{k.emoji} {k.name}</button>)}
          </div>
        )}
      </div>

      {/* NAV */}
      <div style={{ display:"flex",background:white,margin:"0 14px",borderRadius:"0 0 18px 18px",overflow:"hidden",border:`1px solid ${border}`,borderTop:"none" }}>
        {tabs.map(v=><button key={v} style={tabS(view===v)} onClick={()=>setView(v)}>{v==="today"?"📋 Today":v==="progress"?"📊":v==="pool"?"🏆 Pool":v==="rewards"?"🎁 Rewards":"⚙️ Edit"}</button>)}
      </div>

      {/* TODAY */}
      {view==="today"&&<>
        <div style={{ background:`linear-gradient(135deg,${kid.color},${kid.mid})`,margin:"12px 14px 0",borderRadius:22,padding:"20px 20px 18px",color:"#fff",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.1)" }}/>
          <div style={{ fontSize:13,fontWeight:800,opacity:.85,marginBottom:4 }}>{kid.emoji} {kid.name}'s Day</div>
          <div style={{ fontSize:42,fontWeight:900,lineHeight:1,marginBottom:8 }}>{pct}<span style={{ fontSize:22 }}>%</span></div>
          <div style={{ height:8,borderRadius:8,background:"rgba(255,255,255,0.3)",marginBottom:8 }}>
            <div style={{ height:"100%",width:`${pct}%`,background:"#fff",borderRadius:8,transition:"width .6s" }}/>
          </div>
          <div style={{ fontSize:12,opacity:.85 }}>{todayDone} of {todayTotal} tasks complete{pct===100?" — Amazing work! 🎉":""}</div>
        </div>

        <div style={{ display:"flex",gap:10,margin:"10px 14px 0" }}>
          <div style={S.statC("#fef3c7","#d97706")}><div style={{ fontSize:18,fontWeight:900,color:"#d97706" }}>${owed.toFixed(2)}</div><div style={{ fontSize:11,color:textSec }}>Owed</div></div>
          <div style={S.statC("#d1fae5","#059669")}><div style={{ fontSize:18,fontWeight:900,color:"#059669" }}>{streakPts}<span style={{ fontSize:12 }}> pts</span></div><div style={{ fontSize:11,color:textSec }}>{streak} day🔥</div></div>
          <div style={S.statC("#ede9fe","#7c3aed")}><div style={{ fontSize:18,fontWeight:900,color:"#7c3aed" }}>{pts}</div><div style={{ fontSize:11,color:textSec }}>Reward pts</div></div>
        </div>

        {TIME_SLOTS.map(slot=>{
          const sc=kid.chores.filter(c=>(c.timeSlot||"anytime")===slot.id);
          if(!sc.length) return null;
          const slotDone=sc.filter(c=>getDone(kid.id,c.id)).length;
          return (
            <div key={slot.id} style={S.card()}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:32,height:32,borderRadius:10,background:slot.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{slot.icon}</div>
                  <span style={{ fontWeight:900,fontSize:15,color:slot.color }}>{slot.label}</span>
                </div>
                <span style={{ fontSize:12,fontWeight:800,color:slotDone===sc.length?"#059669":textSec }}>{slotDone}/{sc.length}</span>
              </div>
              {kid.largeIcons ? (
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10 }}>
                  {sc.map(c=><LargeChoreRow key={c.id} chore={c} done={getDone(kid.id,c.id)} onTap={()=>toggleChore(c)}/>)}
                </div>
              ) : sc.map(c=><ChoreRow key={c.id} chore={c} done={getDone(kid.id,c.id)} onTap={()=>toggleChore(c)}/>)}
            </div>
          );
        })}

        {myPool.length>0&&(
          <div style={S.card()}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
              <div style={{ width:32,height:32,borderRadius:10,background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🏆</div>
              <span style={{ fontWeight:900,fontSize:15,color:"#dc2626" }}>My Big Ticket Chores</span>
            </div>
            {myPool.map(chore=>{ const done=poolClaims[chore.id]?.done; return (
              <div key={chore.id} onClick={()=>!done&&completePool(chore)} style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:done?"#f9fafb":"#fff5f5",borderRadius:14,marginBottom:6,border:`1.5px solid ${done?"#e5e7eb":"#fca5a5"}`,cursor:done?"default":"pointer",opacity:done?.65:1 }}>
                <div style={{ width:26,height:26,borderRadius:8,border:`2.5px solid ${done?"#dc2626":"#d1d5db"}`,background:done?"#dc2626":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  {done&&<span style={{ color:"#fff",fontSize:13,fontWeight:900 }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800,fontSize:14,color:done?"#9ca3af":textPri,textDecoration:done?"line-through":"none" }}>{chore.name}</div>
                  <div style={{ fontSize:12,color:done?textSec:"#dc2626",fontWeight:700 }}>{done?"✅ Done — parent clears":"🏆 +$"+chore.pay.toFixed(2)}</div>
                </div>
              </div>
            );})}
          </div>
        )}

        {/* Completed log */}
        {(()=>{ const allDone=kid.chores.filter(c=>getDone(kid.id,c.id)),poolDone=myPool.filter(p=>poolClaims[p.id]?.done); if(!allDone.length&&!poolDone.length) return null; return (
          <div style={S.card()}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
              <div style={{ width:32,height:32,borderRadius:10,background:"#d1fae5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>✅</div>
              <div><div style={{ fontWeight:900,fontSize:15,color:"#059669" }}>Completed Today</div><div style={{ fontSize:12,color:textSec }}>{allDone.length+poolDone.length} task{allDone.length+poolDone.length!==1?"s":""} finished</div></div>
            </div>
            {allDone.map(chore=>{ const t=TIER[chore.tier]||TIER[1],slot=TIME_SLOTS.find(s=>s.id===(chore.timeSlot||"anytime"))||TIME_SLOTS[1]; return (
              <div key={chore.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f0fdf4",borderRadius:12,marginBottom:6,border:"1.5px solid #6ee7b788" }}>
                <div style={{ width:22,height:22,borderRadius:6,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span></div>
                <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:13 }}>{chore.name}</div><div style={{ display:"flex",gap:6,marginTop:2 }}><span style={{ ...S.pill(t.light,t.color),fontSize:10 }}>{t.icon} {t.label}</span><span style={{ ...S.pill(slot.light,slot.color),fontSize:10 }}>{slot.icon} {slot.label}</span></div></div>
                {chore.pay>0&&<span style={{ fontWeight:800,fontSize:12,color:"#059669" }}>+${chore.pay.toFixed(2)}</span>}
              </div>
            );})}
            {poolDone.map(chore=>(
              <div key={chore.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f0fdf4",borderRadius:12,marginBottom:6,border:"1.5px solid #6ee7b788" }}>
                <div style={{ width:22,height:22,borderRadius:6,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span></div>
                <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:13 }}>{chore.name}</div><span style={{ ...S.pill("#fee2e2","#dc2626"),fontSize:10 }}>🏆 Big Ticket</span></div>
                <span style={{ fontWeight:800,fontSize:12,color:"#059669" }}>+${chore.pay.toFixed(2)}</span>
              </div>
            ))}
          </div>
        );})()}

        {isParent&&owed>0&&<div style={{ margin:"12px 14px 0" }}><button style={{ ...S.btn("#d97706"),width:"100%",padding:16,fontSize:15,borderRadius:16 }} onClick={()=>setShowPay(kid)}>💸 Pay {kid.name} ${owed.toFixed(2)}</button></div>}
      </>}

      {/* POOL */}
      {view==="pool"&&<>
        <div style={S.card()}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:12,background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>🏆</div>
            <div><div style={{ fontWeight:900,fontSize:16,color:"#dc2626" }}>Big Ticket Pool</div><div style={{ fontSize:12,color:textSec }}>{isParent?"Manage bonus chores":"Grab a bonus chore to earn extra!"}</div></div>
          </div>
        </div>
        <div style={S.card()}>
          <div style={{ fontWeight:800,fontSize:12,color:textSec,marginBottom:10,textTransform:"uppercase",letterSpacing:.5 }}>Available</div>
          {pool.filter(p=>!poolClaims[p.id]).map(chore=>(
            <div key={chore.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"#fff5f5",borderRadius:14,marginBottom:8,border:"1.5px solid #fca5a588" }}>
              <div style={{ width:36,height:36,borderRadius:10,background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>🏆</div>
              <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:14 }}>{chore.name}</div><div style={{ fontSize:12,color:"#dc2626",fontWeight:700 }}>Earns ${chore.pay.toFixed(2)}</div></div>
              {!isParent&&<button onClick={()=>claimPool(chore)} style={{ ...S.btn("#dc2626"),padding:"8px 14px",fontSize:12 }}>Grab it!</button>}
              {isParent&&<div style={{ display:"flex",alignItems:"center",gap:6 }}><span style={{ color:textSec,fontSize:12 }}>$</span><input style={{ ...S.inp,width:55,padding:"6px 8px" }} type="number" value={chore.pay} onChange={e=>updPoolPay(chore.id,e.target.value)}/><button onClick={()=>rmPool(chore.id)} style={{ ...S.btn("#fee2e2","#dc2626"),padding:"6px 10px" }}>✕</button></div>}
            </div>
          ))}
          {pool.filter(p=>!poolClaims[p.id]).length===0&&<div style={{ textAlign:"center",padding:"16px 0",color:textSec }}>No chores available right now!</div>}
          {isParent&&<div style={{ borderTop:`1px solid ${border}`,paddingTop:14,marginTop:6 }}>
            <div style={{ fontWeight:800,fontSize:13,color:"#dc2626",marginBottom:8 }}>+ Add to Pool</div>
            <input style={{ ...S.inp,marginBottom:8 }} placeholder="Chore name" value={newPool.name} onChange={e=>setNewPool(p=>({...p,name:e.target.value}))}/>
            <div style={{ display:"flex",gap:8 }}><input style={{ ...S.inp,flex:1 }} type="number" placeholder="Pay $" value={newPool.pay} onChange={e=>setNewPool(p=>({...p,pay:e.target.value}))}/><button style={S.btn("#dc2626")} onClick={addPoolChore}>Add</button></div>
          </div>}
        </div>
        {(()=>{ const inProg=pool.filter(p=>poolClaims[p.id]&&!poolClaims[p.id].done),done=pool.filter(p=>poolClaims[p.id]?.done),mine=inProg.filter(p=>poolClaims[p.id]?.kidId===kid.id); return <>
          {mine.length>0&&<div style={S.card()}><div style={{ fontWeight:800,fontSize:12,color:"#d97706",marginBottom:10,textTransform:"uppercase",letterSpacing:.5 }}>You're Working On</div>
            {mine.map(chore=>(<div key={chore.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"#fef3c7",borderRadius:14,marginBottom:6,border:"1.5px solid #fcd34d" }}><div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:14 }}>{chore.name}</div><div style={{ fontSize:12,color:"#d97706",fontWeight:700 }}>+${chore.pay.toFixed(2)} when done</div></div><button onClick={()=>completePool(chore)} style={{ ...S.btn("#059669"),padding:"8px 14px",fontSize:12 }}>Done ✓</button></div>))}
          </div>}
          {isParent&&done.length>0&&<div style={S.card()}><div style={{ fontWeight:800,fontSize:12,color:"#059669",marginBottom:4,textTransform:"uppercase",letterSpacing:.5 }}>Completed — Needs Reset</div><div style={{ fontSize:12,color:textSec,marginBottom:10 }}>Reset to put back in the pool.</div>
            {done.map(chore=>{ const claimer=kids.find(k=>k.id===poolClaims[chore.id]?.kidId); return (<div key={chore.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#d1fae5",borderRadius:14,marginBottom:6,border:"1.5px solid #6ee7b7" }}><div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:14 }}>{chore.name}</div><div style={{ fontSize:12,color:"#059669",fontWeight:700 }}>✓ Done by {claimer?.emoji} {claimer?.name}</div></div><button onClick={()=>resetPool(chore.id)} style={{ ...S.btn("#059669"),padding:"7px 14px",fontSize:12 }}>Reset</button></div>); })}
          </div>}
        </>; })()}
      </>}

      {/* REWARDS */}
      {view==="rewards"&&<>
        <div style={{ ...S.card(),background:"linear-gradient(135deg,#fef3c7,#fffbeb)",border:"1.5px solid #fcd34d" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
            <div style={{ width:44,height:44,borderRadius:14,background:"#fef3c7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>🎁</div>
            <div><div style={{ fontWeight:900,fontSize:16,color:"#92400e" }}>Rewards Catalog</div><div style={{ fontSize:12,color:textSec }}>Spend your points on something fun!</div></div>
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <div style={S.statC("#fffbeb","#d97706")}><div style={{ fontSize:24,fontWeight:900,color:"#d97706" }}>{pts}</div><div style={{ fontSize:12,color:textSec,fontWeight:700 }}>Your Points</div></div>
            <div style={S.statC("#fffbeb","#d97706")}><div style={{ fontSize:24,fontWeight:900,color:"#059669" }}>{streakPts}</div><div style={{ fontSize:12,color:textSec,fontWeight:700 }}>Streak Pts</div></div>
          </div>
        </div>
        <div style={S.card()}>
          {rewards.map(reward=>{ const canAfford=pts>=reward.points,timesRedeemed=redeemed[kid.id]?.[reward.id]||0; return (
            <div key={reward.id} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px",background:canAfford?"#fffbeb":"#f9fafb",borderRadius:16,marginBottom:10,border:`1.5px solid ${canAfford?"#fcd34d":border}` }}>
              <div style={{ width:52,height:52,borderRadius:16,background:canAfford?"#fef3c7":"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0 }}>{reward.icon}</div>
              <div style={{ flex:1 }}><div style={{ fontWeight:900,fontSize:15,color:canAfford?textPri:"#9ca3af" }}>{reward.name}</div><div style={{ display:"flex",alignItems:"center",gap:6,marginTop:2 }}><span style={{ fontSize:12,fontWeight:800,color:canAfford?"#d97706":"#9ca3af" }}>⭐ {reward.points} pts</span>{timesRedeemed>0&&<span style={{ fontSize:11,color:"#059669",fontWeight:700 }}>• Redeemed {timesRedeemed}x</span>}</div></div>
              {!isParent&&<button onClick={()=>redeemReward(reward)} disabled={!canAfford} style={{ ...S.btn(canAfford?"#d97706":"#e5e7eb",canAfford?"#fff":"#9ca3af"),padding:"8px 14px",fontSize:12,opacity:canAfford?1:.7,cursor:canAfford?"pointer":"not-allowed" }}>Redeem</button>}
              {isParent&&<button onClick={()=>rmReward(reward.id)} style={{ ...S.btn("#fee2e2","#dc2626"),padding:"6px 10px",fontSize:12 }}>✕</button>}
            </div>
          );})}
        </div>
        {isParent&&<div style={S.card()}>
          <div style={{ fontWeight:800,fontSize:13,color:"#d97706",marginBottom:12 }}>+ Add Reward</div>
          <input style={{ ...S.inp,marginBottom:10 }} placeholder="Reward name" value={newReward.name} onChange={e=>setNewReward(p=>({...p,name:e.target.value}))}/>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:12 }}>
            {REWARD_ICONS.map(ic=><button key={ic} onClick={()=>setNewReward(p=>({...p,icon:ic}))} style={{ fontSize:22,background:newReward.icon===ic?"#fef3c7":"#f3f4f6",border:`2px solid ${newReward.icon===ic?"#d97706":"#e5e7eb"}`,borderRadius:10,padding:"5px 8px",cursor:"pointer" }}>{ic}</button>)}
          </div>
          <input style={{ ...S.inp,marginBottom:12 }} type="number" placeholder="Points cost" value={newReward.points} onChange={e=>setNewReward(p=>({...p,points:e.target.value}))}/>
          <button style={{ ...S.btn("#d97706"),width:"100%" }} onClick={addReward}>Add Reward</button>
        </div>}
      </>}

      {/* PROGRESS */}
      {view==="progress"&&<>
        <div style={{ ...S.card(),background:`linear-gradient(135deg,${kid.light},#fff)`,border:`1.5px solid ${kid.mid}` }}>
          <div style={{ fontWeight:900,fontSize:16,color:kid.color,marginBottom:16 }}>{kid.emoji} {kid.name}'s Week</div>
          <div style={{ display:"flex",gap:6,alignItems:"flex-end",height:80 }}>
            {weekDays.map(d=>{ const p=d.total>0?(d.done/d.total)*100:0,isT=d.key===TK; return (
              <div key={d.key} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                <div style={{ width:"100%",height:60,background:"#e5e7eb",borderRadius:8,overflow:"hidden",display:"flex",alignItems:"flex-end" }}>
                  <div style={{ width:"100%",height:`${p}%`,background:isT?kid.color:kid.mid,transition:"height .6s" }}/>
                </div>
                <div style={{ fontSize:10,color:isT?kid.color:textSec,fontWeight:isT?900:600 }}>{d.label}</div>
              </div>
            );})}
          </div>
        </div>
        <div style={S.card()}>
          <div style={{ fontWeight:900,fontSize:15,marginBottom:12 }}>💰 Earnings</div>
          <div style={{ display:"flex",gap:10,marginBottom:10 }}>
            <div style={S.statC("#fef3c7","#d97706")}><div style={{ fontSize:18,fontWeight:900,color:"#d97706" }}>${wEarn.toFixed(2)}</div><div style={{ fontSize:11,color:textSec }}>This Week</div></div>
            <div style={S.statC("#ede9fe","#7c3aed")}><div style={{ fontSize:18,fontWeight:900,color:"#7c3aed" }}>${mEarn.toFixed(2)}</div><div style={{ fontSize:11,color:textSec }}>This Month</div></div>
          </div>
          <div style={S.statC("#fee2e2","#dc2626")}><div style={{ fontSize:20,fontWeight:900,color:"#dc2626" }}>${owed.toFixed(2)}</div><div style={{ fontSize:11,color:textSec }}>Currently Owed</div></div>
        </div>
        <div style={S.card()}>
          <div style={{ fontWeight:900,fontSize:15,marginBottom:12 }}>⭐ Streak & Points</div>
          <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:10 }}>
            <div style={{ width:56,height:56,borderRadius:18,background:"#d1fae5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,color:"#059669" }}>{streak}🔥</div>
            <div><div style={{ fontWeight:800,fontSize:15 }}>{streak} Day Streak</div><div style={{ fontSize:12,color:textSec }}>{streakPts} streak pts · {pts} reward pts available</div></div>
          </div>
          <div style={{ height:10,borderRadius:8,background:"#e5e7eb",overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${Math.min((streakPts/50)*100,100)}%`,background:"#059669",borderRadius:8,transition:"width .6s" }}/>
          </div>
          <div style={{ fontSize:11,color:textSec,marginTop:4 }}>{streakPts}/50 pts to next bonus</div>
        </div>
        {isParent&&<>
          <div style={S.card()}>
            <div style={{ fontWeight:900,fontSize:15,marginBottom:14 }}>👨‍👩‍👧‍👦 All Kids Today</div>
            {kids.map(k=>{ const kDone=k.chores.filter(c=>completions[k.id]?.[TK]?.[c.id]).length,kPct=k.chores.length>0?Math.round((kDone/k.chores.length)*100):0,kOwed=earnings[k.id]?.total||0; return (
              <div key={k.id} style={{ marginBottom:14 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ width:32,height:32,borderRadius:10,background:k.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{k.emoji}</div>
                    <span style={{ fontWeight:800,color:k.color }}>{k.name}</span>
                  </div>
                  <span style={{ fontSize:12,color:textSec,fontWeight:700 }}>${kOwed.toFixed(2)} owed · {kPct}%</span>
                </div>
                <div style={{ height:8,borderRadius:8,background:"#e5e7eb",overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${kPct}%`,background:k.color,borderRadius:8,transition:"width .6s" }}/>
                </div>
              </div>
            );})}
          </div>
          <div style={S.card()}>
            <div style={{ fontWeight:900,fontSize:15,marginBottom:12 }}>✅ {kids[editTab]?.name}'s Completed Today</div>
            {(()=>{ const vk=kids[editTab],allDone=vk.chores.filter(c=>getDone(vk.id,c.id)),poolDoneItems=pool.filter(p=>poolClaims[p.id]?.kidId===vk.id&&poolClaims[p.id]?.done);
              if(!allDone.length&&!poolDoneItems.length) return <div style={{ textAlign:"center",padding:"16px 0",color:textSec,fontSize:14 }}>No chores completed yet today.</div>;
              return [...allDone.map(chore=>{ const t=TIER[chore.tier]||TIER[1],slot=TIME_SLOTS.find(s=>s.id===(chore.timeSlot||"anytime"))||TIME_SLOTS[1]; return (
                <div key={chore.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f0fdf4",borderRadius:12,marginBottom:6,border:"1.5px solid #6ee7b788" }}>
                  <div style={{ width:22,height:22,borderRadius:6,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span></div>
                  <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:13 }}>{chore.name}</div><div style={{ display:"flex",gap:6,marginTop:2 }}><span style={{ ...S.pill(t.light,t.color),fontSize:10 }}>{t.icon} {t.label}</span><span style={{ ...S.pill(slot.light,slot.color),fontSize:10 }}>{slot.icon} {slot.label}</span></div></div>
                  {chore.pay>0&&<span style={{ fontWeight:800,fontSize:12,color:"#059669" }}>+${chore.pay.toFixed(2)}</span>}
                </div>
              );}), ...poolDoneItems.map(chore=>(
                <div key={chore.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f0fdf4",borderRadius:12,marginBottom:6,border:"1.5px solid #6ee7b788" }}>
                  <div style={{ width:22,height:22,borderRadius:6,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span></div>
                  <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:13 }}>{chore.name}</div><span style={{ ...S.pill("#fee2e2","#dc2626"),fontSize:10 }}>🏆 Big Ticket</span></div>
                  <span style={{ fontWeight:800,fontSize:12,color:"#059669" }}>+${chore.pay.toFixed(2)}</span>
                </div>
              ))];
            })()}
          </div>
        </>}
      </>}

      {/* EDIT */}
      {view==="edit"&&isParent&&(()=>{ const ek=kids[editTab],ekOwed=earnings[ek.id]?.total||0; return <>
        <div style={S.card()}>
          <div style={{ fontWeight:800,fontSize:12,color:textSec,marginBottom:10,textTransform:"uppercase",letterSpacing:.5 }}>Select Kid</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {kids.map((k,i)=><button key={k.id} style={S.kidTab(editTab===i,k)} onClick={()=>setEditTab(i)}>{k.emoji} {k.name}</button>)}
            <button onClick={()=>setShowAddKid(true)} style={{ padding:"7px 14px",borderRadius:20,border:"2px dashed #7c3aed",background:"transparent",color:"#7c3aed",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:font }}>+ Add Kid</button>
          </div>
        </div>

        <div style={{ display:"flex",gap:8,margin:"10px 14px 0",overflowX:"auto" }}>
          {["profile","chores"].map(sec=>(
            <button key={sec} onClick={()=>setEditSection(sec)} style={{ padding:"8px 18px",borderRadius:20,border:`2px solid ${editSection===sec?ek.color:border}`,background:editSection===sec?ek.light:"transparent",color:editSection===sec?ek.color:textSec,fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:font }}>
              {sec==="profile"?"👤 Profile":"📋 Chores"}
            </button>
          ))}
        </div>

        {editSection==="profile"&&<div style={{ ...S.card(),borderLeft:`4px solid ${ek.color}` }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
            <div style={{ width:44,height:44,borderRadius:14,background:ek.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{ek.emoji}</div>
            <div style={{ fontWeight:900,fontSize:16,color:ek.color }}>{ek.name}'s Profile</div>
          </div>
          <div style={{ fontWeight:700,fontSize:13,color:textSec,marginBottom:6 }}>Display Name</div>
          <input style={{ ...S.inp,marginBottom:14 }} value={ek.name} onChange={e=>updKid(editTab,"name",e.target.value)}/>
          <div style={{ fontWeight:700,fontSize:13,color:textSec,marginBottom:6 }}>PIN Code</div>
          <input style={{ ...S.inp,marginBottom:6 }} value={ek.pin} maxLength={4} onChange={e=>updKid(editTab,"pin",e.target.value.slice(0,4).replace(/\D/g,""))}/>
          <div style={{ fontSize:11,color:textSec,marginBottom:16 }}>Current PIN: <strong>{ek.pin}</strong></div>
          <div style={{ fontWeight:700,fontSize:13,color:textSec,marginBottom:8 }}>Display Mode</div>
          <div style={{ display:"flex",gap:10,marginBottom:16 }}>
            <button onClick={()=>updKid(editTab,"largeIcons",false)} style={{ ...S.btn(!ek.largeIcons?ek.color:"#f3f4f6",!ek.largeIcons?"#fff":textSec),flex:1,padding:"10px" }}>📋 Normal</button>
            <button onClick={()=>updKid(editTab,"largeIcons",true)} style={{ ...S.btn(ek.largeIcons?ek.color:"#f3f4f6",ek.largeIcons?"#fff":textSec),flex:1,padding:"10px" }}>🔲 Large Icons</button>
          </div>
          {kids.length>1&&<button onClick={()=>setShowRmKid(true)} style={{ ...S.btn("#fee2e2","#dc2626"),fontSize:13 }}>🗑️ Remove {ek.name}</button>}
        </div>}

        {editSection==="chores"&&<div style={S.card()}>
          <div style={{ fontWeight:900,fontSize:15,marginBottom:14 }}>📋 {ek.name}'s Chores</div>
          {[1,2].map(tier=>{ const tc=ek.chores.filter(c=>c.tier===tier),t=TIER[tier]; return (
            <div key={tier} style={{ marginBottom:16 }}>
              <div style={{ marginBottom:8 }}><span style={S.pill(t.light,t.color)}>{t.icon} {t.label}</span></div>
              {tc.map(chore=>(
                <div key={chore.id} style={{ display:"flex",gap:8,alignItems:"center",marginBottom:6,padding:"10px 12px",background:"#f9fafb",borderRadius:12,border:`1px solid ${border}` }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700,fontSize:13,marginBottom:4 }}>{chore.name}</div>
                    <select style={{ ...S.sel,fontSize:12,padding:"4px 8px" }} value={chore.timeSlot||"anytime"} onChange={e=>updChoreSlot(editTab,chore.id,e.target.value)}>
                      {TIME_SLOTS.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                    </select>
                  </div>
                  {chore.tier>1&&<div style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ color:textSec,fontSize:12 }}>$</span><input style={{ ...S.inp,width:55,padding:"5px 8px" }} type="number" value={chore.pay} onChange={e=>updChorePay(editTab,chore.id,e.target.value)}/></div>}
                  <button onClick={()=>rmChore(editTab,chore.id)} style={{ ...S.btn("#fee2e2","#dc2626"),padding:"5px 10px" }}>✕</button>
                </div>
              ))}
            </div>
          );})}
          <div style={{ borderTop:`1px solid ${border}`,paddingTop:14 }}>
            <div style={{ fontWeight:800,fontSize:13,color:"#7c3aed",marginBottom:10 }}>+ Add Chore</div>
            <input style={{ ...S.inp,marginBottom:8 }} placeholder="Chore name" value={newChore.name} onChange={e=>setNewChore(p=>({...p,name:e.target.value}))}/>
            <div style={{ display:"flex",gap:8,marginBottom:8 }}>
              <select style={{ ...S.sel,flex:1 }} value={newChore.tier} onChange={e=>setNewChore(p=>({...p,tier:parseInt(e.target.value)}))}>
                <option value={1}>✅ Basic (No Pay)</option>
                <option value={2}>💰 Paid Chore</option>
              </select>
              <select style={{ ...S.sel,flex:1 }} value={newChore.timeSlot} onChange={e=>setNewChore(p=>({...p,timeSlot:e.target.value}))}>
                {TIME_SLOTS.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            {newChore.tier>1&&<input style={{ ...S.inp,marginBottom:8 }} type="number" placeholder="$ Pay" value={newChore.pay} onChange={e=>setNewChore(p=>({...p,pay:e.target.value}))}/>}
            <button style={{ ...S.btn("#7c3aed"),width:"100%" }} onClick={()=>addChore(editTab)}>Add Chore</button>
          </div>
        </div>}

        <div style={S.card()}>
          <div style={{ fontWeight:900,fontSize:15,marginBottom:10 }}>🔐 Parent PIN</div>
          <input style={{ ...S.inp,marginBottom:8 }} type="text" maxLength={4} placeholder="New 4-digit PIN" value={newParPin} onChange={e=>setNewParPin(e.target.value.slice(0,4).replace(/\D/g,""))}/>
          <button style={{ ...S.btn("#7c3aed"),width:"100%" }} onClick={()=>{ if(newParPin.length===4){setParentPin(newParPin);setNewParPin("");} }}>Save Parent PIN</button>
          <div style={{ fontSize:11,color:textSec,marginTop:8 }}>Current: <strong>{parentPin}</strong></div>
        </div>

        <div style={S.card()}>
          <div style={{ fontWeight:900,fontSize:15,marginBottom:10 }}>👨‍👩‍👧 Family Account</div>
          <div style={{ fontSize:13,color:textSec,marginBottom:12 }}>Signed in as your family account. All data syncs to the cloud automatically. ☁️</div>
          <button onClick={handleLogout} style={{ ...S.btn("#fee2e2","#dc2626"),width:"100%" }}>Sign Out of Family Account</button>
        </div>

        {ekOwed>0&&<div style={{ margin:"12px 14px 0" }}><button style={{ ...S.btn("#d97706"),width:"100%",padding:16,fontSize:15,borderRadius:16 }} onClick={()=>setShowPay(ek)}>💸 Pay {ek.name} ${ekOwed.toFixed(2)}</button></div>}
      </>;
      })()}

      {/* MODALS */}
      {showAddKid&&<Modal>
        <div style={{ fontSize:20,fontWeight:900,color:"#7c3aed",marginBottom:4 }}>➕ Add a Kid</div>
        <div style={{ fontSize:13,color:textSec,marginBottom:16 }}>Set up a new profile.</div>
        <div style={{ fontWeight:700,fontSize:13,marginBottom:6 }}>Name</div>
        <input style={{ ...S.inp,marginBottom:14 }} placeholder="Kid's name" value={newKid.name} onChange={e=>setNewKid(p=>({...p,name:e.target.value}))}/>
        <div style={{ fontWeight:700,fontSize:13,marginBottom:6 }}>PIN (4 digits)</div>
        <input style={{ ...S.inp,marginBottom:14 }} placeholder="e.g. 5678" maxLength={4} value={newKid.pin} onChange={e=>setNewKid(p=>({...p,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))}/>
        <div style={{ fontWeight:700,fontSize:13,marginBottom:8 }}>Emoji</div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
          {KID_EMOJIS.map(em=><button key={em} onClick={()=>setNewKid(p=>({...p,emoji:em}))} style={{ fontSize:22,background:newKid.emoji===em?"#ede9fe":"#f3f4f6",border:`2px solid ${newKid.emoji===em?"#7c3aed":"#e5e7eb"}`,borderRadius:10,padding:"5px 9px",cursor:"pointer" }}>{em}</button>)}
        </div>
        <div style={{ fontWeight:700,fontSize:13,marginBottom:8 }}>Color Theme</div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
          {KID_PRESETS.map(p=><button key={p.color} onClick={()=>setNewKid(prev=>({...prev,...p}))} style={{ width:32,height:32,borderRadius:"50%",background:p.color,border:`3px solid ${newKid.color===p.color?"#1f2937":"transparent"}`,cursor:"pointer" }}/>)}
        </div>
        <div style={{ fontWeight:700,fontSize:13,marginBottom:8 }}>Display Mode</div>
        <div style={{ display:"flex",gap:10,marginBottom:20 }}>
          <button onClick={()=>setNewKid(p=>({...p,largeIcons:false}))} style={{ ...S.btn(!newKid.largeIcons?"#7c3aed":"#f3f4f6",!newKid.largeIcons?"#fff":textSec),flex:1 }}>📋 Normal</button>
          <button onClick={()=>setNewKid(p=>({...p,largeIcons:true}))} style={{ ...S.btn(newKid.largeIcons?"#7c3aed":"#f3f4f6",newKid.largeIcons?"#fff":textSec),flex:1 }}>🔲 Large Icons</button>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button style={{ ...S.btn("#f3f4f6","#374151"),flex:1 }} onClick={()=>{ setShowAddKid(false); setNewKid({name:"",pin:"",emoji:"🧒",...KID_PRESETS[0],largeIcons:false}); }}>Cancel</button>
          <button style={{ ...S.btn("#7c3aed"),flex:1,opacity:newKid.name.trim()&&newKid.pin.length===4?1:.4 }} onClick={addKid}>Add Kid ✓</button>
        </div>
      </Modal>}

      {showRmKid&&<Modal>
        <div style={{ fontSize:20,fontWeight:900,color:"#dc2626",marginBottom:8 }}>🗑️ Remove {kids[editTab]?.name}?</div>
        <div style={{ color:textSec,marginBottom:20,fontSize:14,lineHeight:1.6 }}>This will permanently delete <strong>{kids[editTab]?.name}</strong>'s profile, chores, and earnings. Cannot be undone.</div>
        <div style={{ display:"flex",gap:10 }}>
          <button style={{ ...S.btn("#f3f4f6","#374151"),flex:1 }} onClick={()=>setShowRmKid(false)}>Keep {kids[editTab]?.name}</button>
          <button style={{ ...S.btn("#dc2626"),flex:1 }} onClick={()=>removeKid(editTab)}>Yes, Remove</button>
        </div>
      </Modal>}

      {showPay&&<Modal>
        <div style={{ fontSize:20,fontWeight:900,color:"#d97706",marginBottom:8 }}>💸 Pay {showPay.name}</div>
        <div style={{ color:textSec,marginBottom:20,fontSize:14 }}>Confirm paying <strong style={{ color:"#d97706" }}>${(earnings[showPay.id]?.total||0).toFixed(2)}</strong> to {showPay.name}.</div>
        <div style={{ display:"flex",gap:10 }}>
          <button style={{ ...S.btn("#f3f4f6","#374151"),flex:1 }} onClick={()=>setShowPay(null)}>Cancel</button>
          <button style={{ ...S.btn("#059669"),flex:1 }} onClick={()=>markPaid(showPay.id,earnings[showPay.id]?.total||0)}>Confirm ✓</button>
        </div>
      </Modal>}
    </div>
  );
}
