# Plan: precios de negocios y `price_today`

Fecha: 2026-11-27. Estado: **propuesta, sin cambios de código**.
Las líneas citadas corresponden al árbol de trabajo de esa fecha, que tiene cambios sin commitear en `routes/productos.js` y `routes/preciosComunitarios.js`.

> **Cambios concurrentes.** Mientras se hacía este análisis, otros trabajos (sin commit) modificaron `routes/negocio.js`, `routes/preciosComunitarios.js` y `controllers/precios_negocio.js`, y crearon `controllers/baja_datos_usuario.js`, `test_precios_negocio_sync.js` y `test_baja_datos_cuenta.js`. Se revisó por lectura el código nuevo (no se ejecutaron las pruebas):
> - `ultimo_precio()` y `sincronizar_precio_negocio()` (`preciosComunitarios.js:50-62`) ya resincronizan desde `price` tras `eliminar_precio` (`:136-137`) y `PUT mis-precios` (`negocio.js:434-436`): **H1 y H2 resueltos en el árbol de trabajo**.
> - `DELETE mi-cuenta/datos` usa `baja_datos_usuario.js` para limpiar y resincronizar cachés: **H8 resuelto para la baja de cuenta**, no para la baja de un local suelto.
> - Siguen pendientes H4, H5, H6, H9, H10, la baja de local de H8 y la limpieza de `price_today`. Revisar el estado antes de implementar.
>
> Las secciones 2 y 3 describen el comportamiento anterior a esos cambios, que sigue siendo el del último commit.

> **Implementado (sin commit):** D0 (alternativa B): `controllers/sincronizacion_precios.js`, resincronización en cada escritura de precios y limpieza uniforme (sin `whereNotIn`). De D4, solo que el borrado de un precio quite su copia de `precios_negocio` (H4). Además, `price_today.price` a `decimal(10,2)` (migración pendiente de ejecutar). H5, H6 (para negocios) quedan cubiertos. D1, D2, D5-D8 y la limpieza de huérfanos previos siguen pendientes.

> **D3 aprobada e implementada (sin commit):** la baja de un local borra en la misma transacción `price_today`, `price`, `precios_negocio`, `promociones_hoy`, `estadistica_aumento_diario`, `branch_category` y `articulo_fotos` del local, limpia cachés y fotos, y el front lo advierte. `promociones` se conserva. Con esto quedan resueltos H9 y la baja de local de H8 (paso 3 y caso de prueba 8, `back/test_baja_local.js`); las menciones a su estado pendiente en este documento son anteriores.

> **D1, D2 y D6 aprobadas e implementadas (sin commit):**
> - D1: las importaciones (`POST /importar`, worker Python, `importar_productos.js`) descartan, con motivo en `descartados.csv`, los items cuyo `branch_id` es de una sucursal de negocio; la regla no se extiende a otras sucursales ni al producto. Las ofertas no escriben precios de producto y no se bloquean.
> - D2: ninguna carga admite fechas posteriores a mañana (Argentina), incluidas las ofertas importadas (`helpers/fecha_precio.js`, `utils/fecha.js`, `validar_fecha()`). Reemplaza la propuesta de rechazar toda fecha futura.
> - D6: redefinida por el usuario sobre la vista administrativa "Precios de hoy": solo precios desde ayer, también de negocios; los de mañana se muestran. El contador `incremental_stats.precios_hoy` no se modificó.
> - Pruebas: `back/test_reglas_importacion.js` y `extra_services/test_reglas_importacion.py`. Requiere reiniciar API y consumidor Python.
> - **D4 (resto), D5, D7 y D8: pospuestas.** Los estados anteriores en este documento sobre D1, D2 y D6 quedan reemplazados por este bloque.

Marcas: **[V]** verificado leyendo código o con `SELECT` en la base local; **[I]** inferido, no reproducido.

## 1. Resumen

