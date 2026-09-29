'use client'

import { useState } from 'react'
import { IdentidadResumen } from '@/lib/types'

// ============================================================
// Alta de un expediente para monitoreo (pestaña "Casos en Monitoreo").
// Mismo estilo que el modal de la demo, pero registra la alerta de verdad
// en /api/alertas: el worker del CEJ la consulta en los minutos siguientes.
// ============================================================

interface ModalNuevaAlertaProps {
  identidad: IdentidadResumen | null
  onClose: () => void
  onCreada: (valor: string) => void
  /** La API respondio que falta la identidad del consultante */
  onSinIdentidad: () => void
}

const inputClass =
  'w-full px-3 py-2.5 bg-[#121c33] border border-[#233352] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition'

export default function ModalNuevaAlerta({ identidad, onClose, onCreada, onSinIdentidad }: ModalNuevaAlertaProps) {
  const [codigo, setCodigo] = useState('')
  const [parte, setParte] = useState('')
  const [activando, setActivando] = useState(false)
  const [error, setError] = useState('')

  const activar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setActivando(true)
    try {
      const res = await fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigoExpediente: codigo, parte }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.codigo === 'sin_identidad') {
          onSinIdentidad()
          return
        }
        setError(data.error || 'No se pudo registrar la alerta')
        return
      }
      onCreada(data.alerta?.valor ?? codigo)
    } catch {
      setError('Error de conexión')
    } finally {
      setActivando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#0e1628] border border-slate-800 w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cabecera del Modal */}
        <div className="p-5 border-b border-slate-800/80 flex items-start justify-between bg-[#121c33] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Crear Alerta de Monitoreo</h2>
              <p className="text-xs text-slate-400">Ingresa el expediente que deseas monitorear en el Poder Judicial.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={activar} className="p-6 space-y-5 overflow-y-auto">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Código del expediente</span>
            <input
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="00570-2026-0-3002-JR-CI-01"
              required
              className={`${inputClass} font-mono`}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Parte (apellidos o razón social)</span>
            <input
              value={parte}
              onChange={(e) => setParte(e.target.value.toUpperCase())}
              placeholder="QUISPE DE COARITA"
              required
              className={inputClass}
            />
            <span className="block text-[11px] text-slate-500">
              Escríbela tal como aparece en las resoluciones del expediente.
            </span>
          </label>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {identidad && (
            <p className="text-[11px] text-slate-500">
              Consulta registrada a nombre de{' '}
              <span className="font-mono text-slate-300">
                {identidad.tipo_documento} {identidad.documento_mascara}
              </span>
            </p>
          )}

          {/* Caja informativa */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-[#121c33]/70 flex items-start gap-2.5">
            <span className="text-amber-400 text-sm">🔔</span>
            <p className="leading-relaxed text-[11px] text-slate-400">
              <strong className="text-slate-200">Notificación automática:</strong> revisaremos este expediente en el CEJ
              del Poder Judicial cada 12 horas. Cuando se registre una nueva actuación se encenderá la campana en la barra
              superior. Monitorear es gratis.
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={activando}
              className="px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={activando}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {activando ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Activando...</span>
                </>
              ) : (
                <span>+ Activar Monitoreo</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
