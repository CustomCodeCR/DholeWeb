import { Check, Image, Monitor, Moon, Palette, RotateCcw, Save, Sun } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DhPageHeader } from '@/shared/components/organisms';
import { DhButton, DhInput } from '@/shared/components/atoms';
import { useThemeStore } from '@/core/stores/themeStore';
import { useLocale } from '@/core/stores/locale';
import { useShortcutStore } from '@/core/stores/shortcutStore';
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore';
import { useBrandingStore } from '@/core/stores/brandingStore';
import { useToastStore } from '@/core/stores/toastStore';
import { DEFAULT_CLIENT_BRANDING } from '@/core/interfaces/branding';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const themeStore = useThemeStore();
const localeStore = useLocale();
const shortcutStore = useShortcutStore();
const tabsStore = useWorkspaceTabsStore();
const brandingStore = useBrandingStore();
const toastStore = useToastStore();
const themeOptions = [
    { value: 'light', label: 'appearance.light', icon: Sun },
    { value: 'dark', label: 'appearance.dark', icon: Moon },
    { value: 'system', label: 'appearance.system', icon: Monitor },
];
const localeOptions = [
    { value: 'es', label: 'appearance.spanish' },
    { value: 'en', label: 'appearance.english' },
];
const brandingForm = ref({ ...DEFAULT_CLIENT_BRANDING });
const overlayPercent = computed(() => Math.round(Number(brandingForm.value.backgroundOverlayOpacity ?? 0) * 100));
const brandingPreviewStyle = computed(() => ({
    backgroundColor: brandingForm.value.primaryColor,
    backgroundImage: brandingForm.value.backgroundImageUrl
        ? `linear-gradient(rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5}), rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5})), url("${brandingForm.value.backgroundImageUrl.replace(/["\\\n\r]/g, '')}")`
        : undefined,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
}));
function syncBrandingForm() {
    brandingForm.value = {
        ...DEFAULT_CLIENT_BRANDING,
        ...brandingStore.settings,
    };
}
function previewBranding() {
    brandingStore.preview(brandingForm.value);
}
function resetBranding() {
    brandingForm.value = {
        ...DEFAULT_CLIENT_BRANDING,
        clientId: brandingStore.settings.clientId,
        clientCode: brandingStore.settings.clientCode,
        clientName: brandingStore.settings.clientName,
    };
    previewBranding();
}
async function saveBranding() {
    const result = await brandingStore.saveForCurrentClient({
        clientId: brandingForm.value.clientId,
        clientCode: brandingForm.value.clientCode,
        primaryColor: brandingForm.value.primaryColor,
        backgroundImageUrl: brandingForm.value.backgroundImageUrl,
        backgroundOverlayOpacity: brandingForm.value.backgroundOverlayOpacity,
    });
    syncBrandingForm();
    if (result.synced) {
        toastStore.success('Branding guardado', 'El color y fondo quedaron guardados para este cliente.');
        return;
    }
    toastStore.warning('Branding aplicado localmente', 'El backend todavía no respondió el endpoint de branding; el cambio se dejó cacheado en este navegador.');
}
async function refreshAppearanceSettings() {
    await brandingStore.loadCurrentClientBranding();
    syncBrandingForm();
}
useViewShortcuts({ save: saveBranding, refresh: refreshAppearanceSettings, autoRefresh: false });
onMounted(refreshAppearanceSettings);
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
    title: (__VLS_ctx.t('appearance.title')),
    subtitle: (__VLS_ctx.t('appearance.subtitle')),
    icon: (__VLS_ctx.Palette),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('appearance.title')),
    subtitle: (__VLS_ctx.t('appearance.subtitle')),
    icon: (__VLS_ctx.Palette),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid gap-5 xl:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-6" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('appearance.theme'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5 grid gap-3 md:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
