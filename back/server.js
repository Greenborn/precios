require("dotenv").config({ path: '.env' })
const busqueda_productos = require("./controllers/busqueda_productos")
const sync_cache = require("./controllers/sync_cache")
const alias_busqueda_ctrl = require("./controllers/alias_busqueda")
const { spawn } = require('child_process')
const path = require('path')

//conexion a base de datos
let conn_obj = {
  host: process.env.mysql_host,
//  port: process.env.mysql_port,
  user: process.env.mysql_user,
  password: process.env.mysql_password,
  database: process.env.mysql_database,
  supportBigNumbers: true,
  bigNumberStrings: true,
  typeCast: function (field, next) {
      if (field.type == "NEWDECIMAL") {
          var value = field.string();
          return (value === null) ? null : Number(value);
      }
      return next();
  }

}

global.knex = require('knex')({
  client: 'mysql2',
  connection: conn_obj,
  pool: { min: 0, max: 1000, "propagateCreateError": false }
});
global.branchs_diccio = {}
global.branch_enterprice_diccio = {}
global.alias_busqueda = {}
global.enterprice_diccio = {}
global.category_diccio = {}
global.products = []
global.precios_diccio = {}
global.products_diccio = {}
global.products_diccio_id = {}
global.products_category_diccio = { by_product_id: {}, by_category_id: {} }

// Configurar zona horaria del proceso para Argentina (UTC-3)
process.env.TZ = 'America/Argentina/Buenos_Aires';

// Ejecutar servicio de actualización de precios en paralelo
const scriptPath = path.join(__dirname, '..', 'extra_services', 'setup_and_run.sh')
const setupProcess = spawn('bash', [scriptPath], {
  cwd: path.join(__dirname, '..', 'extra_services'),
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false
})

setupProcess.stdout.on('data', (data) => {
  console.log(`[setup_and_run.sh] ${data.toString().trim()}`)
})

setupProcess.stderr.on('data', (data) => {
  console.error(`[setup_and_run.sh ERROR] ${data.toString().trim()}`)
})

setupProcess.on('error', (error) => {
  console.error(`[setup_and_run.sh] Error al ejecutar: ${error.message}`)
})

setupProcess.on('exit', (code, signal) => {
  if (code !== null) {
    console.log(`[setup_and_run.sh] Proceso finalizado con código: ${code}`)
  } else {
    console.log(`[setup_and_run.sh] Proceso finalizado por señal: ${signal}`)
  }
})

console.log('[setup_and_run.sh] Servicio de actualización de precios iniciado en paralelo')

//Es de esperar que en 3s ya tenemos conexion disponible
setTimeout(async () => {
  await base_de_datos_iniciada()
}, 2000)

async function generar_diccio_precios(precios_hoy){
  for (let i=0; i < precios_hoy.length; i++){
    if (global.precios_diccio[precios_hoy[i].product_id] == undefined){
      global.precios_diccio[precios_hoy[i].product_id] = []
    }
    
    global.precios_diccio[precios_hoy[i].product_id].push(precios_hoy[i])
  }
}

// Función para regenerar diccionarios y estructuras de datos
async function regenerar_diccionarios(){
  console.log('[regenerar_diccionarios] Iniciando regeneración de diccionarios...')
  
  // Limpiar diccionarios existentes
  global.precios_diccio = {}
  global.branchs_diccio = {}
  global.branch_enterprice_diccio = {}
  global.alias_busqueda = {}
  global.enterprice_diccio = {}
  global.category_diccio = {}
  global.products_diccio = {}
  global.products_diccio_id = {}
  global.diccio_name_category = {}
  
  console.log('[regenerar_diccionarios] Cargando datos desde la base de datos...')
  
  let locales = await global.knex('branch').select()
  let enterprice = await global.knex('enterprice').select()
  let category = await global.knex('category').select()
  global.alias_productos = await global.knex('alias_productos').select()
                              .join('products', 'products.id', 'alias_productos.product_id')
  let precios_hoy = await global.knex('price_today').select()
  let product_category = await global.knex('product_category').select()

  console.log('[regenerar_diccionarios] Generando diccionario de precios...')
  if (precios_hoy)
    await generar_diccio_precios(precios_hoy)

  console.log('[regenerar_diccionarios] Generando diccionario de productos por categoría...')
  await sync_cache.construir_categorias()

  console.log('[regenerar_diccionarios] Generando diccionario de categorías...')
  if (category){
    for (let i=0; i < category.length; i++)
      global.diccio_name_category[category[i].name] = category[i]
  }

  if (product_category && global.alias_productos && locales && enterprice){
    console.log('[regenerar_diccionarios] Generando diccionarios de empresas y sucursales...')
    
    for (let i=0; i < enterprice.length; i++){
      global.enterprice_diccio[Number(enterprice[i].id)] = enterprice[i]
      global.branch_enterprice_diccio[Number(enterprice[i].id)] = []
    }

    for (let i=0; i < locales.length; i++){
      global.branchs_diccio[Number(locales[i].id)] = locales[i]
      global.branch_enterprice_diccio[Number(locales[i].enterprise_id)].push( locales[i] )
    }

    console.log('[regenerar_diccionarios] Generando diccionarios de productos...')
    for (let i=0; i < global.alias_productos.length; i++){
      global.alias_productos[i].name = global.alias_productos[i].name.normalize('NFD')
                                .replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,"$1")
                                .normalize().toLowerCase()
      global.products_diccio[global.alias_productos[i].name] = global.alias_productos[i]
      global.products_diccio_id[global.alias_productos[i].id] = global.alias_productos[i]
    }
    
    console.log('[regenerar_diccionarios] Inicializando buscador...')
    await busqueda_productos.inicializa_buscador()
  }
  
  if (category)
    for (let i=0; i < category.length; i++)
      global.category_diccio[Number(category[i].id)] = category[i]

  await recargar_alias_busqueda()

  console.log('[regenerar_diccionarios] ✓ Regeneración completada exitosamente')
  console.log(`[regenerar_diccionarios] Estadísticas:`)
  console.log(`  - Precios: ${Object.keys(global.precios_diccio).length}`)
  console.log(`  - Productos: ${Object.keys(global.products_diccio_id).length}`)
  console.log(`  - Sucursales: ${Object.keys(global.branchs_diccio).length}`)
  console.log(`  - Empresas: ${Object.keys(global.enterprice_diccio).length}`)
  console.log(`  - Categorías: ${Object.keys(global.category_diccio).length}`)
}

