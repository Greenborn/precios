#!/usr/bin/env bash
set -uo pipefail

# ============================================================
#  backup-db.sh
#  Genera un backup (mysqldump comprimido) de la base de datos
#  de lab_precios vía SSH y lo guarda en la unidad local de backups.
#
#  Credenciales MySQL: se leen del .env remoto (back/.env) en el
#  servidor, así no hace falta conocerlas localmente.
#  Destino local:  /media/debian/bk_01/lab_precios_db/
#  Archivo:        <base>_<YYYYmmdd_HHMMSS>.sql.gz
# ============================================================

# ---------- defaults adaptados a lab_precios ----------
DEFAULT_RUN_AS="apps"
DEFAULT_DEPLOY_PATH="/home/apps/ejecucion/lab_precios"
DEFAULT_BACKUP_ROOT="/media/debian/bk_01"
DEFAULT_BACKUP_SUBDIR="lab_precios_db"

# ---------- variables configurables ----------
SSH_HOST=""
SSH_USER=""
SSH_PORT="22"
SSH_PASS=""
SSH_KEY=""
DEPLOY_PATH="$DEFAULT_DEPLOY_PATH"
RUN_AS="$DEFAULT_RUN_AS"
BACKUP_ROOT="$DEFAULT_BACKUP_ROOT"
BACKUP_SUBDIR="$DEFAULT_BACKUP_SUBDIR"

# ---------- helpers ----------
die() { echo "ERROR: $1" >&2; exit 1; }
info() { echo "==> $1"; }

usage() {
  cat <<'EOF'
Uso: bash backup-db.sh [--flag=valor ...]

Flags:
  --host=HOST          IP o dominio del servidor (requerido)
  --user=USUARIO       Usuario SSH (requerido)
  --port=PUERTO        Puerto SSH (default: 22)
  --password=CLAVE     Contraseña SSH (alternativa a --key)
  --key=RUTA           Ruta a archivo .pem (alternativa a --password)
  --deploy-path=RUTA   Ruta del proyecto backend en el servidor (default: /home/apps/ejecucion/lab_precios)
  --run-as=USUARIO     Usuario dueño del deploy; si se indica, mysqldump corre vía sudo -u (default: apps)
  --backup-root=RUTA   Unidad local de backups (default: /media/debian/bk_01)
  --subdir=NOMBRE      Subdirectorio dentro de backup-root (default: lab_precios_db)
  -h, --help           Muestra esta ayuda
EOF
}

# ---------- parseo de flags ----------
for arg in "$@"; do
  case "$arg" in
    --host=*)        SSH_HOST="${arg#*=}" ;;
    --user=*)        SSH_USER="${arg#*=}" ;;
    --port=*)        SSH_PORT="${arg#*=}" ;;
    --password=*)    SSH_PASS="${arg#*=}" ;;
    --key=*)         SSH_KEY="${arg#*=}" ;;
    --deploy-path=*) DEPLOY_PATH="${arg#*=}" ;;
    --run-as=*)      RUN_AS="${arg#*=}" ;;
    --backup-root=*) BACKUP_ROOT="${arg#*=}" ;;
    --subdir=*)      BACKUP_SUBDIR="${arg#*=}" ;;
    -h|--help)       usage; exit 0 ;;
    *) die "Flag desconocido: $arg (usa --help)" ;;
  esac
done

# ---------- validar inputs requeridos ----------
[ -n "$SSH_HOST" ] || die "Falta el host (--host)"
[ -n "$SSH_USER" ] || die "Falta el usuario SSH (--user)"

if [ -n "$SSH_PASS" ] && [ -n "$SSH_KEY" ]; then
  die "Elige un solo método de autenticación (--password o --key), no ambos"
fi
if [ -z "$SSH_PASS" ] && [ -z "$SSH_KEY" ]; then
  die "Falta método de autenticación: usa --password o --key"
fi
if [ -n "$SSH_KEY" ]; then
  [ -f "$SSH_KEY" ] || die "Archivo .pem no existe: $SSH_KEY"
  PERM="$(stat -c '%a' "$SSH_KEY")"
  [ "$PERM" = "600" ] || info "Aviso: el archivo .pem no tiene permisos 600 (actual: $PERM). Ejecuta: chmod 600 \"$SSH_KEY\""
  command -v ssh >/dev/null || die "ssh no instalado"
fi
if [ -n "$SSH_PASS" ]; then
  command -v sshpass >/dev/null || die "sshpass no instalado. Instalar con: apt install sshpass"
fi
command -v gzip >/dev/null || die "gzip no instalado"

# ---------- destino local ----------
# Se exige que backup-root esté montado para no escribir en el disco raíz por accidente.
mountpoint -q "$BACKUP_ROOT" || die "$BACKUP_ROOT no está montado; montá la unidad de backups antes de continuar"
BACKUP_DIR="$BACKUP_ROOT/$BACKUP_SUBDIR"
mkdir -p "$BACKUP_DIR" || die "No se pudo crear $BACKUP_DIR"
[ -w "$BACKUP_DIR" ] || die "Sin permisos de escritura en $BACKUP_DIR"

