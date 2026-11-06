# Traducciones de Dhole Web

La interfaz utiliza **vue-i18n** y el idioma elegido por el usuario (`es` o `en`).
Incluye los diccionarios generales y los de CRM, SRM, Scraping y Comercial.

Se eliminó el traductor de contenido basado en IA. Cambiar el idioma no ejecuta solicitudes a DholeAIService ni envía información de clientes a un proveedor externo.

Los módulos que aún tengan texto heredado utilizan pares de traducción revisados en `src/core/i18n/operationalLabels.ts`. Los desarrollos nuevos deben usar `t('modulo.clave')` directamente, con claves equivalentes en ambos idiomas, y formatos de fecha/números vinculados al idioma activo.

**Alcance:** el contenido escrito libremente por clientes/usuarios, documentos importados y respuestas de APIs se preserva en su idioma original. Para mostrar esos datos en dos idiomas sin IA se requieren traducciones almacenadas explícitamente en los contratos de datos.

## Pruebas

Ejecutar `pnpm run test:mobile-i18n`, `pnpm run version:check` y `pnpm run build`. Verificar manualmente móviles de 320, 375, 390 y 430 px, tablet de 768 px, escritorio, modo claro/oscuro, cambio ES/EN, formularios, tablas con scroll y diálogos.
