// Área privada del negocio: locales, perfil y foto (una por artículo) por local.
//   /api/mis-locales, /api/publicos, /api/publico/:id   -> express-greenborn-locales
//   /api/perfil/mi-perfil, /api/perfil/publico/:id       -> express-greenborn-perfil
//   PUT/DELETE /api/negocio/locales/:branchId/articulos/:productId/foto
//   GET        /api/negocio/locales/:branchId/fotos
const express = require('express')
const fs = require('fs')
const path = require('path')
const { createLocalesRouter } = require('@greenborn/express-greenborn-locales')
const { createPerfilRouter, createKnexPerfilRepo, normalizarCampos } = require('@greenborn/express-greenborn-perfil')
const sesion = require('../middleware/SesionUsuario')
const { createLocalesRepoBranch, createValidarLocalDuplicado } = require('../helpers/locales_branch')
const cfg = require('../config/negocio')

const router = express.Router()
const knex = global.knex

// ---------- Locales ----------
const validarDuplicado = createValidarLocalDuplicado(knex)
const localesRepo = createLocalesRepoBranch(knex)

// Alta y edición pasan por el control de duplicados antes del router del paquete
router.post('/mis-locales', sesion, validarDuplicado)
router.put('/mis-locales/:id', sesion, validarDuplicado)
router.use(createLocalesRouter({
  repo: localesRepo,
  auth: sesion,
  camposExtra: cfg.CAMPOS_LOCALES_EXTRA,
  terminos: cfg.TERMINOS_LOCAL,
  propietarioColumn: 'propietario_id',
}))

// ---------- Perfil del negocio ----------
router.use('/perfil', createPerfilRouter({
  repo: createKnexPerfilRepo({
    db: knex,
    table: 'perfiles',
    userColumn: 'usuario_id',
    campos: normalizarCampos(cfg.CAMPOS_PERFIL),
  }),
  auth: sesion,
  campos: cfg.CAMPOS_PERFIL,
  terminos: cfg.TERMINOS_NEGOCIO,
}))

// ---------- Portada y foto de perfil ----------
// GET    /api/negocio/mi-perfil/imagenes          -> { portada_url, foto_url }
// PUT    /api/negocio/mi-perfil/imagen/:tipo      -> body { imagen: dataURL }, tipo = portada | foto
// DELETE /api/negocio/mi-perfil/imagen/:tipo
const TIPOS_IMG_PERFIL = { portada: 'portada_archivo', foto: 'foto_archivo' }

function url_perfil_img(archivo) {
  return archivo ? `${cfg.PERFIL_IMG_URL}/${archivo}` : null
}

function borrar_img_perfil(prefijo) {
  if (!fs.existsSync(cfg.PERFIL_IMG_DIR)) return
  for (const f of fs.readdirSync(cfg.PERFIL_IMG_DIR)) {
    if (f.startsWith(prefijo)) fs.unlinkSync(path.join(cfg.PERFIL_IMG_DIR, f))
  }
}

router.get('/negocio/mi-perfil/imagenes', sesion, async (req, res) => {
  try {
    const p = await knex('perfiles').where({ usuario_id: req.user.id }).first('portada_archivo', 'foto_archivo')
    res.json({ portada_url: url_perfil_img(p?.portada_archivo), foto_url: url_perfil_img(p?.foto_archivo) })
  } catch (err) {
    console.error('[negocio] GET imagenes perfil', err)
    res.status(500).json({ error: 'No se pudieron obtener las imágenes' })
  }
})

