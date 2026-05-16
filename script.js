// ==========================================================
// DASHBOARD IoT - script.js
// Compatible con Cloudflare Worker + TagoIO
// ==========================================================

const API_URL = "https://tago-worker.paulmartinez1991.workers.dev/";
const UPDATE_INTERVAL = 1000;

let map = null;
let marker = null;

// ----------------------------------------------------------
// Inicializar mapa
// ----------------------------------------------------------
function inicializarMapa() {
  const mapElement = document.getElementById("map");

  if (!mapElement) return;
  if (typeof L === "undefined") return;

  // Coordenadas iniciales (Cuenca, Ecuador)
  const latInicial = -2.90055;
  const lngInicial = -79.00453;

  map = L.map("map").setView([latInicial, lngInicial], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([latInicial, lngInicial]).addTo(map);
  marker.bindPopup("Esperando datos del GPS...");

  // Muy importante para que Leaflet calcule el tamaño
  setTimeout(() => {
    map.invalidateSize();
  }, 500);
}

// ----------------------------------------------------------
// Estado de conexión
// ----------------------------------------------------------
function actualizarEstado(texto, conectado = true) {
  const status = document.getElementById("status");
  if (!status) return;

  status.textContent = texto;

  status.classList.remove("ok", "error");
  status.classList.add(conectado ? "ok" : "error");
}

// ----------------------------------------------------------
// Validaciones
// ----------------------------------------------------------
function esNumeroValido(valor) {
  return (
    valor !== undefined &&
    valor !== null &&
    valor !== "" &&
    !isNaN(Number(valor))
  );
}

function formatearNumero(valor, decimales = 1) {
  if (!esNumeroValido(valor)) return null;
  return Number(valor).toFixed(decimales);
}

// ----------------------------------------------------------
// Mostrar valor en pantalla
// ----------------------------------------------------------
function setValor(id, valor, sufijo = "") {
  const el = document.getElementById(id);
  if (!el) return;

  if (
    valor === undefined ||
    valor === null ||
    valor === "" ||
    valor === "NaN"
  ) {
    el.textContent = "--";
  } else {
    el.textContent = `${valor}${sufijo}`;
  }
}

// ----------------------------------------------------------
// Convertir array TagoIO a objeto
// ----------------------------------------------------------
function convertirDatos(array) {
  const datos = {};

  if (!Array.isArray(array)) return datos;

  array.forEach((item) => {
    if (!item || !item.variable) return;

    // Manejo especial de "location"
    if (item.variable === "location") {
      // Formato TagoIO:
      // location.coordinates = [lng, lat]
      if (
        item.location &&
        Array.isArray(item.location.coordinates) &&
        item.location.coordinates.length >= 2
      ) {
        const lng = item.location.coordinates[0];
        const lat = item.location.coordinates[1];

        if (esNumeroValido(lat) && esNumeroValido(lng)) {
          datos.location = {
            lat: Number(lat),
            lng: Number(lng)
          };
        }
      }

      return;
    }

    // Variables normales
    datos[item.variable] = item.value;
  });

  return datos;
}

// ----------------------------------------------------------
// Actualizar mapa
// ----------------------------------------------------------
function actualizarMapa(lat, lng) {
  if (!map || !marker) return;
  if (!esNumeroValido(lat) || !esNumeroValido(lng)) return;

  lat = Number(lat);
  lng = Number(lng);

  marker.setLatLng([lat, lng]);

  marker.bindPopup(`
    <b>Ubicación GPS</b><br>
    Latitud: ${lat.toFixed(6)}<br>
    Longitud: ${lng.toFixed(6)}
  `);

  map.setView([lat, lng], 17);

  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

// ----------------------------------------------------------
// Cargar datos desde Worker
// ----------------------------------------------------------
async function cargarDatos() {
  try {
    // ------------------------------------------------------
    // Estado inicial
    // ------------------------------------------------------
    actualizarEstado("Conectando con TagoIO...", true);

    // ------------------------------------------------------
    // Obtener datos del Worker
    // ------------------------------------------------------
    const response = await fetch(API_URL, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const raw = await response.json();

    // ------------------------------------------------------
    // Detectar formato de respuesta
    // ------------------------------------------------------
    let arrayDatos = [];

    if (Array.isArray(raw)) {
      arrayDatos = raw;
    } else if (raw && Array.isArray(raw.result)) {
      arrayDatos = raw.result;
    } else {
      console.error("Respuesta recibida:", raw);
      throw new Error("Formato de respuesta no válido");
    }

    // ------------------------------------------------------
    // Convertir array en objeto { variable: valor }
    // ------------------------------------------------------
    const datos = convertirDatos(arrayDatos);

    console.log("Datos procesados:", datos);

    // ======================================================
    // UBICACIÓN GPS
    // ======================================================
    let lat = null;
    let lng = null;

    // Prioridad 1: location procesado por convertirDatos()
    if (
      datos.location &&
      esNumeroValido(datos.location.lat) &&
      esNumeroValido(datos.location.lng)
    ) {
      lat = Number(datos.location.lat);
      lng = Number(datos.location.lng);
    }
    // Prioridad 2: variables latitud y longitud
    else if (
      esNumeroValido(datos.latitud) &&
      esNumeroValido(datos.longitud)
    ) {
      lat = Number(datos.latitud);
      lng = Number(datos.longitud);
    }

    // Mostrar coordenadas
    if (lat !== null && lng !== null) {
      setValor("latitud", lat.toFixed(6));
      setValor("longitud", lng.toFixed(6));
      actualizarMapa(lat, lng);
    } else {
      setValor("latitud", "--");
      setValor("longitud", "--");
      console.warn("No se pudieron obtener coordenadas válidas.");
    }

    // ======================================================
    // DATOS GPS
    // ======================================================
    setValor(
      "satelites",
      esNumeroValido(datos.satelites)
        ? Number(datos.satelites)
        : "--"
    );

    setValor(
      "hdop",
      formatearNumero(datos.hdop, 2)
    );

    setValor(
      "altitud_gps",
      formatearNumero(datos.altitud_gps, 1),
      " m"
    );

    setValor(
      "velocidad",
      formatearNumero(datos.velocidad, 2),
      " km/h"
    );

    // ======================================================
    // DATOS BME680
    // ======================================================
    setValor(
      "temperatura",
      formatearNumero(datos.temperatura, 1),
      " °C"
    );

    setValor(
      "humedad",
      formatearNumero(datos.humedad, 1),
      " %"
    );

    setValor(
      "presion",
      formatearNumero(datos.presion, 1),
      " hPa"
    );

    setValor(
      "gas_resist",
      formatearNumero(datos.gas_resist, 2),
      " kΩ"
    );

    setValor(
      "altitud_bme",
      formatearNumero(datos.altitud_bme, 1),
      " m"
    );

    // ======================================================
    // HORA ECUADOR
    // ======================================================
    setValor(
      "hora_ecuador",
      datos.hora_ecuador || "--"
    );

    // ======================================================
    // ÚLTIMA ACTUALIZACIÓN
    // ======================================================
    const lastUpdate = document.getElementById("last-update");
    if (lastUpdate) {
      if (datos.hora_ecuador) {
        lastUpdate.textContent =
          "Última actualización: " + datos.hora_ecuador;
      } else {
        lastUpdate.textContent =
          "Última actualización: " +
          new Date().toLocaleTimeString("es-EC");
      }
    }

    // ======================================================
    // Estado OK
    // ======================================================
    actualizarEstado("Conectado a TagoIO", true);

  } catch (error) {
    // ======================================================
    // Error
    // ======================================================
    console.error("Error en cargarDatos():", error);

    actualizarEstado("Error de conexión con TagoIO", false);

    const lastUpdate = document.getElementById("last-update");
    if (lastUpdate) {
      lastUpdate.textContent = "No se pudieron cargar los datos.";
    }
  }
}

    // ------------------------------------------------------
    // GPS
    // ------------------------------------------------------
    setValor("satelites", datos.satelites);
    setValor("hdop", formatearNumero(datos.hdop, 2));
    setValor("altitud_gps", formatearNumero(datos.altitud_gps, 1), " m");
    setValor("velocidad", formatearNumero(datos.velocidad, 2), " km/h");

    // ------------------------------------------------------
    // BME680
    // ------------------------------------------------------
    setValor("temperatura", formatearNumero(datos.temperatura, 1), " °C");
    setValor("humedad", formatearNumero(datos.humedad, 1), " %");
    setValor("presion", formatearNumero(datos.presion, 1), " hPa");
    setValor("gas_resist", formatearNumero(datos.gas_resist, 2), " kΩ");
    setValor("altitud_bme", formatearNumero(datos.altitud_bme, 1), " m");

    // ------------------------------------------------------
    // Hora Ecuador
    // ------------------------------------------------------
    setValor("hora_ecuador", datos.hora_ecuador);

    // ------------------------------------------------------
    // Última actualización
    // ------------------------------------------------------
    const lastUpdate = document.getElementById("last-update");
    if (lastUpdate) {
      lastUpdate.textContent =
        "Última actualización: " +
        new Date().toLocaleTimeString("es-EC");
    }

    actualizarEstado("Conectado a TagoIO", true);
  } catch (error) {
    console.error("Error:", error);
    actualizarEstado("Error de conexión con TagoIO", false);
  }
}

// ----------------------------------------------------------
// Inicio
// ----------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  inicializarMapa();
  cargarDatos();

  // Actualizar cada 5 segundos
  setInterval(cargarDatos, UPDATE_INTERVAL);

  // Recalcular tamaño del mapa al cambiar tamaño de ventana
  window.addEventListener("resize", () => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  });
});
