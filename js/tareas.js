// Cajon de tareas: lee y escribe en una Google Sheet a traves de un Apps
// Script propio (ver apps-script-tareas.gs). Permite agregar, borrar y
// reordenar arrastrando (funciona con mouse y con touch via SortableJS).

const TAREAS_API_URL = "https://script.google.com/macros/s/AKfycbwlxLX_AxE7wTd47iBOog97jm1oIsPseJ9BO0UdonlaUmaJl7qBx5fCX8IFyeLamXwK/exec";
const TAREAS_TOKEN = "70ee87b6f7e009c97b41c05b782c84aa";

let tareasActuales = [];
let tareasSortable = null;

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

async function cargarTareas() {
  document.getElementById("tareas").innerHTML = `<h2>Tareas</h2><p class="tarea-estado">Cargando...</p>`;
  try {
    const respuesta = await fetch(`${TAREAS_API_URL}?token=${TAREAS_TOKEN}`);
    const datos = await respuesta.json();
    if (datos.error) throw new Error(datos.error);
    tareasActuales = datos.tareas || [];
    renderizarTareas();
  } catch (error) {
    document.getElementById("tareas").innerHTML = `<h2>Tareas</h2><p class="tarea-estado">No se pudo conectar</p>`;
  }
}

function renderizarTareas() {
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

  const boton = document.getElementById("tarea-agregar-btn");
  const input = document.getElementById("tarea-input");
  boton.addEventListener("click", agregarTarea);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") agregarTarea();
  });

  document.querySelectorAll(".tarea-borrar").forEach(btn => {
    btn.addEventListener("click", () => borrarTarea(btn.dataset.id));
  });

  activarArrastre();
}

function activarArrastre() {
  const lista = document.getElementById("lista-tareas");
  if (!lista || tareasActuales.length === 0) return;
  if (tareasSortable) tareasSortable.destroy();
  tareasSortable = new Sortable(lista, {
    animation: 150,
    handle: ".tarea-agarre",
    ghostClass: "tarea-fantasma",
    onEnd: guardarOrden,
  });
}

async function agregarTarea() {
  const input = document.getElementById("tarea-input");
  const texto = input.value.trim();
  if (!texto) return;
  input.value = "";
  input.disabled = true;
  try {
    await fetch(TAREAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: TAREAS_TOKEN, action: "add", texto }),
    });
  } catch (error) {
    // se reconcilia al recargar
  }
  await cargarTareas();
}

async function borrarTarea(id) {
  tareasActuales = tareasActuales.filter(t => t.id !== id);
  renderizarTareas();
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

async function guardarOrden() {
  const lista = document.getElementById("lista-tareas");
  const orden = [...lista.querySelectorAll(".tarea-item")].map(el => el.dataset.id);
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
