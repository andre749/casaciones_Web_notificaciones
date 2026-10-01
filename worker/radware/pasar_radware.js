// Pasa la verificacion de Radware del CEJ con el MISMO perfil que usa el worker.
//
// Chrome se abre como un Chrome comun (solo con puerto de depuracion) y nadie se conecta
// a la pagina mientras Radware verifica: con puppeteer.launch o Selenium la pagina se
// queda en "Verifying your browser", un Chrome comun pasa solo. El estado se lee del
// endpoint HTTP /json/list, que no adjunta CDP a la pagina. Puppeteer
// (rebrowser-puppeteer-core, que no filtra Runtime.enable) se conecta solo si aparece el
// hCaptcha, para el clic en "Soy humano", o al final para cerrar Chrome en orden. Las
// cookies de Radware (__uzma, __uzmb, ...) quedan en el perfil y el worker entra sin
// verificacion.
//
//   node pasar_radware.js --perfil <carpeta> [--timeout 120] [--capturas <carpeta>]
//   node pasar_radware.js --puerto <puerto> [--timeout 120] [--capturas <carpeta>]
//
// Con --puerto no abre Chrome: vigila uno ya abierto (con --remote-debugging-port y la
// pagina del CEJ cargando) y al terminar lo deja abierto. Asi lo usa el worker de Python,
// que luego conecta Selenium a ese mismo Chrome.
//
// Imprime UNA linea JSON al final:
//   {"resultado": "directo"|"evitado"|"resuelto"|"atrapado"|"error", "hcaptcha": bool, ...}
//   directo   el formulario cargo sin pagina de Radware
//   evitado   aparecio "Verifying your browser" pero paso sola (sin hCaptcha)
//   resuelto  aparecio el hCaptcha y se paso con el clic en "Soy humano" + Submit
//   atrapado  hCaptcha pidio el desafio de imagenes, o se agoto el tiempo en Radware
// Codigo de salida: 0 si se llego al formulario, 2 si atrapado, 1 si error.

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('rebrowser-puppeteer-core');

const URL_BUSQUEDA = 'https://cej.pj.gob.pe/cej/forms/busquedaform.html';
const CHROME_RUTAS = [
  process.env.CEJ_CHROME_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  '/usr/bin/google-chrome',
].filter(Boolean);

function args() {
  const a = process.argv.slice(2);
  const valor = (n, def) => (a.indexOf(n) >= 0 ? a[a.indexOf(n) + 1] : def);
  return {
    perfil: valor('--perfil', process.env.CEJ_CHROME_PROFILE),
    puerto: valor('--puerto', null),
    timeout: Number(valor('--timeout', 120)) * 1000,
    capturas: valor('--capturas', null),
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const azar = (min, max) => min + Math.random() * (max - min);
const log = (...m) => console.error('[radware]', ...m);

// Cualquier llamada al navegador con tope: una pagina a medio navegar puede no responder
function conTope(promesa, ms, porDefecto = null) {
  return Promise.race([promesa.catch(() => porDefecto), esperar(ms).then(() => porDefecto)]);
}

// Movimiento de mouse en curva (Bezier con ruido) hasta (x, y): Radware y hCaptcha
// puntuan la telemetria del mouse, un salto directo al boton es senal de bot.
let mouseX = azar(200, 600);
let mouseY = azar(150, 400);
async function moverMouse(page, x, y) {
  const c1 = { x: mouseX + azar(-150, 150), y: mouseY + azar(-120, 120) };
  const c2 = { x: x + azar(-120, 120), y: y + azar(-100, 100) };
  const pasos = Math.round(azar(25, 45));
  for (let i = 1; i <= pasos; i++) {
    const t = i / pasos;
    const s = t * t * (3 - 2 * t); // acelera y frena
    const u = 1 - s;
    const px = u * u * u * mouseX + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * x;
    const py = u * u * u * mouseY + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * y;
    await page.mouse.move(px + azar(-1, 1), py + azar(-1, 1));
    await esperar(azar(6, 22));
  }
  mouseX = x;
  mouseY = y;
}

async function clicHumano(page, x, y) {
  await moverMouse(page, x, y);
  await esperar(azar(80, 250));
  await page.mouse.down();
  await esperar(azar(50, 140));
  await page.mouse.up();
}

async function deambular(page) {
  await moverMouse(page, azar(150, 1100), azar(120, 600));
}

async function estado(page) {
  return conTope(
    page.evaluate(() => {
      const texto = document.body ? document.body.innerText : '';
      const marcos = [...document.querySelectorAll('iframe')].filter((f) => /hcaptcha/.test(f.src));
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 50 && r.height > 50 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const casilla = marcos.find((f) => /frame=checkbox/.test(f.src));
      const desafio = marcos.find((f) => /frame=challenge/.test(f.src));
      const token = document.querySelector('textarea[name="h-captcha-response"]');
      const caja = casilla && visible(casilla) ? casilla.getBoundingClientRect() : null;
      return {
        titulo: document.title,
        formulario: !!document.getElementById('captcha_image') || !!document.getElementById('cod_expediente'),
        verificando: /Verifying your browser/i.test(texto),
        casilla: caja ? { x: caja.x, y: caja.y, width: caja.width, height: caja.height } : null,
        desafioVisible: !!(desafio && visible(desafio)),
        token: token ? token.value.length : 0,
      };
    }),
    5000,
    { titulo: '', sinRespuesta: true }
  );
}

async function capturar(page, carpeta, nombre) {
  if (!carpeta) return;
  fs.mkdirSync(carpeta, { recursive: true });
  await conTope(page.screenshot({ path: path.join(carpeta, `${Date.now()}_${nombre}.png`) }), 8000);
}

function puertoLibre() {
  return new Promise((ok, mal) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => ok(port));
    });
    srv.on('error', mal);
  });
}

