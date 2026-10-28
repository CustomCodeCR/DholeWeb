<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { DhButton } from '@/shared/components/atoms'
import { useToastStore } from '@/core/stores/toastStore'

type GuideContext = 'request' | 'dashboard' | 'detail'
interface TourStep {
  element?: string
  popover: { title: string; description: string; side?: 'top' | 'bottom' | 'left' | 'right' }
}
interface TourDriver { drive(): void; destroy(): void }
type DriverFactory = (config: Record<string, unknown>) => TourDriver

const props = withDefaults(defineProps<{
  context: GuideContext
  step?: number
  modification?: boolean
}>(), { step: 1, modification: false })
const toast = useToastStore()
const loading = ref(false)
let currentTour: TourDriver | null = null
let libraryPromise: Promise<DriverFactory> | null = null

// Use a fixed, documented Driver.js distribution. No account data is sent to
// the library: only local CSS selectors and authored Spanish tour text.
function loadDriver(): Promise<DriverFactory> {
  const loaded = (window as Window & {
    driver?: { js?: { driver?: DriverFactory } }
  }).driver?.js?.driver
  if (loaded) return Promise.resolve(loaded)
  if (libraryPromise) return libraryPromise

  libraryPromise = new Promise<DriverFactory>((resolve, reject) => {
    if (!document.querySelector('link[data-dhole-driver-css]')) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/driver.js@1.10.2/dist/driver.css'
      css.dataset.dholeDriverCss = 'true'
      document.head.appendChild(css)
    }
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-dhole-driver-script]')
    const script = existingScript ?? document.createElement('script')
    const finish = () => {
      const factory = (window as Window & {
        driver?: { js?: { driver?: DriverFactory } }
      }).driver?.js?.driver
      if (!factory) {
        reject(new Error('No se pudo inicializar Driver.js.'))
        return
      }
      resolve(factory)
    }
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => {
      script.remove()
      reject(new Error('No se pudo cargar Driver.js.'))
    }, { once: true })
    if (!existingScript) {
      script.src = 'https://unpkg.com/driver.js@1.10.2/dist/driver.js.iife.js'
      script.async = true
      script.dataset.dholeDriverScript = 'true'
      document.head.appendChild(script)
    }
  }).catch((error: unknown) => {
    libraryPromise = null
    throw error
  })
  return libraryPromise
}

function tourStep(element: string | null, title: string, description: string): TourStep {
  const result: TourStep = { popover: { title, description } }
  if (element && document.querySelector(element)) result.element = element
  return result
}

