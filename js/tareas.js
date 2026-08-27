function cargarTareas() {
  // Formato esperado en el titulo del evento: "Tarea: N - texto" (N = prioridad, 1 = mas urgente).
  // La fecha del evento en Google Calendar no se usa para nada aqui, solo el numero de prioridad.
  const tareas = eventosCalendario
    .filter(e => e.tipo === "tarea")
    .map(e => {
      const match = (e.nota || "").match(/^\s*(\d+)\s*-\s*(.*)$/);
      return {
        prioridad: match ? parseInt(match[1], 10) : Infinity,
        texto: match ? match[2] : (e.nota || ""),
      };
    })
    .sort((a, b) => a.prioridad - b.prioridad);

  const filas = tareas.map(t =>
    `<li class="tarea-item"><span class="tarea-texto">${t.texto}</span></li>`
  );

  document.getElementById("tareas").innerHTML = `
    <h2>Tareas</h2>
    <ul class="lista-tareas">
      ${filas.length ? filas.join("") : '<li class="tarea-vacia">Sin tareas pendientes</li>'}
    </ul>
  `;
}

cargarTareas();
