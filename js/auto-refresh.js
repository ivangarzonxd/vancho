// Recarga la pagina automaticamente pasada la medianoche (00:01 hora local del navegador),
// para que si dejas la pestaña abierta varios dias, el clima/agenda/partidos igual se refresquen.
(function () {
  const ahora = new Date();
  const proximaRecarga = new Date(ahora);
  proximaRecarga.setHours(0, 1, 0, 0);
  if (proximaRecarga <= ahora) {
    proximaRecarga.setDate(proximaRecarga.getDate() + 1);
  }
  const msHastaRecarga = proximaRecarga.getTime() - ahora.getTime();
  setTimeout(() => location.reload(), msHastaRecarga);
})();
