import { readFileSync, writeFileSync } from 'node:fs'

const wizardPath = new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url)
let source = readFileSync(wizardPath, 'utf8')

const marker = 'data-screen09-rate-comments'
if (source.includes(marker)) {
  console.log('Pricing screen 09 comments: already present')
  process.exit(0)
}

function replaceRequired(anchor, replacement, label) {
  if (!source.includes(anchor)) {
    throw new Error(`No se encontró el ancla requerida para ${label}.`)
  }
  source = source.replace(anchor, replacement)
}

replaceRequired(
  "const editingRate = ref<RateDto | null>(null)\nconst rateRevisions = ref<RateRevisionDto[]>([])",
  "const editingRate = ref<RateDto | null>(null)\nconst rateComments = ref('')\nconst rateCommentsError = ref('')\nconst rateRevisions = ref<RateRevisionDto[]>([])",
  'estado de comentarios de Pantalla 09',
)

replaceRequired(
  'async function hydrateExistingRate() {',
  `async function loadRateComments(rateId: string) {\n  rateComments.value = ''\n  rateCommentsError.value = ''\n  try {\n    const response = await callEndpoint<unknown>({\n      method: 'GET',\n      path: \`/api/pricing/rates/\${rateId}/comments\`,\n    })\n    const value = unwrapApiResponse<{ comments?: string | null }>(response as never)\n    rateComments.value = value?.comments?.trim() ?? ''\n  } catch (error) {\n    rateCommentsError.value = error instanceof Error\n      ? error.message\n      : 'No fue posible cargar los comentarios de la tarifa.'\n  }\n}\n\nasync function hydrateExistingRate() {`,
  'carga de comentarios de Pantalla 09',
)

replaceRequired(
  '    editingRate.value = rate\n    rateRevisions.value = revisions',
  '    editingRate.value = rate\n    rateRevisions.value = revisions\n    await loadRateComments(props.rateId)',
  'hidratación de comentarios de Pantalla 09',
)

replaceRequired(
  `          <div class="grid gap-4 lg:grid-cols-3">\n            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifa incluye</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.includes || '—' }}</p></div>\n            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Sujeta a</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.subjectTo || '—' }}</p></div>\n            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifa no incluye</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.excludes || '—' }}</p></div>\n          </div>`,
  `          <div class="grid gap-4 lg:grid-cols-3">\n            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifa incluye</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.includes || '—' }}</p></div>\n            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Sujeta a</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.subjectTo || '—' }}</p></div>\n            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifa no incluye</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.excludes || '—' }}</p></div>\n          </div>\n\n          <div data-screen09-rate-comments class="crystal-soft p-5">\n            <div class="flex flex-wrap items-center justify-between gap-2">\n              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Comentarios de la tarifa</p>\n              <span v-if="rateComments" class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Registrado</span>\n            </div>\n            <p v-if="rateComments" class="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-[var(--dh-text)]">{{ rateComments }}</p>\n            <p v-else-if="rateCommentsError" class="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300">{{ rateCommentsError }}</p>\n            <p v-else class="mt-3 text-sm font-semibold text-[var(--dh-text-muted)]">Sin comentarios registrados</p>\n          </div>`,
  'visualización de comentarios de Pantalla 09',
)

writeFileSync(wizardPath, source)
console.log('Pricing screen 09 comments: OK')
