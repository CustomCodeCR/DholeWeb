import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DhButton, DhInput, DhTextarea } from '@/shared/components/atoms';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { RolesService } from '@/core/services/rolesService';
const props = defineProps();
const { t } = useI18n();
const modalStore = useModalStore();
const toastStore = useToastStore();
const loading = ref(false);
const name = ref('');
const description = ref('');
async function save() {
    try {
        loading.value = true;
        await RolesService.create({
            name: name.value,
            description: description.value || null,
            isSystemRole: false,
        });
        toastStore.success('Guardado', 'Rol creado.');
        await props.onSaved?.();
        modalStore.close();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo crear el rol.');
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
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.name),
    label: (__VLS_ctx.t('common.name')),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.name),
    label: (__VLS_ctx.t('common.name')),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.description),
    label: (__VLS_ctx.t('common.description')),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.description),
    label: (__VLS_ctx.t('common.description')),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('common.cancel')),
    variant: "secondary",
}));
const __VLS_12 = __VLS_11({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('common.cancel')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
const __VLS_16 = {
    /** @type {typeof __VLS_15.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.modalStore.close();
        // @ts-ignore
        [save, name, t, t, t, description, modalStore,];
    },
};
var __VLS_13;
var __VLS_14;
let __VLS_17;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    type: "submit",
    label: (__VLS_ctx.t('common.save')),
    loading: (__VLS_ctx.loading),
}));
const __VLS_19 = __VLS_18({
    type: "submit",
    label: (__VLS_ctx.t('common.save')),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
// @ts-ignore
[t, loading,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
