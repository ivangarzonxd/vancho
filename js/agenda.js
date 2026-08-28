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

// Color de la franja izquierda de cada evento, segun su tipo.
function colorTipo(tipo) {
  switch (tipo) {
    case "trabajo": return "#7c9eff"; // turnos de trabajo
    case "evento": return "#f5c451"; // eventos normales de Calendar
    case "festivo": return "#ef5b5b"; // festivos de datos-festivos.js
    default: return "#9aa0ac"; // cualquier otro tipo no contemplado
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

  // Una fila de texto por cada evento del dia, con su color segun el tipo.
  const filasEventos = eventosDelDia.map(e => {
    const color = colorTipo(e.tipo);
    const texto = e.hora ? `${e.hora} ${e.nota || ""}` : (e.nota || "");
    return `<div class="fila-evento" style="border-left-color:${color}">${texto}</div>`;
  }).join("");

  // La celda del dia: numero + lista de eventos, con las clases hoy/pasado/frontera-mes segun toque.
  celdas += `
    <div class="dia-calendario ${esHoy ? "hoy" : ""} ${esPasado ? "pasado" : ""} ${esFronteraMes ? "frontera-mes" : ""}">
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
