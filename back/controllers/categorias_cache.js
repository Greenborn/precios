// Cache en memoria del ABM de categorias (usada por routes/categoriasAdmin.js).
//
// Estructuras (todas con claves String, porque category.id es varchar(36)):
//   global.category_diccio      id -> categoria { id, name, root_category_id }
//   global.diccio_name_category nombre -> categoria (lo usa importar_productos)
//   global.category_productos   category_id -> Set(product_id)
//
// Las lecturas del ABM (listados, arbol, selectores, validaciones) salen de aca.
// Las mutaciones escriben primero en DB y despues actualizan estas caches en el
// mismo proceso, sin regenerar todos los diccionarios.
const sync_cache = require('./sync_cache')

const clave = v => String(v)
const minusc = v => String(v ?? '').toLowerCase()

function comparar(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''), 'es', { sensitivity: 'base' })
}

function ordenar(items, campo, sortOrder = 'asc') {
  const dir = sortOrder === 'desc' ? -1 : 1
  return items.sort((x, y) => dir * comparar(x[campo], y[campo]))
}

function todas() {
  return Object.values(global.category_diccio)
}

// Carga inicial. La llama regenerar_diccionarios en server.js.
exports.cargar = function (categorias, product_category) {
  global.category_diccio = {}
  global.diccio_name_category = {}
  global.category_productos = {}

  for (const c of categorias || []) {
    global.category_diccio[clave(c.id)] = c
    global.diccio_name_category[c.name] = c
  }
  for (const pc of product_category || []) {
    const k = clave(pc.category_id)
    if (!global.category_productos[k]) global.category_productos[k] = new Set()
    global.category_productos[k].add(clave(pc.product_id))
  }
}

exports.obtener = id => global.category_diccio[clave(id)] || null

exports.cant_productos = id => global.category_productos[clave(id)]?.size || 0

exports.tiene_productos = id => exports.cant_productos(id) > 0

exports.tiene_producto = (category_id, product_id) =>
  !!global.category_productos[clave(category_id)]?.has(clave(product_id))

exports.tiene_hijos = id =>
  todas().some(c => c.root_category_id && clave(c.root_category_id) === clave(id))

exports.ids_productos = id => [...(global.category_productos[clave(id)] || [])]

function padre_de(cat) {
  return cat.root_category_id ? global.category_diccio[clave(cat.root_category_id)] || null : null
}

function vista(cat) {
  const padre = padre_de(cat)
  return {
    id: cat.id,
    name: cat.name,
    root_category_id: cat.root_category_id ?? null,
    root_category_name: padre ? padre.name : null,
    cant_productos: exports.cant_productos(cat.id),
  }
}

const FILTER_COLUMNS = {
  id: ['id', 'eq'],
  name: ['name', 'like'],
  root_category_name: ['root_category_name', 'like'],
}

const SORT_COLUMNS = {
  id: 'id',
  name: 'name',
  root_category_name: 'root_category_name',
  cant_productos: 'cant_productos',
}

// Listado paginado con filtros por columna y busqueda por nombre (contrato TableEditor)
exports.listar = function ({ search = '', filters = {}, page = 1, pageSize = 25, sortField = 'name', sortOrder = 'asc' }) {
  let items = todas().map(vista)

  for (const [campo, valor] of Object.entries(filters || {})) {
    const def = FILTER_COLUMNS[campo]
    if (!def || valor === undefined || valor === null || valor === '') continue
    items = items.filter(it => def[1] === 'eq'
      ? clave(it[def[0]]) === clave(valor)
      : minusc(it[def[0]]).includes(minusc(valor)))
  }
  if (search) items = items.filter(it => minusc(it.name).includes(minusc(search)))

  ordenar(items, SORT_COLUMNS[sortField] || 'name', sortOrder)
  const total = items.length
  const rows = items.slice((page - 1) * pageSize, page * pageSize)
  return { rows, total }
}

