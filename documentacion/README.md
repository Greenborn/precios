# 📚 Documentación del Proyecto Precios

Plataforma de seguimiento y comparación de precios de productos en múltiples comercios.

## 📋 Contenido de la Documentación

```
documentacion/
├── back/              # Documentación del backend
│   ├── README.md
│   ├── arquitectura.md
│   ├── definicion_tecnica.md
│   ├── endpoints.md
│   └── [Funcionalidades específicas]
├── front/             # Documentación del frontend
│   ├── README.md
│   ├── arquitectura.md
│   └── definicion_tecnica.md
└── propuestas_mejoras.md
```

## 🎯 Guía de Inicio Rápido

### 1. Configuración del Entorno

```bash
# Copia el archivo de ejemplo
cp env.example .env

# Edita .env con tus valores
# Variables principales:
# - mysql_host, mysql_user, mysql_password, mysql_database
# - service_port_api
# - cors_origin
# - KEY_INT (clave de autenticación interna)
```

Consulta [`env.example`](../env.example) para documentación completa de todas las variables.

### 2. Estructura del Proyecto

```
precios/
├── back/              # Backend (Node.js + Express + MySQL)
│   ├── controllers/   # Lógica de negocio
│   ├── routes/        # Rutas de la API
│   ├── middleware/    # Autenticación y autorización
│   ├── models/        # Modelos de base de datos
│   ├── helpers/       # Utilidades
│   ├── scripts/       # Scripts administrativos
│   ├── migrations/    # Migraciones de base de datos
│   ├── server.js      # Punto de entrada
│   └── package.json
├── front/             # Frontend (Vue.js + Vite)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── test/              # Suite de pruebas y análisis
├── migrations/        # Migraciones compartidas
└── documentacion/     # Esta documentación
```

### 3. Documentación por Módulo

#### 🔧 Backend
- **[README Backend](./back/README.md)**: Visión general del backend
- **[Arquitectura](./back/arquitectura.md)**: Diseño arquitectónico y flujo de datos
- **[Definición Técnica](./back/definicion_tecnica.md)**: Stack tecnológico y especificaciones
- **[Endpoints](./back/endpoints.md)**: Documentación completa de la API REST
- **[Búsqueda Dinámica](../back/documentacion/busqueda_dinamica.md)**: Funcionalidades avanzadas de búsqueda
- **[Validación por Sucursal](../back/documentacion/validacion_branch_id.md)**: Garantías de separación de precios

#### 🎨 Frontend
- **[README Frontend](./front/README.md)**: Visión general del frontend
- **[Arquitectura](./front/arquitectura.md)**: Componentes y estructura Vue
- **[Definición Técnica](./front/definicion_tecnica.md)**: Stack tecnológico

## 🚀 Funcionalidades Principales

### Búsqueda de Productos
- ✅ **Búsqueda indexada en memoria** optimizada por iniciales
- ✅ **Case-insensitive** (independiente de mayúsculas/minúsculas)
- ✅ **Actualización dinámica** sin regenerar la estructura
- ✅ Soporte de múltiples palabras clave

### Gestión de Precios
- ✅ **Seguimiento de precios** en tiempo real
- ✅ **Separación estricta por sucursal** (branch_id + product_id)
- ✅ **Historial completo** de variaciones
- ✅ **Estadísticas diarias** de incrementos

### Importación de Datos
- ✅ Sistema de **cola externa** con **consumidor aparte** (procesa de a un item, sin volcar el volumen diario de golpe)
- ✅ Soporte de **múltiples plataformas** (Mercado Libre, Region20, etc.)
- ✅ **Validaciones inteligentes** de datos
- ✅ **Transaccionalidad** garantizada

### Categorización
- ✅ Estructura **jerárquica de categorías**
- ✅ Relación **flexible** producto-categoría
- ✅ Filtrado por empresa y categoría

## 📊 Modelos de Datos

### Entidades Principales
- **products**: Catálogo de productos
- **price**: Historial de precios
- **price_today**: Precios actuales (última actualización)
- **branch**: Sucursales/comercios
- **enterprise**: Empresas
- **category**: Categorías de productos
- **estadistica_aumento_diario**: Seguimiento de variaciones

Más detalles en [Definición Técnica del Backend](./back/definicion_tecnica.md)

## 🔒 Seguridad y Validación

### Garantías Implementadas
- ✅ **Validación por sucursal**: No se pisan precios entre comercios
- ✅ **Límites por IP**: Prevención de spam en carga de precios
- ✅ **Middleware de autenticación**: Control de acceso por rol
- ✅ **Sanitización de datos**: Limpieza de texto y validaciones

Consulta [Validación por Sucursal](../back/documentacion/validacion_branch_id.md) para detalles.

## 🧪 Testing

### Tests Incluidos
```bash
# Búsqueda dinámica
node back/test_busqueda_dinamica.js

# Validación de separación por sucursal
node back/test_validacion_branch_id.js

# Búsqueda case-insensitive
node back/test_case_insensitive.js
```

## 📈 Mejoras Recientes

### v1.1 - Búsqueda Mejorada y Seguridad
- ✅ Búsqueda case-insensitive
- ✅ Validación crítica por `product_id + branch_id`
- ✅ Actualización dinámica de estructura de búsqueda
- ✅ Tests automatizados exhaustivos
- ✅ Documentación técnica completa

Consulta [CHANGELOG](../back/CHANGELOG_busqueda_dinamica.md) para más detalles.

## 🗺️ Navegación Rápida

### Tareas Comunes

| Tarea | Documento |
|-------|-----------|
| Entender la arquitectura | [Arquitectura Backend](./back/arquitectura.md) |
| Usar la API | [Endpoints](./back/endpoints.md) |
| Agregar nueva funcionalidad | [Definición Técnica](./back/definicion_tecnica.md) |
| Buscar características | [Búsqueda Dinámica](../back/documentacion/busqueda_dinamica.md) |
| Entender precios | [Validación Branch ID](../back/documentacion/validacion_branch_id.md) |
| Propuestas de mejora | [Propuestas](./propuestas_mejoras.md) |

## 💡 Convenciones y Estándares

### Nomenclatura
- Tablas: `snake_case` (ej: `price_today`)
- Campos: `snake_case` (ej: `product_id`)
- Variables JS: `camelCase` (ej: `productId`)
- Funciones: `snake_case` en controladores (ej: `procesar_articulo`)

### Respuestas API
Todas las respuestas siguen el formato:
```json
{
  "stat": true,           // boolean: éxito/error
  "items": [...],         // array: datos
  "error": "mensaje"      // string opcional: error
}
```

## 🤝 Contribución

Antes de contribuir, consulta:
1. La arquitectura actual
2. Las convenciones del proyecto
3. Los tests existentes
4. [Propuestas de Mejora](./propuestas_mejoras.md)

## 📞 Soporte

Para preguntas específicas sobre:
- **API**: Ver [Endpoints](./back/endpoints.md)
- **Base de datos**: Ver [Definición Técnica](./back/definicion_tecnica.md)
- **Búsqueda**: Ver [Búsqueda Dinámica](../back/documentacion/busqueda_dinamica.md)
- **Seguridad**: Ver [Validación Branch ID](../back/documentacion/validacion_branch_id.md)

---

**Última actualización**: 30 de noviembre de 2025
**Versión del proyecto**: 1.1 