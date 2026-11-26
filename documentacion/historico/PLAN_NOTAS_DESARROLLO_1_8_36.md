# Plan de implementación: notas de desarrollo (lote 13, versión 1.8.36)

Fecha: 2026-11-26
Alcance: notas 321 a 333 del sistema Precios (front `front/`, back `back/`).
Documentación relacionada: [Plan lote 12 (1.8.35)](PLAN_NOTAS_DESARROLLO_1_8_35.md) · [README general](../README.md) · [Propuestas de mejora](../propuestas_mejoras.md)

Estado: **PLAN PROPUESTO. Pendiente de respuesta a las decisiones D1–D7 antes de implementar.**

---

## 0. Reglas que aplican a todas las tareas

- **No commitear.** Sólo modificar archivos; el responsable hace los commits (ver `agents.md`).
- **No matar procesos** por patrón de nombre (regla global del usuario).
- **Seguridad** (criterios del proyecto, ver [back arquitectura → Seguridad y Validación](../back/arquitectura.md) y [propuestas → Seguridad](../propuestas_mejoras.md)):
  - Validar entrada en back y front; consultas con knex parametrizado.
  - Mensajes de error al usuario sin detalles internos (SQL, stack, rutas). Detalle sólo en `console.error` del back.
  - Fotos: se mantienen las validaciones existentes (tipo JPG/PNG/WEBP por MIME, máximo 2 MB). **Usar la cámara no debe saltear esas validaciones** (ver T4).
  - `localStorage` (T13): sólo se guarda un valor de una lista blanca (`'normal' | 'grande' | 'muy-grande'`); cualquier otro valor se descarta.
  - Endpoints de negocio: siguen detrás de `sesion_negocio` y verificando propiedad (`propietario_id`).
- **Pruebas:** el front no tiene suite automatizada; el back tiene scripts ad-hoc `back/test_*.js`. Cuando una tarea requiera casos de prueba, se delega a un subagente que los agregue/actualice (estilo existente) y se verifique en navegador (Chrome y Firefox, ya que la nota 322 es de Firefox 153) y en viewport móvil 366x712.
- **Versión:** no se modifica el número de versión (lo hace el script de deploy).
- **Revisión final:** un subagente de revisión recorre cada nota (321–333) contra el código modificado y el checklist de la sección 4.

---

## 1. Mapa de notas a tareas

| Tarea | Nota | Archivos principales | Depende de |
|---|---|---|---|
| T1 Local opcional al cargar precios | 321 | `front/src/pages/MiNegocio.vue`, `back/routes/productos.js` (`cargar_precios_negocio`), modelo `precios` | **D1** |
| T2 Recorte negro hasta mover la imagen | 322 | `front/src/components/publico/RecorteModal.vue` | — |
| T3 Gestos táctiles (pinch zoom + arrastre) | 323 | `RecorteModal.vue` | T2 (mismo archivo) |
| T4 Botón "Cambiar foto" con cámara en móvil | 324 | `RecorteModal.vue`, `MiNegocio.vue` (`elegir_foto`) | T2, T3 |
| T5 Investigar fallo al enviar precios de un local | 325 | `MiNegocio.vue` (`enviar_precios`), `front/src/helpers/request.js`, `back/routes/productos.js` | — |
| T6 Foto en fila propia en móvil | 326 | `MiNegocio.vue` (estilos/grid de `producto-row`) | T7 (mismo bloque) |
| T7 Campos apilados en móvil | 327 | `MiNegocio.vue` | T6 |
| T8 Modales a pantalla completa con scroll interno en móvil | 328 | estilos globales de modales (`front/src/assets/styles/`) y `storeApp.mostrar_modal` | **D2** |
| T9 Selector de mapa sin botones recortados en móvil | 329 | estilos de `.vgms-picker` (override en proyecto) | T8 (mismo CSS de modal) |
| T10 Locales siempre visibles en ficha pública | 330 | `back/routes/negocio.js` (`locales_publicos`), `front/src/pages/FichaNegocio.vue` | **D3** |
| T11 Menú de topbar menos transparente | 331 | `front/src/components/publico/PublicTopBar.vue` | **D4** |
| T12 Búsqueda sticky en móvil | 332 | `front/src/components/publico/BusquedaHero.vue`, `_public.scss` | **D5** |
| T13 Botón de accesibilidad (tamaño de letra) en móvil | 333 | `PublicTopBar.vue` (botón + panel), `front/src/utils/` (preferencia), `main.js` o `App.vue` (aplicar al cargar) | **D6** |

