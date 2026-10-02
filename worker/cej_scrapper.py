# Librerias: pip install -r requirements.txt  (ademas instalar Tesseract OCR en el sistema)
#
# ============================================================
# CEJ SCRAPPER - Consulta de expedientes en el portal CEJ del
# Poder Judicial (https://cej.pj.gob.pe) y monitoreo de nuevas
# actuaciones para el sistema de alertas/notificaciones.
#
# Reemplaza a `consultarExpediente()` (expedientesData.ts) de la
# demo alertas-judicial y genera notificaciones con la misma forma
# que la interfaz `Notificacion` de mockData.ts.
#
# Uso:
#   # Consulta por codigo de expediente (CUE)
#   python cej_scrapper.py consultar --codigo 00456-2024-0-1801-JR-CI-05 --parte PEREZ
#
#   # Consulta por filtros
#   python cej_scrapper.py consultar --distrito LIMA --instancia "JUZGADO ESPECIALIZADO" \
#       --especialidad CIVIL --anio 2024 --numero 456 --parte PEREZ
#
#   # Revisa todas las alertas activas y genera notificaciones
#   python cej_scrapper.py monitorear                     # usa alertas.json
#   python cej_scrapper.py monitorear --fuente supabase   # usa las tablas de Supabase
#
#   # Worker de la pagina: atiende las consultas pedidas desde la web al instante
#   # y revisa todas las alertas cada N horas (ver worker/README.md)
#   python cej_scrapper.py servir --intervalo-horas 12
#
# Variables de entorno (se leen tambien de worker/.env):
#   SUPABASE_URL               URL del proyecto Supabase (para --fuente supabase y servir)
#   SUPABASE_SERVICE_ROLE_KEY  Service role key (solo en el worker, nunca en el front)
#   IDENTIDAD_CLAVE            Clave AES de 32 bytes en base64, la misma que en Netlify
#   TESSERACT_CMD              Ruta a tesseract.exe si no esta en el PATH
#   CEJ_CHROME_PROFILE         Carpeta del perfil de Chrome (por defecto worker/chrome_perfil)
# ============================================================

import argparse
import base64
import hashlib
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import traceback
import unicodedata
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from PIL import Image, ImageFilter, ImageOps
import pytesseract
import urllib.request
from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

try:  # worker/.env con las credenciales (opcional)
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass

URL_BUSQUEDA = "https://cej.pj.gob.pe/cej/forms/busquedaform.html"

CAMPO_VACIO = "--SELECCIONAR"
PATRON_CUE = re.compile(r"^(\d{1,5})-(\d{4})-(\d+)-(\d{4})-([A-Z]{2})-([A-Z]{2})-(\d{1,2})$")

# Pausa entre consultas consecutivas para no saturar el portal
PAUSA_ENTRE_CONSULTAS = 10

# Las fechas del CEJ estan en hora de Peru
ZONA_PERU = timezone(timedelta(hours=-5))

# Captcha: intentos con OCR por consulta
MAX_INTENTOS_OCR = 12
MAX_INTENTOS_EXTERNOS = 3  # solo --captcha-manual
LARGO_CAPTCHA = 4
# Si el OCR no puede, la consulta se reprograma sola (el usuario nunca ve captchas)
REINTENTO_CAPTCHA_MIN = 15
# "Error de conexion" del CEJ: se reintenta hasta este numero de veces seguidas (cada
# REINTENTO_CAPTCHA_MIN) y luego la alerta pasa a error. Visto el 2026-10-01: el mismo DNI
# valido bien y minutos despues dio este error en otras alertas, asi que no indica datos malos.
MAX_ERRORES_TEMPORALES = 4
MENSAJE_REINTENTO_TEMPORAL = "El CEJ esta lento en este momento; se reintentara automaticamente (intento {n} de {total})."

# Verificacion de navegador de Radware en el worker: cuanto esperar a que alguien la
# complete en la ventana y, si nadie lo hace, cuanto pausar antes de volver a intentar
ESPERA_VERIFICACION_WORKER = 30 * 60
PAUSA_TRAS_VERIFICACION_MIN = 10

# Antes de pedir ayuda a una persona, se intenta pasar la verificacion con
# radware/pasar_radware.js (Chrome comun + Puppeteer, ver ese archivo). Requiere Node 18+
# y `npm install` en worker/radware. CEJ_RADWARE_PUPPETEER=0 lo desactiva.
SCRIPT_RADWARE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "radware", "pasar_radware.js")
ESPERA_RADWARE_PUPPETEER = 150
# Radware marca las sesiones nuevas abiertas muy seguidas (el hCaptcha pide entonces el
# desafio de imagenes): tras un bloqueo, Chrome se cierra y se reabre recien despues de
# esta pausa, hasta REAPERTURAS_RADWARE veces
PAUSA_REABRIR_RADWARE = 5 * 60
REAPERTURAS_RADWARE = 2


def _configurar_tesseract() -> None:
    ruta = os.getenv("TESSERACT_CMD")
    if not ruta and not shutil.which("tesseract"):
        # Instalaciones habituales en Windows (instalador UB Mannheim o MSYS2)
        candidatas = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
            r"C:\msys64\ucrt64\bin\tesseract.exe",
        ]
        ruta = next((c for c in candidatas if os.path.exists(c)), None)
    if ruta:
        pytesseract.pytesseract.tesseract_cmd = ruta


_configurar_tesseract()


def version_chrome() -> Optional[int]:
    """Version principal de Chrome instalada (CEJ_CHROME_VERSION la fuerza), para el
    comando `verificar`."""
    if os.getenv("CEJ_CHROME_VERSION"):
        return int(os.environ["CEJ_CHROME_VERSION"])
    if sys.platform == "win32":
        import winreg

        for raiz in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            try:
                with winreg.OpenKey(raiz, r"Software\Google\Chrome\BLBeacon") as clave:
                    return int(winreg.QueryValueEx(clave, "version")[0].split(".")[0])
            except OSError:
                continue
    return None

### Selectores del portal. Cada clave tiene varias alternativas (se usa la primera visible),
### asi si el PJ cambia un ID basta con agregar el nuevo aqui.

SELECTORES = {
    # Comunes
    "captcha_img": [(By.ID, "captcha_image")],
    "captcha_reload": [(By.ID, "btnReload"), (By.CSS_SELECTOR, "[onclick*='captcha']")],
    "captcha_error": [(By.ID, "codCaptchaError"), (By.CSS_SELECTOR, ".captchaError")],
    "sin_resultados": [(By.ID, "mensajeNoExisteExpedientes"), (By.CSS_SELECTOR, ".mensajeNoExiste")],
    # Tab "Por filtros"
    "distrito": [(By.ID, "distritoJudicial")],
    "instancia": [(By.ID, "organoJurisdiccional")],
    "especialidad": [(By.ID, "especialidad")],
    "anio": [(By.ID, "anio")],
    "numero": [(By.ID, "numeroExpediente")],
    "parte": [(By.ID, "parte")],
    "captcha_input": [(By.ID, "codigoCaptcha"), (By.ID, "txtCaptcha")],
    "consultar": [(By.ID, "consultarExpedientes"), (By.CSS_SELECTOR, "#tabs-1 button[type='button']")],
    # Tab "Por codigo de expediente"
    "tab_codigo": [(By.CSS_SELECTOR, "a[href='#tabs-2']"), (By.PARTIAL_LINK_TEXT, "digo de Expediente")],
    "cod_expediente": [(By.ID, "cod_expediente")],
    "cod_anio": [(By.ID, "cod_anio")],
    "cod_incidente": [(By.ID, "cod_incidente")],
    "cod_distprov": [(By.ID, "cod_distprov")],
    "cod_organo": [(By.ID, "cod_organo")],
    "cod_especialidad": [(By.ID, "cod_especialidad")],
    "cod_instancia": [(By.ID, "cod_instancia")],
    "cod_parte": [
        (By.ID, "parte"), 
        (By.ID, "parteCod"), 
        (By.CSS_SELECTOR, "input[placeholder*='RAZÓN SOCIAL' i]")
    ],
    "cod_consultar": [
        (By.ID, "consultarExpedientes"), 
        (By.ID, "consultarExpedientesCod"), 
        (By.CSS_SELECTOR, "#b_consultar button")
    ],
    "cod_captcha_input": [(By.ID, "codigoCaptchaCod"), (By.CSS_SELECTOR, "#tabs-2 input[name*='aptcha']")],
    "cod_captcha_img": [(By.ID, "captcha_image_cod"), (By.CSS_SELECTOR, "#tabs-2 img[id*='captcha']")],
    #"cod_consultar": [(By.ID, "consultarExpedientesCod"), (By.CSS_SELECTOR, "#tabs-2 button[type='button']")],
    # Listado de resultados -> boton de detalle
    "fila_resultado": [(By.CSS_SELECTOR, ".divGLRE0, .divGLRE1")],
    "boton_detalle": [
        (By.CSS_SELECTOR, "button[title*='detalle' i]"),
        (By.CSS_SELECTOR, "form[action*='detalle'] button"),
        (By.CSS_SELECTOR, ".celdCentro form button"),
    ],
    # Modal de Validación de Identidad
    "btn_consultar_inicial": [(By.ID, "consultarExpedientesCod"), (By.ID, "consultarExpedientes")],
    "modal_validacion": [(By.ID, "modalValidacion")],
    "val_tipo_doc": [(By.ID, "tipoDocumento")],
    "val_num_doc": [(By.ID, "numDocumento")],
    "val_cod_verificacion": [(By.ID, "codVerificacion")],
    "val_fecha_emision": [(By.ID, "fechaEmision")],
    "val_fecha_nacimiento": [(By.ID, "fechaNacimiento")],
    "btn_validar_consultante": [(By.ID, "btnValidarConsultante")],
    "loader_busqueda": [(By.ID, "loaderBusqueda")],
    "msj_error_validacion": [(By.ID, "mensajeErrorValidacion")],
}