function buildSteps(): TourStep[] {
  if (props.context === 'dashboard') {
    return [
      tourStep('[data-seller-guide="overview"]',
        'Tu espacio de ventas',
        'Aquí ves las solicitudes y cotizaciones asignadas a tu usuario. Los permisos dependen de tu rol; una vista administrativa es solo de consulta.'),
      tourStep('[data-seller-guide="status"]',
        'Estados de tus cotizaciones',
        'Consulta las tarifas en preparación, enviadas, aceptadas o rechazadas. Selecciona un estado para filtrar.'),
      tourStep('[data-seller-guide="requests"]',
        'Solicitudes a Pricing',
        'Aquí puedes seguir tus solicitudes, consultar sus estados y abrir una solicitud ya registrada.'),
      tourStep('[data-seller-guide="rates"]',
        'Mis tarifas y seguimiento',
        'Abre la tarifa para ver el detalle, marcarla recibida, registrar la aceptación o rechazo del cliente o solicitar una modificación cuando corresponda.'),
      tourStep(null, 'Crear una solicitud nueva',
        'Desde el menú Solicitar tarifa completa modalidad, ruta, equipo y carga. Después de enviar, Pricing continúa el proceso.'),
    ]
  }

  if (props.context === 'detail') {
    return [
      tourStep('[data-seller-guide="detail-summary"]',
        'Cotización enviada',
        'Revisa la QUO, la revisión y el estado. Esta pantalla muestra los datos comerciales de tu cotización.'),
      tourStep('[data-seller-guide="detail-navigation"]',
        'Pantallas de detalle',
        'Selecciona una pantalla para consultar la ruta, la carga y las condiciones sin alterar costos internos.'),
      tourStep('[data-seller-guide="detail-modify"]',
        'Solicitar una modificación',
        'Si tu rol y el estado lo permiten, solicita un cambio a Pricing. La cotización actual se conserva hasta que se prepare y envíe otra revisión.'),
      tourStep('[data-seller-guide="detail-decision"]',
        'Recepción y respuesta del cliente',
        'Marcar recibida no equivale a aceptar. Cuando corresponda, registra por separado la aceptación o el rechazo del cliente.'),
    ]
  }

  const introduction = props.modification
    ? 'Revisa la cotización que quieres modificar. Cambia únicamente los datos necesarios y envía tu solicitud a Pricing; la tarifa original no se modifica directamente.'
    : 'Completa las pantallas 1 a 4 y envía la solicitud. Los campos obligatorios se señalan en rojo y no se puede enviar una solicitud incompleta.'

  const steps: TourStep[] = [
    tourStep('[data-seller-guide="request-intro"]',
      props.modification ? 'Solicitar una modificación' : 'Solicitar una cotización', introduction),
    tourStep('.crystal-stepbar',
      'Pantallas de tu solicitud',
      'Puedes revisar modalidad, tipo de embarque, ruta y carga. Pricing se encarga de las pantallas de costos posteriores.'),
  ]
  if (props.step === 3) {
    steps.push(
      tourStep('[data-required-field="client"]', 'Cliente y ejecutivo',
        'Indica el nombre del cliente y verifica el ejecutivo. Solo se enviarán los datos de tu solicitud.'),
      tourStep('[data-required-field="originId"]', 'Ruta logística',
        'Selecciona POL, POE y, para FCL o LCL marítimo, también el POD obligatorio.'),
      tourStep('[data-required-field="podId"]', 'Destino final (POD)',
        'Este campo es obligatorio en embarques marítimos FCL y LCL, incluso si el POE ya está seleccionado.'),
      tourStep('.crystal-panel', 'Equipo, Incoterm y servicios',
        'Elige el equipo y la cantidad, el Incoterm y los servicios solicitados. Los pesos por contenedor se capturan en su distribución.'),
    )
  } else if (props.step === 4) {
    steps.push(
      tourStep('[data-required-field="cargoValue"]', 'Valor declarado y seguro',
        'Si agregas Seguro de carga, debes indicar un valor declarado mayor que cero.'),
      tourStep('[data-required-field="cargoWeightKg"]', 'Peso obligatorio',
        'Cada línea de carga debe tener peso total positivo. No multipliques el peso por la cantidad: Dhole suma los pesos de las líneas.'),
      tourStep('.crystal-panel', 'Medidas y cantidades',
        'Para cada línea, indica cantidad, largo, ancho y alto. El tamaño se expresa según la unidad seleccionada; nunca uses valores negativos.'),
    )
  } else {
    steps.push(tourStep('.crystal-panel', 'Completa esta pantalla',
      'Selecciona la información solicitada. Al avanzar, Dhole te mostrará qué campos obligatorios faltan.'))
  }
  steps.push(tourStep('.crystal-footer', 'Continuar o enviar',
    'Al intentar continuar, los campos incompletos se marcan en rojo y se muestra un aviso. En la última pantalla, envía la solicitud a Pricing.'))
  return steps
}

async function startTour() {
  if (loading.value) return
  loading.value = true
  try {
    const factory = await loadDriver()
    currentTour?.destroy()
    currentTour = factory({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.65,
      stagePadding: 8,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      progressText: '{{current}} de {{total}}',
      popoverClass: 'dhole-seller-guide-popover',
      steps: buildSteps(),
    })
    currentTour.drive()
  } catch {
    toast.warning('Tutorial no disponible',
      'No se pudo cargar Driver.js. Revisa tu conexión o el bloqueo de recursos externos y vuelve a intentarlo.')
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => { currentTour?.destroy() })
</script>

<template>
  <DhButton
    variant="secondary"
    size="sm"
    :loading="loading"
    :disabled="loading"
    :label="props.context === 'request'
      ? (props.modification ? 'Tutorial: solicitar modificación' : 'Tutorial: solicitar tarifa')
      : props.context === 'detail' ? 'Tutorial de la cotización' : 'Tutorial de ventas'"
    @click="startTour"
  />
</template>
