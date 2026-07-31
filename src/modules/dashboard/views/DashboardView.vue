<script setup lang="ts">
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  ClipboardList,
  HardDrive,
  KeyRound,
  ListTree,
  Mail,
  MonitorCheck,
  ReceiptText,
  Route,
  ServerCog,
  Shield,
  Users,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DhPageHeader } from '@/shared/components/organisms'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { VIEW_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

function isSuperUser(): boolean {
  return authStore.hasRole('SuperUsuario') || authStore.hasRole('SuperUser') || authStore.hasRole('superusuario')
}

const canUsePricing = computed(
  () =>
    authStore.hasScope(VIEW_SCOPES.pricing) ||
    authStore.hasScope(VIEW_SCOPES.pricingRates) ||
    authStore.hasScope(VIEW_SCOPES.pricingImports) ||
    authStore.hasScope(VIEW_SCOPES.pricingDecisions),
)

const pricingFlow = computed(() =>
  [
    {
      number: 1,
      title: 'Revisar correos y archivos',
      description: 'Confirme qué recibió DataExtraction y atienda errores o resultados por revisar.',
      action: 'Abrir bandeja',
      path: '/pricing/email-imports',
      icon: Mail,
      visible: authStore.hasScope(VIEW_SCOPES.pricingImports),
    },
    {
      number: 2,
      title: 'Completar importaciones',
      description: 'Asigne catálogos, corrija rutas y apruebe los registros completos.',
      action: 'Revisar importaciones',
      path: '/pricing/imports?status=Pending',
      icon: ClipboardCheck,
      visible: authStore.hasScope(VIEW_SCOPES.pricingImports),
    },
    {
      number: 3,
      title: 'Seleccionar alternativa',
      description: 'Compare opciones por ruta y convierta la elegida en una tarifa final.',
      action: 'Ir a decisión',
      path: '/pricing',
      icon: Route,
      visible: authStore.hasScope(VIEW_SCOPES.pricingDecisions) || authStore.hasScope(VIEW_SCOPES.pricingRates),
    },
    {
      number: 4,
      title: 'Consultar tarifas oficiales',
      description: 'Administre las tarifas finales disponibles para cotizar y operar.',
      action: 'Ver tarifas',
      path: '/pricing/rates',
      icon: ReceiptText,
      visible: authStore.hasScope(VIEW_SCOPES.pricingRates),
    },
  ].filter((step) => step.visible),
)

const tools = computed(() =>
  [
    {
      title: t('sidebar.catalogs'),
      value: 'Datos maestros',
      icon: ListTree,
      path: '/config/catalogs',
      description: 'Puertos, navieras, agentes, monedas y equipos.',
      visible: authStore.hasScope(VIEW_SCOPES.catalogs),
    },
    {
      title: t('sidebar.monitoring'),
      value: 'Estado de plataforma',
      icon: ServerCog,
      path: '/monitoring/services',
      description: 'Revise salud y disponibilidad de todos los servicios.',
      visible: authStore.hasScope(VIEW_SCOPES.monitoring) || isSuperUser(),
    },
    {
      title: t('sidebar.storage'),
      value: 'Archivos y adjuntos',
      icon: HardDrive,
      path: '/storage',
      description: 'Consulte correos, PDF, imágenes y archivos importados.',
      visible: authStore.hasScope(VIEW_SCOPES.storage) || isSuperUser(),
    },
    {
      title: t('sidebar.audits'),
      value: 'Trazabilidad',
      icon: ClipboardList,
      path: '/auditlogs/events',
      description: 'Revise acciones, cambios y ejecuciones del sistema.',
      visible: authStore.hasScope(VIEW_SCOPES.auditLogs),
    },
    {
      title: t('sidebar.aiAssistant'),
      value: 'Asistente',
      icon: BrainCircuit,
      path: '/ai/assistant',
      description: 'Consulte el asistente de inteligencia artificial.',
      visible: authStore.hasScope(VIEW_SCOPES.aiAssistant),
    },
    {
      title: t('sidebar.users'),
      value: 'Usuarios',
      icon: Users,
      path: '/auth/users',
      description: 'Administre accesos de usuarios internos y externos.',
      visible: authStore.hasScope(VIEW_SCOPES.users),
    },
    {
      title: t('sidebar.roles'),
      value: 'Roles',
      icon: Shield,
      path: '/auth/roles',
      description: 'Organice permisos por rol.',
      visible: authStore.hasScope(VIEW_SCOPES.roles),
    },
    {
      title: t('sidebar.scopes'),
      value: 'Permisos',
      icon: KeyRound,
      path: '/auth/scopes',
      description: 'Consulte los scopes disponibles.',
      visible: authStore.hasScope(VIEW_SCOPES.scopes),
    },
    {
      title: t('sidebar.sessions'),
      value: 'Sesiones',
      icon: MonitorCheck,
      path: '/auth/sessions',
      description: 'Controle sesiones y dispositivos activos.',
      visible: authStore.hasScope(VIEW_SCOPES.sessions),
    },
  ].filter((card) => card.visible),
)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader title="Centro de trabajo" subtitle="Empiece por la siguiente tarea del flujo operativo y deje la administración para cuando la necesite." :icon="Activity" />

    <section class="dh-glass dh-liquid rounded-[36px] p-6">
      <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
        <div>
          <p class="text-sm font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">Bienvenido</p>
          <h2 class="mt-3 text-3xl font-black tracking-tight text-[var(--dh-text)] md:text-5xl">
            {{ authStore.userDisplayName || t('dashboard.operator') }}
          </h2>
          <p class="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--dh-text-muted)]">
            El flujo principal de Dhole inicia con la recepción del correo, continúa con la revisión de la extracción y termina en una tarifa oficial.
          </p>
        </div>
        <div class="rounded-[28px] border border-[rgb(var(--dh-primary-rgb)/0.22)] bg-[rgb(var(--dh-primary-rgb)/0.07)] p-5">
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Acceso recomendado</p>
          <h3 class="mt-2 text-xl font-black text-[var(--dh-text)]">Bandeja de correos de tarifas</h3>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Revise primero qué correos requieren una acción manual.</p>
          <DhButton v-if="canUsePricing" class="mt-4" label="Comenzar flujo" :icon="ArrowRight" @click="router.push('/pricing/email-imports')" />
        </div>
      </div>
    </section>

    <section v-if="pricingFlow.length" class="space-y-3">
      <div>
        <h2 class="text-xl font-black text-[var(--dh-text)]">Operación diaria de Pricing</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Siga estos pasos en orden. Cada tarjeta abre exactamente la pantalla necesaria.</p>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button
          v-for="step in pricingFlow"
          :key="step.path"
          type="button"
          class="group rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-left transition hover:-translate-y-0.5 hover:border-[rgb(var(--dh-primary-rgb)/0.35)] hover:shadow-lg"
          @click="router.push(step.path)"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--dh-primary)] font-black text-white">{{ step.number }}</span>
            <component :is="step.icon" class="h-6 w-6 text-[var(--dh-primary)]" />
          </div>
          <h3 class="mt-5 text-lg font-black text-[var(--dh-text)]">{{ step.title }}</h3>
          <p class="mt-2 min-h-[60px] text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">{{ step.description }}</p>
          <span class="mt-4 inline-flex items-center gap-2 text-sm font-black text-[var(--dh-primary)]">
            {{ step.action }} <ArrowRight class="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </button>
      </div>
    </section>

    <section v-if="tools.length" class="space-y-3">
      <div>
        <h2 class="text-xl font-black text-[var(--dh-text)]">Herramientas y administración</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Configuración, monitoreo, archivos, auditoría y seguridad.</p>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="card in tools"
          :key="card.path"
          class="dh-glass dh-liquid dh-card-hover rounded-[28px] p-5 text-left"
          @click="router.push(card.path)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ card.title }}</p>
              <h3 class="mt-2 text-xl font-black text-[var(--dh-text)]">{{ card.value }}</h3>
              <p class="mt-2 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">{{ card.description }}</p>
            </div>
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] dh-bg-primary-soft text-[var(--dh-primary)]">
              <component :is="card.icon" class="h-5 w-5" />
            </div>
          </div>
          <DhBadge class="mt-4" label="Abrir módulo" variant="neutral" />
        </button>
      </div>
    </section>
  </section>
</template>
