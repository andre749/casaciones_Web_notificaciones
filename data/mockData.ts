// ============================================================
// MOCK DATA - Datos simulados para la maqueta del Sistema de Alertas
// Este archivo centraliza toda la data ficticia que simula
// las respuestas del backend. Será reemplazado por llamadas
// API reales en la fase de integración.
// ============================================================

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  colegiatura: string; // Número de colegiatura del abogado
  membresia: 'basico' | 'profesional' | 'premium';
  tokensDisponibles: number;
  tokensTotales: number;
  avatarUrl?: string;
}

export interface Alerta {
  id: string;
  tipo: 'expediente' | 'palabra_clave';
  valor: string; // Número de expediente o palabra clave
  detalle?: string; // Órgano / distrito / parte del expediente consultado
  estado: 'activo' | 'pausado' | 'encontrado';
  fechaRegistro: string;
  ultimaRevision: string;
  costoTokens: number;
}

export interface Notificacion {
  id: string;
  alertaId: string;
  titulo: string;
  mensaje: string;
  fechaHora: string;
  leida: boolean;
  expediente?: string;
  urlDocumento?: string;
}

// --- Usuario Mock ---
export const usuarioMock: Usuario = {
  id: 'usr_001',
  nombre: 'Carlos',
  apellido: 'Mendoza Ríos',
  email: 'cmendoza@estudiolegalmendoza.pe',
  colegiatura: 'CAL-45892',
  membresia: 'profesional',
  tokensDisponibles: 142,
  tokensTotales: 200,
  avatarUrl: undefined,
};

// --- Alertas Registradas Mock ---
export const alertasMock: Alerta[] = [
  {
    id: 'alr_001',
    tipo: 'expediente',
    valor: '00456-2024-0-1801-JR-CI-05',
    estado: 'activo',
    fechaRegistro: '2024-10-01T10:30:00',
    ultimaRevision: '2024-10-15T14:22:00',
    costoTokens: 5,
  },
  {
    id: 'alr_002',
    tipo: 'expediente',
    valor: '01234-2024-0-1801-JR-PE-03',
    estado: 'encontrado',
    fechaRegistro: '2024-09-20T08:15:00',
    ultimaRevision: '2024-10-15T14:22:00',
    costoTokens: 5,
  },
  {
    id: 'alr_003',
    tipo: 'palabra_clave',
    valor: 'casación laboral indemnización',
    estado: 'activo',
    fechaRegistro: '2024-10-05T16:45:00',
    ultimaRevision: '2024-10-15T12:00:00',
    costoTokens: 3,
  },
  {
    id: 'alr_004',
    tipo: 'expediente',
    valor: '00789-2023-0-1706-JR-LA-01',
    estado: 'pausado',
    fechaRegistro: '2024-08-10T09:00:00',
    ultimaRevision: '2024-09-30T10:15:00',
    costoTokens: 5,
  },
];

// --- Notificaciones Mock ---
export const notificacionesMock: Notificacion[] = [
  {
    id: 'not_001',
    alertaId: 'alr_002',
    titulo: '¡Nuevo documento detectado!',
    mensaje:
      'Se ha encontrado una nueva resolución en el expediente N° 01234-2024-0-1801-JR-PE-03.',
    fechaHora: '2024-10-15T13:45:00',
    leida: false,
    expediente: '01234-2024-0-1801-JR-PE-03',
    urlDocumento: '#',
  },
  {
    id: 'not_002',
    alertaId: 'alr_001',
    titulo: 'Revisión completada',
    mensaje:
      'El expediente N° 00456-2024-0-1801-JR-CI-05 fue revisado. No se encontraron documentos nuevos.',
    fechaHora: '2024-10-15T14:22:00',
    leida: false,
    expediente: '00456-2024-0-1801-JR-CI-05',
  },
  {
    id: 'not_003',
    alertaId: 'alr_003',
    titulo: 'Resultado de búsqueda por palabra clave',
    mensaje:
      'Se encontraron 2 nuevos documentos relacionados con "casación laboral indemnización".',
    fechaHora: '2024-10-14T09:30:00',
    leida: true,
  },
  {
    id: 'not_004',
    alertaId: 'alr_002',
    titulo: '¡Nuevo documento detectado!',
    mensaje:
      'Se ha subido un nuevo auto admisorio en el expediente N° 01234-2024-0-1801-JR-PE-03.',
    fechaHora: '2024-10-12T11:15:00',
    leida: true,
    expediente: '01234-2024-0-1801-JR-PE-03',
    urlDocumento: '#',
  },
];
