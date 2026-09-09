import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { pricingWizardLclCorrections } from './build/pricingWizardLclCorrections'
import { pricingLclSourceVisibilityFix } from './build/pricingLclSourceVisibilityFix'
import { pricingLclCostBreakdownUi } from './build/pricingLclCostBreakdownUi'
import { pricingWizardFixedAutomaticCostEditFix } from './build/pricingWizardFixedAutomaticCostEditFix'
import { pricingWizardEnhancementsScoped } from './build/pricingWizardEnhancementsScoped'
import { pricingWizardOwnLclLinePersistence } from './build/pricingWizardOwnLclLinePersistence'
import { pricingWizardLclRouteContextFix } from './build/pricingWizardLclRouteContextFix'
import { pricingWizardUiParity } from './build/pricingWizardUiParity'
import { pricingWizardLclFclParityFix } from './build/pricingWizardLclFclParityFix'
import { pricingWizardSep02Requirements } from './build/pricingWizardSep02Requirements'
import { pricingWizardLclOptionalWeight } from './build/pricingWizardLclOptionalWeight'
import { pricingWizardLclFinalGuard } from './build/pricingWizardLclFinalGuard'
import { pricingWizardScreen09LclFix } from './build/pricingWizardScreen09LclFix'
import { pricingSellerRateRequests } from './build/pricingSellerRateRequests'
import { pricingSellerDelegatedRequests } from './build/pricingSellerDelegatedRequests'
import { pricingSellerVisibilityProduction } from './build/pricingSellerVisibilityProduction'
import { pricingSellerRateRequestResponsibilities } from './build/pricingSellerRateRequestResponsibilities'
import { pricingWizardStep5RateFilter } from './build/pricingWizardStep5RateFilter'
import { pricingSellerOwnershipUi } from './build/pricingSellerOwnershipUi'
import { pricingSellerScopeAccess } from './build/pricingSellerScopeAccess'
import { pricingCommercialAutomation20260906Fixed } from './build/pricingCommercialAutomation20260906Fixed'
import { pricingRateRequestPoePodFix } from './build/pricingRateRequestPoePodFix'
import { pricingWizardStep3VisualRefresh } from './build/pricingWizardStep3VisualRefresh'
import { pricingWizardFclSplitSelector } from './build/pricingWizardFclSplitSelector'
import { pricingWizardFclDistributionOnly } from './build/pricingWizardFclDistributionOnly'
import { pricingSellerPodIntegrity } from './build/pricingSellerPodIntegrity'
import { pricingWizardFclRateBundles } from './build/pricingWizardFclRateBundles'
import {
  pricingWizardFclRateBundlesPreCompat,
  pricingWizardFclRateBundlesPostCompat,
} from './build/pricingWizardFclRateBundlesCompat'
import { pricingWizardDraftAutosave } from './build/pricingWizardDraftAutosave'
import { pricingWizardDraftEquipmentRestoreFix } from './build/pricingWizardDraftEquipmentRestoreFix'
import { pricingRequirements20260908PreCompat } from './build/pricingRequirements20260908PreCompat'
import { pricingRequirements20260908 } from './build/pricingRequirements20260908'
import { pricingCargoHaulageKeywordFix } from './build/pricingCargoHaulageKeywordFix'
import { pricingCostMultiPortSelection } from './build/pricingCostMultiPortSelection'
import { pricingWizardMixedCarrierExpiry } from './build/pricingWizardMixedCarrierExpiry'
import { pricingWizardFclExpiryChip } from './build/pricingWizardFclExpiryChip'
import { pricingWizardMaritimePanamaFix } from './build/pricingWizardMaritimePanamaFix'
import { pricingWizardRouteTerminalTypes } from './build/pricingWizardRouteTerminalTypes'
import { pricingWizardLandPolish } from './build/pricingWizardLandPolish'
import { pricingWizardShipmentStyleParity } from './build/pricingWizardShipmentStyleParity'
import { pricingWizardLandScreen4Cleanup } from './build/pricingWizardLandScreen4Cleanup'
import { pricingFtlTariffMaster } from './build/pricingFtlTariffMaster'

export default defineConfig({
  plugins: [
    pricingWizardLclOptionalWeight(),
    pricingWizardSep02Requirements(),
    pricingWizardLclCorrections(),
    pricingLclSourceVisibilityFix(),
    pricingLclCostBreakdownUi(),
    pricingWizardFixedAutomaticCostEditFix(),
    pricingWizardEnhancementsScoped(),
    pricingWizardOwnLclLinePersistence(),
    pricingWizardLclRouteContextFix(),
    pricingWizardUiParity(),
    pricingWizardLclFclParityFix(),
    pricingWizardLclFinalGuard(),
    pricingWizardScreen09LclFix(),
    pricingSellerRateRequests(),
    pricingSellerDelegatedRequests(),
    pricingSellerRateRequestResponsibilities(),
    pricingWizardStep5RateFilter(),
    pricingSellerOwnershipUi(),
    pricingSellerScopeAccess(),
    pricingCommercialAutomation20260906Fixed(),
    pricingRateRequestPoePodFix(),
    pricingWizardStep3VisualRefresh(),
    pricingWizardFclSplitSelector(),
    pricingWizardFclDistributionOnly(),
    pricingSellerPodIntegrity(),
    pricingWizardFclRateBundlesPreCompat(),
    pricingWizardFclRateBundles(),
    pricingWizardFclRateBundlesPostCompat(),
    pricingWizardDraftAutosave(),
    pricingWizardDraftEquipmentRestoreFix(),
    pricingRequirements20260908PreCompat(),
    pricingRequirements20260908(),
    pricingCargoHaulageKeywordFix(),
    pricingCostMultiPortSelection(),
    pricingWizardMixedCarrierExpiry(),
    pricingWizardFclExpiryChip(),
    pricingWizardMaritimePanamaFix(),
    pricingWizardRouteTerminalTypes(),
    pricingWizardLandPolish(),
    pricingWizardShipmentStyleParity(),
    pricingWizardLandScreen4Cleanup(),
    pricingFtlTariffMaster(),
    pricingSellerVisibilityProduction(),
    vue(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },

  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
