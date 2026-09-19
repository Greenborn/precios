const express = require('express')
var router = express.Router()
module.exports = router

router.post('/', async function (req, res) {
    const KEY = req.body?.key
    try {
        const KEY_VALID = process.env.KEY_INT
        if (KEY != KEY_VALID) {
            res.status(200).send({ stat: false, error: "Error de autenticación" })
            return
        }

        const DATOS_ENTERPRICE = req.body?.enterprice
        const DATOS_BRANCH = req.body?.branch

        if (!DATOS_ENTERPRICE?.name) {
            res.status(200).send({ stat: false, error: "Falta campo requerido: enterprice.name" })
            return
        }
        if (!DATOS_BRANCH?.branch_name) {
            res.status(200).send({ stat: false, error: "Falta campo requerido: branch.branch_name" })
            return
        }

        if (DATOS_ENTERPRICE?.website) {
            const existente = await global.knex('enterprice').where('website', DATOS_ENTERPRICE.website).first()
            if (existente) {
                res.status(200).send({ stat: false, error: "Ya existe un comercio con esa URL" })
                return
            }
        }

        const trx = await global.knex.transaction()
        let nuevoEnterpriceId, nuevoBranchId

        try {
            const [insertEnterpriceId] = await trx('enterprice').insert({
                name: DATOS_ENTERPRICE.name,
                type: DATOS_ENTERPRICE.type || null,
                website: DATOS_ENTERPRICE.website || null,
                logo_url: DATOS_ENTERPRICE.logo_url || null,
                active: DATOS_ENTERPRICE.active !== undefined ? DATOS_ENTERPRICE.active : true
            })
            nuevoEnterpriceId = Number(insertEnterpriceId)

            const [insertBranchId] = await trx('branch').insert({
                branch_name: DATOS_BRANCH.branch_name,
                enterprise_id: nuevoEnterpriceId,
                address: DATOS_BRANCH.address || null,
                latitude: DATOS_BRANCH.latitude || null,
                longitude: DATOS_BRANCH.longitude || null,
                city: DATOS_BRANCH.city || null
            })
            nuevoBranchId = Number(insertBranchId)

            await trx.commit()
        } catch (err) {
            await trx.rollback()
            console.error('[comercios] Error en transacción:', err)
            const errorMsg = err.code === 'ER_DUP_ENTRY'
                ? "Ya existe un comercio con ese nombre"
                : "Error interno al crear comercio"
            res.status(200).send({ stat: false, error: errorMsg })
            return
        }

        try {
            // require lazy: evita dependencia circular con server.js al cargar el router
            const { regenerar_diccionarios } = require('../server')
            await regenerar_diccionarios()
        } catch (err) {
            console.error('[comercios] Error al regenerar diccionarios:', err)
        }

        res.status(200).send({
            stat: true,
            items: {
                enterprice: {
                    id: nuevoEnterpriceId,
                    name: DATOS_ENTERPRICE.name,
                    type: DATOS_ENTERPRICE.type || null,
                    website: DATOS_ENTERPRICE.website || null,
                    logo_url: DATOS_ENTERPRICE.logo_url || null,
                    active: DATOS_ENTERPRICE.active !== undefined ? DATOS_ENTERPRICE.active : true
                },
                branch: {
                    id: nuevoBranchId,
                    branch_name: DATOS_BRANCH.branch_name,
                    enterprise_id: nuevoEnterpriceId,
                    address: DATOS_BRANCH.address || null,
                    latitude: DATOS_BRANCH.latitude || null,
                    longitude: DATOS_BRANCH.longitude || null,
                    city: DATOS_BRANCH.city || null
                }
            }
        })

    } catch (error) {
        console.error('[comercios] Error:', error)
        res.status(200).send({ stat: false, error: "Error interno, reintente luego" })
    }
})
