# FASE 34 — Componentes Dh faltantes

## Objetivo

Crear solamente los componentes compartidos que FASE 33 confirmó como faltantes dentro de la lista prioritaria del editor visual, sin duplicar controles o infraestructura que ya existen.

Base: `develop` después de FASE 33.

## Componentes reutilizados, no recreados

- `DhConfirmDialog`
- `DhDrawer`
- `DhTooltip`
- `DhEmptyState`
- Toast global: `DhToastContainer` + `useToastStore`

La infraestructura global de Toast ya cubre el caso de uso y no se crea un segundo store/container.

## Componentes creados

### Atoms

- `DhSkeleton`: placeholder de carga configurable.
- `DhColorPicker`: selector de color con valor editable y presets opcionales.

### Molecules

- `DhDropZone`: carga por drag & drop y selector de archivos, con validación de tipo/tamaño/múltiples.
- `DhIconPicker`: selector reutilizable de iconos con búsqueda.
- `DhDevicePreview`: preview Desktop/Tablet/Mobile configurable.
- `DhBlockCard`: card estándar para representar bloques visuales.

### Organisms

- `DhSortable`: ordenamiento genérico por drag & drop, con soporte de teclado Alt+Arrow.
- `DhMediaPicker`: selector modal genérico para multimedia provista por el consumidor.
- `DhBlockPicker`: selector categorizado y buscable de bloques visuales.
- `DhPropertyPanel`: panel genérico de propiedades con tabs y scroll independiente.

## Design System

Todos los componentes se ubican en `src/shared/components`, usan tokens/clases del Design System existente y quedan exportados desde sus barrels para ser consumidos por cualquier módulo de Dhole.

También se normaliza la exportación de `DhSplitRoutePane`, hallazgo pendiente de FASE 33.

## Reglas aplicadas

- No se crean componentes específicos dentro de Mercadeo.
- No se usan `alert()`, `confirm()` ni `prompt()`.
- Los componentes que muestran texto reciben labels/textos por props, de manera que el consumidor pueda resolver i18n.
- Se conserva soporte Light/Dark usando variables `--dh-*`.
- Pickers, paneles y previews contemplan overflow/scroll para contenido largo.
- No se agrega una dependencia visual externa.

## Fuera de alcance

Aunque la auditoría general detectó otros faltantes (`DhCard`, `DhBreadcrumbs`, `DhDatePicker`), no forman parte de la lista prioritaria definida para FASE 34 y no se adelantan en esta fase.
