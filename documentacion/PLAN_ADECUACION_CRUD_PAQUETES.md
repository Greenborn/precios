# Plan de adecuación: CRUD admin sobre paquetes Greenborn

Estado (2026-11-22): **aprobado parcialmente y ejecutado**; pendiente de verificación en runtime.

- Modal, fase A: hecha. `AppStore` delega en `useModal()`; `App.vue` monta `<ModalContainer />`. `ModalsManager.vue` queda sin uso (se borra en fase D).
- Piloto alias categorías: hecho. Back sobre `createCrudRouter` con hooks de duplicado y de borrado en uso; front `CrudModulo` vía `helpers/crudHttp.js`. El panel de alias dentro de Categorías (`AliasCategoria.vue`) y el dashboard se migraron al nuevo contrato.
- Precios comunitarios (parcial): hecho. Listado con el paquete (`soloLectura`); borrado propio `DELETE /:id` conservando la lógica de `price_today` y cachés. Alta y edición no existen.
- Gestión de usuarios: sin cambios de CRUD (sólo se agregó `permisos` a `/user/info`).
- Permisos nuevos a sembrar: `alias_categorias.listar`, `precios.listar`. Aplican al reiniciar el back (seed automático). El rol administrador los recibe solo; otros roles con `.ver` deben recibir también `.listar`.

Pendiente de verificar con base de datos real: joins de `precios_comunitarios` (columnas sin calificar `date_time` y `price` con joins activos), y el aspecto visual de modales sobre el CSS del paquete (fase B).

Paquetes instalados (2026-11-22):
- `back/`: `@greenborn/express-greenborn-crud@^0.4.0`
- `front/`: `@greenborn/vue-greenborn-crud@^0.4.0`, `@greenborn/vue-greenborn-modal-manager@^1.7.1`

Decisiones ya tomadas por el responsable:
1. Los CRUD admin deben usar las rutas y el contrato que provee `express-greenborn-crud`.
2. Mismo criterio que el punto 1 para el front (`CrudModulo` de `vue-greenborn-crud`).
3. **La gestión de usuarios no se delega** al paquete CRUD (al menos por ahora). Queda con su código actual (`routes/userAdmin.js`, `api/admin/gestionUsuarios.js`, `AbmAdmins.vue`).
4. Hace falta un plan de adecuación para usar `vue-greenborn-modal-manager` (ver sección 2).

---

## 1. Migración de CRUD al paquete

### 1.1 Contrato a adoptar

Back (`express-greenborn-crud`), por recurso montado en `/admin/<recurso>`:

| Operación | Ruta | Permiso |
|---|---|---|
| Listar | `GET /list` | `<recurso>.listar` |
| Ver | `GET /:id` | `<recurso>.ver` |
| Crear | `POST /` | `<recurso>.crear` |
| Editar | `PUT /:id` | `<recurso>.editar` |
| Eliminar | `DELETE /:id` | `<recurso>.eliminar` |

Respuestas: `{ status: true, data }`; errores con código HTTP y `{ status: false, message }`.

Front (`CrudModulo`): espera `GET {endpoint}/list`, `POST {endpoint}`, `PUT {endpoint}/:id`, `DELETE {endpoint}/:id`, un cliente `http` que **rechace** ante error HTTP, y permisos como array de strings.

### 1.2 Diferencias con el código actual de precios

| Aspecto | Precios hoy | Paquete |
|---|---|---|
| Rutas | `/get_all`, `/add_one`, `/put_one`, `/delete_one` con id en body | `/list`, `POST /`, `/:id` |
| Respuesta | `{ stat, data }` o `{ stat:false, text }`, HTTP 200 | `{ status, data }`, HTTP de error |
| Autorización | `middleware/Admin` + rutas RBAC propias | `sso.requirePermission('<recurso>.<accion>')` |
| Listado | `fields_def` y `rows` vía `buildVteList` | `GET /list` con `fields_def` incluido |
| Modales | `AppStore.mostrar_modal` / `DialogConfirm` / `FormularioGenerico` | `CrudModulo` usa modal-manager (ver sección 2) |

### 1.3 Inventario y propuesta por CRUD

| CRUD | Back actual | Front actual | Propuesta |
|---|---|---|---|
| Alias categorías | `routes/aliasCategorias.js` | `abmAliasCategorias/` | **Candidato piloto.** Tabla simple, sin id compuesto. Revisar `categorias_disponibles` (no es CRUD, queda como endpoint auxiliar). |
| Índices de precios | `routes/indicesPreciosAdmin.js` | `abmIndicesPrecios/` | Candidato. Revisar `alias_categoria_disponibles` (auxiliar). |
| Alias productos | `routes/alias_productos.js` | `abmAliasProductos/` | **Difícil.** Id compuesto `alias||product_id`; el paquete asume `:id` simple. Requiere `pk` compuesta o `hooks`. Postergar. |
| Precios comunitarios | `routes/preciosComunitarios.js` (solo `get_all` y `delete_one`) | `abmPrecios/` | **Parcial.** Sin alta/edición en back. Migrar solo listado y borrado, o dejar. Decidir. |
| Categorías (árbol) | `routes/categoriasAdmin.js` | `abmCategorias/` (árbol) | **No migrar.** Es un árbol con `add_producto`/`remove_producto` y `arbol`. Queda con su código. |
| Roles, permisos, rutas | `routes/rbac.js` | `acceso/abmRoles`, `abmPermisos`, `abmRutas` | **Riesgoso.** Es el propio RBAC que valida `requirePermission`. Migrar al final y con cuidado: un error bloquea el acceso admin. |
| Usuarios | `routes/userAdmin.js` | `abmAdmin/AbmAdmins.vue` | **Fuera de alcance** (decisión 3). |