### JS que extrae la ficha y las actuaciones de la pagina de detalle (detalleform.html).
### Se hace en el navegador para evitar decenas de round-trips de Selenium.

JS_EXTRAER_DETALLE = r"""
const limpiar = (t) => (t || '').replace(/\s+/g, ' ').trim();

// Ficha del expediente: pares etiqueta (.celdaGridN) -> valor (siguiente celda)
const ficha = {};
document.querySelectorAll('.celdaGridN, .celdaGridN2').forEach((lbl) => {
  const valor = lbl.nextElementSibling;
  const k = limpiar(lbl.textContent).replace(/:$/, '');
  if (k && valor) ficha[k] = limpiar(valor.textContent);
});

// Partes procesales
const partes = [];
document.querySelectorAll('.partes, #collapseTwo .panel-body > div').forEach((row) => {
  const celdas = [...row.children].map((c) => limpiar(c.textContent)).filter(Boolean);
  if (celdas.length >= 2 && !/^parte$/i.test(celdas[0])) partes.push(celdas);
});

// Seguimiento del expediente: un bloque por actuacion
let bloques = document.querySelectorAll('#collapseThree .pnl-seg');
if (!bloques.length) bloques = document.querySelectorAll('div[id^="pnlSeguimiento"]');
const actuaciones = [...bloques].map((b) => {
  const campos = {};
  b.querySelectorAll('.roptionss').forEach((lbl) => {
    const valor = lbl.nextElementSibling;
    const k = limpiar(lbl.textContent).replace(/:$/, '');
    if (k && valor) campos[k] = limpiar(valor.textContent);
  });
  const link = b.querySelector('a[href*="documento"], a.aDescarg');
  return { campos, url: link ? link.href : null };
});

return { ficha, partes, actuaciones };
"""


# ============================================================
# Modelos (espejo de las interfaces TypeScript de la demo)
# ============================================================


@dataclass
class FiltrosBusqueda:
    """Equivalente a `FiltrosBusqueda` de BuscadorExpedientes.tsx."""

    modo: str  # 'filtros' | 'codigo'
    parte: str
    distritoJudicial: str = CAMPO_VACIO
    instancia: str = CAMPO_VACIO
    especialidad: str = CAMPO_VACIO
    anio: str = CAMPO_VACIO
    nroExpediente: str = ""
    codigoExpediente: str = ""

    def validar(self) -> None:
        if not self.parte.strip():
            raise ValueError("Ingresa al menos un apellido o razon social (parte)")
        if self.modo == "codigo":
            if not PATRON_CUE.match(self.codigoExpediente.strip().upper()):
                raise ValueError("Formato invalido. Ej: 00456-2024-0-1801-JR-CI-05")
        elif self.modo == "filtros":
            faltantes = [
                nombre
                for nombre, valor in (
                    ("distritoJudicial", self.distritoJudicial),
                    ("instancia", self.instancia),
                    ("especialidad", self.especialidad),
                    ("anio", self.anio),
                )
                if not valor or valor == CAMPO_VACIO
            ]
            if not self.nroExpediente.strip():
                faltantes.append("nroExpediente")
            if faltantes:
                raise ValueError(f"Faltan filtros: {', '.join(faltantes)}")
        else:
            raise ValueError("modo debe ser 'filtros' o 'codigo'")


@dataclass
class IdentidadConsultante:
    """Datos del modal 'Validacion de identidad del consultante' del CEJ.
    Es la forma del JSON que la pagina guarda cifrado en `identidad_consultante`."""

    tipoDocumento: str  # 'DNI' | 'CE' (valores del select #tipoDocumento del portal)
    numeroDocumento: str
    fechaEmision: str  # AAAA-MM-DD
    fechaNacimiento: str  # AAAA-MM-DD
    codigoVerificacion: str = ""  # solo DNI

    @classmethod
    def desde_dict(cls, datos: dict) -> "IdentidadConsultante":
        campos = cls.__dataclass_fields__.keys()
        return cls(**{k: str(v) for k, v in datos.items() if k in campos})

    def validar(self) -> None:
        if self.tipoDocumento not in ("DNI", "CE"):
            raise ValueError("tipoDocumento debe ser 'DNI' o 'CE'")
        if not self.numeroDocumento.strip():
            raise ValueError("Falta el numero de documento")
        if self.tipoDocumento == "DNI" and not self.codigoVerificacion.strip():
            raise ValueError("Falta el codigo de verificacion del DNI")
        for nombre in ("fechaEmision", "fechaNacimiento"):
            try:
                datetime.strptime(getattr(self, nombre), "%Y-%m-%d")
            except ValueError:
                raise ValueError(f"{nombre} debe tener formato AAAA-MM-DD")

    @staticmethod
    def fecha_portal(iso: str) -> str:
        """AAAA-MM-DD -> ddmmaaaa, que es lo que se teclea en los <input type=date> del portal."""
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d%m%Y")


@dataclass
class Actuacion:
    fecha: Optional[str]  # ISO
    resolucion: str
    acto: str
    sumilla: str
    urlDocumento: Optional[str]
    campos: dict = field(default_factory=dict)  # todos los campos crudos del portal

    @property
    def huella(self) -> str:
        """Identificador estable de la actuacion para detectar novedades."""
        base = "|".join([self.fecha or "", self.resolucion, self.acto, self.sumilla])
        return hashlib.sha1(base.encode("utf-8")).hexdigest()


@dataclass
class ExpedienteEncontrado:
    """Equivalente a `ExpedienteEncontrado` de expedientesData.ts (+ datos extra del CEJ)."""

    codigo: str
    distritoJudicial: str
    organo: str
    parte: Optional[str]
    estadoProcesal: str
    ultimaActuacion: Optional[str]
    especialidad: str = ""
    juez: str = ""
    materia: str = ""
    ficha: dict = field(default_factory=dict)
    partes: list = field(default_factory=list)
    actuaciones: list = field(default_factory=list)  # list[Actuacion]

    def to_dict(self, incluir_actuaciones: bool = True) -> dict:
        d = asdict(self)
        if not incluir_actuaciones:
            d.pop("actuaciones")
        return d

    def ficha_para_guardar(self) -> dict:
        """Lo que se guarda en alertas_expedientes.ficha: la ficha y un resumen de las
        actuaciones (sin los campos crudos) para el PDF "Descargar expediente" de la pagina."""
        d = self.to_dict(incluir_actuaciones=False)
        d["actuaciones"] = [
            {"fecha": a.fecha, "resolucion": a.resolucion, "acto": a.acto, "sumilla": a.sumilla}
            for a in self.actuaciones
        ]
        return d


class CejError(Exception):
    pass


class ExpedienteNoEncontrado(CejError):
    pass


class CaptchaNoResuelto(CejError):
    """Ni el OCR ni el usuario resolvieron el captcha a tiempo."""


class IdentidadRechazada(CejError):
    """El CEJ no acepto los datos de identidad del consultante."""


class PortalNoDisponible(CejError):
    """El CEJ respondio con un error temporal ("Error de conexion. Intente nuevamente.")
    en el mismo lugar donde muestra los rechazos de identidad. No es culpa de la alerta."""


# Mensajes del modal de validacion que son fallas temporales del portal, no rechazos
PATRON_ERROR_TEMPORAL = re.compile(r"error de conexi|intente nuevamente|intentelo nuevamente|servicio no disponible", re.I)


class VerificacionNavegador(CejError):
    """Radware pide una verificacion de navegador que nadie completo. No es culpa de la
    alerta: el worker la devuelve a la cola y espera a que alguien la resuelva."""


# ============================================================
# Utilidades
# ============================================================


def normalizar(texto: str) -> str:
    """Mayusculas sin tildes ni espacios dobles, para comparar textos del portal."""
    sin_tildes = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sin_tildes).strip().upper()


def fecha_a_iso(texto: str) -> Optional[str]:
    """Convierte 'dd/mm/aaaa' o 'dd/mm/aaaa hh:mm' del CEJ a ISO 8601."""
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})(?:\s+(\d{2}):(\d{2}))?", texto or "")
    if not m:
        return None
    d, mes, a, h, mi = m.groups()
    return datetime(int(a), int(mes), int(d), int(h or 0), int(mi or 0), tzinfo=ZONA_PERU).isoformat()


def buscar_campo(campos: dict, *claves: str) -> str:
    """Busca un valor en un dict de etiquetas del portal ignorando tildes/mayusculas."""
    normalizados = {normalizar(k): v for k, v in campos.items()}
    for clave in claves:
        clave_n = normalizar(clave)
        for k, v in normalizados.items():
            if k.startswith(clave_n):
                return v
    return ""


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# Scraper
# ============================================================


def ruta_perfil_chrome() -> str:
    """Perfil persistente de Chrome (CEJ_CHROME_PROFILE, relativo a esta carpeta)."""
    perfil = os.getenv("CEJ_CHROME_PROFILE") or "chrome_perfil"
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), perfil)


