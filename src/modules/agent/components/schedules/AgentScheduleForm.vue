<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CalendarClock } from 'lucide-vue-next'
import { DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'

type FriendlyScheduleMode = 'Manual' | 'Once' | 'Interval' | 'Daily' | 'Weekly' | 'Cron'
type IntervalUnit = 'minutes' | 'hours'

interface ProfileScheduleDraft {
  mode: FriendlyScheduleMode
  scheduleType: 'Once' | 'Interval' | 'Cron' | null
  executeAt: string | null
  intervalMinutes: number | null
  cronExpression: string | null
  timezone: string
}

const emit = defineEmits<{
  change: [draft: ProfileScheduleDraft]
}>()

const mode = ref<FriendlyScheduleMode>('Manual')
const onceDate = ref('')
const onceTime = ref('07:00')
const intervalValue = ref('6')
const intervalUnit = ref<IntervalUnit>('hours')
const dailyTime = ref('07:00')
const weeklyTime = ref('07:00')
const advancedCron = ref('0 7 * * *')
const timezone = ref('America/Costa_Rica')

const weekdays = reactive({
  0: false,
  1: true,
  2: false,
  3: false,
  4: false,
  5: false,
  6: false,
})

const modeOptions = [
  { value: 'Manual', label: 'Manual solamente' },
  { value: 'Once', label: 'Una vez' },
  { value: 'Interval', label: 'Cada X minutos/horas' },
  { value: 'Daily', label: 'Diario' },
  { value: 'Weekly', label: 'Semanal' },
  { value: 'Cron', label: 'Cron avanzado' },
]

const intervalUnitOptions = [
  { value: 'minutes', label: 'minutos' },
  { value: 'hours', label: 'horas' },
]

const weekdayOptions = [
  { key: 1, label: 'Lunes' },
  { key: 2, label: 'Martes' },
  { key: 3, label: 'Miércoles' },
  { key: 4, label: 'Jueves' },
  { key: 5, label: 'Viernes' },
  { key: 6, label: 'Sábado' },
  { key: 0, label: 'Domingo' },
] as const

function timeParts(value: string) {
  const [hour = '0', minute = '0'] = value.split(':')
  return {
    hour: Math.min(23, Math.max(0, Number(hour) || 0)),
    minute: Math.min(59, Math.max(0, Number(minute) || 0)),
  }
}

const generatedCron = computed(() => {
  if (mode.value === 'Daily') {
    const { hour, minute } = timeParts(dailyTime.value)
    return `${minute} ${hour} * * *`
  }

  if (mode.value === 'Weekly') {
    const selectedDays = weekdayOptions
      .filter((item) => weekdays[item.key])
      .map((item) => item.key)
      .join(',')

    if (!selectedDays) return ''

    const { hour, minute } = timeParts(weeklyTime.value)
    return `${minute} ${hour} * * ${selectedDays}`
  }

  if (mode.value === 'Cron') return advancedCron.value.trim()
  return ''
})

const intervalMinutes = computed(() => {
  if (mode.value !== 'Interval') return null
  const value = Number(intervalValue.value)
  if (!Number.isInteger(value) || value <= 0) return null
  return intervalUnit.value === 'hours' ? value * 60 : value
})

const draft = computed<ProfileScheduleDraft>(() => {
  if (mode.value === 'Manual') {
    return {
      mode: mode.value,
      scheduleType: null,
      executeAt: null,
      intervalMinutes: null,
      cronExpression: null,
      timezone: timezone.value,
    }
  }

  if (mode.value === 'Once') {
    return {
      mode: mode.value,
      scheduleType: 'Once',
      executeAt: onceDate.value && onceTime.value ? `${onceDate.value}T${onceTime.value}:00` : null,
      intervalMinutes: null,
      cronExpression: null,
      timezone: timezone.value,
    }
  }

  if (mode.value === 'Interval') {
    return {
      mode: mode.value,
      scheduleType: 'Interval',
      executeAt: null,
      intervalMinutes: intervalMinutes.value,
      cronExpression: null,
      timezone: timezone.value,
    }
  }

  return {
    mode: mode.value,
    scheduleType: 'Cron',
    executeAt: null,
    intervalMinutes: null,
    cronExpression: generatedCron.value || null,
    timezone: timezone.value,
  }
})

watch(draft, (value) => emit('change', value), { deep: true, immediate: true })
</script>

<template>
  <section class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <DhSelect v-model="mode" label="Frecuencia" :options="modeOptions" />
      <DhInput v-model="timezone" label="Timezone" />
    </div>

    <div v-if="mode === 'Manual'" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="font-black text-[var(--dh-text)]">Manual solamente</p>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
        No se creará ninguna programación. El perfil se ejecutará únicamente cuando el usuario lo solicite.
      </p>
    </div>

    <div v-else-if="mode === 'Once'" class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="onceDate" type="date" label="Fecha" />
      <DhInput v-model="onceTime" type="time" label="Hora" />
    </div>

    <div v-else-if="mode === 'Interval'" class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="intervalValue" type="number" label="Cada" />
      <DhSelect v-model="intervalUnit" label="Unidad" :options="intervalUnitOptions" />
      <p class="md:col-span-2 text-sm font-semibold text-[var(--dh-text-muted)]">
        IntervalMinutes: {{ intervalMinutes ?? '—' }}
      </p>
    </div>

    <div v-else-if="mode === 'Daily'" class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="dailyTime" type="time" label="Hora" />
      <DhInput :model-value="generatedCron" label="Cron generado" disabled />
    </div>

    <div v-else-if="mode === 'Weekly'" class="grid gap-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DhCheckbox
          v-for="day in weekdayOptions"
          :key="day.key"
          v-model="weekdays[day.key]"
          :label="day.label"
        />
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <DhInput v-model="weeklyTime" type="time" label="Hora" />
        <DhInput :model-value="generatedCron" label="Cron generado" disabled />
      </div>
    </div>

    <div v-else class="grid gap-4">
      <DhInput v-model="advancedCron" label="CronExpression" placeholder="0 7 * * *" />
      <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
        Use cron estándar de cinco campos.
      </p>
    </div>

    <div class="rounded-[22px] border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
      <div class="flex items-start gap-3">
        <CalendarClock class="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Feature blocked by backend contract: DholeAgentService todavía no expone schedules asociados a AgentExtractionProfile. Esta pantalla prepara una configuración válida, pero no simula guardado.
        </p>
      </div>
    </div>

    <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vista previa</p>
      <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt class="font-bold text-[var(--dh-text-muted)]">Tipo</dt><dd class="font-black">{{ draft.scheduleType ?? 'Manual' }}</dd></div>
        <div><dt class="font-bold text-[var(--dh-text-muted)]">Timezone</dt><dd class="font-black">{{ draft.timezone }}</dd></div>
        <div><dt class="font-bold text-[var(--dh-text-muted)]">ExecuteAt</dt><dd class="font-black">{{ draft.executeAt ?? '—' }}</dd></div>
        <div><dt class="font-bold text-[var(--dh-text-muted)]">IntervalMinutes</dt><dd class="font-black">{{ draft.intervalMinutes ?? '—' }}</dd></div>
        <div class="sm:col-span-2"><dt class="font-bold text-[var(--dh-text-muted)]">CronExpression</dt><dd class="font-black">{{ draft.cronExpression ?? '—' }}</dd></div>
      </dl>
    </div>
  </section>
</template>
