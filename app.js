/* ADN66 Stats — UI final (style capture)
   - Comparatif Nuit vs Catalan (events.byBrand)
   - Blocs par univers avec barres (events.byEvent + clicks pour Hibair)
   - 50 derniers (mix)
   - Device/OS/Browser
   - Liens tracking (format ADN66)
*/

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
  if(!res.ok) throw new Error(`HTTP ${res.status} — ${(text||"").slice(0,180)}`);
  const t = text.trim();
  if(!(t.startsWith("{")||t.startsWith("["))) throw new Error("Réponse non JSON");
  return JSON.parse(text);
}

// -------- Links text (exact user format)
function linksText(){
return `APERO.NET :
BOUTON JEUX : https://stats.aperos.net/go/jeux?src=direct
BOUTON INSTAL APP : https://stats.aperos.net/e/apero_nuit.app.click?to=https%3A%2F%2Faperos.net&src=app
BOUTON APPEL : https://stats.aperos.net/e/apero_nuit.call?to=tel%3A0652336461&src=app

BOUTON AGE GATE APERO DE NUIT:
Accepte :https://stats.aperos.net/e/apero_nuit.age.accept?to=https%3A%2F%2Faperos.net&src=agegate
refuse : https://stats.aperos.net/e/apero_nuit.age.refuse?to=https%3A%2F%2Faperos.net&src=agegate


apero de nuit via Facebook :
https://stats.aperos.net/e/apero_nuit.facebook.click?to=https%3A%2F%2Faperos.net&src=facebook

apero de nuit via google my buisness :
https://stats.aperos.net/e/apero_nuit.site.click?to=https%3A%2F%2Faperos.net&src=site

ROUE DE LA FORTUNE :
https://stats.aperos.net/e/wheel.sms.click?to=https%3A%2F%2Fchance.aperos.net&src=sms


catalan.aperos.net :
BOUTTON APPEL : https://stats.aperos.net/e/apero_catalan.call?to=tel%3A0652336461&src=app
BONTON INSTALL APP : https://stats.aperos.net/e/apero_catalan.app.click?to=https%3A%2F%2Fcatalan.aperos.net&src=app

BOUTON AGE GATE 
accepte : https://stats.aperos.net/e/apero_catalan.age.accept?to=https%3A%2F%2Fcatalan.aperos.net&src=agegate
refuse : https://stats.aperos.net/e/apero_catalan.age.refuse?to=https%3A%2F%2Fcatalan.aperos.net&src=agegate


apero catalan via google my buisness :
https://stats.aperos.net/go/catalan?src=direct

apero catalan via facebook :
https://stats.aperos.net/go/catalan?src=facebook

le jeux hibair drink via QR code :
https://stats.aperos.net/go/jeux?src=qr

le jeux hibair drink via facebook :
https://stats.aperos.net/go/jeux?src=facebook`;
}

function renderLinks(){
  const raw = linksText();
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const html = esc(raw).replace(urlRe, (m)=>`<a href="${m}" target="_blank" rel="noopener">${m}</a>`).replaceAll("\n","<br>");
  setHTML("linksBox", html);
}

async function copyLinks(){
  try{
    await navigator.clipboard.writeText(linksText());
    setStatus("Liens copiés ✅");
  }catch{
    setStatus("Copie bloquée (navigateur)");
  }
}

// -------- Helpers for stats shapes
function normalizeStats(d){
  const byDevice = Array.isArray(d.byDevice) ? d.byDevice : [];
  const byOS = Array.isArray(d.byOS) ? d.byOS : [];
  const byBrowser = Array.isArray(d.byBrowser) ? d.byBrowser : [];
  const byCampaign = Array.isArray(d.byCampaign) ? d.byCampaign : [];
  const lastClicks = Array.isArray(d.last) ? d.last : [];

  const ev = (d && typeof d.events === "object" && d.events) ? d.events : {};
  const byBrand = Array.isArray(ev.byBrand) ? ev.byBrand : [];
  const byEvent = Array.isArray(ev.byEvent) ? ev.byEvent : [];
  const lastEvents = Array.isArray(ev.last) ? ev.last : [];

  const totals = {
    totalEvents: Number(ev.total ?? d.totalEvents ?? d.total ?? NaN),
    todayEvents: Number(ev.todayTotal ?? ev.today ?? d.today ?? NaN),
  };

  return { byDevice, byOS, byBrowser, byCampaign, lastClicks, byBrand, byEvent, lastEvents, totals };
}

