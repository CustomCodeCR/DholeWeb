import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const files = [
  'const requestSellerUserId = ref(',
  'const chosenCrmClient = ref<',
  'const authorizedSellers = ref<',
  'const sellerOptionsError = ref(',
]

function position(text) {
  const index = src.indexOf(text)
  if (index < 0 || src.indexOf(text, index + text.length) >= 0) {
    throw new Error('[Pricing CRM] Missing or duplicate initialization anchor: ' + text)
  }
  return index
}

// The Vite pricingSellerDelegatedRequests plugin injects watch(requestSellerUserId)
// directly after supportDocuments. Another plugin registers an immediate watcher
// after stepTitles and references chosenCrmClient. Every ref must exist first.
const priorityPluginAnchor = position('const supportEntityId = ref(crypto.randomUUID())')
const ownershipPluginAnchor = position('const stepTitles = [')
for (const field of files) {
  const declaredAt = position(field)
  if (declaredAt >= priorityPluginAnchor || declaredAt >= ownershipPluginAnchor) {
    throw new Error('[Pricing CRM] ' + field + ' is declared after an injected watcher; Pricing will render a blank page at runtime.')
  }
}
if (src.includes("watch(requestSellerUserId,()=>{\n  if(!props.sellerRequestMode)return\n  useCrmClient(null)")) {
  throw new Error('[Pricing CRM] Auto-selecting the client seller must never clear the selected CRM customer.')
}
console.log('Pricing CRM watcher initialization: OK')
