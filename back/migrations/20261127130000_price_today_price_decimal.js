// price_today.price pasa de float a decimal(10,2), igual que price.price. Idempotente.
// El float guardaba ~6 cifras significativas: tras la conversión se recupera el valor exacto
// de price (por price_id) solo cuando la diferencia se explica por esa precisión.
exports.up = async function (knex) {
  const [[columna]] = await knex.raw(
    "SELECT DATA_TYPE AS tipo, NUMERIC_PRECISION AS precision_n, NUMERIC_SCALE AS escala FROM information_schema.COLUMNS " +
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'price_today' AND COLUMN_NAME = 'price'"
  )
  const es_destino = columna && columna.tipo === 'decimal' && Number(columna.precision_n) === 10 && Number(columna.escala) === 2
  if (!es_destino) {
    await knex.raw('ALTER TABLE price_today MODIFY price DECIMAL(10,2) NOT NULL')
  }
  await knex.raw(`
    UPDATE price_today pt
      JOIN price p ON p.id = pt.price_id AND p.product_id = pt.product_id AND p.branch_id = pt.branch_id
       SET pt.price = p.price
     WHERE pt.price <> p.price
       AND ABS(pt.price - p.price) <= GREATEST(0.01, ABS(p.price) * 0.00001)
  `)
}

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE price_today MODIFY price FLOAT NOT NULL')
}
