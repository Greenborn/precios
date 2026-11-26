/**
 * Test: ABM admin de locales, cambio del flag `publicado` (routes/localesAdmin.js)
 *
 * Cubre:
 * - GET /get_all: lista locales (publicados y no) con comercio, excluye el "sin local" (sin_local = 1).
 * - GET /get_all: búsqueda y paginado.
 * - PUT /put_one: cambia publicado a true/false (acepta booleano y 1/0).
 * - PUT /put_one: rechaza valores no booleanos sin tocar la base.
 * - PUT /put_one: no permite editar el local "sin local" ni un id inexistente.
 * - PUT /put_one: ignora el resto de los campos del body (sólo cambia publicado).
 *
 * Usa un knex falso en memoria y monta el router real sobre express en un puerto efímero.
 * No requiere base de datos. La protección por permisos (locales.ver / locales.editar)
 * se define en middleware/Admin.js y se verifica en la corrida de integración.
 *
 * Uso: node back/test_publicado_admin.js
 * Sale con código distinto de cero si algún caso falla.
 */

const assert = require('assert')
const express = require('express')

// ---------- knex falso (sólo lo que usa localesAdmin.js) ----------
const tablas = {}
function reset() {
    for (const k of Object.keys(tablas)) delete tablas[k]
    tablas.enterprice = [
        { id: 100, name: 'Comercio A' },
        { id: 200, name: 'Comercio B' },
    ]
    tablas.branch = [
        { id: 1, branch_name: 'Local visible', city: 'Tandil', enterprise_id: 100, publicado: 1, sin_local: null, propietario_id: 1 },
        { id: 2, branch_name: 'Local oculto', city: 'Tandil', enterprise_id: 100, publicado: 0, sin_local: null, propietario_id: 1 },
        { id: 3, branch_name: 'Sin local', city: null, enterprise_id: 100, publicado: 0, sin_local: 1, propietario_id: 1 },
        { id: 4, branch_name: 'Local de otro', city: 'Rauch', enterprise_id: 200, publicado: 1, sin_local: null, propietario_id: 2 },
    ]
}

// Une branch con enterprice y expone columnas como 'branch.x' / 'enterprice.x'
function filas_unidas() {
    return tablas.branch.map((b) => {
        const e = tablas.enterprice.find((x) => x.id === b.enterprise_id) || {}
        const fila = {}
        for (const [k, v] of Object.entries(b)) fila[`branch.${k}`] = v
        for (const [k, v] of Object.entries(e)) fila[`enterprice.${k}`] = v
        return fila
    })
}

function predicado_like(col, val) {
    const key = col.includes('.') ? col : `branch.${col}`
    const t = String(val).replace(/%/g, '').toLowerCase()
    return (f) => String(f[key] ?? '').toLowerCase().includes(t)
}

// Builder mínimo para las consultas de localesAdmin.js (join, where, like, count, orderBy, offset, limit, first, update)
function builder_branch() {
    let filtros = []
    let orden = null
    let orden_desc = false
    let columnas = null
    let offset = 0
    let limite = Infinity
    let modo_count = false
    const valor = (f, col) => f[col.includes('.') ? col : `branch.${col}`]
    const pasa = (f) => filtros.every((fn) => fn(f))

    // Subconsulta agrupada: where(function () { this.where(...).orWhere(...) })
    function grupo(cb) {
        const preds = []
        const sub = {
            where(col, op, val) { preds.push(predicado_like(col, val)); return sub },
            orWhere(col, op, val) { preds.push(predicado_like(col, val)); return sub },
        }
        cb.call(sub)
        filtros.push((f) => preds.some((fn) => fn(f)))
    }

    const b = {
        join() { return this },
        where(obj, op, val) {
            if (typeof obj === 'function') { grupo(obj); return this }
            if (typeof obj === 'string') {
                if (op === 'like') filtros.push(predicado_like(obj, val))
                else filtros.push((f) => String(valor(f, obj)) === String(op))
                return this
            }
            filtros.push((f) => Object.entries(obj).every(([k, v]) => String(valor(f, k)) === String(v)))
            return this
        },
        whereNull(col) { filtros.push((f) => valor(f, col) == null); return this },
        select(...cols) { columnas = cols.map((c) => { const [origen, alias] = c.split(/\s+as\s+/); return { origen: origen.trim(), alias: (alias || origen).trim() } }); return this },
        count() { modo_count = true; return this },
        orderBy(col, dir) { orden = col; orden_desc = dir === 'desc'; return this },
        offset(n) { offset = n; return this },
        limit(n) { limite = n; return this },
        async first(col) {
            const r = await this.then((x) => x)
            if (!r[0]) return undefined
            return col ? { [col]: r[0][col] } : r[0]
        },
        async update(cambios) {
            const r = filas_unidas().filter(pasa)
            for (const fila of r) {
                const original = tablas.branch.find((x) => x.id === fila['branch.id'])
                Object.assign(original, cambios)
            }
            return r.length
        },
        then(ok, ko) {
            let r = filas_unidas().filter(pasa)
            if (modo_count) return Promise.resolve([{ c: r.length }]).then(ok, ko)
            if (orden) r = r.slice().sort((a, c) => (a[orden] > c[orden] ? 1 : -1) * (orden_desc ? -1 : 1))
            r = r.slice(offset, offset + limite)
            if (columnas) {
                r = r.map((f) => {
                    const o = {}
                    for (const c of columnas) o[c.alias] = f[c.origen]
                    return o
                })
            }
            return Promise.resolve(r).then(ok, ko)
        },
    }
    return b
}

