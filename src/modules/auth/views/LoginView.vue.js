import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { LogIn, Mail } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhButton, DhInput, DhPasswordInput } from '@/shared/components/atoms';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
const { t } = useI18n();
const router = useRouter();
const toastStore = useToastStore();
const authStore = useAuthStore();
const email = ref('');
const password = ref('');
const loading = ref(false);
async function login() {
    if (!email.value || !password.value) {
        toastStore.warning('Datos incompletos', t('auth.missingData'));
        return;
    }
    try {
        loading.value = true;
        await authStore.login({ email: email.value, password: password.value });
        toastStore.success('Sesión iniciada', 'Bienvenido a Dhole.');
        await router.push('/home');
    }
    catch (error) {
        toastStore.backendError(error, t('auth.loginError'));
    }
    finally {
        loading.value = false;
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.login) },
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-center" },
});
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-2xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('auth.loginTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('auth.loginSubtitle'));
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.email),
    label: (__VLS_ctx.t('auth.email')),
    placeholder: "admin@empresa.com",
    type: "email",
    icon: (__VLS_ctx.Mail),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.email),
    label: (__VLS_ctx.t('auth.email')),
    placeholder: "admin@empresa.com",
    type: "email",
    icon: (__VLS_ctx.Mail),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhPasswordInput} */
DhPasswordInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.password),
    label: (__VLS_ctx.t('auth.password')),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.password),
    label: (__VLS_ctx.t('auth.password')),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "w-full" },
    type: "submit",
    label: (__VLS_ctx.t('auth.submit')),
    icon: (__VLS_ctx.LogIn),
    loading: (__VLS_ctx.loading),
}));
const __VLS_12 = __VLS_11({
    ...{ class: "w-full" },
    type: "submit",
    label: (__VLS_ctx.t('auth.submit')),
    icon: (__VLS_ctx.LogIn),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
// @ts-ignore
[login, t, t, t, t, t, email, Mail, password, LogIn, loading,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
