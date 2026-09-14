# FASE 46 — Media Picker visual

## Objetivo

Permitir que Mercadeo seleccione imágenes desde una biblioteca visual sin escribir identificadores técnicos.

## Implementación

- El bloque `Imagen` abre `MarketingMediaPicker`, construido sobre el componente oficial `DhMediaPicker`.
- No se muestra ni se solicita `StorageFileId`.
- La biblioteca se carga desde `ContentService.browseMedia` y se limita a imágenes.
- El picker permite buscar por nombre, filtrar por formato, subir imágenes, seleccionar una imagen y ver su preview.
- ALT Text y Caption se editan desde el mismo flujo y se guardan mediante `ContentService.updateMedia`.
- Las nuevas imágenes se suben mediante `ContentService.uploadMedia`.
- La selección del bloque se persiste como `editorMediaId` mediante la operación `edit` ya existente del Page Builder.
- Se respetan los scopes actuales para subir y editar multimedia.
- La interfaz tiene textos ES/EN y reutiliza componentes Dhole.

## Componentes

- `src/shared/components/organisms/DhMediaPicker.vue`
- `src/modules/marketing/components/MarketingMediaPicker.vue`
- `src/modules/marketing/components/MarketingBlockPropertiesContent.vue`

## Pruebas

`tests/marketingMediaPicker.test.ts` valida búsqueda, filtro, subida, selección, preview, ALT, caption y que no se exponga el identificador técnico de Storage.

## Fuera de alcance

FASE 47 no se adelanta. Esta fase no agrega drag & drop de imágenes ni la zona `Arrastre una imagen aquí`.
