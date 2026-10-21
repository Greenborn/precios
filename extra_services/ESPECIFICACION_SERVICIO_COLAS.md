# Especificación del Servicio de Colas Externo

## 📋 Resumen

El servicio de colas es un **buffer**, no un procesador. Su única
responsabilidad es almacenar items y entregarlos de a uno cuando se los pide.

```
Scrapers / clientes
      │  POST /importar, /importar_oferta  (lotes grandes)
      ▼
Backend API (Node, puerto 3001)          → valida KEY, agrega `tipo`, encola
      │  POST /add_data  (un item por request)
      ▼
Servicio de Colas (Node, puerto 3501)    → ALMACENA y PERSISTE. No toca la base
      │  GET /get_data   (un item por request)
      ▼
Consumidor (Python, extra_services/actualizar_precios.py)
      │                                  → PROCESA y escribe en MySQL
      ▼
MySQL  +  POST /interno/sync_cache (avisa a la API para refrescar su cache)
```

### Por qué existe la cola

Todos los días entran **muchísimos artículos** (decenas de miles entre
productos y ofertas). Volcarlos de golpe en la base no es viable:

- Cada artículo implica varias consultas (producto, categoría, relación,
  último precio, variación, `price_today`, estadísticas), no un `INSERT` suelto.
- Un lote grande en una sola transacción bloquea tablas que la API pública está
  leyendo al mismo tiempo.
- Si el proceso se corta a mitad de camino, no hay forma barata de saber qué
  quedó aplicado.

Con la cola, el scraper descarga su lote rápido y se desentiende; el consumidor
drena a su propio ritmo, de a un item, y la base nunca ve un pico. La cola es
además el único lugar donde los datos esperan: si el consumidor está caído, los
items quedan encolados en vez de perderse.

> ⚠️ **No implementar procesamiento dentro de este servicio.** La lógica de
> importación (productos, ofertas, estadísticas, cache) vive en el consumidor
> Python. Este servicio no necesita acceso a MySQL ni conocer el formato de los
> items más allá de guardarlos y devolverlos.

---

## 🔌 API REST Requerida

### POST /add_data

Agrega un item a una cola. Lo usa el backend al importar, y el consumidor al
reencolar un item que falló.

**Request:**
```json
POST /add_data
Content-Type: application/json

{
  "clave": "precios",
  "data": {
    "tipo": "producto",
    "name": "Leche La Serenísima 1L",
    "price": 850,
    "branch_id": 10,
    "category_name": "Lácteos",
    "fecha_registro": "2025-12-30T15:00:00.000Z"
  }
}
```

**Response:**
- `200`: `{ "success": true }`
- `400`: `{ "error": "Clave inválida" }` — clave ausente o >255 caracteres, o `data` faltante

El servicio **no valida el contenido de `data`**: lo guarda tal cual lo recibe,
incluida cualquier propiedad de control que agregue el consumidor (ver
`_intentos` más abajo).

### GET /get_data?clave=precios

Devuelve **un** item y lo elimina de la cola (operación atómica: dos
consumidores simultáneos no pueden recibir el mismo item).

**Response:**
- `200`: `{ "data": { ... } }`
- `400`: `{ "error": "Clave inválida" }`
- `404`: `{ "error": "No hay datos para la clave" }` — cola vacía

El consumidor llama a este endpoint en bucle: mientras reciba `200` pide el
siguiente de inmediato, y ante un `404` espera `QUEUE_POLL_INTERVAL` segundos
(1 por defecto) antes de reintentar.

### GET /count_data?clave=precios

Cantidad de items pendientes. El consumidor lo usa al arrancar como chequeo de
conectividad y después cada N items para loguear el atraso acumulado.

**Response:**
- `200`: `{ "count": 42 }`
- `400`: `{ "error": "Clave inválida" }`

### GET /health

Chequeo de vida, sin efectos. Es el fallback del consumidor cuando
`/count_data` no está disponible.

**Response:** `200` con cualquier cuerpo.

> El consumidor **nunca** escribe items de prueba para verificar conectividad:
> un item falso quedaría encolado y lo tomaría él mismo. Si se agregan
> endpoints de diagnóstico, que sean de solo lectura.

---

## 📦 Cola y formato de los items

Existe una **única cola**, `precios`. El tipo de trabajo se distingue por el
campo `tipo` del item, que el backend agrega antes de encolar:

```javascript
{
  tipo: 'producto' | 'oferta' | 'regenerar_precios', // obligatorio
  fecha_registro: Date|string,                       // obligatorio salvo en regenerar_precios
  _intentos: Number,                                 // opcional, lo agrega el consumidor
  // demás propiedades según el tipo
}
```

| `tipo`               | Origen                              | Qué hace el consumidor                                           |
|----------------------|-------------------------------------|------------------------------------------------------------------|
| `producto`           | `POST /importar`                    | `procesar_articulo()`: producto, categoría, precio, variación, `price_today` |
| `oferta`             | `POST /importar_oferta`             | `procesar_oferta()`: valida duplicados y fecha, inserta en `promociones_hoy` |
| `regenerar_precios`  | `POST /regenerar_price_today`       | Corre `back/scripts/recrear_price_today.js` y reinicia `LAB_PRECIOS` con pm2 |

Un `tipo` desconocido se descarta con log: reintentarlo daría el mismo
resultado.

### Orden de entrega

El orden entre items es indistinto para el procesamiento (cada item trae su
`fecha_registro` y la lógica de precios compara contra el último registro
existente). FIFO es preferible igualmente, para que un item reencolado no vuelva
a salir en la siguiente petición y la cola avance de forma pareja.

---

## 🔁 Reintentos

