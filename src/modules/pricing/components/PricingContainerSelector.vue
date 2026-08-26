<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DhSelect } from '@/shared/components/atoms'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

const props = withDefaults(
  defineProps<{
    modelValue: string
    transport?: 'maritime' | 'land'
    disabled?: boolean
    excludedEquipmentIds?: string[]
    error?: string
  }>(),
  {
    transport: 'maritime',
    disabled: false,
    excludedEquipmentIds: () => [],
    error: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const catalogs = usePricingCatalogs()
const sizeId = ref('')
const kindId = ref('')
let hydrating = false

const isLand = computed(() => props.transport === 'land')
const equipmentItems = computed(() =>
  isLand.value ? catalogs.landEquipmentTypes.value : catalogs.containerTypes.value,
)
const sizeItems = computed(() =>
  isLand.value ? catalogs.landEquipmentSizes.value : catalogs.containerSizes.value,
)
const kindItems = computed(() =>
  isLand.value ? catalogs.landEquipmentKinds.value : catalogs.containerKinds.value,
)

const hasDimensionCatalogs = computed(
  () => sizeItems.value.length > 0 && kindItems.value.length > 0 && equipmentItems.value.length > 0,
)

const sizeOptions = computed(() =>
  isLand.value ? catalogs.landEquipmentSizeOptions.value : catalogs.containerSizeOptions.value,
)
const kindOptions = computed(() => {
  const excluded = new Set(props.excludedEquipmentIds)
  const kinds = isLand.value
    ? catalogs.landEquipmentKindsForSize(sizeId.value)
    : catalogs.containerKindsForSize(sizeId.value)

  return kinds
    .filter((kind) => {
      const equipment = isLand.value
        ? catalogs.resolveLandEquipment(sizeId.value, kind.id)
        : catalogs.resolveContainerEquipment(sizeId.value, kind.id)
      if (!equipment) return false
      return equipment.id === props.modelValue || !excluded.has(equipment.id)
    })
    .map((item) => ({
      label: item.name,
      value: item.id,
    }))
})

const legacyEquipmentOptions = computed(() => {
  const excluded = new Set(props.excludedEquipmentIds)
  const source = isLand.value ? catalogs.landEquipmentOptions.value : catalogs.containerOptions.value
  return source.filter(
    (option) => option.value === props.modelValue || !excluded.has(option.value),
  )
})

const selectedEquipment = computed(() => catalogs.findById(equipmentItems.value, props.modelValue))

function hydrateFromEquipment() {
  if (!hasDimensionCatalogs.value || !props.modelValue) {
    if (!props.modelValue) {
      sizeId.value = ''
      kindId.value = ''
    }
    return
  }

  const split = isLand.value
    ? catalogs.splitLandEquipment(props.modelValue)
    : catalogs.splitContainerEquipment(props.modelValue)
  hydrating = true
  sizeId.value = split.size?.id ?? ''
  kindId.value = split.kind?.id ?? ''
  hydrating = false
}

watch(
  () => [props.modelValue, props.transport],
  hydrateFromEquipment,
  { immediate: true },
)

watch(
  () => [sizeItems.value.length, kindItems.value.length, equipmentItems.value.length],
  hydrateFromEquipment,
)

watch([sizeId, () => props.excludedEquipmentIds], () => {
  if (hydrating) return
  if (kindId.value && !kindOptions.value.some((option) => option.value === kindId.value)) {
    kindId.value = ''
  }
})

watch([sizeId, kindId], () => {
  if (hydrating || !hasDimensionCatalogs.value) return

  if (!sizeId.value || !kindId.value) {
    if (props.modelValue) emit('update:modelValue', '')
    return
  }

  const equipment = isLand.value
    ? catalogs.resolveLandEquipment(sizeId.value, kindId.value)
    : catalogs.resolveContainerEquipment(sizeId.value, kindId.value)
  if (!equipment) {
    if (props.modelValue) emit('update:modelValue', '')
    return
  }

  const excluded = new Set(props.excludedEquipmentIds)
  if (excluded.has(equipment.id) && equipment.id !== props.modelValue) {
    kindId.value = ''
    if (props.modelValue) emit('update:modelValue', '')
    return
  }

  if (equipment.id !== props.modelValue) emit('update:modelValue', equipment.id)
})
</script>

<template>
  <div v-if="hasDimensionCatalogs" class="grid gap-3 sm:grid-cols-2">
    <DhSelect
      v-model="sizeId"
      :disabled="disabled"
      label="Tamaño"
      :placeholder="isLand ? '48, 53...' : '20, 40, 45...'"
      :options="sizeOptions"
    />
    <DhSelect
      v-model="kindId"
      :disabled="disabled || !sizeId"
      :label="isLand ? 'Tipo de equipo' : 'Tipo'"
      :placeholder="isLand ? 'Furgón seco, refrigerado...' : 'Dry Van, High Cube...'"
      :options="kindOptions"
    />
    <p v-if="selectedEquipment" class="-mt-1 text-xs text-slate-500 sm:col-span-2">
      {{ isLand ? 'Equipo terrestre' : 'Equipo' }}:
      <strong>{{ selectedEquipment.name }}</strong>
      <span v-if="selectedEquipment.code"> ({{ selectedEquipment.code }})</span>
    </p>
    <p v-if="error" class="-mt-1 text-xs font-semibold text-red-500 sm:col-span-2">
      {{ error }}
    </p>
  </div>

  <DhSelect
    v-else
    :model-value="modelValue"
    :disabled="disabled"
    :label="isLand ? 'Tipo de equipo terrestre' : 'Tipo de contenedor'"
    :placeholder="isLand ? 'Seleccione equipo terrestre' : 'Seleccione contenedor'"
    :options="legacyEquipmentOptions"
    :error="error"
    @update:model-value="emit('update:modelValue', String($event ?? ''))"
  />
</template>
