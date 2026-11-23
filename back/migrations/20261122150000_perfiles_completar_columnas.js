// Repara `perfiles` cuando la tabla ya existía con otro esquema: el factory de
// express-greenborn-perfil no hace nada si la tabla existe y, además, omite la
// columna de valor de los campos con interruptor (p. ej. nombre_comercial).
const { normalizarCampos } = require('@greenborn/express-greenborn-perfil')
const { CAMPOS_PERFIL } = require('../config/negocio')

exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('perfiles'))) return
  for (const c of normalizarCampos(CAMPOS_PERFIL)) {
    if (c.tipo !== 'booleano' && !(await knex.schema.hasColumn('perfiles', c.nombre))) {
      await knex.schema.alterTable('perfiles', (t) => {
        if (c.tipo === 'numero') t.float(c.nombre).nullable()
        else if (c.tipo === 'texto_largo') t.text(c.nombre).nullable()
        else t.string(c.nombre, 255).nullable()
      })
    }
    if (c.tipo === 'booleano' && !(await knex.schema.hasColumn('perfiles', c.nombre))) {
      await knex.schema.alterTable('perfiles', (t) => t.boolean(c.nombre).notNullable().defaultTo(false))
    }
    if (c.interruptor && !(await knex.schema.hasColumn('perfiles', c.interruptor))) {
      await knex.schema.alterTable('perfiles', (t) => t.boolean(c.interruptor).notNullable().defaultTo(false))
    }
  }
}

exports.down = async function () {}
