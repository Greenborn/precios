// Renombra los locales "sin local" que se crearon con el nombre y apellido del usuario.
// Solo los inequívocos: local y comercio se llaman exactamente como el usuario, ese no es su
// nombre comercial y el comercio no tiene otros locales. Idempotente.
const crypto = require('crypto')

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const sufijo = () => [...crypto.randomBytes(8)].map((b) => ALFABETO[b % ALFABETO.length]).join('')

exports.up = async function (knex) {
  const filas = await knex('branch as b')
    .join('enterprice as e', 'e.id', 'b.enterprise_id')
    .join('usuarios as u', 'u.id', 'b.propietario_id')
    .leftJoin('perfiles as p', 'p.usuario_id', 'u.id')
    .where('b.sin_local', 1)
    .select('b.id', 'b.enterprise_id', 'b.branch_name', 'e.name as comercio', 'u.name', 'u.apellido', 'p.nombre_comercial')

  for (const f of filas) {
    const del_usuario = [f.name, f.apellido].filter(Boolean).join(' ').trim().slice(0, 200)
    const comercial = String(f.nombre_comercial || '').trim()
    if (!del_usuario || f.branch_name !== del_usuario || f.comercio !== del_usuario) continue
    if (comercial.toLowerCase() === del_usuario.toLowerCase()) continue
    const otro = await knex('branch').where('enterprise_id', f.enterprise_id).whereNot('id', f.id).first('id')
    if (otro) continue

    // Mismo criterio que el alta: nombre comercial o genérico (enterprice.name es único)
    const base = comercial.slice(0, 189).trim()
    let nombre = base || `Comercio sin nombre ${sufijo()}`
    while (await knex('enterprice').where('name', nombre).first('id')) {
      nombre = base ? `${base} (${sufijo()})` : `Comercio sin nombre ${sufijo()}`
    }
    await knex.transaction(async (trx) => {
      await trx('enterprice').where('id', f.enterprise_id).update({ name: nombre })
      await trx('branch').where('id', f.id).update({ branch_name: nombre })
    })
    console.log(`[migracion] local sin_local ${f.id} renombrado`)
  }
}

// Sin reversión: no se restauran nombres personales
exports.down = async function () {}
