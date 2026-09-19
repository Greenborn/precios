exports.up = async function(knex) {
  // Idempotente: en entornos donde el esquema preexistía la columna ya fue creada
  const existe = await knex.schema.hasColumn('branch', 'address')
  if (existe) return
  return knex.schema.alterTable('branch', function(table) {
    table.string('address', 500);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('branch', function(table) {
    table.dropColumn('address');
  });
};