// Hijos directos de un nivel (sin parent_id: raices). Con search busca en todos los niveles.
exports.arbol = function ({ parent_id = '', search = '' }) {
  const cant_hijos = {}
  for (const c of todas()) {
    if (c.root_category_id) {
      const k = clave(c.root_category_id)
      cant_hijos[k] = (cant_hijos[k] || 0) + 1
    }
  }

  let items = todas()
  if (search) {
    items = items.filter(c => minusc(c.name).includes(minusc(search)))
  } else {
    const padre = parent_id ? clave(parent_id) : null
    items = items.filter(c => (c.root_category_id ? clave(c.root_category_id) : null) === padre)
  }

  const rows = items.map(c => ({
    id: c.id,
    name: c.name,
    cant_productos: exports.cant_productos(c.id),
    tiene_hijos: (cant_hijos[clave(c.id)] || 0) > 0,
  }))
  return ordenar(rows, 'name')
}

exports.categorias_disponibles = function ({ search = '', exclude_id = '', limit = 20 }) {
  let items = todas()
  if (exclude_id) items = items.filter(c => clave(c.id) !== clave(exclude_id))
  if (search) items = items.filter(c => minusc(c.name).includes(minusc(search)))
  return ordenar(items.map(c => ({ id: c.id, name: c.name })), 'name').slice(0, limit)
}

// Valida nombre y padre contra la cache. id_actual solo en edicion.
exports.validar = function (name, root_category_id, id_actual) {
  if (!name) return { error: 'El nombre de la categoría es obligatorio' }

  const actual = id_actual ? clave(id_actual) : null
  const root = root_category_id ? clave(root_category_id) : null

  const duplicado = todas().some(c => clave(c.id) !== actual && minusc(c.name) === minusc(name))
  if (duplicado) return { error: 'Ya existe una categoría con ese nombre' }

  if (root) {
    if (actual && root === actual)
      return { error: 'Una categoría no puede ser su propia categoría padre' }

    let ancestro = global.category_diccio[root]
    if (!ancestro) return { error: 'La categoría padre indicada no existe' }

    // evita ciclos: ningun ancestro del padre elegido puede ser la categoria actual
    if (actual) {
      const visitados = new Set([actual])
      while (ancestro && ancestro.root_category_id) {
        const r = clave(ancestro.root_category_id)
        if (visitados.has(r))
          return { error: 'La categoría padre elegida genera un ciclo de categorías' }
        visitados.add(r)
        ancestro = global.category_diccio[r]
      }
    }
  }

  return { name, root_category_id: root }
}

// Mutaciones: llamar despues de haber escrito en DB
exports.alta = function (cat) {
  global.category_diccio[clave(cat.id)] = cat
  global.diccio_name_category[cat.name] = cat
  global.category_productos[clave(cat.id)] = new Set()
}

exports.modificar = function (id, cambios) {
  const cat = global.category_diccio[clave(id)]
  if (!cat) return
  if (global.diccio_name_category[cat.name] === cat) delete global.diccio_name_category[cat.name]
  cat.name = cambios.name
  cat.root_category_id = cambios.root_category_id
  global.diccio_name_category[cat.name] = cat
}

exports.baja = function (id) {
  const k = clave(id)
  const cat = global.category_diccio[k]
  if (cat && global.diccio_name_category[cat.name] === cat) delete global.diccio_name_category[cat.name]
  delete global.category_diccio[k]
  delete global.category_productos[k]
}

exports.asociar_producto = function (category_id, product_id) {
  const k = clave(category_id)
  if (!global.category_productos[k]) global.category_productos[k] = new Set()
  global.category_productos[k].add(clave(product_id))
  sync_cache.vincular_producto_categoria(product_id, category_id)
}

exports.desasociar_producto = function (category_id, product_id) {
  global.category_productos[clave(category_id)]?.delete(clave(product_id))
  sync_cache.desvincular_producto_categoria(product_id, category_id)
}
