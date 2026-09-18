// Adapta los nombres de los productos existentes a los alias definidos en la
// tabla alias_busqueda (termino inicial -> termino final).
//
// Para cada definicion:
//   1. Busca productos cuyo nombre (normalizado) coincida con el termino inicial.
//   2. Si existe un producto con el nombre del termino final, los candidatos se
//      fusionan en el (merge: price, price_today, product_category, alias_productos
//      y estadistica_aumento_diario se reapuntan al producto canonico).
//   3. Si no existe, el primer candidato se renombra al termino final y el resto
//      se fusiona en el.
//   4. Garantiza que el termino inicial quede registrado en alias_productos
//      apuntando al producto canonico.
//
// Por defecto hace DRY-RUN (solo muestra que haria).
// Para aplicar cambios: node scripts/adaptar_nombres_alias.js --ejecutar
//
// Uso: node scripts/adaptar_nombres_alias.js [--ejecutar]
require("dotenv").config({ path: '.env' })

// Zona horaria del proceso (Argentina UTC-3), igual que server.js
process.env.TZ = 'America/Argentina/Buenos_Aires'

const utils = require('../helpers/utils')

const EJECUTAR = process.argv.includes('--ejecutar')

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

const stats = {
  definiciones: 0,
  sin_candidatos: 0,
  renombres: 0,
  merges: 0,
  precios_movidos: 0,
  price_today_actualizados: 0,
  price_today_borrados: 0,
  alias_reapuntados: 0,
  aliases_creados: 0,
  categorias_movidas: 0,
  estadisticas_movidas: 0,
  errores: 0
}

function normalizar(texto) {
  // Misma normalizacion que limpiarTexto (usada por los dos caminos de ingestión)
  return utils.limpiarTexto(texto)
}

// Renombra un producto al nombre canonico y actualiza price_today.product_name
async function renombrar_producto(trx, producto, termino) {
  await trx('products').update({ name: termino }).where('id', producto.id)
  const actualizados = await trx('price_today')
    .update({ product_name: termino })
    .where('product_id', producto.id)
  stats.renombres++
  stats.price_today_actualizados += actualizados
  console.log(`   ↻ renombrado "${producto.name}" → "${termino}" (price_today: ${actualizados})`)
}

// Fusiona un producto duplicado en el canonico: mueve precios, price_today,
// categorias, aliases y estadisticas; luego elimina el duplicado.
async function fusionar_producto(trx, duplicado, canonico, termino) {
  // price: sin clave unica por (product_id, branch_id), update directo
  const precios = await trx('price').update({ product_id: canonico.id }).where('product_id', duplicado.id)
  stats.precios_movidos += precios

  // price_today: conservar la fila del canonico cuando existe para la misma sucursal
  const pt_duplicado = await trx('price_today').where('product_id', duplicado.id)
  for (const row of pt_duplicado) {
    const existe_canonico = await trx('price_today')
      .where({ product_id: canonico.id, branch_id: row.branch_id }).first()
    if (existe_canonico) {
      await trx('price_today').where('id', row.id).del()
      stats.price_today_borrados++
    } else {
      await trx('price_today').where('id', row.id).update({ product_id: canonico.id, product_name: termino })
      stats.price_today_actualizados++
    }
  }

  // product_category: reasignar relaciones que el canonico no tenga
  const cats = await trx('product_category').where('product_id', duplicado.id)
  for (const rel of cats) {
    const existe = await trx('product_category')
      .where({ product_id: canonico.id, category_id: rel.category_id }).first()
    if (existe) {
      await trx('product_category').where('id', rel.id).del()
    } else {
      await trx('product_category').where('id', rel.id).update({ product_id: canonico.id })
      stats.categorias_movidas++
    }
  }

  // estadistica_aumento_diario: se conserva el historico bajo el producto canonico
  const estadisticas = await trx('estadistica_aumento_diario')
    .update({ id_producto: canonico.id }).where('id_producto', duplicado.id)
  stats.estadisticas_movidas += estadisticas

  // alias_productos: reapuntar aliases del duplicado al canonico (dedupe por alias)
  const aliases = await trx('alias_productos').where('product_id', duplicado.id)
  for (const a of aliases) {
    const existe = await trx('alias_productos')
      .where({ alias: a.alias, product_id: canonico.id }).first()
    if (existe) {
      await trx('alias_productos').where('alias', a.alias).andWhere('product_id', duplicado.id).del()
    } else {
      await trx('alias_productos').where('alias', a.alias).andWhere('product_id', duplicado.id)
        .update({ product_id: canonico.id })
      stats.alias_reapuntados++
    }
  }

  // eliminar el producto duplicado
  await trx('products').where('id', duplicado.id).del()
  stats.merges++
  console.log(`   ⇄ fusionado "${duplicado.name}" (${duplicado.id}) → "${canonico.name}" (${canonico.id})`)
}

