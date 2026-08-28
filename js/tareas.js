// Cajon de tareas: lee y escribe en una Google Sheet a traves de un Apps
// Script propio (ver apps-script-tareas.gs). Permite agregar, borrar y
// reordenar arrastrando (funciona con mouse y con touch via SortableJS).

// URL del Apps Script desplegado como "Aplicacion web" (ver apps-script-tareas.gs).
const TAREAS_API_URL = "https://script.google.com/macros/s/AKfycbwlxLX_AxE7wTd47iBOog97jm1oIsPseJ9BO0UdonlaUmaJl7qBx5fCX8IFyeLamXwK/exec";
// Palabra clave que el Apps Script exige en cada peticion; sin ella, responde con error.
const TAREAS_TOKEN = "70ee87b6f7e009c97b41c05b782c84aa";

// Copia en memoria de las tareas actuales (se recarga desde el servidor al inicio).
let tareasActuales = [];
// Instancia de SortableJS que maneja el arrastrar-y-soltar; se guarda para poder destruirla y recrearla.
let tareasSortable = null;

// Escapa el texto de una tarea antes de insertarlo como HTML, para evitar
// que un texto con "<" o ">" rompa el maquetado o inyecte HTML/JS.
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto; // el navegador escapa automaticamente al leer/escribir textContent
  return div.innerHTML;
}

// Pide la lista de tareas al Apps Script y, si sale bien, la pinta.
async function cargarTareas() {
  document.getElementById("tareas").innerHTML = `<h2>Tareas</h2><p class="tarea-estado">Cargando...</p>`;
  try {
    const respuesta = await fetch(`${TAREAS_API_URL}?token=${TAREAS_TOKEN}`);
    const datos = await respuesta.json();
    if (datos.error) throw new Error(datos.error); // token invalido u otro error del script
    tareasActuales = datos.tareas || [];
    renderizarTareas();
  } catch (error) {
    // fallo la conexion (red, script caido, token mal puesto, etc.)
    document.getElementById("tareas").innerHTML = `<h2>Tareas</h2><p class="tarea-estado">No se pudo conectar</p>`;
  }
}

// Dibuja el cajon completo (titulo, input para agregar, lista de tareas)
// a partir de lo que haya en tareasActuales, y conecta los botones/eventos.
function renderizarTareas() {
  // Una tarjeta <li> por tarea: manija de arrastre, texto y boton de borrar.
  const filas = tareasActuales.map(t => `
    <li class="tarea-item" data-id="${t.id}">
      <span class="tarea-agarre">⠿</span>
      <span class="tarea-texto">${escaparHtml(t.texto)}</span>
      <button class="tarea-borrar" data-id="${t.id}" title="Borrar" aria-label="Borrar tarea">×</button>
    </li>
  `).join("");

  document.getElementById("tareas").innerHTML = `
    <h2>Tareas</h2>
    <div class="tareas-agregar">
      <input type="text" id="tarea-input" placeholder="Nueva tarea..." maxlength="120" />
      <button id="tarea-agregar-btn" aria-label="Agregar tarea">+</button>
    </div>
    <ul class="lista-tareas" id="lista-tareas">
      ${filas || '<li class="tarea-vacia">Sin tareas pendientes</li>'}
    </ul>
  `;

  // Como el innerHTML se reemplazo entero, hay que volver a enganchar los eventos cada vez.
  const boton = document.getElementById("tarea-agregar-btn");
  const input = document.getElementById("tarea-input");
  boton.addEventListener("click", agregarTarea);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") agregarTarea(); // Enter en el input tambien agrega la tarea
  });

  // Un boton de borrar por cada tarea ya pintada.
  document.querySelectorAll(".tarea-borrar").forEach(btn => {
    btn.addEventListener("click", () => borrarTarea(btn.dataset.id));
  });

  activarArrastre();
}

// Activa (o reactiva) el arrastrar-y-soltar sobre la lista de tareas actual.
function activarArrastre() {
  const lista = document.getElementById("lista-tareas");
  if (!lista || tareasActuales.length === 0) return; // sin tareas no hay nada que arrastrar
  if (tareasSortable) tareasSortable.destroy(); // evita duplicar instancias en cada render
  tareasSortable = new Sortable(lista, {
    animation: 150, // milisegundos de animacion al soltar
    handle: ".tarea-agarre", // solo se puede arrastrar tomando el icono ⠿, no toda la tarjeta
    ghostClass: "tarea-fantasma", // clase css del hueco que queda mientras se arrastra
    onEnd: guardarOrden, // al soltar, guarda el nuevo orden en la Sheet
  });
}

// Agrega una tarea nueva: la manda al Apps Script y recarga la lista completa.
async function agregarTarea() {
  const input = document.getElementById("tarea-input");
  const texto = input.value.trim();
  if (!texto) return; // no manda tareas vacias
  input.value = "";
  input.disabled = true; // evita doble clic mientras se guarda
  try {
    await fetch(TAREAS_API_URL, {
      method: "POST",
      // text/plain evita que el navegador dispare una peticion de preflight (OPTIONS)
      // que Apps Script no maneja bien; el script igual lo interpreta como JSON.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: TAREAS_TOKEN, action: "add", texto }),
    });
  } catch (error) {
    // si falla la peticion, cargarTareas() de abajo igual va a traer el estado real del servidor
  }
  await cargarTareas(); // vuelve a pedir la lista completa (incluye el id que genero el servidor)
}

// Borra una tarea: la quita de la vista al instante (optimista) y avisa al Apps Script.
async function borrarTarea(id) {
  tareasActuales = tareasActuales.filter(t => t.id !== id); // la quita en memoria
  renderizarTareas(); // repinta ya, sin esperar la respuesta del servidor
  try {
    await fetch(TAREAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: TAREAS_TOKEN, action: "delete", id }),
    });
  } catch (error) {
    // si falla, la proxima carga la vuelve a traer
  }
}

// Se llama cuando terminas de arrastrar una tarea: lee el orden actual en
// pantalla y lo manda al Apps Script para que quede guardado en la Sheet.
async function guardarOrden() {
  const lista = document.getElementById("lista-tareas");
  // Lee el orden real de los <li> en el DOM (ya reordenados por SortableJS).
  const orden = [...lista.querySelectorAll(".tarea-item")].map(el => el.dataset.id);
  // Reordena tambien la copia en memoria, para que coincida con lo que se ve.
  tareasActuales.sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id));
  try {
    await fetch(TAREAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: TAREAS_TOKEN, action: "reorder", orden }),
    });
  } catch (error) {
    // si falla, la proxima carga trae el orden real del servidor
  }
}

cargarTareas();
