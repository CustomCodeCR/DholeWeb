# FASE 33 — Auditoría de componentes Dhole

## Objetivo

Inventariar los componentes reutilizables `Dh*` que ya existen en `DholeWeb` antes de crear nuevos controles para el editor visual de Mercadeo.

Esta fase es deliberadamente de auditoría: **no crea componentes visuales nuevos**. La FASE 34 debe partir de este inventario para evitar duplicados.

Base auditada: `develop` en `aa3d42b93413f611f696f3a909b3186a7ceffc02`.

## Criterio de auditoría

Se revisó `src/shared/components` y su organización por atoms, molecules, organisms, containers y templates. También se verificaron los barrels de exports y la infraestructura global relacionada con overlays y toasts.

Un control se considera:

- **Disponible**: existe un componente Dhole reutilizable que cubre la necesidad.
- **Parcial**: existe infraestructura o un componente especializado, pero falta una API Dhole genérica o hay una decisión de diseño pendiente.
- **Faltante**: no existe un componente Dhole reutilizable equivalente.

## Inventario actual de componentes `Dh*`

### Raíz

- `DhStorageImage`

### Atoms

- `DhAvatar`
- `DhBadge`
- `DhButton`
- `DhCheckbox`
- `DhEmptyState`
- `DhIconButton`
- `DhInput`
- `DhPasswordInput`
- `DhSelect`
- `DhSpinner`
- `DhSwitch`
- `DhTextarea`
- `DhTooltip`

### Molecules

- `DhConfirmDialog`
- `DhCrudToolbar`
- `DhDataTable`
- `DhDropdownMenu`
- `DhFormField`
- `DhPagination`
- `DhSearchInput`
- `DhTabs`

### Organisms

- `DhCommandPalette`
- `DhDrawer`
- `DhEntityDetailDrawer`
- `DhEntityDetailPage`
- `DhModal`
- `DhPageHeader`
- `DhSidebar`
- `DhSplitRoutePane`
- `DhTopbar`
- `DhWorkspaceTabs`

### Containers

- `DhDrawerContainer`
- `DhModalContainer`
- `DhToastContainer`

### Templates

- `DhCrudViewTemplate`

**Total auditado: 36 componentes `Dh*`.**

## Cobertura requerida por FASE 33

| Categoría | Estado | Componente / infraestructura actual | Decisión para siguientes fases |
| --- | --- | --- | --- |
| Buttons | Disponible | `DhButton`, `DhIconButton` | Reutilizar. |
| Inputs | Disponible | `DhInput`, `DhPasswordInput`, `DhTextarea`, `DhSearchInput`, `DhCheckbox`, `DhSwitch` | Reutilizar. |
| Selects | Disponible | `DhSelect` | Reutilizar. No crear selects visuales ad-hoc. |
| Modals | Disponible | `DhModal`, `DhModalContainer` | Reutilizar. |
| Dialogs | Parcial | `DhConfirmDialog` | Confirmación ya está resuelta. Crear `DhDialog` solo si aparece un caso genérico real que `DhModal` no cubra. |
| Drawers | Disponible | `DhDrawer`, `DhDrawerContainer` | Reutilizar. |
| Cards | Faltante | — | Candidato a `DhCard` si el editor requiere una card genérica. |
| Tabs | Disponible | `DhTabs`, `DhWorkspaceTabs` | Reutilizar según contexto. |
| Tables | Disponible | `DhDataTable` | Reutilizar. |
| Tooltips | Disponible | `DhTooltip` | Reutilizar. |
| Toasts | Parcial | `DhToastContainer` + `useToastStore` | El sistema global ya funciona. Evaluar si FASE 34 necesita una fachada/componente `DhToast`; no duplicar store ni container. |
| Breadcrumbs | Faltante | — | Candidato a `DhBreadcrumbs`. |
| Pagination | Disponible | `DhPagination` | Reutilizar. |
| Loaders | Disponible | `DhSpinner` | Reutilizar para carga local. |
| Skeletons | Faltante | — | Crear `DhSkeleton` en FASE 34 si se confirma su uso. |
| Empty states | Disponible | `DhEmptyState` | Reutilizar. |
| File pickers | Faltante | — | No existe picker Dhole genérico. No confundir con drawers de upload específicos de Pricing. |
| Date pickers | Faltante | — | Candidato a `DhDatePicker`. |
| Drag & drop | Parcial | Existen implementaciones de módulo, pero no un `Dh*` reutilizable | Crear abstracción del Design System, no reutilizar código específico de Pricing como API pública. |
| Sortable | Faltante | — | `DhSortable` es candidato prioritario de FASE 34. |
| Color picker | Faltante | — | `DhColorPicker` es candidato prioritario de FASE 34. |
| Icon picker | Faltante | — | `DhIconPicker` es candidato prioritario de FASE 34. |

## Estado de la lista prioritaria de FASE 34

| Componente propuesto | Estado después de la auditoría | Acción |
| --- | --- | --- |
| `DhConfirmDialog` | Ya existe | **No recrear.** |
| `DhToast` | Infraestructura existente | Evaluar una fachada solo si aporta una API reutilizable; **no duplicar** `DhToastContainer` ni `useToastStore`. |
| `DhDrawer` | Ya existe | **No recrear.** |
| `DhSortable` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhDropZone` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhMediaPicker` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhIconPicker` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhColorPicker` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhDevicePreview` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhBlockCard` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhBlockPicker` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhPropertyPanel` | Faltante | Crear si FASE 34 confirma necesidad. |
| `DhEmptyState` | Ya existe | **No recrear.** |
| `DhSkeleton` | Faltante | Crear si FASE 34 confirma necesidad. |

## Hallazgos de consistencia

1. `DhSplitRoutePane.vue` existe dentro de `organisms`, pero actualmente no está exportado desde `src/shared/components/organisms/index.ts`. No se modifica en esta fase porque la FASE 33 es de auditoría; debe resolverse cuando se normalicen exports del Design System.
2. Los atoms y molecules principales sí están expuestos desde sus respectivos barrels.
3. Toasts ya son globales mediante `DhToastContainer` y `useToastStore`; crear otra infraestructura paralela produciría duplicación.
4. Hay componentes específicos de módulos que resuelven necesidades similares a drag & drop o uploads, pero no deben considerarse sustitutos del Design System `Dh*` porque están acoplados a su dominio.
5. Los componentes nuevos de FASE 34 deben respetar Light/Dark, i18n, accesibilidad y scroll; no deben introducir `alert()`, `confirm()` ni `prompt()`.

## Faltantes confirmados para evaluar en FASE 34

Faltantes directamente derivados de las categorías auditadas:

- `DhCard`
- `DhBreadcrumbs`
- `DhSkeleton`
- picker de archivos / media reutilizable
- `DhDatePicker`
- `DhDropZone`
- `DhSortable`
- `DhColorPicker`
- `DhIconPicker`

Faltantes adicionales ya priorizados por el roadmap del editor visual:

- `DhMediaPicker`
- `DhDevicePreview`
- `DhBlockCard`
- `DhBlockPicker`
- `DhPropertyPanel`

## Regla para FASE 34

Antes de crear cada componente:

1. comprobar este inventario;
2. comprobar si puede componerse usando componentes `Dh*` existentes;
3. crear un nuevo componente únicamente cuando no exista un equivalente reutilizable;
4. incorporarlo al Design System general de Dhole, no solamente al módulo de Mercadeo.

La FASE 33 queda completa cuando este inventario pasa el pipeline existente de `DholeWeb` y se integra a `develop` siguiendo el flujo rama → tests → `develop`.