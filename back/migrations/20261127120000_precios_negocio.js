// Precios cargados por usuarios con perfil de negocio (usuarios.es_negocio = 1).
// Tabla propia vinculada al usuario para lectura rápida ("mis precios"). Es una copia
// duplicada: el precio sigue en price (histórico), price_today y buscador.
// price_id = id del registro en price (misma clave), así se mantiene la relación.
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('precios_negocio'))) {
    await knex.schema.createTable('precios_negocio', (t) => {
      t.string('id', 36).primary()
      t.integer('usuario_id').unsigned().notNullable()
      t.string('product_id', 64).notNullable()
      t.integer('branch_id').notNullable()
      t.decimal('price', 14, 2).notNullable()
      t.datetime('date_time').notNullable()
      t.string('notas', 255).nullable()
      t.timestamp('creado_el').defaultTo(knex.fn.now())
      t.timestamp('actualizado_el').defaultTo(knex.fn.now())
      t.index(['usuario_id', 'date_time'], 'precios_negocio_usuario_fecha_idx')
      t.index(['product_id', 'branch_id'], 'precios_negocio_producto_local_idx')
    })
  }

  // Misma collation que price: el backfill compara ids entre ambas tablas (si no, MySQL
  // rechaza la comparación con "Illegal mix of collations"). Idempotente.
  const [[{ collation }]] = await knex.raw(
    "SELECT TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'price'"
  )
  if (collation) {
    const charset = collation.split('_')[0]
    await knex.raw(`ALTER TABLE precios_negocio CONVERT TO CHARACTER SET ${charset} COLLATE ${collation}`)
  }

  // Backfill: copia el histórico ya cargado por usuarios con perfil de negocio
  await knex.raw(`
    INSERT INTO precios_negocio (id, usuario_id, product_id, branch_id, price, date_time, notas, creado_el, actualizado_el)
    SELECT p.id, p.user_id, p.product_id, p.branch_id, p.price, p.date_time, p.notas, NOW(), NOW()
      FROM price p
      JOIN usuarios u ON u.id = p.user_id
     WHERE u.es_negocio = 1
       AND NOT EXISTS (SELECT 1 FROM precios_negocio pn WHERE pn.id = p.id)
  `)
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('precios_negocio')
}
