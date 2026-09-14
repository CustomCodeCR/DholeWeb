# FASE 48 — Mejorar biblioteca multimedia

## Objetivo

Convertir Multimedia en una biblioteca visual tipo galería, fácil de explorar por Mercadeo y sin exponer identificadores o estructuras técnicas.

## Galería

`MarketingMediaTab` muestra los recursos como tarjetas visuales responsive. Cada tarjeta incluye:

- thumbnail o representación visual del tipo de archivo;
- tipo humano del recurso;
- nombre y ALT cuando existe;
- tamaño humanizado (B, KB, MB, GB);
- fecha de creación.

Las imágenes cargan su thumbnail de forma perezosa cuando la tarjeta se acerca al viewport, evitando descargar toda la biblioteca de una vez.

## Filtros

La biblioteca ofrece exactamente cuatro vistas:

- Todos;
- Imágenes;
- Videos;
- Documentos.

PDF se presenta dentro de Documentos para mantener el modelo mental solicitado para Mercadeo.

## Búsqueda

La búsqueda instantánea trabaja sobre:

- nombre del archivo;
- ALT;
- fecha de creación, tanto en formato ISO como localizado.

La biblioteca se carga una vez y los filtros/búsqueda se aplican en cliente para responder inmediatamente.

## Tamaño

`MediaDto` no expone el tamaño como propiedad separada. El tamaño se recupera de `MetadataJson`, donde ContentService conserva la respuesta de Storage al registrar el recurso. `mediaSizeInBytes` tolera las formas conocidas de metadata y `formatMediaFileSize` presenta el valor de forma humana.

Si un recurso histórico no contiene tamaño en metadata, la interfaz muestra `—` en lugar de inventar un valor.

## Design System y compatibilidad

- `DhButton`, `DhInput`, `DhDropZone`, `DhEmptyState`, `DhSkeleton`, `DhIconButton`, `DhModal` y `DhConfirmDialog` se reutilizan en el flujo.
- La confirmación de eliminación ya no usa `window.confirm`.
- El flujo previo de subida, preview y edición ALT/Caption se conserva.
- Los textos nuevos soportan español e inglés.

## Fuera de alcance

FASE 48 no implementa los cambios de FASE 49:

- focal point;
- reemplazar archivo;
- nuevas herramientas de edición de imagen.
