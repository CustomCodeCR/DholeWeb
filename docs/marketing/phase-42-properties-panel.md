# FASE 42 — Panel de propiedades

## Objetivo

Mostrar las propiedades de la sección seleccionada en el panel derecho del Editor Visual, usando conceptos comprensibles para Mercadeo.

## Implementado

- Al seleccionar una sección, el panel derecho refleja inmediatamente esa sección.
- En pantallas pequeñas, seleccionar una sección abre el drawer de Propiedades automáticamente.
- Se mantienen cuatro pestañas: `Contenido`, `Diseño`, `Animación` y `Avanzado`.
- `Contenido` permite editar el campo textual principal reconocido y persiste con la operación oficial `edit` del Page Builder.
- `Diseño` queda preparado para controles visuales, sin exponer configuración técnica.
- `Animación` muestra un estado humano de la sección, sin parámetros técnicos.
- `Avanzado` contiene únicamente acciones comprensibles: mostrar/ocultar, duplicar y eliminar la sección.
- El mismo contenido de propiedades se reutiliza en escritorio y en el drawer responsive.
- La sección seleccionada queda resaltada visualmente en la estructura.

## Límites respetados

FASE 42 no implementa los presets de diseño de FASE 43. No agrega controles de alineación, espaciado ni fondos, y no muestra lenguajes ni estructuras técnicas al usuario.
