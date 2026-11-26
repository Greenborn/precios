// Preferencia de tamaño de texto (accesibilidad, nota 333).
// Se guarda sólo un valor de la lista blanca; cualquier otro se descarta.

export const CLAVE_TAMANO_TEXTO = 'precios.tamano_texto'
export const TAMANO_TEXTO_DEFECTO = 'normal'

// Porcentaje sobre el font-size base del navegador (16px). Los rem escalan con <html>.
export const TAMANOS_TEXTO = {
  normal: 100,
  grande: 112.5,
  'muy-grande': 125,
}

export function esTamanoTextoValido(valor) {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(TAMANOS_TEXTO, valor)
}

export function leerTamanoTexto() {
  try {
    const valor = localStorage.getItem(CLAVE_TAMANO_TEXTO)
    return esTamanoTextoValido(valor) ? valor : TAMANO_TEXTO_DEFECTO
  } catch (e) {
    return TAMANO_TEXTO_DEFECTO
  }
}

// Aplica el tamaño en <html>. Devuelve la clave efectiva aplicada.
export function aplicarTamanoTexto(valor) {
  const clave = esTamanoTextoValido(valor) ? valor : TAMANO_TEXTO_DEFECTO
  try {
    document.documentElement.style.fontSize = TAMANOS_TEXTO[clave] + '%'
  } catch (e) { /* sin DOM disponible: no se aplica */ }
  return clave
}

// Aplica y persiste. Si localStorage falla (modo privado), igual aplica el valor en la sesión.
export function guardarTamanoTexto(valor) {
  const clave = aplicarTamanoTexto(valor)
  try {
    localStorage.setItem(CLAVE_TAMANO_TEXTO, clave)
  } catch (e) { /* localStorage no disponible: la preferencia sólo dura la sesión */ }
  return clave
}
