'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import FiltrosBar from '@/components/FiltrosBar'
import UserMenu from '@/components/UserMenu'
import ModalUpgrade from '@/components/ModalUpgrade'
import ModalDetalle from '@/components/ModalDetalle'

import { useAuth } from '@/components/AuthProvider'
import { FiltrosState } from '@/lib/types'

// Casos en Monitoreo (alertas reales del CEJ)
import PanelMonitoreo from '@/components/alertas/PanelMonitoreo'
import { createClient } from '@/lib/supabase-browser'


// ============================================================
// STOPWORDS
// ============================================================

const STOPWORDS = [
  'de',
  'la',
  'el',
  'los',
  'las',
  'y',
  'o',
  'en',
  'del',
  'al',
  'por',
  'para',
  'con',
]


// ============================================================
// RESULTADO DE BÚSQUEDA
// ============================================================

interface ResultadoBusqueda {
  id: string

  pagina_inicio:string;
  
  score: number

  casacion_id: string

  chunk_id?: number

  numero?: string

  title?: string

  fragmento?: string

  highlight?: {
    content?: string[]
    title?: string[]
    numero?: string[]
  }

  source_file?: string

  url_pdf?: string

  pages?: number[] | number | string | string[]
}


// ============================================================
// RESPUESTA API
// ============================================================

interface ApiBusquedaResponse {
  paginaActual: number

  porPagina: number

  totalResultados: number

  totalPaginas: number

  resultados: ResultadoBusqueda[]
}


// ============================================================
// AUTENTICACIÓN
// ============================================================

const AUTH_REQUIRED =
  process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === 'true'


// ============================================================
// COMPONENTE
// ============================================================

