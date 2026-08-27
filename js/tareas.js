function cargarTareas() {
  const tareas = typeof tareasPendientes !== "undefined" ? tareasPendientes : [];

  const filas = tareas.map(texto => `<li class="tarea-item">${texto}</li>`);

  document.getElementById("tareas").innerHTML = `
    <h2>Tareas</h2>
    <ul class="lista-tareas">
      ${filas.length ? filas.join("") : '<li class="tarea-vacia">Sin tareas pendientes</li>'}
    </ul>
  `;
}

cargarTareas();
