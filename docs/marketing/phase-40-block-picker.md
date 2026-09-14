# FASE 40 — Block Picker

## Objetivo

Permitir agregar una sección sin depender exclusivamente de Drag & Drop, usando el componente oficial `DhBlockPicker`.

## Implementado

- Botón `Agregar sección` en la cabecera de `Secciones de la página`.
- El botón abre un `DhModal` con el selector visual de bloques.
- `MarketingBlockPicker` reutiliza `DhBlockPicker`; no crea un selector visual paralelo.
- Se muestran los 25 bloques humanos definidos en FASE 37 con icono, nombre y descripción.
- Los bloques siguen agrupados en Básicos, Diseño, Empresa, Marketing y Contenido.
- Búsqueda `Buscar sección...` / `Search section...`.
- Al seleccionar una tarjeta, la sección se agrega al final de la estructura mediante la operación oficial `add` del Page Builder.
- La nueva sección queda seleccionada y el picker se cierra automáticamente.
- El selector respeta ES/EN y no muestra nombres técnicos del backend.

## Límites respetados

FASE 40 no implementa edición inline de texto o contenido. Esa capacidad corresponde a FASE 41.
