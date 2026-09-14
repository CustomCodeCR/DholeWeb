# FASE 49 — Crear edición de imágenes fácil

## Objetivo

Permitir que Mercadeo ajuste una imagen directamente desde el Media Picker sin buscar propiedades técnicas ni editar JSON.

## Controles disponibles

Al seleccionar una imagen, el Media Picker permite:

- cambiar ALT;
- cambiar caption;
- seleccionar visualmente el punto focal haciendo clic sobre la imagen;
- recentrar el punto focal;
- ver el tamaño del archivo en formato humano;
- reemplazar el archivo seleccionado.

## Punto focal

El punto focal se representa con un marcador sobre la vista previa. Mercadeo hace clic sobre la parte más importante de la imagen y esa posición se guarda junto con la metadata de la referencia multimedia.

La persistencia conserva la metadata existente de Storage y agrega únicamente la configuración de edición necesaria para el punto focal.

## Reemplazo seguro

`Reemplazar archivo` sube la nueva imagen, conserva ALT, caption y punto focal, y selecciona la nueva referencia en el picker.

La referencia anterior no se elimina automáticamente porque podría estar siendo usada por contenido ya publicado. De esta forma, reemplazar una imagen en la selección actual no rompe otros lugares que todavía dependan de la imagen anterior.

## Tamaño

El tamaño se obtiene usando la misma lectura segura de metadata incorporada en FASE 48 y se presenta como B, KB, MB, GB o `—` si el dato no existe para un archivo histórico.

## Interfaz humana

El picker no muestra:

- ids internos;
- StorageFileId;
- MIME type como detalle de la tarjeta;
- JSON;
- metadata técnica innecesaria.

Los textos nuevos soportan español e inglés y reutilizan los componentes oficiales `DhMediaPicker`, `DhInput`, `DhTextarea`, `DhButton`, `DhDropZone` y `DhSkeleton`.

## Compatibilidad

Se conservan los flujos anteriores de FASE 46 y FASE 47: búsqueda, filtros, subida, drag & drop, selección, preview, ALT y caption.

FASE 49 no adelanta FASE 50 ni agrega controles de animación.
