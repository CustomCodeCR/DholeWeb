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
import { pricingSellerScopeAccess } from './build/pricingSellerScopeAccess'

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
    pricingSellerScopeAccess(),
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
