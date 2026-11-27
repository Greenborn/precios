# Plan de implementación: notas de desarrollo (lote 14, versión 1.8.37)

Fecha: 2026-11-27
Alcance: notas 336 a 339 del sistema Precios (front `front/`, back `back/`).
Documentación relacionada: [Plan lote 13 (1.8.36)](PLAN_NOTAS_DESARROLLO_1_8_36.md) · [Plan lote 12 (1.8.35)](PLAN_NOTAS_DESARROLLO_1_8_35.md) · [README general](../README.md) · [Back: arquitectura](../back/arquitectura.md) · [Back: endpoints](../back/endpoints.md) · [Propuestas de mejora](../propuestas_mejoras.md)

Estado: **PLAN APROBADO con decisiones D1–D6 (sección 3). En implementación.**

---

## 0. Reglas que aplican a todas las tareas

- **No commitear.** Sólo modificar archivos; el responsable hace los commits (ver `agents.md`).
- **No matar procesos** por patrón de nombre (regla global del usuario).
- **Seguridad** (criterios del proyecto: [back arquitectura → Seguridad y Validación](../back/arquitectura.md), [back definición técnica → Seguridad](../back/definicion_tecnica.md), [propuestas → Seguridad](../propuestas_mejoras.md)):
  - Validar entrada en back **y** front. Hoy las reglas de contraseña sólo existen en el front (`form_min_max`): el back acepta cualquier valor. Se corrige en T2.
  - Consultas con knex parametrizado; sin concatenar SQL.
  - Mensajes de error al usuario sin detalles internos (SQL, stack, rutas). Detalle sólo en `console.error` / `console.log` del back.
  - Todo endpoint de escritura sobre datos de usuario: requiere sesión y verifica propiedad (`usuario_id` / `user_id` / `propietario_id` igual al `req.user.id` o `req.session.u_data.id`). Un id ajeno responde 403 o 404, nunca modifica.
  - Contraseñas: sólo se guardan con `bcrypt` (costo 10, como hoy); nunca se devuelven en respuestas ni se registran en logs.
  - Límites de entrada: longitud máxima en todos los campos de texto y en el monto de precio (rango positivo, decimales acotados).
- **Pruebas:** el front no tiene suite automatizada. El back tiene scripts ad-hoc `back/test_*.js` (ej. `test_carga_precios_negocio.js`, `test_locales_publicos_borrado.js`). Cuando una tarea requiera casos de prueba, se delega a un subagente que los agregue o actualice con el mismo estilo. Verificación en navegador: Firefox 153 y Chrome, escritorio 1920x919.
- **Documentación:** los endpoints nuevos o modificados se documentan en `documentacion/back/endpoints.md` con la estructura obligatoria (método y ruta, headers, parámetros, respuestas 200/201 y todos los errores 400/401/403/404/422/500). Se actualiza `back/definicion_tecnica.md` si cambia el modelo de datos.
- **Versión:** no se modifica el número de versión (lo hace el script de deploy).
- **Revisión final:** un subagente de revisión recorre las notas 336–339 contra el código modificado y el checklist de la sección 5.

---

## 1. Mapa de notas a tareas

| Tarea | Nota | Archivos principales | Depende de |
|---|---|---|---|
| T1 Autoguardado con debounce en "Datos de la cuenta" | 336 | `front/src/pages/MiConfiguracion.vue`, `front/src/components/genericos/FormularioGenerico.vue` (o formulario propio), `back/routes/userAdmin.js` (`PUT /guardar_config`) | — |
| T2 Cambio de contraseña en modal con validaciones mínimas | 337 | `MiConfiguracion.vue`, nuevo componente `front/src/components/publico/CambiarPasswordModal.vue`, `back/routes/userAdmin.js` | **D2**, **D3** |
| T3 Quitar botón "Guardar" obsoleto | 338 | `MiConfiguracion.vue` (`buttons`, `FormularioGenerico`) | T1 (mismo archivo) |
| T4 Tabla propia de precios de negocio + endpoint de lectura rápida | 339 | migración nueva en `back/migrations/`, `back/routes/productos.js` (`registrar_precio_usuario`), `back/routes/negocio.js`, `back/controllers/precios_negocio.js` | **D4**, **D5** |
| T5 Editar y eliminar precios propios (sólo logueado y autor) | 339 | `back/routes/negocio.js` (nuevos `PUT`/`DELETE`), `front/src/pages/MiNegocio.vue` (sección "Mis precios"), `front/src/api/negocio.js` | T4, **D6** |
| T6 Borrado de datos de cuenta también en la tabla nueva | 339 | `back/routes/negocio.js` (`DELETE /negocio/mi-cuenta/datos`) | T4 |

