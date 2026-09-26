'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase-browser'
import ModalIdentidad from '@/components/monitoreo/ModalIdentidad'
import TarjetaAlerta from '@/components/monitoreo/TarjetaAlerta'
import { AlertaExpediente, IdentidadResumen, NotificacionExpediente, WorkerEstado } from '@/lib/types'

// Mientras hay consultas en curso se refresca seguido para mostrar el resultado; en reposo, cada 30 s.
const REFRESCO_ACTIVO_MS = 3000
const REFRESCO_REPOSO_MS = 30000
// El worker publica un latido por minuto; sin latido reciente se considera fuera de linea
const LATIDO_VIGENTE_MS = 5 * 60 * 1000

export default function MonitoreoPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [alertas, setAlertas] = useState<AlertaExpediente[]>([])
  const [notificaciones, setNotificaciones] = useState<NotificacionExpediente[]>([])
  const [servicioDisponible, setServicioDisponible] = useState(true)
  const [identidad, setIdentidad] = useState<IdentidadResumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modalIdentidad, setModalIdentidad] = useState(false)

  const [codigo, setCodigo] = useState('')
  const [parte, setParte] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  const hayActividad = useRef(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
  }, [loading, user, router])

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
    setServicioDisponible(
      ((w.data ?? []) as WorkerEstado[]).some((x) => x.estado === 'activo' && new Date(x.actualizado).getTime() > limite)
    )
    const ahora = Date.now()
    hayActividad.current = lista.some(
      (x) =>
        x.estado !== 'pausado' &&
        (x.consulta_estado === 'consultando' ||
          (x.consulta_estado === 'pendiente' && new Date(x.consulta_solicitada).getTime() <= ahora))
    )
  }, [user])

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

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identidad) {
      setModalIdentidad(true)
      return
    }
    setErrorForm('')
    setRegistrando(true)
    try {
      const res = await fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigoExpediente: codigo, parte }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorForm(data.error || 'No se pudo registrar')
        if (data.codigo === 'sin_identidad') setModalIdentidad(true)
        return
      }
      setCodigo('')
      setParte('')
      await cargar()
    } catch {
      setErrorForm('Error de conexion')
    } finally {
      setRegistrando(false)
    }
  }

  // El navegador no puede editar alertas directamente: se usan las funciones de la BD
  // (migracion 004), que validan al dueno y limitan las revisiones manuales
  const solicitarRevision = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.rpc('solicitar_revision_alerta', { p_alerta: id })
    if (error) alert(error.message)
    await cargar()
  }

  const pausarAlerta = async (alerta: AlertaExpediente) => {
    const supabase = createClient()
    await supabase.rpc('pausar_alerta', { p_alerta: alerta.id, p_pausar: alerta.estado !== 'pausado' })
    await cargar()
  }

  const eliminarAlerta = async (alerta: AlertaExpediente) => {
    if (!confirm(`¿Dejar de monitorear el expediente ${alerta.valor}?`)) return
    const supabase = createClient()
    await supabase.from('alertas_expedientes').delete().eq('id', alerta.id)
    await cargar()
  }

  const marcarLeidas = async (ids: string[]) => {
    if (!ids.length) return
    const supabase = createClient()
    await supabase.from('notificaciones').update({ leida: true }).in('id', ids)
    setNotificaciones((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, leida: true } : n)))
  }

  if (loading || (user && cargando)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500/30 border-t-amber-500"></div>
      </div>
    )
  }

  if (!user) return null

  const noLeidas = notificaciones.filter((n) => !n.leida)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-4">
          <button
            className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            onClick={() => router.back()}
            aria-label="Volver"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Monitoreo de expedientes</h1>
            <p className="text-xs text-slate-400">Te avisamos cuando haya nuevas actuaciones en el CEJ del Poder Judicial</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Registrar expediente */}
          <form onSubmit={registrar} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">Monitorear un expediente</h2>
              <button
                type="button"
                onClick={() => setModalIdentidad(true)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  identidad
                    ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                {identidad ? `Identidad: ${identidad.tipo_documento} ${identidad.documento_mascara}` : 'Registrar identidad'}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-slate-400">Codigo de expediente</span>
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="00570-2026-0-3002-JR-CI-01"
                  required
                  className="mt-1 w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Parte (apellidos o razon social)</span>
                <input
                  value={parte}
                  onChange={(e) => setParte(e.target.value.toUpperCase())}
                  placeholder="QUISPE DE COARITA"
                  required
                  className="mt-1 w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Escribe la parte tal como aparece en las resoluciones del expediente. Monitorear es gratis.
            </p>
            {errorForm && <p className="text-sm text-red-400">{errorForm}</p>}
            <button
              type="submit"
              disabled={registrando}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50"
            >
              {registrando ? 'Registrando...' : 'Activar monitoreo'}
            </button>
          </form>

          {/* Expedientes */}
          {alertas.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-8 text-center text-sm text-slate-500">
              Aun no monitoreas ningun expediente.
            </div>
          ) : (
            alertas.map((a) => (
              <TarjetaAlerta
                key={a.id}
                alerta={a}
                servicioDisponible={servicioDisponible}
                onRevisar={() => solicitarRevision(a.id)}
                onPausar={() => pausarAlerta(a)}
                onEliminar={() => eliminarAlerta(a)}
              />
            ))
          )}
        </div>

        {/* Notificaciones */}
        <aside id="notificaciones" className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">
              Notificaciones
              {noLeidas.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500 text-black">{noLeidas.length}</span>
              )}
            </h2>
            {noLeidas.length > 0 && (
              <button onClick={() => marcarLeidas(noLeidas.map((n) => n.id))} className="text-xs text-slate-400 hover:text-white">
                Marcar todas leidas
              </button>
            )}
          </div>
          {notificaciones.length === 0 ? (
            <p className="text-sm text-slate-500">
              Cuando aparezca una nueva actuacion en tus expedientes la veras aqui.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
              {notificaciones.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.leida && marcarLeidas([n.id])}
                  className={`p-3 rounded-xl border text-sm cursor-default ${
                    n.leida ? 'border-slate-700/40 bg-slate-800/30' : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <p className={`font-medium ${n.leida ? 'text-slate-300' : 'text-white'}`}>{n.titulo}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.mensaje}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{new Date(n.fecha_hora).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    {n.documento_path && (
                      <a
                        href={`/api/documentos/${n.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 font-medium"
                      >
                        Descargar resolucion
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>

      {modalIdentidad && (
        <ModalIdentidad
          identidad={identidad}
          onClose={() => setModalIdentidad(false)}
          onGuardada={(i) => {
            setIdentidad(i)
            setModalIdentidad(false)
            cargar()
          }}
          onEliminada={() => {
            setIdentidad(null)
            setModalIdentidad(false)
          }}
        />
      )}
    </div>
  )
}
