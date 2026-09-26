// ============================================================
// CASACIONES DATA - Resoluciones de casación simuladas
// Simula el índice (OpenSearch) de PDFs de las Salas Supremas.
// Será reemplazado por la API real en la fase de integración.
// ============================================================

export interface Casacion {
  id: string;
  numero: string; // Ej. "CAS. N° 1234-2023 LIMA"
  materia: string;
  sala: string;
  vocalPonente: string;
  fechaPublicacion: string;
  sumilla: string;
}

export const casacionesMock: Casacion[] = [
  {
    id: 'cas_001',
    numero: 'CAS. N° 4521-2022 LIMA',
    materia: 'Indemnización por despido arbitrario',
    sala: 'Segunda Sala de Derecho Constitucional y Social Transitoria',
    vocalPonente: 'Arévalo Vela',
    fechaPublicacion: '2024-09-12',
    sumilla:
      'El despido fraudulento genera el derecho a indemnización por daño moral cuando se acredita la afectación a la dignidad del trabajador.',
  },
  {
    id: 'cas_002',
    numero: 'CAS. N° 1287-2023 AREQUIPA',
    materia: 'Nulidad de acto jurídico',
    sala: 'Sala Civil Permanente',
    vocalPonente: 'Calderón Puertas',
    fechaPublicacion: '2024-08-28',
    sumilla:
      'La simulación absoluta requiere acreditar la inexistencia de voluntad real de celebrar el acto, no bastando indicios aislados.',
  },
  {
    id: 'cas_003',
    numero: 'CAS. N° 3309-2021 LA LIBERTAD',
    materia: 'Prescripción adquisitiva de dominio',
    sala: 'Sala Civil Transitoria',
    vocalPonente: 'Echevarría Gaviria',
    fechaPublicacion: '2024-07-19',
    sumilla:
      'La posesión como propietario exige conducta de dueño; el pago de tributos municipales es un indicio relevante mas no determinante.',
  },
  {
    id: 'cas_004',
    numero: 'CAS. N° 875-2023 CUSCO',
    materia: 'Reposición laboral',
    sala: 'Segunda Sala de Derecho Constitucional y Social Transitoria',
    vocalPonente: 'Arévalo Vela',
    fechaPublicacion: '2024-10-02',
    sumilla:
      'Procede la reposición cuando el contrato modal se desnaturaliza por ausencia de causa objetiva determinante.',
  },
  {
    id: 'cas_005',
    numero: 'CAS. N° 2140-2022 PIURA',
    materia: 'Tributario - Impuesto a la Renta',
    sala: 'Tercera Sala de Derecho Constitucional y Social Transitoria',
    vocalPonente: 'Burneo Bermejo',
    fechaPublicacion: '2024-06-05',
    sumilla:
      'Los gastos de representación son deducibles siempre que se acredite su vinculación con la generación de renta gravada.',
  },
  {
    id: 'cas_006',
    numero: 'CAS. N° 598-2023 LIMA NORTE',
    materia: 'Alimentos',
    sala: 'Sala Civil Permanente',
    vocalPonente: 'Calderón Puertas',
    fechaPublicacion: '2024-09-30',
    sumilla:
      'El estado de necesidad del hijo mayor de edad que cursa estudios exitosamente se presume y no requiere prueba adicional.',
  },
];

/**
 * Búsqueda simulada: coincide el término (sin tildes, sin mayúsculas)
 * contra número, materia, sala, vocal ponente y sumilla.
 */
export function buscarCasaciones(termino: string): Casacion[] {
  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = normalizar(termino.trim());
  if (!q) return casacionesMock;

  return casacionesMock.filter((c) =>
    [c.numero, c.materia, c.sala, c.vocalPonente, c.sumilla].some((campo) =>
      normalizar(campo).includes(q)
    )
  );
}
