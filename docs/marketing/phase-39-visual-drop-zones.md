# FASE 39 — Drop Zones visuales

## Objetivo

Hacer evidente dónde se insertará un bloque mientras Mercadeo lo arrastra hacia la página.

## Implementado

- Se agregó `DhBlockDropZone`, un componente del Design System específico para inserción de bloques. El `DhDropZone` existente se conserva para carga de archivos.
- Las zonas aparecen únicamente mientras se arrastra un bloque desde la biblioteca.
- Se muestra el texto humano `Soltar sección aquí` / `Drop section here`.
- Existe una zona antes de la primera sección y una después de cada sección; así quedan cubiertos inicio, espacios intermedios y final de la página.
- Cada zona envía su índice visual como `targetIndex` a la operación `add` del Page Builder.
- La zona activa se destaca con borde y fondo del Design System para dejar clara la posición final.
- `DhSortable` expone un slot `after` para colocar elementos Dhole entre secciones y evita resaltar una sección cuando el arrastre proviene de la biblioteca.
- El estado de las zonas se limpia al terminar el arrastre o cambiar de página.

## Design System

No se agregó ninguna librería externa de Drag & Drop. Se reutilizan eventos HTML5 y componentes `Dh*`.

## Fuera de alcance

FASE 39 no implementa el Block Picker de FASE 40 ni agrega una biblioteca visual externa.
