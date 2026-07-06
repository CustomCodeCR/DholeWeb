import { defineStore } from 'pinia'

export type PricingTab = 'imports' | 'rates' | 'costs'

const STORAGE_KEY = 'dhole.pricing.ui'

interface PricingUiState {
  activeTab: PricingTab
  importSearch: string
  importStatus: string
  rateSearch: string
  rateActive: string
  costSearch: string
  uploadProfileCode: string
}

const DEFAULT_STATE: PricingUiState = {
  activeTab: 'imports',
  importSearch: '',
  importStatus: '',
  rateSearch: '',
  rateActive: '',
  costSearch: '',
  uploadProfileCode: '',
}

function normalizeState(state: PricingUiState): PricingUiState {
  if (!['imports', 'rates', 'costs'].includes(state.activeTab)) {
    state.activeTab = 'imports'
  }

  return state
}

function loadState(): PricingUiState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULT_STATE }

  try {
    return normalizeState({ ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<PricingUiState>) })
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export const usePricingStore = defineStore('pricingUi', {
  state: (): PricingUiState => loadState(),

  actions: {
    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeTab: this.activeTab,
          importSearch: this.importSearch,
          importStatus: this.importStatus,
          rateSearch: this.rateSearch,
          rateActive: this.rateActive,
          costSearch: this.costSearch,
          uploadProfileCode: this.uploadProfileCode,
        }),
      )
    },

    setActiveTab(tab: PricingTab) {
      this.activeTab = tab
      this.persist()
    },
  },
})
