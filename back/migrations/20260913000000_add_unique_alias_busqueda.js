// Unicidad del término inicial en alias_busqueda:
// cada nombre que llega puede estar definido una sola vez como alias.
// La tabla ya existe (alias → termino); solo se agrega el índice único.

exports.up = async function (knex) {
  const hasUnique = await knex.schema.hasColumn('alias_busqueda', 'alias');
  if (!hasUnique) return;

  // Eliminar duplicados previos conservando el registro más antiguo
  await knex.raw(`
    DELETE a1 FROM alias_busqueda a1
    JOIN alias_busqueda a2
      ON LOWER(a1.alias) = LOWER(a2.alias)
      AND a1.id > a2.id
  `);

  const existing = await knex.raw(`SHOW INDEX FROM alias_busqueda WHERE Key_name = 'alias_busqueda_alias_unique' AND Non_unique = 0`);
  if (existing[0].length === 0) {
    await knex.schema.alterTable('alias_busqueda', function (table) {
      table.unique(['alias'], 'alias_busqueda_alias_unique');
    });
  }
};

exports.down = async function (knex) {
  const existing = await knex.raw(`SHOW INDEX FROM alias_busqueda WHERE Key_name = 'alias_busqueda_alias_unique' AND Non_unique = 0`);
  if (existing[0].length > 0) {
    await knex.schema.alterTable('alias_busqueda', function (table) {
      table.dropUnique(['alias'], 'alias_busqueda_alias_unique');
    });
  }
};