def ruta_chrome() -> str:
    """chrome.exe instalado (CEJ_CHROME_EXE lo fuerza)."""
    candidatas = [
        os.getenv("CEJ_CHROME_EXE"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        shutil.which("google-chrome") or shutil.which("chrome"),
    ]
    ruta = next((c for c in candidatas if c and os.path.exists(c)), None)
    if not ruta:
        raise WebDriverException("No se encontro Chrome (definir CEJ_CHROME_EXE)")
    return ruta


def puerto_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def pestanas_chrome(puerto: int) -> Optional[list]:
    """Pestanas segun el endpoint HTTP de depuracion (no conecta CDP a la pagina)."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{puerto}/json/list", timeout=3) as r:
            return [t for t in json.load(r) if t.get("type") == "page"]
    except (OSError, ValueError):
        return None


def pasar_radware_con_puppeteer(puerto: int) -> Optional[dict]:
    """Corre radware/pasar_radware.js sobre el Chrome del worker (puerto de depuracion):
    espera a que Radware deje pasar y, si muestra el hCaptcha, hace el clic en "Soy
    humano". Devuelve su resultado ({"resultado": "directo"|"evitado"|"resuelto"|
    "atrapado"|"error", "hcaptcha": bool, ...}), o None si no esta disponible."""
    if os.getenv("CEJ_RADWARE_PUPPETEER", "1") == "0":
        return None
    node = shutil.which("node")
    modulos = os.path.join(os.path.dirname(SCRIPT_RADWARE), "node_modules")
    if not node or not os.path.isdir(modulos):
        print("[!] Sin Node o sin `npm install` en worker/radware: no se intenta pasar Radware solo", file=sys.stderr)
        return None
    try:
        salida = subprocess.run(
            [node, SCRIPT_RADWARE, "--puerto", str(puerto), "--timeout", str(ESPERA_RADWARE_PUPPETEER)],
            capture_output=True,
            text=True,
            timeout=ESPERA_RADWARE_PUPPETEER + 60,
        )
        resultado = json.loads(salida.stdout.strip().splitlines()[-1])
    except (subprocess.TimeoutExpired, ValueError, IndexError) as e:
        resultado = {"resultado": "error", "detalle": f"{type(e).__name__}: {e}"}
    if resultado.get("resultado") != "directo":
        print(f"[*] Radware: {json.dumps(resultado)}", file=sys.stderr)
    return resultado


class CejScraper:
    def __init__(
        self,
        headless: bool = False,
        max_intentos_ocr: int = MAX_INTENTOS_OCR,
        resolver_captcha: Optional[Callable[[bytes], Optional[str]]] = None,
        espera_verificacion: int = 300,
        al_pedir_verificacion: Optional[Callable[[], None]] = None,
    ):
        # El CEJ esta protegido por Radware Bot Manager, que bloquea el modo headless.
        # Por defecto se abre una ventana visible.
        self.headless = headless
        self.max_intentos_ocr = max_intentos_ocr
        # Solo para --captcha-manual: recibe el PNG del captcha y devuelve el texto
        # ("" = otra imagen). En el worker de la pagina no se usa: el usuario nunca ve captchas.
        self.resolver_captcha = resolver_captcha
        # Si Radware pide verificar el navegador, cuanto esperar a que alguien la complete
        # en la ventana, y a quien avisar (el worker lo publica en worker_estado)
        self.espera_verificacion = espera_verificacion
        self.al_pedir_verificacion = al_pedir_verificacion
        self.driver: Optional[webdriver.Chrome] = None
        self.chrome: Optional[subprocess.Popen] = None
        # Resultado de pasar_radware.js en el ultimo iniciar() (para diagnostico)
        self.radware: Optional[dict] = None
        # iniciar() deja el formulario cargado: la primera consulta no lo vuelve a pedir
        self._formulario_listo = False

    ### Ciclo de vida

    def __enter__(self):
        self.iniciar()
        return self

    def __exit__(self, *exc):
        self.cerrar()

    def iniciar(self) -> None:
        """Abre Chrome como un Chrome comun (perfil persistente + puerto de depuracion) en
        el formulario del CEJ, deja que Radware lo verifique sin nada conectado
        (pasar_radware.js) y recien entonces conecta Selenium. Un Chrome lanzado por
        Selenium/undetected_chromedriver hace que Radware marque la sesion y pida hCaptcha.
        El perfil (CEJ_CHROME_PROFILE) conserva las cookies de Radware entre ejecuciones."""
        puerto = puerto_libre()
        argumentos = [
            ruta_chrome(),
            f"--remote-debugging-port={puerto}",
            f"--user-data-dir={ruta_perfil_chrome()}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-popup-blocking",
            "--lang=es-PE",
            "--window-size=1366,768",
        ]
        if self.headless:
            argumentos += ["--headless=new", "--window-size=1400,1000"]
        self.chrome = subprocess.Popen(argumentos + [URL_BUSQUEDA], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        limite = time.time() + 30
        while pestanas_chrome(puerto) is None:
            if self.chrome.poll() is not None or time.time() > limite:
                self.cerrar()
                raise WebDriverException("Chrome no abrio (el perfil esta abierto en otra ventana?)")
            time.sleep(0.5)

        self.radware = pasar_radware_con_puppeteer(puerto)
        if self.radware is None:  # sin Node: al menos no conectar en plena verificacion
            limite = time.time() + 30
            while time.time() < limite:
                cej = [t for t in pestanas_chrome(puerto) or [] if "cej.pj.gob.pe" in t.get("url", "")]
                if cej and cej[0].get("title") and "radware" not in cej[0]["title"].lower():
                    break
                time.sleep(1.5)

        options = webdriver.ChromeOptions()
        options.debugger_address = f"127.0.0.1:{puerto}"
        # Selenium Manager descarga el chromedriver de la version de Chrome instalada
        self.driver = webdriver.Chrome(options=options)
        self.driver.set_page_load_timeout(60)
        self.driver.set_script_timeout(90)  # descarga de documentos (descargar_documento)
        self._formulario_listo = True

    def cerrar(self) -> None:
        # Con debugger_address, quit() solo detiene chromedriver: Chrome se cierra en orden
        # (Browser.close) para que el perfil guarde las cookies de Radware
        if self.driver:
            try:
                self.driver.execute_cdp_cmd("Browser.close", {})
            except Exception:
                pass
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
        if self.chrome:
            try:
                self.chrome.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.chrome.kill()
            self.chrome = None

    ### Helpers de Selenium

    def _buscar(self, clave: str, requerido: bool = True):
        for by, sel in SELECTORES[clave]:
            visibles = [e for e in self.driver.find_elements(by, sel) if self._visible(e)]
            if visibles:
                return visibles[0]
        if requerido:
            raise NoSuchElementException(f"No se encontro el elemento '{clave}' en {self.driver.current_url}")
        return None

    @staticmethod
    def _visible(elemento) -> bool:
        # Si el portal recarga la pagina entre find_elements e is_displayed, el elemento
        # queda obsoleto (stale): se trata como no visible y la espera sigue.
        try:
            return elemento.is_displayed()
        except StaleElementReferenceException:
            return False

    def _esperar(self, clave: str, timeout: int = 15):
        WebDriverWait(self.driver, timeout).until(lambda d: self._buscar(clave, requerido=False))
        return self._buscar(clave)

    def _escribir(self, clave: str, texto: str) -> None:
        el = self._buscar(clave)
        el.clear()
        el.send_keys(texto)

    def _seleccionar(self, clave: str, texto: str, timeout: int = 15) -> None:
        """Selecciona una opcion por texto visible (ignorando tildes). Espera a que el
        combo se llene, ya que instancia/especialidad se cargan por AJAX."""
        objetivo = normalizar(texto)

        def opcion_disponible(_):
            for op in Select(self._buscar(clave)).options:
                if normalizar(op.text) == objetivo:
                    return op.get_attribute("value")
            return False

        try:
            valor = WebDriverWait(self.driver, timeout).until(opcion_disponible)
        except TimeoutException:
            opciones = [op.text for op in Select(self._buscar(clave)).options]
            raise CejError(f"'{texto}' no existe en '{clave}'. Opciones: {opciones}")
        Select(self._buscar(clave)).select_by_value(valor)

    def _completar_validacion_identidad(self, identidad: IdentidadConsultante) -> None:
        """Interactúa con el modal de validación que aparece al intentar consultar."""

        # 1. Esperar a que el modal sea visible
        WebDriverWait(self.driver, 10).until(
            EC.visibility_of_element_located((By.ID, "modalValidacion"))
        )
        time.sleep(1) # Dar tiempo a la animación de Bootstrap

        # 2. Seleccionar el tipo de documento (dispara la visibilidad del código de verificación)
        Select(self._buscar("val_tipo_doc")).select_by_value(identidad.tipoDocumento)

        # 3. Llenar los datos de identidad
        self._escribir("val_num_doc", identidad.numeroDocumento)

        if identidad.tipoDocumento == "DNI":
            # El campo código de verificación solo es visible/requerido para DNI
            self._escribir("val_cod_verificacion", identidad.codigoVerificacion)

        self._escribir("val_fecha_emision", identidad.fecha_portal(identidad.fechaEmision))
        self._escribir("val_fecha_nacimiento", identidad.fecha_portal(identidad.fechaNacimiento))

        # 4. Enviar validación
        self._buscar("btn_validar_consultante").click()

    ### Navegacion

    def abrir_formulario(self) -> None:
        if not (self._formulario_listo and self.driver.current_url.startswith(URL_BUSQUEDA)):
            self.driver.get(URL_BUSQUEDA)
        self._formulario_listo = False
        self._esperar_verificacion_radware()
        self._esperar("captcha_img", timeout=20)

    def _esperar_verificacion_radware(self) -> None:
        """Radware muestra una pagina 'Verifying your browser...' antes del formulario.
        Con un perfil de Chrome ya verificado pasa sola en segundos; si pide resolver un
        desafio, se espera a que una persona lo complete en la ventana (p. ej. por
        escritorio remoto). Las cookies que deja duran meses en CEJ_CHROME_PROFILE."""
        limite = time.time() + self.espera_verificacion
        inicio = time.time()
        avisado = False
        reaperturas = 0
        while "radware" in (self.driver.title or "").lower():
            # Sesion marcada: reabrir al instante vuelve a caer en el hCaptcha. Se cierra
            # Chrome, se deja pasar un rato y se reabre (pasa por Radware sin Selenium)
            if reaperturas < REAPERTURAS_RADWARE and time.time() - inicio > 15:
                reaperturas += 1
                self.cerrar()
                print(f"[*] Radware bloqueo la sesion: se reabre Chrome en {PAUSA_REABRIR_RADWARE // 60} min", file=sys.stderr)
                time.sleep(PAUSA_REABRIR_RADWARE)
                self.iniciar()
                self._formulario_listo = False
                inicio = time.time()
                continue
            if time.time() > limite:
                raise VerificacionNavegador(
                    "El portal CEJ pide verificar el navegador (Radware). Completa la verificacion "
                    "en la ventana de Chrome del worker; queda guardada en CEJ_CHROME_PROFILE."
                )
            # Las verificaciones automaticas tardan unos segundos; si sigue ahi, necesita a alguien
            if not avisado and time.time() - inicio > 20:
                print("[!] El CEJ pide verificar el navegador: completala en la ventana de Chrome", file=sys.stderr)
                if self.al_pedir_verificacion:
                    self.al_pedir_verificacion()
                avisado = True
            time.sleep(2)

    ### Captcha

    def _capturar_captcha(self, clave_img: str) -> bytes:
        """PNG del captcha tomado directamente del elemento (evita errores de escala/DPI al
        recortar un screenshot completo)."""
        return self._buscar(clave_img).screenshot_as_png

    @staticmethod
    def _preprocesar_captcha(png: bytes) -> Image.Image:
        """El captcha del CEJ tiene letras de colores (incluso rojas y negras) sobre fondo
        rojo oscuro, cruzadas por una linea negra fina. Se marca como texto todo pixel que
        se aleje del color de fondo y luego una apertura morfologica borra la linea."""
        imagen = Image.open(io.BytesIO(png)).convert("RGB")
        imagen = imagen.crop((2, 2, imagen.width - 2, imagen.height - 2))  # borde negro
        crudo = imagen.tobytes()
        pixeles = list(zip(crudo[0::3], crudo[1::3], crudo[2::3]))
        fondo = Counter(pixeles).most_common(1)[0][0]
        mascara = Image.new("L", imagen.size, 255)
        mascara.putdata([0 if sum(abs(a - b) for a, b in zip(p, fondo)) > 60 else 255 for p in pixeles])
        mascara = mascara.resize((mascara.width * 3, mascara.height * 3), Image.LANCZOS)
        mascara = mascara.point(lambda v: 0 if v < 128 else 255)
        mascara = mascara.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11))
        return ImageOps.expand(mascara, border=20, fill=255)

    def _ocr_captcha(self, png: bytes) -> str:
        """Lee el captcha con Tesseract. Devuelve "" si la lectura no es creible, para
        recargar la imagen en vez de gastar un intento contra el portal."""
        config = "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        texto = pytesseract.image_to_string(self._preprocesar_captcha(png), config=config)
        texto = "".join(c for c in texto if c.isalnum()).upper()
        return texto if len(texto) == LARGO_CAPTCHA else ""

    def _recargar_captcha(self) -> None:
        boton = self._buscar("captcha_reload", requerido=False)
        if boton:
            boton.click()
        else:
            self.driver.refresh()
            self._esperar_verificacion_radware()
        time.sleep(1.5)

    def _obtener_texto_captcha(self, png: bytes, intentos: dict) -> str:
        """Primero OCR; cuando se agotan sus intentos, el resolvedor externo (consola)."""
        if intentos["ocr"] < self.max_intentos_ocr:
            intentos["ocr"] += 1
            texto = self._ocr_captcha(png)
            print(f"[*] Captcha OCR {intentos['ocr']}/{self.max_intentos_ocr}: {texto or '(ilegible)'}", file=sys.stderr)
            return texto
        if self.resolver_captcha and intentos["externos"] < MAX_INTENTOS_EXTERNOS:
            intentos["externos"] += 1
            print(f"[*] Captcha manual ({intentos['externos']}/{MAX_INTENTOS_EXTERNOS})", file=sys.stderr)
            texto = self.resolver_captcha(png)
            if texto is None:
                raise CaptchaNoResuelto("Nadie respondio el captcha a tiempo")
            return texto.strip().upper()
        raise CaptchaNoResuelto("No se pudo superar el captcha del CEJ")

    def _enviar_con_captcha(self, clave_img: str, clave_input: str, clave_boton: str, identidad: IdentidadConsultante) -> None:
        intentos = {"ocr": 0, "externos": 0}
        while True:
            texto = self._obtener_texto_captcha(self._capturar_captcha(clave_img), intentos)
            if len(texto) < LARGO_CAPTCHA:
                self._recargar_captcha()
                continue

            self._escribir(clave_input, texto)

            # Clic en el botón inicial que levanta el modal
            self._buscar(clave_boton).click()

            # Completar el modal con la identidad del usuario dueño de la alerta. A veces el
            # portal responde (alert, error de captcha) sin llegar a mostrarlo: no es fatal,
            # la respuesta se clasifica abajo y, si hace falta, se reintenta con otro captcha.
            try:
                self._completar_validacion_identidad(identidad)
            except WebDriverException as e:
                print(f"[*] No aparecio el modal de identidad ({type(e).__name__})", file=sys.stderr)

            resultado = self._esperar_respuesta_busqueda()
            if resultado == "ok":
                return
            if resultado == "sin_resultados":
                raise ExpedienteNoEncontrado("El CEJ no devolvió expedientes")
            if resultado.startswith("identidad_invalida"):
                mensaje = resultado.split(":", 1)[-1].strip()
                if PATRON_ERROR_TEMPORAL.search(normalizar(mensaje)):
                    raise PortalNoDisponible(mensaje)
                raise IdentidadRechazada(mensaje or "El CEJ rechazo los datos de identidad")

            # Si el captcha falla, hay que cerrar el modal (si sigue abierto) y recargar
            try:
                self.driver.execute_script("$('#modalValidacion').modal('hide');")
                time.sleep(1)
            except Exception:
                pass

            self._recargar_captcha()

    def _esperar_respuesta_busqueda(self, timeout: int = 30) -> str:
        """Devuelve 'ok', 'sin_resultados', 'identidad_invalida: <mensaje>' o 'captcha_invalido'."""

        def estado(_):
            try:
                return estado_actual()
            except StaleElementReferenceException:
                return False  # la pagina se estaba recargando: volver a mirar

        def estado_actual():
            try:
                self.driver.switch_to.alert.accept()
                return "captcha_invalido"
            except Exception:
                pass
            if self._buscar("fila_resultado", requerido=False) or "detalle" in self.driver.current_url:
                return "ok"
            if self._buscar("sin_resultados", requerido=False):
                return "sin_resultados"
            error = self._buscar("msj_error_validacion", requerido=False)
            if error and error.text.strip():
                return f"identidad_invalida: {error.text.strip()}"
            error = self._buscar("captcha_error", requerido=False)
            if error and error.text.strip():
                return "captcha_invalido"
            return False

        try:
            return WebDriverWait(self.driver, timeout).until(estado)
        except TimeoutException:
            return "captcha_invalido"

    ### Busqueda

    def _buscar_por_filtros(self, f: FiltrosBusqueda, identidad: IdentidadConsultante) -> None:
        self._seleccionar("distrito", f.distritoJudicial)
        self._seleccionar("instancia", f.instancia)
        self._seleccionar("especialidad", f.especialidad)
        self._seleccionar("anio", f.anio)
        self._escribir("numero", f.nroExpediente.strip())
        self._escribir("parte", f.parte.strip().upper())
        self._enviar_con_captcha("captcha_img", "captcha_input", "consultar", identidad)

    def _buscar_por_codigo(self, f: FiltrosBusqueda, identidad: IdentidadConsultante) -> None:
        m = PATRON_CUE.match(f.codigoExpediente.strip().upper())
        nro, anio, incidente, distprov, organo, especialidad, instancia = m.groups()

        # A veces el clic en la pestaña no se registra (pagina aun cargando o un elemento
        # encima): se reintenta y el ultimo intento se hace por JavaScript
        for intento in range(3):
            tab = self._buscar("tab_codigo")
            if intento < 2:
                tab.click()
            else:
                self.driver.execute_script("arguments[0].click();", tab)
            try:
                self._esperar("cod_expediente", timeout=10)
                break
            except TimeoutException:
                if intento == 2:
                    raise
                print("[*] La pestaña 'Por codigo' no abrio; se vuelve a intentar", file=sys.stderr)
        self._escribir("cod_expediente", nro.zfill(5))
        self._escribir("cod_anio", anio)
        self._escribir("cod_incidente", incidente)
        self._escribir("cod_distprov", distprov)
        self._escribir("cod_organo", organo)
        self._escribir("cod_especialidad", especialidad)
        self._escribir("cod_instancia", instancia.zfill(2))
        try:
            self._escribir("cod_parte", f.parte.strip().upper())
        except NoSuchElementException:
            print("[-] Campo 'parte' no encontrado en la pestaña. Intentando consultar sin él...", file=sys.stderr)

        # Algunas versiones del portal comparten un unico captcha entre ambas pestañas
        # Asegurar que el elemento esté en la vista y cargado
        time.sleep(1.5)
        
        img_clave = "cod_captcha_img" if self._buscar("cod_captcha_img", requerido=False) else "captcha_img"
        entrada_clave = "cod_captcha_input" if self._buscar("cod_captcha_input", requerido=False) else "captcha_input"
        
        img_elemento = self._buscar(img_clave)
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", img_elemento)
        time.sleep(0.5) # Breve pausa post-scroll
        
        self._enviar_con_captcha(img_clave, entrada_clave, "cod_consultar", identidad)

    def _abrir_detalle(self, f: FiltrosBusqueda) -> None:
        # El listado de resultados puede recargarse mientras se lee: se reintenta
        for intento in range(3):
            try:
                return self._abrir_detalle_una_vez(f)
            except StaleElementReferenceException:
                if intento == 2:
                    raise
                time.sleep(2)

    def _abrir_detalle_una_vez(self, f: FiltrosBusqueda) -> None:
        if "detalle" in self.driver.current_url:
            return
        filas = self.driver.find_elements(*SELECTORES["fila_resultado"][0])

        # Si hay varios resultados, preferir el que coincide con el numero buscado
        buscado = f.codigoExpediente.split("-")[0] if f.modo == "codigo" else f.nroExpediente
        buscado = buscado.strip().zfill(5)
        fila = next((r for r in filas if buscado in r.text), filas[0] if filas else None)

        boton = None
        if fila:
            for by, sel in SELECTORES["boton_detalle"]:
                encontrados = fila.find_elements(by, sel)
                if encontrados:
                    boton = encontrados[0]
                    break
        boton = boton or self._buscar("boton_detalle")
        boton.click()
        WebDriverWait(self.driver, 20).until(lambda d: "detalle" in d.current_url)
        WebDriverWait(self.driver, 20, ignored_exceptions=(StaleElementReferenceException,)).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".celdaGridN, .celdaGridN2"))
        )

    def _extraer_detalle(self, f: FiltrosBusqueda) -> ExpedienteEncontrado:
        crudo = self.driver.execute_script(JS_EXTRAER_DETALLE)
        ficha = crudo["ficha"]

        actuaciones = []
        for a in crudo["actuaciones"]:
            c = a["campos"]
            actuaciones.append(
                Actuacion(
                    fecha=fecha_a_iso(buscar_campo(c, "Fecha de Resolucion", "Fecha de Ingreso", "Fecha")),
                    resolucion=buscar_campo(c, "Resolucion"),
                    acto=buscar_campo(c, "Acto"),
                    sumilla=buscar_campo(c, "Sumilla", "Descripcion"),
                    urlDocumento=a["url"],
                    campos=c,
                )
            )

        fechas = [a.fecha for a in actuaciones if a.fecha]
        codigo = buscar_campo(ficha, "Expediente N") or (
            f.codigoExpediente.strip().upper()
            if f.modo == "codigo"
            else f"{f.nroExpediente.strip().zfill(5)}-{f.anio}"
        )

        return ExpedienteEncontrado(
            codigo=codigo,
            distritoJudicial=buscar_campo(ficha, "Distrito Judicial") or f.distritoJudicial,
            organo=buscar_campo(ficha, "Organo Jurisdiccional"),
            parte=f.parte.strip().upper(),
            estadoProcesal=buscar_campo(ficha, "Estado") or "EN TRAMITE",
            ultimaActuacion=max(fechas) if fechas else None,
            especialidad=buscar_campo(ficha, "Especialidad"),
            juez=buscar_campo(ficha, "Juez"),
            materia=buscar_campo(ficha, "Materia"),
            ficha=ficha,
            partes=crudo["partes"],
            actuaciones=actuaciones,
        )

    def descargar_documento(self, url: str, max_mb: int = 20) -> Optional[bytes]:
        """Descarga el documento de una actuacion usando la sesion abierta del navegador
        (cookies del CEJ ya validadas). Solo sirve inmediatamente despues de consultar():
        fuera de esa sesion el enlace del CEJ no abre. Devuelve None si no es un PDF."""
        try:
            b64 = self.driver.execute_async_script(
                """
                const [url, max, listo] = arguments;
                fetch(url, {credentials: 'include'})
                  .then((r) => r.ok ? r.arrayBuffer() : null)
                  .then((buf) => {
                    if (!buf || buf.byteLength > max) return listo(null);
                    const bytes = new Uint8Array(buf);
                    let bin = '';
                    for (let i = 0; i < bytes.length; i += 0x8000)
                      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                    listo(btoa(bin));
                  })
                  .catch(() => listo(null));
                """,
                url,
                max_mb * 1024 * 1024,
            )
        except Exception as e:
            print(f"[!] No se pudo descargar {url}: {e}", file=sys.stderr)
            return None
        datos = base64.b64decode(b64) if b64 else b""
        if not datos.startswith(b"%PDF"):
            print(f"[!] El documento {url} no devolvio un PDF", file=sys.stderr)
            return None
        return datos

    def consultar(self, filtros: FiltrosBusqueda, identidad: IdentidadConsultante) -> ExpedienteEncontrado:
        """Busca el expediente en el CEJ y devuelve su ficha con todas las actuaciones."""
        filtros.validar()
        identidad.validar()
        self.abrir_formulario()
        if filtros.modo == "codigo":
            self._buscar_por_codigo(filtros, identidad)
        else:
            self._buscar_por_filtros(filtros, identidad)
        self._abrir_detalle(filtros)
        return self._extraer_detalle(filtros)


# ============================================================
# Deteccion de novedades -> notificaciones
# ============================================================


def detectar_novedades(alerta: dict, expediente: ExpedienteEncontrado) -> list:
    """Compara las actuaciones actuales con las huellas guardadas en la alerta y devuelve
    las notificaciones a crear (misma forma que `Notificacion` de la demo)."""
    if not alerta.get("revisada"):
        # Primera revision: se guarda la linea base sin notificar todo el historial.
        # (No basta con mirar actuacionesVistas: un expediente nuevo puede no tener
        # actuaciones y su primera actuacion si debe notificarse.)
        return []
    conocidas = set(alerta.get("actuacionesVistas") or [])

    notificaciones = []
    for act in expediente.actuaciones:
        if act.huella in conocidas:
            continue
        tipo = act.acto or act.resolucion or "una nueva actuacion"
        detalle = f" {act.sumilla}" if act.sumilla else ""
        notificaciones.append(
            {
                "id": f"not_{alerta['id']}_{act.huella[:12]}",
                "alertaId": alerta["id"],
                "titulo": "¡Nuevo documento detectado!",
                "mensaje": f"Se registro {tipo.lower()} en el expediente N° {expediente.codigo}.{detalle}",
                "fechaHora": act.fecha or ahora_iso(),
                "leida": False,
                "expediente": expediente.codigo,
                "urlDocumento": act.urlDocumento,
            }
        )
    return notificaciones


def filtros_desde_alerta(alerta: dict) -> FiltrosBusqueda:
    datos = dict(alerta.get("filtros") or {})
    if not datos:
        datos = {"modo": "codigo", "codigoExpediente": alerta["valor"], "parte": alerta.get("parte") or ""}
    campos_validos = FiltrosBusqueda.__dataclass_fields__.keys()
    return FiltrosBusqueda(**{k: v for k, v in datos.items() if k in campos_validos})


def descifrar_identidad(valor: str, perfil_id: str) -> IdentidadConsultante:
    """Inverso de lib/cifrado.ts de la pagina (AES-256-GCM, perfil_id como dato asociado)."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    clave = base64.b64decode(os.getenv("IDENTIDAD_CLAVE") or "")
    if len(clave) != 32:
        raise CejError("Define IDENTIDAD_CLAVE (32 bytes en base64, la misma que en Netlify)")
    version, iv, datos = valor.split(":")
    if version != "v1":
        raise CejError(f"Formato de cifrado desconocido: {version}")
    texto = AESGCM(clave).decrypt(base64.b64decode(iv), base64.b64decode(datos), perfil_id.encode())
    return IdentidadConsultante.desde_dict(json.loads(texto))


