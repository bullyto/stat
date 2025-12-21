const API_URL = "https://stats.aperos.net/api/stats";

const elTotal = document.querySelector("#total");
const elToday = document.querySelector("#today");
const elStatus = document.querySelector("#status");

const tableCampaignBody = document.querySelector("#tableCampaign");
const tableDeviceBody = document.querySelector("#tableDevice");
const tableOSBody = document.querySelector("#tableOS");
const tableBrowserBody = document.querySelector("#tableBrowser");
const tableCountryBody = document.querySelector("#tableCountry");

document.querySelector("#refresh").addEventListener("click", loadStats);

async function loadStats() {
  try {
    elStatus.textContent = "Chargement...";
    const res = await fetch(API_URL, { cache: "no-store" });
    const data = await res.json();

    if (!data.ok) throw new Error("API error");

    render(data);
    elStatus.textContent = "OK • stats à jour ✅";
  } catch (err) {
    console.error(err);
    elStatus.textContent = "Erreur de chargement ❌";
  }
}

function render(data) {
  elTotal.textContent = data.total ?? 0;
  elToday.textContent = data.today ?? 0;

  renderTable(
    tableCampaignBody,
    data.byCampaign || [],
    [
      { value: r => r.campaign },
      { className: "right", value: r => r.n }
    ]
  );

  renderTable(
    tableDeviceBody,
    data.byDevice || [],
    [
      { value: r => r.device || "?" },
      { className: "right", value: r => r.n }
    ]
  );

  renderTable(
    tableOSBody,
    data.byOS || [],
    [
      { value: r => r.os || "?" },
      { className: "right", value: r => r.n }
    ]
  );

  renderTable(
    tableBrowserBody,
    data.byBrowser || [],
    [
      { value: r => r.browser || "?" },
      { className: "right", value: r => r.n }
    ]
  );

  renderTable(
    tableCountryBody,
    data.byCountry || [],
    [
      { value: r => r.country || "?" },
      { className: "right", value: r => r.n }
    ]
  );
}

function renderTable(tbody, rows, cols) {
  tbody.innerHTML = "";
  rows.forEach(row => {
    const tr = document.createElement("tr");
    cols.forEach(col => {
      const td = document.createElement("td");
      if (col.className) td.className = col.className;
      td.textContent = col.value(row);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// auto-load
loadStats();
