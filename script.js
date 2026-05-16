// =====================================================
// CONFIGURACIÓN
// =====================================================

// PEGA AQUÍ TU PROFILE TOKEN (Read Only)
const TAGO_TOKEN = "fdaffbf5-1a1f-40e1-9ba8-f35faf3139c6";

// URL de la API de TagoIO
const API_URL = "https://tago-worker.paulmartinez1991.workers.dev";

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================
async function cargarDatos() {
  try {
    const status = document.getElementById("status");
    const lastUpdate = document.getElementById("lastUpdate");

    // Mostrar estado
    if (status) {
      status.textContent = "Conectando a TagoIO...";
    }

    // Solicitud a TagoIO
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Authorization": TAGO_TOKEN,
        "Content-Type": "application/json"
      }
    });

    // Verificar respuesta HTTP
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    // Convertir respuesta JSON
    const datos = await response.json();

    // Mostrar en consola
    console.log("Datos recibidos:", datos);

    // Actualizar estado
    if (status) {
      status.textContent = "Conectado correctamente con TagoIO";
    }

    // Mostrar fecha/hora de actualización
    if (lastUpdate) {
      lastUpdate.textContent =
        "Última actualización: " + new Date().toLocaleString();
    }

    // Aquí luego se pueden actualizar tarjetas y mapa

  } catch (error) {
    console.error("Error:", error);

    const status = document.getElementById("status");
    if (status) {
      status.textContent =
        "Error de conexión con TagoIO: " + error.message;
    }
  }
}

// =====================================================
// INICIO AUTOMÁTICO
// =====================================================
window.addEventListener("load", function () {
  // Primera carga
  cargarDatos();

  // Actualizar cada 10 segundos
  setInterval(cargarDatos, 10000);
});