- Regla (`back/controllers/precios_negocio.js:1-6`): para sucursales con `branch.propietario_id` no nulo vale siempre el último registro de `price` por `(product_id, branch_id)`.
- La inconsistencia existe **[V]**: Node excluye negocios al limpiar `price_today`; Python y `importar_productos.js` no.
- La inconsistencia **no hace perder precios en las lecturas**, porque `combinar()` los toma de `price` **[V]**.
- El daño real está en el código que usa la existencia de una fila en `price_today` para decidir si sincroniza las cachés. Esas cachés nunca purgan las entradas de negocio, así que quedan obsoletas hasta reiniciar o regenerar.
- Recomendación: **`price` es la única fuente para negocios**; `price_today` vuelve a ser estrictamente "hoy y ayer" para todos.

## 2. Trazado de `price_today`

### 2.1 Escrituras y borrados

| Punto | Operación | ¿Excluye negocios? |
|---|---|---|
| `back/routes/productos.js:241-242` (`registrar_precio_usuario`) | Borra anterior a ayer | Sí |
| `back/routes/productos.js:248-289` | Upsert, solo si la fecha es >= ayer; no compara con la fecha ya guardada | n/a |
| `back/scripts/recrear_price_today.js:40-41` | Borra anterior a ayer | Sí |
| `back/scripts/recrear_price_today.js:45-114` | Upsert del último precio con `price.time >= ayer` | n/a |
| `extra_services/actualizar_precios.py:471` (`nuevo_reg_precio`) | Borra anterior a ayer | **No** |
| `extra_services/actualizar_precios.py:514-535`, `662-686` | Upsert | n/a |
| `extra_services/actualizar_precios.py:928` (`actualizar_estadisticas`: al arrancar, `:991`, y cada 10 ítems, `:1021`, `:1047`) | Borra anterior a ayer | **No** |
| `back/controllers/importar_productos.js:38-41` | Borra anterior al día previo **a la fecha del artículo** | **No** |
| `back/controllers/importar_productos.js:64-86`, `244-252` | Upsert | n/a |
| `back/routes/negocio.js:202`, `206` (`DELETE mi-cuenta/datos`) | Borra por usuario y por locales | n/a |
| `back/routes/negocio.js:430` (`PUT mis-precios`) | Actualiza por `price_id` | n/a |
| `back/routes/preciosComunitarios.js:91`, `124` | Restaura el anterior o borra | n/a |
| `back/controllers/baja_datos_usuario.js:63` (nuevo) | Repone en `price_today` en locales ajenos | n/a |
| `back/scripts/adaptar_nombres_alias.js:70`, `86-94` | Renombra, fusiona o borra | n/a |

`importar_productos.js` solo lo importa `back/test_alias_canonico.js` **[V]**: no está en el flujo productivo actual (la importación va por la cola y Python).

### 2.2 Lecturas

| Punto | Uso | ¿Los negocios dependen de `price_today`? |
|---|---|---|
| `back/server.js:118-121` (`regenerar_diccionarios`) | Cachés `precios_diccio` y por categoría | No: `combinar()` los reemplaza desde `price` |
| `back/controllers/busqueda_productos.js:66-72` | Índice del buscador | No: ídem |
| `routes/productos.js:63` (`/all`), `routes/preciosHoy.js:72`, `routes/busqueda.js` | Leen las cachés | No directamente |
| `routes/negocio.js:556` (ficha pública) | Lee `price` | No |
| `routes/negocio.js:372` (mis precios) | Lee `precios_negocio` | No |
| `routes/negocio.js:439` (`PUT`) | Sincroniza según la fila | Antes sí (defecto); ahora solo locales comunes |
| `routes/preciosComunitarios.js:77-81` (`eliminar_precio`) | Restaura en BD según la fila | Antes sí (defecto); ahora las cachés salen de `price` |
| `actualizar_precios.py:939-943` | `incremental_stats.precios_hoy = COUNT(price_today)` | El conteo varía según qué proceso limpió último |
| `scripts/adaptar_nombres_alias.js:86-88` | Fusión de productos | Marginal |