### Grupos de ejecución (un subagente por grupo; evitar editar el mismo archivo en paralelo)

- **Grupo A · Recorte de foto** (secuencial, mismo archivo): T2 → T3 → T4.
- **Grupo B · Mi negocio, formulario de precios** (secuencial, `MiNegocio.vue`): T6 + T7 → T1 (si D1 aplica). T5 es investigación: puede ir en paralelo sólo si se hace sin editar `MiNegocio.vue` hasta tener la causa; si no, va antes del Grupo B.
- **Grupo C · Modales móviles** (estilos globales): T8 → T9.
- **Grupo D · Topbar y búsqueda público** (`PublicTopBar.vue`): T11 → T13. T12 en `BusquedaHero.vue` (paralelo a D).
- **Grupo E · Backend ficha pública**: T10 (sólo `back/routes/negocio.js` + `FichaNegocio.vue`), paralelo a todo lo demás.

Tareas con archivos compartidos entre grupos: ninguna. Grupos A, B, C, D y E pueden correr en paralelo.

---

## 2. Análisis y diseño por nota (delegable)

### T1 · Local opcional al cargar precios (nota 321)
- **Situación:** `MiNegocio.vue:73` el `<select>` tiene `required` y una opción deshabilitada "Elegí un local". `enviar_precios` aborta si `local_precios` es `null` ("Debe elegir un local"). El back exige `branch_id` válido y propio en `cargar_precios_negocio` (`productos.js:513`).
- **Problema de fondo:** un precio se guarda asociado a un local (`product_id`, `branch_id`). Si el emprendedor no tiene local, no hay a qué asociar el precio.
- **Propuesta (pendiente D1):** el campo deja de ser obligatorio en el formulario y se agrega la opción **"Sin local"**. Con esa opción, los precios se guardan sin local (requiere que `branch_id` sea nullable en la tabla de precios y que las consultas públicas lo contemplen), o bien se bloquea el envío con un mensaje claro que pide crear un local. Ver D1.
- **Aceptación:** con "Sin local" seleccionado el formulario permite enviar (según D1); sin local y sin opción, el mensaje es explícito; no se rompen los listados ni las cachés de precios (`quitar_de_caches`, `precios_diccio`).
- **Seguridad:** la opción "sin local" no debe permitir escribir precios en locales ajenos (validar `propietario_id` igual que hoy).
- **Subagente:** back + front; agregar script `back/test_*.js` si se toca el modelo.

### T2 · Recorte se ve negro hasta mover la imagen (nota 322)
- **Situación:** `RecorteModal.vue` ya tiene un `watch([lienzo, imagen], dibujar, {flush:'post'})` (un intento previo). Persiste en Firefox 153 Desktop.
- **Hipótesis a verificar:** el canvas se monta dentro de `v-if="archivo"` y de un contenedor con `aspect-ratio`/`width: 100%`; el `drawImage` ocurre antes del primer layout o cuando el backdrop todavía no tiene tamaño, y el canvas queda con el fondo `#000`. Mover o cambiar zoom fuerza un nuevo dibujo.
- **Propuesta:** dibujar después del primer frame (`requestAnimationFrame` tras `nextTick`) y redibujar en `ResizeObserver` del lienzo; no depender sólo de `watch`. Verificar en Firefox y Chrome.
- **Aceptación:** al abrir el recorte la imagen se ve sin tener que arrastrar ni tocar el zoom, en desktop (1920x919) y móvil.
- **Subagente:** front + verificación en navegador (con GIF, herramienta de navegador).

