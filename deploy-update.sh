#!/usr/bin/env bash
set -uo pipefail

# ============================================================
#  deploy-update.sh
#  Actualiza un despliegue existente de lab_precios vía SSH.
#
#  Usuario del deploy: apps
#  Ruta del proyecto:  ~/ejecucion/lab_precios
#  Proceso PM2:        LAB_PRECIOS
#  Backend:            back/   (server.js, knex en back/migrations)
#  Frontend:           /var/www/PRECIOS (checkout aparte, build en front/)
# ============================================================

# ---------- defaults adaptados a lab_precios ----------
DEFAULT_PM2_NAME="LAB_PRECIOS"
DEFAULT_RUN_AS="apps"
DEFAULT_DEPLOY_PATH="~/ejecucion/lab_precios"
DEFAULT_FRONT_PATH="/var/www/PRECIOS"
DEFAULT_BRANCH="dev"

# ---------- variables configurables ----------
SSH_HOST=""
SSH_USER=""
SSH_PORT="22"
SSH_PASS=""
SSH_KEY=""
GIT_BRANCH="$DEFAULT_BRANCH"
DEPLOY_PATH="$DEFAULT_DEPLOY_PATH"
FRONT_PATH="$DEFAULT_FRONT_PATH"
PM2_NAME="$DEFAULT_PM2_NAME"
RUN_AS="$DEFAULT_RUN_AS"
GIT_USER=""
GIT_TOKEN=""
INTERACTIVE_BRANCH="yes"
INTERACTIVE_PATH="no"
INTERACTIVE_PM2="no"
INTERACTIVE_RUNAS="no"

# ---------- helpers ----------
die() { echo "ERROR: $1" >&2; exit 1; }
info() { echo "==> $1"; }

usage() {
  cat <<'EOF'
Uso: bash deploy-update.sh [--flag=valor ...]

Flags:
  -h, --host=HOST        IP o dominio del servidor (requerido)
  -u, --user=USUARIO     Usuario SSH (requerido)
  -p, --port=PUERTO      Puerto SSH (default: 22)
  -P, --password=CLAVE   Contraseña SSH (alternativa a -k)
  -k, --key=RUTA         Ruta a archivo .pem (alternativa a -P)
  -b, --branch=RAMA      Rama de git a desplegar (default: dev)
  -d, --deploy-path=RUTA Ruta del proyecto backend en el servidor (default: ~/ejecucion/lab_precios)
      --front-path=RUTA  Ruta del frontend (checkout aparte) en el servidor (default: /var/www/PRECIOS)
  -n, --pm2-name=NOMBRE  Nombre del proceso PM2 (default: LAB_PRECIOS)
  -r, --run-as=USUARIO   Usuario dueño del deploy (default: apps)
      --git-user=USUARIO Usuario de GitHub (solo repos HTTPS privados)
      --git-token=TOKEN  Token PAT de GitHub (solo repos HTTPS privados)
EOF
}

# ---------- parseo de flags (sin parámetros posicionales) ----------
for arg in "$@"; do
  case "$arg" in
    --host=*)        SSH_HOST="${arg#*=}" ;;
    --user=*)        SSH_USER="${arg#*=}" ;;
    --port=*)        SSH_PORT="${arg#*=}" ;;
    --password=*)    SSH_PASS="${arg#*=}" ;;
    --key=*)         SSH_KEY="${arg#*=}" ;;
    --branch=*)      GIT_BRANCH="${arg#*=}"; INTERACTIVE_BRANCH="no" ;;
    --deploy-path=*) DEPLOY_PATH="${arg#*=}" ;;
    --front-path=*)  FRONT_PATH="${arg#*=}" ;;
    --pm2-name=*)    PM2_NAME="${arg#*=}" ;;
    --run-as=*)      RUN_AS="${arg#*=}" ;;
    --git-user=*)    GIT_USER="${arg#*=}" ;;
    --git-token=*)   GIT_TOKEN="${arg#*=}" ;;
    -h|--help)       usage; exit 0 ;;
    *) die "Flag desconocido: $arg (usa --help)" ;;
  esac
done

# flags cortos con valor separado
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h) SSH_HOST="$2"; shift 2 ;;
    -u) SSH_USER="$2"; shift 2 ;;
    -p) SSH_PORT="$2"; shift 2 ;;
    -P) SSH_PASS="$2"; shift 2 ;;
    -k) SSH_KEY="$2"; shift 2 ;;
    -b) GIT_BRANCH="$2"; INTERACTIVE_BRANCH="no"; shift 2 ;;
    -d) DEPLOY_PATH="$2"; shift 2 ;;
    --front-path) FRONT_PATH="$2"; shift 2 ;;
    -n) PM2_NAME="$2"; shift 2 ;;
    -r) RUN_AS="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ---------- validar inputs requeridos ----------
