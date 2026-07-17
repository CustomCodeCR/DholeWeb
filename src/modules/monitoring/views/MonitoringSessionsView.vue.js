import { computed, onMounted, ref } from 'vue';
import { Activity, AlertTriangle, MonitorCheck, RefreshCcw, ShieldCheck, Users } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { DhDataTable } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { UsersService } from '@/core/services/usersService';
import { SessionsService } from '@/core/services/sessionsService';
import { useAuthStore } from '@/core/stores/authStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const authStore = useAuthStore();
const toastStore = useToastStore();
const loading = ref(false);
const rows = ref([]);
const lastLoadedAt = ref(null);
function isSuperUser() {
    return authStore.roles.some((role) => role.toLowerCase().includes('super'))
        || authStore.scopes.includes('*')
        || authStore.scopes.includes('auth.users.view');
}
const columns = computed(() => [
    { key: 'userName', label: t('monitoring.user') },
    { key: 'activeSessions', label: t('monitoring.activeSessions'), align: 'center' },
    { key: 'latestIpAddress', label: t('sessions.ipAddress') },
    { key: 'latestUserAgent', label: t('sessions.userAgent') },
    { key: 'latestActivityAt', label: t('monitoring.latestActivity') },
    { key: 'status', label: t('common.status'), align: 'center' },
]);
const totalUsers = computed(() => rows.value.length);
const totalActiveSessions = computed(() => rows.value.reduce((total, row) => total + row.activeSessions, 0));
const onlineUsers = computed(() => rows.value.filter((row) => row.activeSessions > 0).length);
const quietUsers = computed(() => rows.value.filter((row) => row.activeSessions === 0).length);
const formattedLastLoadedAt = computed(() => {
    if (!lastLoadedAt.value)
        return '—';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(lastLoadedAt.value);
});
function formatDate(value) {
    if (!value)
        return '—';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}
