# Servicio de Colas Externo

## 📋 Descripción

La importación de precios atraviesa tres procesos independientes. El backend
**solo encola**: no procesa ni escribe en la base durante una importación.

```
Scrapers / clientes
   │  POST /importar, /importar_oferta, /regenerar_price_today  (lotes grandes)
   ▼
Backend API (Node, 3001)
   │  valida KEY, agrega `tipo` a cada item, POST /add_data (uno por item)
   ▼
Servicio de Colas (Node, 3501)  — externo a este repo
   │  almacena y persiste. No accede a MySQL
   │  GET /get_data (un item por request)
   ▼
Consumidor (Python, extra_services/actualizar_precios.py)
   │  procesa el item y escribe en MySQL
   ├──▶ MySQL
   └──▶ POST /interno/sync_cache  (refresca el cache en memoria de la API)
```

## 🎯 Responsabilidades

| Componente | Hace | No hace |
|------------|------|---------|
| **Backend API** (`routes/productos.js`) | Valida KEY y formato, agrega `tipo`, envía cada item a `/add_data`, responde al cliente cuántos items se aceptaron | No procesa colas, no tiene `setInterval`, no escribe en la base durante la importación, no reintenta |
| **Servicio de Colas** (puerto 3501) | Almacena items, los persiste, entrega uno por `/get_data`, informa profundidad por `/count_data` | No procesa, no conoce el formato de los items, no accede a MySQL |
| **Consumidor Python** (`extra_services/actualizar_precios.py`) | Toma items de a uno, ejecuta la lógica de importación, escribe en MySQL, actualiza estadísticas, reencola fallos transitorios, sincroniza el cache de la API | No recibe peticiones HTTP de clientes |

## 💡 Por qué está partido así

Todos los días entran **muchísimos artículos**. Volcarlos de golpe en la base no
es viable: cada item implica varias consultas (producto, alias de búsqueda,
categoría, relación, último precio, variación, `price_today`, estadísticas), un
lote grande en una sola pasada bloquea tablas que la API pública está leyendo, y
si se corta a mitad de camino no hay forma barata de saber qué quedó aplicado.

Con la cola en el medio:

- ✅ **El cliente no espera**: el scraper sube el lote y se desentiende; el
  endpoint responde en cuanto encoló.
- ✅ **Nada se pierde**: lo pendiente queda en la cola, incluso si el consumidor
  o el backend se reinician.
- ✅ **La base no ve picos**: el consumidor drena de a un item, al ritmo que la
  base tolera.
- ✅ **Desacoplamiento**: el procesamiento no comparte proceso ni event loop con
  la API pública.
- ✅ **Escalabilidad**: varias instancias del backend pueden encolar contra el
  mismo servicio.

---

## 🔧 Configuración

En `back/.env` (ver [`env.example`](../../env.example)):

```bash
QUEUE_SERVICE_URL=http://localhost:3501
```

El backend usa esa variable solo para encolar. Si no está definida usa
`http://localhost:3501` y lo avisa por log al cargar el módulo.

**Nota:** el servicio de colas y el consumidor Python son procesos aparte. Si el
servicio de colas no está arriba, las importaciones fallan al encolar; si el
consumidor no está arriba, las importaciones se aceptan pero nada llega a la
base hasta que se levante.

---

## 🚀 API del Servicio de Colas

Contrato completo en
[`extra_services/ESPECIFICACION_SERVICIO_COLAS.md`](../../extra_services/ESPECIFICACION_SERVICIO_COLAS.md).

### Agregar Item a la Cola — lo usa el backend

**Endpoint:** `POST /add_data`

```json
{
  "clave": "precios",
  "data": {
    "tipo": "producto",
    "name": "Producto X",
    "price": 1000,
    "branch_id": 5,
    "category_name": "Lácteos",
    "fecha_registro": "2025-12-30T15:00:00.000Z"
  }
}
```

**Respuestas:**
- `200`: `{ success: true }`
- `400`: `{ error: 'Clave inválida' }`

### Obtener y Eliminar Item — lo usa el consumidor Python

**Endpoint:** `GET /get_data?clave=precios`

**Respuestas:**
- `200`: `{ data: {...} }` — entrega un item y lo elimina de la cola
- `400`: `{ error: 'Clave inválida' }`
- `404`: `{ error: 'No hay datos para la clave' }` — cola vacía

