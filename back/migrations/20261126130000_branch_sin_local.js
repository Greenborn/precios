// Local "sin local": un único branch por usuario que se crea la primera vez que carga precios
// sin elegir un local real. Se marca con sin_local = 1 (NULL en los demás locales). La unique
// (propietario_id, sin_local) impide duplicarlo aunque dos envíos se hagan a la vez (MySQL
// admite varios NULL, así que los locales comunes no chocan).
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('branch', 'sin_local'))) {
    await knex.schema.alterTable('branch', (t) => {
      t.boolean('sin_local').nullable().defaultTo(null)
    })
  }
  const indices = await knex.raw("SHOW INDEX FROM branch WHERE Key_name = 'branch_propietario_sin_local_unique'")
  if (!indices[0].length) {
    await knex.schema.alterTable('branch', (t) => {
      t.unique(['propietario_id', 'sin_local'], 'branch_propietario_sin_local_unique')
    })
  }
}

exports.down = async function (knex) {
  const indices = await knex.raw("SHOW INDEX FROM branch WHERE Key_name = 'branch_propietario_sin_local_unique'")
  if (indices[0].length) {
    await knex.schema.alterTable('branch', (t) => t.dropUnique(['propietario_id', 'sin_local'], 'branch_propietario_sin_local_unique'))
  }
  if (await knex.schema.hasColumn('branch', 'sin_local')) {
    await knex.schema.alterTable('branch', (t) => t.dropColumn('sin_local'))
  }
}
