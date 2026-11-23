#!/usr/bin/env bash
# Inicia el servidor de desarrollo (backend + frontend).
# Uso: ./dev.sh [--back|--front]
#   (sin flag)  levanta backend y frontend juntos
#   --back      solo backend  (nodemon, puerto de service_port_api)
#   --front     solo frontend (vite, puerto 3000)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$ROOT_DIR/back"
FRONT_DIR="$ROOT_DIR/front"

BACK_PID=""
FRONT_PID=""

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "[dev] Deteniendo servidores..."
  # Matar solo los PID exactos lanzados por este script.
  [ -n "$BACK_PID" ]  && kill "$BACK_PID"  2>/dev/null || true
  [ -n "$FRONT_PID" ] && kill "$FRONT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "[dev] Listo."
}
trap cleanup INT TERM EXIT

command -v node >/dev/null 2>&1 || { echo "[dev] ERROR: node no está instalado."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "[dev] ERROR: npm no está instalado.";  exit 1; }

install_deps() {
  local dir="$1"
  if [ ! -d "$dir/node_modules" ]; then
    echo "[dev] Instalando dependencias en $dir ..."
    (cd "$dir" && npm install)
  fi
}

api_port() {
  local port=""
  if [ -f "$BACK_DIR/.env" ]; then
    port="$(grep -E '^service_port_api=' "$BACK_DIR/.env" | head -n1 | cut -d= -f2- | sed -E 's/[[:space:]]*#.*$//' | tr -d '[:space:]')"
  fi
  echo "${port:-3044}"
}

# Asegura que el dev server use la API local SIN tocar front/.env (el que se
# usa para el build de produccion). Vite carga .env.development solo en modo
# development, asi que el build de produccion (`npm run build`) no se ve afectado.
ensure_front_local_api() {
  local envidia="$FRONT_DIR/.env.development"
  local local_api="http://localhost:$(api_port)"
  local current=""

  if [ -f "$envidia" ]; then
    current="$(grep -E '^VITE_APP_BACKEND_ADMIN=' "$envidia" | tail -n1 | cut -d= -f2- | sed -E "s/[[:space:]\"']//g")"
  fi

  [ "$current" = "$local_api" ] && return 0

  if [ -f "$envidia" ] && grep -qE '^VITE_APP_BACKEND_ADMIN=' "$envidia"; then
    local tmp
    tmp="$(mktemp)"
    sed -E "s|^VITE_APP_BACKEND_ADMIN=.*|VITE_APP_BACKEND_ADMIN=${local_api}|" "$envidia" > "$tmp"
    mv "$tmp" "$envidia"
  else
    {
      [ -s "$envidia" ] || echo "# Generado por dev.sh: fuerza la API local en desarrollo (no afecta el build de produccion)."
      echo "VITE_APP_BACKEND_ADMIN=${local_api}"
    } >> "$envidia"
  fi
  echo "[dev] Frontend apuntando a la API local: ${local_api}"
}

start_back() {
  [ -f "$BACK_DIR/.env" ] || { echo "[dev] ERROR: falta $BACK_DIR/.env"; exit 1; }
  install_deps "$BACK_DIR"
  echo "[dev] Iniciando backend (nodemon)..."
  (cd "$BACK_DIR" && npm start) &
  BACK_PID=$!
}

start_front() {
  [ -f "$FRONT_DIR/.env" ] || { echo "[dev] ERROR: falta $FRONT_DIR/.env"; exit 1; }
  ensure_front_local_api
  install_deps "$FRONT_DIR"
  echo "[dev] Iniciando frontend (vite :3000)..."
  (cd "$FRONT_DIR" && npm run dev) &
  FRONT_PID=$!
}

MODE="${1:-all}"
case "$MODE" in
  --back)  start_back ;;
  --front) start_front ;;
  all|"")  start_back; start_front ;;
  *) echo "Uso: $0 [--back|--front]"; exit 1 ;;
esac

wait
