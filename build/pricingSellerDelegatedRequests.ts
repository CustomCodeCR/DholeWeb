import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingSellerDelegatedRequests] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const priorityState = `const rateRequestPriorityOptions = [
  { value: 'Green', label: 'Verde · máximo 24 horas' },
  { value: 'Yellow', label: 'Amarillo · máximo 48 horas' },
  { value: 'Red', label: 'Rojo · máximo 72 horas' },
]`

  code = replaceOne(
    code,
    priorityState,
    `${priorityState}
interface SellerRequestOwnerDto {
  userId: string
  email?: string | null
  displayName?: string | null
  userName?: string | null
  isCurrent: boolean
}
interface SellerRequestOwnerResponse {
  viewerUserId: string
  mode: 'Own' | 'Selected' | 'All' | string
  sellers: SellerRequestOwnerDto[]
}
const sellerRequestOwnerId = ref('')
const sellerRequestCurrentUserId = ref('')
const sellerRequestOwnerOptions = ref<Array<{ value: string; label: string }>>([])
const sellerRequestOwnersLoading = ref(false)

async function loadSellerRequestOwnerOptions() {
  if (!props.sellerRequestMode || sellerRequestOwnersLoading.value) return
  sellerRequestOwnersLoading.value = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/seller-visibility/me/options',
      headers: { Accept: 'application/json' },
    })
    const visibility = unwrapApiResponse<SellerRequestOwnerResponse>(response as never)
    sellerRequestCurrentUserId.value = visibility.viewerUserId
    sellerRequestOwnerOptions.value = (visibility.sellers ?? []).map((seller) => ({
      value: seller.userId,
      label: String(seller.displayName || seller.userName || seller.email || seller.userId).trim(),
    }))
    const current = visibility.sellers?.find((seller) => seller.isCurrent)
    sellerRequestOwnerId.value = current?.userId
      || visibility.sellers?.[0]?.userId
      || visibility.viewerUserId
  } catch (error) {
    sellerRequestOwnerId.value = ''
    sellerRequestOwnerOptions.value = []
    toastStore.backendError(error, 'No se pudieron cargar los vendedores disponibles para la solicitud.')
  } finally {
    sellerRequestOwnersLoading.value = false
  }
}

onMounted(async () => {
  if (props.sellerRequestMode) await loadSellerRequestOwnerOptions()
})`,
    'seller request priority state',
  )

  code = replaceOne(
    code,
    `          priority: rateRequestPriority.value,
          clientName: form.clientName.trim() || null,`,
    `          priority: rateRequestPriority.value,
          sellerUserId: sellerRequestOwnerId.value || null,
          clientName: form.clientName.trim() || null,`,
    'delegated seller payload',
  )

  code = replaceOne(
    code,
    `    resetWizard()
    rateRequestPriority.value = 'Green'`,
    `    resetWizard()
    rateRequestPriority.value = 'Green'
    sellerRequestOwnerId.value = sellerRequestCurrentUserId.value || sellerRequestOwnerId.value`,
    'delegated seller reset',
  )

  return code
}

export function pricingSellerDelegatedRequests(): Plugin {
  return {
    name: 'dhole-pricing-seller-delegated-requests',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