# ============================================================
# Almacenamiento de alertas: archivo JSON local o Supabase
# ============================================================


class AlmacenJson:
    """alertas.json = {"identidad": {...}, "alertas": [Alerta...], "notificaciones": [Notificacion...]}
    Cada alerta necesita `id`, `valor` (CUE) y `parte`, o bien `filtros` (FiltrosBusqueda).
    La identidad puede ir en la raiz (para todas) o dentro de cada alerta."""

    def __init__(self, ruta: str, identidad: Optional[IdentidadConsultante] = None):
        self.ruta = ruta
        self.identidad = identidad
        if os.path.exists(ruta):
            with open(ruta, encoding="utf-8") as fh:
                self.datos = json.load(fh)
        else:
            self.datos = {"alertas": [], "notificaciones": []}
        self.datos.setdefault("notificaciones", [])

    def alertas_a_revisar(self) -> list:
        return [
            {**a, "revisada": bool(a.get("ficha"))}
            for a in self.datos["alertas"]
            if a.get("tipo", "expediente") == "expediente" and a.get("estado") != "pausado"
        ]

    def identidad_de(self, alerta: dict) -> Optional[IdentidadConsultante]:
        datos = alerta.get("identidad") or self.datos.get("identidad")
        if datos:
            return IdentidadConsultante.desde_dict(datos)
        return self.identidad

    def actualizar_alerta(self, alerta_id: str, cambios: dict) -> None:
        for a in self.datos["alertas"]:
            if a["id"] == alerta_id:
                a.update(cambios)
        self._guardar()

    def agregar_notificaciones(self, notificaciones: list, alerta: dict) -> None:
        existentes = {n["id"] for n in self.datos["notificaciones"]}
        nuevas = [n for n in notificaciones if n["id"] not in existentes]
        self.datos["notificaciones"] = nuevas + self.datos["notificaciones"]
        self._guardar()

    def guardar_documento(self, alerta: dict, nombre: str, pdf: bytes) -> str:
        carpeta = os.path.join(os.path.dirname(os.path.abspath(self.ruta)), "documentos", alerta["id"])
        os.makedirs(carpeta, exist_ok=True)
        ruta = os.path.join(carpeta, f"{nombre}.pdf")
        with open(ruta, "wb") as fh:
            fh.write(pdf)
        return ruta

    def _guardar(self) -> None:
        with open(self.ruta, "w", encoding="utf-8") as fh:
            json.dump(self.datos, fh, ensure_ascii=False, indent=2)


