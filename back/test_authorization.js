/**
 * Test: control de acceso por ruta (back/helpers/authorization.js + middleware/Admin.js y Publico.js)
 *
 * Usa los middlewares reales con su lista `paths`. Cada router de ../routes se reemplaza por
 * uno de prueba con las mismas rutas (leidas del fuente; las de express-greenborn-crud se
 * agregan segun el paquete), que solo responde "llego al handler".
 *
 * Valida que:
 * 1. Toda ruta montada esta declarada con el nivel de acceso esperado (tabla ESPERADO).
 * 2. Las variantes en mayusculas / barra final tienen el mismo control que la ruta canonica.
 * 3. Las rutas no declaradas se rechazan aunque haya sesion.
 *
 * Solo cubre check_roles: los controles internos de cada handler (permisos del CRUD, KEY,
 * sesion) no se ejecutan.
 *
 * Uso: node test_authorization.js
 * No requiere base de datos ni .env.
 */

const fs = require('fs')
const path = require('path')
const Module = require('module')
const express = require('express')

// Sesion simulada: el token es la lista de permisos separada por comas
const auth = require('./helpers/auth')
auth.verificar_token = (token) => {
    if (token === 'invalido') throw new Error('token invalido')
    return { id: token }
}
auth.cargar_usuario = async (id) => ({ id: 1, permisos: id.split(',') })

const inventario = []   // { archivo, metodo, ruta }

