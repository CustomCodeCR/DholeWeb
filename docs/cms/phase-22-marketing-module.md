# FASE 22 — Módulo Mercadeo en DholeWeb

FASE 22 organiza la administración del CMS dentro de `DholeWeb`. No migra DholeWeb a Nuxt y no modifica ContentService, Auth ni FennecWeb.

## Navegación

`/marketing?section=<key>` mantiene un único workspace autenticado y permite enlaces directos a cada sección. El menú interno contiene exactamente las áreas pedidas por la fase: Dashboard, Contenido, Multimedia, Diseño, SEO, Captación, Reuniones, Campañas, Publicación y Configuración.

El Dashboard muestra contenido publicado, drafts, pendientes, programados, leads, formularios, reuniones y campañas.

## Integración

Se reutilizan los editores ya existentes para contenido, SEO, multimedia, menús y settings. Las nuevas vistas de recursos consultan los endpoints existentes de ContentService para placements, collections, redirects, formularios, submissions, leads, tipos/solicitudes de reunión, campañas y sites. Publicación usa los estados editoriales existentes.

`Landing Pages` reutiliza el tipo `Page`: el backend actual no define un tipo o flag separado para distinguir una landing page, por lo que FASE 22 no inventa una nueva clasificación.

`Sitemap` se presenta como una función derivada de rutas/publicación/SEO y no crea una segunda fuente de datos.

## Permisos

FASE 22 mantiene los scopes actuales. La ruta `/marketing` continúa protegida por `cms.view`, y los componentes editables respetan los scopes `cms.*` ya existentes. Los nuevos scopes específicos de formularios, leads, reuniones, campañas, redirects, reviews, navigation y collections pertenecen a FASE 23 y no se adelantan aquí.

## Fuera de alcance

- crear permisos o el rol Mercadeo;
- migrar DholeWeb o FennecWeb;
- crear endpoints alternativos;
- duplicar información de ContentService;
- implementar FASE 23 o posteriores.
