import { computed } from 'vue';
import { Bell, Languages, LogOut, Moon, Search, Sun } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue';
import DhAvatar from '@/shared/components/atoms/DhAvatar.vue';
import { useThemeStore } from '@/core/stores/themeStore';
import { useLocale } from '@/core/stores/locale';
import { useAuthStore } from '@/core/stores/authStore';
import { useShortcutStore } from '@/core/stores/shortcutStore';
const { t } = useI18n();
const themeStore = useThemeStore();
const localeStore = useLocale();
const authStore = useAuthStore();
const shortcutStore = useShortcutStore();
const emit = defineEmits();
const displayName = computed(() => authStore.userDisplayName || 'Usuario');
const displayEmail = computed(() => authStore.email || 'Sesión activa');
const searchShortcut = computed(() => shortcutStore.byAction('global.search')?.keys ?? 'ctrl+k');
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
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "sticky top-4 z-30 mx-4 flex h-[76px] items-center justify-between rounded-[34px] border border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 shadow-[var(--dh-shadow-md)] backdrop-blur-2xl" },
});
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['z-30']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-[76px]']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[34px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-md)]']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-2xl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('search');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "group flex h-12 w-[460px] max-w-[46vw] items-center gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-left text-sm font-semibold text-[var(--dh-text-muted)] shadow-[var(--dh-shadow-sm)] transition hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)]" },
});
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[460px]']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[46vw]']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Search} */
Search;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "truncate" },
});
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
(__VLS_ctx.t('topbar.searchPlaceholder'));
__VLS_asFunctionalElement1(__VLS_intrinsics.kbd, __VLS_intrinsics.kbd)({
    ...{ class: "ml-auto rounded-xl border border-[var(--dh-border)] bg-white/70 px-2 py-1 text-[10px] font-black uppercase text-[var(--dh-text-muted)] dark:bg-white/10" },
});
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/70']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/10']} */ ;
(__VLS_ctx.searchShortcut);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_5 = DhIconButton;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Languages),
    label: (__VLS_ctx.t('topbar.language')),
    variant: "secondary",
}));
const __VLS_7 = __VLS_6({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Languages),
    label: (__VLS_ctx.t('topbar.language')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = {
    /** @type {typeof __VLS_10.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.localeStore.toggleLocale();
        // @ts-ignore
        [t, t, searchShortcut, Languages, localeStore,];
    },
};
var __VLS_8;
var __VLS_9;
const __VLS_12 = DhIconButton;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.themeStore.resolvedTheme === 'dark' ? __VLS_ctx.Sun : __VLS_ctx.Moon),
    label: (__VLS_ctx.t('topbar.theme')),
    variant: "secondary",
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.themeStore.resolvedTheme === 'dark' ? __VLS_ctx.Sun : __VLS_ctx.Moon),
    label: (__VLS_ctx.t('topbar.theme')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_17;
const __VLS_18 = {
    /** @type {typeof __VLS_17.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.themeStore.toggleTheme();
        // @ts-ignore
        [t, themeStore, themeStore, Sun, Moon,];
    },
};
var __VLS_15;
var __VLS_16;
const __VLS_19 = DhIconButton;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
    icon: (__VLS_ctx.Bell),
    label: (__VLS_ctx.t('topbar.notifications')),
    variant: "secondary",
}));
const __VLS_21 = __VLS_20({
    icon: (__VLS_ctx.Bell),
    label: (__VLS_ctx.t('topbar.notifications')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ml-2 flex items-center gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 shadow-[var(--dh-shadow-sm)]" },
});
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
const __VLS_24 = DhAvatar;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    name: (__VLS_ctx.displayName),
    status: "online",
}));
const __VLS_26 = __VLS_25({
    name: (__VLS_ctx.displayName),
    status: "online",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hidden min-w-0 lg:block" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "max-w-40 truncate text-sm font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['max-w-40']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.displayName);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "max-w-40 truncate text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['max-w-40']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.displayEmail);
const __VLS_29 = DhIconButton;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.LogOut),
    label: (__VLS_ctx.t('topbar.logout')),
    variant: "ghost",
    size: "sm",
}));
const __VLS_31 = __VLS_30({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.LogOut),
    label: (__VLS_ctx.t('topbar.logout')),
    variant: "ghost",
    size: "sm",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
let __VLS_34;
const __VLS_35 = {
    /** @type {typeof __VLS_34.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.emit('logout');
        // @ts-ignore
        [emit, t, t, Bell, displayName, displayName, displayEmail, LogOut,];
    },
};
var __VLS_32;
var __VLS_33;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
