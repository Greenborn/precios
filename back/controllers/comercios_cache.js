// Actualización incremental de los diccionarios de comercios y sucursales en memoria
// (branchs_diccio, enterprice_diccio, branch_enterprice_diccio), con la misma forma que
// genera regenerar_diccionarios (server.js): claves numéricas y filas completas de la base.
const baja_datos = require('./baja_datos_usuario')
const precios_negocio = require('./precios_negocio')

// Debe llamarse DESPUÉS de confirmar la transacción. Relee las filas: lo que ya no existe
// se quita de memoria. Si se indica branch_id, su comercio se toma de la fila.
// Nunca lanza: el cambio ya está guardado y no debe responderse como fallido.
async function sincronizar_comercio(knex, { branch_id, enterprise_id } = {}) {
  try {
    let local = null
    if (branch_id != null) local = await knex('branch').where({ id: branch_id }).first()

    // Comercio anterior (baja o cambio de comercio) y el actual del local
    const comercios = new Set([enterprise_id, local?.enterprise_id].filter((e) => e != null).map(Number))
    for (const eid of comercios) {
      const comercio = await knex('enterprice').where({ id: eid }).first()
      if (!comercio) {
        baja_datos.quitar_comercio(eid)
        continue
      }
      global.enterprice_diccio[eid] = comercio
      if (!global.branch_enterprice_diccio[eid]) global.branch_enterprice_diccio[eid] = []
    }

    if (branch_id == null) return
    // Se quita antes de volver a agregar: evita duplicados en las listas
    baja_datos.quitar_local(branch_id)
    if (!local) return

    global.branchs_diccio[Number(local.id)] = local
    // El local "sin local" resuelve su comercio, pero no integra la lista pública de locales
    const lista = global.branch_enterprice_diccio[Number(local.enterprise_id)]
    if (lista && !local.sin_local) {
      global.branch_enterprice_diccio[Number(local.enterprise_id)] =
        [...lista, local].sort((a, b) => Number(a.id) - Number(b.id))
    }
    // quitar_local también lo saca del conjunto de negocios
    if (local.propietario_id != null) precios_negocio.marcar(local.id, true)
  } catch (error) {
    console.error(`[comercios_cache] No se pudo actualizar local ${branch_id} / comercio ${enterprise_id}`, error)
  }
}

module.exports = { sincronizar_comercio }
