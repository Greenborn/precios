const express = require('express')
var router = express.Router()
module.exports = router
const bcrypt = require('bcrypt')
const fs = require("fs")
const busqueda_productos = require("../controllers/busqueda_productos")
const utils = require("../helpers/utils")

// Orden por grupo (todas las palabras / alguna), cantidad de coincidencias y precio
async function hacer_busqueda( termino, orden ){
  return new Promise(async (resolve, reject) => {
    try{

      let productos = await busqueda_productos.busqueda_ranking(termino, orden)

      if (productos){

        // Una sucursal faltante en el diccionario no debe tirar abajo toda la búsqueda
        // Ventana hoy+ayer aplicada al responder (la purga del índice corre cada 15 min)
        const desde = inicio_de_ayer().getTime()
        resolve(productos.filter(p => {
          if (!global.branchs_diccio[Number(p.branch_id)]) return false
          const t = new Date(p.date_time).getTime()
          return isNaN(t) || t >= desde
        }))
      } else
        resolve([])

    } catch (error) {
      console.log(error)
      resolve([])
    }
            
  })
}

async function hacer_busqueda_alquiler( termino, metodo ){
  return new Promise(async (resolve, reject) => {
    try{
      let ultimo_registro =  await global.knex('propiedades_alquiler').select().orderBy('ultima_fecha', 'desc').first()

      if (ultimo_registro) {
        let nueva_fecha = new Date( ultimo_registro.ultima_fecha )
        nueva_fecha.setDate( nueva_fecha.getDate() - 1 )

        let PALABRAS = termino.split(" ")

        let SQL = "(titulo LIKE ?) "
        let params = ['%'+PALABRAS[0]+'%']
        for (let i=1; i < PALABRAS.length; i++){
          SQL += " AND (titulo LIKE ?) "
          params.push('%'+PALABRAS[i]+'%')
        }

        let propiedades = await global.knex('propiedades_alquiler')
                      .select()
                      .whereRaw(SQL, params)
                      .andWhere( "ultima_fecha", '>', nueva_fecha )

        if (propiedades){
          let aux = []
          //console.log(propiedades)
          for (let i=0; i < propiedades.length; i++){
            aux.push(
              {
                "id": propiedades[i].id,
                "tipo": "ALQUILER",
                "moneda": propiedades[i].moneda, 
                "product_id": propiedades[i].id,
                "price": propiedades[i].precio,
                "date_time": new Date(propiedades[i].ultima_fecha).getTime(),
                "user_id": null,
                "branch_id": '',
                "es_oferta": 0,
                "porcentage_oferta": null,
                "confiabilidad": 100,
                "url": propiedades[i].url,
                "notas": null,
                "time": propiedades[i].ultima_fecha,
                "empresa": {
                  "id": -1,
                  "name": propiedades[i].locador,
                  "url_website": ""
                },
                "locales": [],
                "caracteristicas": JSON.parse(propiedades[i].especificaciones),
                "products": {
                  "id": propiedades[i].id,
                  "name": propiedades[i].titulo,
                  "vendor_id": -1,
                  "ultimo_precio_conocido": new Date(propiedades[i].ultima_fecha),
                  "last_price": propiedades[i].precio,
                  "alias": ""
                }
              }
            )
          }
          resolve(aux)
        } else 
          resolve([])

      } else
        resolve([])

    } catch (error) {
      console.log(error)
      resolve([])
    }
            
  })
}

const LIMITE_MAX_PALABRAS = 15
const LIMITE_MIN_CARACTERES = 3

function nombre_producto_filtrado( nombre ){
  let palabras = nombre.split(" ")
  let nuevo = []

  for (let i=0; i < palabras.length && i < LIMITE_MAX_PALABRAS; i++){
    nuevo.push( palabras[i] )
  }

  let nuevo_termino = nuevo.join(" ")

  let alias = global.alias_busqueda[nuevo_termino.toLowerCase()]
  return alias != undefined ? alias : nuevo_termino
}

// Registro de historial sin bloquear la respuesta (los resultados salen de memoria)
function registrar_historial(query, cant, req) {
  global.knex('search_query_history')
    .insert({
      "query": query,
      "date": new Date().toISOString().replace('T', ' ').replace('Z', ''),
      "cant_results": cant,
      "ipv4": req.header('x-forwarded-for')
    })
    .catch(err => console.log('[busqueda] error registrando historial', err.message))
}

