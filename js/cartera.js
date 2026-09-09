// Cajon "Cartera": deudas/pagos con otras personas. Vive detras de un boton
// en el cajon de pendientes (ver #pendientes-otros-wrap en pendientes.js) y
// se abre en un modal flotante, no es un cajon fijo de la cuadricula.
//
// Soporta VARIAS cuentas (una pestaña por persona: "Novia", "Hermano", lo que
// sea) sin tener que tocar este archivo cada vez que agregas a alguien: las
// cuentas se descubren solas desde los movimientos ya guardados (accion
// "cuentas" del Apps Script) y se puede crear una nueva con el boton "+" del
// selector, escribiendo el nombre que quieras.
//
// El PIN NUNCA se guarda en este archivo ni en ningun archivo del repositorio:
// se pide cada vez que abres el modal (se recuerda solo mientras dure la
// pestaña abierta, via sessionStorage) y el propio Apps Script lo valida.
// Si alguien mas abre esta pagina no puede ver ni tocar nada de esto sin
// saber el PIN.

// TODO: pega aqui la URL de tu propia implementacion del Apps Script
// (ver apps-script-cartera.gs), termina en "/exec".
const CARTERA_API_URL = "https://script.google.com/macros/s/AKfycbw1vPAozVBWZvME4Yf5PTIvVkz9xya07650S9IRyAymcmBqQ-VuQiymmKaOT_mijJPR/exec";

// Nombre que se usa la primerisima vez, antes de que exista ninguna cuenta
// guardada todavia (para que el modal no abra vacio sin saber que pintar).
const CARTERA_CUENTA_POR_DEFECTO = "Geral";

let carteraCuentas = []; // nombres de cuenta conocidos (servidor + creadas en este navegador sin movimientos aun)
let cuentaActual = null;
let carteraMovimientos = [];
let carteraSaldo = 0;

// Inserta el modal (vacio, oculto) una sola vez al cargar la pagina, y conecta
// el boton que ya viene pintado dentro de pendientes.js.
//
// OJO: a diferencia de los otros archivos js/*.js, esta funcion NO se llama
// sola al final del archivo. La llama pendientes.js
// (cargarDivisaHora().then(inicializarCartera)) justo despues de pintar el
// boton #cartera-btn, para no crear el modal antes de que el boton exista.
function inicializarCartera() {
  const contenedor = document.createElement("div");
  contenedor.id = "cartera-overlay";
  contenedor.className = "cartera-overlay";
  contenedor.innerHTML = `
    <div class="cartera-modal">
      <div class="cartera-modal-header">
        <h2>💰 Cartera</h2>
        <button class="cartera-cerrar" id="cartera-cerrar-btn" aria-label="Cerrar">×</button>
      </div>
      <div id="cartera-contenido"></div>
    </div>
  `;
  document.body.appendChild(contenedor);

  contenedor.addEventListener("click", (e) => {
    if (e.target === contenedor) cerrarCartera(); // clic afuera del modal, en el fondo oscuro
  });
  document.getElementById("cartera-cerrar-btn").addEventListener("click", cerrarCartera);

  const boton = document.getElementById("cartera-btn");
  if (boton) boton.addEventListener("click", abrirCartera);
}

function abrirCartera() {
  document.getElementById("cartera-overlay").classList.add("abierto");
  const pinGuardado = sessionStorage.getItem("cartera-pin");
  if (pinGuardado) {
    cargarCuentasYListado(pinGuardado);
  } else {
    pintarFormularioPin();
  }
}

function cerrarCartera() {
  document.getElementById("cartera-overlay").classList.remove("abierto");
}

function pintarFormularioPin(error) {
  document.getElementById("cartera-contenido").innerHTML = `
    <form class="cartera-pin-form" id="cartera-pin-form">
      <input type="password" inputmode="numeric" id="cartera-pin-input" placeholder="PIN" autofocus />
      ${error ? `<div class="cartera-error">${error}</div>` : ""}
      <button type="submit">Entrar</button>
    </form>
  `;
  document.getElementById("cartera-pin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pin = document.getElementById("cartera-pin-input").value.trim();
    if (pin) cargarCuentasYListado(pin);
  });
}

