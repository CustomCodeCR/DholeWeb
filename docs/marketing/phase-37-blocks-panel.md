# FASE 37 — Panel izquierdo de bloques

## Objetivo

Convertir el panel izquierdo preparado en FASE 36 en un catálogo visual y humano de secciones disponibles para Mercadeo.

## Implementado

- Catálogo centralizado de 25 bloques.
- Cinco categorías: `Básicos`, `Diseño`, `Empresa`, `Marketing` y `Contenido`.
- Cada bloque muestra icono, nombre y descripción corta.
- Uso de `DhBlockCard` del Design System creado en FASE 34.
- Búsqueda por nombre, descripción o categoría mediante `DhSearchInput`.
- Textos ES/EN según el locale actual.
- El mismo catálogo aparece en escritorio y dentro del `DhDrawer` responsive.
- El panel izquierdo aumentó a 280 px para mantener legibles nombre y descripción.

## Bloques incluidos

- Básicos: Título, Texto, Imagen, Video, Botón, Separador.
- Diseño: Hero, Columnas, Imagen + Texto, Galería, Slider, Tabs.
- Empresa: Servicios, Equipo, Clientes, Estadísticas, Testimonios.
- Marketing: CTA, Banner, Formulario, Reunión, Campaña.
- Contenido: Noticias, FAQ, Posts relacionados.

## Regla de interfaz

La interfaz nunca muestra nombres técnicos de componentes o tipos internos. Los identificadores del catálogo son internos y los usuarios ven únicamente nombres y descripciones de negocio.

## Límites respetados

FASE 37 no implementa todavía:

- selección persistente de un bloque,
- drag & drop,
- movimiento entre posiciones,
- duplicación, eliminación u ocultamiento,
- drop zones,
- inserción mediante `DhBlockPicker`.

Estas capacidades corresponden a FASE 38 en adelante.
