'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IdentidadResumen } from '@/lib/types'

interface ModalIdentidadProps {
  identidad: IdentidadResumen | null
  onClose: () => void
  onGuardada: (identidad: IdentidadResumen) => void
  onEliminada: () => void
}

const inputClass =
  'w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50'

/**
 * Datos que el CEJ pide en su modal "Validacion de identidad del consultante".
 * Se envian a /api/identidad, que los guarda cifrados; nunca vuelven al navegador.
 */
export default function ModalIdentidad({ identidad, onClose, onGuardada, onEliminada }: ModalIdentidadProps) {
  const [tipo, setTipo] = useState<'DNI' | 'CE'>(identidad?.tipo_documento ?? 'DNI')
  const [numero, setNumero] = useState('')
  const [codigo, setCodigo] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const hoy = new Date().toISOString().slice(0, 10)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const res = await fetch('/api/identidad', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoDocumento: tipo,
          numeroDocumento: numero,
          codigoVerificacion: codigo,
          fechaEmision,
          fechaNacimiento,
          consentimiento,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'No se pudo guardar')
        return
      }
      onGuardada(data.identidad)
    } catch {
      setError('Error de conexion')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!confirm('¿Eliminar tus datos de identidad? Tus expedientes dejaran de consultarse hasta que los registres de nuevo.')) return
    setEliminando(true)
    try {
      const res = await fetch('/api/identidad', { method: 'DELETE' })
      if (res.ok) onEliminada()
      else setError('No se pudieron eliminar los datos')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Identidad del consultante</h2>
            <p className="text-xs text-slate-400">El Poder Judicial la exige en cada consulta al CEJ</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition" aria-label="Cerrar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={guardar} className="px-6 py-5 space-y-4">
          {identidad && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              Registrada: {identidad.tipo_documento} {identidad.documento_mascara}. Completa el formulario solo si
              quieres cambiarla.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Tipo de documento</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'DNI' | 'CE')}
                className={`${inputClass} mt-1`}
              >
                <option value="DNI">DNI</option>
                <option value="CE">Carne de extranjeria</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Numero</span>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/\s/g, ''))}
                inputMode={tipo === 'DNI' ? 'numeric' : 'text'}
                maxLength={tipo === 'DNI' ? 8 : 15}
                required
                className={`${inputClass} mt-1`}
                placeholder={tipo === 'DNI' ? '8 digitos' : 'Numero de carne'}
              />
            </label>
          </div>

          {tipo === 'DNI' && (
            <label className="block">
              <span className="text-xs text-slate-400">Codigo de verificacion</span>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                maxLength={3}
                required
                className={`${inputClass} mt-1`}
                placeholder="Ej: 8"
              />
              <span className="text-[11px] text-slate-500">
                El digito que aparece despues del guion, junto al numero de tu DNI.
              </span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400">Fecha de emision</span>
              <input
                type="date"
                value={fechaEmision}
                max={hoy}
                onChange={(e) => setFechaEmision(e.target.value)}
                required
                className={`${inputClass} mt-1 [color-scheme:dark]`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Fecha de nacimiento</span>
              <input
                type="date"
                value={fechaNacimiento}
                max={hoy}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                required
                className={`${inputClass} mt-1 [color-scheme:dark]`}
              />
            </label>
          </div>

          <label className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed cursor-pointer">
            <input
              type="checkbox"
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
              required
              className="mt-0.5 accent-amber-500"
            />
            <span>
              Autorizo el tratamiento de mis datos de identidad para que se usen, cifrados, unicamente en la validacion
              de identidad que exige la Consulta de Expedientes Judiciales (CEJ) al consultar mis expedientes, segun la{' '}
              <Link href="/politica-privacidad#datos-identidad" target="_blank" className="text-amber-400 hover:underline">
                Politica de Privacidad
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            {identidad && (
              <button
                type="button"
                onClick={eliminar}
                disabled={eliminando}
                className="mr-auto text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar mis datos'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !consentimiento}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
