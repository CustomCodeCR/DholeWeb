import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Component } from 'vue'

import {
  LayoutDashboard,
  Users,
  Shield,
  KeyRound,
  MonitorCog,
  ClipboardList,
  Settings,
  BookOpen,
  ListTree,
} from 'lucide-vue-next'

export interface SidebarItem {
  labelKey: string
  icon: Component
  to?: string
  name?: string
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
          },
          {
            labelKey: 'sidebar.roles',
            icon: Shield,
            to: '/auth/roles',
            name: 'roles',
          },
          {
            labelKey: 'sidebar.scopes',
            icon: KeyRound,
            to: '/auth/scopes',
            name: 'scopes',
          },
          {
            labelKey: 'sidebar.sessions',
            icon: MonitorCog,
            to: '/auth/sessions',
            name: 'sessions',
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
          },
        ],
      },
      {
        labelKey: 'sidebar.audits',
        icon: ClipboardList,
        to: '/audits',
        name: 'audits',
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

  const navigation = computed<SidebarSectionView[]>(() =>
    SIDEBAR_NAVIGATION.map((section) => ({
      section: section.sectionKey ? t(section.sectionKey) : '',
      items: section.items.map((item) => mapItem(item, t)),
    })),
  )

  return {
    navigation,
  }
}

function mapItem(item: SidebarItem, t: (key: string) => string): SidebarItemView {
  return {
    ...item,
    label: t(item.labelKey),
    children: item.children?.map((child) => mapItem(child, t)),
  }
}

export { SIDEBAR_NAVIGATION }