function pintarCargando() {
  document.getElementById("cartera-contenido").innerHTML = `<p class="cartera-vacio">Cargando...</p>`;
}

// Nombres de cuenta creados en ESTE navegador que todavia no tienen ningun
// movimiento (por eso el servidor todavia no los conoce via la accion
// "cuentas"): se guardan aparte para que la pestaña no desaparezca si
// recargas la pagina antes de agregar el primer movimiento de esa cuenta.
function cuentasExtraLocales() {
  try {
    return JSON.parse(localStorage.getItem("cartera-cuentas-extra") || "[]");
  } catch (e) {
    return [];
  }
}

function agregarCuentaExtraLocal(nombre) {
  const extra = cuentasExtraLocales();
  if (!extra.includes(nombre)) {
    extra.push(nombre);
    localStorage.setItem("cartera-cuentas-extra", JSON.stringify(extra));
  }
}

// Primer paso al desbloquear con el PIN: averigua que cuentas existen (esto
// tambien sirve para validar el PIN, cualquier accion lo valida igual) y
// decide cual mostrar de entrada, antes de pedir su historial.
async function cargarCuentasYListado(pin) {
  pintarCargando();
  try {
    const resp = await fetch(CARTERA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ pin, action: "cuentas" }),
    });
    const datos = await resp.json();
    if (datos.error) {
      sessionStorage.removeItem("cartera-pin");
      pintarFormularioPin(datos.error);
      return;
    }
    sessionStorage.setItem("cartera-pin", pin);

    // Junta lo que ya tiene movimientos (servidor) con lo creado en este
    // navegador sin movimientos todavia, sin repetir nombres.
    const combinadas = new Set([...datos.cuentas, ...cuentasExtraLocales()]);
    carteraCuentas = combinadas.size > 0 ? Array.from(combinadas) : [CARTERA_CUENTA_POR_DEFECTO];

    const preferida = localStorage.getItem("cartera-cuenta-actual");
    cuentaActual = carteraCuentas.includes(preferida) ? preferida : carteraCuentas[0];

    await pedirListado(pin);
  } catch (error) {
    pintarFormularioPin("No se pudo conectar");
  }
}

// Trae el historial + saldo de "cuentaActual" (el PIN ya se sabe que es
// correcto a esta altura, viene de sessionStorage).
async function pedirListado(pin) {
  const pinUsar = pin || sessionStorage.getItem("cartera-pin");
  pintarCargando();
  try {
    const resp = await fetch(CARTERA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ pin: pinUsar, action: "listar", cuenta: cuentaActual }),
    });
    const datos = await resp.json();
    if (datos.error) {
      sessionStorage.removeItem("cartera-pin");
      pintarFormularioPin(datos.error);
      return;
    }
    carteraMovimientos = datos.movimientos;
    carteraSaldo = datos.saldo;
    pintarCartera();
  } catch (error) {
    pintarFormularioPin("No se pudo conectar");
  }
}

function cambiarCuenta(nombre) {
  cuentaActual = nombre;
  localStorage.setItem("cartera-cuenta-actual", nombre);
  pedirListado();
}

function crearCuentaNueva(nombre) {
  const limpio = nombre.trim();
  if (!limpio || carteraCuentas.includes(limpio)) return;
  carteraCuentas.push(limpio);
  agregarCuentaExtraLocal(limpio);
  cambiarCuenta(limpio);
}

