#!/usr/bin/env bash
# Define (o restablece) la contraseña local de un usuario del sistema.
#
# Uso:
#   ./set_password.sh <email> <contraseña> [--crear]
#
#   --crear   Si el usuario no existe, lo crea con el rol "usuario".
#
# La contraseña se hashea con bcrypt (mismo esquema que el login local de la API).
# Si se omite la contraseña, se pide de forma interactiva (oculta).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  echo "Uso: $(basename "$0") <email> [contraseña] [--crear]" >&2
  exit 1
}

[ $# -ge 1 ] || usage

EMAIL="$1"
shift

PASSWORD=""
CREAR="0"
for arg in "$@"; do
  case "$arg" in
    --crear) CREAR="1" ;;
    -*)
      echo "Opción desconocida: $arg" >&2
      usage
      ;;
    *)
      if [ -z "$PASSWORD" ]; then
        PASSWORD="$arg"
      else
        echo "Parámetro inesperado: $arg" >&2
        usage
      fi
      ;;
  esac
done

if [ -z "$EMAIL" ]; then
  echo "El email es obligatorio." >&2
  exit 1
fi

if [ -z "$PASSWORD" ]; then
  if [ -t 0 ]; then
    read -rs -p "Contraseña para $EMAIL: " PASSWORD
    echo
    read -rs -p "Repetir contraseña: " PASSWORD2
    echo
    if [ "$PASSWORD" != "$PASSWORD2" ]; then
      echo "Las contraseñas no coinciden." >&2
      exit 1
    fi
  else
    echo "La contraseña es obligatoria (o ejecutar en una terminal interactiva)." >&2
    exit 1
  fi
fi

if [ -z "$PASSWORD" ]; then
  echo "La contraseña no puede estar vacía." >&2
  exit 1
fi

export SETPWD_EMAIL="$EMAIL"
export SETPWD_PASSWORD="$PASSWORD"
export SETPWD_CREAR="$CREAR"
export SETPWD_BACK_DIR="$BACK_DIR"
export DOTENV_CONFIG_QUIET=true

node - <<'NODE'
const path = require('path')
const backDir = process.env.SETPWD_BACK_DIR

require(path.join(backDir, 'node_modules', 'dotenv')).config({ path: path.join(backDir, '.env') })

const bcrypt = require(path.join(backDir, 'node_modules', 'bcrypt'))
const knexFactory = require(path.join(backDir, 'node_modules', 'knex'))
const knexConfig = require(path.join(backDir, 'knexfile'))

const email = String(process.env.SETPWD_EMAIL || '').trim()
const password = process.env.SETPWD_PASSWORD
const crear = process.env.SETPWD_CREAR === '1'

async function main() {
  const knex = knexFactory(knexConfig)
  try {
    const hash = await bcrypt.hash(password, 10)

    const usuario = await knex('usuarios')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .first()

    if (usuario) {
      await knex('usuarios').where({ id: usuario.id }).update({ pass: hash })
      console.log(`Contraseña actualizada para ${usuario.email} (id ${usuario.id}).`)
      return
    }

    if (!crear) {
      console.error(`No existe ningún usuario con email ${email}. Usá --crear para crearlo.`)
      process.exitCode = 2
      return
    }

    const local = email.split('@')[0]
    const nombre = local.charAt(0).toUpperCase() + local.slice(1)
    const [id] = await knex('usuarios').insert({
      name: nombre,
      apellido: null,
      email,
      pass: hash,
    })

    const rol = await knex('roles').where({ nombre: 'usuario' }).first()
    if (rol) {
      await knex('usuarios_roles').insert({ usuario_id: id, rol_id: rol.id })
    }

    console.log(`Usuario ${email} creado (id ${id}) con contraseña definida${rol ? ' y rol "usuario"' : ''}.`)
  } finally {
    await knex.destroy()
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
NODE
