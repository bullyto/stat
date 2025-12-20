
/* Stats ADN66 — PWA front
   Campagnes: apero / catalan / chance / jeux
   API: https://stats.aperos.net/api/stats
*/
const API_STATS = "https://stats.aperos.net/api/stats";
const API_LINKS = "https://stats.aperos.net/api/links"; // optional (si le worker le fournit)

const $ = (id) => document.getElementById(id);

function setStatus(msg, isErr=false){
  const el = $("status");
  el.textContent = msg || "";
  el.classList.toggle("err", !!isErr);
}

function formatInt(n){
  if (typeof n !== "number") return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}

function campaignLabel(key){
  const map = {
    apero: "Apéro",
    catalan: "Catalan",
    chance: "Chance",
    jeux: "Jeux",
  };
  return map[key] || key;
}

function buildGoLink(campaign, to){
  const u = new URL(`https://stats.aperos.net/go/${encodeURIComponent(campaign)}`);
  u.searchParams.set("to", to);
  return u.toString();
}

function defaultDestinations(){
  // Tu peux modifier ici si besoin (mais c'est déjà propre)
  return {
    apero: "https://aperos.net",
    catalan: "https://aperos.net/catalan",
    chance: "https://chance.aperos.net",
    jeux: "https://game.aperos.net",
  };
}

async function fetchJson(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function refresh(){
  setStatus("Chargement des stats…");
  try{
    const data = await fetchJson(API_STATS);

    $("kpiTotal").textContent = formatInt(data.total);
    $("kpiToday").textContent = formatInt(data.today);

    const c = data.campaigns || {};
    $("cApero").textContent = formatInt(c.apero ?? 0);
    $("cCatalan").textContent = formatInt(c.catalan ?? 0);
    $("cChance").textContent = formatInt(c.chance ?? 0);
    $("cJeux").textContent = formatInt(c.jeux ?? 0);

    // Table
    const tbody = $("tbody");
    tbody.innerHTML = "";

    const dest = defaultDestinations();
    const rows = ["apero","catalan","chance","jeux"]
      .map(k => ({ key: k, clicks: Number(c[k] ?? 0), to: dest[k] }))
      .sort((a,b) => b.clicks - a.clicks);

    for (const r of rows){
      const tr = document.createElement("tr");

      const td1 = document.createElement("td");
      td1.textContent = campaignLabel(r.key);

      const td2 = document.createElement("td");
      td2.textContent = formatInt(r.clicks);

      const td3 = document.createElement("td");
      const go = buildGoLink(r.key, r.to);
      td3.innerHTML = `<a href="${go}" target="_blank" rel="noopener">Lien tracking</a>
        <span class="muted"> • </span>
        <a href="${r.to}" target="_blank" rel="noopener">Destination</a>`;

      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tbody.appendChild(tr);
    }

    setStatus("OK • stats à jour ✅");
  }catch(err){
    console.error(err);
    setStatus("Erreur : API non accessible (Worker / DNS / CORS).", true);
  }
}

async function copyLinks(){
  const dest = defaultDestinations();
  const lines = [
    `Apéro : ${buildGoLink("apero", dest.apero)}`,
    `Catalan : ${buildGoLink("catalan", dest.catalan)}`,
    `Chance : ${buildGoLink("chance", dest.chance)}`,
    `Jeux : ${buildGoLink("jeux", dest.jeux)}`,
  ];
  const txt = lines.join("\n");
  try{
    await navigator.clipboard.writeText(txt);
    setStatus("Liens copiés ✅ (tu peux coller dans tes notes / SMS / FB)");
  }catch{
    // fallback
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setStatus("Liens copiés ✅");
  }
}

function setupPWAInstall(){
  let deferredPrompt = null;
  const btn = $("btnInstall");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.hidden = true;
  });

  // Service Worker
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnRefresh").addEventListener("click", refresh);
  $("btnCopyLinks").addEventListener("click", copyLinks);
  setupPWAInstall();
  refresh();
});
