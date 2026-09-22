// Unicidad de la relación (alias, product_id) en alias_productos:
// un mismo alias puede apuntar a varios productos, pero la pareja
// (alias, product_id) no puede repetirse. La tabla ya existe; solo se
// agregan dedupe + índice único compuesto (prefijo por límite de bytes).

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('alias_productos');
  if (!hasTable) return;

  // Eliminar pares duplicados previos
  await knex.raw(`
    DELETE a1 FROM alias_productos a1
    JOIN alias_productos a2
      ON LOWER(a1.alias) = LOWER(a2.alias)
      AND a1.product_id = a2.product_id
      AND a1.alias > a2.alias
  `);

  const existing = await knex.raw(
    `SHOW INDEX FROM alias_productos WHERE Key_name = 'alias_productos_alias_product_unique' AND Non_unique = 0`
  );
  if (existing[0].length === 0) {
    // varchar(1024) utf8mb4 excede el límite de índice combinado con product_id;
    // se indexa un prefijo de alias (700*4 + 36*4 = 2944 bytes < 3072).
    await knex.raw(`
      CREATE UNIQUE INDEX alias_productos_alias_product_unique
      ON alias_productos (alias(700), product_id)
    `);
  }
};

exports.down = async function (knex) {
  const existing = await knex.raw(
    `SHOW INDEX FROM alias_productos WHERE Key_name = 'alias_productos_alias_product_unique' AND Non_unique = 0`
  );
  if (existing[0].length > 0) {
    await knex.raw(`DROP INDEX alias_productos_alias_product_unique ON alias_productos`);
  }
};
