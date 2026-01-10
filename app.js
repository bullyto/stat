/* ADN66 — Hub de liens tracking
   Objectif: garder le style, ne garder QUE les liens demandés.
   - Chaque lien s'ouvre dans un nouvel onglet.
   - Le bouton "Installer l’app" déclenche l'installation PWA (si dispo)
     ET envoie un tracking discret via fetch() (sans casser l'installation).
*/

const LINKS = {
  aperos: [
    { id:"apero_btn_games", label:"Bouton JEUX", url:"https://stats.aperos.net/go/jeux?src=direct" },
    // Install: tracking discret + prompt PWA (pas de redirect)
    { id:"apero_btn_install", label:"Bouton INSTALL APP", url:"https://stats.aperos.net/e/apero_nuit.app.click?to=https%3A%2F%2Faperos.net&src=app", kind:"install" },
    { id:"apero_btn_call", label:"Bouton APPEL", url:"https://stats.aperos.net/e/apero_nuit.call?to=tel%3A0652336461&src=app" },
    { id:"apero_age_ok", label:"Age Gate MAJEUR", url:"https://stats.aperos.net/go/apero?src=sms" },
    { id:"apero_age_no", label:"Age Gate MINEUR", url:"https://stats.aperos.net/e/apero_nuit.qr.click?to=https%3A%2F%2Faperos.net&src=qr" },
  ],
  nuitExternal: [
    { id:"apero_fb", label:"Facebook (Apéro de Nuit 66)", url:"https://stats.aperos.net/e/apero_nuit.facebook.click?to=https%3A%2F%2Faperos.net&src=facebook" },
    { id:"apero_gmb", label:"Google Business (Apéro de Nuit 66)", url:"https://stats.aperos.net/e/apero_nuit.site.click?to=https%3A%2F%2Faperos.net&src=site" },
  ],
  catalan: [
    { id:"cat_call", label:"Bouton APPEL", url:"https://stats.aperos.net/e/apero_catalan.call?to=tel%3A0652336461&src=app" },

    // ⚠️ Tu as mis "??". J'ai mis l'équivalent logique (tu peux changer ici si tu veux une autre clé).
    { id:"cat_install", label:"Bouton INSTALL APP", url:"https://stats.aperos.net/e/apero_catalan.app.click?to=https%3A%2F%2Fcatalan.aperos.net&src=app", kind:"install_no_prompt" },

    { id:"cat_age_ok", label:"Age Gate MAJEUR", url:"https://stats.aperos.net/go/catalan?src=sms" },
    { id:"cat_age_no", label:"Age Gate MINEUR", url:"https://stats.aperos.net/go/catalan?src=qr" },
  ],
  catalanExternal: [
    { id:"cat_gmb", label:"Google Business (Apéro Catalan)", url:"https://stats.aperos.net/go/catalan?src=direct" },
    { id:"cat_fb", label:"Facebook (Apéro Catalan)", url:"https://stats.aperos.net/go/catalan?src=facebook" },
  ],
  hibair: [
    { id:"hibair_qr", label:"Jeux Hibair (QR)", url:"https://stats.aperos.net/go/jeux?src=qr" },
    { id:"hibair_fb", label:"Jeux Hibair (Facebook)", url:"https://stats.aperos.net/go/jeux?src=facebook" },
  ],
  wheel: [
    { id:"wheel_sms", label:"Bouton avis (Roue)", url:"https://stats.aperos.net/e/wheel.sms.click?to=https%3A%2F%2Fchance.aperos.net&src=sms" },
  ],
};

const $ = (id) => document.getElementById(id);

function toast(msg){
  const el = $("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.classList.remove("show"), 1800);
}

function safeText(s){ return String(s ?? "").trim(); }

function renderList(containerId, items){
  const container = $(containerId);
  if(!container) return;

  container.innerHTML = (items || []).map(it => {
    const label = safeText(it.label);
    const url = safeText(it.url);
    const kind = it.kind || "link";
    const btnLabel = (kind === "install") ? "Installer" : "Ouvrir";

    return `
      <div class="linkRow" data-kind="${kind}" data-url="${escapeHtml(url)}" data-label="${escapeHtml(label)}">
        <div class="linkMeta">
          <div class="linkName">${escapeHtml(label)}</div>
          <div class="linkUrl" title="${escapeHtml(url)}">${escapeHtml(url)}</div>
        </div>
        <div class="smallBtns">
          <button class="btn ghost small act-copy" type="button">Copier</button>
          <button class="btn small act-open" type="button">${escapeHtml(btnLabel)}</button>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function copyText(txt){
  try{
    await navigator.clipboard.writeText(txt);
    toast("Copié ✅");
  }catch{
    // fallback
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand("copy"); toast("Copié ✅"); }catch{ toast("Copie bloquée"); }
    ta.remove();
  }
}

function openNewTab(url){
  window.open(url, "_blank", "noopener,noreferrer");
}

function fireTracking(url){
  // Discret: déclenche un GET sans navigation (pour logger)
  // keepalive = utile si l'utilisateur ferme vite / install prompt
  try{
    fetch(url, { mode:"no-cors", cache:"no-store", keepalive:true }).catch(()=>{});
  }catch{}
}

let deferredPrompt = null;

function setupInstallPrompt(){
  const btn = $("btnInstall");
  if(!btn) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener("click", async () => {
    if(!deferredPrompt){
      toast("Installation indisponible ici");
      return;
    }
    // Ici pas de tracking (ce bouton est juste un bonus).
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.hidden = true;
  });
}

function setupClicks(){
  document.addEventListener("click", async (e) => {
    const row = e.target.closest(".linkRow");
    if(!row) return;

    const url = row.getAttribute("data-url") || "";
    const label = row.getAttribute("data-label") || "";
    const kind = row.getAttribute("data-kind") || "link";

    if(e.target.closest(".act-copy")){
      await copyText(url);
      return;
    }

    if(e.target.closest(".act-open")){
      if(kind === "install"){
        // 1) tracking discret
        fireTracking(url);

        // 2) prompt PWA si disponible
        if(deferredPrompt){
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          const btn = $("btnInstall");
          if(btn) btn.hidden = true;
          toast("OK ✅");
          return;
        }

        // 3) sinon, on ouvre le lien (ça redirige vers aperos.net)
        openNewTab(url);
        return;
      }

      if(kind === "install_no_prompt"){
        // Catalan: tu n'as pas donné la mécanique install. On log + ouvre.
        fireTracking(url);
        openNewTab(url);
        return;
      }

      openNewTab(url);
      return;
    }
  });

  const btnCopyAll = $("btnCopyAll");
  if(btnCopyAll){
    btnCopyAll.addEventListener("click", async () => {
      const lines = [];
      for(const [section, items] of Object.entries(LINKS)){
        lines.push(`[${section}]`);
        for(const it of items) lines.push(`${it.label} = ${it.url}`);
        lines.push("");
      }
      await copyText(lines.join("\n").trim());
    });
  }
}

function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

document.addEventListener("DOMContentLoaded", () => {
  renderList("listAperos", LINKS.aperos);
  renderList("listNuitExternal", LINKS.nuitExternal);
  renderList("listCatalan", LINKS.catalan);
  renderList("listCatalanExternal", LINKS.catalanExternal);
  renderList("listHibair", LINKS.hibair);
  renderList("listWheel", LINKS.wheel);

  setupInstallPrompt();
  setupClicks();
  registerSW();
});
