# FASE 57 — Crear autosave

## Objetivo

Guardar automáticamente el borrador mientras Mercadeo trabaja en el editor visual, sin depender de alertas ni obligar a publicar para conservar cambios.

## Comportamiento

El texto editado desde el panel de Propiedades continúa reflejándose inmediatamente en la vista viva de FASE 52 y ahora, además, se persiste automáticamente después de una pausa corta de escritura.

- debounce: `800 ms`;
- persistencia: operación `edit` de Page Builder;
- el autosave usa el mismo bloque y `dataJson` que el flujo manual existente;
- no se muestra un toast de éxito por cada autosave;
- si una operación manual está en curso, el autosave espera y reintenta;
- si el guardado falla, el borrador visual se conserva y el toolbar muestra un estado de error.

Las acciones que ya persistían inmediatamente —agregar, mover, duplicar, eliminar, ocultar/mostrar, diseño, multimedia y animación— continúan haciéndolo y participan del mismo estado visual de guardado.

## Estado en toolbar

El editor muestra un indicador discreto y accesible:

- `Guardando...` / `Saving...` mientras existe un cambio pendiente o una operación de Page Builder en curso;
- `Guardado` / `Saved` al completar la persistencia;
- `No guardado` / `Not saved` si el backend rechaza el cambio.

El indicador usa `role="status"` y `aria-live="polite"`.

## Cambio de página y salida

Antes de cambiar la página activa o cerrar el editor se intenta guardar cualquier texto pendiente. Si la operación no puede completarse, el editor conserva el contexto actual para evitar descartar silenciosamente el borrador.

También se intenta vaciar un cambio pendiente si el componente se desmonta por una navegación externa.

## Sin alertas

FASE 57 no utiliza `alert()`, `confirm()` ni `prompt()` para informar el autosave.

## Fuera de alcance

FASE 58 no se implementa aquí. No se agregan:

- Deshacer;
- Rehacer;
- pilas de historial;
- snapshots para Undo/Redo.
