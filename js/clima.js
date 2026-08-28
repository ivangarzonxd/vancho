// Cajon del clima: pide el pronostico de 7 dias a Open-Meteo (API gratis,
// sin key) para las coordenadas de Madrid, y dibuja una tarjeta por dia con
// fecha, emoji, temperaturas, probabilidad+hora de lluvia y que ponerse.

// Sugiere que ropa ponerse segun la temperatura maxima del dia y si va a
// llover (probLluvia en %).
function queMePonerme(tempMax, probLluvia) {
  let prenda = "";

  if (tempMax >= 30) prenda = "cortos, esqueleto";
  else if (tempMax >= 24) prenda = "jean, Camiseta";
  else if (tempMax >= 18) prenda = "Sobrecamisa";
  else if (tempMax >= 12) prenda = "chaqueta ligera";
  else prenda = "chaqeta gruesa";

  if (probLluvia >= 30) prenda += ", ☂️"; // si hay bastante probabilidad de lluvia, suma el paraguas

  return prenda;
}

// Coordenadas de Madrid, usadas para pedir el pronostico a Open-Meteo.
const LAT = 40.4300;
const LON = -3.6190;

// Pide a Open-Meteo: temperaturas maxima/minima, sensacion termica,
// probabilidad de lluvia diaria y por hora, y el codigo de clima de cada dia.
fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,weather_code&hourly=precipitation_probability&timezone=auto`)
  .then(r => r.json())
  .then(datos => {

    // Traduce el codigo numerico de clima de Open-Meteo a un emoji.
    const emojiClima = (codigo) => {
      if (codigo === 0) return "☀️"; // despejado
      if (codigo <= 3) return "⛅"; // parcialmente nublado
      if (codigo === 45 || codigo === 48) return "🌫️"; // niebla
      if (codigo >= 51 && codigo <= 57) return "🌦️"; // llovizna
      if (codigo >= 61 && codigo <= 67) return "🌧️"; // lluvia
      if (codigo >= 71 && codigo <= 77) return "🌨️"; // nieve
      if (codigo >= 80 && codigo <= 82) return "🌦️"; // chubascos
      if (codigo >= 85 && codigo <= 86) return "🌨️"; // chubascos de nieve
      return "⛈️"; // 95+: tormenta
    };

    // Busca en el pronostico POR HORA el rango de horas de ese dia donde la
    // probabilidad de lluvia es alta (>=30%), para mostrar algo como "14-17h".
    const horaConLluvia = (fecha) => {
      const soloFecha = fecha.slice(0, 10); // "YYYY-MM-DD" (el dato horario viene como "YYYY-MM-DDTHH:MM")
      const horas = datos.hourly.time
        .map((h, i) => ({ hora: h, prob: datos.hourly.precipitation_probability[i] }))
        .filter(h => h.hora.startsWith(soloFecha) && h.prob >= 30);

      if (horas.length === 0) return ""; // ese dia no hay horas con lluvia probable
      const inicio = horas[0].hora.slice(11, 13); // hora (HH) del primer momento con lluvia
      const fin = horas[horas.length - 1].hora.slice(11, 13); // hora (HH) del ultimo momento con lluvia
      return `${inicio}-${fin}h`;
    };

    // Solo los primeros 7 dias del pronostico (la API a veces devuelve mas).
    const dias = datos.daily.time.slice(0, 7);

    // Arma una tarjeta de HTML por cada uno de esos 7 dias.
    const tarjetas = dias.map((fecha, i) => {
      // Nombre corto del dia + numero, ej: "lun 25" (se le quita la coma que agrega toLocaleDateString).
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

    // Pinta el cajon completo con las 7 tarjetas ya armadas, en una fila con scroll horizontal.
    document.getElementById("clima").innerHTML = `
      <h2>Clima</h2>
      <div class="clima-dias-wrap">
        <div class="clima-dias">
          ${tarjetas.join("")}
        </div>
      </div>
    `;
  });
