'use client'

import { useCallback, useEffect, useState } from 'react'

interface ItemCompra {
  id: string
  nombre: string
  precio: number
}

declare global {
  interface Window {
    Culqi: {
      publicKey: string
      settings: (settings: Record<string, unknown>) => void
      options: (options: Record<string, unknown>) => void
      open: () => void
      close: () => void
      token: {
        id: string
        email: string
        card_number: string
        last_four: string
        iin: {
          card_brand: string
        }
      } | null
      order: {
        id: string
        state: string
      } | null
      error: {
        user_message: string
      } | null
    }
    culqi: () => void
  }
}

interface CulqiCheckoutProps {
  item: ItemCompra
  tipo: 'plan' | 'creditos'
  userEmail: string
  userName: string
  onSuccess: (data: { token?: string; orderId?: string; method: string }) => void
  onError: (error: string) => void
}

export default function CulqiCheckout({ item: plan, tipo, userEmail, userName, onSuccess, onError }: CulqiCheckoutProps) {
  const [loading, setLoading] = useState(false)
  const [metodo, setMetodo] = useState<'tarjeta' | 'yape' | 'pagoefectivo'>('tarjeta')
  const [culqiLoaded, setCulqiLoaded] = useState(false)

  const inicializarCulqi = useCallback(() => {
    if (!window.Culqi) return;

    const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY;
    if (!publicKey) {
      console.error('Falta NEXT_PUBLIC_CULQI_PUBLIC_KEY');
      return;
    }

    window.Culqi.publicKey = publicKey;
    window.Culqi.settings({
      title: 'Casaciones Web',
      currency: 'PEN',
      amount: Math.round(plan.precio * 100),
      email: userEmail,
    });
    window.Culqi.options({ lang: 'es' });

    window.culqi = () => {
      if (window.Culqi.token) {
        window.Culqi.close();
        onSuccess({ token: window.Culqi.token.id, method: 'tarjeta' });
      } else if (window.Culqi.error) {
        window.Culqi.close();
        onError(window.Culqi.error.user_message);
      }
      setLoading(false);
    };

    setCulqiLoaded(true);
  }, [plan.precio, userEmail, onSuccess, onError]);

  useEffect(() => {
    const existing = document.getElementById('culqi-sdk');
    if (existing) {
      inicializarCulqi();
      return;
    }

    const script = document.createElement('script');
    script.id = 'culqi-sdk';
    script.src = 'https://checkout.culqi.com/js/v4';
    script.async = true;
    script.onload = () => { inicializarCulqi(); };
    script.onerror = () => { onError('No se pudo cargar Culqi'); };
    document.body.appendChild(script);
  }, [inicializarCulqi, onError]);
  const handlePagarTarjeta = () => {
    if (!culqiLoaded || !window.Culqi) {
      onError('Culqi no esta cargado. Intenta nuevamente.')
      return
    }

    setLoading(true)
    setMetodo('tarjeta')
    window.Culqi.open()
  }

  const handlePagarYape = async () => {
    setLoading(true)
    setMetodo('yape')

    try {
      const response = await fetch('/api/culqi/crear-orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: plan.id,
          tipo,
          metodo: 'yape',
          email: userEmail,
          nombre: userName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear orden')
      }

      onSuccess({
        orderId: data.orderId,
        method: 'yape'
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handlePagarPagoEfectivo = async () => {
    setLoading(true)
    setMetodo('pagoefectivo')

    try {
      const response = await fetch('/api/culqi/crear-orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: plan.id,
          tipo,
          metodo: 'pagoefectivo',
          email: userEmail,
          nombre: userName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear orden')
      }

      onSuccess({
        orderId: data.orderId,
        method: 'pagoefectivo'
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Selecciona tu metodo de pago</h3>

        <div className="grid gap-3">
          {/* Tarjeta */}
          <button
            onClick={handlePagarTarjeta}
            disabled={loading || !culqiLoaded}
            className="flex items-center gap-4 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">Tarjeta de credito/debito</p>
              <p className="text-sm text-slate-400">Visa, Mastercard, American Express</p>
            </div>
            {loading && metodo === 'tarjeta' && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500/30 border-t-amber-500" />
            )}
          </button>

          {/* Yape */}
          <button
            onClick={handlePagarYape}
            disabled={loading}
            className="flex items-center gap-4 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-purple-400">Y</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">Yape</p>
              <p className="text-sm text-slate-400">Paga escaneando el codigo QR</p>
            </div>
            {loading && metodo === 'yape' && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500/30 border-t-amber-500" />
            )}
          </button>

          {/* PagoEfectivo */}
          <button
            onClick={handlePagarPagoEfectivo}
            disabled={loading}
            className="flex items-center gap-4 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">PagoEfectivo</p>
              <p className="text-sm text-slate-400">Paga en agentes o banca por internet</p>
            </div>
            {loading && metodo === 'pagoefectivo' && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500/30 border-t-amber-500" />
            )}
          </button>
        </div>
      </div>

      {/* Info de seguridad */}
      <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Pago seguro procesado por Culqi</span>
      </div>
    </div>
  )
}
