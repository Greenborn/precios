// Portada y foto de perfil del negocio (archivos en uploads/perfiles).
exports.up = async function (knex) {
  for (const col of ['portada_archivo', 'foto_archivo']) {
    if (!(await knex.schema.hasColumn('perfiles', col))) {
      await knex.schema.alterTable('perfiles', (t) => t.string(col, 255).nullable())
    }
  }
}

exports.down = async function (knex) {
  for (const col of ['portada_archivo', 'foto_archivo']) {
    if (await knex.schema.hasColumn('perfiles', col)) {
      await knex.schema.alterTable('perfiles', (t) => t.dropColumn(col))
    }
  }
}
