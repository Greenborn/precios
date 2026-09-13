const express = require('express')
require("dotenv").config({ path: '../.env' })
var router = express.Router()
module.exports = router
const alias_busqueda_ctrl = require("../controllers/alias_busqueda")

// Lista de alias (termino inicial -> termino final) con paginacion
router.get('/', async function (req, res) {
    try {
        const salida = await alias_busqueda_ctrl.listar(req.query?.page, req.query?.limit)
        res.status(200).send({ stat: true, ...salida })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    }
})

// Crear definicion de alias: { alias: termino inicial, termino: termino final (canonico) }
router.post('/', async function (req, res) {
    try {
        const salida = await alias_busqueda_ctrl.crear(req.body?.alias, req.body?.termino)
        if (salida.stat) {
            await alias_busqueda_ctrl.recargar()
            return res.status(200).send(salida)
        }
        res.status(200).send({ stat: false, error: salida.error })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    }
})

// Eliminar definicion por id (?id=N). Se usa query param para que el path
// quede declarado en middleware/Admin.js y aplique el permiso correspondiente
router.delete('/', async function (req, res) {
    try {
        const salida = await alias_busqueda_ctrl.eliminar(req.query?.id)
        if (salida.stat) {
            await alias_busqueda_ctrl.recargar()
            return res.status(200).send({ stat: true })
        }
        res.status(200).send({ stat: false, error: "No existe el alias indicado" })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    }
})

// Recarga el diccionario en memoria sin reiniciar el servicio
router.post('/recargar', async function (req, res) {
    try {
        const cantidad = await alias_busqueda_ctrl.recargar()
        res.status(200).send({ stat: true, cantidad })
    } catch (error) {
        console.log("error", error)
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    }
})
