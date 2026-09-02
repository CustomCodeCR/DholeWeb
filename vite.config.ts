import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { pricingWizardLclCorrections } from './build/pricingWizardLclCorrections'
import { pricingLclSourceVisibilityFix } from './build/pricingLclSourceVisibilityFix'
import { pricingWizardEnhancementsScoped } from './build/pricingWizardEnhancementsScoped'
import { pricingWizardLclRouteContextFix } from './build/pricingWizardLclRouteContextFix'
import { pricingWizardUiParity } from './build/pricingWizardUiParity'

export default defineConfig({
  plugins: [pricingWizardLclCorrections(), pricingLclSourceVisibilityFix(), pricingWizardEnhancementsScoped(), pricingWizardLclRouteContextFix(), pricingWizardUiParity(), vue(), tailwindcss()],

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
