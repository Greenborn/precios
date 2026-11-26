#!/usr/bin/env bash
set -uo pipefail

# ============================================================
#  restore-db-local.sh
#  Importa la última copia de seguridad de lab_precios
#  (generada por backup-db.sh) en la base de DESARROLLO local.
#
#  Credenciales y nombre de base: se leen de back/.env local
#  (mysql_host, mysql_port, mysql_user, mysql_password, mysql_database).
#  Origen: /media/debian/bk_01/lab_precios_db/lab_precios_*.sql.gz
#          (se toma el más reciente por nombre de archivo).
#
#  ATENCIÓN: borra y vuelve a crear la base local antes de importar.
# ============================================================

# ---------- defaults (mismos que backup-db.sh) ----------
DEFAULT_BACKUP_ROOT="/media/debian/bk_01"
DEFAULT_BACKUP_SUBDIR="lab_precios_db"
DEFAULT_DB_LABEL="lab_precios"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/back/.env"

BACKUP_ROOT="$DEFAULT_BACKUP_ROOT"
BACKUP_SUBDIR="$DEFAULT_BACKUP_SUBDIR"
DB_LABEL="$DEFAULT_DB_LABEL"
BACKUP_FILE=""
ASSUME_YES=0
DRY_RUN=0

# ---------- helpers ----------
die() { echo "ERROR: $1" >&2; exit 1; }
info() { echo "==> $1"; }

usage() {
  cat <<'EOF'
Uso: bash restore-db-local.sh [opciones]

Importa el backup más reciente de lab_precios en la base local de desarrollo
(la definida en back/.env). BORRA la base local antes de importar.

Opciones:
  --file=RUTA          Usar un backup específico en vez del más reciente
  --backup-root=RUTA   Unidad de backups (default: /media/debian/bk_01)
  --subdir=NOMBRE      Subdirectorio dentro de backup-root (default: lab_precios_db)
  --yes                No pedir confirmación interactiva
  --dry-run            Mostrar qué se haría sin tocar la base
  -h, --help           Muestra esta ayuda
EOF
}

# ---------- parseo de flags ----------
for arg in "$@"; do
  case "$arg" in
    --file=*)        BACKUP_FILE="${arg#*=}" ;;
    --backup-root=*) BACKUP_ROOT="${arg#*=}" ;;
    --subdir=*)      BACKUP_SUBDIR="${arg#*=}" ;;
    --yes)           ASSUME_YES=1 ;;
    --dry-run)       DRY_RUN=1 ;;
    -h|--help)       usage; exit 0 ;;
    *) die "Flag desconocido: $arg (usa --help)" ;;
  esac
done

# ---------- dependencias ----------
command -v mysql >/dev/null || die "mysql (cliente) no instalado"
command -v gzip  >/dev/null || die "gzip no instalado"
command -v node  >/dev/null || die "node no instalado (se usa para leer back/.env con dotenv)"
[ -f "$ENV_FILE" ] || die "No existe $ENV_FILE"
[ -d "$SCRIPT_DIR/back/node_modules/dotenv" ] || die "Falta dotenv en back/node_modules (ejecuta npm install en back/)"

# ---------- leer credenciales de back/.env ----------
# Mismo método que backup-db.sh: dotenv parsea el archivo y se exportan solo las claves MySQL.
DB_ENV_LINES="$(cd "$SCRIPT_DIR/back" && node -e '
const p = require("dotenv").config({ path: process.argv[1], quiet: true }).parsed || {};
const q = v => "\x27" + String(v).split("\x27").join("\x27\\\x27\x27") + "\x27";
for (const k of ["mysql_host", "mysql_port", "mysql_user", "mysql_password", "mysql_database"]) {
  if (p[k] !== undefined) console.log("DB_" + k.toUpperCase() + "=" + q(p[k]));
}
' "$ENV_FILE" 2>/dev/null | grep '^DB_')" || die "No se pudieron leer las variables de $ENV_FILE"
eval "$DB_ENV_LINES"

