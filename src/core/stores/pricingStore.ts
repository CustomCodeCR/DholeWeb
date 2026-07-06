import { defineStore } from 'pinia'

export type PricingTab = 'imports' | 'rates' | 'costs'

const STORAGE_KEY = 'dhole.pricing.ui'

interface PricingUiState {
  activeTab: PricingTab
  importSearch: string
  importStatus: string
  importReadyDate: string
  importQuoteDate: string
  importAgent: string
  importPol: string
  importPoe: string
  importPod: string
  importContainerType: string
  importCarrier: string
  rateSearch: string
  rateActive: string
  rateReadyDate: string
  rateQuoteDate: string
  rateAgent: string
  ratePol: string
  ratePoe: string
  ratePod: string
  rateContainerType: string
  rateCarrier: string
  costSearch: string
  uploadProfileCode: string
}

const DEFAULT_STATE: PricingUiState = {
  activeTab: 'imports',
  importSearch: '',
  importStatus: '',
  importReadyDate: '',
  importQuoteDate: '',
  importAgent: '',
  importPol: '',
  importPoe: '',
  importPod: '',
  importContainerType: '',
  importCarrier: '',
  rateSearch: '',
  rateActive: '',
  rateReadyDate: '',
  rateQuoteDate: '',
  rateAgent: '',
  ratePol: '',
  ratePoe: '',
  ratePod: '',
  rateContainerType: '',
  rateCarrier: '',
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
          importReadyDate: this.importReadyDate,
          importQuoteDate: this.importQuoteDate,
          importAgent: this.importAgent,
          importPol: this.importPol,
          importPoe: this.importPoe,
          importPod: this.importPod,
          importContainerType: this.importContainerType,
          importCarrier: this.importCarrier,
          rateSearch: this.rateSearch,
          rateActive: this.rateActive,
          rateReadyDate: this.rateReadyDate,
          rateQuoteDate: this.rateQuoteDate,
          rateAgent: this.rateAgent,
          ratePol: this.ratePol,
          ratePoe: this.ratePoe,
          ratePod: this.ratePod,
          rateContainerType: this.rateContainerType,
          rateCarrier: this.rateCarrier,
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
