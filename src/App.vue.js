import { onBeforeUnmount, onMounted } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import DhToastContainer from '@/shared/components/containers/DhToastContainer.vue';
import DhModalContainer from '@/shared/components/containers/DhModalContainer.vue';
import DhDrawerContainer from '@/shared/components/containers/DhDrawerContainer.vue';
import { useAuthStore } from '@/core/stores/authStore';
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore';
import { useBrandingStore } from '@/core/stores/brandingStore';
const router = useRouter();
const authStore = useAuthStore();
const tabsStore = useWorkspaceTabsStore();
const brandingStore = useBrandingStore();
function handleAuthExpired() {
    authStore.clearSession();
    tabsStore.clear();
    void brandingStore.loadCurrentClientBranding();
    if (router.currentRoute.value.path !== '/login') {
        router.replace({ path: '/login', query: { expired: '1' } });
    }
}
function handleAuthRefreshed(event) {
    const detail = event.detail;
    if (!detail?.accessToken || !detail?.refreshToken || !detail?.sessionId) {
        return;
    }
    authStore.setSession(detail);
    void brandingStore.loadCurrentClientBranding();
}
onMounted(() => {
    brandingStore.applyCachedOrDefault();
    void brandingStore.loadCurrentClientBranding();
    window.addEventListener('dhole:auth:expired', handleAuthExpired);
    window.addEventListener('dhole:auth:refreshed', handleAuthRefreshed);
});
onBeforeUnmount(() => {
    window.removeEventListener('dhole:auth:expired', handleAuthExpired);
    window.removeEventListener('dhole:auth:refreshed', handleAuthRefreshed);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = DhToastContainer;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_5 = DhModalContainer;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const __VLS_10 = DhDrawerContainer;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.RouterView} */
RouterView;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({}));
const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
