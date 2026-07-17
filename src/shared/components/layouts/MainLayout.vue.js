import { BadgeDollarSign, BookOpen, ClipboardList, Home, KeyRound, Keyboard, ListTree, LockKeyhole, MonitorCheck, Palette, PanelRightClose, ServerCog, TrendingUp, Settings, Shield, Users, FileText, Mail, ReceiptText, } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DhSidebar from '@/shared/components/organisms/DhSidebar.vue';
import DhTopbar from '@/shared/components/organisms/DhTopbar.vue';
import DhWorkspaceTabs from '@/shared/components/organisms/DhWorkspaceTabs.vue';
import DhCommandPalette from '@/shared/components/organisms/DhCommandPalette.vue';
import { VIEW_SCOPES } from '@/core/auth/scopes';
import { useAuthStore } from '@/core/stores/authStore';
import { useShortcutStore, eventToShortcut } from '@/core/stores/shortcutStore';
import { useThemeStore } from '@/core/stores/themeStore';
import { useLocale } from '@/core/stores/locale';
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'dhole.sidebar.collapsed';
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const shortcutStore = useShortcutStore();
const themeStore = useThemeStore();
const localeStore = useLocale();
const tabsStore = useWorkspaceTabsStore();
const commandOpen = ref(false);
const commandQuery = ref('');
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true');
const isEmbedded = new URLSearchParams(window.location.search).get('dhEmbed') === '1';
const contentClass = computed(() => {
    return sidebarCollapsed.value ? 'pl-28' : 'pl-80';
});
const splitFrameUrl = computed(() => {
    if (!tabsStore.splitPane)
        return '';
    return `${window.location.origin}${tabsStore.splitPane.path}?dhEmbed=1`;
});
watch(sidebarCollapsed, (value) => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
});
function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
}
function canView(scope) {
    return authStore.hasScope(scope);
}
function isSuperUser() {
    return authStore.hasRole('SuperUsuario') || authStore.hasRole('SuperUser') || authStore.hasRole('superusuario');
}
const securityChildren = computed(() => {
    const children = [];
    if (canView(VIEW_SCOPES.users)) {
        children.push({ label: t('sidebar.users'), path: '/auth/users', icon: Users });
    }
    if (canView(VIEW_SCOPES.roles)) {
        children.push({ label: t('sidebar.roles'), path: '/auth/roles', icon: Shield });
    }
    if (canView(VIEW_SCOPES.scopes)) {
        children.push({ label: t('sidebar.scopes'), path: '/auth/scopes', icon: KeyRound });
    }
    if (canView(VIEW_SCOPES.sessions)) {
        children.push({ label: t('sidebar.sessions'), path: '/auth/sessions', icon: MonitorCheck });
    }
    return children;
});
const configChildren = computed(() => {
    const children = [];
    if (canView(VIEW_SCOPES.catalogs)) {
        children.push({ label: t('sidebar.catalogs'), path: '/config/catalogs', icon: ListTree });
    }
    return children;
});
const pricingChildren = computed(() => {
    const children = [];
    const canOpenPricing = canView(VIEW_SCOPES.pricing) ||
        canView(VIEW_SCOPES.pricingRates) ||
        canView(VIEW_SCOPES.pricingImports) ||
        canView(VIEW_SCOPES.pricingDecisions) ||
        canView(VIEW_SCOPES.pricingCosts);
    if (canOpenPricing) {
        children.push({ label: t('sidebar.pricingPanel'), path: '/pricing', icon: TrendingUp });
    }
    if (canView(VIEW_SCOPES.pricingImports)) {
        children.push({ label: t('sidebar.importedRates'), path: '/pricing/imports', icon: FileText });
        children.push({
            label: t('sidebar.emailImports'),
            path: '/pricing/email-imports',
            icon: Mail,
        });
    }
    if (canView(VIEW_SCOPES.pricingRates)) {
        children.push({ label: t('sidebar.rates'), path: '/pricing/rates', icon: ReceiptText });
    }
    if (canView(VIEW_SCOPES.pricingCosts)) {
        children.push({ label: t('sidebar.costs'), path: '/pricing/costs', icon: BadgeDollarSign });
    }
    return children;
});
const monitoringChildren = computed(() => {
    const children = [];
    if (canView(VIEW_SCOPES.auditLogs)) {
        children.push({
            label: t('sidebar.audits'),
            path: '/auditlogs/events',
            icon: ClipboardList,
        });
    }
    if (isSuperUser()) {
        children.push({
            label: t('sidebar.serviceMonitoring'),
            path: '/monitoring/services',
            icon: ServerCog,
        });
    }
    return children;
});
const sidebarItems = computed(() => {
    const items = [
        {
            label: t('sidebar.dashboard'),
            path: '/home',
            icon: Home,
        },
    ];
    if (securityChildren.value.length > 0) {
        items.push({ label: t('sidebar.security'), icon: LockKeyhole, children: securityChildren.value });
    }
    if (configChildren.value.length > 0) {
        items.push({ label: t('sidebar.config'), icon: BookOpen, children: configChildren.value });
    }
    if (pricingChildren.value.length > 0) {
        items.push({ label: t('sidebar.pricing'), icon: TrendingUp, children: pricingChildren.value });
    }
    if (monitoringChildren.value.length > 0) {
        items.push({
            label: t('sidebar.monitoring'),
            icon: ServerCog,
            children: monitoringChildren.value,
        });
    }
    items.push({
        label: t('sidebar.settings'),
        icon: Settings,
        children: [
            { label: t('sidebar.appearance'), path: '/settings/appearance', icon: Palette },
            { label: t('sidebar.shortcuts'), path: '/settings/shortcuts', icon: Keyboard },
        ],
    });
    return items;
});
const commands = computed(() => {
    const result = [];
    for (const item of sidebarItems.value) {
        if (item.path) {
            result.push({ id: item.path, title: item.label, description: item.path, icon: item.icon });
        }
        for (const child of item.children ?? []) {
            if (!child.path)
                continue;
            result.push({ id: child.path, title: child.label, description: child.path, icon: child.icon });
        }
    }
    return result;
});
const filteredCommands = computed(() => {
    const query = commandQuery.value.trim().toLowerCase();
    if (!query)
        return commands.value;
    return commands.value.filter((item) => `${item.title} ${item.description ?? ''}`.toLowerCase().includes(query));
});
function selectCommand(item) {
    commandOpen.value = false;
    commandQuery.value = '';
    router.push(item.id);
}
function logout() {
    authStore.clearSession();
    tabsStore.clear();
    router.push('/login');
}
function closeCurrentTab() {
    if (!tabsStore.activeKey)
        return;
    const activeTab = tabsStore.tabs.find((tab) => tab.key === tabsStore.activeKey);
    if (!activeTab || activeTab.closable === false)
        return;
    const key = tabsStore.activeKey;
    tabsStore.closeTab(key);
    const active = tabsStore.tabs.find((x) => x.key === tabsStore.activeKey);
    router.push(active?.path ?? '/home');
}
const activePaneTitle = computed(() => tabsStore.activeTab?.title ?? t('sidebar.dashboard'));
function readDraggedTabKey(event) {
    return (event.dataTransfer?.getData('application/dhole-tab-key') ||
        event.dataTransfer?.getData('text/plain') ||
        null);
}
function handlePaneDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
}
function dropTabToMain(event) {
    event.preventDefault();
    const key = readDraggedTabKey(event);
    if (!key)
        return;
    const tab = tabsStore.moveTabToMain(key);
    if (tab) {
        router.push(tab.path);
    }
}
function dropTabToSplit(event) {
    event.preventDefault();
    const key = readDraggedTabKey(event);
    if (!key)
        return;
    tabsStore.openSplitPane(key);
}
function closeMainPane() {
    const activeTab = tabsStore.activeTab;
    if (activeTab?.closable) {
        tabsStore.closeTab(activeTab.key);
    }
    const promoted = tabsStore.promoteSplitPaneToMain();
    const next = promoted ?? tabsStore.activeTab;
    router.push(next?.path ?? '/home');
}
function dispatchShortcut(name) {
    window.dispatchEvent(new CustomEvent(name));
}
function isShortcutRecorderTarget(event) {
    const target = event.target;
    return (target instanceof Element && Boolean(target.closest('[data-dhole-shortcut-recorder="true"]')));
}
function handleShortcut(event) {
    if (isShortcutRecorderTarget(event))
        return;
    const keys = eventToShortcut(event);
    const shortcut = shortcutStore.byKeys(keys);
    if (!shortcut)
        return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (shortcut.action === 'global.search') {
        commandOpen.value = true;
        return;
    }
    if (shortcut.action === 'record.create') {
        dispatchShortcut('dhole:create');
        return;
    }
    if (shortcut.action === 'record.save') {
        dispatchShortcut('dhole:save');
        return;
    }
    if (shortcut.action === 'tab.close') {
        closeCurrentTab();
        return;
    }
    if (shortcut.action === 'theme.toggle') {
        themeStore.toggleTheme();
        return;
    }
    if (shortcut.action === 'locale.toggle') {
        localeStore.toggleLocale();
    }
}
onMounted(() => {
    window.addEventListener('keydown', handleShortcut, { capture: true });
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleShortcut, { capture: true });
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.isEmbedded) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-h-screen p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.RouterView} */
    RouterView;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-h-screen" },
    });
    /** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
    const __VLS_5 = DhSidebar;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ 'onToggleCollapse': {} },
        items: (__VLS_ctx.sidebarItems),
        collapsed: (__VLS_ctx.sidebarCollapsed),
    }));
    const __VLS_7 = __VLS_6({
        ...{ 'onToggleCollapse': {} },
        items: (__VLS_ctx.sidebarItems),
        collapsed: (__VLS_ctx.sidebarCollapsed),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    let __VLS_10;
    const __VLS_11 = {
        /** @type {typeof __VLS_10.toggleCollapse} */
        onToggleCollapse: (__VLS_ctx.toggleSidebar),
    };
    var __VLS_8;
    var __VLS_9;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-h-screen pr-4 transition-[padding] duration-300" },
        ...{ class: (__VLS_ctx.contentClass) },
    });
    /** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['pr-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-[padding]']} */ ;
    /** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
    const __VLS_12 = DhTopbar;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ 'onSearch': {} },
        ...{ 'onLogout': {} },
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onSearch': {} },
        ...{ 'onLogout': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_17;
    const __VLS_18 = {
        /** @type {typeof __VLS_17.search} */
        onSearch: (...[$event]) => {
            if (!!(__VLS_ctx.isEmbedded))
                return;
            __VLS_ctx.commandOpen = true;
            // @ts-ignore
            [isEmbedded, sidebarItems, sidebarCollapsed, toggleSidebar, contentClass, commandOpen,];
        },
    };
    const __VLS_19 = {
        /** @type {typeof __VLS_17.logout} */
        onLogout: (__VLS_ctx.logout),
    };
    var __VLS_15;
    var __VLS_16;
    const __VLS_20 = DhWorkspaceTabs;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({}));
    const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
        ...{ class: "p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    if (__VLS_ctx.tabsStore.splitPane && !__VLS_ctx.isEmbedded) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid gap-4 xl:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ onDragover: (__VLS_ctx.handlePaneDragOver) },
            ...{ onDrop: (__VLS_ctx.dropTabToMain) },
            ...{ class: "dh-glass dh-liquid min-h-[calc(100vh-10rem)] overflow-hidden rounded-[32px]" },
        });
        /** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
        /** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-h-[calc(100vh-10rem)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between border-b border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
            ...{ class: "truncate text-sm font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.activePaneTitle);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.closeMainPane) },
            ...{ class: "rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]" },
            title: (__VLS_ctx.t('tabs.closeSplit')),
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:text-[var(--dh-text)]']} */ ;
        let __VLS_25;
        /** @ts-ignore @type { | typeof __VLS_components.PanelRightClose} */
        PanelRightClose;
        // @ts-ignore
        const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_27 = __VLS_26({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_26));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "h-[calc(100vh-14rem)] overflow-y-auto p-4 dh-scrollbar" },
        });
        /** @type {__VLS_StyleScopedClasses['h-[calc(100vh-14rem)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
        let __VLS_30;
        /** @ts-ignore @type { | typeof __VLS_components.RouterView} */
        RouterView;
        // @ts-ignore
        const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({}));
        const __VLS_32 = __VLS_31({}, ...__VLS_functionalComponentArgsRest(__VLS_31));
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ onDragover: (__VLS_ctx.handlePaneDragOver) },
            ...{ onDrop: (__VLS_ctx.dropTabToSplit) },
            ...{ class: "dh-glass dh-liquid min-h-[calc(100vh-10rem)] overflow-hidden rounded-[32px]" },
        });
        /** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
        /** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-h-[calc(100vh-10rem)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between border-b border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
            ...{ class: "truncate text-sm font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.tabsStore.splitPane.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isEmbedded))
                        return;
                    if (!(__VLS_ctx.tabsStore.splitPane && !__VLS_ctx.isEmbedded))
                        return;
                    __VLS_ctx.tabsStore.closeSplitPane();
                    // @ts-ignore
                    [isEmbedded, logout, tabsStore, tabsStore, tabsStore, handlePaneDragOver, handlePaneDragOver, dropTabToMain, activePaneTitle, closeMainPane, t, dropTabToSplit,];
                } },
            ...{ class: "rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]" },
            title: (__VLS_ctx.t('tabs.closeSplit')),
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:text-[var(--dh-text)]']} */ ;
        let __VLS_35;
        /** @ts-ignore @type { | typeof __VLS_components.PanelRightClose} */
        PanelRightClose;
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_37 = __VLS_36({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.iframe)({
            key: (__VLS_ctx.tabsStore.splitPane.path),
            src: (__VLS_ctx.splitFrameUrl),
            ...{ class: "h-[calc(100vh-14rem)] w-full border-0 bg-transparent" },
            title: "Split workspace",
        });
        /** @type {__VLS_StyleScopedClasses['h-[calc(100vh-14rem)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
    }
    else {
        let __VLS_40;
        /** @ts-ignore @type { | typeof __VLS_components.RouterView} */
        RouterView;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({}));
        const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    const __VLS_45 = DhCommandPalette;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
        ...{ 'onClose': {} },
        ...{ 'onSelect': {} },
        query: (__VLS_ctx.commandQuery),
        open: (__VLS_ctx.commandOpen),
        items: (__VLS_ctx.filteredCommands),
    }));
    const __VLS_47 = __VLS_46({
        ...{ 'onClose': {} },
        ...{ 'onSelect': {} },
        query: (__VLS_ctx.commandQuery),
        open: (__VLS_ctx.commandOpen),
        items: (__VLS_ctx.filteredCommands),
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    let __VLS_50;
    const __VLS_51 = {
        /** @type {typeof __VLS_50.close} */
        onClose: (...[$event]) => {
            if (!!(__VLS_ctx.isEmbedded))
                return;
            __VLS_ctx.commandOpen = false;
            // @ts-ignore
            [commandOpen, commandOpen, tabsStore, t, splitFrameUrl, commandQuery, filteredCommands,];
        },
    };
    const __VLS_52 = {
        /** @type {typeof __VLS_50.select} */
        onSelect: (__VLS_ctx.selectCommand),
    };
    var __VLS_48;
    var __VLS_49;
}
// @ts-ignore
[selectCommand,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
