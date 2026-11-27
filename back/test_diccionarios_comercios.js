/**
 * Test: actualizacion incremental de los diccionarios de comercios y sucursales
 *
 * Cubre alta, edicion y baja de locales (repositorio de /api/mis-locales), alta del local
 * "sin local" y cambio de `publicado` por el admin: branchs_diccio, enterprice_diccio y
 * branch_enterprice_diccio quedan igual que tras regenerar_diccionarios, sin duplicados y
 * sin exponer el local "sin local" en la lista publica de locales.
 *
 * Usa un knex falso en memoria. No requiere base de datos ni arranca server.js (el armado
 * de regenerar_diccionarios se extrae del archivo como texto).
 *
 * Uso: node back/test_diccionarios_comercios.js
 * Sale con codigo distinto de cero si algun caso falla.
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

// ---------- knex falso ----------
const tablas = {
    branch: [], enterprice: [], perfiles: [], articulo_fotos: [], price_today: [], price: [],
    precios_negocio: [], promociones_hoy: [], estadistica_aumento_diario: [], branch_category: [],
}
let fallar_commit = false

function knex_falso(nombre) {
    const filtros = []
    const filas = () => tablas[nombre]
    const pasa = (f) => filtros.every((fn) => fn(f))
    const b = {
        where(obj) { filtros.push((f) => Object.entries(obj).every(([k, v]) => String(f[k]) === String(v))); return b },
        whereNull(col) { const c = col.split('.').pop(); filtros.push((f) => f[c] == null); return b },
        whereIn(col, vals) { filtros.push((f) => vals.map(String).includes(String(f[col]))); return b },
        orderBy() { return b },
        async select() { return filas().filter(pasa).map((f) => ({ ...f })) },
        async first() { const f = filas().find(pasa); return f ? { ...f } : undefined },
        async insert(datos) {
            const id = filas().reduce((m, f) => Math.max(m, f.id), 0) + 1
            const base = nombre === 'branch' ? { propietario_id: null, sin_local: null } : {}
            filas().push({ id, ...base, ...datos })
            return [id]
        },
        async update(cambios) { filas().filter(pasa).forEach((f) => Object.assign(f, cambios)); return 1 },
        async del() { tablas[nombre] = filas().filter((f) => !pasa(f)); return 1 },
    }
    return b
}
knex_falso.transaction = async (fn) => {
    const copia = JSON.stringify(tablas)
    try {
        const r = await fn(knex_falso)
        if (fallar_commit) throw new Error('commit fallido')
        return r
    } catch (error) {
        Object.assign(tablas, JSON.parse(copia))
        throw error
    }
}

function limpiar_diccionarios() {
    global.branchs_diccio = {}
    global.enterprice_diccio = {}
    global.branch_enterprice_diccio = {}
}
global.knex = knex_falso
limpiar_diccionarios()

const { createLocalesRepoBranch, obtener_o_crear_local_sin_local } = require('./helpers/locales_branch')
const { sincronizar_comercio } = require('./controllers/comercios_cache')
const precios_negocio = require('./controllers/precios_negocio')
const router_admin = require('./routes/localesAdmin')

// Bloque de regenerar_diccionarios que arma estos tres diccionarios (sin requerir server.js)
const fuente = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8')
const bloque = fuente.match(/for \(let i=0; i < enterprice\.length[\s\S]*?(?=\s*console\.log\('\[regenerar_diccionarios\] Generando diccionarios de productos)/)
assert.ok(bloque, 'no se encontro el armado de diccionarios en server.js')
const armar = new Function('enterprice', 'locales', bloque[0])

const foto = () => JSON.parse(JSON.stringify({
    b: global.branchs_diccio, e: global.enterprice_diccio, l: global.branch_enterprice_diccio,
}))
function igual_que_regenerar(caso) {
    const incremental = foto()
    limpiar_diccionarios()
    armar(structuredClone(tablas.enterprice), structuredClone(tablas.branch))
    assert.deepStrictEqual(incremental, foto(), `${caso}: difiere de una regeneracion`)
    console.log(`   ok - ${caso}`)
}

async function main() {
    const repo = createLocalesRepoBranch(knex_falso)

    const a = await repo.crear({ nombre: 'Almacen A', ciudad: 'Tandil', propietario_id: 1 })
    assert.strictEqual(global.branchs_diccio[a.id].branch_name, 'Almacen A')
    const eid = global.branchs_diccio[a.id].enterprise_id
    assert.strictEqual(global.enterprice_diccio[eid].name, 'Almacen A')
    assert.deepStrictEqual(global.branch_enterprice_diccio[eid].map((x) => x.id), [a.id])
    assert.ok(precios_negocio.es_negocio(a.id))
    igual_que_regenerar('alta de local')

    await repo.actualizar(a.id, { nombre: 'Almacen B' })
    await repo.actualizar(String(a.id), { ciudad: 'Rauch' })
    assert.strictEqual(global.enterprice_diccio[eid].name, 'Almacen B')
    assert.strictEqual(global.branch_enterprice_diccio[eid].length, 1)
    assert.strictEqual(global.branch_enterprice_diccio[eid][0].city, 'Rauch')
    assert.ok(precios_negocio.es_negocio(a.id))
    igual_que_regenerar('edicion sin duplicados')

    await sincronizar_comercio(knex_falso, { branch_id: a.id })
    await sincronizar_comercio(knex_falso, { branch_id: a.id, enterprise_id: eid })
    assert.strictEqual(global.branch_enterprice_diccio[eid].length, 1)
    igual_que_regenerar('sincronizar repetido')

    const s = await obtener_o_crear_local_sin_local(knex_falso, { id: 2, name: 'Ana', apellido: 'Paz' })
    const eid_s = s.enterprise_id
    assert.match(global.enterprice_diccio[eid_s].name, /^Comercio sin nombre [A-Z2-9]{8}$/)
    assert.strictEqual(s.branch_name, global.enterprice_diccio[eid_s].name)
    assert.strictEqual(global.branchs_diccio[s.id].sin_local, 1)
    assert.deepStrictEqual(global.branch_enterprice_diccio[eid_s], [])
    assert.ok(precios_negocio.es_negocio(s.id))
    igual_que_regenerar('alta del local "sin local" fuera de la lista publica')

    const capa = router_admin.stack.find((c) => c.route?.path === '/put_one')
    let respuesta
    await capa.route.stack[0].handle(
        { body: { id: a.id, publicado: false } },
        { status() { return this }, send(r) { respuesta = r } },
    )
    assert.strictEqual(respuesta.stat, true)
    assert.strictEqual(global.branchs_diccio[a.id].publicado, false)
    assert.strictEqual(global.branch_enterprice_diccio[eid][0].publicado, false)
    igual_que_regenerar('cambio de publicado por admin')

    const antes = foto()
    fallar_commit = true
    await assert.rejects(repo.crear({ nombre: 'No se guarda', propietario_id: 1 }))
    await assert.rejects(repo.actualizar(a.id, { nombre: 'No se guarda' }))
    await assert.rejects(repo.eliminar(a.id))
    fallar_commit = false
    assert.deepStrictEqual(foto(), antes)
    console.log('   ok - transaccion fallida no cambia los diccionarios')

    // Comercio con dos sucursales: se conserva al quitar una
    const [extra] = await knex_falso('branch').insert({ branch_name: 'Sucursal 2', enterprise_id: eid })
    await sincronizar_comercio(knex_falso, { branch_id: extra })
    igual_que_regenerar('segunda sucursal')
    assert.strictEqual(await repo.eliminar(a.id), true)
    assert.ok(global.enterprice_diccio[eid])
    assert.deepStrictEqual(global.branch_enterprice_diccio[eid].map((x) => x.id), [extra])
    igual_que_regenerar('baja de un local con comercio compartido')

    await repo.eliminar(extra)
    assert.ok(!global.branchs_diccio[extra] && !global.enterprice_diccio[eid] && !global.branch_enterprice_diccio[eid])
    igual_que_regenerar('baja del ultimo local y su comercio')

    // Un fallo al actualizar la memoria no hace fallar la operacion ya guardada
    const error_original = console.error
    console.error = () => {}
    global.enterprice_diccio = undefined
    const c = await repo.crear({ nombre: 'Almacen C', propietario_id: 1 })
    console.error = error_original
    assert.strictEqual(c.nombre, 'Almacen C')
    console.log('   ok - un error del diccionario no se propaga')

    console.log('Todos los casos OK')
}

main().catch((error) => { console.error(error); process.exit(1) })