Orden propuesto: alias categorías → índices de precios → precios comunitarios (parcial) → roles/permisos/rutas.

### 1.4 Pasos por CRUD migrado

1. **Back**: montar `createCrudRouter` en `/admin/<recurso>` detrás del middleware de auth, con `sso` de `back/sso.js`, `recurso`, `tabla`, `campos` y `filtroBase` si aplica. Usar `hooks` solo para validaciones (no para sustituir reglas de negocio ya existentes).
2. **Permisos**: agregar `<recurso>.listar|ver|crear|editar|eliminar` al seed de RBAC. Recordar que el seed no aplica sin reiniciar el back o correr el seed a mano (memoria del proyecto).
3. **Front**: reemplazar el componente por `CrudModulo` con `endpoint="/admin/<recurso>"`, `:http` adaptado (ver 1.5) y `:permisos` del store.
4. **Retirar** las rutas viejas (`get_all`, `add_one`, etc.) y su API en `front/src/api/admin/`, una vez verificado el reemplazo.
5. **Verificar**: listado, filtros, alta, edición, borrado y error de permiso (usuario sin el permiso no ve el botón ni recibe datos).

### 1.5 Adaptadores necesarios (en precios, no en el paquete)

- **Cliente `http`** para `CrudModulo`: envolver `requestAdmin` para que lance ante error y devuelva el body `{ status, data }`. Va en `front/src/helpers/`.
- **Back**: no se toca el paquete. Las rutas nuevas conviven con las viejas hasta terminar la migración.

### 1.6 Riesgos

- Las rutas de `express-greenborn-crud` usan `knex` directo para escribir. Cualquier regla que hoy vive en el route (por ejemplo, validaciones de `alias_productos` o el regenerado de diccionarios en memoria tras cada mutación de `server.js`) debe pasar a `hooks` (`despuesCrear`, `despuesEditar`, `despuesEliminar`). Si no, hay que dejar ese CRUD fuera.
- Los CRUD que regeneran diccionarios en memoria (`global.alias_busqueda`, `global.alias_productos`) necesitan un hook de recarga obligatorio.

---

## 2. Adecuación a `vue-greenborn-modal-manager`

### 2.1 Situación actual

- El estado de modales vive en `front/src/stores/app.js` (Pinia, `AppStore`), con pila `modals_`, `mostrar_modal`, `mostrar_alerta` y `mostrar_confirm`.
- Lo usan **18 archivos** del front.
- `FormularioGenerico` y `DialogConfirm` son componentes propios.

### 2.2 Diferencias con el paquete

| Concepto | Precios (`AppStore`) | Paquete (`useModal`) |
|---|---|---|
| Firma | `mostrar_modal(componente, titulo, parametros, config)` | Igual firma; `componente` admite `{ body, header, footer }` |
| Estado | Pinia | Singleton de módulo, sin Pinia |
| Contenedor | Propio en el layout | `<ModalContainer />` montado **una vez** en `App.vue` |
| Confirmación | `DialogConfirm` con `accion_a_confirmar` | `mostrar_confirm({ title, text, confirmar_accion, no_confirma_accion, severity_confirmar })` |
| Alerta | `mostrar_alerta(texto)` | Igual nombre; admite HTML |
| Callback de guardado | `guardado` / `onSubmit` en `CrudModulo` (vía `buildCrud`) | `CrudModulo` usa el singleton del paquete |

### 2.3 Riesgo principal

`CrudModulo` abre sus formularios y confirmaciones con el modal-manager del paquete. Si el front mantiene además `AppStore.mostrar_modal`, habrá **dos pilas de modales** con dos contenedores: se pueden superponer, apilar mal el z-index o cerrar en el lugar equivocado. Por eso la adecuación debe ser de una sola pila.

### 2.4 Fases

**Fase A: fachada.** En `AppStore`, reemplazar la implementación interna de `mostrar_modal`, `mostrar_alerta` y `mostrar_confirm` por llamadas a `useModal()` del paquete. La firma pública no cambia, así que los 18 archivos no se tocan en esta fase. Montar `<ModalContainer />` en `App.vue` y quitar el contenedor propio.

**Fase B: estilos.** El paquete trae CSS propio que reemplaza Bootstrap y PrimeVue. Revisar qué clases de modal de precios dependen de Bootstrap (`.modal`, `.modal-dialog`) y de PrimeVue (`p-dialog`). Importar `@greenborn/vue-greenborn-modal-manager/style.css` solo después de mapear esas clases, para no romper modales existentes.

**Fase C: parámetros y componentes.** Verificar que los componentes actuales (`FormularioGenerico`, `DialogConfirm`, y los modales que reciben `parametros`) funcionen con las claves reservadas que inyecta el paquete. Migrar `DialogConfirm` a `mostrar_confirm` del paquete.

**Fase D: retirar lo propio.** Quitar `FormularioGenerico` y `DialogConfirm` solo cuando ningún archivo los use.

**Fase E: validación.** Abrir y cerrar modales anidados, alerta sobre confirmación, y el formulario de `CrudModulo`. Verificar en pantalla de escritorio y móvil.

### 2.5 Criterio de salida

- Una sola pila de modales en la app.
- Ningún uso directo de los componentes de modal propios en las pantallas migradas.
- `vite build` sin errores.

---

## 3. Preguntas abiertas para el responsable

1. ¿Migramos el piloto solo con **alias categorías** y luego evaluamos, o incluimos también índices de precios desde el inicio?
2. ¿Precios comunitarios se migra parcial (listado y borrado) o se deja tal cual?
3. ¿La fase A del modal (fachada en `AppStore`) puede hacerse antes de migrar los CRUD? Recomiendo sí, porque es independiente y reduce el riesgo.