function renderSimpleRows(tbodyId, rows, kKey, vKey){
  const tb = $(tbodyId);
  if(!tb) return;
  const list = (rows||[]).map(r=>({k: String(r[kKey] ?? "").trim() || "?", v: Number(r[vKey] ?? 0)}))
    .sort((a,b)=>b.v-a.v);
  tb.innerHTML = list.length
    ? list.map(x=>`<tr><td>${esc(x.k)}</td><td class="rightTxt">${fmt(x.v)}</td></tr>`).join("")
    : `<tr><td colspan="2" style="opacity:.6">—</td></tr>`;
}

function sum(list){ return (list||[]).reduce((s,x)=>s+Number(x.n ?? x.value ?? 0),0); }

function barRow(label, n, pct){
  const pctTxt = Number.isFinite(pct) ? `${pct.toFixed(0)}%` : "—";
  const w = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return `
    <div class="barRow">
      <div class="barTop">
        <div class="left">${esc(label)}</div>
        <div class="right"><span>${fmt(n)}</span><span style="opacity:.85">•</span><span style="opacity:.95">${pctTxt}</span></div>
      </div>
      <div class="barTrack"><div class="barFill" style="width:${w}%"></div></div>
    </div>
  `;
}

function labelEventNice(eventKey){
  const k = String(eventKey||"").trim();

  // Common mappings
  const m = {
    "facebook.click": "Facebook",
    "site.click": "Site",
    "app.click": "Application",
    "qr.click": "QR",
    "sms.click": "SMS",
    "call": "Bouton appeler",
    "age.accept": "Accepter l’âge",
    "age.refuse": "Refuser l’âge",
  };

  // wheel.*
  if(k.startsWith("wheel.")){
    const tail = k.slice("wheel.".length);
    for(const [t,lab] of Object.entries(m)){
      if(tail === t) return `Roue de la fortune — ${lab}`;
    }
    return `Roue — ${tail}`;
  }

  // apero_nuit.*
  if(k.startsWith("apero_nuit.")){
    const tail = k.slice("apero_nuit.".length);
    for(const [t,lab] of Object.entries(m)){
      if(tail === t) return `Apéro de Nuit 66 — ${lab}`;
    }
    return `Apéro de Nuit 66 — ${tail}`;
  }

  // apero_catalan.*
  if(k.startsWith("apero_catalan.")){
    const tail = k.slice("apero_catalan.".length);
    for(const [t,lab] of Object.entries(m)){
      if(tail === t) return `Apéro Catalan — ${lab}`;
    }
    return `Apéro Catalan — ${tail}`;
  }

  return k;
}

function renderBrandBars(containerId, rows, total){
  const el = $(containerId);
  if(!el) return;
  const list = (rows||[]).slice().sort((a,b)=>b.n-a.n);
  if(!list.length){
    el.innerHTML = `<div style="opacity:.6">—</div>`;
    return;
  }
  const t = total || list.reduce((s,x)=>s+x.n,0) || 0;
  el.innerHTML = list.map(x=>{
    const pct = t ? (x.n / t * 100) : 0;
    return barRow(x.label, x.n, pct);
  }).join("");
}

function getBrandTotals(byBrand){
  const map = {};
  for(const r of (byBrand||[])){
    const b = String(r.brand ?? r.k ?? r.key ?? "").trim();
    if(!b) continue;
    map[b] = Number(r.n ?? 0);
  }
  return map;
}