En la base local no existe la clave `precios_hoy` en `incremental_stats`, así que ese `UPDATE` no afecta filas **[V]**; en producción, sin verificar.

### 2.3 Fechas y zona horaria

- `server.js:48` fija `TZ=America/Argentina/Buenos_Aires` **antes** de lanzar Python (`server.js:52`); el hijo hereda la variable **[V código / I efecto]**. `recrear_price_today.js:8` también la fija.
- Python usa `datetime.now()` sin zona (`:470`, `:927`). Si se ejecuta a mano en un host en UTC, escribe y corta con 3 h de diferencia respecto de Node **[I]**.
- Base local: MariaDB 11.8, `time_zone=SYSTEM` (-03) **[V]**. Producción sin verificar.
- Todos los cortes son "inicio de ayer", salvo `importar_productos.js:38-40`, relativo a la fecha del artículo: una fecha futura borra de más y una cadena `YYYY-MM-DD` se interpreta en UTC **[I]**.
- Python inserta `fecha_registro` tal como llega; una cadena con `Z` u offset podría guardarse sin convertir **[I]**.

## 3. Efectos y hallazgos relacionados

Las líneas de `negocio.js` y `preciosComunitarios.js` en la tabla 3.1 son las previas a los cambios concurrentes.

### 3.1 Confirmados

| # | Hallazgo | Efecto |
|---|---|---|
| H1 | `PUT mis-precios` sincroniza solo si hay fila (`negocio.js:422-428`) **[V]** | Tras la limpieza de Python, la BD cambia pero buscador y cachés muestran el precio viejo |
| H2 | `eliminar_precio` ídem (`preciosComunitarios.js:62-127`) **[V]** | El precio borrado sigue visible y no reaparece el anterior. Afecta a `DELETE mis-precios` y al borrado admin |
| H3 | La purga (`server.js:182-189`, `busqueda_productos.js:143`) nunca quita entradas de negocio **[V]** | H1, H2 y H8 duran hasta reiniciar o regenerar |
| H4 | `eliminar_precio` no toca `precios_negocio` **[V]** | Tras un borrado admin queda un huérfano en "mis precios"; un `PUT` sobre él responde éxito y solo cambia la copia |
| H5 | `registrar_precio_usuario` solo sincroniza si la fecha es >= ayer (`productos.js:295`) **[V]** | Un precio de negocio con fecha anterior, aun siendo el más reciente, no aparece hasta reiniciar |
| H6 | El mismo upsert y la sincronización no comparan fechas **[V]** | Una carga fechada ayer pisa un precio más nuevo; al reiniciar, `combinar()` vuelve al otro |
| H7 | `recrear_price_today` solo reinserta la ventana **[V]** | No recupera filas de negocio borradas. Irrelevante para las lecturas |
| H8 | `DELETE mi-cuenta/datos` (`negocio.js:190-226`) y la baja de local (`locales_branch.js:146-159`) no limpian cachés **[V]** | Precios borrados (con nombre del autor) siguen visibles |
| H9 | FK `price_today.branch_id -> branch` es `RESTRICT` **[V]** y la baja de local no borra `price_today` | `DELETE /api/mis-locales/:id` debería fallar mientras haya filas **[I]**. Al preservarlas para siempre, el local no se podría eliminar nunca. Si la baja tiene éxito, quedan huérfanos en `price` y `precios_negocio` |
| H10 | `registrar_precio_usuario` no escribe `price.time` (`productos.js:186-199`); en local, 4 de 4 precios de usuario tienen `time NULL` **[V]** | `recrear_price_today` (`time >= ayer`) los ignora. Python y Node (`ORDER BY time DESC`) los consideran los últimos solo si no hay otro con `time` |

### 3.2 Secundarios (decidir si entran)

