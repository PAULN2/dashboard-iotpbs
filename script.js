const API_URL = "https://tago-worker.paulmartinez1991.workers.dev/";

    const datos = convertirDatos(arrayDatos);
    console.log("Datos procesados:", datos);

    // ======================================================
    // LATITUD Y LONGITUD
    // ======================================================
    let lat = null;
    let lng = null;

    // Prioridad 1: location
    if (
      datos.location &&
      esNumeroValido(datos.location.lat) &&
      esNumeroValido(datos.location.lng)
    ) {
      lat = Number(datos.location.lat);
      lng = Number(datos.location.lng);
    }

    // Prioridad 2: variables individuales
    if (
      lat === null &&
      esNumeroValido(datos.latitud) &&
      esNumeroValido(datos.longitud)
    ) {
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

    // ======================================================
    // GPS
    // ======================================================
    setValor("satelites", datos.satelites ?? "--");
    setValor("hdop", formatearNumero(datos.hdop, 2));
    setValor("altitudGPS", formatearNumero(datos.altitud_gps, 1), " m");
    setValor("velocidad", formatearNumero(datos.velocidad, 2), " km/h");

    // ======================================================
    // BME680
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
// INICIO
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  inicializarMapa();
  cargarDatos();
  setInterval(cargarDatos, UPDATE_INTERVAL);

  window.addEventListener("resize", () => {
    if (map) map.invalidateSize();
  });
});
