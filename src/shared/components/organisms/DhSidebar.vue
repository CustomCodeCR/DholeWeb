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
  const saved = navigationExpanded.value[key]
  if (typeof saved === 'boolean') return saved
  // Other modules preserve their accordion preference; CRM links remain directly visible.
  if (!key.includes(':group:')) return true
  return visibleItems.value.some(item =>
    item.children && groupedChildren(item).some(group =>
      groupStateKey(item, group.id) === key && groupIsActive(group)),
  )
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
function isCrmSection(item: SidebarItem): boolean {
  return (item.children ?? []).some(child => child.path === '/crm/accounts')
}

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

function sectionIsActive(item: SidebarItem): boolean {
  return (item.children ?? []).some(childIsActive)
}

function groupIsActive(group: ChildGroup): boolean {
  return group.items.some(childIsActive)
}

function onSectionClick(item: SidebarItem): void {
  if (compact.value) {
    emit('toggle-collapse')
    return
  }
  toggleExpanded(sectionStateKey(item))
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
      <div class="shrink-0 border-b border-[var(--dh-border)] px-3 pb-3 pt-3">
        <div
          class="flex min-h-16 items-center gap-2.5 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-2.5 py-2 shadow-[var(--dh-shadow-sm)]"
          :class="compact ? 'justify-center' : ''"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--dh-primary)] text-sm font-black text-white"
          >
            GCF
          </div>

          <div v-if="!compact" class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-extrabold tracking-tight text-[var(--dh-text)]">
              {{ t('app.name') }}
            </p>
            <p class="truncate text-[11px] font-medium text-[var(--dh-text-muted)]">
              {{ t('app.subtitle') }}
            </p>
          </div>

          <button
            v-if="!compact && !mobileOpen"
            type="button"
            class="hidden h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-xl text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] focus-visible:outline-2 focus-visible:outline-[var(--dh-primary)] lg:inline-flex"
            :title="t('sidebar.collapse')"
            :aria-label="t('sidebar.collapse')"
            @click="emit('toggle-collapse')"
          >
            <PanelLeftClose class="h-4 w-4" />
          </button>

          <button
            v-if="mobileOpen"
            type="button"
            class="inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-xl text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] lg:hidden"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <button
          v-if="compact"
          type="button"
          class="mt-2 hidden min-h-9 w-full touch-manipulation items-center justify-center rounded-xl text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] lg:flex"
          :title="t('sidebar.expand')"
          :aria-label="t('sidebar.expand')"
          @click="emit('toggle-collapse')"
        >
          <PanelLeftOpen class="h-4 w-4" />
        </button>
      </div>

      <nav class="dh-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2.5 py-3" :aria-label="t('sidebar.dashboard')">
        <template v-for="(item, itemIndex) in visibleItems" :key="item.path ?? item.label">
          <div v-if="item.children" class="sidebar-module">
            <button
              type="button"
              class="sidebar-module-toggle"
              :class="{
                'sidebar-module-toggle--current': sectionIsActive(item),
                'sidebar-module-toggle--compact': compact,
              }"
              :title="compact ? item.label : undefined"
              :aria-label="compact ? item.label + ' — ' + t('sidebar.expand') : item.label"
              :aria-expanded="compact ? undefined : isExpanded(sectionStateKey(item))"
              :aria-controls="compact ? undefined : 'sidebar-section-' + itemIndex"
              @click="onSectionClick(item)"
            >
              <span class="sidebar-module-icon">
                <component :is="item.icon" class="h-[17px] w-[17px]" />
              </span>
              <span v-if="!compact" class="min-w-0 flex-1 truncate text-left">
                {{ item.label }}
              </span>
              <ChevronDown
                v-if="!compact"
                class="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200"
                :class="isExpanded(sectionStateKey(item)) ? '' : '-rotate-90'"
              />
            </button>

            <Transition name="sidebar-accordion">
              <div
                v-if="!compact && isExpanded(sectionStateKey(item))"
                :id="'sidebar-section-' + itemIndex"
                class="sidebar-module-children"
              >
                <template v-for="(group, groupIndex) in groupedChildren(item)" :key="group.id + groupIndex">
                  <div v-if="group.label && isCrmSection(item)"
                    class="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--dh-text-muted)]">
                    {{ group.label }}
                  </div>
                  <button
                    v-else-if="group.label"
                    type="button"
                    class="sidebar-subgroup-toggle"
                    :class="{ 'sidebar-subgroup-toggle--current': groupIsActive(group) }"
                    :aria-expanded="isExpanded(groupStateKey(item, group.id))"
                    :aria-controls="'sidebar-section-' + itemIndex + '-group-' + groupIndex"
                    @click="toggleExpanded(groupStateKey(item, group.id))"
                  >
                    <span class="min-w-0 flex-1 truncate text-left">{{ group.label }}</span>
                    <ChevronDown
                      class="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200"
                      :class="isExpanded(groupStateKey(item, group.id)) ? '' : '-rotate-90'"
                    />
                  </button>

                  <Transition name="sidebar-accordion">
                    <div
                      v-if="isCrmSection(item) || !group.label || isExpanded(groupStateKey(item, group.id))"
                      :id="'sidebar-section-' + itemIndex + '-group-' + groupIndex"
                      class="sidebar-subgroup-children"
                    >
                      <RouterLink
                        v-for="child in group.items"
                        :key="child.path ?? child.label"
                        :to="child.path ?? '/'"
                        class="sidebar-nav-link"
                        active-class="sidebar-nav-link-active"
                        @click="emit('close')"
                      >
                        <component :is="child.icon" class="h-4 w-4 shrink-0" />
                        <span class="min-w-0 flex-1 truncate">{{ child.label }}</span>
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
            class="sidebar-module-toggle sidebar-module-link"
            :class="{ 'sidebar-module-toggle--compact': compact }"
            active-class="sidebar-module-toggle--current"
            :title="compact ? item.label : undefined"
            @click="emit('close')"
          >
            <span class="sidebar-module-icon">
              <component :is="item.icon" class="h-[17px] w-[17px]" />
            </span>
            <span v-if="!compact" class="min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
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

