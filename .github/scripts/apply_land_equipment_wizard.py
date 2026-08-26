from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text()


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    "  containers: [] as CatalogItemSelectDto[],\n  agents: [] as CatalogItemSelectDto[],",
    "  containers: [] as CatalogItemSelectDto[],\n  landEquipment: [] as CatalogItemSelectDto[],\n  agents: [] as CatalogItemSelectDto[],",
    'land catalog state',
)
replace_once(
    "  { value: 'Land', label: 'Terrestre', caption: 'FTL y FCL' },",
    "  { value: 'Land', label: 'Terrestre', caption: 'FTL y LTL' },",
    'land caption',
)
replace_once(
    "  Land: ['FTL', 'FCL'],",
    "  Land: ['FTL', 'LTL'],",
    'land shipment modes',
)

old_source = '''const equipmentSource = computed(() => {
  const modality = String(form.modality)
  if (!modality) return []
  return catalogs.containers.filter((item) => {
    const meta = metadata(item)
    if (meta?.modalities?.length) return meta.modalities.includes(modality)
    if (modality === 'Air') {
      const value = displayValue(item).toUpperCase()
      return ['LOOSE', 'PALLET', 'ULD'].some((kind) => value.includes(kind))
    }
    return modality !== 'Air'
  })
})'''
new_source = '''const equipmentSource = computed(() => {
  const modality = String(form.modality)
  if (!modality) return []

  if (modality === 'Land') {
    const shipmentMode = form.shipmentMode.toUpperCase()
    return catalogs.landEquipment.filter((item) => {
      const meta = metadata(item)
      if (meta?.modalities?.length && !meta.modalities.includes('Land')) return false
      if (meta?.shipmentModes?.length && shipmentMode) return meta.shipmentModes.includes(shipmentMode)
      return true
    })
  }

  return catalogs.containers.filter((item) => {
    const meta = metadata(item)
    if (meta?.modalities?.length) return meta.modalities.includes(modality)
    if (modality === 'Air') {
      const value = displayValue(item).toUpperCase()
      return ['LOOSE', 'PALLET', 'ULD'].some((kind) => value.includes(kind))
    }
    return modality !== 'Air'
  })
})'''
replace_once(old_source, new_source, 'equipment source')

replace_once(
    "const selectedEquipment = computed(() => findById(catalogs.containers, form.equipmentId))",
    "const selectedEquipment = computed(() => findById(equipmentSource.value, form.equipmentId))",
    'selected equipment source',
)

replace_once(
    '''function chooseShipmentMode(value: string) {
  form.shipmentMode = value
  step.value = 3
}''',
    '''function chooseShipmentMode(value: string) {
  form.shipmentMode = value
  form.equipmentSize = ''
  form.equipmentType = ''
  form.equipmentId = ''
  step.value = 3
}''',
    'shipment mode reset',
)

replace_once(
    '''    const [
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      agents,
      carriers,
      currencies,
      selectedCosts,
    ] = await Promise.all([''',
    '''    const [
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      landEquipment,
      agents,
      carriers,
      currencies,
      selectedCosts,
    ] = await Promise.all([''',
    'catalog destructure',
)
replace_once(
    '''      select('container-types'),
      select('agents'),''',
    '''      select('container-types'),
      select('land-equipment-types'),
      select('agents'),''',
    'catalog promise',
)
replace_once(
    '''    Object.assign(catalogs, {
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      agents,
      carriers,
      currencies,
    })''',
    '''    Object.assign(catalogs, {
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      landEquipment,
      agents,
      carriers,
      currencies,
    })''',
    'catalog assign',
)

replace_once(
    ''':label="equipmentHasSizes ? 'Tipo' : 'Tipo de equipo'"
              :placeholder="equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'"''',
    ''':label="form.modality === 'Land' ? 'Tipo de unidad / furgón' : equipmentHasSizes ? 'Tipo' : 'Tipo de equipo'"
              :placeholder="form.modality === 'Land' ? 'Seleccione unidad terrestre' : equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'"''',
    'terrestrial labels',
)
replace_once(
    'No existen tarifas vigentes para esa ruta y tamaño de equipo',
    'No existen tarifas vigentes para esa ruta y equipo',
    'empty rate text',
)

path.write_text(text)
