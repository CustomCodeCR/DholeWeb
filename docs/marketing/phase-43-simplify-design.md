# FASE 43 — Simplificar Diseño

## Objetivo

Permitir que Mercadeo configure el aspecto general de una sección usando opciones visuales y comprensibles, sin exponer configuración técnica.

## Implementado

- La pestaña `Diseño` del panel de propiedades ahora ofrece controles reales.
- `Alineación`: Izquierda, Centro y Derecha.
- `Espaciado`: Pequeño, Normal, Grande y Muy grande.
- `Fondo`: Blanco, Claro, Corporativo, Oscuro, Imagen y Gradiente.
- Cada selección se guarda inmediatamente mediante la operación oficial `edit` del Page Builder.
- Las preferencias se almacenan internamente en el bloque y nunca se muestran como claves o estructuras técnicas.
- Se reutiliza `DhButton` para mantener consistencia con el Design System.
- Todos los textos visibles soportan ES/EN.

## Límites respetados

FASE 43 no implementa Layout Presets. No se agregan todavía opciones visuales como Texto centrado, Texto + Imagen, Imagen + Texto, Video completo o Slider para componer columnas o layouts; eso corresponde a FASE 44.
