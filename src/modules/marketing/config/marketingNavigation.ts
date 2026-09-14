export interface MarketingLocalizedText {
  es: string
  en: string
}

const text = (es: string, en: string): MarketingLocalizedText => ({ es, en })

export const MARKETING_GROUPS = [
  {
    label: null,
    title: text('Inicio', 'Home'),
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        title: text('Inicio', 'Home'),
        description: text('Resumen de contenido, contactos, reuniones y publicaciones.', 'A summary of content, contacts, meetings and publishing.'),
      },
    ],
  },
  {
    label: 'Contenido',
    title: text('Contenido', 'Content'),
    items: [
      { key: 'content-pages', label: 'Páginas', icon: 'file', title: text('Páginas', 'Pages'), description: text('Cree y mantenga las páginas principales del sitio.', 'Create and maintain the main pages of the website.') },
      { key: 'content-news', label: 'Noticias', icon: 'news', title: text('Noticias', 'News'), description: text('Publique novedades y comunicados para sus visitantes.', 'Publish updates and announcements for visitors.') },
      { key: 'content-posts', label: 'Posts', icon: 'file', title: text('Publicaciones', 'Posts'), description: text('Administre artículos y contenido editorial.', 'Manage articles and editorial content.') },
      { key: 'content-videos', label: 'Videos', icon: 'media', title: text('Videos', 'Videos'), description: text('Organice contenido audiovisual publicado como contenido.', 'Organize audiovisual content published as content.') },
      { key: 'content-reusable', label: 'Bloques reutilizables', icon: 'blocks', title: text('Secciones reutilizables', 'Reusable sections'), description: text('Mantenga contenido que puede utilizarse en varias páginas.', 'Maintain content that can be reused across pages.') },
    ],
  },
  {
    label: 'Multimedia',
    title: text('Multimedia', 'Media'),
    items: [
      { key: 'media-library', label: 'Biblioteca', icon: 'media', title: text('Todos los archivos', 'All files'), description: text('Encuentre imágenes, videos y documentos del sitio.', 'Find images, videos and documents used by the website.') },
      { key: 'media-images', label: 'Imágenes', icon: 'image', title: text('Imágenes', 'Images'), description: text('Administre las imágenes disponibles para el sitio.', 'Manage images available to the website.') },
      { key: 'media-videos', label: 'Videos', icon: 'media', title: text('Videos', 'Videos'), description: text('Administre los videos de la biblioteca multimedia.', 'Manage videos in the media library.') },
      { key: 'media-documents', label: 'Documentos', icon: 'file', title: text('Documentos', 'Documents'), description: text('Administre documentos descargables y archivos de apoyo.', 'Manage downloadable documents and supporting files.') },
    ],
  },
  {
    label: 'Diseño',
    title: text('Diseño del sitio', 'Site design'),
    items: [
      { key: 'design-banners', label: 'Banners', icon: 'image', title: text('Banners', 'Banners'), description: text('Cree mensajes visuales destacados para el sitio.', 'Create highlighted visual messages for the website.') },
      { key: 'design-animations', label: 'Animaciones', icon: 'sparkles', title: text('Movimiento y animaciones', 'Motion and animations'), description: text('Configure cómo aparecen y se mueven las secciones.', 'Configure how sections appear and move.') },
      { key: 'design-placements', label: 'Placements', icon: 'blocks', title: text('Ubicaciones del sitio', 'Website placements'), description: text('Defina en qué zonas pueden mostrarse banners y contenido.', 'Choose where banners and content can appear.') },
      { key: 'design-menus', label: 'Menús', icon: 'menu', title: text('Menús y navegación', 'Menus and navigation'), description: text('Organice los enlaces que las personas usan para recorrer el sitio.', 'Organize the links visitors use to navigate the website.') },
      { key: 'design-collections', label: 'Collections', icon: 'blocks', title: text('Colecciones de contenido', 'Content collections'), description: text('Agrupe información reutilizable sin trabajar con estructuras técnicas.', 'Group reusable information without working with technical structures.') },
    ],
  },
  {
    label: 'SEO',
    title: text('Visibilidad en buscadores', 'Search visibility'),
    items: [
      { key: 'seo-pages', label: 'SEO de páginas', icon: 'search', title: text('Apariencia en buscadores', 'Search appearance'), description: text('Mejore cómo se presentan sus páginas en los resultados de búsqueda.', 'Improve how pages appear in search results.') },
      { key: 'seo-redirects', label: 'Redirects', icon: 'link', title: text('Cambios de dirección', 'Address changes'), description: text('Mantenga funcionando enlaces anteriores cuando una página cambia de dirección.', 'Keep old links working when a page address changes.') },
      { key: 'seo-sitemap', label: 'Sitemap', icon: 'search', title: text('Mapa del sitio', 'Site map'), description: text('Revise cómo el sitio informa a los buscadores sobre sus páginas.', 'Review how the website tells search engines about its pages.') },
      { key: 'seo-global', label: 'Configuración global', icon: 'settings', title: text('Preferencias de búsqueda', 'Search preferences'), description: text('Defina la información general que usan buscadores y redes sociales.', 'Set the general information used by search engines and social networks.') },
    ],
  },
  {
    label: 'Captación',
    title: text('Contactos', 'Contacts'),
    items: [
      { key: 'capture-forms', label: 'Formularios', icon: 'form', title: text('Formularios', 'Forms'), description: text('Administre los formularios que completan sus visitantes.', 'Manage forms completed by visitors.') },
      { key: 'capture-submissions', label: 'Submissions', icon: 'inbox', title: text('Respuestas recibidas', 'Received responses'), description: text('Revise la información enviada desde los formularios.', 'Review information submitted through forms.') },
      { key: 'capture-leads', label: 'Leads', icon: 'users', title: text('Contactos interesados', 'Interested contacts'), description: text('Consulte las personas y empresas que mostraron interés.', 'Review people and companies that showed interest.') },
    ],
  },
  {
    label: 'Reuniones',
    title: text('Reuniones', 'Meetings'),
    items: [
      { key: 'meetings-types', label: 'Tipos de reunión', icon: 'calendar', title: text('Opciones de reunión', 'Meeting options'), description: text('Defina las reuniones que sus visitantes pueden solicitar.', 'Define the meetings visitors can request.') },
      { key: 'meetings-requests', label: 'Solicitudes', icon: 'inbox', title: text('Solicitudes de reunión', 'Meeting requests'), description: text('Revise y gestione las reuniones solicitadas.', 'Review and manage requested meetings.') },
      { key: 'meetings-agenda', label: 'Agenda', icon: 'calendar', title: text('Agenda', 'Schedule'), description: text('Vea las reuniones solicitadas y confirmadas en orden cronológico.', 'See requested and confirmed meetings in chronological order.') },
    ],
  },
  {
    label: 'Campañas',
    title: text('Campañas', 'Campaigns'),
    items: [
      { key: 'campaigns-campaigns', label: 'Campañas', icon: 'campaign', title: text('Campañas', 'Campaigns'), description: text('Organice iniciativas y acciones de Mercadeo.', 'Organize marketing initiatives and actions.') },
      { key: 'campaigns-landings', label: 'Landing Pages', icon: 'file', title: text('Páginas de campaña', 'Campaign pages'), description: text('Cree páginas enfocadas en una campaña o acción específica.', 'Create pages focused on a campaign or specific action.') },
    ],
  },
  {
    label: 'Publicación',
    title: text('Publicación', 'Publishing'),
    items: [
      { key: 'publishing-calendar', label: 'Calendario', icon: 'calendar', title: text('Calendario de publicaciones', 'Publishing calendar'), description: text('Vea el contenido que está programado para publicarse.', 'See content scheduled for publication.') },
      { key: 'publishing-pending', label: 'Pendientes de aprobación', icon: 'inbox', title: text('Pendientes de aprobación', 'Pending approval'), description: text('Revise el contenido que espera una decisión.', 'Review content waiting for a decision.') },
      { key: 'publishing-scheduled', label: 'Programados', icon: 'calendar', title: text('Publicaciones programadas', 'Scheduled publications'), description: text('Consulte el contenido que ya tiene fecha de publicación.', 'Review content that already has a publication date.') },
      { key: 'publishing-history', label: 'Historial', icon: 'file', title: text('Publicados y archivo', 'Published and archive'), description: text('Consulte contenido publicado anteriormente o archivado.', 'Review previously published or archived content.') },
    ],
  },
  {
    label: 'IA',
    title: text('Asistente', 'Assistant'),
    items: [
      { key: 'ai-assistant', label: 'Asistente IA', icon: 'sparkles', title: text('Asistente de contenido', 'Content assistant'), description: text('Prepare ideas y borradores con ayuda de inteligencia artificial.', 'Prepare ideas and drafts with AI assistance.') },
    ],
  },
  {
    label: 'Configuración',
    title: text('Configuración', 'Settings'),
    items: [
      { key: 'settings-site', label: 'Información del sitio', icon: 'settings', title: text('Información general', 'General information'), description: text('Revise los datos principales del sitio administrado.', 'Review the main information for the managed website.') },
      { key: 'settings-social', label: 'Redes sociales', icon: 'settings', title: text('Redes sociales', 'Social networks'), description: text('Administre los perfiles sociales que se muestran públicamente.', 'Manage the social profiles displayed publicly.') },
      { key: 'settings-contact', label: 'Datos de contacto', icon: 'settings', title: text('Datos de contacto', 'Contact information'), description: text('Mantenga actualizados los datos de contacto públicos.', 'Keep public contact information up to date.') },
    ],
  },
] as const

export type MarketingSectionKey = (typeof MARKETING_GROUPS)[number]['items'][number]['key']
export const MARKETING_SECTION_KEYS = MARKETING_GROUPS.flatMap((group) => group.items.map((item) => item.key))

export function isMarketingSection(value: unknown): value is MarketingSectionKey {
  return typeof value === 'string' && (MARKETING_SECTION_KEYS as readonly string[]).includes(value)
}

export function localizeMarketing(value: { readonly es: string; readonly en: string }, locale: string) {
  return locale === 'en' ? value.en : value.es
}

export function getMarketingSectionDefinition(key: MarketingSectionKey) {
  for (const group of MARKETING_GROUPS) {
    const item = group.items.find((entry) => entry.key === key)
    if (item) return { group, item }
  }
  return null
}
