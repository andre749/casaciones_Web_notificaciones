import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { cifrar } from '@/lib/cifrado'

/**
 * Identidad del consultante que el CEJ exige en cada consulta.
 * Se guarda cifrada; al cliente solo vuelve el tipo y el numero enmascarado.
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data } = await supabase
    .from('identidad_consultante')
    .select('tipo_documento, documento_mascara, updated_at')
    .eq('perfil_id', user.id)
    .maybeSingle()

  return NextResponse.json({ identidad: data })
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const tipoDocumento = String(body.tipoDocumento ?? '')
    const numeroDocumento = String(body.numeroDocumento ?? '').trim().toUpperCase()
    const codigoVerificacion = String(body.codigoVerificacion ?? '').trim().toUpperCase()
    const fechaEmision = String(body.fechaEmision ?? '')
    const fechaNacimiento = String(body.fechaNacimiento ?? '')

    if (body.consentimiento !== true) {
      return NextResponse.json(
        { error: 'Debes autorizar el tratamiento de tus datos para continuar' },
        { status: 400 }
      )
    }

    if (tipoDocumento !== 'DNI' && tipoDocumento !== 'CE') {
      return NextResponse.json({ error: 'Tipo de documento invalido' }, { status: 400 })
    }
    if (tipoDocumento === 'DNI' && !/^\d{8}$/.test(numeroDocumento)) {
      return NextResponse.json({ error: 'El DNI debe tener 8 digitos' }, { status: 400 })
    }
    if (tipoDocumento === 'CE' && !/^[A-Z0-9]{6,15}$/.test(numeroDocumento)) {
      return NextResponse.json({ error: 'Numero de carnet de extranjeria invalido' }, { status: 400 })
    }
    if (tipoDocumento === 'DNI' && !/^[0-9A-Z]{1,3}$/.test(codigoVerificacion)) {
      return NextResponse.json(
        { error: 'El codigo de verificacion es el caracter que aparece al lado del numero de DNI' },
        { status: 400 }
      )
    }
    const hoy = new Date().toISOString().slice(0, 10)
    if (!FECHA.test(fechaEmision) || !FECHA.test(fechaNacimiento) || fechaEmision > hoy || fechaNacimiento >= fechaEmision) {
      return NextResponse.json({ error: 'Revisa las fechas de emision y nacimiento' }, { status: 400 })
    }

    const datos = JSON.stringify({
      tipoDocumento,
      numeroDocumento,
      codigoVerificacion: tipoDocumento === 'DNI' ? codigoVerificacion : '',
      fechaEmision,
      fechaNacimiento,
    })

    const { data, error } = await supabase
      .from('identidad_consultante')
      .upsert({
        perfil_id: user.id,
        tipo_documento: tipoDocumento,
        documento_mascara: `****${numeroDocumento.slice(-4)}`,
        datos_cifrados: cifrar(datos, user.id),
        consentimiento_en: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('tipo_documento, documento_mascara, updated_at')
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'No se pudo guardar la identidad' }, { status: 500 })
    }

    // Las alertas que fallaron por falta de identidad se vuelven a encolar
    await supabase.rpc('reencolar_alertas_sin_identidad')

    return NextResponse.json({ identidad: data })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  await supabase.from('identidad_consultante').delete().eq('perfil_id', user.id)
  return NextResponse.json({ success: true })
}
