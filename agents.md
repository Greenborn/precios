# Guía de Componentes Reutilizables - Formularios Administrativos

**⚠️ IMPORTANTE:** No realizar commits. El usuario se encarga de crear los commits con su propia firma.

**⚠️ IMPORTANTE:** Prohibido matar procesos (`kill`, `pkill`, `killall`, `xargs kill`, etc.) sin preguntar antes al usuario. En especial, nunca usar un patrón genérico (ej. `pkill -f "vite"`, `pkill -f node`) para bajar un proceso propio: puede matar procesos de otros proyectos que ya estaban corriendo. Si hay que terminar un proceso levantado en la sesión, matar el PID exacto devuelto al lanzarlo (o el job en foreground/background), nunca por patrón de nombre.

Esta guía documenta los componentes genéricos reutilizables para formularios administrativos en el sistema Greenborn.

## ProductSelector

Componente genérico para seleccionar productos con búsqueda remota y visualización del elemento seleccionado en un badge.

### Ubicación
`front/src/components/genericos/ProductSelector.vue`

### Características
- **Búsqueda remota**: Realiza búsquedas en el backend mediante una función configurable
- **Autocompletado**: Dropdown con resultados filtrados
- **Badge de visualización**: Muestra el producto seleccionado en un badge visual
- **Caching automático**: Cachea los productos seleccionados para visualización rápida
- **Totalmente reutilizable**: No está acoplado a ninguna entidad específica

### Uso en Formularios

#### Opción 1: Uso directo en componentes (recomendado para casos complejos)

```vue
<template>
  <ProductSelector
    :modelValue="productoId"
    :displayValue="nombreProducto"
    :search="buscar_productos"
    :optionLabel="'name'"
    :optionValue="'id'"
    label="Seleccionar producto"
    placeholder="Buscar producto..."
    @update:modelValue="productoId = $event"
    @item-selected="onProductoSeleccionado" />
</template>

<script setup>
async function buscar_productos(q) {
  const res = await fetch(`/api/productos?search=${q}`)
  return res.json()
}

function onProductoSeleccionado(producto) {
  console.log('Producto seleccionado:', producto)
}
</script>
```

#### Opción 2: Uso integrado en FormularioGenerico (recomendado para CRUD con tableEditor)

Configura el campo con `form_type: 'product-selector'` en tus campos de formulario:

```javascript
// En tu componente ABM (ej: AbmAliasProductos.vue)
function campos_form() {
  return [
    { 
      field: 'product_id', 
      headerName: 'Producto', 
      form_type: 'product-selector',  // <-- Usar 'product-selector'
      required: true,
      display_field: 'product_name',  // Campo que muestra el nombre
      autocomplete: {
        search: buscar_productos,      // Función de búsqueda
        label: 'name',                 // Campo a mostrar en dropdown
        optionValue: 'id',             // Campo a usar como valor
        placeholder: 'Buscar producto...',
      }
    },
    // ... otros campos
  ]
}

async function buscar_productos(q) {
  const res = await get_productos({ search: q, limit: 20 })
  return (res && res.stat && res.data?.rows) || []
}
```

### Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `modelValue` | Any | No | Valor seleccionado (binding con v-model) |
| `displayValue` | String | No | Texto a mostrar en el input |
| `search` | Function | Sí | Función async que realiza la búsqueda remota |
| `optionLabel` | String | No | Campo del objeto que se muestra (default: 'name') |
| `optionValue` | String | No | Campo del objeto que se usa como valor (default: 'id') |
| `label` | String | No | Etiqueta del campo (default: 'Seleccionar producto') |
| `placeholder` | String | No | Texto placeholder (default: 'Buscar producto por nombre...') |
| `disabled` | Boolean | No | Deshabilita el componente |
| `selectedItem` | Object | No | Objeto del elemento seleccionado (para mostrar en badge) |
| `onSelect` | Function | No | Callback ejecutado después de seleccionar |

### Eventos

| Evento | Parámetro | Descripción |
|--------|-----------|-------------|
| `update:modelValue` | value | Se emite cuando cambia el valor seleccionado |
| `item-selected` | item | Se emite con el objeto completo cuando se selecciona un item |

### Integración con FormularioGenerico

El componente ProductSelector está totalmente integrado con `FormularioGenerico.vue`, que:
1. Detecta el `form_type: 'product-selector'`
2. Crea automáticamente un cache de productos seleccionados
3. Muestra el badge con el nombre del producto
4. Mantiene el binding con el modelo del formulario

### Ejemplos de Implementación

#### ABM de Alias de Productos (actual)
Ver: `front/src/components/admin/abmAliasProductos/AbmAliasProductos.vue`

Los campos están configurados para usar `form_type: 'product-selector'`, lo que automáticamente:
- Abre un dropdown con búsqueda de productos
- Muestra un badge con el nombre del producto seleccionado
- Cachea los productos para acceso rápido

#### Crear un nuevo ABM con selector de productos

1. Importa los helpers necesarios
2. Define la función de búsqueda de productos
3. Añade el campo con `form_type: 'product-selector'`

```javascript
import { get_productos } from '@/api/admin/productos'

async function buscar_productos(q) {
  const res = await get_productos({ search: q, limit: 20 })
  return (res && res.stat && res.data?.rows) || []
}

function campos_form() {
  return [
    {
      field: 'product_id',
      headerName: 'Producto',
      form_type: 'product-selector',
      required: true,
      display_field: 'product_name',
      autocomplete: {
        search: buscar_productos,
        label: 'name',
        optionValue: 'id',
      }
    },
    // ... otros campos
  ]
}
```

### Notas Importantes

- El cache se actualiza automáticamente cuando se selecciona un producto
- La búsqueda es **remota** y se ejecuta en el backend
- El componente respeta el estado `disabled` del campo
- Los badges se actualizan reactivamente cuando cambiar los productos seleccionados
- Compatible con todos los modos del FormularioGenerico (crear, editar)

### Mantenimiento

Si necesitas:
- **Cambiar el estilo del badge**: Modifica el archivo `ProductSelector.vue` en la sección `<style scoped>`
- **Añadir nuevas propiedades**: Actualiza el `defineProps` del componente
- **Modificar el comportamiento**: Cambia la lógica en las funciones `handleSelect` y watchers

---

*Última actualización: 2026-10-16*
