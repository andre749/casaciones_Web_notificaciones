// ============================================================
// JUDICIAL DATA - Datos reales del Portal del Poder Judicial del Perú
// Distritos Judiciales, Instancias, Especialidades y Años
// ============================================================

export const DISTRITOS_JUDICIALES = [
  '--SELECCIONAR',
  'AMAZONAS',
  'ANCASH',
  'APURÍMAC',
  'AREQUIPA',
  'AYACUCHO',
  'CAJAMARCA',
  'CALLAO',
  'CAÑETE',
  'CUSCO',
  'DEL SANTA',
  'HUANCAVELICA',
  'HUÁNUCO',
  'ICA',
  'JUNÍN',
  'LA LIBERTAD',
  'LAMBAYEQUE',
  'LIMA',
  'LIMA ESTE',
  'LIMA NORTE',
  'LIMA SUR',
  'LORETO',
  'MADRE DE DIOS',
  'MOQUEGUA',
  'PASCO',
  'PIURA',
  'PUNO',
  'SAN MARTÍN',
  'SELVA CENTRAL',
  'SULLANA',
  'TACNA',
  'TUMBES',
  'UCAYALI',
  'VENTANILLA',
];

export const INSTANCIAS_GENERALES = [
  '--SELECCIONAR',
  'CORTE SUPREMA',
  'SALA SUPERIOR',
  'JUZGADO ESPECIALIZADO',
  'JUZGADO DE PAZ LETRADO',
  'JUZGADO DE PAZ',
];

export const ESPECIALIDADES_POR_INSTANCIA: Record<string, string[]> = {
  'CORTE SUPREMA': [
    '--SELECCIONAR',
    'SALA CIVIL PERMANENTE',
    'SALA CIVIL TRANSITORIA',
    'SALA PENAL PERMANENTE',
    'SALA PENAL TRANSITORIA',
    'SALA DE DERECHO CONSTITUCIONAL Y SOCIAL PERMANENTE',
    'SALA DE DERECHO CONSTITUCIONAL Y SOCIAL TRANSITORIA',
  ],
  'SALA SUPERIOR': [
    '--SELECCIONAR',
    'CIVIL',
    'PENAL',
    'LABORAL',
    'FAMILIA',
    'COMERCIAL',
    'CONSTITUCIONAL',
    'CONTENCIOSO ADMINISTRATIVO',
  ],
  'JUZGADO ESPECIALIZADO': [
    '--SELECCIONAR',
    'CIVIL',
    'PENAL',
    'LABORAL',
    'FAMILIA',
    'COMERCIAL',
    'CONSTITUCIONAL',
    'CONTENCIOSO ADMINISTRATIVO',
    'TRIBUTARIO Y ADUANERO',
  ],
  'JUZGADO DE PAZ LETRADO': [
    '--SELECCIONAR',
    'CIVIL',
    'PENAL',
    'LABORAL',
    'FAMILIA',
  ],
  'JUZGADO DE PAZ': ['--SELECCIONAR', 'CIVIL', 'PENAL', 'FAMILIA'],
  default: ['--SELECCIONAR'],
};

const currentYear = new Date().getFullYear();
export const ANIOS = [
  '--SELECCIONAR',
  ...Array.from({ length: currentYear - 1990 + 1 }, (_, i) =>
    String(currentYear - i)
  ),
];
