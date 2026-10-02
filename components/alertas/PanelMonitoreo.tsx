'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase-browser'
import ModalIdentidad from '@/components/monitoreo/ModalIdentidad'
import ModalNuevaAlerta from '@/components/alertas/ModalNuevaAlerta'
import { AlertaExpediente, IdentidadResumen, NotificacionExpediente, WorkerEstado } from '@/lib/types'

// ============================================================
// CASOS EN MONITOREO (pestaña de /poder-judicial)
// Misma apariencia que el dashboard de la demo, pero con los datos reales:
// alertas y notificaciones de Supabase, consultas hechas por el worker del CEJ
// (worker/cej_scrapper.py). Funciona igual que /monitoreo.
// ============================================================

// Mientras hay consultas en curso se refresca seguido; en reposo, cada 30 s
const REFRESCO_ACTIVO_MS = 3000
const REFRESCO_REPOSO_MS = 30000
// El worker publica un latido por minuto; sin latido reciente se considera fuera de linea
const LATIDO_VIGENTE_MS = 5 * 60 * 1000

type Filtro = 'todos' | 'activo' | 'encontrado' | 'pausado'

interface PanelMonitoreoProps {
  /** Informa el total de casos para el contador de la pestaña */
  onTotalChange?: (total: number) => void
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

function formatearTiempo(fechaIso: string) {
  const diffMinutos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 60000)
  if (diffMinutos < 1) return 'Hace un momento'
  if (diffMinutos < 60) return `Hace ${diffMinutos} min`
  const diffHoras = Math.floor(diffMinutos / 60)
  if (diffHoras < 24) return `Hace ${diffHoras} h`
  return new Date(fechaIso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function enCurso(a: AlertaExpediente) {
  return ['pendiente', 'consultando', 'requiere_captcha'].includes(a.consulta_estado)
}

function esReintento(a: AlertaExpediente) {
  return a.consulta_estado === 'pendiente' && new Date(a.consulta_solicitada).getTime() > Date.now()
}

export default function PanelMonitoreo({ onTotalChange }: PanelMonitoreoProps) {
  const { user, loading } = useAuth()

  const [alertas, setAlertas] = useState<AlertaExpediente[]>([])
  const [notificaciones, setNotificaciones] = useState<NotificacionExpediente[]>([])
  const [servicioDisponible, setServicioDisponible] = useState(true)
  const [cejNoDisponible, setCejNoDisponible] = useState(false)
  const [identidad, setIdentidad] = useState<IdentidadResumen | null>(null)
  const [cargando, setCargando] = useState(true)

  const [filtroEstado, setFiltroEstado] = useState<Filtro>('todos')
  const [busquedaLocal, setBusquedaLocal] = useState('')
  const [alertaAEliminar, setAlertaAEliminar] = useState<AlertaExpediente | null>(null)
  const [toastAccion, setToastAccion] = useState<string | null>(null)
  const [alertaCreada, setAlertaCreada] = useState<string | null>(null)
  const [modalNueva, setModalNueva] = useState(false)
  const [modalIdentidad, setModalIdentidad] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null)
  // Al registrar la identidad desde "Nueva Alerta", seguir despues con el alta
  const [continuarConAlta, setContinuarConAlta] = useState(false)

  const hayActividad = useRef(false)

  const mostrarToast = (texto: string, ms = 3500) => {
    setToastAccion(texto)
    setTimeout(() => setToastAccion(null), ms)
  }

  const cargar = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const [a, n, w] = await Promise.all([
      supabase.from('alertas_expedientes').select('*').eq('perfil_id', user.id).order('fecha_registro', { ascending: false }),
      supabase.from('notificaciones').select('*').eq('perfil_id', user.id).order('fecha_hora', { ascending: false }).limit(50),
      supabase.from('worker_estado').select('*'),
    ])
    const lista = (a.data ?? []) as AlertaExpediente[]
    setAlertas(lista)
    setNotificaciones((n.data ?? []) as NotificacionExpediente[])
    const limite = Date.now() - LATIDO_VIGENTE_MS
    const vigentes = ((w.data ?? []) as WorkerEstado[]).filter((x) => new Date(x.actualizado).getTime() > limite)
    const hayActivo = vigentes.some((x) => x.estado === 'activo')
    setServicioDisponible(hayActivo)
    // El worker esta bien, pero el CEJ responde "Error de conexion": no es culpa nuestra
    setCejNoDisponible(!hayActivo && vigentes.some((x) => x.estado === 'cej_no_disponible'))
    onTotalChange?.(lista.length)
    hayActividad.current = lista.some(
      (x) =>
        x.estado !== 'pausado' &&
        (x.consulta_estado === 'consultando' || (x.consulta_estado === 'pendiente' && !esReintento(x)))
    )
  }, [user, onTotalChange])

  // Carga inicial + refresco periodico
  useEffect(() => {
    if (!user) return
    let activo = true
    let timer: ReturnType<typeof setTimeout>

    const ciclo = async () => {
      await cargar()
      if (!activo) return
      setCargando(false)
      timer = setTimeout(ciclo, hayActividad.current ? REFRESCO_ACTIVO_MS : REFRESCO_REPOSO_MS)
    }

    fetch('/api/identidad')
      .then((r) => r.json())
      .then((d) => activo && setIdentidad(d.identidad ?? null))
      .catch(() => {})
    ciclo()

    return () => {
      activo = false
      clearTimeout(timer)
    }
  }, [user, cargar])

  // ---------------- Acciones (via funciones de la BD, migracion 004) ----------------

  const solicitarRevision = async (alerta: AlertaExpediente) => {
    const supabase = createClient()
    const { error } = await supabase.rpc('solicitar_revision_alerta', { p_alerta: alerta.id })
    if (error) mostrarToast(error.message, 4500)
    else mostrarToast(`Revisando "${alerta.valor}" en el Poder Judicial...`)
    await cargar()
  }

  const handleToggle = async (alerta: AlertaExpediente) => {
    const pausar = alerta.estado !== 'pausado'
    const supabase = createClient()
    const { error } = await supabase.rpc('pausar_alerta', { p_alerta: alerta.id, p_pausar: pausar })
    if (error) mostrarToast(error.message, 4500)
    else mostrarToast(`Monitoreo de "${alerta.valor}" ${pausar ? 'pausado' : 'reactivado'}.`)
    await cargar()
  }

  const confirmarEliminar = async (alerta: AlertaExpediente) => {
    const supabase = createClient()
    await supabase.from('alertas_expedientes').delete().eq('id', alerta.id)
    setAlertaAEliminar(null)
    mostrarToast(`Se canceló el monitoreo de "${alerta.valor}".`, 4000)
    await cargar()
  }

  const descargarPdf = async (alerta: AlertaExpediente) => {
    setGenerandoPdf(alerta.id)
    try {
      const { descargarPdfExpediente } = await import('@/lib/pdfExpediente')
      descargarPdfExpediente(alerta)
    } finally {
      setGenerandoPdf(null)
    }
  }

  const marcarLeidas = async (ids: string[]) => {
    if (!ids.length) return
    const supabase = createClient()
    await supabase.from('notificaciones').update({ leida: true }).in('id', ids)
    setNotificaciones((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, leida: true } : n)))
  }

  // ---------------- Estados ----------------

  if (loading) return null

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700/80 bg-[#0d1527]/50 px-6 py-16 text-center">
        <h3 className="text-base font-semibold text-white">Inicia sesión para monitorear expedientes</h3>
        <p className="mt-1.5 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Registra tus expedientes y te avisaremos cuando se publique una nueva actuación en el Poder Judicial.
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
        >
          Ingresar
        </Link>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="py-16 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/30 border-t-amber-500" />
      </div>
    )
  }

  // Conteo de métricas
  const totalCasos = alertas.length
  const activos = alertas.filter((a) => a.estado === 'activo').length
  const encontrados = alertas.filter((a) => a.estado === 'encontrado').length
  const pausados = alertas.filter((a) => a.estado === 'pausado').length
  const noLeidas = notificaciones.filter((n) => !n.leida)

  // Filtrado de la lista
  const alertasFiltradas = alertas.filter((a) => {
    const coincideEstado = filtroEstado === 'todos' || a.estado === filtroEstado
    const texto = [a.valor, a.parte, a.detalle, a.ficha?.juez].filter(Boolean).join(' ').toLowerCase()
    return coincideEstado && texto.includes(busquedaLocal.toLowerCase())
  })

  const abrirNuevaAlerta = () => {
    if (identidad) {
      setModalNueva(true)
    } else {
      setContinuarConAlta(true)
      setModalIdentidad(true)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast de confirmación de acción */}
      {toastAccion && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121c33] border border-amber-500/50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in max-w-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-xs text-slate-200">{toastAccion}</span>
        </div>
      )}

      {/* Toast de alerta creada */}
      {alertaCreada && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121c33] border border-amber-500/60 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-black/80 flex items-start gap-3.5 max-w-md animate-in fade-in slide-in-from-top-2">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white flex items-center gap-2">
              <span>Alerta de Monitoreo Activada</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </p>
            <p className="text-xs text-amber-300 font-mono mt-0.5 truncate">{alertaCreada}</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Estamos consultando el expediente en el Poder Judicial; la ficha aparecerá en unos minutos. Te avisaremos
              en la <strong>campana superior (🔔)</strong> cuando haya una nueva actuación.
            </p>
          </div>
          <button onClick={() => setAlertaCreada(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {alertaAEliminar && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <IconoPapelera className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">¿Cancelar monitoreo?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dejaremos de revisar el expediente <span className="font-mono text-slate-200">{alertaAEliminar.valor}</span> en
              el Poder Judicial. No recibirás más alertas de nuevas actuaciones para este caso.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAlertaAEliminar(null)}
                className="px-3.5 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Volver
              </button>
              <button
                onClick={() => confirmarEliminar(alertaAEliminar)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition"
              >
                Sí, cancelar monitoreo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Cabecera del Dashboard --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-white tracking-tight">Casos en Monitoreo</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
              {totalCasos} en total
            </span>
            <button
              onClick={() => setModalIdentidad(true)}
              className={`px-2.5 py-0.5 text-[11px] rounded-full border transition ${
                identidad
                  ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                  : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              {identidad ? `Identidad: ${identidad.tipo_documento} ${identidad.documento_mascara}` : 'Registrar identidad'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Revisamos tus expedientes en el CEJ del Poder Judicial y te avisamos de cada nueva actuación.
          </p>
        </div>

        <button
          onClick={abrirNuevaAlerta}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          <IconoMas className="w-4 h-4" />
          Nueva Alerta
        </button>
      </div>

      {!servicioDisponible && alertas.some((a) => a.estado !== 'pausado' && enCurso(a) && !esReintento(a)) && (
        <div className="p-3 rounded-xl border border-slate-700/80 bg-[#121c33]/70 text-[11px] text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
          {cejNoDisponible
            ? 'La página del Poder Judicial (CEJ) no está respondiendo en este momento. Tus expedientes en cola se consultarán apenas vuelva; puedes cerrar esta página.'
            : 'El servicio de consultas está temporalmente fuera de línea. Tus expedientes en cola se consultarán apenas vuelva; puedes cerrar esta página.'}
        </div>
      )}

      {totalCasos === 0 ? (
        /* --- Estado vacío: usuario sin casos monitoreados --- */
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-[#0d1527]/50 px-6 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <IconoCampana className="w-7 h-7" />
          </div>
          <h3 className="mt-5 text-base font-semibold text-white">Aún no tienes casos en monitoreo</h3>
          <p className="mt-1.5 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Crea una alerta sobre un expediente y revisaremos el portal del Poder Judicial por ti. Te avisaremos en la
            campana superior apenas se registre una nueva actuación.
          </p>
          <button
            onClick={abrirNuevaAlerta}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
          >
            <IconoMas className="w-4 h-4" />
            Crear mi primera alerta
          </button>
          <p className="mt-4 text-[11px] text-slate-500">
            {identidad
              ? 'Monitorear expedientes es gratis.'
              : 'Primero te pediremos los datos de tu DNI o carné de extranjería: el CEJ los exige en cada consulta.'}
          </p>
        </div>
      ) : (
        <>
          {/* --- Barra de Filtros y Búsqueda Rápida --- */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-[#0d1527] border border-slate-800/80 rounded-xl text-xs overflow-x-auto">
              <BotonFiltro activo={filtroEstado === 'todos'} onClick={() => setFiltroEstado('todos')} clase="bg-[#1a2640] text-white">
                Todos ({totalCasos})
              </BotonFiltro>
              <BotonFiltro
                activo={filtroEstado === 'activo'}
                onClick={() => setFiltroEstado('activo')}
                clase="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Activos ({activos})
              </BotonFiltro>
              <BotonFiltro
                activo={filtroEstado === 'encontrado'}
                onClick={() => setFiltroEstado('encontrado')}
                clase="bg-blue-500/20 text-blue-300 border border-blue-500/40"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Con novedades ({encontrados})
              </BotonFiltro>
              <BotonFiltro activo={filtroEstado === 'pausado'} onClick={() => setFiltroEstado('pausado')} clase="bg-slate-700/60 text-slate-200">
                Pausados ({pausados})
              </BotonFiltro>
            </div>

            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <IconoLupa className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={busquedaLocal}
                onChange={(e) => setBusquedaLocal(e.target.value)}
                placeholder="Filtrar mis casos..."
                className="w-full pl-9 pr-3 py-2 bg-[#121c33] border border-[#233352] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* --- Tabla de Casos --- */}
          {alertasFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-[#0d1527]/50 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-400 mx-auto flex items-center justify-center">
                <IconoLupa className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No se encontraron casos con este filtro</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {busquedaLocal ? `No hay alertas que coincidan con "${busquedaLocal}".` : 'No tienes alertas en esta categoría.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/80 bg-[#0d1527]/80 backdrop-blur-md overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#121c33] border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Expediente</th>
                      <th className="px-5 py-3.5 font-semibold">Estado procesal</th>
                      <th className="px-5 py-3.5 font-semibold">Estado de rastreo</th>
                      <th className="px-5 py-3.5 font-semibold">Última revisión</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {alertasFiltradas.map((alerta) => {
                      const pausada = alerta.estado === 'pausado'
                      const ocupada = enCurso(alerta) && !esReintento(alerta)
                      const conError = !pausada && ['error', 'no_encontrado'].includes(alerta.consulta_estado)
                      return (
                        <tr key={alerta.id} className="hover:bg-[#121c33]/50 transition group align-top">
                          {/* Expediente */}
                          <td className="px-5 py-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                📄
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-white font-mono truncate max-w-xs sm:max-w-sm">{alerta.valor}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                                  {alerta.ficha
                                    ? [alerta.ficha.organo, alerta.ficha.juez].filter(Boolean).join(' · ')
                                    : `Parte: ${alerta.parte ?? '—'}`}
                                </p>
                                {conError && alerta.ultimo_error && (
                                  <p className="text-[11px] text-red-300 mt-1 max-w-xs sm:max-w-md whitespace-normal">
                                    {alerta.ultimo_error}
                                  </p>
                                )}
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Registrado: {new Date(alerta.fecha_registro).toLocaleDateString('es-PE')}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Estado procesal (del CEJ) */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                              {alerta.ficha?.estadoProcesal || '—'}
                            </span>
                          </td>

                          {/* Estado de rastreo */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <EstadoRastreo alerta={alerta} />
                          </td>

                          {/* Última revisión */}
                          <td className="px-5 py-4 whitespace-nowrap text-slate-400 text-[11px]">
                            {alerta.ficha ? formatearTiempo(alerta.ultima_revision) : 'Aún no'}
                          </td>

                          {/* Acciones */}
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {alerta.ficha && (
                                <button
                                  onClick={() => descargarPdf(alerta)}
                                  disabled={generandoPdf === alerta.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-medium transition disabled:opacity-50"
                                  title="Descargar el expediente en PDF"
                                >
                                  <span>📥</span>
                                  <span>{generandoPdf === alerta.id ? '...' : 'PDF'}</span>
                                </button>
                              )}

                              <button
                                onClick={() => solicitarRevision(alerta)}
                                disabled={pausada || ocupada}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/50 hover:bg-slate-700 text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Revisar ahora"
                              >
                                <IconoRecargar className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleToggle(alerta)}
                                className={`p-1.5 rounded-lg border transition ${
                                  pausada
                                    ? 'border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                                    : 'border-slate-800 bg-slate-800/50 hover:bg-slate-700 text-slate-300'
                                }`}
                                title={pausada ? 'Reanudar monitoreo' : 'Pausar monitoreo'}
                              >
                                {pausada ? <IconoPlay className="w-3.5 h-3.5" /> : <IconoPausa className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => setAlertaAEliminar(alerta)}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-red-500/20 hover:border-red-500/30 text-slate-400 hover:text-red-300 transition"
                                title="Eliminar del monitoreo"
                              >
                                <IconoPapelera className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pie de tabla con el estado del servicio */}
              <div className="px-5 py-3 border-t border-slate-800/80 bg-[#121c33]/50 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
                <span>
                  Mostrando <strong>{alertasFiltradas.length}</strong> de <strong>{totalCasos}</strong> alertas registradas.
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${servicioDisponible ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  {servicioDisponible
                    ? 'Revisión automática cada 12 h en el CEJ del Poder Judicial'
                    : cejNoDisponible
                      ? 'El CEJ del Poder Judicial no está respondiendo'
                      : 'Servicio de consultas fuera de línea'}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- Notificaciones --- */}
      <div id="notificaciones" className="rounded-2xl border border-slate-800/80 bg-[#0d1527]/80 overflow-hidden shadow-xl scroll-mt-24">
        <div className="px-5 py-3.5 bg-[#121c33] border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <IconoCampana className="w-4 h-4 text-amber-400" />
            Notificaciones
            {noLeidas.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950">{noLeidas.length}</span>
            )}
          </h3>
          {noLeidas.length > 0 && (
            <button onClick={() => marcarLeidas(noLeidas.map((n) => n.id))} className="text-[11px] text-slate-400 hover:text-white transition">
              Marcar todas como leídas
            </button>
          )}
        </div>

        {notificaciones.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-500">
            Cuando se registre una nueva actuación en tus expedientes la verás aquí.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800/60 max-h-[28rem] overflow-y-auto">
            {notificaciones.map((n) => (
              <li
                key={n.id}
                onClick={() => !n.leida && marcarLeidas([n.id])}
                className={`px-5 py-3.5 flex items-start gap-3 transition ${n.leida ? '' : 'bg-amber-500/5 cursor-pointer hover:bg-amber-500/10'}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.leida ? 'bg-slate-700' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${n.leida ? 'text-slate-300' : 'text-white'}`}>{n.titulo}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{n.mensaje}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{fechaHora(n.fecha_hora)}</p>
                </div>
                {n.documento_path && (
                  <a
                    href={`/api/documentos/${n.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-medium transition"
                  >
                    <span>📥</span>
                    <span>Descargar resolución</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalNueva && (
        <ModalNuevaAlerta
          identidad={identidad}
          onClose={() => setModalNueva(false)}
          onSinIdentidad={() => {
            setModalNueva(false)
            setContinuarConAlta(true)
            setModalIdentidad(true)
          }}
          onCreada={(valor) => {
            setModalNueva(false)
            setAlertaCreada(valor)
            setTimeout(() => setAlertaCreada(null), 6000)
            cargar()
          }}
        />
      )}

      {modalIdentidad && (
        <ModalIdentidad
          identidad={identidad}
          onClose={() => {
            setModalIdentidad(false)
            setContinuarConAlta(false)
          }}
          onGuardada={(i) => {
            setIdentidad(i)
            setModalIdentidad(false)
            cargar()
            if (continuarConAlta) setModalNueva(true)
            setContinuarConAlta(false)
          }}
          onEliminada={() => {
            setIdentidad(null)
            setModalIdentidad(false)
            setContinuarConAlta(false)
          }}
        />
      )}
    </div>
  )
}

function EstadoRastreo({ alerta }: { alerta: AlertaExpediente }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border'
  if (alerta.estado === 'pausado') {
    return (
      <span className={`${base} bg-slate-800 text-slate-400 border-slate-700`}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Pausado
      </span>
    )
  }
  if (esReintento(alerta) || alerta.consulta_estado === 'requiere_captcha') {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/30`} title="El CEJ estaba lento; se reintenta solo">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Reintentando {esReintento(alerta) ? hora(alerta.consulta_solicitada) : ''}
      </span>
    )
  }
  if (alerta.consulta_estado === 'consultando') {
    return (
      <span className={`${base} bg-amber-500/15 text-amber-300 border-amber-500/30`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        Consultando el CEJ...
      </span>
    )
  }
  if (alerta.consulta_estado === 'pendiente') {
    return (
      <span className={`${base} bg-slate-800 text-slate-300 border-slate-700`}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
        En cola
      </span>
    )
  }
  if (alerta.consulta_estado === 'no_encontrado') {
    return (
      <span className={`${base} bg-red-500/15 text-red-300 border-red-500/30`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        No encontrado
      </span>
    )
  }
  if (alerta.consulta_estado === 'error') {
    return (
      <span className={`${base} bg-red-500/15 text-red-300 border-red-500/30`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Error
      </span>
    )
  }
  if (alerta.estado === 'encontrado') {
    return (
      <span className={`${base} bg-blue-500/20 text-blue-300 border-blue-500/40`}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Nueva actuación
      </span>
    )
  }
  return (
    <span className={`${base} bg-emerald-500/15 text-emerald-400 border-emerald-500/30`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
      Activo (Monitoreando)
    </span>
  )
}

function BotonFiltro({
  activo,
  onClick,
  clase,
  children,
}: {
  activo: boolean
  onClick: () => void
  clase: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 font-medium ${
        activo ? `${clase} shadow-sm` : 'text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------- Iconos ----------------

const svg = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

function IconoMas({ className }: { className?: string }) {
  return (
    <svg {...svg} strokeWidth={2.5} className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function IconoCampana({ className }: { className?: string }) {
  return (
    <svg {...svg} strokeWidth={1.8} className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function IconoLupa({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function IconoPapelera({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

function IconoPausa({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function IconoPlay({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function IconoRecargar({ className }: { className?: string }) {
  return (
    <svg {...svg} className={className}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}
