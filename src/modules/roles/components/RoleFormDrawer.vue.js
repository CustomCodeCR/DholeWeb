import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DhButton, DhInput, DhTextarea, DhSwitch } from '@/shared/components/atoms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { AUTH_SCOPES } from '@/core/auth/scopes';
import { RolesService } from '@/core/services/rolesService';
import { ScopesService } from '@/core/services/scopesService';
const props = defineProps();
const { t } = useI18n();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const loading = ref(false);
const scopes = ref([]);
const selectedScopeIds = ref([]);
const originalScopeIds = ref([]);
const form = ref({
    name: props.role?.name ?? '',
    description: props.role?.description ?? '',
    isActive: props.role?.isActive ?? true,
});
const isEdit = computed(() => Boolean(props.role));
const canCreate = computed(() => authStore.hasScope(AUTH_SCOPES.roles.create));
const canUpdate = computed(() => authStore.hasScope(AUTH_SCOPES.roles.update));
const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.roles.setActive));
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view));
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesAssign) && canViewScopes.value);
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesRevoke));
const canManageScopes = computed(() => canAssignScopes.value || canRevokeScopes.value);
const canSaveRole = computed(() => (isEdit.value ? canUpdate.value : canCreate.value));
const showScopeSection = computed(() => canManageScopes.value && scopes.value.length > 0);
function diffAdded(current, original) {
    return current.filter((id) => !original.includes(id));
}
function diffRemoved(current, original) {
    return original.filter((id) => !current.includes(id));
}
async function loadScopes() {
    try {
        if (!canManageScopes.value)
            return;
        if (canAssignScopes.value) {
            scopes.value = await ScopesService.select();
        }
        if (!props.role)
            return;
        const currentScopes = await RolesService.getScopes(props.role.id);
        originalScopeIds.value = currentScopes.map((x) => x.scopeId);
        selectedScopeIds.value = [...originalScopeIds.value];
        if (!canAssignScopes.value) {
            scopes.value = currentScopes.map((scope) => ({
                id: scope.scopeId,
                code: scope.scopeCode,
                name: scope.scopeName,
            }));
        }
    }
    catch (error) {
        scopes.value = [];
        toastStore.backendWarning(error, 'No se pudieron cargar los permisos del rol.');
    }
}
async function syncRoleScopes(roleId) {
    const added = diffAdded(selectedScopeIds.value, originalScopeIds.value);
    const removed = diffRemoved(selectedScopeIds.value, originalScopeIds.value);
    if (canAssignScopes.value && added.length > 0)
        await RolesService.assignScopes(roleId, { scopeIds: added });
    if (canRevokeScopes.value && removed.length > 0)
        await RolesService.revokeScopes(roleId, { scopeIds: removed });
}
async function save() {
    if (!canSaveRole.value) {
        toastStore.warning('Sin permiso', 'No tiene permiso para guardar este rol.');
        return;
    }
    try {
        loading.value = true;
        if (props.role) {
            await RolesService.update(props.role.id, {
                name: form.value.name,
                description: form.value.description || null,
            });
            if (canSetActive.value && form.value.isActive !== props.role.isActive) {
                await RolesService.setActive(props.role.id, { isActive: form.value.isActive });
            }
            await syncRoleScopes(props.role.id);
        }
        else {
            const id = await RolesService.create({
                name: form.value.name,
                description: form.value.description || null,
                isSystemRole: false,
            });
            if (canAssignScopes.value && selectedScopeIds.value.length > 0) {
                await RolesService.assignScopes(id, { scopeIds: selectedScopeIds.value });
            }
        }
        toastStore.success('Guardado', 'Rol guardado correctamente.');
        await props.onSaved?.();
        drawerStore.close();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo guardar el rol.');
    }
    finally {
        loading.value = false;
    }
}
onMounted(loadScopes);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.save) },
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.form.name),
    label: (__VLS_ctx.t('common.name')),
    disabled: (!__VLS_ctx.canSaveRole),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.form.name),
    label: (__VLS_ctx.t('common.name')),
    disabled: (!__VLS_ctx.canSaveRole),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
DhTextarea;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.form.description),
    label: (__VLS_ctx.t('common.description')),
    disabled: (!__VLS_ctx.canSaveRole),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.form.description),
    label: (__VLS_ctx.t('common.description')),
    disabled: (!__VLS_ctx.canSaveRole),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
if (__VLS_ctx.role && __VLS_ctx.canSetActive) {
    let __VLS_10;
    /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
    DhSwitch;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        modelValue: (__VLS_ctx.form.isActive),
        label: (__VLS_ctx.t('common.active')),
    }));
    const __VLS_12 = __VLS_11({
        modelValue: (__VLS_ctx.form.isActive),
        label: (__VLS_ctx.t('common.active')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
}
if (__VLS_ctx.showScopeSection) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "mb-3 text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('roles.scopes'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    for (const [scope] of __VLS_vFor((__VLS_ctx.scopes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (scope.id),
            ...{ class: "flex items-start gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-bold" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
            value: (scope.id),
            disabled: ((!__VLS_ctx.originalScopeIds.includes(scope.id) && !__VLS_ctx.canAssignScopes) || (__VLS_ctx.originalScopeIds.includes(scope.id) && !__VLS_ctx.canRevokeScopes && __VLS_ctx.isEdit)),
            ...{ class: "mt-1 accent-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-40" },
        });
        (__VLS_ctx.selectedScopeIds);
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['accent-[var(--dh-primary)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:opacity-40']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (scope.code);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block text-xs text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (scope.name);
        // @ts-ignore
        [save, form, form, form, t, t, t, t, canSaveRole, canSaveRole, role, canSetActive, showScopeSection, scopes, originalScopeIds, originalScopeIds, canAssignScopes, canRevokeScopes, isEdit, selectedScopeIds,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('common.cancel')),
    variant: "secondary",
}));
const __VLS_17 = __VLS_16({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('common.cancel')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
const __VLS_21 = {
    /** @type {typeof __VLS_20.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.drawerStore.close();
        // @ts-ignore
        [t, drawerStore,];
    },
};
var __VLS_18;
var __VLS_19;
let __VLS_22;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
    type: "submit",
    label: (__VLS_ctx.t('common.save')),
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSaveRole),
}));
const __VLS_24 = __VLS_23({
    type: "submit",
    label: (__VLS_ctx.t('common.save')),
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSaveRole),
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
// @ts-ignore
[t, canSaveRole, loading,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
