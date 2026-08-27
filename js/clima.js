function queMePonerme(tempMax, probLluvia) {
  let prenda = "";

  if (tempMax >= 30) prenda = "cortos, esqueleto";
  else if (tempMax >= 24) prenda = "jean, Camiseta";
  else if (tempMax >= 18) prenda = "Sobrecamisa";
  else if (tempMax >= 12) prenda = "chaqueta ligera";
  else prenda = "chaqeta gruesa";

  if (probLluvia >= 30) prenda += ", ☂️";

  return prenda;
}

const LAT = 40.4300;
const LON = -3.6190;

fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,weather_code&hourly=precipitation_probability&timezone=auto`)
  .then(r => r.json())
  .then(datos => {

    const emojiClima = (codigo) => {
      if (codigo === 0) return "☀️";
      if (codigo <= 3) return "⛅";
      if (codigo === 45 || codigo === 48) return "🌫️";
      if (codigo >= 51 && codigo <= 57) return "🌦️";
      if (codigo >= 61 && codigo <= 67) return "🌧️";
      if (codigo >= 71 && codigo <= 77) return "🌨️";
      if (codigo >= 80 && codigo <= 82) return "🌦️";
      if (codigo >= 85 && codigo <= 86) return "🌨️";
      return "⛈️"; // 95+
    };

    const horaConLluvia = (fecha) => {
      const soloFecha = fecha.slice(0, 10);
      const horas = datos.hourly.time
        .map((h, i) => ({ hora: h, prob: datos.hourly.precipitation_probability[i] }))
        .filter(h => h.hora.startsWith(soloFecha) && h.prob >= 30);

      if (horas.length === 0) return "";
      const inicio = horas[0].hora.slice(11, 13);
      const fin = horas[horas.length - 1].hora.slice(11, 13);
      return `${inicio}-${fin}h`;
    };

    const dias = datos.daily.time.slice(0, 7);

    const tarjetas = dias.map((fecha, i) => {
      const nombreDia = new Date(fecha).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(",", "");
      const emoji = emojiClima(datos.daily.weather_code[i]);
      const max = datos.daily.temperature_2m_max[i];
      const min = datos.daily.temperature_2m_min[i];
      const pct = datos.daily.precipitation_probability_max[i];
      const horaTexto = horaConLluvia(fecha);
      const ropa = queMePonerme(max, pct);

      return `
        <div class="dia-clima">
          <div class="dia-fecha">${nombreDia}</div>
          <div class="dia-emoji">${emoji}</div>
          <div class="dia-temp">⬆ ${max}° <span class="temp-min"><br> ⬇ ${min}°</span></div>
          <div class="dia-lluvia">
            <span class="lluvia-pct">${pct}%</span>
            ${horaTexto ? `<span class="lluvia-hora">${horaTexto}</span>` : ""}
          </div>
          <div class="dia-ropa">${ropa}</div>
        </div>
      `;
    });

    document.getElementById("clima").innerHTML = `
      <h2>Clima</h2>
      <div class="clima-dias-wrap">
        <div class="clima-dias">
          ${tarjetas.join("")}
        </div>
      </div>
    `;
  });
