<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms'
import DhStorageImage from '@/shared/components/DhStorageImage.vue'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { StorageService } from '@/core/services/storageService'
import type { CatalogGroupDto, CatalogItemDto } from '@/core/interfaces/catalogs'
import MetadataEditor from '@/modules/catalogs/components/MetadataEditor.vue'
import CatalogRouteLocationPicker from '@/modules/catalogs/components/CatalogRouteLocationPicker.vue'

const props = defineProps<{
  group: CatalogGroupDto
  item?: CatalogItemDto
  nextSortOrder?: number
  onSaved?: () => Promise<void> | void
}>()

const { t } = useI18n()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const loading = ref(false)

interface WarehouseStoredImage {
  storageId: string
  fileName?: string
}

interface PendingWarehouseImage {
  id: string
  file: File
  previewUrl: string
}

interface WarehouseCarouselImage {
  key: string
  storageId?: string
  previewUrl?: string
  fileName?: string
  pendingId?: string
}

const pendingWarehouseImages = ref<PendingWarehouseImage[]>([])
const warehouseCarouselIndex = ref(0)

const form = ref({
  name: props.item?.name ?? '',
  slug: props.item?.slug ?? '',
  description: props.item?.description ?? '',
  value: props.item?.value ?? '',
  metadataJson: props.item?.metadataJson ?? null,
  sortOrder: props.item?.sortOrder ?? props.nextSortOrder ?? 1,
  isSystem: props.item?.isSystem ?? false,
})

const isEdit = computed(() => Boolean(props.item))
const isWarehouseGroup = computed(() => props.group.slug === 'pricing-warehouses')
const isRouteCreate = computed(() => !props.item && ['pol', 'poe', 'pod'].includes(props.group.slug))
const routeCatalogSlug = computed(() => props.group.slug as 'pol' | 'poe' | 'pod')
type RouteCatalogDraft = { name: string; slug: string; description: string; value: string; metadataJson: string }
const routeDraft = ref<RouteCatalogDraft | null>(null)
const routeFormVersion = ref(0)

// A new WHS can be a country-only placeholder, without any geographic details.
const genericWarehouse = ref(!props.item)

const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.create))
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.update))

const canSave = computed(() => {
  return isEdit.value ? canUpdate.value : canCreate.value
})

type WarehouseImageMetadata = Record<string, unknown> & {
  imageStorageId?: string
  imageFileName?: string
  images?: Array<{
    storageId?: string
    fileName?: string
  }>
}

function parseMetadataJson(value?: string | null): WarehouseImageMetadata {
  if (!value?.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as WarehouseImageMetadata)
      : {}
  } catch {
    return {}
  }
}


const isAgentGroup = computed(() => props.group.slug === 'agents')
type AgentCountry = { name: string; code: string }
const polCountries = ref<AgentCountry[]>([])
const agentCountrySearch = ref('')

