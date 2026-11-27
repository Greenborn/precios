// Reconstruye la tabla price_today a partir de price conservando la ventana
// "hoy + ayer": borra registros anteriores al inicio del día de ayer y hace
// upsert del precio más reciente por (product_id, branch_id) de la ventana.
// Uso: node scripts/recrear_price_today.js  (desde back/)
require("dotenv").config({ path: '.env' })
const uuid = require("uuid")

// Zona horaria del proceso (Argentina UTC-3), igual que server.js
process.env.TZ = 'America/Argentina/Buenos_Aires'

const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: process.env.mysql_host,
    user: process.env.mysql_user,
    password: process.env.mysql_password,
    database: process.env.mysql_database,
    supportBigNumbers: true,
    bigNumberStrings: true,
    typeCast: function (field, next) {
      if (field.type == "NEWDECIMAL") {
        var value = field.string();
        return (value === null) ? null : Number(value);
      }
      return next();
    }
  },
  pool: { min: 0, max: 10, "propagateCreateError": false }
})

async function main() {
  console.log('[recrear_price_today] Iniciando regeneración de price_today...')

  // Ventana de retención: hoy y ayer
  const AYER = new Date()
  AYER.setHours(0,0,0,0)
  AYER.setDate(AYER.getDate() - 1)

  // 1) Limpiar registros anteriores a ayer
  const borrados = await knex('price_today').where('date_time', '<', AYER).del()
  console.log(`[recrear_price_today] Registros antiguos eliminados de price_today: ${borrados}`)

  // 2) Precios más recientes por (product_id, branch_id) dentro de la ventana
  const sub = knex('price')
    .where('time', '>=', AYER)
    .select('product_id', 'branch_id')
    .max('time as max_time')
    .groupBy('product_id', 'branch_id')

  const precios = await knex('price')
    .join(sub.as('latest'), function () {
      this.on('price.product_id', '=', 'latest.product_id')
          .on('price.branch_id', '=', 'latest.branch_id')
          .on('price.time', '=', 'latest.max_time')
    })
    .join('products', 'products.id', 'price.product_id')
    .select(
      'price.id as price_id',
      'price.product_id',
      'price.price',
      'price.date_time',
      'price.branch_id',
      'price.es_oferta',
      'price.confiabilidad',
      'price.notas',
      'price.url',
      'price.time',
      'products.name as product_name'
    )

  console.log(`[recrear_price_today] Precios vigentes a regenerar: ${precios.length}`)

  let insertados = 0
  let actualizados = 0

  for (const p of precios) {
    const existe = await knex('price_today')
      .where({ product_id: p.product_id, branch_id: p.branch_id })
      .first()

    if (!existe) {
      await knex('price_today').insert({
        id: uuid.v7(),
        product_id: p.product_id,
        price: p.price,
        date_time: p.date_time,
        branch_id: p.branch_id,
        es_oferta: p.es_oferta,
        confiabilidad: p.confiabilidad,
        notas: p.notas,
        url: p.url,
        time: p.time,
        product_name: p.product_name,
        price_id: p.price_id
      })
      insertados++
    } else {
      await knex('price_today')
        .where({ product_id: p.product_id, branch_id: p.branch_id })
        .update({
          price: p.price,
          date_time: p.date_time,
          es_oferta: p.es_oferta,
          confiabilidad: p.confiabilidad,
          notas: p.notas,
          url: p.url,
          time: p.time,
          product_name: p.product_name,
          price_id: p.price_id
        })
      actualizados++
    }
  }

  console.log(`[recrear_price_today] Insertados: ${insertados}, actualizados: ${actualizados}`)
  console.log('[recrear_price_today] Regeneración completada.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[recrear_price_today] ERROR:', err)
  process.exit(1)
})