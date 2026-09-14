# FASE 47 — Drag & Drop de imágenes

## Objetivo

Permitir que Mercadeo asigne una imagen al bloque `Imagen` sin trabajar con identificadores técnicos ni depender únicamente de la biblioteca multimedia.

## Comportamiento

El editor muestra una zona visual con el texto `Arrastre una imagen aquí` usando el componente oficial `DhDropZone`.

También mantiene la acción `Seleccionar desde biblioteca`, que abre el `DhMediaPicker` implementado en FASE 46.

Al soltar una imagen válida:

1. `ContentService.uploadMedia` envía el archivo al flujo de multimedia, que conserva el archivo real en Storage y crea la referencia de contenido.
2. La referencia devuelta queda seleccionada automáticamente.
3. El bloque recibe el `editorMediaId` mediante el flujo `edit` existente del Page Builder.
4. Se muestra una vista previa de la imagen seleccionada.

Formatos aceptados: JPG/JPEG, PNG, WebP y AVIF.

## Permisos

La subida respeta `cms.media.upload`. La selección desde biblioteca continúa disponible aunque el usuario no tenga permiso de subida.

## Límite de fase

FASE 47 no implementa el rediseño general de la biblioteca multimedia de FASE 48. No se agregan todavía filtros globales de Todos/Imágenes/Videos/Documentos, búsqueda por fecha ni metadatos adicionales de galería.
