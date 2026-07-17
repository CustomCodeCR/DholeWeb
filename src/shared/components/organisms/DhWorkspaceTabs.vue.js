import { PanelRightOpen, X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore';
const router = useRouter();
const tabsStore = useWorkspaceTabsStore();
const { t } = useI18n();
function activate(path, key) {
    tabsStore.setActiveTab(key);
    router.push(path);
}
function close(key) {
    const wasActive = tabsStore.activeKey === key;
    tabsStore.closeTab(key);
    if (wasActive) {
        const active = tabsStore.tabs.find((x) => x.key === tabsStore.activeKey);
        router.push(active?.path ?? '/home');
    }
}
function split(key) {
    tabsStore.openSplitPane(key);
}
function onDragStart(event, key) {
    event.dataTransfer?.setData('application/dhole-tab-key', key);
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.tabsStore.tabs.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mx-4 mt-4 flex gap-2 overflow-x-auto rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-2 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl dh-scrollbar" },
    });
    /** @type {__VLS_StyleScopedClasses['mx-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['backdrop-blur-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
    for (const [tab] of __VLS_vFor((__VLS_ctx.tabsStore.tabs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tabsStore.tabs.length))
                        return;
                    __VLS_ctx.activate(tab.path, tab.key);
                    // @ts-ignore
                    [tabsStore, tabsStore, activate,];
                } },
            ...{ onDragstart: (...[$event]) => {
                    if (!(__VLS_ctx.tabsStore.tabs.length))
                        return;
                    __VLS_ctx.onDragStart($event, tab.key);
                    // @ts-ignore
                    [onDragStart,];
                } },
            key: (tab.key),
            draggable: "true",
            ...{ class: "group flex shrink-0 items-center gap-2 rounded-[18px] px-3 py-2 text-sm font-black transition" },
            ...{ class: (__VLS_ctx.tabsStore.activeKey === tab.key
                    ? 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]'
                    : 'text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]') },
        });
        /** @type {__VLS_StyleScopedClasses['group']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        (tab.title);
        if (tab.path !== '/home') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.tabsStore.tabs.length))
                            return;
                        if (!(tab.path !== '/home'))
                            return;
                        __VLS_ctx.split(tab.key);
                        // @ts-ignore
                        [tabsStore, split,];
                    } },
                ...{ class: "rounded-lg p-0.5 opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10" },
                title: (__VLS_ctx.t('tabs.openSplit')),
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-black/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
            let __VLS_0;
            /** @ts-ignore @type { | typeof __VLS_components.PanelRightOpen} */
            PanelRightOpen;
            // @ts-ignore
            const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
                ...{ class: "h-3.5 w-3.5" },
            }));
            const __VLS_2 = __VLS_1({
                ...{ class: "h-3.5 w-3.5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_1));
            /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        }
        if (tab.closable) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.tabsStore.tabs.length))
                            return;
                        if (!(tab.closable))
                            return;
                        __VLS_ctx.close(tab.key);
                        // @ts-ignore
                        [t, close,];
                    } },
                ...{ class: "rounded-lg p-0.5 opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10" },
                title: (__VLS_ctx.t('tabs.close')),
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-black/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
            let __VLS_5;
            /** @ts-ignore @type { | typeof __VLS_components.X} */
            X;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
                ...{ class: "h-3.5 w-3.5" },
            }));
            const __VLS_7 = __VLS_6({
                ...{ class: "h-3.5 w-3.5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        }
        // @ts-ignore
        [t,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
