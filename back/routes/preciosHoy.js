// Listado de precios del día de hoy, tomado de la caché en memoria (global.precios_diccio).
// Solo lectura: no consulta la base de datos. Muestra solo precios fechados desde ayer (día
// de Argentina), también en sucursales de negocio, aunque la caché conserve sus vigentes más
// antiguos. No hay límite superior: los de mañana (admitidos en las cargas) se muestran.
//
// Permisos (recurso "precios_hoy"): precios_hoy.listar.
const express = require('express')
const sso = require('../sso')
const { dia_desde_hoy, interpretar_fecha } = require('../helpers/fecha_precio')

var router = express.Router()
module.exports = router

// Puente de sesion: check_roles (middleware/Admin.js) deja la sesion en request.session,
// y sso.requirePermission espera req.user.
router.use(function (req, res, next) {
  const u = req.session && req.session.u_data ? req.session.u_data : null
  req.user = u ? { id: u.id } : undefined
  next()
})

const PAGINACION = { tamanoDefecto: 25, tamanoMaximo: 500, tamanosPermitidos: [10, 25, 50, 100, 500] }

// Definicion de columnas (forma publica compatible con fields_def del paquete CRUD)
const CAMPOS = [
  { field: 'date_time',     headerName: 'Fecha',      type: 'date',   sortable: true, filterable: true },
  { field: 'product_name',  headerName: 'Producto',   type: 'text',   sortable: true, filterable: true, searchable: true },
  { field: 'empresa_name',  headerName: 'Comercio',   type: 'text',   sortable: true, filterable: true, searchable: true },
  { field: 'sucursal_name', headerName: 'Sucursal',   type: 'text',   sortable: true, filterable: true, searchable: true },
  { field: 'price',         headerName: 'Precio',     type: 'number', sortable: true, filterable: true },
  { field: 'cargado_por',   headerName: 'Cargado por', type: 'text',  sortable: true, filterable: true, searchable: true },
  { field: 'es_oferta',     headerName: 'Oferta',     type: 'boolean', sortable: true, filterable: true },
]
const CAMPO_POR_NOMBRE = Object.fromEntries(CAMPOS.map(c => [c.field, c]))

function fields_def() {
  return CAMPOS.map(c => ({
    field: c.field,
    headerName: c.headerName,
    type: c.type,
    sortable: c.sortable,
    filterable: c.filterable,
    searchable: c.searchable || false,
    writable: false,
    required: false,
  }))
}

// Convierte un registro de la caché en una fila del listado
function fila_desde_cache(r) {
  const branch = global.branchs_diccio[Number(r.branch_id)] || {}
  const empresa = global.enterprice_diccio[Number(branch.enterprise_id)] || {}
  const cargado_por = [r.user_nombre, r.user_apellido].filter(Boolean).join(' ') || null
  return {
    id: r.id,
    product_id: r.product_id,
    branch_id: r.branch_id,
    product_name: r.product_name || r.name || null,
    empresa_name: empresa.name || null,
    sucursal_name: branch.branch_name || null,
    price: r.price === undefined || r.price === null ? null : Number(r.price),
    date_time: r.date_time || null,
    cargado_por,
    es_oferta: !!r.es_oferta,
    confiabilidad: r.confiabilidad ?? null,
    url: r.url || null,
    notas: r.notas || null,
  }
}

// Filas de la caché (una por product_id y branch_id) fechadas desde ayer
function todas_las_filas() {
  const ayer = dia_desde_hoy(-1)
  const filas = []
  for (const pid in global.precios_diccio) {
    for (const r of global.precios_diccio[pid] || []) {
      const fecha = interpretar_fecha(r.date_time)
      if (fecha && fecha.dia >= ayer) filas.push(fila_desde_cache(r))
    }
  }
  return filas
}

