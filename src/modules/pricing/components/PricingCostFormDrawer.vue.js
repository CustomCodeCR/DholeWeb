import { computed, onMounted, reactive, watch } from 'vue';
import { BadgeDollarSign, Info, Save } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { PricingService } from '@/core/services/pricingService';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { formatMoney } from '@/modules/pricing/utils/pricingFormat';
const props = defineProps();
const { locale, t } = useI18n();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const form = reactive({
    name: props.cost?.name ?? '',
    costType: (props.cost?.costType ?? 'Fixed'),
    costDetailType: (props.cost?.costDetailType ?? 'DestinationCharge'),
    associationType: (props.cost?.agentId ? 'Agent' : props.cost?.carrierId ? 'Carrier' : 'None'),
    carrierId: props.cost?.carrierId ?? '',
    agentId: props.cost?.agentId ?? '',
    portId: props.cost?.portId ?? '',
    portRole: (props.cost?.portRole ?? ''),
    currencyId: props.cost?.currencyId ?? '',
    costAmount: String(props.cost?.costAmount ?? ''),
    saleAmount: String(props.cost?.saleAmount ?? ''),
    notes: props.cost?.notes ?? '',
    saving: false,
    submitted: false,
});
const isAgentCost = computed(() => form.associationType === 'Agent');
const isCarrierCost = computed(() => form.associationType === 'Carrier');
const utility = computed(() => Number(form.saleAmount || 0) - Number(form.costAmount || 0));
const portOptions = computed(() => {
    if (form.portRole === 'Pol')
        return catalogs.polOptions.value;
    if (form.portRole === 'Poe')
        return catalogs.poeOptions.value;
    if (form.portRole === 'Pod')
        return catalogs.podOptions.value;
    return [
        ...catalogs.polOptions.value,
        ...catalogs.poeOptions.value,
        ...catalogs.podOptions.value,
    ].filter((option, index, values) => values.findIndex((item) => item.value === option.value) === index);
});
const costTypeOptions = [
    { label: 'Fijo automático', value: 'Fixed' },
    { label: 'Opcional', value: 'Optional' },
    { label: 'Variable', value: 'Variable' },
];
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
const portRoleOptions = [
    { label: 'Cualquier punto', value: 'Any' },
    { label: 'POL · Puerto de origen', value: 'Pol' },
    { label: 'POE · Puerto de entrada', value: 'Poe' },
    { label: 'POD · Destino final', value: 'Pod' },
];
const associationTypeOptions = [
    { label: 'Sin asociación', value: 'None' },
    { label: 'Naviera', value: 'Carrier' },
    { label: 'Agente', value: 'Agent' },
];
function fieldError(value, message) {
    return form.submitted && !value ? message : undefined;
}
function selected(items, id) {
    return items.find((item) => item.id === id);
}
watch(() => form.associationType, (associationType) => {
    if (associationType === 'Agent') {
        form.carrierId = '';
        form.costDetailType = 'AgentCharge';
        form.saleAmount = '0';
        return;
    }
    form.agentId = '';
    if (associationType === 'None')
        form.carrierId = '';
    if (form.costDetailType === 'AgentCharge')
        form.costDetailType = 'DestinationCharge';
});
watch(() => form.portRole, () => {
    if (!portOptions.value.some((option) => option.value === form.portId))
        form.portId = '';
});
async function submit() {
    form.submitted = true;
    const carrier = selected(catalogs.carriers.value, form.carrierId);
    const agent = selected(catalogs.agents.value, form.agentId);
    const port = selected([...catalogs.polPorts.value, ...catalogs.poePorts.value, ...catalogs.podPorts.value], form.portId);
    const currency = selected(catalogs.currencies.value, form.currencyId);
    if (!form.name.trim() ||
        !currency ||
        (isAgentCost.value && !agent) ||
        (isCarrierCost.value && !carrier) ||
        Number(form.costAmount) < 0 ||
        Number(form.saleAmount) < 0)
        return;
    const payload = {
        name: form.name.trim(),
        costType: form.costType,
        costDetailType: form.costDetailType,
        carrierId: carrier?.id ?? null,
        carrierName: carrier?.name ?? null,
        carrierCode: carrier?.code ?? null,
        agentId: agent?.id ?? null,
        agentName: agent?.name ?? null,
        agentCode: agent?.code ?? null,
        portId: port?.id ?? null,
        portName: port?.name ?? null,
        portCode: port?.code ?? null,
        portRole: port ? form.portRole || null : null,
        currencyId: currency.id,
        currencyName: currency.name,
        currencyCode: currency.code,
        costAmount: Number(form.costAmount),
        saleAmount: isAgentCost.value ? 0 : Number(form.saleAmount),
        notes: form.notes.trim() || null,
    };
    try {
        form.saving = true;
        if (props.cost)
            await PricingService.updateCost(props.cost.id, payload);
        else
            await PricingService.createCost(payload);
        toastStore.success(props.cost ? 'Costo actualizado' : 'Costo creado', 'La matriz de costos quedó actualizada.');
        drawerStore.close();
        await props.onSaved?.();
    }
    catch (error) {
        toastStore.backendError(error, props.cost ? 'No se pudo actualizar el costo.' : 'No se pudo crear el costo.');
    }
    finally {
        form.saving = false;
    }
}
onMounted(catalogs.loadAll);
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
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-5 flex items-start gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] dh-bg-primary-soft text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-11']} */ ;
/** @type {__VLS_StyleScopedClasses['w-11']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.BadgeDollarSign} */
BadgeDollarSign;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-5 w-5" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-medium text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.form.name),
    label: "Nombre",
    placeholder: "THC, handling, BL...",
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.name, 'Indique un nombre.')),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.form.name),
    label: "Nombre",
    placeholder: "THC, handling, BL...",
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.name, 'Indique un nombre.')),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.form.costType),
    label: "Aplicación",
    options: (__VLS_ctx.costTypeOptions),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.form.costType),
    label: "Aplicación",
    options: (__VLS_ctx.costTypeOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.form.costDetailType),
    label: "Rubro",
    options: (__VLS_ctx.detailTypeOptions),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.form.costDetailType),
    label: "Rubro",
    options: (__VLS_ctx.detailTypeOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.form.portRole),
    label: "Punto de aplicación",
    placeholder: "Sin puerto específico",
    options: ([{ label: 'Sin puerto específico', value: '' }, ...__VLS_ctx.portRoleOptions]),
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.form.portRole),
    label: "Punto de aplicación",
    placeholder: "Sin puerto específico",
    options: ([{ label: 'Sin puerto específico', value: '' }, ...__VLS_ctx.portRoleOptions]),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mb-5 mt-1 text-sm font-medium text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
