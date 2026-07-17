import { defineStore } from 'pinia';
const STORAGE_KEY = 'dhole.pricing.workspace.state';
const defaultState = () => ({
    activeTab: 'overview',
    selectedImportId: null,
    selectedRateId: null,
    costFilters: { search: '' },
    importFilters: { search: '', status: '' },
    rateFilters: { search: '', isActive: '' },
    costForm: {
        carrier: '',
        port: '',
        currency: '',
        name: '',
        amount: '',
        isFixed: true,
    },
    uploadForm: { profileCode: '' },
    rateForm: {
        clientName: '',
        carrier: '',
        originPort: '',
        destinationPort: '',
        containerType: '',
        currency: '',
        amount: '',
        saleAmount: '',
        validFrom: '',
        validTo: '',
        freeDays: '',
        notes: '',
    },
    importRateForm: {
        clientName: '',
        carrier: '',
        originPort: '',
        destinationPort: '',
        containerType: '',
        currency: '',
        validFrom: '',
        validTo: '',
        notes: '',
    },
    rateCostForm: {
        costId: '',
        name: '',
        costType: 'Other',
        currency: '',
        amount: '',
        isFixed: false,
        notes: '',
    },
    inlineCostForm: {
        carrier: '',
        port: '',
        currency: '',
        name: '',
        amount: '',
        costType: 'Other',
        isFixed: false,
        notes: '',
    },
});
function mergeState(value) {
    const fallback = defaultState();
    if (!value || typeof value !== 'object') {
        return fallback;
    }
    return {
        ...fallback,
        ...value,
        costFilters: { ...fallback.costFilters, ...(value.costFilters ?? {}) },
        importFilters: { ...fallback.importFilters, ...(value.importFilters ?? {}) },
        rateFilters: { ...fallback.rateFilters, ...(value.rateFilters ?? {}) },
        costForm: { ...fallback.costForm, ...(value.costForm ?? {}) },
        uploadForm: { ...fallback.uploadForm, ...(value.uploadForm ?? {}) },
        rateForm: { ...fallback.rateForm, ...(value.rateForm ?? {}) },
        importRateForm: { ...fallback.importRateForm, ...(value.importRateForm ?? {}) },
        rateCostForm: { ...fallback.rateCostForm, ...(value.rateCostForm ?? {}) },
        inlineCostForm: { ...fallback.inlineCostForm, ...(value.inlineCostForm ?? {}) },
    };
}
function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return defaultState();
    }
    try {
        return mergeState(JSON.parse(raw));
    }
    catch {
        return defaultState();
    }
}
export const usePricingWorkspaceStore = defineStore('pricingWorkspace', {
    state: () => loadState(),
    actions: {
        persist() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
        },
        setActiveTab(tab) {
            this.activeTab = tab;
            this.persist();
        },
        selectImport(id) {
            this.selectedImportId = id;
            this.persist();
        },
        selectRate(id) {
            this.selectedRateId = id;
            this.persist();
        },
        resetUpload() {
            this.uploadForm.profileCode = '';
            this.persist();
        },
        resetInlineCostForm() {
            this.inlineCostForm.name = '';
            this.inlineCostForm.amount = '';
            this.inlineCostForm.notes = '';
            this.inlineCostForm.isFixed = false;
            this.inlineCostForm.costType = 'Other';
            this.persist();
        },
        resetRateCostForm() {
            this.rateCostForm.costId = '';
            this.rateCostForm.name = '';
            this.rateCostForm.amount = '';
            this.rateCostForm.notes = '';
            this.rateCostForm.isFixed = false;
            this.rateCostForm.costType = 'Other';
            this.persist();
        },
        clear() {
            this.$patch(defaultState());
            this.persist();
        },
    },
});
