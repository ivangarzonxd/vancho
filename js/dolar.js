function horaColombiaTexto() {
  return new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
}

async function cargarOtros() {
  let valorCambio = "No disponible";
  try {
    const resp = await fetch("https://open.er-api.com/v6/latest/EUR");
    const datos = await resp.json();
    const tasa = datos.rates.COP;
    valorCambio = `${tasa.toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP`;
  } catch (e) {
    // se deja "No disponible"
  }

  document.getElementById("dolar").innerHTML = `
    <h2>Otros</h2>
    <div class="otros-contenido">
      <div class="otros-item">
        <span class="otros-etiqueta">1 EUR</span>
        <span class="otros-valor">${valorCambio}</span>
      </div>
      <div class="otros-item">
        <span class="otros-etiqueta">Hora Colombia</span>
        <span class="otros-valor" id="otros-hora">${horaColombiaTexto()}</span>
      </div>
    </div>
  `;

  setInterval(() => {
    const el = document.getElementById("otros-hora");
    if (el) el.textContent = horaColombiaTexto();
  }, 60000);
}

cargarOtros();
