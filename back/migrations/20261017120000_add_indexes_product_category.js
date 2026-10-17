// product_category (255k+ filas) no tenia indice en category_id ni product_id,
// solo PK en id. La vista de arbol de categorias (y el conteo de productos por
// categoria en el ABM) hacen leftJoin por category_id y escaneaban la tabla
// entera en cada request (~48s). Se agregan los indices faltantes.
exports.up = async function (knex) {
  await knex.schema.alterTable('product_category', function (table) {
    table.index('category_id');
    table.index('product_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('product_category', function (table) {
    table.dropIndex('category_id');
    table.dropIndex('product_id');
  });
};