[ -n "$SSH_HOST" ] || die "Falta el host (--host)"
[ -n "$SSH_USER" ] || die "Falta el usuario SSH (--user)"

# método de autenticación: exclusivo -P o -k
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

# ---------- preguntas interactivas ----------
if [ "$INTERACTIVE_BRANCH" = "yes" ]; then
  read -r -p "Rama de git a desplegar [${DEFAULT_BRANCH}]: " ANS
  GIT_BRANCH="${ANS:-$DEFAULT_BRANCH}"
fi
if [ "$INTERACTIVE_PATH" = "yes" ]; then
  read -r -p "Ruta del proyecto en el servidor [${DEFAULT_DEPLOY_PATH}]: " ANS
  DEPLOY_PATH="${ANS:-$DEFAULT_DEPLOY_PATH}"
fi
if [ "$INTERACTIVE_PM2" = "yes" ]; then
  read -r -p "Nombre del proceso PM2 [${DEFAULT_PM2_NAME}]: " ANS
  PM2_NAME="${ANS:-$DEFAULT_PM2_NAME}"
fi
if [ "$INTERACTIVE_RUNAS" = "yes" ]; then
  read -r -p "Usuario dueño del deploy [${DEFAULT_RUN_AS}]: " ANS
  RUN_AS="${ANS:-$DEFAULT_RUN_AS}"
fi

# ---------- bump de versión local (antes de desplegar) ----------
# Igual que profesionales.top: +0.0.1 en front/ y back/, commit y push a la rama
# antes de conectar por SSH, así el servidor hace pull de la versión ya bumpeada.
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
info "Verificando working tree local antes del bump de versión"
CURRENT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
[ "$CURRENT_BRANCH" = "$GIT_BRANCH" ] \
  || die "La rama local (${CURRENT_BRANCH}) no coincide con GIT_BRANCH (${GIT_BRANCH}); cambiá de rama antes de desplegar"
[ -z "$(git -C "$REPO_ROOT" status --porcelain)" ] \
  || die "Hay cambios sin commitear en ${REPO_ROOT}; commiteá o descartalos antes de desplegar"
git -C "$REPO_ROOT" fetch origin "$GIT_BRANCH" || die "No se pudo hacer fetch de origin/${GIT_BRANCH}"
[ "$(git -C "$REPO_ROOT" rev-parse HEAD)" = "$(git -C "$REPO_ROOT" rev-parse "origin/${GIT_BRANCH}")" ] \
  || die "La rama local ${GIT_BRANCH} no está sincronizada con origin/${GIT_BRANCH}; hacé pull/push antes de desplegar"

info "Aplicando bump de versión (+0.0.1) en front/ y back/"
(cd "$REPO_ROOT/front" && npm version patch --no-git-tag-version >/dev/null) || die "Falló el bump en front/"
(cd "$REPO_ROOT/back" && npm version patch --no-git-tag-version >/dev/null) || die "Falló el bump en back/"
FRONT_NEW_VERSION="$(node -p "require('${REPO_ROOT}/front/package.json').version")"
BACKEND_NEW_VERSION="$(node -p "require('${REPO_ROOT}/back/package.json').version")"
echo "  front -> ${FRONT_NEW_VERSION}"
echo "  back  -> ${BACKEND_NEW_VERSION}"

git -C "$REPO_ROOT" add front/package.json front/package-lock.json back/package.json back/package-lock.json
git -C "$REPO_ROOT" commit -m "chore: bump de versión por deploy (front ${FRONT_NEW_VERSION}, back ${BACKEND_NEW_VERSION})" \
  || die "Falló el commit del bump de versión"
git -C "$REPO_ROOT" push origin "$GIT_BRANCH" || die "Falló el push del bump de versión a ${GIT_BRANCH}"

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

cleanup() {
  [ -n "${PWDFILE:-}" ] && rm -f "$PWDFILE"
}
trap cleanup EXIT

# ---------- ejecutar despliegue remoto ----------
info "Conectando a $SSH_USER@$SSH_HOST (puerto $SSH_PORT)..."

run_remote "test -d $DEPLOY_PATH/.git && echo OK || echo NO_GIT" | grep -q "OK" \
  || die "No se encontró un repo git en $DEPLOY_PATH (usa deploy-produccion para el despliegue inicial)"
run_remote "test -d $FRONT_PATH/.git && echo OK || echo NO_GIT" | grep -q "OK" \
  || die "No se encontró un repo git en $FRONT_PATH (usa deploy-produccion para el despliegue inicial)"