- Los upserts de Python (`:526-535`, `:664-673`) y de `importar_productos.js` no limpian `user_id/user_nombre/user_apellido`: un precio importado puede quedar atribuido a un usuario **[V código]**.
- La importación puede escribir en sucursales de negocio: inserta un precio nuevo que pasa a ser el vigente, o (diferencia <= 1) refresca `date_time` del precio del negocio sin actualizar `precios_negocio` (`:645-650`) **[V código]**.
- La validación de la carga del negocio admite fechas futuras (`productos.js:551-555`); ese precio quedaría como vigente hasta esa fecha **[V código]**.
- `price` no tiene índice por `branch_id`; la consulta de `combinar()` recorre la tabla completa (~1,6 M filas estimadas por `EXPLAIN`), dos veces por regeneración, y se repite en la ficha pública **[V]**.
- `adaptar_nombres_alias.js` mueve `price` y `price_today` pero no `precios_negocio` **[V]**.
- `price.price` es `decimal(10,2)` y `price_today.price` es `float` **[V]**; 17.866 de 65.096 filas difieren de su `price_id` (17.561 por <= 1; máximo 50). Causa probable: precisión de `float` **[I]**. Además `PRECIO_MAX` (999999999.99) excede `decimal(10,2)`.
- `price_today` no tiene clave única `(product_id, branch_id)` (hoy sin duplicados) **[V]**; `definicion_tecnica.md` describe otro esquema.
- `precios_negocio` se llena según `usuario.es_negocio`, aunque el local no sea propio: las 4 filas locales son de sucursales sin propietario **[V]**. Esos precios siguen la ventana normal.

### 3.3 Estado de la base local

2 sucursales de negocio y **0 precios** en ellas; 0 huérfanos en `precios_negocio`; `price_today`: 65.096 filas. Los defectos **no pueden reproducirse con los datos actuales**; las pruebas deben crear sus propios datos. Producción no fue consultada.

## 4. Alternativas

| Alternativa | Pros | Contras |
|---|---|---|
| **A. Excluir negocios en todos los borrados** | Cambio chico; las filas existen para H1 y H2 | La regla queda repetida en Node y Python; no repara filas ya borradas; agrava H9; no resuelve H4, H5, H6, H8; `price_today` deja de significar "hoy y ayer" |
| **B. `price` como fuente para negocios; limpieza uniforme** | Coincide con las lecturas actuales; una sola definición de vigencia; no exige cambiar los borrados de Python; sin reparación de `price_today`; precio `decimal` | Hay que resincronizar en cada escritura; conviene un índice; `precios_hoy` deja de contar negocios antiguos |
| **C. Tabla o vista propia de vigentes de negocio** | Lecturas rápidas | Otra copia que mantener (ya hay tres); migración y más puntos de fallo |
| **D. Disparador o vista en la base** | Independiente del lenguaje | Lógica oculta, difícil de probar y desplegar |

**Recomendada: B.** A deja la corrección supeditada a que cada proceso presente y futuro recuerde la excepción, y aun así no corrige la mayoría de los defectos.

`price_today` puede seguir recibiendo filas de negocio dentro de la ventana; simplemente nada debe depender de ellas.

## 5. Plan de implementación

Coordinar antes con quienes estén editando `productos.js`, `preciosComunitarios.js` y `middleware/*`, y partir de esos cambios ya integrados.

### Paso 1. Helper de sincronización (hecho en parte)
Ya existe `sincronizar_precio_negocio` en `routes/preciosComunitarios.js`. Falta:

- moverlo, junto con `quitar_de_caches`, a un módulo de `controllers/` (hoy `baja_datos_usuario.js` carga un módulo de rutas de forma diferida), cuidando las dependencias circulares;
- decidir el precio 0: hoy se agrega al buscador, mientras `inicializa_buscador` lo excluye.

