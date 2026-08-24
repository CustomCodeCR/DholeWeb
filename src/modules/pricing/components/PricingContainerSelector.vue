<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DhSelect } from '@/shared/components/atoms'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    excludedEquipmentIds?: string[]
    error?: string
  }>(),
  {
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

const hasDimensionCatalogs = computed(
  () => catalogs.containerSizes.value.length > 0 && catalogs.containerKinds.value.length > 0,
)

const sizeOptions = computed(() => catalogs.containerSizeOptions.value)
const kindOptions = computed(() =>
  catalogs.containerKindsForSize(sizeId.value).map((item) => ({
    label: item.name,
    value: item.id,
  })),
)

const legacyEquipmentOptions = computed(() => {
  const excluded = new Set(props.excludedEquipmentIds)
  return catalogs.containerOptions.value.filter(
    (option) => option.value === props.modelValue || !excluded.has(option.value),
  )
})

const selectedEquipment = computed(() =>
  catalogs.findById(catalogs.containerTypes.value, props.modelValue),
)

function hydrateFromEquipment() {
  if (!hasDimensionCatalogs.value || !props.modelValue) {
    if (!props.modelValue) {
      sizeId.value = ''
      kindId.value = ''
    }
    return
  }

  const split = catalogs.splitContainerEquipment(props.modelValue)
  hydrating = true
  sizeId.value = split.size?.id ?? ''
  kindId.value = split.kind?.id ?? ''
  hydrating = false
}

watch(
  () => props.modelValue,
  hydrateFromEquipment,
  { immediate: true },
)

watch(
  () => [catalogs.containerSizes.value.length, catalogs.containerKinds.value.length, catalogs.containerTypes.value.length],
  hydrateFromEquipment,
)

watch(sizeId, () => {
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

  const equipment = catalogs.resolveContainerEquipment(sizeId.value, kindId.value)
  if (!equipment) {
    if (props.modelValue) emit('update:modelValue', '')
    return
  }

  const excluded = new Set(props.excludedEquipmentIds)
  if (excluded.has(equipment.id) && equipment.id !== props.modelValue) return
  if (equipment.id !== props.modelValue) emit('update:modelValue', equipment.id)
})
</script>

<template>
  <div v-if="hasDimensionCatalogs" class="grid gap-3 sm:grid-cols-2">
    <DhSelect
      v-model="sizeId"
      :disabled="disabled"
      label="Tamaño"
      placeholder="20, 40, 45..."
      :options="sizeOptions"
    />
    <DhSelect
      v-model="kindId"
      :disabled="disabled || !sizeId"
      label="Tipo"
      placeholder="Dry Van, High Cube..."
      :options="kindOptions"
    />
    <p v-if="selectedEquipment" class="-mt-1 text-xs text-slate-500 sm:col-span-2">
      Equipo: <strong>{{ selectedEquipment.name }}</strong>
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
    label="Tipo de contenedor"
    placeholder="Seleccione contenedor"
    :options="legacyEquipmentOptions"
    :error="error"
    @update:model-value="emit('update:modelValue', String($event ?? ''))"
  />
</template>
