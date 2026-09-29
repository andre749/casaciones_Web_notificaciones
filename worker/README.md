# Worker del CEJ (alertas de expedientes)

La pagina (Netlify) no puede abrir Chrome, asi que las consultas al CEJ las hace este
worker desde una computadora aparte. Se comunican solo a traves de Supabase:

```
Usuario ──> Pagina (Netlify) ──> Supabase <── Worker (esta carpeta, PC con Chrome) ──> cej.pj.gob.pe
             registra alerta      cola,        toma la cola, resuelve el captcha (OCR),
             ve notificaciones    alertas,     valida identidad, guarda la ficha, las
             descarga PDFs        notific.,    nuevas actuaciones y sus PDF
                                  documentos
```

- El usuario **nunca** ve una ventana del CEJ ni un captcha: Chrome se abre en la
  computadora del worker. Si el OCR no lee el captcha, la consulta se reprograma sola
  15 minutos despues.
- Cada `--intervalo-horas` las alertas vuelven a la cola (con menos prioridad que lo que
  piden los usuarios). Las actuaciones nuevas se guardan en `notificaciones` con su PDF
  (bucket `documentos-expedientes`) y el usuario ve un aviso al iniciar sesion.
- Se pueden correr varios workers (en distintas PCs) contra la misma base: cada consulta
  se reclama una sola vez. Cada uno publica su latido en `worker_estado`.

## Requisitos de la computadora

- Windows 10/11 (o Linux con escritorio), **encendida y con la sesion iniciada**:
  el portal bloquea Chrome en modo headless, necesita una ventana real.
- Conexion a internet peruana/residencial de preferencia: Radware (antibots del CEJ)
  suele bloquear IPs de centros de datos.
- Google Chrome actualizado.
- Python 3.12+.
- Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki (instalador de Windows).
  Si no esta en `C:\Program Files\Tesseract-OCR`, define `TESSERACT_CMD` en `.env`.

## Instalacion

```bash
git clone <repo> && cd casaciones_Web_notificaciones/worker
python -m pip install -r requirements.txt
copy .env.example .env      # y completar los valores
```

`.env`:

| Variable | De donde sale |
|---|---|
| `SUPABASE_URL` | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > service_role (secreta) |
| `IDENTIDAD_CLAVE` | La **misma** que en Netlify (ver abajo) |

Prueba manual (abre Chrome y deja la ventana a la vista):

```bash
python cej_scrapper.py servir --intervalo-horas 12
```

## Dejarlo corriendo (Programador de tareas de Windows)

1. Programador de tareas > Crear tarea.
2. General: "Ejecutar solo cuando el usuario haya iniciado sesion".
3. Desencadenador: "Al iniciar la sesion".
4. Accion: iniciar `iniciar_worker.bat` de esta carpeta.
5. Configuracion: desmarcar "Detener la tarea si se ejecuta durante mas de 3 dias".
6. Configurar la PC para que no se suspenda (Energia > Suspender: Nunca).

Los mensajes quedan en `worker.log`. Si la PC se apaga, las consultas se quedan en cola y la
pagina avisa al usuario que se haran cuando el servicio vuelva.

## Verificacion de navegador del CEJ (Radware)

El CEJ esta protegido por Radware. La primera vez que un perfil de Chrome entra, puede
mostrar "Verifying your browser" con un desafio que **debe resolver una persona**. Al
resolverlo, Radware deja cookies (`__uzma`, `__uzmb`, ...) que duran ~6 meses en
`CEJ_CHROME_PROFILE`, y desde ahi el worker entra solo.

Primera vez en cada computadora:

```bash
python cej_scrapper.py servir
```

Cuando se abra Chrome, si aparece la verificacion, resuelvela en esa ventana. Queda guardada.

Si mas adelante Radware vuelve a pedirla (cookies vencidas, cambio de red o de IP):
- el worker deja la ventana abierta hasta 30 min esperando que alguien la resuelva
  (en la PC o por escritorio remoto, p. ej. AnyDesk),
- publica `verificacion_navegador` en la tabla `worker_estado` (visible en Supabase),
- las consultas quedan en cola sin marcarse con error; si nadie la resuelve, reintenta
  cada 10 min.

No copies la carpeta `chrome_perfil` a otra PC: contiene tus sesiones de Google y las
cookies de Radware suelen no valer en otra computadora o red.

## Configuracion unica de la pagina

1. Supabase > SQL Editor: ejecutar, en orden, `supabase/migrations/002_alertas_expedientes.sql`,
   `003_identidad_y_cola_cej.sql` y `004_documentos_y_estado_worker.sql`.
2. Generar la clave de cifrado (una sola vez; si se pierde, los usuarios deben volver a
   registrar su identidad):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. Netlify > Site configuration > Environment variables: `IDENTIDAD_CLAVE=<esa clave>` y
   volver a desplegar. Poner la misma clave en `worker/.env`.

## Otros comandos

```bash
# Consulta suelta (imprime la ficha en JSON)
python cej_scrapper.py consultar --codigo <CODIGO-DE-EXPEDIENTE> --parte <APELLIDOS O RAZON SOCIAL> \
    --doc-numero 12345678 --doc-verificacion 0 --doc-emision 2020-01-31 --doc-nacimiento 1990-05-20

# Una ronda de monitoreo sobre alertas.json (sin Supabase; ver alertas.example.json)
python cej_scrapper.py monitorear --archivo alertas.json

# --captcha-manual: escribir el captcha en la consola en vez de OCR
```
