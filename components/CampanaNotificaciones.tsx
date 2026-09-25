'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

const REFRESCO_MS = 60000

/** Campana con el numero de notificaciones de expedientes sin leer. */
export default function CampanaNotificaciones({ userId }: { userId: string }) {
  const [noLeidas, setNoLeidas] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const contar = async () => {
      const { count } = await supabase
        .from('notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('perfil_id', userId)
        .eq('leida', false)
      setNoLeidas(count ?? 0)
    }
    contar()
    const timer = setInterval(contar, REFRESCO_MS)
    return () => clearInterval(timer)
  }, [userId])

  return (
    <Link
      href="/monitoreo#notificaciones"
      className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
      title={noLeidas ? `${noLeidas} notificacion(es) sin leer` : 'Notificaciones de expedientes'}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {noLeidas > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
          {noLeidas > 99 ? '99+' : noLeidas}
        </span>
      )}
    </Link>
  )
}
