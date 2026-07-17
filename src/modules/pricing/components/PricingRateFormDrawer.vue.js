import { computed, onMounted, reactive, ref, watch } from 'vue';
import { AlertTriangle, Info, LockKeyhole, Plus, Save, Ship, Trash2 } from 'lucide-vue-next';
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { PRICING_SCOPES } from '@/core/auth/scopes';
import { PricingService } from '@/core/services/pricingService';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import PricingMultiSelect from './PricingMultiSelect.vue';
import { calculateMargin, formatMoney, minimumSale, toDateInput, } from '@/modules/pricing/utils/pricingFormat';
const props = defineProps();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const catalogs = usePricingCatalogs();
const availableCosts = ref([]);
const details = ref([]);
const optionalCostIds = ref([]);
const removedDetailIds = ref([]);
const initialized = ref(false);
const today = new Date();
const nextMonth = new Date(today);
nextMonth.setDate(nextMonth.getDate() + 30);
const dateValue = (date) => date.toISOString().slice(0, 10);
const form = reactive({
    agentId: props.rate?.agentId ?? '',
    carrierId: props.rate?.carrierId ?? '',
    polId: props.rate?.polId ?? '',
    poeId: props.rate?.poeId ?? '',
    podId: props.rate?.podId ?? '',
    containerTypeId: props.rate?.containerTypeId ?? '',
    currencyId: props.rate?.currencyId ?? '',
    containerQuantity: String(props.rate?.containerQuantity ?? 1),
    freeDays: String(props.rate?.freeDays ?? props.sourceImport?.freeDays ?? 0),
    validFrom: toDateInput(props.rate?.validFrom ?? props.sourceImport?.validFrom) || dateValue(today),
    validTo: toDateInput(props.rate?.validTo ?? props.sourceImport?.validTo) || dateValue(nextMonth),
    clientName: props.rate?.clientName ?? '',
    idtraNumber: props.rate?.idtraNumber ?? '',
    quoNumber: props.rate?.quoNumber ?? '',
    includes: props.rate?.includes ?? '',
    subjectTo: props.rate?.subjectTo ?? '',
    excludes: props.rate?.excludes ?? '',
    transitDays: String(props.rate?.transitDays ?? props.sourceImport?.transitDays ?? ''),
    submitted: false,
    saving: false,
});
const isEditing = computed(() => Boolean(props.rate));
const isFromImport = computed(() => Boolean(props.sourceImport || props.rate?.sourceImportFclRateId));
const isHeaderLocked = isFromImport;
const canAutoApprove = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin));
const selectedCurrency = computed(() => catalogs.findById(catalogs.currencies.value, form.currencyId));
const currencyName = computed(() => selectedCurrency.value?.name ||
    props.rate?.currencyName ||
    props.sourceImport?.currency ||
    'USD');
const detailTypeOptions = [
    { label: 'Flete internacional', value: 'Freight' },
    { label: 'Costo de agente', value: 'AgentCharge' },
    { label: 'Cargo en origen', value: 'OriginCharge' },
    { label: 'Cargo en destino', value: 'DestinationCharge' },
    { label: 'Cargo portuario', value: 'PortCharge' },
    { label: 'Aduana', value: 'CustomsCharge' },
    { label: 'Transporte interno', value: 'InlandTransport' },
    { label: 'Documentación', value: 'Documentation' },
    { label: 'Seguro', value: 'Insurance' },
    { label: 'Otro', value: 'Other' },
];
const editableTypeOptions = [
    { label: 'Variable', value: 'Variable' },
    { label: 'Opcional', value: 'Optional' },
];
function normalizeKey(value) {
    return value
        .trim()
        .toLocaleLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}