// Pestanas segun el endpoint HTTP de depuracion (no conecta CDP a la pagina)
async function pestanas(puerto) {
  try {
    const r = await fetch(`http://127.0.0.1:${puerto}/json/list`, { signal: AbortSignal.timeout(3000) });
    return (await r.json()).filter((t) => t.type === 'page');
  } catch {
    return null;
  }
}

const delCej = (url) => /cej\.pj\.gob\.pe/.test(url);
const esFormulario = (t) => delCej(t.url) && /Consulta de Expedientes|squeda de Expedientes/i.test(t.title);
const esCaptcha = (t) => /radware/i.test(t.title) && /captcha/i.test(t.title); // "Radware Captcha Page"
const esRadware = (t) => /radware/i.test(t.title); // "Radware Page" = "Verifying your browser"

async function conectar(puerto) {
  return conTope(puppeteer.connect({ browserURL: `http://127.0.0.1:${puerto}`, defaultViewport: null }), 10000);
}

async function paginaCej(browser) {
  const paginas = (await conTope(browser.pages(), 5000)) || [];
  return paginas.find((p) => delCej(p.url()));
}

// Pagina del hCaptcha: clic en "Soy humano" y, con el token, Submit. Movimientos de
// mouse humanos. Si hCaptcha pide imagenes no se intenta resolverlas.
async function resolverHcaptcha(page, resultado, limite, capturas) {
  await capturar(page, capturas, 'hcaptcha');
  let ultimoClic = 0;
  let enviado = 0;
  while (Date.now() < limite) {
    const e = await estado(page);
    if (e.formulario || (e.titulo && !/radware/i.test(e.titulo))) return;
    if (e.desafioVisible && !e.token && !resultado.imagenes) {
      resultado.imagenes = true;
      await capturar(page, capturas, 'imagenes');
      log('hCaptcha pidio el desafio de imagenes');
      // No se resuelven: insistir solo prolonga la sesion marcada. Mejor salir y que el
      // worker reintente mas tarde con una sesion nueva.
      return;
    }
    if (e.token && Date.now() - enviado > 8000) {
      await esperar(azar(600, 1400)); // hSolvedRad suele enviar solo; si no, Submit
      const boton = await conTope(page.$('input[type="submit"], button[type="submit"]'), 3000);
      const caja = boton && (await conTope(boton.boundingBox(), 3000));
      if (caja) await clicHumano(page, caja.x + caja.width * azar(0.3, 0.7), caja.y + caja.height * azar(0.3, 0.7));
      enviado = Date.now();
      log('Token de hCaptcha obtenido, enviando');
    } else if (e.casilla && !e.token && !e.desafioVisible && Date.now() - ultimoClic > 15000 && resultado.clicsCasilla < 4) {
      await deambular(page);
      await esperar(azar(700, 1800));
      await clicHumano(page, e.casilla.x + azar(24, 36), e.casilla.y + e.casilla.height / 2 + azar(-5, 5));
      resultado.clicsCasilla++;
      ultimoClic = Date.now();
      log(`Clic en "Soy humano" (${resultado.clicsCasilla})`);
    }
    await esperar(azar(700, 1500));
  }
}

