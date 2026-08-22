/**
 * Generador de códigos de ticket
 * Excluye caracteres visualmente confusos como 'I', 'O', '0', '1'
 */
const CARACTERES_VALIDOS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generarCodigoTurno(longitud = 3) {
  let codigo = ''
  for (let i = 0; i < longitud; i++) {
    const randomIndex = Math.floor(Math.random() * CARACTERES_VALIDOS.length)
    codigo += CARACTERES_VALIDOS.charAt(randomIndex)
  }
  return codigo
}