function normalizar_texto(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function parsear_entero(valor, por_defecto) {
  if (valor === undefined || valor === '') return por_defecto
  const n = Number(valor)
  return Number.isInteger(n) && n >= 1 ? n : null
}

// Busqueda global: el texto debe aparecer en algun campo buscable
function coincide_busqueda(fila, texto) {
  return CAMPOS.some(c => c.searchable && normalizar_texto(fila[c.field]).includes(texto))
}

// Filtros por columna: texto => contiene; boolean => igual; number/date => rango { desde, hasta }
function coincide_filtro(fila, nombre, crudo) {
  const campo = CAMPO_POR_NOMBRE[nombre]
  const valor_fila = fila[nombre]
  if (campo.type === 'text') {
    const txt = typeof crudo === 'object' && crudo !== null ? crudo.valor : crudo
    return normalizar_texto(valor_fila).includes(normalizar_texto(txt))
  }
  if (campo.type === 'boolean') {
    const v = typeof crudo === 'object' && crudo !== null ? crudo.valor : crudo
    return valor_fila === (v === true || v === 'true')
  }
  // number y date: rango
  const desde = typeof crudo === 'object' && crudo !== null ? crudo.desde : undefined
  const hasta = typeof crudo === 'object' && crudo !== null ? crudo.hasta : undefined
  const v = campo.type === 'date' ? new Date(valor_fila).getTime() : valor_fila
  if (v === null || v === undefined || Number.isNaN(v)) return false
  const d = desde === undefined || desde === null || desde === '' ? null : (campo.type === 'date' ? new Date(desde).getTime() : Number(desde))
  const h = hasta === undefined || hasta === null || hasta === '' ? null : (campo.type === 'date' ? new Date(hasta).getTime() : Number(hasta))
  if (d !== null && v < d) return false
  if (h !== null && v > h) return false
  return true
}

function ordenar(filas, campo, orden) {
  const sentido = orden === 'desc' ? -1 : 1
  return filas.sort((a, b) => {
    let x = a[campo], y = b[campo]
    if (campo === 'date_time') { x = new Date(x).getTime(); y = new Date(y).getTime() }
    if (x === y) return 0
    if (x === null || x === undefined) return 1
    if (y === null || y === undefined) return -1
    if (typeof x === 'string') return x.localeCompare(y) * sentido
    return (x < y ? -1 : 1) * sentido
  })
}

// GET /list - listado paginado de la caché (contrato del paquete CRUD: page, pageSize, search, sortField, sortOrder, filters)
router.get('/list', sso.requirePermission('precios_hoy.listar'), function (req, res) {
  try {
    const q = req.query || {}
    const errors = {}

    const page = parsear_entero(q.page, 1)
    if (page === null) errors.page = 'Debe ser un entero mayor o igual a 1'
    const pageSize = parsear_entero(q.pageSize, PAGINACION.tamanoDefecto)
    if (pageSize === null || pageSize > PAGINACION.tamanoMaximo) errors.pageSize = `Máximo ${PAGINACION.tamanoMaximo}`
    if (Object.keys(errors).length) return res.status(400).json({ status: false, message: 'Parámetro inválido', errors })

    let filas = todas_las_filas()

    if (typeof q.search === 'string' && q.search.trim() !== '') {
      const texto = normalizar_texto(q.search.trim()).slice(0, 200)
      filas = filas.filter(f => coincide_busqueda(f, texto))
    }

    if (typeof q.filters === 'string' && q.filters !== '') {
      let parseado
      try { parseado = JSON.parse(q.filters) } catch (e) {
        return res.status(400).json({ status: false, message: 'Filtros con JSON inválido' })
      }
      for (const [nombre, crudo] of Object.entries(parseado || {})) {
        if (!CAMPO_POR_NOMBRE[nombre] || !CAMPO_POR_NOMBRE[nombre].filterable) {
          return res.status(400).json({ status: false, message: `Campo de filtro no permitido: ${nombre}` })
        }
        filas = filas.filter(f => coincide_filtro(f, nombre, crudo))
      }
    }

    if (q.sortField && CAMPO_POR_NOMBRE[q.sortField] && CAMPO_POR_NOMBRE[q.sortField].sortable) {
      ordenar(filas, q.sortField, q.sortOrder)
    } else {
      ordenar(filas, 'date_time', 'desc')
    }

    const total = filas.length
    const inicio = (page - 1) * pageSize
    const rows = filas.slice(inicio, inicio + pageSize)

    res.json({
      status: true,
      data: {
        rows,
        totalRecords: total,
        fields_def: fields_def(),
        paginacion: PAGINACION,
      },
    })
  } catch (error) {
    console.log('[preciosHoy] Error en listado:', error)
    res.status(500).json({ status: false, message: 'Error al listar los precios de hoy' })
  }
})