### T3 · Gestos táctiles: pinch zoom y arrastre (nota 323)
- **Situación:** hay arrastre por `pointer` events y `touch-action: none`, pero **no hay zoom por gesto de pinza**; el zoom sólo es el slider/teclado.
- **Propuesta:** rastrear hasta dos punteros activos (`Map` de `pointerId`); con dos dedos, el zoom se calcula por la distancia entre ellos relativa a la distancia inicial, limitado a `ZOOM_MIN..ZOOM_MAX`. Mantener el arrastre con un dedo. Opcional: rueda del mouse para zoom en desktop.
- **Aceptación:** en móvil se puede hacer zoom con pinza y desplazar con un dedo; el slider queda sincronizado con el zoom por gesto.
- **Subagente:** front; verificación con emulación táctil en navegador (DevTools, 366x712).

### T4 · Cambiar foto en el recorte + cámara en móvil (nota 324)
- **Situación:** el pie del modal sólo tiene "Cancelar" y "Usar esta foto". El `<input type=file>` está en la fila de la tabla de precios, no dentro del modal.
- **Propuesta:** agregar botón **"Cambiar foto"** en el pie del `RecorteModal` (emite evento `cambiar`); el padre abre el selector. En el input se agrega `capture="environment"` **sólo en móvil** (para que abra la cámara) más la opción de elegir archivo existente (sin `capture` se ofrece galería/archivos). Al elegir un archivo nuevo, **se aplican las mismas validaciones** de `elegir_foto` (tipo y tamaño) — extraer esa lógica a una función compartida.
- **Pendiente D7:** cámara sólo en móvil (propuesta) o botón "Tomar foto" explícito.
- **Aceptación:** en desktop el botón abre el selector de archivos; en móvil ofrece cámara; archivos inválidos se rechazan con el mismo mensaje que hoy.
- **Subagente:** front.

### T5 · Fallo al enviar precios de un local (nota 325) — investigación primero
- **Hallazgos hasta ahora:**
  1. `front/src/helpers/request.js` (interceptor de respuesta) devuelve ante cualquier error HTTP o de red `{ error: true, msg }`. En `enviar_precios` (`MiNegocio.vue:453-455`) se usa `res.error` como texto de alerta, por lo que el usuario ve un valor no textual o el texto genérico "No se pudieron cargar los precios", aun cuando la petición llegó.
  2. El endpoint real es `PUT /publico/productos/cargar_precios_negocio` (`productos.js:513`); el front lo llama con el helper `request` (`api/negocio.js:37`). Verificar prefijo y base URL en producción.
  3. La nota dice que **ni siquiera llega la petición**: esto no coincide del todo con (1), así que hay que confirmarlo en el navegador (pestaña Red) antes de corregir. Causas posibles a revisar: validación previa que corta el flujo (`motivo_fila`, `local_precios` nulo tras `agregar_local`/`eliminar_local`), o el `Button` de tipo `submit` sin disparar el evento.
- **Propuesta:** el subagente reproduce con el flujo del usuario (local, un artículo con precio), registra qué sucede en Red y Consola, y corrige la causa. Los mensajes al usuario deben ser textuales y sin detalles internos.
- **Aceptación:** el envío de un precio válido llega al back, se registra y muestra "Se cargaron N precio(s)"; un error real muestra un motivo legible.
- **Subagente:** investigación + corrección en front (y back sólo si la causa está allí).

