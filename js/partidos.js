// Cajon de partidos: para cada equipo de EQUIPOS_INTERES, pide a TheSportsDB
// su proximo partido y arma una tabla ordenada por el partido mas cercano.

// Equipos a seguir, con su id de TheSportsDB (la API que consulta cargarPartidos).
const EQUIPOS_INTERES = [
  { id: 137617, nombre: "Millonarios FC" },
  { id: 137699, nombre: "Inter Miami" },
  { id: 134501, nombre: "Selección Colombia" },
  { id: 133738, nombre: "Real Madrid" },
  { id: 133739, nombre: "Barcelona" },
];

// TheSportsDB da la fecha/hora del partido en UTC (dateEvent + strTime);
// esto las junta y las convierte a fecha y hora locales de Madrid.
function formatoFechaHoraMadrid(dateEvent, strTime) {
  // dateEvent: "YYYY-MM-DD", strTime: "HH:MM:SS" en UTC
  const fechaUTC = new Date(`${dateEvent}T${strTime}Z`); // la "Z" le dice a JS que es UTC
  const fecha = fechaUTC.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""); // quita los puntos de las abreviaturas ("lun." -> "lun")
  const hora = fechaUTC.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
  return { fecha, hora };
}

// Descarta partidos que la API todavia lista como "proximos" pero cuya fecha-hora ya paso
function proximoEventoValido(eventos) {
  if (!eventos) return null; // el equipo no tiene ningun partido listado
  const ahora = new Date();
  // Devuelve el primer evento cuya fecha-hora sea posterior a ahora mismo.
  return eventos.find(ev => {
    if (!ev.strTime || !ev.dateEvent) return false; // evento sin fecha/hora usable, se ignora
    const fechaEvento = new Date(`${ev.dateEvent}T${ev.strTime}Z`);
    return fechaEvento > ahora;
  }) || null;
}

// Pide el proximo partido de cada equipo (en paralelo) y pinta la tabla.
async function cargarPartidos() {
  // Promise.all + map: lanza las 5 peticiones a la vez en vez de una por una.
  const resultados = await Promise.all(EQUIPOS_INTERES.map(async (equipo) => {
    try {
      const resp = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${equipo.id}`);
      const datos = await resp.json();
      const evento = proximoEventoValido(datos.events);
      if (!evento) {
        // el equipo no tiene ningun partido futuro valido: fila vacia, se manda al final al ordenar
        return { equipo, orden: null, html: `<tr><td>${equipo.nombre}</td><td colspan="3">Sin partido próximo</td></tr>` };
      }
      // Compara el id del equipo local del partido con el id de nuestro equipo, para saber quien es el rival.
      const esLocal = String(evento.idHomeTeam) === String(equipo.id);
      const rival = esLocal ? evento.strAwayTeam : evento.strHomeTeam;
      const fechaEvento = new Date(`${evento.dateEvent}T${evento.strTime}Z`);
      const { fecha, hora } = formatoFechaHoraMadrid(evento.dateEvent, evento.strTime);
      return {
        equipo,
        orden: fechaEvento.getTime(), // timestamp numerico, usado luego para ordenar
        html: `<tr><td>${equipo.nombre}</td><td>${rival}</td><td>${fecha}</td><td>${hora}</td></tr>`,
      };
    } catch (e) {
      // fallo la peticion a la API para este equipo: fila de error, tambien al final al ordenar
      return { equipo, orden: null, html: `<tr><td>${equipo.nombre}</td><td colspan="3">Error al cargar</td></tr>` };
    }
  }));

  // Ascendente por fecha-hora mas proxima; los que no tienen partido van al final
  resultados.sort((a, b) => {
    if (a.orden === null && b.orden === null) return 0; // ambos sin partido, no importa el orden entre ellos
    if (a.orden === null) return 1; // a sin partido, va despues de b
    if (b.orden === null) return -1; // b sin partido, va despues de a
    return a.orden - b.orden; // los dos tienen partido: el mas proximo primero
  });

  // Pinta la tabla completa con una fila por equipo, ya ordenada.
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
