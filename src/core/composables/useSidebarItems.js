import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BadgeDollarSign, BookOpen, ClipboardList, KeyRound, LayoutDashboard, ListTree, MonitorCog, Settings, Shield, TrendingUp, Users, FileText, Mail, ReceiptText, } from 'lucide-vue-next';
import { useAuthStore } from '@/core/stores/authStore';
import { VIEW_SCOPES } from '@/core/auth/scopes';
const SIDEBAR_NAVIGATION = [
    {
        items: [
            {
                labelKey: 'sidebar.dashboard',
                icon: LayoutDashboard,
                to: '/home',
                name: 'dashboard',
            },
            {
                labelKey: 'sidebar.security',
                icon: Shield,
                name: 'security',
                children: [
                    {
                        labelKey: 'sidebar.users',
                        icon: Users,
                        to: '/auth/users',
                        name: 'users',
                        requiredScope: VIEW_SCOPES.users,
                    },
                    {
                        labelKey: 'sidebar.roles',
                        icon: Shield,
                        to: '/auth/roles',
                        name: 'roles',
                        requiredScope: VIEW_SCOPES.roles,
                    },
                    {
                        labelKey: 'sidebar.scopes',
                        icon: KeyRound,
                        to: '/auth/scopes',
                        name: 'scopes',
                        requiredScope: VIEW_SCOPES.scopes,
                    },
                    {
                        labelKey: 'sidebar.sessions',
                        icon: MonitorCog,
                        to: '/auth/sessions',
                        name: 'sessions',
                        requiredScope: VIEW_SCOPES.sessions,
                    },
                ],
            },
            {
                labelKey: 'sidebar.config',
                icon: BookOpen,
                name: 'config',
                children: [
                    {
                        labelKey: 'sidebar.catalogs',
                        icon: ListTree,
                        to: '/config/catalogs',
                        name: 'catalogs',
                        requiredScope: VIEW_SCOPES.catalogs,
                    },
                ],
            },
            {
                labelKey: 'sidebar.pricing',
                icon: TrendingUp,
                name: 'pricing',
                children: [
                    {
                        labelKey: 'sidebar.pricingPanel',
                        icon: TrendingUp,
                        to: '/pricing',
                        name: 'pricing',
                        requiredScope: VIEW_SCOPES.pricingRates,
                    },
                    {
                        labelKey: 'sidebar.importedRates',
                        icon: FileText,
                        to: '/pricing/imports',
                        name: 'pricing-imports',
                        requiredScope: VIEW_SCOPES.pricingImports,
                    },
                    {
                        labelKey: 'sidebar.emailImports',
                        icon: Mail,
                        to: '/pricing/email-imports',
                        name: 'pricing-email-imports',
                        requiredScope: VIEW_SCOPES.pricingImports,
                    },
                    {
                        labelKey: 'sidebar.rates',
                        icon: ReceiptText,
                        to: '/pricing/rates',
                        name: 'pricing-rates',
                        requiredScope: VIEW_SCOPES.pricingRates,
                    },
                    {
                        labelKey: 'sidebar.costs',
                        icon: BadgeDollarSign,
                        to: '/pricing/costs',
                        name: 'pricing-costs',
                        requiredScope: VIEW_SCOPES.pricingCosts,
                    },
                ],
            },
            {
                labelKey: 'sidebar.monitoring',
                icon: MonitorCog,
                name: 'monitoring',
                children: [
                    {
                        labelKey: 'sidebar.audits',
                        icon: ClipboardList,
                        to: '/auditlogs/events',
                        name: 'audits',
                        requiredScope: VIEW_SCOPES.auditLogs,
                    },
                    {
                        labelKey: 'sidebar.serviceMonitoring',
                        icon: MonitorCog,
                        to: '/monitoring/services',
                        name: 'monitoring-services',
                        requiredRole: 'SuperUsuario',
                    },
                ],
            },
            {
                labelKey: 'sidebar.settings',
                icon: Settings,
                to: '/settings',
                name: 'settings',
            },
        ],
    },
];
export function useSidebarItems() {
    const { t } = useI18n();
    const authStore = useAuthStore();
    const navigation = computed(() => SIDEBAR_NAVIGATION.map((section) => ({
        section: section.sectionKey ? t(section.sectionKey) : '',
        items: section.items
            .map((item) => mapItem(item, t, authStore))
            .filter((item) => item !== null),
    })).filter((section) => section.items.length > 0));
    return {
        navigation,
    };
}
function mapItem(item, t, authStore) {
    if (item.requiredScope && !authStore.hasScope(item.requiredScope)) {
        return null;
    }
    if (item.requiredRole && !authStore.hasRole(item.requiredRole)) {
        return null;
    }
    const children = item.children
        ?.map((child) => mapItem(child, t, authStore))
        .filter((child) => child !== null);
    if (item.children && (!children || children.length === 0)) {
        return null;
    }
    return {
        ...item,
        label: t(item.labelKey),
        children,
    };
}
export { SIDEBAR_NAVIGATION };