### T6 · Foto en su propia fila en móvil (nota 326)
- **Situación:** en `MiNegocio.vue:107` el bloque de foto es `col-6 col-lg-3`, por lo que en móvil queda a la par del precio (`col-6`).
- **Propuesta:** en móvil (`< 576px`) la foto ocupa `col-12` en una fila propia, debajo del precio. Ajustar también `.producto-row` si hace falta.
- **Aceptación:** en 366x712 la foto aparece en fila separada; en desktop sin cambios.
- **Subagente:** front (con T7).

### T7 · Campos apilados en móvil (nota 327)
- **Situación:** en móvil, Marca y Presentación van a `col-6` (dos por fila), y Precio también `col-6`.
- **Propuesta:** en móvil todos los campos de la fila de producto ocupan `col-12` (uno por fila). El número de artículo ya se oculta en móvil (`producto-row__num`).
- **Aceptación:** en 366x712 no hay dos campos en la misma fila; en `md` y superior el layout actual se mantiene.
- **Subagente:** front (con T6).

### T8 · Modales a pantalla completa con scroll interno en móvil (nota 328)
- **Situación:** el modal de la nota es de la librería `gmm-*` (`gmm-dialog gmm-ancho-auto`), con estilos de paquete externo. Además hay modales propios (`storeApp.mostrar_modal`, `RecorteModal`).
- **Propuesta:** un override global (en `front/src/assets/styles/`) con media query `max-width: 575.98px`: `.gmm-dialog` a 100% de alto y ancho, sin radio, con `overflow:auto` interno (`max-height: 100dvh`). Aplicar lo mismo al `.recorte-dialog` y al contenedor de `storeApp.mostrar_modal`.
- **Pendiente D2:** ¿alcance a todos los modales del sistema (público y admin) o sólo a los de área pública?
- **Aceptación:** en móvil el modal ocupa toda la pantalla; si el contenido excede, se desplaza dentro del modal; el cierre sigue accesible sin scroll de la página.
- **Subagente:** front (estilos).

### T9 · Selector de mapa sin botones recortados (nota 329)
- **Situación:** `div.vgms-picker` pertenece a `@greenborn/vue-greenborn-map-selector` (paquete externo). Se corrige por CSS del proyecto, no editando el paquete.
- **Propuesta:** en móvil, `.vgms-picker` con `flex-wrap: wrap` y `max-width: 100%`; botones con ancho contenido y `min-width: 0`; verificar que el contenedor no tenga `overflow` que los recorte. Si no alcanza, reubicar botones en una segunda línea.
- **Aceptación:** en 366x712 ningún botón queda fuera de la vista ni recortado.
- **Subagente:** front (CSS), con T8.

### T10 · Locales siempre visibles en ficha pública (nota 330)
- **Causa identificada:** `back/routes/negocio.js` `locales_publicos` filtra `publicado: true`. Un local con `publicado = false` nunca aparece en la ficha. La ficha (`FichaNegocio.vue:53`) muestra "Sin locales publicados" en ese caso.
- **Pendiente D3:** ¿qué significa "siempre"? Opciones: (a) quitar el filtro y mostrar todos los locales del negocio; (b) mantener el flag pero forzar `publicado = true` al crear/editar locales y ocultar el control; (c) ver si el flag tiene otro uso.
- **Aceptación (según D3):** un negocio con locales los ve en la ficha pública, en móvil y desktop; la ficha no muestra el estado vacío si hay locales.
- **Seguridad:** la respuesta pública sigue sin exponer `user_id`, emails ni datos privados (criterio ya documentado en el archivo del endpoint).
- **Subagente:** back + front, con script de prueba del endpoint `GET /api/negocio/publico/:perfilId/locales`.

