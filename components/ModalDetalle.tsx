'use client'

import { useState, useEffect, useCallback } from 'react'
import BotonPdf from './BotonPdf'
import { CasacionConEdicion } from '@/lib/types'

interface ModalDetalleProps {
  casacionId: number | null
  onCerrar: () => void
}

export default function ModalDetalle({ casacionId, onCerrar }: ModalDetalleProps) {
  const [casacion, setCasacion] = useState<CasacionConEdicion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [textoExpandido, setTextoExpandido] = useState(false)

  const cargarCasacion = useCallback(async (id: number) => {
    setCargando(true)
    setCasacion(null)
    setTextoExpandido(false)
    try {
      const res = await fetch(`/api/casaciones/${id}`)
      const data = await res.json()
      setCasacion(data)
    } catch {
      setCasacion(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (casacionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarCasacion(casacionId)
    }
  }, [casacionId, cargarCasacion])

  if (!casacionId) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onCerrar}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
            <div>
              {cargando ? (
                <div className="h-6 w-48 bg-slate-700 animate-pulse rounded"></div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-white">
                    Casacion N° {casacion?.numero_casacion}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {casacion?.tipo} - {casacion?.distrito}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {casacion && (
                <BotonPdf
                  numeroCasacion={casacion.numero_casacion}
                  tipo={casacion.tipo}
                  sala={casacion.sala}
                  materia={casacion.materia}
                  textoCompleto={casacion.texto_completo}
                />
              )}
              <button
                onClick={onCerrar}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-4">
            {cargando ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/30 border-t-amber-500"></div>
              </div>
            ) : casacion ? (
              <>
                {/* Identificacion */}
                <Section titulo="Identificacion">
                  <Campo label="Numero de Casacion" valor={casacion.numero_casacion} />
                  <Campo label="Tipo" valor={casacion.tipo} />
                  <Campo label="Distrito Judicial" valor={casacion.distrito} />
                  <Campo label="Sala" valor={casacion.sala} />
                  <Campo label="Codigo Final" valor={casacion.codigo_final} />
                  <Campo label="Fecha de Publicacion" valor={casacion.fecha_publicacion} />
                  <Campo label="Edicion" valor={casacion.numero_edicion} link={casacion.ediciones?.download_url} />
                  <Campo label="Fecha de Resolucion" valor={casacion.fecha_resolucion} />
                </Section>

                {/* Partes */}
                <Section titulo="Partes del Proceso">
                  <Campo label="Demandante" valor={casacion.demandante} />
                  <Campo label="Demandado" valor={casacion.demandado} />
                  <Campo label="Instancia de Origen" valor={casacion.instancia_origen} />
                  <Campo label="Via Procedimental" valor={casacion.via_procedimental} />
                </Section>

                {/* Materia y Causales */}
                <Section titulo="Materia y Causales">
                  <Campo label="Materia" valor={casacion.materia} />
                  <Campo label="Causal de Casacion" valor={casacion.causal_casacion} />
                  <Campo label="Tipo de Infraccion" valor={casacion.tipo_infraccion} />
                  <Campo label="Norma Infringida" valor={casacion.norma_infringida} />
                  <Campo label="Monto (S/)" valor={casacion.monto_soles} />
                </Section>

                {/* Fallo */}
                <Section titulo="Fallo">
                  <Campo label="Resultado" valor={casacion.resultado} destacado />
                  <Campo label="Reenvio" valor={casacion.reenvio} />
                  <Campo label="Precedente Vinculante" valor={casacion.precedente_vinculante} />
                  <Campo label="Pleno Casatorio" valor={casacion.pleno_casatorio ? 'Si' : 'No'} />
                </Section>

                {/* Vocales */}
                <Section titulo="Vocales">
                  <Campo label="Vocal Ponente" valor={casacion.vocal_ponente} />
                  <Campo label="Vocales" valor={casacion.vocales?.replace(/;/g, ', ')} />
                </Section>

                {/* Sumilla */}
                {casacion.sumilla && (
                  <Section titulo="Sumilla">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap col-span-2">{casacion.sumilla}</p>
                  </Section>
                )}

                {/* Texto Completo */}
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Texto Completo</h3>
                  <div className="relative">
                    <div
                      className={`text-xs text-slate-300 leading-relaxed overflow-hidden transition-all ${
                        textoExpandido ? '' : 'max-h-48'
                      }`}
                    >
                      {casacion.texto_completo ? (
                        <TextoFormateado texto={casacion.texto_completo} />
                      ) : (
                        'No disponible'
                      )}
                    </div>
                    {casacion.texto_completo && casacion.texto_completo.length > 500 && !textoExpandido && (
                      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none" />
                    )}
                  </div>
                  {casacion.texto_completo && casacion.texto_completo.length > 500 && (
                    <button
                      onClick={() => setTextoExpandido(!textoExpandido)}
                      className="mt-3 text-sm text-amber-400 hover:text-amber-300 font-medium relative z-10 flex items-center gap-1"
                    >
                      {textoExpandido ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Ver menos
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Ver texto completo
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-red-400">
                Error al cargar la casacion
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3 pb-2 border-b border-slate-700/50">
        {titulo}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Campo({
  label,
  valor,
  link,
  destacado,
}: {
  label: string
  valor?: string | null
  link?: string
  destacado?: boolean
}) {
  if (!valor) return null

  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`text-sm ${destacado ? 'font-bold text-emerald-400' : 'text-slate-200'}`}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 hover:underline">
            {valor}
          </a>
        ) : (
          valor
        )}
      </dd>
    </div>
  )
}

function TextoFormateado({ texto }: { texto: string }) {
  const parrafos = texto
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length > 0)

  return (
    <div className="space-y-3">
      {parrafos.map((parrafo, index) => (
        <p key={index} className="text-justify">
          {parrafo}
        </p>
      ))}
    </div>
  )
}
