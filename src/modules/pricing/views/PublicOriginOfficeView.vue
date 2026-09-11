<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Building2, Mail, MapPin, Phone, Navigation } from 'lucide-vue-next'

interface OfficeContact {
  name: string
  phone: string
  email: string
  role: string
  isPrimary: boolean
  modalities: string[]
  shipmentModes: string[]
  routes: string[]
}

interface OfficePhoto {
  storageId: string
  fileName: string
  publicContentPath: string
}

interface OriginOffice {
  id: string
  name: string
  code: string
  polId: string | null
  polValue: string
  polCode: string
  address: string
  city: string
  country: string
  latitude: number | null
  longitude: number | null
  contacts: OfficeContact[]
  photos: OfficePhoto[]
  message: string
  gcfOnly?: boolean
}

const route = useRoute()
const office = ref<OriginOffice | null>(null)
const loading = ref(true)
const failed = ref(false)
const photoObjectUrls = ref<Record<string, string>>({})
const photoFailures = ref<Record<string, boolean>>({})

const apiBaseUrl = String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

function gatewayUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

function publicAssetUrl(path: string) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return gatewayUrl(path)
}

function compactAgent(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function isRsLogistics(code: string, name: string) {
  const values = [compactAgent(code), compactAgent(name)].filter(Boolean)
  return values.some((value) => value === 'RS' || value.includes('RSLOGISTICS'))
}

const polValue = computed(() => String(route.query.pol ?? '').trim())
const polCode = computed(() => String(route.query.polCode ?? route.params.polCode ?? '').trim().toUpperCase())
const polLocator = computed(() => polValue.value || polCode.value)
const polDisplay = computed(() => office.value?.polValue || polValue.value || office.value?.polCode || polCode.value)
const agentCode = computed(() => String(route.query.agentCode ?? '').trim())
const agentName = computed(() => String(route.query.agent ?? '').trim())
const hasAgentContext = computed(() => Boolean(agentCode.value || agentName.value))
const gcfOnlyFromAgent = computed(() => hasAgentContext.value && !isRsLogistics(agentCode.value, agentName.value))

const coordinates = computed(() => {
  if (office.value?.gcfOnly) return ''
  if (office.value?.latitude == null || office.value?.longitude == null) return ''
  return `${office.value.latitude}, ${office.value.longitude}`
})
const mapUrl = computed(() => coordinates.value ? `https://www.google.com/maps?q=${encodeURIComponent(coordinates.value)}` : '')

function gcfContact(): OfficeContact {
  return {
    name: 'Grupo Castro Fallas',
    phone: '',
    email: 'china@grupocastrofallas.com',
    role: 'Contacto GCF',
    isPrimary: true,
    modalities: [],
    shipmentModes: ['FCL'],
    routes: [],
  }
}

function revokePhotoObjectUrls() {
  Object.values(photoObjectUrls.value).forEach((url) => URL.revokeObjectURL(url))
  photoObjectUrls.value = {}
  photoFailures.value = {}
}

function imageMimeType(fileName: string, responseContentType: string | null) {
  const reported = String(responseContentType ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (reported.startsWith('image/')) return reported

  const extension = fileName.trim().toLowerCase().split('.').pop() ?? ''
  const byExtension: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
  }

  return byExtension[extension] ?? 'application/octet-stream'
}

async function loadPublicPhoto(photo: OfficePhoto) {
  try {
    const response = await fetch(publicAssetUrl(photo.publicContentPath), {
      headers: { Accept: 'image/*' },
      credentials: 'omit',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const content = await response.arrayBuffer()
    if (!content.byteLength) throw new Error('Empty image')

    const blob = new Blob([content], {
      type: imageMimeType(photo.fileName, response.headers.get('content-type')),
    })
    const objectUrl = URL.createObjectURL(blob)
    const previousUrl = photoObjectUrls.value[photo.storageId]
    if (previousUrl) URL.revokeObjectURL(previousUrl)

    photoObjectUrls.value = {
      ...photoObjectUrls.value,
      [photo.storageId]: objectUrl,
    }
  } catch {
    photoFailures.value = {
      ...photoFailures.value,
      [photo.storageId]: true,
    }
  }
}

function loadPublicPhotos(photos: OfficePhoto[]) {
  revokePhotoObjectUrls()
  for (const photo of photos) void loadPublicPhoto(photo)
}

async function load() {
  loading.value = true
  failed.value = false
  office.value = null
  revokePhotoObjectUrls()

  if (!polLocator.value || !apiBaseUrl) {
    failed.value = true
    loading.value = false
    return
  }

  try {
    const query = new URLSearchParams()
    const shipmentMode = String(route.query.shipmentMode ?? '').trim()
    const routeKey = String(route.query.route ?? '').trim()

    // POL resolves the configured origin office. Agent context is carried by
    // newly generated quote links so a non-RS quote never exposes RS contacts/WHS data.
    query.set('pol', polLocator.value)
    if (shipmentMode) query.set('shipmentMode', shipmentMode)
    if (routeKey) query.set('route', routeKey)
    if (agentCode.value) query.set('agentCode', agentCode.value)
    if (agentName.value) query.set('agent', agentName.value)

    const endpoint = gatewayUrl(`/api/config/public/pricing-warehouses/resolve?${query.toString()}`)
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    const resolved = (payload?.data ?? payload) as OriginOffice

    office.value = gcfOnlyFromAgent.value
      ? {
          ...resolved,
          address: '',
          city: '',
          country: '',
          latitude: null,
          longitude: null,
          contacts: [gcfContact()],
          photos: [],
          gcfOnly: true,
        }
      : { ...resolved, gcfOnly: false }

    if (!office.value.gcfOnly && office.value.photos.length) loadPublicPhotos(office.value.photos)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(revokePhotoObjectUrls)
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div class="h-2 bg-red-700" />
        <div class="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[.2em] text-red-700">Grupo Castro Fallas</p>
            <h1 class="mt-2 text-2xl font-black sm:text-3xl">Estos son los datos de Castro Fallas en origen.</h1>
            <p v-if="office?.gcfOnly" class="mt-2 text-sm font-semibold text-slate-500">Contacto GCF para la coordinación correspondiente al POL {{ polDisplay || 'seleccionado' }}.</p>
            <p v-else class="mt-2 text-sm font-semibold text-slate-500">Información pública de coordinación correspondiente al POL {{ polDisplay || 'seleccionado' }}.</p>
          </div>
          <Building2 class="h-12 w-12 text-red-700" />
        </div>
      </header>

      <div v-if="loading" class="rounded-3xl bg-white p-8 text-center font-bold shadow-sm ring-1 ring-slate-200">Cargando datos de la oficina…</div>
      <div v-else-if="failed || !office" class="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p class="text-lg font-black">No encontramos una oficina activa para este POL.</p>
        <p class="mt-2 text-sm text-slate-500">Contacte a Grupo Castro Fallas para confirmar los datos de coordinación.</p>
      </div>

      <template v-else>
        <section :class="office.gcfOnly ? 'mx-auto max-w-2xl' : 'grid gap-4 md:grid-cols-2'">
          <article v-if="!office.gcfOnly" class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p class="text-xs font-black uppercase tracking-[.16em] text-slate-500">Oficina de origen</p>
            <h2 class="mt-2 text-2xl font-black">{{ office.name }}</h2>
            <div class="mt-5 space-y-3 text-sm">
              <div class="flex gap-3"><MapPin class="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><span>{{ office.address || 'Dirección por confirmar' }}<template v-if="office.city || office.country"><br>{{ [office.city, office.country].filter(Boolean).join(', ') }}</template></span></div>
              <div v-if="coordinates" class="flex gap-3"><Navigation class="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><a :href="mapUrl" target="_blank" rel="noopener noreferrer" class="font-bold text-red-700 hover:underline">{{ coordinates }} · Abrir mapa</a></div>
            </div>
          </article>

          <article class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p class="text-xs font-black uppercase tracking-[.16em] text-slate-500">Contactos</p>
            <div v-if="office.contacts.length" class="mt-3 space-y-4">
              <div v-for="(contact, index) in office.contacts" :key="`${contact.email}-${index}`" class="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div class="flex items-center justify-between gap-2"><strong>{{ contact.name || 'Contacto de oficina' }}</strong><span v-if="contact.isPrimary" class="rounded-full bg-red-100 px-2 py-1 text-[10px] font-black uppercase text-red-800">Principal</span></div>
                <p v-if="contact.role" class="mt-1 text-xs font-semibold text-slate-500">{{ contact.role }}</p>
                <a v-if="contact.phone" :href="`tel:${contact.phone}`" class="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-red-700"><Phone class="h-4 w-4" />{{ contact.phone }}</a>
                <a v-if="contact.email" :href="`mailto:${contact.email}`" class="mt-2 flex items-center gap-2 break-all text-sm font-bold text-slate-700 hover:text-red-700"><Mail class="h-4 w-4" />{{ contact.email }}</a>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-slate-500">Contacto por confirmar.</p>
          </article>
        </section>

        <section v-if="!office.gcfOnly" class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4"><p class="text-xs font-black uppercase tracking-[.16em] text-slate-500">Fotografías</p><h2 class="mt-1 text-xl font-black">Referencia de la oficina / WHS</h2></div>
          <div v-if="office.photos.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <figure v-for="photo in office.photos" :key="photo.storageId" class="overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
              <img v-if="photoObjectUrls[photo.storageId]" :src="photoObjectUrls[photo.storageId]" :alt="photo.fileName || office.name" class="aspect-[4/3] w-full object-cover" />
              <div v-else class="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
                <span class="font-semibold">{{ photoFailures[photo.storageId] ? 'Imagen no disponible' : 'Cargando imagen…' }}</span>
                <span v-if="photo.fileName" class="break-all text-xs">{{ photo.fileName }}</span>
              </div>
            </figure>
          </div>
          <p v-else class="text-sm text-slate-500">No hay fotografías publicadas para esta oficina.</p>
        </section>
      </template>
    </div>
  </main>
</template>
