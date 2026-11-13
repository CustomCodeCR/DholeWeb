<script setup lang="ts">
import { computed } from 'vue'
import { FileClock, ShieldCheck } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhModal } from '@/shared/components/organisms'
import {
  activeCrmDraftRecovery,
  decideCrmDraftRecovery,
  type CrmDraftRecoveryChoice,
} from '../utils/crmDraftRecoveryDialog'

const savedAt = computed(() => activeCrmDraftRecovery.value
  ? new Date(activeCrmDraftRecovery.value.savedAt).toLocaleString('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  : '')

function choose(choice: CrmDraftRecoveryChoice) {
  decideCrmDraftRecovery(choice)
}
</script>

<template>
  <DhModal
    :open="Boolean(activeCrmDraftRecovery)"
    priority
    title="Recuperar borrador de CRM"
    size="md"
    @close="choose('later')"
  >
    <div class="space-y-4 text-[var(--dh-text)]" data-crm-draft-recovery>
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]">
          <FileClock class="h-5 w-5" aria-hidden="true" />
        </div>
        <div class="min-w-0 space-y-1">
          <p class="text-sm font-semibold">Encontramos cambios sin guardar</p>
          <p class="text-sm leading-relaxed text-[var(--dh-text-muted)]">
            Este formulario tiene un borrador guardado automáticamente en este navegador.
            Podés recuperar lo que estabas escribiendo.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-xs text-[var(--dh-text-muted)]">
        <ShieldCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Último autoguardado: <strong class="text-[var(--dh-text)]">{{ savedAt }}</strong></span>
      </div>
      <p class="text-xs leading-relaxed text-[var(--dh-text-muted)]">
        «Más tarde» conserva el borrador. «Descartar» lo elimina únicamente de este navegador.
      </p>
    </div>
    <template #footer>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <DhButton label="Más tarde" variant="ghost" @click="choose('later')" />
        <DhButton label="Descartar" variant="secondary" @click="choose('discard')" />
        <DhButton label="Recuperar borrador" @click="choose('restore')" />
      </div>
    </template>
  </DhModal>
</template>
