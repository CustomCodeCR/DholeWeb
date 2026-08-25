import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Component } from 'vue'

import {
  BadgeDollarSign,
  BookOpen,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  ListTree,
  ListChecks,
  MonitorCog,
  Settings,
  Shield,
  TrendingUp,
  Users,
  FileText,
  Mail,
  BrainCircuit,
  HardDrive,
  Bell,
  BellRing,
} from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { VIEW_SCOPES } from '@/core/auth/scopes'

export interface SidebarItem {
  labelKey: string
  icon: Component
  to?: string
  name?: string
  requiredScope?: string
  requiredAnyScopes?: string[]
  requiredRole?: string
  children?: SidebarItem[]
}

export interface SidebarSection {
  sectionKey?: string
  items: SidebarItem[]
}

export interface SidebarItemView extends SidebarItem {
  label: string
  children?: SidebarItemView[]
}

export interface SidebarSectionView {
  section: string
  items: SidebarItemView[]
}

const SIDEBAR_NAVIGATION: SidebarSection[] = [
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
            requiredScope: VIEW_SCOPES.pricing,
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
            labelKey: 'sidebar.costs',
            icon: BadgeDollarSign,
            to: '/pricing/costs',
            name: 'pricing-costs',
            requiredScope: VIEW_SCOPES.pricingCosts,
          },
          {
            labelKey: 'sidebar.rateTerms',
            icon: ListChecks,
            to: '/pricing/rate-terms',
            name: 'pricing-rate-terms',
            requiredScope: VIEW_SCOPES.pricingRateTerms,
          },
        ],
      },

      {
        labelKey: 'sidebar.reports',
        icon: FileText,
        name: 'reports',
        children: [
          {
            labelKey: 'sidebar.reportTemplates',
            icon: FileText,
            to: '/reports/templates',
            name: 'reports-templates',
            requiredScope: VIEW_SCOPES.reportsTemplates,
          },
        ],
      },
      {
        labelKey: 'sidebar.aiCenter',
        icon: BrainCircuit,
        to: '/ai',
        name: 'ai-console',
        requiredAnyScopes: [
          VIEW_SCOPES.aiConnections,
          VIEW_SCOPES.aiModels,
          VIEW_SCOPES.aiProfiles,
          VIEW_SCOPES.aiPromptTemplates,
          VIEW_SCOPES.aiExecutions,
          VIEW_SCOPES.aiAssistant,
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
            requiredScope: VIEW_SCOPES.monitoring,
          },
          {
            labelKey: 'sidebar.notificationAdministration',
            icon: Bell,
            to: '/monitoring/notifications',
            name: 'notifications',
            requiredScope: VIEW_SCOPES.notifications,
          },
          {
            labelKey: 'sidebar.notificationTemplates',
            icon: BellRing,
            to: '/monitoring/notifications/templates',
            name: 'notifications-templates',
            requiredScope: VIEW_SCOPES.notificationTemplates,
          },
          {
            labelKey: 'sidebar.storage',
            icon: HardDrive,
            to: '/storage',
            name: 'storage',
            requiredScope: VIEW_SCOPES.storage,
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
]

export function useSidebarItems() {
  const { t } = useI18n()
  const authStore = useAuthStore()

  const navigation = computed<SidebarSectionView[]>(() =>
    SIDEBAR_NAVIGATION.map((section) => ({
      section: section.sectionKey ? t(section.sectionKey) : '',
      items: section.items
        .map((item) => mapItem(item, t, authStore))
        .filter((item): item is SidebarItemView => item !== null),
    })).filter((section) => section.items.length > 0),
  )

  return {
    navigation,
  }
}

function mapItem(
  item: SidebarItem,
  t: (key: string) => string,
  authStore: ReturnType<typeof useAuthStore>,
): SidebarItemView | null {
  if (item.requiredScope && !authStore.hasScope(item.requiredScope)) {
    return null
  }

  if (item.requiredAnyScopes?.length && !item.requiredAnyScopes.some((scope) => authStore.hasScope(scope))) {
    return null
  }

  if (item.requiredRole && !authStore.hasRole(item.requiredRole)) {
    return null
  }

  const children = item.children
    ?.map((child) => mapItem(child, t, authStore))
    .filter((child): child is SidebarItemView => child !== null)

  if (item.children && (!children || children.length === 0)) {
    return null
  }

  return {
    ...item,
    label: t(item.labelKey),
    children,
  }
}

export { SIDEBAR_NAVIGATION }