function pintarSelectorCuentas() {
  if (carteraCuentas.length <= 1) {
    // Con una sola cuenta no vale la pena mostrar pestañas, solo el "+" para
    // el dia que se necesite otra.
    return `
      <div class="cartera-cuentas">
        <span class="cartera-cuenta-unica">${escaparHtml(cuentaActual)}</span>
        <button type="button" class="cartera-cuenta-mas" id="cartera-nueva-cuenta-btn">+ persona</button>
      </div>
    `;
  }
  const pestañas = carteraCuentas.map(c => `
    <button type="button" class="cartera-cuenta-pestaña ${c === cuentaActual ? "activa" : ""}" data-cuenta="${escaparHtml(c)}">${escaparHtml(c)}</button>
  `).join("");
  return `
    <div class="cartera-cuentas">
      ${pestañas}
      <button type="button" class="cartera-cuenta-mas" id="cartera-nueva-cuenta-btn">+</button>
    </div>
  `;
}

function pintarCartera() {
  const filas = carteraMovimientos.map(m => `
    <li class="cartera-mov">
      <div class="cartera-mov-info">
        <div class="cartera-mov-nota" title="${escaparHtml(m.nota || "(sin nota)")}">
          <span class="cartera-mov-tipo ${m.tipo === "pago" ? "tipo-pago" : "tipo-deuda"}">${m.tipo === "pago" ? "Pago" : "Deuda"}</span>
          ${escaparHtml(m.nota || "(sin nota)")}
        </div>
        <div class="cartera-mov-fecha">${formatoFechaCorta(m.fecha)}</div>
      </div>
      <div class="cartera-mov-monto ${m.monto >= 0 ? "a-favor" : "en-contra"}">${formatoMonto(m.monto, true)}</div>
      <button class="cartera-mov-borrar" data-id="${m.id}" aria-label="Borrar movimiento" title="Borrar">×</button>
    </li>
  `).join("");

  document.getElementById("cartera-contenido").innerHTML = `
    ${pintarSelectorCuentas()}

    <div class="cartera-saldo">
      <div class="cartera-saldo-frase">${fraseSaldo(carteraSaldo)}</div>
      <div class="cartera-saldo-monto ${claseSaldo(carteraSaldo)}">${formatoMonto(Math.abs(carteraSaldo))}</div>
    </div>

    <form class="cartera-agregar-form" id="cartera-agregar-form">
      <div class="cartera-direccion">
        <label><input type="radio" name="cartera-direccion" value="debe" checked /><span>${escaparHtml(cuentaActual)} me debe</span></label>
        <label><input type="radio" name="cartera-direccion" value="debo" /><span>Yo le debo</span></label>
        <label><input type="radio" name="cartera-direccion" value="pago_el" /><span>${escaparHtml(cuentaActual)} me pagó</span></label>
        <label><input type="radio" name="cartera-direccion" value="pago_yo" /><span>Yo le pagué</span></label>
      </div>
      <input type="number" id="cartera-monto-input" step="0.01" min="0" placeholder="Monto (€)" required />
      <input type="text" id="cartera-nota-input" maxlength="80" placeholder="Nota (opcional)" />
      <button type="submit">Agregar</button>
    </form>

    <ul class="cartera-historial">
      ${filas || '<li class="cartera-vacio">Sin movimientos todavia</li>'}
    </ul>
  `;

  document.getElementById("cartera-agregar-form").addEventListener("submit", agregarMovimiento);
  document.querySelectorAll(".cartera-mov-borrar").forEach(btn => {
    btn.addEventListener("click", () => borrarMovimiento(btn.dataset.id));
  });
  document.querySelectorAll(".cartera-cuenta-pestaña").forEach(btn => {
    btn.addEventListener("click", () => cambiarCuenta(btn.dataset.cuenta));
  });
  const botonMas = document.getElementById("cartera-nueva-cuenta-btn");
  if (botonMas) botonMas.addEventListener("click", pedirNombreCuentaNueva);
}

function pedirNombreCuentaNueva() {
  const nombre = window.prompt("Nombre de la nueva persona (ej. Hermano, Roomie...):");
  if (nombre) crearCuentaNueva(nombre);
}

