'use client';

import React, { useState, useEffect } from 'react';
import {
  DISTRITOS_JUDICIALES,
  INSTANCIAS_GENERALES,
  ESPECIALIDADES_POR_INSTANCIA,
  ANIOS,
} from '@/data/judicialData';
import { useIdentidad, DatosIdentidad } from '@/hooks/useIdentidad';
import ModalIdentidad from '@/components/alertas/ModalIdentidad';

// ============================================================
// BUSCADOR DE EXPEDIENTES - Replica el formulario oficial del
// Portal del Poder Judicial del Perú con dos tabs:
//   1. Por Filtros (Distrito, Instancia, Especialidad, Año, Nº, Parte)
//   2. Por Código de Expediente (CUE directo)
// ============================================================

export interface FiltrosBusqueda {
  modo: 'filtros' | 'codigo';
  // Por filtros
  distritoJudicial: string;
  instancia: string;
  especialidad: string;
  anio: string;
  nroExpediente: string;
  parte: string;
  // Por código
  codigoExpediente: string;
}

interface BuscadorExpedientesProps {
  onBuscar: (filtros: FiltrosBusqueda) => void;
  loading?: boolean;
  /** CUE para prellenar: si se envía, el buscador abre en la pestaña "Por Código" */
  codigoInicial?: string;
}

const CAMPO_VACIO = '--SELECCIONAR';

