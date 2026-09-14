# FASE 45 — Presets de bloques

## Objetivo

Permitir que Mercadeo elija diseños previamente preparados para bloques complejos sin configurar su estructura manualmente.

## Implementado

- Se agregó `MarketingBlockPresetPicker` usando `DhBlockCard` del Design System.
- El bloque `Servicios` ofrece seis presets visuales:
  - `3 Cards`
  - `4 Cards`
  - `Cards con imagen`
  - `Cards con iconos`
  - `Slider`
  - `Lista alternada`
- Cada opción tiene una miniatura visual y puede seleccionarse con un clic.
- El preset activo queda resaltado.
- La selección se persiste como preferencia interna del bloque mediante la operación existente `edit` del Page Builder.
- La interfaz se mantiene en conceptos humanos y soporta español e inglés.

## Límite respetado

FASE 45 no implementa el Media Picker de FASE 46 ni solicita identificadores técnicos de archivos.