// Cada opcion del formulario mapea a un signo (para el saldo) y un "tipo"
// (para poder distinguir en el historial una deuda nueva de un pago, aunque
// el signo sea el mismo: ej. "Yo le debo" y "ella me pago" restan los dos del
// saldo, pero son cosas distintas y asi quedan marcadas por separado).
const CARTERA_DIRECCIONES = {
  debe: { signo: 1, tipo: "deuda", etiqueta: (nombre) => `${nombre} me debe` },
  debo: { signo: -1, tipo: "deuda", etiqueta: () => "Yo le debo" },
  pago_el: { signo: -1, tipo: "pago", etiqueta: (nombre) => `${nombre} me pagó` },
  pago_yo: { signo: 1, tipo: "pago", etiqueta: () => "Yo le pagué" },
};

async function agregarMovimiento(e) {
  e.preventDefault();
  const montoInput = document.getElementById("cartera-monto-input");
  const notaInput = document.getElementById("cartera-nota-input");
  const direccionValor = document.querySelector('input[name="cartera-direccion"]:checked').value;
  const direccion = CARTERA_DIRECCIONES[direccionValor];

  const valor = parseFloat(montoInput.value);
  if (!valor || valor <= 0) return; // no manda movimientos vacios o en cero

  const monto = direccion.signo * valor;
  const nota = notaInput.value.trim();
  const etiqueta = direccion.etiqueta(cuentaActual);

  // Confirmacion antes de guardar: esto toca plata, un clic de mas no deberia
  // poder agregar algo sin querer.
  const resumen = `${etiqueta}: ${formatoMonto(valor)}${nota ? ` (${nota})` : ""}`;
  if (!window.confirm(`¿Agregar este movimiento?\n\n${resumen}`)) return;

  const pin = sessionStorage.getItem("cartera-pin");

  montoInput.disabled = true;
  try {
    const resp = await fetch(CARTERA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ pin, action: "agregar", cuenta: cuentaActual, monto, nota: nota || etiqueta, tipo: direccion.tipo }),
    });
    const datos = await resp.json();
    if (datos.error) return; // si el pin se invalido a mitad de sesion, se queda como estaba
    carteraMovimientos = datos.movimientos;
    carteraSaldo = datos.saldo;
    pintarCartera();
  } catch (error) {
    montoInput.disabled = false;
  }
}

async function borrarMovimiento(id) {
  // Tambien pide confirmacion: borrar un movimiento cambia el saldo, no debe
  // poder pasar con un solo clic sin querer.
  if (!window.confirm("¿Borrar este movimiento del historial? Esto no se puede deshacer.")) return;

  const pin = sessionStorage.getItem("cartera-pin");
  try {
    const resp = await fetch(CARTERA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ pin, action: "borrar", id, cuenta: cuentaActual }),
    });
    const datos = await resp.json();
    if (datos.error) return;
    carteraMovimientos = datos.movimientos;
    carteraSaldo = datos.saldo;
    pintarCartera();
  } catch (error) {
    // si falla, se queda como estaba; el proximo listado trae el estado real
  }
}

function fraseSaldo(saldo) {
  if (Math.abs(saldo) < 0.005) return "Están en paz 🤝";
  return saldo > 0 ? "Te debe" : "Le debes";
}

function claseSaldo(saldo) {
  if (Math.abs(saldo) < 0.005) return "en-paz";
  return saldo > 0 ? "a-favor" : "en-contra";
}

// Formatea un monto en euros, estilo español (coma decimal). Con signo=true
// antepone "+"/"-" (para las filas del historial); sin signo, va siempre en
// positivo (para el saldo grande, que ya trae su propia frase "Te debe"/"Le debes").
function formatoMonto(monto, signo) {
  const texto = Math.abs(monto).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefijo = signo ? (monto >= 0 ? "+" : "-") : "";
  return `${prefijo}${texto} €`;
}

function formatoFechaCorta(fechaIso) {
  return new Date(fechaIso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