### Grupos de ejecución

- **Grupo A · Cuenta (front + back)**: T1 → T3 (mismo archivo `MiConfiguracion.vue`); T2 después de T1, en paralelo con T3 sólo si se editan secciones distintas (preferible secuencial).
- **Grupo B · Precios de negocio (back)**: T4 → T6 (mismo archivo `negocio.js`) → T5 (back y front).
- **Grupo C · Pruebas y documentación**: subagente que actualiza `back/test_*.js` y `endpoints.md` una vez cerrados los grupos A y B.

Grupo A y Grupo B no comparten archivos: pueden correr en paralelo. Sólo `negocio.js` se toca en T4, T5 y T6; por eso van en orden.

---

## 2. Análisis y diseño por nota (delegable)

### T1 · Autoguardado con debounce en "Datos de la cuenta" (nota 336)
- **Situación:** `MiConfiguracion.vue` usa `FormularioGenerico` con `onSubmit: guardarConfig`; el usuario debe apretar "Guardar". Envía `PUT /user/guardar_config` con `id, name, apellido, email, pass, pass_repeat`.
- **Referencia del patrón:** `front/src/components/publico/PerfilNegocioForm.vue:55` ya implementa autoguardado con debounce (cada cambio reinicia el temporizador). Reusar el mismo criterio (800 ms, como en `ContactosForm.vue`).
- **Propuesta:**
  - Autoguardar sólo **Nombre, Apellido y Email** (la contraseña sale de este formulario, ver T2).
  - Debounce de 800 ms por campo; estados visibles: "Guardando…", "Guardado", error con mensaje del back.
  - Validar localmente antes de enviar (nombre 2–64, apellido ≤128, email con formato válido y ≤255). Si no pasa, no se envía y se muestra el error en el campo.
  - Back: validar formato de email y longitud en `guardar_config` (hoy no valida formato). Mantener la verificación de email único.
  - Un envío en curso no se pisa: si llega otro cambio, se encola el último valor.
- **Aceptación:** editar el nombre y esperar ~1 s sin tocar nada → se guarda y aparece "Guardado" sin botón. Email inválido → no se envía y se ve el error. Email ya usado → error del back legible.
- **Seguridad:** el back sigue ignorando `id` ajeno (`Number(id) !== usuario.id` → rechazo, ya existente).
- **Subagente:** front (`MiConfiguracion.vue`) + back (validación en `userAdmin.js`) + verificación en navegador.

### T2 · Cambio de contraseña en modal (nota 337)
- **Situación:** los campos `pass` y `pass_repeat` están en el formulario principal. El back `guardar_config` acepta cualquier contraseña no vacía y **no pide la contraseña actual** (cualquier sesión abierta puede cambiarla). El front no valida que coincidan en el back.
- **Propuesta:**
  - Botón **"Cambiar contraseña"** en la tarjeta de cuenta → abre modal con: contraseña nueva, repetir nueva, (ver D2) contraseña actual, y botón **Guardar**.
  - Al guardar: comprobar en el front que ambas coincidan; el back lo vuelve a comprobar.
  - Reglas mínimas (propuesta, ver D3): mínimo 8 caracteres, máximo 128, al menos una letra y un número, no igual al email ni al nombre.
  - Endpoint nuevo `PUT /user/cambiar_password` (separado de `guardar_config`) que recibe `{ pass_actual?, pass, pass_repeat }`, valida reglas, verifica `pass_actual` con `bcrypt.compare` si D2 es sí, guarda con `bcrypt.hash` y responde sin datos sensibles. Al éxito, se mantiene la sesión actual y se muestra confirmación.
  - Quitar `pass` / `pass_repeat` de `guardar_config` (dejan de ser parte del autoguardado) y del `guardarConfig` del front (`front/src/api/admin/userAdmin.js`), con el filtro de asteriscos que hoy existe.
  - Mensajes genéricos ante fallos de autenticación ("La contraseña actual no es correcta"), sin detalles internos.
- **Aceptación:** el modal valida coincidencia antes de enviar; contraseña débil → error con la regla incumplida; contraseña actual incorrecta → 401/403 con mensaje genérico; éxito → cambio aplicado y login posterior con la nueva.
- **Seguridad:** rate limit ya existe a nivel global; no registrar la contraseña en logs; no devolverla.
- **Subagente:** front (modal) + back (endpoint y validaciones) + tests del back.