function getLatestSession(sessions) {
    if (sessions.length === 0)
        return null;
    return [...sessions].sort((left, right) => {
        const leftDate = new Date(left.lastUsedAt || left.createdAt).getTime();
        const rightDate = new Date(right.lastUsedAt || right.createdAt).getTime();
        return rightDate - leftDate;
    })[0] ?? null;
}
function buildRow(user, sessions) {
    const latestSession = getLatestSession(sessions);
    return {
        userId: user.id,
        userName: user.userName,
        displayName: user.displayName,
        email: user.email,
        activeSessions: sessions.length,
        latestIpAddress: latestSession?.ipAddress ?? null,
        latestUserAgent: latestSession?.userAgent ?? null,
        latestActivityAt: latestSession?.lastUsedAt ?? latestSession?.createdAt ?? null,
        status: sessions.length > 0 ? 'online' : 'quiet',
    };
}
async function loadMonitoring() {
    if (!isSuperUser()) {
        rows.value = [];
        return;
    }
    try {
        loading.value = true;
        const usersPage = await UsersService.browsePaged({ pageNumber: 1, pageSize: 100 });
        const users = usersPage.items;
        const sessionResults = await Promise.all(users.map(async (user) => {
            try {
                const sessions = await SessionsService.getActiveByUser(user.id);
                return buildRow(user, sessions);
            }
            catch {
                return buildRow(user, []);
            }
        }));
        rows.value = sessionResults.sort((left, right) => right.activeSessions - left.activeSessions);
        lastLoadedAt.value = new Date();
    }
    catch (error) {
        toastStore.backendError(error, t('monitoring.loadError'));
    }
    finally {
        loading.value = false;
    }
}
useViewShortcuts({ save: loadMonitoring, refresh: loadMonitoring });
onMounted(loadMonitoring);
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
/** @ts-ignore @type { | typeof __VLS_components.DhPageHeader | typeof __VLS_components.DhPageHeader} */
DhPageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: (__VLS_ctx.t('monitoring.sessionsTitle')),
    subtitle: (__VLS_ctx.t('monitoring.sessionsSubtitle')),
    icon: (__VLS_ctx.Activity),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('monitoring.sessionsTitle')),
    subtitle: (__VLS_ctx.t('monitoring.sessionsSubtitle')),
    icon: (__VLS_ctx.Activity),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
{
    const { actions: __VLS_6 } = __VLS_3.slots;
    let __VLS_7;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('common.refresh')),
        variant: "secondary",
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('common.refresh')),
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (__VLS_ctx.loadMonitoring),
    };
    var __VLS_10;
    var __VLS_11;
    // @ts-ignore
    [t, t, t, Activity, RefreshCcw, loadMonitoring,];
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid gap-4 md:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.totalUsers'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.totalUsers);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-red-500/10 p-3 text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-500/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
let __VLS_14;
/** @ts-ignore @type { | typeof __VLS_components.Users} */
Users;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    ...{ class: "h-6 w-6" },
}));
const __VLS_16 = __VLS_15({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.activeSessions'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.totalActiveSessions);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-red-500/10 p-3 text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-500/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
let __VLS_19;
/** @ts-ignore @type { | typeof __VLS_components.MonitorCheck} */
MonitorCheck;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
    ...{ class: "h-6 w-6" },
}));
const __VLS_21 = __VLS_20({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.onlineUsers'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.onlineUsers);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-emerald-500/10 p-3 text-emerald-500" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-500/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-emerald-500']} */ ;
let __VLS_24;
/** @ts-ignore @type { | typeof __VLS_components.ShieldCheck} */
ShieldCheck;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    ...{ class: "h-6 w-6" },
}));
const __VLS_26 = __VLS_25({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.quietUsers'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.quietUsers);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] bg-amber-500/10 p-3 text-amber-500" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
let __VLS_29;
/** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
AlertTriangle;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
    ...{ class: "h-6 w-6" },
}));
const __VLS_31 = __VLS_30({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-5 flex flex-wrap items-center justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('monitoring.liveSessions'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.lastUpdate'));
(__VLS_ctx.formattedLastLoadedAt);
let __VLS_34;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('monitoring.empty')),
}));
const __VLS_36 = __VLS_35({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('monitoring.empty')),
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
const { default: __VLS_39 } = __VLS_37.slots;
{
    const { 'cell-userName': __VLS_40 } = __VLS_37.slots;
    const [{ row }] = __VLS_vSlot(__VLS_40);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (row.displayName || row.userName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (row.email);
    // @ts-ignore
    [t, t, t, t, t, t, t, totalUsers, totalActiveSessions, onlineUsers, quietUsers, formattedLastLoadedAt, columns, rows, loading,];
}
{
    const { 'cell-activeSessions': __VLS_41 } = __VLS_37.slots;
    const [{ value }] = __VLS_vSlot(__VLS_41);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_42;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
        label: (String(value)),
        variant: (Number(value) > 0 ? 'success' : 'neutral'),
    }));
    const __VLS_44 = __VLS_43({
        label: (String(value)),
        variant: (Number(value) > 0 ? 'success' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    // @ts-ignore
    [];
}
{
    const { 'cell-latestUserAgent': __VLS_47 } = __VLS_37.slots;
    const [{ value }] = __VLS_vSlot(__VLS_47);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "line-clamp-1 max-w-md" },
    });
    /** @type {__VLS_StyleScopedClasses['line-clamp-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
    (value ?? '—');
    // @ts-ignore
    [];
}
{
    const { 'cell-latestActivityAt': __VLS_48 } = __VLS_37.slots;
    const [{ value }] = __VLS_vSlot(__VLS_48);
    (__VLS_ctx.formatDate(String(value ?? '')));
    // @ts-ignore
    [formatDate,];
}
{
    const { 'cell-status': __VLS_49 } = __VLS_37.slots;
    const [{ value }] = __VLS_vSlot(__VLS_49);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_50;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
        label: (value === 'online' ? __VLS_ctx.t('monitoring.online') : __VLS_ctx.t('monitoring.quiet')),
        variant: (value === 'online' ? 'success' : 'neutral'),
    }));
    const __VLS_52 = __VLS_51({
        label: (value === 'online' ? __VLS_ctx.t('monitoring.online') : __VLS_ctx.t('monitoring.quiet')),
        variant: (value === 'online' ? 'success' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    // @ts-ignore
    [t, t,];
}
// @ts-ignore
[];
var __VLS_37;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
