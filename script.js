// ==========================================================
// DASHBOARD IoT - script.js (VERSIÓN CORREGIDA)
// Compatible con Cloudflare Worker + TagoIO
// ==========================================================

const API_URL = "https://tago-worker.paulmartinez1991.workers.dev/";
const UPDATE_INTERVAL = 5000;

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
// VALIDAR NÚMERO
// ==========================================================
function esNumeroValido(valor) {
  return valor !== undefined &&
         valor !== null &&
         valor !== "" &&
         !isNaN(Number(valor));
}

// ==========================================================
// ASIGNAR VALOR A TARJETA
// ==========================================================
function setValor(id, valor, sufijo = "") {
  const el = document.getElementById(id);
  if (!el) return;

  if (valor === undefined || valor === null || valor === "" || valor === "NaN") {
    el.textContent = "--";
    return;
  }

  el.textContent = `${valor}${sufijo}`;
}

// ==========================================================
// FORMATEAR NÚMERO
// ==========================================================
function formatearNumero(valor, decimales = 1) {
  if (!esNumeroValido(valor)) return null;
  return Number(valor).toFixed(decimales);
}

// ==========================================================
// CONVERTIR RESPUESTA DE TAGO A OBJETO
// ==========================================================
function convertirDatos(array) {
  const datos = {};

  if (!Array.isArray(array)) {
    console.error("La respuesta no es un arreglo:", array);
    return datos;
  }

  array.forEach(item => {
    if (!item || !item.variable) return;

    // ------------------------------------------------------
    // LOCATION
    // Puede venir en:
    // item.location = {lat, lng}
    // item.value = {lat, lng}
    // item.value = "[object Object]" (inválido)
    // ------------------------------------------------------
    if (item.variable === "location") {
      if (item.location &&
          item.location.lat !== undefined &&
          item.location.lng !== undefined) {
        datos.location = item.location;
      }
      else if (item.value &&
               typeof item.value === "object" &&
               item.value.lat !== undefined &&
               item.value.lng !== undefined) {
        datos.location = item.value;
      }
      return;
    }

    // Guardar variables normales
    datos[item.variable] = item.value;
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

  // Forzar redibujado del mapa
  setTimeout(() => {
    map.invalidateSize();
  }, 200);
}

// ==========================================================
// CARGAR DATOS DESDE EL WORKER
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

    console.log("Respuesta del Worker:", raw);

    // El Worker puede devolver:
    // 1. Un array directamente
    // 2. { status: true, result: [...] }
    let arrayDatos = [];

    if (Array.isArray(raw)) {
      arrayDatos = raw;
    } else if (raw.result && Array.isArray(raw.result)) {
      arrayDatos = raw.result;
    } else {
      throw new Error("Formato de respuesta no válido");
    }

    if (arrayDatos.length === 0) {
      throw new Error("No se recibieron datos");
    }

    const datos = convertirDatos(arrayDatos);

    console.log("Datos procesados:", datos);

    // ======================================================
    // LATITUD Y LONGITUD
    // ======================================================
    let lat = null;
    let lng = null;

    // Prioridad 1: variable location
    if (datos.location &&
        esNumeroValido(datos.location.lat) &&
        esNumeroValido(datos.location.lng)) {
      lat = Number(datos.location.lat);
      lng = Number(datos.location.lng);
    }
    // Prioridad 2: variables individuales
    else if (esNumeroValido(datos.latitud) &&
             esNumeroValido(datos.longitud)) {
      lat = Number(datos.latitud);
      lng = Number(datos.longitud);
    }

    if (lat !== null && lng !== null) {
      setValor("latitud", lat.toFixed(6));
      setValor("longitud", lng.toFixed(6));

      actualizarMapa({
        lat: lat,
        lng: lng
      });
    } else {
      setValor("latitud", "--");
      setValor("longitud", "--");
    }

    // ======================================================
    // VARIABLES GPS
    // ======================================================
    setValor("satelites", datos.satelites ?? "--");
    setValor("hdop", formatearNumero(datos.hdop, 2));
    setValor("altitudGPS", formatearNumero(datos.altitud_gps, 1), " m");
    setValor("velocidad", formatearNumero(datos.velocidad, 2), " km/h");

    // ======================================================
    // VARIABLES BME680
    // ======================================================
    setValor("temperatura", formatearNumero(datos.temperatura, 1), " °C");
    setValor("humedad", formatearNumero(datos.humedad, 1), " %");
    setValor("presion", formatearNumero(datos.presion, 1), " hPa");
    setValor("gas", formatearNumero(datos.gas_resist, 1), " kΩ");
    setValor("altitudBME", formatearNumero(datos.altitud_bme, 1), " m");

    // ======================================================
    // HORA
    // ======================================================
    setValor("hora", datos.hora_ecuador || "--");

    // ======================================================
    // ESTADO
    // ======================================================
    actualizarEstado("Conectado a TagoIO", true);

    const subtitle = document.querySelector(".subtitle");
    if (subtitle) {
      subtitle.textContent =
        "Última actualización: " + new Date().toLocaleTimeString();
    }

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

  // Primera carga
  cargarDatos();

  // Actualización periódica
  setInterval(cargarDatos, UPDATE_INTERVAL);

  // Asegurar render correcto del mapa
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 500);
});
