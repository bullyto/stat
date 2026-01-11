/* Stats ADN66 — app.js (Front PWA)
   Objectif (version 2026-01-11):
   - Affichage "Liens de tracking" regroupé (apero.net / catalan.aperos.net / jeux / roue)
   - Compteurs Age Gate via events: *.age.accept / *.age.refuse
   - Barres colorées :
        Catalan = jaune
        Apéro de nuit = bleu
        Hibair Drink = violet
        Roue de la fortune = rouge
   - Derniers 50 (fusion clicks + events) avec OS/Navigateur
*/

const STATS_ORIGIN = "https://stats.aperos.net";
const API_STATS = `${STATS_ORIGIN}/api/stats`;
const API_HEALTH = `${STATS_ORIGIN}/api/health`;

const COLORS = {
  apero: "#3b82f6",      // bleu
  catalan: "#f6c343",    // jaune
  jeux: "#a855f7",       // violet (hibair)
  hibair: "#a855f7",     // violet
  chance: "#ef4444",     // rouge (roue)
  wheel: "#ef4444",      // rouge
};

function $(id){ return document.getElementById(id); }
function setText(id, v){ const el=$(id); if(el) el.textContent = String(v ?? ""); }
function escHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function formatInt(n){
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toLocaleString("fr-FR") : "0";
}

