# extra_services — Consumidor de la cola de precios

`actualizar_precios.py` es el **procesador** del sistema de importación: lee
items de la cola de a uno y los escribe en MySQL. Corre como proceso aparte del
backend y del servicio de colas.

```
Backend API (3001)  ──POST /add_data──▶  Servicio de Colas (3501)
                                              │
                        GET /get_data (1 item por request)
                                              ▼
                                   actualizar_precios.py  ──▶ MySQL
                                              │
                                              └──POST /interno/sync_cache──▶ API
```

## Por qué de a uno y no todo junto

Todos los días entran muchísimos artículos. Cada uno no es un `INSERT`: implica
resolver producto, alias de búsqueda, categoría, relación producto-categoría,
buscar el último precio de esa sucursal, calcular la variación, actualizar
`price_today` y las estadísticas incrementales. Volcar el lote completo de una
vez bloquearía tablas que la API pública está leyendo y dejaría un estado
imposible de retomar si se corta a mitad de camino.

Entonces: el scraper sube su lote al backend y se desentiende, el backend lo
encola item por item, y este script drena la cola al ritmo que la base tolera.
Lo que no se procesó todavía queda en la cola, no perdido.

## Qué procesa

Despacha según el campo `tipo` del item:

| `tipo`               | Función                      | Resultado                                                        |
|----------------------|------------------------------|------------------------------------------------------------------|
| `producto`           | `procesar_articulo()`        | Producto, categoría, precio, variación, `price_today` + sync de cache |
| `oferta`             | `procesar_oferta()`          | Valida duplicado y fecha, inserta en `promociones_hoy`           |
| `regenerar_precios`  | `subprocess`                 | Corre `back/scripts/recrear_price_today.js` y `pm2 restart LAB_PRECIOS` |

Cualquier otro `tipo` se descarta con log.

Además, cada 10 items procesados actualiza `incremental_stats` (`cant_price`,
`precios_hoy`, `cant_promos`) y limpia `price_today` /
`estadistica_aumento_diario` de registros anteriores a ayer.

## Reintentos y pérdida de datos

El servicio de colas no guarda estado por item, así que el contador de intentos
viaja dentro del item (`_intentos`):

- **Fallo permanente** (campo obligatorio faltante, categoría no especificada,
  oferta duplicada o anterior a ayer): se descarta con log. Reintentar daría
  exactamente lo mismo.
- **Fallo transitorio** (base caída, deadlock, timeout, excepción inesperada):
  se reencola con `POST /add_data` y `_intentos + 1`, hasta `QUEUE_MAX_RETRY`.
- Con fallos transitorios **consecutivos** la espera crece
  (`QUEUE_RETRY_BACKOFF` × fallos seguidos, tope `QUEUE_RETRY_BACKOFF_MAX`):
  sin eso, una base caída haría que el script drene la cola completa
  descartando todo.

## Ejecución

```bash
cd extra_services
./setup_and_run.sh      # crea el venv, instala dependencias y arranca el script
```

O manualmente:

```bash
source venv/bin/activate
python3 actualizar_precios.py
```

En producción conviene dejarlo bajo un supervisor (pm2 / systemd) para que
levante solo: si el consumidor está caído la cola crece, no se pierde nada, pero
los precios del día no se publican.

`Ctrl+C` corta de forma ordenada e imprime el resumen (procesados, reencolados,
descartados, errores).

## Configuración

Lee `back/.env` (ver [`env.example`](../env.example)).

**Base de datos:** `mysql_host`, `mysql_user`, `mysql_password`,
`mysql_database`, `mysql_port`.

**Cola y procesamiento:**

| Variable                   | Default                 | Para qué                                           |
|----------------------------|-------------------------|----------------------------------------------------|
| `QUEUE_SERVICE_URL`        | `http://localhost:3501` | Servicio de colas                                  |
| `QUEUE_KEY`                | `precios`               | Cola de la que consume                             |
| `QUEUE_POLL_INTERVAL`      | `1`                     | Segundos de espera con la cola vacía               |
| `QUEUE_MAX_RETRY`          | `3`                     | Reintentos antes de descartar                      |
| `QUEUE_RETRY_BACKOFF`      | `5`                     | Segundos de pausa por fallo transitorio consecutivo|
| `QUEUE_RETRY_BACKOFF_MAX`  | `60`                    | Tope de esa pausa                                  |
| `QUEUE_BACKLOG_LOG_EVERY`  | `100`                   | Cada cuántos items loguea el backlog (`0` = nunca) |

**Sync de cache de la API:** `internal_sync_key` (obligatoria para que el sync
ocurra), `API_BASE_URL` (default `http://localhost`), `service_port_api`.

Sin `internal_sync_key` el script procesa igual, pero el cache en memoria de la
API queda desactualizado hasta que el servidor se reinicie.

## Diagnóstico

```bash
# ¿Cuánto atraso hay?
curl "http://localhost:3501/count_data?clave=precios"

# ¿El servicio de colas responde?
curl -i "http://localhost:3501/health"
```

Si la cola crece y el log del consumidor no muestra items procesados, el
problema está en la base o en el propio script, no en el encolado.

## Referencias

- [Especificación del servicio de colas](ESPECIFICACION_SERVICIO_COLAS.md)
- [Integración del backend](../back/documentacion/servicio_colas_externo.md)
- [Diagnóstico de conectividad](../back/DIAGNOSTICO_SERVICIO_COLAS.md)
