# Plan de implementación: notas de desarrollo (lote 12, versión 1.8.35)

Fecha: 2026-11-26
Alcance: notas 309 a 320 del sistema Precios (front `front/`, back `back/`).
Documentación relacionada: [README general](../README.md) · [Front arquitectura](../front/arquitectura.md) · [Back arquitectura](../back/arquitectura.md) · [Back endpoints](../back/endpoints.md) · [Propuestas de mejora](../propuestas_mejoras.md)

---

## 0. Reglas que aplican a todas las tareas

- **No commitear.** Sólo modificar archivos; el responsable hace los commits (ver `agents.md`).
- **No matar procesos** por patrón de nombre (regla global del usuario).
- **Seguridad** (ver [back arquitectura → Seguridad y Validación](../back/arquitectura.md#-seguridad-y-validación) y [propuestas → Seguridad](../propuestas_mejoras.md)):
  - Validar entrada en back y front; consultas con knex parametrizado (sin concatenar SQL).
  - Los mensajes de error al usuario no deben incluir detalles internos (SQL, stack, rutas de archivo). Los detalles se loguean en back con `console.error`.
  - Enlaces externos con `target="_blank"` y `rel="noopener noreferrer"`; URLs de contacto sólo con esquemas permitidos (`urlSegura`, `ESQUEMAS_PERMITIDOS`).
  - Todo endpoint de negocio pasa por `sesion_negocio` y verifica propiedad del recurso (`propietario_id` / `usuario_id`).
  - Imágenes: se conserva la validación por firma binaria y el límite de tamaño ya existentes.
- **Pruebas:** no hay suite automatizada de front ni de back (`back/package.json` tiene `test` placeholder). Las tareas que requieren pruebas delegan en un subagente la creación de scripts de verificación bajo `back/test_*.js` (estilo existente) y verificación manual en navegador.
- **Versión:** no se modifica el número de versión (lo hace el script de deploy).

---

## 1. Mapa de notas a tareas

| Tarea | Notas | Archivos principales | Depende de |
|---|---|---|---|
| T1 Enlace a greenborn.com.ar en footer | 309 | `front/src/components/publico/PublicFooter.vue` | — |
| T2 Presentación de labels/inputs en Mi configuración | 310 | `front/src/pages/MiConfiguracion.vue` | — |
| T3 Recorte de foto que se ve negra al cargar | 311 | `front/src/components/publico/RecorteModal.vue` | — |
| T4 Switches "Mostrar en perfil público" habilitados según contenido | 312, 313, 314 | `front/src/components/publico/PerfilNegocioForm.vue` | Decisión D1 |
| T5 Rediseño de datos de contacto y redes | 315 | `ContactosForm.vue`, `ContactosPerfil.vue`, `data/contactos.js`, `api/negocio.js` (sin cambio de contrato) | Decisión D3 |
| T6 Botón "Nuevo local" con modal | 316 | `front/src/pages/MiNegocio.vue`, `LocalCard.vue` | — |
| T7 Locales existentes como cards con operaciones | 317 | `front/src/components/publico/LocalCard.vue` (nuevo `LocalResumen` o modo vista), `MiNegocio.vue` | T6 |
| T8 Detalle de errores al enviar precios | 318 | `front/src/pages/MiNegocio.vue` (función `enviar_precios`), `back/routes/productos.js` (sólo si hace falta mensaje) | — |
| T9 Botón eliminar datos a Mi configuración | 319 | `MiConfiguracion.vue`, `MiNegocio.vue` (quitar) | Decisión D2 |
| T10 Logout tras eliminar datos | 320 | `MiConfiguracion.vue` (tras T9), `utils/auth.js` (uso de `logout`) | T9 |

Grupos de ejecución:
- **Paralelo A** (archivos sin solapamiento): T1, T2, T3, T4, T5, T8-front.
- **Secuencial B** (todos tocan `MiNegocio.vue`; un único subagente): T9 (quitar) → T6 → T7 → T8.
- **Secuencial C** (ambos tocan `MiConfiguracion.vue`): T2 y luego T9 (agregar) → T10. Puede ir en el mismo subagente que T2.

Verificación final: un subagente de revisión recorre cada nota (309–320) contra el código modificado y el checklist de la sección 3.

---

## 2. Detalle por tarea (delegable)

### T1 · Enlace a greenborn.com.ar (nota 309)
- **Qué:** en la línea inferior del footer (`© {{ anio }} Precios de Tandil · Greenborn`), "Greenborn" pasa a ser un enlace a `https://greenborn.com.ar`.
- **Cómo:** `<a href="https://greenborn.com.ar" target="_blank" rel="noopener noreferrer">Greenborn</a>`.
- **Aceptación:** el enlace abre en pestaña nueva; el texto de copyright no cambia.
- **Seguridad:** `rel="noopener noreferrer"`.

### T2 · Labels e inputs en Mi configuración (nota 310)
- **Qué:** la tarjeta "Datos de la cuenta" usa `FormularioGenerico`, cuyo layout es label en columna de 3/12 (`.label-cont`) y campo a la derecha. Hay que mejorar la presentación.
- **Cómo (recomendado):** ajuste **sólo dentro de `MiConfiguracion.vue`** (clase `.cuenta-form`, con `:deep()`), para no afectar `ConfigCuenta.vue` ni `AbmRoles.vue`, que también usan `FormularioGenerico`. Opción: labels arriba del input (una columna) con separación uniforme.
- **Aceptación:** en desktop (1920x919) y móvil, cada label queda alineado con su input; contraseña y repetición mantienen el mismo estilo; ninguna otra pantalla cambia.

### T3 · Foto que se muestra negra al encuadrar (nota 311)
- **Síntoma:** al elegir una foto de artículo, el lienzo de `RecorteModal` aparece negro hasta mover el zoom.
- **Causa probable (no confirmada):** `dibujar()` se ejecuta al cargar la imagen (`watch` con `immediate`, `await nextTick()`), pero el primer dibujo ocurre antes de que el lienzo tenga su tamaño final en el layout. Hay que **reproducir en navegador** antes de cambiar código para confirmarla.
- **Cómo:** redibujar tras el primer render del lienzo (`requestAnimationFrame` o `watch` sobre `lienzo`), y dibujar también en `onMounted`. Verificar que no quede el fondo `#000` sin imagen.
- **Aceptación:** al abrir el encuadre la imagen se ve de inmediato, sin tocar el zoom; arrastre, zoom y teclado siguen funcionando; `RecorteModal` sigue usándose igual en `MiNegocio.vue` y `CabeceraNegocio.vue`.
- **Pasos de reproducción:** Mi negocio → Mis precios → "Foto" en una fila → elegir JPG de más de 800 px.

### T4 · Switches "Mostrar en mi perfil público" (notas 312, 313, 314)
- **Estado actual:** `PerfilNegocioForm.vue` muestra el switch de cada campo `publicable` sin condición.
- **Qué:** el switch queda deshabilitado mientras el campo esté vacío (criterio ya usado en `ContactosForm` con `:disabled="!fila.valor"`). Nota 313 (sitio web) y 314 (descripción) lo piden explícitamente. Nota 312 (nombre comercial) depende de la decisión **D1**.
- **Cómo:** `:disabled="!valores[campo.nombre] || cargando"`; si el campo se vacía, el interruptor se muestra apagado y deshabilitado (y se guarda como `false`).
- **Aceptación:** con el campo vacío el switch no responde; al cargar un valor se habilita; al cargar el perfil no se habilita antes de que lleguen los datos.

### T5 · Rediseño de datos de contacto y redes (nota 315)
- **Estado actual:** una card por tipo (8 tipos fijos), con campos múltiples dentro de cada card.
- **Qué (según la nota):**
  1. Botón **"Agregar red o contacto"**.
  2. Abre un modal: primero se elige el tipo (lista de `TIPOS_CONTACTO`), luego se ingresa el valor.
  3. Al confirmar se agrega una card con: icono de la red (`bi-*` con color de marca), contenido, botón editar/eliminar y switch "Mostrar en mi perfil público".
  4. El contenido es enlace que abre en pestaña nueva cuando corresponde (teléfono y email no abren pestaña; WhatsApp, Facebook, etc. sí, usando `construirUrl` del backend a través de `url` devuelto).
- **Contrato:** `PUT /api/negocio/mi-perfil/contactos` ya recibe la lista completa `{ tipo, valor, visible }[]`. **No cambia el back.** Se mantiene el tope `MAX_POR_TIPO = 10` (validado en back).
- **Cómo:** pasar el estado de `valores[tipo][]` a una lista plana `contactos[]`. Editar abre el mismo modal con el tipo bloqueado. Autoguardado con debounce ya existente.
- **Modal:** reutilizar el patrón de modal del proyecto (`vue-greenborn-modal-manager` vía `AppStore`, o `ModalGenerico` si existe). Confirmar primero que el modal permita formulario y no sólo texto.
- **Aceptación:** agregar, editar, quitar y cambiar visibilidad de un contacto persiste tras recargar; los enlaces tienen `rel` seguro; sólo se muestran contactos visibles en la ficha pública (`/negocio/:id`).
- **Seguridad:** no mostrar `href` que no pase `urlSegura`; el valor se trunca a 255 caracteres (ya en back).
- **Tests:** subagente agrega `back/test_contactos_negocio.js` validando `validarContactos` (tipos, tope por tipo, URL permitida) si el helper es importable sin levantar el servidor.

### T6 · Botón "Nuevo local" en modal (nota 316)
- **Estado actual:** la última card de `seccion-locales` es el formulario de alta.
- **Qué:** reemplazarla por un botón **"Agregar local"** en el encabezado de la sección, que abre un modal con el formulario de alta existente (`LocalCard` sin `local`).
- **Aceptación:** el alta funciona igual (validación de nombre, duplicados por back, código devuelto en el mensaje de éxito); al crear, el modal se cierra y aparece la nueva card.
- **Riesgo:** `LocalCard` abre un selector de mapa (`useMapSelector`) desde dentro del modal. Verificar que el mapa quede por encima (z-index) y que el cierre del modal no lo bloquee.

### T7 · Locales como cards con todos sus datos (nota 317)
- **Estado actual:** `LocalCard` es a la vez vista y formulario de edición, siempre en modo edición.
- **Qué:** cada local existente se muestra como card de **solo lectura**: nombre, código, calle y número, ciudad, ubicación (coordenadas o "Sin ubicación"), estado de publicación si aplica, y botones **Editar** (abre modal con el formulario) y **Eliminar** (confirmación existente).
- **Cómo:** `LocalCard` pasa a tener modo `vista` (default) y el formulario se mueve al modal de T6 (reutilizado en modo edición).
- **Aceptación:** todos los datos del local se ven en la card; editar guarda y actualiza la card; eliminar sigue pidiendo confirmación; el mapa general (`LocalesMapa`) no cambia.
- **Dependencia:** T6 (mismo modal).

### T8 · Detalle de errores al enviar precios (nota 318)
- **Causa identificada:** `enviar_precios()` en `MiNegocio.vue` muestra sólo `res.error`. Cuando el back responde `stat:false` con `items.detalle`, el detalle por artículo (`detalle[].error`, p. ej. "Nombre o precio inválido", "No se pudo registrar el producto") no llega al usuario.
- **Qué:**
  1. Si hay `items.detalle` con errores, el alert lista cada fila con error: `Fila N (nombre): motivo`.
  2. Validación previa en front que indique la fila concreta (nombre vacío con precio, precio no numérico o cero) antes de enviar.
  3. Mensaje de alerta multilínea (revisar que `mostrar_alerta` del modal manager renderice saltos de línea; si no, usar lista corta de máximo 5 filas + "y N más").
- **Back:** sólo ajustar textos de `detalle[].error` si son ambiguos. No exponer errores de base de datos (hoy ya se devuelven textos genéricos).
- **Aceptación:** con una fila sin precio, el mensaje dice cuál fila y por qué; con todas las filas bien, el alta sigue igual.
- **Seguridad:** los errores del back se loguean con `console.log` y no se muestran en crudo.

### T9 · Mover "Eliminar datos de la cuenta" a Mi configuración (nota 319)
- **Qué:** quitar el bloque y el botón de `seccion-perfil` en `MiNegocio.vue` y colocarlo en `MiConfiguracion.vue` como tarjeta "Zona de peligro" al final.
- **Visibilidad:** según decisión **D2** (sólo cuentas negocio o todas).
- **Aceptación:** el botón aparece en Mi configuración y desaparece de Mi negocio; el texto y el diálogo de confirmación se mantienen.
- **Seguridad:** la ruta `DELETE /api/negocio/mi-cuenta/datos` hoy usa `sesion` (cualquier usuario logueado) y opera sobre `req.user.id`; no se cambia la propiedad, sólo se valida que siga siendo así.

### T10 · Logout después de eliminar los datos (nota 320)
- **Estado actual:** tras el borrado, `eliminar_cuenta()` hace `window.location.reload()`.
- **Qué:** reemplazar el reload por `logout(storeApp)` de `utils/auth.js` (mismo flujo que `PublicTopBar`), que llama a `/user/logout`, borra el token y redirige.
- **Aceptación:** tras confirmar, la sesión queda cerrada (la cookie/token se borra) y se vuelve a la pantalla de acceso; el mensaje de éxito queda visible si `logout` lo permite, si no, sólo se muestra el redireccionamiento.
- **Seguridad:** el logout sólo se ejecuta tras un borrado exitoso (si el borrado falla, la sesión se mantiene y se muestra el error).

---

## 3. Revisión final (checklist)

Un subagente revisa, sin modificar código, cada punto:

- [ ] 309: enlace a greenborn.com.ar abre en pestaña nueva, `rel` seguro.
- [ ] 310: labels e inputs alineados en Mi configuración; otras pantallas con `FormularioGenerico` sin cambios.
- [ ] 311: encuadre visible al abrir; zoom, arrastre y teclado OK.
- [ ] 312–314: switches deshabilitados sin contenido y habilitados con contenido.
- [ ] 315: modal de dos pasos, cards con icono, contenido con enlace seguro, editar/eliminar, switch; persiste tras recarga; ficha pública sólo muestra visibles.
- [ ] 316: alta de local en modal; sin card de alta en la sección.
- [ ] 317: locales como cards con todos los datos y botones.
- [ ] 318: el alert indica fila y motivo.
- [ ] 319: botón de eliminar sólo en Mi configuración.
- [ ] 320: tras eliminar, logout y redirección.
- [ ] Seguridad: sin SQL concatenado, sin detalles internos en mensajes, rutas protegidas, enlaces seguros.
- [ ] Sin commits, sin cambio de versión, sin procesos matados por patrón.

---

## 4. Decisiones (respondidas por el responsable)

- **D1 (nota 312):** el switch de nombre comercial se habilita **cuando el campo tiene valor**, igual que 313 y 314.
- **D2 (nota 319):** el botón de eliminar datos se muestra **a todos los usuarios** (el endpoint ya acepta cualquier usuario logueado). Sin restricción por `es_negocio`.
- **D3 (nota 315):** se **quita** la vista previa "Así se ven en tu perfil"; las cards cubren esa función.

## 5. Estado de implementación (2026-11-26)

| Tarea | Estado | Notas |
|---|---|---|
| T1 Footer | Hecho | `PublicFooter.vue` |
| T2 Labels en Mi configuración | Hecho | Ajuste acotado a `.cuenta-form` con `:deep` |
| T3 Recorte negro | Hecho, **no verificado en navegador** | Causa no reproducida; se redibuja al estar listos lienzo e imagen |
| T4 Switches según contenido | Hecho | Usa `unref(formulario)` para leer `interruptor` |
| T5 Contactos en cards con modal | Hecho | `ContactosForm.vue` reescrito; nuevo `FormularioContactoModal.vue`; vista previa quitada (D3). `ContactosPerfil.vue` **se conserva**: lo usa `FichaNegocio.vue` |
| T6 Alta de local en modal | Hecho | Nuevo `FormularioLocalModal.vue` |
| T7 Locales como cards | Hecho | Nuevo `LocalResumen.vue`; `LocalCard.vue` queda sólo como formulario |
| T8 Detalle de errores al enviar | Hecho | Validación previa por fila; errores del back con fila y motivo; filas fallidas quedan en el formulario. Sin cambios en back |
| T9 Eliminar datos en Mi configuración | Hecho | Visible para todos (D2) |
| T10 Logout tras eliminar | Hecho | `logout(storeApp)` tras borrado exitoso |

Verificación:
- `vite build` del front: compila sin errores (salida en el scratchpad, no en el repo).
- Back: sin cambios. No hay suite de pruebas automatizada; no se agregaron casos de prueba.
- Pendiente: prueba manual en navegador de T3, T5 (modal y persistencia), T6/T7 (z-index del selector de mapa dentro del modal) y T8 (salto de línea del alert).
- No se hicieron commits ni cambios de versión.

## 6. Historial
- 2026-11-26: creación del plan a partir de las notas 309–320; decisiones D1–D3 respondidas; implementación T1–T10.
