const API_BASE = "https://stats.aperos.net";

const CAMPAIGNS = [
  { key: "apero", label: "Apéro" },
  { key: "catalan", label: "Catalan" },
  { key: "chance", label: "Chance" },
  { key: "jeux", label: "Jeux" }
];

function normalizeKey(s) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function campaignsToMap(campaigns) {
  const map = {};
  for (const c of CAMPAIGNS) map[c.key] = 0;

  if (campaigns && !Array.isArray(campaigns) && typeof campaigns === "object") {
    for (const [k, v] of Object.entries(campaigns)) {
      const nk = normalizeKey(k);
      if (nk in map) map[nk] = Number(v) || 0;
    }
    return map;
  }

  if (Array.isArray(campaigns)) {
    for (const row of campaigns) {
      const nk = normalizeKey(row?.campaign);
      if (nk in map) map[nk] = Number(row?.n) || 0;
    }
    return map;
  }

  return map;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderCampaignCards(map) {
  for (const c of CAMPAIGNS) {
    setText(`count_${c.key}`, String(map[c.key] ?? 0));
    setText(`exact_${c.key}`, c.key);
  }

  const tbody = document.getElementById("campaignTableBody");
  if (tbody) {
    tbody.innerHTML = "";
    const rows = [...CAMPAIGNS].sort((a, b) => (map[b.key] ?? 0) - (map[a.key] ?? 0));
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.label}</td><td style="text-align:right">${map[r.key] ?? 0}</td>`;
      tbody.appendChild(tr);
    }
  }
}

async function refreshStats() {
  try {
    setText("statusLine", "Chargement…");
    const res = await fetch(`${API_BASE}/api/stats`, { cache: "no-store" });
    const data = await res.json();

    if (!data?.ok) throw new Error(data?.error || "API ko");

    setText("totalCount", String(data.total ?? 0));
    setText("todayCount", String(data.today ?? 0));

    const map = campaignsToMap(data.campaigns);
    renderCampaignCards(map);

    setText("statusLine", "OK • stats à jour ✅");
  } catch (e) {
    console.error(e);
    setText("statusLine", `Erreur : ${e?.message || e}`);
  }
}

window.addEventListener("load", () => {
  const btn = document.getElementById("refreshBtn");
  if (btn) btn.addEventListener("click", refreshStats);
  refreshStats();
});
