import { Activity, ClipboardList, TrendingUp, KeyRound, ListTree, MonitorCheck, ServerCog, Shield, Users, } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { DhPageHeader } from '@/shared/components/organisms';
import { DhBadge } from '@/shared/components/atoms';
import { VIEW_SCOPES } from '@/core/auth/scopes';
import { useAuthStore } from '@/core/stores/authStore';
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
function isSuperUser() {
    return authStore.hasRole('SuperUsuario') || authStore.hasRole('SuperUser') || authStore.hasRole('superusuario');
}
const cards = computed(() => [
    {
        title: t('sidebar.users'),
        value: t('dashboard.values.auth'),
        icon: Users,
        path: '/auth/users',
        description: t('dashboard.openUsers'),
        visible: authStore.hasScope(VIEW_SCOPES.users),
    },
    {
        title: t('sidebar.roles'),
        value: t('dashboard.values.rbac'),
        icon: Shield,
        path: '/auth/roles',
        description: t('dashboard.openRoles'),
        visible: authStore.hasScope(VIEW_SCOPES.roles),
    },
    {
        title: t('sidebar.scopes'),
        value: t('dashboard.values.scopes'),
        icon: KeyRound,
        path: '/auth/scopes',
        description: t('dashboard.openScopes'),
        visible: authStore.hasScope(VIEW_SCOPES.scopes),
    },
    {
        title: t('sidebar.sessions'),
        value: t('dashboard.values.jwt'),
        icon: MonitorCheck,
        path: '/auth/sessions',
        description: t('dashboard.openSessions'),
        visible: authStore.hasScope(VIEW_SCOPES.sessions),
    },
    {
        title: t('sidebar.catalogs'),
        value: t('dashboard.values.config'),
        icon: ListTree,
        path: '/config/catalogs',
        description: t('dashboard.openCatalogs'),
        visible: authStore.hasScope(VIEW_SCOPES.catalogs),
    },
    {
        title: t('sidebar.pricing'),
        value: t('dashboard.values.pricing'),
        icon: TrendingUp,
        path: '/pricing',
        description: t('dashboard.openPricing'),
        visible: authStore.hasScope(VIEW_SCOPES.pricing) ||
            authStore.hasScope(VIEW_SCOPES.pricingRates) ||
            authStore.hasScope(VIEW_SCOPES.pricingImports) ||
            authStore.hasScope(VIEW_SCOPES.pricingDecisions),
    },
    {
        title: t('sidebar.audits'),
        value: t('dashboard.values.audit'),
        icon: ClipboardList,
        path: '/auditlogs/events',
        description: t('dashboard.openAudits'),
        visible: authStore.hasScope(VIEW_SCOPES.auditLogs),
    },
    {
        title: t('sidebar.monitoring'),
        value: t('dashboard.values.monitoring'),
        icon: ServerCog,
        path: '/monitoring/services',
        description: t('dashboard.openMonitoring'),
        visible: isSuperUser(),
    },
].filter((card) => card.visible));
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
    title: (__VLS_ctx.t('dashboard.title')),
    subtitle: (__VLS_ctx.t('dashboard.subtitle')),
    icon: (__VLS_ctx.Activity),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('dashboard.title')),
    subtitle: (__VLS_ctx.t('dashboard.subtitle')),
    icon: (__VLS_ctx.Activity),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[36px] p-6" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[36px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-5 xl:grid-cols-[1.2fr_0.8fr]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-[1.2fr_0.8fr]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.18em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
(__VLS_ctx.t('dashboard.welcome'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-3 text-3xl font-black tracking-tight text-[var(--dh-text)] md:text-5xl" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
/** @type {__VLS_StyleScopedClasses['md:text-5xl']} */ ;
(__VLS_ctx.authStore.userDisplayName || __VLS_ctx.t('dashboard.operator'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-7']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('dashboard.description'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 sm:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('dashboard.visibleModules'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.cards.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('dashboard.sessionStatus'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('common.active'));
if (__VLS_ctx.cards.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-4 md:grid-cols-2 xl:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
    for (const [card] of __VLS_vFor((__VLS_ctx.cards))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.cards.length))
                        return;
                    __VLS_ctx.router.push(card.path);
                    // @ts-ignore
                    [t, t, t, t, t, t, t, t, Activity, authStore, cards, cards, cards, router,];
                } },
            key: (card.path),
            ...{ class: "dh-glass dh-liquid dh-card-hover rounded-[32px] p-5 text-left" },
        });
        /** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
        /** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
        /** @type {__VLS_StyleScopedClasses['dh-card-hover']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start justify-between gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-sm font-black text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (card.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
            ...{ class: "mt-2 truncate text-2xl font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (card.value);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (card.description);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] dh-bg-primary-soft text-[var(--dh-primary)]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-12']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
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
        let __VLS_10;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            ...{ class: "mt-5" },
            label: (__VLS_ctx.t('common.available')),
            variant: "success",
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "mt-5" },
            label: (__VLS_ctx.t('common.available')),
            variant: "success",
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
        // @ts-ignore
        [t,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "dh-glass dh-liquid rounded-[32px] p-6" },
    });
    /** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-bold text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('dashboard.noModules'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('dashboard.noModulesHint'));
}
// @ts-ignore
[t, t,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
