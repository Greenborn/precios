# 🔧 Definición Técnica del Backend

Especificación técnica completa del backend: stack, configuración, modelos, y detalles de implementación.

## 🏗️ Stack Tecnológico

### Runtime & Framework
| Componente | Versión | Propósito |
|------------|---------|----------|
| **Node.js** | 14+ | Runtime JavaScript |
| **Express.js** | 4.x | Framework web REST |
| **Knex.js** | 2.x | Query builder ORM |
| **MySQL** | 5.7+ / 8.0 | Base de datos relacional |

### Librerías Principales
```json
{
  "uuid": "Generación de IDs únicos",
  "dotenv": "Gestión de variables de entorno",
  "axios": "Cliente HTTP (integraciones)",
  "cors": "Control de origen cruzado",
  "helmet": "Seguridad headers HTTP",
  "morgan": "Logging de requests HTTP"
}
```

---

## 📁 Estructura de Carpetas

```
back/
├── controllers/          # Lógica de negocio por módulo
│   ├── busqueda_productos.js      (búsqueda en memoria)
│   └── importar_productos.js      (procesamiento de importaciones)
├── models/              # Definiciones ORM (Objection.js/Knex)
│   ├── BaseModel.js     (clase base con relaciones)
│   ├── Product.js
│   ├── Price.js
│   ├── Branch.js
│   └── ...
├── routes/              # Definición de endpoints HTTP
│   ├── busqueda.js      (GET búsquedas)
│   ├── categorias.js    (GET categorías)
│   ├── productos.js     (GET/PUT/POST productos y precios)
│   └── ...
├── middleware/          # Autenticación y autorización
│   ├── Admin.js         (verificación rol admin)
│   └── Publico.js       (endpoints públicos)
├── helpers/             # Utilidades y funciones auxiliares
│   ├── authorization.js (verificación de acceso)
│   ├── processing.js    (cola en memoria; sin uso tras la cola externa)
│   └── utils.js         (funciones generales)
├── scripts/             # Scripts one-off y procesos
│   └── actualizar_price_today.js (scheduler 24h)
├── migrations/          # Migraciones de BD (Knex)
│   ├── 20250722075112_init_schema.js
│   └── ...
├── db/                  # Configuración y seeders
├── server.js            # Entry point principal
├── knexfile.js          # Config de Knex y BD
├── package.json
└── requirements.txt     # Dependencias Python (si aplica)
```

## ⚙️ Configuración

### Variables de Entorno (`.env`)

```bash
# Base de Datos
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=greenborn_precios

# Servidor
NODE_ENV=development|production
service_port_api=3001
cors_origin=http://localhost:3000

# Timezone (CRÍTICO)
TZ=America/Argentina/Buenos_Aires

# Seguridad
KEY_INT=tu_clave_secreta_interna

# Importación y Cola (servicio externo + consumidor Python)
PRICE_TODAY_CHUNK_SIZE=5000
QUEUE_SERVICE_URL=http://localhost:3501   # el backend solo encola aquí
internal_sync_key=clave_interna_sync      # el consumidor refresca el cache de la API

# Integraciones Externas (opcional)
SEARCH_SERVICE_ENDPOINT=http://search-service:8000
SEARCH_SERVICE_TIMEOUT_MS=5000
```

### Configuración Knex (`knexfile.js`)

```javascript
module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      timezone: 'Z'
    },
    pool: { min: 0, max: 1000 },
    migrations: { directory: './migrations' }
  }
};
```

---

## 🗄️ Modelos de Datos

### Tabla `products`

```sql
CREATE TABLE products (
  product_id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  category_id INT,
  alias_search TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX (category_id),
  FULLTEXT INDEX (name, alias_search)
);
```

### Tabla `price`

```sql
CREATE TABLE price (
  price_id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  branch_id INT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ARS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reliability INT DEFAULT 50,
  imported_from VARCHAR(50),
  url TEXT,
  
  UNIQUE KEY unique_price_today_product_branch (product_id, branch_id),
  INDEX (branch_id),
  INDEX (created_at),
  INDEX (imported_from)
);
```

**⚠️ CRÍTICO**: Validación siempre por `product_id + branch_id` para evitar mezclar sucursales.

### Tabla `price_today` (Caché)