function readRawValues(raw, keys) {
    if (!raw.trim().startsWith('{') && !raw.trim().startsWith('['))
        return [];
    try {
        const results = [];
        const targetKeys = new Set(keys.map(normalizeKey));
        const visit = (value) => {
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (!value || typeof value !== 'object')
                return;
            for (const [key, item] of Object.entries(value)) {
                if (targetKeys.has(normalizeKey(key)) &&
                    (typeof item === 'string' || typeof item === 'number')) {
                    results.push(String(item));
                }
                visit(item);
            }
        };
        visit(JSON.parse(raw));
        return [...new Set(results)];
    }
    catch {
        return [];
    }
}
function fromRateDetail(detail) {
    const masterCost = detail.costId
        ? availableCosts.value.find((cost) => cost.id === detail.costId)
        : undefined;
    return {
        key: detail.id,
        id: detail.id,
        costId: detail.costId,
        name: detail.name,
        costDetailType: detail.costDetailType,
        costType: detail.costType,
        currencyId: detail.currencyId,
        currencyName: detail.currencyName,
        currencyCode: detail.currencyCode,
        costAmount: String(detail.costAmount),
        saleAmount: String(detail.saleAmount),
        notes: detail.notes?.trim() || masterCost?.notes?.trim() || '',
        locked: detail.costType === 'Fixed' && Boolean(detail.costId),
    };
}
function fromCost(cost) {
    return {
        key: `cost-${cost.id}`,
        costId: cost.id,
        name: cost.name,
        costDetailType: cost.costDetailType,
        costType: cost.costType,
        currencyId: cost.currencyId,
        currencyName: cost.currencyName,
        currencyCode: cost.currencyCode,
        costAmount: String(cost.costAmount),
        saleAmount: String(cost.agentId ? 0 : cost.saleAmount),
        notes: cost.notes ?? '',
        locked: false,
    };
}
function addManualDetail(type = 'Other') {
    details.value.push({
        key: crypto.randomUUID(),
        name: type === 'Freight' ? 'Flete internacional' : '',
        costDetailType: type,
        costType: 'Variable',
        currencyId: form.currencyId,
        currencyName: selectedCurrency.value?.name ?? '',
        currencyCode: selectedCurrency.value?.code ?? '',
        costAmount: '',
        saleAmount: '',
        notes: '',
        locked: false,
    });
}
function removeDetail(detail) {
    if (detail.locked || detail.fixedDecisionCost)
        return;
    if (detail.id)
        removedDetailIds.value.push(detail.id);
    if (detail.costId)
        optionalCostIds.value = optionalCostIds.value.filter((id) => id !== detail.costId);
    details.value = details.value.filter((item) => item.key !== detail.key);
}
const optionalCosts = computed(() => {
    const routePortIds = new Set([form.polId, form.poeId, form.podId].filter(Boolean));
    return availableCosts.value.filter((cost) => {
        if (cost.costType !== 'Optional')
            return false;
        if (form.currencyId && cost.currencyId !== form.currencyId)
            return false;
        if (cost.carrierId && cost.carrierId !== form.carrierId)
            return false;
        if (cost.agentId && cost.agentId !== form.agentId)
            return false;
        if (cost.portId && routePortIds.size && !routePortIds.has(cost.portId))
            return false;
        return true;
    });
});
const optionalOptions = computed(() => optionalCosts.value.map((cost) => ({
    value: cost.id,
    label: cost.name,
    description: [
        `${cost.costDetailType} · ${formatMoney(cost.costAmount, cost.currencyName)}`,
        cost.notes?.trim(),
    ]
        .filter(Boolean)
        .join(' · '),
})));
function matchesCostScope(cost) {
    if (form.currencyId && cost.currencyId !== form.currencyId)
        return false;
    if (cost.agentId && cost.agentId !== form.agentId)
        return false;
    if (cost.carrierId && cost.carrierId !== form.carrierId)
        return false;
    if (!cost.portId)
        return true;
    const roleByPort = new Map([
        [form.polId, 'Pol'],
        [form.poeId, 'Poe'],
        [form.podId, 'Pod'],
    ]);
    const matchedRole = roleByPort.get(cost.portId);
    if (!matchedRole)
        return false;
    return !cost.portRole || cost.portRole === 'Any' || cost.portRole === matchedRole;
}
const automaticFixedCosts = computed(() => availableCosts.value.filter((cost) => cost.costType === 'Fixed' && matchesCostScope(cost)));
const selectorsChanged = computed(() => Boolean(props.rate &&
    (props.rate.agentId !== form.agentId ||
        props.rate.carrierId !== form.carrierId ||
        props.rate.polId !== form.polId ||
        props.rate.poeId !== form.poeId ||
        props.rate.podId !== form.podId)));
