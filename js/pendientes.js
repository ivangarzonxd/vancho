// Cajon "Pendientes": arriba tu lista de pendientes sin fecha fija (lee y
// escribe en una Google Sheet a traves de un Apps Script propio, ver
// apps-script-tareas.gs - permite agregar, borrar y reordenar arrastrando,
// funciona con mouse y con touch via SortableJS). Abajo, el cambio EUR->COP
// y la hora de Colombia (misma fuente que antes vivia en el cajon "Otros").

// URL del Apps Script desplegado como "Aplicacion web" (ver apps-script-tareas.gs).
// El backend sigue llamando "tareas" a los datos por dentro (la Sheet, el
// token, la clave del JSON); solo cambio el nombre de cara a la pantalla.
const PENDIENTES_API_URL = "https://script.google.com/macros/s/AKfycbwlxLX_AxE7wTd47iBOog97jm1oIsPseJ9BO0UdonlaUmaJl7qBx5fCX8IFyeLamXwK/exec";
// Palabra clave que el Apps Script exige en cada peticion; sin ella, responde con error.
const PENDIENTES_TOKEN = "70ee87b6f7e009c97b41c05b782c84aa";

// Copia en memoria de los pendientes actuales (se recarga desde el servidor al inicio).
let pendientesActuales = [];
// Instancia de SortableJS que maneja el arrastrar-y-soltar; se guarda para poder destruirla y recrearla.
let pendientesSortable = null;

// Dibuja el esqueleto del cajon UNA sola vez: titulo + dos huecos que se
// llenan por separado mas abajo (lista de pendientes arriba, divisa/hora
// abajo), para que cargarPendientes() y cargarDivisaHora() no se pisen
// entre si al escribir cada uno su propio innerHTML.
document.getElementById("pendientes").innerHTML = `
  <h2>Pendientes</h2>
  <div id="pendientes-lista-wrap"></div>
  <div id="pendientes-otros-wrap"></div>
`;

// Escapa el texto de un pendiente antes de insertarlo como HTML, para evitar
// que un texto con "<" o ">" rompa el maquetado o inyecte HTML/JS.
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto; // el navegador escapa automaticamente al leer/escribir textContent
  return div.innerHTML;
}

// Pide la lista de pendientes al Apps Script y, si sale bien, la pinta.
async function cargarPendientes() {
  document.getElementById("pendientes-lista-wrap").innerHTML = `<p class="pendiente-estado">Cargando...</p>`;
  try {
    const respuesta = await fetch(`${PENDIENTES_API_URL}?token=${PENDIENTES_TOKEN}`);
    const datos = await respuesta.json();
    if (datos.error) throw new Error(datos.error); // token invalido u otro error del script
    pendientesActuales = datos.tareas || []; // el backend sigue devolviendo la clave "tareas"
    renderizarPendientes();
  } catch (error) {
    // fallo la conexion (red, script caido, token mal puesto, etc.)
    document.getElementById("pendientes-lista-wrap").innerHTML = `<p class="pendiente-estado">No se pudo conectar</p>`;
  }
}

// Dibuja el input para agregar + la lista de pendientes, dentro de su
// propio hueco (#pendientes-lista-wrap), y conecta los botones/eventos.
function renderizarPendientes() {
  // Una tarjeta <li> por pendiente: manija de arrastre, texto y boton de borrar.
  const filas = pendientesActuales.map(p => `
    <li class="pendiente-item" data-id="${p.id}">
      <span class="pendiente-agarre">⠿</span>
      <span class="pendiente-texto">${escaparHtml(p.texto)}</span>
      <button class="pendiente-borrar" data-id="${p.id}" title="Borrar" aria-label="Borrar pendiente">×</button>
    </li>
  `).join("");

  // La lista va PRIMERO y el campo de agregar AL FINAL (pegado a la linea que separa
  // esta seccion de la de divisa/hora, ver #pendientes-agregar en pendientes.css).
  document.getElementById("pendientes-lista-wrap").innerHTML = `
    <ul class="lista-pendientes" id="lista-pendientes">
      ${filas || '<li class="pendiente-vacia">Sin pendientes</li>'}
    </ul>
    <div class="pendientes-agregar">
      <input type="text" id="pendiente-input" maxlength="120" />
      <button id="pendiente-agregar-btn" aria-label="Agregar pendiente">+</button>
    </div>
  `;

  // Como el innerHTML se reemplazo entero, hay que volver a enganchar los eventos cada vez.
  const boton = document.getElementById("pendiente-agregar-btn");
  const input = document.getElementById("pendiente-input");
  boton.addEventListener("click", agregarPendiente);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") agregarPendiente(); // Enter en el input tambien agrega el pendiente
  });

  // Un boton de borrar por cada pendiente ya pintado.
  document.querySelectorAll(".pendiente-borrar").forEach(btn => {
    btn.addEventListener("click", () => borrarPendiente(btn.dataset.id));
  });

  activarArrastre();
}

