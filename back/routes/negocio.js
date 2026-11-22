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

module.exports = router
