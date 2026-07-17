import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { GripVertical, Plus, Trash2 } from 'lucide-vue-next';
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms';
const props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const actionOptions = computed(() => [
    { value: 'goto', label: 'goto / navigate' },
    { value: 'waitForSelector', label: 'waitForSelector' },
    { value: 'waitForUrl', label: 'waitForUrl' },
    { value: 'click', label: 'click' },
    { value: 'fill', label: 'fill / type' },
    { value: 'press', label: 'press' },
    { value: 'select', label: 'select option' },
    { value: 'check', label: 'check' },
    { value: 'uncheck', label: 'uncheck' },
    { value: 'wait', label: 'wait / delay' },
]);
const valueSourceOptions = computed(() => [
    { value: '', label: t('scraping.noValue') },
    { value: 'literal', label: t('scraping.literalValue') },
    { value: 'credential.username', label: t('scraping.credentialUsernameValue') },
    { value: 'credential.secret', label: t('scraping.credentialSecretValue') },
    { value: 'job.portOfLoadingName', label: 'Job: POL name' },
    { value: 'job.portOfLoadingCode', label: 'Job: POL code' },
    { value: 'job.portOfEntryName', label: 'Job: POE name' },
    { value: 'job.portOfEntryCode', label: 'Job: POE code' },
    { value: 'job.portOfDischargeName', label: 'Job: POD name' },
    { value: 'job.portOfDischargeCode', label: 'Job: POD code' },
    { value: 'job.containerTypeName', label: 'Job: container name' },
    { value: 'job.containerTypeCode', label: 'Job: container code' },
    { value: 'job.commodity', label: 'Job: commodity' },
    { value: 'job.weightKg', label: 'Job: weight kg' },
    { value: 'job.readyDate', label: 'Job: ready date' },
    { value: 'input.custom', label: t('scraping.inputValue') },
]);
function newStep() {
    return {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        action: 'waitForSelector',
        selector: '',
        valueSource: '',
        value: '',
        key: '',
        url: '',
        urlContains: '',
        timeoutMilliseconds: '30000',
    };
}
function updateStep(index, patch) {
    const next = props.modelValue.map((step, currentIndex) => currentIndex === index ? { ...step, ...patch } : step);
    emit('update:modelValue', next);
}
function addStep() {
    emit('update:modelValue', [...props.modelValue, newStep()]);
}
function removeStep(index) {
    emit('update:modelValue', props.modelValue.filter((_, currentIndex) => currentIndex !== index));
}
function moveStep(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= props.modelValue.length)
        return;
    const next = [...props.modelValue];
    const [item] = next.splice(index, 1);
    if (!item)
        return;
    next.splice(target, 0, item);
    emit('update:modelValue', next);
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-sm font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.title);
if (__VLS_ctx.hint) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.hint);
}
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    label: (__VLS_ctx.t('scraping.addStep')),
    size: "sm",
    variant: "secondary",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    label: (__VLS_ctx.t('scraping.addStep')),
    size: "sm",
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = {
    /** @type {typeof __VLS_5.click} */
    onClick: (__VLS_ctx.addStep),
};
var __VLS_3;
var __VLS_4;
if (!__VLS_ctx.modelValue.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-dashed border-[var(--dh-border)] p-4 text-sm font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.noSteps'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    for (const [step, index] of __VLS_vFor((__VLS_ctx.modelValue))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (step.id),
            ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-black/[0.02] p-4 dark:bg-white/[0.03]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/[0.02]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.03]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-3 flex items-center justify-between gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        let __VLS_7;
        /** @ts-ignore @type { | typeof __VLS_components.GripVertical} */
        GripVertical;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_9 = __VLS_8({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        (__VLS_ctx.t('scraping.step'));
        (index + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_12;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
            ...{ 'onClick': {} },
            label: "↑",
            size: "sm",
            variant: "ghost",
            disabled: (index === 0),
        }));
        const __VLS_14 = __VLS_13({
            ...{ 'onClick': {} },
            label: "↑",
            size: "sm",
            variant: "ghost",
            disabled: (index === 0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        let __VLS_17;
        const __VLS_18 = {
            /** @type {typeof __VLS_17.click} */
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.moveStep(index, -1);
                // @ts-ignore
                [title, hint, hint, Plus, t, t, t, addStep, modelValue, modelValue, moveStep,];
            },
        };
        var __VLS_15;
        var __VLS_16;
        let __VLS_19;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
            ...{ 'onClick': {} },
            label: "↓",
            size: "sm",
            variant: "ghost",
            disabled: (index === __VLS_ctx.modelValue.length - 1),
        }));
        const __VLS_21 = __VLS_20({
            ...{ 'onClick': {} },
            label: "↓",
            size: "sm",
            variant: "ghost",
            disabled: (index === __VLS_ctx.modelValue.length - 1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_20));
        let __VLS_24;
        const __VLS_25 = {
            /** @type {typeof __VLS_24.click} */
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.moveStep(index, 1);
                // @ts-ignore
                [modelValue, moveStep,];
            },
        };
        var __VLS_22;
        var __VLS_23;
        let __VLS_26;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }));
        const __VLS_28 = __VLS_27({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_27));
        let __VLS_31;
        const __VLS_32 = {
            /** @type {typeof __VLS_31.click} */
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.removeStep(index);
                // @ts-ignore
                [Trash2, removeStep,];
            },
        };
        var __VLS_29;
        var __VLS_30;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        let __VLS_33;
        /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
        DhSelect;
        // @ts-ignore
        const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.action),
            label: (__VLS_ctx.t('scraping.stepAction')),
            options: (__VLS_ctx.actionOptions),
        }));
        const __VLS_35 = __VLS_34({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.action),
            label: (__VLS_ctx.t('scraping.stepAction')),
            options: (__VLS_ctx.actionOptions),
        }, ...__VLS_functionalComponentArgsRest(__VLS_34));
        let __VLS_38;
        const __VLS_39 = {
            /** @type {typeof __VLS_38.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { action: String($event ?? '') });
                // @ts-ignore
                [t, actionOptions, updateStep,];
            },
        };
        var __VLS_36;
        var __VLS_37;
        let __VLS_40;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.timeoutMilliseconds),
            label: (__VLS_ctx.t('scraping.timeoutMs')),
            type: "number",
        }));
        const __VLS_42 = __VLS_41({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.timeoutMilliseconds),
            label: (__VLS_ctx.t('scraping.timeoutMs')),
            type: "number",
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
        let __VLS_45;
        const __VLS_46 = {
            /** @type {typeof __VLS_45.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { timeoutMilliseconds: String($event ?? '') });
                // @ts-ignore
                [t, updateStep,];
            },
        };
        var __VLS_43;
        var __VLS_44;
        let __VLS_47;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.url),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.stepUrl')),
            placeholder: "https://www.maersk.com/book/",
        }));
        const __VLS_49 = __VLS_48({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.url),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.stepUrl')),
            placeholder: "https://www.maersk.com/book/",
        }, ...__VLS_functionalComponentArgsRest(__VLS_48));
        let __VLS_52;
        const __VLS_53 = {
            /** @type {typeof __VLS_52.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { url: String($event ?? '') });
                // @ts-ignore
                [t, updateStep,];
            },
        };
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        var __VLS_50;
        var __VLS_51;
        let __VLS_54;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_55 = __VLS_asFunctionalComponent1(__VLS_54, new __VLS_54({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.selector),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.selector')),
            placeholder: "xpath=//*[@id='mc-input-origin']",
        }));
        const __VLS_56 = __VLS_55({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.selector),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.selector')),
            placeholder: "xpath=//*[@id='mc-input-origin']",
        }, ...__VLS_functionalComponentArgsRest(__VLS_55));
        let __VLS_59;
        const __VLS_60 = {
            /** @type {typeof __VLS_59.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { selector: String($event ?? '') });
                // @ts-ignore
                [t, updateStep,];
            },
        };
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        var __VLS_57;
        var __VLS_58;
        let __VLS_61;
        /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
        DhSelect;
        // @ts-ignore
        const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.valueSource),
            label: (__VLS_ctx.t('scraping.valueSource')),
            options: (__VLS_ctx.valueSourceOptions),
        }));
        const __VLS_63 = __VLS_62({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.valueSource),
            label: (__VLS_ctx.t('scraping.valueSource')),
            options: (__VLS_ctx.valueSourceOptions),
        }, ...__VLS_functionalComponentArgsRest(__VLS_62));
        let __VLS_66;
        const __VLS_67 = {
            /** @type {typeof __VLS_66.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { valueSource: String($event ?? '') });
                // @ts-ignore
                [t, updateStep, valueSourceOptions,];
            },
        };
        var __VLS_64;
        var __VLS_65;
        let __VLS_68;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.value),
            label: (step.valueSource === 'input.custom' ? __VLS_ctx.t('scraping.inputName') : __VLS_ctx.t('scraping.stepValue')),
            placeholder: "literal value / custom input name",
        }));
        const __VLS_70 = __VLS_69({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.value),
            label: (step.valueSource === 'input.custom' ? __VLS_ctx.t('scraping.inputName') : __VLS_ctx.t('scraping.stepValue')),
            placeholder: "literal value / custom input name",
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
        let __VLS_73;
        const __VLS_74 = {
            /** @type {typeof __VLS_73.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { value: String($event ?? '') });
                // @ts-ignore
                [t, t, updateStep,];
            },
        };
        var __VLS_71;
        var __VLS_72;
        let __VLS_75;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.key),
            label: (__VLS_ctx.t('scraping.keyToPress')),
            placeholder: "Enter / ArrowDown",
        }));
        const __VLS_77 = __VLS_76({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.key),
            label: (__VLS_ctx.t('scraping.keyToPress')),
            placeholder: "Enter / ArrowDown",
        }, ...__VLS_functionalComponentArgsRest(__VLS_76));
        let __VLS_80;
        const __VLS_81 = {
            /** @type {typeof __VLS_80.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { key: String($event ?? '') });
                // @ts-ignore
                [t, updateStep,];
            },
        };
        var __VLS_78;
        var __VLS_79;
        let __VLS_82;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.urlContains),
            label: (__VLS_ctx.t('scraping.urlContains')),
            placeholder: "maersk.com/book",
        }));
        const __VLS_84 = __VLS_83({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (step.urlContains),
            label: (__VLS_ctx.t('scraping.urlContains')),
            placeholder: "maersk.com/book",
        }, ...__VLS_functionalComponentArgsRest(__VLS_83));
        let __VLS_87;
        const __VLS_88 = {
            /** @type {typeof __VLS_87.'update:modelValue'} */
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.modelValue.length))
                    return;
                __VLS_ctx.updateStep(index, { urlContains: String($event ?? '') });
                // @ts-ignore
                [t, updateStep,];
            },
        };
        var __VLS_85;
        var __VLS_86;
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