class AlmacenSupabase:
    """Lee/escribe `alertas_expedientes`, `notificaciones`, `identidad_consultante` y
    `worker_estado` via PostgREST, y sube los PDF al bucket `documentos-expedientes`
    (ver supabase/migrations/002, 003 y 004)."""

    BUCKET = "documentos-expedientes"
    COLUMNAS = {
        "estado": "estado",
        "detalle": "detalle",
        "ultimaRevision": "ultima_revision",
        "ultimaActuacion": "ultima_actuacion",
        "actuacionesVistas": "actuaciones_vistas",
        "ficha": "ficha",
        "error": "ultimo_error",
        "consultaEstado": "consulta_estado",
        "consultaSolicitada": "consulta_solicitada",
    }

    def __init__(self):
        import requests  # solo se necesita en este modo

        self.requests = requests
        url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise CejError("Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para usar Supabase")
        self.url = url.rstrip("/")
        self.rest = f"{self.url}/rest/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        # Identifica a esta computadora en worker_estado (puede haber varios workers)
        self.worker_id = os.getenv("CEJ_WORKER_ID") or socket.gethostname()

    def _req(self, metodo: str, ruta: str, prefer: str = "return=minimal", **kwargs):
        headers = {**self.headers, "Prefer": prefer} if prefer else self.headers
        r = self.requests.request(metodo, f"{self.rest}/{ruta}", headers=headers, timeout=30, **kwargs)
        if r.status_code >= 400:
            raise CejError(f"Supabase {metodo} {ruta}: {r.status_code} {r.text}")
        return r.json() if r.text else None

    @staticmethod
    def _mapear(f: dict) -> dict:
        return {
            "id": f["id"],
            "perfilId": f["perfil_id"],
            "valor": f["valor"],
            "parte": f.get("parte"),
            "filtros": f.get("filtros"),
            "estado": f["estado"],
            "revisada": f.get("ficha") is not None,
            "actuacionesVistas": f.get("actuaciones_vistas") or [],
            "error": f.get("ultimo_error"),
        }

    def alertas_a_revisar(self) -> list:
        filas = self._req(
            "GET",
            "alertas_expedientes",
            prefer="",
            params={"select": "*", "estado": "neq.pausado", "tipo": "eq.expediente", "order": "ultima_revision.asc"},
        )
        return [self._mapear(f) for f in filas]

    def encolar_vencidas(self, intervalo_horas: float) -> int:
        """Revision periodica: pone en la cola (con prioridad baja) las alertas que no se
        revisan hace `intervalo_horas`. Asi todo pasa por la misma cola y varios workers
        pueden repartirse el trabajo sin consultar dos veces lo mismo."""
        limite = (datetime.now(timezone.utc) - timedelta(hours=intervalo_horas)).isoformat()
        filas = self._req(
            "PATCH",
            "alertas_expedientes",
            prefer="return=representation",
            params={
                "select": "id",
                "estado": "neq.pausado",
                "tipo": "eq.expediente",
                "consulta_estado": "in.(ok,no_encontrado,error)",
                "ultima_revision": f"lt.{limite}",
            },
            json={"consulta_estado": "pendiente", "prioridad": 1, "consulta_solicitada": ahora_iso()},
        )
        return len(filas or [])

    def tomar_pendientes(self, limite: int = 1) -> list:
        """Siguiente(s) alerta(s) de la cola: primero lo que pidio el usuario (prioridad 0),
        luego las revisiones periodicas; se saltan los reintentos programados a futuro.
        Cada una se reclama con un PATCH condicionado, asi dos workers nunca toman la misma."""
        filas = self._req(
            "GET",
            "alertas_expedientes",
            prefer="",
            params={
                "select": "id",
                "consulta_estado": "eq.pendiente",
                "estado": "neq.pausado",
                "consulta_solicitada": f"lte.{ahora_iso()}",
                "order": "prioridad.asc,consulta_solicitada.asc",
                "limit": str(limite),
            },
        )
        tomadas = []
        for f in filas:
            reclamada = self._req(
                "PATCH",
                "alertas_expedientes",
                prefer="return=representation",
                params={"id": f"eq.{f['id']}", "consulta_estado": "eq.pendiente"},
                json={"consulta_estado": "consultando"},
            )
            if reclamada:
                tomadas.append(self._mapear(reclamada[0]))
        return tomadas

    def tomar_companeras(self, alerta: dict) -> list:
        """Otras alertas en cola del mismo expediente (aunque su reintento sea a futuro),
        reclamadas igual que en tomar_pendientes. Quien llama decide cuales comparten la
        consulta y devuelve el resto con liberar()."""
        filas = self._req(
            "GET",
            "alertas_expedientes",
            prefer="",
            params={
                "select": "id",
                "consulta_estado": "eq.pendiente",
                "estado": "neq.pausado",
                "valor": f"eq.{alerta['valor']}",
                "id": f"neq.{alerta['id']}",
            },
        )
        tomadas = []
        for f in filas:
            reclamada = self._req(
                "PATCH",
                "alertas_expedientes",
                prefer="return=representation",
                params={"id": f"eq.{f['id']}", "consulta_estado": "eq.pendiente"},
                json={"consulta_estado": "consultando"},
            )
            if reclamada:
                tomadas.append(self._mapear(reclamada[0]))
        return tomadas

    def liberar(self, alertas: list) -> None:
        """Devuelve a la cola alertas reclamadas que al final no se consultaron."""
        for a in alertas:
            self._req(
                "PATCH",
                "alertas_expedientes",
                params={"id": f"eq.{a['id']}", "consulta_estado": "eq.consultando"},
                json={"consulta_estado": "pendiente"},
            )

    def liberar_consultando(self) -> None:
        """Si el worker se cerro a mitad de una consulta, la devuelve a la cola."""
        self._req(
            "PATCH",
            "alertas_expedientes",
            params={"consulta_estado": "eq.consultando"},
            json={"consulta_estado": "pendiente"},
        )

    def identidad_de(self, alerta: dict) -> Optional[IdentidadConsultante]:
        filas = self._req(
            "GET",
            "identidad_consultante",
            prefer="",
            params={"select": "datos_cifrados", "perfil_id": f"eq.{alerta['perfilId']}"},
        )
        if not filas:
            return None
        return descifrar_identidad(filas[0]["datos_cifrados"], alerta["perfilId"])

    def actualizar_alerta(self, alerta_id: str, cambios: dict) -> None:
        cuerpo = {self.COLUMNAS[k]: v for k, v in cambios.items() if k in self.COLUMNAS}
        self._req("PATCH", "alertas_expedientes", params={"id": f"eq.{alerta_id}"}, json=cuerpo)

    def agregar_notificaciones(self, notificaciones: list, alerta: dict) -> None:
        if not notificaciones:
            return
        filas = [
            {
                "perfil_id": alerta["perfilId"],
                "alerta_id": n["alertaId"],
                "huella": n["id"],
                "titulo": n["titulo"],
                "mensaje": n["mensaje"],
                "fecha_hora": n["fechaHora"],
                "leida": False,
                "expediente": n["expediente"],
                "url_documento": n["urlDocumento"],
                "documento_path": n.get("documentoPath"),
            }
            for n in notificaciones
        ]
        # ignore-duplicates evita repetir la misma actuacion si el monitoreo se re-ejecuta
        self._req(
            "POST",
            "notificaciones",
            prefer="return=minimal,resolution=ignore-duplicates",
            params={"on_conflict": "alerta_id,huella"},
            json=filas,
        )

    def guardar_documento(self, alerta: dict, nombre: str, pdf: bytes) -> str:
        """Sube el PDF a <perfil_id>/<alerta_id>/<nombre>.pdf; la politica del bucket solo
        deja leer a cada usuario su propia carpeta."""
        ruta = f"{alerta['perfilId']}/{alerta['id']}/{nombre}.pdf"
        r = self.requests.post(
            f"{self.url}/storage/v1/object/{self.BUCKET}/{ruta}",
            headers={**self.headers, "Content-Type": "application/pdf", "x-upsert": "true"},
            data=pdf,
            timeout=60,
        )
        if r.status_code >= 400:
            raise CejError(f"Supabase Storage: {r.status_code} {r.text}")
        return ruta

    def latido(self, estado: str = "activo", mensaje: Optional[str] = None) -> None:
        """Publica que este worker sigue vivo (la pagina avisa si no hay ninguno activo)."""
        self._req(
            "POST",
            "worker_estado",
            prefer="return=minimal,resolution=merge-duplicates",
            json={"id": self.worker_id, "estado": estado, "mensaje": mensaje, "actualizado": ahora_iso()},
        )