// Garantiza que el termino inicial quede como alias del producto canonico
async function asegurar_alias(trx, alias, canonico) {
  const existe = await trx('alias_productos')
    .where({ alias: alias, product_id: canonico.id }).first()
  if (existe)
    return
  const ya_apuntado = await trx('alias_productos').where('alias', alias).first()
  if (ya_apuntado) {
    await trx('alias_productos').where('alias', alias).update({ product_id: canonico.id })
    stats.alias_reapuntados++
  } else {
    await trx('alias_productos').insert({ alias: alias, product_id: canonico.id })
    stats.aliases_creados++
  }
}

// Mantiene el indice en memoria por nombre normalizado consistente con lo
// aplicado (o simulado), para que definiciones posteriores vean el estado real.
function actualizar_indice(por_nombre, acciones, def) {
  for (const a of acciones) {
    if (a.tipo === 'renombrar') {
      const vieja = por_nombre[def.alias] || []
      por_nombre[def.alias] = vieja.filter(p => p.id !== a.producto.id)
      a.producto.name = def.termino
      if (!por_nombre[def.termino]) por_nombre[def.termino] = []
      por_nombre[def.termino].push(a.producto)
    }
    if (a.tipo === 'fusionar') {
      for (const clave of Object.keys(por_nombre)) {
        por_nombre[clave] = por_nombre[clave].filter(p => p.id !== a.producto.id)
      }
    }
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log(`[adaptar_nombres_alias] Modo: ${EJECUTAR ? 'EJECUTAR (aplica cambios)' : 'DRY-RUN (solo simulación)'}`)
  console.log('='.repeat(70))

  // 1) Definiciones de alias (termino inicial -> termino final)
  const definiciones = await knex('alias_busqueda').select()
  if (!definiciones.length) {
    console.log('[adaptar_nombres_alias] No hay alias definidos en alias_busqueda. Nada que hacer.')
    return
  }

  // Normalizar definiciones y descartar identidades
  const defs = []
  for (const d of definiciones) {
    const alias_n = normalizar(d.alias)
    const termino_n = normalizar(d.termino)
    if (!alias_n || !termino_n || alias_n === termino_n)
      continue
    defs.push({ alias: alias_n, termino: termino_n })
  }
  console.log(`[adaptar_nombres_alias] ${defs.length} definiciones de alias a procesar`)

  // 2) Indice de productos existentes por nombre normalizado
  const productos = await knex('products').select('id', 'name')
  const por_nombre = {}
  for (const p of productos) {
    const n = normalizar(p.name)
    if (!por_nombre[n]) por_nombre[n] = []
    por_nombre[n].push(p)
  }
  console.log(`[adaptar_nombres_alias] ${productos.length} productos indexados`)

  // 3) Procesar cada definicion
  for (const def of defs) {
    stats.definiciones++
    console.log(`\n[${stats.definiciones}/${defs.length}] "${def.alias}" → "${def.termino}"`)

    const candidatos = por_nombre[def.alias] || []
    const existentes = por_nombre[def.termino] || []

    if (!candidatos.length && !existentes.length) {
      stats.sin_candidatos++
      console.log('   - sin productos afectados (el alias aplicará a precios futuros)')
      continue
    }

    // Si el termino final tiene varios productos con el mismo nombre normalizado,
    // el primero es el canonico y el resto son duplicados a fusionar
    const canonico = existentes.length ? existentes[0] : null
    const a_renombrar = (!canonico && candidatos.length) ? candidatos[0] : null
    const a_fusionar = []

    if (a_renombrar) {
      // el primer candidato se renombra y pasa a ser el canonico
      for (const c of candidatos.slice(1)) a_fusionar.push(c)
    } else if (canonico) {
      for (const c of candidatos) {
        if (c.id !== canonico.id) a_fusionar.push(c)
      }
      for (const e of existentes.slice(1)) {
        if (e.id !== canonico.id) a_fusionar.push(e)
      }
    }

    const canonico_ref = canonico || a_renombrar
    const acciones = []
    if (a_renombrar) acciones.push({ tipo: 'renombrar', producto: a_renombrar })
    for (const dup of a_fusionar) acciones.push({ tipo: 'fusionar', producto: dup, canonico: canonico_ref })
    acciones.push({ tipo: 'asegurar_alias', alias: def.alias, canonico: canonico_ref })

    if (!EJECUTAR) {
      for (const a of acciones) {
        if (a.tipo === 'renombrar')
          console.log(`   [dry-run] renombraría "${a.producto.name}" → "${def.termino}"`)
        if (a.tipo === 'fusionar')
          console.log(`   [dry-run] fusionaría "${a.producto.name}" (${a.producto.id}) → "${a.canonico.name}" (${a.canonico.id})`)
        if (a.tipo === 'asegurar_alias')
          console.log(`   [dry-run] garantizaría alias_productos: "${a.alias}" → ${a.canonico.id}`)
      }
      actualizar_indice(por_nombre, acciones, def)
      continue
    }

    try {
      await knex.transaction(async (trx) => {
        for (const a of acciones) {
          if (a.tipo === 'renombrar') await renombrar_producto(trx, a.producto, def.termino)
          if (a.tipo === 'fusionar') await fusionar_producto(trx, a.producto, a.canonico, def.termino)
          if (a.tipo === 'asegurar_alias') await asegurar_alias(trx, a.alias, a.canonico)
        }
      })
      // solo si la transaccion commitó, el indice refleja el nuevo estado
      actualizar_indice(por_nombre, acciones, def)
    } catch (error) {
      stats.errores++
      console.log(`   ✗ ERROR procesando "${def.alias}": ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('[adaptar_nombres_alias] Resumen:')
  console.log(`   Definiciones procesadas:     ${stats.definiciones}`)
  console.log(`   Sin productos afectados:     ${stats.sin_candidatos}`)
  console.log(`   Renombres:                   ${stats.renombres}`)
  console.log(`   Merges (duplicados unidos):  ${stats.merges}`)
  console.log(`   Precios movidos:             ${stats.precios_movidos}`)
  console.log(`   price_today actualizados:    ${stats.price_today_actualizados}`)
  console.log(`   price_today borrados:        ${stats.price_today_borrados}`)
  console.log(`   Alias reapuntados:           ${stats.alias_reapuntados}`)
  console.log(`   Alias creados:               ${stats.aliases_creados}`)
  console.log(`   Categorias movidas:          ${stats.categorias_movidas}`)
  console.log(`   Estadisticas movidas:        ${stats.estadisticas_movidas}`)
  console.log(`   Errores:                     ${stats.errores}`)
  console.log('='.repeat(70))
  if (EJECUTAR && (stats.renombres || stats.merges)) {
    console.log('[adaptar_nombres_alias] Reiniciar el servicio (o regenerar diccionarios)')
    console.log('   para recargar productos_diccio y el buscador en memoria.')
  }
}

main()
  .then(() => knex.destroy())
  .catch(async (error) => {
    console.error('[adaptar_nombres_alias] Error fatal:', error)
    await knex.destroy().catch(() => {})
    process.exit(1)
  })