### T3 · Quitar botón "Guardar" obsoleto (nota 338)
- **Situación:** el botón "Guardar" de la tarjeta de cuenta es el que se muestra en `MiConfiguracion.vue` con `buttons` de `FormularioGenerico`.
- **Propuesta:** ocultarlo (`visible: false`) para el formulario de cuenta; el guardado queda sólo por debounce (T1). Confirmar que el botón del modal de contraseña (T2) no es el mismo componente.
- **Aceptación:** la tarjeta de cuenta no muestra botón "Guardar"; el autoguardado sigue funcionando.
- **Subagente:** front, junto con T1.

### T4 · Tabla propia de precios de negocio y endpoint de lectura rápida (nota 339)
- **Situación:**
  - Los precios que carga un negocio (`cargar_precios_negocio`, `productos.js:579`, y `registrar_precio_usuario`, `productos.js:178`) se escriben en `price` (histórico, con `user_id`, `user_nombre`, `user_apellido`) y en `price_today` si corresponde a hoy/ayer. El buscador y las cachés en memoria se sincronizan desde ahí.
  - No existe endpoint que devuelva "mis precios" rápido: `GET /negocio/mis-precios` (`negocio.js:336`) recorre `price` con joins y paginación.
- **Propuesta:**
  - Migración nueva `back/migrations/2026MMDD..._precios_negocio.js`: tabla `precios_negocio` con `id` (uuid), `usuario_id` (FK a `usuarios`, not null, índice), `price_id` (referencia al registro de `price`, para mantener la relación), `product_id`, `branch_id`, `price`, `date_time`, `notas`, `creado_el`, `actualizado_el`; índices `(usuario_id, date_time)` y `(product_id, branch_id)`.
  - **Duplicación:** `registrar_precio_usuario` escribe en `price` **y** en `precios_negocio` dentro de la misma transacción, sólo si el usuario tiene `es_negocio = 1`. Los precios siguen disponibles en el resto del sistema (`price`, `price_today`, buscador) sin cambios.
  - **Backfill:** migración de datos para copiar los precios existentes de usuarios con `es_negocio` (según D4).
  - Nuevo endpoint de lectura `GET /negocio/mis-precios-rapido` (o reemplazo de `mis-precios`, ver D5): responde desde `precios_negocio`, paginado, sin joins pesados.
- **Aceptación:** tras cargar un precio de negocio, aparece en `precios_negocio` y en `price`; el endpoint responde en tiempo acotado con datos del mismo usuario; los precios siguen apareciendo en búsqueda pública.
- **Seguridad:** filtro obligatorio por `usuario_id = req.user.id` (sesión negocio); cualquier `usuario_id` de la query se ignora.
- **Subagente:** back (migración, controlador, endpoint) + test `back/test_*.js` de duplicación y consistencia.

### T5 · Editar y eliminar precios propios (nota 339)
- **Situación:** **no existen** endpoints de edición ni borrado de precios de negocio. El único borrado de precios es el de cuenta completa (T6). Existe `DELETE /precios-comunitarios/:id` (`preciosComunitarios.js:131`) pero exige permiso `precios.eliminar` de administrador, no el dueño.
- **Propuesta:**
  - `PUT /negocio/mis-precios/:id` (sesión negocio): sólo permite cambiar `price` (y, según D6, `notas` / fecha). Verifica que el registro en `precios_negocio` tenga `usuario_id = req.user.id`; si no, 404 (no revelar existencia).
  - `DELETE /negocio/mis-precios/:id`: mismo control; borra en `precios_negocio` y en `price` / `price_today` vinculados, y quita del buscador y de las cachés (`quitar_de_caches`).
  - Ambos endpoints: validar `:id` (uuid), precio positivo con ≤2 decimales y rango máximo; responder 401 sin sesión, 403/404 si no es propio, 422 si los datos no validan.
  - Front: en la sección "Mis precios" de `MiNegocio.vue` agregar botones editar/eliminar por fila; eliminar pide confirmación con `storeApp.mostrar_confirm`.
- **Aceptación:** sin sesión → 401; con sesión de otro usuario → 404; propio → cambio o borrado propagado a `price`, `price_today` y buscador; eliminación pide confirmación.
- **Seguridad:** ownership check en servidor (no basta con ocultar botones en el front); no aceptar `usuario_id` del body.
- **Subagente:** back (endpoints + tests de ownership) + front (botones y confirmación).

