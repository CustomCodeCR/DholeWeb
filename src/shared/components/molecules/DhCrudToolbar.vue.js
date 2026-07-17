import { Filter, Plus, RefreshCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import DhButton from '@/shared/components/atoms/DhButton.vue';
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue';
import DhSearchInput from './DhSearchInput.vue';
const __VLS_props = withDefaults(defineProps(), { showCreate: true });
const emit = defineEmits();
const { t } = useI18n();
const __VLS_defaults = { showCreate: true };
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
    ...{ class: "flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
if (__VLS_ctx.title) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-xl font-black tracking-tight text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.title);
}
var __VLS_0 = {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_2 = DhSearchInput;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent1(__VLS_2, new __VLS_2({
    ...{ 'onUpdate:modelValue': {} },
    ...{ 'onSearch': {} },
    ...{ class: "w-full md:w-80" },
    modelValue: (__VLS_ctx.search),
}));
const __VLS_4 = __VLS_3({
    ...{ 'onUpdate:modelValue': {} },
    ...{ 'onSearch': {} },
    ...{ class: "w-full md:w-80" },
    modelValue: (__VLS_ctx.search),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
let __VLS_7;
const __VLS_8 = {
    /** @type {typeof __VLS_7.'update:modelValue'} */
    'onUpdate:modelValue': (...[$event]) => {
        __VLS_ctx.emit('update:search', $event);
        // @ts-ignore
        [title, title, search, emit,];
    },
};
const __VLS_9 = {
    /** @type {typeof __VLS_7.search} */
    onSearch: (...[$event]) => {
        __VLS_ctx.emit('search');
        // @ts-ignore
        [emit,];
    },
};
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-80']} */ ;
var __VLS_5;
var __VLS_6;
const __VLS_10 = DhIconButton;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Filter),
    label: (__VLS_ctx.t('common.filters')),
    variant: "secondary",
}));
const __VLS_12 = __VLS_11({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Filter),
    label: (__VLS_ctx.t('common.filters')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
const __VLS_16 = {
    /** @type {typeof __VLS_15.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.emit('filter');
        // @ts-ignore
        [emit, Filter, t,];
    },
};
var __VLS_13;
var __VLS_14;
const __VLS_17 = DhIconButton;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshCcw),
    label: (__VLS_ctx.t('common.refresh')),
    variant: "secondary",
}));
const __VLS_19 = __VLS_18({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshCcw),
    label: (__VLS_ctx.t('common.refresh')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
let __VLS_22;
const __VLS_23 = {
    /** @type {typeof __VLS_22.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.emit('refresh');
        // @ts-ignore
        [emit, t, RefreshCcw,];
    },
};
var __VLS_20;
var __VLS_21;
if (__VLS_ctx.showCreate) {
    const __VLS_24 = DhButton;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Plus),
        label: (__VLS_ctx.createLabel ?? __VLS_ctx.t('common.create')),
    }));
    const __VLS_26 = __VLS_25({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Plus),
        label: (__VLS_ctx.createLabel ?? __VLS_ctx.t('common.create')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    let __VLS_29;
    const __VLS_30 = {
        /** @type {typeof __VLS_29.click} */
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.showCreate))
                return;
            __VLS_ctx.emit('create');
            // @ts-ignore
            [emit, t, showCreate, Plus, createLabel,];
        },
    };
    var __VLS_27;
    var __VLS_28;
}
// @ts-ignore
var __VLS_1 = __VLS_0;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