```sql
CREATE TABLE price_today (
  product_id VARCHAR(36) NOT NULL,
  branch_id INT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ARS',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (product_id, branch_id),
  INDEX (last_updated)
);
```

**Propósito**: Caché del último precio (últimos 30 días). Actualizado cada 24h.

### Tabla `branch` (Sucursales)

```sql
CREATE TABLE branch (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_name VARCHAR(200) NOT NULL,
  enterprise_id INT NOT NULL,
  address VARCHAR(500),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  city VARCHAR(100),
  INDEX (enterprise_id)
);
```

### Tabla `enterprise` (Empresas)

```sql
CREATE TABLE enterprise (
  enterprise_id INT AUTO_INCREMENT PRIMARY KEY,
  enterprise_name VARCHAR(300) NOT NULL UNIQUE,
  type VARCHAR(50),
  website VARCHAR(255),
  logo_url VARCHAR(255),
  active BOOLEAN DEFAULT TRUE
);
```

### Tabla `category` (Categorías)

```sql
CREATE TABLE category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  cat_name VARCHAR(200) NOT NULL UNIQUE,
  cat_menu_id INT,
  description TEXT,
  icon VARCHAR(100),
  active BOOLEAN DEFAULT TRUE,
  INDEX (cat_menu_id)
);
```

### Tabla `estadistica_aumento_diario`

```sql
CREATE TABLE estadistica_aumento_diario (
  stat_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  branch_id INT NOT NULL,
  fecha_registro DATE NOT NULL,
  price_anterior DECIMAL(12,2),
  price_actual DECIMAL(12,2),
  porcentaje_cambio DECIMAL(6,4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_daily_stat (product_id, branch_id, fecha_registro),
  INDEX (fecha_registro),
  INDEX (porcentaje_cambio)
);
```

**Propósito**: Registro histórico de cambios de precio para análisis y gráficos.

### Tabla `serie_compilada_media_interdiaria`

```sql
CREATE TABLE serie_compilada_media_interdiaria (
  date DATE PRIMARY KEY,
  mean_inc DECIMAL(10,6),
  median_inc DECIMAL(10,6),
  std_inc DECIMAL(10,6),
  count INT,
  inc_acumulado DECIMAL(10,4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos**:
- `date`: Fecha de la estadística
- `mean_inc`: Media de incrementos interdiarios (%)
- `median_inc`: Mediana de incrementos (%)
- `std_inc`: Desviación estándar (%)
- `count`: Cantidad de productos
- `inc_acumulado`: Incremento acumulado desde 2024-01-01 (composición multiplicativa)

**Ejemplo de `inc_acumulado`**:
- Valor: 166.223%
- Significa: Precios se multiplicaron por 2.66223
- Si $100 el 2024-01-01 → $266,22 al final
- Fórmula: `Precio final = Precio inicial × (1 + inc_acumulado/100)`

---

## 🔄 Sistema de Búsqueda

### Estructura en Memoria

```javascript
const lst_letras = {
  'l': {
    'e': {
      'c': {
        'h': {
          'e': [
            {
              product_id: "uuid-1",
              name: "Leche La Serenísima 1L",
              name_lower: "leche la serenísima 1l",
              price: 1250,
              branch_id: 5
            }
          ]
        }
      }
    }
  }
};
```

**Características**:
- ✅ Árbol de letras multinivel (por iniciales)
- ✅ Almacena `name` original + `name_lower`
- ✅ Array de productos al final
- ✅ Indexación ultrarrápida

### Algoritmo (Simplificado)

```javascript
function busqueda(termino) {
  termino_lower = termino.toLowerCase()
  letras = extraer_iniciales(termino_lower)
  
  nodo = lst_letras
  for (letra of letras) {
    nodo = nodo[letra]
    if (!nodo) return []
  }
  
  return nodo.filter(prod => prod.name_lower.includes(termino_lower))
}
```

**Complejidad**: O(1) en promedio, O(n) peor caso.

---

## 📥 Sistema de Importación

### Cola Externa + Consumidor Python

El backend **solo encola**. El procesamiento vive en un proceso aparte
(`extra_services/actualizar_precios.py`), que consume el servicio de colas Node
pidiendo **un item por request**. El volumen diario es muy alto y cada artículo
implica varias consultas, así que no se vuelca el lote de golpe en la base: la
cola amortigua el pico y el consumidor drena al ritmo que la base tolera.

```javascript
// back/routes/productos.js — lado backend: encolar y nada más
async function agregarACola(clave, data) {
  const response = await axios.post(`${QUEUE_SERVICE_URL}/add_data`,
    { clave, data }, { timeout: 5000 })
  return response.data?.success === true
}

