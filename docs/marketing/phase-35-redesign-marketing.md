# FASE 35 — Rediseño de Mercadeo

## Objetivo

Rediseñar el módulo de Mercadeo para que la operación diaria se sienta visual, limpia y simple. La interfaz debe hablar con conceptos de negocio y evitar exponer IDs, JSON, códigos y propiedades internas.

Esta fase **no implementa todavía el nuevo Editor Visual por bloques**. Ese trabajo corresponde a FASE 36 y siguientes. FASE 35 prepara el entorno y reemplaza el editor técnico heredado por un flujo humano compatible con la funcionalidad actual.

## Cambios realizados

### Navegación humanizada

Se mantiene la estructura interna y las claves de sección para no romper rutas, permisos ni pruebas anteriores, pero la interfaz muestra nombres orientados a Mercadeo:

- Dashboard → Inicio
- Placements → Ubicaciones del sitio
- Collections → Colecciones de contenido
- Redirects → Cambios de dirección
- Submissions → Respuestas recibidas
- Leads → Contactos interesados
- Landing Pages → Páginas de campaña
- SEO de páginas → Apariencia en buscadores

Cada opción incluye una descripción en español e inglés.

### Nuevo inicio de Mercadeo

El inicio ahora muestra:

- resumen visual de publicación, borradores, pendientes, contactos, formularios, reuniones y campañas;
- tareas frecuentes con accesos directos;
- navegación buscable;
- contexto claro de la sección activa;
- diseño responsive y compatible con Light/Dark.

### Editor de contenido simplificado

`MarketingContentWorkspace` reemplaza el uso normal del editor técnico anterior.

El usuario trabaja con:

- título;
- resumen;
- dirección pública;
- editor de texto enriquecido;
- imagen principal mediante `DhMediaPicker`;
- categorías;
- contenido destacado;
- título y descripción para buscadores;
- programación y publicación.

Se ocultan del flujo normal:

- IDs;
- slugs internos;
- JSON-LD;
- JSON de configuración;
- códigos internos;
- propiedades de infraestructura.

Los valores SEO avanzados existentes que no se muestran se conservan al guardar.

### Confirmaciones Dhole

El flujo normal ya no depende de ventanas nativas para agregar enlaces ni para acciones destructivas.

Se utilizan:

- `DhModal`;
- `DhConfirmDialog`;
- `DhToast` mediante `useToastStore`;
- `DhDrawer`;
- `DhMediaPicker`;
- `DhButton`, `DhInput`, `DhTextarea`, `DhSelect`, `DhSwitch`, `DhCheckbox`, `DhEmptyState` y `DhSkeleton`.

### Recursos humanizados

Las vistas de recursos dejan de mostrar códigos, IDs, configuraciones JSON y referencias internas como información principal. Por ejemplo:

- una respuesta de formulario aparece como “Respuesta recibida” y no como un ID recortado;
- una colección no muestra `settingsJson`;
- una ubicación no muestra `allowedTypesJson`;
- una reunión no muestra el ID del tipo de reunión;
- las redirecciones se presentan como cambios de dirección permanentes o temporales.

## Compatibilidad

La estructura `MARKETING_GROUPS`, sus claves y sus labels heredados se conservan internamente para mantener compatibilidad con las fases anteriores. Los textos humanizados se almacenan como metadatos localizados y son los que se muestran en la interfaz.

## Fuera de alcance

No se implementan todavía:

- canvas visual de página;
- panel izquierdo de bloques;
- panel de propiedades del Page Builder;
- drag & drop de bloques en la página;
- preview del sitio dentro del editor.

Estos puntos comienzan en FASE 36.
