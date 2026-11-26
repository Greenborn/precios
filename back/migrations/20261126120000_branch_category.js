// Relación N-N entre sucursales (branch) y categorías.
// Se completa al asentar un precio (carga manual o importación por lotes): las categorías
// del producto (product_category) quedan vinculadas al local donde se cargó el precio.
// `actualizado_el` se refresca cada vez que se vuelve a registrar la relación; las que
// no se actualizan en mucho tiempo sirven para detectar categorías muertas en el local.
// product_category sigue siendo N-N.
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('branch_category'))) {
    await knex.schema.createTable('branch_category', function (table) {
      table.increments('id').primary()
      table.integer('branch_id').unsigned().notNullable()
      table.string('category_id', 36).notNullable()
      table.datetime('creado_el').notNullable().defaultTo(knex.fn.now())
      table.datetime('actualizado_el').notNullable().defaultTo(knex.fn.now())

      table.foreign('branch_id').references('id').inTable('branch')
        .onUpdate('CASCADE').onDelete('CASCADE')
      table.foreign('category_id').references('id').inTable('category')
        .onUpdate('CASCADE').onDelete('RESTRICT')
      table.unique(['branch_id', 'category_id'])
      table.index('category_id')
    })
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('branch_category')
}