let __VLS_25;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    modelValue: (__VLS_ctx.form.associationType),
    label: "Costo asociado a",
    options: (__VLS_ctx.associationTypeOptions),
}));
const __VLS_27 = __VLS_26({
    modelValue: (__VLS_ctx.form.associationType),
    label: "Costo asociado a",
    options: (__VLS_ctx.associationTypeOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
if (__VLS_ctx.isAgentCost) {
    let __VLS_30;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
        modelValue: (__VLS_ctx.form.agentId),
        label: "Agente",
        placeholder: "Seleccione agente",
        options: (__VLS_ctx.catalogs.agentOptions.value),
        error: (__VLS_ctx.fieldError(__VLS_ctx.form.agentId, 'Seleccione el agente.')),
    }));
    const __VLS_32 = __VLS_31({
        modelValue: (__VLS_ctx.form.agentId),
        label: "Agente",
        placeholder: "Seleccione agente",
        options: (__VLS_ctx.catalogs.agentOptions.value),
        error: (__VLS_ctx.fieldError(__VLS_ctx.form.agentId, 'Seleccione el agente.')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
}
else if (__VLS_ctx.isCarrierCost) {
    let __VLS_35;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
        modelValue: (__VLS_ctx.form.carrierId),
        label: "Naviera",
        placeholder: "Seleccione naviera",
        options: (__VLS_ctx.catalogs.carrierOptions.value),
        error: (__VLS_ctx.fieldError(__VLS_ctx.form.carrierId, 'Seleccione la naviera.')),
    }));
    const __VLS_37 = __VLS_36({
        modelValue: (__VLS_ctx.form.carrierId),
        label: "Naviera",
        placeholder: "Seleccione naviera",
        options: (__VLS_ctx.catalogs.carrierOptions.value),
        error: (__VLS_ctx.fieldError(__VLS_ctx.form.carrierId, 'Seleccione la naviera.')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
}
let __VLS_40;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.form.portId),
    label: "Puerto",
    placeholder: "Seleccione puerto",
    options: ([{ label: 'Sin puerto específico', value: '' }, ...__VLS_ctx.portOptions]),
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.form.portId),
    label: "Puerto",
    placeholder: "Seleccione puerto",
    options: ([{ label: 'Sin puerto específico', value: '' }, ...__VLS_ctx.portOptions]),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_45;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
    modelValue: (__VLS_ctx.form.currencyId),
    label: "Moneda",
    placeholder: "Seleccione moneda",
    options: (__VLS_ctx.catalogs.currencyOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.currencyId, 'Seleccione la moneda.')),
}));
const __VLS_47 = __VLS_46({
    modelValue: (__VLS_ctx.form.currencyId),
    label: "Moneda",
    placeholder: "Seleccione moneda",
    options: (__VLS_ctx.catalogs.currencyOptions.value),
    error: (__VLS_ctx.fieldError(__VLS_ctx.form.currencyId, 'Seleccione la moneda.')),
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex items-start gap-2 rounded-2xl bg-blue-500/10 p-3 text-sm font-semibold text-blue-700 dark:text-blue-300" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-500/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-blue-300']} */ ;
let __VLS_50;
/** @ts-ignore @type { | typeof __VLS_components.Info} */
Info;
// @ts-ignore
const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
    ...{ class: "mt-0.5 h-4 w-4 shrink-0" },
}));
const __VLS_52 = __VLS_51({
    ...{ class: "mt-0.5 h-4 w-4 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_51));
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
if (__VLS_ctx.form.costType === 'Fixed') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (__VLS_ctx.form.costType === 'Optional') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
let __VLS_55;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
    modelValue: (__VLS_ctx.form.costAmount),
    type: "number",
    label: "Costo",
    placeholder: "0.00",
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.costAmount) < 0
        ? 'El costo no puede ser negativo.'
        : undefined),
}));
const __VLS_57 = __VLS_56({
    modelValue: (__VLS_ctx.form.costAmount),
    type: "number",
    label: "Costo",
    placeholder: "0.00",
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.costAmount) < 0
        ? 'El costo no puede ser negativo.'
        : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_60;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.form.saleAmount),
    type: "number",
    label: "Venta",
    placeholder: "0.00",
    disabled: (__VLS_ctx.isAgentCost),
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.saleAmount) < 0
        ? 'La venta no puede ser negativa.'
        : undefined),
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.form.saleAmount),
    type: "number",
    label: "Venta",
    placeholder: "0.00",
    disabled: (__VLS_ctx.isAgentCost),
    error: (__VLS_ctx.form.submitted && Number(__VLS_ctx.form.saleAmount) < 0
        ? 'La venta no puede ser negativa.'
        : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex items-center justify-between rounded-2xl bg-black/[0.035] px-4 py-3 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-black" },
    ...{ class: (__VLS_ctx.utility >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') },
});
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.formatMoney(__VLS_ctx.utility, __VLS_ctx.catalogs.findById(__VLS_ctx.catalogs.currencies.value, __VLS_ctx.form.currencyId)?.code || 'USD', __VLS_ctx.locale === 'en' ? 'en-US' : 'es-CR'));
if (__VLS_ctx.isAgentCost) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
let __VLS_65;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
    modelValue: (__VLS_ctx.form.notes),
    label: "Notas",
    placeholder: "Condiciones, alcance o evidencia del costo...",
}));
const __VLS_67 = __VLS_66({
    modelValue: (__VLS_ctx.form.notes),
    label: "Notas",
    placeholder: "Condiciones, alcance o evidencia del costo...",
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sticky bottom-0 flex justify-end gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-shell-strong)] py-4 backdrop-blur-xl" },
});
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell-strong)]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-xl']} */ ;
let __VLS_70;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}));
const __VLS_72 = __VLS_71({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_71));
let __VLS_75;
const __VLS_76 = {
    /** @type {typeof __VLS_75.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.drawerStore.close();
        // @ts-ignore
        [submit, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, form, fieldError, fieldError, fieldError, fieldError, costTypeOptions, detailTypeOptions, portRoleOptions, associationTypeOptions, isAgentCost, isAgentCost, isAgentCost, catalogs, catalogs, catalogs, catalogs, catalogs, isCarrierCost, portOptions, utility, utility, formatMoney, locale, drawerStore,];
    },
};
var __VLS_73;
var __VLS_74;
let __VLS_77;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_78 = __VLS_asFunctionalComponent1(__VLS_77, new __VLS_77({
    label: (props.cost ? __VLS_ctx.t('common.save') : 'Crear costo'),
    icon: (__VLS_ctx.Save),
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}));
const __VLS_79 = __VLS_78({
    label: (props.cost ? __VLS_ctx.t('common.save') : 'Crear costo'),
    icon: (__VLS_ctx.Save),
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_78));
// @ts-ignore
[form, t, Save,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