function filterByPrefix(byEvent, prefix){
  const out = [];
  for(const r of (byEvent||[])){
    const key = String(r.k ?? r.event_key ?? r.key ?? "").trim();
    if(!key.startsWith(prefix)) continue;
    out.push({ key, n: Number(r.n ?? 0) });
  }
  return out;
}

function groupHibairFromStats(s){
  // Prefer an explicit breakdown if API provides one
  const candidates = [
    s.byCampaignSource, s.byCampaignBySource, s.campaignBySource,
    s.bySourceCampaign, s.bySourceByCampaign
  ];
  for(const c of candidates){
    if(Array.isArray(c)){
      const rows = c.filter(x => String(x.campaign ?? x.c ?? "").toLowerCase() === "jeux")
        .map(x => ({ src: String(x.source ?? x.src ?? "").toLowerCase(), n: Number(x.n ?? 0) }));
      if(rows.length) return rows;
    }
  }

  // Fallback: build from last clicks (approx)
  const rows = {};
  for(const r of (s.lastClicks||[])){
    if(String(r.campaign ?? "").toLowerCase() !== "jeux") continue;
    const src = String(r.source ?? r.src ?? "direct").toLowerCase();
    rows[src] = (rows[src] || 0) + 1;
  }
  return Object.entries(rows).map(([src,n])=>({src,n}));
}

function normalizeHibairLabel(src){
  const x = String(src||"").toLowerCase();
  if(x.includes("app")) return "Hibair Drink — Application";
  if(x.includes("face")) return "Hibair Drink — Facebook";
  if(x.includes("qr")) return "Hibair Drink — QR";
  if(x.includes("sms")) return "Hibair Drink — SMS";
  if(x.includes("direct")) return "Hibair Drink — Direct";
  return `Hibair Drink — ${src}`;
}

function renderComparatif(byBrand){
  // only Nuit/Catalan
  const map = getBrandTotals(byBrand);
  const nuit = Number(map.apero_nuit ?? map.nuit ?? 0);
  const catalan = Number(map.apero_catalan ?? map.catalan ?? 0);

  const listEl = $("cmpList");
  const barsEl = $("cmpBars");
  if(listEl){
    listEl.innerHTML = [
      `<div class="pillRow"><span class="name">Apéro de Nuit 66</span><span class="n">${fmt(nuit)}</span></div>`,
      `<div class="pillRow"><span class="name">Apéro Catalan</span><span class="n">${fmt(catalan)}</span></div>`
    ].join("");
  }
  if(barsEl){
    // replicate screenshot style: each item alone => 100%
    barsEl.innerHTML = [
      barRow("Apéro de Nuit 66", nuit, 100),
      barRow("Apéro Catalan", catalan, 100)
    ].join("");
  }
}