// un POST /add_data por item, con el tipo marcado
const item = { ...rawItem, tipo: 'producto' }
const success = await agregarACola('precios', item)
```

```python
# extra_services/actualizar_precios.py — lado consumidor
elemento = obtener_elemento_cola(QUEUE_KEY)   # GET /get_data, un item
if elemento:
    resultado = procesar_articulo(elemento)   # escribe en MySQL
    if not resultado['stat'] and not es_error_permanente(resultado['text']):
        reencolar_elemento(elemento)          # POST /add_data con _intentos + 1
```

**Flujo**:
1. Cliente envía POST → valida formato y `KEY_INT` → marca `tipo` → `POST /add_data` por item
2. Responde 200 con el conteo de items encolados
3. El consumidor Python toma de a un item (`GET /get_data`); con cola vacía espera 1s
4. Cada item → transacción completa
5. Actualiza búsqueda y estadísticas, y sincroniza el cache de la API
   (`POST /interno/sync_cache`)
6. Fallo transitorio → reencola (hasta `QUEUE_MAX_RETRY`) con backoff; fallo
   permanente → descarta con log

Detalle completo en
[servicio_colas_externo.md](../../back/documentacion/servicio_colas_externo.md).

### Validación de Precios

```javascript
// SIEMPRE validar por product_id + branch_id
const ultimo = await knex('price')
  .where('product_id', articulo.product_id)
  .where('branch_id', articulo.branch_id)  // ← CRÍTICO
  .orderBy('created_at', 'desc')
  .first();
```

---

## ⏰ Scheduler (Cada 24h)

**Archivo**: `scripts/actualizar_price_today.js`

**Proceso**:
1. Obtiene combinaciones únicas (product_id, branch_id)
2. Procesa en chunks de 5000 registros
3. Para cada combinación: obtiene último precio válido (últimos 30 días)
4. Actualiza `price_today`
5. Reconstruye estructura de búsqueda
6. Elimina precios antiguos

**Transaccionalidad**: Por chunk, no por item.

---

## 🌍 Manejo de Timezone

**CRÍTICO**:
```javascript
process.env.TZ = 'America/Argentina/Buenos_Aires'  // UTC-3

// Día actual = hora local (setHours(0,0,0,0))
const hoy = new Date().setHours(0,0,0,0)

