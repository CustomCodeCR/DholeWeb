import { computed, onMounted, ref } from 'vue';
import { CheckCircle2, Copy, Edit3, Printer, RefreshCw, Route, Send as SendIcon, ShieldCheck, XCircle, } from 'lucide-vue-next';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { useAuthStore } from '@/core/stores/authStore';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { PRICING_SCOPES } from '@/core/auth/scopes';
import { PricingService } from '@/core/services/pricingService';
import PricingRateFormDrawer from './PricingRateFormDrawer.vue';
import PricingReasonModal from './PricingReasonModal.vue';
import PricingDuplicateRateModal from './PricingDuplicateRateModal.vue';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { detailGroup, formatDate, formatMoney, marginTone, routeLabel, statusTone, } from '@/modules/pricing/utils/pricingFormat';
const props = defineProps();
const authStore = useAuthStore();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const current = ref(props.rate);
const displayCurrent = computed(() => catalogs.resolveRateLabels(current.value));
const loading = ref(false);
const costNotesById = ref({});
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update));
const canDuplicate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create));
const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin));
const groups = computed(() => {
    const byGroup = (key) => current.value.rateDetails.filter((detail) => detailGroup(detail.costDetailType) === key);
    return [
        { key: 'agent', title: 'Costos de agente', subtitle: 'Sin venta', rows: byGroup('agent') },
        {
            key: 'freight',
            title: 'Flete internacional',
            subtitle: 'Costo y venta marítima',
            rows: byGroup('freight'),
        },
        {
            key: 'destination',
            title: 'Costos de destino',
            subtitle: 'POE, POD y transporte interno',
            rows: byGroup('destination'),
        },
        { key: 'other', title: 'Otros rubros', subtitle: 'Cargos adicionales', rows: byGroup('other') },
    ];
});
function statusLabel(status) {
    return ({
        Approved: 'Aprobada',
        PendingApproval: 'Pendiente de autorización',
        Rejected: 'Rechazada internamente',
        Draft: 'Borrador',
        Sent: 'Enviada',
        AcceptedByClient: 'Aceptada por el cliente',
        RejectedByClient: 'Rechazada por el cliente',
    }[status] ?? status);
}
async function reload() {
    try {
        loading.value = true;
        current.value = await PricingService.getRate(current.value.id);
        await loadMissingCostNotes(current.value.rateDetails);
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo actualizar el detalle de la tarifa.');
    }
    finally {
        loading.value = false;
    }
}
function resolvedDetailNotes(detail) {
    return detail.notes?.trim() || (detail.costId ? costNotesById.value[detail.costId] : '') || '';
}
async function loadMissingCostNotes(details) {
    const missingCostIds = [
        ...new Set(details
            .filter((detail) => detail.costId &&
            !detail.notes?.trim() &&
            !costNotesById.value[detail.costId])
            .map((detail) => detail.costId)),
    ];
    if (!missingCostIds.length)
        return;
    const results = await Promise.allSettled(missingCostIds.map(async (costId) => ({ costId, cost: await PricingService.getCost(costId) })));
    const next = { ...costNotesById.value };
    for (const result of results) {
        if (result.status !== 'fulfilled')
            continue;
        const notes = result.value.cost.notes?.trim();
        if (notes)
            next[result.value.costId] = notes;
    }
    costNotesById.value = next;
}
function edit() {
    drawerStore.open({
        title: 'Editar tarifa',
        component: PricingRateFormDrawer,
        size: 'full',
        props: {
            rate: current.value,
            onSaved: async () => {
                await props.onSaved?.();
            },
        },
    });
}
function duplicate() {
    modalStore.open({
        title: 'Duplicar tarifa',
        component: PricingDuplicateRateModal,
        props: { rate: current.value, onSaved: props.onSaved },
    });
}
function reject() {
    modalStore.open({
        title: 'Rechazar autorización de margen',
        component: PricingReasonModal,
        props: {
            target: 'margin',
            id: current.value.id,
            onSaved: async () => {
                await reload();
                await props.onSaved?.();
            },
        },
    });
}
async function approve() {
    try {
        await PricingService.approveRateMargin(current.value.id);
        toastStore.success('Margen aprobado', 'La tarifa quedó aprobada y lista para uso operativo.');
        await reload();
        await props.onSaved?.();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo aprobar el margen.');
    }
}
async function setCommercialStatus(status) {
    try {
        await PricingService.setRateStatus(current.value.id, { status });
        toastStore.success('Estado actualizado', `La tarifa quedó ${statusLabel(status).toLowerCase()}.`);
        await reload();
        await props.onSaved?.();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo actualizar el estado comercial de la tarifa.');
    }
}
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
function printRate() {
    const rate = displayCurrent.value;
    const rows = rate.rateDetails
        .filter((detail) => detail.saleAmount > 0 || detail.costDetailType === 'AgentCharge')
        .map((detail) => `
      <tr>
        <td><strong>${escapeHtml(detail.name)}</strong>${resolvedDetailNotes(detail) ? `<div class="note">${escapeHtml(resolvedDetailNotes(detail))}</div>` : ''}</td>
        <td>${escapeHtml(detail.costDetailType)}</td>
        <td class="number">${escapeHtml(formatMoney(detail.costAmount, detail.currencyName))}</td>
        <td class="number">${escapeHtml(formatMoney(detail.saleAmount, detail.currencyName))}</td>
      </tr>`)
        .join('');
    const win = window.open('', '_blank', 'width=1000,height=760');
    if (!win) {
        toastStore.warning('Impresión bloqueada', 'Permita ventanas emergentes para generar la cotización rápida.');
        return;
    }
    win.opener = null;
    win.document
        .write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(rate.rateName || rate.rateCode)}</title><style>
    *{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#171717;margin:0;padding:38px;background:#fff}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #fc2800;padding-bottom:22px}.brand{font-size:28px;font-weight:900}.brand span{color:#fc2800}.muted{color:#737373;font-size:12px}.route{margin:26px 0;padding:22px;border-radius:18px;background:#f5f5f5}.route h1{margin:0 0 8px;font-size:24px}.rate-name{font-size:18px;font-weight:900;margin-top:8px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card{border:1px solid #e5e5e5;border-radius:14px;padding:14px}.card small{display:block;color:#737373;text-transform:uppercase;font-weight:800;letter-spacing:.08em}.card strong{display:block;margin-top:6px;font-size:17px}table{width:100%;border-collapse:collapse;margin-top:22px}th{background:#171717;color:white;text-align:left;padding:12px;font-size:11px;text-transform:uppercase;letter-spacing:.08em}td{padding:12px;border-bottom:1px solid #e5e5e5;font-size:13px;vertical-align:top}.note{margin-top:5px;color:#737373;font-size:11px;white-space:pre-line}.number{text-align:right}.totals{margin:24px 0 0 auto;width:380px;border-top:3px solid #171717}.total-row{display:flex;justify-content:space-between;padding:9px 0;font-weight:700}.total-row.primary{font-size:18px;color:#fc2800}.footer{margin-top:34px;padding-top:18px;border-top:1px solid #e5e5e5;color:#737373;font-size:11px}@media print{body{padding:20px}.no-print{display:none}}
  </style></head><body>
    <div class="header"><div><div class="brand">Dhole <span>Pricing</span></div><div class="rate-name">${escapeHtml(rate.rateName || rate.rateCode)}</div><div class="muted">Resumen de tarifa FCL · ${escapeHtml(rate.rateCode)}</div></div><div class="muted">Emitida: ${escapeHtml(new Date().toLocaleDateString('es-CR'))}<br>IDTRA: ${escapeHtml(rate.idtraNumber || '—')}<br>QUO: ${escapeHtml(rate.quoNumber || '—')}</div></div>
    <section class="route"><h1>${escapeHtml(routeLabel(rate))}</h1><div>${escapeHtml(rate.carrierName)} · ${escapeHtml(rate.containerTypeName)} · Agente: ${escapeHtml(rate.agentName)}</div></section>
    <div class="grid"><div class="card"><small>Vigencia</small><strong>${escapeHtml(formatDate(rate.validFrom))} – ${escapeHtml(formatDate(rate.validTo))}</strong></div><div class="card"><small>Días libres</small><strong>${escapeHtml(rate.freeDays)}</strong></div><div class="card"><small>Tránsito</small><strong>${escapeHtml(rate.transitDays ?? '—')} días</strong></div><div class="card"><small>Estado</small><strong>${escapeHtml(statusLabel(rate.status))}</strong></div></div>
    <table><thead><tr><th>Concepto</th><th>Rubro</th><th class="number">Costo</th><th class="number">Venta</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div class="total-row"><span>Costo total</span><span>${escapeHtml(formatMoney(rate.totalCostAmount, rate.currencyName))}</span></div><div class="total-row primary"><span>Venta total</span><span>${escapeHtml(formatMoney(rate.totalSaleAmount, rate.currencyName))}</span></div><div class="total-row"><span>Utilidad general</span><span>${escapeHtml(formatMoney(rate.totalUtilityAmount, rate.currencyName))}</span></div></div>
    <section class="route"><strong>Tarifa incluye</strong><p>${escapeHtml(rate.includes || '—')}</p><strong>Sujeto a</strong><p>${escapeHtml(rate.subjectTo || '—')}</p><strong>No incluye</strong><p>${escapeHtml(rate.excludes || '—')}</p></section>
    <div class="footer">Tarifa sujeta a vigencia, espacio, disponibilidad y condiciones operativas de origen y destino.</div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
  </body></html>`);
    win.document.close();
}
onMounted(async () => {
    await catalogs.loadAll();
    await reload();
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-liquid overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    label: (__VLS_ctx.statusLabel(__VLS_ctx.current.status)),
    variant: (__VLS_ctx.statusTone(__VLS_ctx.current.status)),
}));
const __VLS_2 = __VLS_1({
    label: (__VLS_ctx.statusLabel(__VLS_ctx.current.status)),
    variant: (__VLS_ctx.statusTone(__VLS_ctx.current.status)),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.current.sourceImportFclRateId) {
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        label: "Desde importación",
        variant: "primary",
    }));
    const __VLS_7 = __VLS_6({
        label: "Desde importación",
        variant: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex items-center gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-12 w-12 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.Route} */
Route;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "h-5 w-5" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-2xl font-black tracking-tight text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.current.rateName || __VLS_ctx.current.rateCode);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.routeLabel(__VLS_ctx.displayCurrent));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.displayCurrent.carrierName);
(__VLS_ctx.displayCurrent.containerTypeName);
(__VLS_ctx.displayCurrent.agentName);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.08em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
(__VLS_ctx.current.rateCode);
if (__VLS_ctx.current.idtraNumber) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.current.idtraNumber);
}
if (__VLS_ctx.current.quoNumber) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.current.quoNumber);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    ...{ 'onClick': {} },
    label: "Imprimir",
    icon: (__VLS_ctx.Printer),
    variant: "secondary",
    size: "sm",
}));
const __VLS_17 = __VLS_16({
    ...{ 'onClick': {} },
    label: "Imprimir",
    icon: (__VLS_ctx.Printer),
    variant: "secondary",
    size: "sm",
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
const __VLS_21 = {
    /** @type {typeof __VLS_20.click} */
    onClick: (__VLS_ctx.printRate),
};
var __VLS_18;
var __VLS_19;
if (__VLS_ctx.canDuplicate) {
    let __VLS_22;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
        ...{ 'onClick': {} },
        label: "Duplicar",
        icon: (__VLS_ctx.Copy),
        variant: "secondary",
        size: "sm",
    }));
    const __VLS_24 = __VLS_23({
        ...{ 'onClick': {} },
        label: "Duplicar",
        icon: (__VLS_ctx.Copy),
        variant: "secondary",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    let __VLS_27;
    const __VLS_28 = {
        /** @type {typeof __VLS_27.click} */
        onClick: (__VLS_ctx.duplicate),
    };
    var __VLS_25;
    var __VLS_26;
}
if (__VLS_ctx.canUpdate) {
    let __VLS_29;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
        ...{ 'onClick': {} },
        label: "Editar",
        icon: (__VLS_ctx.Edit3),
        size: "sm",
    }));
    const __VLS_31 = __VLS_30({
        ...{ 'onClick': {} },
        label: "Editar",
        icon: (__VLS_ctx.Edit3),
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    let __VLS_34;
    const __VLS_35 = {
        /** @type {typeof __VLS_34.click} */
        onClick: (__VLS_ctx.edit),
    };
    var __VLS_32;
    var __VLS_33;
}
if (__VLS_ctx.canUpdate && __VLS_ctx.current.status === 'Approved') {
    let __VLS_36;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        ...{ 'onClick': {} },
        label: "Marcar enviada",
        icon: (__VLS_ctx.SendIcon),
        variant: "secondary",
        size: "sm",
    }));
    const __VLS_38 = __VLS_37({
        ...{ 'onClick': {} },
        label: "Marcar enviada",
        icon: (__VLS_ctx.SendIcon),
        variant: "secondary",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_41;
    const __VLS_42 = {
        /** @type {typeof __VLS_41.click} */
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.canUpdate && __VLS_ctx.current.status === 'Approved'))
                return;
            __VLS_ctx.setCommercialStatus('Sent');
            // @ts-ignore
            [statusLabel, current, current, current, current, current, current, current, current, current, current, current, statusTone, routeLabel, displayCurrent, displayCurrent, displayCurrent, displayCurrent, Printer, printRate, canDuplicate, Copy, duplicate, canUpdate, canUpdate, Edit3, edit, SendIcon, setCommercialStatus,];
        },
    };
    var __VLS_39;
    var __VLS_40;
}
if (__VLS_ctx.canUpdate && __VLS_ctx.current.status === 'Sent') {
    let __VLS_43;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent1(__VLS_43, new __VLS_43({
        ...{ 'onClick': {} },
        label: "Aceptada por cliente",
        icon: (__VLS_ctx.CheckCircle2),
        size: "sm",
    }));
    const __VLS_45 = __VLS_44({
        ...{ 'onClick': {} },
        label: "Aceptada por cliente",
        icon: (__VLS_ctx.CheckCircle2),
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_44));
    let __VLS_48;
    const __VLS_49 = {
        /** @type {typeof __VLS_48.click} */
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.canUpdate && __VLS_ctx.current.status === 'Sent'))
                return;
            __VLS_ctx.setCommercialStatus('AcceptedByClient');
            // @ts-ignore
            [current, canUpdate, setCommercialStatus, CheckCircle2,];
        },
    };
    var __VLS_46;
    var __VLS_47;
}
if (__VLS_ctx.canUpdate && __VLS_ctx.current.status === 'Sent') {
    let __VLS_50;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
        ...{ 'onClick': {} },
        label: "Rechazada por cliente",
        icon: (__VLS_ctx.XCircle),
        variant: "danger",
        size: "sm",
    }));
    const __VLS_52 = __VLS_51({
        ...{ 'onClick': {} },
        label: "Rechazada por cliente",
        icon: (__VLS_ctx.XCircle),
        variant: "danger",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    let __VLS_55;
    const __VLS_56 = {
        /** @type {typeof __VLS_55.click} */
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.canUpdate && __VLS_ctx.current.status === 'Sent'))
                return;
            __VLS_ctx.setCommercialStatus('RejectedByClient');
            // @ts-ignore
            [current, canUpdate, setCommercialStatus, XCircle,];
        },
    };
    var __VLS_53;
    var __VLS_54;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.reload) },
    type: "button",
    ...{ class: "rounded-2xl p-2.5 text-[var(--dh-text-muted)] hover:bg-[var(--dh-card-hover)]" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
let __VLS_57;
/** @ts-ignore @type { | typeof __VLS_components.RefreshCw} */
RefreshCw;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.loading && 'animate-spin') },
}));
const __VLS_59 = __VLS_58({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.loading && 'animate-spin') },
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
if (__VLS_ctx.current.status === 'PendingApproval') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[26px] border border-amber-500/20 bg-amber-500/10 p-5" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start gap-3 text-amber-900 dark:text-amber-100" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-900']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-amber-100']} */ ;
    let __VLS_62;
    /** @ts-ignore @type { | typeof __VLS_components.ShieldCheck} */
    ShieldCheck;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
    }));
    const __VLS_64 = __VLS_63({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
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
    if (__VLS_ctx.canApprove) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        let __VLS_67;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
            ...{ 'onClick': {} },
            label: "Rechazar",
            icon: (__VLS_ctx.XCircle),
            variant: "secondary",
            size: "sm",
        }));
        const __VLS_69 = __VLS_68({
            ...{ 'onClick': {} },
            label: "Rechazar",
            icon: (__VLS_ctx.XCircle),
            variant: "secondary",
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_68));
        let __VLS_72;
        const __VLS_73 = {
            /** @type {typeof __VLS_72.click} */
            onClick: (__VLS_ctx.reject),
        };
        var __VLS_70;
        var __VLS_71;
        let __VLS_74;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_75 = __VLS_asFunctionalComponent1(__VLS_74, new __VLS_74({
            ...{ 'onClick': {} },
            label: "Aprobar margen",
            icon: (__VLS_ctx.CheckCircle2),
            size: "sm",
        }));
        const __VLS_76 = __VLS_75({
            ...{ 'onClick': {} },
            label: "Aprobar margen",
            icon: (__VLS_ctx.CheckCircle2),
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_75));
        let __VLS_79;
        const __VLS_80 = {
            /** @type {typeof __VLS_79.click} */
            onClick: (__VLS_ctx.approve),
        };
        var __VLS_77;
        var __VLS_78;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
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
    ...{ class: "mt-2 text-xl font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.formatMoney(__VLS_ctx.current.totalCostAmount, __VLS_ctx.displayCurrent.currencyName));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
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
    ...{ class: "mt-2 text-xl font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.formatMoney(__VLS_ctx.current.totalSaleAmount, __VLS_ctx.displayCurrent.currencyName));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
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
    ...{ class: "mt-2 text-xl font-black" },
    ...{ class: (__VLS_ctx.current.totalUtilityAmount >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-500') },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.formatMoney(__VLS_ctx.current.totalUtilityAmount, __VLS_ctx.displayCurrent.currencyName));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xl font-black" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.current.marginPercentage.toFixed(2));
let __VLS_81;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_82 = __VLS_asFunctionalComponent1(__VLS_81, new __VLS_81({
    label: (__VLS_ctx.current.marginPercentage >= 12 ? 'En objetivo' : 'Bajo'),
    variant: (__VLS_ctx.marginTone(__VLS_ctx.current.marginPercentage)),
}));
const __VLS_83 = __VLS_82({
    label: (__VLS_ctx.current.marginPercentage >= 12 ? 'En objetivo' : 'Bajo'),
    variant: (__VLS_ctx.marginTone(__VLS_ctx.current.marginPercentage)),
}, ...__VLS_functionalComponentArgsRest(__VLS_82));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.displayCurrent.polName);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.displayCurrent.poeName);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.displayCurrent.podName);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-black/[0.035] p-4 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.formatDate(__VLS_ctx.current.validFrom));
(__VLS_ctx.formatDate(__VLS_ctx.current.validTo));
(__VLS_ctx.current.freeDays);
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.current.clientName || '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.current.containerQuantity);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.current.transitDays != null ? `${__VLS_ctx.current.transitDays} días` : '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.statusLabel(__VLS_ctx.current.status));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5 grid gap-4 lg:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[20px] bg-black/[0.035] p-4 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 whitespace-pre-line text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.current.includes || '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[20px] bg-black/[0.035] p-4 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 whitespace-pre-line text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.current.subjectTo || '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[20px] bg-black/[0.035] p-4 dark:bg-white/[0.05]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 whitespace-pre-line text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.current.excludes || '—');
for (const [group] of __VLS_vFor((__VLS_ctx.groups))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        key: (group.key),
        ...{ class: "overflow-hidden rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)]" },
    });
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "flex items-center justify-between bg-black/[0.035] px-5 py-4 dark:bg-white/[0.05]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (group.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (group.subtitle);
    let __VLS_86;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_87 = __VLS_asFunctionalComponent1(__VLS_86, new __VLS_86({
        label: (String(group.rows.length)),
        variant: "neutral",
    }));
    const __VLS_88 = __VLS_87({
        label: (String(group.rows.length)),
        variant: "neutral",
    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
    if (group.rows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "w-full min-w-[680px] text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-[680px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            ...{ class: "text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "px-5 py-3 text-left" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "px-5 py-3 text-left" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "px-5 py-3 text-right" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "px-5 py-3 text-right" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "px-5 py-3 text-right" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [detail] of __VLS_vFor((group.rows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (detail.id),
                ...{ class: "border-t border-[var(--dh-border)]" },
            });
            /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "px-5 py-4" },
            });
            /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "font-black text-[var(--dh-text)]" },
            });
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
            (detail.name);
            if (__VLS_ctx.resolvedDetailNotes(detail)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-1 max-w-xl whitespace-pre-line text-xs font-medium text-[var(--dh-text-muted)]" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['max-w-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-black text-[var(--dh-text-soft)]" },
                });
                /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
                (__VLS_ctx.resolvedDetailNotes(detail));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "px-5 py-4" },
            });
            /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
            let __VLS_91;
            /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
            DhBadge;
            // @ts-ignore
            const __VLS_92 = __VLS_asFunctionalComponent1(__VLS_91, new __VLS_91({
                label: (detail.costType),
                variant: (detail.costType === 'Fixed'
                    ? 'neutral'
                    : detail.costType === 'Optional'
                        ? 'primary'
                        : 'warning'),
            }));
            const __VLS_93 = __VLS_92({
                label: (detail.costType),
                variant: (detail.costType === 'Fixed'
                    ? 'neutral'
                    : detail.costType === 'Optional'
                        ? 'primary'
                        : 'warning'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_92));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "px-5 py-4 text-right font-bold" },
            });
            /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
            (__VLS_ctx.formatMoney(detail.costAmount, detail.currencyName));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "px-5 py-4 text-right font-bold" },
            });
            /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
            (__VLS_ctx.formatMoney(detail.saleAmount, detail.currencyName));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "px-5 py-4 text-right font-black" },
                ...{ class: (detail.utilityAmount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500') },
            });
            /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            (__VLS_ctx.formatMoney(detail.utilityAmount, detail.currencyName));
            // @ts-ignore
            [statusLabel, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, displayCurrent, displayCurrent, displayCurrent, displayCurrent, displayCurrent, displayCurrent, CheckCircle2, XCircle, reload, loading, loading, canApprove, reject, approve, formatMoney, formatMoney, formatMoney, formatMoney, formatMoney, formatMoney, marginTone, formatDate, formatDate, groups, resolvedDetailNotes, resolvedDetailNotes,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "px-5 py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-8']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
