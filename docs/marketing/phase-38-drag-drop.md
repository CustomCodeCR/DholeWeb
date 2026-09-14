# FASE 38 — Drag & Drop

## Objetivo

Permitir que Mercadeo construya la estructura de una página visualmente, sin editar JSON ni conocer los nombres técnicos del Page Builder.

## Implementado

- Los 25 bloques de la biblioteca pueden seleccionarse y arrastrarse.
- El lienzo acepta bloques de la biblioteca y los persiste con `PageBuilderService`.
- Las secciones existentes se reordenan mediante `DhSortable`.
- Cada sección puede duplicarse, ocultarse/mostrarse y eliminarse.
- La eliminación usa `DhConfirmDialog`; no se usan `alert()`, `confirm()` ni `prompt()` del navegador.
- Las acciones muestran nombres humanos y mensajes ES/EN.
- La traducción entre los 25 bloques visuales y los 16 tipos base soportados por el backend queda encapsulada en `marketingPageBuilder.ts` y nunca se presenta al usuario.
- El identificador visual del bloque se guarda internamente en `data.editorBlockKey` para conservar el nombre correcto cuando varios bloques comparten un mismo tipo base.

## Persistencia

Se usan las operaciones oficiales del Page Builder: `add`, `move`, `duplicate`, `delete`, `hide` y `show`. Cada respuesta del backend vuelve a hidratar la estructura visible del editor.

## Fuera de alcance

FASE 38 no crea las Drop Zones visuales de FASE 39. No se agregan zonas entre secciones ni el texto “Soltar sección aquí”.