// NO usar setUTCHours para cálculos diarios
// ISO string para persistencia
const iso = fecha.toISOString()
```

---

## 🔒 Seguridad

### Rate Limiting
- Max 100 requests globales por IP
- Min 3 segundos entre requests
- Max 1 corrección por (product_id, branch_id)

### Autenticación por Rol
- `middleware/Publico.js`: Endpoints públicos
- `middleware/Admin.js`: Endpoints administrativos

### Validación de Datos
- Campos requeridos
- Tipos correctos
- Longitud máxima
- Valores en rango

---

## 🧪 Testing

```javascript
// test/test_busqueda_dinamica.js
describe('Búsqueda Dinámica', () => {
  it('debe agregar producto a buscador', async () => {
    // Test
  });
});
```

**Ejecución**:
```bash
npm test
```

---

## 📚 Índices Críticos

```sql
CREATE INDEX idx_price_product_branch ON price(product_id, branch_id);
CREATE INDEX idx_price_today_product_branch ON price_today(product_id, branch_id);
CREATE INDEX idx_stat_fecha ON estadistica_aumento_diario(fecha_registro);
CREATE FULLTEXT INDEX idx_product_name ON products(name, alias_search);
```

---

## 🔌 Integraciones

- **MercadoLibre** (plataforma: `ml`)
- **Region20** (propiedades en alquiler)

---

## 📖 Series Compilada Media Interdiaria

La tabla `serie_compilada_media_interdiaria` almacena estadísticas diarias de los incrementos interdiarios de precios, calculadas a partir de la tabla `price`

### ¿Qué significa el incremento acumulado?

El campo `inc_acumulado` representa el aumento porcentual acumulado de los precios desde el 2024-01-01 hasta la fecha correspondiente, calculado de manera compuesta (multiplicativa). Por ejemplo, un valor de 166.223% significa que los precios se multiplicaron por 2.66223 respecto al valor inicial:

- Si el precio era $100 el 2024-01-01, al final del período sería $266,22.
- Fórmula: `Precio final = Precio inicial × (1 + inc_acumulado/100)`

### Proceso de cálculo y guardado

- El script `resetear_serie_compilada_media_interdiaria.js` recorre todos los productos y genera una serie diaria forward-fill desde 2024-01-01.
- Calcula el incremento interdiario para cada día y compila estadísticas diarias (media, mediana, std, count).
- El incremento acumulado se calcula día a día usando composición multiplicativa:
  - `inc_acumulado_día_n = ((1 + inc_acumulado_{n-1}/100) × (1 + mean_inc/100) - 1) × 100`
- Los resultados se guardan en la tabla `serie_compilada_media_interdiaria`.

## Migraciones de Base de Datos (Knex)

El backend utiliza **Knex** para gestionar migraciones de base de datos de forma controlada.

- **Configuración:**
  - El archivo `knexfile.js` toma los datos de conexión desde el archivo `.env`.
  - Las migraciones se almacenan en el directorio `back/migrations/`.

- **Comandos principales:**
  - Crear una nueva migración:
    ```bash
    npx knex migrate:make nombre_migracion
    ```
  - Ejecutar todas las migraciones pendientes:
    ```bash
    npx knex migrate:latest
    ```
  - Revertir la última migración:
    ```bash
    npx knex migrate:rollback
    ```

- **Buenas prácticas:**
  - Versionar todas las migraciones en el repositorio.
  - No modificar migraciones ya aplicadas en producción; crear nuevas para cambios.
  - Mantener el esquema sincronizado entre entornos usando migraciones.

## Consideraciones de Portabilidad
- Separación de lógica de negocio y acceso a datos
- Uso de variables de entorno para configuración
- Documentación exhaustiva de endpoints y modelos

## Proceso de Actualización de Precios

### Descripción general

El proceso de actualización de precios en el backend está diseñado para mantener un historial completo de cambios, asegurar la integridad de los datos y permitir análisis avanzados. Incluye:
- Ingreso manual o masivo de precios (endpoints y scripts)
- Validaciones y límites por IP, producto y sucursal
- Registro de cada cambio en la tabla `price` (histórico) y actualización de `price_today` (último valor)
- Cálculo y registro de variaciones porcentuales en `estadistica_aumento_diario`
- Actualización de estadísticas agregadas
- Cola externa y consumidor Python aparte para absorber el volumen diario sin volcarlo de golpe en la base

### Puntos fuertes
- **Historial completo:** Permite trazabilidad y análisis temporal.
- **Control de abusos:** Rate limiting y controles por IP/producto/negocio.
- **Registro de variaciones:** Facilita análisis de incrementos y alertas.
- **Procesamiento batch:** Escalable para grandes volúmenes.

### Oportunidades de mejora
1. **Atomicidad y transacciones:** Garantizar que todos los cambios relacionados estén siempre en la misma transacción.
2. **Validación de datos:** Usar librerías robustas para evitar errores de tipo o valores atípicos.
3. **Optimización de queries:** Mantener índices adecuados en tablas grandes.
4. **Manejo de precios negativos o nulos:** Prevenir registros inválidos.
5. **Auditoría y logs:** Agregar logs de auditoría para cambios críticos.
6. **Documentación y ejemplos:** Explicar claramente los flujos y campos clave.
7. **Pruebas automatizadas:** Incorporar tests unitarios y de integración.

### Opinión general

El proceso es robusto y flexible, adecuado para sistemas que requieren historial y trazabilidad. Las mejoras sugeridas apuntan a escalar, validar y automatizar aún más el flujo de actualización de precios.

## Cola de Procesamiento de Productos (`colaProcProductos`)

### ¿Qué es?

La cola `colaProcProductos` es una estructura en memoria utilizada para procesar de manera asíncrona y por lotes la importación y actualización masiva de productos y precios.

### Funcionamiento
- Los productos a importar se agregan a la cola mediante el endpoint `/importar` u otros flujos batch.
- Un worker (ciclo con `setInterval`) cada 2 segundos toma hasta 50 items de la cola y los procesa uno a uno.
- Por cada item, se ejecuta un callback asíncrono que realiza la inserción/actualización de precios y estadísticas en la base de datos, usando transacciones.
- Si ocurre un error al procesar un item, este se re-agrega al final de la cola para reintentar más tarde.
- El procesamiento es secuencial (o por lotes pequeños), lo que evita saturar el servidor.

### Manejo de errores y reintentos
- Los items que fallan se reintentan automáticamente.
- No hay backoff exponencial ni límite de reintentos: un item defectuoso puede quedarse en la cola indefinidamente.

### Limitaciones
- **Persistencia:** La cola solo existe en memoria. Si el proceso se reinicia, se pierden los items pendientes.
- **Paralelismo:** El procesamiento es secuencial; no hay procesamiento paralelo salvo que se modifique el worker.
- **Monitoreo:** No hay métricas ni alertas automáticas sobre el tamaño de la cola o errores recurrentes.

### Recomendaciones
- Para entornos de producción críticos, considerar persistir la cola en una tabla temporal o sistema de colas externo (ej: Redis, RabbitMQ).
- Agregar métricas y alertas para monitorear el tamaño de la cola y los errores.
- Implementar backoff exponencial o límite de reintentos para evitar loops infinitos con items defectuosos.
- Documentar claramente el flujo para el equipo de desarrollo y operaciones.

### Advertencia sobre el procesamiento secuencial de la cola

Actualmente, la función que procesa la cola (`procesarColaProc`) utiliza un ciclo `while` con `await` para procesar los items uno a uno de forma estrictamente secuencial. Esto implica:
- Solo se procesa un item a la vez, sin paralelismo.
- Si un item es lento o queda colgado, la cola se detiene hasta que termine o falle.
- Un item defectuoso puede provocar loops rápidos de reintentos y bloquear la cola.
- No se aprovecha el hardware para procesamiento concurrente.

**Para cargas bajas o moderadas esto es suficiente, pero para cargas altas o producción crítica se recomienda:**
- Implementar procesamiento en paralelo controlado (pool de workers, Promise.all por lotes, etc.).
- Agregar timeouts y backoff para reintentos.
- Persistir la cola para evitar pérdida de datos ante caídas.

Esta limitación está documentada para futuras mejoras del sistema.

### Aclaración sobre el uso de `marcarColaNoVacia`

- **Con worker periódico (setInterval):**
  - No es obligatorio llamar a `marcarColaNoVacia` al agregar elementos a la cola, ya que el worker revisa periódicamente el estado real de la cola y ajusta el estado interno automáticamente.
  - El callback `onEmpty` se ejecutará correctamente una sola vez por transición a vacía, aunque haya un pequeño retraso hasta el próximo ciclo del worker.

- **Con procesamiento por evento (sin worker):**
  - Si solo procesas la cola cuando agregas elementos (sin worker periódico), entonces sí debes llamar a `marcarColaNoVacia` cada vez que agregues un elemento, para que el callback `onEmpty` funcione correctamente.

**Patrón recomendado:**
- Para la mayoría de los casos con worker periódico, puedes omitir `marcarColaNoVacia` y el sistema funcionará bien.
- Documenta el comportamiento esperado para el equipo y ajusta según el modelo de procesamiento que uses.

## Actualización automática de la serie compilada al vaciarse la cola de productos

Cuando la cola de productos (`colaProcProductos`) queda vacía, el sistema ejecuta automáticamente el script:

```bash
node scripts/resetear_serie_compilada_media_interdiaria.js price_today --no-truncate
```

Esto actualiza la tabla `serie_compilada_media_interdiaria` solo para los días presentes en `price_today`, sin borrar el historial previo (gracias al argumento `--no-truncate`).

- **Ventaja:** Permite mantener la serie compilada siempre al día con los precios más recientes, sin perder el historial de días anteriores.
- **Uso recomendado:** Este proceso es automático y no requiere intervención manual, pero puede ejecutarse manualmente si es necesario.

### Mecanismo de limpieza automática de `price_today`

La tabla `price_today` está diseñada para contener únicamente los precios correspondientes al día actual y al día anterior (ventana "hoy + ayer"). Para garantizar esto, el sistema implementa la siguiente lógica:

- **Limpieza automática al registrar un nuevo precio:**
  - Cada vez que se registra un nuevo precio (ya sea por importación masiva, carga manual o actualización), el controlador ejecuta una limpieza previa de la tabla `price_today`.
  - Se eliminan todos los registros cuya columna `date_time` sea anterior al inicio del día de ayer (es decir, menor a las 00:00:00 del día anterior).
  - Solo después de esta limpieza se inserta/actualiza el nuevo precio correspondiente.
- **Limpieza periódica (red de seguridad):**
  - El worker de procesamiento (`extra_services/actualizar_precios.py`) ejecuta la misma limpieza al arrancar y periódicamente (dentro de `actualizar_estadisticas`), cubriendo registros que se hayan acumulado fuera del flujo normal.
- **Regeneración manual / por API:**
  - El endpoint `POST /admin/productos/regenerar_price_today` encola la tarea `regenerar_precios`, que ejecuta `node scripts/recrear_price_today.js`. Este script borra lo anterior a "ayer" y reconstruye desde `price` el precio más reciente por producto/sucursal de la ventana.

**Ventajas de este enfoque:**
- La limpieza es centralizada y automática, sin depender del endpoint específico que realice la operación.
- Se evita la acumulación de precios antiguos y se garantiza que los análisis y reportes sobre `price_today` reflejen únicamente los datos vigentes (hoy y ayer).

**Referencia de implementación:**
- Ver función `nuevo_reg_precio` en `back/controllers/importar_productos.js`:
  ```js
  // Limpiar price_today para dejar solo los precios de hoy y ayer
  const AYER = new Date(fecha_registro)
  AYER.setHours(0,0,0,0)
  AYER.setDate(AYER.getDate() - 1)
  await trx('price_today').where('date_time', '<', AYER).del();
  ```
- Ver también `back/routes/productos.js` (`PUT /cargar_nuevo_precio`), `extra_services/actualizar_precios.py` y `back/scripts/recrear_price_today.js`.

### Limpieza automática de `estadistica_aumento_diario` y `promociones_hoy`

La limpieza de datos temporales usa inicio de día en hora local (UTC-3):

- Al vaciarse `colaProcProductos` se ejecuta un callback `onEmpty` que, además de actualizar la serie compilada, elimina registros en `estadistica_aumento_diario` con `fecha_utlimo_precio` anterior a `AYER` (inicio del día anterior local). En la implementación real, esta limpieza corre periódicamente en `extra_services/actualizar_precios.py` (dentro de `actualizar_estadisticas`).
- Al vaciarse `colaProcOfertas` se eliminan registros en `promociones_hoy` con `fecha` anterior a `HOY`.
- Cálculo de `HOY`:
  ```js
  let HOY = new Date();
  HOY.setHours(0,0,0,0);
  ```

Esto mantiene las tablas temporales consistentes con el día operativo local del sistema.

## Limpieza diaria automática de tablas temporales

Para asegurar que los análisis y reportes reflejen únicamente los datos vigentes del día actual, el backend implementa una limpieza automática diaria en las siguientes tablas:

- **estadistica_aumento_diario**: Solo contiene registros del día actual (campo `fecha_utlimo_precio`). Antes de procesar cada lote de importación de productos, se eliminan todos los registros cuya fecha sea anterior a las 00:00:00 del día en curso.
- **promociones_hoy**: Solo contiene promociones vigentes del día actual (campo `fecha`). Antes de procesar cada lote de importación de ofertas, se eliminan todos los registros cuya fecha sea anterior a las 00:00:00 del día en curso.

**Ventajas de este enfoque:**
- Garantiza que los datos temporales estén siempre actualizados y no se acumulen registros antiguos.
- Simplifica la lógica de consulta y análisis, ya que no es necesario filtrar por fecha en cada consulta.
- El proceso es automático y transparente para el usuario y los sistemas integrados.

**Referencia de implementación:**
- Ver lógica en `back/routes/productos.js`, en los ciclos de procesamiento de productos y ofertas.

---

- [Volver al README del backend](./README.md)
- [Arquitectura](./arquitectura.md)
- [Endpoints](./endpoints.md)