export default function ElPeruanoPage() {

  const {
    user,
    loading: authLoading,
    perfil,
    setPerfil,
  } = useAuth()


  const router = useRouter()


  // ==========================================================
  // ESTADOS
  // ==========================================================

  const [buscando, setBuscando] =
    useState(false)


  const [resultados, setResultados] =
    useState<ResultadoBusqueda[]>([])


  const [total, setTotal] =
    useState(0)

  const [paginaActual, setPaginaActual] =
    useState(1)

  const [totalPaginas, setTotalPaginas] =
    useState(0)


  const [cargando, setCargando] =
    useState(false)


  const [showUpgradeModal, setShowUpgradeModal] =
    useState(false)


  const [casacionSeleccionada, setCasacionSeleccionada] =
    useState<number | null>(null)

  // Pestañas: buscador de casaciones / casos en monitoreo
  const [vistaActual, setVistaActual] = useState<'buscador' | 'monitoreo'>('buscador')
  const [totalCasos, setTotalCasos] = useState(0)

  // Contador de la pestaña "Casos en Monitoreo" (el panel lo actualiza al abrirse)
  useEffect(() => {
    if (!user) return
    createClient()
      .from('alertas_expedientes')
      .select('id', { count: 'exact', head: true })
      .eq('perfil_id', user.id)
      .then(({ count }) => setTotalCasos(count ?? 0))
  }, [user])


  // ==========================================================
  // FILTROS
  // ==========================================================

  const [filtros, setFiltros] =
    useState<FiltrosState>({

      busqueda: '',

      tipo: '',

      anio: '',

      mes: '',

      fechaDesde: '',

      fechaHasta: '',

    })


  // ==========================================================
  // REDIRECCIÓN SI NO AUTENTICADO
  // ==========================================================

  useEffect(() => {

    if (
      !authLoading &&
      !user
    ) {

      router.push('/')

    }

  }, [
    authLoading,
    router,
    user,
  ])


  // ==========================================================
  // CARGAR RESULTADOS
  // ==========================================================

  const cargarResultados =
    useCallback(
      async (paginaSolicitada: number = paginaActual) => {

        if (
          AUTH_REQUIRED &&
          !user
        ) {

          return

        }


        setCargando(true)


        try {

          // ==================================================
          // PARÁMETROS
          // ==================================================

          const params =
            new URLSearchParams()


          // --------------------------------------------------
          // BÚSQUEDA
          // --------------------------------------------------

          if (
            filtros.busqueda?.trim()
          ) {

            params.set(
              'q',
              filtros.busqueda.trim()
            )

          }


          // --------------------------------------------------
          // PÁGINA
          // --------------------------------------------------
          //
          // El endpoint nuevo acepta:
          // q, pagina, casacion_id, source_file
          //
          // El backend usa 20 resultados por página.
          // Por ahora comenzamos siempre en la página 1.
          //

          params.set('pagina', String(paginaSolicitada))


          // --------------------------------------------------
          // AÑO
          // --------------------------------------------------
          //
          // El endpoint /search/casaciones todavía no tiene
          // un parámetro "year". No lo enviamos para evitar
          // parámetros incompatibles.
          //
          // Si luego queremos filtrar por año, se puede
          // implementar en el backend usando un campo del
          // documento.
          //


          // ==================================================
          // CONSULTAR BACKEND
          // ==================================================

          // Endpoint compatible con:
          // GET /search/casaciones?q=&pagina=&casacion_id=&source_file=
          const url =
            `/api/proxy/search/casaciones?${params.toString()}`


          console.log(
            'Consultando:',
            url
          )


          const response =
            await fetch(
              url,
              {
                method: 'GET',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                cache: 'no-store',
              }
            )


          // ==================================================
          // ERROR HTTP
          // ==================================================

          if (
            !response.ok
          ) {

            const texto =
              await response.text()

            console.error(
              'Error backend:',
              texto
            )

            throw new Error(
              `Error HTTP ${response.status}`
            )

          }


          // ==================================================
          // JSON
          // ==================================================

          const data:
            ApiBusquedaResponse =
            await response.json()


          console.log(
            'Respuesta búsqueda:',
            data
          )


          // ==================================================
          // RESULTADOS
          // ==================================================

          setResultados(
            data.resultados || []
          )


          // ==================================================
          // TOTAL
          // ==================================================

          setTotal(
            data.totalResultados ??
            (data as unknown as { total?: number }).total ??
            0
          )

          setPaginaActual(
            data.paginaActual ?? paginaSolicitada
          )

          setTotalPaginas(
            data.totalPaginas ??
            Math.ceil(
              (
                data.totalResultados ??
                (data as unknown as { total?: number }).total ??
                0
              ) / (data.porPagina || 20)
            )
          )


        } catch (error) {

          console.error(
            'Error buscando:',
            error
          )


          setResultados([])

          setTotal(0)


        } finally {

          setCargando(false)

        }

      },
      [
        filtros,
        user,
        paginaActual,
      ]
    )


  // ==========================================================
  // GASTAR CRÉDITO
  // ==========================================================

  const gastarCredito =
    async () => {

      if (
        !AUTH_REQUIRED ||
        !user
      ) {

        return

      }


      try {

        const response =
          await fetch(
            '/api/creditos/gastar',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },
            }
          )


        // ====================================================
        // ERROR
        // ====================================================

        if (
          !response.ok
        ) {

          const error =
            await response.json()


          // --------------------------------------------------
          // SIN CRÉDITOS
          // --------------------------------------------------

          if (
            response.status === 402
          ) {

            setShowUpgradeModal(
              true
            )

            throw new Error(
              'No tienes créditos disponibles'
            )

          }


          throw new Error(
            error.error ||
            'Error consumiendo crédito'
          )

        }


        // ====================================================
        // RESPUESTA
        // ====================================================

        const data =
          await response.json()


        if (
          data.success
        ) {

          setPerfil(
            data.perfil
          )

        }


        console.log(
          'Crédito consumido:',
          data
        )


      } catch (error) {

        console.error(
          error
        )

        throw error

      }

    }


  // ==========================================================
  // BUSCAR
  // ==========================================================

  const handleBuscar =
    async () => {

      if (
        buscando
      ) {

        return

      }


      setBuscando(true)


      try {

        setPaginaActual(1)

        await gastarCredito()

        await cargarResultados(1)


      } catch (error) {

        console.error(
          error
        )


      } finally {

        setBuscando(false)

      }

    }


  // ==========================================================
  // LIMPIAR BÚSQUEDA PARA PDF.JS
  // ==========================================================

  const busquedaLimpia =
    filtros.busqueda
      .split(' ')
      .filter(
        palabra =>
          !STOPWORDS.includes(
            palabra.toLowerCase()
          )
      )
      .join(' ')


  const search =
    encodeURIComponent(
      busquedaLimpia
    )


  // ==========================================================
  // LOADING AUTH
  // ==========================================================

  if (
    authLoading
  ) {

    return (

      <div className="min-h-screen bg-slate-900 flex items-center justify-center">

        <div
          className="
            animate-spin
            rounded-full
            h-10
            w-10
            border-2
            border-amber-500/30
            border-t-amber-500
          "
        />

      </div>

    )

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className="
        min-h-screen
        bg-gradient-to-br
        from-slate-900
        via-slate-800
        to-slate-900
      "
    >


      {/* ==================================================== */}
      {/* HEADER */}
      {/* ==================================================== */}

      <header
        className="
          sticky
          top-0
          z-40
          backdrop-blur-md
          bg-slate-900/70
          border-b
          border-slate-700/50
        "
      >

        <div
          className="
            max-w-7xl
            mx-auto
            px-4
            py-4
            flex
            items-center
            justify-between
          "
        >


          {/* ------------------------------------------------ */}
          {/* TÍTULO */}
          {/* ------------------------------------------------ */}

          <div
            className="
              flex
              items-center
              gap-4
            "
          >

            <Link
              href="/"
              className="
                text-slate-400
                hover:text-white
                transition
              "
            >
              ← Volver
            </Link>


            <div>

              <h1
                className="
                  text-2xl
                  font-bold
                  text-white
                "
              >
                Buscador de Casaciones
              </h1>


              <p
                className="
                  text-sm
                  text-slate-400
                "
              >
                OpenSearch + PDFs indexados
              </p>

            </div>

          </div>


          {/* ------------------------------------------------ */}
          {/* NAVEGACIÓN */}
          {/* ------------------------------------------------ */}

          <nav
            className="
              hidden
              md:flex
              items-center
              gap-12
              text-sm
              text-slate-300
            "
          >

            <Link
              href="/poder-judicial"
              className="
                hover:text-white
                transition
              "
            >
              Poder Judicial
            </Link>


            <Link
              href="/tribunal-constitucional"
              className="
                hover:text-white
                transition
              "
            >
              Tribunal Constitucional
            </Link>

          </nav>


          {/* ------------------------------------------------ */}
          {/* USER MENU */}
          {/* ------------------------------------------------ */}

          <UserMenu />

        </div>

      </header>


      {/* ==================================================== */}
      {/* MAIN */}
      {/* ==================================================== */}

      <main
        className="
          max-w-7xl
          mx-auto
          px-4
          py-6
        "
      >
        {/* --- Switcher de Vistas Superior (Buscador vs Casos en Monitoreo) --- */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-6">
          <div className="flex items-center gap-2 p-1 bg-[#0d1527] border border-slate-800 rounded-xl text-xs font-medium">
            <button
              onClick={() => setVistaActual('buscador')}
              className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
                vistaActual === 'buscador'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔍</span>
              Buscador de Casaciones
            </button>
            <button
              onClick={() => setVistaActual('monitoreo')}
              className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
                vistaActual === 'monitoreo'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📡</span>
              Casos en Monitoreo
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  vistaActual === 'monitoreo'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {user ? totalCasos : 0}
              </span>
            </button>
          </div>
        </div>

        {vistaActual === 'monitoreo' ? (
          <PanelMonitoreo onTotalChange={setTotalCasos} />
        ) : (
          <>
            {/* ================================================== */}
            {/* FILTROS */}
            {/* ================================================== */}

            <div
              className="
                bg-slate-800/50
                border
                border-slate-700/50
                rounded-2xl
                p-5
                mb-6
              "
            >

              <FiltrosBar
                filtros={filtros}
                onChange={setFiltros}
                onBuscar={handleBuscar}
              />

            </div>


        {/* ================================================== */}
        {/* INFORMACIÓN */}
        {/* ================================================== */}

        <div
          className="
            flex
            items-center
            justify-between
            mb-6
          "
        >

          <div
            className="
              text-sm
              text-slate-400
            "
          >

            {cargando ? (

              <span
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <div
                  className="
                    animate-spin
                    rounded-full
                    h-4
                    w-4
                    border-2
                    border-amber-500/30
                    border-t-amber-500
                  "
                />

                Buscando...

              </span>

            ) : (

              <>

                <span
                  className="
                    text-white
                    font-semibold
                  "
                >
                  {total}
                </span>

                {' '}

                resultados encontrados

              </>

            )}

          </div>


          {/* ------------------------------------------------ */}
          {/* TEXTO BUSCADO */}
          {/* ------------------------------------------------ */}

          {filtros.busqueda && (

            <div
              className="
                text-xs
                text-slate-500
              "
            >

              búsqueda:{' '}

              <span
                className="
                  text-amber-400
                "
              >
                {filtros.busqueda}
              </span>

            </div>

          )}

        </div>


        {/* ================================================== */}
        {/* RESULTADOS */}
        {/* ================================================== */}

        <div
          className="
            space-y-5
          "
        >

          {resultados.map(
            (
              resultado,
              index
            ) => {


              // ============================================
              // PÁGINA DEL PDF
              // ============================================

              const paginaPDF = (() => {
                const pages = resultado.pages

                if (Array.isArray(pages)) {
                  const primera = pages[0]
                  const numero = Number(primera)
                  return Number.isFinite(numero) && numero > 0
                    ? numero
                    : 1
                }

                const numero = Number(pages)

                return Number.isFinite(numero) && numero > 0
                  ? numero
                  : 1
              })()


              // ============================================
              // URL DEL VISOR PDF.JS
              // ============================================

              const pdfViewerUrl =
                `/api/proxy/pdfjs/web/viewer.html?file=` +
                encodeURIComponent(
                  `/api/proxy/casaciones/${resultado.source_file}`
                ) +
                `#page=${resultado.pagina_inicio}&search=${search}`


              console.log(
                'Resultado:',
                resultado
              )


              // ============================================
              // RENDER
              // ============================================

              return (

                <div
                  key={
                    `${resultado.id || resultado.casacion_id || 'resultado'}-${index}`
                  }
                  className="
                    bg-slate-800/40
                    border
                    border-slate-700/40
                    rounded-2xl
                    overflow-hidden
                    shadow-lg
                  "
                >


                  {/* ====================================== */}
                  {/* CABECERA RESULTADO */}
                  {/* ====================================== */}

                  <div
                    className="
                      p-5
                      border-b
                      border-slate-700/30
                    "
                  >

                    <div
                      className="
                        flex
                        flex-col
                        lg:flex-row
                        lg:items-start
                        lg:justify-between
                        gap-5
                      "
                    >


                      {/* ================================== */}
                      {/* INFORMACIÓN */}
                      {/* ================================== */}

                      <div
                        className="
                          flex-1
                        "
                      >


                        {/* -------------------------------- */}
                        {/* TÍTULO */}
                        {/* -------------------------------- */}

                        <h2
                          className="
                            text-white
                            font-bold
                            text-lg
                            break-all
                          "
                        >

                          {resultado.title ||
                            resultado.numero ||
                            resultado.casacion_id ||
                            'Casación'}

                        </h2>


                        {/* -------------------------------- */}
                        {/* DATOS */}
                        {/* -------------------------------- */}

                        <div
                          className="
                            flex
                            flex-wrap
                            gap-3
                            mt-3
                            text-xs
                          "
                        >


                          {/* CASACIÓN */}

                          <span
                            className="
                              px-2
                              py-1
                              rounded-lg
                              bg-slate-700/50
                              text-slate-300
                            "
                          >
                            ⚖️ {resultado.casacion_id}
                          </span>


                          {/* NÚMERO */}

                          {resultado.numero && (

                            <span
                              className="
                                px-2
                                py-1
                                rounded-lg
                                bg-slate-700/50
                                text-slate-300
                              "
                            >
                              📑 {resultado.numero}
                            </span>

                          )}


                          {/* PÁGINA */}

                          <span
                            className="
                              px-2
                              py-1
                              rounded-lg
                              bg-slate-700/50
                              text-slate-300
                            "
                          >
                            📄 Página {paginaPDF}
                          </span>


                          {/* CHUNK */}

                          <span
                            className="
                              px-2
                              py-1
                              rounded-lg
                              bg-slate-700/50
                              text-slate-300
                            "
                          >
                            🧩 Chunk {resultado.chunk_id ?? '—'}
                          </span>


                          {/* SCORE */}

                          <span
                            className="
                              px-2
                              py-1
                              rounded-lg
                              bg-amber-500/10
                              border
                              border-amber-500/20
                              text-amber-400
                              font-semibold
                            "
                          >
                            ⭐ {resultado.score?.toFixed(2)}
                          </span>

                        </div>

                      </div>


                      {/* ================================== */}
                      {/* BOTONES */}
                      {/* ================================== */}

                      <div
                        className="
                          flex
                          items-center
                          gap-3
                        "
                      >

                        {resultado.source_file && (

                          <>
                            {/* -------------------------------- */}
                            {/* VER PDF */}
                            {/* -------------------------------- */}

                            <a
                              href={pdfViewerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver documento PDF"
                              className="
                                group
                                flex
                                items-center
                                justify-center
                                gap-2
                                px-4
                                py-2
                                rounded-xl
                                text-sm
                                font-semibold
                                bg-blue-500/10
                                border
                                border-blue-500/30
                                text-blue-400
                                hover:bg-blue-500/20
                                hover:border-blue-400/50
                                hover:text-blue-300
                                transition-all
                                duration-200
                              "
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="
                                  h-5
                                  w-5
                                  transition-transform
                                  duration-200
                                  group-hover:scale-110
                                "
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 5 12 5c4.64 0 8.577 2.51 9.964 6.678.06.21.06.434 0 .644C20.577 16.49 16.64 19 12 19c-4.64 0-8.577-2.51-9.964-6.678Z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                                />
                              </svg>

                              <span>Ver PDF</span>
                            </a>


                            {/* -------------------------------- */}
                            {/* DESCARGAR PDF */}
                            {/* -------------------------------- */}

                            <a
                              href={`/api/proxy${resultado.url_pdf}`}
                              download
                              title="Descargar documento PDF"
                              className="
                                group
                                flex
                                items-center
                                justify-center
                                gap-2
                                px-4
                                py-2
                                rounded-xl
                                text-sm
                                font-semibold
                                bg-emerald-500/10
                                border
                                border-emerald-500/30
                                text-emerald-400
                                hover:bg-emerald-500/20
                                hover:border-emerald-400/50
                                hover:text-emerald-300
                                transition-all
                                duration-200
                              "
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="
                                  h-5
                                  w-5
                                  transition-transform
                                  duration-200
                                  group-hover:translate-y-0.5
                                "
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 3v12"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m7 10 5 5 5-5"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 21h14"
                                />
                              </svg>

                              <span>Descargar</span>
                            </a>

                          </>

                        )}

                      </div>

                    </div>

                  </div>


                  {/* ====================================== */}
                  {/* PREVIEW */}
                  {/* ====================================== */}

                  <div
                    className="
                      p-5
                      space-y-4
                    "
                  >


                    {/* ==================================== */}
                    {/* HIGHLIGHT */}
                    {/* ==================================== */}

                    {resultado.highlight?.content?.length ? (

                      resultado.highlight.content.map(
                        (
                          texto,
                          idx
                        ) => (

                          <div
                            key={idx}
                            className="
                              bg-slate-900/40
                              border
                              border-slate-700/30
                              rounded-xl
                              p-4
                              text-sm
                              leading-7
                              text-slate-300
                            "
                            dangerouslySetInnerHTML={{
                              __html:
                                texto,
                            }}
                          />

                        )
                      )

                    ) : resultado.fragmento ? (

                      <div
                        className="
                          bg-slate-900/40
                          border
                          border-slate-700/30
                          rounded-xl
                          p-4
                          text-sm
                          leading-7
                          text-slate-300
                        "
                        dangerouslySetInnerHTML={{
                          __html:
                            resultado.fragmento,
                        }}
                      />

                    ) : (

                      <div
                        className="
                          text-slate-500
                          text-sm
                        "
                      >
                        Sin preview disponible
                      </div>

                    )}


                  </div>

                </div>

              )

            }
          )}

        </div>


        {/* ================================================== */}
        {/* PAGINACIÓN */}
        {/* ================================================== */}

        {!cargando &&
          resultados.length > 0 &&
          totalPaginas > 1 && (
            <div className="flex flex-col items-center gap-3 py-8">

              <div className="flex items-center gap-1">

                {/* Anterior */}
                <button
                  type="button"
                  disabled={paginaActual <= 1}
                  onClick={() => cargarResultados(paginaActual - 1)}
                  className="
                    min-w-10 h-10 px-3
                    rounded-lg
                    text-sm font-medium
                    text-slate-300
                    hover:bg-slate-700/60
                    disabled:opacity-30
                    disabled:cursor-not-allowed
                    transition
                  "
                >
                  ‹
                </button>

                {/* Números estilo Google */}
                {(() => {
                  const paginas: (number | 'ellipsis')[] = []

                  if (totalPaginas <= 7) {
                    for (let i = 1; i <= totalPaginas; i++) {
                      paginas.push(i)
                    }
                  } else {
                    paginas.push(1)

                    if (paginaActual > 4) {
                      paginas.push('ellipsis')
                    }

                    const inicio = Math.max(2, paginaActual - 2)
                    const fin = Math.min(
                      totalPaginas - 1,
                      paginaActual + 2
                    )

                    for (let i = inicio; i <= fin; i++) {
                      paginas.push(i)
                    }

                    if (paginaActual < totalPaginas - 3) {
                      paginas.push('ellipsis')
                    }

                    paginas.push(totalPaginas)
                  }

                  return paginas.map((pagina, index) =>
                    pagina === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="
                          w-10 h-10
                          flex items-center justify-center
                          text-slate-500
                        "
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={pagina}
                        type="button"
                        disabled={pagina === paginaActual}
                        onClick={() => cargarResultados(pagina)}
                        className={`
                          w-10 h-10
                          rounded-full
                          text-sm font-medium
                          transition
                          ${
                            pagina === paginaActual
                              ? 'bg-amber-500 text-slate-950 font-bold cursor-default'
                              : 'text-slate-300 hover:bg-slate-700/60'
                          }
                        `}
                      >
                        {pagina}
                      </button>
                    )
                  )
                })()}

                {/* Siguiente */}
                <button
                  type="button"
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => cargarResultados(paginaActual + 1)}
                  className="
                    min-w-10 h-10 px-3
                    rounded-lg
                    text-sm font-medium
                    text-slate-300
                    hover:bg-slate-700/60
                    disabled:opacity-30
                    disabled:cursor-not-allowed
                    transition
                  "
                >
                  ›
                </button>

              </div>

              <div className="text-xs text-slate-500">
                Página {paginaActual} de {totalPaginas}
              </div>

            </div>
          )}

        {/* ================================================== */}
        {/* SIN RESULTADOS */}
        {/* ================================================== */}

        {!cargando &&
          resultados.length === 0 && (

            <div
              className="
                text-center
                py-20
              "
            >

              <div
                className="
                  text-slate-500
                  text-lg
                "
              >
                No se encontraron resultados
              </div>


              <p
                className="
                  text-slate-600
                  text-sm
                  mt-2
                "
              >
                Intenta con otra búsqueda o cambia los filtros
              </p>

            </div>

          )}
        </>
        )}
      </main>

      {/* ==================================================== */}
      {/* MODAL DETALLE */}
      {/* ==================================================== */}

      <ModalDetalle
        casacionId={
          casacionSeleccionada
        }
        onCerrar={() =>
          setCasacionSeleccionada(
            null
          )
        }
      />


      {/* ==================================================== */}
      {/* MODAL UPGRADE */}
      {/* ==================================================== */}

      <ModalUpgrade
        isOpen={
          showUpgradeModal
        }
        onClose={() =>
          setShowUpgradeModal(
            false
          )
        }
        consultasUsadas={
          perfil?.consultas_usadas || 0
        }
        consultasMax={
          perfil?.creditos || 0
        }
      />

    </div>

  )

}