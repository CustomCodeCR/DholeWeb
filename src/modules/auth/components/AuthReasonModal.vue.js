import { ref } from 'vue';
import { DhButton, DhTextarea } from '@/shared/components/atoms';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
const props = defineProps();
const modalStore = useModalStore();
const toastStore = useToastStore();
const reason = ref('');
const loading = ref(false);
async function confirm() {
    loading.value = true;
    try {
        await props.onConfirm(reason.value.trim() || null);
        modalStore.close();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo completar la acción.');
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
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.title);
if (__VLS_ctx.message) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.message);
}
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.reason),
    label: (__VLS_ctx.reasonLabel ?? 'Motivo'),
    placeholder: "Opcional",
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.reason),
    label: (__VLS_ctx.reasonLabel ?? 'Motivo'),
    placeholder: "Opcional",
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
        [title, message, message, reason, reasonLabel, modalStore,];
    },
};
var __VLS_8;
var __VLS_9;
let __VLS_12;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.confirmLabel),
    variant: (__VLS_ctx.danger ? 'danger' : 'primary'),
    loading: (__VLS_ctx.loading),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.confirmLabel),
    variant: (__VLS_ctx.danger ? 'danger' : 'primary'),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_17;
const __VLS_18 = {
    /** @type {typeof __VLS_17.click} */
    onClick: (__VLS_ctx.confirm),
};
var __VLS_15;
var __VLS_16;
// @ts-ignore
[confirmLabel, danger, loading, confirm,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
