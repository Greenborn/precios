// La tabla `category_alias` (alias por categoria) quedo de un diseño anterior:
// esta vacia, sin uso en el codigo y con category_id tipado `int` cuando
// category.id es `varchar(36)`. Se recrea con los tipos correctos, la FK a
// category y la unicidad (category_id, alias) que pide el nuevo ABM.
exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('category_alias');
  await knex.schema.createTable('category_alias', function (table) {
    table.increments('id').primary();
    table.string('category_id', 36).notNullable();
    table.string('alias', 255).notNullable();

    table.foreign('category_id').references('id').inTable('category')
      .onUpdate('CASCADE').onDelete('RESTRICT');
    table.unique(['category_id', 'alias']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('category_alias');
  await knex.schema.createTable('category_alias', function (table) {
    table.increments('id').primary();
    table.integer('category_id').notNullable();
    table.string('alias', 255).notNullable();
  });
};
