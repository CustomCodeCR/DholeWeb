# FASE 55 — Auditoría de scrollbars de Mercadeo

## Objetivo

Verificar que todas las superficies de Mercadeo sigan siendo utilizables con contenido corto y largo, sin paneles truncados, scroll doble accidental, overlays bloqueados ni contenido inaccesible.

Esta fase audita funcionamiento y contención. **No cambia el diseño visual del scrollbar**; FASE 56 se encargará de la consistencia visual.

## Resultado de la auditoría

| Superficie | Resultado | Acción |
| --- | --- | --- |
| Sidebar principal | Correcto | `DhSidebar` ya usa un área `overflow-y-auto` contenida y `overscroll-contain`. |
| Sidebar de Mercadeo | Correcto | La navegación mantiene altura máxima y scroll propio en escritorio. |
| Editor visual | Correcto | Se mantiene la contención de FASE 54: Bloques, Canvas y Propiedades tienen propietarios de scroll independientes. |
| Panel de propiedades | Correcto | `DhPropertyPanel` conserva header/tabs visibles y desplaza solamente su contenido. |
| Modal | Correcto | `DhModal` limita la altura al viewport y su contenido puede desplazarse. |
| Drawer | Correcto | `DhDrawer` ocupa el viewport disponible y mantiene contenido desplazable. |
| Block Picker | Corregido | Se añadió altura máxima explícita; búsqueda fija y catálogo con un único scroll vertical. |
| Media Picker | Corregido | Se eliminó el scroll vertical duplicado entre la galería y los detalles. Controles/footer quedan fuera del único scroller central. |
| Tablas | Reforzado | `DhDataTable` contiene el scroll horizontal y evita propagar el gesto al contenedor padre. |
| Cards | Correcto | Cards de contenido, recursos y multimedia usan `min-w-0`, truncado o `break-words` según corresponda. |
| Dropdown | Corregido | `DhDropdownMenu` ahora tiene altura máxima, ancho limitado al viewport y scroll para listas largas. |
| Menús | Correcto | Campos usan ancho flexible y el listado puede continuar mediante el scroll normal de la página sin bloqueo. |
| Preview | Correcto | `DhDevicePreview` contiene el scroll horizontal necesario y el preview vivo no bloquea el Canvas. |
| Calendario | Correcto | Usa `MarketingResourceTab`; fechas y detalles permanecen accesibles con contenido largo. |
| Formularios | Correcto | Usa `MarketingResourceTab`; títulos/subtítulos rompen texto y detalles se limitan visualmente. |
| Reuniones | Correcto | Tipos, solicitudes y agenda usan `MarketingResourceTab` y permanecen legibles en listas largas. |

## Cambios realizados

### Dropdowns

`DhDropdownMenu` ahora limita su altura a `min(70dvh, 24rem)`, restringe el ancho al viewport y activa scroll vertical contenido cuando la lista crece.

### Block Picker

`DhBlockPicker` queda limitado a `min(64dvh, 36rem)`. La búsqueda permanece fija y únicamente el catálogo de bloques se desplaza.

### Media Picker

`DhMediaPicker` deja de combinar un grid con `max-height + overflow` dentro del scroll del modal. Ahora:

1. búsqueda/filtros/subida son fijos;
2. galería + detalles comparten un solo scroller central;
3. acciones de cancelar/seleccionar permanecen visibles al final del picker.

### Tablas

`DhDataTable` añade `overscroll-contain` al contenedor horizontal para evitar que una tabla ancha arrastre accidentalmente la superficie padre.

## Cobertura de regresión

`tests/marketingScrollbarAudit.test.ts` verifica:

- sidebar principal y sidebar de Mercadeo;
- editor, Canvas y propiedades;
- modal y drawer;
- Block Picker y Media Picker;
- dropdowns;
- tablas;
- preview de dispositivos;
- cards y contenido largo;
- rutas de formularios, calendario y reuniones;
- uso del scrollbar Dhole ya existente sin adelantar FASE 56.

## Fuera de alcance

FASE 55 no modifica colores, ancho, thumb, track ni apariencia de scrollbars. Esa normalización visual corresponde a **FASE 56 — Crear scroll visual consistente**.
