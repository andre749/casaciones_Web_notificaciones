'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { createClient } from '@/lib/supabase-browser'
import { NotificacionExpediente } from '@/lib/types'

const REFRESCO_MS = 2 * 60 * 1000

/**
 * Popup global de novedades en los expedientes monitoreados. Aparece al iniciar sesion
 * si hay notificaciones sin leer (las que el worker genero mientras el usuario no estaba)
 * y, durante la sesion, cada vez que llega una nueva. No se muestra en /monitoreo, donde
 * ya estan a la vista.
 */
export default function AvisoNovedades() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [novedades, setNovedades] = useState<NotificacionExpediente[]>([])
  const [total, setTotal] = useState(0)
  const [visible, setVisible] = useState(false)

  // Una clave por inicio de sesion: un nuevo login vuelve a mostrar el aviso,
  // recargar la pagina no.
  const clave = user ? `aviso_novedades_${user.id}_${user.last_sign_in_at ?? ''}` : null

  const revisar = useCallback(async () => {
    if (!user || !clave) return
    const supabase = createClient()
    const { data, count } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact' })
      .eq('perfil_id', user.id)
      .eq('leida', false)
      .order('fecha_hora', { ascending: false })
      .limit(3)

    const cantidad = count ?? 0
    let yaMostradas = 0
    try {
      yaMostradas = Number(sessionStorage.getItem(clave) ?? 0)
    } catch {
      // sin sessionStorage (modo privado estricto): se muestra igual
    }
    if (cantidad > yaMostradas) {
      setNovedades((data ?? []) as NotificacionExpediente[])
      setTotal(cantidad)
      setVisible(true)
    }
  }, [user, clave])

  useEffect(() => {
    if (!user || pathname?.startsWith('/monitoreo')) return
    const inicial = setTimeout(revisar, 0)
    const timer = setInterval(revisar, REFRESCO_MS)
    return () => {
      clearTimeout(inicial)
      clearInterval(timer)
    }
  }, [user, pathname, revisar])

  const cerrar = () => {
    try {
      if (clave) sessionStorage.setItem(clave, String(total))
    } catch {
      // ignorar
    }
    setVisible(false)
  }

  if (!visible || !user || pathname?.startsWith('/monitoreo')) return null

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-amber-500/30 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 bg-amber-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {total === 1 ? 'Tienes 1 novedad' : `Tienes ${total} novedades`} en tus expedientes
            </h2>
            <p className="text-xs text-slate-400">Detectadas en el CEJ del Poder Judicial</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {novedades.map((n) => (
            <li key={n.id} className="p-3 rounded-xl border border-slate-700/50 bg-slate-900/40">
              <p className="text-sm text-slate-200">{n.mensaje}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {new Date(n.fecha_hora).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </li>
          ))}
        </ul>
        {total > novedades.length && (
          <p className="mt-2 text-xs text-slate-500">y {total - novedades.length} mas...</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={cerrar} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition">
            Mas tarde
          </button>
          <Link
            href="/monitoreo#notificaciones"
            onClick={cerrar}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/25"
          >
            Ver y descargar
          </Link>
        </div>
      </div>
    </div>
  )
}
