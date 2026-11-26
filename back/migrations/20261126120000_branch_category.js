// Relación N-N entre sucursales (branch) y categorías.
// Se completa al asentar un precio (carga manual o importación por lotes): las categorías
// del producto (product_category) quedan vinculadas al local donde se cargó el precio.
// `actualizado_el` se refresca cada vez que se vuelve a registrar la relación; las que
// no se actualizan en mucho tiempo sirven para detectar categorías muertas en el local.
// product_category sigue siendo N-N.
// El tipo de branch_category.branch_id debe coincidir exactamente con branch.id (si no, MySQL
// falla con errno 150). Se toma de information_schema en vez de asumirlo.
async function tipo_branch_id(knex) {
  const [fila] = await knex.raw(
    `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch' AND COLUMN_NAME = 'id'`
  ).then(r => r[0])
  if (!fila) throw new Error('No se encontró branch.id')
  return fila.tipo // p.ej. "int(11)" o "int(10) unsigned"
}

exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('branch_category'))) {
    const tipo = await tipo_branch_id(knex)
    const sin_signo = /unsigned/i.test(tipo)
    const es_bigint = /^bigint/i.test(tipo)
    await knex.schema.createTable('branch_category', function (table) {
      table.increments('id').primary()
      const col = es_bigint ? table.bigInteger('branch_id') : table.integer('branch_id')
      if (sin_signo) col.unsigned()
      col.notNullable()
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
