<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Bot, CheckCircle2, Globe2, KeyRound, Play, RefreshCcw, ShieldCheck } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { ScrapingService } from '@/core/services/scrapingService'
import { useToastStore } from '@/core/stores/toastStore'
import type {
  ManualWebScrapingRequest,
  ManualWebScrapingResponse,
  ScrapingCredentialDto,
  ScrapingJobDto,
  ScrapingSourceDto,
  WebScrapingAuthBootstrapResponse,
} from '@/core/interfaces/scraping'

type SelectOption = { label: string; value: string | number }

const { t } = useI18n()
const toastStore = useToastStore()

const loading = ref(false)
const bootstrapLoading = ref(false)
const loadingData = ref(false)
const showAdvanced = ref(false)
const showDiagnostics = ref(false)
const showBootstrapDiagnostics = ref(false)
const showHtml = ref(false)

const sources = ref<ScrapingSourceDto[]>([])
const credentials = ref<ScrapingCredentialDto[]>([])
const jobs = ref<ScrapingJobDto[]>([])

const scrapingSourceId = ref('')
const scrapingCredentialId = ref('')
const scrapingJobId = ref('')
const reuseSession = ref(true)
const forceLogin = ref(false)
const resetSession = ref(false)
const persistResult = ref(true)
const completeJob = ref(false)

const url = ref('')
const waitForSelector = ref('')
const loginStepsJson = ref('')
const navigationStepsJson = ref('')
const extractionRulesJson = ref('')
const timeoutSeconds = ref('180')
const bootstrapTimeoutSeconds = ref('300')
const captureHtml = ref(true)
const captureScreenshot = ref(true)
const result = ref<ManualWebScrapingResponse | null>(null)
const bootstrapResult = ref<WebScrapingAuthBootstrapResponse | null>(null)
const dynamicReadyDate = computed(() => nextReadyDate())

const sourceOptions = computed<SelectOption[]>(() => sources.value.map((source) => ({
  value: source.id,
  label: `${source.name} (${source.code})`,
})))

const credentialOptions = computed<SelectOption[]>(() => credentials.value
  .filter((credential) => !scrapingSourceId.value || credential.scrapingSourceId === scrapingSourceId.value)
  .map((credential) => ({
    value: credential.id,
    label: `${credential.username || t('scraping.noUsername')} · ${credential.authenticationModeName}`,
  })))

const jobOptions = computed<SelectOption[]>(() => jobs.value
  .filter((job) => !scrapingSourceId.value || job.scrapingSourceId === scrapingSourceId.value)
  .map((job) => ({
    value: job.id,
    label: `${job.carrierName || job.scrapingSourceName || 'Job'} · ${job.portOfLoadingName || '?'} → ${job.portOfDischargeName || '?'} · ${t('scraping.readyDateDynamicShort')}: ${dynamicReadyDate.value}`,
  })))

const selectedSource = computed(() => sources.value.find((source) => source.id === scrapingSourceId.value) ?? null)
const selectedCredential = computed(() => credentials.value.find((credential) => credential.id === scrapingCredentialId.value) ?? null)
const selectedJob = computed(() => jobs.value.find((job) => job.id === scrapingJobId.value) ?? null)

const isMaerskSource = computed(() => {
  const source = selectedSource.value
  if (!source) return false

  return [source.code, source.name, source.baseUrl, source.carrierCode, source.carrierName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes('maersk'))
})

const sourceRequiresLogin = computed(() => Boolean(selectedSource.value?.requiresLogin || isMaerskSource.value))
const canBootstrap = computed(() => Boolean((scrapingSourceId.value || executionUrl.value) && !bootstrapLoading.value))
const canRun = computed(() => Boolean(scrapingJobId.value || url.value.trim().startsWith('http')))
const success = computed(() => result.value?.success !== false && !result.value?.errorMessage)
const bootstrapSuccess = computed(() => bootstrapResult.value?.success === true)
const executionUrl = computed(() => {
  const manualUrl = url.value.trim()
  if (manualUrl) return manualUrl
  if (selectedSource.value?.baseUrl) return selectedSource.value.baseUrl
  return isMaerskSource.value ? 'https://www.maersk.com/book/' : null
})

