// Medios de contacto del negocio (varios por tipo), con interruptor de visibilidad por dato.
exports.up = async function (knex) {
  if (await knex.schema.hasTable('negocio_contactos')) return
  await knex.schema.createTable('negocio_contactos', (t) => {
    t.increments('id').primary()
    t.integer('usuario_id').unsigned().notNullable().index()
      .references('id').inTable('usuarios').onDelete('CASCADE')
    t.string('tipo', 20).notNullable()
    t.string('valor', 255).notNullable()
    t.boolean('visible').notNullable().defaultTo(true)
    t.timestamps(true, true)
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('negocio_contactos')
}
