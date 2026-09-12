# FASE 14 — Biblioteca multimedia de Mercadeo

La sección **Mercadeo > Multimedia** centraliza los archivos reutilizables del sitio.

## Funciones

- subir imágenes, videos, PDF y documentos permitidos por el pipeline de Storage para Mercadeo;
- buscar por nombre, Alt Text o Caption;
- filtrar por imágenes, videos, PDF y documentos;
- seleccionar referencias existentes para revisar sus datos y reutilizarlas desde los editores de contenido;
- editar Alt Text y Caption;
- eliminar la referencia del CMS sin eliminar físicamente el archivo de Storage;
- mostrar preview autenticado de imágenes, videos y PDF;
- mostrar metadata técnica generada por Storage cuando esté disponible, incluyendo formato, resolución, duración y variantes.

## Integración

DholeWeb consume exclusivamente `/api/content/media/*`. DholeContentService actúa como fachada hacia DholeStorageService para evitar que el usuario de Mercadeo necesite scopes internos de Storage.

Las cargas pasan por el endpoint especializado de Storage para Mercadeo, por lo que se conservan las validaciones de tamaño, extensión y MIME, además de derivados de imágenes y metadata/poster de videos implementados en FASE 7.

## Permisos existentes

- lectura y preview: `cms.view`;
- carga: `cms.media.upload`;
- edición de Alt Text/Caption: `cms.edit`;
- eliminación de referencias: `cms.media.delete`.

No se agregan scopes nuevos en esta fase; la reorganización completa de permisos del CMS corresponde a FASE 23.