// Activa (o reactiva) el arrastrar-y-soltar sobre la lista de pendientes actual.
function activarArrastre() {
  const lista = document.getElementById("lista-pendientes");
  if (!lista || pendientesActuales.length === 0) return; // sin pendientes no hay nada que arrastrar
  if (pendientesSortable) pendientesSortable.destroy(); // evita duplicar instancias en cada render
  pendientesSortable = new Sortable(lista, {
    animation: 150, // milisegundos de animacion al soltar
    handle: ".pendiente-agarre", // solo se puede arrastrar tomando el icono ⠿, no toda la tarjeta
    ghostClass: "pendiente-fantasma", // clase css del hueco que queda mientras se arrastra
    onEnd: guardarOrden, // al soltar, guarda el nuevo orden en la Sheet
  });
}

// Agrega un pendiente nuevo: lo manda al Apps Script y recarga la lista completa.
async function agregarPendiente() {
  const input = document.getElementById("pendiente-input");
  const texto = input.value.trim();
  if (!texto) return; // no manda pendientes vacios
  input.value = "";
  input.disabled = true; // evita doble clic mientras se guarda
  try {
    await fetch(PENDIENTES_API_URL, {
      method: "POST",
      // text/plain evita que el navegador dispare una peticion de preflight (OPTIONS)
      // que Apps Script no maneja bien; el script igual lo interpreta como JSON.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: PENDIENTES_TOKEN, action: "add", texto }),
    });
  } catch (error) {
    // si falla la peticion, cargarPendientes() de abajo igual va a traer el estado real del servidor
  }
  await cargarPendientes(); // vuelve a pedir la lista completa (incluye el id que genero el servidor)
}

// Borra un pendiente: lo quita de la vista al instante (optimista) y avisa al Apps Script.
async function borrarPendiente(id) {
  pendientesActuales = pendientesActuales.filter(p => p.id !== id); // lo quita en memoria
  renderizarPendientes(); // repinta ya, sin esperar la respuesta del servidor
  try {
    await fetch(PENDIENTES_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: PENDIENTES_TOKEN, action: "delete", id }),
    });
  } catch (error) {
    // si falla, la proxima carga lo vuelve a traer
  }
}

// Se llama cuando terminas de arrastrar un pendiente: lee el orden actual en
// pantalla y lo manda al Apps Script para que quede guardado en la Sheet.
async function guardarOrden() {
  const lista = document.getElementById("lista-pendientes");
  // Lee el orden real de los <li> en el DOM (ya reordenados por SortableJS).
  const orden = [...lista.querySelectorAll(".pendiente-item")].map(el => el.dataset.id);
  // Reordena tambien la copia en memoria, para que coincida con lo que se ve.
  pendientesActuales.sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id));
  try {
    await fetch(PENDIENTES_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: PENDIENTES_TOKEN, action: "reorder", orden }),
    });
  } catch (error) {
    // si falla, la proxima carga trae el orden real del servidor
  }
}

// Hora actual en Colombia, formateada como "HH:MM".
function horaColombiaTexto() {
  return new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
}

// Pide el cambio de divisa y pinta la parte de abajo del cajon con el valor
// del euro en pesos colombianos y la hora de Colombia (que se refresca sola
// cada minuto). Vive en su propio hueco (#pendientes-otros-wrap), separado
// de la lista de pendientes de arriba.
async function cargarDivisaHora() {
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

  // Cada dato en una sola linea corta: "1 EUR = 3.637,35 COP" y "05:49 p. m. Colombia".
  document.getElementById("pendientes-otros-wrap").innerHTML = `
    <div class="otros-contenido">
      <div class="otros-item">1 EUR = ${valorCambio}</div>
      <div class="otros-item"><span id="otros-hora">${horaColombiaTexto()}</span> Colombia</div>
    </div>
  `;

  // Refresca solo el texto de la hora de Colombia cada 60 segundos, sin
  // volver a pedir el cambio de divisa (para no gastar peticiones de mas).
  setInterval(() => {
    const el = document.getElementById("otros-hora");
    if (el) el.textContent = horaColombiaTexto();
  }, 60000);
}

cargarPendientes();
cargarDivisaHora();
