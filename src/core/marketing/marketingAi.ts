import type { ExecuteAiChatRequest } from '@/core/interfaces/ai'
import type { ContentItemDto, MediaDto } from '@/core/interfaces/content'

export type MarketingAiTask =
  | 'suggest-title'
  | 'improve-text'
  | 'meta-title'
  | 'meta-description'
  | 'keywords'
  | 'alt-text'
  | 'json-ld'
  | 'summarize-news'
  | 'translate-es-en'
  | 'translate-en-es'

export interface MarketingAiTaskDefinition {
  key: MarketingAiTask
  label: string
  description: string
  source: 'content' | 'media'
}

export const MARKETING_AI_PROFILE_KEY = 'assistant'
export const MARKETING_AI_REQUIRES_HUMAN_APPROVAL = true

export const MARKETING_AI_TASKS: readonly MarketingAiTaskDefinition[] = [
  { key: 'suggest-title', label: 'Sugerir título', description: 'Propone un título claro y comercial sin inventar información.', source: 'content' },
  { key: 'improve-text', label: 'Mejorar texto', description: 'Mejora claridad, gramática y estilo conservando hechos y significado.', source: 'content' },
  { key: 'meta-title', label: 'Generar Meta Title', description: 'Genera un título SEO breve y fiel al contenido.', source: 'content' },
  { key: 'meta-description', label: 'Generar Meta Description', description: 'Genera una descripción SEO útil y concreta.', source: 'content' },
  { key: 'keywords', label: 'Generar Keywords', description: 'Sugiere palabras clave relevantes separadas por comas.', source: 'content' },
  { key: 'alt-text', label: 'Generar ALT', description: 'Genera texto alternativo a partir del contexto disponible del archivo.', source: 'media' },
  { key: 'json-ld', label: 'Generar JSON-LD', description: 'Genera datos estructurados válidos sin bloques Markdown.', source: 'content' },
  { key: 'summarize-news', label: 'Resumir noticia', description: 'Resume una noticia sin añadir hechos que no estén en la fuente.', source: 'content' },
  { key: 'translate-es-en', label: 'Traducir ES → EN', description: 'Traduce de español a inglés preservando significado y formato.', source: 'content' },
  { key: 'translate-en-es', label: 'Traducir EN → ES', description: 'Traduce de inglés a español preservando significado y formato.', source: 'content' },
] as const

const taskInstructions: Record<MarketingAiTask, string> = {
  'suggest-title': 'Propón un solo título. Devuelve únicamente el título, sin comillas ni explicación. Máximo 90 caracteres.',
  'improve-text': 'Mejora redacción, claridad, ortografía y tono profesional. Conserva todos los hechos. Si la fuente contiene HTML, conserva HTML válido y la estructura útil. Devuelve únicamente el texto mejorado.',
  'meta-title': 'Genera un Meta Title SEO fiel al contenido. Devuelve únicamente el título. Objetivo: aproximadamente 50 a 60 caracteres y nunca inventes ventajas o servicios.',
  'meta-description': 'Genera una Meta Description SEO fiel al contenido. Devuelve únicamente la descripción. Objetivo: aproximadamente 140 a 160 caracteres.',
  keywords: 'Genera keywords realmente relacionadas con la fuente. Devuelve únicamente una lista separada por comas, sin numeración ni explicación.',
  'alt-text': 'Genera un ALT descriptivo y accesible usando únicamente el nombre, caption y contexto suministrados. No empieces con "imagen de" ni "foto de" salvo que sea necesario. Devuelve únicamente el ALT y mantenlo conciso.',
  'json-ld': 'Genera un objeto JSON-LD válido y conservador según el contenido. Usa https://schema.org. Devuelve únicamente JSON válido, sin ``` ni comentarios. No inventes dirección, teléfono, precios, autores, fechas u otros hechos ausentes.',
  'summarize-news': 'Resume la noticia en un párrafo breve y factual. Conserva nombres, fechas y cifras presentes; no agregues información externa. Devuelve únicamente el resumen.',
  'translate-es-en': 'Traduce fielmente del español al inglés. Conserva nombres propios, cifras, enlaces y HTML si existe. Devuelve únicamente la traducción.',
  'translate-en-es': 'Traduce fielmente del inglés al español. Conserva nombres propios, cifras, enlaces y HTML si existe. Devuelve únicamente la traducción.',
}

export function isMarketingAiTask(value: unknown): value is MarketingAiTask {
  return typeof value === 'string' && MARKETING_AI_TASKS.some((task) => task.key === value)
}

export function marketingAiTaskDefinition(task: MarketingAiTask): MarketingAiTaskDefinition {
  return MARKETING_AI_TASKS.find((entry) => entry.key === task)!
}

export function buildContentAiSource(content: ContentItemDto): string {
  return [
    `Tipo: ${content.type}`,
    `Idioma: ${content.locale}`,
    `Título: ${content.title}`,
    content.excerpt ? `Resumen: ${content.excerpt}` : null,
    content.renderedHtml ? `Contenido:\n${content.renderedHtml}` : null,
    content.seo?.title ? `Meta Title actual: ${content.seo.title}` : null,
    content.seo?.description ? `Meta Description actual: ${content.seo.description}` : null,
    content.seo?.keywords ? `Keywords actuales: ${content.seo.keywords}` : null,
  ].filter(Boolean).join('\n\n')
}

export function buildMediaAiSource(media: MediaDto): string {
  return [
    `Archivo: ${media.fileName}`,
    `MIME: ${media.contentType}`,
    media.altText ? `ALT actual: ${media.altText}` : null,
    media.caption ? `Caption: ${media.caption}` : null,
  ].filter(Boolean).join('\n')
}

export function buildMarketingAiRequest(
  task: MarketingAiTask,
  source: string,
  context?: { siteKey?: string; contentTitle?: string; contentType?: string },
): ExecuteAiChatRequest {
  const cleanSource = source.trim()
  if (!cleanSource) throw new Error('AI source is required.')

  const system = [
    'Actúa como asistente editorial del CMS de Grupo Castro Fallas.',
    'Tu función es producir una sugerencia para revisión humana, nunca publicar, guardar, programar ni afirmar que realizaste cambios.',
    'No inventes hechos, servicios, certificaciones, precios, fechas, nombres, ubicaciones ni beneficios que no aparezcan en la fuente.',
    'Respeta el idioma solicitado y devuelve solamente el resultado pedido.',
  ].join(' ')

  const contextLines = [
    context?.siteKey ? `Sitio: ${context.siteKey}` : null,
    context?.contentType ? `Tipo de contenido: ${context.contentType}` : null,
    context?.contentTitle ? `Título actual: ${context.contentTitle}` : null,
  ].filter(Boolean).join('\n')

  return {
    profileKey: MARKETING_AI_PROFILE_KEY,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `${taskInstructions[task]}${contextLines ? `\n\nContexto:\n${contextLines}` : ''}\n\nFuente autorizada:\n${cleanSource}`,
      },
    ],
    correlationId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined,
  }
}

export function normalizeMarketingAiOutput(task: MarketingAiTask, raw: string): string {
  let value = raw.trim()
  if (!value) throw new Error('AI returned an empty result.')

  if (task === 'json-ld') {
    value = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('AI JSON-LD result must be a JSON object.')
    }
    return JSON.stringify(parsed, null, 2)
  }

  return value
}
