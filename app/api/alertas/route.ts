import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Mismo patron que PATRON_CUE en worker/cej_scrapper.py
const PATRON_CUE = /^(\d{1,5})-(\d{4})-(\d+)-(\d{4})-([A-Z]{2})-([A-Z]{2})-(\d{1,2})$/

/**
 * Registra un expediente para monitoreo. La alerta queda en consulta_estado
 * 'pendiente' y el worker del CEJ hace la primera consulta en segundos.
 * Crear alertas no consume creditos.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const codigo = String(body.codigoExpediente ?? '').trim().toUpperCase().replace(/\s+/g, '')
    const parte = String(body.parte ?? '').trim().toUpperCase().replace(/\s+/g, ' ')

    const m = PATRON_CUE.exec(codigo)
    if (!m) {
      return NextResponse.json(
        { error: 'Codigo de expediente invalido. Ej: 00570-2026-0-3002-JR-CI-01' },
        { status: 400 }
      )
    }
    if (parte.length < 3) {
      return NextResponse.json(
        { error: 'Ingresa los apellidos o la razon social de una de las partes' },
        { status: 400 }
      )
    }
    const [, nro, anio, incidente, distrito, organo, especialidad, instancia] = m
    const cue = [nro.padStart(5, '0'), anio, incidente, distrito, organo, especialidad, instancia.padStart(2, '0')].join('-')

    const { data: identidad } = await supabase
      .from('identidad_consultante')
      .select('perfil_id')
      .eq('perfil_id', user.id)
      .maybeSingle()
    if (!identidad) {
      return NextResponse.json(
        { error: 'Primero registra tu identidad: el CEJ la exige en cada consulta', codigo: 'sin_identidad' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('alertas_expedientes')
      .insert({
        perfil_id: user.id,
        tipo: 'expediente',
        valor: cue,
        parte,
        filtros: { modo: 'codigo', codigoExpediente: cue, parte },
        // estado, cola y prioridad toman los valores por defecto de la tabla
        // (activo, pendiente, ahora, 0): el navegador no puede escribirlos
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya estas monitoreando este expediente' }, { status: 409 })
      }
      if (error.message?.includes('limite')) {
        // trigger validar_alerta_expediente (migracion 004)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      console.error(error)
      return NextResponse.json({ error: 'No se pudo registrar la alerta' }, { status: 500 })
    }

    return NextResponse.json({ alerta: data })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
