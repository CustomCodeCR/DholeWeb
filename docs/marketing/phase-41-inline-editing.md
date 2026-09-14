# FASE 41 — Edición Inline

## Objetivo

Permitir que Mercadeo edite directamente el texto visible de una sección siempre que el bloque tenga un campo textual reconocible, sin tener que buscar ese campo en otra pantalla.

## Implementado

- Nuevo componente `MarketingInlineEditableText` para edición directa dentro de la estructura visual.
- Un clic sobre el texto activa la edición en el mismo lugar.
- `Enter` guarda, `Escape` cancela y salir del campo guarda el cambio.
- Se reconocen campos existentes como `title`, `headline`, `heading`, `text`, `body`, `content`, `label` y `name`.
- Para bloques nuevos se usa un campo humano predecible (`title`, `text` o `label`) según el bloque.
- Los cambios se persisten con la operación oficial `edit` del Page Builder.
- Al guardar se conserva todo el resto de `data` del bloque; solo cambia el campo editado.
- Se mantienen mensajes ES/EN y no se muestra JSON al usuario.

## Cuándo no se fuerza edición inline

Los bloques puramente visuales o de estructura (`Imagen`, `Video`, `Separador`, `Galería`, `Slider`) no reciben un campo de texto inventado cuando no existe uno previamente.

## Límite respetado

FASE 41 no implementa el panel derecho completo de propiedades. Esa capacidad corresponde a FASE 42.
