# Changelog

## [1.3.6] - 2026-11-06

- Coloca el nombre del cliente debajo de la QUO, en una línea propia con todo el ancho disponible, tanto en escritorio como en móvil.
- Evita que los nombres se compriman letra por letra en la lista de tarifas; añade una prueba de regresión del diseño.
- Incrementa DholeWeb a 1.3.6 (PATCH) y registra el release global Dhole 1.3.13 (DH-20261106-PRICING-QUO-CLIENT-015).

## [1.3.5] - 2026-11-06

- Muestra «Completada · requiere revisión» cuando Ollama terminó y falló una etapa posterior, sin llamar «Fallida» a la ejecución del modelo.
- Añade contador independiente de trabajos pendientes de revisión y mantiene los fallos reales en su categoría.
- Traduce los nuevos estados y explicaciones en español e inglés, incluyendo móvil y escritorio.
- Incluye regresiones para estado operativo y traducciones, con release global Dhole 1.3.11 (DH-20261106-AI-COMPLETED-REVIEW-013).

## [1.3.4] - 2026-11-06

- Separa Guardar tarifa de Enviar revisión al vendedor sin crear revisiones duplicadas.
- Valida la existencia de la función de envío después de las transformaciones del wizard y antes de compilar Vue; incorpora regresiones en CI.
- Renueva los recursos del frontend con versión PATCH para evitar un paquete JavaScript obsoleto.

## [1.3.3] - 2026-11-06

- Separates saving a Pricing seller-modification revision from explicitly sending it; the request remains open after save.
- Prevents the wizard from treating a backend auto-closed request as a successful send, and avoids duplicate quote revisions.
- Requires the operator to choose a cancellation reason and transmits explicit seller-modification cancellation intent.
- Adds regression checks for explicit completion, cancellation, and request dashboard refresh.


## [1.3.2] - 2026-11-06

- Corrige que Configuración desaparezca en celular: botón visible en la barra superior y acceso secundario en el menú lateral.
- Traduce de forma reactiva la bandeja de correos de Pricing, sus filtros, tablas, estados y panel de detalle, sin utilizar IA para traducir.
- Respeta EN/ES en fechas, estados de extracción y acciones; corrige la traducción invertida de «Operations Platform».
- Asegura tarjetas móviles para tablas operativas bajo 640 px y evita desbordamientos en el detalle del correo.
- Añade pruebas de regresión i18n/responsive y verificación obligatoria de CI.

## [1.3.1] - 2026-11-06

- Elimina la traducción por IA, su botón, eventos y dependencias de contenido.
- Completa traducciones ES/EN en navegación, dashboards, reportes y solicitudes de Pricing; formatos de fechas según idioma activo.
- Corrige responsive en celulares: barra de navegación, pestañas, formularios, tablas, modales y drawers; evita que el resumen fijo tape las acciones.
- Incorpora pruebas de regresión de idioma y diseño móvil en CI.

## [1.3.0] - 2026-11-05

- Convierte «Otras pestañas» en un panel integrado que no cubre el contenido, con navegación y cierre accesibles.
- Integra versiones verificadas del servicio y versiones declaradas en el manifiesto del release, señalando su origen.
- Agrega validaciones y pruebas de regresión para ambos cambios.

## [1.2.4] - 2026-11-05

- Actualiza DholeWeb SemVer 1.2.4 y manifiesto al release global Dhole 1.3.1.
- Verifica versión real del bundle sin número fijo y mantiene despliegue automático master/develop.

## [1.2.3] - 2026-11-05

- Asegurar que el botón Asignar IDTRA aparezca en Pantalla 9 para tarifas aceptadas sin identificador válido, incluyendo marcadores heredados como Pendiente.
- Separar visibilidad de permisos: si faltan permisos, mostrar botón deshabilitado con explicación.
- Validar en CI que el botón esté presente en el JavaScript final generado por Vite.

## [1.2.2] - 2026-11-05

- Corregir el error `if is already defined` que impedia iniciar el workflow de produccion.
- Restaurar la ejecucion del despliegue al integrar cambios en master, conservando la opcion de lanzamiento manual.
- Agregar una prueba de regresion para validar los disparadores y evitar condiciones duplicadas en el job.

## [1.2.1] - 2026-11-05

- Habilitar la asignación del IDTRA en la tarjeta Identificación de Pantalla 9, reutilizando el modal y endpoint existente para cotizaciones aceptadas sin IDTRA y refrescando los datos al guardar.

- Mostrar el cliente junto al número QUO con mayor jerarquía visual en escritorio y móvil.
- Ampliar la columna Tarifa sin perder etiquetas REV, SPOT/TARIFA, ruta ni IDTRA.

## [1.2.0] - 2026-11-05

- Add universal version governance, GitHub Actions release gate and permanent Codex policy.
- Synchronize DholeWeb version with the ecosystem release batch.

## [1.1.0] - 2026-11-05

- Mejoras responsive en formularios, tablas, diálogos y barra superior.
- Traducción unificada mediante diccionarios i18n de los módulos registrados.
- Traducción voluntaria de contenido visible con Dhole AI, con restauración del original y sin modificar formularios.

## [1.0.0] - 2026-11-04

- Inicio del versionamiento formal de Dhole Web bajo MAJOR.MINOR.PATCH.
- Información de versión y compilación visible en el sistema.
- Scripts para validación, actualización y registro de futuras versiones.

