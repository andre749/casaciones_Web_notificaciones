import { jsPDF } from 'jspdf'
import { AlertaExpediente } from './types'

const fechaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/**
 * Reporte PDF del expediente con los datos de la ultima revision del CEJ:
 * ficha, partes procesales y actuaciones (seguimiento).
 */
export function descargarPdfExpediente(alerta: AlertaExpediente) {
  const ficha = alerta.ficha
  if (!ficha) return

  const doc = new jsPDF()
  const margen = 20
  const ancho = doc.internal.pageSize.getWidth() - margen * 2
  const alto = doc.internal.pageSize.getHeight()
  let y = 20

  const espacio = (necesario: number) => {
    if (y + necesario > alto - 20) {
      doc.addPage()
      y = 20
    }
  }
  const parrafo = (texto: string, tamano = 9, estilo: 'normal' | 'bold' = 'normal', sangria = 0) => {
    doc.setFontSize(tamano)
    doc.setFont('helvetica', estilo)
    for (const linea of doc.splitTextToSize(texto, ancho - sangria)) {
      espacio(4.5)
      doc.text(linea, margen + sangria, y)
      y += 4.5
    }
  }
  const titulo = (texto: string) => {
    y += 4
    espacio(12)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(texto, margen, y)
    y += 2
    doc.setDrawColor(200)
    doc.line(margen, y, margen + ancho, y)
    y += 6
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`EXPEDIENTE N° ${ficha.codigo || alerta.valor}`, margen, y)
  y += 7
  parrafo(`Fuente: Consulta de Expedientes Judiciales (CEJ) del Poder Judicial. Ultima revision: ${fechaHora(alerta.ultima_revision)}`, 8)

  titulo('Datos del expediente')
  for (const [clave, valor] of Object.entries(ficha.ficha ?? {})) {
    if (!valor || clave.startsWith('Expediente')) continue
    espacio(5)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(`${clave}:`, margen, y)
    doc.setFont('helvetica', 'normal')
    const lineas = doc.splitTextToSize(valor, ancho - 45)
    lineas.forEach((l: string, i: number) => {
      if (i) espacio(4.5)
      doc.text(l, margen + 45, y)
      if (i < lineas.length - 1) y += 4.5
    })
    y += 5
  }

  if (ficha.partes?.length) {
    titulo('Partes procesales')
    for (const [rol, tipo, ...nombre] of ficha.partes) {
      parrafo(`${rol} (${tipo?.toLowerCase() ?? ''}): ${nombre.join(' ')}`)
    }
  }

  titulo('Seguimiento del expediente')
  if (!ficha.actuaciones) {
    parrafo('Las actuaciones se incluiran a partir de la proxima revision del expediente.')
  } else if (!ficha.actuaciones.length) {
    parrafo('El expediente no registra actuaciones a la fecha de la ultima revision.')
  } else {
    const ordenadas = [...ficha.actuaciones].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
    for (const a of ordenadas) {
      y += 1
      parrafo(`${fechaHora(a.fecha)}  ·  ${a.acto || 'Actuacion'}${a.resolucion ? `  ·  Res. ${a.resolucion}` : ''}`, 9, 'bold')
      if (a.sumilla) parrafo(a.sumilla, 9, 'normal', 4)
    }
  }

  doc.save(`Expediente_${(ficha.codigo || alerta.valor).replace(/[^\w-]/g, '_')}.pdf`)
}
