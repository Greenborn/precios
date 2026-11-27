# 📡 Endpoints del Backend

Documentación completa de todos los endpoints REST disponibles en la API de Precios.

## 🎯 Convenciones

| Aspecto | Detalles |
|---------|----------|
| **Base pública** | `/publico` |
| **Base administrativa** | `/admin` |
| **Formato de respuesta** | JSON |
| **Autenticación** | Opcional por rol |
| **Encoding** | UTF-8 |

## 📚 Tabla de Contenidos

1. [Búsqueda](#búsqueda)
2. [Categorías](#categorías)
3. [Productos](#productos)
4. [Importación](#importación)
5. [Comercios](#comercios)
   - [Precios de negocio](#precios-de-negocio-área-privada)
6. [Análisis y Estadísticas](#análisis-y-estadísticas)
7. [Respuestas Estándar](#respuestas-estándar)

---

## 🔍 Búsqueda

### Buscar Precios de Productos

```http
GET /publico/busqueda/precios?product_name=TÉRMINO
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `product_name` | string | ✅ | Término de búsqueda (min 3 caracteres) |

**Comportamiento**:
- ✅ Búsqueda case-insensitive
- ✅ Indexación en memoria ultrarrápida
- ✅ Dinámicamente actualizado en cada importación
- 🔄 Si contiene "alquiler" → busca propiedades de alquiler

**Respuesta 200 (Éxito)**:
```json
{
  "stat": true,
  "items": [
    {
      "product_id": "uuid-1",
      "name": "Leche entera La Serenísima 1L",
      "price": 1250,
      "branch_id": 5,
      "branch_name": "Sucursal Centro",
      "empresa": "Supermercado X",
      "locales": [
        {
          "branch_id": 5,
          "branch_name": "Centro",
          "price": 1250
        }
      ]
    }
  ]
}
```

**Respuesta 400 (Parámetro inválido)**:
```json
{
  "stat": false,
  "error": "product_name must be at least 3 characters"
}
```

**Respuesta 500 (Error interno)**:
```json
{
  "stat": false,
  "items": [],
  "error": true
}
```

---

### Buscar Promociones

```http
GET /publico/busqueda/promociones?product_name=TÉRMINO
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `product_name` | string | ✅ | Término de búsqueda (min 3 caracteres) |

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "product_id": "...",
      "name": "Promoción especial",
      "promo_discount": 15,
      "locales": [...]
    }
  ]
}
```

---

### Comercios con Promociones

```http
GET /publico/busqueda/comercios_promociones
```

**Parámetros**: Ninguno

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "branch_id": 1,
      "branch_name": "Sucursal 1",
      "enterprise": "Supermercado X",
      "promo_count": 5
    }
  ]
}
```

---

### Información de Comercio por URL

```http
GET /publico/busqueda/info_comercio?website=URL
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `website` | string | ✅ | URL del comercio (ej: `https://supermercadox.com`) |

**Comportamiento**:
- ✅ Busca empresa por el campo `website`
- ✅ Retorna datos de la empresa + todas sus sucursales

**Respuesta 200**:
```json
{
  "stat": true,
  "items": {
    "enterprice": {
      "id": 1,
      "name": "Supermercado X",
      "type": "supermarket",
      "website": "https://supermercadox.com",
      "logo_url": "https://supermercadox.com/logo.png",
      "active": true
    },
    "branches": [
      {
        "id": 1,
        "branch_name": "Sucursal Centro",
        "enterprise_id": 1,
        "address": "Av. Siempre Viva 123",
        "latitude": -34.603722,
        "longitude": -58.381592,
        "city": "Buenos Aires"
      }
    ]
  }
}
```

**Respuesta 404 (No encontrado)**:
```json
{
  "stat": false,
  "error": "No se encontro comercio con esa URL"
}
```

---

## 🏷️ Categorías

### Listar Todas las Categorías

```http
GET /publico/categorias/all
```

**Parámetros**: Ninguno

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "cat_menu_id": 1,
      "cat_name": "Almacén",
      "icon": "box",
      "sub_count": 5
    }
  ]
}
```

---

### Empresas por Categoría

```http
GET /publico/categorias/get_empresas_categoria?menu_category_id=ID
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `menu_category_id` | number | ✅ | ID de la categoría |

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "enterprise_id": 1,
      "enterprise_name": "Supermercado X",
      "product_count": 150
    }
  ]
}
```

---

### Subcategorías de una Categoría

```http
GET /publico/categorias/get_sub_categorias?cat_menu_id=ID
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `cat_menu_id` | number | ✅ | ID de la categoría padre |

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "subcat_id": 10,
      "subcat_name": "Leches",
      "icon": "milk"
    }
  ]
}
```

---

### Categorías de una Empresa

```http
GET /publico/categorias/get_categoria_empresa?enterprise_id=ID
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `enterprise_id` | number | ✅ | ID de la empresa |

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "cat_id": 1,
      "cat_name": "Almacén"
    }
  ]
}
```

---

## 📦 Productos

### Productos por Categoría

```http
GET /publico/productos/all?category_id=ID
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `category_id` | number | ✅ | ID de la categoría |

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "product_id": "uuid",
      "name": "Leche entera 1L",
      "current_price": 1250,
      "branch_count": 3
    }
  ]
}
```

---

### Cargar Nuevo Precio

```http
PUT /publico/productos/cargar_nuevo_precio
```

> 🔐 **Requiere sesión activa** (JWT en `x-api-key`). No es una ruta pública: usuarios no logueados reciben `{ stat: false, code: "DO_LOGIN" }`. Cualquier usuario logueado (roles `administrador` o `usuario`) puede publicar. El precio queda registrado con el `user_id`, nombre y apellido del autor.

**Body JSON**:
```json
{
  "product_id": "uuid-del-producto",
  "branch_id": 5,
  "price": 1250
}
```

**Validaciones**:
- ✅ Valida `product_id` + `branch_id` combinación única
- ✅ Límite de 100 ingresos globales por IP
- ✅ Esperar 3 segundos mínimo entre ingresos
- ✅ Max 1 corrección por combinación producto-sucursal
- ✅ Marca confiabilidad = 50
- ✅ Registra autor (`user_id`, `user_nombre`, `user_apellido`)

**Respuesta 200 (Éxito)**:
```json
{
  "stat": true,
  "message": "Precio actualizado"
}
```

**Respuesta 429 (Límite de rate)**:
```json
{
  "stat": false,
  "error": "Too many requests from this IP"
}
```

**Respuesta 400 (Validación)**:
```json
{
  "stat": false,
  "error": "Invalid product_id or branch_id"
}
```

---

### Cargar Precios desde Formulario Comunitario

```http
PUT /publico/productos/cargar_precios_formulario
```

> 🔐 **Requiere sesión activa** (JWT en `x-api-key`). Utilizado por la página `/carga_precio` (Carga Colaborativa de Precios). Los precios se insertan **directamente** en la base de datos (`price` + `price_today`) con el nombre y apellido del usuario que los cargó; no pasan por la cola de validación `formulario_carga_comunitaria`.

**Body JSON**:
```json
{
  "comercio": "Supermercado X",
  "fecha": "2026-09-18",
  "productos": [
    { "nombre": "Arroz", "marca": "Marolio", "presentacion": "1Kg", "precio": 1200 }
  ]
}
```

**Comportamiento**:
- 🔎 Resuelve el producto por alias/nombre (`products_diccio`, `alias_productos`, `products`); si no existe lo crea junto a su alias
- 🏪 Resuelve el comercio por nombre (`enterprice` case-insensitive) y su primera sucursal; si no existe crea empresa+sucursal y regenera diccionarios
- 📅 Solo las fechas dentro de la ventana hoy+ayer entran a `price_today` y al buscador; las anteriores quedan solo en el histórico `price`
- ✍️ Cada precio queda con `user_id` / `user_nombre` / `user_apellido` y `confiabilidad = 50`
- ✅ Rate limit: mínimo 3s entre envíos y máximo 100 envíos diarios por IP; hasta 100 productos por envío

**Respuesta 200 (Éxito)**:
```json
{
  "stat": true,
  "items": { "cargados": 2, "con_error": 0 }
}
```

**Respuesta 200 (Sesión inactiva)**:
```json
{ "stat": false, "code": "DO_LOGIN", "text": "No hay sesion activa" }
```

---

### Listar / Eliminar Precios Cargados por Usuarios (admin)

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `/admin/precios_comunitarios/get_all` | GET | `precios.ver` | Listado paginado (contrato TableEditor) de precios con autor (`price.user_id IS NOT NULL`) |
| `/admin/precios_comunitarios/delete_one` | DELETE | `precios.eliminar` | Elimina un precio cargado por usuario; restaura el precio anterior en `price_today`/buscador/caches si correspondía |

**DELETE /admin/precios_comunitarios/delete_one** body: `{ "id": "uuid-price" }`. Solo admite precios con `user_id` asignado. Si el precio era el vigente en `price_today`, se restaura el registro más reciente de `price` del mismo producto+sucursal (o se elimina `price_today` y se saca del buscador si no hay otro).

---

## 📥 Importación

### Importar Artículos de Plataforma

```http
POST /publico/productos/importar_articulo_plataforma
```

**Body JSON**:
```json
[
  {
    "name": "Leche La Serenísima 1L",
    "price": 1250,
    "currency": "ARS",
    "category_name": "Almacén > Lácteos",
    "url": "https://mercadolibre.com/...",
    "plataforma": "ml",
    "enterprise_id": 1,
    "branch_id": 5
  }
]
```

**Campos**:
| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `name` | string | ✅ | Nombre del producto (normalizado) |
| `price` | number | ✅ | Precio en la moneda especificada |
| `currency` | string | ✅ | ISO 4217 (ARS, USD, etc.) |
| `category_name` | string | ✅ | Ruta: "Categoría > Subcategoría" |
| `url` | string | ❌ | URL del producto en plataforma |
| `plataforma` | string | ✅ | "ml" (MercadoLibre) o "region20" |
| `enterprise_id` | number | ✅ | ID de la empresa |
| `branch_id` | number | ✅ | ID de la sucursal |

**Características**:
- 🔄 Procesamiento asíncrono (no bloquea)
- 📋 Cola en memoria (max 50 items/ciclo)
- 🔁 Reintento automático de errores
- 🔒 Validación de `product_id + branch_id`
- 📊 Calcula automáticamente estadísticas de cambio

**Respuesta 200 (Aceptado)**:
```json
{
  "stat": true,
  "message": "Importación en cola",
  "queued_items": 1,
  "total_in_queue": 5
}
```

**Respuesta 400 (Validación)**:
```json
{
  "stat": false,
  "error": "Invalid items format",
  "details": [
    {
      "index": 0,
      "error": "name is required"
    }
  ]
}
```

---

### Importación Masiva (Alternativa)

```http
POST /publico/productos/importar
```

**Body JSON**:
```json
{
  "key": "KEY_INT_SECRET",
  "lst_importa": [
    {
      "nombre": "Leche 1L",
      "precio": 1250,
      "empresa_id": 1,
      "sucursal_id": 5
    }
  ]
}
```

**Notas**:
- 🔐 Requiere clave `KEY_INT` (variable de entorno)
- 🔄 Cola asíncrona con procesamiento en background
- Respuesta inmediata sin esperar procesamiento

**Respuesta 200**:
```json
{
  "stat": true,
  "message": "Items encolados para procesamiento"
}
```

---

## 🏪 Comercios

### Crear Nuevo Comercio

```http
POST /admin/comercios
```

**Autenticación**: 🔐 Requiere clave `KEY_INT` (enviada en el body)

**Body JSON**:
```json
{
  "key": "KEY_INT_SECRET",
  "enterprice": {
    "name": "Supermercado X",
    "type": "supermarket",
    "website": "https://supermercadox.com",
    "logo_url": "https://supermercadox.com/logo.png",
    "active": true
  },
  "branch": {
    "branch_name": "Sucursal Centro",
    "address": "Av. Siempre Viva 123",
    "latitude": -34.603722,
    "longitude": -58.381592,
    "city": "Buenos Aires"
  }
}
```

**Campos**:
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `key` | string | ✅ | Clave de autenticación interna |
| `enterprice.name` | string | ✅ | Nombre de la empresa (único) |
| `enterprice.type` | string | ❌ | Tipo de comercio |
| `enterprice.website` | string | ❌ | Sitio web |
| `enterprice.logo_url` | string | ❌ | URL del logo |
| `enterprice.active` | boolean | ❌ | Si está activo (default: true) |
| `branch.branch_name` | string | ✅ | Nombre de la sucursal |
| `branch.address` | string | ❌ | Dirección |
| `branch.latitude` | number | ❌ | Latitud |
| `branch.longitude` | number | ❌ | Longitud |
| `branch.city` | string | ❌ | Ciudad |

**Comportamiento**:
- ✅ Crea registro en `enterprice` y `branch` en una transacción atómica
- ✅ Refresca automáticamente los diccionarios en memoria
- ✅ Si el nombre de empresa ya existe, retorna error por duplicado
- ✅ Si el website/URL ya existe, retorna error por duplicado

**Respuesta 200 (Éxito)**:
```json
{
  "stat": true,
  "items": {
    "enterprice": {
      "id": 1,
      "name": "Supermercado X",
      "type": "supermarket",
      "website": "https://supermercadox.com",
      "logo_url": "https://supermercadox.com/logo.png",
      "active": true
    },
    "branch": {
      "id": 1,
      "branch_name": "Sucursal Centro",
      "enterprise_id": 1,
      "address": "Av. Siempre Viva 123",
      "latitude": -34.603722,
      "longitude": -58.381592,
      "city": "Buenos Aires"
    }
  }
}
```

**Respuesta 401 (Autenticación)**:
```json
{
  "stat": false,
  "error": "Error de autenticación"
}
```

---

## 💼 Precios de Negocio (área privada)

Rutas del área de negocio, montadas bajo `/api` (`back/server.js` → `app_API.use("/api", require("./routes/negocio"))`).
Requieren sesión (`x-api-key` o `Authorization: Bearer`) y que la cuenta tenga `es_negocio = 1`.

> Nota: `sesion_negocio` responde 401 sin sesión y 403 si la cuenta no es de negocio. Estos endpoints usan `{ "error": "..." }` (no `stat`/`text`) para errores.

Tabla de datos: `precios_negocio` (ver [definición técnica](../definicion_tecnica.md#tabla-precios_negocio)).

### Mis precios (listado)
**GET** `/api/negocio/mis-precios?limit=50&offset=0`

#### Headers
```http
x-api-key: <token de sesión>
```

#### Parámetros (query)
| Campo | Tipo | Requerido | Reglas |
|-------|------|-----------|--------|
| `limit` | number | No | 1 a 200 (default 50) |
| `offset` | number | No | ≥ 0 (default 0) |

Devuelve, por cada (producto, local), **sólo el último precio cargado por el usuario logueado**. Lee `precios_negocio` filtrando por `usuario_id = req.user.id`; el `usuario_id` de la query se ignora.

#### Respuesta Exitosa (200)
```json
{
  "total": 1,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "id": "0190f3c2-7d1e-7a2b-9c3d-4e5f6a7b8c9d",
      "producto_id": "uuid-del-producto",
      "producto": "Arroz Gallo 1Kg",
      "precio": 1250,
      "fecha": "2026-11-26T10:15:00.000Z",
      "local_id": 5,
      "local": "Sucursal Centro"
    }
  ]
}
```

#### Respuestas de Error
| Código HTTP | Situación | Respuesta |
|-------------|-----------|-----------|
| 401 | Sin sesión | `{ "error": "No hay sesión activa", "code": "DO_LOGIN" }` |
| 403 | Cuenta no marcada como negocio | `{ "error": "Tu cuenta no está configurada como negocio", "code": "NO_NEGOCIO" }` |
| 404 | No aplica (listado vacío devuelve `items: []`) | — |
| 422 | No se usa (parámetros inválidos se normalizan con defaults) | — |
| 500 | Error de base de datos | Mensaje genérico del back (detalle sólo en log) |

#### Características
- **Lectura directa** de `precios_negocio` (sin recorrer `price`).
- Ordenado por nombre de producto, local y `id`.

---

### Editar precio propio
**PUT** `/api/negocio/mis-precios/:id`

#### Headers
```http
x-api-key: <token de sesión>
Content-Type: application/json
```

#### Parámetros
| Campo | Ubicación | Tipo | Requerido | Reglas |
|-------|-----------|------|-----------|--------|
| `id` | path | string | Sí | `[A-Za-z0-9-]`, hasta 36 caracteres (id del precio) |
| `precio` | body | number | Sí | Mayor que 0, máximo `999999999.99`, hasta 2 decimales; acepta coma decimal |

```json
{ "precio": 1300 }
```

#### Respuesta Exitosa (200)
```json
{ "stat": true, "data": { "id": "0190f3c2-7d1e-7a2b-9c3d-4e5f6a7b8c9d", "precio": 1300 } }
```

#### Efectos
- Actualiza `precios_negocio`, `price` (histórico) y `price_today` si el precio es el vigente.
- Sincroniza buscador y cachés en memoria (`agregar_a_buscador`, `sync_cache.actualizar_precio`).
- Todo en transacción sobre la base; la sincronización de caché ocurre después.

#### Respuestas de Error
| Código HTTP | Situación | Respuesta |
|-------------|-----------|-----------|
| 400 | `id` con formato inválido | `{ "error": "Identificador de precio inválido" }` |
| 401 | Sin sesión | `{ "error": "No hay sesión activa", "code": "DO_LOGIN" }` |
| 403 | Cuenta no es de negocio | `{ "error": "Tu cuenta no está configurada como negocio", "code": "NO_NEGOCIO" }` |
| 404 | El precio no existe o es de otro usuario (no se revela cuál) | `{ "error": "Precio no encontrado" }` |
| 422 | Precio no válido (no numérico, ≤ 0, > máximo, más de 2 decimales) | `{ "error": "El precio debe ser un número positivo con hasta 2 decimales" }` |
| 500 | Error interno | `{ "error": "No se pudo editar el precio" }` |

#### Características
- **Propiedad**: se verifica en el servidor (`usuario_id = req.user.id`). `usuario_id` del body no se acepta.

---

### Eliminar precio propio
**DELETE** `/api/negocio/mis-precios/:id`

#### Headers
```http
x-api-key: <token de sesión>
```

#### Parámetros
| Campo | Ubicación | Tipo | Requerido | Reglas |
|-------|-----------|------|-----------|--------|
| `id` | path | string | Sí | Mismo formato que en PUT |

#### Respuesta Exitosa (200)
```json
{ "stat": true, "data": { "id": "0190f3c2-7d1e-7a2b-9c3d-4e5f6a7b8c9d" } }
```

#### Efectos
- Borra la fila en `precios_negocio`, en `price` y, si era el vigente, restaura en `price_today` el precio anterior (misma lógica que `eliminar_precio` de `/admin/precios_comunitarios`).
- Quita o actualiza buscador y cachés en memoria.
- Si la fila existe en `precios_negocio` pero no en `price` (inconsistencia previa), sólo se limpia la copia.

#### Respuestas de Error
| Código HTTP | Situación | Respuesta |
|-------------|-----------|-----------|
| 400 | `id` con formato inválido | `{ "error": "Identificador de precio inválido" }` |
| 401 | Sin sesión | `{ "error": "No hay sesión activa", "code": "DO_LOGIN" }` |
| 403 | Cuenta no es de negocio | `{ "error": "Tu cuenta no está configurada como negocio", "code": "NO_NEGOCIO" }` |
| 404 | No existe o es de otro usuario | `{ "error": "Precio no encontrado" }` |
| 422 | No se usa | — |
| 500 | Error interno | `{ "error": "No se pudo eliminar el precio" }` |

---

## 📊 Análisis y Estadísticas

### Incremento Acumulado de Precios

```http
GET /publico/estadisticas/incremento_acumulado_mensual?year=YYYY&month=MM
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `year` | number | ✅ | Año (YYYY) |
| `month` | number | ✅ | Mes (1-12) |

