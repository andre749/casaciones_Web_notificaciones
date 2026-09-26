import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Cifrado AES-256-GCM de los datos de identidad del consultante.
 * La clave (IDENTIDAD_CLAVE, 32 bytes en base64) solo existe en el servidor
 * y en el worker del CEJ (worker/cej_scrapper.py), que usa el mismo formato:
 *   v1:<iv base64>:<datos cifrados + tag base64>
 * El perfil_id va como dato asociado: un registro copiado a otro usuario no descifra.
 */

function obtenerClave(): Buffer {
  const clave = Buffer.from(process.env.IDENTIDAD_CLAVE ?? '', 'base64')
  if (clave.length !== 32) {
    throw new Error('IDENTIDAD_CLAVE debe ser una clave de 32 bytes en base64')
  }
  return clave
}

export function cifrar(texto: string, perfilId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', obtenerClave(), iv)
  cipher.setAAD(Buffer.from(perfilId))
  const datos = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final(), cipher.getAuthTag()])
  return `v1:${iv.toString('base64')}:${datos.toString('base64')}`
}

export function descifrar(valor: string, perfilId: string): string {
  const [version, ivB64, datosB64] = valor.split(':')
  if (version !== 'v1' || !ivB64 || !datosB64) throw new Error('Formato de cifrado desconocido')
  const datos = Buffer.from(datosB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', obtenerClave(), Buffer.from(ivB64, 'base64'))
  decipher.setAAD(Buffer.from(perfilId))
  decipher.setAuthTag(datos.subarray(datos.length - 16))
  return Buffer.concat([decipher.update(datos.subarray(0, datos.length - 16)), decipher.final()]).toString('utf8')
}
