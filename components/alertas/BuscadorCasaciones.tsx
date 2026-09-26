'use client';

import React, { useState } from 'react';
import { Casacion, buscarCasaciones } from '@/data/casacionesData';

// ============================================================
// BUSCADOR DE CASACIONES (simulado)
// Réplica de la barra original de Benerelatum (/poder-judicial):
// un único campo libre por N° de casación, materia o vocal.
// La búsqueda se resuelve contra casacionesMock con un delay
// que simula la consulta al índice de PDFs (OpenSearch).
// ============================================================

interface BuscadorCasacionesProps {
  totalCasosMonitoreados: number;
  /** Abre el flujo de creación de alerta, opcionalmente prellenado */
  onCrearAlerta: (prefill?: string) => void;
  onVerMonitoreo: () => void;
}

const IconoBuscar = ({ className = 'w-4 h-4', strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const IconoCampana = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export default function BuscadorCasaciones({
  totalCasosMonitoreados,
  onCrearAlerta,
  onVerMonitoreo,
}: BuscadorCasacionesProps) {
  const [termino, setTermino] = useState('');
  const [terminoBuscado, setTerminoBuscado] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Casacion[]>([]);
  const [cargando, setCargando] = useState(false);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    // Simula latencia del backend
    setTimeout(() => {
      setResultados(buscarCasaciones(termino));
      setTerminoBuscado(termino.trim());
      setCargando(false);
    }, 600);
  };

  const formatearFecha = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="space-y-6">
      {/* --- Contenedor Principal de Búsqueda --- */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0d1527]/80 backdrop-blur-md p-6 sm:p-7 shadow-xl">
        <form onSubmit={handleBuscar} className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="termino-casacion" className="block text-xs font-medium text-slate-400 tracking-wide">
              Búsqueda
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <IconoBuscar />
              </span>
              <input
                id="termino-casacion"
                type="text"
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                placeholder="N°, materia, vocal..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#162035] border border-[#233352] rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-semibold text-sm rounded-lg shadow-lg shadow-amber-500/20 transition duration-150 cursor-pointer"
            >
              {cargando ? (
                <span className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
              ) : (
                <IconoBuscar strokeWidth={2.5} />
              )}
              Buscar
            </button>
          </div>
        </form>
      </div>

      {/* --- Indicador de Resultados --- */}
      {terminoBuscado !== null && (
        <p className="pt-2 text-xs text-slate-400 font-normal">
          <strong className="text-slate-200 font-semibold">{resultados.length}</strong>{' '}
          {resultados.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
          {terminoBuscado && (
            <>
              {' '}para <span className="text-amber-400 font-mono">&quot;{terminoBuscado}&quot;</span>
            </>
          )}
        </p>
      )}

      {/* --- Lista de Resultados --- */}
      {terminoBuscado !== null && resultados.length > 0 ? (
        <ul className="space-y-3">
          {resultados.map((c) => (
            <li
              key={c.id}
              className="p-5 rounded-2xl border border-slate-800 bg-[#0d1527]/70 hover:border-amber-500/40 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-300 font-mono">{c.numero}</p>
                  <p className="text-sm text-white mt-0.5">{c.materia}</p>
                </div>
                <span className="text-[11px] text-slate-500 shrink-0">
                  Publicado el {formatearFecha(c.fechaPublicacion)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">{c.sumilla}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
                <span>
                  <span className="text-slate-400">Sala:</span> {c.sala}
                </span>
                <span>
                  <span className="text-slate-400">Vocal ponente:</span> {c.vocalPonente}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        /* --- Estado Vacío Central --- */
        <div className="py-24 sm:py-32 flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-base sm:text-lg font-normal text-slate-300">
            {terminoBuscado === null ? 'Busca una casación' : 'No se encontraron resultados'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {terminoBuscado === null
              ? 'Ingresa un número de casación, materia o vocal ponente'
              : 'Intenta con otra búsqueda o cambia los términos'}
          </p>

          {/* Banner CTA hacia monitoreo */}
          <div className="mt-8 p-5 rounded-2xl border border-slate-800 bg-[#0d1527]/70 max-w-lg text-left flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <IconoCampana className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-white">
                ¿Esperando una resolución que aún no se publica?
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                No necesitas entrar a revisar todos los días. Registra el número de expediente y nuestro bot te notificará de inmediato cuando aparezca en las Salas Supremas.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => onCrearAlerta(terminoBuscado ?? '')}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium"
                >
                  <span>Configurar alerta de monitoreo</span>
                  <span>→</span>
                </button>
                <button
                  onClick={onVerMonitoreo}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Ver mis {totalCasosMonitoreados} casos activos →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
