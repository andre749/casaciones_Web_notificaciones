import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const BUCKET = 'documentos-expedientes'

/**
 * Descarga el PDF de la actuacion de una notificacion. El worker lo bajo del CEJ
 * durante su sesion; aqui se entrega con un enlace temporal. RLS garantiza que
 * cada usuario solo acceda a sus notificaciones y a su carpeta del bucket.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: notificacion } = await supabase
    .from('notificaciones')
    .select('documento_path, expediente')
    .eq('id', id)
    .maybeSingle()

  if (!notificacion?.documento_path) {
    return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 })
  }

  const nombre = `resolucion-${notificacion.expediente ?? 'expediente'}.pdf`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(notificacion.documento_path, 60, { download: nombre })

  if (error || !data) {
    console.error(error)
    return NextResponse.json({ error: 'No se pudo generar el enlace de descarga' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