const storageStateKey = computed(() => {
  const credentialPart = scrapingCredentialId.value || selectedCredential.value?.id || 'anonymous'

  if (scrapingSourceId.value) {
    return `sources/${scrapingSourceId.value}/credentials/${credentialPart}`
  }

  const target = executionUrl.value
  if (!target) return null

  try {
    const parsed = new URL(target)
    return `manual/${parsed.hostname}/${credentialPart}`
  } catch {
    return `manual/custom/${credentialPart}`
  }
})

watch(scrapingSourceId, () => {
  bootstrapResult.value = null

  if (!credentialOptions.value.some((option) => option.value === scrapingCredentialId.value)) {
    scrapingCredentialId.value = ''
  }

  if (!jobOptions.value.some((option) => option.value === scrapingJobId.value)) {
    scrapingJobId.value = ''
  }
})

watch(scrapingCredentialId, () => {
  bootstrapResult.value = null
})

watch(scrapingJobId, (jobId) => {
  const job = jobs.value.find((item) => item.id === jobId)
  if (!job) return
  if (job.scrapingSourceId) scrapingSourceId.value = job.scrapingSourceId
})

function nextReadyDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildRequest(overrides: Partial<ManualWebScrapingRequest> = {}): ManualWebScrapingRequest {
  return {
    url: executionUrl.value,
    scrapingSourceId: scrapingSourceId.value || null,
    scrapingCredentialId: scrapingCredentialId.value || null,
    scrapingJobId: scrapingJobId.value || null,
    waitForSelector: waitForSelector.value.trim() || null,
    timeoutSeconds: Number(timeoutSeconds.value) || 180,
    userAgent: null,
    headers: null,
    waitAfterLoadMilliseconds: 1000,
    captureScreenshot: captureScreenshot.value,
    captureHtml: captureHtml.value,
    viewportWidth: 1440,
    viewportHeight: 900,
    reuseSession: reuseSession.value,
    forceLogin: forceLogin.value,
    resetSession: resetSession.value,
    storageStateKey: storageStateKey.value,
    persistResult: persistResult.value,
    completeJob: completeJob.value,
    loginStepsJson: loginStepsJson.value.trim() || null,
    navigationStepsJson: navigationStepsJson.value.trim() || null,
    extractionRulesJson: extractionRulesJson.value.trim() || null,
    inputValues: { readyDate: nextReadyDate(), effectiveReadyDate: nextReadyDate() },
    ...overrides,
  }
}

async function loadData() {
  try {
    loadingData.value = true
    const [sourcesResult, credentialsResult, jobsResult] = await Promise.all([
      ScrapingService.browseSources({ pageNumber: 1, pageSize: 100 }),
      ScrapingService.browseCredentials({ pageNumber: 1, pageSize: 100 }),
      ScrapingService.browseJobs({ pageNumber: 1, pageSize: 100 }),
    ])

    sources.value = sourcesResult.items
    credentials.value = credentialsResult.items
    jobs.value = jobsResult.items
  } catch (error) {
    toastStore.backendError(error, t('scraping.loadError'))
  } finally {
    loadingData.value = false
  }
}

async function bootstrapAuthentication() {
  if (!canBootstrap.value) {
    toastStore.error(t('common.error'), t('scraping.authBootstrapNeedsTarget'))
    return
  }

  try {
    bootstrapLoading.value = true
    bootstrapResult.value = await ScrapingService.bootstrapAuthentication(buildRequest({
      scrapingJobId: null,
      timeoutSeconds: Number(bootstrapTimeoutSeconds.value) || 300,
      captureHtml: false,
      captureScreenshot: false,
      persistResult: false,
      completeJob: false,
      reuseSession: true,
      storageStateKey: storageStateKey.value,
      forceLogin: true,
      resetSession: true,
      loginStepsJson: null,
      navigationStepsJson: null,
      extractionRulesJson: null,
    }))

    if (!bootstrapResult.value.success) {
      toastStore.error(
        t('scraping.authBootstrapFailed'),
        bootstrapResult.value.errorMessage || t('scraping.authBootstrapFailedHint'),
      )
      return
    }

    reuseSession.value = true
    forceLogin.value = false
    resetSession.value = false
    toastStore.success(t('scraping.authBootstrapSuccess'), t('scraping.authBootstrapSuccessHint'))
  } catch (error) {
    toastStore.backendError(error, t('scraping.authBootstrapError'))
  } finally {
    bootstrapLoading.value = false
  }
}

