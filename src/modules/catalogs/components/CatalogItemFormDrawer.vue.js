import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { CONFIG_SCOPES } from '@/core/auth/scopes';
import { CatalogItemsService } from '@/core/services/catalogItemsService';
import MetadataEditor from '@/modules/catalogs/components/MetadataEditor.vue';
const props = defineProps();
const { t } = useI18n();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const loading = ref(false);
const form = ref({
    name: props.item?.name ?? '',
    slug: props.item?.slug ?? '',
    description: props.item?.description ?? '',
    value: props.item?.value ?? '',
    metadataJson: props.item?.metadataJson ?? null,
    sortOrder: props.item?.sortOrder ?? props.nextSortOrder ?? 1,
    isSystem: props.item?.isSystem ?? false,
});
const isEdit = computed(() => Boolean(props.item));
const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.create));
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.update));
const canSave = computed(() => {
    return isEdit.value ? canUpdate.value : canCreate.value;
});
function resetCreateForm() {
    const nextSortOrder = Number(form.value.sortOrder || 0) + 1;
    form.value = {
        name: '',
        slug: '',
        description: '',
        value: '',
        metadataJson: null,
        sortOrder: nextSortOrder,
        isSystem: false,
    };
}
async function save() {
    if (!canSave.value) {
        toastStore.warning('Sin permiso', 'No tiene permiso para guardar este item.');
        return;
    }
    try {
        loading.value = true;
        if (props.item) {
            await CatalogItemsService.update(props.item.id, {
                name: form.value.name,
                description: form.value.description || null,
                value: form.value.value || null,
                metadataJson: form.value.metadataJson,
                sortOrder: form.value.sortOrder,
            });
            toastStore.success('Guardado', t('catalogs.itemSaved'));
            await props.onSaved?.();
            drawerStore.close();
            return;
        }
        await CatalogItemsService.createForGroup(props.group.id, {
            name: form.value.name,
            slug: form.value.slug || null,
            description: form.value.description || null,
            value: form.value.value || null,
            metadataJson: form.value.metadataJson,
            sortOrder: form.value.sortOrder,
            isSystem: form.value.isSystem,
        });
        toastStore.success('Guardado', 'Item creado correctamente. Puede agregar otro.');
        await props.onSaved?.();
        resetCreateForm();
    }
    catch (error) {
        toastStore.backendError(error, t('catalogs.saveItemError'));
    }
    finally {
        loading.value = false;
    }
}
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
    ...{ onSubmit: (__VLS_ctx.save) },
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('catalogs.group'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.group.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-bold text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
(__VLS_ctx.group.slug);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.form.name),
    label: (__VLS_ctx.t('common.name')),
    placeholder: (__VLS_ctx.t('catalogs.itemNamePlaceholder')),
    disabled: (!__VLS_ctx.canSave),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.form.name),
    label: (__VLS_ctx.t('common.name')),
    placeholder: (__VLS_ctx.t('catalogs.itemNamePlaceholder')),
    disabled: (!__VLS_ctx.canSave),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (!__VLS_ctx.isEdit) {
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        modelValue: (__VLS_ctx.form.slug),
        label: (__VLS_ctx.t('common.slug')),
        placeholder: (__VLS_ctx.t('catalogs.itemSlugPlaceholder')),
        disabled: (!__VLS_ctx.canSave),
    }));
    const __VLS_7 = __VLS_6({
        modelValue: (__VLS_ctx.form.slug),
        label: (__VLS_ctx.t('common.slug')),
        placeholder: (__VLS_ctx.t('catalogs.itemSlugPlaceholder')),
        disabled: (!__VLS_ctx.canSave),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.form.value),
    label: (__VLS_ctx.t('common.value')),
    placeholder: (__VLS_ctx.t('catalogs.itemValuePlaceholder')),
    disabled: (!__VLS_ctx.canSave),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.form.value),
    label: (__VLS_ctx.t('common.value')),
    placeholder: (__VLS_ctx.t('catalogs.itemValuePlaceholder')),
    disabled: (!__VLS_ctx.canSave),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mb-1 block text-xs font-black text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('common.order'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
    ...{ class: "h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60" },
    disabled: (!__VLS_ctx.canSave),
});
(__VLS_ctx.form.sortOrder);
/** @type {__VLS_StyleScopedClasses['h-11']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.form.description),
    label: (__VLS_ctx.t('common.description')),
    placeholder: (__VLS_ctx.t('catalogs.itemDescriptionPlaceholder')),
    disabled: (!__VLS_ctx.canSave),
    ...{ class: "md:col-span-2" },
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.form.description),
    label: (__VLS_ctx.t('common.description')),
    placeholder: (__VLS_ctx.t('catalogs.itemDescriptionPlaceholder')),
    disabled: (!__VLS_ctx.canSave),
    ...{ class: "md:col-span-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
if (!__VLS_ctx.isEdit) {
    let __VLS_20;
    /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
    DhSwitch;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        modelValue: (__VLS_ctx.form.isSystem),
        label: (__VLS_ctx.t('catalogs.systemItem')),
    }));
    const __VLS_22 = __VLS_21({
        modelValue: (__VLS_ctx.form.isSystem),
        label: (__VLS_ctx.t('catalogs.systemItem')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
const __VLS_25 = MetadataEditor;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    modelValue: (__VLS_ctx.form.metadataJson),
}));
const __VLS_27 = __VLS_26({
    modelValue: (__VLS_ctx.form.metadataJson),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_30;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    ...{ 'onClick': {} },
    type: "button",
    label: (__VLS_ctx.t('common.close')),
    variant: "secondary",
}));
const __VLS_32 = __VLS_31({
    ...{ 'onClick': {} },
    type: "button",
    label: (__VLS_ctx.t('common.close')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
let __VLS_35;
const __VLS_36 = {
    /** @type {typeof __VLS_35.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.drawerStore.close();
        // @ts-ignore
        [save, t, t, t, t, t, t, t, t, t, t, t, t, group, group, form, form, form, form, form, form, form, canSave, canSave, canSave, canSave, canSave, isEdit, isEdit, drawerStore,];
    },
};
var __VLS_33;
var __VLS_34;
let __VLS_37;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
    type: "submit",
    label: (__VLS_ctx.isEdit ? __VLS_ctx.t('common.save') : 'Guardar y agregar otro'),
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSave),
}));
const __VLS_39 = __VLS_38({
    type: "submit",
    label: (__VLS_ctx.isEdit ? __VLS_ctx.t('common.save') : 'Guardar y agregar otro'),
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSave),
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
// @ts-ignore
[t, canSave, isEdit, loading,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
