import { computed, reactive } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';
import { DhButton, DhTextarea } from '@/shared/components/atoms';
import { PricingService } from '@/core/services/pricingService';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
const props = defineProps();
const modalStore = useModalStore();
const toastStore = useToastStore();
const form = reactive({ reason: '', submitted: false, saving: false });
const importIds = computed(() => [...new Set((props.ids ?? []).filter(Boolean))]);
const isBatchImport = computed(() => props.target === 'import' && importIds.value.length > 0);
async function submit() {
    form.submitted = true;
    if (!form.reason.trim())
        return;
    try {
        form.saving = true;
        if (props.target === 'import') {
            if (isBatchImport.value) {
                await PricingService.rejectImportRates(importIds.value, { reason: form.reason.trim() });
            }
            else if (props.id) {
                await PricingService.rejectImportRate(props.id, { reason: form.reason.trim() });
            }
            else {
                throw new Error('No se indicó ninguna tarifa importada para rechazar.');
            }
        }
        else if (props.id) {
            await PricingService.rejectRateMargin(props.id, { reason: form.reason.trim() });
        }
        else {
            throw new Error('No se indicó la aprobación de margen que se desea rechazar.');
        }
        toastStore.success(props.target === 'import'
            ? isBatchImport.value
                ? `${importIds.value.length} importaciones rechazadas`
                : 'Importación rechazada'
            : 'Margen rechazado');
        modalStore.close();
        await props.onSaved?.();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo completar el rechazo.');
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
    ...{ class: "flex items-start gap-3 rounded-[22px] bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-amber-200']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
AlertTriangle;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
if (__VLS_ctx.isBatchImport) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (__VLS_ctx.importIds.length);
}
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.form.reason),
    label: "Motivo",
    rows: (4),
    placeholder: "Explique por qué se rechaza...",
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.reason.trim() ? 'El motivo es obligatorio.' : undefined),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.form.reason),
    label: "Motivo",
    rows: (4),
    placeholder: "Explique por qué se rechaza...",
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.reason.trim() ? 'El motivo es obligatorio.' : undefined),
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
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}));
const __VLS_12 = __VLS_11({
    ...{ 'onClick': {} },
    label: "Cancelar",
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
const __VLS_16 = {
    /** @type {typeof __VLS_15.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.modalStore.close();
        // @ts-ignore
        [submit, isBatchImport, importIds, form, form, form, form, modalStore,];
    },
};
var __VLS_13;
var __VLS_14;
let __VLS_17;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    label: "Rechazar",
    variant: "danger",
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}));
const __VLS_19 = __VLS_18({
    label: "Rechazar",
    variant: "danger",
    type: "submit",
    loading: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
// @ts-ignore
[form,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
