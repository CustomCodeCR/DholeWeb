import { computed } from 'vue';
const props = withDefaults(defineProps(), {
    size: 'md',
    status: 'none',
});
const initials = computed(() => {
    if (!props.name)
        return '?';
    return props.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => x[0]?.toUpperCase())
        .join('');
});
const __VLS_defaults = {
    size: 'md',
    status: 'none',
};
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
    ...{ class: "relative inline-flex shrink-0" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
if (__VLS_ctx.src) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (__VLS_ctx.src),
        alt: (__VLS_ctx.name),
        ...{ class: "rounded-full object-cover ring-2 ring-white/70 dark:ring-white/10" },
        ...{ class: ([
                __VLS_ctx.size === 'sm' && 'h-8 w-8',
                __VLS_ctx.size === 'md' && 'h-10 w-10',
                __VLS_ctx.size === 'lg' && 'h-14 w-14',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:ring-white/10']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "inline-flex items-center justify-center rounded-full bg-[var(--dh-primary)] font-bold text-white ring-2 ring-white/70 dark:ring-white/10" },
        ...{ class: ([
                __VLS_ctx.size === 'sm' && 'h-8 w-8 text-xs',
                __VLS_ctx.size === 'md' && 'h-10 w-10 text-sm',
                __VLS_ctx.size === 'lg' && 'h-14 w-14 text-base',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:ring-white/10']} */ ;
    (__VLS_ctx.initials);
}
if (__VLS_ctx.status !== 'none') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-[var(--dh-black)]" },
        ...{ class: ([
                __VLS_ctx.size === 'sm' && 'h-2.5 w-2.5',
                __VLS_ctx.size === 'md' && 'h-3 w-3',
                __VLS_ctx.size === 'lg' && 'h-4 w-4',
                __VLS_ctx.status === 'online' && 'bg-green-500',
                __VLS_ctx.status === 'offline' && 'bg-zinc-400',
                __VLS_ctx.status === 'busy' && 'bg-red-500',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-white']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:border-[var(--dh-black)]']} */ ;
}
// @ts-ignore
[src, src, name, size, size, size, size, size, size, size, size, size, initials, status, status, status, status,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
