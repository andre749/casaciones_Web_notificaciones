'use client'

import { useState } from 'react'
import { AlertaExpediente, ConsultaEstado } from '@/lib/types'

interface TarjetaAlertaProps {
  alerta: AlertaExpediente
  /** Hay un worker activo consultando el CEJ (segun worker_estado) */
  servicioDisponible: boolean
  /** El worker funciona pero el CEJ no responde ("Error de conexion") */
  cejNoDisponible: boolean
  onRevisar: () => void
  onPausar: () => void
  onEliminar: () => void
}

const ESTADOS: Record<ConsultaEstado, { texto: string; clase: string }> = {
  pendiente: { texto: 'En cola', clase: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  consultando: { texto: 'Consultando el CEJ...', clase: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  // Estado antiguo: ahora el worker reprograma la consulta solo
  requiere_captcha: { texto: 'Reintentando', clase: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  ok: { texto: 'Monitoreando', clase: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  no_encontrado: { texto: 'No encontrado', clase: 'bg-red-500/20 text-red-300 border-red-500/30' },
  error: { texto: 'Error', clase: 'bg-red-500/20 text-red-300 border-red-500/30' },
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

export default function TarjetaAlerta({
  alerta,
  servicioDisponible,
  cejNoDisponible,
  onRevisar,
  onPausar,
  onEliminar,
}: TarjetaAlertaProps) {
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const pausada = alerta.estado === 'pausado'
  const enCurso = ['pendiente', 'consultando', 'requiere_captcha'].includes(alerta.consulta_estado)
  // El worker reprograma solo las consultas cuyo captcha no pudo leer
  // eslint-disable-next-line react-hooks/purity
  const reintento = alerta.consulta_estado === 'pendiente' && new Date(alerta.consulta_solicitada).getTime() > Date.now()
  const estado = pausada
    ? { texto: 'Pausado', clase: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
    : reintento
      ? ESTADOS.requiere_captcha
      : ESTADOS[alerta.consulta_estado]
  const ficha = alerta.ficha

  const descargarPdf = async () => {
    setGenerandoPdf(true)
    try {
      const { descargarPdfExpediente } = await import('@/lib/pdfExpediente')
      descargarPdfExpediente(alerta)
    } finally {
      setGenerandoPdf(false)
    }
  }

  return (
    <div className={`bg-slate-800/50 border rounded-2xl p-5 ${alerta.estado === 'encontrado' ? 'border-amber-500/40' : 'border-slate-700/50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-white font-semibold break-all">{alerta.valor}</p>
          <p className="text-xs text-slate-400">Parte: {alerta.parte}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full border flex items-center gap-1.5 ${estado.clase}`}>
          {!pausada && enCurso && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          {estado.texto}
        </span>
      </div>

      {ficha && (
        <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Dato etiqueta="Organo" valor={ficha.organo} />
          <Dato etiqueta="Distrito" valor={ficha.distritoJudicial} />
          <Dato etiqueta="Juez" valor={ficha.juez} />
          <Dato etiqueta="Estado procesal" valor={ficha.estadoProcesal} />
          <Dato etiqueta="Materia" valor={ficha.materia} />
          <Dato etiqueta="Ultima actuacion" valor={fecha(alerta.ultima_actuacion)} />
        </dl>
      )}

      {!pausada && reintento && (
        <p className="mt-4 text-xs text-amber-200/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          El CEJ estaba lento. Volveremos a consultar automaticamente a las {hora(alerta.consulta_solicitada)}; no
          necesitas hacer nada.
        </p>
      )}
      {!pausada && enCurso && !reintento && !servicioDisponible && (
        <p className="mt-4 text-xs text-slate-400 bg-slate-700/30 rounded-lg px-3 py-2">
          {cejNoDisponible
            ? 'La pagina del Poder Judicial (CEJ) no esta respondiendo en este momento. Tu expediente se consultara apenas vuelva; puedes cerrar esta pagina.'
            : 'El servicio de consultas esta temporalmente fuera de linea. Tu expediente se consultara apenas vuelva; puedes cerrar esta pagina.'}
        </p>
      )}
      {!pausada && !enCurso && alerta.ultimo_error && (
        <p className="mt-4 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {alerta.ultimo_error}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Ultima revision: {ficha ? fecha(alerta.ultima_revision) : 'aun no'}</span>
        <div className="flex flex-wrap gap-1">
          {ficha && (
            <Boton onClick={descargarPdf} disabled={generandoPdf}>
              {generandoPdf ? 'Generando...' : 'Descargar expediente (PDF)'}
            </Boton>
          )}
          <Boton onClick={onRevisar} disabled={pausada || (enCurso && !reintento)}>Revisar ahora</Boton>
          <Boton onClick={onPausar}>{pausada ? 'Reanudar' : 'Pausar'}</Boton>
          <Boton onClick={onEliminar} peligro>Eliminar</Boton>
        </div>
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className="text-slate-200 truncate" title={valor ?? ''}>{valor || '—'}</dd>
    </div>
  )
}

function Boton({
  children,
  onClick,
  disabled,
  peligro,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  peligro?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
        peligro ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
      }`}
    >
      {children}
    </button>
  )
}
