import { computed, onMounted, reactive, ref, watch } from 'vue';
import { BadgeDollarSign, Pencil, Power, PowerOff, Trash2 } from 'lucide-vue-next';
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms';
import { DhCrudToolbar, DhDataTable, DhPagination, } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { useAuthStore } from '@/core/stores/authStore';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
import { PRICING_SCOPES } from '@/core/auth/scopes';
import { PricingService } from '@/core/services/pricingService';
import PricingCostFormDrawer from '@/modules/pricing/components/PricingCostFormDrawer.vue';
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { formatMoney } from '@/modules/pricing/utils/pricingFormat';
const authStore = useAuthStore();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const displayCost = (cost) => catalogs.resolveCostLabels(cost);
const rows = ref([]);
const loading = ref(false);
const filtersOpen = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const filters = reactive({
    search: '',
    costType: '',
    costDetailType: '',
    carrierId: '',
    agentId: '',
    portRole: '',
    currencyId: '',
    active: '',
});
const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.create));
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.update));
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.costs.delete));
const canSetActive = computed(() => authStore.hasScope(PRICING_SCOPES.costs.setActive));
const columns = [
    { key: 'name', label: 'Costo' },
    { key: 'costType', label: 'Aplicación' },
    { key: 'costDetailType', label: 'Rubro' },
    { key: 'relation', label: 'Naviera / agente' },
    { key: 'portName', label: 'Puerto' },
    { key: 'costAmount', label: 'Costo', align: 'right' },
    { key: 'saleAmount', label: 'Venta', align: 'right' },
    { key: 'utilityAmount', label: 'Utilidad', align: 'right' },
    { key: 'isActive', label: 'Estado', align: 'center' },
    { key: 'actions', label: '', align: 'right', width: '120px' },
];
const typeOptions = [
    { label: 'Todos', value: '' },
    { label: 'Fijo automático', value: 'Fixed' },
    { label: 'Opcional', value: 'Optional' },
    { label: 'Variable', value: 'Variable' },
];
const detailOptions = [
    { label: 'Todos', value: '' },
    { label: 'Flete internacional', value: 'Freight' },
    { label: 'Costo de agente', value: 'AgentCharge' },
    { label: 'Origen', value: 'OriginCharge' },
    { label: 'Destino', value: 'DestinationCharge' },
    { label: 'Puerto', value: 'PortCharge' },
    { label: 'Aduana', value: 'CustomsCharge' },
    { label: 'Transporte interno', value: 'InlandTransport' },
    { label: 'Documentación', value: 'Documentation' },
    { label: 'Seguro', value: 'Insurance' },
    { label: 'Otro', value: 'Other' },
];
const portRoleOptions = [
    { label: 'Todos', value: '' },
    { label: 'POL', value: 'Pol' },
    { label: 'POE', value: 'Poe' },
    { label: 'POD', value: 'Pod' },
    { label: 'Cualquier punto', value: 'Any' },
];
const activeOptions = [
    { label: 'Todos', value: '' },
    { label: 'Activos', value: 'true' },
    { label: 'Inactivos', value: 'false' },
];
function typeLabel(value) {
    return { Fixed: 'Fijo', Optional: 'Opcional', Variable: 'Variable' }[value];
}
function detailLabel(value) {
    return {
        Freight: 'Flete',
        AgentCharge: 'Agente',
        OriginCharge: 'Origen',
        DestinationCharge: 'Destino',
        PortCharge: 'Puerto',
        CustomsCharge: 'Aduana',
        InlandTransport: 'Transporte interno',
        Documentation: 'Documentación',
        Insurance: 'Seguro',
        Other: 'Otro',
    }[value];
}
async function load() {
    try {
        loading.value = true;
        const result = await PricingService.browseCosts({
            pageNumber: page.value,
            pageSize: pageSize.value,
            search: filters.search || undefined,
            costType: filters.costType || undefined,
            costDetailType: filters.costDetailType || undefined,
            carrierId: filters.carrierId || undefined,
            agentId: filters.agentId || undefined,
            portRole: filters.portRole || undefined,
            currencyId: filters.currencyId || undefined,
            isActive: filters.active === '' ? undefined : filters.active === 'true',
        });
        rows.value = result.items;
        total.value = result.totalCount ?? result.items.length;
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron cargar los costos.');
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
        costType: '',
        costDetailType: '',
        carrierId: '',
        agentId: '',
        portRole: '',
        currencyId: '',
        active: '',
    });
    applyFilters();
}
function openForm(cost) {
    drawerStore.open({
        title: cost ? 'Editar costo' : 'Nuevo costo',
        component: PricingCostFormDrawer,
        size: 'lg',
        props: { cost, onSaved: load },
    });
}
async function toggleActive(cost) {
    try {
        await PricingService.setCostActive(cost.id, { isActive: !cost.isActive });
        toastStore.success(cost.isActive ? 'Costo inactivado' : 'Costo activado');
        await load();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo cambiar el estado del costo.');
    }
}
function confirmDelete(cost) {
    modalStore.open({
        title: 'Eliminar costo',
        component: DhConfirmDialog,
        props: {
            title: 'Eliminar costo',
            message: `¿Desea eliminar “${cost.name}”? Las tarifas existentes conservarán su histórico.`,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true,
            onConfirm: async () => {
                await PricingService.deleteCost(cost.id);
                modalStore.close();
                toastStore.success('Costo eliminado');
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
            openForm();
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
    title: "Costos",
    subtitle: "Matriz maestra de costos fijos, opcionales y variables por naviera, agente y puerto.",
    icon: (__VLS_ctx.BadgeDollarSign),
}));
const __VLS_2 = __VLS_1({
    title: "Costos",
    subtitle: "Matriz maestra de costos fijos, opcionales y variables por naviera, agente y puerto.",
    icon: (__VLS_ctx.BadgeDollarSign),
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
            label: "Nuevo costo",
        }));
        const __VLS_9 = __VLS_8({
            ...{ 'onClick': {} },
            label: "Nuevo costo",
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        let __VLS_12;
        const __VLS_13 = {
            /** @type {typeof __VLS_12.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.canCreate))
                    return;
                __VLS_ctx.openForm();
                // @ts-ignore
                [BadgeDollarSign, canCreate, openForm,];
            },
        };
        var __VLS_10;
        var __VLS_11;
        // @ts-ignore
        [];
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
    title: "Matriz de costos",
    createLabel: "Nuevo costo",
    showCreate: (__VLS_ctx.canCreate),
}));
const __VLS_16 = __VLS_15({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onSearch': {} },
    ...{ 'onFilter': {} },
    search: (__VLS_ctx.filters.search),
    title: "Matriz de costos",
    createLabel: "Nuevo costo",
    showCreate: (__VLS_ctx.canCreate),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
let __VLS_19;
const __VLS_20 = {
    /** @type {typeof __VLS_19.create} */
    onCreate: (...[$event]) => {
        __VLS_ctx.openForm();
        // @ts-ignore
        [canCreate, openForm, filters,];
    },
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
        [load, applyFilters, filtersOpen, filtersOpen,];
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
        modelValue: (__VLS_ctx.filters.costType),
        label: "Aplicación",
        options: (__VLS_ctx.typeOptions),
        placeholder: "",
    }));
    const __VLS_28 = __VLS_27({
        modelValue: (__VLS_ctx.filters.costType),
        label: "Aplicación",
        options: (__VLS_ctx.typeOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    let __VLS_31;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
        modelValue: (__VLS_ctx.filters.costDetailType),
        label: "Rubro",
        options: (__VLS_ctx.detailOptions),
        placeholder: "",
    }));
    const __VLS_33 = __VLS_32({
        modelValue: (__VLS_ctx.filters.costDetailType),
        label: "Rubro",
        options: (__VLS_ctx.detailOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    let __VLS_36;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        modelValue: (__VLS_ctx.filters.carrierId),
        label: "Naviera",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.carrierOptions.value]),
        placeholder: "",
    }));
    const __VLS_38 = __VLS_37({
        modelValue: (__VLS_ctx.filters.carrierId),
        label: "Naviera",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.carrierOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_41;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
        modelValue: (__VLS_ctx.filters.agentId),
        label: "Agente",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.agentOptions.value]),
        placeholder: "",
    }));
    const __VLS_43 = __VLS_42({
        modelValue: (__VLS_ctx.filters.agentId),
        label: "Agente",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.agentOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    let __VLS_46;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        modelValue: (__VLS_ctx.filters.portRole),
        label: "Punto",
        options: (__VLS_ctx.portRoleOptions),
        placeholder: "",
    }));
    const __VLS_48 = __VLS_47({
        modelValue: (__VLS_ctx.filters.portRole),
        label: "Punto",
        options: (__VLS_ctx.portRoleOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    let __VLS_51;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
        modelValue: (__VLS_ctx.filters.currencyId),
        label: "Moneda",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.currencyOptions.value]),
        placeholder: "",
    }));
    const __VLS_53 = __VLS_52({
        modelValue: (__VLS_ctx.filters.currencyId),
        label: "Moneda",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.currencyOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_52));
    let __VLS_56;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
        modelValue: (__VLS_ctx.filters.active),
        label: "Estado",
        options: (__VLS_ctx.activeOptions),
        placeholder: "",
    }));
    const __VLS_58 = __VLS_57({
        modelValue: (__VLS_ctx.filters.active),
        label: "Estado",
        options: (__VLS_ctx.activeOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 flex justify-end gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_61;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({
        ...{ 'onClick': {} },
        label: "Limpiar",
        variant: "ghost",
        size: "sm",
    }));
    const __VLS_63 = __VLS_62({
        ...{ 'onClick': {} },
        label: "Limpiar",
        variant: "ghost",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    let __VLS_66;
    const __VLS_67 = {
        /** @type {typeof __VLS_66.click} */
        onClick: (__VLS_ctx.clearFilters),
    };
    var __VLS_64;
    var __VLS_65;
    let __VLS_68;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
        ...{ 'onClick': {} },
        label: "Aplicar filtros",
        size: "sm",
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClick': {} },
        label: "Aplicar filtros",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_73;
    const __VLS_74 = {
        /** @type {typeof __VLS_73.click} */
        onClick: (__VLS_ctx.applyFilters),
    };
    var __VLS_71;
    var __VLS_72;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_75;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay costos que coincidan con los filtros.",
}));
const __VLS_77 = __VLS_76({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay costos que coincidan con los filtros.",
}, ...__VLS_functionalComponentArgsRest(__VLS_76));
let __VLS_80;
const __VLS_81 = {
    /** @type {typeof __VLS_80.rowClick} */
    onRowClick: ((row) => __VLS_ctx.canUpdate && __VLS_ctx.openForm(row)),
};
const { default: __VLS_82 } = __VLS_78.slots;
{
    const { 'cell-costType': __VLS_83 } = __VLS_78.slots;
    const [{ value }] = __VLS_vSlot(__VLS_83);
    let __VLS_84;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent1(__VLS_84, new __VLS_84({
        label: (__VLS_ctx.typeLabel(value)),
        variant: (value === 'Optional' ? 'primary' : value === 'Fixed' ? 'neutral' : 'warning'),
    }));
    const __VLS_86 = __VLS_85({
        label: (__VLS_ctx.typeLabel(value)),
        variant: (value === 'Optional' ? 'primary' : value === 'Fixed' ? 'neutral' : 'warning'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    // @ts-ignore
    [openForm, filters, filters, filters, filters, filters, filters, filters, applyFilters, filtersOpen, typeOptions, detailOptions, catalogs, catalogs, catalogs, portRoleOptions, activeOptions, clearFilters, columns, rows, loading, canUpdate, typeLabel,];
}
{
    const { 'cell-costDetailType': __VLS_89 } = __VLS_78.slots;
    const [{ value }] = __VLS_vSlot(__VLS_89);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-bold text-[var(--dh-text-soft)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
    (__VLS_ctx.detailLabel(value));
    // @ts-ignore
    [detailLabel,];
}
{
    const { 'cell-relation': __VLS_90 } = __VLS_78.slots;
    const [{ row }] = __VLS_vSlot(__VLS_90);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-bold text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.displayCost(row).agentName || __VLS_ctx.displayCost(row).carrierName || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (row.agentId ? 'Agente' : row.carrierId ? 'Naviera' : 'Sin relación');
    // @ts-ignore
    [displayCost, displayCost,];
}
{
    const { 'cell-portName': __VLS_91 } = __VLS_78.slots;
    const [{ row }] = __VLS_vSlot(__VLS_91);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-bold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.displayCost(row).portName || 'Sin puerto específico');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (row.portRole || 'Cualquier punto');
    // @ts-ignore
    [displayCost,];
}
{
    const { 'cell-costAmount': __VLS_92 } = __VLS_78.slots;
    const [{ row }] = __VLS_vSlot(__VLS_92);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-bold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.formatMoney(row.costAmount, __VLS_ctx.displayCost(row).currencyName));
    // @ts-ignore
    [displayCost, formatMoney,];
}
{
    const { 'cell-saleAmount': __VLS_93 } = __VLS_78.slots;
    const [{ row }] = __VLS_vSlot(__VLS_93);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-bold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.formatMoney(row.saleAmount, __VLS_ctx.displayCost(row).currencyName));
    // @ts-ignore
    [displayCost, formatMoney,];
}
{
    const { 'cell-utilityAmount': __VLS_94 } = __VLS_78.slots;
    const [{ row }] = __VLS_vSlot(__VLS_94);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-black" },
        ...{ class: (row.utilityAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (__VLS_ctx.formatMoney(row.utilityAmount, __VLS_ctx.displayCost(row).currencyName));
    // @ts-ignore
    [displayCost, formatMoney,];
}
{
    const { 'cell-isActive': __VLS_95 } = __VLS_78.slots;
    const [{ value }] = __VLS_vSlot(__VLS_95);
    let __VLS_96;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent1(__VLS_96, new __VLS_96({
        label: (value ? 'Activo' : 'Inactivo'),
        variant: (value ? 'success' : 'neutral'),
    }));
    const __VLS_98 = __VLS_97({
        label: (value ? 'Activo' : 'Inactivo'),
        variant: (value ? 'success' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    // @ts-ignore
    [];
}
{
    const { 'cell-actions': __VLS_101 } = __VLS_78.slots;
    const [{ row }] = __VLS_vSlot(__VLS_101);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    if (__VLS_ctx.canUpdate) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canUpdate))
                        return;
                    __VLS_ctx.openForm(row);
                    // @ts-ignore
                    [openForm, canUpdate,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
            title: "Editar",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
        let __VLS_102;
        /** @ts-ignore @type { | typeof __VLS_components.Pencil} */
        Pencil;
        // @ts-ignore
        const __VLS_103 = __VLS_asFunctionalComponent1(__VLS_102, new __VLS_102({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_104 = __VLS_103({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_103));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    if (__VLS_ctx.canSetActive) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canSetActive))
                        return;
                    __VLS_ctx.toggleActive(row);
                    // @ts-ignore
                    [canSetActive, toggleActive,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
            title: (row.isActive ? 'Inactivar' : 'Activar'),
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
        if (row.isActive) {
            let __VLS_107;
            /** @ts-ignore @type { | typeof __VLS_components.PowerOff} */
            PowerOff;
            // @ts-ignore
            const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
                ...{ class: "h-4 w-4 text-amber-600" },
            }));
            const __VLS_109 = __VLS_108({
                ...{ class: "h-4 w-4 text-amber-600" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_108));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
        }
        else {
            let __VLS_112;
            /** @ts-ignore @type { | typeof __VLS_components.Power} */
            Power;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent1(__VLS_112, new __VLS_112({
                ...{ class: "h-4 w-4 text-emerald-600" },
            }));
            const __VLS_114 = __VLS_113({
                ...{ class: "h-4 w-4 text-emerald-600" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-emerald-600']} */ ;
        }
    }
    if (__VLS_ctx.canDelete) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canDelete))
                        return;
                    __VLS_ctx.confirmDelete(row);
                    // @ts-ignore
                    [canDelete, confirmDelete,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 text-red-500 hover:bg-red-500/10" },
            title: "Eliminar",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
        let __VLS_117;
        /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
        Trash2;
        // @ts-ignore
        const __VLS_118 = __VLS_asFunctionalComponent1(__VLS_117, new __VLS_117({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_119 = __VLS_118({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_118));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_78;
var __VLS_79;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_122;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_123 = __VLS_asFunctionalComponent1(__VLS_122, new __VLS_122({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}));
const __VLS_124 = __VLS_123({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_123));
// @ts-ignore
[total, page, pageSize,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