[ -n "${DB_MYSQL_DATABASE:-}" ] || die "mysql_database no definido en back/.env"
[ -n "${DB_MYSQL_USER:-}" ]     || die "mysql_user no definido en back/.env"
DB_MYSQL_HOST="${DB_MYSQL_HOST:-localhost}"
DB_MYSQL_PORT="${DB_MYSQL_PORT:-3306}"

# ---------- elegir el backup ----------
BACKUP_DIR="$BACKUP_ROOT/$BACKUP_SUBDIR"
if [ -z "$BACKUP_FILE" ]; then
  [ -d "$BACKUP_DIR" ] || die "No existe el directorio de backups: $BACKUP_DIR (¿unidad montada?)"
  BACKUP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_LABEL}_*.sql.gz" -printf '%f\n' \
    | sort | tail -n 1)"
  [ -n "$BACKUP_FILE" ] || die "No hay backups ${DB_LABEL}_*.sql.gz en $BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi
[ -f "$BACKUP_FILE" ] || die "No existe el backup: $BACKUP_FILE"

info "Backup:          $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
info "Base destino:    $DB_MYSQL_DATABASE en $DB_MYSQL_HOST:$DB_MYSQL_PORT (usuario $DB_MYSQL_USER)"

# ---------- validaciones del backup ----------
gzip -t "$BACKUP_FILE" || die "El archivo comprimido está corrupto"
zcat "$BACKUP_FILE" | tail -n 2 | grep -q "Dump completed" \
  || die "El backup no terminó correctamente (falta la línea 'Dump completed')"

if [ "$DRY_RUN" -eq 1 ]; then
  info "Dry-run: no se modificó la base."
  exit 0
fi

# ---------- confirmación ----------
if [ "$ASSUME_YES" -ne 1 ]; then
  echo
  echo "ADVERTENCIA: se BORRARÁ la base '$DB_MYSQL_DATABASE' local y se reemplazará por el backup."
  read -r -p "Escriba el nombre de la base para confirmar: " CONFIRM
  [ "$CONFIRM" = "$DB_MYSQL_DATABASE" ] || die "Confirmación incorrecta. Operación cancelada."
fi

# ---------- cliente MySQL ----------
# La contraseña viaja por MYSQL_PWD (no aparece en la lista de procesos).
export MYSQL_PWD="${DB_MYSQL_PASSWORD:-}"
MYSQL_ARGS=(-h "$DB_MYSQL_HOST" -P "$DB_MYSQL_PORT" -u "$DB_MYSQL_USER")

# Nombre de base validado: solo caracteres seguros para interpolar en SQL.
[[ "$DB_MYSQL_DATABASE" =~ ^[A-Za-z0-9_]+$ ]] || die "Nombre de base no soportado: $DB_MYSQL_DATABASE"

info "Recreando la base '$DB_MYSQL_DATABASE' vacía..."
mysql "${MYSQL_ARGS[@]}" -e "DROP DATABASE IF EXISTS \`$DB_MYSQL_DATABASE\`; CREATE DATABASE \`$DB_MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
  || die "No se pudo recrear la base '$DB_MYSQL_DATABASE'"

info "Importando backup (puede tardar varios minutos)..."
zcat "$BACKUP_FILE" | mysql "${MYSQL_ARGS[@]}" --default-character-set=utf8mb4 "$DB_MYSQL_DATABASE" \
  || die "Falló la importación del backup"

TABLES="$(mysql "${MYSQL_ARGS[@]}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_MYSQL_DATABASE';")"

echo
echo "============================================="
echo "  RESTAURACIÓN COMPLETADA"
echo "============================================="
echo "  Backup:   $BACKUP_FILE"
echo "  Base:     $DB_MYSQL_DATABASE ($DB_MYSQL_HOST)"
echo "  Tablas:   $TABLES"
echo "============================================="
