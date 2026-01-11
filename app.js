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

function barRow(label, n, pct){
  const pctTxt = Number.isFinite(pct) ? `${pct.toFixed(0)}%` : "—";
  const w = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return `
    <div class="barRow">
      <div class="barTop">
        <div class="left">${esc(label)}</div>
        <div class="right"><span>${fmt(n)}</span><span style="opacity:.85">•</span><span>${pctTxt}</span></div>
      </div>
      <div class="barTrack"><div class="barFill" style="width:${w}%"></div></div>
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
  el.innerHTML = clean.map(x=>{
    const pct = total ? (x.n/total*100) : 0;
    return barRow(x.label, x.n, pct);
  }).join("");
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

    setHTML("catSource", `<div style="opacity:.65">Comparatif Facebook/Google pour Catalan : OK quand tu auras des events dédiés (ex: apero_catalan.facebook.click / apero_catalan.site.click) ou un split /go par source exposé dans l’API.</div>`);

    renderCompare("gameCompare", cmp.gameCompare);
    renderCompare("devBars", cmp.techDevice);
    renderCompare("browserBars", cmp.techBrowser);

    renderLast50(s.lastClicks, s.lastEvents);

    setStatus("OK ✅");
  }catch(e){
    console.error(e);
    setStatus(`Erreur: ${e.message}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnRefresh")?.addEventListener("click", refresh);
  $("btnInfos")?.addEventListener("click", openModal);
  $("btnInfos")?.addEventListener("pointerdown", (e)=>{ e.preventDefault(); openModal(); });
  $("btnClose")?.addEventListener("click", closeModal);
  $("modalBack")?.addEventListener("click", (e)=>{ if(e.target?.id==="modalBack") closeModal(); });
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

  registerSW();
  refresh();
});
