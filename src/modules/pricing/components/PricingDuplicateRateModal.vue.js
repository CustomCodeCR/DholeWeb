import { reactive } from 'vue';
import { Copy } from 'lucide-vue-next';
import { DhButton, DhInput } from '@/shared/components/atoms';
import { PricingService } from '@/core/services/pricingService';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { toDateInput } from '@/modules/pricing/utils/pricingFormat';
const props = defineProps();
const modalStore = useModalStore();
const toastStore = useToastStore();
const form = reactive({
    validFrom: toDateInput(props.rate.validFrom),
    validTo: toDateInput(props.rate.validTo),
    submitted: false,
    saving: false,
});
async function submit() {
    form.submitted = true;
    if (!form.validFrom || !form.validTo || form.validTo < form.validFrom)
        return;
    try {
        form.saving = true;
        await PricingService.duplicateRate(props.rate.id, {
            validFrom: form.validFrom,
            validTo: form.validTo,
        });
        toastStore.success('Tarifa duplicada', 'La copia conserva los rubros y permite una vigencia independiente.');
        modalStore.close();
        await props.onSaved?.();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo duplicar la tarifa.');
    }
    finally {
        form.saving = false;
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
    ...{ onSubmit: (__VLS_ctx.submit) },
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start gap-3 rounded-[22px] bg-blue-500/10 p-4 text-blue-800 dark:text-blue-200" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-500/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-blue-200']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Copy} */
Copy;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 sm:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.form.validFrom),
    type: "date",
    label: "Válida desde",
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.validFrom ? 'Indique la fecha.' : undefined),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.form.validFrom),
    type: "date",
    label: "Válida desde",
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.validFrom ? 'Indique la fecha.' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.form.validTo),
    type: "date",
    label: "Válida hasta",
    error: (__VLS_ctx.form.submitted && (!__VLS_ctx.form.validTo || __VLS_ctx.form.validTo < __VLS_ctx.form.validFrom)
        ? 'Revise el rango.'
        : undefined),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.form.validTo),
    type: "date",
    label: "Válida hasta",
    error: (__VLS_ctx.form.submitted && (!__VLS_ctx.form.validTo || __VLS_ctx.form.validTo < __VLS_ctx.form.validFrom)
        ? 'Revise el rango.'
        : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}));
const __VLS_17 = __VLS_16({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
const __VLS_21 = {
    /** @type {typeof __VLS_20.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.modalStore.close();
        // @ts-ignore
        [submit, form, form, form, form, form, form, form, form, form, modalStore,];
    },
};
var __VLS_18;
var __VLS_19;
let __VLS_22;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
    label: "Duplicar tarifa",
    icon: (__VLS_ctx.Copy),
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}));
const __VLS_24 = __VLS_23({
    label: "Duplicar tarifa",
    icon: (__VLS_ctx.Copy),
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
// @ts-ignore
[form, Copy,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