function normalizedCountry(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function canonicalCountryName(value: string) {
  // Los POL pueden tener un sufijo de código de puerto: "Estados Unidos (ABQ)".
  // No es otro país; este sufijo se elimina solo para clasificar países.
  return value.trim().replace(/\s*\([A-Z0-9]{2,6}\)\s*$/i, '').trim()
}

function countryIdentity(name: string, code = '') {
  const canonical = canonicalCountryName(name)
  const iso = code.trim().toUpperCase()
  const known = polCountries.value.find((country) =>
    normalizedCountry(country.name) === normalizedCountry(canonical)
    || Boolean(country.code && (country.code.toUpperCase() === iso || country.code.toUpperCase() === canonical.toUpperCase())),
  )
  const matchedCode = known?.code || (/^[A-Z]{2}$/.test(iso) ? iso : '')
  return matchedCode ? `code:${matchedCode.toUpperCase()}` : `name:${normalizedCountry(canonical)}`
}

function listCountryNames(meta: Record<string, unknown>) {
  const countries = Array.isArray(meta.countries) ? meta.countries : []
  const names = countries
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map((value) => value.trim())

  if (!names.length) {
    const legacyName = String(
      meta.countryName || meta.country || meta.originCountry || '',
    ).trim()
    if (legacyName) names.push(legacyName)
  }

  const rawCodes = Array.isArray(meta.countryCodes) ? meta.countryCodes : []
  const codes = [...rawCodes, meta.countryCode, meta.originCountryCode]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  for (const code of codes) {
    const known = polCountries.value.find((country) =>
      Boolean(country.code) && country.code.toUpperCase() === code.toUpperCase(),
    )
    // Compatibilidad con agentes cuya única metadata anterior era countryCode.
    if (known && !names.some((name) => normalizedCountry(name) === normalizedCountry(known.name))) {
      names.push(known.name)
    } else if (!known && names.length === 0) {
      names.push(code)
    }
  }

  const unique = new Map<string, string>()
  names.forEach((name) => {
    const canonical = canonicalCountryName(name)
    const known = polCountries.value.find((country) =>
      normalizedCountry(country.name) === normalizedCountry(canonical)
      || Boolean(country.code && country.code.toUpperCase() === canonical.toUpperCase()),
    )
    const displayName = known?.name ?? canonical
    unique.set(countryIdentity(displayName), displayName)
  })
  return [...unique.values()]
}

const selectedAgentCountries = computed(() => listCountryNames(parseMetadataJson(form.value.metadataJson)))
const agentCountryOptions = computed(() => {
  const names = new Map<string, AgentCountry>()
  for (const country of [...polCountries.value, ...selectedAgentCountries.value.map((name) => ({ name, code: '' }))]) {
    const key = countryIdentity(country.name, country.code)
    const current = names.get(key)
    if (!current || (!current.code && country.code)) names.set(key, country)
  }
  return [...names.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
})
const filteredAgentCountryOptions = computed(() => {
  const search = normalizedCountry(agentCountrySearch.value)
  return agentCountryOptions.value.filter((country) =>
    !search || normalizedCountry(country.name).includes(search) || country.code.toLowerCase().includes(search),
  )
})
const canAddCustomCountry = computed(() => {
  const search = normalizedCountry(agentCountrySearch.value)
  return Boolean(search) && !agentCountryOptions.value.some((country) =>
    countryIdentity(country.name, country.code) === countryIdentity(agentCountrySearch.value)
    || Boolean(country.code && country.code.toLowerCase() === search),
  )
})

function agentCountrySelected(name: string) {
  return selectedAgentCountries.value.some((selected) => countryIdentity(selected) === countryIdentity(name))
}

function setAgentCountries(names: string[]) {
  const metadata = parseMetadataJson(form.value.metadataJson)
  const canonical = new Map<string, AgentCountry>()
  for (const value of names) {
    const normalizedValue = canonicalCountryName(value)
    const known = polCountries.value.find((country) =>
      normalizedCountry(country.name) === normalizedCountry(normalizedValue)
      || Boolean(country.code && country.code.toLowerCase() === normalizedValue.toLowerCase()),
    )
    const name = known?.name ?? normalizedValue
    if (name) canonical.set(countryIdentity(name, known?.code), { name, code: known?.code ?? '' })
  }
  const countries = [...canonical.values()]
  // Los campos singulares conservan compatibilidad con lectores anteriores.
  // Los plurales son la fuente para los agentes que trabajan en varios países.
  for (const key of [
    'country', 'countryName', 'countryCode', 'countryIso2', 'countryIso3',
    'originCountry', 'originCountryCode', 'iso2', 'iso3', 'countries', 'countryCodes',
  ]) delete metadata[key]
  if (countries.length) {
    metadata.countries = countries.map((country) => country.name)
    metadata.country = countries[0]!.name
    metadata.countryName = countries[0]!.name
    if (countries[0]!.code) metadata.countryCode = countries[0]!.code
    const codes = [...new Set(countries.map((country) => country.code).filter(Boolean))]
    if (codes.length) metadata.countryCodes = codes
  }
  form.value.metadataJson = Object.keys(metadata).length ? JSON.stringify(metadata) : null
}

function toggleAgentCountry(name: string) {
  if (!canSave.value) return
  const selected = selectedAgentCountries.value
  setAgentCountries(agentCountrySelected(name)
    ? selected.filter((value) => countryIdentity(value) !== countryIdentity(name))
    : [...selected, name])
}

function addCustomAgentCountry() {
  if (!canSave.value || !canAddCustomCountry.value) return
  setAgentCountries([...selectedAgentCountries.value, agentCountrySearch.value.trim()])
  agentCountrySearch.value = ''
}

async function loadAgentCountries() {
  if (!isAgentGroup.value) return
  try {
    const ports = await CatalogItemsService.select({ catalogGroupSlug: 'pol' })
    const countries = new Map<string, AgentCountry>()
    const codeKeys = new Map<string, string>()
    for (const port of ports) {
      const meta = parseMetadataJson(port.metadataJson)
      const portNames = [port.label, port.value].map((value) => String(value ?? '').trim())
      const routeWithCountry = portNames.find((name) => name.includes(',')) ?? ''
      const suffix = routeWithCountry ? routeWithCountry.split(',').at(-1)?.trim() : ''
      const names = [
        meta.countryName, meta.country, meta.originCountry,
        ...(Array.isArray(meta.countries) ? meta.countries : []),
        suffix, meta.countryCode,
      ].filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
      const code = String(meta.countryCode ?? '').trim().toUpperCase()
      const isoCode = /^[A-Z]{2}$/.test(code) ? code : ''
      for (const rawName of names) {
        const name = canonicalCountryName(rawName)
        if (!name) continue
        // "US" no se muestra como una segunda opción si ya existe "Estados Unidos".
        if (isoCode && name.toUpperCase() === isoCode && names.some((value) =>
          canonicalCountryName(value).toUpperCase() !== isoCode,
        )) continue

        // Agrupar por ISO y por país normalizado, nunca por código/nombre del puerto.
        const normalizedName = normalizedCountry(name)
        const key = (isoCode && codeKeys.get(isoCode)) || normalizedName
        const existing = countries.get(key)
        const chooseReadableName = existing && /^[A-Z]{2}$/.test(existing.name) && name.length > 2
        if (!existing || chooseReadableName || (!existing.code && isoCode)) {
          countries.set(key, { name: chooseReadableName || !existing ? name : existing.name, code: isoCode || existing?.code || '' })
        }
        if (isoCode) codeKeys.set(isoCode, key)
      }
    }
    polCountries.value = [...countries.values()]
  } catch {
    // Todavía se puede registrar un país manualmente cuando no cargue el catálogo POL.
  }
}

onMounted(() => { void loadAgentCountries() })

function storedWarehouseImages(metadata: WarehouseImageMetadata): WarehouseStoredImage[] {
  const images: WarehouseStoredImage[] = []
  const seen = new Set<string>()

  const add = (storageId?: string, fileName?: string) => {
    const id = String(storageId ?? '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    images.push({ storageId: id, fileName: String(fileName ?? '').trim() || undefined })
  }

  if (Array.isArray(metadata.images)) {
    metadata.images.forEach((image) => add(image?.storageId, image?.fileName))
  }

  // Compatibilidad con los WHS creados cuando solo se permitía una imagen.
  add(metadata.imageStorageId, metadata.imageFileName)

  return images
}

const warehouseImageMetadata = computed(() => parseMetadataJson(form.value.metadataJson))
const warehouseStoredImages = computed(() => storedWarehouseImages(warehouseImageMetadata.value))
const warehouseCarouselImages = computed<WarehouseCarouselImage[]>(() => [
  ...warehouseStoredImages.value.map((image) => ({
    key: `stored:${image.storageId}`,
    storageId: image.storageId,
    fileName: image.fileName,
  })),
  ...pendingWarehouseImages.value.map((image) => ({
    key: `pending:${image.id}`,
    previewUrl: image.previewUrl,
    fileName: image.file.name,
    pendingId: image.id,
  })),
])
const activeWarehouseImage = computed(() => warehouseCarouselImages.value[warehouseCarouselIndex.value] ?? null)

watch(
  () => warehouseCarouselImages.value.length,
  (length) => {
    if (!length) {
      warehouseCarouselIndex.value = 0
      return
    }
    if (warehouseCarouselIndex.value >= length) warehouseCarouselIndex.value = length - 1
  },
)

function clearPendingWarehouseImages() {
  pendingWarehouseImages.value.forEach((image) => URL.revokeObjectURL(image.previewUrl))
  pendingWarehouseImages.value = []
  warehouseCarouselIndex.value = 0
}

function selectWarehouseImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return

  const accepted: PendingWarehouseImage[] = []
  let rejectedType = 0
  let rejectedSize = 0

  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      rejectedType += 1
      continue
    }

    if (file.size > 5 * 1024 * 1024) {
      rejectedSize += 1
      continue
    }

    const duplicate = pendingWarehouseImages.value.some((image) =>
      image.file.name === file.name &&
      image.file.size === file.size &&
      image.file.lastModified === file.lastModified,
    )
    if (duplicate) continue

    accepted.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    })
  }

  if (rejectedType) {
    toastStore.warning('Archivo no válido', `${rejectedType} imagen(es) fueron omitidas. Use JPG, PNG o WEBP.`)
  }
  if (rejectedSize) {
    toastStore.warning('Imagen muy grande', `${rejectedSize} imagen(es) fueron omitidas por superar 5 MB.`)
  }
  if (!accepted.length) return

  const firstNewIndex = warehouseStoredImages.value.length + pendingWarehouseImages.value.length
  pendingWarehouseImages.value.push(...accepted)
  warehouseCarouselIndex.value = firstNewIndex
}

