// ABM de precios cargados por usuarios (solo rol administrador).
//
// Migracion parcial sobre @greenborn/express-greenborn-crud:
//   - Listado: GET /list y GET /:id del paquete (soloLectura), con filtroBase que deja
//     solo precios cargados por usuarios y joins de lectura.
//   - Borrado: DELETE /:id propio. No se delega al paquete porque la eliminacion restaura
//     el precio anterior (solo si es de hoy o ayer) en price_today, borra la copia de
//     precios_negocio y sincroniza buscador y caches en memoria.
//   - Alta y edicion: no existen (soloLectura).
//
// Permisos (recurso "precios"): precios.listar, precios.ver, precios.eliminar.
const express = require('express')
const { createCrudRouter, ErrorCrud } = require('@greenborn/express-greenborn-crud')
const sso = require('../sso')
const busqueda_productos = require('../controllers/busqueda_productos')
const sync_cache = require('../controllers/sync_cache')
const precios_negocio = require('../controllers/precios_negocio')
const { quitar_de_caches, sincronizar_precio_negocio } = require('../controllers/sincronizacion_precios')

var router = express.Router()
module.exports = router

// Puente de sesion: check_roles (middleware/Admin.js) deja la sesion en request.session,
// y sso.requirePermission espera req.user.
router.use(function (req, res, next) {
  const u = req.session && req.session.u_data ? req.session.u_data : null
  req.user = u ? { id: u.id } : undefined
  next()
})

function inicio_de_ayer() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d
}

// Elimina un precio cargado por un usuario. Si era el precio vigente en price_today,
// se restaura el precio anterior más reciente del mismo producto+sucursal solo si es de hoy
// o ayer; si no, se quita de price_today y de memoria. En locales de negocio la memoria sale
// de `price`, sin ventana. Borra también la copia de precios_negocio.
// Lanza ErrorCrud ante casos de negocio.
async function eliminar_precio(id) {
  const precio = await global.knex('price').where({ id }).first()
  if (!precio) throw new ErrorCrud(404, 'Precio no encontrado')
  if (!precio.user_id) throw new ErrorCrud(400, 'Solo se pueden eliminar precios cargados por usuarios')

  let actualizar_buscador = null   // datos para agregar_a_buscador tras commit
  let eliminar_buscador = false

  const trx = await global.knex.transaction()
  try {
    const price_today_vigente = await trx('price_today').where({ price_id: id }).first()

    await trx('price').where({ id }).del()
    await trx('precios_negocio').where({ id }).del()

    if (price_today_vigente) {
      const anterior = await trx('price')
        .where({ product_id: precio.product_id, branch_id: precio.branch_id })
        .orderBy('date_time', 'desc')
        .first()

      if (anterior && new Date(anterior.date_time) >= inicio_de_ayer()) {
        const producto_db = await trx('products').where('id', anterior.product_id).first()
        const product_name = producto_db?.name || null

        await trx('price_today').where({ id: price_today_vigente.id }).update({
          price: anterior.price,
          date_time: anterior.date_time,
          es_oferta: anterior.es_oferta,
          confiabilidad: anterior.confiabilidad,
          url: anterior.url,
          notas: anterior.notas,
          time: anterior.time,
          product_name: product_name,
          price_id: anterior.id,
          user_id: anterior.user_id || null,
          user_nombre: anterior.user_nombre || null,
          user_apellido: anterior.user_apellido || null
        })

        actualizar_buscador = {
          product_name,
          product_id: anterior.product_id,
          price: anterior.price,
          branch_id: anterior.branch_id,
          date_time: anterior.date_time,
          time: anterior.time,
          url: anterior.url || null,
          user_id: anterior.user_id || null,
          user_nombre: anterior.user_nombre || null,
          user_apellido: anterior.user_apellido || null,
          price_id: anterior.id,
          id: price_today_vigente.id,
          es_oferta: anterior.es_oferta,
          confiabilidad: anterior.confiabilidad,
          notas: anterior.notas
        }
      } else {
        await trx('price_today').where({ id: price_today_vigente.id }).del()
        eliminar_buscador = true
      }
    }

    await trx.commit()
  } catch (err) {
    await trx.rollback()
    throw err
  }

  // Sincronizar buscador y caches en memoria
  if (precios_negocio.es_negocio(precio.branch_id)) {
    await sincronizar_precio_negocio(precio.product_id, precio.branch_id)
  } else if (actualizar_buscador && actualizar_buscador.product_name) {
    busqueda_productos.agregar_a_buscador(actualizar_buscador)
    await sync_cache.actualizar_precio(actualizar_buscador)
  } else if (eliminar_buscador) {
    busqueda_productos.eliminar_de_buscador(precio.product_id, precio.branch_id)
    quitar_de_caches(precio.product_id, precio.branch_id)
  }
}

// price.id es varchar(36): conviven UUID v7, UUID v1 e ids numericos antiguos. El id se usa
// siempre como string; comparar la columna con un numero haria que MySQL convierta los ids.
const ID_PRECIO = /^[A-Za-z0-9-]{1,36}$/

// DELETE /:id - elimina un precio cargado por un usuario
router.delete('/:id', sso.requirePermission('precios.eliminar'), async function (req, res) {
  const id = String(req.params.id || '')
  if (!ID_PRECIO.test(id)) return res.status(400).json({ status: false, message: 'Identificador de precio inválido' })

  try {
    await eliminar_precio(id)
    res.status(200).json({ status: true, data: { id, message: 'Precio eliminado correctamente' } })
  } catch (error) {
    if (error instanceof ErrorCrud) return res.status(error.status).json({ status: false, message: error.message })
    console.log('[preciosComunitarios] Error en eliminar:', error)
    res.status(500).json({ status: false, message: 'Error al eliminar el precio' })
  }
})

// GET /list y GET /:id - listado de solo lectura (contrato del paquete)
router.use(createCrudRouter({
  knex: global.knex,
  sso,
  recurso: 'precios',
  tabla: 'price',
  pk: 'id',
  soloLectura: true,
  filtroBase: (req, qb) => qb.whereNotNull('price.user_id'),
  joins: [
    { tabla: 'products', alias: 'pr', on: ['product_id', 'id'], tipo: 'left' },
    { tabla: 'branch', alias: 'b', on: ['branch_id', 'id'], tipo: 'left' },
    { tabla: 'enterprice', alias: 'e', on: ['b.enterprise_id', 'id'], tipo: 'left' },
    { tabla: 'usuarios', alias: 'u', on: ['user_id', 'id'], tipo: 'left' },
  ],
  campos: [
    { field: 'date_time', headerName: 'Fecha', type: 'date', sortable: true, filterable: true },
    { field: 'product_name', headerName: 'Producto', type: 'text', columna: 'pr.name', sortable: true, filterable: true, searchable: true },
    { field: 'empresa_name', headerName: 'Comercio', type: 'text', columna: 'e.name', filterable: true, searchable: true },
    { field: 'price', headerName: 'Precio', type: 'number', sortable: true, filterable: true },
    { field: 'cargado_por', headerName: 'Cargado por', type: 'text', columna: 'u.name', filterable: true, searchable: true },
    { field: 'user_email', headerName: 'Email usuario', type: 'text', columna: 'u.email', filterable: true, searchable: true },
  ],
  logger: console,
}))

// Expuesto para el área de negocio (DELETE /negocio/mis-precios/:id), que valida la propiedad antes
module.exports.eliminar_precio = eliminar_precio
