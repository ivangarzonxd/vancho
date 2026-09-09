// Cajon de la agenda: dibuja una cuadricula de 6 semanas (42 dias) centrada
// en la semana actual, resalta el dia de hoy y muestra los eventos de cada
// dia (festivos de datos-festivos.js + eventos de datos-agenda.js, que el
// robot de GitHub Actions actualiza cada madrugada desde Google Calendar).

// Junta los festivos con los eventos de Calendar, pero sin las "tareas"
// (esas las gestiona el cajon de tareas por su cuenta, no se pintan aqui).
// eventosPartidos viene de js/datos-partidos.js, el robot de GitHub Actions
// que consulta API-Football una vez al dia (ya no se pide nada al navegador,
// ver mas abajo: esto evita gastar el limite diario de peticiones gratis de
// la API en cada visita a la pagina).
const eventosAgenda = [...eventosFestivos, ...eventosCalendario.filter(e => e.tipo !== "tarea"), ...eventosPartidos];

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

// Pone en mayuscula la primera letra (los nombres de mes de JS salen en minuscula).
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Titulo del cajon: TODOS los meses que toca la ventana de 42 dias, en orden.
// (Antes solo se tomaba el mes del primer dia y el del ultimo, y si la ventana
// cruzaba 3 meses el del medio -ej. Septiembre- desaparecia del titulo).
const mesesVistos = [];
for (let i = 0; i < totalDias; i++) {
  const fecha = new Date(inicioSemana);
  fecha.setDate(inicioSemana.getDate() + i);
  const nombreMes = cap(fecha.toLocaleDateString("es-ES", { month: "long" }));
  // Como los dias van en orden, solo hay que comparar contra el ultimo mes agregado.
  if (mesesVistos[mesesVistos.length - 1] !== nombreMes) mesesVistos.push(nombreMes);
}
const tituloMes = mesesVistos.join(" - ");

// Emoji de cada evento, segun su tipo.
function emojiTipo(tipo) {
  switch (tipo) {
    case "trabajo": return "☎️"; // turnos de trabajo, formato antiguo (por si queda alguno en Calendar)
    case "oficina": return "🏢"; // turno de trabajo en la oficina
    case "casa": return "🏠"; // turno de trabajo desde casa
    case "libre": return "👍"; // dia libre del turno de trabajo
    case "vacaciones": return "✈️"; // vacaciones
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

  // Una fila de texto por cada evento del dia, con su emoji segun el tipo. Si el
  // texto no cabe en el ancho de la celda, el CSS lo corta con "..." (ver .fila-evento
  // en agenda.css); el atributo "title" hace que el navegador muestre el texto
  // completo en un tooltip nativo al dejar el mouse encima, sin agregar scroll.
  const filasEventos = eventosDelDia.map(e => {
    const emoji = emojiTipo(e.tipo);
    const texto = e.hora ? `${e.hora} ${e.nota || ""}` : (e.nota || "");
    return `<div class="fila-evento" title="${escaparHtml(texto)}">${emoji} ${texto}</div>`;
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
  <h2>${tituloMes}</h2>
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