const visibleDetails = computed(() => {
    const currentRows = selectorsChanged.value
        ? details.value.filter((detail) => !detail.locked)
        : details.value;
    const currentFixedIds = new Set(currentRows.filter((detail) => detail.locked).map((detail) => detail.costId));
    const estimated = automaticFixedCosts.value
        .filter((cost) => !currentFixedIds.has(cost.id))
        .map((cost) => ({
        ...fromCost(cost),
        key: `estimated-${cost.id}`,
        locked: true,
        estimated: true,
    }));
    return [...currentRows, ...estimated];
});
const totalCost = computed(() => visibleDetails.value.reduce((sum, detail) => sum + Number(detail.costAmount || 0), 0));
const totalSale = computed(() => visibleDetails.value.reduce((sum, detail) => sum + Number(detail.saleAmount || 0), 0));
const totalUtility = computed(() => totalSale.value - totalCost.value);
const margin = computed(() => calculateMargin(totalCost.value, totalSale.value));
const groups = computed(() => [
    {
        key: 'agent',
        title: 'Costos de agente',
        hint: 'No generan venta.',
        rows: visibleDetails.value.filter((detail) => detail.costDetailType === 'AgentCharge'),
    },
    {
        key: 'freight',
        title: 'Flete internacional',
        hint: 'Costo y venta marítima.',
        rows: visibleDetails.value.filter((detail) => detail.costDetailType === 'Freight'),
    },
    {
        key: 'destination',
        title: 'Costos de destino',
        hint: 'POE, POD y transporte interno.',
        rows: visibleDetails.value.filter((detail) => ['DestinationCharge', 'InlandTransport'].includes(detail.costDetailType)),
    },
    {
        key: 'other',
        title: 'Otros rubros',
        hint: 'Origen, documentación, seguro y adicionales.',
        rows: visibleDetails.value.filter((detail) => !['AgentCharge', 'Freight', 'DestinationCharge', 'InlandTransport'].includes(detail.costDetailType)),
    },
]);
watch(optionalCostIds, (ids) => {
    if (!initialized.value)
        return;
    const selected = new Set(ids);
    for (const costId of ids) {
        if (!details.value.some((detail) => detail.costId === costId)) {
            const cost = availableCosts.value.find((item) => item.id === costId);
            if (cost)
                details.value.push(fromCost(cost));
        }
    }
    const removed = details.value.filter((detail) => detail.costType === 'Optional' && detail.costId && !selected.has(detail.costId));
    for (const detail of removed)
        if (detail.id)
            removedDetailIds.value.push(detail.id);
    details.value = details.value.filter((detail) => detail.costType !== 'Optional' || !detail.costId || selected.has(detail.costId));
}, { deep: true });
watch(() => form.currencyId, () => {
    const currency = selectedCurrency.value;
    if (!currency)
        return;
    for (const detail of details.value) {
        if (!detail.costId && !detail.locked && !detail.fixedDecisionCost) {
            detail.currencyId = currency.id;
            detail.currencyName = currency.name;
            detail.currencyCode = currency.code;
        }
    }
});
function fieldError(value, label) {
    return form.submitted && !value ? `Seleccione ${label}.` : undefined;
}
function detailError(detail) {
    if (!form.submitted)
        return '';
    if (!detail.name.trim())
        return 'Indique el nombre del rubro.';
    if (!detail.currencyId)
        return 'Seleccione una moneda.';
    if (Number(detail.costAmount) < 0 || Number(detail.saleAmount) < 0)
        return 'Los montos no pueden ser negativos.';
    return '';
}
function mapDetail(detail) {
    const agentCost = detail.costDetailType === 'AgentCharge';
    return {
        costId: detail.costId ?? null,
        name: detail.name.trim(),
        costDetailType: detail.costDetailType,
        costType: detail.costType,
        currencyId: detail.currencyId,
        currencyName: detail.currencyName,
        currencyCode: detail.currencyCode,
        costAmount: Number(detail.costAmount || 0),
        saleAmount: agentCost ? 0 : Number(detail.saleAmount || 0),
        notes: detail.notes.trim() || null,
    };
}
function buildHeader() {
    const agent = catalogs.findById(catalogs.agents.value, form.agentId);
    const carrier = catalogs.findById(catalogs.carriers.value, form.carrierId);
    const pol = catalogs.findById(catalogs.polPorts.value, form.polId);
    const poe = catalogs.findById(catalogs.poePorts.value, form.poeId);
    const pod = catalogs.findById(catalogs.podPorts.value, form.podId);
    const container = catalogs.findById(catalogs.containerTypes.value, form.containerTypeId);
    const currency = catalogs.findById(catalogs.currencies.value, form.currencyId);
    if (!agent || !carrier || !pol || !poe || !pod || !container || !currency)
        return null;
    return {
        agentId: agent.id,
        agentName: agent.name,
        agentCode: agent.code,
        carrierId: carrier.id,
        carrierName: carrier.name,
        carrierCode: carrier.code,
        polId: pol.id,
        polName: pol.name,
        polCode: pol.code,
        poeId: poe.id,
        poeName: poe.name,
        poeCode: poe.code,
        podId: pod.id,
        podName: pod.name,
        podCode: pod.code,
        containerTypeId: container.id,
        containerTypeName: container.name,
        containerTypeCode: container.code,
        currencyId: currency.id,
        currencyName: currency.name,
        currencyCode: currency.code,
        freeDays: Number(form.freeDays || 0),
        validFrom: form.validFrom,
        validTo: form.validTo,
        containerQuantity: Number(form.containerQuantity || 1),
        clientName: form.clientName.trim() || null,
        idtraNumber: form.idtraNumber.trim() || null,
        quoNumber: form.quoNumber.trim() || null,
        includes: form.includes.trim() || null,
        subjectTo: form.subjectTo.trim() || null,
        excludes: form.excludes.trim() || null,
        transitDays: form.transitDays.trim() ? Number(form.transitDays) : null,
    };
}
function validate() {
    form.submitted = true;
    if (!buildHeader())
        return false;
    if (Number(form.freeDays) < 0 ||
        Number(form.containerQuantity) <= 0 ||
        (form.transitDays.trim() && Number(form.transitDays) < 0) ||
        !form.validFrom ||
        !form.validTo ||
        form.validTo < form.validFrom)
        return false;
    const applicable = details.value.filter((detail) => !selectorsChanged.value || !detail.locked);
    if (!applicable.some((detail) => detail.costDetailType === 'Freight'))
        return false;
    return applicable.every((detail) => !detailError(detail));
}
function updatePayloadFromRate(rate, freightSale, headerOverride) {
    const extraDetails = rate.rateDetails.map((detail) => ({
        id: detail.id,
        costId: detail.costId,
        name: detail.name,
        costDetailType: detail.costDetailType,
        costType: detail.costType,
        currencyId: detail.currencyId,
        currencyName: detail.currencyName,
        currencyCode: detail.currencyCode,
        costAmount: detail.costAmount,
        saleAmount: detail.costDetailType === 'Freight' && freightSale !== undefined
            ? freightSale
            : detail.saleAmount,
        notes: detail.notes,
    }));
    const header = headerOverride ?? {
        agentId: rate.agentId,
        agentName: rate.agentName,
        agentCode: rate.agentCode,
        carrierId: rate.carrierId,
        carrierName: rate.carrierName,
        carrierCode: rate.carrierCode,
        polId: rate.polId,
        polName: rate.polName,
        polCode: rate.polCode,
        poeId: rate.poeId,
        poeName: rate.poeName,
        poeCode: rate.poeCode,
        podId: rate.podId,
        podName: rate.podName,
        podCode: rate.podCode,
        containerTypeId: rate.containerTypeId,
        containerTypeName: rate.containerTypeName,
        containerTypeCode: rate.containerTypeCode,
        currencyId: rate.currencyId,
        currencyName: rate.currencyName,
        currencyCode: rate.currencyCode,
        freeDays: rate.freeDays,
        validFrom: rate.validFrom,
        validTo: rate.validTo,
        containerQuantity: rate.containerQuantity,
        clientName: rate.clientName ?? null,
        idtraNumber: rate.idtraNumber ?? null,
        quoNumber: rate.quoNumber ?? null,
        includes: rate.includes ?? null,
        subjectTo: rate.subjectTo ?? null,
        excludes: rate.excludes ?? null,
        transitDays: rate.transitDays ?? null,
    };
    return {
        ...header,
        extraDetails,
        removedExtraDetailIds: [],
    };
}
async function approveIfAllowed(rateId) {
    const result = await PricingService.getRate(rateId);
    if (result.status === 'PendingApproval' && canAutoApprove.value) {
        await PricingService.approveRateMargin(rateId);
        toastStore.success('Tarifa guardada y aprobada', 'Su permiso permitió aprobar automáticamente el margen inferior al 12%.');
    }
    else if (result.status === 'PendingApproval') {
        toastStore.warning('Tarifa pendiente de aprobación', 'El margen actual es inferior al 12% y debe revisarlo una persona autorizada.');
    }
    else {
        toastStore.success(isEditing.value ? 'Tarifa actualizada' : 'Tarifa creada', 'Los totales y el margen se recalcularon correctamente.');
    }
}
async function submit() {
    if (!validate())
        return;
    const header = buildHeader();
    try {
        form.saving = true;
        let rateId = props.rate?.id;
        if (props.rate) {
            const payload = {
                ...header,
                extraDetails: details.value
                    .filter((detail) => !detail.importedFreight && (!selectorsChanged.value || !detail.locked))
                    .map((detail) => ({ ...mapDetail(detail), id: detail.id ?? null })),
                removedExtraDetailIds: [...new Set(removedDetailIds.value)],
            };
            await PricingService.updateRate(props.rate.id, payload);
        }
        else {
            const payload = {
                sourceImportFclRateId: props.sourceImport?.id ?? null,
                ...header,
                details: details.value
                    .filter((detail) => !detail.locked && !detail.importedFreight)
                    .map(mapDetail),
            };
            rateId = await PricingService.createRate(payload);
            // Imported freight is created by Pricing from the source row. Apply the
            // sale entered by the user immediately through the supported update flow.
            const importedFreight = details.value.find((detail) => detail.importedFreight);
            if (importedFreight) {
                const created = await PricingService.getRate(rateId);
                await PricingService.updateRate(rateId, updatePayloadFromRate(created, Number(importedFreight.saleAmount || 0), header));
            }
        }
        if (rateId)
            await approveIfAllowed(rateId);
        drawerStore.close();
        await props.onSaved?.(rateId);
    }
    catch (error) {
        toastStore.backendError(error, isEditing.value ? 'No se pudo actualizar la tarifa.' : 'No se pudo crear la tarifa.');
    }
    finally {
        form.saving = false;
    }
}
async function initialize() {
    await catalogs.loadAll();
    try {
        const firstPage = await PricingService.browseCosts({
            pageNumber: 1,
            pageSize: 100,
            isActive: true,
        });
        const costs = [...firstPage.items];
        const pageSize = firstPage.pageSize ?? 100;
        const totalPages = firstPage.totalPages ??
            Math.max(1, Math.ceil((firstPage.totalCount ?? costs.length) / pageSize));
        for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
            const page = await PricingService.browseCosts({
                pageNumber,
                pageSize,
                isActive: true,
            });
            costs.push(...page.items);
        }
        availableCosts.value = costs;
    }
    catch {
        // Compatibilidad con versiones anteriores del backend. El endpoint
        // paginado es el preferido porque devuelve las notas completas.
        try {
            availableCosts.value = await PricingService.selectCosts({ isActive: true });
        }
        catch {
            availableCosts.value = [];
        }
    }
    if (props.rate) {
        details.value = props.rate.rateDetails.map(fromRateDetail);
        optionalCostIds.value = props.rate.rateDetails
            .filter((detail) => detail.costType === 'Optional' && detail.costId)
            .map((detail) => detail.costId);
    }
    else if (props.sourceImport) {
        const source = props.sourceImport;
        const raw = source.rawDataJson ?? '';
        const agent = catalogs.findBestMatch(catalogs.agents.value, source.agentId, source.agent, source.agentCode, source.agentSlug, ...readRawValues(raw, ['agent', 'agente', 'client', 'cliente', 'customer']));
        const carrier = catalogs.findBestMatch(catalogs.carriers.value, source.carrierId, source.carrier, source.carrierCode, source.carrierSlug, ...readRawValues(raw, ['carrier', 'carrierName', 'naviera', 'shippingLine']));
        const pol = catalogs.findBestMatch(catalogs.polPorts.value, source.polId, source.pol, source.polCode, source.polSlug, ...readRawValues(raw, ['pol', 'origin', 'originPort', 'portOfLoading', 'puertoOrigen']));
        const pod = catalogs.findBestMatch(catalogs.podPorts.value, source.podId, source.pod, source.podCode, source.podSlug, ...readRawValues(raw, [
            'pod',
            'destination',
            'destinationPort',
            'portOfDischarge',
            'puertoDestino',
        ]));
        const poe = catalogs.findBestMatch(catalogs.poePorts.value, source.poeId, source.poe, source.poeCode, source.poeSlug, ...readRawValues(raw, [
            'poe',
            'entryPort',
            'portOfEntry',
            'puertoEntrada',
            'transshipmentPort',
        ]), source.pod, source.podCode);
        const container = catalogs.findBestMatch(catalogs.containerTypes.value, source.containerTypeId, source.containerType, source.containerTypeCode, source.containerTypeSlug, ...readRawValues(raw, ['container', 'containerType', 'equipment', 'equipmentType', 'tamano']));
        const currency = catalogs.findBestMatch(catalogs.currencies.value, source.currencyId, source.currency, source.currencyCode, source.currencySlug, ...readRawValues(raw, ['currency', 'currencyCode', 'moneda']));
        form.agentId =
            agent?.id ??
                catalogs.findByCode(catalogs.agents.value, 'WWL')?.id ??
                catalogs.findByCode(catalogs.agents.value, 'RS')?.id ??
                '';
        form.carrierId = carrier?.id ?? '';
        form.polId = pol?.id ?? '';
        form.poeId = poe?.id ?? '';
        form.podId = pod?.id ?? '';
        form.containerTypeId = container?.id ?? '';
        form.currencyId =
            currency?.id ?? catalogs.findByCode(catalogs.currencies.value, 'USD')?.id ?? '';
        const importedDetails = [
            {
                key: `import-freight-${props.sourceImport.id}`,
                name: 'Flete internacional',
                costDetailType: 'Freight',
                costType: 'Variable',
                currencyId: form.currencyId,
                currencyName: selectedCurrency.value?.name ?? props.sourceImport.currency,
                currencyCode: selectedCurrency.value?.code ?? props.sourceImport.currency,
                costAmount: String(props.sourceImport.freight),
                saleAmount: String(props.sourceImport.freight),
                notes: '',
                locked: false,
                importedFreight: true,
            },
        ];
        if ((props.decisionInternationalLandFreight ?? 0) > 0) {
            const usdCurrency = catalogs.findByCode(catalogs.currencies.value, 'USD') ?? selectedCurrency.value;
            importedDetails.push({
                key: `decision-land-freight-${props.sourceImport.id}`,
                name: 'Flete terrestre internacional',
                costDetailType: 'InlandTransport',
                costType: 'Variable',
                currencyId: usdCurrency?.id ?? form.currencyId,
                currencyName: usdCurrency?.name ?? 'USD',
                currencyCode: usdCurrency?.code ?? 'USD',
                costAmount: String(props.decisionInternationalLandFreight),
                saleAmount: String(props.decisionInternationalLandFreight),
                notes: 'Valor fijo aplicado por selección de vía multimodal desde el dashboard.',
                locked: false,
                fixedDecisionCost: true,
            });
        }
        details.value = importedDetails;
    }
    else {
        form.agentId =
            catalogs.findByCode(catalogs.agents.value, 'WWL')?.id ??
                catalogs.findByCode(catalogs.agents.value, 'RS')?.id ??
                '';
        addManualDetail('Freight');
    }
    initialized.value = true;
}
onMounted(initialize);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.submit) },
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
if (__VLS_ctx.rate) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.rate.rateName || __VLS_ctx.rate.rateCode);
}
if (__VLS_ctx.sourceImport) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "flex items-start gap-3 rounded-[24px] border border-blue-500/20 bg-blue-500/10 p-4 text-blue-800 dark:text-blue-200" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-blue-500/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-blue-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-blue-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-blue-200']} */ ;
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.Info} */
    Info;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm font-semibold opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.sourceImport.carrier);
    (__VLS_ctx.sourceImport.pol);
    (__VLS_ctx.sourceImport.pod);
    (__VLS_ctx.sourceImport.containerType);
    if (__VLS_ctx.decisionInternationalLandFreight) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.formatMoney(__VLS_ctx.decisionInternationalLandFreight, 'USD'));
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-5 flex items-center gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['w-9']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-medium text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2 xl:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.form.agentId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Agente",
    placeholder: "Seleccione agente",
    options: (__VLS_ctx.catalogs.agentOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.agentId, 'el agente')),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.form.agentId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Agente",
    placeholder: "Seleccione agente",
    options: (__VLS_ctx.catalogs.agentOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.agentId, 'el agente')),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.form.carrierId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Naviera",
    placeholder: "Seleccione naviera",
    options: (__VLS_ctx.catalogs.carrierOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.carrierId, 'la naviera')),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.form.carrierId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Naviera",
    placeholder: "Seleccione naviera",
    options: (__VLS_ctx.catalogs.carrierOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.carrierId, 'la naviera')),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.form.containerTypeId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Contenedor",
    placeholder: "Seleccione contenedor",
    options: (__VLS_ctx.catalogs.containerOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.containerTypeId, 'el contenedor')),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.form.containerTypeId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Contenedor",
    placeholder: "Seleccione contenedor",
    options: (__VLS_ctx.catalogs.containerOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.containerTypeId, 'el contenedor')),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.form.polId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "POL · Origen",
    placeholder: "Seleccione POL",
    options: (__VLS_ctx.catalogs.polOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.polId, 'el POL')),
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.form.polId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "POL · Origen",
    placeholder: "Seleccione POL",
    options: (__VLS_ctx.catalogs.polOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.polId, 'el POL')),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_25;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    modelValue: (__VLS_ctx.form.poeId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "POE · Entrada",
    placeholder: "Seleccione POE",
    options: (__VLS_ctx.catalogs.poeOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.poeId, 'el POE')),
}));
const __VLS_27 = __VLS_26({
    modelValue: (__VLS_ctx.form.poeId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "POE · Entrada",
    placeholder: "Seleccione POE",
    options: (__VLS_ctx.catalogs.poeOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.poeId, 'el POE')),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_30;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    modelValue: (__VLS_ctx.form.podId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "POD · Destino final",
    placeholder: "Seleccione POD",
    options: (__VLS_ctx.catalogs.podOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.podId, 'el POD')),
}));
const __VLS_32 = __VLS_31({
    modelValue: (__VLS_ctx.form.podId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "POD · Destino final",
    placeholder: "Seleccione POD",
    options: (__VLS_ctx.catalogs.podOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.podId, 'el POD')),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-5 flex items-center gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['w-9']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-medium text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
let __VLS_35;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
    modelValue: (__VLS_ctx.form.currencyId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Moneda",
    placeholder: "Seleccione moneda",
    options: (__VLS_ctx.catalogs.currencyOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.currencyId, 'la moneda')),
}));
const __VLS_37 = __VLS_36({
    modelValue: (__VLS_ctx.form.currencyId),
    disabled: (__VLS_ctx.isHeaderLocked),
    label: "Moneda",
    placeholder: "Seleccione moneda",
    options: (__VLS_ctx.catalogs.currencyOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.currencyId, 'la moneda')),
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
let __VLS_40;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.form.freeDays),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "number",
    label: "Días libres",
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.freeDays) < 0 ? 'No puede ser negativo.' : undefined),
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.form.freeDays),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "number",
    label: "Días libres",
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.freeDays) < 0 ? 'No puede ser negativo.' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_45;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
    modelValue: (__VLS_ctx.form.validFrom),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "date",
    label: "Válida desde",
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.validFrom ? 'Indique la fecha.' : undefined),
}));
const __VLS_47 = __VLS_46({
    modelValue: (__VLS_ctx.form.validFrom),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "date",
    label: "Válida desde",
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.validFrom ? 'Indique la fecha.' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
let __VLS_50;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
    modelValue: (__VLS_ctx.form.validTo),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "date",
    label: "Válida hasta",
    error: (__VLS_ctx.form.submitted && (!__VLS_ctx.form.validTo || __VLS_ctx.form.validTo < __VLS_ctx.form.validFrom)
        ? 'Revise el rango.'
        : undefined),
}));
const __VLS_52 = __VLS_51({
    modelValue: (__VLS_ctx.form.validTo),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "date",
    label: "Válida hasta",
    error: (__VLS_ctx.form.submitted && (!__VLS_ctx.form.validTo || __VLS_ctx.form.validTo < __VLS_ctx.form.validFrom)
        ? 'Revise el rango.'
        : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_51));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-5 flex items-center gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['w-9']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-medium text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
let __VLS_55;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
    modelValue: (__VLS_ctx.form.clientName),
    label: "Cliente",
    placeholder: "Nombre del cliente",
}));
const __VLS_57 = __VLS_56({
    modelValue: (__VLS_ctx.form.clientName),
    label: "Cliente",
    placeholder: "Nombre del cliente",
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_60;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.form.idtraNumber),
    label: "Número IDTRA",
    placeholder: "IDTRA-...",
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.form.idtraNumber),
    label: "Número IDTRA",
    placeholder: "IDTRA-...",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
