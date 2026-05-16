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
  map = L.map("map").setView([-2.90055, -79.00453], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([-2.90055, -79.00453]).addTo(map);
  marker.bindPopup("Esperando datos del GPS...");
}

// ==========================================================
// ACTUALIZAR ESTADO
// ==========================================================
function actualizarEstado(texto, conectado = true) {
  const status = document.getElementById("status");
  if (!status) return;

  status.textContent = texto;
  status.style.color = conectado ? "#00ff99" : "#ff5555";
}

// ==========================================================
// FORMATEAR NÚMERO
// ==========================================================
function formatNumber(valor, decimales = 1) {
  const num = Number(valor);

  if (valor === undefined || valor === null || valor === "") {
    return "--";
  }

  if (isNaN(num)) {
    return "--";
  }

  return num.toFixed(decimales);
}

// ==========================================================
// ACTUALIZAR ELEMENTO HTML
// ==========================================================
function setValor(id, valor, sufijo = "") {
  const el = document.getElementById(id);
  if (!el) return;

  if (
    valor === undefined ||
    valor === null ||
    valor === "" ||
    valor === "NaN" ||
    valor === "--"
  ) {
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

  if (!Array.isArray(array)) return datos;

  array.forEach(item => {
    if (!item || !item.variable) return;

    // ---------------- LOCATION ----------------
    if (item.variable === "location") {
      let loc = null;

      // Formato 1: { value: { lat, lng } }
      if (item.value && typeof item.value === "object") {
        if (
          item.value.lat !== undefined &&
          item.value.lng !== undefined
        ) {
          loc = {
            lat: item.value.lat,
            lng: item.value.lng
          };
        }
      }

      // Formato 2: { location: { lat, lng } }
      if (!loc && item.location) {
        if (
          item.location.lat !== undefined &&
          item.location.lng !== undefined
        ) {
          loc = {
            lat: item.location.lat,
            lng: item.location.lng
          };
        }
      }

      // Formato 3: GeoJSON coordinates [lng, lat]
      if (
        !loc &&
        item.location &&
        item.location.coordinates &&
        Array.isArray(item.location.coordinates)
      ) {
        loc = {
          lat: item.location.coordinates[1],
          lng: item.location.coordinates[0]
        };
      }

      if (loc) {
        datos.location = loc;
      }
    }

    // ---------------- OTRAS VARIABLES ----------------
    else {
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
// CARGAR DATOS
// ==========================================================
async function cargarDatos() {
  try {
    actualizarEstado("Conectando con TagoIO...", true);

    const response = await fetch(API_URL, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const raw = await response.json();

    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("No se recibieron datos");
    }

    console.log("Datos recibidos:", raw);

    const datos = convertirDatos(raw);

    console.log("Datos procesados:", datos);

    // ======================================================
    // BME680
    // ======================================================
    setValor("temperatura", formatNumber(datos.temperatura, 1), " °C");
    setValor("humedad", formatNumber(datos.humedad, 1), " %");
    setValor("presion", formatNumber(datos.presion, 1), " hPa");
    setValor("gas", formatNumber(datos.gas_resist, 1), " kΩ");
    setValor("altitudBME", formatNumber(datos.altitud_bme, 1), " m");

    // ======================================================
    // GPS
    // ======================================================
    setValor("altitudGPS", formatNumber(datos.altitud_gps, 1), " m");
    setValor("velocidad", formatNumber(datos.velocidad, 2), " km/h");
    setValor("satelites", formatNumber(datos.satelites, 0));
    setValor("hdop", formatNumber(datos.hdop, 2));

    // ======================================================
    // FECHA Y HORA
    // ======================================================
    setValor("hora", datos.hora_ecuador);

    // ======================================================
    // LATITUD Y LONGITUD
    // ======================================================
    if (datos.location) {
      const lat = parseFloat(datos.location.lat);
      const lng = parseFloat(datos.location.lng);

      if (!isNaN(lat) && !isNaN(lng)) {
        setValor("latitud", lat.toFixed(6));
        setValor("longitud", lng.toFixed(6));

        actualizarMapa({
          lat: lat,
          lng: lng
        });
      }
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
