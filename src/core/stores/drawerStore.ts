import { defineStore } from 'pinia'
import type { Component } from 'vue'

export interface DrawerState {
  isOpen: boolean
  title: string
  component: Component | null
  props: Record<string, unknown>
  size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export const useDrawerStore = defineStore('drawer', {
  state: (): DrawerState => ({
    isOpen: false,
    title: '',
    component: null,
    props: {},
    size: 'md',
  }),

  actions: {
    open(input: {
      title: string
      component: Component
      props?: Record<string, unknown>
      size?: DrawerState['size']
    }) {
      this.title = input.title
      this.component = input.component
      this.props = input.props ?? {}
      this.size = input.size ?? 'md'
      this.isOpen = true
    },

    close() {
      this.isOpen = false
      this.title = ''
      this.component = null
      this.props = {}
      this.size = 'md'
    },
  },
})