function removePendingWarehouseImage(pendingId: string) {
  const index = pendingWarehouseImages.value.findIndex((image) => image.id === pendingId)
  if (index < 0) return
  const image = pendingWarehouseImages.value[index]
  if (!image) return
  URL.revokeObjectURL(image.previewUrl)
  pendingWarehouseImages.value.splice(index, 1)
}

function previousWarehouseImage() {
  const length = warehouseCarouselImages.value.length
  if (length <= 1) return
  warehouseCarouselIndex.value = (warehouseCarouselIndex.value - 1 + length) % length
}

function nextWarehouseImage() {
  const length = warehouseCarouselImages.value.length
  if (length <= 1) return
  warehouseCarouselIndex.value = (warehouseCarouselIndex.value + 1) % length
}

function selectWarehouseCarouselImage(index: number) {
  warehouseCarouselIndex.value = index
}

async function uploadWarehouseImages(entityId: string, metadataJson: string | null) {
  if (!isWarehouseGroup.value || !pendingWarehouseImages.value.length) return metadataJson

  const metadata = parseMetadataJson(metadataJson)
  const images = storedWarehouseImages(metadata)

  for (const [index, pendingImage] of pendingWarehouseImages.value.entries()) {
    const uploaded = await StorageService.uploadFile({
      file: pendingImage.file,
      sourceService: 'DholeWeb',
      entityType: 'PricingWarehouse',
      entityId,
      metadataJson: JSON.stringify({
        catalogGroupSlug: props.group.slug,
        warehouseName: form.value.name || null,
        imageIndex: images.length + index,
      }),
    })

    images.push({
      storageId: uploaded.id,
      fileName: uploaded.originalFileName || pendingImage.file.name,
    })
  }

  metadata.images = images.map((image) => ({
    storageId: image.storageId,
    fileName: image.fileName,
  }))

  // Conservamos los campos anteriores para cualquier pantalla/instalación que aún
  // consuma la imagen única del WHS. La primera imagen funciona como portada.
  metadata.imageStorageId = images[0]?.storageId
  metadata.imageFileName = images[0]?.fileName

  return JSON.stringify(metadata)
}

