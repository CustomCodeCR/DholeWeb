<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-vue-next'

export interface SidebarItem {
  label: string
  path?: string
  icon: Component
  group?: string
  children?: SidebarItem[]
}

const props = defineProps<{
  items: SidebarItem[]
  collapsed?: boolean
  mobileOpen?: boolean
}>()

const emit = defineEmits<{
  'toggle-collapse': []
  close: []
}>()

const { t } = useI18n()
const compact = computed(() => Boolean(props.collapsed && !props.mobileOpen))

// Settings is centralized in the topbar. Keep the routes available, but do not
// render the Settings group in the left sidebar.
const visibleItems = computed(() =>
  props.items.filter(
    (item) => !item.children?.some((child) => child.path === '/settings/appearance'),
  ),
)

type ChildGroup = {
  id: string
  label?: string
  items: SidebarItem[]
}

const NAVIGATION_STATE_KEY = 'dhole.sidebar.navigation.expanded.v1'
const route = useRoute()

function readNavigationState(): Record<string, boolean> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(NAVIGATION_STATE_KEY) ?? '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
    return Object.fromEntries(
      Object.entries(stored).filter(([, value]) => typeof value === 'boolean'),
    ) as Record<string, boolean>
  } catch {
    return {}
  }
}

const navigationExpanded = ref<Record<string, boolean>>(readNavigationState())

function sectionStateKey(item: SidebarItem): string {
  return 'section:' + (item.children?.[0]?.path ?? item.path ?? item.label)
}

function groupStateKey(item: SidebarItem, group: string): string {
  return sectionStateKey(item) + ':group:' + group
}

function isExpanded(key: string): boolean {
  return navigationExpanded.value[key] !== false
}

function saveNavigationState(): void {
  try {
    localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(navigationExpanded.value))
  } catch {
    // The sidebar remains interactive when browser storage is unavailable.
  }
}

function toggleExpanded(key: string): void {
  navigationExpanded.value = { ...navigationExpanded.value, [key]: !isExpanded(key) }
  saveNavigationState()
}

// The CRM supplies flat, permission-filtered children with group labels.
// Group only adjacent entries, preserving both their order and route destinations.
function groupedChildren(item: SidebarItem): ChildGroup[] {
  const groups: ChildGroup[] = []
  for (const child of item.children ?? []) {
    const id = child.group ?? ''
    let current = groups[groups.length - 1]
    if (!current || current.id !== id) {
      current = { id, label: child.group, items: [] }
      groups.push(current)
    }
    current.items.push(child)
  }
  return groups
}

function childIsActive(child: SidebarItem): boolean {
  if (!child.path) return false
  return route.path === child.path ||
    (child.path !== '/crm' && route.path.startsWith(child.path + '/'))
}

// When another control navigates to a collapsed group, reveal its active link.
// Manual collapsing still works on the current page, and states survive reloads.
watch(
  () => route.path,
  () => {
    const toExpand: Record<string, boolean> = {}
    for (const item of visibleItems.value) {
      if (!item.children) continue
      for (const group of groupedChildren(item)) {
        if (!group.items.some(childIsActive)) continue
        toExpand[sectionStateKey(item)] = true
        if (group.label) toExpand[groupStateKey(item, group.id)] = true
      }
    }
    if (Object.keys(toExpand).some((key) => !isExpanded(key))) {
      navigationExpanded.value = { ...navigationExpanded.value, ...toExpand }
      saveNavigationState()
    }
  },
)
</script>

