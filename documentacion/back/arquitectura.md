# 🏗️ Arquitectura del Backend

Descripción del diseño arquitectónico, componentes y flujo de datos del backend de Precios.

## 📐 Diagrama de Arquitectura General

```mermaid
graph TB
    subgraph "Cliente"
        Web["🌐 Frontend Vue.js"]
        Mobile["📱 Cliente Externo"]
    end
    
    subgraph "API REST"
        Router["🔀 Router Express"]
        Middleware["🔐 Middleware<br/>Autenticación/Autorización"]
        Endpoints["📡 Endpoints"]
    end
    
    subgraph "Lógica de Negocio"
        Search["🔍 Búsqueda (Indexada)"]
        Import["📥 Importación"]
        Stats["📊 Estadísticas"]
        Cache["💾 Cache price_today"]
    end
    
    subgraph "Persistencia"
        DB["🗄️ MySQL<br/>Base de Datos"]
        Models["📋 ORM (Knex)"]
    end
    
    subgraph "Procesos Externos"
        Queue["📋 Servicio de Colas<br/>(Node, 3501)"]
        Consumer["🐍 Consumidor<br/>(actualizar_precios.py)"]
        Scheduler["⏱️ Scheduler 24h"]
    end
    
    Web -->|HTTP/REST| Router
    Mobile -->|HTTP/REST| Router
    Router --> Middleware
    Middleware --> Endpoints
    Endpoints --> Search
    Endpoints --> Import
    Endpoints --> Stats
    Import -->|POST /add_data| Queue
    Queue -->|GET /get_data, 1 item| Consumer
    Consumer --> DB
    Consumer -->|/interno/sync_cache| Cache
    Search -.-> Cache
    Endpoints --> Models
    Models --> DB
    Scheduler -->|1x día| Cache
    Scheduler -->|1x día| Search
```

## 🧩 Componentes Principales

### 1. Capa de Presentación (API REST)
**Localización**: `routes/*.js`

- Define endpoints HTTP (GET, POST, PUT, DELETE)
- Entrada: Query params, body JSON
- Salida: JSON estructurado
- Mantiene convenciones de respuesta consistentes

**Ejemplo**:
```
GET /publico/busqueda/precios?product_name=leche
→ Router busqueda.js → Controlador → Respuesta JSON
```

### 2. Capa de Autenticación y Autorización
**Localización**: `middleware/Publico.js`, `middleware/Admin.js`

- Valida identidad del usuario
- Verifica permisos por rol
- Monta subrutas según acceso
- Control granular de endpoints

**Prefijos**:
- `/publico/*` → Acceso público
- `/admin/*` → Acceso administrativo

### 3. Capa de Lógica de Negocio
**Localización**: `controllers/`, `helpers/`

#### 3.1 Búsqueda de Productos
- **Archivo**: `controllers/busqueda_productos.js`
- **Tipo**: Indexación en memoria
- **Características**:
  - Índice por iniciales de palabras
  - Búsqueda case-insensitive
  - Actualización dinámica sin regeneración completa
- **Performance**: O(letras) ≈ Ultra rápido

#### 3.2 Importación de Precios (encolado)
- **Archivo**: `routes/productos.js` (`agregarACola`)
- **Tipo**: proxy hacia el servicio de colas externo
- **Características**:
  - Valida `KEY_INT` y el formato del lote
  - Agrega el campo `tipo` a cada item (`producto`, `oferta`, `regenerar_precios`)
  - Envía un `POST /add_data` por item y responde con el conteo de aceptados
  - **No** procesa ni escribe en la base durante la importación

#### 3.3 Procesamiento Asíncrono (fuera del backend)
- **Archivo**: `extra_services/actualizar_precios.py` (proceso aparte, Python)
- **Características**:
  - Toma **un item por request** de `GET /get_data` y lo procesa
  - Ejecuta la lógica de importación: producto, categoría, precio, variación,
    `price_today`, estadísticas incrementales
  - Reencola los fallos transitorios (`_intentos`, hasta `QUEUE_MAX_RETRY`) y
    descarta los permanentes con log
  - Backoff incremental ante fallos consecutivos (base caída)
  - Notifica `POST /interno/sync_cache` para refrescar el cache de la API