// Recarga en memoria el diccionario alias_busqueda (termino inicial -> termino final)
async function recargar_alias_busqueda(){
  const cantidad = await alias_busqueda_ctrl.recargar()
  console.log(`[alias_busqueda] ${cantidad} alias cargados en memoria`)
  return cantidad
}

async function base_de_datos_iniciada(){
  console.log('se establecio conexion DB')

  // Ejecutar migraciones pendientes automáticamente
  try {
    await knex.migrate.latest()
    console.log('[migrate] Migraciones ejecutadas correctamente')
  } catch (err) {
    console.error('[migrate] Error al ejecutar migraciones:', err)
  }

  // Seed idempotente de RBAC (rol administrador, permisos, rutas y admin por defecto)
  try {
    const { seed_rbac } = require('./scripts/seed_rbac')
    await seed_rbac()
    console.log('[seed_rbac] Seed RBAC ejecutado correctamente')
  } catch (err) {
    console.error('[seed_rbac] Error al ejecutar seed:', err)
  }

  let app_API = require('express')();
  let server_API = require('http').Server(app_API);

  //CORS
  let cors_origin = process.env.cors_origin.split(' ')
  let cors = require('cors')
  let corsOptions = {
    credentials: true,
    origin: cors_origin
  }
  app_API.use(cors(corsOptions))

  //FORMATEO
  let bodyParser = require("body-parser")
  app_API.use(bodyParser.json({limit: '50mb'}))

  //MIDLEWARE
  app_API.use("/publico", require("./middleware/Publico"))
  app_API.use("/admin", require("./middleware/Admin"))

  //RUTA INTERNA (solo para procesos internos, protegida por clave)
  const INTERNAL_SYNC_KEY = process.env.internal_sync_key
  app_API.post("/interno/sync_cache", async (req, res) => {
    try {
      const key = req.get('x-internal-key')
      if (!INTERNAL_SYNC_KEY || key !== INTERNAL_SYNC_KEY) {
        return res.status(401).send({ stat: false, error: "unauthorized" })
      }
      const ph = req.body
      if (!ph || !ph.product_id || !ph.branch_id) {
        return res.status(400).send({ stat: false, error: "campos faltantes" })
      }
      if (!global.precios_diccio || !global.products_category_diccio) {
        return res.status(500).send({ stat: false, error: "diccionarios no inicializados" })
      }
      ph.product_id = String(ph.product_id)
      ph.branch_id = String(ph.branch_id)
      await sync_cache.actualizar_precio(ph)
      res.status(200).send({ stat: true })
    } catch (error) {
      console.log("[interno/sync_cache] error", error)
      res.status(500).send({ stat: false, error: "error interno" })
    }
  })

  server_API.listen(process.env.service_port_api)
  console.log('Servidor escuchando en: ',process.env.service_port_api)

  // Inicializar diccionarios y estructuras de datos
  await regenerar_diccionarios()

  // La actualización de price_today debe ejecutarse manualmente o encolando la tarea
  // node scripts/recrear_price_today.js o POST /admin/productos/regenerar_price_today (agrega elemento a la cola)
  console.log('[price_today] Para actualizar price_today:')
  console.log('  - Manualmente: node scripts/recrear_price_today.js')
  console.log('  - Mediante API (encolar): POST /admin/productos/regenerar_price_today con key válida')
}

// Exportar funciones para uso externo
module.exports = { regenerar_diccionarios, recargar_alias_busqueda }
