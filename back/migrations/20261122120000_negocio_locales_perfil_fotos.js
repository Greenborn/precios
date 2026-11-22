// Área privada del negocio:
// - branch (local): propietario_id (usuario dueño), codigo (identificador único
//   de los locales nuevos) y publicado (visible en el mapa público). Los locales
//   existentes quedan publicados y sin propietario (cargados por administración).
// - articulo_fotos: una foto opcional por (local, artículo).
// - perfiles: perfil del negocio, creado con el factory de express-greenborn-perfil.
const { createPerfilMigration } = require('@greenborn/express-greenborn-perfil')
const { CAMPOS_PERFIL } = require('../config/negocio')

const perfil = createPerfilMigration({
  table: 'perfiles',
  userColumn: 'usuario_id',
  userTable: 'usuarios',
  campos: CAMPOS_PERFIL,
})

exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('branch', 'propietario_id'))) {
    await knex.schema.alterTable('branch', (t) => {
      t.integer('propietario_id').unsigned().nullable().index()
    })
  }
  if (!(await knex.schema.hasColumn('branch', 'codigo'))) {
    await knex.schema.alterTable('branch', (t) => {
      t.string('codigo', 32).nullable().unique()
    })
  }
  if (!(await knex.schema.hasColumn('branch', 'publicado'))) {
    await knex.schema.alterTable('branch', (t) => {
      t.boolean('publicado').notNullable().defaultTo(false)
    })
    await knex('branch').whereNull('propietario_id').update({ publicado: true })
  }

  if (!(await knex.schema.hasTable('articulo_fotos'))) {
    await knex.schema.createTable('articulo_fotos', (t) => {
      t.increments('id').primary()
      t.integer('branch_id').unsigned().notNullable()
      t.string('product_id', 36).notNullable()
      t.string('archivo', 255).notNullable()
      t.integer('user_id').unsigned().nullable()
      t.timestamps(true, true)
      t.unique(['branch_id', 'product_id'])
    })
  }

  await perfil.up(knex)
}

exports.down = async function (knex) {
  await perfil.down(knex)
  await knex.schema.dropTableIfExists('articulo_fotos')
  if (await knex.schema.hasColumn('branch', 'publicado')) {
    await knex.schema.alterTable('branch', (t) => t.dropColumn('publicado'))
  }
  if (await knex.schema.hasColumn('branch', 'codigo')) {
    await knex.schema.alterTable('branch', (t) => t.dropColumn('codigo'))
  }
  if (await knex.schema.hasColumn('branch', 'propietario_id')) {
    await knex.schema.alterTable('branch', (t) => t.dropColumn('propietario_id'))
  }
}