- **Por qué de a uno**: el volumen diario es muy alto y cada artículo implica
  varias consultas; volcarlo de golpe bloquearía tablas que la API pública está
  leyendo. Ver [servicio de colas externo](../../back/documentacion/servicio_colas_externo.md)

> `helpers/processing.js` (cola en memoria, ciclos de 50 items) quedó sin uso en
> la importación tras la migración al servicio externo.

### 4. Capa de Acceso a Datos
**Localización**: `models/*.js`, `db/`

- ORM: **Knex.js**
- Base de datos: **MySQL**
- Transacciones: **Soporte completo**
- Migrations: **Knex migrations**

### 5. Capa de Cache
**Localización**: `price_today` tabla

- Cache de precios actuales
- Actualizado cada 24h
- Soporte para búsqueda rápida
- Se sincroniza con estructura de búsqueda

## 🔄 Flujos de Datos

### Flujo 1: Búsqueda de Precios (Lectura)

```
Cliente
   ↓
GET /publico/busqueda/precios?product_name=X
   ↓
Router (busqueda.js)
   ↓
hacer_busqueda(termino)
   ↓
busqueda_productos.busqueda(termino)
   ├─ Convierte a minúsculas (case-insensitive)
   ├─ Busca en estructura indexada
   └─ Retorna máx N resultados
   ↓
Enriquecimiento de datos
   ├─ Agrega empresa (desde global.enterprice_diccio)
   ├─ Agrega sucursales (desde global.branch_enterprice_diccio)
   └─ Formatea respuesta
   ↓
Respuesta JSON
{
  "stat": true,
  "items": [
    {
      "product_id": "...",
      "name": "...",
      "price": 1200,
      "branch_id": 10,
      "empresa": {...},
      "locales": [...]
    }
  ]
}
```

### Flujo 2: Importación de Precios (Escritura)

```
Sistema Externo
   ↓
POST /publico/productos/importar
Body: { key: KEY_INT, lst_importa: [...] }
   ↓
Validar clave de seguridad (KEY_INT)
   ↓
Agregar `tipo: "producto"` a cada item
   ↓
POST {QUEUE_SERVICE_URL}/add_data  (un request por item)
   ↓
Responder al cliente: { stat, count } (items encolados)
   ↓
[ASÍNCRONO - proceso aparte: extra_services/actualizar_precios.py]
   ↓
Consumidor Python en bucle:
   ├─ GET /get_data?clave=precios  → un item por request
   ├─ Cola vacía → espera 1s y reintenta
   └─ Fallo transitorio → reencola con _intentos (hasta 3)
   ↓
Para cada item:
   procesar_articulo(item)
   ├─ Normalizar nombre y categoría
   ├─ Obtener o crear producto
   ├─ Obtener o crear categoría
   ├─ Crear relación producto-categoría
   ├─ Procesar precio
   │  ├─ Si es nuevo precio → Insertar en price
   │  ├─ Si es actualización → Actualizar price_today
   │  ├─ Si es cambio significativo → Calcular estadísticas
   │  └─ Actualizar estructura de búsqueda
   └─ Dentro de transacción (TODO O NADA)
   ↓
Actualizar contadores globales (cada 10 items)
   ├─ cant_price (total en price)
   ├─ precios_hoy (total en price_today)
   └─ cant_promos (total en promociones_hoy)
   ↓
Sincronizar cache en memoria de la API
   └─ POST /interno/sync_cache (x-internal-key)
```

### Flujo 3: Actualización de Precios Actuales (Scheduler 24h)

```
Server inicia
   ↓
Programa scheduler cada 24 horas
   ↓
Cada 24h:
   ├─ Fork proceso hijo: actualizar_price_today.js
   ├─ Procesa en chunks de 5000 combinaciones
   │  ├─ product_id + branch_id única
   │  ├─ Selecciona precio más reciente (últimos 30 días)
   │  ├─ Excluye precios = 0
   │  └─ Usa transacción por chunk
   └─ Elimina precios antiguos de price_today
   ↓
Actualiza estructura de búsqueda
   busqueda_productos.inicializa_buscador()
   ├─ Lee todos los registros de price_today
   ├─ Crea índice de letras
   └─ Lista para búsqueda
   ↓
Proceso hijo termina
   └─ Event: exit → Loguea resultado
```

