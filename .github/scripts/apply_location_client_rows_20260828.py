from pathlib import Path

wizard_path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = wizard_path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'{label} not found')
    text = text.replace(old, new, 1)


replace_once(
    "import PricingCrystalMultiSelect from '@/modules/pricing/components/PricingCrystalMultiSelect.vue'\nimport PricingInteractiveOsmMap from '@/modules/pricing/components/PricingInteractiveOsmMap.vue'",
    "import PricingCrystalMultiSelect from '@/modules/pricing/components/PricingCrystalMultiSelect.vue'\nimport PricingInteractiveOsmMap from '@/modules/pricing/components/PricingInteractiveOsmMap.vue'\nimport PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'",
    'location search component import',
)

old_route_grid = '''          <div class="crystal-soft grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">
            <DhInput v-model="form.executiveName" label="Ejecutivo de venta" placeholder="Escriba el nombre del ejecutivo" autocomplete="off" />
            <DhInput v-model="form.clientName" label="Nombre del cliente" placeholder="Escriba el nombre del cliente" />
            <DhSelect v-model="form.originId" label="Origen" placeholder="Seleccione origen" :options="originOptions" />
            <DhSelect v-model="form.destinationId" label="Destino (POE)" placeholder="Seleccione POE" :options="destinationOptions" />
            <DhSelect v-model="form.podId" label="POD (opcional)" placeholder="Seleccione POD si aplica" :options="podOptions" />

            <DhSelect
              v-if="equipmentHasSizes"
              v-model="form.equipmentSize"
              :label="form.modality === 'Land' ? 'Tamaño de furgón' : 'Tamaño'"
              :placeholder="form.modality === 'Land' ? 'Seleccione tamaño de furgón' : 'Seleccione tamaño'"
              :options="equipmentSizeOptions"
            />
            <DhSelect
              v-model="form.equipmentType"
              :label="form.modality === 'Land' ? 'Furgón / equipo terrestre' : equipmentHasSizes ? 'Tipo' : 'Tipo de equipo'"
              :placeholder="form.modality === 'Land' ? 'Seleccione furgón' : equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'"
              :disabled="equipmentHasSizes && !form.equipmentSize"
              :options="equipmentTypeOptions"
            />

            <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" :label="form.modality === 'Land' ? 'Cantidad de unidades' : 'Cantidad'" />
            <DhSelect v-model="form.incotermId" label="Incoterm" placeholder="Seleccione Incoterm" :options="incotermOptions" />
            <DhInput v-model="form.loadDate" type="date" label="Fecha de carga" />

            <div class="md:col-span-2 xl:col-span-3">
              <PricingCrystalMultiSelect
                v-model="form.serviceIds"
                label="Servicios"
                placeholder="Seleccione servicios"
                search-placeholder="Buscar servicio..."
                :options="serviceOptions"
              />
            </div>
          </div>'''

