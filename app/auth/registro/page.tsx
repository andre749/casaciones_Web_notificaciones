'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { PaqueteCreditos } from '@/lib/types'
import { useAuth } from '@/components/AuthProvider'

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === 'true'

function RegistroContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { user, perfil, setPerfil } = useAuth()

  const redirectTo = searchParams.get('redirect')

  // Paso del flujo: datos de la cuenta -> (opcional) elegir paquete de creditos
  const [paso, setPaso] = useState<'datos' | 'paquete'>('datos')
  const [paquetes, setPaquetes] = useState<PaqueteCreditos[]>([])
  const [cargandoPaquetes, setCargandoPaquetes] = useState(false)

  useEffect(() => {
    if (paso !== 'paquete' || !PAYMENTS_ENABLED) return

    const cargarPaquetes = async () => {
      setCargandoPaquetes(true)
      const { data } = await supabase
        .from('paquetes_creditos')
        .select('*')
        .eq('activo', true)
        .order('precio')

      if (data) setPaquetes(data)
      setCargandoPaquetes(false)
    }

    cargarPaquetes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso])

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);


    try {

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre,
          },
        },
      });


      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {

        // Esperamos un momento para que el trigger de BD termine de crear el perfil
        await new Promise(r => setTimeout(r, 1000));

        const { data: perfil, error: perfilError } = await supabase
          .from("perfiles")
          .select()
          .eq("id", data.user.id)
          .single();

        
        if (perfil) {
          setPerfil(perfil);
        } else if (perfilError) {
          console.error("Error obteniendo perfil:", perfilError);
        }
      }


      setLoading(false);

      if (PAYMENTS_ENABLED) {
        setPaso("paquete");
      } else {
        router.push("/poder-judicial");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };
  const elegirPaquete = (paqueteId: string) => {
    router.push(`/checkout?tipo=creditos&paquete=${paqueteId}`)
  }

  const continuarGratis = () => {
    router.push('/poder-judicial')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className={paso === 'paquete' ? 'max-w-3xl w-full' : 'max-w-md w-full'}>
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Casaciones Peru</span>
          </Link>
        </div>

        {paso === 'datos' ? (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Crear Cuenta
            </h1>
            <p className="text-slate-400 text-center mb-6">
              Obten 30 consultas gratis para probar el aplicativo
            </p>

            <form onSubmit={handleRegistro} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  placeholder="Minimo 6 caracteres"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creando cuenta...
                  </span>
                ) : (
                  'Crear cuenta gratis'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-400">
                Ya tienes cuenta?{' '}
                <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 font-medium">
                  Inicia sesion
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Cuenta creada</h1>
              <p className="text-slate-400">
                Ya tienes 30 consultas gratis. Si necesitas mas, puedes
                comprar un paquete de creditos ahora o hacerlo despues desde tu cuenta.
              </p>
            </div>

            {cargandoPaquetes ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/30 border-t-amber-500" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                {paquetes.map((paquete) => (
                  <button
                    key={paquete.id}
                    onClick={() => elegirPaquete(paquete.id)}
                    className={`text-left rounded-xl border p-5 transition hover:bg-slate-700/50 relative ${paquete.destacado
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-slate-600/50 bg-slate-700/30'
                      }`}
                  >
                    {paquete.destacado && (
                      <span className="absolute -top-3 left-4 px-2 py-0.5 bg-amber-500 text-black text-xs font-semibold rounded-full">
                        Popular
                      </span>
                    )}
                    <p className="font-semibold text-white">{paquete.nombre}</p>
                    <p className="text-sm text-slate-400 mt-1">{paquete.creditos} creditos</p>
                    <p className="text-2xl font-bold text-white mt-3">S/{paquete.precio}</p>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={continuarGratis}
              className="w-full py-3 text-sm font-medium text-slate-300 bg-slate-700/50 border border-slate-600/50 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Continuar con el plan gratis
            </button>
          </div>
        )}

        <p className="text-center text-slate-500 text-sm mt-6">
          <Link href="/" className="hover:text-slate-300">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroContent />
    </Suspense>
  )
}