<template>
  <Transition name="sidebar-overlay">
    <button
      v-if="mobileOpen"
      type="button"
      class="fixed inset-0 z-[39] bg-black/25 backdrop-blur-sm lg:hidden"
      :aria-label="t('common.close')"
      @click="emit('close')"
    />
  </Transition>

  <aside
    class="fixed bottom-2 left-2 top-2 z-40 flex w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-shell)] shadow-[var(--dh-shadow-lg)] backdrop-blur-2xl transition-[width,transform] duration-300 sm:bottom-4 sm:left-4 sm:top-4 lg:translate-x-0"
    :class="[
      collapsed ? 'lg:w-20' : 'lg:w-72',
      mobileOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0',
    ]"
  >
    <div class="flex min-h-0 w-full flex-col">
      <div class="shrink-0 border-b border-[var(--dh-border)] p-3">
        <div
          class="dh-liquid flex items-center rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-[var(--dh-shadow-sm)]"
          :class="compact ? 'justify-center' : 'gap-3'"
        >
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[var(--dh-primary)] text-lg font-black text-white shadow-[var(--dh-glow)]"
          >
            GCF
          </div>

          <div v-if="!compact" class="min-w-0 flex-1">
            <p class="truncate text-sm font-black tracking-tight text-[var(--dh-text)]">
              {{ t('app.name') }}
            </p>
            <p class="truncate text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ t('app.subtitle') }}
            </p>
          </div>

          <button
            v-if="mobileOpen"
            type="button"
            class="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] lg:hidden"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <button
          class="mt-3 hidden w-full items-center justify-center rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] lg:flex"
          :title="collapsed ? t('sidebar.expand') : t('sidebar.collapse')"
          @click="emit('toggle-collapse')"
        >
          <PanelLeftOpen v-if="collapsed" class="h-4 w-4" />
          <PanelLeftClose v-else class="h-4 w-4" />
        </button>
      </div>

      <nav class="dh-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pr-2">
        <template v-for="(item, itemIndex) in visibleItems" :key="item.path ?? item.label">
          <div v-if="item.children" class="space-y-1.5">
            <button
              type="button"
              class="flex min-h-10 w-full touch-manipulation items-center rounded-[20px] px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.18em] text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)] disabled:cursor-default"
              :class="compact ? 'justify-center' : 'gap-3'"
              :title="compact ? item.label : undefined"
              :disabled="compact"
              :aria-expanded="compact || isExpanded(sectionStateKey(item))"
              :aria-controls="'sidebar-section-' + itemIndex"
              @click="toggleExpanded(sectionStateKey(item))"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />
              <span v-if="!compact" class="truncate">{{ item.label }}</span>
              <ChevronDown
                v-if="!compact"
                class="ml-auto h-4 w-4 shrink-0 transition-transform duration-200"
                :class="isExpanded(sectionStateKey(item)) ? '' : '-rotate-90'"
              />
            </button>

            <Transition name="sidebar-accordion">
              <div
                v-if="compact || isExpanded(sectionStateKey(item))"
                :id="'sidebar-section-' + itemIndex"
                class="space-y-1.5"
              >
                <template v-for="(group, groupIndex) in groupedChildren(item)" :key="group.id + groupIndex">
                  <button
                    v-if="group.label && !compact"
                    type="button"
                    class="mt-3 flex min-h-9 w-full touch-manipulation items-center justify-between gap-2 border-t border-[var(--dh-border)] px-3 pt-2 text-left text-[10px] font-extrabold uppercase tracking-widest text-[var(--dh-text-muted)] transition hover:text-[var(--dh-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                    :aria-expanded="isExpanded(groupStateKey(item, group.id))"
                    :aria-controls="'sidebar-section-' + itemIndex + '-group-' + groupIndex"
                    @click="toggleExpanded(groupStateKey(item, group.id))"
                  >
                    <span class="truncate">{{ group.label }}</span>
                    <ChevronDown
                      class="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
                      :class="isExpanded(groupStateKey(item, group.id)) ? '' : '-rotate-90'"
                    />
                  </button>

                  <Transition name="sidebar-accordion">
                    <div
                      v-if="compact || !group.label || isExpanded(groupStateKey(item, group.id))"
                      :id="'sidebar-section-' + itemIndex + '-group-' + groupIndex"
                      class="space-y-1"
                    >
                      <RouterLink
                        v-for="child in group.items"
                        :key="child.path ?? child.label"
                        :to="child.path ?? '/'"
                        class="flex min-h-11 touch-manipulation items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]"
                        :class="compact ? 'justify-center' : 'gap-3'"
                        :title="compact ? child.label : undefined"
                        active-class="!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]"
                        @click="emit('close')"
                      >
                        <component :is="child.icon" class="h-4 w-4 shrink-0" />
                        <span v-if="!compact" class="truncate">{{ child.label }}</span>
                      </RouterLink>
                    </div>
                  </Transition>
                </template>
              </div>
            </Transition>
          </div>

          <RouterLink
            v-else
            :to="item.path ?? '/'"
            class="flex min-h-11 touch-manipulation items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]"
            :class="compact ? 'justify-center' : 'gap-3'"
            :title="compact ? item.label : undefined"
            active-class="!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]"
            @click="emit('close')"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" />
            <span v-if="!compact" class="truncate">{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active {
  transition: opacity 180ms ease;
}

.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to {
  opacity: 0;
}

.sidebar-accordion-enter-active,
.sidebar-accordion-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.sidebar-accordion-enter-from,
.sidebar-accordion-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-accordion-enter-active,
  .sidebar-accordion-leave-active {
    transition: none;
  }
}
</style>