# ============================================================
# Comandos
# ============================================================


def descargar_documentos(almacen, scraper: CejScraper, alerta: dict, notificaciones: list) -> None:
    """Baja el PDF de cada actuacion nueva mientras la sesion del CEJ sigue abierta y lo
    guarda para que el usuario lo descargue desde la pagina, sin pasar por el CEJ."""
    for n in notificaciones:
        if not n.get("urlDocumento"):
            continue
        pdf = scraper.descargar_documento(n["urlDocumento"])
        if not pdf:
            continue
        try:
            n["documentoPath"] = almacen.guardar_documento(alerta, n["id"], pdf)
        except Exception as e:  # la notificacion se crea igual, con el enlace del CEJ
            print(f"[!] No se pudo guardar el documento de {n['expediente']}: {e}", file=sys.stderr)


def _clave_consulta(alerta: dict, identidad: IdentidadConsultante) -> str:
    """Dos alertas con la misma clave dan exactamente la misma consulta en el CEJ."""
    return json.dumps([asdict(filtros_desde_alerta(alerta)), asdict(identidad)], sort_keys=True)


def agrupar_companeras(almacen, alerta: dict) -> list:
    """Alertas en cola del mismo expediente, con los mismos filtros y la misma identidad
    que `alerta` (p. ej. varias cuentas de la misma persona). Se consultan una sola vez:
    validar el mismo DNI varias veces seguidas hace que el CEJ responda "Error de
    conexion". Las que no coinciden vuelven a la cola."""
    if not hasattr(almacen, "tomar_companeras"):
        return []
    try:
        clave = _clave_consulta(alerta, almacen.identidad_de(alerta))
    except Exception:
        return []
    candidatas = almacen.tomar_companeras(alerta)
    grupo, otras = [], []
    for c in candidatas:
        try:
            igual = _clave_consulta(c, almacen.identidad_de(c)) == clave
        except Exception:
            igual = False
        (grupo if igual else otras).append(c)
    if otras:
        almacen.liberar(otras)
    return grupo


