// La carga inicial de categorias dejo el string literal 'null' en vez de NULL
// real en root_category_id (3472 filas). Se normaliza y se agrega la FK
// auto-referenciada que faltaba, necesaria para la vista de arbol del ABM.
exports.up = async function (knex) {
  await knex('category').where({ root_category_id: 'null' }).update({ root_category_id: null });
  await knex('category').where({ root_category_id: '' }).update({ root_category_id: null });

  await knex.schema.alterTable('category', function (table) {
    table.foreign('root_category_id').references('id').inTable('category')
      .onUpdate('CASCADE').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('category', function (table) {
    table.dropForeign('root_category_id');
  });
};
