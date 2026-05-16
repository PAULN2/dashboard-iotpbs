===============================================
// CONFIGURACIÓN
// ==========================================================
// Reemplaza este token por tu token de TagoIO.
// Se recomienda crear uno de SOLO LECTURA (Read Only).
// IMPORTANTE: para la página web utiliza un TOKEN DE PERFIL (Profile Token)
// con permisos de SOLO LECTURA (Read Only), NO el Device Token del ESP32.
const TAGO_TOKEN = "33e4dec9-056a-42bc-83e3-6ed4a540e00b";

// Región US (coincide con tu ESP32)
const TAGO_API = "https://api.us.tago.io/data";

// Variables a consultar
const VARIABLES = [
  "location",
  "latitud",
  "longitud",
  "altitud_gps",
  "velocidad",
  "satelites",
  "hdop",
  "hora_ecuador",
  "temperatura",
  "humedad",
  "presion",
  "gas_resist",
  "altitud_bme"
];

// ==========================================================
// MAPA
// ==========================================================
let map = L.map("map").setView([-2.8974, -79.0045], 13); // Cuenca, Ecuador

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

let marker = L.marker([-2.8974, -79.0045]).addTo(map);

// ==========================================================
// UTILIDADES
// ==========================================================
function setStatus(text, ok = true) {
  const status = document.getElementById("status");
  status.textContent = text;
  status.className = "status " + (ok ? "ok" : "error");
}

function setValue(id, value, decimals = null) {
  const el = document.getElementById(id);
  if (!el) return;

  if (value === undefined || value === null || value === "") {
    el.textContent = "--";
    return;
  }

  if (typeof value === "number" && decimals !== null) {
    el.textContent = value.toFixed(decimals);
  } else {
    el.textContent = value;
  }
}

// ==========================================================
// CONSULTA A TAGOIO
// ==========================================================
async function fetchTagoData() {
  try {
    setStatus("Consultando TagoIO...", true);

    const query = VARIABLES.map(v => `variable=${encodeURIComponent(v)}`).join("&");
    const url = `${TAGO_API}?${query}&qty=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        // En navegadores, TagoIO funciona de forma más confiable con
        // un Profile Token usando el encabezado Authorization.
        "Authorization": TAGO_TOKEN,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json(); // { result: [...] }
    const data = json.result || [];

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No hay datos disponibles");
    }

    const latest = {};

    for (const item of data) {
      if (!(item.variable in latest)) {
        latest[item.variable] = item;
setInterval(fetchTagoData, 5000);