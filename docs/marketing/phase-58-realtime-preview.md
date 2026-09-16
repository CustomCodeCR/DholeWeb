# FASE 58 — Preview en tiempo real

## Objetivo

El Canvas debe reflejar inmediatamente los cambios de Mercadeo mientras edita una página, sin esperar publicación ni regeneración del HTML público.

El alcance del roadmap cubre:

- texto;
- imagen;
- layout;
- fondo;
- animación;
- spacing.

## Texto

El panel de Propiedades ya enviaba cada pulsación al estado de preview y FASE 57 la persiste mediante autosave.

FASE 58 completa el mismo comportamiento para la edición inline dentro del editor:

- `MarketingInlineEditableText` emite `preview` en cada `input`;
- `MarketingVisualEditor` aplica ese valor solamente al draft visual;
- el Canvas lo consume mediante `livePreviewBlocks` inmediatamente;
- Enter/blur confirma y persiste con el flujo existente;
- Escape restaura el valor persistido y revierte el preview.

El preview inline no arma un autosave adicional mientras el usuario mantiene abierta la edición `contenteditable`; esto conserva el comportamiento de Escape como cancelación real. Al confirmar, se usa la persistencia normal del bloque.

## Imagen, layout, fondo y spacing

Estos cambios usan el flujo optimista existente de `saveBlockTextProperty`:

1. se actualiza el bloque local con `replaceBuilderBlockLocal`;
2. el Canvas reacciona inmediatamente;
3. luego se envía `PageBuilderService.apply`;
4. si el backend falla, se restaura el estado anterior.

`MarketingLivePreview` observa `editorMediaId` y carga la nueva imagen cuando cambia la referencia.

## Animación

Los cambios de preset y niveles actualizan primero la configuración local del bloque y luego persisten `animationJson`. El renderer usa `preset`, `duration` y `distance` para reproducir el resultado sin esperar publicación.

## Renderer

`MarketingLivePreview` trabaja con el estado vivo de Page Builder. `renderedHtml` se mantiene únicamente como fallback cuando la página todavía no tiene bloques visuales disponibles.

## Pruebas

`tests/marketingRealtimePreview.test.ts` protege:

- preview inmediato de edición inline;
- reversión con Escape;
- autosave separado para el panel de Propiedades;
- reacción a imagen, layout, fondo, animación y spacing;
- actualización optimista antes de la respuesta del backend.

## Fuera de alcance

Esta rama no agrega ni modifica el selector Desktop / Tablet / Mobile. Ese comportamiento pertenece a FASE 59 del roadmap vigente; si ya existe por trabajo previo, se conserva sin cambios.
