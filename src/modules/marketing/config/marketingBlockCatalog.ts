export type MarketingBlockIcon =
  | 'heading'
  | 'text'
  | 'image'
  | 'video'
  | 'button'
  | 'divider'
  | 'hero'
  | 'columns'
  | 'image-text'
  | 'gallery'
  | 'slider'
  | 'tabs'
  | 'services'
  | 'team'
  | 'clients'
  | 'stats'
  | 'testimonials'
  | 'cta'
  | 'banner'
  | 'form'
  | 'meeting'
  | 'campaign'
  | 'news'
  | 'faq'
  | 'related-posts'

export interface MarketingBlockText {
  es: string
  en: string
}

export interface MarketingBlockDefinition {
  id: string
  title: MarketingBlockText
  description: MarketingBlockText
  icon: MarketingBlockIcon
}

export interface MarketingBlockGroup {
  id: 'basic' | 'design' | 'company' | 'marketing' | 'content'
  title: MarketingBlockText
  blocks: MarketingBlockDefinition[]
}

export const MARKETING_BLOCK_GROUPS: MarketingBlockGroup[] = [
  {
    id: 'basic',
    title: { es: 'Básicos', en: 'Basics' },
    blocks: [
      { id: 'heading', icon: 'heading', title: { es: 'Título', en: 'Heading' }, description: { es: 'Encabezado para presentar una sección.', en: 'Heading for introducing a section.' } },
      { id: 'text', icon: 'text', title: { es: 'Texto', en: 'Text' }, description: { es: 'Contenido de lectura en uno o varios párrafos.', en: 'Readable content in one or more paragraphs.' } },
      { id: 'image', icon: 'image', title: { es: 'Imagen', en: 'Image' }, description: { es: 'Imagen destacada con texto alternativo.', en: 'Featured image with alternative text.' } },
      { id: 'video', icon: 'video', title: { es: 'Video', en: 'Video' }, description: { es: 'Contenido audiovisual para la página.', en: 'Video content for the page.' } },
      { id: 'button', icon: 'button', title: { es: 'Botón', en: 'Button' }, description: { es: 'Acción visible que lleva a otro destino.', en: 'Visible action that links to another destination.' } },
      { id: 'divider', icon: 'divider', title: { es: 'Separador', en: 'Divider' }, description: { es: 'Separa visualmente grupos de contenido.', en: 'Visually separates groups of content.' } },
    ],
  },
  {
    id: 'design',
    title: { es: 'Diseño', en: 'Design' },
    blocks: [
      { id: 'hero', icon: 'hero', title: { es: 'Hero', en: 'Hero' }, description: { es: 'Cabecera visual para destacar el mensaje principal.', en: 'Visual header for highlighting the main message.' } },
      { id: 'columns', icon: 'columns', title: { es: 'Columnas', en: 'Columns' }, description: { es: 'Organiza contenido en varias columnas.', en: 'Organizes content into multiple columns.' } },
      { id: 'image-text', icon: 'image-text', title: { es: 'Imagen + Texto', en: 'Image + Text' }, description: { es: 'Combina una imagen con contenido explicativo.', en: 'Combines an image with supporting copy.' } },
      { id: 'gallery', icon: 'gallery', title: { es: 'Galería', en: 'Gallery' }, description: { es: 'Muestra varias imágenes en una composición visual.', en: 'Displays multiple images in a visual composition.' } },
      { id: 'slider', icon: 'slider', title: { es: 'Slider', en: 'Slider' }, description: { es: 'Presenta contenido destacado en varias láminas.', en: 'Presents featured content across several slides.' } },
      { id: 'tabs', icon: 'tabs', title: { es: 'Tabs', en: 'Tabs' }, description: { es: 'Organiza información en pestañas fáciles de explorar.', en: 'Organizes information into easy-to-browse tabs.' } },
    ],
  },
  {
    id: 'company',
    title: { es: 'Empresa', en: 'Company' },
    blocks: [
      { id: 'services', icon: 'services', title: { es: 'Servicios', en: 'Services' }, description: { es: 'Presenta los servicios principales de la empresa.', en: 'Presents the company’s main services.' } },
      { id: 'team', icon: 'team', title: { es: 'Equipo', en: 'Team' }, description: { es: 'Muestra personas y roles del equipo.', en: 'Shows team members and their roles.' } },
      { id: 'clients', icon: 'clients', title: { es: 'Clientes', en: 'Clients' }, description: { es: 'Destaca clientes, aliados o marcas relacionadas.', en: 'Highlights clients, partners or related brands.' } },
      { id: 'stats', icon: 'stats', title: { es: 'Estadísticas', en: 'Statistics' }, description: { es: 'Resalta cifras y resultados importantes.', en: 'Highlights important figures and results.' } },
      { id: 'testimonials', icon: 'testimonials', title: { es: 'Testimonios', en: 'Testimonials' }, description: { es: 'Comparte opiniones y experiencias de clientes.', en: 'Shares customer opinions and experiences.' } },
    ],
  },
  {
    id: 'marketing',
    title: { es: 'Marketing', en: 'Marketing' },
    blocks: [
      { id: 'cta', icon: 'cta', title: { es: 'CTA', en: 'CTA' }, description: { es: 'Invita al visitante a realizar una acción concreta.', en: 'Invites the visitor to take a specific action.' } },
      { id: 'banner', icon: 'banner', title: { es: 'Banner', en: 'Banner' }, description: { es: 'Mensaje visual destacado dentro de la página.', en: 'Highlighted visual message inside the page.' } },
      { id: 'form', icon: 'form', title: { es: 'Formulario', en: 'Form' }, description: { es: 'Recopila datos de visitantes y contactos.', en: 'Collects visitor and contact information.' } },
      { id: 'meeting', icon: 'meeting', title: { es: 'Reunión', en: 'Meeting' }, description: { es: 'Permite solicitar o coordinar una reunión.', en: 'Lets visitors request or arrange a meeting.' } },
      { id: 'campaign', icon: 'campaign', title: { es: 'Campaña', en: 'Campaign' }, description: { es: 'Destaca una campaña o iniciativa activa.', en: 'Highlights an active campaign or initiative.' } },
    ],
  },
  {
    id: 'content',
    title: { es: 'Contenido', en: 'Content' },
    blocks: [
      { id: 'news', icon: 'news', title: { es: 'Noticias', en: 'News' }, description: { es: 'Muestra noticias o novedades recientes.', en: 'Displays recent news or updates.' } },
      { id: 'faq', icon: 'faq', title: { es: 'FAQ', en: 'FAQ' }, description: { es: 'Agrupa preguntas frecuentes y sus respuestas.', en: 'Groups frequently asked questions and answers.' } },
      { id: 'related-posts', icon: 'related-posts', title: { es: 'Posts relacionados', en: 'Related posts' }, description: { es: 'Sugiere contenido relacionado para continuar navegando.', en: 'Suggests related content to continue browsing.' } },
    ],
  },
]

export function localizeMarketingBlock(text: MarketingBlockText, locale: string) {
  return locale.startsWith('en') ? text.en : text.es
}
