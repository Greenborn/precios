// Adaptador de express-greenborn-locales sobre las tablas existentes:
//   local  -> branch (address, city, latitude, longitude, branch_name)
//   negocio del local -> enterprice (cada local nuevo crea su enterprice con el mismo nombre)
// Además: código identificador único por local nuevo y control de duplicados.
const crypto = require('crypto')

// Sin caracteres ambiguos (0/O, 1/I)
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generar_codigo() {
  const bytes = crypto.randomBytes(8)
  let codigo = 'LOC-'
  for (let i = 0; i < 8; i++) codigo += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length]
  return codigo
}

// Fila de branch -> forma que espera el paquete (campos del esquema de locales)
function aPaquete(fila) {
  if (!fila) return null
  return {
    id: Number(fila.id),
    propietario_id: fila.propietario_id == null ? null : Number(fila.propietario_id),
    codigo: fila.codigo || null,
    nombre: fila.branch_name || null,
    calle: fila.address || null,
    numero: null,
    ciudad: fila.city || null,
    latitud: fila.latitude == null ? null : Number(fila.latitude),
    longitud: fila.longitude == null ? null : Number(fila.longitude),
    mapa_url: null,
    publicado: !!fila.publicado,
  }
}

// Cambios del paquete -> columnas de branch
function aColumnas(datos = {}) {
  const cols = {}
  if ('nombre' in datos) cols.branch_name = datos.nombre || null
  if ('calle' in datos || 'numero' in datos) {
    cols.address = [datos.calle, datos.numero].filter((v) => v != null && String(v).trim() !== '').join(' ') || null
  }
  if ('ciudad' in datos) cols.city = datos.ciudad || null
  if ('latitud' in datos) cols.latitude = datos.latitud ?? null
  if ('longitud' in datos) cols.longitude = datos.longitud ?? null
  if ('publicado' in datos) cols.publicado = !!datos.publicado
  if ('propietario_id' in datos) cols.propietario_id = datos.propietario_id
  return cols
}

function createLocalesRepoBranch(knex) {
  const base = () => knex('branch')

  async function codigo_unico() {
    for (let i = 0; i < 10; i++) {
      const codigo = generar_codigo()
      const existe = await base().where({ codigo }).first()
      if (!existe) return codigo
    }
    throw new Error('No se pudo generar un código de local único')
  }

  return {
    async listarPorPropietario(userId) {
      const filas = await base().where({ propietario_id: userId }).orderBy('id')
      return filas.map(aPaquete)
    },
    async obtener(id) {
      return aPaquete(await base().where({ id }).first())
    },
    async crear(datos) {
      const cols = aColumnas(datos)
      const codigo = await codigo_unico()
      const nuevoId = await knex.transaction(async (trx) => {
        const [enterpriseId] = await trx('enterprice').insert({
          name: cols.branch_name,
          active: true,
        })
        const [id] = await trx('branch').insert({
          ...cols,
          enterprise_id: Number(enterpriseId),
          codigo,
          publicado: !!cols.publicado,
        })
        return Number(id)
      })
      return aPaquete(await base().where({ id: nuevoId }).first())
    },
    async actualizar(id, cambios) {
      const cols = aColumnas(cambios)
      await knex.transaction(async (trx) => {
        const fila = await trx('branch').where({ id }).first()
        if (!fila) return
        if (Object.keys(cols).length) await trx('branch').where({ id }).update(cols)
        // El nombre del local es también el nombre del comercio creado con él
        if ('branch_name' in cols && fila.enterprise_id) {
          await trx('enterprice').where({ id: fila.enterprise_id }).update({ name: cols.branch_name })
        }
      })
      return aPaquete(await base().where({ id }).first())
    },
    async eliminar(id) {
      return knex.transaction(async (trx) => {
        const fila = await trx('branch').where({ id }).first()
        if (!fila) return false
        await trx('articulo_fotos').where({ branch_id: id }).del()
        await trx('branch').where({ id }).del()
        // Si el comercio ya no tiene locales, se quita junto con el local
        const quedan = await trx('branch').where({ enterprise_id: fila.enterprise_id }).first()
        if (!quedan && fila.enterprise_id) {
          await trx('enterprice').where({ id: fila.enterprise_id }).del()
        }
        return true
      })
    },
    async listarPublicados({ ciudad } = {}) {
      const q = base().where({ publicado: true }).orderBy('id')
      if (ciudad) q.where('city', ciudad)
      return (await q).map(aPaquete)
    },
  }
}

// Middleware de control de duplicados para alta y edición de locales.
// Un local es duplicado si ya existe otro con el mismo nombre, dirección y ciudad
// (sin distinguir mayúsculas), o si el nombre coincide con un comercio existente.
// Los locales nuevos reciben además un código único (ver createLocalesRepoBranch).
function createValidarLocalDuplicado(knex) {
  return function validarLocalDuplicado(req, res, next) {
    (async () => {
      const actual = req.params?.id ? await knex('branch').where({ id: req.params.id }).first() : null
      if (req.params?.id && !actual) return next()
      // Edición de un local ajeno: el router del paquete responde 403; no se consulta nada más
      if (actual && String(actual.propietario_id) !== String(req.user?.id)) return next()

      const body = req.body || {}
      const merged = { ...(actual ? aPaquete(actual) : {}), ...body }
      const nombre = String(merged.nombre || '').trim()
      if (!nombre) return next()

      const calle = String(merged.calle || '').trim()
      const numero = String(merged.numero || '').trim()
      const direccion = [calle, numero].filter(Boolean).join(' ').toLowerCase()
      const ciudad = String(merged.ciudad || '').trim().toLowerCase()

      const excluirBranch = actual ? actual.id : 0
      const excluirEnterprise = actual ? actual.enterprise_id : 0

      const comercio = await knex('enterprice')
        .whereRaw('LOWER(name) = ?', [nombre.toLowerCase()])
        .whereNot('id', excluirEnterprise)
        .first()
      if (comercio) {
        return res.status(409).json({ error: 'Ya existe un comercio con ese nombre' })
      }

      const local = await knex('branch')
        .whereRaw('LOWER(branch_name) = ?', [nombre.toLowerCase()])
        .whereRaw("LOWER(COALESCE(address, '')) = ?", [direccion])
        .whereRaw("LOWER(COALESCE(city, '')) = ?", [ciudad])
        .whereNot('id', excluirBranch)
        .first()
      if (local) {
        return res.status(409).json({ error: 'Ya existe un local con ese nombre y dirección' })
      }
      next()
    })().catch(next)
  }
}

module.exports = { createLocalesRepoBranch, createValidarLocalDuplicado, aPaquete, generar_codigo }
