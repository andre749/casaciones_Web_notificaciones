'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase-browser'
import { CreditosHistorial } from '@/lib/types'

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === 'true'

export default function CuentaPage() {
  const router = useRouter()
  const { user, perfil, loading, refreshPerfil } = useAuth()

  const [editando, setEditando] = useState(false)
  const [nombreEditado, setNombreEditado] = useState(
  () => perfil?.nombre ?? ''
)
  const [guardando, setGuardando] = useState(false)

  const [historial, setHistorial] = useState<CreditosHistorial[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    const cargarHistorial = async () => {
      if (!user || !PAYMENTS_ENABLED) {
        setCargandoHistorial(false)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from('creditos_historial')
        .select('*')
        .eq('perfil_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) setHistorial(data)
      setCargandoHistorial(false)
    }

    cargarHistorial()
  }, [user])

  const guardarNombre = async () => {
    if (!user) return
    setGuardando(true)
    const supabase = createClient()
    await supabase.from('perfiles').update({ nombre: nombreEditado }).eq('id', user.id)
    await refreshPerfil()
    setGuardando(false)
    setEditando(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500/30 border-t-amber-500"></div>
      </div>
    )
  }

  if (!user || !perfil) {
    return null
  }

  const planLabel = perfil.plan_id === 'profesional' ? 'Profesional' :
                    perfil.plan_id === 'basico' ? 'Basico' : 'Gratis'

  const planColor = perfil.plan_id === 'profesional' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    perfil.plan_id === 'basico' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    'bg-slate-500/20 text-slate-400 border-slate-500/30'

  const consultasMax = perfil.creditos

  const porcentajeUso = consultasMax === -1 ? 0 : (perfil.consultas_usadas / consultasMax) * 100
  const creditos = perfil.creditos ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div
              className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              onClick={()=>router.back()}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Mi Cuenta</h1>
              <p className="text-xs text-slate-400">Gestiona tu perfil, plan y creditos</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Perfil */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Perfil</h2>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {(nombreEditado || perfil.nombre)?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                {editando ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nombreEditado}
                      onChange={(e) => setNombreEditado(e.target.value)}
                      className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <button
                      onClick={guardarNombre}
                      disabled={guardando}
                      className="px-3 py-2 text-sm font-medium text-black bg-amber-400 rounded-lg hover:bg-amber-300 transition disabled:opacity-50"
                    >
                      {guardando ? '...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => { setEditando(false); setNombreEditado(perfil.nombre || '') }}
                      className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-white">{perfil.nombre || 'Usuario'}</p>
                    <button
                      onClick={() => setEditando(true)}
                      className="text-slate-400 hover:text-white transition"
                      title="Editar nombre"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-sm text-slate-400">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Plan actual */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Plan actual</h2>
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${planColor}`}>
                {planLabel}
              </span>
            </div>

            {/* Uso */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">Consultas este mes</span>
                <span className="text-white font-medium">
                  {perfil.consultas_usadas}
                  {consultasMax !== -1 && ` / ${consultasMax}`}
                </span>
              </div>
              {consultasMax !== -1 && (
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      porcentajeUso >= 100 ? 'bg-red-500' :
                      porcentajeUso >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(porcentajeUso, 100)}%` }}
                  />
                </div>
              )}
              {consultasMax === -1 && (
                <p className="text-sm text-emerald-400">Consultas ilimitadas</p>
              )}
            </div>

            {perfil.plan_id !== 'profesional' && (
              <Link
                href="/precios"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/25"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Mejorar plan
              </Link>
            )}
          </div>

          {/* Creditos */}
          {PAYMENTS_ENABLED && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Creditos</h2>
                <span className="px-3 py-1 text-sm font-medium rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {creditos} disponibles
                </span>
              </div>

              <p className="text-sm text-slate-400 mb-4">
                Los creditos se usan automaticamente cuando agotas las consultas
                gratuitas de tu plan y no caducan.
              </p>

              <Link
                href="/precios#creditos"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/25"
              >
                Comprar mas creditos
              </Link>

              {!cargandoHistorial && historial.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Movimientos recientes</h3>
                  <div className="space-y-2">
                    {historial.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">
                          {h.descripcion || (h.tipo === 'compra' ? 'Compra de creditos' : 'Consumo')}
                        </span>
                        <span className={h.cantidad > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                          {h.cantidad > 0 ? '+' : ''}{h.cantidad}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Acciones rapidas */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Acciones rapidas</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <Link
                href="/poder-judicial"
                className="flex items-center gap-3 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl hover:bg-slate-700/50 transition-colors"
              >
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Buscar casaciones</p>
                  <p className="text-xs text-slate-400">Diario El Peruano</p>
                </div>
              </Link>

              <Link
                href="/monitoreo"
                className="flex items-center gap-3 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl hover:bg-slate-700/50 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Monitorear expedientes</p>
                  <p className="text-xs text-slate-400">Alertas del CEJ</p>
                </div>
              </Link>

              {PAYMENTS_ENABLED && (
                <Link
                  href="/cuenta/suscripcion"
                  className="flex items-center gap-3 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl hover:bg-slate-700/50 transition-colors"
                >
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-white">Mi suscripcion</p>
                    <p className="text-xs text-slate-400">Gestionar plan</p>
                  </div>
                </Link>
              )}

              <Link
                href="/precios"
                className="flex items-center gap-3 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl hover:bg-slate-700/50 transition-colors"
              >
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Ver planes</p>
                  <p className="text-xs text-slate-400">Precios y beneficios</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Info */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500">
              Las consultas se renuevan el primer dia de cada mes.
              Ultima renovacion: {new Date(perfil.fecha_reset).toLocaleDateString('es-PE')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