router.put('/negocio/mi-perfil/imagen/:tipo', sesion, async (req, res) => {
  try {
    const columna = TIPOS_IMG_PERFIL[req.params.tipo]
    if (!columna) return res.status(400).json({ error: 'Tipo de imagen inválido' })
    const m = DATA_URL_IMAGEN.exec(String(req.body?.imagen || ''))
    if (!m) return res.status(400).json({ error: 'La imagen debe ser JPG, PNG o WEBP' })
    const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64')
    if (!buf.length) return res.status(400).json({ error: 'La imagen está vacía' })
    if (buf.length > cfg.PERFIL_IMG_MAX_BYTES) return res.status(413).json({ error: 'La imagen supera el máximo de 3 MB' })
    const ext = detectar_tipo_imagen(buf)
    if (!ext) return res.status(400).json({ error: 'El archivo no es una imagen JPG, PNG o WEBP válida' })

    fs.mkdirSync(cfg.PERFIL_IMG_DIR, { recursive: true })
    const prefijo = `${req.user.id}_${req.params.tipo}.`
    borrar_img_perfil(prefijo)
    // Nombre con marca de tiempo para evitar caché del navegador al reemplazar
    const archivo = `${req.user.id}_${req.params.tipo}.${Date.now()}.${ext}`
    fs.writeFileSync(path.join(cfg.PERFIL_IMG_DIR, archivo), buf)

    const existe = await knex('perfiles').where({ usuario_id: req.user.id }).first('id')
    if (existe) await knex('perfiles').where({ usuario_id: req.user.id }).update({ [columna]: archivo })
    else await knex('perfiles').insert({ usuario_id: req.user.id, [columna]: archivo })

    res.json({ url: url_perfil_img(archivo) })
  } catch (err) {
    console.error('[negocio] PUT imagen perfil', err)
    res.status(500).json({ error: 'No se pudo guardar la imagen' })
  }
})

router.delete('/negocio/mi-perfil/imagen/:tipo', sesion, async (req, res) => {
  try {
    const columna = TIPOS_IMG_PERFIL[req.params.tipo]
    if (!columna) return res.status(400).json({ error: 'Tipo de imagen inválido' })
    borrar_img_perfil(`${req.user.id}_${req.params.tipo}.`)
    await knex('perfiles').where({ usuario_id: req.user.id }).update({ [columna]: null })
    res.json({ ok: true })
  } catch (err) {
    console.error('[negocio] DELETE imagen perfil', err)
    res.status(500).json({ error: 'No se pudo quitar la imagen' })
  }
})

// ---------- Foto por artículo (una por local + artículo) ----------
const ID_PRODUCTO = /^[A-Za-z0-9-]{1,36}$/
const DATA_URL_IMAGEN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/

// Detecta el tipo real por firma binaria (no confía en el tipo declarado)
function detectar_tipo_imagen(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  return null
}

function prefijo_foto(branchId, productId) {
  return `${branchId}_${productId}.`
}

// Borra cualquier foto previa del par (local, artículo), sin importar su extensión
function borrar_fotos_previas(prefijo) {
  if (!fs.existsSync(cfg.FOTOS_DIR)) return
  for (const f of fs.readdirSync(cfg.FOTOS_DIR)) {
    if (f.startsWith(prefijo)) fs.unlinkSync(path.join(cfg.FOTOS_DIR, f))
  }
}

// Valida que el identificador sea un local del usuario autenticado
async function localPropio(req, res) {
  const branchId = Number(req.params.branchId)
  if (!Number.isInteger(branchId) || branchId <= 0) {
    res.status(400).json({ error: 'Identificador de local inválido' })
    return null
  }
  const local = await knex('branch').where({ id: branchId }).first()
  if (!local || String(local.propietario_id) !== String(req.user.id)) {
    res.status(403).json({ error: 'El local no pertenece a tu cuenta' })
    return null
  }
  return { branchId, local }
}

router.get('/negocio/locales/:branchId/fotos', sesion, async (req, res) => {
  try {
    const propio = await localPropio(req, res)
    if (!propio) return
    const filas = await knex('articulo_fotos').where({ branch_id: propio.branchId }).select('product_id', 'archivo')
    res.json(filas.map((f) => ({ product_id: f.product_id, url: `${cfg.FOTOS_URL}/${f.archivo}` })))
  } catch (err) {
    console.error('[negocio] GET fotos', err)
    res.status(500).json({ error: 'No se pudieron obtener las fotos' })
  }
})

