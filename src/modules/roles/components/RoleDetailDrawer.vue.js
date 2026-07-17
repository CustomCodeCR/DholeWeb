import { computed, onMounted, ref } from 'vue';
import { Ban, CheckCircle2, KeyRound, Shield, ShieldMinus, ShieldPlus } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { DhTabs } from '@/shared/components/molecules';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { AUTH_SCOPES } from '@/core/auth/scopes';
import { RolesService } from '@/core/services/rolesService';
import { ScopesService } from '@/core/services/scopesService';
import AuthMultiSelectModal from '@/modules/auth/components/AuthMultiSelectModal.vue';
const props = defineProps();
const { t } = useI18n();
const modalStore = useModalStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const localRole = ref({ ...props.role });
const activeTab = ref('summary');
const loading = ref(false);
const roleScopes = ref([]);
const availableScopes = ref([]);
const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.roles.setActive));
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view));
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesAssign) && canViewScopes.value);
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesRevoke));
const showRoleActions = computed(() => canSetActive.value);
const showScopeActions = computed(() => canAssignScopes.value || canRevokeScopes.value);
const tabs = computed(() => [
    { key: 'summary', label: 'Resumen' },
    { key: 'scopes', label: `${t('roles.assignedScopes')} (${roleScopes.value.length})` },
]);
async function loadRelated() {
    loading.value = true;
    try {
        const [assigned, scopes] = await Promise.all([
            RolesService.getScopes(localRole.value.id),
            canAssignScopes.value ? ScopesService.select() : Promise.resolve([]),
        ]);
        roleScopes.value = assigned;
        availableScopes.value = scopes;
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron cargar los permisos del rol.');
    }
    finally {
        loading.value = false;
    }
}
async function refreshParent() {
    await props.onSaved?.();
}
async function activate() {
    if (!canSetActive.value)
        return;
    await RolesService.activate(localRole.value.id);
    localRole.value.isActive = true;
    toastStore.success('Rol activado');
    await refreshParent();
}
async function inactivate() {
    if (!canSetActive.value)
        return;
    await RolesService.inactivate(localRole.value.id);
    localRole.value.isActive = false;
    toastStore.success('Rol inactivado');
    await refreshParent();
}
function openAssignScopes() {
    if (!canAssignScopes.value)
        return;
    const selected = roleScopes.value.map((scope) => scope.scopeId);
    modalStore.open({
        title: t('roles.assignScopes'),
        component: AuthMultiSelectModal,
        size: 'lg',
        props: {
            title: t('roles.assignScopes'),
            description: 'Seleccione los scopes que desea agregar al rol.',
            items: availableScopes.value.map((scope) => ({ id: scope.id, label: scope.name, description: scope.code, badge: 'Scope' })),
            initiallySelectedIds: selected,
            confirmLabel: t('common.assign'),
            onConfirm: async (ids) => {
                const toAssign = ids.filter((id) => !selected.includes(id));
                if (toAssign.length > 0)
                    await RolesService.assignScopes(localRole.value.id, { scopeIds: toAssign });
                toastStore.success('Scopes asignados al rol');
                await loadRelated();
                await refreshParent();
            },
        },
    });
}
function openRevokeScopes() {
    if (!canRevokeScopes.value || roleScopes.value.length === 0)
        return;
    modalStore.open({
        title: t('roles.revokeScopes'),
        component: AuthMultiSelectModal,
        size: 'lg',
        props: {
            title: t('roles.revokeScopes'),
            description: 'Seleccione los scopes que desea quitar del rol.',
            items: roleScopes.value.map((scope) => ({ id: scope.scopeId, label: scope.scopeName, description: scope.scopeCode, badge: 'Scope' })),
            confirmLabel: t('common.revoke'),
            onConfirm: async (ids) => {
                if (ids.length > 0)
                    await RolesService.revokeScopes(localRole.value.id, { scopeIds: ids });
                toastStore.success('Scopes revocados del rol');
                await loadRelated();
                await refreshParent();
            },
        },
    });
}
onMounted(loadRelated);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-4" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.localRole.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.localRole.description ?? 'Sin descripción');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    label: (__VLS_ctx.localRole.isSystemRole ? __VLS_ctx.t('roles.system') : __VLS_ctx.t('roles.custom')),
    variant: "primary",
}));
const __VLS_2 = __VLS_1({
    label: (__VLS_ctx.localRole.isSystemRole ? __VLS_ctx.t('roles.system') : __VLS_ctx.t('roles.custom')),
    variant: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    label: (__VLS_ctx.localRole.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
    variant: (__VLS_ctx.localRole.isActive ? 'success' : 'neutral'),
}));
const __VLS_7 = __VLS_6({
    label: (__VLS_ctx.localRole.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
    variant: (__VLS_ctx.localRole.isActive ? 'success' : 'neutral'),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.Shield} */
Shield;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "h-8 w-8 text-[var(--dh-primary)]" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-8 w-8 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
if (__VLS_ctx.showRoleActions) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-5 grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    if (__VLS_ctx.localRole.isActive) {
        let __VLS_15;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: "Inactivar",
            variant: "secondary",
        }));
        const __VLS_17 = __VLS_16({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: "Inactivar",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        let __VLS_20;
        const __VLS_21 = {
            /** @type {typeof __VLS_20.click} */
            onClick: (__VLS_ctx.inactivate),
        };
        var __VLS_18;
        var __VLS_19;
    }
    else {
        let __VLS_22;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            label: "Activar",
        }));
        const __VLS_24 = __VLS_23({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            label: "Activar",
        }, ...__VLS_functionalComponentArgsRest(__VLS_23));
        let __VLS_27;
        const __VLS_28 = {
            /** @type {typeof __VLS_27.click} */
            onClick: (__VLS_ctx.activate),
        };
        var __VLS_25;
        var __VLS_26;
    }
}
let __VLS_29;
/** @ts-ignore @type { | typeof __VLS_components.DhTabs} */
DhTabs;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
    modelValue: (__VLS_ctx.activeTab),
    items: (__VLS_ctx.tabs),
}));
const __VLS_31 = __VLS_30({
    modelValue: (__VLS_ctx.activeTab),
    items: (__VLS_ctx.tabs),
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[28px] border border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('common.loading'));
}
else if (__VLS_ctx.activeTab === 'summary') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 break-all text-sm font-bold text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.localRole.id);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.showScopeActions) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        if (__VLS_ctx.canAssignScopes) {
            let __VLS_34;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldPlus),
                label: (__VLS_ctx.t('roles.assignScopes')),
            }));
            const __VLS_36 = __VLS_35({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldPlus),
                label: (__VLS_ctx.t('roles.assignScopes')),
            }, ...__VLS_functionalComponentArgsRest(__VLS_35));
            let __VLS_39;
            const __VLS_40 = {
                /** @type {typeof __VLS_39.click} */
                onClick: (__VLS_ctx.openAssignScopes),
            };
            var __VLS_37;
            var __VLS_38;
        }
        if (__VLS_ctx.canRevokeScopes && __VLS_ctx.roleScopes.length > 0) {
            let __VLS_41;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldMinus),
                label: (__VLS_ctx.t('roles.revokeScopes')),
                variant: "secondary",
            }));
            const __VLS_43 = __VLS_42({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldMinus),
                label: (__VLS_ctx.t('roles.revokeScopes')),
                variant: "secondary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_42));
            let __VLS_46;
            const __VLS_47 = {
                /** @type {typeof __VLS_46.click} */
                onClick: (__VLS_ctx.openRevokeScopes),
            };
            var __VLS_44;
            var __VLS_45;
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    for (const [scope] of __VLS_vFor((__VLS_ctx.roleScopes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (scope.scopeId),
            ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        let __VLS_48;
        /** @ts-ignore @type { | typeof __VLS_components.KeyRound} */
        KeyRound;
        // @ts-ignore
        const __VLS_49 = __VLS_asFunctionalComponent1(__VLS_48, new __VLS_48({
            ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
        }));
        const __VLS_50 = __VLS_49({
            ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_49));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (scope.scopeName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-bold text-[var(--dh-primary)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        (scope.scopeCode);
        // @ts-ignore
        [localRole, localRole, localRole, localRole, localRole, localRole, localRole, t, t, t, t, t, t, t, showRoleActions, Ban, inactivate, CheckCircle2, activate, activeTab, activeTab, tabs, loading, showScopeActions, canAssignScopes, ShieldPlus, openAssignScopes, canRevokeScopes, roleScopes, roleScopes, ShieldMinus, openRevokeScopes,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
