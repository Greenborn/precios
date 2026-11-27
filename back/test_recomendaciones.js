/**
 * Test: reglas de acceso y de datos
 * - Solo administradores otorgan roles y permisos.
 * - Buscador e info_comercio devuelven solo campos publicos de branch.
 * - Local "sin local": nombre generico, y la carga comunitaria no lo elige.
 * - Locales de negocio: cada escritura resincroniza desde `price`.
 * - Endpoints con clave: se rechazan sin KEY_INT o sin clave.
 * - Migraciones de price_today.price y de nombres "sin local".
 *
 * Usa los routers, helpers y migraciones reales sobre SQLite en memoria (node:sqlite).
 * sso esta simulado. No requiere base de datos.
 *
 * Uso: node back/test_recomendaciones.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const express = require('express')
const { DatabaseSync } = require('node:sqlite')
const Knex = require('knex')
const ClienteMysql = require('knex/lib/dialects/mysql2')

// ---------- knex sobre SQLite en memoria ----------
const db = new DatabaseSync(':memory:')
class ClienteMemoria extends ClienteMysql {
    _driver() { return {} }
    async acquireRawConnection() { return {} }
    async destroyRawConnection() {}
    validateConnection() { return true }
    async _query(conexion, obj) {
        const args = (obj.bindings || []).map((v) => (v instanceof Date ? v.toISOString() : v === undefined ? null : typeof v === 'boolean' ? Number(v) : v))
        const sentencia = db.prepare(obj.sql)
        if (/^\s*select/i.test(obj.sql)) obj.response = [sentencia.all(...args).map((f) => ({ ...f })), []]
        else {
            const r = sentencia.run(...args)
            obj.response = [{ insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) }, []]
        }
        return obj
    }
}
global.knex = Knex({ client: ClienteMemoria, connection: {}, pool: { min: 0, max: 1 } })

const ADMIN_EMAIL = 'admin@ejemplo.com'
const archivo_sso = require.resolve('./sso')
require.cache[archivo_sso] = { id: archivo_sso, filename: archivo_sso, loaded: true, exports: { ADMIN_EMAIL, requirePermission: () => (q, s, n) => n() } }

const COLUMNAS_PRECIO = 'product_id TEXT, branch_id INTEGER, price REAL, date_time TEXT, time TEXT, es_oferta INTEGER, confiabilidad INTEGER, notas TEXT, url TEXT, user_id INTEGER, user_nombre TEXT, user_apellido TEXT'
db.exec(`
CREATE TABLE price (id TEXT PRIMARY KEY, ${COLUMNAS_PRECIO});
CREATE TABLE price_today (id TEXT PRIMARY KEY, price_id TEXT, product_name TEXT, ${COLUMNAS_PRECIO});
CREATE TABLE precios_negocio (id TEXT PRIMARY KEY, usuario_id INTEGER, product_id TEXT, branch_id INTEGER, price REAL, date_time TEXT, notas TEXT, creado_el TEXT, actualizado_el TEXT);
CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE product_category (product_id TEXT, category_id INTEGER);
CREATE TABLE branch_category (branch_id INTEGER, category_id TEXT, creado_el TEXT, actualizado_el TEXT);
CREATE TABLE enterprice (id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE, active INTEGER, website TEXT);
CREATE TABLE branch (id INTEGER PRIMARY KEY, branch_name TEXT, enterprise_id INTEGER, propietario_id INTEGER, codigo TEXT, publicado INTEGER, sin_local INTEGER, address TEXT, city TEXT);
CREATE TABLE usuarios (id INTEGER PRIMARY KEY, name TEXT, apellido TEXT, email TEXT, pass TEXT, es_negocio INTEGER);
CREATE TABLE usuarios_roles (usuario_id INTEGER, rol_id INTEGER);
CREATE TABLE roles_permisos (rol_id INTEGER, permiso_id INTEGER);
CREATE TABLE roles (id INTEGER PRIMARY KEY, nombre TEXT, descripcion TEXT);
CREATE TABLE permisos (id INTEGER PRIMARY KEY, nombre TEXT, descripcion TEXT);
CREATE TABLE perfiles (usuario_id INTEGER, nombre_comercial TEXT);
INSERT INTO roles VALUES (1, 'administrador', ''), (2, 'editor', '');
INSERT INTO permisos VALUES (1, 'alias.ver', '');
INSERT INTO products VALUES ('p1', 'Arroz');
`)

for (const k of ['precios_diccio', 'branchs_diccio', 'enterprice_diccio', 'branch_enterprice_diccio', 'products_diccio', 'products_diccio_id', 'alias_busqueda']) global[k] = {}
global.products_category_diccio = { by_product_id: { p1: [5] }, by_category_id: {} }

const buscador = require('./controllers/busqueda_productos')
const precios_negocio = require('./controllers/precios_negocio')
const { aplicar_precio } = require('./controllers/sincronizacion_precios')
const { obtener_o_crear_local_sin_local } = require('./helpers/locales_branch')
const router_productos = require('./routes/productos')

// ---------- servidor de prueba: la sesion llega por cabecera ----------
const app = express()
app.use(express.json())
app.use((req, res, next) => {
    const rol = req.get('x-test-rol')
    req.session = { u_data: { id: 50, email: 'otro@ejemplo.com', roles: rol ? [rol] : [] } }
    next()
})
app.use('/rbac', require('./routes/rbac'))
app.use('/user', require('./routes/userAdmin'))
app.use('/busqueda', require('./routes/busqueda'))
app.use('/productos', router_productos)
app.use('/comercios', require('./routes/comercios'))
const servidor = app.listen(0)
const base = `http://127.0.0.1:${servidor.address().port}`

async function pedir(metodo, ruta, cuerpo, rol = 'editor') {
    const r = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-test-rol': rol }, body: cuerpo && JSON.stringify(cuerpo) })
    return r.json()
}
const contar = async (tabla) => (await global.knex(tabla)).length

let fallos = 0
async function caso(nombre, fn) {
    try {
        await fn()
        salida(`OK    ${nombre}`)
    } catch (e) {
        fallos++
        salida(`FAIL  ${nombre}`)
        salida(`      ${String(e.message).split('\n').join('\n      ')}`)
    }
}
const salida = console.log

;(async () => {
    console.log = () => {}

    await caso('no administrador: no asigna roles ni permisos', async () => {
        for (const [ruta, cuerpo] of [
            ['/rbac/asignar_usuario_rol', { id_usuario: 50, id_rol: 1 }],
            ['/rbac/asignar_permiso_rol', { id_rol: 2, id_permiso: 1 }],
            ['/user/add_one', { name: 'X', email: 'x@ejemplo.com', pass: 'p', roles: [1] }],
            ['/user/add_one', { name: 'X', email: 'x@ejemplo.com', pass: 'p', roles: '1' }],
            ['/user/add_one', { name: 'X', email: ADMIN_EMAIL.toUpperCase(), pass: 'p' }],
        ]) {
            const r = await pedir('POST', ruta, cuerpo)
            assert.strictEqual(r.stat, false, `${ruta} ${JSON.stringify(r)}`)
            assert.ok(r.text, ruta)
        }
        assert.strictEqual((await pedir('PUT', '/rbac/editar_rol', { id: 2, nombre: 'administrador' })).stat, false)
        assert.strictEqual((await pedir('PUT', '/rbac/editar_permiso', { id: 1, nombre: 'usuarios.crear' })).stat, false)
        assert.strictEqual((await pedir('PUT', '/user/guardar_config', { email: ADMIN_EMAIL })).stat, false)
        for (const t of ['usuarios', 'usuarios_roles', 'roles_permisos']) assert.strictEqual(await contar(t), 0, t)
        assert.strictEqual((await global.knex('roles').where({ id: 2 }).first()).nombre, 'editor')
    })

    await caso('no administrador: crea usuarios sin roles y edita descripciones', async () => {
        assert.strictEqual((await pedir('POST', '/user/add_one', { name: 'S', email: 's@ejemplo.com', pass: 'p', roles: [] })).stat, true)
        assert.strictEqual((await pedir('PUT', '/rbac/editar_rol', { id: 2, nombre: 'editor', descripcion: 'd' })).stat, true)
        assert.strictEqual(await contar('usuarios_roles'), 0)
    })

    await caso('administrador: asigna roles y permisos; su rol no se renombra', async () => {
        const admin = (m, r, c) => pedir(m, r, c, 'administrador')
        assert.strictEqual((await admin('POST', '/rbac/asignar_usuario_rol', { id_usuario: 50, id_rol: 2 })).stat, true)
        assert.strictEqual((await admin('POST', '/rbac/asignar_permiso_rol', { id_rol: 2, id_permiso: 1 })).stat, true)
        assert.strictEqual((await admin('POST', '/user/add_one', { name: 'A', email: 'a@ejemplo.com', pass: 'p', roles: [2] })).stat, true)
        assert.strictEqual((await admin('PUT', '/rbac/editar_rol', { id: 1, nombre: 'jefe' })).stat, false)
        assert.strictEqual(await contar('usuarios_roles'), 2)
    })

    let sin_local
    await caso('sin local: nombre generico, o comercial con sufijo si esta tomado', async () => {
        sin_local = await obtener_o_crear_local_sin_local(global.knex, { id: 1, name: 'Ana', apellido: 'Paz' })
        assert.match(sin_local.branch_name, /^Comercio sin nombre [A-Z2-9]{8}$/)
        await global.knex('enterprice').insert({ name: 'Kiosco' })
        await global.knex('perfiles').insert({ usuario_id: 2, nombre_comercial: ' Kiosco ' })
        const otro = await obtener_o_crear_local_sin_local(global.knex, { id: 2, name: 'Juan' })
        assert.match(otro.branch_name, /^Kiosco \([A-Z2-9]{8}\)$/)
    })

    await caso('carga comunitaria: no elige el local "sin local" y reutiliza el que crea', async () => {
        const a = await router_productos.resolver_comercio_form(sin_local.branch_name.toUpperCase())
        const b = await router_productos.resolver_comercio_form(sin_local.branch_name)
        assert.strictEqual(a.enterprise_id, sin_local.enterprise_id)
        assert.notStrictEqual(a.branch_id, Number(sin_local.id))
        assert.deepStrictEqual(a, b)
        const nuevo = await global.knex('branch').where({ id: a.branch_id }).first()
        assert.strictEqual(nuevo.sin_local, null)
        assert.strictEqual(nuevo.propietario_id, null)
    })

    await caso('buscador e info_comercio: solo campos publicos de branch', async () => {
        const [eid] = await global.knex('enterprice').insert({ name: 'Super', website: 'super.test' })
        const local = { id: 900, branch_name: 'Centro', enterprise_id: eid, propietario_id: 9, codigo: 'LOC-SECRETO', publicado: 0, sin_local: null, address_road: 'Calle', address_number: '1', city: 'Tandil' }
        global.branchs_diccio[900] = local
        global.enterprice_diccio[eid] = { id: eid, name: 'Super' }
        global.branch_enterprice_diccio[eid] = [local]
        buscador.agregar_a_buscador({ product_id: 'p1', product_name: 'Arroz', branch_id: 900, price: 5, date_time: new Date() })
        const r = await pedir('GET', '/busqueda/precios?product_name=arroz')
        assert.deepStrictEqual(r.items[0].locales, [{ id: 900, enterprise_id: eid, branch_name: 'Centro', address_road: 'Calle', address_number: '1', city: 'Tandil' }])
        assert.strictEqual(local.codigo, 'LOC-SECRETO', 'el diccionario no se modifica')
        await global.knex('branch').insert({ id: 900, branch_name: 'Centro', enterprise_id: eid, propietario_id: 9, codigo: 'LOC-SECRETO', publicado: 0 })
        const info = await pedir('GET', '/busqueda/info_comercio?website=super.test')
        assert.strictEqual(info.items.branches.length, 1)
        assert.ok(!/propietario|codigo|publicado|sin_local/.test(JSON.stringify(info)), JSON.stringify(info))
        buscador.eliminar_de_buscador('p1', 900)
    })

    const visibles = (local) => ({
        buscador: buscador.busqueda_ranking('arroz').filter((r) => r.branch_id == local).map((r) => r.price),
        precios: (global.precios_diccio.p1 || []).filter((r) => r.branch_id == local).map((r) => r.price),
    })

    await caso('negocio: una carga antigua se ve y no pisa a una mas nueva', async () => {
        const local = Number(sin_local.id)
        const cargar = (precio, dias) => router_productos.registrar_precio_usuario({ id: 1 }, 'p1', local, precio, new Date(Date.now() - dias * 86400000), 'n')
        assert.ok(await cargar(10, 10))
        assert.deepStrictEqual(visibles(local), { buscador: [10], precios: [10] })
        assert.ok(await cargar(20, 5))
        assert.ok(await cargar(30, 8))
        assert.deepStrictEqual(visibles(local), { buscador: [20], precios: [20] })
        assert.strictEqual(await contar('price_today'), 0)
    })

    await caso('negocio: el precio del importador se relee de price; local comun usa lo recibido', async () => {
        const local = Number(sin_local.id)
        await aplicar_precio({ product_id: 'p1', product_name: 'Arroz', branch_id: String(local), price: 999, date_time: new Date() })
        assert.deepStrictEqual(visibles(local), { buscador: [20], precios: [20] })
        precios_negocio.marcar(901, false)
        await aplicar_precio({ product_id: 'p1', product_name: 'Arroz', branch_id: 901, price: 7, date_time: new Date() })
        assert.deepStrictEqual(visibles(901), { buscador: [7], precios: [7] })
    })

    await caso('la limpieza de price_today tambien alcanza a los negocios', async () => {
        await global.knex('price_today').insert({ id: 'viejo', product_id: 'p2', branch_id: Number(sin_local.id), date_time: '2000-01-01' })
        await router_productos.registrar_precio_usuario({ id: 1 }, 'p1', Number(sin_local.id), 25, new Date(), 'n')
        assert.strictEqual(await global.knex('price_today').where({ id: 'viejo' }).first(), undefined)
    })

    await caso('endpoints con clave: rechazan sin variable o sin clave', async () => {
        const rutas = ['/productos/regenerar_price_today', '/productos/importar', '/productos/importar_oferta', '/productos/importar_alquiler', '/comercios']
        const rechazo = /autenticaci|Error interno/
        const anterior = process.env.KEY_INT
        for (const [env, cuerpo] of [[undefined, {}], [undefined, { key: 'x' }], ['', { key: '' }], ['secreta', {}], ['secreta', { key: 'otra' }], ['secreta', { key: ['secreta'] }]]) {
            if (env === undefined) delete process.env.KEY_INT
            else process.env.KEY_INT = env
            for (const ruta of rutas) {
                const r = await pedir('POST', ruta, cuerpo)
                assert.strictEqual(r.stat, false, `${ruta} ${env} ${JSON.stringify(cuerpo)}`)
                assert.match(r.error, rechazo)
            }
        }
        process.env.KEY_INT = 'secreta'
        assert.strictEqual((await pedir('POST', '/productos/importar', { key: 'secreta', lst_importa: [] })).error, 'No hay items para importar')
        if (anterior === undefined) delete process.env.KEY_INT
        else process.env.KEY_INT = anterior
    })

    await caso('migracion price_today: convierte solo si hace falta', async () => {
        const migracion = require('./migrations/20261127130000_price_today_price_decimal')
        for (const [columna, alter] of [[{ tipo: 'float', precision_n: 12, escala: null }, 1], [{ tipo: 'decimal', precision_n: 10, escala: 2 }, 0]]) {
            const sentencias = []
            await migracion.up({ raw: async (sql) => { sentencias.push(sql.trim()); return [[columna]] } })
            assert.strictEqual(sentencias.filter((s) => s.startsWith('ALTER')).length, alter)
            assert.strictEqual(sentencias.filter((s) => s.startsWith('UPDATE')).length, 1)
        }
    })

    await caso('migracion sin local: renombra solo los generados con el nombre del usuario', async () => {
        db.exec('DELETE FROM branch; DELETE FROM enterprice; DELETE FROM usuarios; DELETE FROM perfiles')
        const casos = [
            // id, nombre del local, usuario, nombre comercial, sin_local
            [1, 'Ana Paz', ['Ana', 'Paz'], null, 1],          // se renombra
            [2, 'Luis Rey', ['Luis', 'Rey'], 'Luis Rey', 1],  // es su nombre comercial
            [3, 'Almacen', ['Eva', 'Sol'], null, 1],          // otro nombre
            [4, 'Raul Gil', ['Raul', 'Gil'], null, null],     // local comun
            [5, 'Sara Luz', ['Sara', 'Luz'], null, 1],        // comercio compartido
            [6, 'Beto', ['Beto', null], 'La Esquina', 1],     // se usa el nombre comercial
        ]
        for (const [id, nombre, [name, apellido], comercial, sl] of casos) {
            await global.knex('usuarios').insert({ id, name, apellido })
            if (comercial) await global.knex('perfiles').insert({ usuario_id: id, nombre_comercial: comercial })
            await global.knex('enterprice').insert({ id, name: nombre })
            await global.knex('branch').insert({ id, branch_name: nombre, enterprise_id: id, propietario_id: id, sin_local: sl })
        }
        await global.knex('branch').insert({ id: 50, branch_name: 'Sara Luz', enterprise_id: 5 })
        const migracion = require('./migrations/20261127140000_branch_sin_local_nombre_generico')
        await migracion.up(global.knex)
        const nombres = async () => (await global.knex('branch').where('id', '<', 50).orderBy('id')).map((b) => b.branch_name)
        const primera = await nombres()
        assert.match(primera[0], /^Comercio sin nombre /)
        assert.deepStrictEqual(primera.slice(1), ['Luis Rey', 'Almacen', 'Raul Gil', 'Sara Luz', 'La Esquina'])
        assert.deepStrictEqual((await global.knex('enterprice').orderBy('id')).map((e) => e.name), primera)
        await migracion.up(global.knex)
        assert.deepStrictEqual(await nombres(), primera)
    })

    console.log = salida
    servidor.close()
    await global.knex.destroy()
    console.log(fallos ? `\n${fallos} caso(s) con fallos` : '\nTodos los casos OK')
    process.exit(fallos ? 1 : 0)
})()