async function execute() {
  if (!canRun.value) {
    toastStore.error(t('common.error'), t('scraping.manualNeedsJobOrUrl'))
    return
  }

  try {
    loading.value = true
    result.value = await ScrapingService.executeManual(buildRequest())

    if (result.value.success === false || result.value.errorMessage) {
      toastStore.error(t('common.error'), result.value.errorMessage || result.value.message || t('scraping.manualError'))
      return
    }

    toastStore.success(t('scraping.manualSuccess'))
  } catch (error) {
    toastStore.backendError(error, t('scraping.manualError'))
  } finally {
    loading.value = false
  }
}

function clearResult() {
  result.value = null
}

onMounted(loadData)
</script>

<template>
  <section class="space-y-5">
    <DhPageHeader :title="t('scraping.manualTitle')" :subtitle="t('scraping.manualSubtitle')" :icon="Bot">
      <template #actions>
        <DhButton :icon="RefreshCcw" :label="t('common.refresh')" variant="secondary" :loading="loadingData" @click="loadData" />
        <DhButton v-if="result" :label="t('common.clear')" variant="secondary" @click="clearResult" />
        <DhButton :icon="Play" :label="t('scraping.execute')" :disabled="!canRun || loading" :loading="loading" @click="execute" />
      </template>
    </DhPageHeader>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section class="space-y-4">
        <div class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('scraping.realExecution') }}</h2>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.realExecutionHint') }}</p>
            </div>
            <DhBadge :label="persistResult ? t('scraping.persistResult') : t('scraping.previewOnly')" :variant="persistResult ? 'success' : 'neutral'" />
          </div>

          <div class="grid gap-3">
            <DhSelect v-model="scrapingJobId" :label="t('scraping.job')" :placeholder="t('scraping.selectJob')" :options="jobOptions" />

            <div v-if="selectedJob" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-xs font-semibold text-[var(--dh-text-muted)]">
              <p class="font-black text-[var(--dh-text)]">{{ selectedJob.carrierName || selectedJob.scrapingSourceName }}</p>
              <p class="mt-1">{{ selectedJob.portOfLoadingName }} → {{ selectedJob.portOfDischargeName }} · {{ selectedJob.containerTypeName }} · {{ t('scraping.readyDateDynamicShort') }}: {{ dynamicReadyDate }}</p>
              <p v-if="selectedJob.scheduledAtUtc" class="mt-1">{{ t('scraping.scheduledAt') }}: {{ selectedJob.scheduledAtUtc }}</p>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <DhSelect v-model="scrapingSourceId" :label="t('scraping.source')" :placeholder="t('scraping.selectSource')" :options="sourceOptions" />
              <DhSelect v-model="scrapingCredentialId" :label="t('scraping.credential')" :placeholder="t('scraping.autoCredential')" :options="credentialOptions" />
            </div>
          </div>
        </div>

        <div class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="rounded-2xl bg-[var(--dh-primary-soft)] p-3 text-[var(--dh-primary)]">
                <KeyRound class="h-5 w-5" />
              </div>
              <div>
                <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('scraping.authBootstrapTitle') }}</h2>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.authBootstrapHint') }}</p>
              </div>
            </div>
            <DhBadge
              :label="bootstrapSuccess ? t('scraping.sessionReady') : t('scraping.sessionNotReady')"
              :variant="bootstrapSuccess ? 'success' : 'warning'"
            />
          </div>

          <div class="space-y-4">
            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <div class="flex gap-3">
                <ShieldCheck class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
                <div>
                  <p class="text-sm font-black text-[var(--dh-text)]">{{ t('scraping.authBootstrapStepTitle') }}</p>
                  <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">{{ t('scraping.authBootstrapStepHint') }}</p>
                </div>
              </div>
            </div>

            <div v-if="sourceRequiresLogin && !bootstrapSuccess" class="rounded-[22px] border border-amber-500/25 bg-amber-500/10 p-4">
              <div class="flex gap-3">
                <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <p class="text-xs font-semibold leading-5 text-[var(--dh-text)]">{{ t('scraping.authBootstrapWarning') }}</p>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
              <DhInput v-model="bootstrapTimeoutSeconds" :label="t('scraping.authBootstrapTimeout')" type="number" />
              <DhButton
                class="self-end"
                :icon="KeyRound"
                :label="t('scraping.authBootstrapAction')"
                :disabled="!canBootstrap"
                :loading="bootstrapLoading"
                @click="bootstrapAuthentication"
              />
            </div>

            <div v-if="bootstrapResult" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">{{ t('scraping.authBootstrapResult') }}</p>
                  <p class="mt-1 break-all text-sm font-black text-[var(--dh-text)]">{{ bootstrapResult.finalUrl || bootstrapResult.initialUrl }}</p>
                  <p v-if="storageStateKey" class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.storageStateKey') }}: {{ storageStateKey }}</p>
                  <p v-if="bootstrapResult.storageStatePath" class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.storageState') }}: {{ bootstrapResult.storageStatePath }}</p>
                  <p v-if="bootstrapResult.persistentProfilePath" class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.profilePath') }}: {{ bootstrapResult.persistentProfilePath }}</p>
                </div>
                <DhBadge :label="bootstrapSuccess ? t('common.success') : t('common.failed')" :variant="bootstrapSuccess ? 'success' : 'danger'" />
              </div>
              <p v-if="bootstrapResult.errorMessage" class="mt-3 text-sm font-semibold text-red-400">{{ bootstrapResult.errorMessage }}</p>
              <DhButton
                v-if="bootstrapResult.diagnostics?.length"
                class="mt-3"
                :label="showBootstrapDiagnostics ? t('scraping.hideDiagnostics') : t('scraping.showDiagnostics')"
                variant="secondary"
                size="sm"
                @click="showBootstrapDiagnostics = !showBootstrapDiagnostics"
              />
              <DhTextarea
                v-if="showBootstrapDiagnostics && bootstrapResult.diagnostics?.length"
                class="mt-3"
                :model-value="bootstrapResult.diagnostics.join('\n')"
                :label="t('scraping.diagnostics')"
                readonly
                :rows="7"
              />
            </div>
          </div>
        </div>

        <div class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4">
            <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('scraping.runOptions') }}</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.runOptionsHint') }}</p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <DhSwitch v-model="reuseSession" :label="t('scraping.reuseSession')" />
            <DhSwitch v-model="forceLogin" :label="t('scraping.forceLogin')" />
            <DhSwitch v-model="resetSession" :label="t('scraping.resetSession')" />
            <DhSwitch v-model="persistResult" :label="t('scraping.persistResult')" />
          </div>

          <DhButton
            class="mt-4"
            :label="showAdvanced ? t('scraping.hideAdvanced') : t('scraping.showAdvanced')"
            variant="secondary"
            @click="showAdvanced = !showAdvanced"
          />
        </div>

        <div v-if="showAdvanced" class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4">
            <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('scraping.advancedManualOptions') }}</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.advancedManualOptionsHint') }}</p>
          </div>

          <div class="space-y-4">
            <DhInput v-model="url" :label="t('scraping.url')" placeholder="https://www.maersk.com/book/" />
            <div class="grid gap-3 md:grid-cols-2">
              <DhInput v-model="waitForSelector" :label="t('scraping.waitForSelector')" placeholder="#mc-input-origin" />
              <DhInput v-model="timeoutSeconds" :label="t('scraping.timeoutSeconds')" type="number" />
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <DhSwitch v-model="completeJob" :label="t('scraping.completeJobAfterManual')" />
              <DhSwitch v-model="captureScreenshot" :label="t('scraping.captureScreenshot')" />
              <DhSwitch v-model="captureHtml" :label="t('scraping.captureHtml')" />
            </div>

            <DhTextarea v-model="loginStepsJson" :label="t('scraping.loginStepsOverride')" :rows="4" />
            <DhTextarea v-model="navigationStepsJson" :label="t('scraping.navigationStepsOverride')" :rows="4" />
            <DhTextarea v-model="extractionRulesJson" :label="t('scraping.extractionRulesOverride')" :rows="4" />

            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <div class="flex items-center gap-3">
                <Globe2 class="h-5 w-5 text-[var(--dh-primary)]" />
                <div>
                  <p class="text-sm font-black text-[var(--dh-text)]">{{ t('scraping.manualNoteTitle') }}</p>
                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.manualNote') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="dh-glass dh-liquid rounded-[28px] p-5">
        <div v-if="!result" class="flex min-h-[22rem] items-center justify-center text-center">
          <div>
            <Bot class="mx-auto h-10 w-10 text-[var(--dh-primary)]" />
            <h2 class="mt-3 text-xl font-black text-[var(--dh-text)]">{{ t('scraping.noManualResult') }}</h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.noManualResultHint') }}</p>
            <div v-if="bootstrapSuccess" class="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-400">
              <CheckCircle2 class="h-4 w-4" />
              {{ t('scraping.sessionReady') }}
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">{{ t('scraping.result') }}</p>
              <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">{{ result.title || result.finalUrl || result.url || 'Resultado' }}</h2>
              <p class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ result.finalUrl || result.url }}</p>
            </div>
            <DhBadge :label="success ? t('common.success') : t('common.failed')" :variant="success ? 'success' : 'danger'" />
          </div>

          <div v-if="result.errorMessage" class="rounded-[22px] border border-red-500/25 bg-red-500/10 p-4">
            <p class="text-xs font-black uppercase tracking-[0.16em] text-red-400">{{ t('common.error') }}</p>
            <p class="mt-2 text-sm font-semibold text-[var(--dh-text)]">{{ result.errorMessage }}</p>
          </div>

          <div class="grid gap-3 md:grid-cols-4">
            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('scraping.statusCode') }}</p>
              <p class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ result.statusCode ?? '—' }}</p>
            </div>
            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('scraping.elapsed') }}</p>
              <p class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ Math.round(result.durationMilliseconds ?? result.elapsedMilliseconds ?? 0) }} ms</p>
            </div>
            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('scraping.evidences') }}</p>
              <p class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ result.evidenceCount ?? 0 }}</p>
            </div>
            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('scraping.extractedRates') }}</p>
              <p class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ result.extractedRateCount ?? 0 }}</p>
            </div>
          </div>

          <div v-if="result.scrapingRunId || result.scrapedRateCandidateId" class="grid gap-3 md:grid-cols-2">
            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-xs font-black text-[var(--dh-text-muted)]">Run ID</p>
              <p class="mt-1 break-all text-sm font-black text-[var(--dh-text)]">{{ result.scrapingRunId || '—' }}</p>
            </div>
            <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-xs font-black text-[var(--dh-text-muted)]">Rate Candidate ID</p>
              <p class="mt-1 break-all text-sm font-black text-[var(--dh-text)]">{{ result.scrapedRateCandidateId || '—' }}</p>
            </div>
          </div>

          <DhTextarea :model-value="JSON.stringify(result.extractedValues || {}, null, 2)" :label="t('scraping.extractedValues')" readonly :rows="6" />

          <div class="flex flex-wrap gap-2">
            <DhButton
              v-if="result.diagnostics?.length"
              :label="showDiagnostics ? t('scraping.hideDiagnostics') : t('scraping.showDiagnostics')"
              variant="secondary"
              @click="showDiagnostics = !showDiagnostics"
            />
            <DhButton
              v-if="result.html"
              :label="showHtml ? t('scraping.hideHtml') : t('scraping.showHtml')"
              variant="secondary"
              @click="showHtml = !showHtml"
            />
          </div>

          <DhTextarea v-if="showDiagnostics && result.diagnostics?.length" :model-value="(result.diagnostics || []).join('\n')" :label="t('scraping.diagnostics')" readonly :rows="8" />
          <DhTextarea v-if="showHtml && result.html" :model-value="result.html" label="HTML" readonly :rows="8" />
        </div>
      </section>
    </div>
  </section>
</template>
