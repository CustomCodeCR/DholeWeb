from pathlib import Path
import re

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')
original = text


def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise RuntimeError(f'{label}: marker not found')
    text = text.replace(old, new, 1)

replace_once(
    "interface CatalogMetadata {\n  modalities?: string[]",
    "interface CatalogMetadata {\n  modality?: string\n  modalities?: string[]",
    'metadata modality',
)

replace_once(
    "  poe: [] as CatalogItemSelectDto[],\n  containers: [] as CatalogItemSelectDto[],",
    "  poe: [] as CatalogItemSelectDto[],\n  landEquipmentTypes: [] as CatalogItemSelectDto[],\n  landEquipmentSizes: [] as CatalogItemSelectDto[],\n  landEquipmentKinds: [] as CatalogItemSelectDto[],\n  containers: [] as CatalogItemSelectDto[],",
    'land catalogs state',
)

source_pattern = re.compile(
    r"const equipmentSource = computed\(\(\) => \{.*?\n\}\)\n\nconst equipmentHasSizes",
    re.S,
)
source_replacement = '''const equipmentSource = computed(() => {
  const modality = String(form.modality)
  if (!modality) return []

  if (modality === 'Land') {
    return catalogs.landEquipmentTypes.filter((item) => {
      const meta = metadata(item)
      if (meta?.modality && meta.modality.toLocaleLowerCase() !== 'land') return false

      if (meta?.shipmentModes?.length && form.shipmentMode) {
        const currentMode = form.shipmentMode.toUpperCase()
        return meta.shipmentModes.some(
          (value) => String(value).trim().toUpperCase() === currentMode,
        )
      }

      return true
    })
  }

  return catalogs.containers.filter((item) => {
    const meta = metadata(item)
    const normalizedModality = modality.toLocaleLowerCase()

    if (meta?.modalities?.length) {
      return meta.modalities.some(
        (value) => String(value).trim().toLocaleLowerCase() === normalizedModality,
      )
    }

    if (meta?.shipmentModes?.length && form.shipmentMode) {
      const currentMode = form.shipmentMode.toUpperCase()
      if (meta.shipmentModes.some((value) => String(value).trim().toUpperCase() === currentMode)) {
        return true
      }
    }

    if (modality === 'Air') {
      const value = displayValue(item).toUpperCase()
      return ['LOOSE', 'PALLET', 'ULD'].some((kind) => value.includes(kind))
    }

    return true
  })
})

const equipmentHasSizes'''
text, count = source_pattern.subn(source_replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'equipmentSource: expected 1 replacement, got {count}')

size_pattern = re.compile(
    r"const equipmentSizeOptions = computed\(\(\) => \{.*?\n\}\)\n\nconst equipmentTypeOptions",
    re.S,
)
size_replacement = '''const equipmentSizeOptions = computed(() => {
  const availableSizes = new Set(
    equipmentSource.value
      .map((item) => metadata(item)?.size?.trim())
      .filter((value): value is string => Boolean(value)),
  )

  if (form.modality === 'Land' && catalogs.landEquipmentSizes.length) {
    return catalogs.landEquipmentSizes
      .filter((item) => availableSizes.has(displayValue(item)))
      .map((item) => ({ value: displayValue(item), label: item.label || `${displayValue(item)} pies` }))
  }

  return [...availableSizes]
    .sort((a, b) => number(a) - number(b))
    .map((size) => ({ value: size, label: size }))
})

const equipmentTypeOptions'''
text, count = size_pattern.subn(size_replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'equipmentSizeOptions: expected 1 replacement, got {count}')

type_pattern = re.compile(
    r"const equipmentTypeOptions = computed\(\(\) => \{.*?\n\}\)\n\nconst selectedOrigin",
    re.S,
)
type_replacement = '''const equipmentTypeOptions = computed(() => {
  if (!equipmentHasSizes.value) {
    return equipmentSource.value.map((item) => ({ value: item.id, label: item.label || displayValue(item) }))
  }

  if (!form.equipmentSize) return []

  const availableKinds = new Set(
    equipmentSource.value
      .filter((item) => metadata(item)?.size === form.equipmentSize)
      .map((item) => metadata(item)?.kind?.trim())
      .filter((value): value is string => Boolean(value)),
  )

  if (form.modality === 'Land' && catalogs.landEquipmentKinds.length) {
    const configured = catalogs.landEquipmentKinds
      .filter((item) => availableKinds.has(item.slug))
      .map((item) => ({ value: item.slug, label: item.label || displayValue(item) }))

    if (configured.length) return configured
  }

  return [...availableKinds].map((kind) => ({
    value: kind,
    label: kindLabels[kind] ?? kind.replaceAll('-', ' '),
  }))
})

const selectedOrigin'''
text, count = type_pattern.subn(type_replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'equipmentTypeOptions: expected 1 replacement, got {count}')

replace_once(
    "      poe,\n      containers,\n      agents,",
    "      poe,\n      landEquipmentTypes,\n      landEquipmentSizes,\n      landEquipmentKinds,\n      containers,\n      agents,",
    'catalog destructuring',
)
replace_once(
    "      select('poe'),\n      select('container-types'),",
    "      select('poe'),\n      select('land-equipment-types'),\n      select('land-equipment-sizes'),\n      select('land-equipment-kinds'),\n      select('container-types'),",
    'catalog requests',
)

assignment_pattern = re.compile(
    r"(catalogs\.poe\s*=\s*poe\s*\n)(\s*catalogs\.containers\s*=\s*containers)",
)
text, count = assignment_pattern.subn(
    r"\1    catalogs.landEquipmentTypes = landEquipmentTypes\n    catalogs.landEquipmentSizes = landEquipmentSizes\n    catalogs.landEquipmentKinds = landEquipmentKinds\n\2",
    text,
    count=1,
)
if count != 1:
    raise RuntimeError(f'catalog assignments: expected 1 replacement, got {count}')

if text == original:
    raise RuntimeError('No changes applied')

path.write_text(text, encoding='utf-8')
print('Land equipment Config integration patch applied.')
