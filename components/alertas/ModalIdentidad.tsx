'use client';

import React, { useState, useEffect } from 'react';
import { useIdentidad, DatosIdentidad } from '@/hooks/useIdentidad';

// ============================================================
// MODAL VALIDACIÓN DE IDENTIDAD DEL CONSULTANTE
// Replica el modal del Portal del Poder Judicial del Perú.
// Los datos se guardan en localStorage y no se vuelven a pedir.
// ============================================================

const TIPOS_DOCUMENTO = [
  '-- Seleccionar --',
  'DNI',
  'Carnet de Extranjería',
  'Pasaporte',
  'RUC',
];

interface ModalIdentidadProps {
  isOpen: boolean;
  onClose: () => void;
  /** Llamado cuando la identidad es validada exitosamente */
  onValidado: (datos: DatosIdentidad) => void;
}

export default function ModalIdentidad({ isOpen, onClose, onValidado }: ModalIdentidadProps) {
  const { identidad, guardarIdentidad } = useIdentidad();

  const [tipo, setTipo] = useState('-- Seleccionar --');
  const [numero, setNumero] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  // Pre-llenar si ya hay datos guardados
  useEffect(() => {
    if (identidad) {
      setTipo(identidad.tipoDocumento);
      setNumero(identidad.numeroDocumento);
      setFechaEmision(identidad.fechaEmision);
      setFechaNacimiento(identidad.fechaNacimiento);
    }
  }, [identidad, isOpen]);

  if (!isOpen) return null;

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (tipo === '-- Seleccionar --') e.tipo = 'Selecciona el tipo de documento';
    if (!numero.trim()) e.numero = 'Ingresa el número de documento';
    else if (tipo === 'DNI' && !/^\d{8}$/.test(numero.trim()))
      e.numero = 'El DNI debe tener exactamente 8 dígitos';
    if (!fechaEmision) e.fechaEmision = 'Ingresa la fecha de emisión';
    if (!fechaNacimiento) e.fechaNacimiento = 'Ingresa la fecha de nacimiento';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleValidar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    setEnviando(true);
    // Simula validación con el PJ (~600ms)
    setTimeout(() => {
      const datos: Omit<DatosIdentidad, 'guardadoEn'> = {
        tipoDocumento: tipo,
        numeroDocumento: numero.trim(),
        fechaEmision,
        fechaNacimiento,
      };
      guardarIdentidad(datos);
      setEnviando(false);
      onValidado({ ...datos, guardadoEn: new Date().toISOString() });
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-lg shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="bg-[#8b0000] px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-base text-center flex-1 uppercase tracking-wide leading-tight">
            Validación de Identidad del<br />Consultante
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 text-xl font-bold ml-4 leading-none transition"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Descripción */}
        <div className="px-6 pt-5 pb-2 text-center">
          <p className="text-sm text-gray-700 leading-relaxed">
            Antes de realizar la consulta, <strong>confirme su identidad</strong> ingresando los datos de su documento de identidad.
          </p>
          {/* Ícono de persona */}
          <div className="mt-4 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#f5c6c6] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="#8b0000"
                className="w-10 h-10"
              >
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
          </div>

          {/* Indicador de datos guardados */}
          {identidad && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-xs text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Datos guardados previamente · {identidad.tipoDocumento} {identidad.numeroDocumento}
            </div>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleValidar} className="px-6 pb-2 pt-4 space-y-4">
          {/* Tipo de documento */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-x-3 gap-y-1">
            <label className="text-sm font-semibold text-gray-700 pt-2.5 text-right leading-tight">
              Tipo de<br />documento{' '}
              <span className="text-[#8b0000]">*</span>
            </label>
            <div className="space-y-1">
              <select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  setErrors((p) => ({ ...p, tipo: '' }));
                }}
                className={`w-full px-3 py-2 border rounded text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 transition ${
                  errors.tipo ? 'border-red-400 focus:ring-red-300' : 'border-blue-300 focus:ring-blue-300'
                }`}
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.tipo && <p className="text-xs text-red-500">{errors.tipo}</p>}
            </div>
          </div>

          {/* Número de documento */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-x-3 gap-y-1">
            <label className="text-sm font-semibold text-gray-700 pt-2.5 text-right leading-tight">
              Número de<br />documento{' '}
              <span className="text-[#8b0000]">*</span>
            </label>
            <div className="space-y-1">
              <input
                type="text"
                value={numero}
                onChange={(e) => {
                  setNumero(e.target.value);
                  setErrors((p) => ({ ...p, numero: '' }));
                }}
                placeholder="Ingresar número de documento"
                maxLength={tipo === 'DNI' ? 8 : 20}
                className={`w-full px-3 py-2 border rounded text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${
                  errors.numero ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-300'
                }`}
              />
              {errors.numero && <p className="text-xs text-red-500">{errors.numero}</p>}
            </div>
          </div>

          {/* Fecha de emisión */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-x-3 gap-y-1">
            <label className="text-sm font-semibold text-gray-700 pt-2.5 text-right leading-tight">
              Fecha de emisión{' '}
              <span className="text-[#8b0000]">*</span>
            </label>
            <div className="space-y-1">
              <input
                type="date"
                value={fechaEmision}
                onChange={(e) => {
                  setFechaEmision(e.target.value);
                  setErrors((p) => ({ ...p, fechaEmision: '' }));
                }}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2 border rounded text-sm text-gray-800 focus:outline-none focus:ring-2 transition ${
                  errors.fechaEmision ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-300'
                }`}
              />
              {errors.fechaEmision && <p className="text-xs text-red-500">{errors.fechaEmision}</p>}
            </div>
          </div>

          {/* Fecha de nacimiento */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-x-3 gap-y-1">
            <label className="text-sm font-semibold text-gray-700 pt-2.5 text-right leading-tight">
              Fecha de<br />nacimiento{' '}
              <span className="text-[#8b0000]">*</span>
            </label>
            <div className="space-y-1">
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => {
                  setFechaNacimiento(e.target.value);
                  setErrors((p) => ({ ...p, fechaNacimiento: '' }));
                }}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2 border rounded text-sm text-gray-800 focus:outline-none focus:ring-2 transition ${
                  errors.fechaNacimiento ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-300'
                }`}
              />
              {errors.fechaNacimiento && <p className="text-xs text-red-500">{errors.fechaNacimiento}</p>}
            </div>
          </div>

          {/* Aviso de persistencia */}
          <div className="flex items-start gap-2 pt-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b0000" strokeWidth="2" className="w-4 h-4 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Tus datos se guardarán de forma local en este dispositivo. No necesitarás ingresarlos nuevamente en futuras consultas.
            </p>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-center gap-4 pt-3 pb-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-2.5 rounded border border-gray-400 text-sm font-bold text-gray-600 hover:bg-gray-100 transition uppercase tracking-wide"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-8 py-2.5 rounded bg-[#8b0000] hover:bg-[#6b0000] text-white text-sm font-bold transition uppercase tracking-wide shadow disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {enviando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                'Validar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
