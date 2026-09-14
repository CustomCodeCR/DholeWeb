# FASE 35 — Configuración de animaciones desde Mercadeo

Se agrega **Diseño → Animaciones** al módulo de Mercadeo. El usuario selecciona una página, carga sus bloques reales desde Page Builder y configura `preset`, `duration`, `delay`, `easing`, `stagger`, `trigger`, `once` y `distance` por bloque.

Los presets y límites son los mismos de Fennec FASE 34. El guardado usa `POST /api/content/page-builder/{contentId}/operations` con operación `edit` y `animationJson`, sin reemplazar `data` del bloque.

Esta fase administra configuración únicamente. No implementa `CmsMotion` ni `IntersectionObserver`.
