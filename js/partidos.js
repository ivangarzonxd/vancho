const EQUIPOS_INTERES = [
  { id: 137617, nombre: "Millonarios FC" },
  { id: 137699, nombre: "Inter Miami" },
  { id: 134501, nombre: "Selección Colombia" },
  { id: 133738, nombre: "Real Madrid" },
  { id: 133739, nombre: "Barcelona" },
];

function formatoFechaHoraMadrid(dateEvent, strTime) {
  // dateEvent: "YYYY-MM-DD", strTime: "HH:MM:SS" en UTC
  const fechaUTC = new Date(`${dateEvent}T${strTime}Z`);
  const fecha = fechaUTC.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  const hora = fechaUTC.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
  return { fecha, hora };
}

// Descarta partidos que la API todavia lista como "proximos" pero cuya fecha-hora ya paso
function proximoEventoValido(eventos) {
  if (!eventos) return null;
  const ahora = new Date();
  return eventos.find(ev => {
    if (!ev.strTime || !ev.dateEvent) return false;
    const fechaEvento = new Date(`${ev.dateEvent}T${ev.strTime}Z`);
    return fechaEvento > ahora;
  }) || null;
}

async function cargarPartidos() {
  const resultados = await Promise.all(EQUIPOS_INTERES.map(async (equipo) => {
    try {
      const resp = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${equipo.id}`);
      const datos = await resp.json();
      const evento = proximoEventoValido(datos.events);
      if (!evento) {
        return { equipo, orden: null, html: `<tr><td>${equipo.nombre}</td><td colspan="3">Sin partido próximo</td></tr>` };
      }
      const esLocal = String(evento.idHomeTeam) === String(equipo.id);
      const rival = esLocal ? evento.strAwayTeam : evento.strHomeTeam;
      const fechaEvento = new Date(`${evento.dateEvent}T${evento.strTime}Z`);
      const { fecha, hora } = formatoFechaHoraMadrid(evento.dateEvent, evento.strTime);
      return {
        equipo,
        orden: fechaEvento.getTime(),
        html: `<tr><td>${equipo.nombre}</td><td>${rival}</td><td>${fecha}</td><td>${hora}</td></tr>`,
      };
    } catch (e) {
      return { equipo, orden: null, html: `<tr><td>${equipo.nombre}</td><td colspan="3">Error al cargar</td></tr>` };
    }
  }));

  // Ascendente por fecha-hora mas proxima; los que no tienen partido van al final
  resultados.sort((a, b) => {
    if (a.orden === null && b.orden === null) return 0;
    if (a.orden === null) return 1;
    if (b.orden === null) return -1;
    return a.orden - b.orden;
  });

  document.getElementById("partidos").innerHTML = `
    <h2>Partidos</h2>
    <div class="tabla-partidos-wrap">
      <table class="tabla-partidos">
        <thead>
          <tr><th>Equipo</th><th>Rival</th><th>Fecha</th><th>Hora</th></tr>
        </thead>
        <tbody>
          ${resultados.map(r => r.html).join("")}
        </tbody>
      </table>
    </div>
  `;
}

cargarPartidos();
