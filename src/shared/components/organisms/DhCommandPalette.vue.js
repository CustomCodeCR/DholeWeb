import { nextTick, ref, watch } from 'vue';
import { Search } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import DhModal from './DhModal.vue';
const props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const inputRef = ref(null);
watch(() => props.open, async (open) => {
    if (!open)
        return;
    await nextTick();
    inputRef.value?.focus();
});
function handleEnter() {
    const first = props.items[0];
    if (first)
        emit('select', first);
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
const __VLS_0 = DhModal || DhModal;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.open),
    title: (__VLS_ctx.t('common.search')),
    size: "lg",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.open),
    title: (__VLS_ctx.t('common.search')),
    size: "lg",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = {
    /** @type {typeof __VLS_5.close} */
    onClose: (...[$event]) => {
        __VLS_ctx.emit('close');
        // @ts-ignore
        [open, t, emit,];
    },
};
var __VLS_7;
const { default: __VLS_8 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-14 items-center gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 shadow-[var(--dh-shadow-sm)]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
let __VLS_9;
/** @ts-ignore @type { | typeof __VLS_components.Search} */
Search;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}));
const __VLS_11 = __VLS_10({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (...[$event]) => {
            __VLS_ctx.emit('update:query', $event.target.value);
            // @ts-ignore
            [emit,];
        } },
    ...{ onKeydown: (__VLS_ctx.handleEnter) },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit, handleEnter,];
        } },
    ref: "inputRef",
    value: (__VLS_ctx.query),
    placeholder: (__VLS_ctx.t('topbar.searchPlaceholder')),
    ...{ class: "h-full flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder:text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "max-h-[55vh] space-y-2 overflow-y-auto pr-1 dh-scrollbar" },
});
/** @type {__VLS_StyleScopedClasses['max-h-[55vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('select', item);
                // @ts-ignore
                [t, emit, query, items,];
            } },
        key: (item.id),
        type: "button",
        ...{ class: "flex w-full items-center gap-3 rounded-[24px] border border-transparent px-4 py-3 text-left transition hover:border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-transparent']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex h-11 w-11 items-center justify-center rounded-[18px] dh-bg-primary-soft text-[var(--dh-primary)]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-11']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-11']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    if (item.icon) {
        const __VLS_14 = (item.icon);
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            ...{ class: "h-5 w-5" },
        }));
        const __VLS_16 = __VLS_15({
            ...{ class: "h-5 w-5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "block truncate text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (item.title);
    if (item.description) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block truncate text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (item.description);
    }
    // @ts-ignore
    [];
}
if (__VLS_ctx.items.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('common.noData'));
}
// @ts-ignore
[t, items,];
var __VLS_3;
var __VLS_4;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