function resetCreateForm() {
  routeDraft.value = null
  routeFormVersion.value += 1
  const nextSortOrder = Number(form.value.sortOrder || 0) + 1
  clearPendingWarehouseImages()
  genericWarehouse.value = true

  form.value = {
    name: '',
    slug: '',
    description: '',
    value: '',
    metadataJson: null,
    sortOrder: nextSortOrder,
    isSystem: false,
  }
}

async function save() {
  if (!canSave.value) {
    toastStore.warning('Sin permiso', 'No tiene permiso para guardar este item.')
    return
  }

  const selectedRoute = isRouteCreate.value ? routeDraft.value : null
  if (isRouteCreate.value && !selectedRoute) {
    toastStore.warning('Ubicación incompleta', 'Escriba el nombre del lugar y seleccione el país antes de guardar.')
    return
  }
  const name = (selectedRoute?.name ?? form.value.name).trim()
  if (!name) {
    toastStore.warning('Nombre requerido', 'Escriba el nombre del ítem.')
    return
  }

  if (isAgentGroup.value && !selectedAgentCountries.value.length) {
    toastStore.warning('País requerido', 'Seleccione el país que corresponde a este agente.')
    return
  }

  const isGeneric = isWarehouseGroup.value && genericWarehouse.value
  // A generic WHS carries no street address, geocoding, city, photos or contacts.
  const value = isGeneric ? name : (selectedRoute?.value ?? form.value.value) || null
  const metadataJsonForSave = isGeneric ? JSON.stringify({ isGeneric: true }) : (selectedRoute?.metadataJson ?? form.value.metadataJson)

  try {
    loading.value = true

    if (props.item) {
      const metadataJson = isGeneric
        ? metadataJsonForSave
        : await uploadWarehouseImages(props.item.id, metadataJsonForSave)

      await CatalogItemsService.update(props.item.id, {
        name,
        description: isGeneric ? null : form.value.description || null,
        value,
        metadataJson,
        sortOrder: form.value.sortOrder,
      })

      form.value.metadataJson = metadataJson
      clearPendingWarehouseImages()
      toastStore.success('Guardado', t('catalogs.itemSaved'))
      await props.onSaved?.()
      drawerStore.close()
      return
    }

    const createdId = await CatalogItemsService.createForGroup(props.group.id, {
      name,
      slug: isGeneric ? null : (selectedRoute?.slug ?? form.value.slug) || null,
      description: isGeneric ? null : (selectedRoute?.description ?? form.value.description) || null,
      value,
      metadataJson: metadataJsonForSave,
      sortOrder: form.value.sortOrder,
      isSystem: isGeneric ? false : form.value.isSystem,
    })

    const metadataJson = isGeneric
      ? metadataJsonForSave
      : await uploadWarehouseImages(createdId, metadataJsonForSave)
    if (metadataJson !== metadataJsonForSave) {
      await CatalogItemsService.update(createdId, {
        name,
        description: isGeneric ? null : form.value.description || null,
        value,
        metadataJson,
        sortOrder: form.value.sortOrder,
      })
    }

    toastStore.success('Guardado', 'Item creado correctamente. Puede agregar otro.')
    await props.onSaved?.()
    resetCreateForm()
  } catch (error) {
    toastStore.backendError(error, t('catalogs.saveItemError'))
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(clearPendingWarehouseImages)
</script>

<template>
  <form :class="isRouteCreate ? 'space-y-8' : 'space-y-5'" @submit.prevent="save">
    <div v-if="!isRouteCreate" class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
        {{ t('catalogs.group') }}
      </p>

      <p class="mt-1 text-sm font-black text-[var(--dh-text)]">
        {{ group.name }}
      </p>

      <p class="mt-1 text-xs font-bold text-[var(--dh-primary)]">
        {{ group.slug }}
      </p>
    </div>

    <CatalogRouteLocationPicker
      v-if="isRouteCreate"
      :key="routeFormVersion"
      v-model="routeDraft"
      :catalog-slug="routeCatalogSlug"
      :disabled="!canSave || loading"
    />

    <template v-else>
    <section v-if="isWarehouseGroup" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <DhSwitch v-model="genericWarehouse" label="WHS genérico: solo nombre" :disabled="!canSave" />
      <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
        Al activarlo, escriba únicamente el país o nombre (ej. Alemania). Dirección, coordenadas, ciudad y demás datos no son necesarios.
      </p>
    </section>

    <div class="grid gap-4 md:grid-cols-2">
      <DhInput
        v-model="form.name"
        :label="t('common.name')"
        :placeholder="t('catalogs.itemNamePlaceholder')"
        :disabled="!canSave"
        :class="isWarehouseGroup && genericWarehouse ? 'md:col-span-2' : ''"
      />

      <template v-if="!isWarehouseGroup || !genericWarehouse">
      <DhInput
        v-if="!isEdit"
        v-model="form.slug"
        :label="t('common.slug')"
        :placeholder="t('catalogs.itemSlugPlaceholder')"
        :disabled="!canSave"
      />

      <DhInput
        v-model="form.value"
        :label="t('common.value')"
        :placeholder="t('catalogs.itemValuePlaceholder')"
        :disabled="!canSave"
      />

      <label class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">
          {{ t('common.order') }}
        </span>

        <input
          v-model.number="form.sortOrder"
          type="number"
          min="1"
          class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!canSave"
        />
      </label>

      <DhInput
        v-model="form.description"
        :label="t('common.description')"
        :placeholder="t('catalogs.itemDescriptionPlaceholder')"
        :disabled="!canSave"
        class="md:col-span-2"
      />

      <DhSwitch v-if="!isEdit" v-model="form.isSystem" :label="t('catalogs.systemItem')" />
      </template>
    </div>

    <section
      v-if="isWarehouseGroup && !genericWarehouse"
      class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
    >
      <div class="space-y-4">
        <div>
          <p class="text-sm font-black text-[var(--dh-text)]">Imágenes del WHS</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Puede cargar varias fotos JPG, PNG o WEBP de hasta 5 MB cada una. La primera imagen queda como portada y todas se conservan en el carrusel del WHS.
          </p>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]"
        >
          <div class="aspect-[16/9] w-full">
            <img
              v-if="activeWarehouseImage?.previewUrl"
              :src="activeWarehouseImage.previewUrl"
              :alt="`Vista previa de ${form.name || 'WHS'}`"
              class="h-full w-full object-cover"
            />
            <DhStorageImage
              v-else-if="activeWarehouseImage?.storageId"
              :file-id="activeWarehouseImage.storageId"
              :alt="`Imagen de ${form.name || 'WHS'}`"
              class="h-full w-full"
            />
            <div
              v-else
              class="grid h-full w-full place-items-center px-4 text-center text-xs font-bold text-[var(--dh-text-muted)]"
            >
              Sin imágenes. Puede seleccionar varias fotografías del WHS.
            </div>
          </div>

          <template v-if="warehouseCarouselImages.length > 1">
            <button
              type="button"
              aria-label="Imagen anterior"
              class="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/45 text-xl font-black text-white shadow-lg backdrop-blur transition hover:bg-black/65"
              @click="previousWarehouseImage"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Imagen siguiente"
              class="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/45 text-xl font-black text-white shadow-lg backdrop-blur transition hover:bg-black/65"
              @click="nextWarehouseImage"
            >
              ›
            </button>
            <span
              class="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur"
            >
              {{ warehouseCarouselIndex + 1 }} / {{ warehouseCarouselImages.length }}
            </span>
          </template>
        </div>

        <div v-if="warehouseCarouselImages.length > 1" class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="(image, index) in warehouseCarouselImages"
            :key="image.key"
            type="button"
            class="h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[var(--dh-input)] transition"
            :class="index === warehouseCarouselIndex ? 'border-[var(--dh-primary)]' : 'border-[var(--dh-border)] opacity-75 hover:opacity-100'"
            :aria-label="`Ver imagen ${index + 1}`"
            @click="selectWarehouseCarouselImage(index)"
          >
            <img
              v-if="image.previewUrl"
              :src="image.previewUrl"
              alt=""
              class="h-full w-full object-cover"
            />
            <DhStorageImage
              v-else-if="image.storageId"
              :file-id="image.storageId"
              alt=""
              class="h-full w-full"
            />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <label
            class="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-xs font-black text-[var(--dh-text)] transition hover:border-[var(--dh-primary)]"
            :class="!canSave ? 'pointer-events-none opacity-60' : ''"
          >
            {{ warehouseCarouselImages.length ? 'Agregar más imágenes' : 'Cargar imágenes' }}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              class="hidden"
              :disabled="!canSave"
              @change="selectWarehouseImages"
            />
          </label>

          <DhButton
            v-if="activeWarehouseImage?.pendingId"
            type="button"
            label="Quitar imagen seleccionada"
            variant="ghost"
            size="sm"
            @click="removePendingWarehouseImage(activeWarehouseImage.pendingId)"
          />

          <span
            v-if="warehouseCarouselImages.length"
            class="text-xs font-bold text-[var(--dh-text-muted)]"
          >
            {{ warehouseStoredImages.length }} guardada(s) · {{ pendingWarehouseImages.length }} nueva(s)
          </span>
        </div>

        <p
          v-if="activeWarehouseImage?.fileName"
          class="truncate text-xs font-bold text-[var(--dh-primary)]"
        >
          {{ activeWarehouseImage.fileName }}
        </p>
      </div>
    </section>

    <section v-if="isAgentGroup" class="space-y-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Países del agente *</span>
        <span class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ selectedAgentCountries.length }} seleccionados</span>
      </div>
      <div v-if="selectedAgentCountries.length" class="flex flex-wrap gap-2">
        <span
          v-for="country in selectedAgentCountries"
          :key="normalizedCountry(country)"
          class="inline-flex items-center gap-2 rounded-full border border-[var(--dh-border)] bg-[var(--dh-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--dh-text)]"
        >
          {{ country }}
          <button
            type="button"
            class="text-[var(--dh-primary)] hover:opacity-70 disabled:opacity-40"
            :aria-label="'Quitar ' + country"
            :disabled="!canSave"
            @click="toggleAgentCountry(country)"
          >×</button>
        </span>
      </div>
      <DhInput
        v-model="agentCountrySearch"
        label="Buscar y seleccionar países"
        placeholder="Buscar país (ej. China, Brasil, India)"
        :disabled="!canSave"
      />
      <div class="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2">
        <label
          v-for="country in filteredAgentCountryOptions"
          :key="normalizedCountry(country.name)"
          class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--dh-text)] hover:bg-[var(--dh-primary-soft)]"
        >
          <input
            type="checkbox"
            class="h-4 w-4 accent-[var(--dh-primary)]"
            :checked="agentCountrySelected(country.name)"
            :disabled="!canSave"
            @change="toggleAgentCountry(country.name)"
          />
          <span>{{ country.name }}</span>
          <span v-if="country.code" class="ml-auto text-xs text-[var(--dh-text-muted)]">{{ country.code }}</span>
        </label>
        <p v-if="!filteredAgentCountryOptions.length" class="p-2 text-xs text-[var(--dh-text-muted)]">
          No hay países que coincidan con la búsqueda.
        </p>
      </div>
      <button
        v-if="canAddCustomCountry"
        type="button"
        class="text-left text-sm font-bold text-[var(--dh-primary)] disabled:opacity-50"
        :disabled="!canSave"
        @click="addCustomAgentCountry"
      >+ Agregar país «{{ agentCountrySearch.trim() }}»</button>
      <p class="text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
        Seleccione todos los países donde opera el agente. Se guardan en metadata.countries y se comparan con el país del POL en Pricing.
      </p>
    </section>

    <MetadataEditor v-if="!isWarehouseGroup || !genericWarehouse" v-model="form.metadataJson" />
    </template>

    <div class="flex flex-wrap items-center justify-end gap-3" :class="isRouteCreate ? 'border-t border-[var(--dh-border)] pt-6' : ''">
      <DhButton
        type="button"
        :label="t('common.close')"
        variant="secondary"
        @click="drawerStore.close()"
      />

      <DhButton
        type="submit"
        :label="isEdit ? t('common.save') : isRouteCreate ? 'Agregar ubicación' : 'Guardar y agregar otro'"
        :loading="loading"
        :disabled="!canSave || loading || (isRouteCreate && !routeDraft)"
      />
    </div>
  </form>
</template>
