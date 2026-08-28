// Recarga la pagina automaticamente pasada la medianoche (00:01 hora local
// del navegador), para que si dejas la pestaña abierta varios dias, el
// clima/agenda/partidos igual se refresquen sin que tengas que hacerlo tu.
(function () {
  const ahora = new Date();

  // Calcula la proxima 00:01 a partir de ahora mismo.
  const proximaRecarga = new Date(ahora);
  proximaRecarga.setHours(0, 1, 0, 0);

  // Si ya pasaron las 00:01 de hoy, la proxima recarga es mañana a esa hora.
  if (proximaRecarga <= ahora) {
    proximaRecarga.setDate(proximaRecarga.getDate() + 1);
  }

  // Milisegundos que faltan hasta ese momento.
  const msHastaRecarga = proximaRecarga.getTime() - ahora.getTime();

  // Programa la recarga completa de la pagina para ese instante.
  setTimeout(() => location.reload(), msHastaRecarga);
})();
