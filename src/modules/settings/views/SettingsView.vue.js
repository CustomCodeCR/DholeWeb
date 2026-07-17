import { Keyboard, ListChecks, Palette, Settings } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { DhPageHeader } from '@/shared/components/organisms';
const router = useRouter();
const { t } = useI18n();
const cards = [
    { title: t('settings.appearance'), description: 'Tema, idioma y branding por cliente.', icon: Palette, path: '/settings/appearance' },
    { title: t('settings.shortcuts'), description: 'Atajos configurables en el navegador.', icon: Keyboard, path: '/settings/shortcuts' },
    { title: 'Selects de Pricing', description: 'Puertos, contenedores, navieras, incoterms y catálogos usados por Pricing.', icon: ListChecks, path: '/settings/pricing-selects' },
];
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
    title: (__VLS_ctx.t('settings.title')),
    subtitle: (__VLS_ctx.t('settings.subtitle')),
    icon: (__VLS_ctx.Settings),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('settings.title')),
    subtitle: (__VLS_ctx.t('settings.subtitle')),
    icon: (__VLS_ctx.Settings),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
for (const [card] of __VLS_vFor((__VLS_ctx.cards))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.router.push(card.path);
                // @ts-ignore
                [t, t, Settings, cards, router,];
            } },
        key: (card.path),
        ...{ class: "dh-glass dh-liquid dh-card-hover rounded-[32px] p-6 text-left" },
    });
    /** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-card-hover']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-4" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex h-12 w-12 items-center justify-center rounded-[22px] dh-bg-primary-soft text-[var(--dh-primary)]" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-12']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    const __VLS_5 = (card.icon);
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "h-6 w-6" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "h-6 w-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (card.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (card.description);
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
