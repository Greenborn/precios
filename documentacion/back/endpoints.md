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

El módulo RBAC gestiona usuarios, roles, permisos y rutas del panel de administración. En esta etapa existe un único rol: **`administrador`**.

### Autenticación (JWT)

- Login público → devuelve `token` y `u_data` (incluye `rutas` para el menú).
- El token se envía en el header `x-api-key` (o `Authorization: Bearer <token>`) en el resto de los endpoints `/admin/*`.
- Variable de entorno: `JWT_SECRET`, `JWT_EXPIRES_IN`.

### 1.1 Login
**POST** `/admin/user/login`

#### Body
```json
{ "email": "admin@admin.com", "password": "admin123" }
```

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

#### Body
```json
{ "id": 1, "name": "Administrador", "email": "admin@admin.com", "pass": "nueva_clave" }
```

#### Respuesta Exitosa (200)
```json
{ "stat": true, "data": { "message": "Cuenta actualizada correctamente" } }
```

#### Características
- **Autenticación**: Requerida. Solo permite editar la propia cuenta.
- **Permisos**: `perfil.editar`

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
- **Seed**: `scripts/seed_rbac.js` (idempotente) crea el rol `administrador`, 18 permisos base, las rutas del panel y el usuario por defecto `admin@admin.com`.

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
