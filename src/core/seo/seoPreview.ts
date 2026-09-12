export interface SeoPreviewInput {
  title: string
  slug: string
  excerpt?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  canonicalUrl?: string | null
  fallbackUrl?: string | null
}

export interface SeoPreviewState {
  title: string
  description: string
  url: string
}

export interface SeoValidationInput {
  canonicalUrl?: string | null
  robots?: string | null
  structuredDataJson?: string | null
}

export function buildSeoPreview(input: SeoPreviewInput): SeoPreviewState {
  const title = input.seoTitle?.trim() || input.title.trim() || 'Sin título'
  const description = input.seoDescription?.trim() || input.excerpt?.trim() || 'Sin descripción SEO.'
  const slug = input.slug.trim().replace(/^\/+/, '') || 'contenido'
  const url = input.canonicalUrl?.trim() || input.fallbackUrl?.trim() || `https://sitio/${slug}`
  return { title, description, url }
}

export function validateSeoInput(input: SeoValidationInput): string | null {
  const canonical = input.canonicalUrl?.trim()
  if (canonical) {
    try {
      const parsed = new URL(canonical)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'La URL canónica debe usar HTTP o HTTPS.'
    } catch {
      return 'La URL canónica debe ser una URL absoluta válida.'
    }
  }

  const robots = input.robots?.trim() ?? ''
  if (robots.includes('\n') || robots.includes('\r') || robots.length > 120)
    return 'La directiva Robots no es válida.'

  const structured = input.structuredDataJson?.trim()
  if (structured) {
    try {
      const parsed = JSON.parse(structured) as unknown
      if (typeof parsed !== 'object' || parsed === null) return 'JSON-LD debe ser un objeto o arreglo JSON.'
    } catch {
      return 'JSON-LD debe contener JSON válido.'
    }
  }
  return null
}