### Paso 2. Usarlo en las escrituras restantes
- `eliminar_precio`: borrar también `precios_negocio` por `id` dentro de la transacción (H4).
- `routes/negocio.js` `PUT`: responder 404 si el precio ya no está en `price`.
- `routes/negocio.js` `DELETE`: conservar el borrado de la copia para huérfanos previos y resincronizar en ese caso.
- `routes/productos.js` `registrar_precio_usuario`: para negocios, helper en lugar de la sincronización directa, sin condición de ventana (H5, H6).
- `server.js` `/interno/sync_cache` (`:249-273`): si la sucursal es de negocio, ignorar el contenido recibido y usar el helper.
- `controllers/importar_productos.js` `aplicar_sync`: mismo criterio.

### Paso 3. Baja de un local (H8, H9)
- `helpers/locales_branch.js` `eliminar`: dentro de la transacción borrar `price_today` del local antes de `branch`; tras el commit quitar sus claves de las cachés y llamar a `quitar_local` (hoy `marcar` se llama dentro de la transacción).
- Baja de cuenta: ya cubierta; validar con `test_baja_datos_cuenta.js`.
- Qué hacer con `price` y `precios_negocio` al borrar un local: decisión D3.

### Paso 4. Limpieza uniforme de `price_today`
- Quitar el `whereNotIn` en `routes/productos.js:242` y `scripts/recrear_price_today.js:41`.
- Python (`:471`, `:928`) e `importar_productos.js:41`: sin cambios en el borrado. Actualizar el comentario de `precios_negocio.js` para dejar escrito que `price_today` no es fuente para negocios.
- Hacerlo en el mismo despliegue que los pasos 1 a 3.

### Paso 5. `price.time` (H10)
- Agregar `time` al insert de `registrar_precio_usuario`.
- Migración: `UPDATE price SET time = date_time WHERE time IS NULL AND user_id IS NOT NULL`. Contar antes en producción.
- Efecto a revisar: esos precios pasan a participar en `recrear_price_today` y en la comparación "último precio" de los importadores.

### Paso 6. Migraciones de rendimiento y reparación
- Índice `price (branch_id, product_id, date_time)`. Medir la creación en una copia; el servidor ejecuta las migraciones al arrancar y `deploy-update.sh` también.
- Reparar huérfanos, con respaldo y `SELECT` previo:
  ```sql
  SELECT COUNT(*) FROM precios_negocio pn
    LEFT JOIN price p ON p.id = pn.id WHERE p.id IS NULL;
  -- si corresponde (D4)
  DELETE pn FROM precios_negocio pn
    LEFT JOIN price p ON p.id = pn.id WHERE p.id IS NULL;
  ```
- `price_today` no necesita reparación: las filas antiguas de negocio caen en la siguiente limpieza y las cachés se rearman desde `price` al reiniciar.
- Actualizar `adaptar_nombres_alias.js` para mover `precios_negocio.product_id`.

### Paso 7. Documentación
`documentacion/back/definicion_tecnica.md` (secciones `price_today`, `precios_negocio`, limpieza automática) y `endpoints.md` (mis precios y borrado admin).

## 6. Pruebas

Ampliar `back/test_precios_negocio_sync.js` (usa SQLite en memoria) o crear un script aparte; lo que requiera MySQL, solo contra base local o de pruebas, creando y borrando sus datos. Cubrir, comprobando BD, `precios_diccio`, caché por categoría y buscador:

1. Precio de negocio de hace 10 días sin fila en `price_today`: aparece tras regenerar y sobrevive a la purga.
2. `PUT` sin fila en `price_today`: las cachés muestran el valor nuevo.
3. `DELETE` del vigente sin fila: reaparece el anterior; si no hay otro, desaparece.
4. Borrado de un precio no vigente: no cambia lo visible.
5. Borrado admin: no quedan filas en `precios_negocio`.
6. Carga con fecha antigua que es la más reciente: se ve de inmediato. Carga con fecha anterior a la vigente: no la pisa.
7. `sync_cache` interno con un precio más viejo en sucursal de negocio: no pisa el vigente.
8. Baja de local con precios en `price_today`: termina bien y limpia cachés.
9. Borrado de datos de cuenta: no queda nada en cachés.
10. Regresión para sucursales sin propietario: ventana, restauración y purga sin cambios.
11. `recrear_price_today` incluye un precio de usuario reciente.

