const __VLS_props = withDefaults(defineProps(), { variant: 'ghost', size: 'md', disabled: false });
const emit = defineEmits();
const __VLS_defaults = { variant: 'ghost', size: 'md', disabled: false };
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
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('click', $event);
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    'aria-label': (__VLS_ctx.label),
    title: (__VLS_ctx.label),
    disabled: (__VLS_ctx.disabled),
    ...{ class: "inline-flex items-center justify-center rounded-[18px] transition-all duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50" },
    ...{ class: ([
            __VLS_ctx.size === 'sm' && 'h-9 w-9', __VLS_ctx.size === 'md' && 'h-11 w-11', __VLS_ctx.size === 'lg' && 'h-13 w-13',
            __VLS_ctx.variant === 'primary' && 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]',
            __VLS_ctx.variant === 'secondary' && 'border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl hover:bg-[var(--dh-card-hover)]',
            __VLS_ctx.variant === 'ghost' && 'text-[var(--dh-text-soft)] hover:bg-black/5 dark:hover:bg-white/10',
            __VLS_ctx.variant === 'danger' && 'text-red-600 hover:bg-red-500/10',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-[0.96]']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
const __VLS_0 = (__VLS_ctx.icon);
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[label, label, disabled, size, size, size, variant, variant, variant, variant, icon,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