**Respuesta 200**:
```json
{
  "stat": true,
  "year": 2025,
  "month": 11,
  "items": [
    {
      "product_id": "uuid",
      "name": "Leche 1L",
      "accumulated_increase": 5.2,
      "percentile": 0.75
    }
  ]
}
```

---

### Media de Incremento Interdiario

```http
GET /publico/estadisticas/media_incremento_interdiario?year=YYYY&month=MM
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `year` | number | ✅ | Año |
| `month` | number | ✅ | Mes |

**Respuesta 200**:
```json
{
  "stat": true,
  "items": [
    {
      "product_id": "uuid",
      "name": "Producto",
      "daily_avg_increase": 0.15,
      "volatility": 0.08
    }
  ]
}
```

---

### Variación de Precios

```http
GET /publico/estadisticas/variacion_precios?product_id=UUID&branch_id=ID&days=DÍAS
```

**Parámetros Query**:
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|-------------|
| `product_id` | string | ✅ | ID del producto |
| `branch_id` | number | ✅ | ID de la sucursal |
| `days` | number | ❌ | Últimos N días (default 30) |

**Respuesta 200**:
```json
{
  "stat": true,
  "product": "Leche 1L",
  "branch": "Sucursal Centro",
  "history": [
    {
      "date": "2025-11-15",
      "price": 1250,
      "change_percent": 2.5
    }
  ]
}
```

---

## ✅ Respuestas Estándar

### Formato Base de Respuesta

Todas las respuestas siguen este formato:

```json
{
  "stat": true|false,
  "items": [],
  "error": null|"mensaje"
}
```

**Campos**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `stat` | boolean | Indica éxito (`true`) o error (`false`) |
| `items` | array | Datos solicitados (vacío si error) |
| `error` | string \| null | Mensaje de error (si aplica) |

### Códigos HTTP

| Código | Situación | Ejemplo |
|--------|-----------|---------|
| **200** | Éxito en operación | GET búsqueda exitosa |
| **400** | Validación fallida | Parámetros inválidos |
| **401** | No autenticado | Token expirado |
| **403** | No autorizado | Rol insuficiente |
| **429** | Rate limit | Demasiadas solicitudes |
| **500** | Error del servidor | Excepción no capturada |

---

## 🔐 Autenticación y Autorización

### Headers Requeridos

Para endpoints administrativos:

```http
Authorization: Bearer <token>
X-API-Key: <api_key>
```

### Prefijos de Rutas

- `/publico/*` → **Acceso público sin autenticación**
- `/admin/*` → **Requiere autenticación de rol administrativo**

---

## 🔐 Administración y RBAC

El módulo RBAC gestiona usuarios, roles, permisos y rutas del panel de administración. Roles base: **`administrador`** (acceso total) y **`usuario`** (puede publicar precios; asignado por defecto a los usuarios creados vía SSO).

### Autenticación (JWT)

- Login público → devuelve `token` y `u_data` (incluye `rutas` para el menú).
- El token se envía en el header `x-api-key` (o `Authorization: Bearer <token>`) en el resto de los endpoints `/admin/*`.
- Variable de entorno: `JWT_SECRET`, `JWT_EXPIRES_IN`.

### 1.1 Login
**POST** `/admin/user/login`

#### Body
```json
{ "email": "usuario@dominio.com", "password": "una_contraseña_local" }
```

> ℹ️ No existe una cuenta admin por defecto. El admin único (`ADMIN_EMAIL`) se crea al iniciar sesión vía SSO. Para habilitar el login local de un usuario (o crearle una contraseña), usá `back/scripts/set_password.sh` (ver [Contraseña local de usuarios](#contraseña-local-de-usuarios)).

#### Respuesta Exitosa (200)
```json
{
  "stat": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "u_data": {
      "id": 1,
      "name": "Administrador",
      "email": "admin@admin.com",
      "rutas": [
        { "id": 1, "id_ruta_root": null, "path": "dashboard", "componente": "Dasboard", "icon": "pi-home", "title": "Dashboard", "orden_visualizacion": 1 }
      ]
    }
  }
}
```

#### Respuesta de Error (200)
```json
{ "stat": false, "text": "Credenciales inválidas" }
```

#### Características
- **Autenticación**: No requerida (público)
- **Validación**: Email y password requeridos
- **Transaccional**: No

### 1.2 Login SSO (Google)
**POST** `/admin/user/sso_login`

Inicia sesión mediante el servicio SSO central de Greenborn (`auth.greenborn.com.ar`, app_id `"precios"`). El frontend redirige a `{SSO}/auth/google?url_redireccion_app=...&unique_id=...`, el SSO vuelve a `/#/admin/login-redirect?token=<temporal>&unique_id=...`, el front canjea el token temporal por un bearer (`POST {SSO}/auth/login`) y lo envía aquí. El backend verifica el bearer contra `GET {SSO}/auth/verify`, busca el usuario local por email (lo crea automáticamente con rol `SSO_DEFAULT_ROL` si no existe) y emite el JWT local igual que `/login`.

#### Body
```json
{ "token": "<bearer_token_sso>", "unique_id": "req_..." }
```

#### Respuesta Exitosa (200)
```json
{
  "stat": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "u_data": {
      "id": 2,
      "name": "Nombre de Google",
      "email": "usuario@gmail.com",
      "rutas": []
    }
  }
}
```

#### Respuesta de Error (200)
```json
{ "stat": false, "text": "Token SSO inválido o expirado", "code": "DO_LOGIN" }
```

#### Características
- **Autenticación**: No requerida (público)
- **Variables de entorno**: `URL_AUTH_SERVICE`, `SSO_DEFAULT_ROL`
- **Librería**: `express-greenborn-sso-back` (verificación contra el SSO con caché de 12 h)
- **Auto-registro**: usuarios nuevos se crean con contraseña inutilizable y sin rutas asignadas

### 1.3 Información de Sesión
**GET** `/admin/user/info`

#### Headers
```
x-api-key: <token>
```

#### Respuesta Exitosa (200)
```json
{
  "stat": true,
  "data": {
    "id": 1,
    "name": "Administrador",
    "email": "admin@admin.com",
    "rutas": [ { "id": 1, "id_ruta_root": null, "path": "dashboard", "componente": "Dasboard", "icon": "pi-home", "title": "Dashboard", "orden_visualizacion": 1 } ]
  }
}
```

#### Características
- **Autenticación**: Requerida

### 1.4 Logout
**POST** `/admin/user/logout`

Si la sesión inició por SSO, el frontend envía en el body `sso_token` (bearer del SSO) y `unique_id`; el backend revoca la sesión en el SSO central (best-effort).

#### Body (opcional)
```json
{ "sso_token": "<bearer_token_sso>", "unique_id": "req_..." }
```

#### Respuesta Exitosa (200)
```json
{ "stat": true, "data": { "message": "Sesión cerrada" } }
```

### 1.5 Actualizar Cuenta Propia
**PUT** `/admin/user/guardar_config`

> La contraseña **no** se cambia aquí (un `pass` en el body se ignora). Para cambiarla usar [1.6](#16-cambiar-contraseña-propia).

#### Headers
```http
x-api-key: <token de sesión>
Content-Type: application/json
```

#### Parámetros (body)
| Campo | Tipo | Requerido | Reglas |
|-------|------|-----------|--------|
| `id` | number | No | Si se envía debe ser el id de la sesión; si no, responde error `No autorizado` |
| `name` | string | No | 2 a 64 caracteres (se recorta espacios) |
| `apellido` | string \| null | No | Máximo 128 caracteres; vacío guarda `null` |
| `email` | string | No | Formato `algo@dominio.ext`, 5 a 255 caracteres, único entre usuarios |
| `es_negocio` | boolean | No | Marca la cuenta como negocio |

Al menos un campo debe venir; si no, responde `No hay datos para actualizar`.

```json
{ "name": "Ana", "apellido": "Pérez", "email": "ana@example.com" }
```

#### Respuesta Exitosa (200)
```json
{ "stat": true, "data": { "message": "Cuenta actualizada correctamente" } }
```

#### Respuestas de Error
Los errores de validación responden **HTTP 200** con `stat: false` (convención de `userAdmin`):

| Código HTTP | Situación | Respuesta |
|-------------|-----------|-----------|
| 200 | Nombre fuera de rango | `{ "stat": false, "text": "El nombre debe tener entre 2 y 64 caracteres" }` |
| 200 | Apellido > 128 | `{ "stat": false, "text": "El apellido no puede superar 128 caracteres" }` |
| 200 | Email con formato inválido | `{ "stat": false, "text": "El email no tiene un formato válido" }` |
| 200 | Email ya usado por otra cuenta | `{ "stat": false, "text": "El email ya está en uso" }` |
| 200 | Body sin campos | `{ "stat": false, "text": "No hay datos para actualizar" }` |
| 200 | `id` ajeno | `{ "stat": false, "text": "No autorizado" }` |
| 401 | Sin sesión | `{ "stat": false, "text": "No hay sesion activa", "code": "DO_LOGIN" }` (200, mismo formato) |
| 403 | Sin permiso `perfil.editar` | Respuesta del middleware de RBAC |
| 404 | No aplica (la ruta siempre existe para el usuario logueado) | — |
| 422 | No se usa: los datos inválidos responden 200 con `stat: false` | — |
| 500 | Error inesperado | `{ "stat": false, "text": "..." }` (el detalle se registra sólo en el log del back) |

#### Características
- **Autenticación**: Requerida. Solo permite editar la propia cuenta (`req.session.u_data`).
- **Permisos**: `perfil.editar`
- **Autoguardado**: el front envía sólo `name`, `apellido` y `email` (con debounce).

---

### 1.6 Cambiar Contraseña Propia
**PUT** `/admin/user/cambiar_password`

#### Headers
```http
x-api-key: <token de sesión>
Content-Type: application/json
```

#### Parámetros (body)
| Campo | Tipo | Requerido | Reglas |
|-------|------|-----------|--------|
| `pass` | string | Sí | 8 a 128 caracteres, al menos una letra y un número, distinta al email y al nombre de la cuenta (sin distinguir mayúsculas) |
| `pass_repeat` | string | Sí | Debe ser idéntica a `pass` |

No se pide la contraseña actual (decisión D2 del plan 1.8.37). La contraseña se guarda con `bcrypt` (costo 10) y nunca se devuelve ni se registra en logs.

```json
{ "pass": "Clave2026", "pass_repeat": "Clave2026" }
```

#### Respuesta Exitosa (200)
```json
{ "stat": true, "data": { "message": "Contraseña actualizada correctamente" } }
```

La sesión actual no se cierra.

#### Respuestas de Error
Igual que 1.5, los errores de validación responden **HTTP 200** con `stat: false`:

| Código HTTP | Situación | Respuesta |
|-------------|-----------|-----------|
| 200 | `pass` y `pass_repeat` distintas | `{ "stat": false, "text": "Las contraseñas no coinciden" }` |
| 200 | Regla incumplida | `{ "stat": false, "text": "La contraseña debe tener al menos 8 caracteres" }` (o: `... no puede superar 128 caracteres`, `... debe incluir al menos una letra`, `... debe incluir al menos un número`, `... no puede ser igual al email`, `... no puede ser igual al nombre`, `La contraseña es requerida`) |
| 401 | Sin sesión | `{ "stat": false, "text": "No hay sesion activa", "code": "DO_LOGIN" }` (HTTP 200) |
| 403 | Sin permiso de la ruta | Respuesta del middleware de RBAC |
| 404 | No aplica | — |
| 422 | No se usa: las validaciones responden 200 con `stat: false` | — |
| 500 | Error al guardar | `{ "stat": false, "text": "No se pudo cambiar la contraseña" }` (HTTP 200; el detalle no se expone) |

#### Características
- **Autenticación**: Requerida. Cambia sólo la contraseña de la sesión.
- **Validación**: en back (`back/helpers/password_reglas.js`) y en front (modal de cambio).

---

### 2. Gestión de Usuarios (`/admin/user/*`)

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `/user/get_all` | GET | `usuarios.ver` | Listado paginado (rows + fields_def) |
| `/user/add_one` | POST | `usuarios.crear` | Crear usuario con roles |
| `/user/put_one` | PUT | `usuarios.editar` | Actualizar usuario y sus roles |
| `/user/delete_one` | DELETE | `usuarios.eliminar` | Eliminar usuario |

#### Crear usuario
**POST** `/admin/user/add_one`
```json
{ "name": "Analista", "email": "analista@empresa.com", "pass": "clave123", "roles": [1] }
```

#### Listado (contrato TableEditor)
**GET** `/admin/user/get_all?page=1&pageSize=25&search=&sortField=id&sortOrder=asc&filters={}`
```json
{
  "stat": true,
  "data": {
    "rows": [ { "id": 1, "name": "Administrador", "email": "admin@admin.com", "roles": [ { "id": 1, "nombre": "administrador" } ] } ],
    "fields_def": [ { "field": "id", "headerName": "ID", "sortable": true } ],
    "total": 1,
    "page": 1,
    "pageSize": 25
  }
}
```

**Contrato de listado paginado** (aplica a `user/get_all` y a `rbac/get_roles`, `rbac/get_permisos`, `rbac/get_rutas`):

| Query param | Tipo | Descripción |
|-------------|------|-------------|
| `page` | int | Página (default 1) |
| `pageSize` | int | Tamaño de página (default 25) |
| `search` | string | Búsqueda global (LIKE sobre campos principales) |
| `sortField` | string | Campo de orden (whitelist por recurso; default `id`) |
| `sortOrder` | string | `asc` o `desc` (default `asc`) |
| `filters` | JSON string | Filtros por columna `{ "campo": "valor" }` (LIKE) |

Respuesta: `{ stat: true, data: { rows, fields_def, total, page, pageSize } }`.

### 3. Gestión de Roles (`/admin/rbac/*`)

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `/rbac/get_roles` | GET | `roles.ver` | Listar roles |
| `/rbac/nuevo_rol` | POST | `roles.crear` | Crear rol |
| `/rbac/editar_rol` | PUT | `roles.editar` | Editar rol |
| `/rbac/eliminar_rol` | DELETE | `roles.eliminar` | Eliminar rol (protege `administrador`) |
| `/rbac/asignar_permiso_rol` | POST | `roles.editar` | Vincular permiso a rol |
| `/rbac/asignar_usuario_rol` | POST | `usuarios.editar` | Asignar rol a usuario |

### 4. Gestión de Permisos (`/admin/rbac/*`)

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `/rbac/get_permisos` | GET | `permisos.ver` | Listar permisos |
| `/rbac/nuevo_permiso` | POST | `permisos.crear` | Crear permiso |
| `/rbac/editar_permiso` | PUT | `permisos.editar` | Editar permiso |
| `/rbac/eliminar_permiso` | DELETE | `permisos.eliminar` | Eliminar permiso |

### 5. Gestión de Rutas (`/admin/rbac/*`)

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `/rbac/get_rutas` | GET | `rutas.ver` | Listar rutas del panel |
| `/rbac/nueva_ruta` | POST | `rutas.crear` | Crear ruta |
| `/rbac/editar_ruta` | PUT | `rutas.editar` | Editar ruta |
| `/rbac/eliminar_ruta` | DELETE | `rutas.eliminar` | Eliminar ruta |

#### Asignar permiso a rol
**POST** `/admin/rbac/asignar_permiso_rol`
```json
{ "id_rol": 1, "id_permiso": 2 }
```
```json
{ "stat": true, "data": { "message": "Permiso vinculado al rol" } }
```

#### Características generales del RBAC
- **Autenticación**: Requerida en todos los endpoints `/admin/*` excepto `/admin/user/login`.
- **Permisos**: Validados por el middleware `helpers/authorization.js` según el permiso declarado por ruta.
- **Formato**: Respuestas de listado usan el contrato del `TableEditor` (`rows` + `fields_def`).
- **Roles base**: `administrador` (acceso total) y `usuario` (puede publicar precios vía formulario; rol por defecto de los usuarios creados vía SSO).
- **Seed**: `scripts/seed_rbac.js` (idempotente) crea los roles, 20 permisos base, las rutas del panel y asegura el **admin único** (`ADMIN_EMAIL`, por defecto `lucho.2012.tandil@gmail.com`): remueve el rol `administrador` de cualquier otro usuario y lo asigna al admin único en su primer login SSO (`sso.js::asegurar_rol_admin`).

#### Contraseña local de usuarios

El seed RBAC **no crea cuentas con contraseña**: los usuarios creados vía SSO reciben una contraseña aleatoria inutilizable. Para habilitar el login local (`POST /admin/user/login`) de cualquier usuario, definí o restablecé su contraseña con:

```bash
# Actualiza la contraseña de un usuario existente (busca por email, case-insensitive)
./back/scripts/set_password.sh usuario@dominio.com MiContraseña123

# Si el usuario no existe, crearlo con el rol "usuario"
./back/scripts/set_password.sh nuevo@dominio.com MiContraseña123 --crear

# Sin pasar la contraseña como argumento, la pide de forma interactiva (oculta)
./back/scripts/set_password.sh usuario@dominio.com
```

El script lee `back/.env`, hashea la contraseña con **bcrypt** (mismo esquema que el login local) y la guarda en `usuarios.pass`. Salidas: `0` éxito, `1` error de conexión/parámetros, `2` usuario inexistente (sin `--crear`).

### Tablas RBAC

`usuarios`, `roles`, `permisos`, `rutas` y las tablas puente `usuarios_roles`, `roles_permisos`, `roles_rutas`.

---

## 📝 Ejemplos Prácticos

### 1. Buscar y Obtener Precios

```bash
# Buscar productos
curl -X GET "http://localhost:3001/publico/busqueda/precios?product_name=leche"

# Respuesta
{
  "stat": true,
  "items": [
    {
      "product_id": "abc123",
      "name": "Leche La Serenísima 1L",
      "price": 1250,
      "branch_name": "Centro"
    }
  ]
}
```

### 2. Importar Precios Nuevos

```bash
curl -X POST "http://localhost:3001/publico/productos/importar_articulo_plataforma" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "Leche 1L",
      "price": 1250,
      "currency": "ARS",
      "category_name": "Almacén > Lácteos",
      "plataforma": "ml",
      "enterprise_id": 1,
      "branch_id": 5
    }
  ]'
```

### 3. Actualizar Precio Existente

```bash
curl -X PUT "http://localhost:3001/publico/productos/cargar_nuevo_precio" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "abc123",
    "branch_id": 5,
    "price": 1300
  }'
```

---

## 🚀 Versiones y Compatibilidad

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.1 | 2025-11-30 | ✅ Búsqueda case-insensitive, validación branch_id |
| 1.0 | 2025-07-22 | 🎉 Lanzamiento inicial |

---

## 📞 Soporte

Para reportar problemas con los endpoints:
1. Verificar documentación
2. Revisar logs del servidor
3. Contactar al equipo de desarrollo

---

**Última actualización**: 24 de julio de 2026  
**Mantenedor**: Equipo de Backend
