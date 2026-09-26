'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Alerta } from '@/data/mockData';

// ============================================================
// DASHBOARD DE CASOS MONITOREADOS
// Tabla y tarjetas interactivas de expedientes en seguimiento.
// Permite:
// - Filtrar por estado (Activo, Encontrado, Pausado).
// - Buscar dentro de los expedientes monitoreados.
// - Pausar o reanudar el rastreo de cada caso.
// - Eliminar alertas con confirmación visual.
// - Ver/Descargar documentos detectados por el scraper.
// ============================================================

interface DashboardMonitoreoProps {
  onOpenCrearAlerta: () => void;
  onVerDocumento: (alerta: Alerta) => void;
}

export default function DashboardMonitoreo({
  onOpenCrearAlerta,
  onVerDocumento,
}: DashboardMonitoreoProps) {
  const { alertas, toggleEstadoAlerta, eliminarAlerta } = useApp();

  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'encontrado' | 'pausado'>('todos');
  const [busquedaLocal, setBusquedaLocal] = useState('');
  const [alertaAEliminar, setAlertaAEliminar] = useState<string | null>(null);
  const [toastAccion, setToastAccion] = useState<string | null>(null);

  // Conteo de métricas
  const totalCasos = alertas.length;
  const activos = alertas.filter((a) => a.estado === 'activo').length;
  const encontrados = alertas.filter((a) => a.estado === 'encontrado').length;
  const pausados = alertas.filter((a) => a.estado === 'pausado').length;

  // Filtrado de la lista
  const alertasFiltradas = alertas.filter((a) => {
    const coincideEstado = filtroEstado === 'todos' || a.estado === filtroEstado;
    const texto = [a.valor, a.detalle].filter(Boolean).join(' ').toLowerCase();
    const coincideTexto = texto.includes(busquedaLocal.toLowerCase());
    return coincideEstado && coincideTexto;
  });

  // Manejar eliminación con confirmación
  const confirmarEliminar = (id: string, valor: string) => {
    eliminarAlerta(id);
    setAlertaAEliminar(null);
    setToastAccion(`Se canceló el monitoreo de "${valor}".`);
    setTimeout(() => setToastAccion(null), 4000);
  };

  // Manejar pausar / reanudar
  const handleToggle = (id: string, estadoActual: string, valor: string) => {
    toggleEstadoAlerta(id);
    const nuevoEstado = estadoActual === 'activo' ? 'pausado' : 'reactivado';
    setToastAccion(`Monitoreo de "${valor}" ${nuevoEstado}.`);
    setTimeout(() => setToastAccion(null), 3500);
  };

  // Formateador de tiempo relativo
  const formatearTiempo = (fechaIso: string) => {
    const fecha = new Date(fechaIso);
    const diffMinutos = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60));
    if (diffMinutos < 60) return `Hace ${Math.max(5, diffMinutos)} min`;
    const diffHoras = Math.floor(diffMinutos / 60);
    if (diffHoras < 24) return `Hace ${diffHoras} h`;
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Toast de confirmación de acción */}
      {toastAccion && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121c33] border border-amber-500/50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs text-slate-200">{toastAccion}</span>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {alertaAEliminar && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">¿Cancelar monitoreo?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              El bot dejará de rastrear este expediente en el Poder Judicial. No recibirás más alertas de nuevas resoluciones para este caso.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAlertaAEliminar(null)}
                className="px-3.5 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Volver
              </button>
              <button
                onClick={() => {
                  const alerta = alertas.find((a) => a.id === alertaAEliminar);
                  if (alerta) confirmarEliminar(alerta.id, alerta.valor);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition"
              >
                Sí, cancelar monitoreo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Cabecera del Dashboard --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Casos en Monitoreo
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full">
              {totalCasos} en total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Rastreo continuo de casaciones en Salas Supremas y El Peruano.
          </p>
        </div>

        <button
          onClick={onOpenCrearAlerta}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-4 h-4"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Nueva Alerta
        </button>
      </div>

      {totalCasos === 0 ? (
        /* --- Estado vacío: usuario sin casos monitoreados --- */
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-[#0d1527]/50 px-6 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <h3 className="mt-5 text-base font-semibold text-white">
            Aún no tienes casos en monitoreo
          </h3>
          <p className="mt-1.5 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Crea una alerta sobre un expediente y el bot revisará el portal del Poder Judicial por ti.
            Te avisaremos en la campana superior apenas se publique una nueva resolución.
          </p>
          <button
            onClick={onOpenCrearAlerta}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Crear mi primera alerta
          </button>
          <p className="mt-4 text-[11px] text-slate-500">
            Se solicitará validar tu identidad (DNI, CE u otro) si aún no lo has hecho.
          </p>
        </div>
      ) : (
      <>
      {/* --- Barra de Filtros y Búsqueda Rápida --- */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Pestañas de Filtro por Estado */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0d1527] border border-slate-800/80 rounded-xl text-xs overflow-x-auto">
          <button
            onClick={() => setFiltroEstado('todos')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap font-medium ${
              filtroEstado === 'todos'
                ? 'bg-[#1a2640] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({totalCasos})
          </button>
          <button
            onClick={() => setFiltroEstado('activo')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 font-medium ${
              filtroEstado === 'activo'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Activos ({activos})
          </button>
          <button
            onClick={() => setFiltroEstado('encontrado')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 font-medium ${
              filtroEstado === 'encontrado'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Documento Detectado ({encontrados})
          </button>
          <button
            onClick={() => setFiltroEstado('pausado')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap font-medium ${
              filtroEstado === 'pausado'
                ? 'bg-slate-700/60 text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pausados ({pausados})
          </button>
        </div>

        {/* Buscador dentro de la lista */}
        <div className="relative w-full md:w-64">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-3.5 h-3.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="text"
            value={busquedaLocal}
            onChange={(e) => setBusquedaLocal(e.target.value)}
            placeholder="Filtrar mis casos..."
            className="w-full pl-9 pr-3 py-2 bg-[#121c33] border border-[#233352] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
      </div>

      {/* --- Tabla de Casos (Desktop) / Cards (Mobile) --- */}
      {alertasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0d1527]/50 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-400 mx-auto flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-6 h-6"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">
            No se encontraron casos con este filtro
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {busquedaLocal
              ? `No hay alertas que coincidan con "${busquedaLocal}".`
              : 'No tienes alertas en esta categoría.'}
          </p>
          <button
            onClick={onOpenCrearAlerta}
            className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs hover:bg-amber-500/20 transition"
          >
            + Registrar Nueva Alerta
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0d1527]/80 backdrop-blur-md overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#121c33] border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Expediente / Término</th>
                  <th className="px-5 py-3.5 font-semibold">Tipo</th>
                  <th className="px-5 py-3.5 font-semibold">Estado de Rastreo</th>
                  <th className="px-5 py-3.5 font-semibold">Última Revisión</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {alertasFiltradas.map((alerta) => (
                  <tr
                    key={alerta.id}
                    className="hover:bg-[#121c33]/50 transition group"
                  >
                    {/* Expediente / Valor */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            alerta.tipo === 'expediente'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {alerta.tipo === 'expediente' ? '📄' : '🔍'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-xs sm:max-w-sm">
                            {alerta.valor}
                          </p>
                          {alerta.detalle && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                              {alerta.detalle}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Registrado: {new Date(alerta.fechaRegistro).toLocaleDateString('es-PE')}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Tipo */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="capitalize px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                        {alerta.tipo === 'expediente' ? 'Expediente' : 'Palabra Clave'}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {alerta.estado === 'activo' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Activo (Buscando)
                        </span>
                      )}
                      {alerta.estado === 'encontrado' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          Documento Detectado
                        </span>
                      )}
                      {alerta.estado === 'pausado' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          Pausado
                        </span>
                      )}
                    </td>

                    {/* Última Revisión */}
                    <td className="px-5 py-4 whitespace-nowrap text-slate-400 text-[11px]">
                      {formatearTiempo(alerta.ultimaRevision)}
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Botón Ver Documento si ya fue encontrado */}
                        {alerta.estado === 'encontrado' && (
                          <button
                            onClick={() => onVerDocumento(alerta)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-medium transition"
                            title="Descargar documento detectado"
                          >
                            <span>📥</span>
                            <span>Ver PDF</span>
                          </button>
                        )}

                        {/* Botón Pausar / Reanudar */}
                        <button
                          onClick={() => handleToggle(alerta.id, alerta.estado, alerta.valor)}
                          className={`p-1.5 rounded-lg border transition ${
                            alerta.estado === 'activo'
                              ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-700 text-slate-300'
                              : 'border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                          }`}
                          title={alerta.estado === 'activo' ? 'Pausar monitoreo' : 'Reanudar monitoreo'}
                        >
                          {alerta.estado === 'activo' ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-3.5 h-3.5"
                            >
                              <rect x="6" y="4" width="4" height="16" />
                              <rect x="14" y="4" width="4" height="16" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-3.5 h-3.5"
                            >
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          )}
                        </button>

                        {/* Botón Eliminar / Cancelar Rastreo */}
                        <button
                          onClick={() => setAlertaAEliminar(alerta.id)}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-red-500/20 hover:border-red-500/30 text-slate-400 hover:text-red-300 transition"
                          title="Eliminar del monitoreo"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-3.5 h-3.5"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pie de tabla con información del scraper */}
          <div className="px-5 py-3 border-t border-slate-800/80 bg-[#121c33]/50 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>
              Mostrando <strong>{alertasFiltradas.length}</strong> de <strong>{totalCasos}</strong> alertas registradas.
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Sondeo automático activo cada 30 min en Salas Supremas
            </span>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
