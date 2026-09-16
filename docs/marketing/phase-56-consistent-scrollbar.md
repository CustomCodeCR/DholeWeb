# FASE 56 — Scroll visual consistente

## Objetivo

Crear un único estilo visual Dhole para las barras de desplazamiento usadas por Mercadeo y por las superficies compartidas de la aplicación.

La fase parte de la auditoría funcional de FASE 55. Aquí no se cambia quién es dueño del scroll ni se agregan nuevos contenedores: únicamente se unifica la presentación visual.

## Implementación

El contrato vive exclusivamente en `src/assets/theme.css`.

### Tokens Dhole

Se agregaron variables compartidas:

- `--dh-scrollbar-size`
- `--dh-scrollbar-radius`
- `--dh-scrollbar-track`
- `--dh-scrollbar-thumb`
- `--dh-scrollbar-thumb-hover`
- `--dh-scrollbar-thumb-active`

Light mode y dark mode tienen valores propios para track y thumb, conservando el color primario configurable de Dhole.

### Tamaño y facilidad de uso

La pista usa un área de 10 px. El thumb tiene un borde transparente de 2 px, por lo que visualmente queda más delgado sin reducir el área que el usuario puede tomar con el mouse.

También se establece un mínimo de 36 px para la longitud del thumb cuando el navegador lo permite.

### Compatibilidad

- Firefox usa `scrollbar-width` y `scrollbar-color`.
- Navegadores WebKit/Blink usan los pseudo-elementos `::-webkit-scrollbar*`.
- Hover y active refuerzan visualmente el thumb en navegadores compatibles.
- `::-webkit-scrollbar-corner` queda transparente.

## Un solo estilo

El selector usa `:where(...)` para mantener especificidad cero y aplicar el contrato a cualquier superficie scrollable de Dhole, incluyendo contenido teletransportado a `body` como modales y drawers.

No se define un scrollbar distinto en:

- sidebar
- editor
- propiedades
- modal
- drawer
- Block Picker
- Media Picker
- tablas
- dropdowns
- preview
- calendario
- formularios
- reuniones

Las excepciones funcionales que deliberadamente ocultan un scrollbar pueden seguir sobrescribiendo el estándar porque el selector base tiene especificidad baja.

## Pruebas

`tests/marketingScrollbarStyle.test.ts` valida:

1. existencia de un único contrato Dhole;
2. tokens diferenciados para light/dark;
3. tamaño compacto pero fácil de arrastrar;
4. ausencia de CSS visual de scrollbar dentro de `src/modules/marketing`.

La prueba está integrada en `pnpm test:marketing`.

## Fuera de alcance

FASE 57 — autosave — no se implementa aquí. No se agregan estados `Guardando...`, `Guardado`, timers, watchers ni persistencia automática.