router.put('/negocio/locales/:branchId/articulos/:productId/foto', sesion, async (req, res) => {
  try {
    const propio = await localPropio(req, res)
    if (!propio) return
    const { productId } = req.params
    if (!ID_PRODUCTO.test(productId)) return res.status(400).json({ error: 'Identificador de artículo inválido' })

    const producto = await knex('products').where({ id: productId }).first()
    if (!producto) return res.status(404).json({ error: 'Artículo no encontrado' })

    const m = DATA_URL_IMAGEN.exec(String(req.body?.imagen || ''))
    if (!m) return res.status(400).json({ error: 'La imagen debe ser JPG, PNG o WEBP' })
    const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64')
    if (!buf.length) return res.status(400).json({ error: 'La imagen está vacía' })
    if (buf.length > cfg.FOTO_MAX_BYTES) return res.status(413).json({ error: 'La foto supera el máximo de 2 MB' })

    const ext = detectar_tipo_imagen(buf)
    if (!ext) return res.status(400).json({ error: 'El archivo no es una imagen JPG, PNG o WEBP válida' })

    fs.mkdirSync(cfg.FOTOS_DIR, { recursive: true })
    const prefijo = prefijo_foto(propio.branchId, productId)
    borrar_fotos_previas(prefijo)
    const archivo = prefijo + ext
    fs.writeFileSync(path.join(cfg.FOTOS_DIR, archivo), buf)

    // Una sola foto por (local, artículo): la nueva reemplaza a la anterior
    await knex('articulo_fotos')
      .insert({ branch_id: propio.branchId, product_id: productId, archivo, user_id: req.user.id })
      .onConflict(['branch_id', 'product_id'])
      .merge({ archivo, user_id: req.user.id, updated_at: knex.fn.now() })

    res.json({ product_id: productId, url: `${cfg.FOTOS_URL}/${archivo}` })
  } catch (err) {
    console.error('[negocio] PUT foto', err)
    res.status(500).json({ error: 'No se pudo guardar la foto' })
  }
})

router.delete('/negocio/locales/:branchId/articulos/:productId/foto', sesion, async (req, res) => {
  try {
    const propio = await localPropio(req, res)
    if (!propio) return
    const { productId } = req.params
    if (!ID_PRODUCTO.test(productId)) return res.status(400).json({ error: 'Identificador de artículo inválido' })

    borrar_fotos_previas(prefijo_foto(propio.branchId, productId))
    await knex('articulo_fotos').where({ branch_id: propio.branchId, product_id: productId }).del()
    res.status(204).end()
  } catch (err) {
    console.error('[negocio] DELETE foto', err)
    res.status(500).json({ error: 'No se pudo eliminar la foto' })
  }
})

// ---------- Mis precios (listado privado) ----------
//   GET /api/negocio/mis-precios?limit&offset -> último precio por producto y local propios
router.get('/negocio/mis-precios', sesion, async (req, res) => {
  try {
    const locales = await knex('branch').where({ propietario_id: req.user.id }).orderBy('id').select('id', 'branch_name')
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200)
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
    const branchIds = locales.map((l) => l.id)
    if (!branchIds.length) return res.json({ total: 0, limit, offset, items: [] })

    const nombres = new Map(locales.map((l) => [String(l.id), l.branch_name]))
    const base = require('../controllers/precios_negocio').consulta_ultimos_precios(knex, branchIds)
    const [{ n: total }] = await knex.count('* as n').from(base.clone().as('t'))
    const filas = await base.clone()
      .orderBy('products.name').orderBy('price.branch_id').orderBy('price.id')
      .limit(limit).offset(offset)

    res.json({
      total: Number(total), limit, offset,
      items: filas.map((f) => ({
        producto_id: f.product_id,
        producto: f.product_name,
        precio: Number(f.price),
        fecha: f.date_time,
        local_id: Number(f.branch_id),
        local: nombres.get(String(f.branch_id)) || null,
      })),
    })
  } catch (err) {
    console.error('[negocio] GET mis-precios', err)
    res.status(500).json({ error: 'No se pudieron obtener los precios' })
  }
})

// ---------- Ficha pública del negocio (sin login) ----------
//   GET /api/negocio/publico/:perfilId/locales                -> locales publicados del negocio
//   GET /api/negocio/publico/:perfilId/productos?limit&offset -> último precio por producto y local
// :perfilId es perfiles.id (la misma clave que /api/perfil/publico/:id).
// Solo datos públicos: nunca user_id, user_nombre, user_apellido ni emails.
const precios_negocio = require('../controllers/precios_negocio')
const LIMITE_PRODUCTOS_DEFAULT = 50
const LIMITE_PRODUCTOS_MAX = 200

