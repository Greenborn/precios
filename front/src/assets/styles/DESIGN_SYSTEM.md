# Greenborn Design System (Fase 0 + 1)

Guía para quien siga trabajando sobre el front (páginas públicas, admin).

## Archivos de estilos

| Archivo | Rol |
|---|---|
| `_tokens.scss` | **Fuente única** de tokens SCSS (`$gb-*`): paleta, espaciado, radios, sombras, tipografía, transiciones. |
| `_bootstrap-custom.scss` | Overrides de variables Bootstrap con los tokens + `@import "bootstrap/scss/bootstrap"`. Se importa en `main.js` (reemplaza `bootstrap.min.css`). |
| `_theme.scss` | Emite las custom properties `--gb-*` en `:root` / `[data-bs-theme=light]`, y deja la estructura de `[data-bs-theme=dark]` (sin toggle todavía). |
| `_utilities.scss` | Clases utilitarias `.gb-*` y estilos de campo (`.gb-field*`). |
| `_overrides.scss` | Ajustes puntuales a Bootstrap (input-group). |
| `layout.scss` | Layout global (body, login, navbar admin). Importa theme/utilities/overrides. |

Sass: `vite.config.js` silencia deprecations de `@import` de Bootstrap (`silenceDeprecations`).

**Regla:** en componentes `.vue` usar `var(--gb-...)` (no hex). En SCSS se puede `@import "@/assets/styles/tokens"` si hace falta un `$gb-*` en compilación (no emite CSS).

## Tokens (custom properties)

