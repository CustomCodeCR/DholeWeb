# FASE 50 — Animation Picker visual

## Objetivo

Permitir que Mercadeo elija la animación de una sección mediante opciones visuales comprensibles, sin exponer CSS, transformaciones ni parámetros internos del Motion System.

## Opciones disponibles

El panel **Animación** ofrece exactamente las seis opciones humanas definidas por el roadmap:

- Sin animación;
- Aparecer suavemente;
- Subir suavemente;
- Entrar desde izquierda;
- Entrar desde derecha;
- Zoom suave.

Internamente se usan los presets compatibles con el contrato existente de Page Builder (`none`, `fade`, `slide-up`, `slide-right`, `slide-left` y `zoom-in`), pero esos nombres técnicos no se presentan a Mercadeo.

## Vista previa

Cada opción contiene una miniatura visual. Al pasar el cursor sobre una opción, la miniatura reproduce el efecto correspondiente. También se respeta `prefers-reduced-motion` para evitar animaciones de preview cuando el sistema solicita movimiento reducido.

## Persistencia

`MarketingVisualEditor` guarda la elección mediante la operación `edit` de Page Builder y `animationJson`.

Si el bloque ya posee configuración de animación, se preservan sus demás valores y únicamente cambia el preset. Si todavía no existe configuración, se envía solo el preset y ContentService aplica los defaults centrales del Motion System.

## Design System

El selector reutiliza `DhBlockCard` para presentar y seleccionar cada opción, manteniendo el lenguaje visual de Dhole.

## Fuera de alcance

FASE 50 no implementa FASE 51. No se muestran controles para:

- nivel de movimiento;
- intensidad;
- velocidad;
- duración;
- delay;
- easing;
- distancia.