// Resuelve el perfil público al usuario dueño; null si no existe
async function dueno_de_perfil(req, res) {
  const perfilId = Number(req.params.perfilId)
  if (!Number.isInteger(perfilId) || perfilId <= 0) {
    res.status(400).json({ error: 'Identificador de negocio inválido' })
    return null
  }
  const perfil = await knex('perfiles').where({ id: perfilId }).first('usuario_id')
  if (!perfil) {
    res.status(404).json({ error: 'negocio no encontrado' })
    return null
  }
  return perfil.usuario_id
}

// Locales publicados del dueño: { id, nombre, calle, ciudad, latitud, longitud }
async function locales_publicos(usuarioId) {
  const filas = await knex('branch')
    .where({ propietario_id: usuarioId, publicado: true })
    .orderBy('id')
    .select('id', 'branch_name', 'address', 'city', 'latitude', 'longitude')
  return filas.map((f) => ({
    id: Number(f.id),
    nombre: f.branch_name || null,
    calle: f.address || null,
    ciudad: f.city || null,
    latitud: f.latitude == null ? null : Number(f.latitude),
    longitud: f.longitude == null ? null : Number(f.longitude),
  }))
}

router.get('/negocio/publico/:perfilId/imagenes', async (req, res) => {
  try {
    const perfilId = Number(req.params.perfilId)
    if (!Number.isInteger(perfilId) || perfilId <= 0) return res.status(400).json({ error: 'Identificador de negocio inválido' })
    const p = await knex('perfiles').where({ id: perfilId }).first('portada_archivo', 'foto_archivo')
    if (!p) return res.status(404).json({ error: 'negocio no encontrado' })
    res.json({ portada_url: url_perfil_img(p.portada_archivo), foto_url: url_perfil_img(p.foto_archivo) })
  } catch (err) {
    console.error('[negocio] GET imagenes publicas', err)
    res.status(500).json({ error: 'No se pudieron obtener las imágenes' })
  }
})

router.get('/negocio/publico/:perfilId/locales', async (req, res) => {
  try {
    const usuarioId = await dueno_de_perfil(req, res)
    if (usuarioId == null) return
    res.json(await locales_publicos(usuarioId))
  } catch (err) {
    console.error('[negocio] GET publico locales', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

router.get('/negocio/publico/:perfilId/productos', async (req, res) => {
  try {
    const usuarioId = await dueno_de_perfil(req, res)
    if (usuarioId == null) return

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || LIMITE_PRODUCTOS_DEFAULT, 1), LIMITE_PRODUCTOS_MAX)
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)

    const locales = await locales_publicos(usuarioId)
    const nombres = new Map(locales.map((l) => [String(l.id), l.nombre]))
    const branchIds = locales.map((l) => l.id)
    if (!branchIds.length) return res.json({ total: 0, limit, offset, items: [] })

    const base = precios_negocio.consulta_ultimos_precios(knex, branchIds)
    const [{ n: total }] = await knex.count('* as n').from(base.clone().as('t'))
    const filas = await base.clone()
      .orderBy('products.name')
      .orderBy('price.branch_id')
      .orderBy('price.id')
      .limit(limit)
      .offset(offset)

    // Foto del artículo por (local, artículo), solo de las filas de esta página
    const productIds = [...new Set(filas.map((f) => f.product_id))]
    const fotos = productIds.length
      ? await knex('articulo_fotos').whereIn('branch_id', branchIds).whereIn('product_id', productIds).select('branch_id', 'product_id', 'archivo')
      : []
    const fotoPor = new Map(fotos.map((f) => [`${f.branch_id}|${f.product_id}`, `${cfg.FOTOS_URL}/${f.archivo}`]))

    res.json({
      total: Number(total),
      limit,
      offset,
      items: filas.map((f) => ({
        producto_id: f.product_id,
        producto: f.product_name,
        precio: Number(f.price),
        fecha: f.date_time,
        hora: f.time,
        es_oferta: !!f.es_oferta,
        local_id: Number(f.branch_id),
        local: nombres.get(String(f.branch_id)) || null,
        foto_url: fotoPor.get(`${f.branch_id}|${f.product_id}`) || null,
      })),
    })
  } catch (err) {
    console.error('[negocio] GET publico productos', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
