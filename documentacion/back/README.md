# 🔧 Backend del Proyecto Precios

API REST para gestión de precios, productos y comercios. Implementado con **Node.js**, **Express** y **MySQL**.

## 📌 Descripción General

El backend proporciona:
- ✅ **API REST** para búsqueda, importación y gestión de precios
- ✅ **Sistema de búsqueda** optimizado en memoria
- ✅ **Importación asíncrona** de múltiples plataformas
- ✅ **Seguimiento de variaciones** de precios
- ✅ **Gestión de roles y permisos**

## 📚 Documentación

### Conceptos Fundamentales
| Documento | Contenido |
|-----------|----------|
| **[Arquitectura](./arquitectura.md)** | Diseño general, componentes, flujo de datos |
| **[Definición Técnica](./definicion_tecnica.md)** | Stack, base de datos, modelos |
| **[Endpoints](./endpoints.md)** | API REST completa con ejemplos |

### Funcionalidades Avanzadas
| Documento | Contenido |
|-----------|----------|
| **[Búsqueda Dinámica](../../back/documentacion/busqueda_dinamica.md)** | Búsqueda en tiempo real, case-insensitive |
| **[Validación por Sucursal](../../back/documentacion/validacion_branch_id.md)** | Separación de precios, garantías |

### Cambios Recientes
| Documento | Contenido |
|-----------|----------|
| **[Changelog](../../back/CHANGELOG_busqueda_dinamica.md)** | Mejoras v1.1 |

## 🚀 Inicio Rápido

### 1. Instalación de Dependencias
```bash
cd back
npm install
```

### 2. Configuración del Entorno
```bash
cp ../env.example ../.env
# Edita ../.env con tus valores
```

### 3. Iniciar el Servidor
```bash
npm start
# Servidor escuchando en puerto definido en .env
```

### 4. Ejecutar Tests
```bash
# Búsqueda dinámica
node test_busqueda_dinamica.js

# Validación por sucursal
node test_validacion_branch_id.js

# Búsqueda case-insensitive
node test_case_insensitive.js
```

## 📁 Estructura de Carpetas

```
back/
├── controllers/          # Lógica de negocio
│   ├── busqueda_productos.js
│   └── importar_productos.js
├── routes/               # Definición de rutas
│   ├── busqueda.js
│   ├── categorias.js
│   ├── productos.js
│   ├── estadistica.js
│   └── userAdmin.js
├── middleware/           # Control de acceso
│   ├── Publico.js
│   └── Admin.js
├── models/               # Modelos de datos
│   ├── BaseModel.js
│   ├── UsuarioModel.js
│   ├── RolModel.js
│   └── ...
├── helpers/              # Utilidades
│   ├── utils.js
│   ├── authorization.js
│   └── processing.js
├── scripts/              # Scripts administrativos
│   ├── actualizar_price_today.js
│   ├── unificar_productos.js
│   └── ...
├── migrations/           # Migraciones de DB
├── informes/             # Generadores de reportes
├── documentacion/        # Documentación específica
├── db/                   # Configuración de base de datos
├── test_*.js             # Tests automatizados
├── server.js             # Punto de entrada
├── knexfile.js           # Config de Knex ORM
└── package.json
```

## 🔑 Componentes Clave

### Búsqueda de Productos
- **Archivo**: `controllers/busqueda_productos.js`
- **Características**:
  - Búsqueda indexada por iniciales
  - Case-insensitive
  - Actualización dinámica
  - Soporte multi-palabra
- **Consulta**: [Búsqueda Dinámica](../../back/documentacion/busqueda_dinamica.md)

### Importación de Precios
- **Archivos**: `routes/productos.js` (encola) y
  `extra_services/actualizar_precios.py` (procesa, proceso aparte)
- **Características**:
  - Cola externa (servicio Node en 3501): el backend solo encola
  - El consumidor Python toma **un item por request** y escribe en la base, para
    no volcar el volumen diario de golpe
  - Transacciones de base de datos
  - Validación inteligente
  - Estadísticas automáticas
  - Reintento de fallos transitorios con backoff