new_route_grid = '''          <div class="crystal-soft space-y-5 p-4 md:p-5">
            <!-- Fila 1: se mantienen editables hasta que el maestro de clientes/ejecutivos se cierre. -->
            <div class="grid gap-4 md:grid-cols-2">
              <DhInput v-model="form.clientName" label="Nombre del cliente" placeholder="Escriba el nombre del cliente" autocomplete="off" />
              <DhInput v-model="form.executiveName" label="Ejecutivo comercial" placeholder="Escriba el nombre del ejecutivo" autocomplete="off" />
            </div>

            <!-- Fila 2: buscadores de ubicación estilo freight search. CY = Container Yard; SD = Store Door. -->
            <div class="grid gap-4 md:grid-cols-3">
              <PricingLocationSearchSelect
                v-model="form.originId"
                label="Origen (POL)"
                placeholder="Buscar puerto de origen"
                search-placeholder="Buscar puerto, ciudad o país…"
                terminal-type="CY"
                :options="originOptions"
              />
              <PricingLocationSearchSelect
                v-model="form.destinationId"
                label="Destino (POE)"
                placeholder="Buscar puerto de salida"
                search-placeholder="Buscar puerto, ciudad o país…"
                terminal-type="CY"
                :options="destinationOptions"
              />
              <PricingLocationSearchSelect
                v-model="form.podId"
                label="POD"
                placeholder="Buscar destino final"
                search-placeholder="Buscar destino, ciudad o región…"
                terminal-type="SD"
                :optional="true"
                :options="podOptions"
              />
            </div>

            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->
            <div class="grid gap-4 md:grid-cols-3">
              <DhSelect
                v-if="equipmentHasSizes"
                v-model="form.equipmentSize"
                :label="form.modality === 'Land' ? 'Tamaño de furgón' : 'Tamaño de equipo'"
                :placeholder="form.modality === 'Land' ? 'Seleccione tamaño de furgón' : 'Seleccione tamaño'"
                :options="equipmentSizeOptions"
              />
              <DhSelect
                v-model="form.equipmentType"
                :label="form.modality === 'Land' ? 'Tipo de furgón' : equipmentHasSizes ? 'Tipo de equipo' : 'Tipo de equipo'"
                :placeholder="form.modality === 'Land' ? 'Seleccione furgón' : equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'"
                :disabled="equipmentHasSizes && !form.equipmentSize"
                :options="equipmentTypeOptions"
              />
              <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" :label="form.modality === 'Land' ? 'Cantidad de unidades' : 'Cantidad de equipo'" />
            </div>

            <!-- Fila 4: Incoterm y fecha de carga lista. -->
            <div class="grid gap-4 md:grid-cols-2">
              <DhSelect v-model="form.incotermId" label="Incoterm" placeholder="Seleccione Incoterm" :options="incotermOptions" />
              <DhInput v-model="form.loadDate" type="date" label="Fecha carga lista" />
            </div>

            <PricingCrystalMultiSelect
              v-model="form.serviceIds"
              label="Servicios"
              placeholder="Seleccione servicios"
              search-placeholder="Buscar servicio..."
              :options="serviceOptions"
            />
          </div>'''
replace_once(old_route_grid, new_route_grid, 'step 3 requested rows')

replace_once(
    "      clientName: form.clientName.trim() || null,\n      freeDays: number(form.freeDays),",
    "      clientName: form.clientName.trim() || null,\n      executiveName: form.executiveName.trim() || null,\n      freeDays: number(form.freeDays),",
    'executive create payload',
)

replace_once(
    "    clientName: '',\n    pickupAddress: '',",
    "    clientName: '',\n    executiveName: '',\n    pickupAddress: '',",
    'executive reset',
)

wizard_path.write_text(text, encoding='utf-8')

interfaces_path = Path('src/core/interfaces/pricing.ts')
interfaces = interfaces_path.read_text(encoding='utf-8')

if 'executiveName?: string | null' not in interfaces:
    marker = '  clientName?: string | null\n'
    count = interfaces.count(marker)
    if count < 2:
        raise SystemExit(f'expected at least two clientName markers, found {count}')
    interfaces = interfaces.replace(marker, marker + '  executiveName?: string | null\n')

create_marker = '  incotermCode?: string | null\n'
create_section = interfaces.find('export interface CreateRateRequest')
if create_section < 0:
    raise SystemExit('CreateRateRequest not found')
create_end = interfaces.find('\n}', create_section)
chunk = interfaces[create_section:create_end]
if 'pickupAddress?: string | null' not in chunk:
    position = interfaces.find(create_marker, create_section, create_end)
    if position < 0:
        raise SystemExit('CreateRateRequest incoterm marker not found')
    position += len(create_marker)
    addition = '  pickupAddress?: string | null\n  pickupLatitude?: number | null\n  pickupLongitude?: number | null\n'
    interfaces = interfaces[:position] + addition + interfaces[position:]

interfaces_path.write_text(interfaces, encoding='utf-8')
print('Requested DholeWeb location/client rows patch applied.')
