// Nuevo ABM "Indices de precios": por el momento cada indice se identifica
// por su nombre (cod_indice, ya PK) y referencia un alias de categoria
// (category_alias). La asociacion a productos puntuales se definira despues.
exports.up = async function (knex) {
  await knex.schema.alterTable('indices_precios', function (table) {
    table.integer('category_alias_id').unsigned().notNullable();
    table.foreign('category_alias_id').references('id').inTable('category_alias')
      .onUpdate('CASCADE').onDelete('RESTRICT');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('indices_precios', function (table) {
    table.dropForeign('category_alias_id');
    table.dropColumn('category_alias_id');
  });
};