function router_de_prueba(archivo) {
    const fuente = fs.readFileSync(path.join(__dirname, 'routes', `${archivo}.js`), 'utf8')
    const rutas = [...fuente.matchAll(/^\s*router\.(get|post|put|patch|delete|all)\(\s*['"]([^'"]*)['"]/gm)]
        .map(m => [m[1], m[2]])
    if (/createCrudRouter\(\{/.test(fuente)) {
        rutas.push(['get', '/list'], ['get', '/:id'])
        if (!/soloLectura:\s*true/.test(fuente)) rutas.push(['post', '/'], ['put', '/:id'], ['delete', '/:id'])
    }
    const router = express.Router()
    for (const [metodo, ruta] of rutas) {
        router[metodo](ruta, (req, res) => res.send({ handler: true }))
        inventario.push({ archivo, metodo: metodo.toUpperCase(), ruta })
    }
    return router
}

const montajes = {}   // archivo -> prefijo
const load_original = Module._load
Module._load = function (pedido, padre, ...resto) {
    const m = pedido.match(/^\.\.\/routes\/(\w+)$/)
    if (m) return router_de_prueba(m[1])
    return load_original.call(this, pedido, padre, ...resto)
}
const app = express()
for (const [base, nombre] of [['/admin', 'Admin'], ['/publico', 'Publico']]) {
    const fuente = fs.readFileSync(path.join(__dirname, 'middleware', `${nombre}.js`), 'utf8')
    for (const m of fuente.matchAll(/router\.use\("(\/\w+)", require\("\.\.\/routes\/(\w+)"\)\)/g))
        montajes[m[2]] = base + m[1]
    app.use(base, require(`./middleware/${nombre}`))
}
Module._load = load_original

const PUB = 'public'
const SES = 'session'
const ESPERADO = {}
function esperado(nivel, ...rutas) { for (const r of rutas) ESPERADO[r] = nivel }

esperado(PUB,
    'POST /admin/user/login', 'POST /admin/user/sso_login', 'POST /admin/comercios',
    'GET /publico/busqueda/precios', 'GET /publico/busqueda/promociones',
    'GET /publico/busqueda/info_comercio', 'GET /publico/busqueda/comercios_promociones',
    'GET /publico/busqueda/sugerencias',
    'POST /publico/chatbot/chat_bot_rsp',
    'GET /publico/estadistica/data', 'POST /publico/estadistica/precios_usuarios',
    'GET /publico/categorias/all', 'GET /publico/categorias/get_empresas_categoria',
    'GET /publico/categorias/get_categoria_empresa', 'GET /publico/categorias/get_sub_categorias',
    'GET /publico/productos/all', 'POST /publico/productos/importar',
    'POST /publico/productos/importar_alquiler', 'POST /publico/productos/importar_oferta')

esperado(SES,
    'GET /admin/user/info', 'POST /admin/user/logout', 'PUT /admin/user/guardar_config',
    'PUT /admin/user/cambiar_password',
    // permiso exigido dentro del router (sso.requirePermission)
    'GET /admin/alias_categorias/:id', 'POST /admin/alias_categorias',
    'PUT /admin/alias_categorias/:id', 'DELETE /admin/alias_categorias/:id',
    'GET /admin/precios_comunitarios/:id', 'DELETE /admin/precios_comunitarios/:id',
    'POST /publico/productos/regenerar_price_today',
    'PUT /publico/productos/cargar_nuevo_precio', 'PUT /publico/productos/cargar_precios_formulario',
    'PUT /publico/productos/cargar_precios_negocio')

esperado('usuarios.ver', 'GET /admin/user/get_all')
esperado('usuarios.crear', 'POST /admin/user/add_one')
esperado('usuarios.editar', 'PUT /admin/user/put_one', 'POST /admin/rbac/asignar_usuario_rol')
esperado('usuarios.eliminar', 'DELETE /admin/user/delete_one')
esperado('productos.editar', 'GET /admin/alias', 'POST /admin/alias', 'DELETE /admin/alias', 'POST /admin/alias/recargar')
esperado('alias.ver', 'GET /admin/alias_productos/get_all', 'GET /admin/alias_productos/productos')
esperado('alias.crear', 'POST /admin/alias_productos/add_one')
esperado('alias.editar', 'PUT /admin/alias_productos/put_one')
esperado('alias.eliminar', 'DELETE /admin/alias_productos/delete_one')
esperado('roles.ver', 'GET /admin/rbac/get_roles')
esperado('roles.crear', 'POST /admin/rbac/nuevo_rol')
esperado('roles.editar', 'PUT /admin/rbac/editar_rol', 'POST /admin/rbac/asignar_permiso_rol')
esperado('roles.eliminar', 'DELETE /admin/rbac/eliminar_rol')
esperado('permisos.ver', 'GET /admin/rbac/get_permisos')
esperado('permisos.crear', 'POST /admin/rbac/nuevo_permiso')
esperado('permisos.editar', 'PUT /admin/rbac/editar_permiso')
esperado('permisos.eliminar', 'DELETE /admin/rbac/eliminar_permiso')
esperado('rutas.ver', 'GET /admin/rbac/get_rutas')
esperado('rutas.crear', 'POST /admin/rbac/nueva_ruta')
esperado('rutas.editar', 'PUT /admin/rbac/editar_ruta')
esperado('rutas.eliminar', 'DELETE /admin/rbac/eliminar_ruta')
esperado('categorias.ver', 'GET /admin/categorias/get_all', 'GET /admin/categorias/productos_categoria',
    'GET /admin/categorias/productos_disponibles', 'GET /admin/categorias/categorias_disponibles',
    'GET /admin/categorias/arbol')
esperado('categorias.crear', 'POST /admin/categorias/add_one')
esperado('categorias.editar', 'PUT /admin/categorias/put_one', 'POST /admin/categorias/add_producto',
    'DELETE /admin/categorias/remove_producto')
esperado('categorias.eliminar', 'DELETE /admin/categorias/delete_one')
esperado('alias_categorias.listar', 'GET /admin/alias_categorias/list')
esperado('indices_precios.ver', 'GET /admin/indices_precios/get_all', 'GET /admin/indices_precios/alias_categoria_disponibles')
esperado('indices_precios.crear', 'POST /admin/indices_precios/add_one')
esperado('indices_precios.editar', 'PUT /admin/indices_precios/put_one')
esperado('indices_precios.eliminar', 'DELETE /admin/indices_precios/delete_one')
esperado('precios.listar', 'GET /admin/precios_comunitarios/list')
esperado('precios_hoy.listar', 'GET /admin/precios_hoy/list')
esperado('locales.ver', 'GET /admin/locales/get_all')
esperado('locales.editar', 'PUT /admin/locales/put_one')

let fallos = 0
let pruebas = 0

function comprobar(nombre, condicion, detalle = '') {
    pruebas++
    if (!condicion) {
        fallos++
        console.log(`   ✗ ${nombre} ${detalle}`)
    }
}

async function pedir(base, metodo, url, token) {
    const res = await fetch(base + url, { method: metodo, headers: token ? { 'x-api-key': token } : {} })
    const body = await res.json().catch(() => ({}))
    if (body.handler) return 'handler'
    return body.text || `HTTP ${res.status}`
}

// Variantes que Express enruta al mismo handler
function variantes(url) {
    const [, base, modulo, ...resto] = url.split('/')
    const armar = (...p) => '/' + p.join('/')
    const may = (s) => s.toUpperCase()
    return [...new Set([
        url,
        url + '/',
        armar(base, modulo, ...resto.map(may)),
        armar(base, may(modulo), ...resto),
        armar(may(base), may(modulo), ...resto.map(may)) + '/',
        url + '?x=1',
    ])]
}

async function parte_rutas(base) {
    const montadas = inventario.map(r =>
        ({ metodo: r.metodo, url: montajes[r.archivo] + (r.ruta === '/' ? '' : r.ruta) }))
    const claves = montadas.map(r => `${r.metodo} ${r.url}`)

    console.log(`\n1. Inventario: ${claves.length} rutas montadas`)
    for (const c of claves) comprobar(`ruta prevista en el test: ${c}`, c in ESPERADO)
    for (const c in ESPERADO) comprobar(`ruta esperada montada: ${c}`, claves.includes(c))

    console.log('\n2. Nivel de acceso por ruta y variantes')
    for (const { metodo, url } of montadas) {
        const nivel = ESPERADO[`${metodo} ${url}`]
        for (const v of variantes(url.replace(':id', 'Ab1'))) {
            const anonimo = await pedir(base, metodo, v)
            const invalido = await pedir(base, metodo, v, 'invalido')
            const sin_permiso = await pedir(base, metodo, v, 'ninguno')
            const n = `${metodo} ${v}`
            if (nivel === PUB) {
                comprobar(`${n} publica`, anonimo === 'handler', `-> ${anonimo}`)
                continue
            }
            comprobar(`${n} rechaza anonimo`, anonimo === 'No hay sesion activa', `-> ${anonimo}`)
            comprobar(`${n} rechaza token invalido`, invalido === 'Token invalido o expirado', `-> ${invalido}`)
            if (nivel === SES) {
                comprobar(`${n} admite sesion`, sin_permiso === 'handler', `-> ${sin_permiso}`)
                continue
            }
            comprobar(`${n} rechaza sin permiso`, sin_permiso === 'Permisos insuficientes', `-> ${sin_permiso}`)
            const con_permiso = await pedir(base, metodo, v, nivel)
            comprobar(`${n} admite ${nivel}`, con_permiso === 'handler', `-> ${con_permiso}`)
        }
    }
}

async function parte_no_declaradas(base) {
    console.log('\n3. Rutas no declaradas')
    const urls = [
        '/admin', '/admin/rbac', '/admin/user', '/admin/user/signup', '/admin/rbac/get_roles/x',
        '/admin/rbac//get_roles', '/admin//rbac/get_roles', '/admin/rbac/get%5Froles',
        '/admin/comercios/otra', '/admin/alias_categorias/1/x', '/admin/precios_comunitarios',
        '/admin/productos/regenerar_price_today', '/publico', '/publico/productos',
        '/publico/productos/all/x', '/publico/busqueda/otra',
    ]
    const todos = Object.values(ESPERADO).join(',')
    for (const url of urls) {
        for (const token of [null, todos]) {
            const r = await pedir(base, 'GET', url, token)
            comprobar(`rechaza ${url} ${token ? 'con sesion' : 'anonimo'}`, r === 'Ruta no permitida', `-> ${r}`)
        }
    }
}

const servidor = app.listen(0, '127.0.0.1', async () => {
    const base = `http://127.0.0.1:${servidor.address().port}`
    const log = console.log
    // Silencia los logs de los middlewares
    console.log = (...a) => { if (!/(middleware|Check roles)/.test(String(a[0]))) log(...a) }
    try {
        await parte_rutas(base)
        await parte_no_declaradas(base)
    } catch (error) {
        fallos++
        console.log(error)
    }
    console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones correctas`)
    process.exitCode = fallos ? 1 : 0
    servidor.close()
})