global.knex = (nombre) => {
    if (nombre !== 'branch') throw new Error('tabla no simulada: ' + nombre)
    return builder_branch()
}

// ---------- servidor de prueba ----------
const router = require('./routes/localesAdmin')
const app = express()
app.use(express.json())
app.use('/', router)
const servidor = app.listen(0)
const base = `http://127.0.0.1:${servidor.address().port}`

async function pedir(metodo, ruta, cuerpo) {
    const r = await fetch(base + ruta, {
        method: metodo,
        headers: { 'content-type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
    const texto = await r.text()
    let json = null
    try { json = JSON.parse(texto) } catch (_) { /* sin cuerpo JSON */ }
    return { status: r.status, json, texto }
}

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

;(async () => {
    await caso('get_all lista locales con comercio y excluye "sin local"', async () => {
        reset()
        const r = await pedir('GET', '/get_all')
        assert.strictEqual(r.json.stat, true, r.texto)
        const ids = r.json.data.rows.map((l) => l.id).sort()
        assert.deepStrictEqual(ids, [1, 2, 4])
        const visible = r.json.data.rows.find((l) => l.id === 1)
        assert.strictEqual(visible.comercio, 'Comercio A')
        assert.strictEqual(visible.publicado, true)
        assert.strictEqual(r.json.data.rows.find((l) => l.id === 2).publicado, false)
        assert.strictEqual(r.json.data.total, 3)
    })

    await caso('get_all busca por nombre y pagina', async () => {
        reset()
        const r = await pedir('GET', '/get_all?search=otro&page=1&pageSize=10')
        assert.deepStrictEqual(r.json.data.rows.map((l) => l.id), [4])
        const p = await pedir('GET', '/get_all?page=2&pageSize=2')
        assert.strictEqual(p.json.data.rows.length, 1)
        assert.strictEqual(p.json.data.total, 3)
    })

    await caso('put_one despublica un local (booleano false)', async () => {
        reset()
        const r = await pedir('PUT', '/put_one', { id: 1, publicado: false })
        assert.strictEqual(r.json.stat, true, r.texto)
        assert.strictEqual(Number(tablas.branch.find((f) => f.id === 1).publicado), 0)
    })

    await caso('put_one publica un local (1/0 del formulario)', async () => {
        reset()
        const r = await pedir('PUT', '/put_one', { id: 2, publicado: 1 })
        assert.strictEqual(r.json.stat, true, r.texto)
        assert.strictEqual(Number(tablas.branch.find((f) => f.id === 2).publicado), 1)
    })

    await caso('put_one rechaza valores no booleanos sin tocar la base', async () => {
        for (const valor of ['si', 2, null, {}, [], 'true x']) {
            reset()
            const r = await pedir('PUT', '/put_one', { id: 2, publicado: valor })
            assert.strictEqual(r.json.stat, false, `valor ${JSON.stringify(valor)}: ${r.texto}`)
            assert.strictEqual(Number(tablas.branch.find((f) => f.id === 2).publicado), 0)
        }
    })

    await caso('put_one no edita el local "sin local" ni un id inexistente', async () => {
        reset()
        const sin_local = await pedir('PUT', '/put_one', { id: 3, publicado: true })
        assert.strictEqual(sin_local.json.stat, false, sin_local.texto)
        assert.strictEqual(Number(tablas.branch.find((f) => f.id === 3).publicado), 0)
        const inexistente = await pedir('PUT', '/put_one', { id: 999, publicado: true })
        assert.strictEqual(inexistente.json.stat, false, inexistente.texto)
    })

    await caso('put_one ignora campos ajenos a publicado', async () => {
        reset()
        const antes = { ...tablas.branch.find((f) => f.id === 1) }
        const r = await pedir('PUT', '/put_one', { id: 1, publicado: false, branch_name: 'Hackeado', propietario_id: 2 })
        assert.strictEqual(r.json.stat, true, r.texto)
        const despues = tablas.branch.find((f) => f.id === 1)
        assert.strictEqual(despues.branch_name, antes.branch_name)
        assert.strictEqual(despues.propietario_id, antes.propietario_id)
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
