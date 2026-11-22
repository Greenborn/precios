// ABM de alias de categoria (tabla `category_alias`) sobre @greenborn/express-greenborn-crud.
// Un alias (texto libre) asociado a una categoria. La pareja (category_id, alias) es unica
// (validacion case-insensitive en el hook antesCrear/antesEditar). Se usa luego como selector
// en el ABM de Indices de Precios.
//
// Rutas (montadas en /admin/alias_categorias por middleware/Admin.js):
//   GET /list, GET /:id, POST /, PUT /:id, DELETE /:id
// Permisos: alias_categorias.listar|ver|crear|editar|eliminar (sso.requirePermission).
const express = require('express')
const { createCrudRouter, ErrorCrud } = require('@greenborn/express-greenborn-crud')
const sso = require('../sso')

var router = express.Router()
module.exports = router

// Puente de sesion: check_roles (middleware/Admin.js) deja la sesion en request.session,
// y sso.requirePermission espera req.user (mismo id de usuario).
router.use(function (req, res, next) {
  const u = req.session && req.session.u_data ? req.session.u_data : null
  req.user = u ? { id: u.id } : undefined
  next()
})

// Sanitizacion liviana: sin saltos de linea, sin espacios dobles, longitud maxima
function limpiar_alias(texto) {
  return String(texto ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255)
}

// Valida y normaliza alias + category_id. En edicion, id_actual excluye el propio registro.
async function validar_duplicado(category_id, alias, id_actual) {
  if (!alias) throw new ErrorCrud(400, 'El alias es obligatorio', { alias: 'Requerido' })

  let q = global.knex('category_alias')
    .where({ category_id })
    .whereRaw('LOWER(alias) = ?', [alias.toLowerCase()])
  if (id_actual) q = q.whereNot({ id: id_actual })
  if (await q.first()) throw new ErrorCrud(409, 'Ya existe ese alias para esa categoría')
}

const crud = createCrudRouter({
  knex: global.knex,
  sso,
  recurso: 'alias_categorias',
  tabla: 'category_alias',
  pk: 'id',
  campos: [
    { field: 'category_id', headerName: 'Categoría', type: 'select', required: true, sortable: true, filterable: true,
      lookup: { tabla: 'category', valor: 'id', etiqueta: 'name' } },
    { field: 'alias', headerName: 'Alias', type: 'text', maxLength: 255, required: true, sortable: true, filterable: true, searchable: true },
    { field: 'category_name', headerName: 'Categoría (nombre)', type: 'text', columna: 'cat.name', sortable: true, filterable: true, searchable: true },
  ],
  joins: [
    { tabla: 'category', alias: 'cat', on: ['category_id', 'id'], tipo: 'inner' },
  ],
  hooks: {
    antesCrear: async (req, datos) => {
      const alias = limpiar_alias(datos.alias)
      await validar_duplicado(datos.category_id, alias, null)
      return { ...datos, alias }
    },
    antesEditar: async (req, datos, registro) => {
      const alias = datos.alias !== undefined ? limpiar_alias(datos.alias) : registro.alias
      const category_id = datos.category_id !== undefined ? datos.category_id : registro.category_id
      await validar_duplicado(category_id, alias, registro.id)
      return { ...datos, ...(datos.alias !== undefined ? { alias } : {}) }
    },
    antesEliminar: async (req, registro) => {
      const en_indice = await global.knex('indices_precios').where({ category_alias_id: registro.id }).first()
      if (en_indice)
        throw new ErrorCrud(409, 'No se puede eliminar: el alias está siendo usado por un índice de precios')
      return registro
    },
  },
  logger: console,
})

router.use(crud)