// -------- last 50 (mix clicks + events)
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
  return {
    kind: "click",
    date: parseDateAny(r.created_at ?? r.ts ?? r.date),
    name: String(r.campaign ?? ""),
    src: String(r.source ?? r.src ?? ""),
    os: String(r.os ?? ""),
    browser: String(r.browser ?? ""),
  };
}
function normalizeEvent(r){
  return {
    kind: "event",
    date: parseDateAny(r.ts ?? r.created_at ?? r.date),
    name: String(r.event_key ?? r.k ?? r.key ?? ""),
    src: String(r.src ?? r.source ?? ""),
    os: String(r.os ?? ""),
    browser: String(r.browser ?? ""),
  };
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
      <td>${esc(x.kind==="event" ? labelEventNice(x.name) : x.name)}</td>
      <td class="hideSm">${esc(x.src || "")}</td>
      <td class="hideSm">${esc(x.os || "")}</td>
      <td class="hideSm">${esc(x.browser || "")}</td>
    </tr>
  `).join("");
}

// -------- main render
function computeTotalEvents(byBrand){
  const map = getBrandTotals(byBrand);
  // sum of all brands in events.byBrand
  return Object.values(map).reduce((s,n)=>s+Number(n||0),0);
}

function computeTodayFallback(s){
  // If API doesn't return today totals, approximate with today's events in lastEvents
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const start = new Date(y,m,d,0,0,0,0).getTime();
  let count = 0;
  for(const r of (s.lastEvents||[])){
    const dt = parseDateAny(r.ts ?? r.created_at ?? r.date);
    if(!dt) continue;
    if(dt.getTime() >= start) count++;
  }
  return count || NaN;
}

async function refresh(){
  setStatus("Chargement…");
  try{
    try{ await fetch(API_HEALTH, {cache:"no-store"}); }catch{}
    const raw = await fetchJson(API_STATS);
    if(raw && raw.ok === false) throw new Error(raw.error || "API ok=false");

    const s = normalizeStats(raw);

    // totals
    const total = Number.isFinite(s.totals.totalEvents) ? s.totals.totalEvents : computeTotalEvents(s.byBrand);
    setText("totalEvents", fmt(total));

    const today = Number.isFinite(s.totals.todayEvents) ? s.totals.todayEvents : computeTodayFallback(s);
    setText("todayEvents", Number.isFinite(today) ? fmt(today) : fmt(total));

    // comparatif
    renderComparatif(s.byBrand);

    // brand blocks from events.byEvent
    const nuitRows = filterByPrefix(s.byEvent, "apero_nuit.").map(x=>({label: labelEventNice(x.key), n:x.n}));
    const catalanRows = filterByPrefix(s.byEvent, "apero_catalan.").map(x=>({label: labelEventNice(x.key), n:x.n}));
    const wheelRows = filterByPrefix(s.byEvent, "wheel.").map(x=>({label: labelEventNice(x.key), n:x.n}));

    const brandTotals = getBrandTotals(s.byBrand);
    const totalNuit = Number(brandTotals.apero_nuit ?? brandTotals.nuit ?? nuitRows.reduce((a,b)=>a+b.n,0) ?? 0);
    const totalCatalan = Number(brandTotals.apero_catalan ?? brandTotals.catalan ?? catalanRows.reduce((a,b)=>a+b.n,0) ?? 0);
    const totalWheel = wheelRows.reduce((a,b)=>a+b.n,0);

    setText("totalNuit", fmt(totalNuit));
    setText("totalCatalan", fmt(totalCatalan));
    setText("totalWheel", fmt(totalWheel));

    renderBrandBars("nuitBars", nuitRows, totalNuit);
    renderBrandBars("catalanBars", catalanRows, totalCatalan);
    renderBrandBars("wheelBars", wheelRows, totalWheel);

    // hibair from clicks (campaign jeux)
    const hib = groupHibairFromStats(s);
    const hibRows = (hib||[]).map(x=>({label: normalizeHibairLabel(x.src), n: x.n})).sort((a,b)=>b.n-a.n);
    const totalHibair = hibRows.reduce((a,b)=>a+b.n,0);
    setText("totalHibair", fmt(totalHibair));
    renderBrandBars("hibairBars", hibRows, totalHibair);

    // tech tables
    renderSimpleRows("tbodyDevice", s.byDevice, "device", "n");
    renderSimpleRows("tbodyOS", s.byOS, "os", "n");
    renderSimpleRows("tbodyBrowser", s.byBrowser, "browser", "n");

    // last 50
    renderLast50(s.lastClicks, s.lastEvents);

    setStatus("OK ✅");
  }catch(e){
    console.error(e);
    setStatus(`Erreur: ${e.message}`);
  }
}

// PWA SW
function registerSW(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderLinks();
  const br = $("btnRefresh"); if(br) br.addEventListener("click", refresh);
  const bc = $("btnCopyLinks"); if(bc) bc.addEventListener("click", copyLinks);
  registerSW();
  refresh();
});
