# FASE 54 — Scroll independiente correcto

## Objetivo

Evitar que el editor visual haga crecer o bloquee la página completa cuando Bloques, Canvas o Propiedades contienen más información que la altura disponible.

El editor mantiene tres zonas principales:

- Bloques;
- Canvas;
- Propiedades.

Cada zona administra su propio desplazamiento cuando corresponde.

## Cambios

### Shell del editor

El editor queda limitado a la altura útil del viewport. El toolbar permanece fuera de las zonas desplazables y el grid interno usa `min-height: 0` y `overflow: hidden` para que sus hijos puedan administrar correctamente su propio scroll.

### Bloques

`MarketingBlockLibrary` conserva el buscador fijo dentro de su zona y desplaza únicamente la lista de bloques. El scroll usa `overscroll-contain` para impedir que al llegar al principio o final se arrastre accidentalmente la aplicación.

### Canvas

`visual-editor-canvas-wrap` es el único propietario del scroll vertical de la zona central. El contenedor interno `visual-editor-canvas` deja de actuar como segundo scroller, evitando el scroll vertical doble.

El Canvas usa `overscroll-behavior: contain` y `scrollbar-gutter: stable`.

### Propiedades

La columna derecha queda contenida por el grid. `DhPropertyPanel` mantiene su cabecera y tabs fuera del contenido desplazable y su cuerpo usa el scroll interno existente.

### Modal y Drawer del editor

Los componentes oficiales `DhModal` y `DhDrawer` ya limitan su altura al viewport y usan contenido con `min-h-0`, `overflow-y-auto` y `overscroll-contain`, por lo que siguen siendo desplazables incluso en pantallas de poca altura.

## Responsive

En pantallas pequeñas el editor también queda limitado a la altura útil del viewport y el Canvas conserva su propio desplazamiento. Bloques y Propiedades continúan abriéndose mediante los drawers existentes.

## Fuera de alcance

FASE 54 no realiza la auditoría general de scrollbars de Mercadeo. Sidebar principal, tablas, cards, media picker y otras superficies globales corresponden a FASE 55.
