import { useI18n } from 'vue-i18n';
const __VLS_export = ((__VLS_props, __VLS_ctx, __VLS_exposed, __VLS_setup = (async () => {
    const __VLS_props = defineProps();
    const emit = defineEmits();
    const { t } = useI18n();
    function valueOf(row, key) {
        return row[key];
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
        ...{ class: "dh-scrollbar overflow-x-auto rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl" },
    });
    /** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['backdrop-blur-xl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "w-full min-w-[760px] border-collapse text-left text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-[760px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-collapse']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({
        ...{ class: "bg-black/[0.035] text-xs text-[var(--dh-text-muted)] dark:bg-white/[0.05]" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    for (const [column] of __VLS_vFor((__VLS_ctx.columns))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            key: (String(column.key)),
            ...{ class: "px-5 py-4 font-black uppercase tracking-[0.12em]" },
            ...{ style: ({ width: column.width }) },
            ...{ class: ([
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                ]) },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
        (column.label);
        // @ts-ignore
        [columns,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: (__VLS_ctx.columns.length),
            ...{ class: "px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-12']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (__VLS_ctx.t('common.loading'));
    }
    else if (__VLS_ctx.rows.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: (__VLS_ctx.columns.length),
            ...{ class: "px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-12']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (__VLS_ctx.emptyText ?? __VLS_ctx.t('common.noData'));
    }
    else {
        for (const [row] of __VLS_vFor((__VLS_ctx.rows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.rows.length === 0))
                            return;
                        __VLS_ctx.emit('rowClick', row);
                        // @ts-ignore
                        [columns, columns, loading, t, t, rows, rows, emptyText, emit,];
                    } },
                key: (String(row.id ?? JSON.stringify(row))),
                ...{ class: "cursor-pointer border-t border-[var(--dh-border)] transition hover:bg-[var(--dh-card-hover)]" },
            });
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
            for (const [column] of __VLS_vFor((__VLS_ctx.columns))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    key: (String(column.key)),
                    ...{ class: "px-5 py-4 text-[var(--dh-text-soft)]" },
                    ...{ class: ([
                            column.align === 'center' && 'text-center',
                            column.align === 'right' && 'text-right',
                        ]) },
                });
                /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
                var __VLS_0 = {
                    row: (row),
                    value: (__VLS_ctx.valueOf(row, column.key)),
                };
                var __VLS_1 = __VLS_tryAsConstant(`cell-${String(column.key)}`);
                (__VLS_ctx.valueOf(row, column.key));
                // @ts-ignore
                [columns, valueOf, valueOf,];
            }
            // @ts-ignore
            [];
        }
    }
    // @ts-ignore
    var __VLS_2 = __VLS_1, __VLS_3 = __VLS_0;
    // @ts-ignore
    [];
    return {};
})()) => ({}));
export default {};
