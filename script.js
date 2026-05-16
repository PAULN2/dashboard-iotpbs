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

  if (!el) {
    console.warn(`No existe el elemento con id="${id}"`);
    return;
  }

  if (
    valor === undefined ||
    valor === null ||
    valor === "" ||
    valor === "NaN" ||
    (typeof valor === "number" && isNaN(valor))
  ) {
    el.textContent = "--";
    return;
  }

  el.textContent = `${valor}${sufijo}`;
}

// ----------------------------------------------------------
// Convertir array TagoIO a objeto
// ----------------------------------------------------------
function convertirDatos(array) {
  const datos = {};

  if (!Array.isArray(array)) return datos;

  for (const item of array) {
    if (!item || !item.variable) continue;

    // ==========================================
    // LOCATION (TagoIO)
    // coordinates = [longitud, latitud]
    // ==========================================
    if (item.variable === "location") {
      if (
        item.location &&
        Array.isArray(item.location.coordinates) &&
        item.location.coordinates.length >= 2
      ) {
        const lng = Number(item.location.coordinates[0]);
        const lat = Number(item.location.coordinates[1]);

        if (!isNaN(lat) && !isNaN(lng)) {
          datos.location = {
            lat: lat,
            lng: lng
          };
        }
      }

      continue;
    }

    // ==========================================
    // Variables normales
    // ==========================================
    datos[item.variable] = item.value;
  }

  console.log("Datos convertidos:", datos);

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
// Reemplaza TODA tu función cargarDatos() por esta versión

async function cargarDatos() {
  try {
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
    // Normalizar respuesta
    // ------------------------------------------------------
    let arrayDatos = [];

    if (Array.isArray(raw)) {
      arrayDatos = raw;
    } else if (raw && Array.isArray(raw.result)) {
      arrayDatos = raw.result;
    } else {
      throw new Error("Formato de respuesta no válido");
    }

    console.log("Datos recibidos:", arrayDatos);

    // ------------------------------------------------------
    // Convertir a objeto { variable: valor }
    // ------------------------------------------------------
    const datos = convertirDatos(arrayDatos);

    console.log("Datos convertidos:", datos);

    // ======================================================
    // OBTENER LATITUD Y LONGITUD DIRECTAMENTE DEL JSON
    // (más robusto que depender solo de convertirDatos)
    // ======================================================
    let lat = null;
    let lng = null;

    // 1) Buscar variable "location"
    const itemLocation = arrayDatos.find(
      (item) => item && item.variable === "location"
    );

    if (
      itemLocation &&
      itemLocation.location &&
      Array.isArray(itemLocation.location.coordinates) &&
      itemLocation.location.coordinates.length >= 2
    ) {
      // coordinates = [longitud, latitud]
      lng = Number(itemLocation.location.coordinates[0]);
      lat = Number(itemLocation.location.coordinates[1]);
    }

    // 2) Si no existe location, usar latitud y longitud individuales
    if (
      (lat === null || isNaN(lat)) &&
      esNumeroValido(datos.latitud)
    ) {
      lat = Number(datos.latitud);
    }

    if (
      (lng === null || isNaN(lng)) &&
      esNumeroValido(datos.longitud)
    ) {
      lng = Number(datos.longitud);
    }

    // 3) Mostrar coordenadas
    if (
      lat !== null &&
      lng !== null &&
      !isNaN(lat) &&
      !isNaN(lng)
    ) {
      setValor("latitud", lat.toFixed(6));
      setValor("longitud", lng.toFixed(6));
      actualizarMapa(lat, lng);
    } else {
      setValor("latitud", "--");
      setValor("longitud", "--");
      console.warn("No se pudieron obtener coordenadas válidas.");
    }

    // ======================================================
    // MOSTRAR TODOS LOS DATOS DIRECTAMENTE
    // ======================================================

    // GPS
    setValor("satelites", datos.satelites);
    setValor("hdop", formatearNumero(datos.hdop, 2));
    setValor("altitud_gps", formatearNumero(datos.altitud_gps, 1), " m");
    setValor("velocidad", formatearNumero(datos.velocidad, 2), " km/h");

    // BME680
    setValor("temperatura", formatearNumero(datos.temperatura, 1), " °C");
    setValor("humedad", formatearNumero(datos.humedad, 1), " %");
    setValor("presion", formatearNumero(datos.presion, 1), " hPa");
    setValor("gas_resist", formatearNumero(datos.gas_resist, 2), " kΩ");
    setValor("altitud_bme", formatearNumero(datos.altitud_bme, 1), " m");

    // Hora Ecuador
    setValor("hora_ecuador", datos.hora_ecuador);

    // ======================================================
    // Última actualización
    // ======================================================
    const lastUpdate = document.getElementById("last-update");
    if (lastUpdate) {
      lastUpdate.textContent =
        "Última actualización: " +
        (datos.hora_ecuador || new Date().toLocaleTimeString("es-EC"));
    }

    // ======================================================
    // Estado OK
    // ======================================================
    actualizarEstado("Conectado a TagoIO", true);

  } catch (error) {
    console.error("Error en cargarDatos():", error);

    actualizarEstado("Error de conexión con TagoIO", false);

    const lastUpdate = document.getElementById("last-update");
    if (lastUpdate) {
      lastUpdate.textContent = "No se pudieron cargar los datos.";
    }
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
