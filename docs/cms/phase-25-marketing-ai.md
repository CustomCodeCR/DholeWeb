# FASE 25 — Integrar IA

## Alcance

FASE 25 integra el módulo Mercadeo de DholeWeb con el `DholeAIService` existente. No se implementan proveedores, modelos ni lógica LLM dentro de ContentService o DholeWeb.

El apartado `Mercadeo > IA > Asistente IA` permite:

- sugerir título;
- mejorar texto;
- generar Meta Title;
- generar Meta Description;
- generar Keywords;
- generar ALT;
- generar JSON-LD;
- resumir noticias;
- traducir ES → EN;
- traducir EN → ES.

## Integración

DholeWeb reutiliza `AiService.executeChat` y el perfil existente `assistant` de DholeAIService. El usuario debe disponer de `ai.execution.execute` para ejecutar sugerencias. Los permisos `cms.*` continúan controlando las operaciones de edición del módulo Mercadeo.

El asistente puede cargar contenido e imágenes existentes únicamente como contexto. Antes de ejecutar, el usuario puede revisar y editar exactamente qué texto será enviado a IA.

## Aprobación humana obligatoria

Una respuesta de IA siempre inicia como `Pendiente de aprobación`.

1. La IA genera una sugerencia.
2. El usuario revisa y puede editar el resultado.
3. El usuario pulsa `Aprobar resultado`.
4. Solo después de aprobar se habilita copiar el resultado.
5. Para ALT, si existe una imagen seleccionada y el usuario tiene permiso CMS de edición, se habilita `Aplicar ALT aprobado`.

La aprobación de una sugerencia no guarda ni publica contenido editorial. Para títulos, cuerpo, SEO, JSON-LD, resúmenes y traducciones, el resultado aprobado se copia al editor correspondiente y continúa por el flujo editorial normal.

## Regla de publicación

La implementación de FASE 25 no llama a:

- `publish` / `publishEditor`;
- `schedule` / `scheduleEditor`;
- `submitForReview` / `submitEditor`.

DholeAIService no recibe capacidad de publicar. La publicación, revisión y programación continúan bajo los permisos y flujos CMS existentes.

## Seguridad del prompt

Los prompts de FASE 25 indican explícitamente que el modelo:

- produce una sugerencia para revisión humana;
- no puede afirmar que publicó o guardó cambios;
- no debe inventar hechos, servicios, certificaciones, precios, fechas, nombres o ubicaciones;
- debe usar únicamente la fuente proporcionada;
- debe devolver solo el resultado solicitado.

JSON-LD se valida como un objeto JSON válido antes de mostrarlo como resultado utilizable.

## Persistencia

FASE 25 no agrega tablas ni migraciones. No modifica DholeContentService, DholeAIService ni DholeAuthService.
