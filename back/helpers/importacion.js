// Reglas y registro de descartes de las importaciones automáticas de precios.
const fs = require('fs')
const path = require('path')

// CSV compartido con el worker (extra_services/actualizar_precios.py)
const CSV_DESCARTADOS = process.env.CSV_DESCARTADOS ||
    path.join(__dirname, '..', '..', 'extra_services', 'logs', 'descartados.csv')

// Una sucursal con dueño (incluido el local "sin local") es de negocio: sus precios los
// carga sólo el usuario. La regla es por branch_id, no por empresa ni por producto.
const es_sucursal_negocio = (branch) => branch?.propietario_id != null

const motivo_sucursal_negocio = (branch_id) =>
    `sucursal de negocio (branch_id ${branch_id}): las importaciones no escriben sus precios`

// rechazados: [{ item, motivo }]
function registrar_descartes_csv(rechazados, tipo = 'producto') {
    try {
        fs.mkdirSync(path.dirname(CSV_DESCARTADOS), { recursive: true })
        const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
        let out = ''
        if (!fs.existsSync(CSV_DESCARTADOS) || fs.statSync(CSV_DESCARTADOS).size === 0) {
            out += 'fecha,origen,tipo,nombre,branch_id,motivo\n'
        }
        const fecha = new Date().toISOString().replace('T', ' ').slice(0, 19)
        for (const { item, motivo } of rechazados) {
            out += [fecha, 'importar', tipo, item?.name || item?.titulo || '', item?.branch_id || '', motivo].map(esc).join(',') + '\n'
        }
        fs.appendFileSync(CSV_DESCARTADOS, out)
    } catch (e) {
        console.log('[importar] no se pudo escribir CSV de descartados', e.message)
    }
}

module.exports = { es_sucursal_negocio, motivo_sucursal_negocio, registrar_descartes_csv }
