
// ==========================================================
// DASHBOARD IoT - script.js
// Compatible con Cloudflare Worker + TagoIO
// No requiere cambios en tu CSS ni en tu diseño actual.
// ==========================================================

const API_URL = "https://tago-worker.paulmartinez1991.workers.dev/";
const UPDATE_INTERVAL = 5000;

let map = null;
let marker = null;

function inicializarMapa() {
  const mapElement = document.getElementById("map");
  if (!mapElement || typeof L === "undefined") return;

  map = L.map("map").setView([-2.90055, -79.00453], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([-2.90055, -79.00453]).addTo(map);
  marker.bindPopup("Esperando datos del GPS...");

  setTimeout(() => map.invalidateSize(), 500);
}

function actualizarEstado(texto, conectado = true) {
  const status = document.getElementById("status");
  if (!status) return;

  status.textContent = texto;
  status.style.color = conectado ? "#00ff99" : "#ff5555";
}

function esNumeroValido(valor) {
  return valor !== undefined &&
         valor !== null &&
         valor !== "" &&
         !isNaN(Number(valor));
}

function formatearNumero(valor, decimales = 1) {
  if (!esNumeroValido(valor)) return null;
  return Number(valor).toFixed(decimales);
}

function setValor(id, valor, sufijo = "") {
  const el = document.getElementById(id);
  if (!el) return;

  if (valor === undefined || valor === null || valor === "" || valor === "NaN") {
    el.textContent = "--";
  } else {
    el.textContent = `${valor}${sufijo}`;
  }
}

function convertirDatos(array) {
  const datos = {};

  if (!Array.isArray(array)) return datos;

  array.forEach((item) => {
    if (!item || !item.variable) return;

    if (item.variable === "location") {
      if (item.location && esNumeroValido(item.location.lat) && esNumeroValido(item.location.lng)) {
        datos.location = {
          lat: Number(item.location.lat),
          lng: Number(item.location.lng)
        };
      } else if (
        item.value &&
        typeof item.value === "object" &&
        esNumeroValido(item.value.lat) &&
        esNumeroValido(item.value.lng)
      ) {
        datos.location = {
          lat: Number(item.value.lat),
          lng: Number(item.value.lng)
        };
      }
      return;
    }

    datos[item.variable] = item.value;
  });

  return datos;
}

function actualizarMapa(lat, lng) {
  if (!map || !marker) return;
  if (!esNumeroValido(lat) || !esNumeroValido(lng)) return;

  lat = Number(lat);
  lng = Number(lng);

  marker.setLatLng([lat, lng]);
  marker.bindPopup(
    `<b>Ubicación GPS</b><br>Latitud: ${lat.toFixed(6)}<br>Longitud: ${lng.toFixed(6)}`
  );

  map.setView([lat, lng], 17);
  setTimeout(() => map.invalidateSize(), 100);
}

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

    let arrayDatos = [];
    if (Array.isArray(raw)) {
      arrayDatos = raw;
    } else if (raw.result && Array.isArray(raw.result)) {
      arrayDatos = raw.result;
    } else {
      throw new Error("Formato de respuesta no válido");
    }

    const datos = convertirDatos(arrayDatos);
    console.log("Datos procesados:", datos);

    // GPS - Latitud y Longitud
    let lat = null;
    let lng = null;

    if (datos.location && esNumeroValido(datos.location.lat) && esNumeroValido(datos.location.lng)) {
      lat = Number(datos.location.lat);
      lng = Number(datos.location.lng);
    } else if (esNumeroValido(datos.latitud) && esNumeroValido(datos.longitud)) {
      lat = Number(datos.latitud);
      lng = Number(datos.longitud);
    }

    if (lat !== null && lng !== null) {
      setValor("latitud", lat.toFixed(6));
      setValor("longitud", lng.toFixed(6));
      actualizarMapa(lat, lng);
    } else {
      setValor("latitud", "--");
      setValor("longitud", "--");
    }

    // GPS
    setValor("satelites", datos.satelites);
    setValor("hdop", formatearNumero(datos.hdop, 2));
    setValor("altitudGPS", formatearNumero(datos.altitud_gps, 1), " m");
    setValor("velocidad", formatearNumero(datos.velocidad, 2), " km/h");

    // BME680
    setValor("temperatura", formatearNumero(datos.temperatura, 1), " °C");
    setValor("humedad", formatearNumero(datos.humedad, 1), " %");
    setValor("presion", formatearNumero(datos.presion, 1), " hPa");
    setValor("gas", formatearNumero(datos.gas_resist, 1), " kΩ");
    setValor("altitudBME", formatearNumero(datos.altitud_bme, 1), " m");

    // Hora
    setValor("hora", datos.hora_ecuador);

    actualizarEstado("Conectado a TagoIO", true);

    const subtitle = document.querySelector(".subtitle");
    if (subtitle) {
      subtitle.textContent =
        "ESP32 + GPS NEO-6M + BME680 + TagoIO | Última actualización: " +
        new Date().toLocaleTimeString(); 
    }
  } catch (error) {
    console.error("Error:", error);
    actualizarEstado("Error de conexión con TagoIO", false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarMapa();
  cargarDatos();
  setInterval(cargarDatos, UPDATE_INTERVAL);

  window.addEventListener("resize", () => {
    if (map) map.invalidateSize();
  });
});