### T11 · Menú de la topbar menos transparente (nota 331)
- **Situación:** `PublicTopBar.vue:232` aplica `color-mix(... 82%, transparent)` y `backdrop-filter` a la barra cuando está `is-scrolled`; el menú desplegable móvil (`#pubNav.is-open`) hereda esa transparencia.
- **Pendiente D4:** ¿la transparencia se baja sólo en el menú desplegable móvil (propuesta) o en toda la barra?
- **Propuesta:** menú desplegable con fondo `var(--gb-surface)` sólido (opacidad 100%) y sombra; barra sin cambios salvo D4.
- **Aceptación:** el texto del menú móvil se lee sobre cualquier contenido de fondo.
- **Subagente:** front (estilos).

### T12 · Búsqueda sticky en móvil (nota 332)
- **Situación:** `.pub-search` está dentro de `pub-hero` (al principio de la página); se pierde al hacer scroll.
- **Pendiente D5:** ¿sticky debajo de la topbar (`position: sticky; top: 4rem`) en la vista de inicio, o dentro de la topbar?
- **Propuesta:** en móvil (`< 768px`), `.pub-search` con `position: sticky; top: calc(4rem + env(safe-area-inset-top))`, fondo sólido y `z-index` menor que la topbar. Verificar que ningún ancestro tenga `overflow: hidden`.
- **Aceptación:** en móvil el campo de búsqueda queda visible al hacer scroll en la página de inicio y no tapa contenido de forma permanente.
- **Subagente:** front (`BusquedaHero.vue`, `_public.scss`).

### T13 · Botón de accesibilidad: tamaño de letra (nota 333)
- **Propuesta:** en la topbar móvil, botón con icono `bi-universal-access` (o `bi-fonts`) y `aria-label`, que abre un panel con tres opciones de tamaño: Normal (100%), Grande (112,5%), Muy grande (125%). Se aplica como `font-size` en `<html>` (los `rem` escalan). La preferencia se guarda en `localStorage` con la clave `precios.tamano_texto` y se aplica al iniciar la app antes del primer render.
- **Seguridad:** sólo valores de lista blanca; valor inválido o error de `localStorage` (modo privado) → Normal, sin romper la app (`try/catch`).
- **Pendiente D6:** ¿también en desktop? (la nota pide móvil; propuesta: sólo móvil, por coherencia con la nota).
- **Aceptación:** el cambio se aplica en vivo, persiste al recargar, y el panel se cierra con Escape y es operable con teclado.
- **Subagente:** front.

---

## 3. Decisiones (respuestas del usuario)

| # | Tema | Decisión |
|---|---|---|
| **D1** | Carga de precios sin local (nota 321) | **Opción 2: guardar precios sin local.** Si el usuario no tiene local, al cargar precios se crea automáticamente un `branch` y su `enterprise` asociada con los datos del usuario logueado. Ver detalle en T1. |
| **D2** | Alcance de modales a pantalla completa en móvil (nota 328) | **Todos** los modales. |
| **D3** | Locales en ficha pública (nota 330) | **Todos se publican por defecto.** El flag `publicado` no es editable por el usuario; sí podrá cambiarlo un admin desde el panel de administración. |
| **D4** | Transparencia de la topbar (nota 331) | **Toda la barra** (no sólo el menú), en móvil y desktop. |
| **D6** | Tamaño de letra (nota 333) | **También desktop**, con las opciones Normal / Grande / Muy grande (propuesta, sin respuesta explícita). |
| **D5** | Búsqueda sticky (nota 332) | *Sin respuesta.* Se aplica el valor por defecto: debajo de la topbar, sólo móvil, en inicio. |
| **D7** | Cámara en cambio de foto (nota 324) | *Sin respuesta.* Se aplica el valor por defecto: cámara sólo en móvil (`capture`). |

### Respuestas posteriores (confirmadas)

