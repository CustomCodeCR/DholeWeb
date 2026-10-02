import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-miami-lcl-rules-20261002'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingMiamiLclRules20261002] ${label}: expected 1 anchor, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function insertMiamiFormState(source: string) {
  if (source.includes("miamiCommercialPlan: 'A'")) return source

  const pattern = /^(\s*)carrierHaulage:\s*false,/gm
  const matches = [...source.matchAll(pattern)]
  if (matches.length < 2) {
    throw new Error(
      `[pricingMiamiLclRules20261002] Miami form state: expected at least 2 carrierHaulage anchors, found ${matches.length}.`,
    )
  }

  return source.replace(pattern, (_match, indent: string) => [
    `${indent}carrierHaulage: false,`,
    `${indent}miamiCommercialPlan: 'A',`,
    `${indent}miamiWhsQty: 1,`,
    `${indent}miamiIncludeSed: true,`,
    `${indent}miamiSedQty: 1,`,
    `${indent}miamiBonded: false,`,
  ].join('\n'))
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = source

  code = insertMiamiFormState(code)

  code = replaceRequired(
    code,
    `const CFT_PER_CBM = 35.31466672148859
const INCH_TO_CM = 2.54`,
    `const CFT_PER_CBM = 35.31466672148859
const MIAMI_KG_PER_CFT = 14.16
const MIAMI_LB_PER_KG = 2.20462262
const INCH_TO_CM = 2.54

interface MiamiCommercialRateUi {
  label: string
  salePerCft: number
  minimumFreightSale: number
  sed: number
  handling: number
  vgm: number
  tica: number
  seal: number
  documentation: number
  forwarding: number
  insurancePct: number
  insuranceMinimum: number
  little?: boolean
}

const MIAMI_COMMERCIAL_RATES: Record<string, MiamiCommercialRateUi> = {
  A: { label: 'Cliente A', salePerCft: 2.80, minimumFreightSale: 280, sed: 25, handling: 45, vgm: 20, tica: 25, seal: 20, documentation: 25, forwarding: 0, insurancePct: 0.75, insuranceMinimum: 50 },
  B: { label: 'Cliente B', salePerCft: 2.95, minimumFreightSale: 295, sed: 28, handling: 55, vgm: 25, tica: 25, seal: 30, documentation: 45, forwarding: 0, insurancePct: 0.80, insuranceMinimum: 60 },
  C: { label: 'Cliente C', salePerCft: 3.00, minimumFreightSale: 300, sed: 30, handling: 65, vgm: 25, tica: 25, seal: 35, documentation: 50, forwarding: 0, insurancePct: 0.80, insuranceMinimum: 60 },
  D: { label: 'Cliente D', salePerCft: 2.92, minimumFreightSale: 292, sed: 35, handling: 55, vgm: 45, tica: 30, seal: 35, documentation: 50, forwarding: 65, insurancePct: 0.80, insuranceMinimum: 60 },
  'NVOCC-B': { label: 'Cliente NVOCC-B', salePerCft: 2.90, minimumFreightSale: 170, sed: 25, handling: 45, vgm: 20, tica: 0, seal: 20, documentation: 0, forwarding: 0, insurancePct: 0.50, insuranceMinimum: 50 },
  'NVOCC-A': { label: 'Cliente NVOCC-A', salePerCft: 2.60, minimumFreightSale: 95, sed: 25, handling: 60, vgm: 0, tica: 0, seal: 25, documentation: 25, forwarding: 0, insurancePct: 0.50, insuranceMinimum: 50 },
  LITTLE: { label: 'CARGAS LITTLE', salePerCft: 0, minimumFreightSale: 0, sed: 0, handling: 35, vgm: 15, tica: 0, seal: 0, documentation: 20, forwarding: 0, insurancePct: 0.50, insuranceMinimum: 10, little: true },
}

const miamiCommercialPlanOptions = [
  { value: 'A', label: 'Cliente A' },
  { value: 'B', label: 'Cliente B' },
  { value: 'C', label: 'Cliente C' },
  { value: 'D', label: 'Cliente D' },
  { value: 'NVOCC-B', label: 'Cliente NVOCC-B' },
  { value: 'NVOCC-A', label: 'Cliente NVOCC-A' },
  { value: 'LITTLE', label: 'CARGAS LITTLE' },
]`,
    'Miami rate constants',
  )

  code = replaceRequired(
    code,
    `const cargoVolumeUnit = computed(() => isUnitedStatesPol.value ? 'CFT' : 'CBM')`,
    `const isMiamiLcl = computed(() => {
  if (shipmentModeForApi.value !== 'Lcl') return false
  const origin = selectedOrigin.value
  const values = [
    String(origin?.code ?? ''),
    String(origin?.label ?? ''),
    String(origin?.value ?? ''),
    displayValue(origin),
  ].map((value) => normalizeCatalogValue(value).replace(/[^a-z0-9]/g, ''))
  return values.some((value) => value === 'mia' || value === 'usmia' || value.includes('miami'))
})

const miamiCommercialRate = computed(() =>
  MIAMI_COMMERCIAL_RATES[String(form.miamiCommercialPlan || 'A')] ?? MIAMI_COMMERCIAL_RATES.A,
)

function miamiKgToLb(value: number) {
  return Math.max(0, number(value)) * MIAMI_LB_PER_KG
}

function setMiamiWeightLb(line: ConsolidatedCargoLineUi, value: unknown) {
  line.weightKg = Math.max(0, number(value)) / MIAMI_LB_PER_KG
}

function miamiDimensionCm(value: number) {
  return Math.max(0, number(value)) * INCH_TO_CM
}

const cargoVolumeUnit = computed(() => isUnitedStatesPol.value ? 'CFT' : 'CBM')`,
    'Miami origin resolver',
  )

  code = replaceRequired(
    code,
    `const lclWeightCbm = computed(() =>
  consolidatedTotalWeightKg.value / Math.max(1, consolidatedKgPerCbm.value),
)
const lclChargeableCbm = computed(() => {
  const calculated = Math.max(lclDimensionalCbm.value, lclWeightCbm.value)
  return calculated > 0 ? Math.max(1, calculated) : 0
})`,
    `const miamiWeightCft = computed(() =>
  consolidatedTotalWeightKg.value / MIAMI_KG_PER_CFT,
)
const lclWeightCbm = computed(() =>
  isMiamiLcl.value
    ? miamiWeightCft.value / CFT_PER_CBM
    : consolidatedTotalWeightKg.value / Math.max(1, consolidatedKgPerCbm.value),
)
const lclChargeableCbm = computed(() => {
  const calculated = Math.max(lclDimensionalCbm.value, lclWeightCbm.value)
  if (calculated <= 0) return 0
  // Miami aplica mínimo monetario por tarifa comercial; no fuerza 1 CBM.
  if (isMiamiLcl.value) return calculated
  return Math.max(1, calculated)
})
const miamiPhysicalCft = computed(() => lclPhysicalCbm.value * CFT_PER_CBM)
const miamiDimensionalCft = computed(() => lclDimensionalCbm.value * CFT_PER_CBM)
const miamiChargeableCft = computed(() => lclChargeableCbm.value * CFT_PER_CBM)
const miamiFreightCalculated = computed(() =>
  miamiChargeableCft.value * miamiCommercialRate.value.salePerCft,
)
const miamiFreightSale = computed(() => {
  const rate = miamiCommercialRate.value
  if (rate.little) {
    if (miamiChargeableCft.value <= 0) return 0
    if (miamiChargeableCft.value <= 30) return 30
    if (miamiChargeableCft.value <= 60) return 40
    if (miamiChargeableCft.value <= 80) return 50
    return 0
  }
  return Math.max(miamiFreightCalculated.value, rate.minimumFreightSale)
})
const miamiInsuranceSale = computed(() => {
  const cargoValue = Math.max(0, number(form.cargoValue))
  if (cargoValue <= 0) return 0
  const rate = miamiCommercialRate.value
  return Math.max(cargoValue * rate.insurancePct / 100, rate.insuranceMinimum)
})
const miamiFakSale = computed(() => {
  const rate = miamiCommercialRate.value
  const sed = form.miamiIncludeSed
    ? rate.sed * Math.max(1, Math.trunc(number(form.miamiSedQty)))
    : 0
  return sed + rate.handling + rate.vgm + rate.tica + rate.seal + rate.documentation + rate.forwarding
})
const miamiLittleIssues = computed(() => {
  if (!isMiamiLcl.value || !miamiCommercialRate.value.little) return [] as string[]
  const issues: string[] = []
  if (consolidatedTotalWeightKg.value > 100) issues.push('Peso mayor a 100 kg')
  if (miamiChargeableCft.value > 80) issues.push('Volumen mayor a 80 CFT')
  if (number(form.cargoValue) > 1000) issues.push('Valor de carga mayor a USD 1,000')
  if (form.dangerousCargo) issues.push('Carga IMO')
  if (form.miamiBonded) issues.push('Carga Bonded')
  if (Math.max(1, Math.trunc(number(form.miamiWhsQty))) > 3) issues.push('Más de 3 WHS')
  return issues
})`,
    'Miami CFT chargeable calculation',
  )

  code = replaceRequired(
    code,
    `                    {{ isUnitedStatesPol
                      ? 'POL Estados Unidos: capture dimensiones en pulgadas y el volumen comercial se trabaja en CFT.'
                      : 'Capture dimensiones en centímetros y el volumen comercial se trabaja en CBM.' }}
                    Se compara contra {{ shipmentModeForApi === 'Ltl' ? 'peso/330' : 'peso/500' }}.`,
    `                    {{ isMiamiLcl
                      ? 'Miami: capture dimensiones en pulgadas y peso en libras. Dhole convierte cada valor a centímetros y kilogramos antes de calcular.'
                      : isUnitedStatesPol
                        ? 'POL Estados Unidos: capture dimensiones en pulgadas y el volumen comercial se trabaja en CFT.'
                        : 'Capture dimensiones en centímetros y el volumen comercial se trabaja en CBM.' }}
                    {{ isMiamiLcl
                      ? 'El CFT cobrable compara el volumen facturable contra el equivalente por peso ya convertido.'
                      : 'Se compara contra ' + (shipmentModeForApi === 'Ltl' ? 'peso/330' : 'peso/500') + '.' }}`,
    'Miami live conversion instructions',
  )

  code = replaceRequired(
    code,
    `                    <DhInput v-model.number="line.weightKg" type="number" min="0" step="0.01" label="Peso total (kg)" />`,
    `                    <DhInput
                      v-if="isMiamiLcl"
                      :model-value="miamiKgToLb(line.weightKg)"
                      type="number"
                      min="0"
                      step="0.01"
                      label="Peso total (lb)"
                      @update:model-value="setMiamiWeightLb(line, $event)"
                    />
                    <DhInput v-else v-model.number="line.weightKg" type="number" min="0" step="0.01" label="Peso total (kg)" />`,
    'Miami pounds input',
  )

  code = replaceRequired(
    code,
    `                  <p v-if="cargoLineForcedNonStackable(line)" class="mt-2 text-xs font-black text-amber-600">`,
    `                  <div v-if="isMiamiLcl" class="mt-3 grid gap-2 rounded-xl border border-[var(--dh-border)] bg-black/[0.02] px-3 py-2 text-[11px] font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.025] sm:grid-cols-2 xl:grid-cols-4">
                    <span>Peso: <b class="text-[var(--dh-text)]">{{ miamiKgToLb(line.weightKg).toFixed(2) }} lb → {{ Math.max(0, number(line.weightKg)).toFixed(2) }} kg</b></span>
                    <span>Largo: <b class="text-[var(--dh-text)]">{{ Math.max(0, number(line.length)).toFixed(2) }} in → {{ miamiDimensionCm(line.length).toFixed(2) }} cm</b></span>
                    <span>Ancho: <b class="text-[var(--dh-text)]">{{ Math.max(0, number(line.width)).toFixed(2) }} in → {{ miamiDimensionCm(line.width).toFixed(2) }} cm</b></span>
                    <span>Alto: <b class="text-[var(--dh-text)]">{{ Math.max(0, number(line.height)).toFixed(2) }} in → {{ miamiDimensionCm(line.height).toFixed(2) }} cm</b></span>
                  </div>

                  <p v-if="cargoLineForcedNonStackable(line)" class="mt-2 text-xs font-black text-amber-600">`,
    'Miami per-line live conversions',
  )

  code = replaceRequired(
    code,
    `  if (consolidatedCargoMode.value && basis === 'PerChargeableCft') return Math.max(CFT_PER_CBM, number(lclChargeableCbm.value) * CFT_PER_CBM)`,
    `  if (consolidatedCargoMode.value && basis === 'PerChargeableCft') return isMiamiLcl.value
    ? Math.max(0.001, number(lclChargeableCbm.value) * CFT_PER_CBM)
    : Math.max(CFT_PER_CBM, number(lclChargeableCbm.value) * CFT_PER_CBM)`,
    'Miami CFT quantity without 1-CBM floor',
  )

  code = replaceRequired(
    code,
    `      heightCm: cargoDimensionToCm(line.height),
    }))
  : [])`,
    `      heightCm: cargoDimensionToCm(line.height),
      isStackable: cargoLineEffectiveStackable(line),
    }))
  : [])`,
    'stackability in own LCL calculation payload',
  )

  code = replaceRequired(
    code,
    `function hydrateConsolidatedCargoLines(rate: RateDto) {
  if (!consolidatedCargoMode.value) return
  const rows = Array.isArray(rate.cargoLines) ? rate.cargoLines : []`,
    `function hydrateConsolidatedCargoLines(rate: RateDto) {
  if (!consolidatedCargoMode.value) return
  const persistedNotes = (rate.rateDetails ?? []).map((detail) => String(detail.notes ?? '')).join(' · ')
  const planMatch = persistedNotes.match(/Plan Miami:\\s*(NVOCC-A|NVOCC-B|LITTLE|A|B|C|D)/i)
  if (planMatch?.[1]) {
    const normalizedPlan = planMatch[1].toUpperCase()
    form.miamiCommercialPlan = normalizedPlan
  }
  const whsMatch = persistedNotes.match(/WHS:\\s*(\\d+)/i)
  if (whsMatch?.[1]) form.miamiWhsQty = Math.max(1, Number(whsMatch[1]))
  const sedMatch = persistedNotes.match(/SED:\\s*(\\d+)/i)
  if (sedMatch?.[1]) {
    const sedQty = Math.max(0, Number(sedMatch[1]))
    form.miamiIncludeSed = sedQty > 0
    form.miamiSedQty = Math.max(1, sedQty)
  }
  const bondedMatch = persistedNotes.match(/Bonded:\\s*(Sí|Si|Yes|No)/i)
  if (bondedMatch?.[1]) form.miamiBonded = !/^no$/i.test(bondedMatch[1])
  const rows = Array.isArray(rate.cargoLines) ? rate.cargoLines : []`,
    'Miami plan hydration',
  )

  code = replaceRequired(
    code,
    `            :cargo-lines="lclCargoLines"
            :pol-id="selectedOrigin?.id ?? null"`,
    `            :cargo-lines="lclCargoLines"
            :commercial-plan="isMiamiLcl ? form.miamiCommercialPlan : null"
            :cargo-value="form.cargoValue"
            :whs-qty="form.miamiWhsQty"
            :include-sed="form.miamiIncludeSed"
            :sed-qty="form.miamiSedQty"
            :dangerous-cargo="form.dangerousCargo"
            :bonded="form.miamiBonded"
            :pol-id="selectedOrigin?.id ?? null"`,
    'Miami commercial props to LCL selector',
  )

  const planBoard = `              <div v-if="isMiamiLcl" class="rounded-2xl border border-[var(--dh-primary)]/30 bg-[var(--dh-card)] p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-black">Tarifa comercial Miami</p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">El tipo de cliente se aplica por cotización aquí; el consolidado conserva únicamente sus costos operativos.</p>
                  </div>
                  <span class="rounded-full border border-[var(--dh-primary)]/25 bg-[var(--dh-primary)]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">CFT · Miami</span>
                </div>
                <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <DhSelect v-model="form.miamiCommercialPlan" label="Tipo / tarifa de cliente" :options="miamiCommercialPlanOptions" />
                  <DhInput v-model.number="form.miamiWhsQty" type="number" min="1" step="1" label="Cantidad de WHS" />
                  <button type="button" class="crystal-flag self-end" :class="form.miamiIncludeSed ? 'crystal-flag--active' : ''" @click="form.miamiIncludeSed = !form.miamiIncludeSed">
                    <Check v-if="form.miamiIncludeSed" class="h-4 w-4" /> Incluir SED
                  </button>
                  <DhInput v-if="form.miamiIncludeSed" v-model.number="form.miamiSedQty" type="number" min="1" step="1" label="Cantidad de SED" />
                  <button type="button" class="crystal-flag self-end" :class="form.miamiBonded ? 'crystal-flag--active' : ''" @click="form.miamiBonded = !form.miamiBonded">
                    <Check v-if="form.miamiBonded" class="h-4 w-4" /> Bonded
                  </button>
                </div>
                <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div class="crystal-metric crystal-metric--sale"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Venta / CFT</span><strong class="mt-1 block">{{ miamiCommercialRate.little ? 'Escalonada' : 'USD ' + miamiCommercialRate.salePerCft.toFixed(2) }}</strong></div>
                  <div class="crystal-metric crystal-metric--neutral"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Equiv. venta / CBM</span><strong class="mt-1 block">{{ miamiCommercialRate.little ? 'Por tramo' : 'USD ' + (miamiCommercialRate.salePerCft * CFT_PER_CBM).toFixed(2) }}</strong></div>
                  <div class="crystal-metric crystal-metric--neutral"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Mínimo flete</span><strong class="mt-1 block">{{ miamiCommercialRate.little ? 'USD 30 / 40 / 50' : 'USD ' + miamiCommercialRate.minimumFreightSale.toFixed(2) }}</strong></div>
                  <div class="crystal-metric crystal-metric--neutral"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Cargos fijos FAK</span><strong class="mt-1 block">USD {{ miamiFakSale.toFixed(2) }}</strong></div>
                  <div class="crystal-metric crystal-metric--neutral"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Seguro</span><strong class="mt-1 block">USD {{ miamiInsuranceSale.toFixed(2) }}</strong><small>{{ miamiCommercialRate.insurancePct.toFixed(2) }}% · mín. USD {{ miamiCommercialRate.insuranceMinimum.toFixed(2) }}</small></div>
                </div>
                <div v-if="miamiCommercialRate.little" class="mt-3 rounded-xl border px-3 py-2 text-xs font-bold" :class="miamiLittleIssues.length ? 'border-red-500/30 bg-red-500/10 text-red-600' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'">
                  {{ miamiLittleIssues.length ? 'NO APLICA LITTLE: ' + miamiLittleIssues.join(' · ') : 'CARGAS LITTLE: cumple peso, CFT, valor, IMO, Bonded y WHS. Confirmar manualmente que no requiera permisos.' }}
                </div>
              </div>

`

  code = replaceRequired(
    code,
    `              <div class="space-y-3">
                <div
                  v-for="(line, index) in consolidatedCargoLines"`,
    planBoard + `              <div class="space-y-3">
                <div
                  v-for="(line, index) in consolidatedCargoLines"`,
    'Miami plan board',
  )

  code = replaceRequired(
    code,
    `                  <small>{{ isUnitedStatesPol ? 'Mínimo facturable: 35.315 CFT (1 CBM)' : 'Mínimo facturable: 1 CBM' }}</small>`,
    `                  <small v-if="isMiamiLcl">{{ miamiCommercialRate.little ? 'Flete escalonado por CFT real' : 'Mínimo monetario de flete: USD ' + miamiCommercialRate.minimumFreightSale.toFixed(2) }}</small>
                  <small v-else>{{ isUnitedStatesPol ? 'Mínimo facturable: 35.315 CFT (1 CBM)' : 'Mínimo facturable: 1 CBM' }}</small>`,
    'Miami minimum caption',
  )

  const conversionBoard = `              <div v-if="isMiamiLcl" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-xs font-semibold text-[var(--dh-text-muted)]">
                <p class="font-black text-[var(--dh-text)]">Conversiones aplicadas a esta carga</p>
                <p class="mt-1">Las dimensiones se capturan en pulgadas y el peso en libras. Los valores convertidos a cm y kg se actualizan con lo que realmente se ingrese.</p>
                <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <span>Peso total: <b class="text-[var(--dh-text)]">{{ miamiKgToLb(consolidatedTotalWeightKg).toFixed(2) }} lb → {{ consolidatedTotalWeightKg.toFixed(2) }} kg</b></span>
                  <span>Volumen físico: <b class="text-[var(--dh-text)]">{{ miamiPhysicalCft.toFixed(3) }} CFT / {{ lclPhysicalCbm.toFixed(3) }} CBM</b></span>
                  <span>Volumen facturable: <b class="text-[var(--dh-text)]">{{ miamiDimensionalCft.toFixed(3) }} CFT / {{ lclDimensionalCbm.toFixed(3) }} CBM</b></span>
                  <span>Equivalente por peso: <b class="text-[var(--dh-text)]">{{ miamiWeightCft.toFixed(3) }} CFT</b></span>
                </div>
                <div class="mt-2 rounded-xl border border-[var(--dh-primary)]/20 bg-[var(--dh-primary)]/5 px-3 py-2">
                  CFT cobrable: <b class="text-[var(--dh-primary)]">{{ miamiChargeableCft.toFixed(3) }} CFT</b>
                  <span class="ml-2">({{ lclChargeableCbm.toFixed(3) }} CBM)</span>
                </div>
                <p class="mt-2">No estibable: alto ≥ 70 in (177.8 cm) automático; altura facturable mínima 2.66 m. El peso es total por línea y las dimensiones sí se multiplican por cantidad.</p>
              </div>

`

  code = replaceRequired(
    code,
    `              <p v-if="!consolidatedCargoLinesReady" class="text-xs font-bold text-amber-600">`,
    conversionBoard + `              <p v-if="!consolidatedCargoLinesReady" class="text-xs font-bold text-amber-600">`,
    'Miami conversion board',
  )

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[pricingMiamiLclRules20261002] script end not found.')
  code = code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
  return code
}

export function pricingMiamiLclRules20261002(): Plugin {
  return {
    name: 'dhole-pricing-miami-lcl-rules-20261002',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