- **Consulta**: [Endpoints](./endpoints.md#importación) ·
  [Servicio de colas externo](../../back/documentacion/servicio_colas_externo.md)

### Actualización de Precios Actuales
- **Archivo**: `scripts/actualizar_price_today.js`
- **Características**:
  - Se ejecuta cada 24 horas
  - Procesa en chunks para performance
  - Actualiza estructura de búsqueda
  - Ejecutado en proceso hijo separado

### Validación por Sucursal
- **Garantía**: Precios completamente separados por `product_id + branch_id`
- **Consulta**: [Validación Branch ID](../../back/documentacion/validacion_branch_id.md)

## 💾 Base de Datos

### Tablas Principales
| Tabla | Descripción |
|-------|-----------|
| `products` | Catálogo de productos |
| `price` | Historial completo de precios |
| `price_today` | Precios actuales (cache) |
| `branch` | Sucursales/comercios |
| `enterprise` | Empresas |
| `category` | Categorías de productos |
| `estadistica_aumento_diario` | Variaciones diarias |

**Más detalles**: [Definición Técnica](./definicion_tecnica.md#base-de-datos)

## 🔐 Seguridad

### Autenticación y Autorización
- Middleware: `middleware/Admin.js` y `middleware/Publico.js`
- Roles: Usuario, Admin
- Permisos granulares

### Validaciones
- Sanitización de datos de entrada
- Límites por IP para evitar spam
- Validación de campos requeridos
- Transaccionalidad en operaciones críticas

**Más detalles**: [Validación Branch ID](../../back/documentacion/validacion_branch_id.md)

## 📊 API REST

### Endpoints Principales
- **Búsqueda**: `GET /publico/busqueda/precios`
- **Categorías**: `GET /publico/categorias/all`
- **Productos**: `GET /publico/productos/all`
- **Cargar Precio**: `PUT /publico/productos/cargar_nuevo_precio`
- **Importar**: `POST /publico/productos/importar`

**Documentación completa**: [Endpoints](./endpoints.md)

## 🧪 Testing

### Tests Incluidos
```bash
# Test de búsqueda dinámica (8 casos)
node test_busqueda_dinamica.js

# Test de separación por sucursal (10 casos)
node test_validacion_branch_id.js

# Test de búsqueda case-insensitive (7 casos)
node test_case_insensitive.js
```

**Estado**: ✅ Todos pasan exitosamente

## 📈 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Runtime** | Node.js |
| **Framework Web** | Express.js |
| **ORM** | Knex.js |
| **Base de Datos** | MySQL 8+ |
| **Async** | Promesas, async/await |
| **Validación** | Lógica personalizada |

**Dependencias completas**: Ver `package.json`

## 🔄 Flujos Principales

### 1. Búsqueda de Precios
```
Cliente → GET /publico/busqueda/precios
       → Búsqueda en estructura indexada
       → Enriquecimiento de datos
       → Respuesta con empresa, sucursal, precio
```

### 2. Importación de Precios
```
Sistema Externo → POST /publico/productos/importar
              → Backend: valida, marca `tipo` y encola (POST /add_data)
              → Servicio de Colas (Node, 3501): almacena y persiste
              → Consumidor Python: GET /get_data, un item por vez
              → Validación y normalización
              → Insertar en DB
              → Actualizar price_today
              → Actualizar estructura de búsqueda
              → POST /interno/sync_cache (refresca cache de la API)
```

### 3. Actualización de Precios Actuales (24h)
```
Scheduler → fork() actualizar_price_today.js
        → Procesa combinaciones product_id + branch_id
        → Selecciona precios más recientes
        → Actualiza price_today
        → Reconstruye estructura de búsqueda
```

## 🛠️ Configuración

### Variables de Entorno Clave
```
# Base de Datos
mysql_host=localhost
mysql_user=root
mysql_password=
mysql_database=precios

# API
service_port_api=3000
cors_origin=http://localhost:5173

# Seguridad
KEY_INT=clave_secreta_interna

# Búsqueda
PRICE_TODAY_CHUNK_SIZE=5000
```

**Completas**: Ver `../env.example`

## 📞 Soporte

### Preguntas Frecuentes

**¿Cómo agregar un nuevo endpoint?**
- Crear archivo en `routes/`
- Montar en `server.js`
- Documentar en `endpoints.md`
- Ver [Endpoints](./endpoints.md) para convenciones

**¿Cómo importar productos?**
- Usar POST `/publico/productos/importar` con `KEY_INT`
- Ver [Endpoints](./endpoints.md#importación) para formato

**¿Por qué el precio no aparece en búsqueda?**
- Verificar en `price_today` (requiere precio > 0)
- Esperar actualización de estructura de búsqueda (2-24h)

**¿Cómo garantizar que no se pisen precios?**
- Sistema valida `product_id + branch_id` automáticamente
- Ver [Validación Branch ID](../../back/documentacion/validacion_branch_id.md)

---

**Versión**: 1.1  
**Última actualización**: 30 de noviembre de 2025 