for (const [option] of __VLS_vFor((__VLS_ctx.themeOptions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.themeStore.setTheme(option.value);
                // @ts-ignore
                [t, t, t, Palette, themeOptions, themeStore,];
            } },
        key: (option.value),
        type: "button",
        ...{ class: "relative rounded-[26px] border p-4 text-left transition hover:bg-[var(--dh-card-hover)]" },
        ...{ class: (__VLS_ctx.themeStore.mode === option.value ? 'dh-primary-selected' : 'border-[var(--dh-border)] bg-[var(--dh-card)]') },
    });
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
    const __VLS_5 = (option.icon);
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-3 text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t(option.label));
    if (__VLS_ctx.themeStore.mode === option.value) {
        let __VLS_10;
        /** @ts-ignore @type { | typeof __VLS_components.Check} */
        Check;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            ...{ class: "absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" },
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['right-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['top-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    }
    // @ts-ignore
    [t, themeStore, themeStore,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-6" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('appearance.language'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5 grid gap-3 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
for (const [option] of __VLS_vFor((__VLS_ctx.localeOptions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.localeStore.setLocale(option.value);
                // @ts-ignore
                [t, localeOptions, localeStore,];
            } },
        key: (option.value),
        type: "button",
        ...{ class: "relative rounded-[26px] border p-4 text-left transition hover:bg-[var(--dh-card-hover)]" },
        ...{ class: (__VLS_ctx.localeStore.locale === option.value ? 'dh-primary-selected' : 'border-[var(--dh-border)] bg-[var(--dh-card)]') },
    });
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-[var(--dh-card-hover)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t(option.label));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (option.value.toUpperCase());
    if (__VLS_ctx.localeStore.locale === option.value) {
        let __VLS_15;
        /** @ts-ignore @type { | typeof __VLS_components.Check} */
        Check;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            ...{ class: "absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['right-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['top-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    }
    // @ts-ignore
    [t, localeStore, localeStore,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-6" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 max-w-3xl text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.brandingStore.clientLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
let __VLS_20;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    ...{ 'onClick': {} },
    label: "Previsualizar",
    variant: "secondary",
    icon: (__VLS_ctx.Image),
}));
const __VLS_22 = __VLS_21({
    ...{ 'onClick': {} },
    label: "Previsualizar",
    variant: "secondary",
    icon: (__VLS_ctx.Image),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_25;
const __VLS_26 = {
    /** @type {typeof __VLS_25.click} */
    onClick: (__VLS_ctx.previewBranding),
};
var __VLS_23;
var __VLS_24;
let __VLS_27;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
    ...{ 'onClick': {} },
    label: "Restaurar",
    variant: "secondary",
    icon: (__VLS_ctx.RotateCcw),
}));
const __VLS_29 = __VLS_28({
    ...{ 'onClick': {} },
    label: "Restaurar",
    variant: "secondary",
    icon: (__VLS_ctx.RotateCcw),
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
let __VLS_32;
const __VLS_33 = {
    /** @type {typeof __VLS_32.click} */
    onClick: (__VLS_ctx.resetBranding),
};
var __VLS_30;
var __VLS_31;
let __VLS_34;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
    ...{ 'onClick': {} },
    label: "Guardar cliente",
    icon: (__VLS_ctx.Save),
    loading: (__VLS_ctx.brandingStore.saving),
}));
const __VLS_36 = __VLS_35({
    ...{ 'onClick': {} },
    label: "Guardar cliente",
    icon: (__VLS_ctx.Save),
    loading: (__VLS_ctx.brandingStore.saving),
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
let __VLS_39;
const __VLS_40 = {
    /** @type {typeof __VLS_39.click} */
    onClick: (__VLS_ctx.saveBranding),
};
var __VLS_37;
var __VLS_38;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]" },
});
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-[minmax(0,1fr)_24rem]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-11 items-center gap-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl dh-focus-primary" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-11']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-focus-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.previewBranding) },
    type: "color",
    ...{ class: "h-7 w-10 cursor-pointer rounded-xl border-0 bg-transparent p-0" },
});
(__VLS_ctx.brandingForm.primaryColor);
/** @type {__VLS_StyleScopedClasses['h-7']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.previewBranding) },
    value: (__VLS_ctx.brandingForm.primaryColor),
    type: "text",
    ...{ class: "h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:font-medium placeholder:text-[var(--dh-text-muted)]" },
    placeholder: "#fc2800",
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder:font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder:text-[var(--dh-text-muted)]']} */ ;
let __VLS_41;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.brandingForm.backgroundImageUrl ?? null),
    label: "Imagen de fondo",
    placeholder: "https://... o /storage/...",
}));
const __VLS_43 = __VLS_42({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.brandingForm.backgroundImageUrl ?? null),
    label: "Imagen de fondo",
    placeholder: "https://... o /storage/...",
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
let __VLS_46;
const __VLS_47 = {
    /** @type {typeof __VLS_46.'update:modelValue'} */
    'onUpdate:modelValue': ((value) => { __VLS_ctx.brandingForm.backgroundImageUrl = value; __VLS_ctx.previewBranding(); }),
};
var __VLS_44;
var __VLS_45;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block md:col-span-2" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.overlayPercent);
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.previewBranding) },
    type: "range",
    min: "0",
    max: "0.95",
    step: "0.05",
    ...{ class: "w-full accent-[var(--dh-primary)]" },
});
(__VLS_ctx.brandingForm.backgroundOverlayOpacity);
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['accent-[var(--dh-primary)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "rounded-[32px] border border-[var(--dh-border)] p-4 shadow-[var(--dh-shadow-sm)]" },
    ...{ style: (__VLS_ctx.brandingPreviewStyle) },
});
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[26px] border border-white/20 bg-black/30 p-5 text-white backdrop-blur-xl" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-xl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex h-12 w-12 items-center justify-center rounded-[22px] bg-white/20 text-lg font-black" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/20']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-black uppercase tracking-[0.16em] opacity-75" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "mt-2 text-2xl font-black" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
(__VLS_ctx.brandingStore.clientLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm font-semibold opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-6" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5 flex flex-wrap gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
let __VLS_48;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent1(__VLS_48, new __VLS_48({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('appearance.resetWorkspace')),
    variant: "secondary",
}));
const __VLS_50 = __VLS_49({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('appearance.resetWorkspace')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
let __VLS_53;
const __VLS_54 = {
    /** @type {typeof __VLS_53.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.tabsStore.clear();
        // @ts-ignore
        [t, brandingStore, brandingStore, brandingStore, Image, previewBranding, previewBranding, previewBranding, previewBranding, previewBranding, RotateCcw, resetBranding, Save, saveBranding, brandingForm, brandingForm, brandingForm, brandingForm, brandingForm, overlayPercent, brandingPreviewStyle, tabsStore,];
    },
};
var __VLS_51;
var __VLS_52;
let __VLS_55;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('appearance.resetShortcuts')),
    variant: "secondary",
}));
const __VLS_57 = __VLS_56({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('appearance.resetShortcuts')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_60;
const __VLS_61 = {
    /** @type {typeof __VLS_60.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.shortcutStore.reset();
        // @ts-ignore
        [t, shortcutStore,];
    },
};
var __VLS_58;
var __VLS_59;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