Ejecutar además las pruebas existentes relacionadas (`test_carga_precios_negocio.js`, `test_eliminar_precio_admin.js`, `test_precios_negocio_sync.js`, `test_baja_datos_cuenta.js`, `test_alias_canonico.js`), revisando antes cuáles escriben en la base. En este análisis no se ejecutó ninguna.

## 7. Riesgos

- Una resincronización antes del commit mostraría datos revertidos: llamar siempre después.
- La creación del índice puede demorar o bloquear escrituras en `price`.
- El relleno de `time` cambia qué precio toman los importadores como último.
- `recrear_price_today` une por `MAX(time)`: empates producen varias filas por clave (gana la última procesada) **[V código]**.
- `PUT`/`DELETE` y la importación concurrente pueden cruzarse; releer `price` tras el commit reduce el problema, no lo elimina.
- `ids_negocio` vive en memoria: un cambio manual de `propietario_id` requiere regenerar.
- `DELETE mis-precios` no es atómico entre `eliminar_precio` y la limpieza de la copia; el paso 2 lo resuelve.

## 8. Despliegue

1. Respaldo (`backup-db.sh`) y conteos previos en producción: huérfanos, `time NULL`, precios y sucursales de negocio, zona horaria del host y de la base.
2. Integrar en `dev` (rama por defecto de `deploy-update.sh`; el árbol local está en `PRD`).
3. Desplegar con `deploy-update.sh`: instala, migra y ejecuta `pm2 restart LAB_PRECIOS`.
4. **Consumidor Python**: lo lanza `server.js` mediante `setup_and_run.sh`. Se espera que el reinicio de PM2 lo reinicie junto con la API **[I]**. Verificar en el servidor, solo con consultas (`pm2 logs`, `ps`), que haya **un único** proceso y con hora de inicio nueva. Si quedó uno anterior, informar su PID y pedir autorización antes de terminarlo; nunca por patrón de nombre.
5. Con la recomendación B el código Python no cambia salvo que se aprueben D1, D2 o D5; en ese caso el reinicio es obligatorio.
6. Verificar: arranque sin errores de migración, tiempo de `regenerar_diccionarios`, y un ciclo de editar y borrar con un negocio de prueba.
7. Reversión: volver al commit anterior y reiniciar. El índice puede quedar; el relleno de `time` solo se revierte desde el respaldo o una lista de ids guardada antes.

## 9. Decisiones del usuario

| # | Decisión | Propuesta |
|---|---|---|
| D0 | Alternativa | B |
| D1 | ¿La importación puede escribir o reconfirmar precios en sucursales de negocio? | **Aprobada e implementada:** descartar con motivo en el CSV, solo por el `branch_id` del item |
| D2 | ¿Admitir fechas futuras en cargas del negocio? | **Aprobada e implementada:** en todas las cargas, hasta mañana inclusive |
| D3 | Al borrar un local, ¿borrar su histórico en `price` y `precios_negocio` o conservarlo? | **Aprobada e implementada: borrar**, igual que en la baja de datos de cuenta |
| D4 | ¿Eliminar los huérfanos de `precios_negocio`? Un borrado admin ¿debe quitarlos de "mis precios"? | Sí a ambos. Hecho solo el borrado admin; limpieza de huérfanos **pospuesta** |
| D5 | ¿Corregir ahora la atribución de usuario en upserts de importación? | **Pospuesta** |
| D6 | ¿`precios_hoy` debe incluir los vigentes de negocios? | **Aprobada e implementada:** la vista admin "Precios de hoy" muestra desde ayer, también negocios |
| D7 | ¿Relleno de `price.time` e índice nuevo en este despliegue? | **Pospuesta** |
| D8 | ¿Se elimina `importar_productos.js` (sin uso productivo)? | **Pospuesta** |
