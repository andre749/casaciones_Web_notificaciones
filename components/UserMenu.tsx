'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import CampanaNotificaciones from './CampanaNotificaciones'

export default function UserMenu() {
  const { user, perfil, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth/login"
          className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          Ingresar
        </Link>
        <Link
          href="/auth/registro"
          className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg transition-all shadow-lg shadow-amber-500/25"
        >
          Registrarse
        </Link>
      </div>
    )
  }

  const planLabel = perfil?.plan_id === 'profesional' ? 'PRO' :
                    perfil?.plan_id === 'basico' ? 'Basico' : 'Gratis'

  const planColor = perfil?.plan_id === 'profesional' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    perfil?.plan_id === 'basico' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    'bg-slate-500/20 text-slate-400 border-slate-500/30'
  return (
    <div className="flex items-center gap-1">
    <CampanaNotificaciones userId={user.id} />
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {perfil?.nombre?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-sm font-medium text-white truncate">
              {perfil?.nombre || 'Usuario'}
            </p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          
          </div>

          {/* Stats */}
          <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Consultas usadas</span>
              <span className="text-white font-medium">
                {perfil?.consultas_usadas || 0}
                {perfil?.plan_id !== 'profesional' && `/${perfil?.creditos}`}
              </span>
            </div>
            {perfil?.plan_id !== 'profesional' && (
              <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((perfil?.consultas_usadas || 0) / 10 * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/cuenta"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Mi cuenta
            </Link>
            <Link
              href="/monitoreo"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Monitoreo de expedientes
            </Link>
            <Link
              href="/precios"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Mejorar plan
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-700/50 py-1">
            <button
              onClick={() => {
                signOut()
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesion
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