// Ventana de vigencia común a precios y ofertas: hoy + ayer (margen de un día)
function inicio_de_ayer() {
  let d = new Date()
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() - 1)
  return d
}

const CANTIDAD_DEFECTO = 30
const CANTIDAD_MAX = 100

// Completa empresa y locales solo para los ítems que se devuelven
function enriquecer(items) {
  for (const item of items) {
    if (item.empresa) continue
    const branch = global.branchs_diccio[Number(item.branch_id)]
    if (!branch) continue
    item.empresa = global.enterprice_diccio[Number(branch.enterprise_id)]
    item.locales = global.branch_enterprice_diccio[Number(branch.enterprise_id)]
  }
  return items
}

function ordenar(items, orden) {
  // Sin orden (o inválido) el criterio por defecto es el menor precio, igual que el front
  if (orden === 'relevancia') return items
  const f = orden === 'precio_desc' ? -1 : 1
  return [...items].sort((a, b) => {
    const pa = Number(a?.price), pb = Number(b?.price)
    if (pa == -1) return 1
    if (pb == -1) return -1
    return ((pa - pb) * f) || String(a?.id).localeCompare(String(b?.id))
  })
}

// Paginación: si no se envía `pagina` se devuelve todo (compatibilidad con
// consumidores existentes, p. ej. Calculadora de Trueque).
function paginar(items, query) {
  const total = items.length
  if (query?.pagina === undefined)
    return { items, total, pagina: 1, hay_mas: false }

  const pagina = Math.max(1, parseInt(query.pagina) || 1)
  const cantidad = Math.min(CANTIDAD_MAX, Math.max(1, parseInt(query.cantidad) || CANTIDAD_DEFECTO))
  const desde = (pagina - 1) * cantidad
  const pag_items = items.slice(desde, desde + cantidad)
  return { items: pag_items, total, pagina, hay_mas: desde + cantidad < total }
}

router.get('/sugerencias', function (req, res) {
  try {
    const q = utils.limpiarTexto(String(req?.query?.q || ''))
    if (q.length < LIMITE_MIN_CARACTERES)
      return res.status(200).send({ stat: true, items: [] })
    res.status(200).send({ stat: true, items: busqueda_productos.sugerencias(q, 8) })
  } catch (error) {
    console.log(error)
    res.status(200).send({ stat: false, items: [] })
  }
})

router.get('/precios', async function (req, res) {
  try {
    let product_name = utils.limpiarTexto(String(req?.query?.product_name || ''))

    if (product_name.length < LIMITE_MIN_CARACTERES)
      return res.status(200).send({ stat: false, items: [], total: 0, error: true,
                                    message: `El término debe tener al menos ${LIMITE_MIN_CARACTERES} caracteres` })

    const es_alquiler = product_name.search("alquiler") > -1
    // Productos: hacer_busqueda ya devuelve el ranking final (no se reordena por precio)
    let res_busqueda = es_alquiler
      ? await hacer_busqueda_alquiler( product_name, 'AND' )
      : await hacer_busqueda( product_name, req.query.orden )
    res_busqueda = res_busqueda || []

    const resultado = paginar(res_busqueda, req.query)
    if (!es_alquiler) enriquecer(resultado.items)

    // Historial solo en la primera página (no por cada scroll)
    if (resultado.pagina === 1)
      registrar_historial(product_name, resultado.total, req)

    res.status(200).send({ stat: true, ...resultado })
  } catch (error) {
    console.log('[busqueda/precios] error', error)
    res.status(200).send({ stat: false, items: [], total: 0, error: true })
  }
})