# ---------- comando SSH ----------
SSH_COMMON="-p $SSH_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
if [ -n "$SSH_KEY" ]; then
  SSH_CMD="ssh $SSH_COMMON -i $SSH_KEY $SSH_USER@$SSH_HOST"
else
  PWDFILE="$(mktemp)"
  printf '%s\n' "$SSH_PASS" > "$PWDFILE"
  chmod 600 "$PWDFILE"
  SSH_CMD="sshpass -f $PWDFILE ssh $SSH_COMMON $SSH_USER@$SSH_HOST"
fi

run_remote() {
  $SSH_CMD "$@"
}

PARTIAL_FILE=""
cleanup() {
  [ -n "${PWDFILE:-}" ] && rm -f "$PWDFILE"
  [ -n "$PARTIAL_FILE" ] && rm -f "$PARTIAL_FILE"
}
trap cleanup EXIT

# ---------- conexión y resolución de rutas remotas ----------
info "Conectando a $SSH_USER@$SSH_HOST (puerto $SSH_PORT)..."
REMOTE_HOME="$(run_remote 'echo "$HOME"')" || die "No se pudo conectar por SSH a $SSH_HOST"
[ -n "$REMOTE_HOME" ] || die "No se pudo determinar el HOME remoto"
DEPLOY_PATH="${DEPLOY_PATH/#\~/$REMOTE_HOME}"

run_remote "test -f $DEPLOY_PATH/back/.env && echo OK || echo NO_ENV" | grep -q "OK" \
  || die "No se encontró $DEPLOY_PATH/back/.env en el servidor (¿ruta de deploy correcta?)"

# ---------- script remoto ----------
# Se envía por stdin (heredoc sin expansión local). Lee las credenciales del .env
# con dotenv, y vuelca la base con mysqldump. La contraseña viaja por MYSQL_PWD,
# no como argumento, para que no aparezca en la lista de procesos.
REMOTE_SCRIPT=$(cat <<'REMOTE'
set -o pipefail
cd "$DEPLOY_PATH/back" || { echo "No se pudo entrar a $DEPLOY_PATH/back" >&2; exit 1; }

eval "$(node -e '
const p = require("dotenv").config({ quiet: true }).parsed || {};
const q = v => "\x27" + String(v).split("\x27").join("\x27\\\x27\x27") + "\x27";
for (const k of ["mysql_host", "mysql_port", "mysql_user", "mysql_password", "mysql_database"]) {
  if (p[k] !== undefined) console.log("DB_" + k.toUpperCase() + "=" + q(p[k]));
}
' 2>/dev/null | grep '^DB_')" || { echo "No se pudieron leer las variables de .env" >&2; exit 1; }

[ -n "${DB_MYSQL_DATABASE:-}" ] || { echo "mysql_database no definido en .env" >&2; exit 1; }

export MYSQL_PWD="${DB_MYSQL_PASSWORD:-}"
mysqldump \
  -h "${DB_MYSQL_HOST:-localhost}" \
  -P "${DB_MYSQL_PORT:-3306}" \
  -u "${DB_MYSQL_USER}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --no-tablespaces \
  --default-character-set=utf8mb4 \
  "$DB_MYSQL_DATABASE"
REMOTE
)

# ---------- ejecutar backup ----------
TS="$(date +%Y%m%d_%H%M%S)"
DB_LABEL="lab_precios"
FINAL_FILE="$BACKUP_DIR/${DB_LABEL}_${TS}.sql.gz"
PARTIAL_FILE="${FINAL_FILE}.partial"

info "Generando dump de la base (remoto) -> $FINAL_FILE"
if [ -n "$RUN_AS" ]; then
  REMOTE_CMD="sudo -u $RUN_AS env DEPLOY_PATH=$DEPLOY_PATH bash -s"
else
  REMOTE_CMD="env DEPLOY_PATH=$DEPLOY_PATH bash -s"
fi

printf '%s\n' "$REMOTE_SCRIPT" | run_remote "$REMOTE_CMD" | gzip -c > "$PARTIAL_FILE" \
  || die "Falló el mysqldump remoto (el archivo parcial fue descartado)"

info "Verificando integridad del archivo"
gzip -t "$PARTIAL_FILE" || die "El archivo comprimido está corrupto"
zcat "$PARTIAL_FILE" | tail -n 2 | grep -q "Dump completed" \
  || die "El dump no terminó correctamente (falta la línea 'Dump completed')"

mv "$PARTIAL_FILE" "$FINAL_FILE" || die "No se pudo mover el backup a $FINAL_FILE"
PARTIAL_FILE=""

echo
echo "============================================="
echo "  BACKUP COMPLETADO"
echo "============================================="
echo "  Host:     $SSH_USER@$SSH_HOST"
echo "  Archivo:  $FINAL_FILE"
echo "  Tamaño:   $(du -h "$FINAL_FILE" | cut -f1)"
echo "============================================="