def _resultado_error_temporal(alerta: dict, base: dict, e: Exception) -> dict:
    """Cambios para una alerta tras un "Error de conexion" del CEJ: reintento en
    REINTENTO_CAPTCHA_MIN, o error tras MAX_ERRORES_TEMPORALES seguidos. El numero de
    intento viaja en el mensaje que ve el usuario (ultimo_error); una consulta exitosa lo
    borra y el conteo vuelve a empezar."""
    previo = re.search(r"intento (\d+) de", alerta.get("error") or "")
    intento = int(previo.group(1)) + 1 if previo else 1
    if intento >= MAX_ERRORES_TEMPORALES:
        print(f"[!] {alerta['valor']}: el CEJ fallo {intento} veces seguidas ({e}); la alerta pasa a error", file=sys.stderr)
        return {
            **base,
            "consultaEstado": "error",
            "error": "El CEJ no respondio tras varios intentos (\"Error de conexion\"). Vuelve a "
            "consultar mas tarde; si sigue pasando, revisa los datos de tu DNI.",
        }
    reintento = datetime.now(timezone.utc) + timedelta(minutes=REINTENTO_CAPTCHA_MIN)
    print(
        f"[*] {alerta['valor']}: error temporal del CEJ ({e}), intento {intento} de {MAX_ERRORES_TEMPORALES}; "
        f"se reintenta a las {reintento:%H:%M} UTC",
        file=sys.stderr,
    )
    return {
        "consultaEstado": "pendiente",
        "consultaSolicitada": reintento.isoformat(),
        "error": MENSAJE_REINTENTO_TEMPORAL.format(n=intento, total=MAX_ERRORES_TEMPORALES),
    }


def revisar_alerta(almacen, scraper: CejScraper, alerta: dict, companeras: Optional[list] = None) -> int:
    """Consulta una alerta en el CEJ, registra novedades y deja el resultado en la alerta.
    El usuario nunca interviene: si el captcha no sale, la consulta se reprograma sola.
    `companeras` (ver agrupar_companeras) reciben el mismo resultado sin otra consulta.
    Devuelve el numero de notificaciones creadas."""
    grupo = [alerta] + list(companeras or [])
    base = {"ultimaRevision": ahora_iso()}

    def a_todas(cambios) -> None:
        for a in grupo:
            almacen.actualizar_alerta(a["id"], cambios(a) if callable(cambios) else cambios)

    try:
        identidad = almacen.identidad_de(alerta)
    except Exception as e:  # clave incorrecta o datos corruptos
        identidad = None
        print(f"[!] {alerta['valor']}: no se pudo leer la identidad: {e}", file=sys.stderr)
    if not identidad:
        a_todas({**base, "consultaEstado": "error", "error": "Falta registrar la identidad del consultante"})
        return 0
    if len(grupo) > 1:
        print(f"[*] {alerta['valor']}: una consulta para {len(grupo)} alertas (misma identidad)", file=sys.stderr)

    a_todas({"consultaEstado": "consultando"})
    try:
        expediente = scraper.consultar(filtros_desde_alerta(alerta), identidad)
    except ExpedienteNoEncontrado:
        print(f"[*] {alerta['valor']}: el CEJ no encontro el expediente con esa parte", file=sys.stderr)
        a_todas(
            {
                **base,
                "consultaEstado": "no_encontrado",
                "error": "El CEJ no encontro el expediente con esa parte. Revisa el codigo y los apellidos.",
            }
        )
        return 0
    except CaptchaNoResuelto:
        reintento = datetime.now(timezone.utc) + timedelta(minutes=REINTENTO_CAPTCHA_MIN)
        print(f"[*] {alerta['valor']}: captcha no resuelto, se reintenta a las {reintento:%H:%M} UTC", file=sys.stderr)
        a_todas(
            {
                "consultaEstado": "pendiente",
                "consultaSolicitada": reintento.isoformat(),
                "error": "El CEJ esta lento en este momento; se reintentara automaticamente.",
            }
        )
        return 0
    except PortalNoDisponible as e:
        a_todas(lambda a: _resultado_error_temporal(a, base, e))
        return 0
    except IdentidadRechazada as e:
        print(f"[!] {alerta['valor']}: el CEJ rechazo la identidad ({e})", file=sys.stderr)
        a_todas({**base, "consultaEstado": "error", "error": f"El CEJ rechazo tu identidad: {e}"})
        return 0
    except VerificacionNavegador:
        # No es un problema de la alerta: vuelve a la cola tal cual y el worker se detiene
        a_todas({"consultaEstado": "pendiente"})
        raise
    except WebDriverException as e:
        # Fallo del navegador o del portal a mitad de la consulta (pagina recargada,
        # timeout...): es temporal, se reprograma como un captcha no resuelto
        reintento = datetime.now(timezone.utc) + timedelta(minutes=REINTENTO_CAPTCHA_MIN)
        print(f"[!] {alerta['valor']}: {type(e).__name__}; se reintenta a las {reintento:%H:%M} UTC", file=sys.stderr)
        print(traceback.format_exc(limit=6).split("Stacktrace:")[0], file=sys.stderr)
        a_todas(
            {
                "consultaEstado": "pendiente",
                "consultaSolicitada": reintento.isoformat(),
                "error": "El CEJ esta lento en este momento; se reintentara automaticamente.",
            }
        )
        return 0
    except Exception as e:  # CejError o datos invalidos
        print(f"[!] {alerta['valor']}: {type(e).__name__}: {e}", file=sys.stderr)
        print(traceback.format_exc(limit=6), file=sys.stderr)
        mensaje = str(e).splitlines()[0] if str(e) else type(e).__name__
        a_todas({**base, "consultaEstado": "error", "error": f"No se pudo consultar el CEJ: {mensaje}"[:300]})
        return 0

    # Cada alerta tiene sus propias actuaciones vistas, notificaciones y copias de los PDF
    # (el PDF se baja del CEJ una sola vez)
    pdfs = {}
    descargar = scraper.descargar_documento

    def descargar_una_vez(url, *args, **kwargs):
        if url not in pdfs:
            pdfs[url] = descargar(url, *args, **kwargs)
        return pdfs[url]

    scraper.descargar_documento = descargar_una_vez
    total = 0
    try:
        for a in grupo:
            notificaciones = detectar_novedades(a, expediente)
            descargar_documentos(almacen, scraper, a, notificaciones)
            almacen.agregar_notificaciones(notificaciones, a)
            cambios = {
                **base,
                "consultaEstado": "ok",
                "ultimaActuacion": expediente.ultimaActuacion,
                "detalle": " · ".join(filter(None, [expediente.distritoJudicial, expediente.organo, expediente.parte])),
                "ficha": expediente.ficha_para_guardar(),
                "actuacionesVistas": [act.huella for act in expediente.actuaciones],
                "error": None,
            }
            if notificaciones:
                cambios["estado"] = "encontrado"
            almacen.actualizar_alerta(a["id"], cambios)
            total += len(notificaciones)
    finally:
        del scraper.descargar_documento  # vuelve al metodo de la clase
    print(
        f"[+] {expediente.codigo}: {total} novedad(es)" + (f" en {len(grupo)} alertas" if len(grupo) > 1 else ""),
        file=sys.stderr,
    )
    return total


def monitorear(almacen, scraper: CejScraper) -> dict:
    """Una ronda sobre todas las alertas activas (comando `monitorear`, sin cola)."""
    alertas = almacen.alertas_a_revisar()
    resumen = {"revisadas": 0, "notificaciones": 0, "errores": 0}
    print(f"[*] {len(alertas)} alerta(s) por revisar", file=sys.stderr)

    for i, alerta in enumerate(alertas):
        if i:
            time.sleep(PAUSA_ENTRE_CONSULTAS)
        try:
            resumen["notificaciones"] += revisar_alerta(almacen, scraper, alerta)
            resumen["revisadas"] += 1
        except VerificacionNavegador:
            raise
        except Exception as e:  # p. ej. Supabase no responde
            print(f"[!] {alerta['valor']}: {type(e).__name__}: {e}", file=sys.stderr)
            resumen["errores"] += 1

    return resumen


def servir(
    almacen: AlmacenSupabase, headless: bool, intervalo_horas: float, espera: float, intentos_ocr: int = MAX_INTENTOS_OCR
) -> None:
    """Worker de la pagina. Cada `espera` segundos:
    - publica su latido en worker_estado,
    - encola las alertas que no se revisan hace `intervalo_horas`,
    - atiende la cola de a una alerta (primero lo pedido por usuarios).
    Chrome solo se abre mientras hay trabajo. Si el CEJ pide verificar el navegador,
    espera a que alguien la complete en la ventana y, si nadie lo hace, reintenta luego."""
    almacen.liberar_consultando()
    ultimo_latido = ultima_encolada = 0.0
    print(f"[*] Worker CEJ '{almacen.worker_id}' iniciado (revision cada {intervalo_horas} h)", file=sys.stderr)

    def pedir_verificacion() -> None:
        almacen.latido("verificacion_navegador", "El CEJ pide verificar el navegador en la ventana de Chrome del worker")

    while True:
        try:
            if time.time() - ultimo_latido > 60:
                almacen.latido()
                ultimo_latido = time.time()
            if intervalo_horas > 0 and time.time() - ultima_encolada > 60:
                encoladas = almacen.encolar_vencidas(intervalo_horas)
                if encoladas:
                    print(f"[*] {encoladas} alerta(s) encolada(s) para revision periodica", file=sys.stderr)
                ultima_encolada = time.time()

            pendientes = almacen.tomar_pendientes()
            if pendientes:
                with CejScraper(
                    headless=headless,
                    max_intentos_ocr=intentos_ocr,
                    espera_verificacion=ESPERA_VERIFICACION_WORKER,
                    al_pedir_verificacion=pedir_verificacion,
                ) as scraper:
                    while pendientes:
                        alerta = pendientes[0]
                        print(f"[*] Consultando {alerta['valor']}", file=sys.stderr)
                        almacen.latido()
                        ultimo_latido = time.time()
                        revisar_alerta(almacen, scraper, alerta, agrupar_companeras(almacen, alerta))
                        time.sleep(PAUSA_ENTRE_CONSULTAS)
                        pendientes = almacen.tomar_pendientes()
        except KeyboardInterrupt:
            raise
        except VerificacionNavegador as e:
            print(f"[!] {e} Reintento en {PAUSA_TRAS_VERIFICACION_MIN} min.", file=sys.stderr)
            try:
                pedir_verificacion()
            except Exception:
                pass
            time.sleep(PAUSA_TRAS_VERIFICACION_MIN * 60)
        except Exception as e:  # sin internet, Chrome cerrado, Supabase caido...
            print(f"[!] Worker: {type(e).__name__}: {e}", file=sys.stderr)
            time.sleep(30)
        time.sleep(espera)


