export interface Casacion {
  id: number
  edicion_id: number
  archivo_pdf: string
  anio_carpeta: string
  mes_carpeta: string
  numero_casacion: string
  anio_casacion: string
  tipo: string
  distrito: string
  pleno_casatorio: boolean
  numero_edicion: string
  fecha_publicacion: string
  fecha_resolucion: string
  sala: string
  vocal_ponente: string
  vocales: string
  demandante: string
  demandado: string
  materia: string
  via_procedimental: string
  instancia_origen: string
  causal_casacion: string
  tipo_infraccion: string
  norma_infringida: string
  resultado: string
  reenvio: string
  precedente_vinculante: string
  sumilla: string
  monto_soles: string
  codigo_final: string
  texto_completo: string
  created_at: string
}

export interface Edicion {
  id: number
  numero_edicion: string
  fecha_publicacion: string
  download_url: string
  procesada: boolean
  created_at: string
}

export interface CasacionConEdicion extends Casacion {
  ediciones?: Edicion
}

export interface FiltrosState {
  busqueda: string
  tipo: string
  anio: string
  mes: string
  fechaDesde: string
  fechaHasta: string
}

// Tipos para Culqi
export interface Plan {
  id: string
  nombre: string
  precio: number
  consultas_mes: number
  descripcion: string
  activo: boolean
}

export interface Perfil {
  id: string
  email: string
  nombre: string | null
  plan_id: string
  consultas_usadas: number
  fecha_reset: string
  culqi_customer_id: string | null
  creditos: number
  created_at: string
}

export interface PaqueteCreditos {
  id: string
  nombre: string
  creditos: number
  precio: number
  descripcion: string | null
  destacado: boolean
  activo: boolean
}

export interface CreditosHistorial {
  id: string
  perfil_id: string
  tipo: 'compra' | 'consumo' | 'ajuste'
  cantidad: number
  saldo_resultante: number
  descripcion: string | null
  culqi_charge_id: string | null
  created_at: string
}

export interface Suscripcion {
  id: string
  perfil_id: string
  plan_id: string
  estado: 'activa' | 'cancelada' | 'expirada'
  fecha_inicio: string
  fecha_fin: string | null
  culqi_subscription_id: string | null
  created_at: string
}

export interface Pago {
  id: string
  perfil_id: string
  monto: number
  moneda: string
  estado: 'completado' | 'fallido' | 'pendiente'
  metodo_pago: string | null
  culqi_charge_id: string | null
  created_at: string
}

export interface CulqiToken {
  id: string
  type: string
  email: string
  card_number: string
  last_four: string
  active: boolean
  iin: {
    card_brand: string
    card_type: string
    issuer: {
      name: string
      country: string
    }
  }
}

export interface CulqiOrder {
  id: string
  amount: number
  currency_code: string
  state: string
  qr_code?: string
  cip_code?: string
}

// Tipos para alertas de expedientes (CEJ)
export type ConsultaEstado =
  | 'pendiente'
  | 'consultando'
  | 'requiere_captcha'
  | 'ok'
  | 'no_encontrado'
  | 'error'

export interface FichaExpediente {
  codigo: string
  distritoJudicial: string
  organo: string
  parte: string | null
  estadoProcesal: string
  ultimaActuacion: string | null
  especialidad: string
  juez: string
  materia: string
  ficha: Record<string, string>
  partes: string[][]
  actuaciones?: ActuacionResumen[]
}

export interface ActuacionResumen {
  fecha: string | null
  resolucion: string
  acto: string
  sumilla: string
}

export interface AlertaExpediente {
  id: string
  perfil_id: string
  tipo: 'expediente' | 'palabra_clave'
  valor: string
  parte: string | null
  filtros: Record<string, string> | null
  detalle: string | null
  estado: 'activo' | 'pausado' | 'encontrado'
  ficha: FichaExpediente | null
  ultima_actuacion: string | null
  ultimo_error: string | null
  consulta_estado: ConsultaEstado
  consulta_solicitada: string
  prioridad: number
  fecha_registro: string
  ultima_revision: string
}

export interface NotificacionExpediente {
  id: string
  perfil_id: string
  alerta_id: string
  titulo: string
  mensaje: string
  fecha_hora: string
  leida: boolean
  expediente: string | null
  url_documento: string | null
  documento_path: string | null
  created_at: string
}

export interface IdentidadResumen {
  tipo_documento: 'DNI' | 'CE'
  documento_mascara: string
  updated_at: string
}

export interface WorkerEstado {
  id: string
  estado: 'activo' | 'verificacion_navegador' | 'cej_no_disponible'
  mensaje: string | null
  actualizado: string
}
