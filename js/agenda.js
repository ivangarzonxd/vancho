const eventosAgenda = [...eventosFestivos, ...eventosCalendario];

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

const diaSemanaHoy = (hoy.getDay() + 6) % 7;
const inicioSemana = new Date(hoy);
inicioSemana.setDate(hoy.getDate() - diaSemanaHoy);

const totalDias = 6 * 7;

const finVentana = new Date(inicioSemana);
finVentana.setDate(inicioSemana.getDate() + totalDias - 1);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mesInicio = cap(inicioSemana.toLocaleDateString("es-ES", { month: "long" }));
const mesFin = cap(finVentana.toLocaleDateString("es-ES", { month: "long" }));
const tituloMes = mesInicio === mesFin ? mesInicio : `${mesInicio} - ${mesFin}`;

function colorTipo(tipo) {
  switch (tipo) {
    case "trabajo": return "#7c9eff";
    case "evento": return "#f5c451";
    case "festivo": return "#ef5b5b";
    default: return "#9aa0ac";
  }
}

function formatoFecha(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

let celdas = "";
for (let i = 0; i < totalDias; i++) {
  const fecha = new Date(inicioSemana);
  fecha.setDate(inicioSemana.getDate() + i);

  const esHoy = fecha.getTime() === hoy.getTime();
  const esPasado = fecha < hoy;
  const esFronteraMes = fecha.getDate() === 1;

  const fechaStr = formatoFecha(fecha);
  const eventosDelDia = eventosAgenda
    .filter(e => e.fecha === fechaStr)
    .sort((a, b) => (a.hora || "00:00").localeCompare(b.hora || "00:00"));

  const filasEventos = eventosDelDia.map(e => {
    const color = colorTipo(e.tipo);
    const texto = e.hora ? `${e.hora} ${e.nota || ""}` : (e.nota || "");
    return `<div class="fila-evento" style="border-left-color:${color}">${texto}</div>`;
  }).join("");

  celdas += `
    <div class="dia-calendario ${esHoy ? "hoy" : ""} ${esPasado ? "pasado" : ""} ${esFronteraMes ? "frontera-mes" : ""}">
      <span class="numero-dia">${fecha.getDate()}</span>
      <div class="eventos-dia">${filasEventos}</div>
    </div>
  `;
}

document.getElementById("agenda").innerHTML = `
  <h2>Agenda — ${tituloMes}</h2>
  <div class="semana-header">
    <div class="dia-semana">Lun</div>
    <div class="dia-semana">Mar</div>
    <div class="dia-semana">Mié</div>
    <div class="dia-semana">Jue</div>
    <div class="dia-semana">Vie</div>
    <div class="dia-semana">Sáb</div>
    <div class="dia-semana">Dom</div>
  </div>
  <div class="dias-scroll">
    <div class="calendario">${celdas}</div>
  </div>
`;
