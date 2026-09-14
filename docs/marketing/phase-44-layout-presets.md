# FASE 44 — Layout Presets visuales

## Objetivo

Permitir que Mercadeo elija la composición visual de un bloque sin configurar columnas ni estructuras manualmente.

## Implementado

- El bloque `Hero` muestra cinco composiciones visuales dentro de la pestaña `Diseño`:
  - Texto centrado.
  - Texto | Imagen.
  - Imagen | Texto.
  - Video completo.
  - Slider.
- Cada opción se representa mediante una tarjeta visual reutilizando `DhBlockCard` del Design System.
- La opción activa queda resaltada y puede cambiarse con un clic.
- La selección se persiste mediante la operación `edit` ya existente del Page Builder.
- La preferencia se mantiene como dato interno del bloque; Mercadeo no ve claves, estructuras técnicas ni configuración de columnas.
- Los textos funcionan en español e inglés.

## Límites respetados

FASE 44 no agrega presets específicos de bloques de FASE 45. En particular, no incorpora todavía opciones de Servicios como 3 Cards, 4 Cards, Cards con imagen, Cards con iconos o Lista alternada.