- Colores: `--gb-primary` (#15803d, AA 5.02:1 sobre blanco; texto encima: `--gb-on-primary`), `--gb-primary-hover`, `--gb-primary-soft`, `--gb-primary-soft-2`, `--gb-accent` (teal #0f766e), `--gb-success|warning|danger|info` y sus `-soft`.
- Superficies/texto: `--gb-bg` (slate-50), `--gb-surface` (#fff), `--gb-surface-2` (slate-100), `--gb-border`, `--gb-border-strong`, `--gb-text`, `--gb-text-muted`, `--gb-heading`, `--gb-sidebar-bg` (slate-900), `--gb-overlay`.
- Espaciado: `--gb-space-0..7` = 0, .25, .5, .75, 1, 1.5, 2, 3 rem.
- Radios: `--gb-radius-sm` 8px, `--gb-radius` 12px, `--gb-radius-lg` 16px, `--gb-radius-pill`.
- Sombras: `--gb-shadow-sm`, `--gb-shadow`, `--gb-shadow-lg`.
- Tipografía: `--gb-font-sans` (Inter via `@fontsource/inter` 400/500/600/700), `--gb-font-mono`. Base 15px; headings h1 2rem → h6 .9375rem, peso 600.
- Movimiento: `--gb-transition-fast` 120ms, `--gb-transition` 200ms, `--gb-transition-slow` 320ms. Se respeta `prefers-reduced-motion`.
- Controles: `--gb-control-height` 2.5rem, `--gb-control-height-sm` 2rem, `--gb-focus-ring`.

Bootstrap usa los mismos valores: `$primary` verde, `$secondary` slate-500, `$border-radius` 8px, `$body-bg` slate-50, etc. Así que `btn-primary`, `text-primary`, `form-control:focus`, etc. ya salen en marca.

**Ojo:** `.bg-primary` está forzado a oscuro (`--gb-sidebar-bg`) en `layout.scss` por compatibilidad con la navbar admin. Para fondo verde usar `.text-bg-primary` o `var(--gb-primary)`.

## Clases utilitarias

- `.gb-num` — números tabulares (precios, KPIs, tablas).
- `.gb-text-muted`, `.gb-surface` (fondo+borde+radio), `.gb-shadow-sm|.gb-shadow|.gb-shadow-lg`, `.gb-rounded-sm|.gb-rounded|.gb-rounded-lg`.
- `.gb-hover-lift` (sube 2px + sombra), `.gb-focus-ring`, `.gb-truncate`.
- `.gb-field`, `.gb-field__label`, `.gb-field__help`, `.gb-field__error` (los usan los inputs; reutilizables a mano).

## Íconos

Un solo sistema: **bootstrap-icons** vía `<Icon name="..."/>` (registrado global). Acepta `pi-*` (legacy, mapeo en `src/utils/icons.js`), `bi-*` o nombre corto (`house` → `bi-house`). Props: `name`, `size` (ej `'1.25rem'`), `label` (si se pasa, deja de ser aria-hidden). `@dvuckovic/vue3-bootstrap-icons` no se usaba en ningún lado y se desinstaló.

## Componentes (todos globales, `src/components/ui/`)

### Button
Props legacy intactos: `label, icon, iconPos ('left'|'right'), disabled, autofocus, class, loading`. Las clases legacy `p-button-danger` / `p-button-text` siguen funcionando.
Nuevos: `variant` (`primary`|`secondary`|`ghost`|`danger`|`success`|`warning`|`info`|`link`|`outline`|`outline-<color>`), `severity` (alias estilo PrimeVue), `text` (ghost; con `severity` toma su color), `outlined`, `rounded`, `size` (`sm|small|lg|large`), `block`, `type` (default `button`), `ariaLabel`.
`loading` muestra spinner y deshabilita. Solo-ícono → padding cuadrado y aria-label automático.

### InputText / InputPassword / Select / AutoComplete / DatePicker / MultiSelect
Props comunes nuevas: `label`, `help`, `error` (string → mensaje + `is-invalid`; `true` → solo borde rojo), `required`, `id` (si no, se autogenera). Sin `label/help/error` el DOM queda igual que antes (sin wrapper).
`inheritAttrs: false`: los atributos (`class`, `style`…) van al input (InputText/DatePicker) o al contenedor (Select/AutoComplete/MultiSelect/InputPassword), igual que antes.
Extras: InputText/Select `size="sm|lg"`; InputPassword `autocomplete`; MultiSelect `disabled`, cierra con click afuera/Esc; AutoComplete muestra spinner mientras busca.

### DataTable
Props legacy intactos. Nuevos: `loading` (skeleton), `skeletonRows` (5), `compact`, `hoverable` (true), `stickyHeader` (true), `card` (radio grande + sombra). Slot `#empty` (default: `<EmptyState>` con `emptyMessage`). Paginación con primera/anterior/siguiente/última; emite `update:rows`.

### Dialog
Props legacy: `visible, header, modal, dismissableMask, style, closable`. Nuevos: `size` (`auto`|`sm` 400|`md` 600|`lg` 900|`xl` 1200), `closeOnEscape` (true). Slots: default, `#header`, `#footer` (barra estándar, botones alineados a la derecha). Animación fade+scale. Click en máscara solo cierra si el click es en la máscara (antes cerraba también al clickear dentro).

### Toast
`toast.add({ severity, summary, detail, life })` (vía `ToastGenerico`). Severidades: `success|info|warn|warning|error|danger|secondary`. Stack arriba-derecha, ícono por tipo, borde lateral de color, animación.

### Card (nuevo)
`<Card title subtitle icon variant="default|outline|flat|elevated" hoverable flush tag>` Slots: default, `#header`, `#actions`, `#footer`. `flush` quita el padding del body (útil para tablas).

### Badge (nuevo)
`<Badge label tone="neutral|primary|success|warning|danger|info|accent" variant="soft|solid|outline" size="sm|md" icon dot pill>` o contenido por slot.

### EmptyState (nuevo)
`<EmptyState icon="bi-inbox" title description size="sm|md|lg">` Slots: default / `#actions`.

### Skeleton (nuevo)
`<Skeleton width="100%" height shape="text|rect|circle" :lines="3" radius>`.

### PageHeader (nuevo)
`<PageHeader title subtitle icon :breadcrumbs="[{label:'Inicio', to:'/'}, {label:'Productos'}]">` Slots: `#actions`, `#title`, `#subtitle`, default (debajo, p.ej. tabs/filtros).

### StatCard (nuevo)
`<StatCard label value :delta="3.2" deltaSuffix="%" hint="vs. mes anterior" icon tone invertColors loading>`
▲ verde / ▼ rojo; `invertColors` para métricas donde subir es malo (precios). `delta` string no numérico se muestra tal cual. Slot default reemplaza el valor.

### Chart + `src/utils/chartTheme.js`
`Chart.vue` aplica `applyChartDefaults(Chart)` una vez (Inter, tooltips oscuros redondeados, grillas suaves sin borde de eje, leyenda con puntos, líneas con tensión). Props nuevos: `themed` (true: colorea datasets sin color con `CHART_PALETTE`), `height` (ej `'320px'`, desactiva maintainAspectRatio). Exporta `CHART_COLORS`, `CHART_PALETTE`, `alpha(hex,a)`, `themeData(type,data)`.

## Modo oscuro (futuro)
Poner `data-bs-theme="dark"` en `<html>`: Bootstrap 5.3 y las `--gb-*` ya cambian. Falta: toggle, revisar componentes de terceros (`@greenborn/vue-table-editor`, side-menu) y los colores fijos de `chartTheme.js`.
