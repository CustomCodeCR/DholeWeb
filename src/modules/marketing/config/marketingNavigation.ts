export const MARKETING_GROUPS = [
  { label: null, items: [{ key: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  {
    label: 'Contenido',
    items: [
      { key: 'content-pages', label: 'Páginas', icon: 'file' },
      { key: 'content-news', label: 'Noticias', icon: 'news' },
      { key: 'content-posts', label: 'Posts', icon: 'file' },
      { key: 'content-videos', label: 'Videos', icon: 'media' },
      { key: 'content-reusable', label: 'Bloques reutilizables', icon: 'blocks' },
    ],
  },
  {
    label: 'Multimedia',
    items: [
      { key: 'media-library', label: 'Biblioteca', icon: 'media' },
      { key: 'media-images', label: 'Imágenes', icon: 'image' },
      { key: 'media-videos', label: 'Videos', icon: 'media' },
      { key: 'media-documents', label: 'Documentos', icon: 'file' },
    ],
  },
  {
    label: 'Diseño',
    items: [
      { key: 'design-banners', label: 'Banners', icon: 'image' },
      { key: 'design-animations', label: 'Animaciones', icon: 'sparkles' },
      { key: 'design-placements', label: 'Placements', icon: 'blocks' },
      { key: 'design-menus', label: 'Menús', icon: 'menu' },
      { key: 'design-collections', label: 'Collections', icon: 'blocks' },
    ],
  },
  {
    label: 'SEO',
    items: [
      { key: 'seo-pages', label: 'SEO de páginas', icon: 'search' },
      { key: 'seo-redirects', label: 'Redirects', icon: 'link' },
      { key: 'seo-sitemap', label: 'Sitemap', icon: 'search' },
      { key: 'seo-global', label: 'Configuración global', icon: 'settings' },
    ],
  },
  {
    label: 'Captación',
    items: [
      { key: 'capture-forms', label: 'Formularios', icon: 'form' },
      { key: 'capture-submissions', label: 'Submissions', icon: 'inbox' },
      { key: 'capture-leads', label: 'Leads', icon: 'users' },
    ],
  },
  {
    label: 'Reuniones',
    items: [
      { key: 'meetings-types', label: 'Tipos de reunión', icon: 'calendar' },
      { key: 'meetings-requests', label: 'Solicitudes', icon: 'inbox' },
      { key: 'meetings-agenda', label: 'Agenda', icon: 'calendar' },
    ],
  },
  {
    label: 'Campañas',
    items: [
      { key: 'campaigns-campaigns', label: 'Campañas', icon: 'campaign' },
      { key: 'campaigns-landings', label: 'Landing Pages', icon: 'file' },
    ],
  },
  {
    label: 'Publicación',
    items: [
      { key: 'publishing-calendar', label: 'Calendario', icon: 'calendar' },
      { key: 'publishing-pending', label: 'Pendientes de aprobación', icon: 'inbox' },
      { key: 'publishing-scheduled', label: 'Programados', icon: 'calendar' },
      { key: 'publishing-history', label: 'Historial', icon: 'file' },
    ],
  },
  { label: 'IA', items: [{ key: 'ai-assistant', label: 'Asistente IA', icon: 'sparkles' }] },
  {
    label: 'Configuración',
    items: [
      { key: 'settings-site', label: 'Información del sitio', icon: 'settings' },
      { key: 'settings-social', label: 'Redes sociales', icon: 'settings' },
      { key: 'settings-contact', label: 'Datos de contacto', icon: 'settings' },
    ],
  },
] as const

export type MarketingSectionKey = (typeof MARKETING_GROUPS)[number]['items'][number]['key']
export const MARKETING_SECTION_KEYS = MARKETING_GROUPS.flatMap((group) => group.items.map((item) => item.key))
export function isMarketingSection(value: unknown): value is MarketingSectionKey {
  return typeof value === 'string' && (MARKETING_SECTION_KEYS as readonly string[]).includes(value)
}
