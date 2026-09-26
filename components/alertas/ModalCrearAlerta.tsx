'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useIdentidad } from '@/hooks/useIdentidad';
import BuscadorExpedientes, { FiltrosBusqueda } from '@/components/alertas/BuscadorExpedientes';
import ModalIdentidad from '@/components/alertas/ModalIdentidad';
import { consultarExpediente, ExpedienteEncontrado } from '@/data/expedientesData';

// ============================================================
// MODAL CREAR ALERTA - Flujo protegido por identidad
//
// 1. Al abrirse verifica si el consultante ya validó su identidad.
//    Si NO → se muestra primero el ModalIdentidad (DNI / CE / ...).
//    Si cancela la validación, se cancela también la creación.
// 2. Con identidad validada → buscador de expedientes
//    (Por filtros / Por código), igual al portal del PJ.
// 3. Se muestra la ficha del expediente encontrado y el usuario
//    confirma → se activa el monitoreo (agregarAlerta).
// ============================================================

interface ModalCrearAlertaProps {
  isOpen: boolean;
  onClose: () => void;
  /** Valor sugerido (ej. término del buscador de casaciones) */
  initialValue?: string;
  onAlertCreated?: (valor: string, tipo: string) => void;
}

type Paso = 'buscar' | 'confirmar';

// Un valor sugerido solo se usa si parece un CUE (NNNNN-AAAA-...)
const PATRON_CUE = /^\d{4,5}-\d{4}/;

export default function ModalCrearAlerta({
  isOpen,
  onClose,
  initialValue = '',
  onAlertCreated,
}: ModalCrearAlertaProps) {
  const { alertas, agregarAlerta } = useApp();
  const { identidad, tieneIdentidad, cargado } = useIdentidad();

  const [paso, setPaso] = useState<Paso>('buscar');
  const [buscando, setBuscando] = useState(false);
  const [expediente, setExpediente] = useState<ExpedienteEncontrado | null>(null);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ModalIdentidad llama onValidado() y luego onClose(): este ref evita
  // que ese onClose cierre todo el flujo justo después de validar.
  const recienValidado = useRef(false);

  // Reiniciar el flujo cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPaso('buscar');
      setExpediente(null);
      setError(null);
      recienValidado.current = false;
    }
  }, [isOpen]);

  if (!isOpen || !cargado) return null;

  // --- Paso 0: Validación de identidad (si aún no la tiene) ---
  if (!tieneIdentidad) {
    return (
      <ModalIdentidad
        isOpen
        onValidado={() => {
          recienValidado.current = true;
        }}
        onClose={() => {
          if (recienValidado.current) return; // continúa al buscador
          onClose(); // canceló la validación → se cancela la alerta
        }}
      />
    );
  }

  const codigoInicial = PATRON_CUE.test(initialValue.trim()) ? initialValue.trim() : '';

  // --- Paso 1 → 2: consultar el expediente ---
  const handleBuscar = async (filtros: FiltrosBusqueda) => {
    setBuscando(true);
    setError(null);
    const resultado = await consultarExpediente(filtros);
    setBuscando(false);

    // Evita duplicar el monitoreo de un mismo expediente
    if (alertas.some((a) => a.tipo === 'expediente' && a.valor === resultado.codigo)) {
      setError(`El expediente ${resultado.codigo} ya se encuentra en monitoreo.`);
      return;
    }

    setExpediente(resultado);
    setPaso('confirmar');
  };

  // --- Paso 2: activar el monitoreo ---
  const handleActivar = () => {
    if (!expediente) return;
    setActivando(true);

    setTimeout(() => {
      agregarAlerta({
        tipo: 'expediente',
        valor: expediente.codigo,
        detalle: [expediente.distritoJudicial, expediente.organo, expediente.parte]
          .filter(Boolean)
          .join(' · '),
        estado: 'activo',
        costoTokens: 0,
      });
      setActivando(false);
      onAlertCreated?.(expediente.codigo, 'expediente');
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#0e1628] border border-slate-800 w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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
              <p className="text-xs text-slate-400">
                {paso === 'buscar'
                  ? 'Paso 1 de 2 · Ubica el expediente que deseas monitorear.'
                  : 'Paso 2 de 2 · Confirma el expediente y activa el rastreo.'}
              </p>
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

        <div className="p-6 space-y-5 overflow-y-auto">
          {paso === 'buscar' ? (
            <>
              <BuscadorExpedientes
                onBuscar={handleBuscar}
                loading={buscando}
                codigoInicial={codigoInicial}
              />
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            expediente && (
              <>
                {/* Ficha del expediente encontrado */}
                <div className="rounded-2xl border border-slate-800 bg-[#0d1527]/80 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-emerald-500/5">
                    <span className="text-xs font-medium text-emerald-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Expediente encontrado
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                      {expediente.estadoProcesal}
                    </span>
                  </div>
                  <dl className="p-5 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-4 gap-y-2.5 text-xs">
                    <dt className="text-slate-500">N° de expediente</dt>
                    <dd className="text-amber-300 font-mono font-semibold">{expediente.codigo}</dd>
                    <dt className="text-slate-500">Distrito judicial</dt>
                    <dd className="text-slate-200">{expediente.distritoJudicial}</dd>
                    <dt className="text-slate-500">Órgano jurisdiccional</dt>
                    <dd className="text-slate-200">{expediente.organo}</dd>
                    {expediente.parte && (
                      <>
                        <dt className="text-slate-500">Parte</dt>
                        <dd className="text-slate-200">{expediente.parte}</dd>
                      </>
                    )}
                    <dt className="text-slate-500">Última actuación</dt>
                    <dd className="text-slate-200">
                      {new Date(expediente.ultimaActuacion).toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </dd>
                  </dl>
                </div>

                {/* Consultante validado */}
                {identidad && (
                  <p className="text-[11px] text-slate-500">
                    Consulta registrada a nombre de{' '}
                    <span className="font-mono text-slate-300">
                      {identidad.tipoDocumento} {identidad.numeroDocumento}
                    </span>
                  </p>
                )}

                {/* Caja informativa */}
                <div className="p-3.5 rounded-xl border border-slate-800 bg-[#121c33]/70 flex items-start gap-2.5">
                  <span className="text-amber-400 text-sm">🔔</span>
                  <p className="leading-relaxed text-[11px] text-slate-400">
                    <strong className="text-slate-200">Notificación automática:</strong> el scraper revisará periódicamente este expediente en el portal del Poder Judicial. En cuanto se publique una nueva resolución, se encenderá la campana en la barra superior.
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaso('buscar')}
                    disabled={activando}
                    className="px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    ← Buscar otro expediente
                  </button>
                  <button
                    type="button"
                    onClick={handleActivar}
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
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