export default function BuscadorExpedientes({
  onBuscar,
  loading = false,
  codigoInicial = '',
}: BuscadorExpedientesProps) {
  const { identidad, tieneIdentidad } = useIdentidad();
  const [modo, setModo] = useState<'filtros' | 'codigo'>(codigoInicial ? 'codigo' : 'filtros');

  // Campos por filtros
  const [distrito, setDistrito] = useState(CAMPO_VACIO);
  const [instancia, setInstancia] = useState(CAMPO_VACIO);
  const [especialidad, setEspecialidad] = useState(CAMPO_VACIO);
  const [anio, setAnio] = useState(CAMPO_VACIO);
  const [nroExpediente, setNroExpediente] = useState('');
  const [parte, setParte] = useState('');

  // Por código de expediente
  const [codigoExpediente, setCodigoExpediente] = useState(codigoInicial);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estado del modal de identidad
  const [modalIdentidadAbierto, setModalIdentidadAbierto] = useState(false);
  // Filtros pendientes de ejecutar tras validar identidad
  const [filtrosPendientes, setFiltrosPendientes] = useState<Parameters<typeof onBuscar>[0] | null>(null);

  // Cuando cambia instancia, resetear especialidad
  useEffect(() => {
    setEspecialidad(CAMPO_VACIO);
  }, [instancia]);

  // Especialidades disponibles según instancia seleccionada
  const especialidadesDisponibles =
    instancia !== CAMPO_VACIO
      ? ESPECIALIDADES_POR_INSTANCIA[instancia] ||
        ESPECIALIDADES_POR_INSTANCIA['default']
      : ESPECIALIDADES_POR_INSTANCIA['default'];

  const validarFiltros = (): boolean => {
    const e: Record<string, string> = {};
    if (distrito === CAMPO_VACIO) e.distrito = 'Selecciona un distrito judicial';
    if (instancia === CAMPO_VACIO) e.instancia = 'Selecciona una instancia';
    if (especialidad === CAMPO_VACIO) e.especialidad = 'Selecciona una especialidad';
    if (anio === CAMPO_VACIO) e.anio = 'Selecciona el año';
    if (!nroExpediente.trim()) e.nroExpediente = 'Ingresa el número de expediente';
    if (!parte.trim()) e.parte = 'Ingresa al menos un apellido o razón social';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validarCodigo = (): boolean => {
    const e: Record<string, string> = {};
    if (!codigoExpediente.trim()) {
      e.codigoExpediente = 'Ingresa el código del expediente';
    } else if (!/\d{4,5}-\d{4}/.test(codigoExpediente)) {
      e.codigoExpediente = 'Formato inválido. Ej: 00456-2024-0-1801-JR-CI-05';
    }
    // El portal del PJ exige la parte también en la consulta por código
    if (!parte.trim()) e.parte = 'Ingresa al menos un apellido o razón social';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modo === 'filtros') {
      if (!validarFiltros()) return;
    } else {
      if (!validarCodigo()) return;
    }

    const filtros = {
      modo,
      distritoJudicial: distrito,
      instancia,
      especialidad,
      anio,
      nroExpediente,
      parte,
      codigoExpediente,
    };

    // Si no tiene identidad guardada, pedir validación primero
    if (!tieneIdentidad) {
      setFiltrosPendientes(filtros);
      setModalIdentidadAbierto(true);
      return;
    }

    onBuscar(filtros);
  };

  // Llamado cuando el usuario valida su identidad en el modal
  const handleIdentidadValidada = (_datos: DatosIdentidad) => {
    if (filtrosPendientes) {
      onBuscar(filtrosPendientes);
      setFiltrosPendientes(null);
    }
  };

  const handleLimpiar = () => {
    setDistrito(CAMPO_VACIO);
    setInstancia(CAMPO_VACIO);
    setEspecialidad(CAMPO_VACIO);
    setAnio(CAMPO_VACIO);
    setNroExpediente('');
    setParte('');
    setCodigoExpediente('');
    setErrors({});
  };

  // Rellena el formulario con datos de prueba para test rápido
  const handleRellenarPrueba = () => {
    setDistrito('LIMA');
    setInstancia('CORTE SUPREMA');
    setEspecialidad('SALA CIVIL PERMANENTE');
    setAnio('2024');
    setNroExpediente('00456');
    setParte('GARCIA LOPEZ');
    setErrors({});
  };

  return (
    <>
    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1527]/80 backdrop-blur-md shadow-xl overflow-hidden">
      {/* Chip de identidad guardada */}
      {tieneIdentidad && identidad ? (
        <div className="flex items-center justify-between px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-300 font-medium">
              Identidad verificada ·{' '}
              <span className="font-mono">
                {identidad.tipoDocumento} {identidad.numeroDocumento}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setModalIdentidadAbierto(true)}
            className="text-[11px] text-slate-400 hover:text-white transition underline"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-amber-400 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span className="text-xs text-amber-300">
            Se solicitará validar tu identidad antes de realizar la primera consulta.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-2 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => {
            setModo('filtros');
            setErrors({});
          }}
          className={`py-3.5 text-sm font-semibold transition-all ${
            modo === 'filtros'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-[#0d1527] text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Por filtros
        </button>
        <button
          type="button"
          onClick={() => {
            setModo('codigo');
            setErrors({});
          }}
          className={`py-3.5 text-sm font-semibold transition-all ${
            modo === 'codigo'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-[#0d1527] text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          Por Código de Expediente
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-7">
        {modo === 'filtros' ? (
          <div className="space-y-4">
            {/* Botón de datos de prueba */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRellenarPrueba}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-amber-400 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Rellenar con datos de prueba
              </button>
            </div>
            {/* Fila 1: Distrito Judicial */}
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-x-4 gap-y-1">
              <label className="text-xs font-medium text-slate-300 pt-2.5 text-right sm:text-right">
                Distrito judicial <span className="text-amber-400">(*)</span>
              </label>
              <div className="space-y-1">
                <select
                  value={distrito}
                  onChange={(e) => {
                    setDistrito(e.target.value);
                    setErrors((prev) => ({ ...prev, distrito: '' }));
                  }}
                  className={`w-full px-3 py-2.5 bg-[#162035] border rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition appearance-none cursor-pointer ${
                    errors.distrito
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-[#233352] focus:border-amber-500'
                  }`}
                >
                  {DISTRITOS_JUDICIALES.map((d) => (
                    <option key={d} value={d} className="bg-[#162035]">
                      {d}
                    </option>
                  ))}
                </select>
                {errors.distrito && (
                  <p className="text-[11px] text-red-400">{errors.distrito}</p>
                )}
              </div>
            </div>

            {/* Fila 2: Instancia */}
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-x-4 gap-y-1">
              <label className="text-xs font-medium text-slate-300 pt-2.5 text-right sm:text-right">
                Instancia <span className="text-amber-400">(*)</span>
              </label>
              <div className="space-y-1">
                <select
                  value={instancia}
                  onChange={(e) => {
                    setInstancia(e.target.value);
                    setErrors((prev) => ({ ...prev, instancia: '' }));
                  }}
                  disabled={distrito === CAMPO_VACIO}
                  className={`w-full px-3 py-2.5 bg-[#162035] border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    instancia === CAMPO_VACIO ? 'text-slate-400' : 'text-white'
                  } ${
                    errors.instancia
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-[#233352] focus:border-amber-500'
                  }`}
                >
                  <option value={CAMPO_VACIO} disabled className="bg-[#162035] text-slate-400">
                    {distrito === CAMPO_VACIO ? 'Primero selecciona un distrito' : '--SELECCIONAR--'}
                  </option>
                  {INSTANCIAS_GENERALES.filter((inst) => inst !== CAMPO_VACIO).map((inst) => (
                    <option key={inst} value={inst} className="bg-[#162035] text-white">
                      {inst}
                    </option>
                  ))}
                </select>
                {errors.instancia && (
                  <p className="text-[11px] text-red-400">{errors.instancia}</p>
                )}
              </div>
            </div>

            {/* Fila 3: Especialidad */}
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-x-4 gap-y-1">
              <label className="text-xs font-medium text-slate-300 pt-2.5 text-right sm:text-right">
                Especialidad <span className="text-amber-400">(*)</span>
              </label>
              <div className="space-y-1">
                <select
                  value={especialidad}
                  onChange={(e) => {
                    setEspecialidad(e.target.value);
                    setErrors((prev) => ({ ...prev, especialidad: '' }));
                  }}
                  disabled={instancia === CAMPO_VACIO}
                  className={`w-full px-3 py-2.5 bg-[#162035] border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    especialidad === CAMPO_VACIO ? 'text-slate-400' : 'text-white'
                  } ${
                    errors.especialidad
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-[#233352] focus:border-amber-500'
                  }`}
                >
                  <option value={CAMPO_VACIO} disabled className="bg-[#162035] text-slate-400">
                    {instancia === CAMPO_VACIO ? 'Primero selecciona una instancia' : '--SELECCIONAR--'}
                  </option>
                  {especialidadesDisponibles.filter((esp) => esp !== CAMPO_VACIO).map((esp) => (
                    <option key={esp} value={esp} className="bg-[#162035] text-white">
                      {esp}
                    </option>
                  ))}
                </select>
                {errors.especialidad && (
                  <p className="text-[11px] text-red-400">{errors.especialidad}</p>
                )}
              </div>
            </div>

            {/* Fila 4: Año */}
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-x-4 gap-y-1">
              <label className="text-xs font-medium text-slate-300 pt-2.5 text-right sm:text-right">
                Año <span className="text-amber-400">(*)</span>
              </label>
              <div className="space-y-1">
                <select
                  value={anio}
                  onChange={(e) => {
                    setAnio(e.target.value);
                    setErrors((prev) => ({ ...prev, anio: '' }));
                  }}
                  className={`w-full px-3 py-2.5 bg-[#162035] border rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition appearance-none cursor-pointer ${
                    errors.anio
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-[#233352] focus:border-amber-500'
                  }`}
                >
                  {ANIOS.map((a) => (
                    <option key={a} value={a} className="bg-[#162035]">
                      {a}
                    </option>
                  ))}
                </select>
                {errors.anio && (
                  <p className="text-[11px] text-red-400">{errors.anio}</p>
                )}
              </div>
            </div>

            {/* Fila 5: Nº Expediente */}
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-x-4 gap-y-1">
              <label className="text-xs font-medium text-slate-300 pt-2.5 text-right sm:text-right">
                Nº Expediente <span className="text-amber-400">(*)</span>
              </label>
              <div className="space-y-1">
                <input
                  type="text"
                  value={nroExpediente}
                  onChange={(e) => {
                    setNroExpediente(e.target.value);
                    setErrors((prev) => ({ ...prev, nroExpediente: '' }));
                  }}
                  placeholder="Nº EXPEDIENTE"
                  className={`w-full px-3.5 py-2.5 bg-[#162035] border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-mono ${
                    errors.nroExpediente
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-[#233352] focus:border-amber-500'
                  }`}
                />
                {errors.nroExpediente && (
                  <p className="text-[11px] text-red-400">{errors.nroExpediente}</p>
                )}
              </div>
            </div>

            {/* Fila 6: Parte */}
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] items-start gap-x-4 gap-y-1">
              <label className="text-xs font-medium text-slate-300 pt-2.5 text-right sm:text-right">
                Parte <span className="text-amber-400">(*)</span>
              </label>
              <div className="space-y-1">
                <input
                  type="text"
                  value={parte}
                  onChange={(e) => {
                    setParte(e.target.value);
                    setErrors((prev) => ({ ...prev, parte: '' }));
                  }}
                  placeholder="APELLIDO PATERNO Y APELLIDO MATERNO O RAZÓN SOCIAL"
                  className={`w-full px-3.5 py-2.5 bg-[#162035] border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition ${
                    errors.parte
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-[#233352] focus:border-amber-500'
                  }`}
                />
                {errors.parte && (
                  <p className="text-[11px] text-red-400">{errors.parte}</p>
                )}
                <p className="text-[11px] text-amber-300/80 italic leading-relaxed mt-1">
                  Ingresar ambos apellidos (paterno y materno) o la razón social de alguna de las
                  partes involucradas en el proceso, respetando el orden y la forma exacta en que
                  aparecen en cualquiera de las resoluciones del expediente.
                </p>
              </div>
            </div>

            {/* Nota obligatorios */}
            <div className="pt-1 text-center">
              <span className="text-xs text-amber-400 font-medium">(*) Datos obligatorios</span>
            </div>
          </div>
        ) : (
          /* Tab: Por Código de Expediente */
          <div className="space-y-4 max-w-lg mx-auto">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Código Único de Expediente (CUE){' '}
                <span className="text-amber-400">(*)</span>
              </label>
              <input
                type="text"
                value={codigoExpediente}
                onChange={(e) => {
                  setCodigoExpediente(e.target.value);
                  setErrors((prev) => ({ ...prev, codigoExpediente: '' }));
                }}
                placeholder="Ej. 00456-2024-0-1801-JR-CI-05"
                className={`w-full px-3.5 py-3 bg-[#162035] border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-mono ${
                  errors.codigoExpediente
                    ? 'border-red-500/60 focus:border-red-500'
                    : 'border-[#233352] focus:border-amber-500'
                }`}
                autoFocus
              />
              {errors.codigoExpediente && (
                <p className="text-[11px] text-red-400">{errors.codigoExpediente}</p>
              )}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Formato estándar del Poder Judicial:{' '}
                <span className="text-amber-400 font-mono">NNNNN-AAAA-0-DDDD-INST-ESPEC-NN</span>
              </p>
              {/* Ejemplos rápidos */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-500">Ejemplos:</span>
                {['00456-2024-0-1801-JR-CI-05', '01234-2024-0-1801-JR-PE-03'].map((ej) => (
                  <button
                    key={ej}
                    type="button"
                    onClick={() => setCodigoExpediente(ej)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    {ej}
                  </button>
                ))}
              </div>
            </div>

            {/* Parte (obligatoria también en la consulta por código) */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Parte <span className="text-amber-400">(*)</span>
              </label>
              <input
                type="text"
                value={parte}
                onChange={(e) => {
                  setParte(e.target.value);
                  setErrors((prev) => ({ ...prev, parte: '' }));
                }}
                placeholder="APELLIDO PATERNO Y APELLIDO MATERNO O RAZÓN SOCIAL"
                className={`w-full px-3.5 py-3 bg-[#162035] border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition ${
                  errors.parte
                    ? 'border-red-500/60 focus:border-red-500'
                    : 'border-[#233352] focus:border-amber-500'
                }`}
              />
              {errors.parte && (
                <p className="text-[11px] text-red-400">{errors.parte}</p>
              )}
              <p className="text-[11px] text-amber-300/80 italic leading-relaxed">
                Ingresar ambos apellidos (paterno y materno) o la razón social de alguna de las
                partes involucradas en el proceso, tal como aparecen en las resoluciones del expediente.
              </p>
            </div>

            <div className="pt-1 text-center">
              <span className="text-xs text-amber-400 font-medium">(*) Datos obligatorios</span>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-slate-800/60">
          <button
            type="button"
            onClick={handleLimpiar}
            className="px-5 py-2.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Limpiar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-8 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-sm rounded-lg shadow-lg shadow-amber-500/20 transition duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Consultar Expediente
              </>
            )}
          </button>
        </div>
      </form>
    </div>

    {/* Modal de Validación de Identidad */}
    <ModalIdentidad
      isOpen={modalIdentidadAbierto}
      onClose={() => {
        setModalIdentidadAbierto(false);
        setFiltrosPendientes(null);
      }}
      onValidado={handleIdentidadValidada}
    />
    </>
  );
}
