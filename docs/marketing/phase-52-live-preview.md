# FASE 52 — Vista previa inmediata

## Objetivo

La zona central del editor visual debe reflejar los cambios de Mercadeo sin requerir guardar o publicar para poder verlos.

## Implementación

Se agregó `MarketingLivePreview.vue` como renderer reactivo del estado actual del Page Builder. La vista central deja de depender del `renderedHtml` publicado cuando existen secciones del Page Builder.

La vista refleja directamente:

- texto;
- imagen seleccionada desde la biblioteca multimedia;
- alineación y layout;
- fondo/diseño;
- color cuando el bloque contiene una preferencia de color segura;
- espaciado;
- preset, distancia y duración de animación;
- visibilidad del bloque.

## Texto sin guardar

`MarketingBlockPropertiesContent` emite `preview-text` mientras Mercadeo escribe en `DhInput` o `DhTextarea`.

`MarketingVisualEditor` mantiene esos cambios en `previewTextDrafts` y construye `livePreviewBlocks`, por lo que escribir en el panel derecho actualiza la zona central sin presionar **Guardar contenido**.

El botón Guardar continúa existiendo únicamente para persistir el contenido.

## Cambios persistentes optimistas

Las selecciones de imagen, diseño, espaciado y animación actualizan primero el estado local de `builderBlocks`. Después se ejecuta la operación oficial de Page Builder.

Si la operación falla, el editor restaura el estado anterior. Esto permite una respuesta visual inmediata sin ocultar errores de persistencia.

## Imágenes

Cuando un bloque contiene `editorMediaId`, el preview descarga el contenido mediante `/api/content/media/{id}/content`, crea una URL temporal y la libera cuando deja de utilizarse o se desmonta el componente.

## Seguridad

- No se utiliza `v-html` para el renderer vivo.
- El `renderedHtml` existente se conserva únicamente como fallback cuando la página no tiene bloques y se muestra dentro de un `iframe` con `sandbox=""`.
- Los colores dinámicos aceptados por el preview se validan antes de aplicarse.
- No se expone CSS, HTML, JS ni JSON a Mercadeo.

## Compatibilidad

La persistencia continúa utilizando `PageBuilderService.apply` con las operaciones existentes. FASE 50 y FASE 51 mantienen sus contratos de `animationJson`.

## Fuera de alcance

FASE 52 no agrega controles Desktop / Tablet / Mobile ni utiliza `DhDevicePreview`. Eso corresponde a FASE 53.
