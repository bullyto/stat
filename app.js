const ORIGIN = "https://stats.aperos.net";
const API_STATS = `${ORIGIN}/api/stats`;
const API_HEALTH = `${ORIGIN}/api/health`;

const $ = (id) => document.getElementById(id);
function setText(id, v){ const el=$(id); if(el) el.textContent = (v ?? ""); }
function setHTML(id, v){ const el=$(id); if(el) el.innerHTML = (v ?? ""); }

function fmt(n){
  const x = Number(n);
  if(!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("fr-FR").format(x);
}
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function setStatus(msg){
  const el = $("status");
  if(!el) return;
  el.textContent = msg || "—";
}

async function fetchJson(url){
  const res = await fetch(url, { cache:"no-store" });
  const text = await res.text();
  if(!res.ok) throw new Error(`HTTP ${res.status} — ${(text||"").slice(0,160)}`);
  const t = text.trim();
  if(!(t.startsWith("{")||t.startsWith("["))) throw new Error("Réponse non JSON");
  return JSON.parse(text);
}

function normalizeStats(d){
  const byDevice = Array.isArray(d.byDevice) ? d.byDevice : [];
  const byBrowser = Array.isArray(d.byBrowser) ? d.byBrowser : [];
  const byCampaign = Array.isArray(d.byCampaign) ? d.byCampaign : [];
  const lastClicks = Array.isArray(d.last) ? d.last : [];

  const ev = (d && typeof d.events === "object" && d.events) ? d.events : {};
  const byEvent = Array.isArray(ev.byEvent) ? ev.byEvent : [];
  const lastEvents = Array.isArray(ev.last) ? ev.last : [];

  const totals = {
    totalEvents: Number(ev.total ?? d.totalEvents ?? d.total ?? NaN),
    todayEvents: Number(ev.todayTotal ?? ev.today ?? d.today ?? NaN),
  };

  return { byDevice, byBrowser, byCampaign, lastClicks, byEvent, lastEvents, totals };
}

function getEventCountMap(byEvent){
  const m = {};
  for(const r of (byEvent||[])){
    const k = String(r.k ?? r.event_key ?? r.key ?? "").trim();
    if(!k) continue;
    m[k] = Number(r.n ?? 0);
  }
  return m;
}
function getCampaignCountMap(byCampaign){
  const m = {};
  for(const r of (byCampaign||[])){
    const k = String(r.campaign ?? "").toLowerCase();
    if(!k) continue;
    m[k] = Number(r.n ?? 0);
  }
  return m;
}


function paletteForContainer(containerId){
  // Match your color rules
  if(String(containerId).startsWith("nuit")) return { c1:"rgba(26,167,255,.95)", c2:"rgba(0,120,255,.85)" }; // blue
  if(String(containerId).startsWith("cat"))  return { c1:"rgba(255,204,0,.95)", c2:"rgba(255,145,0,.85)" }; // yellow
  if(String(containerId).startsWith("game")) return { c1:"rgba(166,120,255,.92)", c2:"rgba(120,90,255,.82)" }; // violet
  // tech neutral
  return { c1:"rgba(231,255,255,.55)", c2:"rgba(231,255,255,.25)" };
}

function barRow(label, n, pct, palette){
  const pctTxt = Number.isFinite(pct) ? `${pct.toFixed(0)}%` : "—";
  const w = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const grad = `linear-gradient(90deg, ${palette.c1}, ${palette.c2})`;

  const trackStyle = [
    "margin-top:10px",
    "height:16px",
    "border-radius:999px",
    "border:1px solid rgba(255,255,255,.28)",
    "background:rgba(255,255,255,.12)",
    "overflow:hidden",
    "position:relative",
    "z-index:2",
    "box-shadow: inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.35)"
  ].join(";");

  const fillStyle = [
    "height:100%",
    `width:${w}%`,
    "border-radius:999px",
    `background:${grad}`,
    "position:relative",
    "z-index:3",
    "box-shadow: 0 0 0 1px rgba(255,255,255,.14), 0 0 22px rgba(90,255,235,.22)"
  ].join(";");

  return `
    <div class="barRow">
      <div class="barTop">
        <div class="left">${esc(label)}</div>
        <div class="right"><span>${fmt(n)}</span><span style="opacity:.8">•</span><span>${pctTxt}</span></div>
      </div>
      <div style="${trackStyle}">
        <div style="${fillStyle}"></div>
      </div>
    </div>
  `;
}
function renderCompare(containerId, items){
  const el = $(containerId);
  if(!el) return;
  const clean = (items||[]).map(x=>({label:x.label, n:Number(x.n||0)}));
  const total = clean.reduce((s,x)=>s+x.n,0) || 0;
  if(!total){
    el.innerHTML = `<div style="opacity:.6">—</div>`;
    return;
  }
  const pal = paletteForContainer(containerId);
  el.innerHTML = clean.map(x=>{
    const pct = total ? (x.n/total*100) : 0;
    return barRow(x.label, x.n, pct, pal);
  }).join("");
}

function renderBrandCompare(){
  // Prefer API-provided fields if present; else compute from known blocks (nuit + catalan totals)
  const el = $("cmpBrand");
  if(!el) return;

  // Try global state if present
  const nuitTotal = (state?.counts?.nuit_total ?? state?.counts?.apero_nuit_total ?? null);
  const catTotal  = (state?.counts?.catalan_total ?? state?.counts?.apero_catalan_total ?? null);

  // If API doesn't expose totals, compute from sections we already render
  const computedNuit = typeof state?.computed?.nuitTotal === "number" ? state.computed.nuitTotal : null;
  const computedCat  = typeof state?.computed?.catalanTotal === "number" ? state.computed.catalanTotal : null;

  const nNuit = Number(nuitTotal ?? computedNuit ?? 0);
  const nCat  = Number(catTotal  ?? computedCat  ?? 0);
  const total = (nNuit + nCat) || 0;

  if(!total){
    el.innerHTML = `<div style="opacity:.6">—</div>`;
    return;
  }

  const items = [
    { label:"Apéro de Nuit 66", n:nNuit, palette:{c1:"rgba(26,167,255,.95)", c2:"rgba(0,120,255,.85)"} },
    { label:"Apéro Catalan",   n:nCat,  palette:{c1:"rgba(255,204,0,.95)", c2:"rgba(255,145,0,.85)"} },
  ];

  el.innerHTML = items.map(x => barRow(x.label, x.n, (x.n/total*100), x.palette)).join("");
}


function parseDateAny(v){
  const s = String(v ?? "").trim();
  if(!s) return null;
  const d = new Date(s);
  if(!Number.isNaN(d.getTime())) return d;
  const n = Number(s);
  if(Number.isFinite(n)){
    const ms = n > 1e12 ? n : n*1000;
    const d2 = new Date(ms);
    if(!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}
function fmtDate(d){
  try{ return new Intl.DateTimeFormat("fr-FR",{dateStyle:"short", timeStyle:"medium"}).format(d); }
  catch{ return d.toISOString(); }
}
function normalizeClick(r){
  return { kind:"click", date: parseDateAny(r.created_at ?? r.ts ?? r.date), name:String(r.campaign ?? ""), src:String(r.source ?? r.src ?? ""), os:String(r.os ?? ""), browser:String(r.browser ?? "") };
}
function normalizeEvent(r){
  return { kind:"event", date: parseDateAny(r.ts ?? r.created_at ?? r.date), name:String(r.event_key ?? r.k ?? r.key ?? ""), src:String(r.src ?? r.source ?? ""), os:String(r.os ?? ""), browser:String(r.browser ?? "") };
}
function renderLast50(lastClicks, lastEvents){
  const tb = $("tbodyLast50");
  if(!tb) return;
  const clicks = (lastClicks||[]).map(normalizeClick).filter(x=>x.date);
  const events = (lastEvents||[]).map(normalizeEvent).filter(x=>x.date);
  const all = clicks.concat(events).sort((a,b)=>b.date-a.date).slice(0,50);
  if(!all.length){
    tb.innerHTML = `<tr><td colspan="6" style="opacity:.6">—</td></tr>`;
    return;
  }
  tb.innerHTML = all.map(x=>`
    <tr>
      <td>${esc(fmtDate(x.date))}</td>
      <td>${esc(x.kind)}</td>
      <td>${esc(x.name)}</td>
      <td class="hideSm">${esc(x.src || "")}</td>
      <td class="hideSm">${esc(x.os || "")}</td>
      <td class="hideSm">${esc(x.browser || "")}</td>
    </tr>
  `).join("");
}

function computeTodayFallback(s){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0).getTime();
  let count = 0;
  for(const r of (s.lastEvents||[])){
    const dt = parseDateAny(r.ts ?? r.created_at ?? r.date);
    if(dt && dt.getTime() >= start) count++;
  }
  return count || NaN;
}

function buildComparisons(s){
  const E = getEventCountMap(s.byEvent);
  const C = getCampaignCountMap(s.byCampaign);

  // APEROS.NET
  const nuitJeux = Number(C.jeux ?? 0);
  const nuitInstall = Number(E["apero_nuit.app.click"] ?? 0);
  const nuitCall = Number(E["apero_nuit.call"] ?? 0);

  const nuitAgeOk = Number(E["apero_nuit.age.accept"] ?? 0);
  const nuitAgeNo = Number(E["apero_nuit.age.refuse"] ?? 0);

  const nuitFb = Number(E["apero_nuit.facebook.click"] ?? 0);
  const nuitGmb = Number(E["apero_nuit.site.click"] ?? 0);

  // CATALAN
  const catInstall = Number(E["apero_catalan.app.click"] ?? 0);
  const catCall = Number(E["apero_catalan.call"] ?? 0);

  const catAgeOk = Number(E["apero_catalan.age.accept"] ?? 0);
  const catAgeNo = Number(E["apero_catalan.age.refuse"] ?? 0);

  // Catalan source split is /go links; without API bySource, we can't split reliably.
  // We display an informative message in UI (handled below).

  // Gamification
  const hibair = Number(C.jeux ?? 0);
  const wheel = Number(E["wheel.sms.click"] ?? 0);

  return {
    nuitIntent: [
      {label:"Jeux", n:nuitJeux},
      {label:"Install app", n:nuitInstall},
      {label:"Appel", n:nuitCall},
    ],
    nuitAge: [
      {label:"Âge accepté", n:nuitAgeOk},
      {label:"Âge refusé", n:nuitAgeNo},
    ],
    nuitSource: [
      {label:"Facebook", n:nuitFb},
      {label:"Google My Business", n:nuitGmb},
    ],
    catIntent: [
      {label:"Install app", n:catInstall},
      {label:"Appel", n:catCall},
    ],
    catAge: [
      {label:"Âge accepté", n:catAgeOk},
      {label:"Âge refusé", n:catAgeNo},
    ],
    gameCompare: [
      {label:"Hibair Drink", n:hibair},
      {label:"Roue de la fortune", n:wheel},
    ],
    techDevice: (s.byDevice||[]).map(r=>({label:String(r.device??"?"), n:Number(r.n??0)})).slice(0,10),
    techBrowser: (s.byBrowser||[]).map(r=>({label:String(r.browser??"?"), n:Number(r.n??0)})).slice(0,10),
  };
}

function registerSW(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

function openModal(){
  const back = $("modalBack");
  if(!back) return;
  // Force display even if style.css contains conflicting rules
  back.style.setProperty("display","flex","important");
  back.style.setProperty("visibility","visible","important");
  back.style.setProperty("opacity","1","important");
  back.setAttribute("aria-hidden","false");
}
function closeModal(){
  const back = $("modalBack");
  if(!back) return;
  back.style.setProperty("display","none","important");
  back.setAttribute("aria-hidden","true");
}

async function refresh(){
  if(inFlight) return;
  inFlight = true;

  setStatus("Chargement…");
  try{
    try{ await fetch(API_HEALTH, {cache:"no-store"}); }catch{}
    const raw = await fetchJson(API_STATS);
    if(raw && raw.ok === false) throw new Error(raw.error || "API ok=false");
    const s = normalizeStats(raw);

    const total = Number.isFinite(s.totals.totalEvents) ? s.totals.totalEvents : NaN;
    setText("totalEvents", Number.isFinite(total) ? fmt(total) : "—");

    const today = Number.isFinite(s.totals.todayEvents) ? s.totals.todayEvents : computeTodayFallback(s);
    setText("todayEvents", Number.isFinite(today) ? fmt(today) : "—");

    const cmp = buildComparisons(s);

    renderCompare("nuitIntent", cmp.nuitIntent);
    renderCompare("nuitAge", cmp.nuitAge);
    renderCompare("nuitSource", cmp.nuitSource);

    renderCompare("catIntent", cmp.catIntent);
    renderCompare("catAge", cmp.catAge);

    if(cmp.catSource){ renderCompare("catSource", cmp.catSource); } else { setHTML("catSource", `<div style="opacity:.6">—</div>`); }

    renderCompare("gameCompare", cmp.gameCompare);
    renderCompare("devBars", cmp.techDevice);
    renderCompare("browserBars", cmp.techBrowser);

    renderLast50(s.lastClicks, s.lastEvents);

    setStatus("OK ✅");
  }catch(e){
    console.error(e);
    setStatus(`Erreur: ${e.message}`);
    inFlight = false;
  }
}







function getTrackingTextLabeled(){
  return [
    "APEROS.NET — Apéro de Nuit 66",
    "• Bouton Jeux:",
    "  https://stats.aperos.net/go/jeux?src=direct",
    "• Bouton Install App:",
    "  https://stats.aperos.net/e/apero_nuit.app.click?to=https%3A%2F%2Faperos.net&src=app",
    "• Bouton Appel:",
    "  https://stats.aperos.net/e/apero_nuit.call?to=tel%3A0652336461&src=app",
    "",
    "APEROS.NET — Age Gate",
    "• Âge accepté:",
    "  https://stats.aperos.net/e/apero_nuit.age.accept?to=https%3A%2F%2Faperos.net&src=agegate",
    "• Âge refusé:",
    "  https://stats.aperos.net/e/apero_nuit.age.refuse?to=https%3A%2F%2Faperos.net&src=agegate",
    "",
    "APEROS.NET — Origine",
    "• Facebook:",
    "  https://stats.aperos.net/e/apero_nuit.facebook.click?to=https%3A%2F%2Faperos.net&src=facebook",
    "• Google My Business:",
    "  https://stats.aperos.net/e/apero_nuit.site.click?to=https%3A%2F%2Faperos.net&src=site",
    "",
    "CATALAN.APEROS.NET — Apéro Catalan",
    "• Bouton Appel:",
    "  https://stats.aperos.net/e/apero_catalan.call?to=tel%3A0652336461&src=app",
    "• Bouton Install App:",
    "  https://stats.aperos.net/e/apero_catalan.app.click?to=https%3A%2F%2Fcatalan.aperos.net&src=app",
    "",
    "CATALAN.APEROS.NET — Age Gate",
    "• Âge accepté:",
    "  https://stats.aperos.net/e/apero_catalan.age.accept?to=https%3A%2F%2Fcatalan.aperos.net&src=agegate",
    "• Âge refusé:",
    "  https://stats.aperos.net/e/apero_catalan.age.refuse?to=https%3A%2F%2Fcatalan.aperos.net&src=agegate",
    "",
    "CATALAN.APEROS.NET — Origine (via /go)",
    "• Google My Business (direct):",
    "  https://stats.aperos.net/go/catalan?src=direct",
    "• Facebook:",
    "  https://stats.aperos.net/go/catalan?src=facebook",
    "",
    "HIBAIR DRINK — Accès (via /go/jeux)",
    "• QR Code:",
    "  https://stats.aperos.net/go/jeux?src=qr",
    "• Facebook:",
    "  https://stats.aperos.net/go/jeux?src=facebook",
    "",
    "ROUE DE LA FORTUNE",
    "• SMS:",
    "  https://stats.aperos.net/e/wheel.sms.click?to=https%3A%2F%2Fchance.aperos.net&src=sms",
  ].join("\\n");
}

async function copyTrackings(){
  const text = getTrackingTextLabeled();
  try{
    await navigator.clipboard.writeText(text);
    setStatus("Trackings copiés ✅");
  }catch(e){
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try{
      document.execCommand("copy");
      setStatus("Trackings copiés ✅");
    }catch(_){
      setStatus("Copie impossible ❌");
    }
    document.body.removeChild(ta);
  }
}


// Live polling (auto refresh)
const LIVE_POLL_MS = 5000; // ADN66: toutes les 5 secondes
let liveTimer = null;
let liveInFlight = false;

async function liveTick(){
  if(liveInFlight) return;
  liveInFlight = true;
  try{
    await refresh();
  }catch(e){
    try{
      if(typeof setStatus === "function"){
        setStatus("Erreur: " + (e && e.message ? e.message : String(e)), false);
      }
    }catch(_){}
  }finally{
    liveInFlight = false;
  }
}

function startLivePolling(){
  stopLivePolling();
  liveTimer = setInterval(liveTick, LIVE_POLL_MS);
  // run immediately once
  liveTick();
}

function stopLivePolling(){
  if(liveTimer){
    clearInterval(liveTimer);
    liveTimer = null;
  }
}
}
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible"){
    refresh();
    startLivePolling();
  }else{
    stopLivePolling();
  }
});


document.addEventListener("DOMContentLoaded", () => {
  $("btnRefresh")?.addEventListener("click", refresh);
  $("btnInfos")?.addEventListener("click", openModal);
  $("btnCopyTrack")?.addEventListener("click", copyTrackings);
  $("btnCopyTrack")?.addEventListener("pointerdown", (e)=>{ e.preventDefault(); copyTrackings(); });
  $("btnCopyTrack")?.addEventListener("click", copyTrackings);
  $("btnCopyTrack")?.addEventListener("pointerdown", (e)=>{ e.preventDefault(); copyTrackings(); });
  $("btnInfos")?.addEventListener("pointerdown", (e)=>{ e.preventDefault(); openModal(); });
  $("btnClose")?.addEventListener("click", closeModal);
  $("modalBack")?.addEventListener("click", (e)=>{ if(e.target?.id==="modalBack") closeModal(); });
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

  registerSW();
  refresh();
});
