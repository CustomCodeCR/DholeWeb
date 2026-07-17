import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';
const __VLS_props = defineProps();
const __VLS_emit = defineEmits();
const { t } = useI18n();
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
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "fixed bottom-4 left-4 top-4 z-40 flex overflow-hidden rounded-[34px] border border-[var(--dh-border)] bg-[var(--dh-shell)] shadow-[var(--dh-shadow-lg)] backdrop-blur-2xl transition-[width] duration-300" },
    ...{ class: (__VLS_ctx.collapsed ? 'w-20' : 'w-72') },
});
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
/** @type {__VLS_StyleScopedClasses['left-4']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[34px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell)]']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-lg)]']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-[width]']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex min-h-0 w-full flex-col" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shrink-0 border-b border-[var(--dh-border)] p-3" },
});
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dh-liquid flex items-center rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-[var(--dh-shadow-sm)]" },
    ...{ class: (__VLS_ctx.collapsed ? 'justify-center' : 'gap-3') },
});
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[var(--dh-primary)] text-lg font-black text-white shadow-[var(--dh-glow)]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-glow)]']} */ ;
if (!__VLS_ctx.collapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "truncate text-sm font-black tracking-tight text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('app.name'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "truncate text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('app.subtitle'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle-collapse');
            // @ts-ignore
            [collapsed, collapsed, collapsed, t, t, $emit,];
        } },
    ...{ class: "mt-3 flex w-full items-center justify-center rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]" },
    title: (__VLS_ctx.collapsed ? __VLS_ctx.t('sidebar.expand') : __VLS_ctx.t('sidebar.collapse')),
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-[var(--dh-text)]']} */ ;
if (__VLS_ctx.collapsed) {
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.PanelLeftOpen} */
    PanelLeftOpen;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
else {
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.PanelLeftClose} */
    PanelLeftClose;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "dh-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pr-2" },
});
/** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overscroll-contain']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-2']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement(__VLS_intrinsics.template)({
        key: (item.label),
    });
    if (item.children) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-1.5" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center rounded-[20px] px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--dh-text-muted)]" },
            ...{ class: (__VLS_ctx.collapsed ? 'justify-center' : 'gap-3') },
            title: (__VLS_ctx.collapsed ? item.label : undefined),
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.18em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        const __VLS_10 = (item.icon);
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        if (!__VLS_ctx.collapsed) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "truncate" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (item.label);
        }
        if (!__VLS_ctx.collapsed) {
            let __VLS_15;
            /** @ts-ignore @type { | typeof __VLS_components.ChevronDown} */
            ChevronDown;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
                ...{ class: "ml-auto h-4 w-4 shrink-0" },
            }));
            const __VLS_17 = __VLS_16({
                ...{ class: "ml-auto h-4 w-4 shrink-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
            /** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        }
        for (const [child] of __VLS_vFor((item.children))) {
            let __VLS_20;
            /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
            RouterLink;
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
                key: (child.path),
                to: (child.path ?? '/'),
                ...{ class: "flex items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]" },
                ...{ class: (__VLS_ctx.collapsed ? 'justify-center' : 'gap-3') },
                title: (__VLS_ctx.collapsed ? child.label : undefined),
                activeClass: "!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]",
            }));
            const __VLS_22 = __VLS_21({
                key: (child.path),
                to: (child.path ?? '/'),
                ...{ class: "flex items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]" },
                ...{ class: (__VLS_ctx.collapsed ? 'justify-center' : 'gap-3') },
                title: (__VLS_ctx.collapsed ? child.label : undefined),
                activeClass: "!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]",
            }, ...__VLS_functionalComponentArgsRest(__VLS_21));
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
            const { default: __VLS_25 } = __VLS_23.slots;
            const __VLS_26 = (child.icon);
            // @ts-ignore
            const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
                ...{ class: "h-4 w-4 shrink-0" },
            }));
            const __VLS_28 = __VLS_27({
                ...{ class: "h-4 w-4 shrink-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_27));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            if (!__VLS_ctx.collapsed) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "truncate" },
                });
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (child.label);
            }
            // @ts-ignore
            [collapsed, collapsed, collapsed, collapsed, collapsed, collapsed, collapsed, collapsed, collapsed, t, t, items,];
            var __VLS_23;
            // @ts-ignore
            [];
        }
    }
    else {
        let __VLS_31;
        /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
        RouterLink;
        // @ts-ignore
        const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
            to: (item.path ?? '/'),
            ...{ class: "flex items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]" },
            ...{ class: (__VLS_ctx.collapsed ? 'justify-center' : 'gap-3') },
            title: (__VLS_ctx.collapsed ? item.label : undefined),
            activeClass: "!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]",
        }));
        const __VLS_33 = __VLS_32({
            to: (item.path ?? '/'),
            ...{ class: "flex items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]" },
            ...{ class: (__VLS_ctx.collapsed ? 'justify-center' : 'gap-3') },
            title: (__VLS_ctx.collapsed ? item.label : undefined),
            activeClass: "!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]",
        }, ...__VLS_functionalComponentArgsRest(__VLS_32));
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
        const { default: __VLS_36 } = __VLS_34.slots;
        const __VLS_37 = (item.icon);
        // @ts-ignore
        const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_39 = __VLS_38({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_38));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        if (!__VLS_ctx.collapsed) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "truncate" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (item.label);
        }
        // @ts-ignore
        [collapsed, collapsed, collapsed,];
        var __VLS_34;
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
