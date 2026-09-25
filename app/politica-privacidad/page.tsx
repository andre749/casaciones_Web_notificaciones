import Link from "next/link";

export default function PoliticaPrivacidadPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Casaciones Judiciales del Perú
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm md:p-12">
          <div className="mb-10 border-b pb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              Información legal
            </p>

            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Política de Privacidad
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              Última actualización: [FECHA]
            </p>
          </div>

          <div className="space-y-10 leading-7">
            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                1. Responsable del tratamiento
              </h2>

              <div className="rounded-xl bg-slate-50 p-5">
                <p><strong>Razón social:</strong> [RAZÓN SOCIAL]</p>
                <p><strong>RUC:</strong> [RUC]</p>
                <p><strong>Domicilio:</strong> [DIRECCIÓN]</p>
                <p><strong>Correo:</strong> [CORREO]</p>
                <p><strong>Teléfono:</strong> [TELÉFONO]</p>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                2. Datos personales que podemos recopilar
              </h2>

              <p>Dependiendo de las funcionalidades utilizadas, podemos recopilar:</p>

              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Nombres y apellidos.</li>
                <li>Correo electrónico.</li>
                <li>Número de teléfono.</li>
                <li>Información necesaria para crear una cuenta.</li>
                <li>Historial de búsquedas y consultas.</li>
                <li>Información técnica del dispositivo y navegador.</li>
                <li>Dirección IP.</li>
                <li>Información proporcionada en consultas o reclamos.</li>
                <li>
                  Datos de tu documento de identidad (tipo y número, código de
                  verificación, fecha de emisión y fecha de nacimiento), solo si
                  activas el monitoreo de expedientes.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                3. Finalidades
              </h2>

              <p>Los datos personales podrán utilizarse para:</p>

              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Crear y administrar cuentas.</li>
                <li>Proporcionar el servicio contratado.</li>
                <li>Gestionar créditos y planes.</li>
                <li>Procesar y verificar pagos.</li>
                <li>Atender consultas y solicitudes.</li>
                <li>Atender quejas y reclamos.</li>
                <li>Prevenir fraude y usos indebidos.</li>
                <li>Mantener la seguridad de la plataforma.</li>
                <li>Mejorar el funcionamiento del servicio.</li>
                <li>Cumplir obligaciones legales.</li>
                <li>Enviar comunicaciones relacionadas con el servicio.</li>
                <li>
                  Consultar los expedientes que registres en la Consulta de
                  Expedientes Judiciales del Poder Judicial y avisarte de sus
                  novedades.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                4. Base legal
              </h2>

              <p>
                El tratamiento de los datos personales se realizará conforme a
                la normativa peruana aplicable en materia de protección de
                datos personales.
              </p>

              <p className="mt-3">
                Cuando sea necesario obtener consentimiento, este será
                solicitado mediante los mecanismos correspondientes.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                5. Proveedores externos
              </h2>

              <p>
                Para operar la plataforma podemos utilizar proveedores
                tecnológicos externos, incluyendo servicios de alojamiento,
                infraestructura, correo electrónico, procesamiento de pagos y
                seguridad.
              </p>

              <p className="mt-3">
                Estos proveedores podrán acceder únicamente a la información
                necesaria para prestar los servicios contratados.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                6. Pagos
              </h2>

              <p>
                Los pagos pueden ser procesados mediante proveedores externos
                como Culqi.
              </p>

              <p className="mt-3">
                Los datos sensibles de pago son procesados mediante la
                infraestructura correspondiente del proveedor de pagos y no
                forman parte de las credenciales de acceso de Casaciones
                Judiciales del Perú.
              </p>
            </section>

            <section id="datos-identidad" className="scroll-mt-24">
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                7. Datos de identidad para el monitoreo de expedientes
              </h2>

              <p>
                La Consulta de Expedientes Judiciales (CEJ) del Poder Judicial
                exige validar la identidad de quien consulta. Para monitorear tus
                expedientes sin que tengas que hacerlo en cada consulta, y solo
                con tu autorización expresa, guardamos los datos de tu documento
                de identidad que el CEJ solicita.
              </p>

              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  <strong>Finalidad única:</strong> completar la validación de
                  identidad del CEJ al consultar los expedientes que tú
                  registres. No se usan para ningún otro fin ni se comparten con
                  terceros distintos del Poder Judicial.
                </li>
                <li>
                  <strong>Protección:</strong> se almacenan cifrados (AES-256) y
                  solo el sistema que realiza las consultas puede descifrarlos.
                  En la plataforma únicamente se muestran los últimos cuatro
                  dígitos del documento.
                </li>
                <li>
                  <strong>Conservación:</strong> mientras mantengas el monitoreo
                  activo. Puedes eliminarlos en cualquier momento desde
                  &quot;Monitoreo de expedientes&quot; &gt; &quot;Identidad&quot; &gt;
                  &quot;Eliminar mis datos&quot;; también se eliminan al eliminar tu
                  cuenta.
                </li>
                <li>
                  <strong>Documentos:</strong> las resoluciones descargadas del
                  CEJ para tus notificaciones se guardan en un almacenamiento
                  privado al que solo tú tienes acceso.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                8. Seguridad
              </h2>

              <p>
                Implementamos medidas técnicas y organizativas destinadas a
                proteger los datos personales contra accesos no autorizados,
                pérdida, alteración o uso indebido.
              </p>

              <p className="mt-3">
                Sin embargo, ningún sistema conectado a Internet puede
                garantizar seguridad absoluta.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                9. Conservación
              </h2>

              <p>
                Los datos serán conservados durante el tiempo necesario para
                cumplir las finalidades para las cuales fueron recopilados y
                las obligaciones legales correspondientes.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                10. Derechos del titular
              </h2>

              <p>
                El titular de los datos personales podrá ejercer los derechos
                que le reconoce la legislación peruana aplicable.
              </p>

              <p className="mt-3">
                Para realizar una solicitud relacionada con sus datos
                personales puede comunicarse mediante:
              </p>

              <div className="mt-4 rounded-xl bg-slate-50 p-5">
                <p><strong>Correo:</strong> [CORREO]</p>
                <p><strong>Dirección:</strong> [DIRECCIÓN]</p>
                <p><strong>Teléfono:</strong> [TELÉFONO]</p>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                11. Cookies
              </h2>

              <p>
                La plataforma podrá utilizar cookies y tecnologías similares
                para mantener sesiones, mejorar la experiencia de usuario,
                obtener métricas de funcionamiento y mantener la seguridad.
              </p>

              <p className="mt-3">
                El usuario puede configurar su navegador para gestionar
                determinadas cookies.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                12. Cambios en esta política
              </h2>

              <p>
                Esta Política de Privacidad podrá actualizarse cuando sea
                necesario. La versión vigente estará disponible en la
                plataforma.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-slate-900">
                13. Contacto
              </h2>

              <div className="rounded-xl bg-slate-50 p-5">
                <p><strong>Correo:</strong> [CORREO]</p>
                <p><strong>Teléfono:</strong> [TELÉFONO]</p>
                <p><strong>Dirección:</strong> [DIRECCIÓN]</p>
              </div>
            </section>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-sm text-blue-900">
                El tratamiento de datos personales se realizará conforme a la
                legislación peruana aplicable.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}