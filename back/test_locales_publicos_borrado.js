/**
 * Test: locales públicos de la ficha de negocio y borrado de datos de la cuenta
 *
 * Cubre:
 * - GET /api/negocio/publico/:perfilId/locales: muestra todos los locales del dueño
 *   (también los que tienen publicado = false) sin exponer user_id ni emails.
 * - POST /api/mis-locales: publicado queda en true aunque el body diga false.
 * - DELETE /api/negocio/mi-cuenta/datos: borra locales (incluido el "sin local"),
 *   sus precios y su enterprice, y no toca comercios de otros dueños.
 *
 * Usa un knex falso en memoria y monta el router real de routes/negocio.js sobre
 * express en un puerto efímero. No requiere base de datos.
 *
 * Uso: node back/test_locales_publicos_borrado.js
 * Sale con código distinto de cero si algún caso falla.
 */

const assert = require('assert')
const path = require('path')
const express = require('express')

// ---------- knex falso ----------
const tablas = {}
const cargar = () => JSON.parse(JSON.stringify(tablas))
function reset(datos) {
    for (const k of Object.keys(tablas)) delete tablas[k]
    for (const [k, v] of Object.entries(datos)) tablas[k] = v.map((f) => ({ ...f }))
}

function constructor_builder(nombre) {
    let filtros = []
    let orden = null
    let columnas = null
    const filas = () => (tablas[nombre] || (tablas[nombre] = []))
    const pasa = (f) => filtros.every((fn) => fn(f))
    const b = {
        where(obj) {
            if (typeof obj === 'function') return this
            filtros.push((f) => Object.entries(obj).every(([k, v]) => String(f[k]) === String(v)))
            return this
        },
        whereIn(col, valores) { filtros.push((f) => valores.map(String).includes(String(f[col]))); return this },
        whereNot(col, valor) { filtros.push((f) => String(f[col]) !== String(valor)); return this },
        whereNull(col) { filtros.push((f) => f[col] == null); return this },
        // Sólo los patrones que usa validarLocalDuplicado: LOWER(col) = ? y LOWER(COALESCE(col, '')) = ?
        whereRaw(sql, bindings = []) {
            const m = sql.match(/LOWER\((?:COALESCE\()?(\w+)/)
            if (!m) return this
            const col = m[1]
            const valor = String(bindings[0] ?? '')
            filtros.push((f) => String(f[col] ?? '').toLowerCase() === valor)
            return this
        },
        orderBy(col) { orden = col; return this },
        select(...cols) { columnas = cols; return this },
        async first(...cols) {
            const r = await this.then((x) => x)
            return r[0] ? proyectar(r[0], cols.length ? cols : columnas) : undefined
        },
        async insert(datos) {
            const id = (filas().reduce((m, f) => Math.max(m, Number(f.id) || 0), 0)) + 1
            filas().push({ id, ...datos })
            return [id]
        },
        async update(cambios) {
            let n = 0
            for (const f of filas()) if (pasa(f)) { Object.assign(f, cambios); n++ }
            return n
        },
        async del() {
            const antes = filas().length
            tablas[nombre] = filas().filter((f) => !pasa(f))
            return antes - tablas[nombre].length
        },
        then(ok, ko) {
            let r = filas().filter(pasa)
            if (orden) r = r.slice().sort((a, c) => (a[orden] > c[orden] ? 1 : -1))
            r = r.map((f) => proyectar(f, columnas))
            return Promise.resolve(r).then(ok, ko)
        },
    }
    return b
}
function proyectar(f, cols) {
    if (!cols || !cols.length) return { ...f }
    const o = {}
    for (const c of cols) o[c] = f[c]
    return o
}

const knex_falso = (nombre) => constructor_builder(nombre)
knex_falso.transaction = async (cb) => cb(knex_falso)
global.knex = knex_falso

// Sesión falsa: el usuario llega por cabecera x-test-user
const sesion_falsa = (req, res, next) => {
    const id = Number(req.headers['x-test-user'])
    if (!id) return res.status(401).json({ error: 'sin sesión' })
    req.user = { id }
    req.session = { isLogged: true, u_data: { id, es_negocio: true } }
    next()
}
const ruta_sesion = path.join(__dirname, 'middleware', 'SesionUsuario.js')
require.cache[ruta_sesion] = { id: ruta_sesion, filename: ruta_sesion, loaded: true, exports: sesion_falsa }

const negocio = require('./routes/negocio')

let fallos = 0
function caso(nombre, fn) {
    return Promise.resolve().then(fn).then(
        () => console.log(`OK    ${nombre}`),
        (e) => {
            fallos++
            console.log(`FAIL  ${nombre}`)
            console.log(`      ${String(e.message).split('\n').join('\n      ')}`)
        }
    )
}

const DATOS_BASE = () => ({
    usuarios: [{ id: 1, email: 'dueno@ejemplo.com' }, { id: 2, email: 'otro@ejemplo.com' }],
    perfiles: [{ id: 10, usuario_id: 1, portada_archivo: null, foto_archivo: null }],
    enterprice: [
        { id: 100, name: 'Comercio A', active: true },
        { id: 200, name: 'Comercio B', active: true },
        { id: 300, name: 'Sin local del dueño', active: true },
    ],
    branch: [
        { id: 1, branch_name: 'Local visible', address: 'Calle 1', city: 'Tandil', latitude: null, longitude: null, propietario_id: 1, enterprise_id: 100, codigo: 'LOC-AAAA', publicado: 1 },
        { id: 2, branch_name: 'Local oculto', address: 'Calle 2', city: 'Tandil', latitude: null, longitude: null, propietario_id: 1, enterprise_id: 100, codigo: 'LOC-BBBB', publicado: 0 },
        { id: 3, branch_name: 'Sin local', address: null, city: null, latitude: null, longitude: null, propietario_id: 1, enterprise_id: 300, codigo: null, publicado: 1 },
        { id: 4, branch_name: 'Local de otro', address: 'Calle 9', city: 'Tandil', latitude: null, longitude: null, propietario_id: 2, enterprise_id: 200, codigo: 'LOC-CCCC', publicado: 1 },
    ],
    price: [{ id: 1, user_id: 1, branch_id: 3, product_id: 'P1', price: 10 }, { id: 2, user_id: 2, branch_id: 4, product_id: 'P1', price: 20 }],
    price_today: [{ id: 1, user_id: 1, branch_id: 1, product_id: 'P1', price: 10 }],
    articulo_fotos: [{ id: 1, branch_id: 1, product_id: 'P1', archivo: 'x.jpg', user_id: 1 }],
})

const app = express()
app.use(express.json())
app.use('/api', negocio)
const servidor = app.listen(0)
const base = `http://127.0.0.1:${servidor.address().port}/api`

async function pedir(metodo, ruta, usuario, cuerpo) {
    const r = await fetch(base + ruta, {
        method: metodo,
        headers: { 'content-type': 'application/json', 'x-test-user': String(usuario) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
    const texto = await r.text()
    let json = null
    try { json = JSON.parse(texto) } catch (_) { /* sin cuerpo JSON */ }
    return { status: r.status, json, texto }
}

;(async () => {
    await caso('locales públicos incluye locales con publicado = false', async () => {
        reset(DATOS_BASE())
        const r = await pedir('GET', '/negocio/publico/10/locales')
        assert.strictEqual(r.status, 200)
        const ids = r.json.map((l) => l.id).sort()
        assert.deepStrictEqual(ids, [1, 2, 3])
    })

    await caso('locales públicos no expone user_id, emails ni códigos', async () => {
        reset(DATOS_BASE())
        const r = await pedir('GET', '/negocio/publico/10/locales')
        assert.ok(!/user_id|propietario|email|codigo|dueno@|otro@/.test(r.texto), r.texto)
        for (const l of r.json) {
            assert.deepStrictEqual(Object.keys(l).sort(), ['calle', 'ciudad', 'id', 'latitud', 'longitud', 'nombre'])
        }
    })

    await caso('perfil inexistente responde 404', async () => {
        reset(DATOS_BASE())
        const r = await pedir('GET', '/negocio/publico/999/locales')
        assert.strictEqual(r.status, 404)
    })

    await caso('alta de local: publicado queda en true aunque el body diga false', async () => {
        reset(DATOS_BASE())
        const r = await pedir('POST', '/mis-locales', 1, { nombre: 'Nuevo local', calle: 'Calle 5', ciudad: 'Tandil', publicado: false })
        assert.ok(r.status >= 200 && r.status < 300, `status ${r.status}: ${r.texto}`)
        const nuevo = tablas.branch.find((f) => f.branch_name === 'Nuevo local')
        assert.ok(nuevo, 'debería existir el local nuevo')
        assert.strictEqual(Number(nuevo.publicado), 1)
    })

    await caso('edición de local: el body no puede cambiar publicado', async () => {
        reset(DATOS_BASE())
        const r = await pedir('PUT', '/mis-locales/1', 1, { nombre: 'Local visible', calle: 'Calle 1', ciudad: 'Tandil', publicado: false })
        assert.ok(r.status >= 200 && r.status < 300, `status ${r.status}: ${r.texto}`)
        const local = tablas.branch.find((f) => f.id === 1)
        assert.strictEqual(Number(local.publicado), 1)
    })

    await caso('borrado de datos: quita locales (incluido "sin local"), precios, fotos y enterprice propios', async () => {
        reset(DATOS_BASE())
        const r = await pedir('DELETE', '/negocio/mi-cuenta/datos', 1)
        assert.strictEqual(r.status, 200, r.texto)
        assert.deepStrictEqual(tablas.branch.map((f) => f.id), [4], 'sólo debe quedar el local del otro dueño')
        assert.deepStrictEqual(tablas.price.map((f) => f.user_id), [2])
        assert.strictEqual((tablas.price_today || []).length, 0)
        assert.strictEqual((tablas.articulo_fotos || []).length, 0)
        assert.deepStrictEqual(tablas.enterprice.map((f) => f.id).sort(), [200], 'se borran los comercios propios sin locales')
    })

    await caso('borrado de datos: no borra un comercio que aún tiene locales de otro dueño', async () => {
        reset(DATOS_BASE())
        tablas.branch.push({ id: 5, branch_name: 'Compartido', propietario_id: 2, enterprise_id: 100, publicado: 1 })
        const r = await pedir('DELETE', '/negocio/mi-cuenta/datos', 1)
        assert.strictEqual(r.status, 200, r.texto)
        assert.ok(tablas.enterprice.some((f) => f.id === 100), 'el comercio 100 debe quedar')
    })

    await caso('borrado de datos sin sesión responde 401', async () => {
        reset(DATOS_BASE())
        const r = await pedir('DELETE', '/negocio/mi-cuenta/datos', 0)
        assert.strictEqual(r.status, 401)
        assert.strictEqual(tablas.branch.length, 4)
    })

    servidor.close()
    if (fallos > 0) {
        console.log(`\n${fallos} caso(s) fallaron`)
        process.exit(1)
    }
    console.log('\nTodos los casos pasaron')
    process.exit(0)
})().catch((e) => {
    console.error(e)
    servidor.close()
    process.exit(1)
})
