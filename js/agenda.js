// Cajon de la agenda: dibuja una cuadricula de 6 semanas (42 dias) centrada
// en la semana actual, resalta el dia de hoy y muestra los eventos de cada
// dia (festivos de datos-festivos.js + eventos de datos-agenda.js, que el
// robot de GitHub Actions actualiza cada madrugada desde Google Calendar).

// Junta los festivos con los eventos de Calendar, pero sin las "tareas"
// (esas las gestiona el cajon de tareas por su cuenta, no se pintan aqui).
const eventosAgenda = [...eventosFestivos, ...eventosCalendario.filter(e => e.tipo !== "tarea")];

// "Hoy" a las 00:00 en punto, para poder comparar fechas sin la hora exacta.
const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

// getDay() de JS empieza en domingo (0); esto lo convierte a que la semana
// empiece en lunes (0 = lunes ... 6 = domingo).
const diaSemanaHoy = (hoy.getDay() + 6) % 7;

// Retrocede desde hoy hasta el lunes de esta semana: ese es el primer dia
// que se va a dibujar en la cuadricula.
const inicioSemana = new Date(hoy);
inicioSemana.setDate(hoy.getDate() - diaSemanaHoy);

// 6 semanas completas x 7 dias = 42 celdas en total.
const totalDias = 6 * 7;

// Ultimo dia que se dibuja (42 dias despues del inicio de semana).
const finVentana = new Date(inicioSemana);
finVentana.setDate(inicioSemana.getDate() + totalDias - 1);

// Pone en mayuscula la primera letra (los nombres de mes de JS salen en minuscula).
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mesInicio = cap(inicioSemana.toLocaleDateString("es-ES", { month: "long" }));
const mesFin = cap(finVentana.toLocaleDateString("es-ES", { month: "long" }));
// Titulo del cajon: un solo mes si la ventana no cruza de mes, o "Mes1 - Mes2" si cruza.
const tituloMes = mesInicio === mesFin ? mesInicio : `${mesInicio} - ${mesFin}`;

// Emoji de cada evento, segun su tipo.
function emojiTipo(tipo) {
  switch (tipo) {
    case "trabajo": return "☎️"; // turnos de trabajo (logo de tu empresa)
    case "evento": return "📌"; // eventos normales de Calendar
    case "festivo": return "🎉"; // festivos de datos-festivos.js
    case "partido": return "⚽"; // partidos de futbol
    default: return "•"; // cualquier otro tipo no contemplado
  }
}

// Convierte un objeto Date a texto "YYYY-MM-DD" en hora LOCAL (a diferencia
// de toISOString(), que usa UTC y podria mostrar el dia equivocado).
function formatoFecha(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0"); // getMonth() es 0-indexado, se le suma 1
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Arma el HTML de las 42 celdas del calendario, una por una.
let celdas = "";
for (let i = 0; i < totalDias; i++) {
  const fecha = new Date(inicioSemana);
  fecha.setDate(inicioSemana.getDate() + i); // avanza dia a dia desde el inicio de semana

  const esHoy = fecha.getTime() === hoy.getTime(); // para resaltar la celda de hoy
  const esPasado = fecha < hoy; // para atenuar los dias que ya pasaron
  const esFronteraMes = fecha.getDate() === 1; // para marcar el inicio de un mes nuevo

  const fechaStr = formatoFecha(fecha);
  // Eventos de este dia en concreto, ordenados por hora (los que no tienen hora van primero).
  const eventosDelDia = eventosAgenda
    .filter(e => e.fecha === fechaStr)
    .sort((a, b) => (a.hora || "00:00").localeCompare(b.hora || "00:00"));

  // Una fila de texto por cada evento del dia, con su emoji segun el tipo.
  const filasEventos = eventosDelDia.map(e => {
    const emoji = emojiTipo(e.tipo);
    const texto = e.hora ? `${e.hora} ${e.nota || ""}` : (e.nota || "");
    return `<div class="fila-evento">${emoji} ${texto}</div>`;
  }).join("");

  // La celda del dia: numero + lista de eventos, con las clases hoy/pasado/frontera-mes segun toque.
  celdas += `
    <div class="dia-calendario ${esHoy ? "hoy" : ""} ${esPasado ? "pasado" : ""} ${esFronteraMes ? "frontera-mes" : ""}" data-fecha="${fechaStr}">
      <span class="numero-dia">${fecha.getDate()}</span>
      <div class="eventos-dia">${filasEventos}</div>
    </div>
  `;
}

// Pinta el cajon completo: titulo con el mes, cabecera de dias de la semana
// y la cuadricula de 42 celdas ya armada arriba.
document.getElementById("agenda").innerHTML = `
  <h2>Agenda — ${tituloMes}</h2>
  <div class="semana-header">
    <div class="dia-semana etiqueta-secundaria">Lun</div>
    <div class="dia-semana etiqueta-secundaria">Mar</div>
    <div class="dia-semana etiqueta-secundaria">Mié</div>
    <div class="dia-semana etiqueta-secundaria">Jue</div>
    <div class="dia-semana etiqueta-secundaria">Vie</div>
    <div class="dia-semana etiqueta-secundaria">Sáb</div>
    <div class="dia-semana etiqueta-secundaria">Dom</div>
  </div>
  <div class="dias-scroll">
    <div class="calendario">${celdas}</div>
  </div>
`;

// --- Partidos: pide a TheSportsDB el proximo partido de cada equipo y lo
// inyecta directamente en la celda del calendario de arriba que corresponda
// a esa fecha (usa el atributo data-fecha de cada celda y emojiTipo() de
// mas arriba en este mismo archivo). Antes vivia en su propio js/partidos.js
// con su propia caja; ahora es parte de la agenda, que es donde se pinta.

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

async function cargarPartidos() {
  await Promise.all(EQUIPOS_INTERES.map(async (equipo) => {
    try {
      const resp = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${equipo.id}`);
      const datos = await resp.json();
      const evento = proximoEventoValido(datos.events);
      if (!evento) return; // este equipo no tiene partido proximo, no hay nada que pintar

      const esLocal = String(evento.idHomeTeam) === String(equipo.id);
      const rival = esLocal ? evento.strAwayTeam : evento.strHomeTeam;
      const { hora } = formatoFechaHoraMadrid(evento.dateEvent, evento.strTime);

      const contenedor = document.querySelector(`.dia-calendario[data-fecha="${evento.dateEvent}"] .eventos-dia`);
      if (!contenedor) return; // el partido cae fuera de las 6 semanas que se ven ahora mismo

      const emoji = emojiTipo("partido");
      contenedor.insertAdjacentHTML("beforeend", `<div class="fila-evento">${emoji} ${hora} ${equipo.nombre} vs ${rival}</div>`);
    } catch (e) {
      // si falla ese equipo, simplemente no se agrega su partido
    }
  }));
}

cargarPartidos();