async function hacer_busqueda_promo( termino, metodo ){
  return new Promise(async (resolve, reject) => {
    try{       
        let promos = undefined

        if (termino !== 'cod_todas_las_ofertas'){
          let PALABRAS = termino.toLowerCase().split(" ").filter(p => p.length > 0)
          // comparación insensible a mayúsculas aplicando LOWER sobre la columna
          let SQL = "(LOWER(titulo) LIKE ?) "
          let params = ['%'+PALABRAS[0]+'%']
          for (let i=1; i < PALABRAS.length; i++){
            SQL += " AND (LOWER(titulo) LIKE ?) "
            params.push('%'+PALABRAS[i]+'%')
          }

          // Sin .distinct('titulo'): knex generaba "select distinct titulo" y se
          // perdían branch_id/precio/etc. (la búsqueda con término daba siempre 0).
          // orderBy estable para que la paginación no repita ni saltee ítems.
          promos = await global.knex('promociones_hoy')
                        .select()
                        .whereRaw(SQL, params)
                        .andWhere('fecha', '>=', inicio_de_ayer())
                        .orderBy([{ column: 'precio' }, { column: 'id' }])
        } else 
          promos = await global.knex('promociones_hoy')
                      .select()
                      .where('fecha', '>=', inicio_de_ayer())
                      .orderBy([{ column: 'precio' }, { column: 'id' }])

        
        if (promos){
          let aux = []
          //console.log(propiedades)
          for (let i=0; i < promos.length; i++){
            // Promo con sucursal desconocida: se saltea en lugar de romper toda la búsqueda
            const branch = global.branchs_diccio[Number(promos[i].branch_id)]
            if (!branch) continue
            let caracteristicas = {}
            try { caracteristicas = JSON.parse(promos[i].datos_extra) || {} } catch { caracteristicas = {} }
            aux.push(
              {
                "id": promos[i].id,
                "tipo": "PROMO",
                "product_id": promos[i].id_producto,
                "price": promos[i].precio,
                "date_time": new Date(promos[i].fecha).getTime(),
                "user_id": null,
                "branch_id": promos[i].branch_id,
                "es_oferta": 1,
                "porcentage_oferta": null,
                "confiabilidad": 100,
                "url": promos[i].url,
                "notas": null,
                "time": promos[i].fecha,
                "empresa": {
                  "id": -1,
                  "name": global.enterprice_diccio[Number(branch.enterprise_id)]?.name,
                  "url_website": ""
                },
                "locales": global.branch_enterprice_diccio[Number(branch.enterprise_id)],
                "caracteristicas": caracteristicas,
                "products": {
                  "id": promos[i].id,
                  "name": promos[i].titulo,
                  "vendor_id": -1,
                  "ultimo_precio_conocido": new Date(promos[i].fecha),
                  "last_price": promos[i].precio,
                  "alias": ""
                }
              }
            )
          }
          resolve(aux)
        } else 
          resolve([])

    } catch (error) {
      console.log(error)
      resolve([])
    }
            
  })
}

router.get('/promociones', async function (req, res) {

  try {
    const crudo = String(req?.query?.product_name || '').trim()
    const TODAS = crudo === 'cod_todas_las_ofertas'
    // Mismo saneo que /precios (acentos, espacios, caracteres especiales)
    let product_name = TODAS ? crudo : utils.limpiarTexto(crudo)

    if (product_name.length < LIMITE_MIN_CARACTERES)
      return res.status(200).send({ stat: false, items: [], total: 0, error: true,
                                    message: `El término debe tener al menos ${LIMITE_MIN_CARACTERES} caracteres` })

    if (!TODAS) product_name = nombre_producto_filtrado( product_name)
    let res_busqueda = ordenar(await hacer_busqueda_promo( product_name, 'AND' ) || [], req.query.orden)
    const resultado = paginar(res_busqueda, req.query)
    if (resultado.pagina === 1 && !TODAS)
      registrar_historial(product_name, resultado.total, req)

    res.status(200).send({ stat: true, ...resultado })
  } catch {
    res.status(200).send({ stat: false, items: [], error: true })
  }  
})

router.get('/info_comercio', async function (req, res) {
    console.log("query ", req.query)

    try {
        let website = req?.query?.website
        if (!website) {
            return res.status(200).send({ stat: false, error: "Falta parametro: website" })
        }

        let enterprice = await global.knex('enterprice').where('website', website).first()
        if (!enterprice) {
            return res.status(200).send({ stat: false, error: "No se encontro comercio con esa URL" })
        }

        let branches = await global.knex('branch').where('enterprise_id', enterprice.id)

        res.status(200).send({
            stat: true,
            items: {
                enterprice,
                branches
            }
        })

    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false, error: "Error interno" })
    }
})

router.get('/comercios_promociones', async function (req, res) {
  console.log("query ", req.query)

  try {
    let comercios_promos = await global.knex('enterprice')
                            .select(['enterprice.*', 'promociones_hoy.branch_id'])
                            .join('branch', 'branch.enterprise_id', 'enterprice.id')
                            .join('promociones_hoy', 'promociones_hoy.branch_id', 'branch.id')
                            .distinct('enterprice.id')

    res.status(200).send({ stat: true, items: comercios_promos })
      
  } catch (error) {
    console.log(error)
    res.status(200).send({ stat: false, items: [], error: true })
  }  
})

