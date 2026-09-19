// Carga de precios por usuarios logueados:
// - usuarios.apellido: permite registrar y mostrar nombre y apellido del autor
// - price / price_today: trazabilidad del usuario que cargó el precio
//   (user_id + snapshot de nombre/apellido para mostrar sin joins)
exports.up = async function (knex) {
  // --- usuarios.apellido ---
  const tiene_apellido = await knex.schema.hasColumn('usuarios', 'apellido')
  if (!tiene_apellido) {
    await knex.schema.alterTable('usuarios', function (table) {
      table.string('apellido', 128).nullable().after('name')
    })
  }

  // Backfill no destructivo: separar apellido del nombre compuesto existente
  await knex.raw(
    `UPDATE usuarios
        SET apellido = TRIM(SUBSTRING(name, LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 1)),
            name     = SUBSTRING_INDEX(name, ' ', 1)
      WHERE apellido IS NULL
        AND name LIKE '% %'`
  )

  // --- price / price_today: columnas de autor ---
  for (const tabla of ['price', 'price_today']) {
    const existe_tabla = await knex.schema.hasTable(tabla)
    if (!existe_tabla) continue

    const tiene_user_id = await knex.schema.hasColumn(tabla, 'user_id')
    if (!tiene_user_id) {
      await knex.schema.alterTable(tabla, function (table) {
        table.integer('user_id').unsigned().nullable()
      })
    }

    const tiene_user_nombre = await knex.schema.hasColumn(tabla, 'user_nombre')
    if (!tiene_user_nombre) {
      await knex.schema.alterTable(tabla, function (table) {
        table.string('user_nombre', 128).nullable()
        table.string('user_apellido', 128).nullable()
      })
    }
  }
}

exports.down = async function (knex) {
  await knex.schema.alterTable('usuarios', function (table) {
    table.dropColumn('apellido')
  })

  for (const tabla of ['price', 'price_today']) {
    const existe_tabla = await knex.schema.hasTable(tabla)
    if (!existe_tabla) continue

    await knex.schema.alterTable(tabla, function (table) {
      table.dropColumn('user_id')
      table.dropColumn('user_nombre')
      table.dropColumn('user_apellido')
    })
  }
}
