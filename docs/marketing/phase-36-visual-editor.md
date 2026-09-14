# FASE 36 — Nuevo Editor Visual

## Objetivo

Crear la pantalla principal del nuevo Editor Visual de Mercadeo sin adelantar la funcionalidad de las fases siguientes.

## Implementado

- Acceso al Editor Visual desde el encabezado de Mercadeo.
- Acceso contextual desde `Páginas`.
- Selector de página dentro del editor.
- Barra superior con regreso a `Páginas`, página seleccionada, estado y `Vista previa`.
- Layout principal de tres áreas en escritorio:
  - `Bloques` a la izquierda.
  - `Página visual` al centro.
  - `Propiedades` a la derecha.
- Vista visual aislada en `iframe` del HTML renderizado de la página seleccionada.
- Panel de propiedades con las secciones previstas: `Contenido`, `Diseño`, `Animación` y `Espaciado`.
- Comportamiento responsive: Bloques y Propiedades pasan a `DhDrawer` en pantallas menores.
- Light/Dark mediante variables del Design System en la interfaz del editor.
- Textos ES/EN siguiendo el locale actual.

## Límites respetados

FASE 36 crea el shell y navegación del editor, pero deliberadamente no implementa:

- catálogo real de bloques (FASE 37),
- drag & drop (FASE 38),
- drop zones (FASE 39),
- `DhBlockPicker` funcional dentro del editor (FASE 40),
- edición concreta de propiedades de bloque.

Los paneles laterales quedan preparados para que las siguientes fases agreguen esas capacidades sin rediseñar nuevamente la pantalla principal.
