"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/components/AuthProvider";
import CampanaNotificaciones from "@/components/CampanaNotificaciones";
import { LogOut } from "lucide-react"
const PAYMENTS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === 'true'
interface Plan {
  id: string
  nombre: string
  precio: number
  consultas_mes: number // ahora representa créditos
  descripcion: string
}
export default function Home() {
  const { user, perfil, signOut } = useAuth()
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(true);
  const route = useRouter()
  const [planes, setPlanes] = useState<Plan[]>([{ id: "038990b4-d477-459c-a312-09bf260bc9ae", nombre: "Básico", precio: 29.9, consultas_mes: 100, descripcion: "" }, { id: "f366cb33-4bea-45d1-a258-3aa5032346bd", nombre: "Profesional", precio: 59.9, consultas_mes: 500, descripcion: "" }, { id: "0bb0a891-78b1-44a2-b837-5808a8c602fe", nombre: "Empresarial", precio: 99.9, consultas_mes: 1000, descripcion: "" }])

  const comprarCreditos = (planId: string) => {
    if (!PAYMENTS_ENABLED) {
      alert('Próximamente integración con Culqi')
      return
    }

    if (!user) {
      router.push(
        `/auth/registro?redirect=/checkout?tipo=creditos%26paquete=${planId}`
      )
      return
    }

    router.push(`/checkout?tipo=creditos&paquete=${planId}`)
  }

  return (
    <main
      className={`relative min-h-screen overflow-hidden transition-colors duration-500 ${darkMode
        ? "bg-[#090909] text-white"
        : "bg-white text-slate-900"
        }`}
    >      {/* Líneas verticales */}


      {/* Glow central */}
      <div className="hidden absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2">
        <div className="w-[700px] h-[700px] rounded-full bg-slate-900/40 blur-3xl" />
      </div>

      <div className="relative z-10 ">
        <header className={`fixed w-full px-8 py-6 z-100 ${darkMode
          ? "bg-[#090909] text-white"
          : "bg-white text-slate-900"
          }`}>
          <div className="max-w-7xl mx-auto grid grid-cols-[1fr_1fr] md:grid-cols-[1fr_2fr_1fr] items-center">
            {/* Logo */}
            <div className="flex justify-start">
              <Link href="/">
                <Image
                  src="/logo1.svg"
                  alt="Logo"
                  width={60}
                  height={60}
                  className="rounded-full"
                />
              </Link>
            </div>

            {/* Menu */}
            <nav className="hidden md:flex justify-center items-center gap-16 text-md text-slate-300">
              <Link
                href="/poder-judicial"
                className="
                relative
                text-slate-300
                hover:text-white
                transition
                after:absolute
                after:left-0
                after:-bottom-2
                after:h-[2px]
                after:w-0
                after:bg-yellow-400
                after:transition-all
                hover:after:w-full
                "
              >
                Poder Judicial
              </Link>
              <Link
                href="/tribunal-constitucional"
                className="
                relative
                text-slate-300
                hover:text-white
                transition
                after:absolute
                after:left-0
                after:-bottom-2
                after:h-[2px]
                after:w-0
                after:bg-yellow-400
                after:transition-all
                hover:after:w-full
                "
              >
                Tribunal Constitucional
              </Link>
            </nav>

            {/* CTA */}
            <div className="flex justify-end items-center gap-4">


              {user ? (<>
                <CampanaNotificaciones userId={user.id} />
                <button
                  className="cursor-pointer font-medium px-8 py-2 rounded-full transition bg-yellow-400
                text-black
                hover:bg-yellow-300
                shadow-lg shadow-yellow-500/20"
                  onClick={() =>
                    route.push("/cuenta")
                  }
                >
                  Perfil
                </button>
                <button
                  onClick={() => signOut()}
                  className="group flex items-center gap-2 cursor-pointer px-3 py-2 rounded-full transition-all duration-300 hover:bg-white/5"
                >
                  <LogOut
                    className="text-white group-hover:text-yellow-300 transition-colors duration-300"
                    size={20}
                  />

                  <span
                    className="
      overflow-hidden
      whitespace-nowrap
      max-w-0
      opacity-0
      group-hover:max-w-24
      group-hover:opacity-100
      transition-all
      duration-300
      text-sm
      text-yellow-300
    "
                  >
                    Logout
                  </span>
                </button>
              </>) : (
                <>
                  <button
                    className="cursor-pointer border-1 border-yellow-400 font-medium px-8 py-2 rounded-full transition border border-slate-700
                text-white
                bg-transparent
                hover:bg-white/5"
                    onClick={() =>
                      route.push("/auth/login")
                    }
                  >
                    Login
                  </button>
                  <button
                    className="font-medium px-8 py-2 rounded-full transition bg-yellow-400
                text-black
                hover:bg-yellow-300
                shadow-lg shadow-yellow-500/20
                min-w-[120px]"
                    onClick={() =>
                      route.push("/auth/registro")
                    }
                  >
                    Sign up
                  </button>
                </>)}

            </div>
          </div>
        </header>
        <div className="pt-20">
          <div className="absolute inset-0 flex justify-between px-10 opacity-30 pointer-events-none">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`h-full w-px ${darkMode
                  ? "bg-gradient-to-b from-transparent via-slate-500 to-transparent"
                  : "bg-gradient-to-b from-transparent via-slate-300 to-transparent"
                  }`}
              />
            ))}
          </div>
          {/* Navbar */}


          {/* Hero */}
          <section className="animate-fade-up relative flex flex-col items-center justify-center min-h-[100vh] text-center px-6">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 mb-6">
              Lex iniusta non est lex            </p>
            <p className="hidden text-sm uppercase tracking-[0.3em] text-slate-500 mb-6">
              Jurisprudencia Peruana
            </p>

            <h1
              className={`max-w-4xl text-5xl md:text-7xl font-light leading-tight ${darkMode ? "text-white" : "text-slate-900"
                }`}
            >            Toda la información en
              <br />
              un solo lugar
            </h1>

            <p
              className={`mt-6 max-w-xl mb-10 ${darkMode ? "text-slate-400" : "text-slate-600"
                }`}
            >
              Sentencias, casaciones y jurisprudencia del Poder Judicial y
              Tribunal Constitucional del Perú.
            </p>
            {!user ? <button
              className="cursor-pointer font-medium px-8 py-2 rounded-full transition bg-yellow-400
                text-black
                hover:bg-yellow-300
                shadow-lg shadow-yellow-500/20"
              onClick={() =>
                route.push("/auth/registro")
              }
            >
              Probar ahora
            </button>
              :
              <section className="relative z-10 py- px-6">
                <div className="max-w-6xl mx-auto">


                  <div className="grid md:grid-cols-2 gap-8">

                    {/* Poder Judicial */}
                    <Link href="/poder-judicial">
                      <div
                        className={`group p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-2 ${darkMode
                          ? "bg-slate-900/60 border-slate-800 hover:border-yellow-400"
                          : "bg-white border-slate-200 hover:border-yellow-500 shadow-sm"
                          }`}
                      >
                        <div className="text-5xl mb-6">⚖️</div>

                        <h3 className="text-2xl font-semibold mb-4">
                          Poder Judicial
                        </h3>

                        <p
                          className={
                            darkMode
                              ? "text-slate-400"
                              : "text-slate-600"
                          }
                        >
                          Casaciones y resoluciones emitidas por las Salas Supremas
                          del Poder Judicial del Perú.
                        </p>
                      </div>
                    </Link>

                    {/* Tribunal Constitucional */}
                    <Link href="/tribunal-constitucional">
                      <div
                        className={`group p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-2 ${darkMode
                          ? "bg-slate-900/60 border-slate-800 hover:border-blue-400"
                          : "bg-white border-slate-200 hover:border-blue-500 shadow-sm"
                          }`}
                      >
                        <div className="text-5xl mb-6">🏛️</div>

                        <h3 className="text-2xl font-semibold mb-4">
                          Tribunal Constitucional
                        </h3>

                        <p
                          className={
                            darkMode
                              ? "text-slate-400"
                              : "text-slate-600"
                          }
                        >
                          Sentencias, precedentes y resoluciones del Tribunal
                          Constitucional del Perú.
                        </p>
                      </div>
                    </Link>

                  </div>
                </div>
              </section>
            }

            {/* Cards flotantes */}
            <div className="hidden">

              <div className="absolute left-[12%] top-[45%] max-w-[220px] rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur p-4 text-left">
                <p className="text-xs text-slate-300">
                  Casación de fecha 10 de octubre de 2023, interpuesta por el
                  abogado Óscar Acuña Viera.
                </p>
              </div>

              <div className="absolute left-[20%] bottom-[15%] w-20 h-20 rounded-xl border border-slate-700 bg-slate-900/70" />

              <div className="absolute right-[10%] top-[35%] max-w-[230px] rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur p-4 text-left">
                <p className="text-xs text-slate-300">
                  Estos instrumentos internacionales, ello en virtud a los
                  artículos 26 y 27 de la Convención de Viena.
                </p>
              </div>

              <div className="absolute right-[16%] bottom-[22%] max-w-[260px] rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur p-4 text-left">
                <p className="text-xs text-slate-300">
                  Principio de legalidad, principio de verdad material y numeral 4
                  del artículo 31 de la Convención de Viena.
                </p>
              </div>

              <div className="absolute right-[12%] top-[58%] w-32 h-16 rounded-xl border border-slate-700 bg-slate-900/70" />
              <div className="absolute left-[12%] top-[55%] w-36 h-16 rounded-xl border border-slate-700 bg-slate-900/70" />
            </div>
          </section>

        </div>
        {!user && <section className="relative z-10 py-24 px-6">
          <div className="max-w-6xl mx-auto">

            <div className="text-center mb-16">
              <h2 className="text-4xl font-light mb-4">
                Fuentes Oficiales
              </h2>

              <p
                className={
                  darkMode
                    ? "text-slate-400"
                    : "text-slate-600"
                }
              >
                Consulta información proveniente de los repositorios oficiales del Estado Peruano.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">

              {/* Poder Judicial */}
              <Link href="/poder-judicial">
                <div
                  className={`group p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-2 ${darkMode
                    ? "bg-slate-900/60 border-slate-800 hover:border-yellow-400"
                    : "bg-white border-slate-200 hover:border-yellow-500 shadow-sm"
                    }`}
                >
                  <div className="text-5xl mb-6">⚖️</div>

                  <h3 className="text-2xl font-semibold mb-4">
                    Poder Judicial
                  </h3>

                  <p
                    className={
                      darkMode
                        ? "text-slate-400"
                        : "text-slate-600"
                    }
                  >
                    Casaciones y resoluciones emitidas por las Salas Supremas
                    del Poder Judicial del Perú.
                  </p>

                  <div className="mt-6 text-yellow-400">
                    Explorar →
                  </div>
                </div>
              </Link>

              {/* Tribunal Constitucional */}
              <Link href="/tribunal-constitucional">
                <div
                  className={`group p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-2 ${darkMode
                    ? "bg-slate-900/60 border-slate-800 hover:border-blue-400"
                    : "bg-white border-slate-200 hover:border-blue-500 shadow-sm"
                    }`}
                >
                  <div className="text-5xl mb-6">🏛️</div>

                  <h3 className="text-2xl font-semibold mb-4">
                    Tribunal Constitucional
                  </h3>

                  <p
                    className={
                      darkMode
                        ? "text-slate-400"
                        : "text-slate-600"
                    }
                  >
                    Sentencias, precedentes y resoluciones del Tribunal
                    Constitucional del Perú.
                  </p>

                  <div className="mt-6 text-blue-400">
                    Explorar →
                  </div>
                </div>
              </Link>

            </div>
          </div>
        </section>}
        <section className="py-32 px-6">
          <div className="max-w-6xl mx-auto">

            <div className="text-center mb-20">
              <h2 className="text-5xl font-light mb-6">
                Encuentra jurisprudencia en segundos
              </h2>

              <p className="text-slate-400 max-w-2xl mx-auto">
                Centralizamos información de múltiples fuentes oficiales y la
                ponemos a tu disposición mediante una búsqueda rápida y moderna.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">

              <div className="p-8 rounded-3xl border border-slate-800">
                <div className="text-4xl mb-6">📚</div>
                <h3 className="text-2xl mb-4">Repositorio Unificado</h3>
                <p className="text-slate-400">
                  Accede desde un único lugar a resoluciones del Poder Judicial
                  y Tribunal Constitucional.
                </p>
              </div>

              <div className="p-8 rounded-3xl border border-slate-800">
                <div className="text-4xl mb-6">🔍</div>
                <h3 className="text-2xl mb-4">Búsqueda Avanzada</h3>
                <p className="text-slate-400">
                  Filtra por materia, fecha, expediente, órgano jurisdiccional
                  o palabras clave.
                </p>
              </div>

              <div className="p-8 rounded-3xl border border-slate-800">
                <div className="text-4xl mb-6">⚡</div>
                <h3 className="text-2xl mb-4">Resultados Instantáneos</h3>
                <p className="text-slate-400">
                  Encuentra resoluciones relevantes en segundos sin navegar
                  múltiples portales.
                </p>
              </div>

            </div>
          </div>
        </section>
        <section className="hidden py-32 px-6">
          <div className="max-w-6xl mx-auto">

            <div className="text-center mb-20">
              <h2 className="text-5xl font-light mb-6">
                Elige la cantidad de análisis que necesitas
              </h2>

              <p className="text-slate-400 max-w-2xl mx-auto">
                Todas las funcionalidades están incluidas. La única diferencia
                es la cantidad de tokens disponibles para consultas
                .
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">

              <div className="rounded-3xl border border-slate-800 p-8">
                <h3 className="text-2xl mb-4">Básico</h3>

                <div className="text-5xl font-light mb-2">
                  S/29.90
                </div>



                <div className="text-3xl mb-6">
                  100
                </div>

                <p className="text-slate-400">
                  tokens
                </p>
              </div>

              <div className="rounded-3xl border border-yellow-500 p-8 relative">
                <span className="absolute top-4 right-4 bg-yellow-400 text-black text-xs px-3 py-1 rounded-full">
                  Popular
                </span>

                <h3 className="text-2xl mb-4">
                  Profesional
                </h3>

                <div className="text-5xl font-light mb-2">
                  S/49
                </div>

                <div className="text-slate-500 mb-8">
                  por mes
                </div>

                <div className="text-3xl mb-6">
                  2M
                </div>

                <p className="text-slate-400">
                  tokens mensuales
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 p-8">
                <h3 className="text-2xl mb-4">
                  Enterprise
                </h3>

                <div className="text-5xl font-light mb-2">
                  S/99
                </div>

                <div className="text-slate-500 mb-8">
                  por mes
                </div>

                <div className="text-3xl mb-6">
                  10M
                </div>

                <p className="text-slate-400">
                  tokens mensuales
                </p>
              </div>

            </div>

            <p className="text-center text-slate-500 mt-12">
              Todos los planes incluyen acceso completo a las funcionalidades de la plataforma.
            </p>

          </div>
        </section>
        <main className="max-w-6xl mx-auto px-4 py-12">

          {/* HERO */}
          <div className="text-center mb-12">

            <h2 className="text-4xl font-bold text-white mb-4">
              Elije los créditos cuando los necesites
            </h2>

            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Cada búsqueda consume un crédito.
              Los créditos nunca vencen y permanecen en tu cuenta
              hasta que los utilices.
            </p>

            {perfil && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3">

                <span className="text-emerald-400">
                  Saldo actual:
                </span>

                <span className="font-bold text-white">
                  {perfil.creditos ?? 0} créditos
                </span>

              </div>
            )}

          </div>

          {/* TARJETAS */}

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {planes.map((plan, index) => {
              const destacado =
                index === Math.floor(planes.length / 2)

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-8 ${destacado
                    ? 'border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-600/5'
                    : 'border border-slate-700/50 bg-slate-800/50'
                    }`}
                >
                  {destacado && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">

                      <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black">
                        Más comprado
                      </span>

                    </div>
                  )}

                  <h3 className="text-xl font-bold text-white">
                    {plan.nombre}
                  </h3>

                  <div className="mt-4">

                    <span className="text-4xl font-bold text-white">
                      S/{plan.precio}
                    </span>

                  </div>

                  <p className="mt-5 text-slate-400 text-sm">
                    {plan.descripcion}
                  </p>

                  <ul className="mt-6 space-y-3">

                    <li className="flex items-center gap-2 text-sm text-slate-300">

                      <svg
                        className="w-5 h-5 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>

                      {plan.consultas_mes} créditos

                    </li>

                    <li className="flex items-center gap-2 text-sm text-slate-300">

                      <svg
                        className="w-5 h-5 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>

                      Acceso al buscador

                    </li>

                    <li className="flex items-center gap-2 text-sm text-slate-300">

                      <svg
                        className="w-5 h-5 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>

                      Descarga de PDFs

                    </li>
                  </ul>

                  <button
                    onClick={() => comprarCreditos(plan.id)}
                    className={`mt-8 w-full rounded-lg py-3 text-sm font-semibold transition-all ${destacado
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                  >
                    Comprar créditos
                  </button>
                </div>
              )
            })}
          </div>


          {/* Información */}
          <div className="mt-20 max-w-4xl mx-auto">

            <h3 className="mb-8 text-center text-2xl font-bold text-white">
              Preguntas frecuentes
            </h3>

            <div className="space-y-4">

              <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
                <h4 className="mb-2 font-semibold text-white">
                  ¿Cómo funcionan los créditos?
                </h4>

                <p className="text-sm text-slate-400">
                  Cada búsqueda realizada en el sistema consume un crédito.
                  Ver los resultados, abrir el PDF o descargarlo no consume
                  créditos adicionales.
                </p>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
                <h4 className="mb-2 font-semibold text-white">
                  ¿Los créditos vencen?
                </h4>

                <p className="text-sm text-slate-400">
                  No. Los créditos permanecen en tu cuenta hasta que los utilices.
                </p>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
                <h4 className="mb-2 font-semibold text-white">
                  ¿Qué métodos de pago aceptan?
                </h4>

                <p className="text-sm text-slate-400">
                  Puedes pagar mediante Visa, Mastercard, Yape,
                  PagoEfectivo y otros métodos disponibles en Culqi.
                </p>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
                <h4 className="mb-2 font-semibold text-white">
                  ¿Cómo recibo mis créditos?
                </h4>

                <p className="text-sm text-slate-400">
                  Después de que el pago sea aprobado, los créditos se
                  acreditarán automáticamente en tu cuenta y podrás
                  utilizarlos inmediatamente.
                </p>
              </div>

            </div>

          </div>

        </main>
      </div>
      <footer className="relative z-10 border-t border-slate-800 bg-[#070707] px-6 py-12">
        <div className="mx-auto max-w-6xl">

          <div className="grid gap-10 md:grid-cols-3">

            {/* Marca */}
            <div>
              <div className="mb-4 flex items-center gap-3">
                <img
                  src="/logo1.svg"
                  alt="Casaciones"
                  className="h-10 w-auto"
                />

                <span className="text-xl font-bold text-white">
                  Casaciones
                </span>
              </div>

              <p className="max-w-sm text-sm leading-6 text-slate-400">
                Plataforma digital para la búsqueda y consulta de
                resoluciones y casaciones judiciales.
              </p>
            </div>

            {/* Información */}
            <div>
              <h3 className="mb-4 font-semibold text-white">
                Información
              </h3>

              <div className="flex flex-col gap-3 text-sm">

                <Link
                  href="/terminos-y-condiciones"
                  className="text-slate-400 transition hover:text-yellow-400"
                >
                  Términos y condiciones
                </Link>

                <Link
                  href="/politica-privacidad"
                  className="text-slate-400 transition hover:text-yellow-400"
                >
                  Política de privacidad
                </Link>

                <Link
                  href="/cambios-y-devoluciones"
                  className="text-slate-400 transition hover:text-yellow-400"
                >
                  Cambios y devoluciones
                </Link>

                <Link
                  href="/libro-reclamaciones"
                  className="text-slate-400 transition hover:text-yellow-400"
                >
                  Libro de reclamaciones
                </Link>

              </div>
            </div>

            {/* Contacto */}
            <div>
              <h3 className="mb-4 font-semibold text-white">
                Contacto
              </h3>

              <div className="space-y-3 text-sm text-slate-400">

                <p>
                  Correo:{" "}
                  <a
                    href="mailto:TU_CORREO"
                    className="transition hover:text-yellow-400"
                  >
                    TU_CORREO
                  </a>
                </p>

                <p>
                  Teléfono: TU_TELEFONO
                </p>

                <p>
                  Lima, Perú
                </p>

              </div>
            </div>

          </div>

          <div className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Casaciones. Todos los derechos reservados.
          </div>

        </div>
      </footer>
    </main>
  );
}