function buildTrackingText(){
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
https://stats.aperos.net/go/jeux?src=facebook
`;
}

function copyLinks(){
  const t = buildTrackingText();
  navigator.clipboard?.writeText(t).then(()=>{
    toast("Liens copiés ✅");
  }).catch(()=>{
    toast("Copie impossible (navigateur) ❌");
  });
}

function toast(msg){
  // mini toast simple sans dépendances
  let el = document.querySelector(".toast");
  if(!el){
    el = document.createElement("div");
    el.className = "toast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "18px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 14px";
    el.style.borderRadius = "999px";
    el.style.border = "1px solid rgba(255,255,255,.14)";
    el.style.background = "rgba(0,0,0,.55)";
    el.style.backdropFilter = "blur(10px)";
    el.style.zIndex = "9999";
    el.style.fontWeight = "700";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ el.style.opacity = "0"; }, 1800);
}

async function fetchJson(url){
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function toMsFromSqliteDatetime(dt){
  // "YYYY-MM-DD HH:MM:SS" (localtime). On parse comme local.
  if(!dt) return 0;
  const m = String(dt).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if(!m) return 0;
  const [_, Y, Mo, D, h, mi, s] = m;
  return new Date(Number(Y), Number(Mo)-1, Number(D), Number(h), Number(mi), Number(s)).getTime();
}

function renderBars(containerId, items){
  const wrap = $(containerId);
  if(!wrap) return;
  const safe = (items || []).filter(x => Number(x.value) > 0);
  if(!safe.length){
    wrap.innerHTML = `<div class="muted small">Aucune donnée.</div>`;
    return;
  }
  const max = Math.max(...safe.map(x => Number(x.value) || 0), 1);

  wrap.innerHTML = safe.map(it=>{
    const pct = Math.max(0, Math.min(100, (Number(it.value) / max) * 100));
    const color = it.color || "rgba(255,255,255,.7)";
    return `
      <div class="barRow">
        <div class="barLabel">${escHtml(it.label)}</div>
        <div class="barTrack"><div class="barFill" style="width:${pct}%;background:${color}"></div></div>
        <div class="barVal">${formatInt(it.value)}</div>
      </div>
    `;
  }).join("");
}

function pickTopText(mapLike, topN=4){
  const rows = Object.entries(mapLike || {})
    .map(([k,v]) => ({ k, v:Number(v||0) }))
    .filter(r => r.v > 0)
    .sort((a,b)=>b.v-a.v)
    .slice(0, topN);
  if(!rows.length) return "—";
  return rows.map(r => `${r.k} (${formatInt(r.v)})`).join(" • ");
}

function normalizeStats(raw){
  const clicks = {
    byCampaign: Array.isArray(raw?.byCampaign) ? raw.byCampaign : [],
    last: Array.isArray(raw?.last) ? raw.last : [],
  };
  const events = {
    byEvent: Array.isArray(raw?.events?.byEvent) ? raw.events.byEvent : [],
    byBrand: Array.isArray(raw?.events?.byBrand) ? raw.events.byBrand : [],
    last: Array.isArray(raw?.events?.last) ? raw.events.last : [],
  };
  return { clicks, events };
}

function mapFromRows(rows, keyField, valField){
  const m = {};
  for(const r of (rows || [])){
    const k = String(r?.[keyField] ?? r?.k ?? "").trim() || "?";
    const v = Number(r?.[valField] ?? r?.n ?? 0);
    m[k] = (m[k] || 0) + v;
  }
  return m;
}

function renderAgeGate(eventsByEvent){
  const aperoAccept = eventsByEvent["apero_nuit.age.accept"] || 0;
  const aperoRefuse = eventsByEvent["apero_nuit.age.refuse"] || 0;
  const catAccept = eventsByEvent["apero_catalan.age.accept"] || 0;
  const catRefuse = eventsByEvent["apero_catalan.age.refuse"] || 0;

  setText("ageAperoAccept", formatInt(aperoAccept));
  setText("ageAperoRefuse", formatInt(aperoRefuse));
  setText("ageCatalanAccept", formatInt(catAccept));
  setText("ageCatalanRefuse", formatInt(catRefuse));
}

function renderLast50Merged(clickLast, eventLast){
  const merged = [];

  for(const r of (clickLast || [])){
    merged.push({
      ts: toMsFromSqliteDatetime(r.created_at),
      date: r.created_at || "",
      type: "click",
      key: r.campaign || "?",
      src: r.source || "direct",
      country: r.country || "?",
      device: r.device || "?",
      os: r.os || "?",
      browser: r.browser || "?",
      target: `${r.domain || ""}${r.path || ""}`.replace(/^\s+|\s+$/g,"")
    });
  }

  for(const r of (eventLast || [])){
    merged.push({
      ts: Number(r.ts || 0),
      date: r.ts ? new Date(Number(r.ts)).toLocaleString("fr-FR") : "",
      type: "event",
      key: r.event_key || "?",
      src: r.src || "direct",
      country: r.country || "?",
      device: r.device || "?",
      os: r.os || "?",
      browser: r.browser || "?",
      target: ""
    });
  }

  merged.sort((a,b)=> (b.ts||0) - (a.ts||0));
  const top50 = merged.slice(0, 50);

  // résumé OS / navigateur sur les 50 derniers
  const osMap = {};
  const brMap = {};
  for(const it of top50){
    const os = String(it.os || "?");
    const br = String(it.browser || "?");
    osMap[os] = (osMap[os]||0) + 1;
    brMap[br] = (brMap[br]||0) + 1;
  }
  setText("last50OS", pickTopText(osMap, 5));
  setText("last50Browser", pickTopText(brMap, 5));

  const tbody = $("tbodyLast50");
  if(!tbody) return;
  tbody.innerHTML = top50.map(it => `
    <tr>
      <td>${escHtml(it.date)}</td>
      <td>${escHtml(it.type)}</td>
      <td>${escHtml(it.key)}</td>
      <td>${escHtml(it.src)}</td>
      <td>${escHtml(it.country)}</td>
      <td>${escHtml(it.device)}</td>
      <td>${escHtml(it.os)}</td>
      <td>${escHtml(it.browser)}</td>
      <td>${escHtml(it.target)}</td>
    </tr>
  `).join("");
}

function renderBarsFromData(clickByCampaign, eventsByBrand){
  // Campagnes (clicks)
  const cMap = mapFromRows(clickByCampaign, "campaign", "n");
  const campaignItems = [
    { label: "Apéro de Nuit (apero)", value: cMap.apero || 0, color: COLORS.apero },
    { label: "Apéro Catalan (catalan)", value: cMap.catalan || 0, color: COLORS.catalan },
    { label: "Hibair Drink (jeux)", value: cMap.jeux || cMap.game || 0, color: COLORS.jeux },
    { label: "Roue de la fortune (chance)", value: cMap.chance || 0, color: COLORS.chance },
  ].filter(x => x.value > 0);

  // Marques (events)
  const bMap = mapFromRows(eventsByBrand, "k", "n");
  const brandItems = [
    { label: "Apéro Catalan", value: bMap.apero_catalan || 0, color: COLORS.catalan },
    { label: "Apéro de Nuit 66", value: bMap.apero_nuit || 0, color: COLORS.apero },
    { label: "Hibair Drink", value: bMap.hibair || 0, color: COLORS.hibair },
    { label: "Roue de la fortune", value: bMap.wheel || 0, color: COLORS.wheel },
  ].filter(x => x.value > 0);

  renderBars("barsCampaign", campaignItems);
  renderBars("barsBrand", brandItems);
}

async function refresh(){
  try{
    const raw = await fetchJson(API_STATS);
    const { clicks, events } = normalizeStats(raw);

    // liens
    setText("trackingLinks", buildTrackingText());

    // age gate
    const evMap = mapFromRows(events.byEvent, "k", "n");
    renderAgeGate(evMap);

    // barres
    renderBarsFromData(clicks.byCampaign, events.byBrand);

    // derniers 50 (fusion)
    renderLast50Merged(clicks.last, events.last);

  }catch(e){
    console.error(e);
    toast("Erreur API / D1 (voir console) ❌");
    // même si erreur, afficher au moins les liens
    setText("trackingLinks", buildTrackingText());
  }
}

/* ===== PWA install (conserve l’existant, simplifié) ===== */
let deferredPrompt = null;

function setupPWAInstall(){
  const btn = $("btnInstall");
  const hint = $("installHint");
  if(!btn) return;

  btn.disabled = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.disabled = false;
    if(hint) hint.textContent = "Disponible sur cet appareil.";
  });

  btn.addEventListener("click", async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    try{ await deferredPrompt.userChoice; }catch{}
    deferredPrompt = null;
    btn.disabled = true;
  });

  // iOS hint
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if(isIOS && hint) hint.textContent = "iOS : Partager → Sur l’écran d’accueil.";
}

/* ===== Auto refresh ===== */
function setupAuto(){
  const LS = "adn66_stat_auto";
  const toggle = $("autoToggle");
  if(!toggle) return;

  let on = localStorage.getItem(LS) === "1";
  toggle.checked = on;

  let timer = null;
  const arm = () => {
    if(timer) clearInterval(timer);
    if(!toggle.checked) return;
    timer = setInterval(refresh, 15000);
  };

  toggle.addEventListener("change", ()=>{
    localStorage.setItem(LS, toggle.checked ? "1" : "0");
    arm();
  });

  arm();
}

function hardReload(){
  // SW: tente d’ignorer cache
  try { if (navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage({type:"SKIP_WAITING"}); } catch {}
  location.reload(true);
}

document.addEventListener("DOMContentLoaded", () => {
  setText("apiHost", "stats.aperos.net");
  if ($("btnRefresh")) $("btnRefresh").addEventListener("click", refresh);
  if ($("btnCopyLinks")) $("btnCopyLinks").addEventListener("click", copyLinks);
  if ($("btnHardReload")) $("btnHardReload").addEventListener("click", hardReload);

  setText("trackingLinks", buildTrackingText());
  setupPWAInstall();
  setupAuto();
  refresh();
});
