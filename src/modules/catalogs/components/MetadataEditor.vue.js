import { Plus, Trash2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { DhButton, DhInput } from '@/shared/components/atoms';
const props = defineProps();
const emit = defineEmits();
const rows = ref([]);
const internalUpdate = ref(false);
const hasRows = computed(() => rows.value.length > 0);
function createId() {
    return crypto.randomUUID();
}
function detectType(value) {
    if (typeof value === 'number')
        return 'number';
    if (typeof value === 'boolean')
        return 'boolean';
    if (typeof value === 'object' && value !== null)
        return 'json';
    return 'string';
}
function toInputValue(value) {
    if (typeof value === 'object' && value !== null)
        return JSON.stringify(value);
    if (value === null || value === undefined)
        return '';
    return String(value);
}
function parseValue(row) {
    const value = row.value.trim();
    if (row.type === 'number') {
        const numberValue = Number(value);
        return Number.isNaN(numberValue) ? 0 : numberValue;
    }
    if (row.type === 'boolean') {
        return (value === 'true' ||
            value === '1' ||
            value.toLowerCase() === 'sí' ||
            value.toLowerCase() === 'si');
    }
    if (row.type === 'json') {
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    return row.value;
}
function syncFromModel(value) {
    if (!value) {
        rows.value = [];
        return;
    }
    try {
        const parsed = JSON.parse(value);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            rows.value = [];
            return;
        }
        rows.value = Object.entries(parsed).map(([key, itemValue]) => ({
            id: createId(),
            key,
            value: toInputValue(itemValue),
            type: detectType(itemValue),
        }));
    }
    catch {
        rows.value = [];
    }
}
function emitJson() {
    internalUpdate.value = true;
    const metadata = rows.value
        .filter((row) => row.key.trim())
        .reduce((acc, row) => {
        acc[row.key.trim()] = parseValue(row);
        return acc;
    }, {});
    const value = Object.keys(metadata).length === 0 ? null : JSON.stringify(metadata);
    emit('update:modelValue', value);
    queueMicrotask(() => {
        internalUpdate.value = false;
    });
}
function addRow() {
    rows.value.push({
        id: createId(),
        key: '',
        value: '',
        type: 'string',
    });
    emitJson();
}
function removeRow(id) {
    rows.value = rows.value.filter((row) => row.id !== id);
    emitJson();
}
watch(() => props.modelValue, (value) => {
    if (!internalUpdate.value)
        syncFromModel(value);
}, { immediate: true });
watch(rows, () => {
    emitJson();
}, { deep: true });
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
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-3 flex items-center justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-sm font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    label: "Campo",
    size: "sm",
    variant: "secondary",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    label: "Campo",
    size: "sm",
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = {
    /** @type {typeof __VLS_5.click} */
    onClick: (__VLS_ctx.addRow),
};
var __VLS_3;
var __VLS_4;
if (!__VLS_ctx.hasRows) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[20px] border border-dashed border-[var(--dh-border)] p-4 text-center text-sm font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    for (const [row] of __VLS_vFor((__VLS_ctx.rows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (row.id),
            ...{ class: "grid gap-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 md:grid-cols-[1fr_130px_1.4fr_auto]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-[1fr_130px_1.4fr_auto]']} */ ;
        let __VLS_7;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            modelValue: (row.key),
            label: "Campo",
            placeholder: "category",
        }));
        const __VLS_9 = __VLS_8({
            modelValue: (row.key),
            label: "Campo",
            placeholder: "category",
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "block" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "mb-1 block text-xs font-black text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (row.type),
            ...{ class: "h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none" },
        });
        /** @type {__VLS_StyleScopedClasses['h-11']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "string",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "number",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "boolean",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "json",
        });
        let __VLS_12;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
            modelValue: (row.value),
            label: "Valor",
            placeholder: "trade_terms",
        }));
        const __VLS_14 = __VLS_13({
            modelValue: (row.value),
            label: "Valor",
            placeholder: "trade_terms",
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.hasRows))
                        return;
                    __VLS_ctx.removeRow(row.id);
                    // @ts-ignore
                    [Plus, addRow, hasRows, rows, removeRow,];
                } },
            type: "button",
            ...{ class: "mt-6 rounded-2xl p-2 text-red-500 hover:bg-red-500/10" },
            title: "Eliminar campo",
        });
        /** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
        let __VLS_17;
        /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
        Trash2;
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_19 = __VLS_18({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_18));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
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
