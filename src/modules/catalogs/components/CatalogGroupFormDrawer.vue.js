import { computed, ref } from 'vue';
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { CONFIG_SCOPES } from '@/core/auth/scopes';
import { CatalogGroupsService } from '@/core/services/catalogGroupsService';
import MetadataEditor from '@/modules/catalogs/components/MetadataEditor.vue';
const props = defineProps();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const loading = ref(false);
const form = ref({
    name: props.group?.name ?? '',
    slug: props.group?.slug ?? '',
    description: props.group?.description ?? '',
    metadataJson: props.group?.metadataJson ?? null,
    isSystem: props.group?.isSystem ?? false,
});
const isEdit = computed(() => Boolean(props.group));
const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.create));
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.update));
const canSave = computed(() => (isEdit.value ? canUpdate.value : canCreate.value));
async function save() {
    if (!canSave.value) {
        toastStore.warning('Sin permiso', 'No tiene permiso para guardar este catálogo.');
        return;
    }
    try {
        loading.value = true;
        if (props.group) {
            await CatalogGroupsService.update(props.group.id, {
                name: form.value.name,
                description: form.value.description || null,
                metadataJson: form.value.metadataJson,
            });
        }
        else {
            await CatalogGroupsService.create({
                name: form.value.name,
                slug: form.value.slug || null,
                description: form.value.description || null,
                metadataJson: form.value.metadataJson,
                isSystem: form.value.isSystem,
            });
        }
        toastStore.success('Guardado', 'Catálogo guardado correctamente.');
        await props.onSaved?.();
        drawerStore.close();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo guardar el catálogo.');
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
    label: "Nombre",
    placeholder: "Tipos de contenedores",
    disabled: (!__VLS_ctx.canSave),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.form.name),
    label: "Nombre",
    placeholder: "Tipos de contenedores",
    disabled: (!__VLS_ctx.canSave),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (!__VLS_ctx.isEdit) {
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        modelValue: (__VLS_ctx.form.slug),
        label: "Slug",
        placeholder: "tipos-contenedores",
        disabled: (!__VLS_ctx.canSave),
    }));
    const __VLS_7 = __VLS_6({
        modelValue: (__VLS_ctx.form.slug),
        label: "Slug",
        placeholder: "tipos-contenedores",
        disabled: (!__VLS_ctx.canSave),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.form.description),
    label: "Descripción",
    placeholder: "Catálogo para clasificación de contenedores",
    disabled: (!__VLS_ctx.canSave),
    ...{ class: "md:col-span-2" },
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.form.description),
    label: "Descripción",
    placeholder: "Catálogo para clasificación de contenedores",
    disabled: (!__VLS_ctx.canSave),
    ...{ class: "md:col-span-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
if (!__VLS_ctx.isEdit) {
    let __VLS_15;
    /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
    DhSwitch;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        modelValue: (__VLS_ctx.form.isSystem),
        label: "Catálogo de sistema",
    }));
    const __VLS_17 = __VLS_16({
        modelValue: (__VLS_ctx.form.isSystem),
        label: "Catálogo de sistema",
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
}
const __VLS_20 = MetadataEditor;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.form.metadataJson),
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.form.metadataJson),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_25;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
}));
const __VLS_27 = __VLS_26({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_30;
const __VLS_31 = {
    /** @type {typeof __VLS_30.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.drawerStore.close();
        // @ts-ignore
        [save, form, form, form, form, form, canSave, canSave, canSave, isEdit, isEdit, drawerStore,];
    },
};
var __VLS_28;
var __VLS_29;
let __VLS_32;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
    type: "submit",
    label: "Guardar",
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSave),
}));
const __VLS_34 = __VLS_33({
    type: "submit",
    label: "Guardar",
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSave),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
// @ts-ignore
[canSave, loading,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
