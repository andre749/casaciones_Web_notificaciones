// ============================================================
// EXPEDIENTES DATA - Consulta simulada al portal CEJ del PJ
// Recibe los filtros del BuscadorExpedientes y devuelve la
// ficha del expediente. Será reemplazado por el scraper real.
// ============================================================

import type { FiltrosBusqueda } from '@/components/alertas/BuscadorExpedientes';

export interface ExpedienteEncontrado {
  codigo: string; // CUE o "NNNNN-AAAA" cuando se consulta por filtros
  distritoJudicial: string;
  organo: string; // Instancia / Especialidad
  parte?: string;
  estadoProcesal: string;
  ultimaActuacion: string; // ISO date
}

// Códigos de especialidad del CUE -> nombre legible
const ESPECIALIDADES_CUE: Record<string, string> = {
  CI: 'CIVIL',
  PE: 'PENAL',
  LA: 'LABORAL',
  FA: 'FAMILIA',
  CA: 'CONTENCIOSO ADMINISTRATIVO',
  CO: 'COMERCIAL',
};

// Instancias del CUE -> nombre legible
const INSTANCIAS_CUE: Record<string, string> = {
  JR: 'JUZGADO ESPECIALIZADO',
  JP: 'JUZGADO DE PAZ LETRADO',
  SP: 'SALA SUPERIOR',
  SU: 'CORTE SUPREMA',
};

/** Simula la latencia de consulta y devuelve la ficha del expediente. */
export function consultarExpediente(filtros: FiltrosBusqueda): Promise<ExpedienteEncontrado> {
  const hace3Dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  let resultado: ExpedienteEncontrado;

  if (filtros.modo === 'codigo') {
    // CUE: NNNNN-AAAA-0-DDDD-INST-ESPEC-NN
    const codigo = filtros.codigoExpediente.trim().toUpperCase();
    const [, , , , inst, espec, nro] = codigo.split('-');
    const instancia = INSTANCIAS_CUE[inst] ?? 'ÓRGANO JURISDICCIONAL';
    const especialidad = ESPECIALIDADES_CUE[espec] ?? '';
    resultado = {
      codigo,
      distritoJudicial: 'LIMA',
      organo: [nro ? `${Number(nro)}° ${instancia}` : instancia, especialidad]
        .filter(Boolean)
        .join(' '),
      parte: filtros.parte.trim().toUpperCase(),
      estadoProcesal: 'EN TRÁMITE',
      ultimaActuacion: hace3Dias,
    };
  } else {
    resultado = {
      codigo: `${filtros.nroExpediente.trim().padStart(5, '0')}-${filtros.anio}`,
      distritoJudicial: filtros.distritoJudicial,
      organo: `${filtros.instancia} · ${filtros.especialidad}`,
      parte: filtros.parte.trim().toUpperCase(),
      estadoProcesal: 'EN TRÁMITE',
      ultimaActuacion: hace3Dias,
    };
  }

  return new Promise((resolve) => setTimeout(() => resolve(resultado), 800));
}
