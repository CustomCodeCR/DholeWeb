import { KeyRound } from 'lucide-vue-next';
import { useRoute } from 'vue-router';
import { DhEntityDetailPage } from '@/shared/components/organisms';
const route = useRoute();
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhEntityDetailPage | typeof __VLS_components.DhEntityDetailPage} */
DhEntityDetailPage;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: "Detalle de permiso",
    subtitle: (String(__VLS_ctx.route.params.id)),
    icon: (__VLS_ctx.KeyRound),
}));
const __VLS_2 = __VLS_1({
    title: "Detalle de permiso",
    subtitle: (String(__VLS_ctx.route.params.id)),
    icon: (__VLS_ctx.KeyRound),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5;
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
// @ts-ignore
[route, KeyRound,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