# Evitar el error de git "posesión dudosa" (dubious ownership): el repo puede estar
# bajo un propietario distinto al usuario SSH (p.ej. apps/www-data). Cada comando git
# se ejecuta con -c safe.directory='*' inline para que la confianza se aplique en el
# mismo proceso que ejecuta la operación, sin depender de config entre sesiones SSH.
# Adicionalmente se registra safe.directory a nivel de sistema como respaldo persistente.
info "Registrando safe.directory para git (evita 'posesión dudosa')"
run_remote "git config --system --add safe.directory $DEPLOY_PATH 2>&1 || true"
run_remote "git config --system --add safe.directory $FRONT_PATH 2>&1 || true"

GIT() { run_remote "git -c safe.directory='*' $@"; }

info "Cambios locales no commiteados -> git stash (backend y frontend)"
GIT -C $DEPLOY_PATH stash 2>&1 || true
GIT -C $FRONT_PATH stash 2>&1 || true

info "Checkout y pull de la rama $GIT_BRANCH"
if [ -n "$GIT_USER" ] && [ -n "$GIT_TOKEN" ]; then
  run_remote "cd $DEPLOY_PATH && git config credential.helper store && printf 'protocol=https\nhost=github.com\nusername=${GIT_USER}\npassword=${GIT_TOKEN}\n' | git credential approve"
  run_remote "cd $FRONT_PATH && git config credential.helper store && printf 'protocol=https\nhost=github.com\nusername=${GIT_USER}\npassword=${GIT_TOKEN}\n' | git credential approve"
fi
GIT -C $DEPLOY_PATH checkout "$GIT_BRANCH" && GIT -C $DEPLOY_PATH pull origin "$GIT_BRANCH" \
  || die "Falló el pull de la rama $GIT_BRANCH en $DEPLOY_PATH"
GIT -C $FRONT_PATH checkout "$GIT_BRANCH" && GIT -C $FRONT_PATH pull origin "$GIT_BRANCH" \
  || die "Falló el pull de la rama $GIT_BRANCH en $FRONT_PATH"

info "Verificando rama desplegada en frontend"
GIT -C $FRONT_PATH branch --show-current | grep -q "^$GIT_BRANCH$" \
  || die "El frontend no quedó en la rama $GIT_BRANCH"

if [ -n "$RUN_AS" ]; then
  info "Ajustando propietario a $RUN_AS"
  if [ "$SSH_USER" = "root" ]; then
    CHOWN_CMD="chown -R $RUN_AS:$RUN_AS $DEPLOY_PATH"
    CHOWN_FRONT_CMD="chown -R $RUN_AS:$RUN_AS $FRONT_PATH"
  else
    CHOWN_CMD="sudo chown -R $RUN_AS:$RUN_AS $DEPLOY_PATH"
    CHOWN_FRONT_CMD="sudo chown -R $RUN_AS:$RUN_AS $FRONT_PATH"
  fi
  run_remote "$CHOWN_CMD 2>&1" \
    || die "Fallo al ajustar propietario. Verifica permisos de root/sudo para el chown"
  run_remote "$CHOWN_FRONT_CMD 2>&1" \
    || die "Fallo al ajustar propietario de $FRONT_PATH. Verifica permisos de root/sudo para el chown"
fi

SUDO=""
[ -n "$RUN_AS" ] && SUDO="sudo -u $RUN_AS"

info "npm install en back/"
run_remote "cd $DEPLOY_PATH/back && $SUDO npm install 2>&1" || die "Falló npm install en back/"

info "npm install en $FRONT_PATH/front"
run_remote "cd $FRONT_PATH/front && $SUDO npm install 2>&1" || die "Falló npm install en front/"

info "Build del frontend"
run_remote "cd $FRONT_PATH/front && $SUDO npm run build 2>&1" || die "Falló el build del frontend"
run_remote "test -d $FRONT_PATH/front/dist && echo OK || echo NO_DIST" | grep -q "OK" \
  || die "No se generó dist/ en front"

info "Migraciones de base de datos (knex)"
run_remote "cd $DEPLOY_PATH/back && $SUDO npx knex migrate:latest 2>&1" || die "Fallaron las migraciones"

info "Reiniciando proceso PM2 $PM2_NAME"
run_remote "$SUDO pm2 restart $PM2_NAME 2>&1" || die "Falló pm2 restart $PM2_NAME"

echo
echo "============================================="
echo "  ACTUALIZACIÓN COMPLETADA"
echo "============================================="
echo "  Host:       $SSH_USER@$SSH_HOST"
echo "  Ruta backend:   $DEPLOY_PATH"
echo "  Ruta front:     $FRONT_PATH"
echo "  Rama:       $GIT_BRANCH"
echo "  PM2:        $PM2_NAME"
echo "  run-as:     ${RUN_AS:-usuario SSH}"
echo "============================================="
echo
info "Estado final de PM2:"
run_remote "$SUDO pm2 list 2>&1"
