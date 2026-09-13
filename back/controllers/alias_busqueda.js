// Gestion del diccionario de alias de busqueda en memoria
// tabla alias_busqueda: alias (termino inicial que llega) -> termino (termino final / nombre canonico)

exports.recargar = async function () {
    const alias = await global.knex('alias_busqueda').select()
    const nuevo = {}
    if (alias)
        for (let i = 0; i < alias.length; i++)
            nuevo[alias[i].alias.toLowerCase()] = alias[i].termino
    global.alias_busqueda = nuevo
    return Object.keys(nuevo).length
}

exports.listar = async function (page = 1, limit = 100) {
    page = Number(page) > 0 ? Number(page) : 1
    limit = Number(limit) > 0 ? Math.min(Number(limit), 1000) : 100
    const items = await global.knex('alias_busqueda')
        .select()
        .orderBy('id', 'asc')
        .limit(limit)
        .offset((page - 1) * limit)
    const [{ total }] = await global.knex('alias_busqueda').count({ total: '*' })
    return { items, total: Number(total), page, limit }
}

exports.crear = async function (alias, termino) {
    alias = utils_limpiar(alias)
    termino = utils_limpiar(termino)
    if (!alias || !termino)
        return { stat: false, error: "alias y termino son obligatorios" }
    if (alias.length > 512 || termino.length > 512)
        return { stat: false, error: "alias y termino no pueden superar 512 caracteres" }

    const existente = await global.knex('alias_busqueda')
        .whereRaw('LOWER(alias) = ?', [alias.toLowerCase()])
        .first()
    if (existente)
        return { stat: false, error: "el termino inicial ya esta definido", existente }

    const [id] = await global.knex('alias_busqueda').insert({ alias, termino })
    return { stat: true, item: { id, alias, termino } }
}

exports.eliminar = async function (id) {
    const cant = await global.knex('alias_busqueda').where('id', id).del()
    return { stat: cant > 0 }
}

function utils_limpiar(texto) {
    const REPLACES = [['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u']]
    texto = String(texto ?? '').replace(/[;{}()\*/\\`'"]/g, '')
    texto = texto.replace(/[\r\n]/g, '')
    texto = texto.replace(/\s+/g, ' ')
    for (let i = 0; i < REPLACES.length; i++)
        texto = texto.replace(REPLACES[i][0], REPLACES[i][1])
    return texto.trim().toLowerCase()
}
