import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Database, RefreshCcw, Settings2 } from 'lucide-vue-next';
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms';
import { DhDataTable } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { CatalogItemsService } from '@/core/services/catalogItemsService';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const router = useRouter();
const toastStore = useToastStore();
const loading = ref(false);
const selectedSlug = ref('ports');
const items = ref([]);
const catalogs = [
    { slug: 'ports', name: 'Puertos', description: 'Origen, puerto de salida y destino para decisiones y tarifas FCL.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
    { slug: 'container-types', name: 'Tipos de contenedor', description: '20DV, 40DV, 40HC, 45HC u otros contenedores usados en pricing.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
    { slug: 'carriers', name: 'Navieras', description: 'Maersk, MSC, CMA CGM, Hapag-Lloyd y otras navieras.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
    { slug: 'agents', name: 'Agentes', description: 'Agentes o proveedores asociados a una tarifa.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
    { slug: 'commodities', name: 'Commodities', description: 'FAK, carga general, textiles, electrónicos u otras categorías.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
    { slug: 'incoterms', name: 'Incoterms', description: 'EXW, FOB, CIF, DAP, DDP y demás términos comerciales.', requiredIn: 'Decisión tarifaria' },
    { slug: 'currencies', name: 'Monedas', description: 'Moneda de costos, venta y margen.', requiredIn: 'Tarifas FCL' },
    { slug: 'pricing-import-profiles', name: 'Perfiles de extracción', description: 'Perfil que usa DataExtraction al leer PDF, Excel o CSV.', requiredIn: 'Importar tarifario' },
];
const catalogOptions = computed(() => catalogs.map((catalog) => ({ label: catalog.name, value: catalog.slug })));
const selectedCatalog = computed(() => catalogs.find((catalog) => catalog.slug === selectedSlug.value) ?? catalogs[0]);
const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'code', label: 'Código', width: '140px' },
    { key: 'slug', label: 'Slug', width: '180px' },
    { key: 'value', label: 'Valor enviado a Pricing', width: '190px' },
    { key: 'sortOrder', label: 'Orden', align: 'right', width: '90px' },
    { key: 'isActive', label: 'Activo', align: 'center', width: '100px' },
];
async function loadItems() {
    loading.value = true;
    try {
        items.value = await CatalogItemsService.getByGroupSlug(selectedSlug.value);
    }
    catch (error) {
        items.value = [];
        toastStore.backendWarning(error, 'No se pudieron cargar los valores del catálogo seleccionado.');
    }
    finally {
        loading.value = false;
    }
}
function openCatalogAdmin() {
    router.push('/config/catalogs');
}
watch(selectedSlug, loadItems);
useViewShortcuts({ save: loadItems, refresh: loadItems });
onMounted(loadItems);
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
    title: "Selects de Pricing",
    subtitle: "Estos combos se alimentan desde ConfigService. Pricing valida los valores antes de crear tarifas o decisiones.",
    icon: (__VLS_ctx.Settings2),
}));
const __VLS_2 = __VLS_1({
    title: "Selects de Pricing",
    subtitle: "Estos combos se alimentan desde ConfigService. Pricing valida los valores antes de crear tarifas o decisiones.",
    icon: (__VLS_ctx.Settings2),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
{
    const { actions: __VLS_6 } = __VLS_3.slots;
    let __VLS_7;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        variant: "secondary",
        label: "Actualizar",
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        variant: "secondary",
        label: "Actualizar",
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (__VLS_ctx.loadItems),
    };
    var __VLS_10;
    var __VLS_11;
    let __VLS_14;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Database),
        label: "Administrar catálogos",
    }));
    const __VLS_16 = __VLS_15({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Database),
        label: "Administrar catálogos",
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_19;
    const __VLS_20 = {
        /** @type {typeof __VLS_19.click} */
        onClick: (__VLS_ctx.openCatalogAdmin),
    };
    var __VLS_17;
    var __VLS_18;
    // @ts-ignore
    [Settings2, RefreshCcw, loading, loadItems, Database, openCatalogAdmin,];
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 lg:grid-cols-[320px_1fr] lg:items-end" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-[320px_1fr]']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-end']} */ ;
let __VLS_21;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
    modelValue: (__VLS_ctx.selectedSlug),
    label: "Catálogo para selects",
    options: (__VLS_ctx.catalogOptions),
}));
const __VLS_23 = __VLS_22({
    modelValue: (__VLS_ctx.selectedSlug),
    label: "Catálogo para selects",
    options: (__VLS_ctx.catalogOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.selectedCatalog.name);
let __VLS_26;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
    label: "ConfigService",
    variant: "primary",
}));
const __VLS_28 = __VLS_27({
    label: "ConfigService",
    variant: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
let __VLS_31;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
    label: (__VLS_ctx.selectedCatalog.slug),
    variant: "neutral",
}));
const __VLS_33 = __VLS_32({
    label: (__VLS_ctx.selectedCatalog.slug),
    variant: "neutral",
}, ...__VLS_functionalComponentArgsRest(__VLS_32));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.selectedCatalog.description);
(__VLS_ctx.selectedCatalog.requiredIn);
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
let __VLS_36;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.items),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay valores para este catálogo. Créelos desde ConfigService para que aparezcan en Pricing.",
}));
const __VLS_38 = __VLS_37({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.items),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay valores para este catálogo. Créelos desde ConfigService para que aparezcan en Pricing.",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const { default: __VLS_41 } = __VLS_39.slots;
{
    const { 'cell-value': __VLS_42 } = __VLS_39.slots;
    const [{ row, value }] = __VLS_vSlot(__VLS_42);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono text-xs font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (value || row.code || row.slug);
    // @ts-ignore
    [loading, selectedSlug, catalogOptions, selectedCatalog, selectedCatalog, selectedCatalog, selectedCatalog, columns, items,];
}
{
    const { 'cell-isActive': __VLS_43 } = __VLS_39.slots;
    const [{ value }] = __VLS_vSlot(__VLS_43);
    let __VLS_44;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent1(__VLS_44, new __VLS_44({
        label: (value ? 'Sí' : 'No'),
        variant: (value ? 'success' : 'danger'),
    }));
    const __VLS_46 = __VLS_45({
        label: (value ? 'Sí' : 'No'),
        variant: (value ? 'success' : 'danger'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_39;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