- **D1 (local "sin local"):** es **un único local específico por usuario**, creado la primera vez que carga precios sin local y reutilizado en envíos posteriores. Se **borra** junto con el resto de los datos cuando el usuario elige borrar su propia información (ver `back/routes/negocio.js`, endpoint de borrado de datos, que hoy elimina locales, fotos y precios; debe incluir también este local y su `enterprise`).
- **Nombre de la `enterprise`:** nombre comercial del perfil; si no está definido, el nombre de usuario (`nombre` + `apellido` del usuario logueado, o el que corresponda según el esquema).
- **Nota 325 / "no me deja ingresar nada":** el usuario reporta que los campos no permiten ingresar datos aunque se completen. Se trata como **bug de formularios** (probablemente el envío o validación que bloquea la carga). Se investiga junto con T5.

### Nueva tarea transversal · V1 Validaciones en todos los campos (solicitud del usuario)

- Todo campo de formulario en el área de negocio (perfil, contactos, locales, carga de precios, cuenta) valida al escribir y al enviar.
- Errores en **rojo**: borde `is-invalid` de Bootstrap, color de texto rojo y mensaje debajo del campo (`invalid-feedback`), con `aria-invalid="true"` y `aria-describedby`.
- Validación en back igual a la del front (los errores del back se muestran en el campo correspondiente cuando sea posible).
- Mensajes concretos ("El precio debe ser mayor a 0", "El nombre es obligatorio"), sin detalles internos.
- Se aplica después de T5 y T1, ya que tocan los mismos formularios. Subagente dedicado; revisar cada formulario contra la lista de campos.

### Ajustes derivados de las decisiones

- **T1 (D1):** cuando no hay local seleccionado, el envío crea `branch` + `enterprise` con los datos del usuario logueado (nombre comercial / nombre del usuario, `propietario_id` = usuario) y carga los precios en ese local. Pendiente de verificar en el esquema: relación entre `enterprise` y `branch`, campos obligatorios de `enterprise` y si se reutiliza un local "Sin local" existente para no duplicar en cargas sucesivas (propuesta: reutilizar el primer local del usuario marcado como "sin local" o el primero existente, para no crear un local por cada envío). **Confirmar esta última propuesta** antes de implementar.
- **T10 (D3):** quitar el filtro `publicado: true` en `locales_publicos`; la columna `publicado` pasa a ser `true` por defecto al crear locales y sólo editable desde el panel admin (sin cambio en la UI de usuario). Verificar que el panel admin tenga el control; si no, se agrega a la tarea.
- **T11 (D4):** la transparencia se baja en `.pub-topbar.is-scrolled` (toda la barra) con fondo sólido `var(--gb-surface)`; se mantiene `box-shadow`.
- **T13 (D6):** el botón de tamaño de letra se muestra también en desktop, en la topbar.

---

## 4. Checklist de revisión final

- [ ] 321: local opcional según D1; sin local y sin opción, mensaje claro.
- [ ] 322: recorte visible al abrir, sin mover la imagen (Firefox y Chrome).
- [ ] 323: pinch zoom y arrastre con un dedo en móvil; slider sincronizado.
- [ ] 324: botón "Cambiar foto" en el recorte; cámara en móvil; validaciones de tipo y tamaño vigentes.
- [ ] 325: causa identificada y corregida; un envío válido llega al back y se confirma.
- [ ] 326: foto en fila propia en móvil.
- [ ] 327: todos los campos apilados en móvil (366x712).
- [ ] 328: modales a pantalla completa con scroll interno en móvil (según D2).
- [ ] 329: ningún botón del selector de mapa recortado en 366x712.
- [ ] 330: locales visibles en la ficha pública (según D3), sin exponer datos privados.
- [ ] 331: menú móvil con fondo sólido legible.
- [ ] 332: búsqueda sticky en móvil.
- [ ] 333: botón de tamaño de letra en móvil; preferencia en `localStorage` validada; persiste al recargar.
- [ ] Seguridad: sin SQL concatenado, sin detalles internos en mensajes, validaciones de imagen intactas, `localStorage` con lista blanca.
- [ ] Pruebas: scripts de back actualizados/agregados (T1, T5 si aplica, T10) y verificación en navegador de cada punto móvil (366x712) y desktop (1920x919).
