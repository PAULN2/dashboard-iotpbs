// ==========================================================
// DASHBOARD IoT - script.js
// ESP32 + GPS NEO-6M + BME680 + TagoIO
// Datos obtenidos mediante Cloudflare Worker
// ==========================================================

// URL de tu Cloudflare Worker
const API_URL = "https://tago-worker.paulmartinez1991.workers.dev/";

// Intervalo de actualización (ms)
const UPDATE_INTERVAL = 5000;

// Variables globales del mapa
let map;
let marker;

// ==========================================================
// INICIALIZAR MAPA
// ==========================================================
function inicializarMapa() {
  map = L.map("map").setView([-2.90055, -79.00453], 13); // Cuenca, Ecuador

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([-2.90055, -79.00453]).addTo(map);
  marker.bindPopup("Esperando datos del GPS...");
}

// ==========================================================
// ACTUALIZAR INDICADOR DE ESTADO
// ==========================================================
function actualizarEstado(texto, conectado = true) {
  const status = document.getElementById("status");

  if (!status) return;

  status.textContent = texto;

  if (conectado) {
    status.style.color = "#00ff99";
  } else {
    status.style.color = "#ff5555";
  }
}

// ==========================================================
// ACTUALIZAR ELEMENTO HTML
// ==========================================================
function setValor(id, valor, sufijo = "") {
  const el = document.getElementById(id);
  if (!el) return;

  if (valor === undefined || valor === null || valor === "") {
    el.textContent = "--";
  } else {
    el.textContent = `${valor}${sufijo}`;
  }
}

// ==========================================================
// CONVERTIR ARRAY DE TAGO A OBJETO
// ==========================================================
function convertirDatos(array) {
  const datos = {};

  array.forEach(item => {
    if (item.variable === "location") {
      // Puede venir como:
      // item.location = {lat, lng}
      // o item.value = {lat, lng}
      if (item.location) {
        datos.location = item.location;
      } else if (item.value && typeof item.value === "object") {
        datos.location = item.value;
      }
    } else {
      datos[item.variable] = item.value;
    }
  });

  return datos;
}

// ==========================================================
// ACTUALIZAR MAPA
// ==========================================================
function actualizarMapa(location) {
  if (!location) return;

  const lat = parseFloat(location.lat);
  const lng = parseFloat(location.lng);

  if (isNaN(lat) || isNaN(lng)) return;

  marker.setLatLng([lat, lng]);

  map.setView([lat, lng], 17);

  marker.bindPopup(`
    <b>Ubicación GPS</b><br>
    Latitud: ${lat.toFixed(6)}<br>
    Longitud: ${lng.toFixed(6)}
  `);
}

// ==========================================================
// CARGAR DATOS DESDE CLOUDLFARE WORKER
// ==========================================================
async function cargarDatos() {
  try {
    actualizarEstado("Conectando con TagoIO...", true);

    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const raw = await response.json();

    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("No se recibieron datos");
    }

    console.log("Datos recibidos:", raw);

    const datos = convertirDatos(raw);

    // ------------------------------------------------------
    // Actualizar tarjetas
    // ------------------------------------------------------
    setValor("temperatura", Number(datos.temperatura).toFixed(1), " °C");
    setValor("humedad", Number(datos.humedad).toFixed(1), " %");
    setValor("presion", Number(datos.presion).toFixed(1), " hPa");
    setValor("gas", Number(datos.gas_resist).toFixed(1), " kΩ");
    setValor("altitudBME", Number(datos.altitud_bme).toFixed(1), " m");

    setValor("altitudGPS", Number(datos.altitud_gps).toFixed(1), " m");
    setValor("velocidad", Number(datos.velocidad).toFixed(2), " km/h");
    setValor("satelites", datos.satelites);
    setValor("hdop", Number(datos.hdop).toFixed(2));
    setValor("hora", datos.hora_ecuador);

    // Latitud y longitud
    if (datos.location) {
      const lat = Number(datos.location.lat);
      const lng = Number(datos.location.lng);

      setValor("latitud", lat.toFixed(6));
      setValor("longitud", lng.toFixed(6));

      actualizarMapa(datos.location);
    }

    actualizarEstado("Conectado a TagoIO", true);
  } catch (error) {
    console.error("Error:", error);
    actualizarEstado("Error de conexión con TagoIO", false);
  }
}

// ==========================================================
// INICIALIZACIÓN
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  inicializarMapa();
  cargarDatos();
  setInterval(cargarDatos, UPDATE_INTERVAL);
});