.sidebar-module {
  min-width: 0;
}

.sidebar-module-toggle {
  display: flex;
  min-height: 44px;
  width: 100%;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 13px;
  padding: 6px 10px;
  color: var(--dh-text-soft);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
}

.sidebar-module-toggle:hover,
.sidebar-module-toggle:focus-visible {
  background-color: var(--dh-card-hover);
  color: var(--dh-text);
}

.sidebar-module-toggle--current {
  border-color: color-mix(in srgb, var(--dh-primary) 20%, transparent);
  background-color: color-mix(in srgb, var(--dh-primary) 9%, var(--dh-card));
  color: var(--dh-text);
}

.sidebar-module-toggle--current .sidebar-module-icon {
  background-color: color-mix(in srgb, var(--dh-primary) 14%, transparent);
  color: var(--dh-primary);
}

.sidebar-module-icon {
  display: flex;
  width: 30px;
  height: 30px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--dh-text-muted);
}

.sidebar-module-toggle--compact {
  justify-content: center;
  gap: 0;
  padding-inline: 6px;
}

.sidebar-module-children {
  margin: 3px 0 7px 24px;
  padding-left: 10px;
  border-left: 1px solid var(--dh-border);
}

.sidebar-subgroup-toggle {
  display: flex;
  width: 100%;
  min-height: 35px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 9px;
  padding: 7px 9px;
  color: var(--dh-text-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.065em;
  line-height: 1.25;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.sidebar-subgroup-toggle:hover,
.sidebar-subgroup-toggle:focus-visible {
  background-color: var(--dh-card-hover);
  color: var(--dh-text);
}

.sidebar-subgroup-toggle--current {
  color: var(--dh-text);
}

.sidebar-subgroup-children {
  display: grid;
  gap: 2px;
  margin: 0 0 4px;
}

.sidebar-nav-link {
  position: relative;
  display: flex;
  min-height: 39px;
  align-items: center;
  gap: 10px;
  border-radius: 11px;
  padding: 8px 10px;
  color: var(--dh-text-soft);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.sidebar-nav-link svg {
  color: var(--dh-text-muted);
}

.sidebar-nav-link:hover,
.sidebar-nav-link:focus-visible {
  background-color: var(--dh-card-hover);
  color: var(--dh-text);
}

.sidebar-nav-link-active,
.sidebar-nav-link-active:hover {
  background-color: color-mix(in srgb, var(--dh-primary) 13%, var(--dh-card));
  color: var(--dh-text);
  font-weight: 750;
}

.sidebar-nav-link-active::before {
  content: '';
  position: absolute;
  inset: 10px auto 10px 0;
  width: 3px;
  border-radius: 4px;
  background-color: var(--dh-primary);
}

.sidebar-nav-link-active svg {
  color: var(--dh-primary);
}

.sidebar-module-toggle:focus-visible,
.sidebar-subgroup-toggle:focus-visible,
.sidebar-nav-link:focus-visible {
  outline: 2px solid var(--dh-primary);
  outline-offset: -2px;
}

.sidebar-accordion-enter-active,
.sidebar-accordion-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.sidebar-accordion-enter-from,
.sidebar-accordion-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-accordion-enter-active,
  .sidebar-accordion-leave-active,
  .sidebar-module-toggle,
  .sidebar-subgroup-toggle,
  .sidebar-nav-link {
    transition: none;
  }
}
</style>
