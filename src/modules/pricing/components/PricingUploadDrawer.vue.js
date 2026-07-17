import { computed, onMounted, reactive, ref } from 'vue';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-vue-next';
import { DhButton, DhSelect } from '@/shared/components/atoms';
import { PricingService } from '@/core/services/pricingService';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { createCorrelationId } from '@/modules/pricing/utils/pricingFormat';
const props = defineProps();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const fileInput = ref(null);
const file = ref(null);
const result = ref(null);
const form = reactive({ profileId: '', submitted: false, saving: false, dragging: false });
const selectedProfile = computed(() => catalogs.findById(catalogs.importProfiles.value, form.profileId));
function chooseFile(files) {
    file.value = files?.[0] ?? null;
    result.value = null;
}
function drop(event) {
    form.dragging = false;
    chooseFile(event.dataTransfer?.files ?? null);
}
async function submit() {
    form.submitted = true;
    if (!file.value || !selectedProfile.value)
        return;
    try {
        form.saving = true;
        result.value = await PricingService.extractImportRates(file.value, selectedProfile.value.slug, createCorrelationId());
        toastStore.success('Archivo procesado', `${result.value.createdRows} tarifas importadas fueron creadas.`);
        await props.onSaved?.();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo extraer el tarifario.');
    }
    finally {
        form.saving = false;
    }
}
onMounted(catalogs.loadAll);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.form.profileId),
    label: "Perfil de importación",
    placeholder: "Seleccione el formato del proveedor",
    options: (__VLS_ctx.catalogs.profileOptions.value),
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.profileId ? 'Seleccione un perfil.' : undefined),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.form.profileId),
    label: "Perfil de importación",
    placeholder: "Seleccione el formato del proveedor",
    options: (__VLS_ctx.catalogs.profileOptions.value),
    error: (__VLS_ctx.form.submitted && !__VLS_ctx.form.profileId ? 'Seleccione un perfil.' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.fileInput?.click();
            // @ts-ignore
            [form, form, form, catalogs, fileInput,];
        } },
    ...{ onDragover: (...[$event]) => {
            __VLS_ctx.form.dragging = true;
            // @ts-ignore
            [form,];
        } },
    ...{ onDragleave: (...[$event]) => {
            __VLS_ctx.form.dragging = false;
            // @ts-ignore
            [form,];
        } },
    ...{ onDrop: (__VLS_ctx.drop) },
    type: "button",
    ...{ class: "mt-5 flex min-h-64 w-full flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-8 text-center transition" },
    ...{ class: (__VLS_ctx.form.dragging
            ? 'border-[var(--dh-primary)] dh-bg-primary-soft'
            : 'border-[var(--dh-border-strong)] hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)]') },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.chooseFile($event.target.files);
            // @ts-ignore
            [form, drop, chooseFile,];
        } },
    ref: "fileInput",
    ...{ class: "hidden" },
    type: "file",
    accept: ".pdf,.xlsx,.xls,.csv,image/*",
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-16 w-16 items-center justify-center rounded-[24px] dh-bg-primary-soft text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
if (__VLS_ctx.file) {
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.FileSpreadsheet} */
    FileSpreadsheet;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "h-7 w-7" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "h-7 w-7" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
}
else {
    let __VLS_10;
    /** @ts-ignore @type { | typeof __VLS_components.UploadCloud} */
    UploadCloud;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        ...{ class: "h-7 w-7" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "h-7 w-7" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-4 text-base font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.file?.name ?? 'Arrastre o seleccione el tarifario');
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
if (__VLS_ctx.file) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-3 rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[var(--dh-text-soft)] dark:bg-white/10" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/5']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-white/10']} */ ;
    ((__VLS_ctx.file.size / 1024 / 1024).toFixed(2));
}
if (__VLS_ctx.form.submitted && !__VLS_ctx.file) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs font-semibold text-red-500" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
}
if (__VLS_ctx.result) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[26px] border p-5" },
        ...{ class: (__VLS_ctx.result.hasIssues
                ? 'border-amber-500/20 bg-amber-500/10'
                : 'border-emerald-500/20 bg-emerald-500/10') },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    if (__VLS_ctx.result.hasIssues) {
        let __VLS_15;
        /** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
        AlertTriangle;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-amber-600" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-amber-600" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
    }
    else {
        let __VLS_20;
        /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
        CheckCircle2;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-emerald-600" },
        }));
        const __VLS_22 = __VLS_21({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-emerald-600" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-emerald-600']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-lg font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (__VLS_ctx.result.totalRows);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-lg font-black text-emerald-600" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-600']} */ ;
    (__VLS_ctx.result.createdRows);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-lg font-black text-amber-600" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
    (__VLS_ctx.result.warningRows);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-lg font-black text-red-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
    (__VLS_ctx.result.invalidRows);
    if (__VLS_ctx.result.issues.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-4 max-h-48 space-y-2 overflow-y-auto dh-scrollbar" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-h-48']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
        for (const [issue, index] of __VLS_vFor((__VLS_ctx.result.issues))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (`${issue.code}-${index}`),
                ...{ class: "rounded-2xl bg-[var(--dh-card)] px-3 py-2 text-xs font-semibold text-[var(--dh-text-soft)]" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-black" },
            });
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            (issue.code);
            (issue.message);
            if (issue.sourceRowNumber) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[var(--dh-text-muted)]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
                (issue.sourceRowNumber);
            }
            // @ts-ignore
            [form, file, file, file, file, file, result, result, result, result, result, result, result, result, result,];
        }
    }
}
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
    label: (__VLS_ctx.result ? 'Cerrar' : 'Cancelar'),
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}));
const __VLS_27 = __VLS_26({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.result ? 'Cerrar' : 'Cancelar'),
    variant: "secondary",
    disabled: (__VLS_ctx.form.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_30;
const __VLS_31 = {
    /** @type {typeof __VLS_30.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.drawerStore.close();
        // @ts-ignore
        [form, result, drawerStore,];
    },
};
var __VLS_28;
var __VLS_29;
if (!__VLS_ctx.result) {
    let __VLS_32;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
        ...{ 'onClick': {} },
        label: "Extraer tarifas",
        icon: (__VLS_ctx.UploadCloud),
        loading: (__VLS_ctx.form.saving),
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onClick': {} },
        label: "Extraer tarifas",
        icon: (__VLS_ctx.UploadCloud),
        loading: (__VLS_ctx.form.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_37;
    const __VLS_38 = {
        /** @type {typeof __VLS_37.click} */
        onClick: (__VLS_ctx.submit),
    };
    var __VLS_35;
    var __VLS_36;
}
// @ts-ignore
[form, result, UploadCloud, submit,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