### T6 · Borrado de datos de cuenta incluye la tabla nueva (nota 339)
- **Situación:** `DELETE /negocio/mi-cuenta/datos` (`negocio.js:188`) ya borra `price`, `price_today` y fotos por `user_id` y por local. No conoce la tabla nueva.
- **Propuesta:** agregar `trx('precios_negocio').where({ usuario_id: uid }).del()` dentro de la transacción existente, y también por `branch_id` de los locales del usuario.
- **Aceptación:** tras el borrado de datos de cuenta no queda ninguna fila en `precios_negocio` de ese usuario; el resto de usuarios no se ve afectado.
- **Subagente:** back, junto con T4 (mismo archivo).

---

## 3. Decisiones pendientes (respuesta del usuario)

Cada decisión tiene la propuesta por defecto; si no se responde, se aplica la propuesta.

- **D1 · Autoguardado de cuenta (respondido):** Nombre, Apellido y Email se autoguardan (tarjeta "Datos de la cuenta" de `/mi-configuracion`). La contraseña no.
- **D2 · Contraseña actual (respondido):** **no** se pide la contraseña actual. El modal tiene sólo contraseña nueva y repetirla. (Corrige T2: se elimina `pass_actual` del diseño.)
- **D3 · Reglas de contraseña (respondido, ok):** 8 a 128 caracteres, al menos una letra y un número, distinta al email y al nombre.
- **D4 · Precios de negocio (respondido):** los precios que cargan los negocios **se muestran en la búsqueda general** y **forman parte del histórico** (tabla `price`). La tabla nueva `precios_negocio` es una copia duplicada para lectura rápida. Se mantiene la escritura en `price`, `price_today` y buscador. Backfill: asumido, se copian los precios históricos de negocios (no hubo respuesta explícita).
- **D5 · Endpoint de lectura (respondido):** reemplaza a `GET /negocio/mis-precios`, que ya es un endpoint específico.
- **D6 · Alcance del endpoint (respondido):** el endpoint de lectura devuelve **sólo los precios del propio usuario**. Edición y eliminación siguen la propuesta: sólo precio; eliminar borra también en `price`, `price_today` y buscador (asumido, no hubo respuesta explícita sobre ese punto).

---

## 4. Riesgos y puntos de atención

- **Duplicación:** cualquier cambio de precio debe propagarse a las dos tablas dentro de una transacción; si una falla, se revierte todo. Riesgo de desincronización si se edita `price` sin `precios_negocio` (se cubre con tests de T4/T5).
- **Cachés en memoria:** editar o borrar precios debe actualizar `precios_diccio` / buscador (`quitar_de_caches`, `agregar_a_buscador`), igual que hoy en la carga.
- **Contraseña sin verificación (hallazgo):** `guardar_config` permite cambiar la contraseña sin la actual. Se corrige en T2.
- **Validaciones sólo en front (hallazgo):** longitud de contraseña y email no se validan en el back. Se corrigen en T1 y T2.

---

## 5. Checklist de revisión final

Cada punto se verifica contra el código modificado por un subagente de revisión.

- [ ] **336:** Nombre, apellido y email se guardan solos con debounce (≈800 ms); sin botón de guardado; errores visibles; back valida formato y longitud.
- [ ] **337:** Contraseña sólo en modal con botón Guardar; coincidencia comprobada en front y back; reglas mínimas aplicadas; contraseña actual verificada (si D2 = sí); sin datos sensibles en respuestas ni logs.
- [ ] **338:** No existe botón "Guardar" en la tarjeta de cuenta.
- [ ] **339 (tabla):** `precios_negocio` creada, con índices; precio de negocio escrito en `price` y en `precios_negocio` en la misma transacción; backfill aplicado (si D4 = sí).
- [ ] **339 (lectura):** endpoint rápido devuelve sólo los precios del usuario logueado; los precios siguen disponibles en búsqueda pública.
- [ ] **339 (edición y borrado):** requieren sesión y propiedad; ajeno → 404; propagan a `price`, `price_today` y buscador; eliminar pide confirmación en el front.
- [ ] **339 (cuenta):** `DELETE /negocio/mi-cuenta/datos` borra también `precios_negocio`.
- [ ] **Seguridad:** entradas validadas en back y front; knex parametrizado; errores sin detalles internos; sin `usuario_id` aceptado desde el body.
- [ ] **Pruebas:** scripts `back/test_*.js` agregados o actualizados; verificación en Firefox y Chrome, escritorio 1920x919.
- [ ] **Documentación:** `endpoints.md` actualizado con los endpoints nuevos y modificados; `definicion_tecnica.md` con la tabla nueva.