Los reintentos los maneja el **consumidor**, no el servicio de colas. El
servicio no guarda estado por item, así que el contador viaja dentro del propio
item:

1. El consumidor clasifica el fallo:
   - **Permanente** (datos del item: campo obligatorio faltante, categoría no
     especificada, oferta duplicada o anterior a ayer) → se descarta con log.
   - **Transitorio** (base caída, deadlock, timeout, excepción inesperada) → se
     reencola.
2. Al reencolar, incrementa `_intentos` y hace `POST /add_data` con el item.
3. Al superar `QUEUE_MAX_RETRY` (3 por defecto) el item se descarta con log.
4. Con fallos transitorios consecutivos el consumidor pausa de forma incremental
   (`QUEUE_RETRY_BACKOFF` × fallos seguidos, con tope `QUEUE_RETRY_BACKOFF_MAX`)
   para no drenar la cola entera contra una base que no responde.

Lo único que el servicio de colas debe garantizar es que `/add_data` y
`/get_data` sean fiables y que el item vuelva a la cola intacto.

---

## 🗄️ Persistencia

Requisito central: **los items no se pierden al reiniciar el servicio**, y los
pendientes se siguen entregando después del reinicio.

**Opciones sugeridas:**
1. **Redis** (recomendado)
   - Listas: `RPUSH` + `LPOP` para FIFO
   - Persistencia: `appendonly yes`
2. **Base de datos**
   - Tabla `queue_items` con estado (`pending`, `processing`, `failed`)
3. **Sistema de archivos**
   - Archivos JSON por cola; menos recomendado por concurrencia

Dimensionamiento: la cola tiene que aguantar el pico diario completo sin que el
consumidor haya empezado a drenar (el scraper puede subir decenas de miles de
items en minutos, y el consumidor procesa de a uno).

---

## 📊 Monitoreo y Logs

### Logs mínimos

```javascript
console.log(`[${clave}] Item agregado. Pendientes: ${pendientes}`)
console.log(`[${clave}] Item entregado. Pendientes: ${pendientes}`)
console.error(`[${clave}] Petición inválida:`, error)
```

### Métricas sugeridas

- Items en cola (por clave) — la más importante: si crece y no baja, el
  consumidor está caído o no da abasto
- Items agregados / entregados (contadores)
- Timestamp de la última entrega exitosa

---

## ⚙️ Configuración

### Variables de entorno del servicio

```bash
# Puerto del servicio
PORT=3501

# Persistencia (si se usa Redis)
REDIS_URL=redis://localhost:6379
```

**No necesita** credenciales de MySQL: no accede a la base.

### Dependencias

```json
{
  "dependencies": {
    "express": "^4.18.1",
    "dotenv": "^16.6.1",
    "redis": "^4.0.0"
  }
}
```

### Variables del lado del backend y del consumidor

```bash
QUEUE_SERVICE_URL=http://localhost:3501   # backend y consumidor
QUEUE_KEY=precios                         # consumidor
QUEUE_POLL_INTERVAL=1                     # consumidor
QUEUE_MAX_RETRY=3                         # consumidor
QUEUE_RETRY_BACKOFF=5                     # consumidor
QUEUE_RETRY_BACKOFF_MAX=60                # consumidor
QUEUE_BACKLOG_LOG_EVERY=100               # consumidor
```

---

## ✅ Checklist de Implementación

### Básico (MVP)
- [ ] `POST /add_data` funcionando
- [ ] `GET /get_data` devolviendo y eliminando un item de forma atómica
- [ ] Almacenamiento en memoria (array/Map) sobre la clave `precios`
- [ ] `404` cuando la cola está vacía
- [ ] Logs básicos de alta y entrega

### Producción
- [ ] Persistencia (Redis/DB/filesystem)
- [ ] `GET /count_data`
- [ ] `GET /health`
- [ ] Concurrencia segura en `/get_data` (sin entregas duplicadas)
- [ ] Logs estructurados y métrica de profundidad de cola

### Avanzado
- [ ] Dashboard de monitoreo
- [ ] Alertas por cola saturada (backlog que no baja)
- [ ] Dead letter queue para items que el consumidor descarta
- [ ] Rate limiting por clave
- [ ] Múltiples colas con prioridad

---

## 🧪 Testing

```bash
# 1. Encolar un item
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
      "fecha_registro": "2025-12-30T00:00:00Z"
    }
  }'

# 2. Verificar que quedó pendiente
curl "http://localhost:3501/count_data?clave=precios"

# 3. Retirarlo (con el consumidor Python detenido, si no lo toma él)
curl "http://localhost:3501/get_data?clave=precios"

# 4. Cola vacía debe dar 404
curl -i "http://localhost:3501/get_data?clave=precios"
```

Para probar el procesamiento de punta a punta, dejar el consumidor Python
corriendo (`extra_services/setup_and_run.sh`), encolar el item del paso 1 y
verificar en la base:

```sql
SELECT * FROM price WHERE product_id IN (
  SELECT id FROM products WHERE name = 'test product'
);
```

---

## 📞 Referencias

- **Consumidor (procesamiento real):** [`extra_services/actualizar_precios.py`](actualizar_precios.py) — ver [README](README.md)
- **Integración del backend:** [`back/documentacion/servicio_colas_externo.md`](../back/documentacion/servicio_colas_externo.md)
- **Changelog:** [`back/CHANGELOG_servicio_colas.md`](../back/CHANGELOG_servicio_colas.md)
- **Diagnóstico de conectividad:** [`back/DIAGNOSTICO_SERVICIO_COLAS.md`](../back/DIAGNOSTICO_SERVICIO_COLAS.md)
