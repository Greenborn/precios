// Resalta con <mark> las palabras del término de búsqueda dentro de un texto.
// Espejo del tokenizar() del back (controllers/busqueda_productos.js): mismas
// reglas de normalización y palabras vacías, para marcar solo lo que la búsqueda usó.
// Escapa el texto antes de marcar: el resultado es seguro para v-html.

const PALABRAS_VACIAS = new Set(['de','del','el','la','los','las','un','una','unos','unas',
  'y','o','u','e','a','al','en','con','sin','por','para','su','sus','lo','que','se'])
const MAX_PALABRAS = 5

// Variantes con y sin tilde/diéresis para que "cafe" marque "café" y viceversa
const VARIANTES = { a: 'aáàäâ', e: 'eéèëê', i: 'iíìïî', o: 'oóòöô', u: 'uúùüû', n: 'nñ' }

function normalizar(texto) {
  return String(texto || '').normalize('NFD')
    .replace(/([^ǹ-ͯ]|n(?!̃(?![̀-ͯ])))[̀-ͯ]+/gi, '$1')
    .normalize().toLowerCase()
    .replace(/[;{}()*\/\\`'"]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function tokenizar(termino) {
  const unicas = [...new Set(normalizar(termino).split(' ').filter(p => p.length > 0))]
  if (unicas.length === 0) return []
  const sin_vacias = unicas.filter(p => !PALABRAS_VACIAS.has(p))
  return (sin_vacias.length > 0 ? sin_vacias : unicas).slice(0, MAX_PALABRAS)
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Patrón para una palabra: cada letra con acentos admitidos
function patronPalabra(palabra) {
  return [...palabra].map(c => {
    const variantes = VARIANTES[c]
    return variantes ? `[${variantes}]` : escapeRegex(c)
  }).join('')
}

export function resaltarTerminos(texto, termino) {
  if (typeof texto !== 'string') return ''
  const palabras = tokenizar(termino)
  if (palabras.length === 0) return escapeHtml(texto)

  // Las más largas primero, para que "coca cola" gane sobre "cola" dentro del alternado
  const alternado = palabras
    .sort((a, b) => b.length - a.length)
    .map(patronPalabra)
    .join('|')
  // split con grupo capturador: índices impares = coincidencias
  const partes = texto.split(new RegExp(`(${alternado})`, 'gi'))
  return partes
    .map((parte, i) => (i % 2 === 1 ? `<mark>${escapeHtml(parte)}</mark>` : escapeHtml(parte)))
    .join('')
}
