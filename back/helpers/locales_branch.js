// Adaptador de express-greenborn-locales sobre las tablas existentes:
//   local  -> branch (address, city, latitude, longitude, branch_name)
//   negocio del local -> enterprice (cada local nuevo crea su enterprice con el mismo nombre)
// Además: código identificador único por local nuevo y control de duplicados.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const cfg = require('../config/negocio')
const baja_datos = require('../controllers/baja_datos_usuario')
const precios_negocio = require('../controllers/precios_negocio')
const { sincronizar_comercio } = require('../controllers/comercios_cache')

// Sin caracteres ambiguos (0/O, 1/I)
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Tablas con filas propias de un local (columna branch_id), que se borran junto con él.
// price_today va primero: tiene FK RESTRICT hacia branch.
// `promociones` (archivo histórico de ofertas importadas) se conserva.
const TABLAS_DEL_LOCAL = [
  'price_today',
  'price',
  'precios_negocio',
  'promociones_hoy',
  'estadistica_aumento_diario',
  'branch_category',
  'articulo_fotos',
]

// Archivos de fotos de artículos del local (`<branch_id>_<product_id>.<ext>`).
// Nunca lanza: la baja ya está confirmada.
function borrar_fotos_local(branch_id) {
  try {
    if (!fs.existsSync(cfg.FOTOS_DIR)) return
    for (const f of fs.readdirSync(cfg.FOTOS_DIR)) {
      if (f.startsWith(`${branch_id}_`)) fs.rmSync(path.join(cfg.FOTOS_DIR, f), { force: true })
    }
  } catch (error) {
    console.error(`[locales_branch] No se pudieron borrar las fotos del local ${branch_id}`, error)
  }
}

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
  // `publicado` no se toca desde los endpoints del usuario (siempre true al crear; sólo admin lo cambia)
  if ('propietario_id' in datos) cols.propietario_id = datos.propietario_id
  return cols
}

function nombre_generico() {
  return `Comercio sin nombre ${generar_codigo().slice(4)}`
}

// enterprice.name es unico: si el nombre comercial ya esta tomado se le agrega un sufijo
async function nombre_comercio_libre(knex, nombre_comercial) {
  let nombre = nombre_comercial || nombre_generico()
  for (let i = 0; i < 10; i++) {
    if (!(await knex('enterprice').where({ name: nombre }).first())) return nombre
    nombre = nombre_comercial ? `${nombre_comercial} (${generar_codigo().slice(4)})` : nombre_generico()
  }
  throw new Error('No se pudo generar un nombre de comercio único')
}

// Local "sin local" del usuario: se crea una sola vez (branch con sin_local = 1 y su enterprice)
// y se reutiliza en envíos posteriores. Nombre = nombre comercial del perfil o, si no está
// definido, uno genérico (nunca el nombre y apellido del usuario). No es un local publicable
// (publicado = false).
async function obtener_o_crear_local_sin_local(knex, usuario) {
  const buscar = () => knex('branch').where({ propietario_id: usuario.id, sin_local: 1 }).first()
  const existente = await buscar()
  if (existente) return existente

  const perfil = await knex('perfiles').where({ usuario_id: usuario.id }).first('nombre_comercial')
  // 189 + sufijo " (XXXXXXXX)" = 200, el largo de branch_name
  const nombre_comercial = String(perfil?.nombre_comercial || '').trim().slice(0, 189).trim()
  const nombre = await nombre_comercio_libre(knex, nombre_comercial)

  let codigo = null
  for (let i = 0; i < 10 && !codigo; i++) {
    const candidato = generar_codigo()
    if (!(await knex('branch').where({ codigo: candidato }).first())) codigo = candidato
  }
  if (!codigo) throw new Error('No se pudo generar un código de local único')

  try {
    const id = await knex.transaction(async (trx) => {
      const [enterpriseId] = await trx('enterprice').insert({ name: nombre, active: true })
      const [nuevoId] = await trx('branch').insert({
        branch_name: nombre,
        enterprise_id: Number(enterpriseId),
        propietario_id: usuario.id,
        codigo,
        publicado: false,
        sin_local: 1,
      })
      return Number(nuevoId)
    })
    precios_negocio.marcar(id, true)
    await sincronizar_comercio(knex, { branch_id: id })
    return await knex('branch').where({ id }).first()
  } catch (error) {
    // Carrera con otro envío simultáneo: si ya quedó creado, se usa ese
    const ya_creado = await buscar()
    if (ya_creado) return ya_creado
    throw error
  }
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
      // El local "sin local" (sin_local = 1) no aparece en la lista de locales del usuario
      const filas = await base().where({ propietario_id: userId }).whereNull('sin_local').orderBy('id')
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
          publicado: true,
        })
        return Number(id)
      })
      precios_negocio.marcar(nuevoId, true)
      await sincronizar_comercio(knex, { branch_id: nuevoId })
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
      await sincronizar_comercio(knex, { branch_id: id })
      return aPaquete(await base().where({ id }).first())
    },
    // Baja definitiva: borra también los precios del local (histórico incluido), de
    // cualquier usuario. El control de propiedad lo hace el llamador (router de locales).
    async eliminar(id) {
      let fila = null
      let afectados = null
      const eliminado = await knex.transaction(async (trx) => {
        fila = await trx('branch').where({ id }).first()
        if (!fila) return false
        // Se usa el id de la fila: el recibido llega como texto desde la URL
        const branch_id = fila.id
        afectados = await baja_datos.pares_afectados(trx, null, [branch_id])
        for (const tabla of TABLAS_DEL_LOCAL) await trx(tabla).where({ branch_id }).del()
        await trx('branch').where({ id: branch_id }).del()
        // Si el comercio ya no tiene locales, se quita junto con el local
        const quedan = await trx('branch').where({ enterprise_id: fila.enterprise_id }).first()
        if (!quedan && fila.enterprise_id) {
          await trx('enterprice').where({ id: fila.enterprise_id }).del()
        }
        return true
      })
      if (!eliminado) return false
      // Confirmada la baja: buscador y caches de precios, diccionarios, marca de negocio y fotos
      try {
        await baja_datos.resincronizar(knex, afectados.pares, [fila.id])
      } catch (error) {
        console.error(`[locales_branch] No se pudieron limpiar las caches del local ${fila.id}`, error)
      }
      precios_negocio.marcar(fila.id, false)
      await sincronizar_comercio(knex, { branch_id: fila.id, enterprise_id: fila.enterprise_id })
      borrar_fotos_local(fila.id)
      return true
    },
    async listarPublicados({ ciudad } = {}) {
      // D3: todos los locales se publican; el local interno "sin local" nunca se lista
      const q = base().whereNull('sin_local').orderBy('id')
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

module.exports = { createLocalesRepoBranch, createValidarLocalDuplicado, aPaquete, generar_codigo, obtener_o_crear_local_sin_local }