## 🔒 Seguridad y Validación

### Validación por Sucursal (CRÍTICO)

**Problema**: Sin validación, se pueden pisar precios entre sucursales.

**Solución**: Usar `product_id + branch_id` como clave única

**Dónde se valida**:
1. `procesa_precio()` → Busca último precio por `product_id` + `branch_id`
2. `nuevo_reg_precio()` → Inserta/actualiza por `product_id` + `branch_id`
3. `agregar_a_buscador()` → Elimina por `product_id` + `branch_id`
4. `eliminar_de_buscador()` → Elimina por `product_id` + `branch_id`

**Garantía**: ✅ 100% separado por sucursal

### Límites por IP

**Ubicación**: `routes/productos.js` - `cargar_nuevo_precio()`

**Límites**:
- Max 100 ingresos por IP (global)
- Min 3 segundos entre ingresos
- Max 1 corrección por producto-sucursal

**Marca**: confiabilidad = 50

## 📚 Modelos de Datos

### Relaciones Principales

```
products (1) ──┬──→ (M) alias_productos
               └──→ (M) price
               └──→ (M) product_category

branch (1) ──┬──→ (M) price
             └──→ (M) price_today

enterprise (1) ──→ (M) branch

category (1) ──→ (M) product_category

price_today: cache de último precio por (product_id, branch_id)

estadistica_aumento_diario: registro de cambios de precio
```

**Más detalles**: [Definición Técnica](./definicion_tecnica.md)

## 🚀 Optimizaciones

### 1. Búsqueda en Memoria
- Evita consultas a DB en cada búsqueda
- Indexada por iniciales de palabras
- O(1) para acceso inicial, O(n) para refinamiento
- Actualización eficiente sin regeneración completa

### 2. Caché price_today
- Evita consultar history completo de prices
- Limitado a último mes de datos
- Sincronizado con estructura de búsqueda
- Actualización en batch (chunked)

### 3. Cola Externa + Consumidor Aparte
- No bloquea la API en importación masiva: el backend solo encola
- El volumen diario (muchísimos artículos) se drena de a un item, sin picos
  sobre tablas que la API pública está leyendo
- Los pendientes sobreviven a un reinicio del backend o del consumidor
- Permite múltiples importaciones simultáneas
- Reintento de fallos transitorios con backoff, en el consumidor

### 4. Transaccionalidad
- Operaciones atómicas
- Rollback automático si falla
- Garantiza consistencia de datos

## 🔌 Extensibilidad

### Agregar Nuevo Endpoint

1. **Crear archivo en `routes/nombre.js`**
```javascript
const express = require('express')
const router = express.Router()

router.get('/ruta', async (req, res) => {
  // Lógica
})

module.exports = router
```

2. **Montar en `server.js`**
```javascript
app_API.use('/publico', require('./routes/nombre'))
```

3. **Documentar en `endpoints.md`**

### Agregar Nueva Tabla

1. **Crear migration en `migrations/`**
```bash
npx knex migrate:make nombre_tabla
```

2. **Definir modelo en `models/`**

3. **Usar en controladores/rutas**

## 📊 Observabilidad

### Logs
- Console.log en procesos principales
- Eventos: inicio/fin de tareas
- Errores con stack trace

### Métricas Globales
- `incremental_stats` tabla
- Contador de precios
- Contador de precios hoy
- Contador de promociones

### Monitoreo Recomendado
- [x] Logs de error
- [ ] Métricas de performance
- [ ] Alertas de fallos
- [ ] Dashboard de uso

## 🔧 Configuración

**Variables clave**:
- `PRICE_TODAY_CHUNK_SIZE`: Tamaño de chunk para actualización (default 5000)
- `service_port_api`: Puerto de escucha
- `mysql_*`: Credenciales de base de datos
- `cors_origin`: Origen permitido para CORS
- `KEY_INT`: Clave de autenticación interna

## 📖 Referencias

- [Endpoints](./endpoints.md)
- [Definición Técnica](./definicion_tecnica.md)
- [Búsqueda Dinámica](../../back/documentacion/busqueda_dinamica.md)
- [Validación Branch ID](../../back/documentacion/validacion_branch_id.md)

---

**Versión**: 1.1  
**Última actualización**: 30 de noviembre de 2025
