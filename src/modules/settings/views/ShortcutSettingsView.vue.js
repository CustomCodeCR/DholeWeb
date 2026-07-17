import { nextTick, ref } from 'vue';
import { Keyboard } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhPageHeader } from '@/shared/components/organisms';
import { DhButton, DhInput } from '@/shared/components/atoms';
import { eventToShortcut, useShortcutStore, } from '@/core/stores/shortcutStore';
const { t } = useI18n();
const shortcutStore = useShortcutStore();
const recordingAction = ref(null);
function update(action, value) {
    if (recordingAction.value)
        return;
    shortcutStore.updateShortcut(action, value);
}
async function startRecording(action) {
    recordingAction.value = action;
    await nextTick();
    const row = document.querySelector(`[data-shortcut-action="${action}"]`);
    const focusable = row?.querySelector('input, button');
    focusable?.focus();
}
function captureShortcut(event, action) {
    if (!recordingAction.value || recordingAction.value !== action)
        return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const keys = eventToShortcut(event);
    if (!keys || !keys.includes('+'))
        return;
    shortcutStore.updateShortcut(action, keys);
    recordingAction.value = null;
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhPageHeader} */
DhPageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: (__VLS_ctx.t('settings.shortcuts')),
    subtitle: "Atajos personalizables guardados localmente. Dhole los intercepta antes que el navegador cuando la app tiene foco.",
    icon: (__VLS_ctx.Keyboard),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('settings.shortcuts')),
    subtitle: "Atajos personalizables guardados localmente. Dhole los intercepta antes que el navegador cuando la app tiene foco.",
    icon: (__VLS_ctx.Keyboard),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-6" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
for (const [shortcut] of __VLS_vFor((__VLS_ctx.shortcutStore.shortcuts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onKeydown: (...[$event]) => {
                __VLS_ctx.captureShortcut($event, shortcut.action);
                // @ts-ignore
                [t, Keyboard, shortcutStore, captureShortcut,];
            } },
        key: (shortcut.action),
        ...{ class: "grid gap-3 rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 md:grid-cols-[1fr_280px_120px] md:items-end" },
        'data-shortcut-action': (shortcut.action),
        'data-dhole-shortcut-recorder': (__VLS_ctx.recordingAction === shortcut.action ? 'true' : undefined),
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-[1fr_280px_120px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:items-end']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (shortcut.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (shortcut.action);
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ 'onFocus': {} },
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.recordingAction === shortcut.action ? 'Presione la combinación...' : shortcut.keys),
        label: "Combinación",
    }));
    const __VLS_7 = __VLS_6({
        ...{ 'onFocus': {} },
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.recordingAction === shortcut.action ? 'Presione la combinación...' : shortcut.keys),
        label: "Combinación",
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    let __VLS_10;
    const __VLS_11 = {
        /** @type {typeof __VLS_10.focus} */
        onFocus: (...[$event]) => {
            __VLS_ctx.startRecording(shortcut.action);
            // @ts-ignore
            [recordingAction, recordingAction, startRecording,];
        },
    };
    const __VLS_12 = {
        /** @type {typeof __VLS_10.'update:modelValue'} */
        'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.update(shortcut.action, $event);
            // @ts-ignore
            [update,];
        },
    };
    var __VLS_8;
    var __VLS_9;
    let __VLS_13;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.recordingAction === shortcut.action ? 'Grabando' : 'Grabar'),
        variant: "secondary",
    }));
    const __VLS_15 = __VLS_14({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.recordingAction === shortcut.action ? 'Grabando' : 'Grabar'),
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    let __VLS_18;
    const __VLS_19 = {
        /** @type {typeof __VLS_18.click} */
        onClick: (...[$event]) => {
            __VLS_ctx.startRecording(shortcut.action);
            // @ts-ignore
            [recordingAction, startRecording,];
        },
    };
    var __VLS_16;
    var __VLS_17;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_20;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    ...{ 'onClick': {} },
    label: "Restaurar",
    variant: "secondary",
}));
const __VLS_22 = __VLS_21({
    ...{ 'onClick': {} },
    label: "Restaurar",
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_25;
const __VLS_26 = {
    /** @type {typeof __VLS_25.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.shortcutStore.reset();
        // @ts-ignore
        [shortcutStore,];
    },
};
var __VLS_23;
var __VLS_24;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
