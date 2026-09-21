import { computed, ref } from 'vue'

export const AGENT_PROFILE_WIZARD_STEPS = [
  'general',
  'credentials',
  'routes',
  'equipment',
  'captures',
  'fields',
  'hermes',
  'schedule',
  'test',
] as const

export type AgentProfileWizardStep = (typeof AGENT_PROFILE_WIZARD_STEPS)[number]

export function useAgentProfileWizard(initialStep: AgentProfileWizardStep = 'general') {
  const currentStep = ref<AgentProfileWizardStep>(initialStep)
  const visitedSteps = ref<Set<AgentProfileWizardStep>>(new Set([initialStep]))

  const currentIndex = computed(() => AGENT_PROFILE_WIZARD_STEPS.indexOf(currentStep.value))
  const isFirstStep = computed(() => currentIndex.value === 0)
  const isLastStep = computed(() => currentIndex.value === AGENT_PROFILE_WIZARD_STEPS.length - 1)

  function goTo(step: AgentProfileWizardStep) {
    currentStep.value = step
    visitedSteps.value = new Set([...visitedSteps.value, step])
  }

  function next() {
    if (isLastStep.value) return
    goTo(AGENT_PROFILE_WIZARD_STEPS[currentIndex.value + 1]!)
  }

  function previous() {
    if (isFirstStep.value) return
    goTo(AGENT_PROFILE_WIZARD_STEPS[currentIndex.value - 1]!)
  }

  function reset() {
    currentStep.value = initialStep
    visitedSteps.value = new Set([initialStep])
  }

  return {
    steps: AGENT_PROFILE_WIZARD_STEPS,
    currentStep,
    currentIndex,
    visitedSteps,
    isFirstStep,
    isLastStep,
    goTo,
    next,
    previous,
    reset,
  }
}
