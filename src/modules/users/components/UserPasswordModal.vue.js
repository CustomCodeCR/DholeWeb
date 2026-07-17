import { ref } from 'vue';
import { DhButton, DhPasswordInput } from '@/shared/components/atoms';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { UsersService } from '@/core/services/usersService';
const props = defineProps();
const modalStore = useModalStore();
const toastStore = useToastStore();
const password = ref('');
const loading = ref(false);
async function save() {
    if (!password.value) {
        toastStore.warning('Contraseña requerida');
        return;
    }
    loading.value = true;
    try {
        await UsersService.changePassword(props.userId, { password: password.value });
        toastStore.success('Contraseña actualizada');
        await props.onSaved?.();
        modalStore.close();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo cambiar la contraseña.');
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
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhPasswordInput} */
DhPasswordInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.password),
    label: "Nueva contraseña",
    placeholder: "Digite la nueva contraseña",
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.password),
    label: "Nueva contraseña",
    placeholder: "Digite la nueva contraseña",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
}));
const __VLS_7 = __VLS_6({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = {
    /** @type {typeof __VLS_10.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.modalStore.close();
        // @ts-ignore
        [save, password, modalStore,];
    },
};
var __VLS_8;
var __VLS_9;
let __VLS_12;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    type: "submit",
    label: "Guardar contraseña",
    loading: (__VLS_ctx.loading),
}));
const __VLS_14 = __VLS_13({
    type: "submit",
    label: "Guardar contraseña",
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
// @ts-ignore
[loading,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