### Contar Items — monitoreo

**Endpoint:** `GET /count_data?clave=precios`

**Respuestas:**
- `200`: `{ count: 42 }`
- `400`: `{ error: 'Clave inválida' }`

---

## 📦 Cola utilizada

Desde marzo de 2026 hay una **única cola**, `precios`. El campo `tipo` dentro
del objeto determina cómo lo procesa el consumidor.

### Estructura básica de cada item

```json
{
  "tipo": "producto" | "oferta" | "regenerar_precios", // obligatorio
  "fecha_registro": "Date|string",                     // obligatorio salvo regenerar_precios
  "_intentos": 0                                       // opcional, lo agrega el consumidor al reintentar
}
```

### Qué encola cada endpoint

| Endpoint del backend | `tipo` | Procesamiento en el consumidor |
|----------------------|--------|--------------------------------|
| `POST /importar` | `producto` | `procesar_articulo()` |
| `POST /importar_oferta` | `oferta` | `procesar_oferta()` |
| `POST /regenerar_price_today` | `regenerar_precios` | `back/scripts/recrear_price_today.js` + `pm2 restart LAB_PRECIOS` |

**Producto:**
```json
{
  "tipo": "producto",
  "name": "Leche La Serenísima 1L",
  "price": 850,
  "branch_id": 10,
  "category_name": "Lácteos",
  "fecha_registro": "2025-12-30T15:00:00.000Z"
}
```

**Oferta:**
```json
{
  "tipo": "oferta",
  "titulo": "Oferta especial",
  "precio": 500,
  "branch_id": 5,
  "url": "https://...",
  "fecha_registro": "2025-12-30T15:00:00.000Z"
}
```

### Flujo completo

1. Cliente → Backend (`/importar` ó `/importar_oferta`): valida KEY y datos,
   agrega la propiedad `tipo` a cada item.
2. Backend → `POST {QUEUE_SERVICE_URL}/add_data` con `clave: "precios"`, **un
   request por item**. Responde al cliente con el conteo de aceptados.
3. Consumidor Python → `GET /get_data?clave=precios` en bucle: mientras reciba
   items los procesa uno tras otro; con la cola vacía espera 1 segundo.
4. El consumidor escribe en MySQL, actualiza `incremental_stats` cada 10 items y
   notifica `POST /interno/sync_cache` para refrescar el cache de la API.

> Un solo canal de entrada permite escalar más fácilmente y añadir nuevos tipos
> sin tocar el servicio de colas.

---

## 🧩 Helper del backend

### `agregarACola(clave, data)` — `back/routes/productos.js`

Envía un item al servicio de colas vía `POST /add_data` con timeout de 5s.

**Retorna:**
- `true`: el servicio respondió `{ success: true }`
- `false`: error de conexión, timeout, status de error o respuesta inesperada
  (lo registra en consola con el detalle)

Los endpoints de importación lo llaman en un loop sobre el lote recibido y
cuentan los éxitos. **No hay reintentos en el backend**: un item que no se pudo
encolar se informa al cliente como no aceptado.

---

## 🚨 Manejo de Errores

### En el Backend (solo encolado)

Si el servicio de colas no está disponible:

- Se registra el error en consola:
  `[Cola precios] ✗ ERROR: No se puede conectar al servicio en http://localhost:3501`
- `agregarACola()` retorna `false`
- El cliente recibe el conteo de items aceptados vs. enviados

**Ejemplo de respuesta:**
```json
{
  "stat": true,
  "count": 95
}
```
(de 100 enviados, 95 fueron encolados)

### En el Consumidor Python (procesamiento y reintentos)

El consumidor clasifica cada fallo:

- **Permanente** — datos del item (campo obligatorio faltante, categoría no
  especificada, oferta duplicada o anterior a ayer): descarta con log.
  Reintentar daría el mismo resultado.
- **Transitorio** — base caída, deadlock, timeout, excepción inesperada:
  reencola el item con `POST /add_data` e `_intentos + 1`, hasta
  `QUEUE_MAX_RETRY` (3 por defecto); después lo descarta con log.
- Con fallos transitorios **consecutivos** pausa de forma incremental
  (`QUEUE_RETRY_BACKOFF` × fallos seguidos, tope `QUEUE_RETRY_BACKOFF_MAX`),
  para no drenar la cola completa contra una base que no responde.

