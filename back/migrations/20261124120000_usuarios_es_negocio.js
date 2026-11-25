// Indica si el usuario representa a un negocio. Habilita el perfil, los locales y la
// carga de precios propios (área /mi-negocio). Por defecto los usuarios no son negocios.
exports.up = async function (knex) {
  if (await knex.schema.hasColumn('usuarios', 'es_negocio')) return
  await knex.schema.alterTable('usuarios', (t) => {
    t.boolean('es_negocio').notNullable().defaultTo(false)
  })
}

exports.down = async function (knex) {
  if (!(await knex.schema.hasColumn('usuarios', 'es_negocio'))) return
  await knex.schema.alterTable('usuarios', (t) => {
    t.dropColumn('es_negocio')
  })
}