let __VLS_65;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
    modelValue: (__VLS_ctx.form.quoNumber),
    label: "Número QUO",
    placeholder: "QUO-...",
}));
const __VLS_67 = __VLS_66({
    modelValue: (__VLS_ctx.form.quoNumber),
    label: "Número QUO",
    placeholder: "QUO-...",
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
let __VLS_70;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
    modelValue: (__VLS_ctx.form.containerQuantity),
    type: "number",
    min: "1",
    label: "Cantidad de contenedores",
    disabled: (__VLS_ctx.isHeaderLocked),
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.containerQuantity) <= 0 ? 'Debe ser mayor a cero.' : undefined),
}));
const __VLS_72 = __VLS_71({
    modelValue: (__VLS_ctx.form.containerQuantity),
    type: "number",
    min: "1",
    label: "Cantidad de contenedores",
    disabled: (__VLS_ctx.isHeaderLocked),
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.containerQuantity) <= 0 ? 'Debe ser mayor a cero.' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_71));
let __VLS_75;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
    modelValue: (__VLS_ctx.form.transitDays),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "number",
    min: "0",
    label: "Tiempo de tránsito (días)",
    error: (__VLS_ctx.form.submitted && __VLS_ctx.form.transitDays && Number(__VLS_ctx.form.transitDays) < 0 ? 'No puede ser negativo.' : undefined),
}));
const __VLS_77 = __VLS_76({
    modelValue: (__VLS_ctx.form.transitDays),
    disabled: (__VLS_ctx.isHeaderLocked),
    type: "number",
    min: "0",
    label: "Tiempo de tránsito (días)",
    error: (__VLS_ctx.form.submitted && __VLS_ctx.form.transitDays && Number(__VLS_ctx.form.transitDays) < 0 ? 'No puede ser negativo.' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_76));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 grid gap-4 lg:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
let __VLS_80;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
    modelValue: (__VLS_ctx.form.includes),
    label: "Tarifa incluye",
    rows: (4),
}));
const __VLS_82 = __VLS_81({
    modelValue: (__VLS_ctx.form.includes),
    label: "Tarifa incluye",
    rows: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
let __VLS_85;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({
    modelValue: (__VLS_ctx.form.subjectTo),
    label: "Sujeto a",
    rows: (4),
}));
const __VLS_87 = __VLS_86({
    modelValue: (__VLS_ctx.form.subjectTo),
    label: "Sujeto a",
    rows: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_86));
let __VLS_90;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
    modelValue: (__VLS_ctx.form.excludes),
    label: "No incluye",
    rows: (4),
}));
const __VLS_92 = __VLS_91({
    modelValue: (__VLS_ctx.form.excludes),
    label: "No incluye",
    rows: (4),
}, ...__VLS_functionalComponentArgsRest(__VLS_91));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-5 flex items-center gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['w-9']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-medium text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
let __VLS_95;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_96 = __VLS_asFunctionalComponent1(__VLS_95, new __VLS_95({
    ...{ 'onClick': {} },
    label: "Rubro manual",
    icon: (__VLS_ctx.Plus),
    variant: "secondary",
    size: "sm",
}));
const __VLS_97 = __VLS_96({
    ...{ 'onClick': {} },
    label: "Rubro manual",
    icon: (__VLS_ctx.Plus),
    variant: "secondary",
    size: "sm",
}, ...__VLS_functionalComponentArgsRest(__VLS_96));
let __VLS_100;
const __VLS_101 = {
    /** @type {typeof __VLS_100.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.addManualDetail();
        // @ts-ignore
        [submit, rate, rate, rate, sourceImport, sourceImport, sourceImport, sourceImport, sourceImport, decisionInternationalLandFreight, decisionInternationalLandFreight, formatMoney, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, isHeaderLocked, catalogs, catalogs, catalogs, catalogs, catalogs, catalogs, catalogs, fieldError, fieldError, fieldError, fieldError, fieldError, fieldError, fieldError, Plus, addManualDetail,];
    },
};
var __VLS_98;
var __VLS_99;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5 space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
for (const [group] of __VLS_vFor((__VLS_ctx.groups))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        key: (group.key),
        ...{ class: "overflow-hidden rounded-[24px] border border-[var(--dh-border)]" },
    });
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "flex items-center justify-between bg-black/[0.035] px-4 py-3 dark:bg-white/[0.05]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (group.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (group.hint);
    let __VLS_102;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_103 = __VLS_asFunctionalComponent1(__VLS_102, new __VLS_102({
        label: (String(group.rows.length)),
        variant: "neutral",
    }));
    const __VLS_104 = __VLS_103({
        label: (String(group.rows.length)),
        variant: "neutral",
    }, ...__VLS_functionalComponentArgsRest(__VLS_103));
    if (group.rows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "divide-y divide-[var(--dh-border)]" },
        });
        /** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
        /** @type {__VLS_StyleScopedClasses['divide-[var(--dh-border)]']} */ ;
        for (const [detail] of __VLS_vFor((group.rows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                key: (detail.key),
                ...{ class: "p-4" },
            });
            /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "grid gap-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto] xl:items-start" },
            });
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]']} */ ;
            /** @type {__VLS_StyleScopedClasses['xl:items-start']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            let __VLS_107;
            /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
            DhInput;
            // @ts-ignore
            const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
                modelValue: (detail.name),
                label: "Concepto",
                placeholder: "Nombre del rubro",
                disabled: (detail.locked || Boolean(detail.costId) || detail.fixedDecisionCost),
            }));
            const __VLS_109 = __VLS_108({
                modelValue: (detail.name),
                label: "Concepto",
                placeholder: "Nombre del rubro",
                disabled: (detail.locked || Boolean(detail.costId) || detail.fixedDecisionCost),
            }, ...__VLS_functionalComponentArgsRest(__VLS_108));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap gap-1.5" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            let __VLS_112;
            /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
            DhBadge;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent1(__VLS_112, new __VLS_112({
                label: (detail.costType),
                variant: (detail.locked
                    ? 'neutral'
                    : detail.costType === 'Optional'
                        ? 'primary'
                        : 'warning'),
            }));
            const __VLS_114 = __VLS_113({
                label: (detail.costType),
                variant: (detail.locked
                    ? 'neutral'
                    : detail.costType === 'Optional'
                        ? 'primary'
                        : 'warning'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
            if (detail.locked) {
                let __VLS_117;
                /** @ts-ignore @type { | typeof __VLS_components.DhBadge | typeof __VLS_components.DhBadge} */
                DhBadge;
                // @ts-ignore
                const __VLS_118 = __VLS_asFunctionalComponent1(__VLS_117, new __VLS_117({
                    label: "Automático",
                    variant: "neutral",
                }));
                const __VLS_119 = __VLS_118({
                    label: "Automático",
                    variant: "neutral",
                }, ...__VLS_functionalComponentArgsRest(__VLS_118));
                const { default: __VLS_122 } = __VLS_120.slots;
                let __VLS_123;
                /** @ts-ignore @type { | typeof __VLS_components.LockKeyhole} */
                LockKeyhole;
                // @ts-ignore
                const __VLS_124 = __VLS_asFunctionalComponent1(__VLS_123, new __VLS_123({
                    ...{ class: "mr-1 h-3 w-3" },
                }));
                const __VLS_125 = __VLS_124({
                    ...{ class: "mr-1 h-3 w-3" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_124));
                /** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                // @ts-ignore
                [groups,];
                var __VLS_120;
            }
            if (detail.fixedDecisionCost) {
                let __VLS_128;
                /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
                DhBadge;
                // @ts-ignore
                const __VLS_129 = __VLS_asFunctionalComponent1(__VLS_128, new __VLS_128({
                    label: "Valor fijo del dashboard",
                    variant: "primary",
                }));
                const __VLS_130 = __VLS_129({
                    label: "Valor fijo del dashboard",
                    variant: "primary",
                }, ...__VLS_functionalComponentArgsRest(__VLS_129));
            }
            if (detail.notes.trim()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-2 rounded-xl bg-black/[0.035] px-3 py-2 text-xs font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.05]" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
                /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-black text-[var(--dh-text-soft)]" },
                });
                /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
                (detail.notes);
            }
            let __VLS_133;
            /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
            DhSelect;
            // @ts-ignore
            const __VLS_134 = __VLS_asFunctionalComponent1(__VLS_133, new __VLS_133({
                modelValue: (detail.costDetailType),
                label: "Rubro",
                options: (__VLS_ctx.detailTypeOptions),
                disabled: (detail.locked || Boolean(detail.costId) || detail.fixedDecisionCost),
            }));
            const __VLS_135 = __VLS_134({
                modelValue: (detail.costDetailType),
                label: "Rubro",
                options: (__VLS_ctx.detailTypeOptions),
                disabled: (detail.locked || Boolean(detail.costId) || detail.fixedDecisionCost),
            }, ...__VLS_functionalComponentArgsRest(__VLS_134));
            let __VLS_138;
            /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
            DhInput;
            // @ts-ignore
            const __VLS_139 = __VLS_asFunctionalComponent1(__VLS_138, new __VLS_138({
                modelValue: (detail.costAmount),
                type: "number",
                label: "Costo",
                placeholder: "0.00",
                disabled: (detail.importedFreight || detail.estimated || detail.fixedDecisionCost),
            }));
            const __VLS_140 = __VLS_139({
                modelValue: (detail.costAmount),
                type: "number",
                label: "Costo",
                placeholder: "0.00",
                disabled: (detail.importedFreight || detail.estimated || detail.fixedDecisionCost),
            }, ...__VLS_functionalComponentArgsRest(__VLS_139));
            let __VLS_143;
            /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
            DhInput;
            // @ts-ignore
            const __VLS_144 = __VLS_asFunctionalComponent1(__VLS_143, new __VLS_143({
                modelValue: (detail.saleAmount),
                type: "number",
                label: "Venta",
                placeholder: "0.00",
                disabled: (detail.costDetailType === 'AgentCharge' || detail.estimated),
            }));
            const __VLS_145 = __VLS_144({
                modelValue: (detail.saleAmount),
                type: "number",
                label: "Venta",
                placeholder: "0.00",
                disabled: (detail.costDetailType === 'AgentCharge' || detail.estimated),
            }, ...__VLS_functionalComponentArgsRest(__VLS_144));
            if (!detail.locked && !detail.importedFreight && !detail.fixedDecisionCost) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(group.rows.length))
                                return;
                            if (!(!detail.locked && !detail.importedFreight && !detail.fixedDecisionCost))
                                return;
                            __VLS_ctx.removeDetail(detail);
                            // @ts-ignore
                            [detailTypeOptions, removeDetail,];
                        } },
                    type: "button",
                    ...{ class: "mt-6 rounded-2xl p-2.5 text-red-500 transition hover:bg-red-500/10" },
                    title: "Quitar rubro",
                });
                /** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
                let __VLS_148;
                /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
                Trash2;
                // @ts-ignore
                const __VLS_149 = __VLS_asFunctionalComponent1(__VLS_148, new __VLS_148({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_150 = __VLS_149({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_149));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            if (!detail.costId && !detail.locked && !detail.fixedDecisionCost) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-3 grid gap-3 md:grid-cols-[180px_1fr]" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-[180px_1fr]']} */ ;
                let __VLS_153;
                /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
                DhSelect;
                // @ts-ignore
                const __VLS_154 = __VLS_asFunctionalComponent1(__VLS_153, new __VLS_153({
                    modelValue: (detail.costType),
                    label: "Aplicación",
                    options: (__VLS_ctx.editableTypeOptions),
                }));
                const __VLS_155 = __VLS_154({
                    modelValue: (detail.costType),
                    label: "Aplicación",
                    options: (__VLS_ctx.editableTypeOptions),
                }, ...__VLS_functionalComponentArgsRest(__VLS_154));
                let __VLS_158;
                /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
                DhTextarea;
                // @ts-ignore
                const __VLS_159 = __VLS_asFunctionalComponent1(__VLS_158, new __VLS_158({
                    modelValue: (detail.notes),
                    label: "Notas",
                    rows: (2),
                }));
                const __VLS_160 = __VLS_159({
                    modelValue: (detail.notes),
                    label: "Notas",
                    rows: (2),
                }, ...__VLS_functionalComponentArgsRest(__VLS_159));
            }
            if (__VLS_ctx.detailError(detail)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-2 text-xs font-semibold text-red-500" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
                (__VLS_ctx.detailError(detail));
            }
            // @ts-ignore
            [editableTypeOptions, detailError, detailError,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "px-4 py-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-6 border-t border-[var(--dh-border)] pt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
const __VLS_163 = PricingMultiSelect;
// @ts-ignore
const __VLS_164 = __VLS_asFunctionalComponent1(__VLS_163, new __VLS_163({
    modelValue: (__VLS_ctx.optionalCostIds),
    options: (__VLS_ctx.optionalOptions),
    label: "Costos opcionales",
    placeholder: "Seleccione costos opcionales",
}));
const __VLS_165 = __VLS_164({
    modelValue: (__VLS_ctx.optionalCostIds),
    options: (__VLS_ctx.optionalOptions),
    label: "Costos opcionales",
    placeholder: "Seleccione costos opcionales",
}, ...__VLS_functionalComponentArgsRest(__VLS_164));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "sticky bottom-0 z-20 rounded-[28px] border border-[var(--dh-border-strong)] bg-[var(--dh-shell-strong)] p-4 shadow-[var(--dh-shadow-lg)] backdrop-blur-2xl" },
});
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border-strong)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell-strong)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-lg)]']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-2xl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.formatMoney(__VLS_ctx.totalCost, __VLS_ctx.currencyName));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.formatMoney(__VLS_ctx.totalSale, __VLS_ctx.currencyName));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-lg font-black" },
    ...{ class: (__VLS_ctx.totalUtility >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.formatMoney(__VLS_ctx.totalUtility, __VLS_ctx.currencyName));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-lg font-black" },
    ...{ class: (__VLS_ctx.margin >= 12
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-amber-600 dark:text-amber-400') },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.margin.toFixed(2));
if (__VLS_ctx.margin < 12 && __VLS_ctx.totalSale > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-amber-200']} */ ;
    let __VLS_168;
    /** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
    AlertTriangle;
    // @ts-ignore
    const __VLS_169 = __VLS_asFunctionalComponent1(__VLS_168, new __VLS_168({
        ...{ class: "mt-0.5 h-4 w-4 shrink-0" },
    }));
    const __VLS_170 = __VLS_169({
        ...{ class: "mt-0.5 h-4 w-4 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_169));
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.minimumSale(__VLS_ctx.totalCost), __VLS_ctx.currencyName));
    (__VLS_ctx.canAutoApprove
        ? 'Su permiso aprobará automáticamente si decide guardar así.'
        : 'La tarifa quedará pendiente de aprobación.');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex flex-wrap justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_173;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_174 = __VLS_asFunctionalComponent1(__VLS_173, new __VLS_173({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}));
const __VLS_175 = __VLS_174({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_174));
let __VLS_178;
const __VLS_179 = {
    /** @type {typeof __VLS_178.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.drawerStore.close();
        // @ts-ignore
        [formatMoney, formatMoney, formatMoney, formatMoney, form, optionalCostIds, optionalOptions, totalCost, totalCost, currencyName, currencyName, currencyName, currencyName, totalSale, totalSale, totalUtility, totalUtility, margin, margin, margin, minimumSale, canAutoApprove, drawerStore,];
    },
};
var __VLS_176;
var __VLS_177;
let __VLS_180;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent1(__VLS_180, new __VLS_180({
    label: (__VLS_ctx.isEditing ? 'Guardar cambios' : 'Crear tarifa'),
    icon: (__VLS_ctx.isEditing ? __VLS_ctx.Save : __VLS_ctx.Ship),
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}));
const __VLS_182 = __VLS_181({
    label: (__VLS_ctx.isEditing ? 'Guardar cambios' : 'Crear tarifa'),
    icon: (__VLS_ctx.isEditing ? __VLS_ctx.Save : __VLS_ctx.Ship),
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_181));
// @ts-ignore
[form, isEditing, isEditing, Save, Ship,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