El contador de intentos viaja dentro del item porque el servicio de colas no
guarda estado por item.

### En el Servicio de Colas

Responsable únicamente de no perder items: persistencia, entrega atómica en
`/get_data` y recuperación de pendientes tras un reinicio.

---

## 📊 Logs

### Backend (solo envío)

```
[importar] Se agregaron 100/100 items a la cola.
[importar_oferta] Se agregaron 25/30 ofertas a la cola.
```

En caso de error:
```
[Cola precios] ✗ ERROR: No se puede conectar al servicio en http://localhost:3501
[importar] Se agregaron 0/100 items a la cola.
```

### Consumidor Python (procesamiento)

```
[2026-10-21 03:15:22] Producto obtenido de la cola
Producto: leche la serenisima 1l
✓ Producto procesado (Total: 1240)
  → Estadísticas actualizadas
  → Cola 'precios': 18340 items pendientes
↻ Item reencolado (intento 1/3)
⊘ Oferta descartada: Oferta duplicada (título ya existe)
```

Al cortar con `Ctrl+C` imprime el resumen: procesados, reencolados,
descartados y errores.

---

## 📈 Rendimiento

- El backend encola un item por request HTTP: el costo de `/importar` crece
  lineal con el tamaño del lote, pero no toca la base.
- El consumidor procesa de a un item y pide el siguiente de inmediato. El
  techo real lo pone la base (varias consultas por artículo), no la cola.
- **Si el backlog crece y no baja** (`/count_data`), el consumidor está caído o
  no da abasto: los items no se pierden, pero los precios del día no se
  publican hasta que drene.

---

## 🔍 Verificación

### Estado de la cola

```bash
curl "http://localhost:3501/count_data?clave=precios"
```

### Encolar item de prueba

```bash
curl -X POST http://localhost:3501/add_data \
  -H "Content-Type: application/json" \
  -d '{
    "clave": "precios",
    "data": {
      "tipo": "producto",
      "name": "Test Product",
      "price": 100,
      "branch_id": 1,
      "category_name": "Test",
      "fecha_registro": "2025-12-30T00:00:00.000Z"
    }
  }'
```

Con el consumidor Python corriendo, el item debe desaparecer de la cola y
aparecer en la base. Para retirarlo a mano hay que detener el consumidor
primero (si no, lo toma él):

```bash
curl "http://localhost:3501/get_data?clave=precios"
```

Diagnóstico de conectividad backend ↔ servicio de colas:
[`back/DIAGNOSTICO_SERVICIO_COLAS.md`](../DIAGNOSTICO_SERVICIO_COLAS.md).

---

## 🗂️ Código histórico

El procesamiento en memoria dentro del backend fue eliminado en la migración al
servicio externo:

- ❌ `setInterval` de procesamiento de productos y ofertas
- ❌ `procesa_item()`, `obtenerDeCola()`, `contarItemsCola()`
- ❌ Limpieza de `estadistica_aumento_diario` y `promociones_hoy` en el backend

Esas responsabilidades están hoy en el consumidor Python.

`back/helpers/processing.js` (`procesarColaProc`, `marcarColaNoVacia`) quedó sin
uso en la importación; se mantiene por si sirve para otras colas en memoria.

### Archivos involucrados

1. [`env.example`](../../env.example) — `QUEUE_SERVICE_URL`, `internal_sync_key` y variables del consumidor
2. [`routes/productos.js`](../routes/productos.js) — encolado (`agregarACola`)
3. [`extra_services/actualizar_precios.py`](../../extra_services/actualizar_precios.py) — consumidor y procesamiento
4. [`extra_services/README.md`](../../extra_services/README.md) — operación del consumidor
5. [`extra_services/ESPECIFICACION_SERVICIO_COLAS.md`](../../extra_services/ESPECIFICACION_SERVICIO_COLAS.md) — contrato del servicio de colas

---

## 📝 TODO

- [ ] Endpoint en la API para exponer el estado de la cola (hoy hay que
      consultar `/count_data` del servicio a mano)
- [ ] Métricas de tiempo de procesamiento por item
- [ ] Dead letter queue para los items que el consumidor descarta
- [ ] Alertas por backlog que no baja
