import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Copy, Edit3, Eye, Plus, ReceiptText, Trash2 } from 'lucide-vue-next';
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms';
import { DhCrudToolbar, DhDataTable, DhPagination, } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { useAuthStore } from '@/core/stores/authStore';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
import { PRICING_SCOPES } from '@/core/auth/scopes';
import { PricingService } from '@/core/services/pricingService';
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue';
import PricingRateDetailDrawer from '@/modules/pricing/components/PricingRateDetailDrawer.vue';
import PricingDuplicateRateModal from '@/modules/pricing/components/PricingDuplicateRateModal.vue';
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { formatDate, formatMoney, marginTone, routeLabel, statusTone, } from '@/modules/pricing/utils/pricingFormat';
const authStore = useAuthStore();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const displayRate = (rate) => catalogs.resolveRateLabels(rate);
const rows = ref([]);
const selectedIds = ref([]);
const loading = ref(false);
const filtersOpen = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const filters = reactive({
    search: '',
    status: '',
    approval: '',
    agentId: '',
    carrierId: '',
    polId: '',
    poeId: '',
    podId: '',
    containerTypeId: '',
    currencyId: '',
    idtraNumber: '',
    quoNumber: '',
    quoteDate: '',
    validFrom: '',
    validTo: '',
});
const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create));
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update));
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete));
const columns = [
    { key: 'selected', label: '', width: '48px', align: 'center' },
    { key: 'route', label: 'Tarifa / ruta' },
    { key: 'agentName', label: 'Agente' },
    { key: 'carrierName', label: 'Naviera / contenedor' },
    { key: 'totalCostAmount', label: 'Costo', align: 'right' },
    { key: 'totalSaleAmount', label: 'Venta', align: 'right' },
    { key: 'totalUtilityAmount', label: 'Utilidad', align: 'right' },
    { key: 'marginPercentage', label: 'Margen', align: 'right' },
    { key: 'status', label: 'Estado', align: 'center' },
    { key: 'actions', label: '', align: 'right', width: '130px' },
];
const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Aprobadas', value: 'Approved' },
    { label: 'Pendientes de autorización', value: 'PendingApproval' },
    { label: 'Borradores', value: 'Draft' },
    { label: 'Rechazadas internamente', value: 'Rejected' },
    { label: 'Enviadas', value: 'Sent' },
    { label: 'Aceptadas por el cliente', value: 'AcceptedByClient' },
    { label: 'Rechazadas por el cliente', value: 'RejectedByClient' },
];
const approvalOptions = [
    { label: 'Todas', value: '' },
    { label: 'Requieren aprobación', value: 'true' },
    { label: 'Sin aprobación pendiente', value: 'false' },
];
function statusLabel(status) {
    return ({
        Approved: 'Aprobada',
        PendingApproval: 'Pendiente',
        Draft: 'Borrador',
        Rejected: 'Rechazada internamente',
        Sent: 'Enviada',
        AcceptedByClient: 'Aceptada por el cliente',
        RejectedByClient: 'Rechazada por el cliente',
    }[status] ?? status);
}
async function load() {
    try {
        loading.value = true;
        const result = await PricingService.browseRates({
            pageNumber: page.value,
            pageSize: pageSize.value,
            search: filters.search || undefined,
            status: filters.status || undefined,
            requiredApproval: filters.approval === '' ? undefined : filters.approval === 'true',
            agentId: filters.agentId || undefined,
            carrierId: filters.carrierId || undefined,
            polId: filters.polId || undefined,
            poeId: filters.poeId || undefined,
            podId: filters.podId || undefined,
            containerTypeId: filters.containerTypeId || undefined,
            currencyId: filters.currencyId || undefined,
            idtraNumber: filters.idtraNumber || undefined,
            quoNumber: filters.quoNumber || undefined,
            quoteDate: filters.quoteDate || undefined,
            validFrom: filters.validFrom || undefined,
            validTo: filters.validTo || undefined,
        });
        rows.value = result.items;
        total.value = result.totalCount ?? result.items.length;
        selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id));
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron cargar las tarifas.');
    }
    finally {
        loading.value = false;
    }
}
function applyFilters() {
    page.value = 1;
    load();
}
function clearFilters() {
    Object.assign(filters, {
        search: '',
        status: '',
        approval: '',
        agentId: '',
        carrierId: '',
        polId: '',
        poeId: '',
        podId: '',
        containerTypeId: '',
        currencyId: '',
        idtraNumber: '',
        quoNumber: '',
        quoteDate: '',
        validFrom: '',
        validTo: '',
    });
    applyFilters();
}
function toggleSelection(id) {
    selectedIds.value = selectedIds.value.includes(id)
        ? selectedIds.value.filter((item) => item !== id)
        : [...selectedIds.value, id];
}
function openCreate() {
    drawerStore.open({
        title: 'Crear tarifa manual',
        component: PricingRateFormDrawer,
        size: 'full',
        props: { onSaved: load },
    });
}
function openDetail(rate) {
    drawerStore.open({
        title: rate.rateName || `Tarifa · ${routeLabel(displayRate(rate))}`,
        component: PricingRateDetailDrawer,
        size: 'xl',
        props: { rate, onSaved: load },
    });
}
function openEdit(rate) {
    drawerStore.open({
        title: `Editar · ${rate.rateName || rate.rateCode}`,
        component: PricingRateFormDrawer,
        size: 'full',
        props: { rate, onSaved: load },
    });
}
function duplicate(rate) {
    modalStore.open({
        title: 'Duplicar tarifa',
        component: PricingDuplicateRateModal,
        props: { rate, onSaved: load },
    });
}
function confirmDelete() {
    if (!selectedIds.value.length)
        return;
    modalStore.open({
        title: 'Eliminar tarifas',
        component: DhConfirmDialog,
        props: {
            title: 'Eliminar tarifas',
            message: `¿Desea eliminar ${selectedIds.value.length} tarifa${selectedIds.value.length === 1 ? '' : 's'}? Esta acción conserva la trazabilidad de auditoría.`,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true,
            onConfirm: async () => {
                await PricingService.deleteRates(selectedIds.value);
                selectedIds.value = [];
                modalStore.close();
                toastStore.success('Tarifas eliminadas');
                await load();
            },
            onCancel: modalStore.close,
        },
    });
}
watch([page, pageSize], load);
useViewShortcuts({
    create: () => {
        if (canCreate.value)
            openCreate();
    },
    save: load,
    refresh: load,
});
onMounted(async () => {
    await catalogs.loadAll();
    await load();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhPageHeader | typeof __VLS_components.DhPageHeader} */
DhPageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: "Tarifas",
    subtitle: "Construya y revise tarifas FCL con costo, venta, utilidad y margen en una sola vista.",
    icon: (__VLS_ctx.ReceiptText),
}));
const __VLS_2 = __VLS_1({
    title: "Tarifas",
    subtitle: "Construya y revise tarifas FCL con costo, venta, utilidad y margen en una sola vista.",
    icon: (__VLS_ctx.ReceiptText),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.canCreate) {
    {
        const { actions: __VLS_6 } = __VLS_3.slots;
        let __VLS_7;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            ...{ 'onClick': {} },
            label: "Crear tarifa manual",
            icon: (__VLS_ctx.Plus),
        }));
        const __VLS_9 = __VLS_8({
            ...{ 'onClick': {} },
            label: "Crear tarifa manual",
            icon: (__VLS_ctx.Plus),
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        let __VLS_12;
        const __VLS_13 = {
            /** @type {typeof __VLS_12.click} */
            onClick: (__VLS_ctx.openCreate),
        };
        var __VLS_10;
        var __VLS_11;
        // @ts-ignore
        [ReceiptText, canCreate, Plus, openCreate,];
    }
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
let __VLS_14;
/** @ts-ignore @type { | typeof __VLS_components.DhCrudToolbar | typeof __VLS_components.DhCrudToolbar} */
DhCrudToolbar;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onSearch': {} },
    ...{ 'onFilter': {} },
    search: (__VLS_ctx.filters.search),
    title: "Tarifas oficiales",
    createLabel: "Crear tarifa",
    showCreate: (__VLS_ctx.canCreate),
}));
const __VLS_16 = __VLS_15({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onSearch': {} },
    ...{ 'onFilter': {} },
    search: (__VLS_ctx.filters.search),
    title: "Tarifas oficiales",
    createLabel: "Crear tarifa",
    showCreate: (__VLS_ctx.canCreate),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
let __VLS_19;
const __VLS_20 = {
    /** @type {typeof __VLS_19.create} */
    onCreate: (__VLS_ctx.openCreate),
};
const __VLS_21 = {
    /** @type {typeof __VLS_19.refresh} */
    onRefresh: (__VLS_ctx.load),
};
const __VLS_22 = {
    /** @type {typeof __VLS_19.search} */
    onSearch: (__VLS_ctx.applyFilters),
};
const __VLS_23 = {
    /** @type {typeof __VLS_19.filter} */
    onFilter: (...[$event]) => {
        __VLS_ctx.filtersOpen = !__VLS_ctx.filtersOpen;
        // @ts-ignore
        [canCreate, openCreate, filters, load, applyFilters, filtersOpen, filtersOpen,];
    },
};
const { default: __VLS_24 } = __VLS_17.slots;
{
    const { description: __VLS_25 } = __VLS_17.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.total);
    // @ts-ignore
    [total,];
}
// @ts-ignore
[];
var __VLS_17;
var __VLS_18;
if (__VLS_ctx.filtersOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/[0.025]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.04]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2 xl:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
    let __VLS_26;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
        modelValue: (__VLS_ctx.filters.status),
        label: "Estado",
        options: (__VLS_ctx.statusOptions),
        placeholder: "",
    }));
    const __VLS_28 = __VLS_27({
        modelValue: (__VLS_ctx.filters.status),
        label: "Estado",
        options: (__VLS_ctx.statusOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    let __VLS_31;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
        modelValue: (__VLS_ctx.filters.approval),
        label: "Aprobación",
        options: (__VLS_ctx.approvalOptions),
        placeholder: "",
    }));
    const __VLS_33 = __VLS_32({
        modelValue: (__VLS_ctx.filters.approval),
        label: "Aprobación",
        options: (__VLS_ctx.approvalOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    let __VLS_36;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        modelValue: (__VLS_ctx.filters.agentId),
        label: "Agente",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.agentOptions.value]),
        placeholder: "",
    }));
    const __VLS_38 = __VLS_37({
        modelValue: (__VLS_ctx.filters.agentId),
        label: "Agente",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.agentOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_41;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
        modelValue: (__VLS_ctx.filters.carrierId),
        label: "Naviera",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.carrierOptions.value]),
        placeholder: "",
    }));
    const __VLS_43 = __VLS_42({
        modelValue: (__VLS_ctx.filters.carrierId),
        label: "Naviera",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.carrierOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    let __VLS_46;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        modelValue: (__VLS_ctx.filters.polId),
        label: "POL",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.polOptions.value]),
        placeholder: "",
    }));
    const __VLS_48 = __VLS_47({
        modelValue: (__VLS_ctx.filters.polId),
        label: "POL",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.polOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    let __VLS_51;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
        modelValue: (__VLS_ctx.filters.poeId),
        label: "POE",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.poeOptions.value]),
        placeholder: "",
    }));
    const __VLS_53 = __VLS_52({
        modelValue: (__VLS_ctx.filters.poeId),
        label: "POE",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.poeOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_52));
    let __VLS_56;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
        modelValue: (__VLS_ctx.filters.podId),
        label: "POD",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.podOptions.value]),
        placeholder: "",
    }));
    const __VLS_58 = __VLS_57({
        modelValue: (__VLS_ctx.filters.podId),
        label: "POD",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.podOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_61;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({
        modelValue: (__VLS_ctx.filters.containerTypeId),
        label: "Contenedor",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.containerOptions.value]),
        placeholder: "",
    }));
    const __VLS_63 = __VLS_62({
        modelValue: (__VLS_ctx.filters.containerTypeId),
        label: "Contenedor",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.containerOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    let __VLS_66;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent1(__VLS_66, new __VLS_66({
        modelValue: (__VLS_ctx.filters.currencyId),
        label: "Moneda",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.currencyOptions.value]),
        placeholder: "",
    }));
    const __VLS_68 = __VLS_67({
        modelValue: (__VLS_ctx.filters.currencyId),
        label: "Moneda",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.currencyOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_67));
    let __VLS_71;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_72 = __VLS_asFunctionalComponent1(__VLS_71, new __VLS_71({
        modelValue: (__VLS_ctx.filters.idtraNumber),
        label: "Número IDTRA",
        placeholder: "Buscar IDTRA",
    }));
    const __VLS_73 = __VLS_72({
        modelValue: (__VLS_ctx.filters.idtraNumber),
        label: "Número IDTRA",
        placeholder: "Buscar IDTRA",
    }, ...__VLS_functionalComponentArgsRest(__VLS_72));
    let __VLS_76;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
        modelValue: (__VLS_ctx.filters.quoNumber),
        label: "Número QUO",
        placeholder: "Buscar QUO",
    }));
    const __VLS_78 = __VLS_77({
        modelValue: (__VLS_ctx.filters.quoNumber),
        label: "Número QUO",
        placeholder: "Buscar QUO",
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    let __VLS_81;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_82 = __VLS_asFunctionalComponent1(__VLS_81, new __VLS_81({
        modelValue: (__VLS_ctx.filters.quoteDate),
        type: "date",
        label: "Fecha de cotización",
    }));
    const __VLS_83 = __VLS_82({
        modelValue: (__VLS_ctx.filters.quoteDate),
        type: "date",
        label: "Fecha de cotización",
    }, ...__VLS_functionalComponentArgsRest(__VLS_82));
    let __VLS_86;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_87 = __VLS_asFunctionalComponent1(__VLS_86, new __VLS_86({
        modelValue: (__VLS_ctx.filters.validFrom),
        type: "date",
        label: "Vigente desde",
    }));
    const __VLS_88 = __VLS_87({
        modelValue: (__VLS_ctx.filters.validFrom),
        type: "date",
        label: "Vigente desde",
    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
    let __VLS_91;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_92 = __VLS_asFunctionalComponent1(__VLS_91, new __VLS_91({
        modelValue: (__VLS_ctx.filters.validTo),
        type: "date",
        label: "Vigente hasta",
    }));
    const __VLS_93 = __VLS_92({
        modelValue: (__VLS_ctx.filters.validTo),
        type: "date",
        label: "Vigente hasta",
    }, ...__VLS_functionalComponentArgsRest(__VLS_92));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 flex justify-end gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_96;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent1(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        label: "Limpiar",
        variant: "ghost",
        size: "sm",
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        label: "Limpiar",
        variant: "ghost",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_101;
    const __VLS_102 = {
        /** @type {typeof __VLS_101.click} */
        onClick: (__VLS_ctx.clearFilters),
    };
    var __VLS_99;
    var __VLS_100;
    let __VLS_103;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_104 = __VLS_asFunctionalComponent1(__VLS_103, new __VLS_103({
        ...{ 'onClick': {} },
        label: "Aplicar filtros",
        size: "sm",
    }));
    const __VLS_105 = __VLS_104({
        ...{ 'onClick': {} },
        label: "Aplicar filtros",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_104));
    let __VLS_108;
    const __VLS_109 = {
        /** @type {typeof __VLS_108.click} */
        onClick: (__VLS_ctx.applyFilters),
    };
    var __VLS_106;
    var __VLS_107;
}
if (__VLS_ctx.selectedIds.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-5 flex items-center justify-between rounded-[22px] dh-bg-primary-soft px-4 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-black text-[var(--dh-primary)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    (__VLS_ctx.selectedIds.length);
    (__VLS_ctx.selectedIds.length === 1 ? '' : 's');
    if (__VLS_ctx.canDelete) {
        let __VLS_110;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_111 = __VLS_asFunctionalComponent1(__VLS_110, new __VLS_110({
            ...{ 'onClick': {} },
            label: "Eliminar seleccionadas",
            icon: (__VLS_ctx.Trash2),
            variant: "danger",
            size: "sm",
        }));
        const __VLS_112 = __VLS_111({
            ...{ 'onClick': {} },
            label: "Eliminar seleccionadas",
            icon: (__VLS_ctx.Trash2),
            variant: "danger",
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_111));
        let __VLS_115;
        const __VLS_116 = {
            /** @type {typeof __VLS_115.click} */
            onClick: (__VLS_ctx.confirmDelete),
        };
        var __VLS_113;
        var __VLS_114;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_117;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_118 = __VLS_asFunctionalComponent1(__VLS_117, new __VLS_117({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay tarifas que coincidan con los filtros.",
}));
const __VLS_119 = __VLS_118({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay tarifas que coincidan con los filtros.",
}, ...__VLS_functionalComponentArgsRest(__VLS_118));
let __VLS_122;
const __VLS_123 = {
    /** @type {typeof __VLS_122.rowClick} */
    onRowClick: (__VLS_ctx.openDetail),
};
const { default: __VLS_124 } = __VLS_120.slots;
{
    const { 'cell-selected': __VLS_125 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_125);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_126;
    /** @ts-ignore @type { | typeof __VLS_components.DhCheckbox} */
    DhCheckbox;
    // @ts-ignore
    const __VLS_127 = __VLS_asFunctionalComponent1(__VLS_126, new __VLS_126({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.selectedIds.includes(row.id)),
    }));
    const __VLS_128 = __VLS_127({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.selectedIds.includes(row.id)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_127));
    let __VLS_131;
    const __VLS_132 = {
        /** @type {typeof __VLS_131.'update:modelValue'} */
        'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.toggleSelection(row.id);
            // @ts-ignore
            [filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, applyFilters, filtersOpen, statusOptions, approvalOptions, catalogs, catalogs, catalogs, catalogs, catalogs, catalogs, catalogs, clearFilters, selectedIds, selectedIds, selectedIds, selectedIds, canDelete, Trash2, confirmDelete, columns, rows, loading, openDetail, toggleSelection,];
        },
    };
    var __VLS_129;
    var __VLS_130;
    // @ts-ignore
    [];
}
{
    const { 'cell-route': __VLS_133 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_133);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (row.rateName || row.rateCode);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-0.5 text-sm font-bold text-[var(--dh-text-soft)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
    (__VLS_ctx.routeLabel(__VLS_ctx.displayRate(row)));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (row.rateCode);
    if (row.idtraNumber) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (row.idtraNumber);
    }
    if (row.quoNumber) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (row.quoNumber);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.formatDate(row.validFrom));
    (__VLS_ctx.formatDate(row.validTo));
    (row.freeDays);
    // @ts-ignore
    [routeLabel, displayRate, formatDate, formatDate,];
}
{
    const { 'cell-agentName': __VLS_134 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_134);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-bold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.displayRate(row).agentName || '—');
    // @ts-ignore
    [displayRate,];
}
{
    const { 'cell-carrierName': __VLS_135 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_135);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-bold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.displayRate(row).carrierName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.displayRate(row).containerTypeName);
    // @ts-ignore
    [displayRate, displayRate,];
}
{
    const { 'cell-totalCostAmount': __VLS_136 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_136);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-bold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.formatMoney(row.totalCostAmount, __VLS_ctx.displayRate(row).currencyName));
    // @ts-ignore
    [displayRate, formatMoney,];
}
{
    const { 'cell-totalSaleAmount': __VLS_137 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_137);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (__VLS_ctx.formatMoney(row.totalSaleAmount, __VLS_ctx.displayRate(row).currencyName));
    // @ts-ignore
    [displayRate, formatMoney,];
}
{
    const { 'cell-totalUtilityAmount': __VLS_138 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_138);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-black" },
        ...{ class: (row.totalUtilityAmount >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500') },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (__VLS_ctx.formatMoney(row.totalUtilityAmount, __VLS_ctx.displayRate(row).currencyName));
    // @ts-ignore
    [displayRate, formatMoney,];
}
{
    const { 'cell-marginPercentage': __VLS_139 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_139);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-end gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (row.marginPercentage.toFixed(2));
    let __VLS_140;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent1(__VLS_140, new __VLS_140({
        label: (row.marginPercentage >= 12 ? 'OK' : 'Bajo'),
        variant: (__VLS_ctx.marginTone(row.marginPercentage)),
    }));
    const __VLS_142 = __VLS_141({
        label: (row.marginPercentage >= 12 ? 'OK' : 'Bajo'),
        variant: (__VLS_ctx.marginTone(row.marginPercentage)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    // @ts-ignore
    [marginTone,];
}
{
    const { 'cell-status': __VLS_145 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_145);
    let __VLS_146;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_147 = __VLS_asFunctionalComponent1(__VLS_146, new __VLS_146({
        label: (__VLS_ctx.statusLabel(row.status)),
        variant: (__VLS_ctx.statusTone(row.status)),
    }));
    const __VLS_148 = __VLS_147({
        label: (__VLS_ctx.statusLabel(row.status)),
        variant: (__VLS_ctx.statusTone(row.status)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_147));
    // @ts-ignore
    [statusLabel, statusTone,];
}
{
    const { 'cell-actions': __VLS_151 } = __VLS_120.slots;
    const [{ row }] = __VLS_vSlot(__VLS_151);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openDetail(row);
                // @ts-ignore
                [openDetail,];
            } },
        type: "button",
        ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
        title: "Ver detalle",
    });
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
    let __VLS_152;
    /** @ts-ignore @type { | typeof __VLS_components.Eye} */
    Eye;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent1(__VLS_152, new __VLS_152({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_154 = __VLS_153({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    if (__VLS_ctx.canUpdate) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canUpdate))
                        return;
                    __VLS_ctx.openEdit(row);
                    // @ts-ignore
                    [canUpdate, openEdit,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
            title: "Editar",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
        let __VLS_157;
        /** @ts-ignore @type { | typeof __VLS_components.Edit3} */
        Edit3;
        // @ts-ignore
        const __VLS_158 = __VLS_asFunctionalComponent1(__VLS_157, new __VLS_157({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_159 = __VLS_158({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_158));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    if (__VLS_ctx.canCreate) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canCreate))
                        return;
                    __VLS_ctx.duplicate(row);
                    // @ts-ignore
                    [canCreate, duplicate,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
            title: "Duplicar",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
        let __VLS_162;
        /** @ts-ignore @type { | typeof __VLS_components.Copy} */
        Copy;
        // @ts-ignore
        const __VLS_163 = __VLS_asFunctionalComponent1(__VLS_162, new __VLS_162({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_164 = __VLS_163({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_163));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_120;
var __VLS_121;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_167;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_168 = __VLS_asFunctionalComponent1(__VLS_167, new __VLS_167({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}));
const __VLS_169 = __VLS_168({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_168));
// @ts-ignore
[total, page, pageSize,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