def verificar_instalacion() -> bool:
    """Comando `verificar`: revisa esta PC, el .env y la base de datos sin consultar el CEJ
    ni mostrar ningun secreto."""
    ok = True

    def check(nombre: str, bien: bool, detalle: str = "") -> None:
        nonlocal ok
        ok &= bien
        print(f"  [{'OK' if bien else 'FALTA'}] {nombre}{' - ' + detalle if detalle else ''}")

    print("\n== Esta computadora")
    try:
        check("Tesseract OCR", True, str(pytesseract.get_tesseract_version()))
    except Exception:
        check("Tesseract OCR", False, "instalalo o define TESSERACT_CMD")
    chrome = version_chrome()
    check("Google Chrome", chrome is not None, f"version {chrome}" if chrome else "instalalo o define CEJ_CHROME_VERSION")
    perfil = ruta_perfil_chrome()
    node = shutil.which("node")
    check("Node.js (pasar Radware)", bool(node) and os.path.isdir(os.path.join(os.path.dirname(SCRIPT_RADWARE), "node_modules")),
          "" if node else "instalar Node 18+ y correr `npm install` en worker/radware")
    print(f"  [--] Perfil de Chrome: {perfil} ({'ya existe' if os.path.isdir(perfil) else 'se creara al arrancar'})")

    print("\n== worker/.env")
    for var in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "IDENTIDAD_CLAVE"):
        valor = os.getenv(var) or (os.getenv("NEXT_PUBLIC_SUPABASE_URL") if var == "SUPABASE_URL" else None)
        check(var, bool(valor), "definida" if valor else "vacia")
    try:
        clave_ok = len(base64.b64decode(os.getenv("IDENTIDAD_CLAVE") or "")) == 32
    except Exception:
        clave_ok = False
    check("IDENTIDAD_CLAVE con formato valido (32 bytes base64)", clave_ok)
    if not ok:
        return False

    print("\n== Supabase")
    try:
        almacen = AlmacenSupabase()
        r = almacen.requests.get(f"{almacen.rest}/", headers=almacen.headers, timeout=30)
        check("Conexion con la service role key", r.status_code == 200, f"HTTP {r.status_code}")
        rutas = r.json().get("paths", {}) if r.status_code == 200 else {}
        for tabla in ("alertas_expedientes", "notificaciones", "identidad_consultante", "worker_estado"):
            check(f"Tabla {tabla}", f"/{tabla}" in rutas)
        check("Funciones de la migracion 004", "/rpc/solicitar_revision_alerta" in rutas)
        b = almacen.requests.get(
            f"{almacen.url}/storage/v1/bucket/{almacen.BUCKET}", headers=almacen.headers, timeout=30
        )
        check(f"Bucket {almacen.BUCKET}", b.status_code == 200 and not b.json().get("public"), "privado" if b.ok else f"HTTP {b.status_code}")

        # La clave debe ser la misma de Netlify: se prueba descifrando una identidad real
        filas = almacen._req("GET", "identidad_consultante", prefer="", params={"select": "perfil_id,datos_cifrados", "limit": "1"})
        if filas:
            try:
                descifrar_identidad(filas[0]["datos_cifrados"], filas[0]["perfil_id"])
                check("IDENTIDAD_CLAVE igual a la de Netlify", True, "descifra las identidades guardadas")
            except Exception:
                check("IDENTIDAD_CLAVE igual a la de Netlify", False, "NO descifra las identidades: revisa que sea identica")
        else:
            print("  [--] Aun no hay identidades registradas: no se puede comparar la clave con la de Netlify")
        pendientes = almacen._req("GET", "alertas_expedientes", prefer="", params={"select": "id", "consulta_estado": "eq.pendiente"})
        print(f"  [--] Alertas en cola: {len(pendientes or [])}")
    except Exception as e:
        check("Supabase", False, f"{type(e).__name__}: {e}"[:200])

    print("\nTodo listo: ejecuta `python cej_scrapper.py servir`" if ok else "\nCorrige lo marcado como FALTA.")
    return ok


def construir_filtros(args) -> FiltrosBusqueda:
    if args.codigo:
        return FiltrosBusqueda(modo="codigo", codigoExpediente=args.codigo, parte=" ".join(args.parte))
    return FiltrosBusqueda(
        modo="filtros",
        distritoJudicial=args.distrito or CAMPO_VACIO,
        instancia=args.instancia or CAMPO_VACIO,
        especialidad=args.especialidad or CAMPO_VACIO,
        anio=args.anio or CAMPO_VACIO,
        nroExpediente=args.numero or "",
        parte=" ".join(args.parte),
    )


def construir_identidad(args) -> Optional[IdentidadConsultante]:
    if not args.doc_numero:
        return None
    return IdentidadConsultante(
        tipoDocumento=args.doc_tipo,
        numeroDocumento=args.doc_numero,
        codigoVerificacion=args.doc_verificacion or "",
        fechaEmision=args.doc_emision or "",
        fechaNacimiento=args.doc_nacimiento or "",
    )


def captcha_por_consola(png: bytes) -> str:
    Image.open(io.BytesIO(png)).show()
    return input("Escribe el captcha que ves en la imagen (vacio = otra imagen): ").strip()


def agregar_args_identidad(parser) -> None:
    g = parser.add_argument_group("identidad del consultante (la que pide el modal del CEJ)")
    g.add_argument("--doc-tipo", choices=["DNI", "CE"], default="DNI")
    g.add_argument("--doc-numero")
    g.add_argument("--doc-verificacion", help="Codigo de verificacion del DNI")
    g.add_argument("--doc-emision", help="Fecha de emision AAAA-MM-DD")
    g.add_argument("--doc-nacimiento", help="Fecha de nacimiento AAAA-MM-DD")


def main() -> int:
    parser = argparse.ArgumentParser(description="Scraper del CEJ del Poder Judicial del Peru")
    parser.add_argument("--headless", action="store_true", help="Chrome sin ventana (Radware suele bloquearlo)")
    parser.add_argument("--captcha-manual", action="store_true", help="Escribir el captcha a mano en vez de OCR")
    sub = parser.add_subparsers(dest="comando", required=True)

    p_consultar = sub.add_parser("consultar", help="Consulta un expediente y lo imprime en JSON")
    # nargs="+" permite escribir la parte con espacios aunque no se pongan comillas
    p_consultar.add_argument("--parte", required=True, nargs="+", help="Apellido o razon social de una parte")
    p_consultar.add_argument("--codigo", help="CUE, ej. 00456-2024-0-1801-JR-CI-05")
    p_consultar.add_argument("--distrito")
    p_consultar.add_argument("--instancia")
    p_consultar.add_argument("--especialidad")
    p_consultar.add_argument("--anio")
    p_consultar.add_argument("--numero")
    agregar_args_identidad(p_consultar)

    p_monitorear = sub.add_parser("monitorear", help="Revisa las alertas activas y genera notificaciones")
    p_monitorear.add_argument("--fuente", choices=["json", "supabase"], default="json")
    p_monitorear.add_argument("--archivo", default="alertas.json", help="Archivo de alertas para --fuente json")
    agregar_args_identidad(p_monitorear)

    p_servir = sub.add_parser("servir", help="Worker de la pagina: cola de consultas + monitoreo periodico (Supabase)")
    p_servir.add_argument("--intervalo-horas", type=float, default=12, help="Cada cuanto revisar todas las alertas (0 = nunca)")
    p_servir.add_argument("--espera", type=float, default=5, help="Segundos entre revisiones de la cola")
    p_servir.add_argument(
        "--intentos-ocr", type=int, default=MAX_INTENTOS_OCR, help="Intentos de OCR por consulta antes de reprogramarla"
    )

    sub.add_parser("verificar", help="Revisa esta PC, worker/.env y la base de datos (no consulta el CEJ)")

    args = parser.parse_args()
    # La consola de Windows usa cp1252 por defecto; el JSON sale en UTF-8 para quien lo consuma
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    if args.comando == "verificar":
        return 0 if verificar_instalacion() else 1

    # Validar antes de abrir Chrome
    filtros = identidad = almacen = None
    try:
        if args.comando in ("consultar", "monitorear"):
            identidad = construir_identidad(args)
            if identidad:
                identidad.validar()
        if args.comando == "consultar":
            filtros = construir_filtros(args)
            filtros.validar()
            if not identidad:
                raise ValueError("Indica la identidad del consultante con --doc-numero, --doc-emision, etc.")
        elif args.comando == "monitorear":
            almacen = AlmacenSupabase() if args.fuente == "supabase" else AlmacenJson(args.archivo, identidad)
        else:
            almacen = AlmacenSupabase()
    except ValueError as e:
        print(f"[!] Datos invalidos: {e}", file=sys.stderr)
        return 2
    except CejError as e:
        print(f"[!] {e}", file=sys.stderr)
        return 1

    if args.comando == "servir":
        try:
            servir(almacen, args.headless, args.intervalo_horas, args.espera, args.intentos_ocr)
        except KeyboardInterrupt:
            pass
        return 0

    opciones = {"max_intentos_ocr": 0, "resolver_captcha": captcha_por_consola} if args.captcha_manual else {}
    try:
        with CejScraper(headless=args.headless, **opciones) as scraper:
            if filtros:
                expediente = scraper.consultar(filtros, identidad)
                print(json.dumps(expediente.to_dict(), ensure_ascii=False, indent=2))
            else:
                print(json.dumps(monitorear(almacen, scraper), ensure_ascii=False))
    except ExpedienteNoEncontrado as e:
        print(f"[!] {e}", file=sys.stderr)
        return 3
    except CejError as e:
        print(f"[!] {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
