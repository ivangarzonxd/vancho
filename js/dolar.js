// Cajon "Otros": muestra el cambio de EUR a COP (para saber cuanto valen
// tus euros en pesos colombianos) y la hora actual en Colombia.

// Hora actual en Colombia, formateada como "HH:MM".
function horaColombiaTexto() {
  return new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
}

// Pide el cambio de divisa y pinta el cajon con el valor del euro en pesos
// colombianos y la hora de Colombia (que ademas se refresca sola cada minuto).
async function cargarOtros() {
  let valorCambio = "No disponible"; // valor por defecto si falla la peticion

  try {
    // API gratuita y sin key, ya trae el peso colombiano (COP) entre sus tasas.
    const resp = await fetch("https://open.er-api.com/v6/latest/EUR");
    const datos = await resp.json();
    const tasa = datos.rates.COP;
    // Formatea el numero con separador de miles al estilo colombiano.
    valorCambio = `${tasa.toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP`;
  } catch (e) {
    // si falla la peticion, se deja el texto "No disponible" de arriba
  }

  // Pinta el cajon con los dos datos: cambio de euro y hora de Colombia.
  document.getElementById("dolar").innerHTML = `
    <h2>Otros</h2>
    <div class="otros-contenido">
      <div class="otros-item">
        <span class="otros-etiqueta etiqueta-secundaria">1 EUR</span>
        <span class="otros-valor">${valorCambio}</span>
      </div>
      <div class="otros-item">
        <span class="otros-etiqueta etiqueta-secundaria">Hora Colombia</span>
        <span class="otros-valor" id="otros-hora">${horaColombiaTexto()}</span>
      </div>
    </div>
  `;

  // Refresca solo el texto de la hora de Colombia cada 60 segundos, sin
  // volver a pedir el cambio de divisa (para no gastar peticiones de mas).
  setInterval(() => {
    const el = document.getElementById("otros-hora");
    if (el) el.textContent = horaColombiaTexto();
  }, 60000);
}

cargarOtros();
