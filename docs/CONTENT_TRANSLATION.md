# Traducción del contenido de Dhole Web

La selección de idioma en la barra superior utiliza los diccionarios de `vue-i18n` registrados en `src/core/i18n/index.ts` (incluidos CRM, SRM, Scraping y Comercial). Los textos conocidos se localizan sin llamadas a un proveedor de IA.

El botón **Traducir contenido con IA / Translate page content with AI** realiza una traducción explícita de los textos de lectura de la página actual. **No se envía contenido a IA al cambiar de idioma.** El texto mostrado se conserva en memoria y puede restaurarse desde el mismo botón. Formularios editables, controles, elementos de navegación, valores con aspecto de identificadores, direcciones web y correos quedan excluidos.

## Requisitos

- Debe estar disponible `DholeAIService` y el perfil de chat `assistant` con permisos para el usuario que realiza la traducción.
- Puede utilizarse otro perfil configurando `VITE_CONTENT_TRANSLATION_PROFILE_KEY` en el despliegue de Dhole Web.
- La función utiliza el endpoint autenticado y el proveedor del perfil seleccionado; el contenido puede salir al proveedor de IA configurado. Revise la política de tratamiento de datos antes de habilitar la función con información confidencial.
- Cuando el perfil esté deshabilitado, la red falle o el modelo no devuelva un JSON válido, se mostrará un aviso y el contenido original seguirá disponible.

## Alcance y límites

La traducción se realiza sobre texto de lectura renderizado en el DOM, no sobre los datos fuente. Se procesa un máximo de 120 textos únicos por solicitud, en grupos de 20. La caché es local a la sesión de la página y no se guarda en el backend. Los documentos adjuntos, imágenes, PDF, editores, correos en HTML y contenido de iframes no forman parte de esta traducción.

Las traducciones de la interfaz deben continuar implementándose mediante `vue-i18n`. Para un campo de negocio persistente en dos idiomas conviene añadir valores localizados a su contrato de API; no utilizar esta traducción visual para guardar contenido. Los cambios de idioma restauran el texto original y permiten volver a solicitar la traducción.