async function main() {
  const { perfil, timeout, capturas, puerto: puertoExistente } = args();
  if (!perfil && !puertoExistente) throw new Error('Falta --perfil (o CEJ_CHROME_PROFILE) o --puerto');
  const chrome = CHROME_RUTAS.find((r) => fs.existsSync(r));
  if (!chrome && !puertoExistente) throw new Error('No se encontro chrome.exe (definir CEJ_CHROME_EXE)');

  const inicio = Date.now();
  const limite = inicio + timeout;
  const resultado = { resultado: 'atrapado', hcaptcha: false, verificacion: false, clicsCasilla: 0, imagenes: false };
  const puerto = puertoExistente || (await puertoLibre());
  const proceso = puertoExistente ? null : spawn(
    chrome,
    [
      `--remote-debugging-port=${puerto}`,
      `--user-data-dir=${path.resolve(perfil)}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1366,768',
      '--lang=es-PE',
      URL_BUSQUEDA,
    ],
    { stdio: 'ignore' }
  );
  let browser = null;
  try {
    let recargas = 0;
    let desdeRadware = 0;
    while (Date.now() < limite) {
      await esperar(1500);
      if (proceso && proceso.exitCode !== null) throw new Error(`Chrome se cerro (codigo ${proceso.exitCode}); perfil en uso?`);
      const tab = ((await pestanas(puerto)) || []).find((t) => delCej(t.url));
      if (!tab) continue;
      if (esFormulario(tab)) {
        resultado.resultado = resultado.hcaptcha ? 'resuelto' : resultado.verificacion ? 'evitado' : 'directo';
        break;
      }
      if (esCaptcha(tab)) {
        if (!resultado.hcaptcha) log('Radware mostro el hCaptcha');
        resultado.hcaptcha = true;
        browser = browser || (await conectar(puerto));
        const page = browser && (await paginaCej(browser));
        if (page) await resolverHcaptcha(page, resultado, limite, capturas);
        if (resultado.imagenes) break;
      } else if (esRadware(tab)) {
        resultado.verificacion = true;
        desdeRadware = desdeRadware || Date.now();
        // Si la verificacion pasiva no avanza en 45 s, una recarga suele destrabarla
        if (Date.now() - desdeRadware > 45000 && recargas < 1) {
          browser = browser || (await conectar(puerto));
          const page = browser && (await paginaCej(browser));
          if (page) await conTope(page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }), 22000);
          recargas++;
          desdeRadware = Date.now();
          log('Verificacion trabada: recarga');
        }
      }
    }
    if (proceso || resultado.resultado === 'atrapado') browser = browser || (await conectar(puerto));
    if (resultado.resultado === 'atrapado' && browser) {
      const page = await paginaCej(browser);
      if (page) await capturar(page, capturas, 'atrapado');
    } else await esperar(1500); // que Chrome persista las cookies antes de cerrar
  } finally {
    resultado.segundos = Math.round((Date.now() - inicio) / 100) / 10;
    if (!proceso) {
      if (browser) await conTope(browser.disconnect(), 5000); // el Chrome es del worker
    } else {
      // Cierre ordenado (Browser.close) para que el perfil guarde las cookies de Radware
      if (browser) await conTope(browser.close(), 10000);
      await esperar(1000);
      if (proceso.exitCode === null) proceso.kill();
    }
  }
  return resultado;
}

main()
  .then((r) => {
    console.log(JSON.stringify(r));
    process.exit(r.resultado === 'atrapado' ? 2 : 0);
  })
  .catch((err) => {
    console.log(JSON.stringify({ resultado: 'error', detalle: String(err.message || err).slice(0, 300) }));
    process.exit(1);
  });
