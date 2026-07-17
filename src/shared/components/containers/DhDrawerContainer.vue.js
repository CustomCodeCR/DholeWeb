import { X } from 'lucide-vue-next';
import { useDrawerStore } from '@/core/stores/drawerStore';
const drawerStore = useDrawerStore();
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "drawer-backdrop",
}));
const __VLS_8 = __VLS_7({
    name: "drawer-backdrop",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
if (__VLS_ctx.drawerStore.isOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.drawerStore.isOpen))
                    return;
                __VLS_ctx.drawerStore.close();
                // @ts-ignore
                [drawerStore, drawerStore,];
            } },
        ...{ class: "fixed inset-0 z-[80] flex justify-end bg-black/35 backdrop-blur-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[80]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/35']} */ ;
    /** @type {__VLS_StyleScopedClasses['backdrop-blur-sm']} */ ;
    let __VLS_12;
    /** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
    Transition;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        name: "drawer-panel",
        appear: true,
    }));
    const __VLS_14 = __VLS_13({
        name: "drawer-panel",
        appear: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    const { default: __VLS_17 } = __VLS_15.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ...{ class: "dh-glass-strong h-full overflow-hidden border-l border-[var(--dh-border)]" },
        ...{ class: ([
                __VLS_ctx.drawerStore.size === 'sm' && 'w-full max-w-sm',
                __VLS_ctx.drawerStore.size === 'md' && 'w-full max-w-xl',
                __VLS_ctx.drawerStore.size === 'lg' && 'w-full max-w-3xl',
                __VLS_ctx.drawerStore.size === 'xl' && 'w-full max-w-5xl',
                __VLS_ctx.drawerStore.size === 'full' && 'w-full',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['dh-glass-strong']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-l']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "flex items-center justify-between border-b border-[var(--dh-border)] px-5 py-4" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-base font-bold text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.drawerStore.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.drawerStore.isOpen))
                    return;
                __VLS_ctx.drawerStore.close();
                // @ts-ignore
                [drawerStore, drawerStore, drawerStore, drawerStore, drawerStore, drawerStore, drawerStore,];
            } },
        type: "button",
        ...{ class: "rounded-2xl p-2 text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
    let __VLS_18;
    /** @ts-ignore @type { | typeof __VLS_components.X} */
    X;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_20 = __VLS_19({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
        ...{ class: "h-[calc(100vh-65px)] overflow-y-auto p-5 dh-scrollbar" },
    });
    /** @type {__VLS_StyleScopedClasses['h-[calc(100vh-65px)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
    if (__VLS_ctx.drawerStore.component) {
        const __VLS_23 = (__VLS_ctx.drawerStore.component);
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({
            ...(__VLS_ctx.drawerStore.props),
        }));
        const __VLS_25 = __VLS_24({
            ...(__VLS_ctx.drawerStore.props),
        }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    }
    // @ts-ignore
    [drawerStore, drawerStore, drawerStore,];
    var __VLS_15;
}
// @ts-ignore
[];
var __VLS_9;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
